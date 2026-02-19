import { NextResponse } from 'next/server';
import { requireAuth } from '@/app/lib/auth';
import { supabaseAdmin } from '@/app/lib/supabase-server';
import { generateSceneImage } from '@/app/lib/image-gen';
import { uploadMediaFromUrl } from '@/app/lib/storage';
import { handleError } from '@/app/lib/api-utils';

export const maxDuration = 300;

function genJobId(): string {
  return 'job_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const { character_id, prompt, option, reference_image_path, spicy } = body;

    if (!character_id || !prompt) {
      return NextResponse.json(
        { error: 'character_id and prompt are required' },
        { status: 400 }
      );
    }

    // Get character from DB
    const { data: character, error: charError } = await supabaseAdmin
      .from('characters')
      .select('*')
      .eq('id', character_id)
      .eq('user_id', user.id)
      .single();

    if (charError || !character) {
      return NextResponse.json({ error: 'Character not found' }, { status: 404 });
    }

    // Create job row for tracking
    const jobId = genJobId();
    await supabaseAdmin.from('jobs').insert({
      id: jobId,
      user_id: user.id,
      character_id,
      job_type: 'image',
      status: 'processing',
      input_data: { prompt, option, reference_image_path: reference_image_path || null },
    });

    try {
      // Build image URLs array
      const imageUrls = [character.image_path];
      if (option === 'ref_image' && reference_image_path) {
        imageUrls.push(reference_image_path);
      }

      // Generate scene image
      console.log('[generate/image] imageUrls:', imageUrls.length, 'option:', option);
      const resultUrl = await generateSceneImage(prompt, imageUrls, !!spicy);
      console.log('[generate/image] resultUrl:', resultUrl?.slice(0, 100));

      // Upload to storage
      const publicUrl = await uploadMediaFromUrl(resultUrl, 'images', 'png');

      // Save media record
      const { data: media, error: mediaError } = await supabaseAdmin
        .from('media')
        .insert({
          character_id,
          user_id: user.id,
          media_type: 'image',
          file_path: publicUrl,
          generation_mode: option,
          prompt,
          reference_image_path: reference_image_path || null,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (mediaError) throw new Error(mediaError.message);

      // Mark job completed
      await supabaseAdmin
        .from('jobs')
        .update({
          status: 'completed',
          result_data: { media_id: media.id, file_path: publicUrl },
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      return NextResponse.json({
        job_id: jobId,
        media_id: media.id,
        file_path: publicUrl,
      });
    } catch (innerError: unknown) {
      // Mark job failed
      const errMsg = innerError instanceof Error ? innerError.message : String(innerError);
      await supabaseAdmin
        .from('jobs')
        .update({
          status: 'failed',
          error_message: errMsg,
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      throw innerError;
    }
  } catch (error: unknown) {
    return handleError(error);
  }
}
