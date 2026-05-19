import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/useAuth'
import { getWeekDateRange, formatDateLong, getSeasonPrice } from '../lib/weeks'
import { PAYMENT, REFUND_DEADLINE_WEEKS, paymentReference } from '../lib/config'
import { cancelBooking, acceptReserveOffer, weeksUntilCheckin } from '../lib/booking-actions'
import { bookingsToIcs, downloadIcs } from '../lib/ical'
import { CalendarCheck, Clock, Users, XCircle, AlertTriangle, Ticket, Download, CreditCard, CheckCircle2, MessageSquare, Pencil, Save } from 'lucide-react'

export default function BookingsPage() {
  const { profile } = useAuth()
  const [bookings, setBookings] = useState([])
  const [neighbors, setNeighbors] = useState({})
  const [lotteryApps, setLotteryApps] = useState([])
  const [loading, setLoading] = useState(true)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [cancelling, setCancelling] = useState(false)
  const [reserveOffers, setReserveOffers] = useState([])
  const [acceptingOffer, setAcceptingOffer] = useState(null)
  const [editingNoteId, setEditingNoteId] = useState(null)
  const [noteDraft, setNoteDraft] = useState('')

  async function fetchData() {
    if (!profile) return

    const [{ data: bookingData }, { data: lotteryData }, { data: offerData }] = await Promise.all([
      supabase
        .from('bookings')
        .select('*')
        .eq('user_id', profile.id)
        .eq('status', 'confirmed')
        .order('year', { ascending: true })
        .order('week_number', { ascending: true }),
      supabase
        .from('lottery_applications')
        .select('*')
        .eq('user_id', profile.id)
        .order('year', { ascending: true })
        .order('week_number', { ascending: true }),
      supabase
        .from('reserve_offers')
        .select('*')
        .eq('offered_to_user_id', profile.id)
        .eq('status', 'pending')
        .gt('deadline', new Date().toISOString()),
    ])

    setBookings(bookingData || [])
    setLotteryApps(lotteryData || [])
    setReserveOffers(offerData || [])

    if (bookingData?.length) {
      // Hämta alla grannar i en enda query per år istället för en per bokning.
      const yearGroups = new Map()
      for (const b of bookingData) {
        const set = yearGroups.get(b.year) ?? new Set()
        set.add(b.week_number - 1)
        set.add(b.week_number + 1)
        yearGroups.set(b.year, set)
      }
      const yearWeeks = await Promise.all(
        Array.from(yearGroups.entries()).map(([year, weeks]) =>
          supabase
            .from('weeks')
            .select('year, week_number, booked_by:users(name, phone)')
            .eq('year', year)
            .eq('status', 'booked')
            .in('week_number', Array.from(weeks))
            .then(({ data }) => data || [])
        )
      )
      const lookup = new Map()
      for (const rows of yearWeeks) {
        for (const w of rows) lookup.set(`${w.year}-${w.week_number}`, w.booked_by)
      }
      const neighborMap = {}
      for (const b of bookingData) {
        neighborMap[`${b.year}-${b.week_number}`] = {
          before: lookup.get(`${b.year}-${b.week_number - 1}`),
          after: lookup.get(`${b.year}-${b.week_number + 1}`),
        }
      }
      setNeighbors(neighborMap)
    }

    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [profile])

  async function handleCancel(booking) {
    setCancelling(true)
    try {
      await cancelBooking({ profile, booking })
    } catch (e) {
      console.error(e)
    }
    setCancelTarget(null)
    setCancelling(false)
    fetchData()
  }

  async function acceptOffer(offer) {
    setAcceptingOffer(offer.id)
    try {
      await acceptReserveOffer({ profile, offer })
    } catch (e) {
      console.error(e)
    }
    setAcceptingOffer(null)
    fetchData()
  }

  async function saveNote(bookingId) {
    const trimmed = noteDraft.trim().slice(0, 200)
    await supabase.from('bookings').update({ note: trimmed || null }).eq('id', bookingId)
    setBookings((prev) => prev.map((b) => b.id === bookingId ? { ...b, note: trimmed || null } : b))
    setEditingNoteId(null)
    setNoteDraft('')
  }

  const statusLabel = {
    pending: { text: 'Väntar på lottning', color: 'text-purple-600' },
    won: { text: 'Vunnen', color: 'text-emerald-600' },
    reserve: { text: 'Reserv', color: 'text-amber-600' },
    lost: { text: 'Ej vald', color: 'text-slate-400' },
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <CalendarCheck className="w-5 h-5 text-red-600" />
          Mina bokningar
        </h1>
        <p className="text-slate-400 text-sm mt-0.5">Bekräftade bokningar och lottningsanmälningar</p>
      </div>

      {reserveOffers.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-amber-500 uppercase tracking-wide">Erbjudande — svara inom 48h</h2>
          {reserveOffers.map((offer) => {
            const dates = getWeekDateRange(offer.year, offer.week_number)
            const deadline = new Date(offer.deadline)
            const hoursLeft = Math.max(0, Math.round((deadline - Date.now()) / 3600000))
            return (
              <div key={offer.id} className="bg-amber-50 border border-amber-300 rounded-xl p-4 space-y-3 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">
                      Vecka {offer.week_number}, {offer.year} — {formatDateLong(dates.checkIn)} – {formatDateLong(dates.checkOut)}
                    </div>
                    <div className="text-xs text-amber-700 mt-0.5">
                      En avbokning har skett. Du erbjuds som reserv att ta platsen.
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">{hoursLeft}h kvar att svara</div>
                  </div>
                </div>
                <button
                  onClick={() => acceptOffer(offer)}
                  disabled={acceptingOffer === offer.id}
                  className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-medium rounded-lg px-4 py-2.5 text-sm flex items-center justify-center gap-2 transition-colors"
                >
                  {acceptingOffer === offer.id ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Acceptera bokning'
                  )}
                </button>
              </div>
            )
          })}
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Bekräftade bokningar</h2>
          {bookings.length > 0 && (
            <button
              onClick={() => downloadIcs(`bik-stugan-${profile.name.replace(/\s+/g, '-').toLowerCase()}.ics`, bookingsToIcs(bookings))}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
              title="Lägg till i Google/Apple Calendar"
            >
              <Download className="w-3.5 h-3.5" />
              Lägg till i kalender
            </button>
          )}
        </div>
        {bookings.length === 0 ? (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center text-slate-400 text-sm">
            Du har inga bekräftade bokningar ännu.
          </div>
        ) : (
          bookings.map((b) => {
            const dates = getWeekDateRange(b.year, b.week_number)
            const season = getSeasonPrice(b.week_number)
            const key = `${b.year}-${b.week_number}`
            const nb = neighbors[key]
            const reference = paymentReference(profile, b.year, b.week_number)

            return (
              <div key={b.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                      <span className="text-sm font-bold text-emerald-700">V{b.week_number}</span>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-700">
                        {formatDateLong(dates.checkIn)} – {formatDateLong(dates.checkOut)}, {b.year}
                      </div>
                      <div className="text-xs text-slate-400">{season.label} · {b.price} kr</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setCancelTarget(b)}
                    className="text-xs text-slate-400 hover:text-red-500 transition-colors"
                  >
                    Avboka
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    In: {formatDateLong(dates.checkIn)} kl 12:00
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    Ut: {formatDateLong(dates.checkOut)} kl 12:00
                  </span>
                </div>

                {b.deposit_paid ? (
                  <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 text-xs text-emerald-700">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    Anmälningsavgift {b.deposit_amount || PAYMENT.depositAmount} kr betald
                  </div>
                ) : (
                  <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 space-y-1">
                    <div className="flex items-center gap-2 text-xs text-amber-800 font-medium">
                      <CreditCard className="w-3.5 h-3.5 shrink-0" />
                      Anmälningsavgift {b.deposit_amount || PAYMENT.depositAmount} kr — ej betald
                    </div>
                    <div className="text-[11px] text-amber-700">
                      Plusgiro: <strong>{PAYMENT.plusgiro}</strong> ({PAYMENT.payee}) · Meddelande: <strong>{reference}</strong>
                    </div>
                  </div>
                )}

                {(() => {
                  const remaining = Math.max(0, (b.price || 0) - (b.deposit_amount || PAYMENT.depositAmount))
                  if (remaining === 0) return null
                  return b.final_paid ? (
                    <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 text-xs text-emerald-700">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      Slutbetalning {remaining.toLocaleString('sv-SE')} kr betald
                    </div>
                  ) : (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 space-y-1">
                      <div className="flex items-center gap-2 text-xs text-slate-700 font-medium">
                        <CreditCard className="w-3.5 h-3.5 shrink-0" />
                        Slutbetalning {remaining.toLocaleString('sv-SE')} kr — ej betald
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Plusgiro: <strong>{PAYMENT.plusgiro}</strong> ({PAYMENT.payee}) · Meddelande: <strong>{reference}</strong>
                      </div>
                    </div>
                  )
                })()}

                {editingNoteId === b.id ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 space-y-2">
                    <textarea
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value.slice(0, 200))}
                      rows={2}
                      autoFocus
                      placeholder="Kommentar till bokningen (max 200 tecken)..."
                      className="w-full bg-white border border-slate-200 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/40 resize-none"
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">{noteDraft.length}/200</span>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => { setEditingNoteId(null); setNoteDraft('') }}
                          className="text-[11px] text-slate-500 hover:text-slate-700 px-2 py-1"
                        >
                          Avbryt
                        </button>
                        <button
                          onClick={() => saveNote(b.id)}
                          className="flex items-center gap-1 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 rounded"
                        >
                          <Save className="w-3 h-3" />
                          Spara
                        </button>
                      </div>
                    </div>
                  </div>
                ) : b.note ? (
                  <div className="flex items-start gap-2 bg-slate-50 rounded-lg px-3 py-2 group">
                    <MessageSquare className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-slate-600 flex-1 whitespace-pre-wrap">{b.note}</p>
                    <button
                      onClick={() => { setEditingNoteId(b.id); setNoteDraft(b.note) }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-slate-600"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setEditingNoteId(b.id); setNoteDraft('') }}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Lägg till kommentar
                  </button>
                )}

                {nb && (nb.before || nb.after) && (
                  <div className="bg-slate-50 rounded-lg p-3 space-y-1">
                    <div className="flex items-center gap-1 text-xs text-slate-400 mb-1">
                      <Users className="w-3.5 h-3.5" />
                      <span>Samordning</span>
                    </div>
                    {nb.before && (
                      <div className="text-xs text-slate-600">
                        Före dig: <span className="font-medium">{nb.before.name}</span>
                        {nb.before.phone && <span className="text-slate-400"> · {nb.before.phone}</span>}
                      </div>
                    )}
                    {nb.after && (
                      <div className="text-xs text-slate-600">
                        Efter dig: <span className="font-medium">{nb.after.name}</span>
                        {nb.after.phone && <span className="text-slate-400"> · {nb.after.phone}</span>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Lottningsanmälningar</h2>
        {lotteryApps.length === 0 ? (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center text-slate-400 text-sm">
            Du har inga aktiva lottningsanmälningar.
          </div>
        ) : (
          lotteryApps.map((app) => {
            const dates = getWeekDateRange(app.year, app.week_number)
            const st = statusLabel[app.status] || statusLabel.pending

            return (
              <div key={app.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3 shadow-sm">
                <div className="w-11 h-11 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-center">
                  <Ticket className="w-5 h-5 text-purple-600" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-700">
                    Vecka {app.week_number}, {app.year} — {formatDateLong(dates.checkIn)} – {formatDateLong(dates.checkOut)}
                  </div>
                  <div className={`text-xs mt-0.5 ${st.color}`}>
                    {st.text}
                    {app.status === 'reserve' && app.reserve_rank && ` (#${app.reserve_rank})`}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {cancelTarget && (() => {
        const weeksLeft = weeksUntilCheckin(cancelTarget.year, cancelTarget.week_number)
        const refundable = weeksLeft >= REFUND_DEADLINE_WEEKS
        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-sm px-4 pb-4">
            <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-sm p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">Avboka vecka {cancelTarget.week_number}?</h3>
                  <p className="text-xs text-slate-400">Denna åtgärd kan inte ångras.</p>
                </div>
              </div>

              {(cancelTarget.deposit_paid || cancelTarget.final_paid) && (() => {
                const remaining = Math.max(0, (cancelTarget.price || 0) - (cancelTarget.deposit_amount || PAYMENT.depositAmount))
                const parts = []
                if (cancelTarget.deposit_paid) parts.push(`anmälningsavgiften (${cancelTarget.deposit_amount || PAYMENT.depositAmount} kr)`)
                if (cancelTarget.final_paid && remaining > 0) parts.push(`slutbetalningen (${remaining.toLocaleString('sv-SE')} kr)`)
                const label = parts.join(' och ')
                return refundable ? (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-700">
                    Det är mer än {REFUND_DEADLINE_WEEKS} veckor till incheckning —
                    <strong> {label} återbetalas.</strong>
                  </div>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                    <strong>OBS:</strong> Det är mindre än {REFUND_DEADLINE_WEEKS} veckor till incheckning —
                    {' '}{label} <strong>återbetalas inte</strong>.
                  </div>
                )
              })()}

              <div className="flex gap-2">
                <button
                  onClick={() => setCancelTarget(null)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium rounded-lg px-4 py-2.5 text-sm transition-colors"
                >
                  Behåll
                </button>
                <button
                  onClick={() => handleCancel(cancelTarget)}
                  disabled={cancelling}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium rounded-lg px-4 py-2.5 text-sm flex items-center justify-center gap-1 transition-colors"
                >
                  {cancelling ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <XCircle className="w-4 h-4" />
                      Avboka
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
