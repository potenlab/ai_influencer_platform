import { fal } from '@fal-ai/client';
import { xaiImageGenerate, xaiImageEdit } from './xai';

let _falConfigured = false;
function ensureFalConfig() {
  if (!_falConfigured) {
    fal.config({ credentials: process.env.FAL_KEY! });
    _falConfigured = true;
  }
}

const REALISTIC_SUFFIX = ' — raw unedited photo, candid smartphone photography, natural ambient lighting, visible skin texture and pores, no retouching, no filters, real person, not AI-generated looking';

function withRealisticStyle(prompt: string): string {
  return prompt + REALISTIC_SUFFIX;
}

export async function generateCharacterImage(prompt: string, spicy = false): Promise<string> {
  const styledPrompt = withRealisticStyle(prompt);
  if (spicy) {
    return xaiImageGenerate(styledPrompt);
  }
  ensureFalConfig();
  const result = await fal.run('fal-ai/nano-banana-pro', {
    input: { prompt: styledPrompt, aspect_ratio: '1:1', num_images: 1 },
  });
  const data = result as { data: { images: { url: string }[] } };
  return data.data.images[0].url;
}

export async function generateShotImage(
  prompt: string,
  sourceImageUrl: string,
  spicy = false,
): Promise<string> {
  const styledPrompt = withRealisticStyle(prompt);

  if (spicy) {
    return xaiImageEdit(styledPrompt, sourceImageUrl);
  }

  ensureFalConfig();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await fal.run('fal-ai/nano-banana-pro/edit' as any, {
    input: {
      prompt: styledPrompt,
      image_urls: [sourceImageUrl],
      num_images: 1,
    } as Record<string, unknown>,
  });
  const data = result as { data: { images: { url: string }[] } };
  return data.data.images[0].url;
}

export async function generateSceneImage(
  prompt: string,
  imageUrls: string[],
  spicy = false,
): Promise<string> {
  const styledPrompt = withRealisticStyle(prompt);

  // Spicy (text_only, no reference image): xAI grok edit on character image
  if (spicy && imageUrls.length === 1) {
    return xaiImageEdit(styledPrompt, imageUrls[0]);
  }

  // Reference image or mild: always fal.ai nano-banana-pro/edit
  ensureFalConfig();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await fal.run('fal-ai/nano-banana-pro/edit' as any, {
    input: {
      prompt: styledPrompt,
      image_urls: imageUrls,
      num_images: 1,
      aspect_ratio: '9:16',
      resolution: '2K',
    } as Record<string, unknown>,
  });
  const data = result as { data: { images: { url: string }[] } };
  return data.data.images[0].url;
}
