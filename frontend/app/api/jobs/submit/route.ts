import { NextResponse } from 'next/server';
import { requireAuth } from '@/app/lib/auth';
import { supabaseAdmin } from '@/app/lib/supabase-server';
import { submitVideoToQueue, uploadToFalStorage } from '@/app/lib/fal';
import { determineVideoDuration } from '@/app/lib/openrouter';
import { handleError } from '@/app/lib/api-utils';

function genJobId(): string {
  return 'job_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
}

function getWebhookUrl(): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL;
  if (!base) throw new Error('NEXT_PUBLIC_SITE_URL or VERCEL_URL must be set for webhooks');
  const origin = base.startsWith('http') ? base : `https://${base}`;
  return `${origin}/api/webhooks/fal`;
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const { job_type, character_id, ...params } = body;

    if (!job_type || !character_id) {
      return NextResponse.json(
        { error: 'job_type and character_id are required' },
        { status: 400 }
      );
    }

    // Verify character ownership
    const { data: character, error: charError } = await supabaseAdmin
      .from('characters')
      .select('*')
      .eq('id', character_id)
      .eq('user_id', user.id)
      .single();

    if (charError || !character) {
      return NextResponse.json({ error: 'Character not found' }, { status: 404 });
    }

    const jobId = genJobId();
    const webhookUrl = getWebhookUrl();

    let falModel: string;
    let falInput: Record<string, any>;

    if (job_type === 'video_final') {
      const { first_frame_path, video_prompt, concept } = params;
      if (!first_frame_path || !video_prompt) {
        return NextResponse.json(
          { error: 'first_frame_path and video_prompt are required for video_final' },
          { status: 400 }
        );
      }

      // Determine duration via LLM (fast, within timeout)
      const duration = await determineVideoDuration(video_prompt);

      if (first_frame_path) {
        falModel = 'xai/grok-imagine-video/image-to-video';
        falInput = {
          prompt: video_prompt,
          image_url: first_frame_path,
          duration: Math.min(duration, 15),
          aspect_ratio: '9:16',
          resolution: '720p',
        };
      } else {
        falModel = 'xai/grok-imagine-video/text-to-video';
        falInput = {
          prompt: video_prompt,
          duration: Math.min(duration, 15),
          aspect_ratio: '9:16',
          resolution: '720p',
        };
      }

      // Create job row
      await supabaseAdmin.from('jobs').insert({
        id: jobId,
        user_id: user.id,
        character_id,
        job_type,
        status: 'pending',
        input_data: { first_frame_path, video_prompt, concept, duration },
      });

    } else if (job_type === 'video_motion') {
      const { prompt, driving_video_url } = params;
      if (!prompt || !driving_video_url) {
        return NextResponse.json(
          { error: 'prompt and driving_video_url are required for video_motion' },
          { status: 400 }
        );
      }

      falModel = 'fal-ai/kling-video/v2.6/standard/motion-control';
      const [falImageUrl, falVideoUrl] = await Promise.all([
        uploadToFalStorage(character.image_path),
        uploadToFalStorage(driving_video_url),
      ]);
      falInput = {
        image_url: falImageUrl,
        video_url: falVideoUrl,
        prompt,
        character_orientation: 'video',
      };

      // Create job row
      await supabaseAdmin.from('jobs').insert({
        id: jobId,
        user_id: user.id,
        character_id,
        job_type,
        status: 'pending',
        input_data: { prompt, driving_video_url },
      });

    } else {
      return NextResponse.json({ error: `Unknown job_type: ${job_type}` }, { status: 400 });
    }

    // Submit to FAL queue
    const { request_id } = await submitVideoToQueue(falModel, falInput, webhookUrl);

    // Update job with fal_request_id and set status to processing
    await supabaseAdmin
      .from('jobs')
      .update({
        fal_request_id: request_id,
        status: 'processing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    return NextResponse.json({ job_id: jobId });
  } catch (error: any) {
    return handleError(error);
  }
}
