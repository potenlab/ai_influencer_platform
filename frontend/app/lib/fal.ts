import { fal } from '@fal-ai/client';

let _configured = false;
function ensureConfig() {
  if (!_configured) {
    fal.config({ credentials: process.env.FAL_KEY! });
    _configured = true;
  }
}

// ── Re-upload external URL to fal.ai storage ──
// Kling cannot read Supabase storage URLs directly, so we proxy through fal storage.
export async function uploadToFalStorage(externalUrl: string): Promise<string> {
  ensureConfig();
  const response = await fetch(externalUrl);
  if (!response.ok) throw new Error(`Failed to fetch ${externalUrl}`);
  const buffer = await response.arrayBuffer();
  const contentType = response.headers.get('content-type') || 'application/octet-stream';
  const ext = externalUrl.split('.').pop()?.split('?')[0] || 'bin';
  const file = new File([buffer], `upload.${ext}`, { type: contentType });
  return await fal.storage.upload(file);
}

// ── Async queue submit (for long-running video generation) ──

export interface QueueSubmitResult {
  request_id: string;
}

export async function submitVideoToQueue(
  model: string,
  input: Record<string, any>,
  webhookUrl: string
): Promise<QueueSubmitResult> {
  ensureConfig();
  const result = await fal.queue.submit(model, {
    input,
    webhookUrl,
  });
  return { request_id: result.request_id };
}
