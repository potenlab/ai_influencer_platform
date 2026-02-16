import { supabaseAdmin } from './supabase-server';

function genId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

export async function uploadMediaFromUrl(
  url: string,
  folder: string,
  extension: string
): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download from ${url}`);
  const buffer = await response.arrayBuffer();

  const filename = `${folder}/${genId()}.${extension}`;

  const contentType =
    extension === 'mp4'
      ? 'video/mp4'
      : extension === 'png'
        ? 'image/png'
        : extension === 'jpg'
          ? 'image/jpeg'
          : 'image/webp';

  const { error } = await supabaseAdmin.storage
    .from('media')
    .upload(filename, buffer, {
      contentType,
      upsert: false,
    });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const {
    data: { publicUrl },
  } = supabaseAdmin.storage.from('media').getPublicUrl(filename);
  return publicUrl;
}

export async function uploadMediaFromBuffer(
  buffer: ArrayBuffer | Buffer,
  folder: string,
  extension: string,
  contentType: string
): Promise<string> {
  const filename = `${folder}/${genId()}.${extension}`;

  const { error } = await supabaseAdmin.storage
    .from('media')
    .upload(filename, buffer, {
      contentType,
      upsert: false,
    });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const {
    data: { publicUrl },
  } = supabaseAdmin.storage.from('media').getPublicUrl(filename);
  return publicUrl;
}
