import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Zap, Calculator, ArrowRight, CheckCircle2, Save } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/useAuth'
import { getWeekDateRange, formatDateShort } from '../lib/weeks'
import { PAYMENT } from '../lib/config'
import Spinner from '../components/Spinner'

const PRICE_PER_KWH = 2.5

export default function ElectricityPage() {
  const { profile } = useAuth()
  const [bookings, setBookings] = useState([])
  const [readings, setReadings] = useState({})
  const [selectedBookingId, setSelectedBookingId] = useState('')
  const [startKwh, setStartKwh] = useState('')
  const [endKwh, setEndKwh] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(null)
  const [error, setError] = useState(null)
  const [prevEndHint, setPrevEndHint] = useState(null)

  function pickPreferredBooking(bks, readingMap) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    // Föredra bokning som pågår nu eller är närmast i tiden (förr eller framåt)
    const withDates = bks.map((b) => {
      const { checkIn, checkOut } = getWeekDateRange(b.year, b.week_number)
      const isCurrent = today >= checkIn && today <= checkOut
      const distance = Math.abs(checkIn.getTime() - today.getTime())
      return { b, checkIn, checkOut, isCurrent, distance }
    })
    const current = withDates.find((x) => x.isCurrent)
    if (current) return current.b
    // Annars: senaste avslutade utan komplett avläsning
    const past = withDates.filter((x) => x.checkOut < today)
    const unfinished = past.find((x) => !readingMap[x.b.id]?.end_kwh)
    if (unfinished) return unfinished.b
    // Annars: närmaste
    withDates.sort((a, b) => a.distance - b.distance)
    return withDates[0]?.b
  }

  async function selectBooking(bookingId, readingMap = readings, bksList = bookings) {
    setSelectedBookingId(bookingId)
    setError(null)
    setSavedAt(null)
    const r = readingMap[bookingId]
    if (r?.start_kwh != null) {
      setStartKwh(String(r.start_kwh))
      setEndKwh(r?.end_kwh != null ? String(r.end_kwh) : '')
      setPrevEndHint(null)
    } else {
      const booking = bksList.find((b) => b.id === bookingId)
      let prevEnd = null
      if (booking) {
        const { data } = await supabase
          .from('electricity_readings')
          .select('end_kwh, booking:bookings!booking_id(year, week_number)')
          .eq('user_id', profile.id)
          .not('end_kwh', 'is', null)
        const thisKey = booking.year * 100 + booking.week_number
        let bestKey = -Infinity
        for (const rd of data || []) {
          const k = ((rd.booking?.year || 0) * 100) + (rd.booking?.week_number || 0)
          if (k < thisKey && k > bestKey) { bestKey = k; prevEnd = rd.end_kwh }
        }
      }
      setStartKwh(prevEnd != null ? String(prevEnd) : '')
      setEndKwh('')
      setPrevEndHint(prevEnd)
    }
  }

  async function fetchData() {
    setLoading(true)
    const now = new Date()
    const minYear = now.getFullYear() - 1
    const { data: bookingData } = await supabase
      .from('bookings')
      .select('id, year, week_number, price')
      .eq('user_id', profile.id)
      .eq('status', 'confirmed')
      .gte('year', minYear)
      .order('year', { ascending: false })
      .order('week_number', { ascending: false })

    const bks = bookingData || []
    setBookings(bks)

    if (bks.length) {
      const { data: readingData } = await supabase
        .from('electricity_readings')
        .select('*')
        .in('booking_id', bks.map((b) => b.id))
      const map = {}
      for (const r of readingData || []) map[r.booking_id] = r
      setReadings(map)

      const preferred = pickPreferredBooking(bks, map)
      if (preferred) selectBooking(preferred.id, map, bks)
    }

    setLoading(false)
  }

  useEffect(() => {
    if (!profile) return
    fetchData()  
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  const selectedBooking = useMemo(
    () => bookings.find((b) => b.id === selectedBookingId) || null,
    [bookings, selectedBookingId]
  )

  const startNum = startKwh === '' ? null : Number(startKwh)
  const endNum = endKwh === '' ? null : Number(endKwh)
  const usage = startNum != null && endNum != null && !Number.isNaN(startNum) && !Number.isNaN(endNum)
    ? Math.max(0, endNum - startNum)
    : null
  const cost = usage !== null ? usage * PRICE_PER_KWH : null

  async function handleSave() {
    if (!selectedBooking || startNum == null || Number.isNaN(startNum)) {
      setError('Fyll i åtminstone start-kWh')
      return
    }
    if (endNum != null && !Number.isNaN(endNum) && endNum < startNum) {
      setError('Slut-kWh kan inte vara mindre än start-kWh')
      return
    }
    setSaving(true)
    setError(null)
    const payload = {
      booking_id: selectedBooking.id,
      user_id: profile.id,
      start_kwh: startNum,
      end_kwh: endNum != null && !Number.isNaN(endNum) ? endNum : null,
    }
    const { data, error: saveError } = await supabase
      .from('electricity_readings')
      .upsert(payload, { onConflict: 'booking_id' })
      .select()
      .single()

    if (saveError) {
      setError(saveError.message)
    } else {
      setReadings((prev) => ({ ...prev, [selectedBooking.id]: data }))
      setSavedAt(new Date())
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="max-w-lg mx-auto space-y-3">
        <div className="h-7 w-48 bg-slate-100 rounded animate-pulse" />
        <div className="h-64 bg-slate-100 rounded-xl animate-pulse" />
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-500" />
          El-kalkylator
        </h1>
        <p className="text-slate-400 text-sm mt-0.5">
          Läs av elmätaren vid ankomst och avfärd för att beräkna elkostnaden.
        </p>
      </div>

      {bookings.length === 0 ? (
        <div className="bg-slate-50 border border-slate-200 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
            <Zap className="w-6 h-6 text-slate-400" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-slate-700">Inga elavläsningar</h3>
            <p className="text-xs text-slate-400 max-w-xs">
              Du har inga bokade veckor under det senaste eller nuvarande året att läsa av el för.
            </p>
          </div>
          <Link
            to="/"
            className="inline-flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm transition-colors mt-2"
          >
            Gå till kalendern och boka din vecka →
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <div>
            <label className="block text-sm text-slate-500 mb-1">Vilken bokning?</label>
            <select
              value={selectedBookingId}
              onChange={(e) => selectBooking(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500"
            >
              {bookings.map((b) => {
                const dates = getWeekDateRange(b.year, b.week_number)
                const r = readings[b.id]
                const status = r?.end_kwh != null ? ' · avläst' : r ? ' · påbörjad' : ''
                return (
                  <option key={b.id} value={b.id}>
                    V{b.week_number}, {b.year} ({formatDateShort(dates.checkIn)}–{formatDateShort(dates.checkOut)}){status}
                  </option>
                )
              })}
            </select>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-medium text-amber-700">Instruktioner</span>
            </div>
            <ol className="text-sm text-slate-500 list-decimal list-inside space-y-1">
              <li>Läs av elmätaren vid incheckning (lördag 12:00)</li>
              <li>Läs av igen vid utcheckning (lördag 12:00)</li>
              <li>Mata in värdena och spara</li>
              <li>Betala beloppet till föreningens plusgiro</li>
            </ol>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm text-slate-500 mb-1">Start-kWh (vid ankomst)</label>
              <input
                type="number"
                value={startKwh}
                onChange={(e) => { setStartKwh(e.target.value); setSavedAt(null) }}
                placeholder="t.ex. 12345"
                className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-lg text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-all"
              />
              {prevEndHint != null && (
                <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                  <Zap className="w-3 h-3" /> Föregående slutavläsning: {Number(prevEndHint).toLocaleString('sv-SE')} kWh
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm text-slate-500 mb-1">Slut-kWh (vid avfärd)</label>
              <input
                type="number"
                value={endKwh}
                onChange={(e) => { setEndKwh(e.target.value); setSavedAt(null) }}
                placeholder="t.ex. 12390"
                className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-lg text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-all"
              />
            </div>
          </div>

          {cost !== null && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center space-y-2">
              <div className="text-sm text-slate-500">
                Förbrukning: <span className="font-medium text-slate-700">{usage} kWh</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
                <span>{usage} kWh</span>
                <span>×</span>
                <span>{PRICE_PER_KWH.toFixed(2)} kr</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
              <div className="text-4xl font-bold text-amber-600">
                {cost.toFixed(0)} kr
              </div>
              <div className="text-xs text-slate-500 pt-1 space-y-0.5">
                <div>
                  Betala till plusgiro <strong className="text-slate-700">{PAYMENT.plusgiro}</strong> ({PAYMENT.payee})
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving || !selectedBooking || startKwh === ''}
            className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-medium rounded-lg px-4 py-2.5 text-sm flex items-center justify-center gap-2 transition-colors"
          >
            {saving ? (
              <Spinner />
            ) : savedAt ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Sparat
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Spara avläsning
              </>
            )}
          </button>
        </div>
      )}

      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center gap-3">
        <Calculator className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <p className="text-xs text-slate-400">
          Elpriset är {PRICE_PER_KWH.toFixed(2)} kr/kWh. Beloppet avrundas till närmaste hel krona.
        </p>
      </div>
    </div>
  )
}
