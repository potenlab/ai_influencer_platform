import { fal } from '@fal-ai/client';
import { xaiImageGenerate } from './xai';

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
    input: { prompt: styledPrompt, image_size: 'square_hd', num_images: 1 } as any,
  });
  return (result as any).data.images[0].url;
}

export async function generateSceneImage(
  prompt: string,
  imageUrls: string[],
): Promise<string> {
  const styledPrompt = withRealisticStyle(prompt);
  ensureFalConfig();
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
