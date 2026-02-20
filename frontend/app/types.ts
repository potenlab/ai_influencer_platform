export interface Character {
  id: string;
  name: string;
  content_style: string;
  personality_traits: string[];
  tone_of_voice: string;
  target_audience: string;
  content_themes: string[];
  visual_description: string;
  image_path: string;
}

export interface HistoryMedia {
  id: number;
  plan_id: string | null;
  media_type: string;
  file_path: string;
  created_at: string;
  character_id: string;
  character_name: string;
  character_image_path: string;
  // v2 fields
  generation_mode: string | null;
  prompt: string | null;
  video_prompt: string | null;
  first_frame_path: string | null;
  reference_image_path: string | null;
  is_portfolio: boolean;
  status: 'completed' | 'failed';
  error_message: string | null;
  // legacy plan fields
  plan_title: string | null;
  plan_theme: string | null;
  hook: string | null;
  plan_first_frame_prompt: string | null;
  plan_video_prompt: string | null;
  call_to_action: string | null;
  duration_seconds: number | null;
}
