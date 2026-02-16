import { NextResponse } from 'next/server';
import { requireAuth } from '@/app/lib/auth';
import { supabaseAdmin } from '@/app/lib/supabase-server';
import { generateSceneImage } from '@/app/lib/fal';
import { generateVideoPrompt } from '@/app/lib/openrouter';
import { uploadMediaFromUrl } from '@/app/lib/storage';
import { handleError } from '@/app/lib/api-utils';
import crypto from 'crypto';

export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const { character_id, concept, option, reference_image_path, spicy } = body;

    if (!character_id || !concept) {
      return NextResponse.json(
        { error: 'character_id and concept are required' },
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

    // Build image URLs for first frame generation
    const imageUrls = [character.image_path];
    if (option === 'ref_image' && reference_image_path) {
      imageUrls.push(reference_image_path);
    }

    // Generate first frame image
    const firstFrameUrl = await generateSceneImage(concept, imageUrls, !!spicy);
    const firstFramePath = await uploadMediaFromUrl(firstFrameUrl, 'images', 'png');

    // Generate video prompt via LLM
    const videoPrompt = await generateVideoPrompt(character, concept);

    const prepareId = crypto.randomUUID();

    return NextResponse.json({
      prepare_id: prepareId,
      first_frame_path: firstFramePath,
      video_prompt: videoPrompt,
    });
  } catch (error: any) {
    return handleError(error);
  }
}
