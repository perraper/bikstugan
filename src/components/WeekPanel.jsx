import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { getSeasonPrice, getWeekDateRange, formatDateLong, formatDateShort, getBookingPeriod, isLotteryPassed, formatLotteryDate } from '../lib/weeks'
import { PAYMENT, REFUND_DEADLINE_WEEKS, paymentReference } from '../lib/config'
import {
  bookWeek,
  cancelBooking,
  joinReserveList,
  leaveReserveList,
  applyForLottery,
  isRefundable,
} from '../lib/booking-actions'
import {
  X, Clock, Bed, Zap, AlertTriangle, CreditCard, Copy, Check, MessageSquare,
  CalendarCheck, CheckCircle2, Ticket, Users, Star, Pencil, Save, History,
  Shield, Trash2, RotateCcw, Send, Shuffle, Wrench,
} from 'lucide-react'

const STATUS_BADGE = {
  available:   { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Ledig' },
  booked:      { bg: 'bg-red-100',     text: 'text-red-700',     label: 'Bokad' },
  lottery:     { bg: 'bg-purple-100',  text: 'text-purple-700',  label: 'Lottning' },
  maintenance: { bg: 'bg-stone-200',   text: 'text-stone-700',   label: 'Underhåll' },
}

export default function WeekPanel({ week, year, onClose, onMutate }) {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
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
  const [editingNote, setEditingNote] = useState(false)
  const [noteDraft, setNoteDraft] = useState('')
  const [copiedField, setCopiedField] = useState(null)
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

  useEffect(() => {
    fetchData()
  }, [week.week_number, year])

  async function fetchData() {
    setLoading(true)
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
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  function copyToClipboard(text, field) {
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 1500)
    }).catch(() => {})
  }

  async function handleBook() {
    setActionLoading(true)
    setError('')
    try {
      await bookWeek({ profile, year, weekNumber: week.week_number, note: bookNote })
      onClose(true)
    } catch (e) {
      setError(e.message || 'Något gick fel.')
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
      onClose(true)
    } catch (e) {
      setError(e.message || 'Något gick fel.')
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
      setError(e.message || 'Något gick fel.')
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
      setError(e.message || 'Något gick fel.')
    } finally {
      setActionLoading(false)
    }
  }

  async function saveNote() {
    if (!booking) return
    const trimmed = noteDraft.trim().slice(0, 200)
    await supabase.from('bookings').update({ note: trimmed || null }).eq('id', booking.id)
    setBooking({ ...booking, note: trimmed || null })
    setEditingNote(false)
    setNoteDraft('')
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
              {error}
            </div>
          )}

          {/* Bekräftelsedialog: avboka */}
          {view === 'confirm-cancel' && booking && (
            <CancelConfirm
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
                />
              )}

              {/* === UNDERHÅLL === */}
              {isMaintenance && (
                <div className="bg-stone-100 border border-stone-300 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-stone-700">
                    <Wrench className="w-4 h-4 text-amber-500" />
                    Underhåll / renovering
                  </div>
                  {week.legacyName && (
                    <div className="text-sm text-stone-600">{week.legacyName}</div>
                  )}
                  <p className="text-xs text-stone-500">
                    Veckan är blockerad för arbete och kan inte bokas.
                  </p>
                </div>
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
                  profile={profile}
                  reserveCount={reserves.length}
                  ownReserve={ownReserve}
                  ownReserveRank={ownLotteryApp?.reserve_rank}
                  activeOffer={activeOffer}
                  loading={loading}
                  actionLoading={actionLoading}
                  editingNote={editingNote}
                  noteDraft={noteDraft}
                  setEditingNote={setEditingNote}
                  setNoteDraft={setNoteDraft}
                  onSaveNote={saveNote}
                  onCancelBooking={() => setView('confirm-cancel')}
                  onJoinReserve={handleJoinReserve}
                  onLeaveReserve={() => setView('confirm-leave-reserve')}
                  copiedField={copiedField}
                  onCopy={copyToClipboard}
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
      <Shuffle className="w-3 h-3 text-slate-400" />
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

function BookSection({ season, remaining, bookNote, setBookNote, agreed, setAgreed, loading, onBook }) {
  return (
    <>
      <div className="bg-red-50 border border-red-100 rounded-lg p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-slate-500">{season.label}</div>
          </div>
          <div className="text-2xl font-bold text-red-700">{season.price} kr</div>
        </div>
        <div className="flex items-start gap-2 border-t border-red-100 pt-2">
          <CreditCard className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
          <span className="text-xs text-red-700">
            <strong>{PAYMENT.depositAmount} kr</strong> i anmälningsavgift på plusgiro — resterande {remaining} kr faktureras senare.
          </span>
        </div>
        <div className="flex items-start gap-2 text-xs text-slate-500 border-t border-red-100 pt-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
          <span>
            Vid avbokning <strong>senare än {REFUND_DEADLINE_WEEKS} veckor</strong> innan veckan återbetalas inte anmälningsavgiften.
          </span>
        </div>
      </div>

      <div>
        <label className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5">
          <MessageSquare className="w-3.5 h-3.5" />
          Kommentar (valfritt)
        </label>
        <textarea
          value={bookNote}
          onChange={(e) => setBookNote(e.target.value.slice(0, 200))}
          placeholder="T.ex. kommer sent på lördag, har med hund..."
          rows={2}
          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 resize-none"
        />
        <div className="text-[10px] text-slate-400 text-right mt-0.5">{bookNote.length}/200</div>
      </div>

      <label className="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3 cursor-pointer hover:bg-slate-100 transition-colors">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
        />
        <span className="text-xs text-slate-600 leading-relaxed">
          Jag åtar mig att betala <strong>{PAYMENT.depositAmount} kr</strong> i anmälningsavgift på plusgiro {PAYMENT.plusgiro}
          och resterande <strong>{remaining} kr</strong> enligt faktura. Jag är medveten om att avgiften
          inte återbetalas vid avbokning senare än {REFUND_DEADLINE_WEEKS} veckor innan ankomst.
        </span>
      </label>

      <button
        onClick={onBook}
        disabled={loading || !agreed}
        className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium rounded-lg px-4 py-3 text-sm flex items-center justify-center gap-2 transition-colors"
      >
        {loading ? (
          <Spinner />
        ) : (
          <>
            <CalendarCheck className="w-4 h-4" />
            Bekräfta bokning
          </>
        )}
      </button>
    </>
  )
}

function LotterySection({ season, applied, loading, onApply }) {
  return (
    <>
      <div className="bg-purple-50 border border-purple-100 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-1.5">
          <Ticket className="w-4 h-4 text-purple-600" />
          <span className="text-sm font-medium text-purple-700">Lottning pågår</span>
        </div>
        <p className="text-sm text-slate-500">
          Denna vecka ingår i lottningsperioden. Anmäl ditt intresse så deltar du i dragningen.
        </p>
        <div className="text-xs text-slate-500 mt-2">Pris vid vinst: <strong>{season.price} kr</strong></div>
      </div>

      {applied ? (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 className="w-4 h-4" />
          Du är anmäld till lottningen
        </div>
      ) : (
        <button
          onClick={onApply}
          disabled={loading}
          className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium rounded-lg px-4 py-3 text-sm flex items-center justify-center gap-2 transition-colors"
        >
          {loading ? <Spinner /> : <><Ticket className="w-4 h-4" /> Anmäl intresse</>}
        </button>
      )}
    </>
  )
}

function BookedSection({
  isOwnBooking, isOthersBooking, isLegacy, canSeeBookerName, bookerName, booking, profile,
  reserveCount, ownReserve, ownReserveRank, activeOffer, loading, actionLoading,
  editingNote, noteDraft, setEditingNote, setNoteDraft, onSaveNote, onCancelBooking,
  onJoinReserve, onLeaveReserve, copiedField, onCopy, paymentRef,
}) {
  return (
    <>
      {/* Vem äger veckan */}
      <div className="bg-slate-50 rounded-lg p-4 space-y-1.5">
        {isOwnBooking ? (
          <>
            <div className="flex items-center gap-2 text-sm text-slate-700 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Din bokning
            </div>
            {booking?.created_at && (
              <div className="text-xs text-slate-400">
                Bokad {new Date(booking.created_at).toLocaleDateString('sv-SE')}
              </div>
            )}
          </>
        ) : canSeeBookerName && bookerName ? (
          <>
            <div className="text-xs text-slate-400 mb-0.5">Bokad av</div>
            <div className="text-sm text-slate-700 font-medium">{bookerName}</div>
            {!isLegacy && (
              <div className="text-[11px] text-slate-400">
                Du ser namnet eftersom du har en bokning grannveckan.
              </div>
            )}
          </>
        ) : (
          <div className="text-sm text-slate-500">Veckan är bokad.</div>
        )}
      </div>

      {/* Egen bokning: deposit + kommentar + avboka */}
      {isOwnBooking && booking && (
        <>
          {booking.deposit_paid ? (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 text-xs text-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              Anmälningsavgift {booking.deposit_amount || PAYMENT.depositAmount} kr betald
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm text-amber-800 font-medium">
                <CreditCard className="w-4 h-4" />
                Anmälningsavgift ej betald
              </div>
              <div className="space-y-1 bg-white rounded-md p-2 border border-amber-100">
                <PaymentRow label="Plusgiro" value={PAYMENT.plusgiro} field="pg" copied={copiedField} onCopy={onCopy} />
                <PaymentRow label="Belopp" value={`${booking.deposit_amount || PAYMENT.depositAmount} kr`} field="amount" copied={copiedField} onCopy={onCopy} />
                <PaymentRow label="Meddelande" value={paymentRef} field="ref" copied={copiedField} onCopy={onCopy} />
              </div>
            </div>
          )}

          {/* Egen kommentar */}
          {editingNote ? (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 space-y-2">
              <textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value.slice(0, 200))}
                rows={2}
                autoFocus
                placeholder="Kommentar (max 200 tecken)..."
                className="w-full bg-white border border-slate-200 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/40 resize-none"
              />
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400">{noteDraft.length}/200</span>
                <div className="flex gap-1.5">
                  <button onClick={() => { setEditingNote(false); setNoteDraft('') }} className="text-[11px] text-slate-500 hover:text-slate-700 px-2 py-1">
                    Avbryt
                  </button>
                  <button onClick={onSaveNote} className="flex items-center gap-1 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 rounded">
                    <Save className="w-3 h-3" /> Spara
                  </button>
                </div>
              </div>
            </div>
          ) : booking.note ? (
            <div className="flex items-start gap-2 bg-slate-50 rounded-lg px-3 py-2 group">
              <MessageSquare className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-600 flex-1 whitespace-pre-wrap">{booking.note}</p>
              <button
                onClick={() => { setEditingNote(true); setNoteDraft(booking.note) }}
                className="opacity-60 hover:opacity-100 transition-opacity text-slate-400 hover:text-slate-600"
                title="Redigera"
              >
                <Pencil className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setEditingNote(true); setNoteDraft('') }}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Lägg till kommentar
            </button>
          )}

          {/* Reservs (bara antal för medlem) */}
          {reserveCount > 0 && (
            <div className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
              <Users className="w-3.5 h-3.5 inline -mt-0.5 mr-1 text-slate-400" />
              {reserveCount} reserv{reserveCount !== 1 ? 'er' : ''} står på kö om du avbokar
            </div>
          )}

          <button
            onClick={onCancelBooking}
            disabled={actionLoading}
            className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-medium rounded-lg px-4 py-2.5 text-sm flex items-center justify-center gap-2 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Avboka
          </button>
        </>
      )}

      {/* Annans bokning: ställ mig som reserv */}
      {isOthersBooking && (
        <>
          {activeOffer && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
              <Clock className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />
              Ett reserverbjudande pågår just nu (väntar på svar i 48h).
            </div>
          )}

          {ownReserve ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm text-amber-800 font-medium">
                <Star className="w-4 h-4" />
                Du står som reserv #{ownReserveRank}
              </div>
              <p className="text-xs text-amber-700">
                Om {bookerName || 'bokaren'} avbokar och du är först i kön får du ett mejl med 48h på dig att tacka ja.
              </p>
              <button
                onClick={onLeaveReserve}
                disabled={actionLoading}
                className="text-xs text-amber-700 hover:text-amber-900 underline"
              >
                Ta bort mig från reservlistan
              </button>
            </div>
          ) : !isLegacy ? (
            <button
              onClick={onJoinReserve}
              disabled={actionLoading}
              className="w-full bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 font-medium rounded-lg px-4 py-2.5 text-sm flex items-center justify-center gap-2 transition-colors"
            >
              {actionLoading ? <Spinner color="amber" /> : <><Star className="w-4 h-4" /> Ställ mig som reserv</>}
            </button>
          ) : (
            <div className="text-[11px] text-slate-400 italic">
              Veckan är registrerad som äldre bokning utan koppling till medlemskonto.
            </div>
          )}
        </>
      )}
    </>
  )
}

function PaymentRow({ label, value, field, copied, onCopy }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-slate-400 shrink-0">{label}</span>
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-slate-700 font-medium font-mono truncate">{value}</span>
        <button
          onClick={() => onCopy(value, field)}
          className="p-1 hover:bg-slate-100 rounded transition-colors shrink-0"
          title="Kopiera"
        >
          {copied === field ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-slate-400" />}
        </button>
      </div>
    </div>
  )
}

function CancelConfirm({ booking, onCancel, onConfirm, loading }) {
  const refundable = isRefundable(booking.year, booking.week_number)
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-5 h-5 text-red-500" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Avboka vecka {booking.week_number}?</h3>
          <p className="text-xs text-slate-400">Denna åtgärd kan inte ångras.</p>
        </div>
      </div>

      {booking.deposit_paid && (
        refundable ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-700">
            Det är mer än {REFUND_DEADLINE_WEEKS} veckor till incheckning —
            <strong> anmälningsavgiften ({booking.deposit_amount || PAYMENT.depositAmount} kr) återbetalas.</strong>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
            <strong>OBS:</strong> Det är mindre än {REFUND_DEADLINE_WEEKS} veckor till incheckning —
            anmälningsavgiften <strong>återbetalas inte</strong>.
          </div>
        )
      )}

      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium rounded-lg px-4 py-2.5 text-sm transition-colors">
          Behåll
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium rounded-lg px-4 py-2.5 text-sm flex items-center justify-center gap-1 transition-colors"
        >
          {loading ? <Spinner /> : <><Trash2 className="w-4 h-4" /> Avboka</>}
        </button>
      </div>
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

function AdminSection({ open, setOpen, reserves, booking, week, year, activeOffer, onAfterAction }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [legacyName, setLegacyName] = useState('')
  const [legacyNote, setLegacyNote] = useState('')
  const [legacyType, setLegacyType] = useState('booking') // 'booking' | 'maintenance'
  const [legacyOpen, setLegacyOpen] = useState(false)

  const hasRealBooking = !!booking
  const existingLegacyName = week.isLegacy ? week.legacyName : null

  async function setStatus(status) {
    setBusy(true); setErr('')
    const price = week.price || 2000
    const { error } = await supabase
      .from('weeks')
      .upsert(
        { year, week_number: week.week_number, status, price },
        { onConflict: 'year,week_number' }
      )
    if (error) setErr(error.message)
    else await onAfterAction()
    setBusy(false)
  }

  async function removeLegacy() {
    setBusy(true); setErr('')
    // Ta bort både maintenance- och booking-typ legacy-rader för veckan.
    const { error: legacyError } = await supabase
      .from('legacy_bookings')
      .delete()
      .eq('year', year)
      .eq('week_number', week.week_number)
      .in('type', ['booking', 'maintenance'])
    if (legacyError) {
      setErr(legacyError.message)
      setBusy(false)
      return
    }
    // Om weeks-raden står som 'booked' utan riktig bokare, frigör den.
    if (week.status === 'booked' && !booking) {
      await supabase
        .from('weeks')
        .update({ status: 'available', booked_by_user_id: null })
        .eq('year', year)
        .eq('week_number', week.week_number)
    }
    await onAfterAction()
    setBusy(false)
  }

  async function saveLegacy() {
    if (!legacyName.trim()) return
    setBusy(true); setErr('')
    const { error } = await supabase.from('legacy_bookings').insert({
      year,
      week_number: week.week_number,
      booked_by_name: legacyName.trim(),
      type: legacyType,
      notes: legacyNote.trim() || null,
    })
    if (error) setErr(error.message)
    else {
      // För underhåll behöver inte weeks-raden ändras — UI hämtar färg från legacy.type.
      // Men för 'booking' förvänta att veckan markeras som bokad.
      if (legacyType === 'booking' && week.status !== 'booked') {
        await supabase.from('weeks').upsert(
          { year, week_number: week.week_number, status: 'booked', price: week.price || 2000 },
          { onConflict: 'year,week_number' }
        )
      }
      setLegacyName(''); setLegacyNote(''); setLegacyType('booking'); setLegacyOpen(false)
      await onAfterAction()
    }
    setBusy(false)
  }

  async function markDepositPaid() {
    if (!booking) return
    setBusy(true); setErr('')
    const { error } = await supabase
      .from('bookings')
      .update({ deposit_paid: true, deposit_paid_at: new Date().toISOString() })
      .eq('id', booking.id)
    if (error) setErr(error.message)
    else await onAfterAction()
    setBusy(false)
  }

  async function markDepositUnpaid() {
    if (!booking) return
    setBusy(true); setErr('')
    const { error } = await supabase
      .from('bookings')
      .update({ deposit_paid: false, deposit_paid_at: null })
      .eq('id', booking.id)
    if (error) setErr(error.message)
    else await onAfterAction()
    setBusy(false)
  }

  async function removeReserve(applicationId) {
    setBusy(true); setErr('')
    const { error } = await supabase
      .from('lottery_applications')
      .delete()
      .eq('id', applicationId)
    if (error) setErr(error.message)
    else await onAfterAction()
    setBusy(false)
  }

  async function sendReminder() {
    if (!booking) return
    setBusy(true); setErr('')
    try {
      await supabase.functions.invoke('send-email', {
        body: {
          type: 'deposit_reminder',
          userId: booking.user_id,
          weekNumber: week.week_number,
          year,
          extra: { reminderCount: (booking.deposit_reminder_count || 0) + 1 },
        },
      })
      await supabase.from('bookings').update({
        deposit_reminder_count: (booking.deposit_reminder_count || 0) + 1,
        deposit_reminder_last_at: new Date().toISOString(),
      }).eq('id', booking.id)
      await onAfterAction()
    } catch (e) {
      setErr(e.message)
    }
    setBusy(false)
  }

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <span className="flex items-center gap-2 text-xs font-semibold text-slate-600 uppercase tracking-wide">
          <Shield className="w-3.5 h-3.5" /> Admin
        </span>
        <span className="text-xs text-slate-400">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div className="p-4 space-y-3 text-sm">
          {err && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">{err}</div>
          )}

          {/* Snabb status-toggle */}
          <div className="space-y-1.5 border-b border-slate-100 pb-3">
            <div className="text-xs text-slate-400 uppercase tracking-wide">Status</div>
            <div className="flex gap-1.5">
              {[
                { key: 'available', label: 'Ledig', cls: 'bg-emerald-500 text-white', idle: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
                { key: 'lottery',   label: 'Lottning', cls: 'bg-purple-500 text-white', idle: 'bg-purple-50 text-purple-700 hover:bg-purple-100' },
                { key: 'booked',    label: 'Bokad',    cls: 'bg-red-500 text-white',     idle: 'bg-red-50 text-red-700 hover:bg-red-100' },
              ].map((s) => {
                const active = week.status === s.key
                return (
                  <button
                    key={s.key}
                    disabled={busy}
                    onClick={() => setStatus(s.key)}
                    className={`flex-1 text-xs font-medium rounded px-2 py-1.5 transition-colors ${active ? s.cls : s.idle}`}
                  >
                    {s.label}
                  </button>
                )
              })}
            </div>
            {week.status === 'booked' && !hasRealBooking && !existingLegacyName && (
              <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded px-2 py-1">
                Veckan är markerad som bokad men saknar bokare. Lägg till legacy-namn nedan eller ändra status.
              </div>
            )}
          </div>

          {/* Legacy-namn (om ingen riktig bokning finns) */}
          {!hasRealBooking && (
            <div className="space-y-1.5 border-b border-slate-100 pb-3">
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-400 uppercase tracking-wide">Legacy-bokning</div>
                {!legacyOpen && (
                  <button
                    onClick={() => setLegacyOpen(true)}
                    className="text-[11px] text-slate-500 hover:text-slate-700"
                  >
                    {existingLegacyName ? 'Ändra' : '+ Lägg till namn'}
                  </button>
                )}
              </div>
              {existingLegacyName && !legacyOpen && (
                <div className="flex items-center justify-between gap-2 bg-slate-50 rounded px-2 py-1">
                  <span className="text-xs text-slate-600 truncate">{existingLegacyName}</span>
                  <button
                    disabled={busy}
                    onClick={removeLegacy}
                    className="text-[11px] text-slate-400 hover:text-red-500 transition-colors shrink-0 flex items-center gap-1"
                    title="Ta bort"
                  >
                    <Trash2 className="w-3 h-3" />
                    Ta bort
                  </button>
                </div>
              )}
              {legacyOpen && (
                <div className="space-y-1.5">
                  <div className="flex gap-1">
                    {[
                      { key: 'booking', label: 'Bokning', cls: 'bg-red-500 text-white', idle: 'bg-red-50 text-red-700 hover:bg-red-100' },
                      { key: 'maintenance', label: 'Underhåll', cls: 'bg-amber-500 text-white', idle: 'bg-amber-50 text-amber-700 hover:bg-amber-100' },
                    ].map((t) => {
                      const active = legacyType === t.key
                      return (
                        <button
                          key={t.key}
                          onClick={() => setLegacyType(t.key)}
                          className={`flex-1 text-[11px] font-medium rounded px-2 py-1 transition-colors ${active ? t.cls : t.idle}`}
                        >
                          {t.label}
                        </button>
                      )
                    })}
                  </div>
                  <input
                    type="text"
                    value={legacyName}
                    onChange={(e) => setLegacyName(e.target.value)}
                    placeholder={legacyType === 'maintenance' ? 'T.ex. Renovering kök, VVS' : (existingLegacyName || 'Namn (t.ex. Mälarn)')}
                    className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                  <input
                    type="text"
                    value={legacyNote}
                    onChange={(e) => setLegacyNote(e.target.value)}
                    placeholder="Anteckning (valfritt)"
                    className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => { setLegacyOpen(false); setLegacyName(''); setLegacyNote(''); setLegacyType('booking') }}
                      className="text-[11px] text-slate-500 hover:text-slate-700 px-2 py-1"
                    >
                      Avbryt
                    </button>
                    <button
                      disabled={busy || !legacyName.trim()}
                      onClick={saveLegacy}
                      className="flex-1 text-[11px] bg-slate-700 hover:bg-slate-800 disabled:opacity-50 text-white px-2 py-1 rounded"
                    >
                      Spara
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {booking && (
            <div className="space-y-2 border-b border-slate-100 pb-3">
              <div className="text-xs text-slate-400 uppercase tracking-wide">Bokning</div>
              <div className="text-xs text-slate-600">
                {booking.user?.name} ({booking.user?.email})
                {booking.user?.phone && <> · {booking.user.phone}</>}
              </div>
              <div className="flex flex-wrap gap-2">
                {booking.deposit_paid ? (
                  <button
                    disabled={busy}
                    onClick={markDepositUnpaid}
                    className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" /> Ångra "betald"
                  </button>
                ) : (
                  <>
                    <button
                      disabled={busy}
                      onClick={markDepositPaid}
                      className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 rounded flex items-center gap-1"
                    >
                      <Check className="w-3 h-3" /> Markera betald
                    </button>
                    <button
                      disabled={busy}
                      onClick={sendReminder}
                      className="text-xs bg-amber-100 hover:bg-amber-200 text-amber-800 px-2 py-1 rounded flex items-center gap-1"
                      title={booking.deposit_reminder_count ? `${booking.deposit_reminder_count} påminnelser skickade` : 'Inga påminnelser skickade'}
                    >
                      <Send className="w-3 h-3" /> Skicka påminnelse
                      {booking.deposit_reminder_count > 0 && ` (${booking.deposit_reminder_count})`}
                    </button>
                  </>
                )}
              </div>
              {booking.note && (
                <div className="text-[11px] text-slate-500 italic bg-slate-50 rounded px-2 py-1">
                  Bokarens kommentar: "{booking.note}"
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <div className="text-xs text-slate-400 uppercase tracking-wide">Reservlista ({reserves.length})</div>
            {reserves.length === 0 ? (
              <div className="text-xs text-slate-400 italic">Inga reserver</div>
            ) : (
              <ul className="space-y-1">
                {reserves.map((r) => (
                  <li key={r.id} className="flex items-center justify-between text-xs bg-slate-50 rounded px-2 py-1.5">
                    <span className="text-slate-700">
                      <span className="font-mono text-slate-400">#{r.reserve_rank}</span> {r.user?.name}
                    </span>
                    <button
                      disabled={busy}
                      onClick={() => removeReserve(r.id)}
                      className="text-slate-400 hover:text-red-500 transition-colors"
                      title="Ta bort"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {activeOffer && (
            <div className="bg-amber-50 border border-amber-200 rounded p-2 text-[11px] text-amber-800">
              Erbjudande pågår till <strong>{activeOffer.user?.name}</strong> · deadline{' '}
              {new Date(activeOffer.deadline).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function HistorySection({ open, setOpen, weekNumber, history }) {
  // Visa endast slutförda veckor — checkOut < idag.
  const now = Date.now()
  const sorted = [...history]
    .filter((row) => getWeekDateRange(row.year, weekNumber).checkOut.getTime() < now)
    .sort((a, b) => b.year - a.year)
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <span className="flex items-center gap-2 text-xs font-semibold text-slate-600 uppercase tracking-wide">
          <History className="w-3.5 h-3.5" /> Historik V{weekNumber}
        </span>
        <span className="text-xs text-slate-400">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div className="p-3 space-y-1 text-xs max-h-60 overflow-y-auto">
          {sorted.length === 0 ? (
            <div className="text-slate-400 italic">Ingen historik</div>
          ) : (
            sorted.map((row, i) => {
              const name = row.source === 'real' ? row.user?.name : row.booked_by_name
              return (
                <div key={i} className="flex items-center justify-between gap-2 px-2 py-1 hover:bg-slate-50 rounded">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-slate-400 shrink-0">{row.year}</span>
                    <span className="text-slate-700 truncate">{name || '—'}</span>
                    {row.type && row.type !== 'booking' && (
                      <span className="text-[10px] text-slate-400 italic">({row.type})</span>
                    )}
                    {row.source === 'real' && row.status === 'cancelled' && (
                      <span className="text-[10px] text-red-400 italic">(avbokad)</span>
                    )}
                  </div>
                  {row.price && <span className="text-slate-400 text-[10px]">{row.price} kr</span>}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

function Spinner({ color = 'white' }) {
  const ringClass = color === 'amber' ? 'border-amber-300/30 border-t-amber-700' : 'border-white/30 border-t-white'
  return <div className={`w-4 h-4 border-2 ${ringClass} rounded-full animate-spin`} />
}
