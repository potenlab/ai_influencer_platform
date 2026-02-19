import { NextResponse } from 'next/server';
import { requireAuth } from '@/app/lib/auth';
import { supabaseAdmin } from '@/app/lib/supabase-server';
import { generateShotImage } from '@/app/lib/image-gen';
import { uploadMediaFromUrl } from '@/app/lib/storage';
import { handleError } from '@/app/lib/api-utils';

export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const { job_id } = body;

    if (!job_id) {
      return NextResponse.json({ error: 'job_id is required' }, { status: 400 });
    }

    // Get job from DB
    const { data: job, error: jobError } = await supabaseAdmin
      .from('jobs')
      .select('*')
      .eq('id', job_id)
      .eq('user_id', user.id)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    if (job.job_type !== 'shots') {
      return NextResponse.json({ error: 'Invalid job type' }, { status: 400 });
    }

    // Update status to processing
    await supabaseAdmin
      .from('jobs')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', job_id);

    const inputData = job.input_data || {};
    const { prompt, source_image_path, spicy } = inputData;

    try {
      // Generate the shot image
      const resultUrl = await generateShotImage(prompt, source_image_path, !!spicy);

      // Upload to storage
      const publicUrl = await uploadMediaFromUrl(resultUrl, 'images', 'png');

      // Save media record
      const { data: media } = await supabaseAdmin
        .from('media')
        .insert({
          character_id: job.character_id,
          user_id: job.user_id,
          media_type: 'image',
          file_path: publicUrl,
          generation_mode: 'shots',
          prompt,
          reference_image_path: source_image_path,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      // Update job to completed
      await supabaseAdmin
        .from('jobs')
        .update({
          status: 'completed',
          result_data: {
            media_id: media?.id,
            file_path: publicUrl,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', job_id);

      return NextResponse.json({ status: 'completed', media_id: media?.id, file_path: publicUrl });
    } catch (genError: unknown) {
      // Mark job as failed
      const errorMessage = genError instanceof Error ? genError.message : 'Shot generation failed';
      await supabaseAdmin
        .from('jobs')
        .update({
          status: 'failed',
          error_message: errorMessage,
          updated_at: new Date().toISOString(),
        })
        .eq('id', job_id);

      return NextResponse.json({ status: 'failed', error: errorMessage }, { status: 500 });
    }
  } catch (error: unknown) {
    return handleError(error);
  }
}
