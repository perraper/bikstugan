-- ============================================
-- Aktivera Supabase Realtime för tabellerna som kalendern visar.
-- Klienten prenumererar via supabase.channel(...).on('postgres_changes', ...)
-- och får live-events när någon annan bokar/avbokar/lottningen ändras.
--
-- REPLICA IDENTITY FULL gör att UPDATE/DELETE-events innehåller alla
-- kolumner (inte bara PK + ändrade), vilket krävs för att row-filter
-- som year=eq.X ska fungera även när year-kolumnen själv inte ändras.
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.weeks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.legacy_bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lottery_applications;

ALTER TABLE public.weeks REPLICA IDENTITY FULL;
ALTER TABLE public.bookings REPLICA IDENTITY FULL;
ALTER TABLE public.legacy_bookings REPLICA IDENTITY FULL;
ALTER TABLE public.lottery_applications REPLICA IDENTITY FULL;
