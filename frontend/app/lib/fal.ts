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

// ── Poll FAL queue for video generation status ──
export async function falPollVideo(
  requestId: string,
  endpointId = 'fal-ai/kling-video/v2.6/standard/motion-control'
): Promise<{ status: string; videoUrl?: string; error?: string }> {
  ensureConfig();
  try {
    const queueStatus = await fal.queue.status(endpointId, { requestId });
    if (queueStatus.status === 'COMPLETED') {
      const result = await fal.queue.result(endpointId, { requestId });
      const data = result.data as Record<string, unknown>;
      const video = data?.video as Record<string, unknown> | undefined;
      const videoUrl = video?.url as string | undefined;
      return videoUrl
        ? { status: 'done', videoUrl }
        : { status: 'failed', error: 'No video URL in FAL result' };
    }
    return { status: 'processing' };
  } catch (err: unknown) {
    // Extract detailed error message from FAL validation errors
    const falErr = err as { body?: { detail?: Array<{ msg?: string }> } };
    const detail = falErr?.body?.detail?.[0]?.msg;
    const message = detail || (err instanceof Error ? err.message : String(err)) || 'FAL poll error';
    return { status: 'failed', error: message };
  }
}

export async function submitVideoToQueue(
  model: string,
  input: Record<string, unknown>,
  webhookUrl: string
): Promise<QueueSubmitResult> {
  ensureConfig();
  const result = await fal.queue.submit(model, {
    input,
    webhookUrl,
  });
  return { request_id: result.request_id };
}
