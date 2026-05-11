import { supabase } from './supabase'

// Logga en admin-åtgärd. Tystas bort vid fel — vi vill aldrig att
// en misslyckad logg ska blockera den underliggande åtgärden.
export async function logAdminAction(action, { table, id, details } = {}) {
  const { error } = await supabase.rpc('log_admin_action', {
    p_action: action,
    p_target_table: table ?? null,
    p_target_id: id != null ? String(id) : null,
    p_details: details ?? null,
  })
  if (error) console.error('audit log failed', action, error)
}
