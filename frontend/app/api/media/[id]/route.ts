import { NextResponse } from 'next/server';
import { requireAuth } from '@/app/lib/auth';
import { supabaseAdmin } from '@/app/lib/supabase-server';
import { handleError } from '@/app/lib/api-utils';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;
    const body = await request.json();
    const { is_portfolio } = body;

    if (typeof is_portfolio !== 'boolean') {
      return NextResponse.json(
        { error: 'is_portfolio (boolean) is required' },
        { status: 400 }
      );
    }

    // Verify ownership
    const { data: media, error: fetchError } = await supabaseAdmin
      .from('media')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !media) {
      return NextResponse.json({ error: 'Media not found' }, { status: 404 });
    }

    const { error: updateError } = await supabaseAdmin
      .from('media')
      .update({ is_portfolio })
      .eq('id', id);

    if (updateError) throw new Error(updateError.message);

    return NextResponse.json({ success: true, is_portfolio });
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

    // Verify ownership
    const { data: media, error: fetchError } = await supabaseAdmin
      .from('media')
      .select('id, file_path')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !media) {
      return NextResponse.json({ error: 'Media not found' }, { status: 404 });
    }

    const { error: deleteError } = await supabaseAdmin
      .from('media')
      .delete()
      .eq('id', id);

    if (deleteError) throw new Error(deleteError.message);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return handleError(error);
  }
}
