import { AlertTriangle, XCircle } from 'lucide-react'
import { PAYMENT, REFUND_DEADLINE_WEEKS } from '../lib/config'
import { isRefundable } from '../lib/booking-actions'
import Spinner from './Spinner'

// Återanvändbart innehåll för "Avboka bokning?"-dialog.
// Renderar inte egen overlay — konsumenten bestämmer (modal eller inbäddat).
export default function CancelBookingConfirm({ booking, onCancel, onConfirm, loading }) {
  const refundable = isRefundable(booking.year, booking.week_number)
  const remaining = Math.max(0, (booking.price || 0) - (booking.deposit_amount || PAYMENT.depositAmount))
  const parts = []
  if (booking.deposit_paid) {
    parts.push(`anmälningsavgiften (${booking.deposit_amount || PAYMENT.depositAmount} kr)`)
  }
  if (booking.final_paid && remaining > 0) {
    parts.push(`slutbetalningen (${remaining.toLocaleString('sv-SE')} kr)`)
  }
  const label = parts.join(' och ')
  const showRefundInfo = booking.deposit_paid || booking.final_paid

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-5 h-5 text-red-500" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Avboka vecka {booking.week_number}?</h3>
          <p className="text-xs text-slate-400">Denna åtgärd kan inte ångras.</p>
        </div>
      </div>

      {showRefundInfo && (
        refundable ? (
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
      )}

      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium rounded-lg px-4 py-2.5 text-sm transition-colors"
        >
          Behåll
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium rounded-lg px-4 py-2.5 text-sm flex items-center justify-center gap-1 transition-colors"
        >
          {loading ? <Spinner /> : <><XCircle className="w-4 h-4" /> Avboka</>}
        </button>
      </div>
    </div>
  )
}
