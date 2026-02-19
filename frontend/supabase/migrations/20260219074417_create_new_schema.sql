-- ============================================================
-- profiles
-- ============================================================
CREATE TABLE profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT,
  role       TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- characters
-- ============================================================
CREATE TABLE characters (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  visual_description  TEXT,
  personality_traits  JSONB DEFAULT '[]'::jsonb,
  tone_of_voice       TEXT,
  content_style       TEXT,
  target_audience     TEXT,
  content_themes      JSONB DEFAULT '[]'::jsonb,
  image_path          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- content_plans
-- ============================================================
CREATE TABLE content_plans (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id        UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  theme               TEXT,
  title               TEXT,
  hook                TEXT,
  first_frame_prompt  TEXT,
  video_prompt        TEXT,
  call_to_action      TEXT,
  duration_seconds    INTEGER,
  plan_data           JSONB DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE content_plans ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- media
-- ============================================================
CREATE TABLE media (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id          UUID NOT NULL,
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id               UUID,
  media_type            TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  file_path             TEXT,
  generation_mode       TEXT,
  prompt                TEXT,
  video_prompt          TEXT,
  first_frame_path      TEXT,
  reference_image_path  TEXT,
  is_portfolio          BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Named FKs to match app code expectations
  CONSTRAINT media_character_id_fkey FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
  CONSTRAINT media_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES content_plans(id) ON DELETE SET NULL
);
ALTER TABLE media ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- jobs (TEXT PK for job_<hex> IDs)
-- ============================================================
CREATE TABLE jobs (
  id              TEXT PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  character_id    UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  job_type        TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  input_data      JSONB DEFAULT '{}'::jsonb,
  fal_request_id  TEXT,
  result_data     JSONB,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
