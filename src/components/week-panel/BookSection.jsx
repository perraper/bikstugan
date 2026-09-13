import { CreditCard, AlertTriangle, MessageSquare, CalendarCheck } from 'lucide-react'
import { PAYMENT, REFUND_DEADLINE_WEEKS } from '../../lib/config'
import Spinner from '../Spinner'

export default function BookSection({
  season,
  remaining,
  bookNote,
  setBookNote,
  agreed,
  setAgreed,
  loading,
  onBook,
}) {
  return (
    <>
      <div className="bg-red-50 border border-red-100 rounded-lg p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-slate-500">{season.label}</div>
          </div>
          <div className="text-2xl font-bold text-red-700">{season.price} kr</div>
        </div>
        <div className="flex items-start gap-2 border-t border-red-100 pt-2">
          <CreditCard className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
          <span className="text-xs text-red-700">
            <strong>{PAYMENT.depositAmount} kr</strong> i anmälningsavgift på plusgiro — resterande {remaining} kr faktureras senare.
          </span>
        </div>
        <div className="flex items-start gap-2 text-xs text-slate-500 border-t border-red-100 pt-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
          <span>
            Vid avbokning <strong>senare än {REFUND_DEADLINE_WEEKS} veckor</strong> innan veckan återbetalas inte anmälningsavgiften.
          </span>
        </div>
      </div>

      <div>
        <label className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5">
          <MessageSquare className="w-3.5 h-3.5" />
          Kommentar (valfritt)
        </label>
        <textarea
          value={bookNote}
          onChange={(e) => setBookNote(e.target.value.slice(0, 200))}
          placeholder="T.ex. kommer sent på lördag, har med hund..."
          rows={2}
          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 resize-none"
        />
        <div className="text-[10px] text-slate-400 text-right mt-0.5">{bookNote.length}/200</div>
      </div>

      <label className="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3 cursor-pointer hover:bg-slate-100 transition-colors">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
        />
        <span className="text-xs text-slate-600 leading-relaxed">
          Jag åtar mig att betala <strong>{PAYMENT.depositAmount} kr</strong> i anmälningsavgift på plusgiro {PAYMENT.plusgiro}
          och resterande <strong>{remaining} kr</strong> enligt faktura. Jag är medveten om att avgiften
          inte återbetalas vid avbokning senare än {REFUND_DEADLINE_WEEKS} veckor innan ankomst.
        </span>
      </label>

      <button
        onClick={onBook}
        disabled={loading || !agreed}
        className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium rounded-lg px-4 py-3 text-sm flex items-center justify-center gap-2 transition-colors"
      >
        {loading ? (
          <Spinner />
        ) : (
          <>
            <CalendarCheck className="w-4 h-4" />
            Bekräfta bokning
          </>
        )}
      </button>
    </>
  )
}
