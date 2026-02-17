import { xaiImageGenerate, xaiImageEdit } from './xai';
import { describeImageForPrompt } from './openrouter';

const REALISTIC_SUFFIX = ' — photorealistic style, ultra-realistic, natural skin texture, real photograph, studio-quality lighting';

function withRealisticStyle(prompt: string): string {
  return prompt + REALISTIC_SUFFIX;
}

export async function generateCharacterImage(prompt: string): Promise<string> {
  const styledPrompt = withRealisticStyle(prompt);
  return xaiImageGenerate(styledPrompt);
}

export async function generateSceneImage(
  prompt: string,
  imageUrls: string[]
): Promise<string> {
  // If there's a reference image (second URL), describe it via LLM and merge into prompt
  let fullPrompt = prompt;
  if (imageUrls.length > 1) {
    console.log('[generateSceneImage] describing reference image via LLM');
    const refDescription = await describeImageForPrompt(imageUrls[1]);
    fullPrompt = `${prompt}\n\nReference image context: ${refDescription}`;
  }

  const styledPrompt = withRealisticStyle(fullPrompt);

  // Use character image (first URL) as base for edit
  const characterImage = imageUrls[0];
  return xaiImageEdit(styledPrompt, characterImage);
}
