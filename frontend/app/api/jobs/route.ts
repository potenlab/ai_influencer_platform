import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/app/lib/auth';
import { supabaseAdmin } from '@/app/lib/supabase-server';
import { handleError } from '@/app/lib/api-utils';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    // Mark stale processing jobs (>1 hour) as failed
    await supabaseAdmin
      .from('jobs')
      .update({
        status: 'failed',
        error_message: 'Job timed out (stale)',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('status', 'processing')
      .lt('updated_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());

    // Also mark stale pending jobs (never submitted, >1 hour) as failed
    await supabaseAdmin
      .from('jobs')
      .update({
        status: 'failed',
        error_message: 'Job timed out (never submitted)',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .is('fal_request_id', null)
      .lt('updated_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());

    // Fetch active jobs (pending + processing)
    const { data: jobs, error } = await supabaseAdmin
      .from('jobs')
      .select(`
        id,
        job_type,
        status,
        input_data,
        result_data,
        error_message,
        created_at,
        updated_at,
        character_id,
        characters (
          name,
          image_path
        )
      `)
      .eq('user_id', user.id)
      .in('status', ['pending', 'processing'])
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    // Map to frontend-friendly shape
    const mapped = (jobs || []).map((job) => {
      const inputData = (job.input_data || {}) as Record<string, unknown>;
      const char = job.characters as unknown as { name: string; image_path: string } | null;

      // Determine the display prompt based on job_type
      let displayPrompt = '';
      if (job.job_type === 'video_final') {
        displayPrompt = (inputData.concept as string) || (inputData.video_prompt as string) || '';
      } else if (job.job_type === 'video_motion') {
        displayPrompt = (inputData.prompt as string) || '';
      } else if (job.job_type === 'shots') {
        displayPrompt = (inputData.prompt as string) || '';
      } else if (job.job_type === 'image') {
        displayPrompt = (inputData.prompt as string) || '';
      }

      return {
        job_id: job.id,
        job_type: job.job_type,
        status: job.status,
        character_name: char?.name || 'Unknown',
        character_image_path: char?.image_path || '',
        prompt: displayPrompt,
        first_frame_path: (inputData.first_frame_path as string) || undefined,
        result_data: job.result_data,
        error_message: job.error_message,
        created_at: job.created_at,
      };
    });

    return NextResponse.json(mapped);
  } catch (error: unknown) {
    return handleError(error);
  }
}
