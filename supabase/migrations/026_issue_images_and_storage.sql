-- ============================================
-- 026: Image attachments for issues & storage configuration
-- ============================================

ALTER TABLE public.issues
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Skapa bucket för ärendebilder om den inte finns
INSERT INTO storage.buckets (id, name, public)
VALUES ('issue-attachments', 'issue-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Tillåt inloggade användare att ladda upp bilder
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Issue attachments: upload authenticated'
  ) THEN
    CREATE POLICY "Issue attachments: upload authenticated" ON storage.objects
      FOR INSERT WITH CHECK (
        bucket_id = 'issue-attachments'
        AND auth.uid() IS NOT NULL
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Issue attachments: public read'
  ) THEN
    CREATE POLICY "Issue attachments: public read" ON storage.objects
      FOR SELECT USING (
        bucket_id = 'issue-attachments'
      );
  END IF;
END $$;
