-- ============================================
-- 018: Markera elbetalning som betald
-- ============================================
-- Lägger till electricity_paid + electricity_paid_at på electricity_readings
-- samt en UPDATE-policy för admin.

ALTER TABLE public.electricity_readings
  ADD COLUMN electricity_paid BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN electricity_paid_at TIMESTAMPTZ;

-- Admin kan uppdatera betalningsstatus på elavläsningar
CREATE POLICY "Electricity: admin update" ON public.electricity_readings
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );
