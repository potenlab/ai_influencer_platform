import { fal } from '@fal-ai/client';

let _configured = false;
function ensureConfig() {
  if (!_configured) {
    fal.config({ credentials: process.env.FAL_KEY! });
    _configured = true;
  }
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
