-- Allow admins to insert bookings on behalf of any user (needed for publishResults)
CREATE POLICY "Bookings: admin insert" ON public.bookings FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Backfill missing v17 2026 booking (was blocked by old RLS)
INSERT INTO public.bookings (user_id, year, week_number, price, status)
SELECT
  booked_by_user_id,
  2026,
  17,
  getSeasonPrice_price,
  'confirmed'
FROM (
  SELECT
    booked_by_user_id,
    CASE
      WHEN 17 IN (1,9,13,14,15,51,52) THEN 3000
      WHEN 17 BETWEEN 18 AND 26      THEN 1700
      ELSE 2000
    END AS getSeasonPrice_price
  FROM public.weeks
  WHERE year = 2026 AND week_number = 17
) sub
WHERE booked_by_user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.bookings
    WHERE year = 2026 AND week_number = 17 AND user_id = sub.booked_by_user_id
  );
