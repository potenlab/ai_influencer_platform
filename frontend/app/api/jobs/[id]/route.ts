import { NextResponse } from 'next/server';
import { requireAuth } from '@/app/lib/auth';
import { supabaseAdmin } from '@/app/lib/supabase-server';
import { xaiPollVideo } from '@/app/lib/xai';
import { falPollVideo } from '@/app/lib/fal';
import { uploadMediaFromUrl } from '@/app/lib/storage';
import { handleError } from '@/app/lib/api-utils';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;

    const { data: job, error } = await supabaseAdmin
      .from('jobs')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Shots jobs: no external polling needed, DB state is updated by /shots/run
    if (job.job_type === 'shots') {
      return NextResponse.json({
        id: job.id,
        job_type: job.job_type,
        status: job.status,
        result_data: job.result_data,
        error_message: job.error_message,
        created_at: job.created_at,
        updated_at: job.updated_at,
      });
    }

    // If still processing, poll xAI for status
    if (job.status === 'processing' && job.fal_request_id) {
      try {
        const poll = job.job_type === 'video_motion'
          ? await falPollVideo(job.fal_request_id)
          : await xaiPollVideo(job.fal_request_id);

        if (poll.status === 'failed') {
          await supabaseAdmin
            .from('jobs')
            .update({
              status: 'failed',
              error_message: poll.error || 'Video generation failed',
              updated_at: new Date().toISOString(),
            })
            .eq('id', job.id);

          return NextResponse.json({
            id: job.id,
            job_type: job.job_type,
            status: 'failed',
            result_data: null,
            error_message: poll.error || 'Video generation failed',
            created_at: job.created_at,
            updated_at: new Date().toISOString(),
          });
        }

        if (poll.status === 'done' && poll.videoUrl) {
          // Upload video to Supabase Storage
          const videoPath = await uploadMediaFromUrl(poll.videoUrl, 'videos', 'mp4');

          const inputData = job.input_data || {};
          const mediaRecord: Record<string, any> = {
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

          const { data: media } = await supabaseAdmin
            .from('media')
            .insert(mediaRecord)
            .select()
            .single();

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

          return NextResponse.json({
            id: job.id,
            job_type: job.job_type,
            status: 'completed',
            result_data: {
              media_id: media?.id,
              video_path: videoPath,
              first_frame_path: inputData.first_frame_path || null,
            },
            error_message: null,
            created_at: job.created_at,
            updated_at: new Date().toISOString(),
          });
        }
      } catch (pollErr: any) {
        console.error('xAI poll error:', pollErr.message);
        // Don't fail the request, just return current DB state
      }
    }

    return NextResponse.json({
      id: job.id,
      job_type: job.job_type,
      status: job.status,
      result_data: job.result_data,
      error_message: job.error_message,
      created_at: job.created_at,
      updated_at: job.updated_at,
    });
  } catch (error: any) {
    return handleError(error);
  }
}
