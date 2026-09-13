import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAdmin } from '../../context/AdminContext'
import { CalendarDays, Plus, Trash2, Wrench, Star, X } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getWeekDateRange } from '../../lib/weeks'

export default function HistorikPage() {
  const { year, allBookings } = useAdmin()
  const navigate = useNavigate()
  const location = useLocation()
  const [legacyBookings, setLegacyBookings] = useState([])
  const [legacyForm, setLegacyForm] = useState(null)
  const [savingLegacy, setSavingLegacy] = useState(false)

  const fetchLegacyBookings = useCallback(async () => {
    const { data } = await supabase.from('legacy_bookings').select('*').eq('year', year).order('week_number')
    setLegacyBookings(data || [])
  }, [year])

  useEffect(() => {
    fetchLegacyBookings() // eslint-disable-line react-hooks/set-state-in-effect
  }, [fetchLegacyBookings])

  async function saveLegacyBooking() {
    if (!legacyForm?.booked_by_name || !legacyForm?.week_number) return
    setSavingLegacy(true)
    if (legacyForm.id) {
      await supabase.from('legacy_bookings').update({
        week_number: Number(legacyForm.week_number),
        booked_by_name: legacyForm.booked_by_name,
        reserve_name: legacyForm.reserve_name || null,
        type: legacyForm.type,
        price: legacyForm.price ? Number(legacyForm.price) : null,
        paid: legacyForm.paid || null,
        notes: legacyForm.notes || null,
      }).eq('id', legacyForm.id)
    } else {
      await supabase.from('legacy_bookings').insert({
        year,
        week_number: Number(legacyForm.week_number),
        booked_by_name: legacyForm.booked_by_name,
        reserve_name: legacyForm.reserve_name || null,
        type: legacyForm.type || 'booking',
        price: legacyForm.price ? Number(legacyForm.price) : null,
        paid: legacyForm.paid || null,
        notes: legacyForm.notes || null,
      })
    }
    setLegacyForm(null)
    setSavingLegacy(false)
    fetchLegacyBookings()
  }

  async function deleteLegacyBooking(id) {
    await supabase.from('legacy_bookings').delete().eq('id', id)
    setLegacyBookings((prev) => prev.filter((b) => b.id !== id))
  }

  const inputCls = 'w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  const realEntries = allBookings
    .filter((b) => b.status === 'confirmed')
    .map((b) => ({ _src: 'real', week_number: b.week_number, _b: b }))
  const legacyEntries = legacyBookings.map((b) => ({ _src: 'legacy', week_number: b.week_number, _b: b }))
  const combined = [...realEntries, ...legacyEntries].sort((a, b) => a.week_number - b.week_number)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Bokningar & Historik {year}</h2>
        <button
          onClick={() => setLegacyForm({ type: 'booking', week_number: '', booked_by_name: '', reserve_name: '', price: '', paid: '', notes: '' })}
          className="flex items-center gap-1 text-xs bg-blue-50 text-blue-600 border border-blue-200 px-2.5 py-1.5 rounded-lg hover:bg-blue-100 transition-colors font-medium"
        >
          <Plus className="w-3.5 h-3.5" />
          Lägg till
        </button>
      </div>

      {legacyForm && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-sm">
          <h3 className="text-sm font-medium text-slate-700">{legacyForm.id ? 'Redigera bokning' : 'Ny bokning'}</h3>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Vecka</label>
              <input type="number" min="1" max="53" value={legacyForm.week_number} onChange={(e) => setLegacyForm((f) => ({ ...f, week_number: e.target.value }))} className={inputCls} placeholder="v.nr" />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Typ</label>
              <select value={legacyForm.type} onChange={(e) => setLegacyForm((f) => ({ ...f, type: e.target.value }))} className={inputCls}>
                <option value="booking">Bokning</option>
                <option value="maintenance">Underhåll</option>
                <option value="cancelled">Avbokad</option>
                <option value="interest">Intresselista</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Bokad av</label>
            <input type="text" value={legacyForm.booked_by_name} onChange={(e) => setLegacyForm((f) => ({ ...f, booked_by_name: e.target.value }))} className={inputCls} placeholder="Namn" />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Reserv / Extra namn</label>
            <input type="text" value={legacyForm.reserve_name || ''} onChange={(e) => setLegacyForm((f) => ({ ...f, reserve_name: e.target.value }))} className={inputCls} placeholder="Valfritt" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Pris (kr)</label>
              <input type="number" value={legacyForm.price || ''} onChange={(e) => setLegacyForm((f) => ({ ...f, price: e.target.value }))} className={inputCls} placeholder="t.ex. 1750" />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Betalt</label>
              <input type="text" value={legacyForm.paid || ''} onChange={(e) => setLegacyForm((f) => ({ ...f, paid: e.target.value }))} className={inputCls} placeholder="t.ex. 500+1250" />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Anteckning</label>
            <input type="text" value={legacyForm.notes || ''} onChange={(e) => setLegacyForm((f) => ({ ...f, notes: e.target.value }))} className={inputCls} placeholder="Valfritt" />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={() => setLegacyForm(null)} className="flex-1 border border-slate-200 text-slate-500 rounded-lg py-2 text-sm hover:bg-slate-50 transition-colors">Avbryt</button>
            <button
              onClick={saveLegacyBooking}
              disabled={savingLegacy || !legacyForm.booked_by_name || !legacyForm.week_number}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {savingLegacy ? 'Sparar...' : 'Spara'}
            </button>
          </div>
        </div>
      )}

      {combined.length === 0 ? (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 text-center text-slate-400 text-sm">
          Inga bokningar för {year}.
        </div>
      ) : (
        <div className="space-y-1.5">
          {combined.map((entry) => {
            if (entry._src === 'real') {
              const b = entry._b
              const { checkOut } = getWeekDateRange(b.year, b.week_number)
              const upcoming = checkOut >= new Date()
              const payStatus = b.deposit_paid && b.final_paid ? 'Fullt betald' : b.deposit_paid ? 'Anm.avg betald' : null
              return (
                <div
                  key={`real-${b.id}`}
                  onClick={() => navigate(`/?year=${year}&week=${b.week_number}&from=${encodeURIComponent(location.pathname + location.search)}`)}
                  className={`border rounded-lg px-3 py-2 flex items-center gap-2.5 cursor-pointer hover:shadow-sm transition-all ${upcoming ? 'border-emerald-200 bg-emerald-50/40' : 'border-sky-200 bg-sky-50/40'}`}
                  title="Klicka för att visa på kalendersidan"
                >
                  <div className="text-xs font-bold text-slate-500 w-7 shrink-0">V{b.week_number}</div>
                  <CalendarDays className={`w-3.5 h-3.5 shrink-0 ${upcoming ? 'text-emerald-500' : 'text-sky-500'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-700 truncate">{b.user?.name || 'Okänd'}</div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {[b.price ? `${b.price} kr` : null, payStatus].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${upcoming ? 'text-emerald-700 bg-emerald-100' : 'text-sky-600 bg-sky-100'}`}>
                    {upcoming ? 'Kommande' : 'Genomförd'}
                  </span>
                </div>
              )
            }

            const b = entry._b
            const typeConfig = {
              booking:     { bg: 'bg-white',       border: 'border-slate-200', icon: <CalendarDays className="w-3.5 h-3.5 text-blue-500" />,   label: null },
              maintenance: { bg: 'bg-amber-50/60', border: 'border-amber-200', icon: <Wrench className="w-3.5 h-3.5 text-amber-500" />,         label: 'Underhåll' },
              cancelled:   { bg: 'bg-slate-50',    border: 'border-slate-200', icon: <X className="w-3.5 h-3.5 text-slate-400" />,              label: 'Avbokad' },
              interest:    { bg: 'bg-purple-50/60',border: 'border-purple-200',icon: <Star className="w-3.5 h-3.5 text-purple-500" />,          label: 'Intresse' },
            }[b.type] || { bg: 'bg-white', border: 'border-slate-200', icon: null, label: null }
            return (
              <div
                key={`legacy-${b.id}`}
                onClick={(e) => {
                  if (!e.target.closest('button')) {
                    navigate(`/?year=${year}&week=${b.week_number}&from=${encodeURIComponent(location.pathname + location.search)}`)
                  }
                }}
                className={`border rounded-lg px-3 py-2 flex items-center gap-2.5 cursor-pointer hover:shadow-sm transition-all ${typeConfig.bg} ${typeConfig.border}`}
                title="Klicka för att visa på kalendersidan"
              >
                <div className="text-xs font-bold text-slate-500 w-7 shrink-0">V{b.week_number}</div>
                {typeConfig.icon}
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium truncate ${b.type === 'cancelled' ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                    {b.booked_by_name}
                    {b.reserve_name && <span className="text-slate-400 font-normal"> / {b.reserve_name}</span>}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">
                    {[typeConfig.label, b.price ? `${b.price} kr` : null, b.paid ? `betalt: ${b.paid}` : null, b.notes].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => setLegacyForm({ ...b })} className="text-[10px] px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded transition-colors">
                    Redigera
                  </button>
                  <button
                    onClick={() => deleteLegacyBooking(b.id)}
                    aria-label="Ta bort historisk bokning"
                    className="p-1 hover:bg-red-50 text-slate-300 hover:text-red-400 rounded transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
