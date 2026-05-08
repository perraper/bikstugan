-- ============================================
-- 010: Anonymisera medlem (GDPR-compliant "delete")
-- ============================================
-- Anonymiserar både public.users och auth.users så att medlemmen
-- inte kan logga in mer, men bokningar/historik bevaras med
-- "Borttagen medlem" som namn.
-- ============================================

CREATE OR REPLACE FUNCTION public.delete_member(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid;
  anon_email text;
BEGIN
  caller_id := auth.uid();

  -- Endast admin får anropa
  IF NOT EXISTS (
    SELECT 1 FROM public.users AS me
    WHERE me.id = caller_id AND me.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Endast admin har åtkomst till denna funktion';
  END IF;

  -- Inte tillåt att admin raderar sig själv
  IF caller_id = target_user_id THEN
    RAISE EXCEPTION 'Du kan inte ta bort ditt eget konto';
  END IF;

  anon_email := 'deleted-' || target_user_id::text || '@deleted.local';

  -- Anonymisera public.users-raden (bibehåller FK för bokningar etc)
  UPDATE public.users
  SET
    name = 'Borttagen medlem',
    email = anon_email,
    phone = NULL,
    member_id = '',
    approved = FALSE,
    role = 'member'
  WHERE id = target_user_id;

  -- Spärra auth-kontot: byt email + invalidera lösenord + bekräftelse
  -- pgcrypto-funktionerna ligger i extensions-schemat på Supabase
  UPDATE auth.users
  SET
    email = anon_email,
    encrypted_password = extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')),
    email_confirmed_at = NULL,
    raw_user_meta_data = '{}'::jsonb,
    banned_until = 'infinity'::timestamptz,
    updated_at = NOW()
  WHERE id = target_user_id;

  -- Rensa pending reserverbjudanden + lottery-anmälningar
  DELETE FROM public.reserve_offers
  WHERE offered_to_user_id = target_user_id AND status = 'pending';

  DELETE FROM public.lottery_applications
  WHERE user_id = target_user_id AND status IN ('pending', 'reserve');
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_member(uuid) TO authenticated;
