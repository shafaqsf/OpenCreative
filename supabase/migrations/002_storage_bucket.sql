-- Create a public bucket for project assets (product images, reference videos)
INSERT INTO storage.buckets (id, name, public)
VALUES ('assets', 'assets', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access
CREATE POLICY IF NOT EXISTS "Public read access"
ON storage.objects FOR SELECT
USING (bucket_id = 'assets');

-- Allow authenticated uploads (no auth in this app, so allow anonymous uploads)
CREATE POLICY IF NOT EXISTS "Allow uploads"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'assets');

-- Allow deletion by anyone (simplify for open-source demo)
CREATE POLICY IF NOT EXISTS "Allow deletes"
ON storage.objects FOR DELETE
USING (bucket_id = 'assets');