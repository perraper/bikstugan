-- ============================================
-- Fix cron jobs: correct Saturday calculation and hardcode URLs
-- Run in Supabase SQL Editor
-- ============================================

-- Remove old jobs
SELECT cron.unschedule('send-welcome-emails');
SELECT cron.unschedule('escalate-reserve-offers');

-- ============================================
-- 1. Welcome email — 7 days before check-in
-- Check-in = Saturday BEFORE the ISO week (monday - 2 days)
-- Runs daily at 09:00
-- ============================================
SELECT cron.schedule(
  'send-welcome-emails',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://yihesdrpszxwuzmzennu.supabase.co/functions/v1/send-email',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key'),
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

-- ============================================
-- 2. Reserve escalation — check expired offers and notify next
-- Runs every hour
-- ============================================
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
    url := 'https://yihesdrpszxwuzmzennu.supabase.co/functions/v1/send-email',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key'),
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
