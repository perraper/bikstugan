-- ============================================
-- Sätt default-rättigheter så att framtida tabeller i public-schemat
-- automatiskt blir åtkomliga via Data API (supabase-js / PostgREST).
--
-- Bakgrund: från 30 okt 2026 slutar Supabase auto-exponera nya
-- public-tabeller till Data API. Befintliga tabeller behåller sina
-- nuvarande grants, men nya tabeller behöver explicita GRANT-statements
-- annars får supabase-js "permission denied".
--
-- Med ALTER DEFAULT PRIVILEGES nedan får alla framtida tabeller
-- automatiskt rätt grants utan att vi behöver komma ihåg det vid
-- varje migration. RLS-policies styr fortfarande vad varje användare
-- faktiskt får läsa/skriva — GRANTs här ger bara åtkomst till tabellen
-- som sådan.
--
-- Inget GRANT till anon eftersom appen kräver inloggning överallt.
-- ============================================

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO service_role;
