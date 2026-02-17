import { NextResponse } from 'next/server';
import { requireAuth } from '@/app/lib/auth';
import { supabaseAdmin } from '@/app/lib/supabase-server';
import { generateCharacterPersonality } from '@/app/lib/openrouter';
import { generateCharacterImage, generateSceneImage } from '@/app/lib/image-gen';
import { uploadMediaFromUrl } from '@/app/lib/storage';
import { handleError } from '@/app/lib/api-utils';

export const maxDuration = 300;

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);

    const { data, error } = await supabaseAdmin
      .from('characters')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    return NextResponse.json(data);
  } catch (error: any) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const { name, concept, audience, image_url, image_mode, spicy } = body;

    if (!name || !concept) {
      return NextResponse.json(
        { error: 'name and concept are required' },
        { status: 400 }
      );
    }

    const personality = await generateCharacterPersonality(concept, audience || 'General audience');

    const characterId = crypto.randomUUID();
    let imagePath: string;

    if (image_url && image_mode === 'direct') {
      imagePath = image_url;
    } else if (image_url && image_mode === 'generate') {
      const resultUrl = await generateSceneImage(personality.visual_description, [image_url]);
      imagePath = await uploadMediaFromUrl(resultUrl, 'images', 'png');
    } else {
      const resultUrl = await generateCharacterImage(personality.visual_description, !!spicy);
      imagePath = await uploadMediaFromUrl(resultUrl, 'images', 'png');
    }

    const characterData = {
      id: characterId,
      user_id: user.id,
      name,
      visual_description: personality.visual_description,
      personality_traits: personality.personality_traits || [],
      tone_of_voice: personality.tone_of_voice,
      content_style: personality.content_style,
      target_audience: audience || 'General audience',
      content_themes: personality.content_themes || [],
      image_path: imagePath,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
      .from('characters')
      .insert(characterData)
      .select()
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    return handleError(error);
  }
}
