-- ============================================
-- Anmälningsavgift (deposit) — spårning per bokning
-- ============================================

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS deposit_paid BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deposit_paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deposit_amount INTEGER NOT NULL DEFAULT 500;

-- Endast admin får uppdatera deposit_paid (i tillägg till befintlig "update own")
CREATE POLICY "Bookings: admin update deposit" ON public.bookings
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Index för snabbare admin-översikt över obetalda
CREATE INDEX IF NOT EXISTS idx_bookings_deposit_unpaid
  ON public.bookings(year, week_number)
  WHERE deposit_paid = FALSE AND status = 'confirmed';
