-- ============================================
-- pg_cron jobs for automated email triggers
-- Requires pg_cron extension enabled in Supabase
-- ============================================

-- Enable pg_cron if not already
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================
-- 1. Welcome email — 7 days before check-in
-- Runs daily at 09:00
-- ============================================
SELECT cron.schedule(
  'send-welcome-emails',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/send-email',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'type', 'welcome',
      'userId', b.user_id::text,
      'weekNumber', b.week_number,
      'year', b.year
    )
  )
  FROM public.bookings b
  JOIN public.weeks w ON w.year = b.year AND w.week_number = b.week_number
  WHERE b.status = 'confirmed'
    AND w.status = 'booked'
    -- Check-in is the Saturday of the ISO week
    -- This finds bookings where check-in is exactly 7 days from now
    AND (
      date_trunc('day',
        (make_date(b.year, 1, 4)
         - make_interval(days := extract(isodow from make_date(b.year, 1, 4))::int - 1)
         + make_interval(weeks := b.week_number - 1)
         + make_interval(days := 5))
      ) = CURRENT_DATE + INTERVAL '7 days'
    );
  $$
);

-- ============================================
-- 2. Reserve escalation — check expired offers
-- Runs every hour
-- ============================================

-- Table to track reserve offers
CREATE TABLE IF NOT EXISTS public.reserve_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL,
  week_number INTEGER NOT NULL,
  offered_to_user_id UUID NOT NULL REFERENCES public.users(id),
  reserve_rank INTEGER NOT NULL,
  offered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deadline TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '48 hours'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired'))
);

ALTER TABLE public.reserve_offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reserve offers: read own" ON public.reserve_offers FOR SELECT USING (
  auth.uid() = offered_to_user_id OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

SELECT cron.schedule(
  'escalate-reserve-offers',
  '0 * * * *',
  $$
  -- Expire timed-out offers
  UPDATE public.reserve_offers
  SET status = 'expired'
  WHERE status = 'pending' AND deadline < NOW();

  -- For each expired offer, send to next reserve
  INSERT INTO public.reserve_offers (year, week_number, offered_to_user_id, reserve_rank)
  SELECT
    ro.year,
    ro.week_number,
    la.user_id,
    la.reserve_rank
  FROM public.reserve_offers ro
  JOIN public.lottery_applications la
    ON la.year = ro.year
    AND la.week_number = ro.week_number
    AND la.status = 'reserve'
    AND la.reserve_rank = ro.reserve_rank + 1
  WHERE ro.status = 'expired'
    AND NOT EXISTS (
      SELECT 1 FROM public.reserve_offers existing
      WHERE existing.year = ro.year
        AND existing.week_number = ro.week_number
        AND existing.reserve_rank = ro.reserve_rank + 1
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.weeks w
      WHERE w.year = ro.year
        AND w.week_number = ro.week_number
        AND w.status = 'booked'
    );
  $$
);
