import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Copy, Check, ArrowRight, CreditCard } from 'lucide-react'
import { PAYMENT } from '../../lib/config'
import { formatDateLong } from '../../lib/weeks'

export default function BookingSuccessView({ weekNumber, year, dates, paymentRef, onDone }) {
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard?.writeText(paymentRef).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  return (
    <div className="space-y-4 text-center py-2">
      <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-50 rounded-2xl mb-1 ring-8 ring-emerald-50/50">
        <CheckCircle2 className="w-8 h-8 text-emerald-600" />
      </div>

      <div>
        <h3 className="text-lg font-bold text-slate-800">
          Vecka {weekNumber}, {year} är nu bokad!
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          {formatDateLong(dates.checkIn)} – {formatDateLong(dates.checkOut)}
        </p>
      </div>

      {/* Betalningsinstruktion */}
      <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-4 text-left space-y-2.5">
        <div className="flex items-center gap-2 text-xs font-semibold text-amber-800 uppercase tracking-wide">
          <CreditCard className="w-3.5 h-3.5 text-amber-600" />
          <span>Anmälningsavgift att betala</span>
        </div>

        <div className="text-xs text-slate-600">
          Betala <strong>{PAYMENT.depositAmount} kr</strong> via internetbanken till föreningens plusgiro för att slutföra bokningen.
        </div>

        <div className="bg-white rounded-lg p-3 border border-amber-100 space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Plusgiro</span>
            <span className="font-mono font-medium text-slate-800">{PAYMENT.plusgiro}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Mottagare</span>
            <span className="text-slate-700">{PAYMENT.payee}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Belopp</span>
            <span className="font-bold text-emerald-700">{PAYMENT.depositAmount} kr</span>
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-slate-100">
            <span className="text-slate-400">Meddelande</span>
            <div className="flex items-center gap-1.5">
              <span className="font-mono font-semibold text-slate-800">{paymentRef}</span>
              <button
                onClick={handleCopy}
                className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                title="Kopiera meddelande"
                aria-label="Kopiera meddelande"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-slate-400">
          Resterande belopp faktureras separat före incheckning.
        </p>
      </div>

      {/* Knappar */}
      <div className="space-y-2 pt-1">
        <button
          onClick={() => {
            onDone()
            navigate('/bookings')
          }}
          className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-lg px-4 py-2.5 text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-sm"
        >
          <span>Gå till Mina bokningar</span>
          <ArrowRight className="w-4 h-4" />
        </button>
        <button
          onClick={onDone}
          className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium rounded-lg px-4 py-2.5 text-sm transition-colors cursor-pointer"
        >
          Stäng och återgå till kalendern
        </button>
      </div>
    </div>
  )
}
