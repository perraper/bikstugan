-- ============================================
-- 013: Påminnelser och återbetalning för slutbetalning
-- ============================================

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS final_reminder_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_reminder_last_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS final_refundable BOOLEAN;

-- ============================================
-- Cron: skicka påminnelser om obetald slutbetalning
-- 1:a påminnelse 4 veckor före ankomst, 2:a 1 vecka före
-- Körs dagligen 09:45
-- ============================================
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
        url := current_setting('app.settings.supabase_url') || '/functions/v1/send-email',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
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
