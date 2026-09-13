export const PAYMENT = {
  depositAmount: 500,
  plusgiro: '572 64-4',
  payee: 'Brandkårens Idrottsklubb',
  swishNumber: null, // Sätts till t.ex. '123 456 78 90' när Swish aktiveras
}

export const isSwishEnabled = Boolean(PAYMENT.swishNumber)

// Avbokningsregler: anmälningsavgiften återbetalas EJ vid avbokning
// senare än detta antal veckor innan ankomst.
export const REFUND_DEADLINE_WEEKS = 4

export function paymentReference(user, year, weekNumber) {
  const last = (user?.name || '').split(' ').slice(-1)[0]
  return `V${weekNumber}/${year} ${last}`.trim()
}

export function getSwishUrl({ payee = PAYMENT.swishNumber, amount, message }) {
  if (!payee) return ''
  const cleanNumber = payee.replace(/\s+/g, '')
  const data = {
    version: 1,
    payee: { value: cleanNumber },
    amount: { value: Number(amount) },
    message: { value: message },
  }
  return `swish://payment?data=${encodeURIComponent(JSON.stringify(data))}`
}

export function getSwishQrUrl({ payee = PAYMENT.swishNumber, amount, message }) {
  if (!payee) return ''
  const swishUrl = getSwishUrl({ payee, amount, message })
  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(swishUrl)}`
}
