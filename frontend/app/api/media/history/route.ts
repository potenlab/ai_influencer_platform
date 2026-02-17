import { NextResponse } from 'next/server';
import { requireAuth } from '@/app/lib/auth';
import { supabaseAdmin } from '@/app/lib/supabase-server';
import { handleError } from '@/app/lib/api-utils';

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);

    const { searchParams } = new URL(request.url);
    const characterId = searchParams.get('character_id');
    const mediaType = searchParams.get('media_type');
    const isPortfolio = searchParams.get('is_portfolio');

    let query = supabaseAdmin
      .from('media')
      .select(`
        *,
        characters!media_character_id_fkey (
          id,
          name,
          image_path
        ),
        content_plans!media_plan_id_fkey (
          title,
          theme,
          hook,
          first_frame_prompt,
          video_prompt,
          call_to_action,
          duration_seconds
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (characterId) {
      query = query.eq('character_id', characterId);
    }

    if (mediaType) {
      query = query.eq('media_type', mediaType);
    }

    if (isPortfolio === 'true') {
      query = query.eq('is_portfolio', true);
    } else if (isPortfolio === 'false') {
      query = query.eq('is_portfolio', false);
    }

    const { data, error } = await query;

    if (error) throw new Error(error.message);

    // Flatten joined data to match frontend HistoryMedia interface
    const flattened = (data || []).map((row: any) => {
      const char = row.characters || {};
      const plan = row.content_plans || {};
      return {
        id: row.id,
        plan_id: row.plan_id,
        media_type: row.media_type,
        file_path: row.file_path,
        created_at: row.created_at,
        character_id: row.character_id,
        character_name: char.name || '',
        character_image_path: char.image_path || '',
        generation_mode: row.generation_mode,
        prompt: row.prompt,
        video_prompt: row.video_prompt,
        first_frame_path: row.first_frame_path,
        reference_image_path: row.reference_image_path,
        is_portfolio: row.is_portfolio ?? true,
        plan_title: plan.title || null,
        plan_theme: plan.theme || null,
        hook: plan.hook || null,
        plan_first_frame_prompt: plan.first_frame_prompt || null,
        plan_video_prompt: plan.video_prompt || null,
        call_to_action: plan.call_to_action || null,
        duration_seconds: plan.duration_seconds || null,
      };
    });

    return NextResponse.json(flattened);
  } catch (error: any) {
    return handleError(error);
  }
}
