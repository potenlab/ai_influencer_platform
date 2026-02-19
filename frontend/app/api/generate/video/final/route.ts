import { NextResponse } from 'next/server';
import { requireAuth } from '@/app/lib/auth';
import { supabaseAdmin } from '@/app/lib/supabase-server';
import { xaiSubmitVideo } from '@/app/lib/xai';
import { determineVideoDuration } from '@/app/lib/openrouter';
import { handleError } from '@/app/lib/api-utils';

function genJobId(): string {
  return 'job_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
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

    // Determine video duration via LLM
    const duration = await determineVideoDuration(video_prompt);

    const jobId = genJobId();

    // Create job row
    await supabaseAdmin.from('jobs').insert({
      id: jobId,
      user_id: user.id,
      character_id,
      job_type: 'video_final',
      status: 'pending',
      input_data: { first_frame_path, video_prompt, concept, duration },
    });

    // Submit to xAI directly (returns request_id)
    const requestId = await xaiSubmitVideo(
      video_prompt,
      duration,
      first_frame_path || undefined
    );

    // Update job with xAI request_id
    await supabaseAdmin
      .from('jobs')
      .update({
        fal_request_id: requestId,
        status: 'processing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    return NextResponse.json({ job_id: jobId });
  } catch (error: unknown) {
    return handleError(error);
  }
}
