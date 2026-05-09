-- ============================================
-- Slutbetalning (resterande belopp efter anmälningsavgift)
-- ============================================

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS final_paid BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS final_paid_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_bookings_final_unpaid
  ON public.bookings(year, week_number)
  WHERE final_paid = FALSE AND status = 'confirmed';
