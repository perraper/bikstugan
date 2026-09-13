import { useState } from 'react'
import { CheckCircle2, CreditCard, Copy, Check, QrCode, Smartphone } from 'lucide-react'
import { PAYMENT, isSwishEnabled, getSwishUrl, getSwishQrUrl } from '../lib/config'

function PaymentRow({ label, value, field, copiedField, onCopy }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-slate-400 shrink-0">{label}</span>
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-slate-700 font-medium font-mono truncate">{value}</span>
        <button
          onClick={() => onCopy(value, field)}
          className="p-1 hover:bg-slate-100 rounded transition-colors shrink-0 text-slate-400 hover:text-slate-600 cursor-pointer"
          title={`Kopiera ${label}`}
          aria-label={`Kopiera ${label}`}
        >
          {copiedField === field ? (
            <Check className="w-3 h-3 text-emerald-500" />
          ) : (
            <Copy className="w-3 h-3" />
          )}
        </button>
      </div>
    </div>
  )
}

export default function BookingPaymentInfo({ booking, paymentRef, compact = false }) {
  const [copiedField, setCopiedField] = useState(null)
  const [showSwishQr, setShowSwishQr] = useState(null) // 'deposit' | 'final' | null

  const copyToClipboard = (text, field) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 1500)
    }).catch(() => {})
  }

  if (!booking) return null

  const depositAmount = booking.deposit_amount || PAYMENT.depositAmount
  const remaining = Math.max(0, (booking.price || 0) - depositAmount)

  return (
    <div className="space-y-3">
      {/* Anmälningsavgift */}
      {booking.deposit_paid ? (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 text-xs text-emerald-700">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>Anmälningsavgift {depositAmount.toLocaleString('sv-SE')} kr betald</span>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs sm:text-sm text-amber-800 font-medium">
            <CreditCard className="w-4 h-4 shrink-0" />
            <span>Anmälningsavgift {depositAmount.toLocaleString('sv-SE')} kr — ej betald</span>
          </div>
          {compact ? (
            <div className="text-[11px] text-amber-700 flex flex-wrap gap-x-2">
              <span>Plusgiro: <strong>{PAYMENT.plusgiro}</strong> ({PAYMENT.payee})</span>
              <span>·</span>
              <span>Meddelande: <strong>{paymentRef}</strong></span>
            </div>
          ) : (
            <div className="space-y-1 bg-white rounded-md p-2 border border-amber-100">
              <PaymentRow
                label="Plusgiro"
                value={PAYMENT.plusgiro}
                field="pg"
                copiedField={copiedField}
                onCopy={copyToClipboard}
              />
              <PaymentRow
                label="Belopp"
                value={`${depositAmount.toLocaleString('sv-SE')} kr`}
                field="amount"
                copiedField={copiedField}
                onCopy={copyToClipboard}
              />
              <PaymentRow
                label="Meddelande"
                value={paymentRef}
                field="ref"
                copiedField={copiedField}
                onCopy={copyToClipboard}
              />
            </div>
          )}
          {/* Swish-knapp och QR-kod */}
          {isSwishEnabled && (
            <div className="pt-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={getSwishUrl({ amount: depositAmount, message: paymentRef })}
                  className="inline-flex items-center gap-1.5 bg-[#002f6c] hover:bg-[#00224f] text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Öppna i Swish ({depositAmount.toLocaleString('sv-SE')} kr)</span>
                </a>
                <button
                  type="button"
                  onClick={() => setShowSwishQr(showSwishQr === 'deposit' ? null : 'deposit')}
                  className="inline-flex items-center gap-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                  title="Visa Swish QR-kod"
                >
                  <QrCode className="w-3.5 h-3.5 text-slate-500" />
                  <span>{showSwishQr === 'deposit' ? 'Dölj QR' : 'Swish QR-kod'}</span>
                </button>
              </div>

              {showSwishQr === 'deposit' && (
                <div className="bg-white rounded-lg p-3 border border-amber-200 flex flex-col items-center text-center space-y-2">
                  <img
                    src={getSwishQrUrl({ amount: depositAmount, message: paymentRef })}
                    alt="Swish QR-kod"
                    className="w-36 h-36 rounded-md border border-slate-100"
                  />
                  <div className="text-xs text-slate-600">
                    Scanna med Swish-appen för att betala <strong>{depositAmount} kr</strong>.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Slutbetalning */}
      {remaining > 0 && (
        booking.final_paid ? (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 text-xs text-emerald-700">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>Slutbetalning {remaining.toLocaleString('sv-SE')} kr klar</span>
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-700 font-medium">
              <CreditCard className="w-4 h-4 shrink-0" />
              <span>Slutbetalning {remaining.toLocaleString('sv-SE')} kr — ej klar</span>
            </div>
            {compact ? (
              <div className="text-[11px] text-slate-600 flex flex-wrap gap-x-2">
                <span>Plusgiro: <strong>{PAYMENT.plusgiro}</strong> ({PAYMENT.payee})</span>
                <span>·</span>
                <span>Meddelande: <strong>{paymentRef}</strong></span>
              </div>
            ) : (
              <div className="space-y-1 bg-white rounded-md p-2 border border-slate-200">
                <PaymentRow
                  label="Plusgiro"
                  value={PAYMENT.plusgiro}
                  field="pg-final"
                  copiedField={copiedField}
                  onCopy={copyToClipboard}
                />
                <PaymentRow
                  label="Belopp"
                  value={`${remaining.toLocaleString('sv-SE')} kr`}
                  field="amount-final"
                  copiedField={copiedField}
                  onCopy={copyToClipboard}
                />
                <PaymentRow
                  label="Meddelande"
                  value={paymentRef}
                  field="ref-final"
                  copiedField={copiedField}
                  onCopy={copyToClipboard}
                />
              </div>
            )}

            {/* Swish-knapp och QR-kod för slutbetalning */}
            {isSwishEnabled && (
              <div className="pt-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={getSwishUrl({ amount: remaining, message: paymentRef })}
                    className="inline-flex items-center gap-1.5 bg-[#002f6c] hover:bg-[#00224f] text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm transition-colors cursor-pointer"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Öppna i Swish ({remaining.toLocaleString('sv-SE')} kr)</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => setShowSwishQr(showSwishQr === 'final' ? null : 'final')}
                    className="inline-flex items-center gap-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                    title="Visa Swish QR-kod"
                  >
                    <QrCode className="w-3.5 h-3.5 text-slate-500" />
                    <span>{showSwishQr === 'final' ? 'Dölj QR' : 'Swish QR-kod'}</span>
                  </button>
                </div>

                {showSwishQr === 'final' && (
                  <div className="bg-white rounded-lg p-3 border border-slate-200 flex flex-col items-center text-center space-y-2">
                    <img
                      src={getSwishQrUrl({ amount: remaining, message: paymentRef })}
                      alt="Swish QR-kod"
                      className="w-36 h-36 rounded-md border border-slate-100"
                    />
                    <div className="text-xs text-slate-600">
                      Scanna med Swish-appen för att betala <strong>{remaining.toLocaleString('sv-SE')} kr</strong>.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      )}
    </div>
  )
}
