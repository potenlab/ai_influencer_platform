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
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.choices[0].message.content || '';
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
- visual_description: Detailed physical appearance for AI image generation. IMPORTANT: This should be a FRONT-FACING ID PHOTO style portrait (like passport or professional headshot). Include: exact facial features, hair style/color, clothing style, expression (neutral/professional), lighting (studio), background (plain). Make it very detailed for consistent character representation.

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
  const spicyInstructions = spicy
    ? `
SPICY MODE ON — Make this video BOLD, PROVOCATIVE, and ATTENTION-GRABBING.
- Use dramatic, seductive, or intense body language and expressions.
- Push boundaries with confident poses, slow-motion effects, intense eye contact.
- Make it feel like a high-end fashion film or music video — edgy, cinematic, unapologetic.
- Amplify charisma, attitude, and visual impact to the max.`
    : '';

  const prompt = `Create a detailed second-by-second video prompt for a short-form video.

Character: ${character.name}
Personality: ${(character.personality_traits || []).join(', ')}
Tone: ${character.tone_of_voice}
Style: ${character.content_style}

Concept: ${concept}
${spicyInstructions}
Generate a detailed video prompt describing the ENTIRE video second-by-second.
The video can be 5-15 seconds long.
Format: "0-2s: [action], 2-5s: [action], ..."
Return ONLY the video prompt text, no JSON, no markdown.`;

  const content = await chatCompletion(
    [
      { role: 'system', content: spicy
        ? 'You are a bold, edgy video director known for provocative, high-impact short-form content. Return only the prompt text.'
        : 'You are a video director specializing in short-form content. Return only the prompt text.' },
      { role: 'user', content: prompt },
    ],
    spicy ? 0.9 : 0.7
  );

  return content.trim();
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
