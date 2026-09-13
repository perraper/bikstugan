import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/useAuth'
import { getSeasonPrice, getWeekDateRange, formatDateLong, formatDateShort, getBookingPeriod, isLotteryPassed, formatLotteryDate } from '../lib/weeks'
import { PAYMENT, paymentReference } from '../lib/config'
import {
  bookWeek,
  cancelBooking,
  joinReserveList,
  leaveReserveList,
  applyForLottery,
  withdrawLotteryApplication,
} from '../lib/booking-actions'
import {
  X, Clock, Bed, Zap, AlertTriangle,
  Users, Star, Wrench, Shuffle,
} from 'lucide-react'
import Spinner from './Spinner'
import CancelBookingConfirm from './CancelBookingConfirm'
import BookSection from './week-panel/BookSection'
import LotterySection from './week-panel/LotterySection'
import BookedSection from './week-panel/BookedSection'
import AdminSection from './week-panel/AdminSection'
import HistorySection from './week-panel/HistorySection'
import BookingSuccessView from './week-panel/BookingSuccessView'

const STATUS_BADGE = {
  available:   { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Ledig' },
  booked:      { bg: 'bg-red-100',     text: 'text-red-700',     label: 'Bokad' },
  lottery:     { bg: 'bg-purple-100',  text: 'text-purple-700',  label: 'Lottning' },
  maintenance: { bg: 'bg-stone-200',   text: 'text-stone-700',   label: 'Underhåll' },
}

export default function WeekPanel({ week, year, onClose, onMutate }) {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'

  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [localLoading, setLocalLoading] = useState(true)
  const [view, setView] = useState('main') // main | confirm-cancel | confirm-leave-reserve

  // Loaded data
  const [booking, setBooking] = useState(null)            // public.bookings row + user
  const [reserves, setReserves] = useState([])            // lottery_applications status='reserve' + user
  const [activeOffer, setActiveOffer] = useState(null)    // pending reserve_offer
  const [history, setHistory] = useState([])              // admin: legacy + bookings same week
  const [ownLotteryApp, setOwnLotteryApp] = useState(null)
  const [neighborOwn, setNeighborOwn] = useState(false)   // is profile booker of week±1?

  // Form state
  const [agreed, setAgreed] = useState(false)
  const [bookNote, setBookNote] = useState('')
  const [adminOpen, setAdminOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  const season = getSeasonPrice(week.week_number)
  const dates = getWeekDateRange(year, week.week_number)
  const remaining = season.price - PAYMENT.depositAmount

  const isLegacy = week.isLegacy
  const isMaintenance = week.status === 'maintenance'
  const isAvailable = !isLegacy && week.status === 'available'
  const isLottery = !isLegacy && week.status === 'lottery'
  const isBooked = week.status === 'booked'
  const isOwnBooking = isBooked && !isLegacy && booking?.user_id === profile?.id
  const isOthersBooking = isBooked && !isOwnBooking

  async function fetchData() {
    setLocalLoading(true)
    try {
      const fetches = []

      if (!isLegacy && week.status === 'booked') {
        fetches.push(
          supabase
            .from('bookings')
            .select('*, user:users(id, name, email, phone)')
            .eq('year', year)
            .eq('week_number', week.week_number)
            .eq('status', 'confirmed')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
            .then(({ data }) => setBooking(data))
        )

        fetches.push(
          supabase
            .from('reserve_offers')
            .select('*, user:users(id, name)')
            .eq('year', year)
            .eq('week_number', week.week_number)
            .eq('status', 'pending')
            .gt('deadline', new Date().toISOString())
            .maybeSingle()
            .then(({ data }) => setActiveOffer(data))
        )
      }

      // Reserves visible for everyone for booked weeks (members see only count, admin sees full list)
      fetches.push(
        supabase
          .from('lottery_applications')
          .select('*, user:users(id, name)')
          .eq('year', year)
          .eq('week_number', week.week_number)
          .eq('status', 'reserve')
          .order('reserve_rank')
          .then(({ data }) => setReserves(data || []))
      )

      if (profile) {
        fetches.push(
          supabase
            .from('lottery_applications')
            .select('*')
            .eq('user_id', profile.id)
            .eq('year', year)
            .eq('week_number', week.week_number)
            .maybeSingle()
            .then(({ data }) => setOwnLotteryApp(data))
        )

        fetches.push(
          supabase
            .from('weeks')
            .select('week_number, booked_by_user_id')
            .eq('year', year)
            .in('week_number', [week.week_number - 1, week.week_number + 1])
            .eq('status', 'booked')
            .then(({ data }) => {
              setNeighborOwn(
                (data || []).some((w) => w.booked_by_user_id === profile.id)
              )
            })
        )
      }

      if (isAdmin) {
        fetches.push(
          supabase
            .from('legacy_bookings')
            .select('year, booked_by_name, type, paid, price, notes')
            .eq('week_number', week.week_number)
            .order('year', { ascending: false })
            .then(({ data }) => {
              setHistory((prev) => [
                ...(data || []).map((r) => ({ ...r, source: 'legacy' })),
                ...prev.filter((r) => r.source !== 'legacy'),
              ])
            })
        )
        fetches.push(
          supabase
            .from('bookings')
            .select('year, status, price, deposit_paid, user:users(name)')
            .eq('week_number', week.week_number)
            .order('year', { ascending: false })
            .then(({ data }) => {
              setHistory((prev) => [
                ...prev.filter((r) => r.source !== 'real'),
                ...(data || []).map((r) => ({ ...r, source: 'real' })),
              ])
            })
        )
      }

      await Promise.all(fetches)
    } catch (e) {
      console.error('Kunde inte hämta veckodata:', e)
      setError('Kunde inte hämta detaljer för veckan.')
    } finally {
      setLocalLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [week.week_number, week.status, week.isLegacy, year, profile?.id])

  async function handleBook() {
    setActionLoading(true)
    setError('')
    try {
      await bookWeek({ profile, year, weekNumber: week.week_number, note: bookNote })
      onMutate?.()
      setView('book-success')
    } catch (e) {
      setError(e.message || 'Något gick fel vid bokning.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleWithdrawLottery() {
    setActionLoading(true)
    setError('')
    try {
      await withdrawLotteryApplication({ profile, year, weekNumber: week.week_number })
      await fetchData()
      onMutate?.()
    } catch (e) {
      setError(e.message || 'Något gick fel när intresseanmälan togs bort.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleCancel() {
    if (!booking) return
    setActionLoading(true)
    setError('')
    try {
      await cancelBooking({ profile, booking })
      onClose(true)
    } catch (e) {
      setError(e.message || 'Något gick fel vid avbokning.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleLottery() {
    setActionLoading(true)
    setError('')
    try {
      await applyForLottery({ profile, year, weekNumber: week.week_number })
      await fetchData()
      onMutate?.()
    } catch (e) {
      setError(e.message || 'Något gick fel vid lottningsanmälan.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleJoinReserve() {
    setActionLoading(true)
    setError('')
    try {
      await joinReserveList({ profile, year, weekNumber: week.week_number })
      await fetchData()
    } catch (e) {
      setError(e.message || 'Något gick fel när du ställde dig i kö.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleLeaveReserve() {
    setActionLoading(true)
    setError('')
    try {
      await leaveReserveList({ profile, year, weekNumber: week.week_number })
      setView('main')
      await fetchData()
    } catch (e) {
      setError(e.message || 'Något gick fel när du lämnade kön.')
    } finally {
      setActionLoading(false)
    }
  }

  async function saveNote(newNote) {
    if (!booking) return
    const trimmed = (newNote || '').trim().slice(0, 200)
    const { error: updateError } = await supabase
      .from('bookings')
      .update({ note: trimmed || null })
      .eq('id', booking.id)
    if (updateError) throw updateError
    setBooking({ ...booking, note: trimmed || null })
  }

  // Privacy: members can see booker name only on neighbor weeks (±1 from own booking)
  const canSeeBookerName = isAdmin || isOwnBooking || neighborOwn
  const bookerName = isLegacy ? week.legacyName : booking?.user?.name
  const ownReserve = ownLotteryApp?.status === 'reserve'

  const statusKey = isMaintenance ? 'maintenance' : isAvailable ? 'available' : isLottery ? 'lottery' : 'booked'
  const badge = STATUS_BADGE[statusKey]

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-sm px-4 pb-4">
      <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-800">
                Vecka {week.week_number} · {year}
              </h3>
              <div className="text-xs text-slate-400">
                {formatDateShort(dates.checkIn)} – {formatDateShort(dates.checkOut)} · {season.label}
              </div>
            </div>
            <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${badge.bg} ${badge.text}`}>
              {isOwnBooking ? 'Din bokning' : badge.label}
            </span>
          </div>
          <button onClick={() => onClose(false)} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Bekräftelsedialog: avboka */}
          {view === 'confirm-cancel' && booking && (
            <CancelBookingConfirm
              booking={booking}
              onCancel={() => setView('main')}
              onConfirm={handleCancel}
              loading={actionLoading}
            />
          )}

          {/* Bekräftelsedialog: lämna reservlista */}
          {view === 'confirm-leave-reserve' && (
            <LeaveReserveConfirm
              onCancel={() => setView('main')}
              onConfirm={handleLeaveReserve}
              loading={actionLoading}
            />
          )}

          {/* Bekräftelse efter genomförd bokning */}
          {view === 'book-success' && (
            <BookingSuccessView
              weekNumber={week.week_number}
              year={year}
              dates={dates}
              paymentRef={paymentReference(profile, year, week.week_number)}
              onDone={() => onClose(true)}
            />
          )}

          {view === 'main' && (
            <>
              {/* Datum/info-block — visas alltid */}
              <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                <InfoRow icon={Clock} label="In" value={`${formatDateLong(dates.checkIn)} kl 12:00`} />
                <InfoRow icon={Clock} label="Ut" value={`${formatDateLong(dates.checkOut)} kl 12:00`} />
                <InfoRow icon={Bed} value="6 sängplatser · självhushåll" />
                <InfoRow icon={Zap} value="El debiteras extra (2,50 kr/kWh)" iconClass="text-amber-500" />
              </div>

              {/* Period & lottningsdatum */}
              <PeriodInfo year={year} weekNumber={week.week_number} />

              {localLoading ? (
                <div className="flex justify-center items-center py-8">
                  <Spinner className="w-6 h-6 text-slate-400" />
                </div>
              ) : (
                <>
                  {/* === LEDIG === */}
                  {isAvailable && (
                    <BookSection
                      season={season}
                      remaining={remaining}
                      bookNote={bookNote}
                      setBookNote={setBookNote}
                      agreed={agreed}
                      setAgreed={setAgreed}
                      loading={actionLoading}
                      onBook={handleBook}
                    />
                  )}

                  {/* === LOTTNING === */}
                  {isLottery && (
                    <LotterySection
                      season={season}
                      applied={!!ownLotteryApp}
                      loading={actionLoading}
                      onApply={handleLottery}
                      onWithdraw={handleWithdrawLottery}
                    />
                  )}

                  {/* === UNDERHÅLL === */}
                  {isMaintenance && (
                    <>
                      <div className="bg-stone-100 border border-stone-300 rounded-lg p-4 space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-stone-700">
                          <Wrench className="w-4 h-4 text-amber-500" />
                          Underhåll / renovering
                        </div>
                        {week.legacyName && (
                          <div className="text-sm text-stone-600">{week.legacyName}</div>
                        )}
                        <p className="text-xs text-stone-500">
                          Veckan är blockerad för arbete. Ställ dig i kö om du vill ha chansen att boka ifall underhållet ställs in.
                        </p>
                      </div>

                      {ownReserve ? (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                          <div className="flex items-center gap-2 text-sm text-amber-800 font-medium">
                            <Star className="w-4 h-4" />
                            Du står i kö #{ownLotteryApp?.reserve_rank}
                          </div>
                          <p className="text-xs text-amber-700">
                            Om underhållet ställs in och veckan öppnas upp kontaktar admin ködeltagarna.
                          </p>
                          <button
                            onClick={() => setView('confirm-leave-reserve')}
                            disabled={actionLoading}
                            className="text-xs text-amber-700 hover:text-amber-900 underline"
                          >
                            Ta bort mig från kön
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={handleJoinReserve}
                          disabled={actionLoading}
                          className="w-full bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 font-medium rounded-lg px-4 py-2.5 text-sm flex items-center justify-center gap-2 transition-colors"
                        >
                          {actionLoading ? <Spinner color="amber" /> : <><Star className="w-4 h-4" /> Ställ mig i kö</>}
                        </button>
                      )}

                      {reserves.length > 0 && (
                        <div className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                          <Users className="w-3.5 h-3.5 inline -mt-0.5 mr-1 text-slate-400" />
                          {reserves.length} {reserves.length === 1 ? 'person' : 'personer'} i kön
                        </div>
                      )}
                    </>
                  )}

                  {/* === BOKAD === */}
                  {isBooked && (
                    <BookedSection
                      isOwnBooking={isOwnBooking}
                      isOthersBooking={isOthersBooking}
                      isLegacy={isLegacy}
                      canSeeBookerName={canSeeBookerName}
                      bookerName={bookerName}
                      booking={booking}
                      reserveCount={reserves.length}
                      ownReserve={ownReserve}
                      ownReserveRank={ownLotteryApp?.reserve_rank}
                      activeOffer={activeOffer}
                      actionLoading={actionLoading}
                      onSaveNote={saveNote}
                      onCancelBooking={() => setView('confirm-cancel')}
                      onJoinReserve={handleJoinReserve}
                      onLeaveReserve={() => setView('confirm-leave-reserve')}
                      paymentRef={booking ? paymentReference(booking.user, year, week.week_number) : ''}
                    />
                  )}

                  {/* === ADMIN-SEKTION === */}
                  {isAdmin && (
                    <AdminSection
                      open={adminOpen}
                      setOpen={setAdminOpen}
                      reserves={reserves}
                      booking={booking}
                      week={week}
                      year={year}
                      activeOffer={activeOffer}
                      onAfterAction={async () => {
                        await fetchData()
                        onMutate?.()
                      }}
                    />
                  )}

                  {/* === HISTORIK (admin only) === */}
                  {isAdmin && (
                    <HistorySection
                      open={historyOpen}
                      setOpen={setHistoryOpen}
                      weekNumber={week.week_number}
                      history={history}
                    />
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function PeriodInfo({ year, weekNumber }) {
  const period = getBookingPeriod(year, weekNumber)
  const passed = isLotteryPassed(year, weekNumber)
  const verb = passed ? 'skedde' : 'sker'
  return (
    <div className="flex items-center gap-2 text-[11px] text-slate-500 px-1">
      <Shuffle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      <span>
        Period: <span className="text-slate-600 font-medium">{period.label}</span>
        {' · '}
        Lottning {verb} <span className="text-slate-600 font-medium">{formatLotteryDate(period.lotteryDate)}</span>
      </span>
    </div>
  )
}

function InfoRow({ icon: Icon, label, value, iconClass = 'text-slate-400' }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <Icon className={`w-4 h-4 shrink-0 ${iconClass}`} />
      {label && <span className="text-slate-400">{label}:</span>}
      <span className="text-slate-700">{value}</span>
    </div>
  )
}

function LeaveReserveConfirm({ onCancel, onConfirm, loading }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
          <Star className="w-5 h-5 text-amber-500" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Ta bort dig från reservlistan?</h3>
          <p className="text-xs text-slate-400">Du kan ställa dig som reserv igen — men då hamnar du sist i kön.</p>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium rounded-lg px-4 py-2.5 text-sm transition-colors">
          Stanna kvar
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-medium rounded-lg px-4 py-2.5 text-sm flex items-center justify-center gap-1 transition-colors"
        >
          {loading ? <Spinner /> : <>Ta bort mig</>}
        </button>
      </div>
    </div>
  )
}
