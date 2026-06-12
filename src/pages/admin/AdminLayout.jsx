import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { AdminProvider, useAdmin } from '../../context/AdminContext'
import {
  Settings, ChevronLeft, ChevronRight, CreditCard, Bug,
  Shuffle, Users, BarChart3, History, Shield, X, CalendarDays,
  Mail, Phone, User, Save, Pencil, AlertTriangle, Zap,
} from 'lucide-react'
import { getWeekDateRange, formatDateShort } from '../../lib/weeks'
import Spinner from '../../components/Spinner'

const SUBNAV = [
  { to: 'payments',  label: 'Betalningar',    icon: CreditCard, badgeKey: 'payments' },
  { to: 'issues',    label: 'Felanmälningar', icon: Bug,        badgeKey: 'issues' },
  { to: 'lottery',   label: 'Lottning',       icon: Shuffle },
  { to: 'members',   label: 'Medlemmar',      icon: Users,      badgeKey: 'members' },
  { to: 'stats',     label: 'Statistik',      icon: BarChart3 },
  { to: 'history',   label: 'Historik',       icon: History },
  { to: 'audit',     label: 'Logg',           icon: Shield },
]

function AdminSubnav() {
  const { year, setYear, allBookings, pendingUsers, openIssuesCount } = useAdmin()
  const unpaidCount = allBookings.filter((b) => !b.deposit_paid && b.status === 'confirmed').length

  const badges = {
    payments: unpaidCount,
    issues: openIssuesCount,
    members: pendingUsers.length,
  }

  return (
    <div className="sticky top-14 z-40 -mx-4 -mt-6 bg-white border-b border-slate-200">
      {/* Title row + year picker */}
      <div className="px-4 flex items-center justify-between py-2.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-red-600" />
          <h1 className="text-sm font-bold text-slate-800">Administration</h1>
        </div>
        <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-1">
          <button
            onClick={() => setYear((y) => y - 1)}
            className="p-1 hover:bg-slate-200 rounded transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5 text-slate-500" />
          </button>
          <span className="text-sm font-semibold text-slate-700 w-10 text-center">{year}</span>
          <button
            onClick={() => setYear((y) => y + 1)}
            className="p-1 hover:bg-slate-200 rounded transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
          </button>
        </div>
      </div>

      {/* Subnav links */}
      <nav className="px-4 flex gap-0.5 overflow-x-auto py-1.5" style={{ scrollbarWidth: 'none' }}>
        {SUBNAV.map(({ to, label, icon: Icon, badgeKey }) => {
          const badge = badgeKey ? (badges[badgeKey] ?? 0) : 0
          return (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-red-50 text-red-700'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`
              }
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              {label}
              {badge > 0 && (
                <span className="min-w-[16px] h-4 bg-red-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}

// ——— Member modal (shared across all sub-pages) ———
function MemberModal() {
  const {
    selectedMember, setSelectedMember,
    memberBookings,
    editForm, setEditForm, editError,
    savingEdit,
    startEditMember, saveMemberEdit,
  } = useAdmin()

  const navigate = useNavigate()
  const location = useLocation()

  if (!selectedMember) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-sm px-4 pb-4">
      <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-md p-5 space-y-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
              <CalendarDays className="w-5 h-5 text-slate-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">{selectedMember.name}</h3>
              <p className="text-xs text-slate-400">
                {selectedMember.email}{selectedMember.phone ? ` · ${selectedMember.phone}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={() => { setSelectedMember(null); setEditForm(null) }}
            className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {editForm ? (
          <div className="border border-slate-200 rounded-lg p-3 space-y-3 bg-slate-50">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Redigera medlem</h4>
              <button
                onClick={() => { setEditForm(null) }}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                Avbryt
              </button>
            </div>
            {[
              { label: 'Namn', key: 'name', type: 'text', icon: User, note: null },
              { label: 'E-post', key: 'email', type: 'email', icon: Mail, note: 'Ändras både i auth (inloggning) och medlemsregistret. Ingen bekräftelse skickas.' },
              { label: 'Telefon', key: 'phone', type: 'tel', icon: Phone, note: null },
            ].map(({ label, key, type, icon: Icon, note }) => (
              <div key={key}>
                <label className="block text-[11px] text-slate-400 mb-1">{label}</label>
                <div className="relative">
                  <Icon className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type={type}
                    value={editForm[key]}
                    onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500"
                  />
                </div>
                {note && <p className="text-[10px] text-amber-600 mt-1">{note}</p>}
              </div>
            ))}
            {editError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">{editError}</p>
            )}
            <button
              onClick={saveMemberEdit}
              disabled={savingEdit}
              className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium rounded-lg px-4 py-2 text-sm flex items-center justify-center gap-2 transition-colors"
            >
              {savingEdit ? <Spinner /> : <><Save className="w-4 h-4" />Spara</>}
            </button>
          </div>
        ) : (
          <button
            onClick={startEditMember}
            className="w-full flex items-center justify-center gap-2 text-xs text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
            Redigera medlemsinfo
          </button>
        )}

        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Bokningshistorik</h4>
        {memberBookings.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">Inga bokningar</p>
        ) : (
          <div className="space-y-2">
            {memberBookings.map((b) => {
              const dates = getWeekDateRange(b.year, b.week_number)
              return (
                <div
                  key={b.id}
                  onClick={() => {
                    setSelectedMember(null)
                    navigate(`/?year=${b.year}&week=${b.week_number}&from=${encodeURIComponent(location.pathname + location.search)}`)
                  }}
                  className={`border rounded-lg px-3 py-2 space-y-1 cursor-pointer hover:shadow-sm hover:scale-[1.01] transition-all ${
                    b.status === 'confirmed' 
                      ? 'border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/30' 
                      : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                  }`}
                  title="Klicka för att visa på kalendersidan"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-slate-700">V{b.week_number}, {b.year}</div>
                      <div className="text-xs text-slate-400">{formatDateShort(dates.checkIn)} – {formatDateShort(dates.checkOut)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-slate-600">{b.price} kr</div>
                      <div className={`text-xs ${b.status === 'confirmed' ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {b.status === 'confirmed' ? 'Bekräftad' : b.status === 'cancelled' ? 'Avbokad' : b.status}
                      </div>
                    </div>
                  </div>
                  {b.electricity && (
                    <div className="flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded px-2 py-1">
                      <Zap className="w-3 h-3 shrink-0" />
                      {b.electricity.end_kwh != null ? (
                        <span>
                          El: {b.electricity.start_kwh}→{b.electricity.end_kwh} kWh ·{' '}
                          <strong>{Math.round(Number(b.electricity.cost || 0)).toLocaleString('sv-SE')} kr</strong>
                        </span>
                      ) : (
                        <span>El påbörjad: {b.electricity.start_kwh} kWh</span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ——— Confirm dialog (shared across all sub-pages) ———
function ConfirmDialogModal() {
  const { confirmDialog, setConfirmDialog } = useAdmin()
  if (!confirmDialog) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-sm px-4 pb-4">
      <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-sm p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${confirmDialog.danger ? 'bg-red-50' : 'bg-amber-50'}`}>
            <AlertTriangle className={`w-5 h-5 ${confirmDialog.danger ? 'text-red-500' : 'text-amber-500'}`} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">{confirmDialog.title}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{confirmDialog.body}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setConfirmDialog(null)}
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium rounded-lg px-4 py-2.5 text-sm transition-colors"
          >
            Avbryt
          </button>
          <button
            onClick={confirmDialog.onConfirm}
            className={`flex-1 text-white font-medium rounded-lg px-4 py-2.5 text-sm transition-colors ${
              confirmDialog.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'
            }`}
          >
            {confirmDialog.confirmLabel || 'Bekräfta'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ——— Root layout ———
export default function AdminLayout() {
  return (
    <AdminProvider>
      <AdminSubnav />
      <div className="mt-6 space-y-5">
        <Outlet />
      </div>
      <MemberModal />
      <ConfirmDialogModal />
    </AdminProvider>
  )
}
