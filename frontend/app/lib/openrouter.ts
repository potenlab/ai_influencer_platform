function getModel(): string {
  return process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash';
}

async function chatCompletion(
  messages: { role: string; content: string }[],
  temperature: number = 0.7
): Promise<string> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: getModel(), messages, temperature }),
  });
  const rawText = await res.text();
  if (!res.ok) {
    throw new Error(`OpenRouter error ${res.status}: ${rawText}`);
  }
  let data;
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error(`OpenRouter returned non-JSON: ${rawText.slice(0, 200)}`);
  }
  if (data.error) {
    throw new Error(`OpenRouter API error: ${JSON.stringify(data.error)}`);
  }
  return data.choices?.[0]?.message?.content || '';
}

async function visionChatCompletion(
  imageUrl: string,
  textPrompt: string,
  temperature: number = 0.5
): Promise<string> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: getModel(),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imageUrl } },
            { type: 'text', text: textPrompt },
          ],
        },
      ],
      temperature,
    }),
  });
  const rawText = await res.text();
  if (!res.ok) {
    throw new Error(`OpenRouter vision error ${res.status}: ${rawText}`);
  }
  let data;
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error(`OpenRouter vision returned non-JSON: ${rawText.slice(0, 200)}`);
  }
  if (data.error) {
    throw new Error(`OpenRouter vision API error: ${JSON.stringify(data.error)}`);
  }
  return data.choices?.[0]?.message?.content || '';
}

export async function describeImageForPrompt(imageUrl: string): Promise<string> {
  return visionChatCompletion(
    imageUrl,
    `Describe this image in detail for use as an AI image generation prompt. Focus on:
- Scene composition, setting, background
- Pose, body position, camera angle
- Lighting, mood, color palette
- Clothing, accessories, styling
- Any notable visual elements

Return ONLY the descriptive text, no explanations or prefixes. Keep it under 200 words.`
  );
}

export async function describeReferenceImage(imageUrl: string): Promise<string> {
  const model = 'moonshotai/kimi-k2.5';
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imageUrl } },
            {
              type: 'text',
              text: `Describe this reference image in detail for use as an AI image generation prompt. Focus on:
- Scene composition, setting, background
- Pose, body position, camera angle
- Lighting, mood, color palette
- Clothing, accessories, styling
- Props, objects, and notable visual elements

Return ONLY the descriptive text, no explanations or prefixes. Keep it under 150 words.`,
            },
          ],
        },
      ],
      temperature: 0.4,
    }),
  });
  const rawText = await res.text();
  if (!res.ok) {
    throw new Error(`Kimi K2.5 vision error ${res.status}: ${rawText}`);
  }
  let data;
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error(`Kimi K2.5 vision returned non-JSON: ${rawText.slice(0, 200)}`);
  }
  if (data.error) {
    throw new Error(`Kimi K2.5 vision API error: ${JSON.stringify(data.error)}`);
  }
  return data.choices?.[0]?.message?.content || '';
}

function extractJson(content: string): any {
  const match = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (match) content = match[1];
  return JSON.parse(content);
}

export async function generateCharacterPersonality(
  concept: string,
  audience: string
) {
  const prompt = `Create a detailed personality profile for an AI influencer character.

Concept: ${concept}
Target Audience: ${audience}

Generate a JSON object with:
- archetype: Brief character archetype (1 sentence)
- personality_traits: 5-7 personality traits (list)
- tone_of_voice: Communication style (1-2 words)
- content_style: Type of content they create (1 word)
- content_themes: 3-5 content topics they cover (list)
- visual_description: Detailed physical appearance for AI image generation. IMPORTANT: This should look like a CANDID REAL PHOTO taken with a smartphone — NOT a studio portrait or AI-generated look. Include: exact facial features (with natural imperfections like freckles, asymmetry, pores), hair style/color (natural, not perfectly styled), clothing style (casual everyday clothes), expression (natural and relaxed, like a selfie or friend's snapshot), lighting (natural ambient light, NOT studio lighting), background (real everyday setting like a cafe, street, park — NOT plain/studio). The goal is to look like a real person's Instagram photo, not a retouched model shot. Avoid any description that sounds artificial or overly polished.

Return only valid JSON.`;

  const content = await chatCompletion(
    [
      { role: 'system', content: 'You are a character design expert. Always return valid JSON.' },
      { role: 'user', content: prompt },
    ],
    0.8
  );

  return extractJson(content);
}

export async function generateContentPlan(character: any, theme: string) {
  const prompt = `Create a SHORT-FORM VIDEO content plan for this character:

Character: ${character.name}
Personality: ${(character.personality_traits || []).join(', ')}
Tone: ${character.tone_of_voice}
Style: ${character.content_style}

Theme: ${theme}

IMPORTANT: This is for ONE single video (not multiple scenes).
The video should be 5-10 seconds long for short-form content.

Generate a JSON object with EXACTLY these fields:
- title: Content title (catchy, engaging)
- hook: Opening hook (1-2 sentences to grab attention)
- duration_seconds: Total video duration in seconds (5-10)
- first_frame_prompt: Detailed description of the STARTING IMAGE for this video. This will be used for img2img generation from the character's ID photo. Describe: exact pose, camera angle, setting, lighting, what the character is doing in the first frame. Be very specific.
- video_prompt: Second-by-second description of the ENTIRE video. Format: "0-2s: [action], 2-5s: [action], 5-8s: [action], 8-10s: [action]". Be very specific about movements, expressions, camera angles, and transitions.
- call_to_action: Ending CTA (1 sentence)

DO NOT include "scenes" - this is a SINGLE video with one continuous flow.
Return only valid JSON.`;

  const content = await chatCompletion(
    [
      { role: 'system', content: 'You are a content strategist specializing in short-form video. Always return valid JSON.' },
      { role: 'user', content: prompt },
    ],
    0.7
  );

  return extractJson(content);
}

export async function generateVideoPrompt(
  character: any,
  concept: string,
  spicy = false
): Promise<string> {
  const spicyNote = spicy
    ? ' Make it bold, provocative, and cinematic — like a fashion film or music video.'
    : '';

  const prompt = `Write a short video prompt based on this concept.

Character: ${character.name}
Concept: ${concept}

Rules:
- Describe the scene and action in 1~3 sentences MAX.${spicyNote}
- NO second-by-second breakdown. NO timestamps. NO "0-2s:" format.
- Just a concise, vivid description of what happens in the video.
- Return ONLY the prompt text, nothing else.`;

  const content = await chatCompletion(
    [
      { role: 'system', content: 'You write concise video prompts. 1-3 sentences only.' },
      { role: 'user', content: prompt },
    ],
    0.7
  );

  return content.trim();
}

export async function generateShotsPrompts(
  imageDescription: string,
  count = 5
): Promise<string[]> {
  const prompt = `Based on the following image description, generate ${count} different photo variation prompts.
Each variation should look like it was taken at the SAME location, SAME day, with the SAME person wearing the SAME outfit.
But each shot should have a DIFFERENT angle, pose, expression, or framing — like a photographer taking multiple shots during one session.

Original image description:
${imageDescription}

Rules:
- Keep the same person, same clothing, same setting/background
- Vary: camera angle (close-up, full body, over-the-shoulder, side profile, etc.), pose, expression, framing
- Each prompt should be a complete image generation prompt (1-2 sentences)
- Make them feel like candid photos from a real photoshoot
- Return ONLY a JSON array of ${count} strings, no explanation

Example format: ["prompt 1", "prompt 2", ...]`;

  const content = await chatCompletion(
    [
      { role: 'system', content: 'You generate image variation prompts. Always return a valid JSON array of strings.' },
      { role: 'user', content: prompt },
    ],
    0.8
  );

  return extractJson(content);
}

export async function determineVideoDuration(
  videoPrompt: string
): Promise<number> {
  const prompt = `Analyze this video prompt and determine the optimal duration in seconds (5-15).

Video prompt:
${videoPrompt}

Rules:
- Simple actions (waving, smiling, posing): 5s
- Medium actions (walking, talking, demonstrating): 8-10s
- Complex sequences (multiple scenes, storytelling): 12-15s

Return ONLY a single integer (5-15), nothing else.`;

  const content = await chatCompletion(
    [
      { role: 'system', content: 'Return only a single integer.' },
      { role: 'user', content: prompt },
    ],
    0.3
  );

  const raw = (content || '10').trim();
  const duration = parseInt(raw, 10);
  if (isNaN(duration)) return 10;
  return Math.max(5, Math.min(15, duration));
}
