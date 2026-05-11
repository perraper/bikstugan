-- ============================================
-- 012: Admin audit log
-- ============================================
-- Loggar admin-åtgärder (betalningsstatus, medlemsedit, rollbyten,
-- godkännanden, raderingar) så att fel kan spåras och rättas.
-- Ingen rad får skrivas direkt — all loggning går via log_admin_action()
-- som verifierar att anroparen är admin.
-- ============================================

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id     UUID NOT NULL REFERENCES public.users(id),
  action       TEXT NOT NULL,
  target_table TEXT,
  target_id    TEXT,
  details      JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created
  ON public.admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_admin
  ON public.admin_audit_log(admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_target
  ON public.admin_audit_log(target_table, target_id);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "AuditLog: admin select" ON public.admin_audit_log;

CREATE POLICY "AuditLog: admin select" ON public.admin_audit_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Inga insert/update/delete-policies → tabellen är read-only för alla klienter.
-- Loggning sker uteslutande via SECURITY DEFINER-funktionen nedan.

CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_action       TEXT,
  p_target_table TEXT DEFAULT NULL,
  p_target_id    TEXT DEFAULT NULL,
  p_details      JSONB DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid;
  log_id    uuid;
BEGIN
  caller_id := auth.uid();

  IF NOT EXISTS (
    SELECT 1 FROM public.users WHERE id = caller_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Endast admin får logga audit-händelser';
  END IF;

  INSERT INTO public.admin_audit_log (admin_id, action, target_table, target_id, details)
  VALUES (caller_id, p_action, p_target_table, p_target_id, p_details)
  RETURNING id INTO log_id;

  RETURN log_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_admin_action(TEXT, TEXT, TEXT, JSONB) TO authenticated;
