-- ============================================
-- 021: Återkalla anon-åtkomst till SECURITY DEFINER-funktioner
-- ============================================
-- Trigger-funktioner anropas automatiskt av databasen, inte via RPC —
-- REVOKE påverkar inte trigger-exekvering.
REVOKE EXECUTE ON FUNCTION public.auto_approve_user() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_member(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_admin_users_with_auth() FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_admin_action(text, text, text, jsonb) FROM anon;

-- delete_member, get_admin_users_with_auth och log_admin_action ska bara
-- kunna anropas av inloggade användare (med inbyggd admin-kontroll)
GRANT EXECUTE ON FUNCTION public.delete_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_users_with_auth() TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_admin_action(text, text, text, jsonb) TO authenticated;
