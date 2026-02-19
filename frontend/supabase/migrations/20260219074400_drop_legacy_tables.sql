-- Remove video_generations from realtime publication
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'video_generations'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE video_generations;
  END IF;
END $$;

-- Drop triggers on old tables
DROP TRIGGER IF EXISTS set_updated_at ON appearances;
DROP TRIGGER IF EXISTS set_updated_at ON image_generations;
DROP TRIGGER IF EXISTS set_updated_at ON video_generations;

-- Drop tables in dependency order (children first)
DROP TABLE IF EXISTS image_generations CASCADE;
DROP TABLE IF EXISTS video_generations CASCADE;
DROP TABLE IF EXISTS appearances CASCADE;

-- Keep set_updated_at() function for reuse
