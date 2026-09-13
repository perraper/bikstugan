-- ============================================
-- 025: Phase 1 — Security, Atomic Transactions & Indexing
-- ============================================

-- ----------------------------------------------------
-- 1. Indexing (Prestanda)
-- ----------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_bookings_year_week
  ON public.bookings(year, week_number);

CREATE INDEX IF NOT EXISTS idx_reserve_offers_lookup
  ON public.reserve_offers(year, week_number, status);

CREATE INDEX IF NOT EXISTS idx_lottery_apps_pending
  ON public.lottery_applications(year, status, week_number);

-- ----------------------------------------------------
-- 2. Realtime Publication Fix
-- Säkerställ att admin-notiser för väntande medlemmar och felanmälningar fungerar
-- ----------------------------------------------------

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.issues;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

-- ----------------------------------------------------
-- 3. RLS Hardening (Säkerhet)
-- Endast godkända medlemmar (approved = true) får boka eller anmäla lottning
-- ----------------------------------------------------

-- WEEKS
DROP POLICY IF EXISTS "Weeks: member book" ON public.weeks;
DROP POLICY IF EXISTS "Weeks: member update own booking" ON public.weeks;
DROP POLICY IF EXISTS "Weeks: approved members insert booking" ON public.weeks;
DROP POLICY IF EXISTS "Weeks: approved members update own booking" ON public.weeks;

CREATE POLICY "Weeks: approved members insert booking" ON public.weeks
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND approved = true)
  );

CREATE POLICY "Weeks: approved members update own booking" ON public.weeks
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND approved = true)
    AND (
      booked_by_user_id = auth.uid()
      OR (status = 'available' AND booked_by_user_id IS NULL)
    )
  );

-- BOOKINGS
DROP POLICY IF EXISTS "Bookings: insert own" ON public.bookings;
CREATE POLICY "Bookings: insert own" ON public.bookings
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND approved = true)
  );

-- LOTTERY APPLICATIONS
DROP POLICY IF EXISTS "Lottery: insert own" ON public.lottery_applications;
CREATE POLICY "Lottery: insert own" ON public.lottery_applications
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND approved = true)
  );

-- Tillåt medlemmar att ångra/dra tillbaka sin intresseanmälan eller lämna reservkön
DROP POLICY IF EXISTS "Lottery: delete own pending or reserve" ON public.lottery_applications;
CREATE POLICY "Lottery: delete own pending or reserve" ON public.lottery_applications
  FOR DELETE USING (
    auth.uid() = user_id
    AND status IN ('pending', 'reserve')
  );

-- ----------------------------------------------------
-- 4. Atomic Lottery Publishing (Dataintegritet & Prestanda)
-- Ersätter 75-100 frontend-anrop med en enda transaktion i PostgreSQL
-- ----------------------------------------------------

CREATE OR REPLACE FUNCTION public.publish_lottery_results(
  p_year int,
  p_draft jsonb,
  p_prices jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role text;
  v_week_str text;
  v_week_num int;
  v_apps jsonb;
  v_winner_id uuid;
  v_winner_app_id uuid;
  v_app jsonb;
  v_price int;
  v_idx int;
  v_w int;
  v_audit_summary jsonb := '{}'::jsonb;
BEGIN
  -- Kontrollera administratörsbehörighet
  SELECT role INTO v_caller_role FROM public.users WHERE id = auth.uid();
  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Endast administratörer kan publicera lottningsresultat';
  END IF;

  -- 1. Gå igenom veckorna i utkastet
  FOR v_week_str, v_apps IN SELECT * FROM jsonb_each(p_draft)
  LOOP
    v_week_num := v_week_str::int;
    IF jsonb_array_length(v_apps) > 0 THEN
      -- Vinnaren är första index (0)
      v_winner_app_id := (v_apps->0->>'id')::uuid;
      v_winner_id := (v_apps->0->>'user_id')::uuid;
      v_price := COALESCE((p_prices->>v_week_str)::int, 2000);

      -- Uppdatera vinnaransökan
      UPDATE public.lottery_applications
      SET status = 'won', reserve_rank = NULL
      WHERE id = v_winner_app_id;

      -- Uppdatera reserver
      IF jsonb_array_length(v_apps) > 1 THEN
        FOR v_idx IN 1 .. (jsonb_array_length(v_apps) - 1)
        LOOP
          v_app := v_apps->v_idx;
          UPDATE public.lottery_applications
          SET status = 'reserve', reserve_rank = v_idx
          WHERE id = (v_app->>'id')::uuid;
        END LOOP;
      END IF;

      -- Upsert i weeks-tabellen
      INSERT INTO public.weeks (year, week_number, status, booked_by_user_id, price)
      VALUES (p_year, v_week_num, 'booked', v_winner_id, v_price)
      ON CONFLICT (year, week_number)
      DO UPDATE SET
        status = 'booked',
        booked_by_user_id = v_winner_id,
        price = v_price,
        updated_at = NOW();

      -- Skapa bokning om den inte redan finns
      IF NOT EXISTS (
        SELECT 1 FROM public.bookings
        WHERE year = p_year AND week_number = v_week_num AND status = 'confirmed'
      ) THEN
        INSERT INTO public.bookings (user_id, year, week_number, price, status)
        VALUES (v_winner_id, p_year, v_week_num, v_price, 'confirmed');
      END IF;

      -- Samla sammanfattning för revisionsloggen
      v_audit_summary := jsonb_set(
        v_audit_summary,
        ARRAY[v_week_str],
        jsonb_build_object('winner_id', v_winner_id, 'reserves_count', jsonb_array_length(v_apps) - 1)
      );
    END IF;
  END LOOP;

  -- 2. Veckor som ingick i lottningen men inte hade några sökande öppnas upp som 'available'
  FOR v_w IN
    SELECT week_number FROM public.weeks
    WHERE year = p_year AND status = 'lottery'
  LOOP
    IF NOT (p_draft ? v_w::text) OR jsonb_array_length(COALESCE(p_draft->(v_w::text), '[]'::jsonb)) = 0 THEN
      v_price := COALESCE((p_prices->>(v_w::text))::int, 2000);
      UPDATE public.weeks
      SET status = 'available', booked_by_user_id = NULL, price = v_price, updated_at = NOW()
      WHERE year = p_year AND week_number = v_w;
    END IF;
  END LOOP;

  -- 3. Skapa revisionslogg
  INSERT INTO public.admin_audit_log (admin_id, action, details)
  VALUES (
    auth.uid(),
    'lottery.publish',
    jsonb_build_object('year', p_year, 'weeks', v_audit_summary)
  );

  RETURN jsonb_build_object('success', true, 'weeks_published', v_audit_summary);
END;
$$;

-- Återkalla publik åtkomst, endast inloggade kan anropa funktionen (den kollar även admin internt)
REVOKE EXECUTE ON FUNCTION public.publish_lottery_results(int, jsonb, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.publish_lottery_results(int, jsonb, jsonb) TO authenticated;
