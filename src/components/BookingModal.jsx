import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { getSeasonPrice, getWeekDateRange, formatDateLong } from '../lib/weeks'
import { PAYMENT, REFUND_DEADLINE_WEEKS, paymentReference } from '../lib/config'
import { X, CalendarCheck, Clock, Bed, Zap, AlertTriangle, CreditCard, Copy, Check, MessageSquare } from 'lucide-react'

export default function BookingModal({ week, year, onClose }) {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [copiedField, setCopiedField] = useState(null)
  const [note, setNote] = useState('')

  const season = getSeasonPrice(week.week_number)
  const dates = getWeekDateRange(year, week.week_number)
  const reference = paymentReference(profile, year, week.week_number)
  const remaining = season.price - PAYMENT.depositAmount

  function copyToClipboard(text, field) {
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 1500)
    }).catch(() => {})
  }

  async function handleBook() {
    setLoading(true)
    setError('')

    const { error: err } = await supabase
      .from('weeks')
      .upsert({
        year,
        week_number: week.week_number,
        status: 'booked',
        booked_by_user_id: profile.id,
        price: season.price,
      }, { onConflict: 'year,week_number' })

    if (err) {
      setError(err.message)
    } else {
      await supabase.from('bookings').insert({
        user_id: profile.id,
        year,
        week_number: week.week_number,
        price: season.price,
        status: 'confirmed',
        note: note.trim() || null,
      })

      supabase.functions.invoke('send-email', {
        body: { type: 'booking_confirmation', userId: profile.id, weekNumber: week.week_number, year },
      }).catch(console.error)

      supabase.functions.invoke('send-email', {
        body: {
          type: 'booking_admin_notify',
          userId: profile.id,
          weekNumber: week.week_number,
          year,
          extra: { price: season.price, note: note.trim() || null },
        },
      }).catch(console.error)

      setConfirmed(true)
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-sm px-4 pb-4">
      <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 shrink-0">
          <h3 className="text-base font-semibold text-slate-800">
            {confirmed ? 'Bokning bekräftad!' : 'Boka vecka ' + week.week_number}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {confirmed ? (
            <div className="space-y-4">
              <div className="text-center py-2">
                <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-50 rounded-2xl mb-3">
                  <CalendarCheck className="w-7 h-7 text-emerald-600" />
                </div>
                <p className="text-slate-600 text-sm">
                  Din bokning för vecka <strong>{week.week_number}</strong> är nu bekräftad.
                </p>
                <p className="text-slate-400 text-xs mt-1">En bekräftelse har skickats till din e-post.</p>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2 text-amber-800 font-medium text-sm">
                  <CreditCard className="w-4 h-4" />
                  Nästa steg — betala anmälningsavgift
                </div>
                <p className="text-xs text-amber-700">
                  Betala {PAYMENT.depositAmount} kr för att säkra bokningen.
                </p>
                <div className="space-y-1.5 bg-white rounded-lg p-3 border border-amber-100">
                  <PaymentRow label="Plusgiro" value={PAYMENT.plusgiro} field="pg" copied={copiedField} onCopy={copyToClipboard} />
                  <PaymentRow label="Mottagare" value={PAYMENT.payee} field="payee" copied={copiedField} onCopy={copyToClipboard} />
                  <PaymentRow label="Belopp" value={`${PAYMENT.depositAmount} kr`} field="amount" copied={copiedField} onCopy={copyToClipboard} />
                  <PaymentRow label="Meddelande" value={reference} field="ref" copied={copiedField} onCopy={copyToClipboard} />
                </div>
                <p className="text-xs text-slate-500">
                  Resterande <strong>{remaining} kr</strong> faktureras separat.
                </p>
              </div>

              <button
                onClick={onClose}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg px-4 py-2.5 text-sm transition-colors"
              >
                Stäng
              </button>
            </div>
          ) : (
            <>
              <div className="bg-slate-50 rounded-lg p-4 space-y-2.5">
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                  <div className="text-sm">
                    <span className="text-slate-400">In: </span>
                    <span className="text-slate-700">{formatDateLong(dates.checkIn)} kl 12:00</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                  <div className="text-sm">
                    <span className="text-slate-400">Ut: </span>
                    <span className="text-slate-700">{formatDateLong(dates.checkOut)} kl 12:00</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Bed className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-sm text-slate-600">6 sängplatser · Självhushåll</span>
                </div>
                <div className="flex items-center gap-3">
                  <Zap className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="text-sm text-slate-600">El debiteras extra (2,50 kr/kWh)</span>
                </div>
              </div>

              <div className="bg-red-50 border border-red-100 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-slate-500">{season.label}</div>
                    <div className="text-xs text-slate-400">Vecka {week.week_number}, {year}</div>
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
                  value={note}
                  onChange={(e) => setNote(e.target.value.slice(0, 200))}
                  placeholder="T.ex. kommer sent på lördag, har med hund..."
                  rows={2}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 resize-none"
                />
                <div className="text-[10px] text-slate-400 text-right mt-0.5">{note.length}/200</div>
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

              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              <button
                onClick={handleBook}
                disabled={loading || !agreed}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium rounded-lg px-4 py-3 text-sm flex items-center justify-center gap-2 transition-colors"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <CalendarCheck className="w-4 h-4" />
                    Bekräfta bokning
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function PaymentRow({ label, value, field, copied, onCopy }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-slate-400 shrink-0">{label}</span>
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-slate-700 font-medium font-mono truncate">{value}</span>
        <button
          onClick={() => onCopy(value, field)}
          className="p-1 hover:bg-slate-100 rounded transition-colors shrink-0"
          title="Kopiera"
        >
          {copied === field ? (
            <Check className="w-3 h-3 text-emerald-500" />
          ) : (
            <Copy className="w-3 h-3 text-slate-400" />
          )}
        </button>
      </div>
    </div>
  )
}
