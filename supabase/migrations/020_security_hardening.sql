-- ============================================
-- 020: Säkerhetshårdning
-- ============================================

-- 1. Återkalla anon-exekvering från SECURITY DEFINER-funktioner
--    (alla har interna admin-kontroller men ska ändå inte vara publika)
REVOKE EXECUTE ON FUNCTION public.delete_member(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.auto_approve_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_admin_users_with_auth() FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_admin_action(text, text, text, jsonb) FROM anon;

-- 2. Sätt search_path på trigger-funktioner för att förhindra search_path-hijacking
--    normalize_allowed_email behöver inte SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.normalize_allowed_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.email := LOWER(TRIM(NEW.email));
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 3. Strama åt users INSERT-policy:
--    Med CHECK (true) kunde en ny användare sätta role='admin'.
--    Ny policy: id måste matcha auth.uid() och role måste vara 'member'.
--    OBS: approved-villkor utelämnas med avsikt — auto_approve_user-triggern
--    (BEFORE INSERT) kan sätta approved=true för allowlistade mejl, och det
--    skulle krocka med ett approved=FALSE-krav i WITH CHECK.
DROP POLICY IF EXISTS "Users: insert own" ON public.users;
CREATE POLICY "Users: insert own" ON public.users
  FOR INSERT WITH CHECK (
    auth.uid() = id
    AND role = 'member'
  );
