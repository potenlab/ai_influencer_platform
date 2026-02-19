import { NextResponse } from 'next/server';
import { requireAuth } from '@/app/lib/auth';
import { supabaseAdmin } from '@/app/lib/supabase-server';
import { generateVideoPrompt } from '@/app/lib/openrouter';
import { handleError } from '@/app/lib/api-utils';
import crypto from 'crypto';

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const { character_id, concept, first_frame_path } = body;

    if (!character_id || !concept || !first_frame_path) {
      return NextResponse.json(
        { error: 'character_id, concept, and first_frame_path are required' },
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

    // Generate video prompt via LLM
    const videoPrompt = await generateVideoPrompt(character, concept);

    const prepareId = crypto.randomUUID();

    return NextResponse.json({
      prepare_id: prepareId,
      first_frame_path: first_frame_path,
      video_prompt: videoPrompt,
    });
  } catch (error: unknown) {
    return handleError(error);
  }
}
