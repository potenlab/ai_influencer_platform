import { NextResponse } from 'next/server';
import { requireAuth } from '@/app/lib/auth';
import { supabaseAdmin } from '@/app/lib/supabase-server';
import { submitVideoToQueue } from '@/app/lib/fal';
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
    const { character_id, first_frame_path, video_prompt, concept } = body;

    if (!character_id || !first_frame_path || !video_prompt) {
      return NextResponse.json(
        { error: 'character_id, first_frame_path, and video_prompt are required' },
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

    // Determine video duration via LLM (fast operation, within timeout)
    const duration = await determineVideoDuration(video_prompt);

    const jobId = genJobId();
    const webhookUrl = getWebhookUrl();

    const falModel = first_frame_path
      ? 'xai/grok-imagine-video/image-to-video'
      : 'xai/grok-imagine-video/text-to-video';

    const falInput: Record<string, any> = {
      prompt: video_prompt,
      duration: Math.min(duration, 15),
      aspect_ratio: '9:16',
      resolution: '720p',
    };
    if (first_frame_path) {
      falInput.image_url = first_frame_path;
    }

    // Create job row
    await supabaseAdmin.from('jobs').insert({
      id: jobId,
      user_id: user.id,
      character_id,
      job_type: 'video_final',
      status: 'pending',
      input_data: { first_frame_path, video_prompt, concept, duration },
    });

    // Submit to FAL queue (returns immediately)
    const { request_id } = await submitVideoToQueue(falModel, falInput, webhookUrl);

    // Update job with request_id
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
