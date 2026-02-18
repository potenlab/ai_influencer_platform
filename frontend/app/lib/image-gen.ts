import { fal } from '@fal-ai/client';
import { xaiImageGenerate, xaiImageEdit } from './xai';
import { describeReferenceImage } from './openrouter';

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
  const result = await fal.run('fal-ai/nano-banana-pro/edit' as any, {
    input: {
      prompt: styledPrompt,
      image_urls: [sourceImageUrl],
      num_images: 1,
    } as any,
  });
  return (result as any).data.images[0].url;
}

export async function generateSceneImage(
  prompt: string,
  imageUrls: string[],
  spicy = false,
): Promise<string> {
  const styledPrompt = withRealisticStyle(prompt);

  // Spicy mode: xAI grok edit
  if (spicy) {
    if (imageUrls.length === 1) {
      // text_only: direct grok edit on character image
      return xaiImageEdit(styledPrompt, imageUrls[0]);
    }
    // ref_image: describe reference image via Kimi K2.5, then grok edit on character image
    const refDescription = await describeReferenceImage(imageUrls[1]);
    const combinedPrompt = withRealisticStyle(
      `${prompt}. Reference scene: ${refDescription}`
    );
    return xaiImageEdit(combinedPrompt, imageUrls[0]);
  }

  // Mild mode: fal.ai nano-banana-pro/edit
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
