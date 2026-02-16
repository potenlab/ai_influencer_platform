import { NextResponse } from 'next/server';
import { requireAuth } from '@/app/lib/auth';
import { uploadMediaFromBuffer } from '@/app/lib/storage';
import { handleError } from '@/app/lib/api-utils';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: Request) {
  try {
    await requireAuth(request);

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: png, jpg, jpeg, webp' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split('.').pop() || 'png';

    const publicUrl = await uploadMediaFromBuffer(
      buffer,
      'uploads',
      ext,
      file.type
    );

    return NextResponse.json({
      file_path: publicUrl,
      web_path: publicUrl,
    });
  } catch (error: any) {
    return handleError(error);
  }
}
