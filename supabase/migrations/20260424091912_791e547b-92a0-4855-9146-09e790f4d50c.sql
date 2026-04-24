
INSERT INTO storage.buckets (id, name, public)
VALUES ('exit-attachments', 'exit-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Public read
CREATE POLICY "Exit attachments are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'exit-attachments');

-- Authenticated users can upload
CREATE POLICY "Authenticated users can upload exit attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'exit-attachments');

-- Authenticated users can update/delete their school's files
CREATE POLICY "Authenticated users can update exit attachments"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'exit-attachments');

CREATE POLICY "Authenticated users can delete exit attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'exit-attachments');
