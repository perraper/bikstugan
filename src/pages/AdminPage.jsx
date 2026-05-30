import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/useAuth'
import { getSeasonPrice, getWeekDateRange, formatDateShort, getWeeksForYear } from '../lib/weeks'
import { PAYMENT } from '../lib/config'
import { downloadCsv, downloadJson, fetchBackupData, bookingsToCsv } from '../lib/backup'
import { logAdminAction } from '../lib/audit'
import {
  Settings, Shuffle, Eye, Send, ChevronLeft, ChevronRight,
  GripVertical, Trophy, Users, AlertTriangle, Check, X, Shield, User,
  Download, CalendarDays, History, Plus, Wrench, Star, Trash2,
  CreditCard, CheckCircle2, Search, BarChart3, TrendingUp,
  MessageSquare, Bug, Hammer, RotateCcw, ArrowRight, Pencil, Save, Mail, Phone,
  Upload, MailCheck, Zap
} from 'lucide-react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Spinner from '../components/Spinner'

const AUDIT_LABELS = {
  'booking.toggle_deposit_paid':      { label: 'Anmälningsavgift', tone: 'emerald' },
  'booking.toggle_final_paid':        { label: 'Slutbetalning',    tone: 'emerald' },
  'booking.toggle_electricity_paid':  { label: 'El-betalning',     tone: 'amber'   },
  'booking.edit_electricity':         { label: 'El-avläsning',     tone: 'amber'   },
  'booking.mark_refunded':        { label: 'Återbetald (anm.)', tone: 'amber' },
  'booking.mark_final_refunded':  { label: 'Återbetald (slut)', tone: 'amber' },
  'user.approve':                 { label: 'Godkände',          tone: 'emerald' },
  'user.reject':                  { label: 'Avvisade',          tone: 'red' },
  'user.toggle_admin':            { label: 'Bytte roll',        tone: 'purple' },
  'user.delete':                  { label: 'Tog bort',          tone: 'red' },
  'user.edit':                    { label: 'Redigerade',        tone: 'blue' },
  'lottery.publish':              { label: 'Lottning',          tone: 'purple' },
}

const AUDIT_TONE = {
  emerald: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  amber:   'bg-amber-50 text-amber-700 border border-amber-200',
  red:     'bg-red-50 text-red-700 border border-red-200',
  purple:  'bg-purple-50 text-purple-700 border border-purple-200',
  blue:    'bg-blue-50 text-blue-700 border border-blue-200',
  slate:   'bg-slate-100 text-slate-600 border border-slate-200',
}

function renderAuditSummary(row) {
  const d = row.details || {}
  switch (row.action) {
    case 'booking.toggle_deposit_paid':
      return `V${d.week_number}/${d.year} anm.avg → ${d.after?.deposit_paid ? 'betald' : 'obetald'}`
    case 'booking.toggle_final_paid':
      return `V${d.week_number}/${d.year} slutbet → ${d.after?.final_paid ? 'betald' : 'obetald'}`
    case 'booking.toggle_electricity_paid':
      return `V${d.week_number}/${d.year} el → ${d.after?.electricity_paid ? 'betald' : 'obetald'}`
    case 'booking.edit_electricity':
      return `V${d.week_number}/${d.year} el ${d.before?.start_kwh}→${d.before?.end_kwh ?? '?'} ändrat till ${d.after?.start_kwh}→${d.after?.end_kwh ?? '?'} kWh`
    case 'booking.mark_refunded':
      return `V${d.week_number}/${d.year} anm.avg återbetald`
    case 'booking.mark_final_refunded':
      return `V${d.week_number}/${d.year} slutbet återbetald`
    case 'user.approve':
      return `Medlem godkänd`
    case 'user.reject':
      return `${d.name || 'Medlem'} (${d.email || ''}) avvisad`
    case 'user.toggle_admin':
      return `${d.before?.role || '?'} → ${d.after?.role || '?'}`
    case 'user.delete':
      return `${d.name || 'Medlem'} (${d.email || ''}) borttagen`
    case 'user.edit': {
      const fields = Object.keys(d.after || {})
      return fields.length > 0 ? `Ändrade: ${fields.join(', ')}` : 'Redigerade medlem'
    }
    case 'lottery.publish': {
      const weeks = Object.keys(d.weeks || {})
      return `${weeks.length} vecka${weeks.length === 1 ? '' : 'or'} publicerade${d.year ? ` (${d.year})` : ''}`
    }
    default:
      return ''
  }
}

function SortableApplicant({ app, index, isWinner }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: app.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 rounded-lg border ${
        isWinner
          ? 'bg-emerald-50 border-emerald-200'
          : 'bg-slate-50 border-slate-200'
      }`}
    >
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 text-slate-400 hover:text-slate-600">
        <GripVertical className="w-4 h-4" />
      </button>
      <div className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold bg-slate-200 text-slate-600">
        {index + 1}
      </div>
      {isWinner && <Trophy className="w-4 h-4 text-amber-500" />}
      <div className="flex-1">
        <div className="text-sm text-slate-700">{app.user?.name || 'Okänd'}</div>
        <div className="text-xs text-slate-400">{app.user?.email}</div>
      </div>
      {isWinner ? (
        <span className="text-xs text-emerald-600 font-medium">Vinnare</span>
      ) : (
        <span className="text-xs text-slate-400">Reserv #{index}</span>
      )}
    </div>
  )
}

export default function AdminPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [year, setYear] = useState(new Date().getFullYear())
  const [weeks, setWeeks] = useState([])
  const [lotteryWeeks, setLotteryWeeks] = useState([])
  const [draftResults, setDraftResults] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [tab, setTab] = useState('payments')
  const [pendingUsers, setPendingUsers] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [editingElId, setEditingElId] = useState(null)
  const [elDraft, setElDraft] = useState({ start: '', end: '' })
  const [approvingId, setApprovingId] = useState(null)
  const [selectedMember, setSelectedMember] = useState(null)
  const [memberBookings, setMemberBookings] = useState([])
  const [editForm, setEditForm] = useState(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState(null)
  const [lotteryApps, setLotteryApps] = useState([])
  const [legacyBookings, setLegacyBookings] = useState([])
  const [legacyForm, setLegacyForm] = useState(null)
  const [savingLegacy, setSavingLegacy] = useState(false)
  const [resending, setResending] = useState(false)
  const [resentCount, setResentCount] = useState(null)
  const [allBookings, setAllBookings] = useState([])
  const [memberSearch, setMemberSearch] = useState('')
  const [confirmDialog, setConfirmDialog] = useState(null)
  const [issues, setIssues] = useState([])
  const [issueFilter, setIssueFilter] = useState('open')
  const [issueResponse, setIssueResponse] = useState({ id: null, text: '' })
  const [allowedEmails, setAllowedEmails] = useState([])
  const [allowedEmailInput, setAllowedEmailInput] = useState('')
  const [allowedEmailBusy, setAllowedEmailBusy] = useState(false)
  const [allowedEmailMsg, setAllowedEmailMsg] = useState(null)
  const [auditLog, setAuditLog] = useState([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [expandedAuditId, setExpandedAuditId] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  )

  const totalWeeks = getWeeksForYear(year)

  // Funktionerna nedan deklareras senare i komponenten — hoistade
  // function declarations är säkra att anropa här, men react-hooks-pluginet
  // varnar pga risk för stale closure. Vi har inga deps utöver year/tab,
  // så det är OK i praktiken.
  /* eslint-disable react-hooks/immutability */
  useEffect(() => {
    fetchData()
    fetchPendingUsers()
    fetchLegacyBookings()
  }, [year])

  useEffect(() => {
    fetchIssues()
    fetchAllowedEmails()
  }, [])

  useEffect(() => {
    if (tab === 'audit') fetchAuditLog()
  }, [tab])
  /* eslint-enable react-hooks/immutability */

  async function fetchAuditLog() {
    setAuditLoading(true)
    const { data } = await supabase
      .from('admin_audit_log')
      .select('*, admin:users!admin_id(name, email)')
      .order('created_at', { ascending: false })
      .limit(100)
    setAuditLog(data || [])
    setAuditLoading(false)
  }

  async function fetchAllowedEmails() {
    const { data } = await supabase
      .from('allowed_emails')
      .select('*')
      .order('email')
    setAllowedEmails(data || [])
  }

  async function addAllowedEmails(emails) {
    const cleaned = Array.from(new Set(
      emails
        .map((e) => (e || '').trim().toLowerCase())
        .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
    ))
    if (cleaned.length === 0) {
      setAllowedEmailMsg({ type: 'error', text: 'Inga giltiga mejladresser hittades.' })
      return
    }
    setAllowedEmailBusy(true)
    setAllowedEmailMsg(null)
    const rows = cleaned.map((email) => ({ email, added_by: profile?.id ?? null }))
    const { error } = await supabase
      .from('allowed_emails')
      .upsert(rows, { onConflict: 'email', ignoreDuplicates: true })
    setAllowedEmailBusy(false)
    if (error) {
      setAllowedEmailMsg({ type: 'error', text: error.message })
      return
    }
    await fetchAllowedEmails()
    setAllowedEmailMsg({ type: 'success', text: `La till ${cleaned.length} mejladress${cleaned.length === 1 ? '' : 'er'}.` })
  }

  async function removeAllowedEmail(email) {
    const { error } = await supabase.from('allowed_emails').delete().eq('email', email)
    if (error) {
      setAllowedEmailMsg({ type: 'error', text: error.message })
      return
    }
    setAllowedEmails((prev) => prev.filter((r) => r.email !== email))
  }

  async function handleAllowedCsvUpload(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const text = await file.text()
    const emails = text
      .split(/[\r\n,;]+/)
      .map((line) => {
        const cell = line.split(/[,;\t]/)[0]
        return cell.replace(/^"|"$/g, '').trim()
      })
      .filter(Boolean)
    await addAllowedEmails(emails)
  }

  async function submitManualAllowedEmail() {
    if (!allowedEmailInput.trim()) return
    await addAllowedEmails([allowedEmailInput])
    setAllowedEmailInput('')
  }

  async function fetchIssues() {
    const { data } = await supabase
      .from('issues')
      .select('*, user:users!user_id(name, email), resolver:users!resolved_by(name)')
      .order('created_at', { ascending: false })
    setIssues(data || [])
  }

  async function updateIssueStatus(id, status, responseText) {
    const update = { status }
    if (status === 'resolved') {
      update.resolved_at = new Date().toISOString()
      update.resolved_by = profile?.id
    }
    if (responseText !== undefined) update.admin_response = responseText
    await supabase.from('issues').update(update).eq('id', id)
    fetchIssues()
    setIssueResponse({ id: null, text: '' })
  }

  async function fetchData() {
    const { data: weekData } = await supabase
      .from('weeks')
      .select('*, booked_by:users(name, email)')
      .eq('year', year)
      .order('week_number')

    setWeeks(weekData || [])
    const lotteryW = (weekData || []).filter((w) => w.status === 'lottery')
    setLotteryWeeks(lotteryW)

    const { data: appData } = await supabase
      .from('lottery_applications')
      .select('*, user:users(name, email)')
      .eq('year', year)
      .order('week_number')
    setLotteryApps(appData || [])

    const { data: bookingData } = await supabase
      .from('bookings')
      .select('*, user:users(name, email)')
      .eq('year', year)
      .order('week_number')

    const ids = (bookingData || []).map((b) => b.id)
    let readingMap = {}
    if (ids.length) {
      const { data: readingData } = await supabase
        .from('electricity_readings')
        .select('id, booking_id, start_kwh, end_kwh, cost, electricity_paid, electricity_paid_at')
        .in('booking_id', ids)
      for (const r of readingData || []) readingMap[r.booking_id] = r
    }
    setAllBookings((bookingData || []).map((b) => ({ ...b, electricity: readingMap[b.id] || null })))
  }

  async function toggleDepositPaid(booking) {
    const newPaid = !booking.deposit_paid
    const newPaidAt = newPaid ? new Date().toISOString() : null
    await supabase
      .from('bookings')
      .update({ deposit_paid: newPaid, deposit_paid_at: newPaidAt })
      .eq('id', booking.id)
    setAllBookings((prev) => prev.map((b) =>
      b.id === booking.id ? { ...b, deposit_paid: newPaid, deposit_paid_at: newPaidAt } : b
    ))
    logAdminAction('booking.toggle_deposit_paid', {
      table: 'bookings',
      id: booking.id,
      details: {
        user_id: booking.user_id,
        year: booking.year,
        week_number: booking.week_number,
        before: { deposit_paid: booking.deposit_paid },
        after: { deposit_paid: newPaid },
      },
    })
  }

  async function saveElectricity(booking) {
    const startNum = Number(elDraft.start)
    const endNum = elDraft.end === '' ? null : Number(elDraft.end)
    if (isNaN(startNum) || elDraft.start === '') return
    const { data, error } = await supabase
      .from('electricity_readings')
      .update({ start_kwh: startNum, end_kwh: endNum })
      .eq('id', booking.electricity.id)
      .select('id, booking_id, start_kwh, end_kwh, cost, electricity_paid, electricity_paid_at')
      .single()
    if (error) return
    setAllBookings((prev) => prev.map((b) => b.id === booking.id ? { ...b, electricity: data } : b))
    setMemberBookings((prev) => prev.map((b) => b.id === booking.id ? { ...b, electricity: data } : b))
    setEditingElId(null)
    logAdminAction('booking.edit_electricity', {
      table: 'electricity_readings',
      id: booking.electricity.id,
      details: {
        user_id: booking.user_id,
        year: booking.year,
        week_number: booking.week_number,
        before: { start_kwh: booking.electricity.start_kwh, end_kwh: booking.electricity.end_kwh },
        after: { start_kwh: startNum, end_kwh: endNum },
      },
    })
  }

  async function toggleElectricityPaid(booking) {
    const r = booking.electricity
    const newPaid = !r.electricity_paid
    const newPaidAt = newPaid ? new Date().toISOString() : null
    await supabase
      .from('electricity_readings')
      .update({ electricity_paid: newPaid, electricity_paid_at: newPaidAt })
      .eq('id', r.id)
    const updated = { ...r, electricity_paid: newPaid, electricity_paid_at: newPaidAt }
    setAllBookings((prev) => prev.map((b) => b.id === booking.id ? { ...b, electricity: updated } : b))
    setMemberBookings((prev) => prev.map((b) => b.id === booking.id ? { ...b, electricity: updated } : b))
    logAdminAction('booking.toggle_electricity_paid', {
      table: 'electricity_readings',
      id: r.id,
      details: {
        user_id: booking.user_id,
        year: booking.year,
        week_number: booking.week_number,
        before: { electricity_paid: r.electricity_paid },
        after: { electricity_paid: newPaid },
      },
    })
  }

  async function toggleFinalPaid(booking) {
    const newPaid = !booking.final_paid
    const newPaidAt = newPaid ? new Date().toISOString() : null
    await supabase
      .from('bookings')
      .update({ final_paid: newPaid, final_paid_at: newPaidAt })
      .eq('id', booking.id)
    setAllBookings((prev) => prev.map((b) =>
      b.id === booking.id ? { ...b, final_paid: newPaid, final_paid_at: newPaidAt } : b
    ))
    logAdminAction('booking.toggle_final_paid', {
      table: 'bookings',
      id: booking.id,
      details: {
        user_id: booking.user_id,
        year: booking.year,
        week_number: booking.week_number,
        before: { final_paid: booking.final_paid },
        after: { final_paid: newPaid },
      },
    })
  }

  async function fetchPendingUsers() {
    // delete_member anonymiserar (email → deleted-<uuid>@deleted.local) men raden
    // ligger kvar för att bevara bokningshistorik. Filtrera bort dem från admin-listorna
    // så de inte dyker upp som "väntar på godkännande" igen.
    const isDeleted = (u) => u.email?.endsWith('@deleted.local')

    const { data, error } = await supabase.rpc('get_admin_users_with_auth')
    if (error) {
      console.error(error)
      // Fallback om migrationen inte är körd än
      const [{ data: pending }, { data: all }] = await Promise.all([
        supabase.from('users').select('*').eq('approved', false).order('created_at', { ascending: true }),
        supabase.from('users').select('*').eq('approved', true).order('name'),
      ])
      setPendingUsers((pending || []).filter((u) => !isDeleted(u)))
      setAllUsers((all || []).filter((u) => !isDeleted(u)))
      return
    }
    const rows = (data || []).filter((u) => !isDeleted(u))
    setPendingUsers(rows.filter((u) => !u.approved).sort((a, b) => new Date(a.created_at) - new Date(b.created_at)))
    setAllUsers(rows.filter((u) => u.approved).sort((a, b) => {
      if (a.role !== b.role) return a.role === 'admin' ? -1 : 1
      return a.name.localeCompare(b.name, 'sv')
    }))
  }

  function formatLastSignIn(ts) {
    if (!ts) return 'Aldrig inloggad'
    const date = new Date(ts)
    const diffMs = Date.now() - date.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return 'just nu'
    if (diffMin < 60) return `${diffMin} min sedan`
    const diffHours = Math.floor(diffMin / 60)
    if (diffHours < 24) return `${diffHours} h sedan`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays === 1) return 'i går'
    if (diffDays < 30) return `${diffDays} dagar sedan`
    const diffMonths = Math.floor(diffDays / 30)
    if (diffMonths < 12) return `${diffMonths} mån sedan`
    return date.toLocaleDateString('sv-SE')
  }

  async function approveUser(userId) {
    setApprovingId(userId)
    await supabase.from('users').update({ approved: true }).eq('id', userId)
    logAdminAction('user.approve', { table: 'users', id: userId })
    fetchPendingUsers()
    setApprovingId(null)
  }

  function rejectUser(user) {
    setConfirmDialog({
      title: `Avvisa ${user.name}?`,
      body: 'Kontot raderas permanent och kan inte återskapas.',
      confirmLabel: 'Avvisa',
      danger: true,
      onConfirm: async () => {
        setApprovingId(user.id)
        await supabase.from('users').delete().eq('id', user.id)
        logAdminAction('user.reject', {
          table: 'users',
          id: user.id,
          details: { name: user.name, email: user.email },
        })
        setPendingUsers((prev) => prev.filter((u) => u.id !== user.id))
        setApprovingId(null)
        setConfirmDialog(null)
      },
    })
  }

  async function toggleAdmin(userId, currentRole) {
    const newRole = currentRole === 'admin' ? 'member' : 'admin'
    await supabase.from('users').update({ role: newRole }).eq('id', userId)
    setAllUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: newRole } : u))
    logAdminAction('user.toggle_admin', {
      table: 'users',
      id: userId,
      details: { before: { role: currentRole }, after: { role: newRole } },
    })
  }

  function deleteMember(user) {
    if (user.id === profile?.id) return
    setConfirmDialog({
      title: `Ta bort ${user.name}?`,
      body: 'Kontot anonymiseras (kan inte logga in mer). Bokningar och historik bevaras men visas som "Borttagen medlem".',
      confirmLabel: 'Ta bort',
      danger: true,
      onConfirm: async () => {
        setApprovingId(user.id)
        const { error } = await supabase.rpc('delete_member', { target_user_id: user.id })
        if (error) {
          alert('Kunde inte ta bort medlemmen: ' + error.message)
        } else {
          logAdminAction('user.delete', {
            table: 'users',
            id: user.id,
            details: { name: user.name, email: user.email },
          })
          await fetchPendingUsers()
        }
        setApprovingId(null)
        setConfirmDialog(null)
      },
    })
  }

  function exportMembersCSV() {
    const headers = ['Namn', 'E-post', 'Telefon', 'Roll']
    const rows = allUsers.map((u) => [u.name, u.email, u.phone || '', u.role])
    downloadCsv(`medlemmar-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows)
  }

  async function showMemberBookings(user) {
    setSelectedMember(user)
    setEditForm(null)
    setEditError(null)
    const { data } = await supabase
      .from('bookings')
      .select('*')
      .eq('user_id', user.id)
      .order('year', { ascending: false })
      .order('week_number', { ascending: false })

    const ids = (data || []).map((b) => b.id)
    let readingMap = {}
    if (ids.length) {
      const { data: readingData } = await supabase
        .from('electricity_readings')
        .select('id, booking_id, start_kwh, end_kwh, cost, electricity_paid, electricity_paid_at')
        .in('booking_id', ids)
      for (const r of readingData || []) readingMap[r.booking_id] = r
    }
    setMemberBookings((data || []).map((b) => ({ ...b, electricity: readingMap[b.id] || null })))
  }

  function startEditMember() {
    if (!selectedMember) return
    setEditForm({
      name: selectedMember.name || '',
      email: selectedMember.email || '',
      phone: selectedMember.phone || '',
    })
    setEditError(null)
  }

  async function saveMemberEdit() {
    if (!selectedMember || !editForm) return
    setSavingEdit(true)
    setEditError(null)
    const payload = { userId: selectedMember.id }
    const before = {}
    const after = {}
    if (editForm.name !== selectedMember.name) {
      payload.name = editForm.name; before.name = selectedMember.name; after.name = editForm.name
    }
    if (editForm.email !== selectedMember.email) {
      payload.email = editForm.email; before.email = selectedMember.email; after.email = editForm.email
    }
    if ((editForm.phone || '') !== (selectedMember.phone || '')) {
      payload.phone = editForm.phone; before.phone = selectedMember.phone || null; after.phone = editForm.phone || null
    }
    if (Object.keys(payload).length === 1) {
      setEditForm(null)
      setSavingEdit(false)
      return
    }
    const { data, error } = await supabase.functions.invoke('admin-update-user', { body: payload })
    if (error || data?.error) {
      setEditError(data?.error || error.message)
      setSavingEdit(false)
      return
    }
    const updated = { ...selectedMember, ...payload }
    delete updated.userId
    setSelectedMember(updated)
    setAllUsers((prev) => prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)))
    logAdminAction('user.edit', {
      table: 'users',
      id: selectedMember.id,
      details: { before, after },
    })
    setEditForm(null)
    setSavingEdit(false)
  }

  async function fetchLegacyBookings() {
    const { data } = await supabase
      .from('legacy_bookings')
      .select('*')
      .eq('year', year)
      .order('week_number')
    setLegacyBookings(data || [])
  }

  async function saveLegacyBooking() {
    if (!legacyForm?.booked_by_name || !legacyForm?.week_number) return
    setSavingLegacy(true)
    if (legacyForm.id) {
      await supabase.from('legacy_bookings').update({
        week_number: Number(legacyForm.week_number),
        booked_by_name: legacyForm.booked_by_name,
        reserve_name: legacyForm.reserve_name || null,
        type: legacyForm.type,
        price: legacyForm.price ? Number(legacyForm.price) : null,
        paid: legacyForm.paid || null,
        notes: legacyForm.notes || null,
      }).eq('id', legacyForm.id)
    } else {
      await supabase.from('legacy_bookings').insert({
        year,
        week_number: Number(legacyForm.week_number),
        booked_by_name: legacyForm.booked_by_name,
        reserve_name: legacyForm.reserve_name || null,
        type: legacyForm.type || 'booking',
        price: legacyForm.price ? Number(legacyForm.price) : null,
        paid: legacyForm.paid || null,
        notes: legacyForm.notes || null,
      })
    }
    setLegacyForm(null)
    setSavingLegacy(false)
    fetchLegacyBookings()
  }

  async function deleteLegacyBooking(id) {
    await supabase.from('legacy_bookings').delete().eq('id', id)
    setLegacyBookings((prev) => prev.filter((b) => b.id !== id))
  }

  async function resendLotteryEmails() {
    setResending(true)
    setResentCount(null)
    const { data } = await supabase
      .from('lottery_applications')
      .select('*')
      .eq('year', year)
      .in('status', ['won', 'reserve'])

    let sent = 0
    const errors = []
    for (const app of (data || [])) {
      const { data: result, error } = await supabase.functions.invoke('send-email', {
        body: {
          type: 'lottery_result',
          userId: app.user_id,
          weekNumber: app.week_number,
          year,
          extra: { won: app.status === 'won', reserveRank: app.reserve_rank ?? undefined },
        },
      })
      if (error || result?.error) {
        errors.push(`V${app.week_number} (${app.status}): ${error?.message || result?.error}`)
      } else {
        sent++
      }
    }

    if (errors.length > 0) console.error('Resend errors:', errors)
    setResentCount({ sent, errors })
    setResending(false)
  }

  async function generateDraft() {
    setGenerating(true)
    const results = {}

    for (const w of lotteryWeeks) {
      const { data: apps } = await supabase
        .from('lottery_applications')
        .select('*, user:users(name, email)')
        .eq('year', year)
        .eq('week_number', w.week_number)
        .eq('status', 'pending')

      if (apps && apps.length > 0) {
        const shuffled = [...apps]
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
        }
        results[w.week_number] = shuffled
      }
    }

    setDraftResults(results)
    setGenerating(false)
  }

  function handleDragEnd(weekNum) {
    return (event) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      setDraftResults((prev) => {
        const apps = prev[weekNum]
        const oldIndex = apps.findIndex((a) => a.id === active.id)
        const newIndex = apps.findIndex((a) => a.id === over.id)
        return { ...prev, [weekNum]: arrayMove(apps, oldIndex, newIndex) }
      })
    }
  }

  async function publishResults() {
    if (!draftResults) return
    setPublishing(true)

    const auditSummary = {}
    for (const [weekNum, apps] of Object.entries(draftResults)) {
      const wn = Number(weekNum)
      if (apps.length === 0) continue

      const winner = apps[0]
      auditSummary[wn] = {
        winner_id: winner.user_id,
        reserves: apps.slice(1).map((a, i) => ({ rank: i + 1, user_id: a.user_id })),
      }
      await supabase.from('lottery_applications').update({ status: 'won' }).eq('id', winner.id)

      for (let i = 1; i < apps.length; i++) {
        await supabase.from('lottery_applications').update({ status: 'reserve', reserve_rank: i }).eq('id', apps[i].id)
      }

      await supabase.from('weeks').upsert(
        { year, week_number: wn, status: 'booked', booked_by_user_id: winner.user_id, price: getSeasonPrice(wn).price },
        { onConflict: 'year,week_number' }
      )

      await supabase.from('bookings').insert({
        user_id: winner.user_id, year, week_number: wn, price: getSeasonPrice(wn).price, status: 'confirmed',
      })

      supabase.functions.invoke('send-email', {
        body: { type: 'lottery_result', userId: winner.user_id, weekNumber: wn, year, extra: { won: true } },
      }).catch(console.error)
      for (let i = 1; i < apps.length; i++) {
        supabase.functions.invoke('send-email', {
          body: { type: 'lottery_result', userId: apps[i].user_id, weekNumber: wn, year, extra: { won: false, reserveRank: i } },
        }).catch(console.error)
      }
    }

    for (const w of lotteryWeeks) {
      if (!draftResults[w.week_number] || draftResults[w.week_number].length === 0) {
        await supabase.from('weeks').upsert(
          { year, week_number: w.week_number, status: 'available', price: getSeasonPrice(w.week_number).price },
          { onConflict: 'year,week_number' }
        )
      }
    }

    logAdminAction('lottery.publish', {
      table: 'lottery_applications',
      id: String(year),
      details: { year, weeks: auditSummary },
    })

    setDraftResults(null)
    setPublishing(false)
    fetchData()
  }

  const weekStatuses = {}
  for (const w of weeks) { weekStatuses[w.week_number] = w }

  const filteredUsers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase()
    if (!q) return allUsers
    return allUsers.filter((u) =>
      [u.name, u.email, u.phone].filter(Boolean).some((v) => v.toLowerCase().includes(q))
    )
  }, [allUsers, memberSearch])

  const unpaidDeposits = allBookings.filter((b) => !b.deposit_paid && b.status === 'confirmed')
  const unpaidFinals = allBookings.filter((b) => !b.final_paid && b.status === 'confirmed')
  const finalRemaining = (b) => Math.max(0, (b.price || 0) - (b.deposit_amount || PAYMENT.depositAmount))

  const refundsPending = allBookings.filter(
    (b) => b.status === 'cancelled' && b.deposit_paid && b.deposit_refundable === true
  )

  const finalRefundsPending = allBookings.filter(
    (b) => b.status === 'cancelled' && b.final_paid && b.final_refundable === true && finalRemaining(b) > 0
  )

  const filteredIssues = useMemo(() => {
    if (issueFilter === 'all') return issues
    return issues.filter((i) => i.status === issueFilter)
  }, [issues, issueFilter])

  async function markRefunded(booking) {
    await supabase
      .from('bookings')
      .update({ deposit_refundable: false, deposit_paid: false })
      .eq('id', booking.id)
    setAllBookings((prev) => prev.map((b) =>
      b.id === booking.id ? { ...b, deposit_refundable: false, deposit_paid: false } : b
    ))
    logAdminAction('booking.mark_refunded', {
      table: 'bookings',
      id: booking.id,
      details: {
        user_id: booking.user_id,
        year: booking.year,
        week_number: booking.week_number,
      },
    })
  }

  async function markFinalRefunded(booking) {
    await supabase
      .from('bookings')
      .update({ final_refundable: false, final_paid: false })
      .eq('id', booking.id)
    setAllBookings((prev) => prev.map((b) =>
      b.id === booking.id ? { ...b, final_refundable: false, final_paid: false } : b
    ))
    logAdminAction('booking.mark_final_refunded', {
      table: 'bookings',
      id: booking.id,
      details: {
        user_id: booking.user_id,
        year: booking.year,
        week_number: booking.week_number,
      },
    })
  }

  const [exportingBackup, setExportingBackup] = useState(false)

  async function exportBookingsCsv() {
    const { data } = await supabase
      .from('bookings')
      .select('*, user:users(name, email)')
      .order('year', { ascending: false })
      .order('week_number')
    const { headers, rows } = bookingsToCsv(data || [])
    downloadCsv(`bik-bokningar-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows)
  }

  async function exportFullBackup() {
    setExportingBackup(true)
    const data = await fetchBackupData(supabase)
    downloadJson(`bik-backup-${new Date().toISOString().slice(0, 10)}.json`, data)
    setExportingBackup(false)
  }

  const yearStats = useMemo(() => {
    const confirmedBookings = allBookings.filter((b) => b.status === 'confirmed')
    const bookedCount = confirmedBookings.length
    const totalRevenue = confirmedBookings.reduce((sum, b) => sum + (b.price || 0), 0)
    const occupancy = totalWeeks > 0 ? Math.round((bookedCount / totalWeeks) * 100) : 0
    const bySeason = { 'Högsäsong': 0, 'Normalsäsong': 0, 'Lågsäsong': 0 }
    for (const b of confirmedBookings) {
      const label = getSeasonPrice(b.week_number).label
      bySeason[label] = (bySeason[label] || 0) + 1
    }
    const lotteryDemand = {}
    for (const a of lotteryApps) {
      lotteryDemand[a.week_number] = (lotteryDemand[a.week_number] || 0) + 1
    }
    const popularWeeks = Object.entries(lotteryDemand)
      .map(([w, c]) => ({ week: Number(w), count: c }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
    return { bookedCount, totalRevenue, occupancy, bySeason, popularWeeks, totalMembers: allUsers.length }
  }, [allBookings, lotteryApps, allUsers, totalWeeks])

  const dbAvailable = weeks.filter((w) => w.status === 'available').length
  const dbBooked = weeks.filter((w) => w.status === 'booked').length
  const dbLottery = weeks.filter((w) => w.status === 'lottery').length
  const untracked = totalWeeks - weeks.length // weeks without db row default to lottery
  const statusCounts = {
    available: dbAvailable,
    booked: dbBooked,
    lottery: dbLottery + untracked,
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Settings className="w-5 h-5 text-red-600" />
            Administration
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">Hantera veckor, lottning och bokningar</p>
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

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 border border-slate-200 rounded-lg p-1 flex-wrap">
        {[
          { key: 'payments', label: `Betalningar${unpaidDeposits.length ? ` (${unpaidDeposits.length})` : ''}` },
          { key: 'issues', label: `Felanmälningar${issues.filter((i) => i.status === 'open').length ? ` (${issues.filter((i) => i.status === 'open').length})` : ''}` },
          { key: 'lottery', label: 'Lottningsmotor' },
          { key: 'members', label: `Medlemmar${pendingUsers.length ? ` (${pendingUsers.length})` : ''}` },
          { key: 'stats', label: 'Statistik' },
          { key: 'history', label: 'Historik' },
          { key: 'audit', label: 'Logg' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" />{statusCounts.available} lediga</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" />{statusCounts.booked} bokade</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-purple-500" />{statusCounts.lottery} lottning</span>
      </div>


      {tab === 'payments' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <div className="text-xs text-emerald-700">Anm.avg betalda</div>
              <div className="text-lg font-bold text-emerald-700">
                {allBookings.filter((b) => b.deposit_paid && b.status === 'confirmed').length}
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="text-xs text-amber-700">Obetalda anm.avg</div>
              <div className="text-lg font-bold text-amber-700">
                {unpaidDeposits.length}
              </div>
              <div className="text-[11px] text-amber-600">
                {unpaidDeposits.reduce((sum, b) => sum + (b.deposit_amount || PAYMENT.depositAmount), 0)} kr
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div className="text-xs text-slate-500">Utestående slutbet.</div>
              <div className="text-lg font-bold text-slate-700">
                {unpaidFinals.reduce((sum, b) => sum + finalRemaining(b), 0).toLocaleString('sv-SE')} kr
              </div>
              <div className="text-[11px] text-slate-400">
                {unpaidFinals.filter((b) => finalRemaining(b) > 0).length} bokningar
              </div>
            </div>
          </div>

          {(refundsPending.length > 0 || finalRefundsPending.length > 0) && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
                <RotateCcw className="w-4 h-4" />
                Återbetalningar att hantera ({refundsPending.length + finalRefundsPending.length})
              </div>
              {refundsPending.map((b) => (
                <div key={`dep-${b.id}`} className="bg-white border border-blue-100 rounded-lg p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-700 truncate">
                      V{b.week_number} · {b.user?.name || 'Okänd'} · <span className="text-blue-700">anm.avg</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Avbokad {b.cancelled_at ? new Date(b.cancelled_at).toLocaleDateString('sv-SE') : ''} · {b.deposit_amount || PAYMENT.depositAmount} kr ska återbetalas
                    </div>
                  </div>
                  <button
                    onClick={() => markRefunded(b)}
                    className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-medium shrink-0"
                  >
                    Återbetalad
                  </button>
                </div>
              ))}
              {finalRefundsPending.map((b) => (
                <div key={`fin-${b.id}`} className="bg-white border border-blue-100 rounded-lg p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-700 truncate">
                      V{b.week_number} · {b.user?.name || 'Okänd'} · <span className="text-blue-700">slutbet.</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Avbokad {b.cancelled_at ? new Date(b.cancelled_at).toLocaleDateString('sv-SE') : ''} · {finalRemaining(b).toLocaleString('sv-SE')} kr ska återbetalas
                    </div>
                  </div>
                  <button
                    onClick={() => markFinalRefunded(b)}
                    className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-medium shrink-0"
                  >
                    Återbetalad
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Bokningar {year}</h2>
            {allBookings.length === 0 ? (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center text-slate-400 text-sm">
                Inga bokningar för {year}.
              </div>
            ) : (
              allBookings.filter((b) => b.status === 'confirmed').map((b) => {
                const dates = getWeekDateRange(b.year, b.week_number)
                const fullyPaid = b.deposit_paid && b.final_paid
                const remaining = finalRemaining(b)
                return (
                  <div
                    key={b.id}
                    className={`border rounded-lg px-3 py-2.5 ${
                      fullyPaid
                        ? 'bg-emerald-50/40 border-emerald-200'
                        : b.deposit_paid
                          ? 'bg-sky-50/40 border-sky-200'
                          : 'bg-amber-50/40 border-amber-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => navigate(`/?year=${b.year}&week=${b.week_number}`)}
                        title="Öppna bokningen i kalendern"
                        className="flex items-center gap-3 flex-1 min-w-0 text-left group"
                      >
                        <div className="text-xs font-bold text-slate-600 w-7 shrink-0 group-hover:text-red-600 transition-colors">V{b.week_number}</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-slate-700 truncate group-hover:text-red-600 transition-colors">
                            {b.user?.name || 'Okänd'}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">
                            {formatDateShort(dates.checkIn)} – {formatDateShort(dates.checkOut)} · {b.price} kr
                            {!b.final_paid && remaining > 0 && (
                              <span className="text-slate-500"> · kvar {remaining.toLocaleString('sv-SE')} kr</span>
                            )}
                            {!b.deposit_paid && b.deposit_reminder_count > 0 && (
                              <span className="text-amber-600"> · {b.deposit_reminder_count} påm. skickad{b.deposit_reminder_count > 1 ? 'e' : ''}</span>
                            )}
                          </div>
                        </div>
                      </button>
                      <div className="flex flex-col gap-1 shrink-0">
                        <button
                          onClick={() => toggleDepositPaid(b)}
                          title={b.deposit_paid ? 'Anmälningsavgift betald' : 'Markera anmälningsavgift som betald'}
                          className={`flex items-center justify-between gap-1.5 text-[11px] px-2.5 py-1 rounded-lg font-medium transition-colors min-w-[105px] ${
                            b.deposit_paid
                              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                              : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                          }`}
                        >
                          <span className="flex items-center gap-1">
                            {b.deposit_paid ? <CheckCircle2 className="w-3 h-3" /> : <CreditCard className="w-3 h-3" />}
                            Anm.avg
                          </span>
                          <span className="text-[10px] opacity-75">{b.deposit_amount || PAYMENT.depositAmount} kr</span>
                        </button>
                        <button
                          onClick={() => toggleFinalPaid(b)}
                          title={b.final_paid ? 'Slutbetalning klar' : 'Markera slutbetalning som klar'}
                          className={`flex items-center justify-between gap-1.5 text-[11px] px-2.5 py-1 rounded-lg font-medium transition-colors min-w-[105px] ${
                            b.final_paid
                              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          <span className="flex items-center gap-1">
                            {b.final_paid ? <CheckCircle2 className="w-3 h-3" /> : <CreditCard className="w-3 h-3" />}
                            Slutbet.
                          </span>
                          <span className="text-[10px] opacity-75">{remaining.toLocaleString('sv-SE')} kr</span>
                        </button>
                      </div>
                    </div>
                    {b.electricity && (
                      editingElId === b.id ? (
                        <div className="mt-2 bg-amber-50/80 border border-amber-200 rounded px-2 py-2 space-y-2">
                          <div className="flex items-center gap-1 text-[11px] font-medium text-amber-700">
                            <Zap className="w-3 h-3" /> Redigera elavläsning
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <input
                              type="number"
                              value={elDraft.start}
                              onChange={(e) => setElDraft((d) => ({ ...d, start: e.target.value }))}
                              placeholder="Start kWh"
                              className="w-24 bg-white border border-amber-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
                            />
                            <span className="text-[11px] text-slate-400">→</span>
                            <input
                              type="number"
                              value={elDraft.end}
                              onChange={(e) => setElDraft((d) => ({ ...d, end: e.target.value }))}
                              placeholder="Slut kWh"
                              className="w-28 bg-white border border-amber-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
                            />
                            <button onClick={() => saveElectricity(b)} className="text-[10px] bg-amber-500 hover:bg-amber-600 text-white font-medium px-2 py-1 rounded transition-colors">Spara</button>
                            <button onClick={() => setEditingElId(null)} className="text-[10px] text-slate-500 hover:text-slate-700 px-1 py-1">Avbryt</button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50/80 border border-amber-100 rounded px-2 py-1">
                          <Zap className="w-3 h-3 shrink-0" />
                          {b.electricity.end_kwh != null ? (
                            <>
                              <span className="flex-1">
                                El: {b.electricity.start_kwh}→{b.electricity.end_kwh} kWh ({Math.max(0, b.electricity.end_kwh - b.electricity.start_kwh)} kWh) ·{' '}
                                <strong>{Math.round(Number(b.electricity.cost || 0)).toLocaleString('sv-SE')} kr</strong>
                              </span>
                              <button
                                onClick={() => toggleElectricityPaid(b)}
                                className={`ml-1 shrink-0 flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded transition-colors ${
                                  b.electricity.electricity_paid
                                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                    : 'bg-amber-200 text-amber-800 hover:bg-amber-300'
                                }`}
                              >
                                {b.electricity.electricity_paid ? <><CheckCircle2 className="w-2.5 h-2.5" /> Betald</> : 'Markera betald'}
                              </button>
                            </>
                          ) : (
                            <span className="flex-1">El påbörjad: {b.electricity.start_kwh} kWh (slutavläsning saknas)</span>
                          )}
                          <button
                            onClick={() => { setEditingElId(b.id); setElDraft({ start: String(b.electricity.start_kwh), end: b.electricity.end_kwh != null ? String(b.electricity.end_kwh) : '' }) }}
                            className="ml-1 shrink-0 text-slate-400 hover:text-amber-600 transition-colors"
                            title="Redigera avläsning"
                          >
                            <Pencil className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      )
                    )}
                    {b.note && (
                      <div className="mt-2 flex items-start gap-1.5 text-[11px] text-slate-500 bg-white/60 rounded px-2 py-1">
                        <MessageSquare className="w-3 h-3 mt-0.5 shrink-0" />
                        <span className="whitespace-pre-wrap">{b.note}</span>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {tab === 'issues' && (
        <div className="space-y-4">
          <div className="flex gap-1 bg-slate-100 border border-slate-200 rounded-lg p-1">
            {[
              { key: 'open', label: 'Öppna' },
              { key: 'in_progress', label: 'Pågår' },
              { key: 'resolved', label: 'Lösta' },
              { key: 'all', label: 'Alla' },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setIssueFilter(f.key)}
                className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  issueFilter === f.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {filteredIssues.length === 0 ? (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 text-center text-slate-400 text-sm">
              Inga felanmälningar i denna kategori.
            </div>
          ) : (
            filteredIssues.map((issue) => (
              <div key={issue.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-slate-800">{issue.title}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {issue.user?.name} · {new Date(issue.created_at).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase shrink-0 ${
                    issue.status === 'open' ? 'bg-red-100 text-red-700' :
                    issue.status === 'in_progress' ? 'bg-amber-100 text-amber-700' :
                    'bg-emerald-100 text-emerald-700'
                  }`}>
                    {issue.status === 'open' ? 'Öppet' : issue.status === 'in_progress' ? 'Pågår' : 'Löst'}
                  </span>
                </div>

                <p className="text-sm text-slate-600 whitespace-pre-wrap bg-slate-50 rounded-lg p-3">{issue.description}</p>

                {issue.admin_response && (
                  <div className="bg-blue-50 border-l-2 border-blue-300 rounded px-3 py-2">
                    <div className="text-[10px] uppercase tracking-wide text-blue-500 font-semibold mb-0.5">Adminsvar</div>
                    <p className="text-xs text-slate-600 whitespace-pre-wrap">{issue.admin_response}</p>
                  </div>
                )}

                {issueResponse.id === issue.id && (
                  <textarea
                    value={issueResponse.text}
                    onChange={(e) => setIssueResponse({ id: issue.id, text: e.target.value })}
                    rows={2}
                    placeholder="Svar till medlemmen (valfritt)..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-none"
                  />
                )}

                {issue.status !== 'resolved' && (
                  <div className="flex flex-wrap gap-1.5">
                    {issue.status === 'open' && (
                      <button
                        onClick={() => updateIssueStatus(issue.id, 'in_progress')}
                        className="flex items-center gap-1 text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 px-2.5 py-1.5 rounded-lg font-medium"
                      >
                        <Hammer className="w-3 h-3" />
                        Påbörja
                      </button>
                    )}
                    {issueResponse.id === issue.id ? (
                      <>
                        <button
                          onClick={() => updateIssueStatus(issue.id, 'resolved', issueResponse.text)}
                          className="flex items-center gap-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded-lg font-medium"
                        >
                          <Check className="w-3 h-3" />
                          Markera löst
                        </button>
                        <button
                          onClick={() => setIssueResponse({ id: null, text: '' })}
                          className="text-xs text-slate-500 hover:text-slate-700 px-2.5 py-1.5"
                        >
                          Avbryt
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setIssueResponse({ id: issue.id, text: issue.admin_response || '' })}
                        className="flex items-center gap-1 text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-1.5 rounded-lg font-medium"
                      >
                        <Check className="w-3 h-3" />
                        Lös
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'lottery' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Skicka om lottningsmail till vinnare och reserver</span>
            <button
              onClick={resendLotteryEmails}
              disabled={resending}
              className="flex items-center gap-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {resending ? (
                <div className="w-3 h-3 border-2 border-slate-400/30 border-t-slate-500 rounded-full animate-spin" />
              ) : (
                <Send className="w-3 h-3" />
              )}
              {resending ? 'Skickar...' : 'Skicka om'}
            </button>
          </div>
          {resentCount !== null && (
            <div className="space-y-1.5">
              <div className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${
                resentCount.sent > 0 ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-slate-50 border border-slate-200 text-slate-500'
              }`}>
                <Check className="w-3.5 h-3.5" />
                {resentCount.sent === 0 && resentCount.errors.length === 0
                  ? 'Inga publicerade lottningsresultat hittades.'
                  : `${resentCount.sent} mail skickade.`}
              </div>
              {resentCount.errors.map((e, i) => (
                <div key={i} className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  {e}
                </div>
              ))}
            </div>
          )}
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-sm text-slate-600 space-y-2">
            <h3 className="font-medium text-purple-700">Lottningsperioder</h3>
            <ul className="text-xs text-slate-500 space-y-1 list-disc list-inside">
              <li><strong>Dec–Apr:</strong> Ansökan stänger 31 oktober</li>
              <li><strong>Maj–Nov:</strong> Ansökan stänger 30 april</li>
            </ul>
          </div>

          {lotteryWeeks.length === 0 ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center text-slate-400 text-sm">
              Inga veckor är markerade som lottning. Ändra veckostatus i Veckoöversikten.
            </div>
          ) : !draftResults ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-500">
                {lotteryWeeks.length} vecka(or) markerade för lottning. Generera ett utkast för att se och justera resultaten.
              </p>
              <button
                onClick={generateDraft}
                disabled={generating}
                className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium rounded-lg px-6 py-3 text-sm flex items-center justify-center gap-2 transition-colors"
              >
                {generating ? (
                  <Spinner />
                ) : (
                  <>
                    <Shuffle className="w-4 h-4" />
                    Generera lottningsutkast
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-center gap-2">
                  <Eye className="w-5 h-5 text-blue-500" />
                  <div>
                    <div className="text-sm font-medium text-slate-700">Preview-läge</div>
                    <div className="text-xs text-slate-400">Dra och släpp för att justera ordningen. Nr 1 = vinnare.</div>
                  </div>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => setDraftResults(null)}
                    className="flex-1 sm:flex-none bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-medium rounded-lg px-4 py-2.5 text-sm flex items-center justify-center gap-1 transition-colors"
                  >
                    <X className="w-4 h-4" />
                    Avbryt
                  </button>
                  <button
                    onClick={publishResults}
                    disabled={publishing}
                    className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium rounded-lg px-4 py-2.5 text-sm flex items-center justify-center gap-1 transition-colors"
                  >
                    {publishing ? (
                      <Spinner />
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Publicera & skicka mejl
                      </>
                    )}
                  </button>
                </div>
              </div>

              {Object.entries(draftResults).map(([weekNum, apps]) => {
                const wn = Number(weekNum)
                const dates = getWeekDateRange(year, wn)
                const season = getSeasonPrice(wn)

                return (
                  <div key={weekNum} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-slate-700">
                          Vecka {weekNum} — {formatDateShort(dates.checkIn)} – {formatDateShort(dates.checkOut)}
                        </div>
                        <div className="text-xs text-slate-400">{season.label} · {season.price} kr</div>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-slate-400">
                        <Users className="w-3.5 h-3.5" />
                        {apps.length} sökande
                      </div>
                    </div>

                    {apps.length === 0 ? (
                      <div className="p-4 text-sm text-slate-400 text-center">Inga sökande</div>
                    ) : (
                      <div className="p-3 space-y-2">
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd(wn)}>
                          <SortableContext items={apps.map((a) => a.id)} strategy={verticalListSortingStrategy}>
                            {apps.map((app, idx) => (
                              <SortableApplicant key={app.id} app={app} index={idx} isWinner={idx === 0} />
                            ))}
                          </SortableContext>
                        </DndContext>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'members' && (
        <div className="space-y-3">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                <MailCheck className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-slate-700">Förgodkända mejladresser</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Konton som registreras med en mejl i listan godkänns automatiskt.
                  Övriga hamnar som vanligt i kö för admin-godkännande.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-3">
              <label className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors">
                <Upload className="w-3.5 h-3.5 text-slate-500" />
                Importera CSV
                <input type="file" accept=".csv,.txt" onChange={handleAllowedCsvUpload} className="hidden" />
              </label>
              <div className="flex-1 flex items-center gap-2 min-w-[180px]">
                <input
                  type="email"
                  value={allowedEmailInput}
                  onChange={(e) => setAllowedEmailInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitManualAllowedEmail()}
                  placeholder="namn@exempel.se"
                  className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500"
                />
                <button
                  onClick={submitManualAllowedEmail}
                  disabled={allowedEmailBusy || !allowedEmailInput.trim()}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
                >
                  Lägg till
                </button>
              </div>
            </div>

            {allowedEmailMsg && (
              <div className={`text-xs rounded-lg px-3 py-2 mb-3 ${
                allowedEmailMsg.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                  : 'bg-red-50 border border-red-200 text-red-600'
              }`}>
                {allowedEmailMsg.text}
              </div>
            )}

            {allowedEmails.length === 0 ? (
              <div className="text-xs text-slate-400 text-center py-3 bg-slate-50 rounded-lg">
                Inga mejladresser i listan ännu.
              </div>
            ) : (
              <>
                <div className="text-[11px] text-slate-400 mb-1.5">
                  {allowedEmails.length} mejladress{allowedEmails.length === 1 ? '' : 'er'} i listan
                </div>
                <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                  {allowedEmails.map((row) => (
                    <div key={row.email} className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="text-xs text-slate-600 truncate flex-1">{row.email}</span>
                      <button
                        onClick={() => removeAllowedEmail(row.email)}
                        className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                        title="Ta bort"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide pt-2">Väntande godkännanden</h2>
          {pendingUsers.length === 0 ? (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center text-slate-400 text-xs">
              Inga väntande konton.
            </div>
          ) : (
            pendingUsers.map((u) => (
              <div key={u.id} className="bg-white border border-slate-200 rounded-lg px-3 py-2.5 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4 text-amber-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-700">{u.name}</div>
                  <div className="text-xs text-slate-400 truncate">{u.email}{u.phone ? ` · ${u.phone}` : ''}</div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() => rejectUser(u)}
                    disabled={approvingId === u.id}
                    className="w-8 h-8 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center text-red-500 hover:bg-red-100 transition-colors disabled:opacity-50"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => approveUser(u.id)}
                    disabled={approvingId === u.id}
                    className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}

          {/* All approved members */}
          <div className="flex items-center justify-between mt-6">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Alla medlemmar</h2>
            {allUsers.length > 0 && (
              <button
                onClick={exportMembersCSV}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Exportera CSV
              </button>
            )}
          </div>

          {allUsers.length > 0 && (
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Sök medlem (namn, e-post, telefon)..."
                className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500"
              />
            </div>
          )}

          {filteredUsers.length === 0 ? (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center text-slate-400 text-xs">
              {memberSearch ? `Inga träffar för "${memberSearch}".` : 'Inga godkända medlemmar ännu.'}
            </div>
          ) : (
            filteredUsers.map((u) => (
              <div key={u.id} className="bg-white border border-slate-200 rounded-lg px-3 py-2.5 flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  u.role === 'admin' ? 'bg-blue-50 border border-blue-200' : 'bg-slate-50 border border-slate-200'
                }`}>
                  {u.role === 'admin' ? (
                    <Shield className="w-4 h-4 text-blue-500" />
                  ) : (
                    <User className="w-4 h-4 text-slate-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => showMemberBookings(u)}>
                  <div className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                    {u.name}
                    {u.role === 'admin' && (
                      <span className="text-[10px] font-semibold bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">ADMIN</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 truncate">{u.email}{u.phone ? ` · ${u.phone}` : ''}</div>
                  <div className={`text-[10px] mt-0.5 ${u.last_sign_in_at ? 'text-slate-400' : 'text-amber-500'}`}>
                    {u.last_sign_in_at ? `Senast inloggad: ${formatLastSignIn(u.last_sign_in_at)}` : 'Aldrig inloggad'}
                  </div>
                </div>
                <button
                  onClick={() => toggleAdmin(u.id, u.role)}
                  className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors shrink-0 ${
                    u.role === 'admin'
                      ? 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      : 'bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100'
                  }`}
                >
                  {u.role === 'admin' ? 'Ta bort admin' : 'Gör admin'}
                </button>
                {u.id !== profile?.id && (
                  <button
                    onClick={() => deleteMember(u)}
                    disabled={approvingId === u.id}
                    title="Ta bort medlem (anonymisera)"
                    className="p-1.5 text-slate-400 hover:text-red-500 disabled:opacity-50 transition-colors shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'stats' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <StatCard label="Beläggning" value={`${yearStats.occupancy}%`} sub={`${yearStats.bookedCount} av ${totalWeeks} veckor`} icon={<TrendingUp className="w-4 h-4 text-emerald-500" />} />
            <StatCard label="Intäkter" value={`${yearStats.totalRevenue.toLocaleString('sv-SE')} kr`} sub="bokade veckor" icon={<CreditCard className="w-4 h-4 text-blue-500" />} />
            <StatCard label="Medlemmar" value={yearStats.totalMembers} sub="godkända" icon={<Users className="w-4 h-4 text-purple-500" />} />
            <StatCard label="Lottningsanmäl." value={lotteryApps.length} sub={`${year}`} icon={<BarChart3 className="w-4 h-4 text-amber-500" />} />
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Bokningar per säsong</h3>
            <div className="space-y-2">
              {Object.entries(yearStats.bySeason).map(([label, count]) => {
                const max = Math.max(1, ...Object.values(yearStats.bySeason))
                const pct = (count / max) * 100
                return (
                  <div key={label}>
                    <div className="flex justify-between text-xs text-slate-500 mb-0.5">
                      <span>{label}</span>
                      <span className="font-medium text-slate-700">{count}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-red-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Backup & export</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                onClick={exportBookingsCsv}
                className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-3 py-2.5 text-left transition-colors"
              >
                <Download className="w-4 h-4 text-slate-500 shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-700">Bokningar (Excel)</div>
                  <div className="text-[11px] text-slate-400">Alla bokningar som CSV</div>
                </div>
              </button>
              <button
                onClick={exportFullBackup}
                disabled={exportingBackup}
                className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-3 py-2.5 text-left transition-colors disabled:opacity-50"
              >
                {exportingBackup ? (
                  <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin shrink-0" />
                ) : (
                  <Download className="w-4 h-4 text-slate-500 shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-700">Komplett backup (JSON)</div>
                  <div className="text-[11px] text-slate-400">Alla tabeller — för säkerhetskopiering</div>
                </div>
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Populäraste lottningsveckor</h3>
            {yearStats.popularWeeks.length === 0 ? (
              <p className="text-sm text-slate-400">Inga lottningsanmälningar för {year}.</p>
            ) : (
              <div className="space-y-2">
                {yearStats.popularWeeks.map((w) => {
                  const dates = getWeekDateRange(year, w.week)
                  const max = yearStats.popularWeeks[0].count
                  const pct = (w.count / max) * 100
                  return (
                    <div key={w.week}>
                      <div className="flex justify-between text-xs text-slate-500 mb-0.5">
                        <span>V{w.week} · {formatDateShort(dates.checkIn)}</span>
                        <span className="font-medium text-slate-700">{w.count} anmälda</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Historiska bokningar {year}
            </h2>
            <button
              onClick={() => setLegacyForm({ type: 'booking', week_number: '', booked_by_name: '', reserve_name: '', price: '', paid: '', notes: '' })}
              className="flex items-center gap-1 text-xs bg-blue-50 text-blue-600 border border-blue-200 px-2.5 py-1.5 rounded-lg hover:bg-blue-100 transition-colors font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              Lägg till
            </button>
          </div>

          {legacyForm && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-sm">
              <h3 className="text-sm font-medium text-slate-700">{legacyForm.id ? 'Redigera bokning' : 'Ny bokning'}</h3>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Vecka</label>
                  <input
                    type="number" min="1" max="53"
                    value={legacyForm.week_number}
                    onChange={(e) => setLegacyForm((f) => ({ ...f, week_number: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="v.nr"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Typ</label>
                  <select
                    value={legacyForm.type}
                    onChange={(e) => setLegacyForm((f) => ({ ...f, type: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="booking">Bokning</option>
                    <option value="maintenance">Underhåll</option>
                    <option value="cancelled">Avbokad</option>
                    <option value="interest">Intresselista</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Bokad av</label>
                <input
                  type="text"
                  value={legacyForm.booked_by_name}
                  onChange={(e) => setLegacyForm((f) => ({ ...f, booked_by_name: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Namn"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Reserv / Extra namn</label>
                <input
                  type="text"
                  value={legacyForm.reserve_name || ''}
                  onChange={(e) => setLegacyForm((f) => ({ ...f, reserve_name: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Valfritt"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Pris (kr)</label>
                  <input
                    type="number"
                    value={legacyForm.price || ''}
                    onChange={(e) => setLegacyForm((f) => ({ ...f, price: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="t.ex. 1750"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Betalt</label>
                  <input
                    type="text"
                    value={legacyForm.paid || ''}
                    onChange={(e) => setLegacyForm((f) => ({ ...f, paid: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="t.ex. 500+1250"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Anteckning</label>
                <input
                  type="text"
                  value={legacyForm.notes || ''}
                  onChange={(e) => setLegacyForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Valfritt"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setLegacyForm(null)}
                  className="flex-1 border border-slate-200 text-slate-500 rounded-lg py-2 text-sm hover:bg-slate-50 transition-colors"
                >
                  Avbryt
                </button>
                <button
                  onClick={saveLegacyBooking}
                  disabled={savingLegacy || !legacyForm.booked_by_name || !legacyForm.week_number}
                  className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {savingLegacy ? 'Sparar...' : 'Spara'}
                </button>
              </div>
            </div>
          )}

          {legacyBookings.length === 0 ? (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 text-center text-slate-400 text-sm">
              Inga historiska bokningar för {year}.
            </div>
          ) : (
            <div className="space-y-1.5">
              {legacyBookings.map((b) => {
                const typeConfig = {
                  booking:     { bg: 'bg-white',       border: 'border-slate-200', icon: <CalendarDays className="w-3.5 h-3.5 text-blue-500" />,    label: null },
                  maintenance: { bg: 'bg-amber-50/60', border: 'border-amber-200', icon: <Wrench className="w-3.5 h-3.5 text-amber-500" />,         label: 'Underhåll' },
                  cancelled:   { bg: 'bg-slate-50',    border: 'border-slate-200', icon: <X className="w-3.5 h-3.5 text-slate-400" />,              label: 'Avbokad' },
                  interest:    { bg: 'bg-purple-50/60',border: 'border-purple-200',icon: <Star className="w-3.5 h-3.5 text-purple-500" />,          label: 'Intresse' },
                }[b.type] || { bg: 'bg-white', border: 'border-slate-200', icon: null, label: null }

                return (
                  <div key={b.id} className={`border rounded-lg px-3 py-2 flex items-center gap-2.5 ${typeConfig.bg} ${typeConfig.border}`}>
                    <div className="text-xs font-bold text-slate-500 w-7 shrink-0">V{b.week_number}</div>
                    {typeConfig.icon}
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium truncate ${b.type === 'cancelled' ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                        {b.booked_by_name}
                        {b.reserve_name && <span className="text-slate-400 font-normal"> / {b.reserve_name}</span>}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {[typeConfig.label, b.price ? `${b.price} kr` : null, b.paid ? `betalt: ${b.paid}` : null, b.notes].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => setLegacyForm({ ...b })}
                        className="text-[10px] px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded transition-colors"
                      >
                        Redigera
                      </button>
                      <button
                        onClick={() => deleteLegacyBooking(b.id)}
                        className="p-1 hover:bg-red-50 text-slate-300 hover:text-red-400 rounded transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'audit' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Senaste admin-åtgärder
            </h2>
            <button
              onClick={fetchAuditLog}
              disabled={auditLoading}
              className="flex items-center gap-1 text-xs bg-slate-100 text-slate-600 border border-slate-200 px-2.5 py-1.5 rounded-lg hover:bg-slate-200 disabled:opacity-50 transition-colors font-medium"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${auditLoading ? 'animate-spin' : ''}`} />
              Uppdatera
            </button>
          </div>

          {auditLoading && auditLog.length === 0 ? (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 text-center text-slate-400 text-sm">
              Hämtar logg…
            </div>
          ) : auditLog.length === 0 ? (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 text-center text-slate-400 text-sm">
              Ingen logg ännu — händelser dyker upp här när admins gör ändringar.
            </div>
          ) : (
            <div className="space-y-1.5">
              {auditLog.map((row) => {
                const meta = AUDIT_LABELS[row.action] || { label: row.action, tone: 'slate' }
                const ts = new Date(row.created_at)
                const isExpanded = expandedAuditId === row.id
                const summary = renderAuditSummary(row)
                const toneClass = AUDIT_TONE[meta.tone] || AUDIT_TONE.slate

                return (
                  <div key={row.id} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedAuditId(isExpanded ? null : row.id)}
                      className="w-full text-left px-3 py-2.5 hover:bg-slate-50 transition-colors flex items-start gap-3"
                    >
                      <div className="text-[11px] text-slate-400 w-24 shrink-0 pt-0.5 font-mono">
                        {ts.toLocaleString('sv-SE', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${toneClass}`}>
                            {meta.label}
                          </span>
                          <span className="text-sm text-slate-700 truncate">{summary}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          av {row.admin?.name || 'okänd admin'}
                        </div>
                      </div>
                      {row.details && (
                        <ChevronRight className={`w-4 h-4 text-slate-300 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      )}
                    </button>
                    {isExpanded && row.details && (
                      <pre className="bg-slate-50 border-t border-slate-200 px-3 py-2 text-[11px] text-slate-600 overflow-x-auto">
                        {JSON.stringify(row.details, null, 2)}
                      </pre>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Member booking history modal */}
      {selectedMember && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-sm px-4 pb-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-md p-5 space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                  <CalendarDays className="w-5 h-5 text-slate-500" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">{selectedMember.name}</h3>
                  <p className="text-xs text-slate-400">{selectedMember.email}{selectedMember.phone ? ` · ${selectedMember.phone}` : ''}</p>
                </div>
              </div>
              <button onClick={() => { setSelectedMember(null); setEditForm(null) }} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Edit section */}
            {editForm ? (
              <div className="border border-slate-200 rounded-lg p-3 space-y-3 bg-slate-50">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Redigera medlem</h4>
                  <button
                    onClick={() => { setEditForm(null); setEditError(null) }}
                    className="text-xs text-slate-400 hover:text-slate-600"
                  >
                    Avbryt
                  </button>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Namn</label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-lg pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">E-post</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-lg pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500"
                    />
                  </div>
                  <p className="text-[10px] text-amber-600 mt-1">
                    Ändras både i auth (inloggning) och medlemsregistret. Ingen bekräftelse skickas.
                  </p>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Telefon</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="tel"
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-lg pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500"
                    />
                  </div>
                </div>
                {editError && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">{editError}</p>
                )}
                <button
                  onClick={saveMemberEdit}
                  disabled={savingEdit}
                  className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium rounded-lg px-4 py-2 text-sm flex items-center justify-center gap-2 transition-colors"
                >
                  {savingEdit ? (
                    <Spinner />
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Spara
                    </>
                  )}
                </button>
              </div>
            ) : (
              <button
                onClick={startEditMember}
                className="w-full flex items-center justify-center gap-2 text-xs text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
                Redigera medlemsinfo
              </button>
            )}

            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Bokningshistorik</h4>
            {memberBookings.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">Inga bokningar</p>
            ) : (
              <div className="space-y-2">
                {memberBookings.map((b) => {
                  const dates = getWeekDateRange(b.year, b.week_number)
                  return (
                    <div key={b.id} className={`border rounded-lg px-3 py-2 space-y-1 ${
                      b.status === 'confirmed' ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 bg-slate-50'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-slate-700">V{b.week_number}, {b.year}</div>
                          <div className="text-xs text-slate-400">{formatDateShort(dates.checkIn)} – {formatDateShort(dates.checkOut)}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium text-slate-600">{b.price} kr</div>
                          <div className={`text-xs ${b.status === 'confirmed' ? 'text-emerald-600' : 'text-slate-400'}`}>
                            {b.status === 'confirmed' ? 'Bekräftad' : b.status === 'cancelled' ? 'Avbokad' : b.status}
                          </div>
                        </div>
                      </div>
                      {b.electricity && (
                        editingElId === b.id ? (
                          <div className="bg-amber-50 border border-amber-200 rounded px-2 py-2 space-y-2">
                            <div className="flex items-center gap-1 text-[11px] font-medium text-amber-700">
                              <Zap className="w-3 h-3" /> Redigera elavläsning
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <input
                                type="number"
                                value={elDraft.start}
                                onChange={(e) => setElDraft((d) => ({ ...d, start: e.target.value }))}
                                placeholder="Start kWh"
                                className="w-24 bg-white border border-amber-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
                              />
                              <span className="text-[11px] text-slate-400">→</span>
                              <input
                                type="number"
                                value={elDraft.end}
                                onChange={(e) => setElDraft((d) => ({ ...d, end: e.target.value }))}
                                placeholder="Slut kWh"
                                className="w-28 bg-white border border-amber-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
                              />
                              <button onClick={() => saveElectricity(b)} className="text-[10px] bg-amber-500 hover:bg-amber-600 text-white font-medium px-2 py-1 rounded transition-colors">Spara</button>
                              <button onClick={() => setEditingElId(null)} className="text-[10px] text-slate-500 hover:text-slate-700 px-1 py-1">Avbryt</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded px-2 py-1">
                            <Zap className="w-3 h-3 shrink-0" />
                            {b.electricity.end_kwh != null ? (
                              <>
                                <span className="flex-1">
                                  El: {b.electricity.start_kwh}→{b.electricity.end_kwh} kWh ·{' '}
                                  <strong>{Math.round(Number(b.electricity.cost || 0)).toLocaleString('sv-SE')} kr</strong>
                                </span>
                                <button
                                  onClick={() => toggleElectricityPaid(b)}
                                  className={`ml-1 shrink-0 flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded transition-colors ${
                                    b.electricity.electricity_paid
                                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                      : 'bg-amber-200 text-amber-800 hover:bg-amber-300'
                                  }`}
                                >
                                  {b.electricity.electricity_paid ? <><CheckCircle2 className="w-2.5 h-2.5" /> Betald</> : 'Markera betald'}
                                </button>
                              </>
                            ) : (
                              <span className="flex-1">El påbörjad: {b.electricity.start_kwh} kWh</span>
                            )}
                            <button
                              onClick={() => { setEditingElId(b.id); setElDraft({ start: String(b.electricity.start_kwh), end: b.electricity.end_kwh != null ? String(b.electricity.end_kwh) : '' }) }}
                              className="ml-1 shrink-0 text-slate-400 hover:text-amber-600 transition-colors"
                              title="Redigera avläsning"
                            >
                              <Pencil className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        )
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmation dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-sm px-4 pb-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-sm p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${confirmDialog.danger ? 'bg-red-50' : 'bg-amber-50'}`}>
                <AlertTriangle className={`w-5 h-5 ${confirmDialog.danger ? 'text-red-500' : 'text-amber-500'}`} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800">{confirmDialog.title}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{confirmDialog.body}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDialog(null)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium rounded-lg px-4 py-2.5 text-sm transition-colors"
              >
                Avbryt
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className={`flex-1 text-white font-medium rounded-lg px-4 py-2.5 text-sm transition-colors ${
                  confirmDialog.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                {confirmDialog.confirmLabel || 'Bekräfta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, sub, icon }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
      <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
        {icon}
        {label}
      </div>
      <div className="text-lg font-bold text-slate-800">{value}</div>
      {sub && <div className="text-[10px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
  )
}
