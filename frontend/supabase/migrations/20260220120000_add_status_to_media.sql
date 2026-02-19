-- Add status and error_message columns to media table
-- Allows tracking failed generations alongside successful ones.
ALTER TABLE media
  ADD COLUMN status TEXT NOT NULL DEFAULT 'completed'
    CHECK (status IN ('completed', 'failed')),
  ADD COLUMN error_message TEXT;
