const HIGH_SEASON_WEEKS = [1, 9, 13, 14, 15, 51, 52, 53]
const LOW_SEASON_WEEKS = Array.from({ length: 9 }, (_, i) => i + 18) // 18-26

export function getSeasonPrice(weekNumber) {
  if (HIGH_SEASON_WEEKS.includes(weekNumber)) return { price: 3000, label: 'Högsäsong' }
  if (LOW_SEASON_WEEKS.includes(weekNumber)) return { price: 1700, label: 'Lågsäsong' }
  return { price: 2000, label: 'Normalsäsong' }
}

export function getSeasonColor(weekNumber) {
  if (HIGH_SEASON_WEEKS.includes(weekNumber)) return 'text-red-400'
  if (LOW_SEASON_WEEKS.includes(weekNumber)) return 'text-emerald-400'
  return 'text-blue-400'
}

export function getWeekDateRange(year, weekNumber) {
  // ISO week: week 1 contains the first Thursday of the year
  const jan4 = new Date(year, 0, 4)
  const dayOfWeek = jan4.getDay() || 7
  const monday = new Date(jan4)
  monday.setDate(jan4.getDate() - dayOfWeek + 1 + (weekNumber - 1) * 7)

  // Check-in Saturday before the week, Check-out Saturday when the week ends
  const saturday = new Date(monday)
  saturday.setDate(monday.getDate() - 2)

  const nextSaturday = new Date(saturday)
  nextSaturday.setDate(saturday.getDate() + 7)

  return { checkIn: saturday, checkOut: nextSaturday }
}

export function formatDateShort(date) {
  return date.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })
}

export function formatDateLong(date) {
  return date.toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function getCurrentIsoWeek() {
  const now = new Date()
  const target = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  const dayNum = target.getUTCDay() || 7
  target.setUTCDate(target.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1))
  const weekNumber = Math.ceil(((target - yearStart) / 86400000 + 1) / 7)
  return { year: target.getUTCFullYear(), week: weekNumber }
}

// ============================================
// Bokningsperioder & lottningsdatum
// ============================================
// Sommarperiod: 1 maj – 30 nov (lottning sker 1 dec föregående år)
// Vinterperiod: 1 dec – 30 apr (lottning sker 1 maj samma år)
// Veckor lottas i förväg; resterande släpps som först-till-kvarn.

function isoWeekToMidweekDate(year, weekNumber) {
  // ISO-vecka: torsdagen i veckan ligger garanterat i rätt år
  const jan4 = new Date(year, 0, 4)
  const dayOfWeek = jan4.getDay() || 7
  const monday = new Date(jan4)
  monday.setDate(jan4.getDate() - dayOfWeek + 1 + (weekNumber - 1) * 7)
  const thursday = new Date(monday)
  thursday.setDate(monday.getDate() + 3)
  return thursday
}

export function getBookingPeriod(year, weekNumber) {
  // Avgör om en vecka tillhör sommar- eller vinterperioden, samt när
  // lottningen för perioden sker. Returnerar även periodetikett (t.ex. "vinter 25/26").
  const midweek = isoWeekToMidweekDate(year, weekNumber)
  const month = midweek.getMonth() + 1 // 1–12
  const isSummer = month >= 5 && month <= 11

  if (isSummer) {
    // Sommar X = 1 maj X – 30 nov X. Lottning 1 dec (X-1).
    return {
      kind: 'summer',
      label: `sommar ${String(year).slice(-2)}`,
      lotteryDate: new Date(year - 1, 11, 1), // 1 dec föregående år
      seasonStart: new Date(year, 4, 1),       // 1 maj
      seasonEnd: new Date(year, 10, 30),       // 30 nov
    }
  }

  // Vinter: dec–apr. Perioden "vinter A/B" = 1 dec A – 30 apr B.
  // Lottning 1 maj A.
  const winterStartYear = month === 12 ? year : year - 1
  return {
    kind: 'winter',
    label: `vinter ${String(winterStartYear).slice(-2)}/${String(winterStartYear + 1).slice(-2)}`,
    lotteryDate: new Date(winterStartYear, 4, 1), // 1 maj
    seasonStart: new Date(winterStartYear, 11, 1), // 1 dec
    seasonEnd: new Date(winterStartYear + 1, 3, 30), // 30 apr
  }
}

export function isLotteryPassed(year, weekNumber, now = new Date()) {
  return now >= getBookingPeriod(year, weekNumber).lotteryDate
}

export function formatLotteryDate(date) {
  return date.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function getWeeksForYear(year) {
  // Get number of ISO weeks in a year
  const dec28 = new Date(year, 11, 28)
  const dayOfWeek = dec28.getDay() || 7
  const thursdayOfLastWeek = new Date(dec28)
  thursdayOfLastWeek.setDate(dec28.getDate() - dayOfWeek + 4)
  const jan1 = new Date(thursdayOfLastWeek.getFullYear(), 0, 1)
  const totalWeeks = Math.ceil(((thursdayOfLastWeek - jan1) / 86400000 + 1) / 7)
  return totalWeeks
}
