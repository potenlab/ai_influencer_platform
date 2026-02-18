import { NextResponse } from 'next/server';
import { requireAuth } from '@/app/lib/auth';
import { supabaseAdmin } from '@/app/lib/supabase-server';
import { handleError } from '@/app/lib/api-utils';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;

    const { data, error } = await supabaseAdmin
      .from('characters')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Character not found' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return handleError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;
    const body = await request.json();
    const { image_path } = body;

    if (!image_path || typeof image_path !== 'string') {
      return NextResponse.json(
        { error: 'image_path (string) is required' },
        { status: 400 }
      );
    }

    // Verify character belongs to user
    const { data: character, error: fetchError } = await supabaseAdmin
      .from('characters')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !character) {
      return NextResponse.json({ error: 'Character not found' }, { status: 404 });
    }

    const { error: updateError } = await supabaseAdmin
      .from('characters')
      .update({ image_path })
      .eq('id', id);

    if (updateError) throw new Error(updateError.message);

    return NextResponse.json({ success: true, image_path });
  } catch (error: any) {
    return handleError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;

    // Verify character belongs to user
    const { data: character, error: fetchError } = await supabaseAdmin
      .from('characters')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !character) {
      return NextResponse.json({ error: 'Character not found' }, { status: 404 });
    }

    // Delete related media records
    await supabaseAdmin
      .from('media')
      .delete()
      .eq('character_id', id);

    // Delete related content plans
    await supabaseAdmin
      .from('content_plans')
      .delete()
      .eq('character_id', id);

    // Delete the character
    const { error: deleteError } = await supabaseAdmin
      .from('characters')
      .delete()
      .eq('id', id);

    if (deleteError) throw new Error(deleteError.message);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return handleError(error);
  }
}
