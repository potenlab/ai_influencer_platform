from openai import OpenAI
import json
import re

class OpenRouterClient:
    def __init__(self, api_key: str, model: str):
        self.client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=api_key
        )
        self.model = model

    def _extract_json(self, content: str) -> dict:
        """Extract JSON from response, handling markdown code blocks"""
        json_match = re.search(r'```(?:json)?\s*(.*?)\s*```', content, re.DOTALL)
        if json_match:
            content = json_match.group(1)
        return json.loads(content)

    def generate_character_personality(self, concept: str, audience: str) -> dict:
        """Generate personality traits for a character"""
        prompt = f"""Create a detailed personality profile for an AI influencer character.

Concept: {concept}
Target Audience: {audience}

Generate a JSON object with:
- archetype: Brief character archetype (1 sentence)
- personality_traits: 5-7 personality traits (list)
- tone_of_voice: Communication style (1-2 words)
- content_style: Type of content they create (1 word)
- content_themes: 3-5 content topics they cover (list)
- visual_description: Detailed physical appearance for AI image generation. IMPORTANT: This should be a FRONT-FACING ID PHOTO style portrait (like passport or professional headshot). Include: exact facial features, hair style/color, clothing style, expression (neutral/professional), lighting (studio), background (plain). Make it very detailed for consistent character representation.

Return only valid JSON."""

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "You are a character design expert. Always return valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.8
        )

        return self._extract_json(response.choices[0].message.content)

    def generate_content_plan(self, character: dict, theme: str) -> dict:
        """Generate a single-video content plan (no scenes) - legacy"""
        prompt = f"""Create a SHORT-FORM VIDEO content plan for this character:

Character: {character['name']}
Personality: {', '.join(character['personality_traits'])}
Tone: {character['tone_of_voice']}
Style: {character['content_style']}

Theme: {theme}

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
Return only valid JSON."""

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "You are a content strategist specializing in short-form video. Always return valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7
        )

        return self._extract_json(response.choices[0].message.content)

    def generate_video_prompt(self, character: dict, concept: str) -> str:
        """Generate a video prompt from character info and concept."""
        prompt = f"""Create a detailed second-by-second video prompt for a short-form video.

Character: {character['name']}
Personality: {', '.join(character['personality_traits'])}
Tone: {character['tone_of_voice']}
Style: {character['content_style']}

Concept: {concept}

Generate a detailed video prompt describing the ENTIRE video second-by-second.
The video can be 5-15 seconds long.
Format: "0-2s: [action], 2-5s: [action], ..."
Return ONLY the video prompt text, no JSON, no markdown."""

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "You are a video director specializing in short-form content. Return only the prompt text."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7
        )

        return response.choices[0].message.content.strip()

    def determine_video_duration(self, video_prompt: str) -> int:
        """Analyze a video prompt and determine optimal duration (5-15 seconds)."""
        prompt = f"""Analyze this video prompt and determine the optimal duration in seconds (5-15).

Video prompt:
{video_prompt}

Rules:
- Simple actions (waving, smiling, posing): 5s
- Medium actions (walking, talking, demonstrating): 8-10s
- Complex sequences (multiple scenes, storytelling): 12-15s

Return ONLY a single integer (5-15), nothing else."""

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "Return only a single integer."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3
        )

        raw = response.choices[0].message.content.strip()
        try:
            duration = int(raw)
            return max(5, min(15, duration))
        except ValueError:
            return 10
