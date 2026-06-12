import { useAdmin } from '../../context/AdminContext'
import { PAYMENT } from '../../lib/config'
import { getWeekDateRange, formatDateShort } from '../../lib/weeks'
import { CheckCircle2, CreditCard, RotateCcw, Zap, MessageSquare } from 'lucide-react'

export default function BetalningarPage() {
  const {
    year, weeks, totalWeeks, allBookings,
    toggleDepositPaid, toggleFinalPaid,
    markRefunded, markFinalRefunded,
    finalRemaining,
  } = useAdmin()

  const unpaidDeposits = allBookings.filter((b) => !b.deposit_paid && b.status === 'confirmed')
  const unpaidFinals = allBookings.filter((b) => !b.final_paid && b.status === 'confirmed')
  const refundsPending = allBookings.filter(
    (b) => b.status === 'cancelled' && b.deposit_paid && b.deposit_refundable === true
  )
  const finalRefundsPending = allBookings.filter(
    (b) => b.status === 'cancelled' && b.final_paid && b.final_refundable === true && finalRemaining(b) > 0
  )

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
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
          <div className="text-xs text-emerald-700">Anm.avg betalda</div>
          <div className="text-lg font-bold text-emerald-700">
            {allBookings.filter((b) => b.deposit_paid && b.status === 'confirmed').length}
          </div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div className="text-xs text-amber-700">Obetalda anm.avg</div>
          <div className="text-lg font-bold text-amber-700">{unpaidDeposits.length}</div>
          <div className="text-[11px] text-amber-600">
            {unpaidDeposits.reduce((sum, b) => sum + (b.deposit_amount || PAYMENT.depositAmount), 0)} kr
          </div>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
          <div className="text-xs text-slate-500">Utestående slutbet.</div>
          <div className="text-lg font-bold text-slate-700">
            {unpaidFinals.reduce((sum, b) => sum + finalRemaining(b), 0).toLocaleString('sv-SE')} kr
          </div>
          <div className="text-[11px] text-slate-400">
            {unpaidFinals.filter((b) => finalRemaining(b) > 0).length} bokningar
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
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Bokningar {year}</h2>
        {allBookings.length === 0 ? (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center text-slate-400 text-sm">
            Inga bokningar för {year}.
          </div>
        ) : (
          allBookings.filter((b) => b.status === 'confirmed').map((b) => {
            const dates = getWeekDateRange(b.year, b.week_number)
            const fullyPaid = b.deposit_paid && b.final_paid
            const remaining = finalRemaining(b)
            return (
              <div
                key={b.id}
                className={`border rounded-lg px-3 py-2.5 ${
                  fullyPaid
                    ? 'bg-emerald-50/40 border-emerald-200'
                    : b.deposit_paid
                    ? 'bg-sky-50/40 border-sky-200'
                    : 'bg-amber-50/40 border-amber-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="text-xs font-bold text-slate-600 w-7 shrink-0">V{b.week_number}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-700 truncate">{b.user?.name || 'Okänd'}</div>
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
                  <div className="flex flex-col gap-1 shrink-0">
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
                </div>
                {b.electricity && (
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50/80 border border-amber-100 rounded px-2 py-1">
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
