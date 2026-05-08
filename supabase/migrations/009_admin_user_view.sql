-- ============================================
-- 009: Admin-vy för medlemslistan med last_sign_in_at
-- ============================================
-- Supabase Auth lagrar last_sign_in_at i auth.users men den tabellen
-- är skyddad från klienten. Vi exponerar fältet via en
-- SECURITY DEFINER-funktion som bara svarar för admins.
-- ============================================

CREATE OR REPLACE FUNCTION public.get_admin_users_with_auth()
RETURNS TABLE (
  id uuid,
  name text,
  email text,
  phone text,
  member_id text,
  role text,
  approved boolean,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users AS me
    WHERE me.id = auth.uid() AND me.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Endast admin har åtkomst till denna funktion';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.name,
    u.email,
    u.phone,
    u.member_id,
    u.role,
    u.approved,
    u.created_at,
    au.last_sign_in_at
  FROM public.users u
  LEFT JOIN auth.users au ON au.id = u.id
  ORDER BY u.name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_users_with_auth() TO authenticated;
