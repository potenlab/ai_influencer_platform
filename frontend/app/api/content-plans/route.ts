import { NextResponse } from 'next/server';
import { requireAuth } from '@/app/lib/auth';
import { supabaseAdmin } from '@/app/lib/supabase-server';
import { generateContentPlan } from '@/app/lib/openrouter';
import { handleError } from '@/app/lib/api-utils';

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);

    const { searchParams } = new URL(request.url);
    const characterId = searchParams.get('character_id');

    let query = supabaseAdmin
      .from('content_plans')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (characterId) {
      query = query.eq('character_id', characterId);
    }

    const { data, error } = await query;

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
    const { character_id, theme } = body;

    if (!character_id || !theme) {
      return NextResponse.json(
        { error: 'character_id and theme are required' },
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

    // Generate content plan via LLM
    const planData = await generateContentPlan(character, theme);

    const { data, error } = await supabaseAdmin
      .from('content_plans')
      .insert({
        character_id,
        user_id: user.id,
        theme,
        plan_data: planData,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    return handleError(error);
  }
}
