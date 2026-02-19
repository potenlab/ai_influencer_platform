-- ============================================================
-- updated_at triggers (reuse existing set_updated_at function)
-- ============================================================
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- Indexes on FK columns and common query filters
-- ============================================================
CREATE INDEX idx_characters_user_id ON characters(user_id);
CREATE INDEX idx_content_plans_character_id ON content_plans(character_id);
CREATE INDEX idx_content_plans_user_id ON content_plans(user_id);
CREATE INDEX idx_media_character_id ON media(character_id);
CREATE INDEX idx_media_user_id ON media(user_id);
CREATE INDEX idx_media_plan_id ON media(plan_id);
CREATE INDEX idx_jobs_user_id ON jobs(user_id);
CREATE INDEX idx_jobs_character_id ON jobs(character_id);
CREATE INDEX idx_jobs_status ON jobs(status);

-- ============================================================
-- Add jobs to realtime publication
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE jobs;

-- ============================================================
-- Auto-create profile on new user signup
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- Backfill existing auth users into profiles
-- ============================================================
INSERT INTO public.profiles (id, email)
SELECT id, email FROM auth.users
ON CONFLICT (id) DO NOTHING;
