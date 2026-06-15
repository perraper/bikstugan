-- ============================================
-- 019: Admin kan skapa elavläsningar
-- ============================================
-- Tidigare kunde bara medlemmen själv lägga in en avläsning (insert own).
-- Denna policy låter admin skapa en avläsning på valfri bokning, t.ex.
-- om medlemmen aldrig matade in den själv.

CREATE POLICY "Electricity: admin insert" ON public.electricity_readings
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );
