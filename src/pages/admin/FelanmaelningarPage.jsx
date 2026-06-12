import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAdmin } from '../../context/AdminContext'
import { Check, Hammer, X } from 'lucide-react'

export default function FelanmaelningarPage() {
  const { fetchOpenIssuesCount } = useAdmin()
  const [issues, setIssues] = useState([])
  const [issueFilter, setIssueFilter] = useState('open')
  const [issueResponse, setIssueResponse] = useState({ id: null, text: '' })
  const { profile } = { profile: null } // not needed here directly

  useEffect(() => {
    fetchIssues()
  }, [])

  async function fetchIssues() {
    const { data } = await supabase
      .from('issues')
      .select('*, user:users!user_id(name, email), resolver:users!resolved_by(name)')
      .order('created_at', { ascending: false })
    setIssues(data || [])
  }

  async function updateIssueStatus(id, status, responseText) {
    const update = { status }
    if (status === 'resolved') {
      update.resolved_at = new Date().toISOString()
    }
    if (responseText !== undefined) update.admin_response = responseText
    await supabase.from('issues').update(update).eq('id', id)
    fetchIssues()
    setIssueResponse({ id: null, text: '' })
  }

  const filteredIssues = useMemo(() => {
    if (issueFilter === 'all') return issues
    return issues.filter((i) => i.status === issueFilter)
  }, [issues, issueFilter])

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-slate-100 border border-slate-200 rounded-lg p-1">
        {[
          { key: 'open', label: 'Öppna' },
          { key: 'in_progress', label: 'Pågår' },
          { key: 'resolved', label: 'Lösta' },
          { key: 'all', label: 'Alla' },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setIssueFilter(f.key)}
            className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              issueFilter === f.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {f.label}
            {f.key !== 'all' && (
              <span className="ml-1 opacity-60">
                ({issues.filter((i) => i.status === f.key).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {filteredIssues.length === 0 ? (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 text-center text-slate-400 text-sm">
          Inga felanmälningar i denna kategori.
        </div>
      ) : (
        filteredIssues.map((issue) => (
          <div key={issue.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-slate-800">{issue.title}</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {issue.user?.name} · {new Date(issue.created_at).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase shrink-0 ${
                issue.status === 'open' ? 'bg-red-100 text-red-700' :
                issue.status === 'in_progress' ? 'bg-amber-100 text-amber-700' :
                'bg-emerald-100 text-emerald-700'
              }`}>
                {issue.status === 'open' ? 'Öppet' : issue.status === 'in_progress' ? 'Pågår' : 'Löst'}
              </span>
            </div>

            <p className="text-sm text-slate-600 whitespace-pre-wrap bg-slate-50 rounded-lg p-3">{issue.description}</p>

            {issue.admin_response && (
              <div className="bg-blue-50 border-l-2 border-blue-300 rounded px-3 py-2">
                <div className="text-[10px] uppercase tracking-wide text-blue-500 font-semibold mb-0.5">Adminsvar</div>
                <p className="text-xs text-slate-600 whitespace-pre-wrap">{issue.admin_response}</p>
              </div>
            )}

            {issueResponse.id === issue.id && (
              <textarea
                value={issueResponse.text}
                onChange={(e) => setIssueResponse({ id: issue.id, text: e.target.value })}
                rows={2}
                placeholder="Svar till medlemmen (valfritt)..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-none"
              />
            )}

            {issue.status !== 'resolved' && (
              <div className="flex flex-wrap gap-1.5">
                {issue.status === 'open' && (
                  <button
                    onClick={() => updateIssueStatus(issue.id, 'in_progress')}
                    className="flex items-center gap-1 text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 px-2.5 py-1.5 rounded-lg font-medium"
                  >
                    <Hammer className="w-3 h-3" />
                    Påbörja
                  </button>
                )}
                {issueResponse.id === issue.id ? (
                  <>
                    <button
                      onClick={() => updateIssueStatus(issue.id, 'resolved', issueResponse.text)}
                      className="flex items-center gap-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded-lg font-medium"
                    >
                      <Check className="w-3 h-3" />
                      Markera löst
                    </button>
                    <button
                      onClick={() => setIssueResponse({ id: null, text: '' })}
                      className="text-xs text-slate-500 hover:text-slate-700 px-2.5 py-1.5"
                    >
                      Avbryt
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setIssueResponse({ id: issue.id, text: issue.admin_response || '' })}
                    className="flex items-center gap-1 text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-1.5 rounded-lg font-medium"
                  >
                    <Check className="w-3 h-3" />
                    Lös
                  </button>
                )}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}
