-- Clean up orphaned character_id references in jobs
-- (jobs pointing to characters that have been deleted)
UPDATE public.jobs
SET character_id = NULL
WHERE character_id IS NOT NULL
  AND character_id NOT IN (SELECT id FROM public.characters);

-- Add missing foreign key from jobs.character_id to characters.id
-- PostgREST requires this FK to resolve the embedded join in GET /api/jobs
ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_character_id_fkey
  FOREIGN KEY (character_id) REFERENCES public.characters(id)
  ON DELETE SET NULL;
