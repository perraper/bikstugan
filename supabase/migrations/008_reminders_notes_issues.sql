-- ============================================
-- 008: Påminnelser, kommentarer på bokning, felanmälan
-- ============================================

-- Bokningar: påminnelse-tracking, återbetalningsstatus, fritextkommentar
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS deposit_reminder_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_reminder_last_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deposit_refundable BOOLEAN,
  ADD COLUMN IF NOT EXISTS note TEXT CHECK (note IS NULL OR char_length(note) <= 200);

-- ============================================
-- Felanmälan (issues)
-- ============================================
CREATE TABLE IF NOT EXISTS public.issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id),
  title TEXT NOT NULL CHECK (char_length(title) <= 100),
  description TEXT NOT NULL CHECK (char_length(description) <= 1000),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  admin_response TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.users(id)
);

ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Issues: read all" ON public.issues
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Issues: insert own" ON public.issues
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Issues: admin update" ON public.issues
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE INDEX IF NOT EXISTS idx_issues_status ON public.issues(status, created_at DESC);

-- ============================================
-- Cron: skicka påminnelser om obetald deposit
-- 1:a påminnelse efter 7 dagar, 2:a efter 14 dagar, sedan stopp
-- Körs dagligen 09:30
-- ============================================
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
        url := current_setting('app.settings.supabase_url') || '/functions/v1/send-email',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
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
