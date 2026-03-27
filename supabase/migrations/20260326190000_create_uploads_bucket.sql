-- Create storage bucket used by fund application attachments.
-- Idempotent so it can be safely applied in local resets.

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('uploads', 'uploads', true, 52428800)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit;

-- Allow signed-in users to manage files in the uploads bucket.
DROP POLICY IF EXISTS "uploads_authenticated_insert" ON storage.objects;
CREATE POLICY "uploads_authenticated_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'uploads' AND owner = auth.uid());

DROP POLICY IF EXISTS "uploads_authenticated_select" ON storage.objects;
CREATE POLICY "uploads_authenticated_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'uploads');

DROP POLICY IF EXISTS "uploads_authenticated_update" ON storage.objects;
CREATE POLICY "uploads_authenticated_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'uploads' AND owner = auth.uid())
WITH CHECK (bucket_id = 'uploads' AND owner = auth.uid());

DROP POLICY IF EXISTS "uploads_authenticated_delete" ON storage.objects;
CREATE POLICY "uploads_authenticated_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'uploads' AND owner = auth.uid());
