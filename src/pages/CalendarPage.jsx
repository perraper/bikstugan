import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/useAuth'
import { getSeasonPrice, getWeekDateRange, formatDateShort, getWeeksForYear, getCurrentIsoWeek, isLotteryPassed } from '../lib/weeks'
import { CalendarDays, ChevronLeft, ChevronRight, Check, Wrench } from 'lucide-react'
import WeekPanel from '../components/WeekPanel'

const STATUS_CONFIG = {
  available:   { bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500', label: 'Ledig' },
  booked:      { bg: 'bg-red-50',     border: 'border-red-200',     dot: 'bg-red-500',     label: 'Bokad' },
  lottery:     { bg: 'bg-purple-50',  border: 'border-purple-200',  dot: 'bg-purple-500',  label: 'Lottning' },
  maintenance: { bg: 'bg-amber-50',   border: 'border-amber-300',   dot: 'bg-amber-500',   label: 'Underhåll' },
}

export default function CalendarPage() {
  const { profile } = useAuth()
  const [year, setYear] = useState(new Date().getFullYear())
  const [weeks, setWeeks] = useState([])
  const [legacyMap, setLegacyMap] = useState({})
  const [lotteryApps, setLotteryApps] = useState([])
  const [visibleNameWeeks, setVisibleNameWeeks] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [selectedWeekNum, setSelectedWeekNum] = useState(null)
  const [filter, setFilter] = useState('all')

  const totalWeeks = getWeeksForYear(year)
  const today = getCurrentIsoWeek()
  const currentWeekRef = useRef(null)

  async function fetchWeeks() {
    setLoading(true)
    const { data } = await supabase
      .from('weeks')
      .select('*, booked_by:users(name)')
      .eq('year', year)
      .order('week_number')
    setWeeks(data || [])
    setLoading(false)
  }

  async function fetchLegacy() {
    const { data } = await supabase
      .from('legacy_bookings')
      .select('week_number, booked_by_name, type')
      .eq('year', year)
      .in('type', ['booking', 'interest', 'maintenance'])
      .order('week_number')

    const map = {}
    for (const b of (data || [])) {
      if (!map[b.week_number]) map[b.week_number] = { bookings: [], interests: [], maintenance: [] }
      if (b.type === 'booking') map[b.week_number].bookings.push(b.booked_by_name)
      if (b.type === 'interest') map[b.week_number].interests.push(b.booked_by_name)
      if (b.type === 'maintenance') map[b.week_number].maintenance.push(b.booked_by_name)
    }
    setLegacyMap(map)
  }

  async function fetchOwnBookings() {
    if (!profile) return
    const { data } = await supabase
      .from('bookings')
      .select('week_number')
      .eq('user_id', profile.id)
      .eq('year', year)
      .eq('status', 'confirmed')
    const neighborWeeks = new Set()
    for (const b of (data || [])) {
      neighborWeeks.add(b.week_number - 1)
      neighborWeeks.add(b.week_number)
      neighborWeeks.add(b.week_number + 1)
    }
    setVisibleNameWeeks(neighborWeeks)
  }

  async function fetchLotteryApps() {
    if (!profile) return
    const { data } = await supabase
      .from('lottery_applications')
      .select('*')
      .eq('user_id', profile.id)
      .eq('year', year)
    setLotteryApps(data || [])
  }

  useEffect(() => {
    fetchWeeks()
    fetchLegacy()
    fetchLotteryApps()
    fetchOwnBookings()
  }, [year, profile])

  // Realtime: lyssna på ändringar i alla relevanta tabeller för året
  // och uppdatera vyn automatiskt. Debounce 500ms så en serie ändringar
  // (t.ex. avbokning → reserveerbjudande → reservuppdatering) batchas
  // till en enda refetch.
  useEffect(() => {
    let timer = null
    const triggerRefetch = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        fetchWeeks()
        fetchLegacy()
        fetchLotteryApps()
        fetchOwnBookings()
      }, 500)
    }

    const filter = `year=eq.${year}`
    const channel = supabase
      .channel(`calendar-${year}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'weeks', filter }, triggerRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter }, triggerRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'legacy_bookings', filter }, triggerRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lottery_applications', filter }, triggerRefetch)
      .subscribe()

    return () => {
      if (timer) clearTimeout(timer)
      supabase.removeChannel(channel)
    }
  }, [year])

  useEffect(() => {
    if (!loading && year === today.year && currentWeekRef.current) {
      currentWeekRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [loading, year])

  function getWeekData(weekNum) {
    const dbWeek = weeks.find((w) => w.week_number === weekNum)
    const legacy = legacyMap[weekNum]

    // Real user booking (has a linked user) takes absolute priority
    if (dbWeek?.status === 'booked' && dbWeek.booked_by?.name) {
      return {
        ...dbWeek, isLegacy: false,
        interestCount: legacy?.interests?.length || 0,
        interestNames: legacy?.interests || [],
      }
    }

    // Legacy booking takes priority over any db entry without a real user
    if (legacy?.bookings?.length > 0) {
      return {
        week_number: weekNum, year,
        status: 'booked',
        price: dbWeek?.price ?? getSeasonPrice(weekNum).price,
        isLegacy: true,
        legacyName: legacy.bookings[0],
      }
    }

    // Maintenance/renovering — egen status med egen färg
    if (legacy?.maintenance?.length > 0) {
      return {
        week_number: weekNum, year,
        status: 'maintenance',
        price: dbWeek?.price ?? getSeasonPrice(weekNum).price,
        isLegacy: true,
        isMaintenance: true,
        legacyName: legacy.maintenance[0],
      }
    }

    // Regular db week without legacy booking
    if (dbWeek) {
      return {
        ...dbWeek, isLegacy: false,
        interestCount: legacy?.interests?.length || 0,
        interestNames: legacy?.interests || [],
      }
    }

    // Ingen db-rad: status beror på om lottningen för perioden passerats.
    // Före lottning → 'lottery' (medlemmar kan anmäla intresse).
    // Efter lottning → 'available' (först-till-kvarn).
    const defaultStatus = isLotteryPassed(year, weekNum) ? 'available' : 'lottery'
    return {
      week_number: weekNum, year,
      status: defaultStatus,
      price: getSeasonPrice(weekNum).price,
      isLegacy: false,
      interestCount: legacy?.interests?.length || 0,
      interestNames: legacy?.interests || [],
    }
  }

  function hasAppliedForLottery(weekNum) {
    return lotteryApps.some((a) => a.week_number === weekNum)
  }

  function handleWeekClick(weekNum) {
    setSelectedWeekNum(weekNum)
  }

  const statusCounts = useMemo(() => {
    const counts = { available: 0, booked: 0, lottery: 0, maintenance: 0 }
    for (let n = 1; n <= totalWeeks; n++) {
      const w = getWeekData(n)
      if (counts[w.status] !== undefined) counts[w.status]++
    }
    return counts
  }, [weeks, legacyMap, totalWeeks, year])

  // Härled selectedWeek reaktivt från selectedWeekNum + senaste data,
  // så panelen alltid visar uppdaterad status efter mutationer.
  const selectedWeek = selectedWeekNum ? getWeekData(selectedWeekNum) : null

  async function refetchAll() {
    await Promise.all([fetchWeeks(), fetchLegacy(), fetchLotteryApps(), fetchOwnBookings()])
  }

  function closePanel(didMutate) {
    setSelectedWeekNum(null)
    if (didMutate) refetchAll()
  }

  function WeekCard({ weekNum, compact = false }) {
    const week = getWeekData(weekNum)
    const cfg = STATUS_CONFIG[week.status] || STATUS_CONFIG.available
    const season = getSeasonPrice(weekNum)
    const dates = getWeekDateRange(year, weekNum)
    const applied = hasAppliedForLottery(weekNum)
    // Alla veckor är klickbara — panelen visar rätt sektion baserat på status och roll.
    const isClickable = true
    const hidden = filter !== 'all' && week.status !== filter
    const isCurrent = year === today.year && weekNum === today.week

    const isAdmin = profile?.role === 'admin'
    const canSeeName = isAdmin || visibleNameWeeks.has(weekNum)
    const rawName = week.isLegacy ? week.legacyName : week.booked_by?.name
    const bookedName = canSeeName ? rawName : null

    return (
      <button
        ref={isCurrent ? currentWeekRef : null}
        onClick={() => isClickable && handleWeekClick(weekNum)}
        disabled={!isClickable}
        className={`${cfg.bg} ${cfg.border} border rounded-xl text-left transition-all relative ${
          compact ? 'p-2' : 'p-2.5'
        } ${
          isClickable
            ? 'hover:shadow-md hover:scale-[1.03] cursor-pointer active:scale-[0.97]'
            : 'cursor-default'
        } ${hidden ? 'opacity-20' : ''} ${isCurrent ? 'ring-2 ring-blue-500 ring-offset-1' : ''}`}
      >
        {isCurrent && (
          <span className="absolute -top-1.5 -right-1 bg-blue-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full leading-none">
            IDAG
          </span>
        )}
        <div className="flex items-center justify-between mb-0.5">
          <span className={`font-bold text-slate-700 ${compact ? 'text-[11px]' : 'text-xs'}`}>V{weekNum}</span>
          <span className={`w-2 h-2 rounded-full ${cfg.dot} ${week.isLegacy ? 'opacity-60' : ''}`} />
        </div>
        <div className="text-[10px] text-slate-400 leading-tight">{formatDateShort(dates.checkIn)}</div>

        {week.status === 'maintenance' ? (
          <div className="flex items-center gap-1 mt-0.5 leading-tight" title={week.legacyName || 'Underhåll'}>
            <Wrench className="w-3 h-3 text-amber-500 shrink-0" />
            <span className="text-[10px] text-stone-600 font-medium truncate">
              {week.legacyName || 'Underhåll'}
            </span>
          </div>
        ) : week.status === 'booked' && bookedName ? (
          <div className="text-[10px] text-slate-500 truncate mt-0.5 leading-tight" title={bookedName}>
            {bookedName}
          </div>
        ) : (
          <div className={`font-semibold text-slate-600 mt-0.5 ${compact ? 'text-[10px]' : 'text-xs'}`}>
            {season.price} kr
          </div>
        )}

        {applied && !week.isLegacy && (
          <div className="flex items-center gap-0.5 mt-0.5">
            <Check className="w-3 h-3 text-purple-600" />
            <span className="text-[9px] text-purple-600 font-medium">Anmäld</span>
          </div>
        )}
        {week.interestCount > 0 && (
          <div className="text-[9px] text-purple-500 font-medium mt-0.5">
            {week.interestCount} intressent{week.interestCount !== 1 ? 'er' : ''}
          </div>
        )}
      </button>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-red-600" />
            Bokningskalender
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">Klicka på en vecka för att boka eller anmäla intresse</p>
        </div>

        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
          <button onClick={() => setYear(year - 1)} className="p-1 hover:bg-slate-200 rounded transition-colors">
            <ChevronLeft className="w-4 h-4 text-slate-500" />
          </button>
          <span className="text-sm font-semibold text-slate-700 w-12 text-center">{year}</span>
          <button onClick={() => setYear(year + 1)} className="p-1 hover:bg-slate-200 rounded transition-colors">
            <ChevronRight className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </div>

      {/* Legend + Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-4 text-xs text-slate-500">
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => setFilter(filter === key ? 'all' : key)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors ${
                filter === key ? 'bg-slate-100 font-medium text-slate-700' : 'hover:bg-slate-50'
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
              <span className="text-slate-400 font-mono text-[10px]">{statusCounts[key]}</span>
            </button>
          ))}
          {filter !== 'all' && (
            <button
              onClick={() => setFilter('all')}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-red-500 hover:bg-red-50 transition-colors"
            >
              Visa alla
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-3 text-[10px] text-slate-400">
          <span>Högsäsong: 3 000 kr</span>
          <span>Normalsäsong: 2 000 kr</span>
          <span>Lågsäsong: 1 700 kr</span>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-6 sm:grid-cols-9 lg:grid-cols-13 gap-1">
          {Array.from({ length: totalWeeks }).map((_, i) => (
            <div key={i} className="h-14 bg-slate-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <div className="hidden sm:grid grid-cols-7 lg:grid-cols-10 gap-2">
            {Array.from({ length: totalWeeks }, (_, i) => i + 1).map((weekNum) => (
              <WeekCard key={weekNum} weekNum={weekNum} />
            ))}
          </div>
          <div className="sm:hidden grid grid-cols-3 gap-2">
            {Array.from({ length: totalWeeks }, (_, i) => i + 1).map((weekNum) => (
              <WeekCard key={weekNum} weekNum={weekNum} compact />
            ))}
          </div>
        </>
      )}

      {selectedWeek && (
        <WeekPanel
          week={selectedWeek}
          year={year}
          onClose={closePanel}
          onMutate={refetchAll}
        />
      )}
    </div>
  )
}
