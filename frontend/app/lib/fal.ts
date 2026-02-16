import { fal } from '@fal-ai/client';
import { describeImageForPrompt, generateSpicyPrompts } from './openrouter';

let _configured = false;
function ensureConfig() {
  if (!_configured) {
    fal.config({ credentials: process.env.FAL_KEY! });
    _configured = true;
  }
}

// ── xAI direct API helpers (for spicy mode) ──

async function xaiImageGenerate(prompt: string, aspectRatio = '1:1'): Promise<string> {
  const res = await fetch('https://api.x.ai/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.XAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'grok-imagine-image-pro',
      prompt,
      n: 1,
      aspect_ratio: aspectRatio,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`xAI image error ${res.status}: ${JSON.stringify(err)}`);
  }
  const data = await res.json();
  return data.data[0].url;
}

async function xaiImageEdit(prompt: string, imageUrl: string): Promise<string> {
  const res = await fetch('https://api.x.ai/v1/images/edits', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.XAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'grok-imagine-image-pro',
      prompt,
      image: { url: imageUrl, type: 'image_url' },
      n: 1,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`xAI image edit error ${res.status}: ${JSON.stringify(err)}`);
  }
  const data = await res.json();
  return data.data[0].url;
}

// ── Realistic style suffix ──

const REALISTIC_SUFFIX = ' — photorealistic style, ultra-realistic, natural skin texture, real photograph, studio-quality lighting';

function withRealisticStyle(prompt: string): string {
  return prompt + REALISTIC_SUFFIX;
}

// ── Public image generation functions ──

export async function generateCharacterImage(
  prompt: string,
  spicy = false
): Promise<string> {
  const styledPrompt = withRealisticStyle(prompt);
  if (spicy) {
    // Two-step: nano-banana-pro → grok edit
    console.log('[generateCharacterImage] spicy two-step: generating safe base with nano-banana-pro');
    const { safePrompt, spicyEditPrompt } = await generateSpicyPrompts(prompt);
    ensureConfig();
    const baseResult = await fal.run('fal-ai/nano-banana-pro', {
      input: { prompt: withRealisticStyle(safePrompt), image_size: 'square_hd', num_images: 1 } as any,
    });
    const baseUrl = (baseResult as any).data.images[0].url;
    if (spicyEditPrompt) {
      console.log('[generateCharacterImage] spicy two-step: editing with grok-imagine-image-pro');
      return xaiImageEdit(withRealisticStyle(spicyEditPrompt), baseUrl);
    }
    return baseUrl;
  }
  ensureConfig();
  const result = await fal.run('fal-ai/nano-banana-pro', {
    input: { prompt: styledPrompt, image_size: 'square_hd', num_images: 1 } as any,
  });
  return (result as any).data.images[0].url;
}

export async function generateSceneImage(
  prompt: string,
  imageUrls: string[],
  spicy = false
): Promise<string> {
  if (spicy) {
    // Two-step spicy: nano-banana-pro/edit → grok edit
    // Step 0: 참고이미지 있으면 LLM으로 설명 추출
    let refDescription: string | undefined;
    if (imageUrls.length > 1) {
      console.log('[generateSceneImage] spicy: describing reference image via LLM');
      refDescription = await describeImageForPrompt(imageUrls[1]);
    }

    // Step 1: Kimi가 safe prompt + spicy edit prompt 생성
    console.log('[generateSceneImage] spicy two-step: generating prompts via LLM');
    const { safePrompt, spicyEditPrompt } = await generateSpicyPrompts(prompt, refDescription);

    // Step 2: nano-banana-pro/edit로 safe 베이스 이미지 생성 (캐릭터 일관성 유지)
    console.log('[generateSceneImage] spicy two-step: generating safe base with nano-banana-pro/edit');
    ensureConfig();
    const baseResult = await fal.run('fal-ai/nano-banana-pro/edit' as any, {
      input: {
        prompt: withRealisticStyle(safePrompt),
        image_urls: imageUrls,
        num_images: 1,
        aspect_ratio: '9:16',
        resolution: '2K',
      } as any,
    });
    const baseUrl = (baseResult as any).data.images[0].url;

    // Step 3: spicy edit prompt이 있으면 grok으로 사람 부분만 spicy하게 편집
    if (spicyEditPrompt) {
      console.log('[generateSceneImage] spicy two-step: editing with grok-imagine-image-pro');
      return xaiImageEdit(withRealisticStyle(spicyEditPrompt), baseUrl);
    }
    return baseUrl;
  }
  // Mild: fal.ai nano-banana-pro
  const styledPrompt = withRealisticStyle(prompt);
  ensureConfig();
  const result = await fal.run('fal-ai/nano-banana-pro/edit' as any, {
    input: {
      prompt: styledPrompt,
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

// ── xAI direct video API ──

export async function xaiSubmitVideo(
  prompt: string,
  duration: number,
  imageUrl?: string
): Promise<string> {
  const body: Record<string, any> = {
    model: 'grok-imagine-video',
    prompt,
    duration: Math.min(duration, 15),
    aspect_ratio: '9:16',
    resolution: '720p',
  };
  if (imageUrl) {
    body.image = { url: imageUrl };
  }

  const res = await fetch('https://api.x.ai/v1/videos/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.XAI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`xAI video submit error ${res.status}: ${JSON.stringify(err)}`);
  }
  const data = await res.json();
  return data.request_id;
}

export async function xaiPollVideo(requestId: string): Promise<{ status: string; videoUrl?: string; error?: string }> {
  const res = await fetch(`https://api.x.ai/v1/videos/${requestId}`, {
    headers: {
      Authorization: `Bearer ${process.env.XAI_API_KEY}`,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const errorMsg = err.error || err.message || `xAI error ${res.status}`;
    return { status: 'failed', error: errorMsg };
  }
  const data = await res.json();
  // xAI returns video object directly when done (no status field)
  if (data.video?.url) {
    return { status: 'done', videoUrl: data.video.url };
  }
  return { status: data.status || 'processing' };
}
