-- ============================================
-- 014: Koppla elavläsningar till bokning
-- ============================================
-- Tabellen `electricity_readings` skapades i 001 men har aldrig använts
-- (UI:t var bara en kalkylator). Vi droppar och bygger om med booking_id
-- så avläsningen kopplas till en specifik bokning och syns för admin.

DROP TABLE IF EXISTS public.electricity_readings CASCADE;

CREATE TABLE public.electricity_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id),
  start_kwh NUMERIC NOT NULL,
  end_kwh NUMERIC,
  price_per_kwh NUMERIC NOT NULL DEFAULT 2.50,
  cost NUMERIC GENERATED ALWAYS AS (
    CASE WHEN end_kwh IS NOT NULL
      THEN GREATEST(0, (end_kwh - start_kwh)) * price_per_kwh
      ELSE NULL
    END
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_electricity_readings_booking ON public.electricity_readings(booking_id);
CREATE INDEX idx_electricity_readings_user ON public.electricity_readings(user_id);

ALTER TABLE public.electricity_readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Electricity: read own or admin" ON public.electricity_readings
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Electricity: insert own" ON public.electricity_readings
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.bookings
      WHERE id = booking_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Electricity: update own" ON public.electricity_readings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER electricity_readings_updated_at
  BEFORE UPDATE ON public.electricity_readings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
