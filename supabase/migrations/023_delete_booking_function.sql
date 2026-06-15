-- ============================================
-- 023: Admin-funktion för att ta bort en bokning
-- ============================================
-- Tar bort bokning + el-avläsning och återställer veckans status
-- till 'available' i en enda transaktion.
CREATE OR REPLACE FUNCTION public.delete_booking(p_booking_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_year       INT;
  v_week_number INT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT year, week_number INTO v_year, v_week_number
  FROM public.bookings WHERE id = p_booking_id;

  DELETE FROM public.electricity_readings WHERE booking_id = p_booking_id;
  DELETE FROM public.bookings WHERE id = p_booking_id;

  UPDATE public.weeks
  SET status = 'available', booked_by_user_id = NULL
  WHERE year = v_year AND week_number = v_week_number;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_booking(UUID) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_booking(UUID) TO authenticated;
