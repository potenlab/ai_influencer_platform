import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-server';
import { uploadMediaFromUrl } from '@/app/lib/storage';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { request_id, status, payload, error: falError } = body;

    if (!request_id) {
      return NextResponse.json({ error: 'Missing request_id' }, { status: 400 });
    }

    // Find job by fal_request_id
    const { data: job, error: jobError } = await supabaseAdmin
      .from('jobs')
      .select('*')
      .eq('fal_request_id', request_id)
      .single();

    if (jobError || !job) {
      console.error('Webhook: job not found for request_id', request_id);
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Skip if job was already completed by polling
    if (job.status === 'completed') {
      return NextResponse.json({ ok: true });
    }

    if (status === 'OK' && payload) {
      // Extract video URL from FAL result
      const videoUrl = payload?.video?.url;
      if (!videoUrl) {
        await supabaseAdmin
          .from('jobs')
          .update({
            status: 'failed',
            error_message: 'No video URL in FAL response',
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id);
        return NextResponse.json({ ok: true });
      }

      // Upload video to Supabase Storage
      const videoPath = await uploadMediaFromUrl(videoUrl, 'videos', 'mp4');

      // Build media record based on job type
      const inputData = job.input_data || {};
      const mediaRecord: Record<string, unknown> = {
        character_id: job.character_id,
        user_id: job.user_id,
        media_type: 'video',
        file_path: videoPath,
        created_at: new Date().toISOString(),
      };

      if (job.job_type === 'video_final') {
        mediaRecord.generation_mode = 'video';
        mediaRecord.prompt = inputData.concept;
        mediaRecord.video_prompt = inputData.video_prompt;
        mediaRecord.first_frame_path = inputData.first_frame_path;
      } else if (job.job_type === 'video_motion') {
        mediaRecord.generation_mode = 'motion_control';
        mediaRecord.prompt = inputData.prompt;
      }

      // Save media record
      const { data: media, error: mediaError } = await supabaseAdmin
        .from('media')
        .insert(mediaRecord)
        .select()
        .single();

      if (mediaError) {
        console.error('Webhook: failed to create media record', mediaError);
      }

      // Update job to completed
      await supabaseAdmin
        .from('jobs')
        .update({
          status: 'completed',
          result_data: {
            media_id: media?.id,
            video_path: videoPath,
            first_frame_path: inputData.first_frame_path || null,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id);
    } else {
      // FAL error
      const errorMsg = falError || body?.error_message || 'Unknown FAL error';
      const errStr = typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg);
      await supabaseAdmin
        .from('jobs')
        .update({
          status: 'failed',
          error_message: errStr,
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id);

      // Insert failed media record so it persists in history
      const inputData = job.input_data || {};
      const failedMediaRecord: Record<string, unknown> = {
        character_id: job.character_id,
        user_id: job.user_id,
        media_type: 'video',
        file_path: null,
        status: 'failed',
        error_message: errStr,
        created_at: new Date().toISOString(),
      };
      if (job.job_type === 'video_final') {
        failedMediaRecord.generation_mode = 'video';
        failedMediaRecord.prompt = inputData.concept;
        failedMediaRecord.video_prompt = inputData.video_prompt;
        failedMediaRecord.first_frame_path = inputData.first_frame_path;
      } else if (job.job_type === 'video_motion') {
        failedMediaRecord.generation_mode = 'motion_control';
        failedMediaRecord.prompt = inputData.prompt;
      }
      await supabaseAdmin.from('media').insert(failedMediaRecord);
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
