import { fal } from '@fal-ai/client';

let _configured = false;
function ensureConfig() {
  if (!_configured) {
    fal.config({ credentials: process.env.FAL_KEY! });
    _configured = true;
  }
}

export async function generateCharacterImage(
  prompt: string,
  spicy = false
): Promise<string> {
  ensureConfig();
  const model = spicy ? 'xai/grok-imagine-image' : 'fal-ai/nano-banana-pro';
  const result = await fal.run(model, {
    input: { prompt, image_size: 'square_hd', num_images: 1 } as any,
  });
  return (result as any).data.images[0].url;
}

export async function generateSceneImage(
  prompt: string,
  imageUrls: string[],
  spicy = false
): Promise<string> {
  ensureConfig();
  const model = spicy ? 'xai/grok-imagine-image/edit' : 'fal-ai/nano-banana-pro/edit';
  const result = await fal.run(model as any, {
    input: {
      prompt,
      image_urls: imageUrls,
      num_images: 1,
      aspect_ratio: '9:16',
      resolution: '2K',
    } as any,
  });
  return (result as any).data.images[0].url;
}

export async function uploadToFal(
  fileBuffer: Uint8Array | ArrayBuffer,
  contentType: string
): Promise<string> {
  ensureConfig();
  const blob = new Blob([fileBuffer as BlobPart], { type: contentType });
  const url = await fal.storage.upload(blob);
  return url;
}

export async function generateVideo(
  prompt: string,
  duration: number,
  imageUrl?: string
): Promise<string> {
  ensureConfig();
  if (imageUrl) {
    const result = await fal.subscribe('xai/grok-imagine-video/image-to-video', {
      input: {
        prompt,
        image_url: imageUrl,
        duration: Math.min(duration, 15),
        aspect_ratio: '9:16',
        resolution: '720p',
      },
      logs: true,
    });
    return (result as any).data.video.url;
  } else {
    const result = await fal.subscribe('xai/grok-imagine-video/text-to-video', {
      input: {
        prompt,
        duration: Math.min(duration, 15),
        aspect_ratio: '9:16',
        resolution: '720p',
      },
      logs: true,
    });
    return (result as any).data.video.url;
  }
}

export async function generateDreamactorVideo(
  faceImageUrl: string,
  drivingVideoUrl: string
): Promise<string> {
  ensureConfig();
  const result = await fal.subscribe('fal-ai/bytedance/dreamactor/v2', {
    input: {
      face_image_url: faceImageUrl,
      driving_video_url: drivingVideoUrl,
    },
    logs: true,
  });
  return (result as any).data.video.url;
}

export async function generateMotionControlVideo(
  imageUrl: string,
  videoUrl: string,
  prompt: string
): Promise<string> {
  ensureConfig();
  const result = await fal.subscribe(
    'fal-ai/kling-video/v2.6/standard/motion-control',
    {
      input: {
        image_url: imageUrl,
        video_url: videoUrl,
        prompt,
        character_orientation: 'video',
      },
      logs: true,
    }
  );
  return (result as any).data.video.url;
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
