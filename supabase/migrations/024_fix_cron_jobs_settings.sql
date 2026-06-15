-- ============================================
-- 024: Migrate database custom variables to settings table
-- ============================================

-- 1. Create secure settings table
CREATE TABLE IF NOT EXISTS public.settings (
  key text PRIMARY KEY,
  value text NOT NULL
);

-- Enable Row Level Security to prevent unauthorized access
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- 2. Create get_setting helper function
CREATE OR REPLACE FUNCTION public.get_setting(setting_key text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  val text;
BEGIN
  -- Try getting from Postgres database settings (useful for local dev/testing fallback)
  BEGIN
    val := current_setting(setting_key, true);
  EXCEPTION WHEN OTHERS THEN
    val := NULL;
  END;

  -- If not found or empty, get from the settings table
  IF val IS NULL OR val = '' THEN
    SELECT value INTO val FROM public.settings WHERE key = setting_key;
  END IF;

  RETURN val;
END;
$$;

-- 3. Reschedule cron jobs with get_setting() helper

-- Unschedule existing jobs
SELECT cron.unschedule('send-welcome-emails');
SELECT cron.unschedule('escalate-reserve-offers');
SELECT cron.unschedule('send-deposit-reminders');
SELECT cron.unschedule('send-final-payment-reminders');

-- Job 1: Welcome email — 7 days before check-in
SELECT cron.schedule(
  'send-welcome-emails',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := public.get_setting('app.settings.supabase_url') || '/functions/v1/send-email',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || public.get_setting('supabase.service_role_key'),
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
  WHERE b.status = 'confirmed'
    AND (
      date_trunc('day',
        (make_date(b.year, 1, 4)
         - make_interval(days := extract(isodow from make_date(b.year, 1, 4))::int - 1)
         + make_interval(weeks := b.week_number - 1)
         - make_interval(days := 2))
      ) = CURRENT_DATE + INTERVAL '7 days'
    );
  $$
);

-- Job 2: Reserve escalation
SELECT cron.schedule(
  'escalate-reserve-offers',
  '0 * * * *',
  $$
  -- Expire timed-out offers
  UPDATE public.reserve_offers
  SET status = 'expired'
  WHERE status = 'pending' AND deadline < NOW();

  -- For each expired offer, create new offer for next reserve
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

  -- Send email to newly created offers
  SELECT net.http_post(
    url := public.get_setting('app.settings.supabase_url') || '/functions/v1/send-email',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || public.get_setting('supabase.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'type', 'cancellation_offer',
      'userId', ro.offered_to_user_id::text,
      'weekNumber', ro.week_number,
      'year', ro.year,
      'extra', jsonb_build_object('reserveRank', ro.reserve_rank)
    )
  )
  FROM public.reserve_offers ro
  WHERE ro.status = 'pending'
    AND ro.offered_at > NOW() - INTERVAL '1 hour';
  $$
);

-- Job 3: Send deposit reminders
SELECT cron.schedule(
  'send-deposit-reminders',
  '30 9 * * *',
  $$
  WITH due AS (
    SELECT id, user_id, year, week_number, deposit_reminder_count + 1 AS next_count
    FROM public.bookings
    WHERE status = 'confirmed'
      AND deposit_paid = FALSE
      AND (
        (deposit_reminder_count = 0 AND created_at < NOW() - INTERVAL '7 days')
        OR (deposit_reminder_count = 1 AND created_at < NOW() - INTERVAL '14 days')
      )
  ),
  sent AS (
    SELECT
      net.http_post(
        url := public.get_setting('app.settings.supabase_url') || '/functions/v1/send-email',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || public.get_setting('app.settings.service_role_key'),
          'Content-Type', 'application/json'
        ),
        body := jsonb_build_object(
          'type', 'deposit_reminder',
          'userId', d.user_id::text,
          'weekNumber', d.week_number,
          'year', d.year,
          'extra', jsonb_build_object('reminderCount', d.next_count)
        )
      ) AS request_id,
      d.id AS booking_id
    FROM due d
  )
  UPDATE public.bookings b
  SET deposit_reminder_count = deposit_reminder_count + 1,
      deposit_reminder_last_at = NOW()
  FROM sent s
  WHERE b.id = s.booking_id;
  $$
);

-- Job 4: Send final payment reminders
SELECT cron.schedule(
  'send-final-payment-reminders',
  '45 9 * * *',
  $$
  WITH due AS (
    SELECT
      b.id,
      b.user_id,
      b.year,
      b.week_number,
      b.final_reminder_count,
      b.final_reminder_count + 1 AS next_count,
      GREATEST(0, b.price - COALESCE(b.deposit_amount, 500)) AS remaining,
      date_trunc('day',
        (make_date(b.year, 1, 4)
         - make_interval(days := extract(isodow from make_date(b.year, 1, 4))::int - 1)
         + make_interval(weeks := b.week_number - 1)
         - make_interval(days := 2))
      )::date AS checkin_date
    FROM public.bookings b
    WHERE b.status = 'confirmed'
      AND b.final_paid = FALSE
      AND b.price > COALESCE(b.deposit_amount, 500)
  ),
  filtered AS (
    SELECT * FROM due
    WHERE remaining > 0
      AND (
        (final_reminder_count = 0 AND checkin_date - INTERVAL '28 days' = CURRENT_DATE)
        OR (final_reminder_count = 1 AND checkin_date - INTERVAL '7 days' = CURRENT_DATE)
      )
  ),
  sent AS (
    SELECT
      net.http_post(
        url := public.get_setting('app.settings.supabase_url') || '/functions/v1/send-email',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || public.get_setting('app.settings.service_role_key'),
          'Content-Type', 'application/json'
        ),
        body := jsonb_build_object(
          'type', 'final_reminder',
          'userId', f.user_id::text,
          'weekNumber', f.week_number,
          'year', f.year,
          'extra', jsonb_build_object(
            'reminderCount', f.next_count,
            'remaining', f.remaining
          )
        )
      ) AS request_id,
      f.id AS booking_id
    FROM filtered f
  )
  UPDATE public.bookings b
  SET final_reminder_count = final_reminder_count + 1,
      final_reminder_last_at = NOW()
  FROM sent s
  WHERE b.id = s.booking_id;
  $$
);
