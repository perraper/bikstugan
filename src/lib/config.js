// Betalningsinställningar för anmälningsavgift.

export const PAYMENT = {
  depositAmount: 500,
  plusgiro: '572 64-4',
  payee: 'Brandkårens Idrottsklubb',
}

// Avbokningsregler: anmälningsavgiften återbetalas EJ vid avbokning
// senare än detta antal veckor innan ankomst.
export const REFUND_DEADLINE_WEEKS = 4

export function paymentReference(user, year, weekNumber) {
  const last = (user?.name || '').split(' ').slice(-1)[0]
  return `V${weekNumber}/${year} ${last}`.trim()
}
