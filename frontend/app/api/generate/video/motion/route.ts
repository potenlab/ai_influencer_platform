import { NextResponse } from 'next/server';
import { requireAuth } from '@/app/lib/auth';
import { supabaseAdmin } from '@/app/lib/supabase-server';
import { submitVideoToQueue, uploadToFalStorage } from '@/app/lib/fal';
import { handleError } from '@/app/lib/api-utils';

export const maxDuration = 120;

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
    const { character_id, prompt, driving_video_url, image_path, spicy } = body;

    if (!character_id || !prompt || !driving_video_url) {
      return NextResponse.json(
        { error: 'character_id, prompt, and driving_video_url are required' },
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

    // Create job row
    await supabaseAdmin.from('jobs').insert({
      id: jobId,
      user_id: user.id,
      character_id,
      job_type: 'video_motion',
      status: 'pending',
      input_data: { prompt, driving_video_url, image_path: image_path || character.image_path, spicy: !!spicy },
    });

    // Re-upload to fal.ai storage (Kling cannot read Supabase URLs directly)
    const resolvedImagePath = image_path || character.image_path;
    const [falImageUrl, falVideoUrl] = await Promise.all([
      uploadToFalStorage(resolvedImagePath),
      uploadToFalStorage(driving_video_url),
    ]);

    // Submit to FAL queue (returns immediately)
    const { request_id } = await submitVideoToQueue(
      'fal-ai/kling-video/v2.6/standard/motion-control',
      {
        image_url: falImageUrl,
        video_url: falVideoUrl,
        prompt,
        character_orientation: 'video',
      },
      webhookUrl
    );

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
  } catch (error: unknown) {
    return handleError(error);
  }
}
