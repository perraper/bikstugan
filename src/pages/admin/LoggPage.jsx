import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { ChevronRight, RotateCcw } from 'lucide-react'

const AUDIT_LABELS = {
  'booking.toggle_deposit_paid':  { label: 'Anmälningsavgift', tone: 'emerald' },
  'booking.toggle_final_paid':    { label: 'Slutbetalning',    tone: 'emerald' },
  'booking.mark_refunded':        { label: 'Återbetald (anm.)', tone: 'amber' },
  'booking.mark_final_refunded':  { label: 'Återbetald (slut)', tone: 'amber' },
  'user.approve':                 { label: 'Godkände',          tone: 'emerald' },
  'user.reject':                  { label: 'Avvisade',          tone: 'red' },
  'user.toggle_admin':            { label: 'Bytte roll',        tone: 'purple' },
  'user.delete':                  { label: 'Tog bort',          tone: 'red' },
  'user.edit':                    { label: 'Redigerade',        tone: 'blue' },
  'lottery.publish':              { label: 'Lottning',          tone: 'purple' },
}

const AUDIT_TONE = {
  emerald: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  amber:   'bg-amber-50 text-amber-700 border border-amber-200',
  red:     'bg-red-50 text-red-700 border border-red-200',
  purple:  'bg-purple-50 text-purple-700 border border-purple-200',
  blue:    'bg-blue-50 text-blue-700 border border-blue-200',
  slate:   'bg-slate-100 text-slate-600 border border-slate-200',
}

function renderAuditSummary(row) {
  const d = row.details || {}
  switch (row.action) {
    case 'booking.toggle_deposit_paid':
      return `V${d.week_number}/${d.year} anm.avg → ${d.after?.deposit_paid ? 'betald' : 'obetald'}`
    case 'booking.toggle_final_paid':
      return `V${d.week_number}/${d.year} slutbet → ${d.after?.final_paid ? 'betald' : 'obetald'}`
    case 'booking.mark_refunded':
      return `V${d.week_number}/${d.year} anm.avg återbetald`
    case 'booking.mark_final_refunded':
      return `V${d.week_number}/${d.year} slutbet återbetald`
    case 'user.approve':
      return 'Medlem godkänd'
    case 'user.reject':
      return `${d.name || 'Medlem'} (${d.email || ''}) avvisad`
    case 'user.toggle_admin':
      return `${d.before?.role || '?'} → ${d.after?.role || '?'}`
    case 'user.delete':
      return `${d.name || 'Medlem'} (${d.email || ''}) borttagen`
    case 'user.edit': {
      const fields = Object.keys(d.after || {})
      return fields.length > 0 ? `Ändrade: ${fields.join(', ')}` : 'Redigerade medlem'
    }
    case 'lottery.publish': {
      const weeks = Object.keys(d.weeks || {})
      return `${weeks.length} vecka${weeks.length === 1 ? '' : 'or'} publicerade${d.year ? ` (${d.year})` : ''}`
    }
    default:
      return ''
  }
}

export default function LoggPage() {
  const [auditLog, setAuditLog] = useState([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [expandedAuditId, setExpandedAuditId] = useState(null)

  const fetchAuditLog = useCallback(async () => {
    setAuditLoading(true)
    const { data } = await supabase
      .from('admin_audit_log')
      .select('*, admin:users!admin_id(name, email)')
      .order('created_at', { ascending: false })
      .limit(100)
    setAuditLog(data || [])
    setAuditLoading(false)
  }, [])

  useEffect(() => {
    fetchAuditLog() // eslint-disable-line react-hooks/set-state-in-effect
  }, [fetchAuditLog])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Senaste admin-åtgärder</h2>
        <button
          onClick={fetchAuditLog}
          disabled={auditLoading}
          className="flex items-center gap-1 text-xs bg-slate-100 text-slate-600 border border-slate-200 px-2.5 py-1.5 rounded-lg hover:bg-slate-200 disabled:opacity-50 transition-colors font-medium"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${auditLoading ? 'animate-spin' : ''}`} />
          Uppdatera
        </button>
      </div>

      {auditLoading && auditLog.length === 0 ? (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 text-center text-slate-400 text-sm">Hämtar logg…</div>
      ) : auditLog.length === 0 ? (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 text-center text-slate-400 text-sm">
          Ingen logg ännu — händelser dyker upp här när admins gör ändringar.
        </div>
      ) : (
        <div className="space-y-1.5">
          {auditLog.map((row) => {
            const meta = AUDIT_LABELS[row.action] || { label: row.action, tone: 'slate' }
            const ts = new Date(row.created_at)
            const isExpanded = expandedAuditId === row.id
            const summary = renderAuditSummary(row)
            const toneClass = AUDIT_TONE[meta.tone] || AUDIT_TONE.slate
            return (
              <div key={row.id} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedAuditId(isExpanded ? null : row.id)}
                  className="w-full text-left px-3 py-2.5 hover:bg-slate-50 transition-colors flex items-start gap-3"
                >
                  <div className="text-[11px] text-slate-400 w-24 shrink-0 pt-0.5 font-mono">
                    {ts.toLocaleString('sv-SE', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${toneClass}`}>{meta.label}</span>
                      <span className="text-sm text-slate-700 truncate">{summary}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">av {row.admin?.name || 'okänd admin'}</div>
                  </div>
                  {row.details && (
                    <ChevronRight className={`w-4 h-4 text-slate-300 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  )}
                </button>
                {isExpanded && row.details && (
                  <pre className="bg-slate-50 border-t border-slate-200 px-3 py-2 text-[11px] text-slate-600 overflow-x-auto">
                    {JSON.stringify(row.details, null, 2)}
                  </pre>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
