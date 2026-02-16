import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/lib/auth';
import { supabaseAdmin } from '@/app/lib/supabase-server';
import { handleError } from '@/app/lib/api-utils';

export async function GET(request: Request) {
  try {
    await requireAdmin(request);

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    return NextResponse.json(data);
  } catch (error: any) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const body = await request.json();
    const { email, password, role } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'email and password are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: role || 'user' },
    });

    if (error) throw new Error(error.message);

    return NextResponse.json(
      {
        id: data.user.id,
        email: data.user.email,
        role: data.user.user_metadata?.role || 'user',
        created_at: data.user.created_at,
      },
      { status: 201 }
    );
  } catch (error: any) {
    return handleError(error);
  }
}
