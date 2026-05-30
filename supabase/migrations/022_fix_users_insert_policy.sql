-- ============================================
-- 022: Rätta users INSERT-policy (regression från 020)
-- ============================================
-- auto_approve_user-triggern körs BEFORE INSERT och kan sätta approved=true
-- för allowlistade mejl — det krockar med approved=FALSE-villkoret i 020.
-- Behåll skyddet mot att en användare sätter sig som admin, men ta bort
-- approved-villkoret (approved styrs av triggern, inte klienten).
DROP POLICY IF EXISTS "Users: insert own" ON public.users;
CREATE POLICY "Users: insert own" ON public.users
  FOR INSERT WITH CHECK (
    auth.uid() = id
    AND role = 'member'
  );
