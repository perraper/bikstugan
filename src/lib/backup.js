function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function csvCell(value) {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

export function downloadCsv(filename, headers, rows) {
  const lines = [headers, ...rows].map((r) => r.map(csvCell).join(','))
  // Lägg till BOM så Excel öppnar UTF-8 korrekt
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
  downloadBlob(filename, blob)
}

export function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  downloadBlob(filename, blob)
}

export async function fetchBackupData(supabase) {
  const [users, weeks, bookings, lottery, legacy, reserveOffers, issues] = await Promise.all([
    supabase.from('users').select('*'),
    supabase.from('weeks').select('*'),
    supabase.from('bookings').select('*, user:users(name, email)'),
    supabase.from('lottery_applications').select('*, user:users(name, email)'),
    supabase.from('legacy_bookings').select('*'),
    supabase.from('reserve_offers').select('*'),
    supabase.from('issues').select('*, user:users!user_id(name, email)'),
  ])

  return {
    exported_at: new Date().toISOString(),
    users: users.data || [],
    weeks: weeks.data || [],
    bookings: bookings.data || [],
    lottery_applications: lottery.data || [],
    legacy_bookings: legacy.data || [],
    reserve_offers: reserveOffers.data || [],
    issues: issues.data || [],
  }
}

export function bookingsToCsv(bookings) {
  const headers = [
    'Bokningsnr', 'Status', 'Namn', 'E-post', 'År', 'Vecka', 'Pris',
    'Anmälningsavgift betald', 'Belopp', 'Slutbetalning klar', 'Påminnelser skickade',
    'Skapad', 'Avbokad', 'Återbetalningsbar', 'Kommentar'
  ]
  const rows = bookings.map((b) => [
    b.id,
    b.status,
    b.user?.name || '',
    b.user?.email || '',
    b.year,
    b.week_number,
    b.price,
    b.deposit_paid ? 'Ja' : 'Nej',
    b.deposit_amount || '',
    b.final_paid ? 'Ja' : 'Nej',
    b.deposit_reminder_count || 0,
    b.created_at,
    b.cancelled_at || '',
    b.deposit_refundable === null ? '' : (b.deposit_refundable ? 'Ja' : 'Nej'),
    b.note || '',
  ])
  return { headers, rows }
}
