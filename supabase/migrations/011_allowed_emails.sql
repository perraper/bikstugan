-- ============================================
-- 011: Förgodkända mejladresser → automatiskt godkända konton
-- ============================================
-- Lista över mejladresser som ska auto-godkännas vid registrering.
-- Övriga konton hamnar som idag i pending och kräver admin-godkännande.
-- ============================================

CREATE TABLE IF NOT EXISTS public.allowed_emails (
  email      TEXT PRIMARY KEY,
  added_by   UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.allowed_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "AllowedEmails: admin select" ON public.allowed_emails;
DROP POLICY IF EXISTS "AllowedEmails: admin insert" ON public.allowed_emails;
DROP POLICY IF EXISTS "AllowedEmails: admin delete" ON public.allowed_emails;

CREATE POLICY "AllowedEmails: admin select" ON public.allowed_emails
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "AllowedEmails: admin insert" ON public.allowed_emails
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "AllowedEmails: admin delete" ON public.allowed_emails
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Normalisera email till trim+lowercase före insert
CREATE OR REPLACE FUNCTION public.normalize_allowed_email()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.email := LOWER(TRIM(NEW.email));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS allowed_emails_normalize ON public.allowed_emails;
CREATE TRIGGER allowed_emails_normalize
  BEFORE INSERT OR UPDATE ON public.allowed_emails
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_allowed_email();

-- Auto-godkänn nya users-rader om mejlen finns i allowed_emails.
-- SECURITY DEFINER så triggern kan läsa allowed_emails även för icke-admin.
CREATE OR REPLACE FUNCTION public.auto_approve_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.allowed_emails
    WHERE email = LOWER(TRIM(NEW.email))
  ) THEN
    NEW.approved := TRUE;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_auto_approve ON public.users;
CREATE TRIGGER users_auto_approve
  BEFORE INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_approve_user();
