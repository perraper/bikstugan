import { useAdmin } from '../../context/AdminContext'
import { PAYMENT } from '../../lib/config'
import { getWeekDateRange, formatDateShort } from '../../lib/weeks'
import { CheckCircle2, CreditCard, RotateCcw, Zap, MessageSquare, Send, Trash2, Pencil } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

export default function BetalningarPage() {
  const {
    year, weeks, totalWeeks, allBookings,
    toggleDepositPaid, toggleFinalPaid, toggleElectricityPaid,
    markRefunded, markFinalRefunded,
    finalRemaining, cancelBookingAdmin, sendReminder, saveElectricity, showMemberBookings
  } = useAdmin()

  const [filter, setFilter] = useState('all') // 'all' | 'unpaid_deposit' | 'unpaid_final' | 'unpaid_electricity' | 'paid_deposit'

  const navigate = useNavigate()
  const location = useLocation()

  const [editingElecId, setEditingElecId] = useState(null)
  const [elecStart, setElecStart] = useState('')
  const [elecEnd, setElecEnd] = useState('')

  const unpaidDeposits = allBookings.filter((b) => !b.deposit_paid && b.status === 'confirmed')
  const unpaidFinals = allBookings.filter((b) => !b.final_paid && b.status === 'confirmed')
  const unpaidElectricity = allBookings.filter((b) => b.status === 'confirmed' && b.electricity && b.electricity.cost > 0 && !b.electricity.electricity_paid)
  const paidDeposits = allBookings.filter((b) => b.deposit_paid && b.status === 'confirmed')

  const refundsPending = allBookings.filter(
    (b) => b.status === 'cancelled' && b.deposit_paid && b.deposit_refundable === true
  )
  const finalRefundsPending = allBookings.filter(
    (b) => b.status === 'cancelled' && b.final_paid && b.final_refundable === true && finalRemaining(b) > 0
  )

  const handleFilterClick = (newFilter) => {
    setFilter((prev) => (prev === newFilter ? 'all' : newFilter))
  }

  const filteredBookings = allBookings
    .filter((b) => b.status === 'confirmed')
    .filter((b) => {
      if (filter === 'unpaid_deposit') return !b.deposit_paid
      if (filter === 'unpaid_final') return !b.final_paid && finalRemaining(b) > 0
      if (filter === 'unpaid_electricity') return b.electricity && b.electricity.cost > 0 && !b.electricity.electricity_paid
      if (filter === 'paid_deposit') return b.deposit_paid
      return true
    })

  const dbBooked = weeks.filter((w) => w.status === 'booked').length
  const dbAvailable = weeks.filter((w) => w.status === 'available').length
  const dbLottery = weeks.filter((w) => w.status === 'lottery').length
  const untracked = totalWeeks - weeks.length

  return (
    <div className="space-y-4">
      {/* Quick stats */}
      <div className="flex gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" />{dbAvailable} lediga</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" />{dbBooked} bokade</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-purple-500" />{dbLottery + untracked} lottning</span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {/* Obetalda anm.avg */}
        <div
          onClick={() => handleFilterClick('unpaid_deposit')}
          className={`cursor-pointer rounded-lg p-3 transition-all border ${
            filter === 'unpaid_deposit'
              ? 'ring-2 ring-amber-400 border-amber-300 shadow-sm bg-amber-50'
              : 'bg-amber-50/40 border-amber-200 hover:bg-amber-50/80'
          }`}
        >
          <div className="text-xs font-semibold text-amber-700">Obetalda anm.avg</div>
          <div className="text-lg font-bold text-amber-700">{unpaidDeposits.length}</div>
          <div className="text-[11px] text-amber-600">
            {unpaidDeposits.reduce((sum, b) => sum + (b.deposit_amount || PAYMENT.depositAmount), 0)} kr
          </div>
        </div>

        {/* Utestående slutbet. */}
        <div
          onClick={() => handleFilterClick('unpaid_final')}
          className={`cursor-pointer rounded-lg p-3 transition-all border ${
            filter === 'unpaid_final'
              ? 'ring-2 ring-slate-400 border-slate-300 shadow-sm bg-slate-50'
              : 'bg-slate-50/40 border-slate-200 hover:bg-slate-50/80'
          }`}
        >
          <div className="text-xs font-semibold text-slate-500">Utestående slutbet.</div>
          <div className="text-lg font-bold text-slate-700">
            {unpaidFinals.reduce((sum, b) => sum + finalRemaining(b), 0).toLocaleString('sv-SE')} kr
          </div>
          <div className="text-[11px] text-slate-400">
            {unpaidFinals.filter((b) => finalRemaining(b) > 0).length} bokningar
          </div>
        </div>

        {/* Obetald el */}
        <div
          onClick={() => handleFilterClick('unpaid_electricity')}
          className={`cursor-pointer rounded-lg p-3 transition-all border ${
            filter === 'unpaid_electricity'
              ? 'ring-2 ring-orange-400 border-orange-300 shadow-sm bg-orange-50'
              : 'bg-orange-50/40 border-orange-200 hover:bg-orange-50/80'
          }`}
        >
          <div className="text-xs font-semibold text-orange-700 flex items-center gap-1">
            <Zap className="w-3 h-3 text-orange-500 shrink-0" />
            Obetald el
          </div>
          <div className="text-lg font-bold text-orange-700">{unpaidElectricity.length}</div>
          <div className="text-[11px] text-orange-600">
            {Math.round(unpaidElectricity.reduce((sum, b) => sum + Number(b.electricity?.cost || 0), 0)).toLocaleString('sv-SE')} kr
          </div>
        </div>

        {/* Anm.avg betalda */}
        <div
          onClick={() => handleFilterClick('paid_deposit')}
          className={`cursor-pointer rounded-lg p-3 transition-all border ${
            filter === 'paid_deposit'
              ? 'ring-2 ring-emerald-400 border-emerald-300 shadow-sm bg-emerald-50'
              : 'bg-emerald-50/40 border-emerald-200 hover:bg-emerald-50/80'
          }`}
        >
          <div className="text-xs font-semibold text-emerald-700">Anm.avg betalda</div>
          <div className="text-lg font-bold text-emerald-700">
            {paidDeposits.length}
          </div>
          <div className="text-[11px] text-emerald-600">
            Visa bara betalda
          </div>
        </div>
      </div>

      {/* Refunds */}
      {(refundsPending.length > 0 || finalRefundsPending.length > 0) && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
            <RotateCcw className="w-4 h-4" />
            Återbetalningar att hantera ({refundsPending.length + finalRefundsPending.length})
          </div>
          {refundsPending.map((b) => (
            <div key={`dep-${b.id}`} className="bg-white border border-blue-100 rounded-lg p-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-700 truncate">
                  V{b.week_number} · {b.user?.name || 'Okänd'} · <span className="text-blue-700">anm.avg</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Avbokad {b.cancelled_at ? new Date(b.cancelled_at).toLocaleDateString('sv-SE') : ''} · {b.deposit_amount || PAYMENT.depositAmount} kr ska återbetalas
                </div>
              </div>
              <button
                onClick={() => markRefunded(b)}
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-medium shrink-0"
              >
                Återbetalad
              </button>
            </div>
          ))}
          {finalRefundsPending.map((b) => (
            <div key={`fin-${b.id}`} className="bg-white border border-blue-100 rounded-lg p-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-700 truncate">
                  V{b.week_number} · {b.user?.name || 'Okänd'} · <span className="text-blue-700">slutbet.</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Avbokad {b.cancelled_at ? new Date(b.cancelled_at).toLocaleDateString('sv-SE') : ''} · {finalRemaining(b).toLocaleString('sv-SE')} kr ska återbetalas
                </div>
              </div>
              <button
                onClick={() => markFinalRefunded(b)}
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-medium shrink-0"
              >
                Återbetalad
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Booking list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            Bokningar {year} {filter !== 'all' && '· Filtrerad'} ({filteredBookings.length})
          </h2>
          {filter !== 'all' && (
            <button
              onClick={() => setFilter('all')}
              className="text-[11px] text-red-600 hover:underline font-medium"
            >
              Rensa filter
            </button>
          )}
        </div>
        {filteredBookings.length === 0 ? (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center text-slate-400 text-sm">
            {filter === 'all' ? `Inga bokningar för ${year}.` : 'Inga bokningar matchar filtret.'}
          </div>
        ) : (
          filteredBookings.map((b) => {
            const dates = getWeekDateRange(b.year, b.week_number)
            const fullyPaid = b.deposit_paid && b.final_paid
            const remaining = finalRemaining(b)
            return (
              <div
                key={b.id}
                onClick={(e) => {
                  if (e.target.closest('.member-link')) {
                    showMemberBookings(b.user)
                  } else if (!e.target.closest('button') && !e.target.closest('input')) {
                    navigate(`/?year=${b.year}&week=${b.week_number}&from=${encodeURIComponent(location.pathname + location.search)}`)
                  }
                }}
                className={`border rounded-lg px-3 py-2.5 cursor-pointer hover:shadow-sm transition-all ${
                  fullyPaid
                    ? 'bg-emerald-50/40 border-emerald-200 hover:bg-emerald-50/80'
                    : b.deposit_paid
                    ? 'bg-sky-50/40 border-sky-200 hover:bg-sky-50/80'
                    : 'bg-amber-50/40 border-amber-200 hover:bg-amber-50/80'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="text-xs font-bold text-slate-600 w-7 shrink-0">V{b.week_number}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-700 truncate">
                      <span className="member-link hover:underline cursor-pointer text-slate-800 font-semibold" title="Visa medlemshistorik">
                        {b.user?.name || 'Okänd'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {formatDateShort(dates.checkIn)} – {formatDateShort(dates.checkOut)} · {b.price} kr
                      {!b.final_paid && remaining > 0 && (
                        <span className="text-slate-500"> · kvar {remaining.toLocaleString('sv-SE')} kr</span>
                      )}
                      {!b.deposit_paid && b.deposit_reminder_count > 0 && (
                        <span className="text-amber-600"> · {b.deposit_reminder_count} påm. skickad{b.deposit_reminder_count > 1 ? 'e' : ''}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-1.5 shrink-0">
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => toggleDepositPaid(b)}
                        title={b.deposit_paid ? 'Anmälningsavgift betald' : 'Markera anmälningsavgift som betald'}
                        className={`flex items-center justify-between gap-1.5 text-[11px] px-2.5 py-1 rounded-lg font-medium transition-colors min-w-[105px] ${
                          b.deposit_paid
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                            : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                        }`}
                      >
                        <span className="flex items-center gap-1">
                          {b.deposit_paid ? <CheckCircle2 className="w-3 h-3" /> : <CreditCard className="w-3 h-3" />}
                          Anm.avg
                        </span>
                        <span className="text-[10px] opacity-75">{b.deposit_amount || PAYMENT.depositAmount} kr</span>
                      </button>
                      <button
                        onClick={() => toggleFinalPaid(b)}
                        title={b.final_paid ? 'Slutbetalning klar' : 'Markera slutbetalning som klar'}
                        className={`flex items-center justify-between gap-1.5 text-[11px] px-2.5 py-1 rounded-lg font-medium transition-colors min-w-[105px] ${
                          b.final_paid
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        <span className="flex items-center gap-1">
                          {b.final_paid ? <CheckCircle2 className="w-3 h-3" /> : <CreditCard className="w-3 h-3" />}
                          Slutbet.
                        </span>
                        <span className="text-[10px] opacity-75">{remaining.toLocaleString('sv-SE')} kr</span>
                      </button>
                    </div>
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => sendReminder(b)}
                        className="flex items-center justify-center gap-1.5 text-[11px] bg-blue-100 hover:bg-blue-200 text-blue-700 px-2.5 py-1 rounded-lg font-medium transition-colors w-full sm:w-auto min-w-[85px]"
                      >
                        <Send className="w-3 h-3" /> Påminn
                      </button>
                      <button
                        onClick={() => cancelBookingAdmin(b)}
                        className="flex items-center justify-center gap-1.5 text-[11px] bg-red-100 hover:bg-red-200 text-red-700 px-2.5 py-1 rounded-lg font-medium transition-colors w-full sm:w-auto min-w-[85px]"
                      >
                        <Trash2 className="w-3 h-3" /> Ta bort
                      </button>
                    </div>
                  </div>
                </div>
                {editingElecId === b.id ? (
                  <div className="mt-2 flex items-center gap-2 text-[11px] bg-white border border-amber-200 rounded px-2 py-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <input type="number" placeholder="Start" value={elecStart} onChange={(e) => setElecStart(e.target.value)} className="w-16 border border-slate-200 rounded px-1.5 py-0.5 focus:outline-none focus:border-amber-400" />
                    <span className="text-slate-400">→</span>
                    <input type="number" placeholder="Slut" value={elecEnd} onChange={(e) => setElecEnd(e.target.value)} className="w-16 border border-slate-200 rounded px-1.5 py-0.5 focus:outline-none focus:border-amber-400" />
                    <div className="flex gap-1 ml-auto">
                      <button onClick={() => { setEditingElecId(null); setElecStart(''); setElecEnd('') }} className="text-slate-500 hover:text-slate-700 px-1.5">Avbryt</button>
                      <button onClick={() => { saveElectricity(b.id, elecStart ? Number(elecStart) : null, elecEnd ? Number(elecEnd) : null); setEditingElecId(null) }} className="bg-amber-500 hover:bg-amber-600 text-white rounded px-2 py-0.5 font-medium">Spara</button>
                    </div>
                  </div>
                ) : b.electricity ? (
                  <div className={`mt-2 flex items-center justify-between gap-1.5 text-[11px] border rounded px-2 py-1 transition-colors ${
                    b.electricity.electricity_paid 
                      ? 'text-emerald-700 bg-emerald-50/80 border-emerald-100' 
                      : 'text-amber-700 bg-amber-50/80 border-amber-100'
                  }`}>
                    <div className="flex items-center gap-1.5">
                      <Zap className="w-3 h-3 shrink-0" />
                      {b.electricity.end_kwh != null ? (
                        <span>
                          El: {b.electricity.start_kwh}→{b.electricity.end_kwh} kWh ({Math.max(0, b.electricity.end_kwh - b.electricity.start_kwh)} kWh) ·{' '}
                          <strong>{Math.round(Number(b.electricity.cost || 0)).toLocaleString('sv-SE')} kr</strong>
                        </span>
                      ) : (
                        <span>El påbörjad: {b.electricity.start_kwh} kWh (slutavläsning saknas)</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {b.electricity.end_kwh != null && (
                        <button
                          onClick={() => toggleElectricityPaid(b)}
                          className={`text-[10px] px-2 py-0.5 rounded font-semibold transition-colors ${
                            b.electricity.electricity_paid
                              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                              : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                          }`}
                        >
                          {b.electricity.electricity_paid ? 'El betald' : 'Markera betald'}
                        </button>
                      )}
                      <button 
                        onClick={() => { setEditingElecId(b.id); setElecStart(b.electricity.start_kwh ?? ''); setElecEnd(b.electricity.end_kwh ?? '') }}
                        className="p-1 hover:bg-amber-200/50 rounded transition-colors"
                        title="Redigera elavläsning"
                      >
                        <Pencil className="w-3 h-3 opacity-60 hover:opacity-100" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2">
                    <button 
                      onClick={() => { setEditingElecId(b.id); setElecStart(''); setElecEnd('') }}
                      className="flex items-center gap-1.5 text-[10px] text-slate-400 hover:text-amber-600 transition-colors"
                    >
                      <Zap className="w-3 h-3" /> Lägg till elavläsning
                    </button>
                  </div>
                )}
                {b.note && (
                  <div className="mt-2 flex items-start gap-1.5 text-[11px] text-slate-500 bg-white/60 rounded px-2 py-1">
                    <MessageSquare className="w-3 h-3 mt-0.5 shrink-0" />
                    <span className="whitespace-pre-wrap">{b.note}</span>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
