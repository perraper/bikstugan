import { getWeekDateRange } from './weeks'

function formatICalDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

function escapeText(text) {
  return String(text).replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n')
}

export function bookingsToIcs(bookings, calendarName = 'BIK-stugan') {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BIK-stugan//Bokningar//SV',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calendarName)}`,
  ]

  for (const b of bookings) {
    const dates = getWeekDateRange(b.year, b.week_number)
    const uid = `bik-${b.id || `${b.year}-${b.week_number}`}@bik-stugan`
    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${formatICalDate(new Date())}T000000Z`,
      `DTSTART;VALUE=DATE:${formatICalDate(dates.checkIn)}`,
      `DTEND;VALUE=DATE:${formatICalDate(dates.checkOut)}`,
      `SUMMARY:${escapeText(`BIK-stugan v${b.week_number}`)}`,
      `DESCRIPTION:${escapeText(`Vecka ${b.week_number}, ${b.year}. Incheckning kl 12:00, utcheckning kl 12:00.`)}`,
      'END:VEVENT'
    )
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

export function downloadIcs(filename, content) {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
