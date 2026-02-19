-- Create the media storage bucket (public, 100MB limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'media',
  'media',
  true,
  104857600, -- 100MB
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']
);

-- Public read access for media bucket
CREATE POLICY "Public read access on media bucket"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'media');

-- Authenticated users can upload to media bucket
CREATE POLICY "Authenticated users can upload to media bucket"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'media');

-- Authenticated users can update their uploads in media bucket
CREATE POLICY "Authenticated users can update in media bucket"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'media');

-- Authenticated users can delete their uploads in media bucket
CREATE POLICY "Authenticated users can delete from media bucket"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'media');
