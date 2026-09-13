import { useEffect, useMemo, useRef, useState, useCallback, forwardRef, memo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/useAuth'
import { getSeasonPrice, getWeekDateRange, formatDateShort, getWeeksForYear, getCurrentIsoWeek, isLotteryPassed } from '../lib/weeks'
import { CalendarDays, ChevronLeft, ChevronRight, Check, Wrench, AlertTriangle, RefreshCw } from 'lucide-react'
import WeekPanel from '../components/WeekPanel'

const STATUS_CONFIG = {
  available:   { bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500', label: 'Ledig' },
  booked:      { bg: 'bg-red-50',     border: 'border-red-200',     dot: 'bg-red-500',     label: 'Bokad' },
  lottery:     { bg: 'bg-purple-50',  border: 'border-purple-200',  dot: 'bg-purple-500',  label: 'Lottning' },
  maintenance: { bg: 'bg-amber-50',   border: 'border-amber-300',   dot: 'bg-amber-500',   label: 'Underhåll' },
}

// Flyttad utanför komponenten och memoizerad för att förhindra ommontering av 52 DOM-noder vid render
const WeekCard = memo(forwardRef(function WeekCard(
  { weekNum, week, dates, season, cfg, bookedName, applied, isSelected, isCurrent, hidden, onClick },
  ref
) {
  return (
    <button
      ref={ref}
      onClick={() => onClick(weekNum)}
      aria-label={`Vecka ${weekNum}, ${formatDateShort(dates.checkIn)}, status ${cfg.label}${bookedName ? `, bokad av ${bookedName}` : ''}`}
      aria-current={isCurrent ? 'date' : undefined}
      className={`${cfg.bg} ${cfg.border} border rounded-xl text-left transition-all relative p-2 sm:p-2.5 hover:shadow-md hover:scale-[1.03] cursor-pointer active:scale-[0.97] ${
        hidden ? 'opacity-20' : ''
      } ${isCurrent ? 'ring-2 ring-blue-500 ring-offset-1' : ''} ${
        isSelected ? 'ring-2 ring-slate-800' : ''
      }`}
    >
      {isCurrent && (
        <span className="absolute -top-1.5 -right-1 bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none shadow-sm tracking-wide">
          IDAG
        </span>
      )}
      <div className="flex items-center justify-between mb-0.5">
        <span className="font-bold text-slate-800 text-xs sm:text-sm">V{weekNum}</span>
        <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot} ${week.isLegacy ? 'opacity-60' : ''}`} />
      </div>
      <div className="text-xs text-slate-500 font-medium leading-tight">{formatDateShort(dates.checkIn)}</div>

      {week.status === 'maintenance' ? (
        <div className="flex items-center gap-1 mt-0.5 leading-tight" title={week.legacyName || 'Underhåll'}>
          <Wrench className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span className="text-xs text-stone-700 font-medium truncate">
            {week.legacyName || 'Underhåll'}
          </span>
        </div>
      ) : week.status === 'booked' && bookedName ? (
        <div className="text-xs text-slate-700 font-medium truncate mt-0.5 leading-tight" title={bookedName}>
          {bookedName}
        </div>
      ) : (
        <div className="font-semibold text-slate-800 mt-0.5 text-xs sm:text-sm">
          {season.price} kr
        </div>
      )}

      {applied && !week.isLegacy && (
        <div className="flex items-center gap-0.5 mt-0.5">
          <Check className="w-3.5 h-3.5 text-purple-700" />
          <span className="text-[11px] text-purple-700 font-semibold">Anmäld</span>
        </div>
      )}
      {week.interestCount > 0 && (
        <div className="text-[11px] text-purple-700 font-medium mt-0.5">
          {week.interestCount} intressent{week.interestCount !== 1 ? 'er' : ''}
        </div>
      )}
    </button>
  )
}))

export default function CalendarPage() {
  const { profile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const paramYear = searchParams.get('year')
  const paramWeek = searchParams.get('week')

  const [year, setYear] = useState(() => {
    return paramYear ? Number(paramYear) : new Date().getFullYear()
  })
  const [weeks, setWeeks] = useState([])
  const [legacyMap, setLegacyMap] = useState({})
  const [lotteryApps, setLotteryApps] = useState([])
  const [visibleNameWeeks, setVisibleNameWeeks] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedWeekNum, setSelectedWeekNum] = useState(() => {
    return paramWeek ? Number(paramWeek) : null
  })
  const [filter, setFilter] = useState('all')

  const totalWeeks = getWeeksForYear(year)
  const today = getCurrentIsoWeek()
  const currentWeekRef = useRef(null)
  const selectedWeekRef = useRef(null)

  useEffect(() => {
    const y = searchParams.get('year')
    const w = searchParams.get('week')
    if (y) setYear(Number(y))
    if (w) {
      setSelectedWeekNum(Number(w))
    } else {
      setSelectedWeekNum(null)
    }
  }, [searchParams])

  // Batchad datahämtning med fullständig felhantering
  const loadCalendarData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [weeksRes, legacyRes, lotteryRes, ownBookingsRes] = await Promise.all([
        supabase
          .from('weeks')
          .select('*, booked_by:users(name)')
          .eq('year', year)
          .order('week_number'),
        supabase
          .from('legacy_bookings')
          .select('week_number, booked_by_name, type')
          .eq('year', year)
          .in('type', ['booking', 'interest', 'maintenance'])
          .order('week_number'),
        profile
          ? supabase.from('lottery_applications').select('*').eq('user_id', profile.id).eq('year', year)
          : Promise.resolve({ data: [] }),
        profile
          ? supabase.from('bookings').select('week_number').eq('user_id', profile.id).eq('year', year).eq('status', 'confirmed')
          : Promise.resolve({ data: [] }),
      ])

      if (weeksRes.error) throw weeksRes.error
      if (legacyRes.error) throw legacyRes.error
      if (lotteryRes?.error) throw lotteryRes.error
      if (ownBookingsRes?.error) throw ownBookingsRes.error

      const map = {}
      for (const b of (legacyRes.data || [])) {
        if (!map[b.week_number]) map[b.week_number] = { bookings: [], interests: [], maintenance: [] }
        if (b.type === 'booking') map[b.week_number].bookings.push(b.booked_by_name)
        if (b.type === 'interest') map[b.week_number].interests.push(b.booked_by_name)
        if (b.type === 'maintenance') map[b.week_number].maintenance.push(b.booked_by_name)
      }

      const neighborWeeks = new Set()
      for (const b of (ownBookingsRes.data || [])) {
        neighborWeeks.add(b.week_number - 1)
        neighborWeeks.add(b.week_number)
        neighborWeeks.add(b.week_number + 1)
      }

      setWeeks(weeksRes.data || [])
      setLegacyMap(map)
      setLotteryApps(lotteryRes.data || [])
      setVisibleNameWeeks(neighborWeeks)
    } catch (err) {
      console.error('Fel vid hämtning av kalenderdata:', err)
      setError('Kunde inte hämta kalenderdata från databasen. Kontrollera nätverksanslutningen.')
    } finally {
      setLoading(false)
    }
  }, [year, profile])

  useEffect(() => {
    loadCalendarData()
  }, [loadCalendarData])

  // Realtime: lyssna på ändringar i alla relevanta tabeller för året
  useEffect(() => {
    let timer = null
    const triggerRefetch = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        loadCalendarData()
      }, 500)
    }

    const filterStr = `year=eq.${year}`
    const channel = supabase
      .channel(`calendar-${year}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'weeks', filter: filterStr }, triggerRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: filterStr }, triggerRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'legacy_bookings', filter: filterStr }, triggerRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lottery_applications', filter: filterStr }, triggerRefetch)
      .subscribe()

    return () => {
      if (timer) clearTimeout(timer)
      supabase.removeChannel(channel)
    }
  }, [year, loadCalendarData])

  useEffect(() => {
    if (!loading) {
      setTimeout(() => {
        if (selectedWeekNum && selectedWeekRef.current) {
          selectedWeekRef.current.scrollIntoView({ block: 'center' })
        } else if (year === today.year && currentWeekRef.current) {
          currentWeekRef.current.scrollIntoView({ block: 'center' })
        }
      }, 50)
    }
  }, [loading, selectedWeekNum, year, today.year, today.week])

  const getWeekData = useCallback((weekNum) => {
    const dbWeek = weeks.find((w) => w.week_number === weekNum)
    const legacy = legacyMap[weekNum]

    if (dbWeek?.status === 'booked' && dbWeek.booked_by?.name) {
      return {
        ...dbWeek, isLegacy: false,
        interestCount: legacy?.interests?.length || 0,
        interestNames: legacy?.interests || [],
      }
    }

    if (legacy?.bookings?.length > 0) {
      return {
        week_number: weekNum, year,
        status: 'booked',
        price: dbWeek?.price ?? getSeasonPrice(weekNum).price,
        isLegacy: true,
        legacyName: legacy.bookings[0],
      }
    }

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

    if (dbWeek) {
      return {
        ...dbWeek, isLegacy: false,
        interestCount: legacy?.interests?.length || 0,
        interestNames: legacy?.interests || [],
      }
    }

    const defaultStatus = isLotteryPassed(year, weekNum) ? 'available' : 'lottery'
    return {
      week_number: weekNum, year,
      status: defaultStatus,
      price: getSeasonPrice(weekNum).price,
      isLegacy: false,
      interestCount: legacy?.interests?.length || 0,
      interestNames: legacy?.interests || [],
    }
  }, [weeks, legacyMap, year])

  function handleWeekClick(weekNum) {
    setSelectedWeekNum(weekNum)
    setSearchParams((prev) => {
      prev.set('week', String(weekNum))
      return prev
    }, { replace: true })
  }

  function handleYearChange(newYear) {
    setYear(newYear)
    setSearchParams((prev) => {
      prev.set('year', String(newYear))
      return prev
    }, { replace: true })
  }

  const statusCounts = useMemo(() => {
    const counts = { available: 0, booked: 0, lottery: 0, maintenance: 0 }
    for (let n = 1; n <= totalWeeks; n++) {
      const w = getWeekData(n)
      if (counts[w.status] !== undefined) counts[w.status]++
    }
    return counts
  }, [getWeekData, totalWeeks])

  const selectedWeek = selectedWeekNum ? getWeekData(selectedWeekNum) : null

  function closePanel(didMutate) {
    setSelectedWeekNum(null)
    const fromPath = searchParams.get('from')
    if (fromPath) {
      navigate(fromPath)
    } else {
      setSearchParams((prev) => {
        prev.delete('week')
        return prev
      }, { replace: true })
    }
    if (didMutate) loadCalendarData()
  }

  const isAdmin = profile?.role === 'admin'

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
          <button
            onClick={() => handleYearChange(year - 1)}
            className="p-1 hover:bg-slate-200 rounded transition-colors cursor-pointer"
            title="Föregående år"
            aria-label="Föregående år"
          >
            <ChevronLeft className="w-4 h-4 text-slate-500" />
          </button>
          <span className="text-sm font-semibold text-slate-700 w-12 text-center">{year}</span>
          <button
            onClick={() => handleYearChange(year + 1)}
            className="p-1 hover:bg-slate-200 rounded transition-colors cursor-pointer"
            title="Nästa år"
            aria-label="Nästa år"
          >
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

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-red-700 text-sm">
            <AlertTriangle className="w-5 h-5 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
          <button
            onClick={loadCalendarData}
            className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Försök igen
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-3 sm:grid-cols-7 lg:grid-cols-10 gap-2">
          {Array.from({ length: totalWeeks }).map((_, i) => (
            <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        /* En enda responsiv grid istället för två duplicerade DOM-träd */
        <div className="grid grid-cols-3 sm:grid-cols-7 lg:grid-cols-10 gap-2">
          {Array.from({ length: totalWeeks }, (_, i) => i + 1).map((weekNum) => {
            const week = getWeekData(weekNum)
            const cfg = STATUS_CONFIG[week.status] || STATUS_CONFIG.available
            const season = getSeasonPrice(weekNum)
            const dates = getWeekDateRange(year, weekNum)
            const applied = lotteryApps.some((a) => a.week_number === weekNum)
            const hidden = filter !== 'all' && week.status !== filter
            const isCurrent = year === today.year && weekNum === today.week
            const isSelected = selectedWeekNum === weekNum
            const canSeeName = isAdmin || visibleNameWeeks.has(weekNum)
            const rawName = week.isLegacy ? week.legacyName : week.booked_by?.name
            const bookedName = canSeeName ? rawName : null

            return (
              <WeekCard
                key={weekNum}
                ref={isSelected ? selectedWeekRef : (isCurrent ? currentWeekRef : null)}
                weekNum={weekNum}
                week={week}
                dates={dates}
                season={season}
                cfg={cfg}
                bookedName={bookedName}
                applied={applied}
                isSelected={isSelected}
                isCurrent={isCurrent}
                hidden={hidden}
                onClick={handleWeekClick}
              />
            )
          })}
        </div>
      )}

      {selectedWeek && !loading && (
        <WeekPanel
          week={selectedWeek}
          year={year}
          onClose={closePanel}
          onMutate={loadCalendarData}
        />
      )}
    </div>
  )
}
