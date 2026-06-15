import { useMemo, useState } from 'react'
import { useAdmin } from '../../context/AdminContext'
import { useAuth } from '../../context/useAuth'
import {
  Check, X, Shield, User, Download, Search,
  Users, Trash2, MailCheck, Mail, Upload, Plus,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function MedlemmarPage() {
  const { profile } = useAuth()
  const {
    pendingUsers, allUsers, approvingId,
    approveUser, rejectUser, toggleAdmin, deleteMember,
    showMemberBookings, exportMembersCSV, formatLastSignIn,
  } = useAdmin()

  const [memberSearch, setMemberSearch] = useState('')
  const [allowedEmails, setAllowedEmails] = useState([])
  const [allowedEmailInput, setAllowedEmailInput] = useState('')
  const [allowedEmailBusy, setAllowedEmailBusy] = useState(false)
  const [allowedEmailMsg, setAllowedEmailMsg] = useState(null)

  // Fetch allowed emails on mount
  useMemo(() => {
    supabase.from('allowed_emails').select('*').order('email').then(({ data }) => setAllowedEmails(data || []))
  }, [])

  async function addAllowedEmails(emails) {
    const cleaned = Array.from(new Set(
      emails.map((e) => (e || '').trim().toLowerCase()).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
    ))
    if (cleaned.length === 0) { setAllowedEmailMsg({ type: 'error', text: 'Inga giltiga mejladresser hittades.' }); return }
    setAllowedEmailBusy(true)
    setAllowedEmailMsg(null)
    const rows = cleaned.map((email) => ({ email, added_by: profile?.id ?? null }))
    const { error } = await supabase.from('allowed_emails').upsert(rows, { onConflict: 'email', ignoreDuplicates: true })
    setAllowedEmailBusy(false)
    if (error) { setAllowedEmailMsg({ type: 'error', text: error.message }); return }
    const { data } = await supabase.from('allowed_emails').select('*').order('email')
    setAllowedEmails(data || [])
    setAllowedEmailMsg({ type: 'success', text: `La till ${cleaned.length} mejladress${cleaned.length === 1 ? '' : 'er'}.` })
  }

  async function removeAllowedEmail(email) {
    const { error } = await supabase.from('allowed_emails').delete().eq('email', email)
    if (error) { setAllowedEmailMsg({ type: 'error', text: error.message }); return }
    setAllowedEmails((prev) => prev.filter((r) => r.email !== email))
  }

  async function handleAllowedCsvUpload(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const text = await file.text()
    const emails = text.split(/[\r\n,;]+/).map((line) => {
      const cell = line.split(/[,;\t]/)[0]
      return cell.replace(/^"|"$/g, '').trim()
    }).filter(Boolean)
    await addAllowedEmails(emails)
  }

  async function submitManualAllowedEmail() {
    if (!allowedEmailInput.trim()) return
    await addAllowedEmails([allowedEmailInput])
    setAllowedEmailInput('')
  }

  const filteredUsers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase()
    if (!q) return allUsers
    return allUsers.filter((u) =>
      [u.name, u.email, u.phone].filter(Boolean).some((v) => v.toLowerCase().includes(q))
    )
  }, [allUsers, memberSearch])

  return (
    <div className="space-y-3">
      {/* Allowed emails */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
            <MailCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-slate-700">Förgodkända mejladresser</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Konton som registreras med en mejl i listan godkänns automatiskt. Övriga hamnar som vanligt i kö.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <label className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors">
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            Importera CSV
            <input type="file" accept=".csv,.txt" onChange={handleAllowedCsvUpload} className="hidden" />
          </label>
          <div className="flex-1 flex items-center gap-2 min-w-[180px]">
            <input
              type="email"
              value={allowedEmailInput}
              onChange={(e) => setAllowedEmailInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitManualAllowedEmail()}
              placeholder="namn@exempel.se"
              className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500"
            />
            <button
              onClick={submitManualAllowedEmail}
              disabled={allowedEmailBusy || !allowedEmailInput.trim()}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        {allowedEmailMsg && (
          <div className={`text-xs rounded-lg px-3 py-2 mb-3 ${allowedEmailMsg.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-600'}`}>
            {allowedEmailMsg.text}
          </div>
        )}
        {allowedEmails.length === 0 ? (
          <div className="text-xs text-slate-400 text-center py-3 bg-slate-50 rounded-lg">Inga mejladresser i listan ännu.</div>
        ) : (
          <>
            <div className="text-[11px] text-slate-400 mb-1.5">{allowedEmails.length} mejladress{allowedEmails.length === 1 ? '' : 'er'} i listan</div>
            <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
              {allowedEmails.map((row) => (
                <div key={row.email} className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md">
                  <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="text-xs text-slate-600 truncate flex-1">{row.email}</span>
                  <button onClick={() => removeAllowedEmail(row.email)} className="p-1 text-slate-400 hover:text-red-500 transition-colors" title="Ta bort">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Pending approvals */}
      <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide pt-2">Väntande godkännanden</h2>
      {pendingUsers.length === 0 ? (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center text-slate-400 text-xs">Inga väntande konton.</div>
      ) : (
        pendingUsers.map((u) => (
          <div key={u.id} className="bg-white border border-slate-200 rounded-lg px-3 py-2.5 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4 text-amber-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-700">{u.name}</div>
              <div className="text-xs text-slate-400 truncate">{u.email}{u.phone ? ` · ${u.phone}` : ''}</div>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <button
                onClick={() => rejectUser(u)}
                disabled={approvingId === u.id}
                className="w-8 h-8 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center text-red-500 hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
              <button
                onClick={() => approveUser(u.id)}
                disabled={approvingId === u.id}
                className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 hover:bg-emerald-100 transition-colors disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))
      )}

      {/* All approved members */}
      <div className="flex items-center justify-between mt-6">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Alla medlemmar</h2>
        {allUsers.length > 0 && (
          <button
            onClick={exportMembersCSV}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Exportera CSV
          </button>
        )}
      </div>

      {allUsers.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
            placeholder="Sök medlem (namn, e-post, telefon)..."
            className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500"
          />
        </div>
      )}

      {filteredUsers.length === 0 ? (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center text-slate-400 text-xs">
          {memberSearch ? `Inga träffar för "${memberSearch}".` : 'Inga godkända medlemmar ännu.'}
        </div>
      ) : (
        filteredUsers.map((u) => (
          <div key={u.id} className="bg-white border border-slate-200 rounded-lg px-3 py-2.5 flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${u.role === 'admin' ? 'bg-blue-50 border border-blue-200' : 'bg-slate-50 border border-slate-200'}`}>
              {u.role === 'admin' ? <Shield className="w-4 h-4 text-blue-500" /> : <User className="w-4 h-4 text-slate-400" />}
            </div>
            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => showMemberBookings(u)}>
              <div className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                {u.name}
                {u.role === 'admin' && <span className="text-[10px] font-semibold bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">ADMIN</span>}
              </div>
              <div className="text-xs text-slate-400 truncate">{u.email}{u.phone ? ` · ${u.phone}` : ''}</div>
              <div className={`text-[10px] mt-0.5 ${u.last_sign_in_at ? 'text-slate-400' : 'text-amber-500'}`}>
                {u.last_sign_in_at ? `Senast inloggad: ${formatLastSignIn(u.last_sign_in_at)}` : 'Aldrig inloggad'}
              </div>
            </div>
            <button
              onClick={() => toggleAdmin(u.id, u.role)}
              className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors shrink-0 ${u.role === 'admin' ? 'bg-slate-100 text-slate-500 hover:bg-slate-200' : 'bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100'}`}
            >
              {u.role === 'admin' ? 'Ta bort admin' : 'Gör admin'}
            </button>
            {u.id !== profile?.id && (
              <button
                onClick={() => deleteMember(u)}
                disabled={approvingId === u.id}
                title="Ta bort medlem (anonymisera)"
                className="p-1.5 text-slate-400 hover:text-red-500 disabled:opacity-50 transition-colors shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ))
      )}
    </div>
  )
}
