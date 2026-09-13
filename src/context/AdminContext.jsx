import { createContext, useContext, useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { getWeeksForYear } from '../lib/weeks'
import { PAYMENT } from '../lib/config'
import { downloadCsv } from '../lib/backup'
import { logAdminAction } from '../lib/audit'
import { cancelBooking } from '../lib/booking-actions'

const AdminContext = createContext(null)

// eslint-disable-next-line react-refresh/only-export-components
export function useAdmin() {
  return useContext(AdminContext)
}

export function AdminProvider({ children }) {
  const { profile } = useAuth()
  const [year, setYear] = useState(new Date().getFullYear())
  const [weeks, setWeeks] = useState([])
  const [allBookings, setAllBookings] = useState([])
  const [lotteryApps, setLotteryApps] = useState([])
  const [pendingUsers, setPendingUsers] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [approvingId, setApprovingId] = useState(null)
  const [selectedMember, setSelectedMember] = useState(null)
  const [memberBookings, setMemberBookings] = useState([])
  const [editForm, setEditForm] = useState(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState(null)
  const [confirmDialog, setConfirmDialog] = useState(null)
  const [openIssuesCount, setOpenIssuesCount] = useState(0)

  const totalWeeks = getWeeksForYear(year)

  async function fetchOpenIssuesCount() {
    const { count } = await supabase
      .from('issues')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open')
    setOpenIssuesCount(count ?? 0)
  }

  async function fetchData() {
    const [weekRes, appRes, bookingRes] = await Promise.all([
      supabase
        .from('weeks')
        .select('*, booked_by:users(id, name, email, phone)')
        .eq('year', year)
        .order('week_number'),
      supabase
        .from('lottery_applications')
        .select('*, user:users(id, name, email, phone)')
        .eq('year', year)
        .order('week_number'),
      supabase
        .from('bookings')
        .select('*, user:users(id, name, email, phone)')
        .eq('year', year)
        .order('week_number'),
    ])

    const weekData = weekRes.data || []
    const appData = appRes.data || []
    const bookingData = bookingRes.data || []

    setWeeks(weekData)
    setLotteryApps(appData)

    const ids = bookingData.map((b) => b.id)
    let readingMap = {}
    if (ids.length) {
      const { data: readingData } = await supabase
        .from('electricity_readings')
        .select('booking_id, start_kwh, end_kwh, cost, electricity_paid, electricity_paid_at')
        .in('booking_id', ids)
      for (const r of readingData || []) readingMap[r.booking_id] = r
    }
    setAllBookings(bookingData.map((b) => ({ ...b, electricity: readingMap[b.id] || null })))
  }

  const isDeleted = (u) => u.email?.endsWith('@deleted.local')

  async function fetchPendingUsers() {
    const { data, error } = await supabase.rpc('get_admin_users_with_auth')
    if (error) {
      const [{ data: pending }, { data: all }] = await Promise.all([
        supabase.from('users').select('*').eq('approved', false).order('created_at', { ascending: true }),
        supabase.from('users').select('*').eq('approved', true).order('name'),
      ])
      setPendingUsers((pending || []).filter((u) => !isDeleted(u)))
      setAllUsers((all || []).filter((u) => !isDeleted(u)))
      return
    }
    const rows = (data || []).filter((u) => !isDeleted(u))
    setPendingUsers(
      rows.filter((u) => !u.approved).sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    )
    setAllUsers(
      rows.filter((u) => u.approved).sort((a, b) => {
        if (a.role !== b.role) return a.role === 'admin' ? -1 : 1
        return a.name.localeCompare(b.name, 'sv')
      })
    )
  }

  useEffect(() => {
    fetchData()
    fetchPendingUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year])

  useEffect(() => {
    fetchOpenIssuesCount()
    const channel = supabase
      .channel('admin-issues-count')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'issues' }, fetchOpenIssuesCount)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
     
  }, [])

  // fetch methods moved above

  function finalRemaining(b) {
    return Math.max(0, (b.price || 0) - (b.deposit_amount || PAYMENT.depositAmount))
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

  async function toggleDepositPaid(booking) {
    const newPaid = !booking.deposit_paid
    const newPaidAt = newPaid ? new Date().toISOString() : null
    const { error } = await supabase
      .from('bookings')
      .update({ deposit_paid: newPaid, deposit_paid_at: newPaidAt })
      .eq('id', booking.id)

    if (error) {
      alert('Kunde inte ändra betalstatus: ' + error.message)
      return
    }

    setAllBookings((prev) =>
      prev.map((b) => b.id === booking.id ? { ...b, deposit_paid: newPaid, deposit_paid_at: newPaidAt } : b)
    )
    logAdminAction('booking.toggle_deposit_paid', {
      table: 'bookings', id: booking.id,
      details: { user_id: booking.user_id, year: booking.year, week_number: booking.week_number, before: { deposit_paid: booking.deposit_paid }, after: { deposit_paid: newPaid } },
    })
  }

  async function toggleFinalPaid(booking) {
    const newPaid = !booking.final_paid
    const newPaidAt = newPaid ? new Date().toISOString() : null
    const { error } = await supabase
      .from('bookings')
      .update({ final_paid: newPaid, final_paid_at: newPaidAt })
      .eq('id', booking.id)

    if (error) {
      alert('Kunde inte ändra slutbetalning: ' + error.message)
      return
    }

    setAllBookings((prev) =>
      prev.map((b) => b.id === booking.id ? { ...b, final_paid: newPaid, final_paid_at: newPaidAt } : b)
    )
    logAdminAction('booking.toggle_final_paid', {
      table: 'bookings', id: booking.id,
      details: { user_id: booking.user_id, year: booking.year, week_number: booking.week_number, before: { final_paid: booking.final_paid }, after: { final_paid: newPaid } },
    })
  }

  async function approveUser(userId) {
    setApprovingId(userId)
    const { error } = await supabase.from('users').update({ approved: true }).eq('id', userId)
    if (error) {
      alert('Kunde inte godkänna användare: ' + error.message)
    } else {
      logAdminAction('user.approve', { table: 'users', id: userId })
      await fetchPendingUsers()
    }
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
        const { error } = await supabase.from('users').delete().eq('id', user.id)
        if (error) {
          alert('Kunde inte avvisa användare: ' + error.message)
        } else {
          logAdminAction('user.reject', { table: 'users', id: user.id, details: { name: user.name, email: user.email } })
          setPendingUsers((prev) => prev.filter((u) => u.id !== user.id))
        }
        setApprovingId(null)
        setConfirmDialog(null)
      },
    })
  }

  async function toggleAdmin(userId, currentRole) {
    const newRole = currentRole === 'admin' ? 'member' : 'admin'
    const { error } = await supabase.from('users').update({ role: newRole }).eq('id', userId)
    if (error) {
      alert('Kunde inte ändra administratörsroll: ' + error.message)
      return
    }
    setAllUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: newRole } : u))
    logAdminAction('user.toggle_admin', {
      table: 'users', id: userId,
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
          logAdminAction('user.delete', { table: 'users', id: user.id, details: { name: user.name, email: user.email } })
          await fetchPendingUsers()
        }
        setApprovingId(null)
        setConfirmDialog(null)
      },
    })
  }

  async function markRefunded(booking) {
    const { error } = await supabase.from('bookings').update({ deposit_refundable: false, deposit_paid: false }).eq('id', booking.id)
    if (error) {
      alert('Kunde inte markera återbetalning: ' + error.message)
      return
    }
    setAllBookings((prev) =>
      prev.map((b) => b.id === booking.id ? { ...b, deposit_refundable: false, deposit_paid: false } : b)
    )
    logAdminAction('booking.mark_refunded', {
      table: 'bookings', id: booking.id,
      details: { user_id: booking.user_id, year: booking.year, week_number: booking.week_number },
    })
  }

  async function markFinalRefunded(booking) {
    const { error } = await supabase.from('bookings').update({ final_refundable: false, final_paid: false }).eq('id', booking.id)
    if (error) {
      alert('Kunde inte markera slutlig återbetalning: ' + error.message)
      return
    }
    setAllBookings((prev) =>
      prev.map((b) => b.id === booking.id ? { ...b, final_refundable: false, final_paid: false } : b)
    )
    logAdminAction('booking.mark_final_refunded', {
      table: 'bookings', id: booking.id,
      details: { user_id: booking.user_id, year: booking.year, week_number: booking.week_number },
    })
  }

  function cancelBookingAdmin(booking) {
    setConfirmDialog({
      title: `Avboka vecka ${booking.week_number} för ${booking.user?.name || 'medlem'}?`,
      body: 'Mejl skickas till medlemmen. Om det finns reserver får den första i kön automatiskt ett erbjudande (48h).',
      confirmLabel: 'Ja, avboka',
      danger: true,
      onConfirm: async () => {
        try {
          await cancelBooking({ profile, booking })
          logAdminAction('booking.cancel', { table: 'bookings', id: booking.id, details: { user_id: booking.user_id, week_number: booking.week_number, year: booking.year } })
          await fetchData()
        } catch (err) {
          alert('Kunde inte avboka: ' + err.message)
        }
        setConfirmDialog(null)
      }
    })
  }

  async function sendReminder(booking) {
    try {
      await supabase.functions.invoke('send-email', {
        body: { type: 'deposit_reminder', userId: booking.user_id, weekNumber: booking.week_number, year: booking.year, extra: { reminderCount: (booking.deposit_reminder_count || 0) + 1 } }
      })
      await supabase.from('bookings').update({
        deposit_reminder_count: (booking.deposit_reminder_count || 0) + 1,
        deposit_reminder_last_at: new Date().toISOString()
      }).eq('id', booking.id)
      await fetchData()
    } catch (e) {
      alert('Kunde inte skicka påminnelse: ' + e.message)
    }
  }

  async function saveElectricity(bookingId, startKwh, endKwh) {
    const booking = allBookings.find((b) => b.id === bookingId)
    const userId = booking?.user_id || null
    if (!userId) {
      alert('Kunde inte spara el: ingen bokning/medlem hittades')
      return
    }
    const payload = { booking_id: bookingId, user_id: userId, start_kwh: startKwh, end_kwh: endKwh }
    const { error } = await supabase.from('electricity_readings').upsert(payload, { onConflict: 'booking_id' })
    if (error) alert('Kunde inte spara el: ' + error.message)
    else fetchData()
  }

  async function toggleElectricityPaid(booking) {
    if (!booking.electricity) return
    const newPaid = !booking.electricity.electricity_paid
    const newPaidAt = newPaid ? new Date().toISOString() : null

    const { error } = await supabase
      .from('electricity_readings')
      .update({ electricity_paid: newPaid, electricity_paid_at: newPaidAt })
      .eq('booking_id', booking.id)

    if (error) {
      alert('Kunde inte ändra el-betalning: ' + error.message)
      return
    }

    setAllBookings((prev) =>
      prev.map((b) =>
        b.id === booking.id
          ? {
              ...b,
              electricity: {
                ...b.electricity,
                electricity_paid: newPaid,
                electricity_paid_at: newPaidAt,
              },
            }
          : b
      )
    )

    logAdminAction('electricity.toggle_paid', {
      table: 'electricity_readings',
      id: booking.electricity.id,
      details: {
        booking_id: booking.id,
        user_id: booking.user_id,
        year: booking.year,
        week_number: booking.week_number,
        before: { electricity_paid: booking.electricity.electricity_paid },
        after: { electricity_paid: newPaid },
      },
    })
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
        .select('booking_id, start_kwh, end_kwh, cost, electricity_paid, electricity_paid_at')
        .in('booking_id', ids)
      for (const r of readingData || []) readingMap[r.booking_id] = r
    }
    setMemberBookings((data || []).map((b) => ({ ...b, electricity: readingMap[b.id] || null })))
  }

  function startEditMember() {
    if (!selectedMember) return
    setEditForm({ name: selectedMember.name || '', email: selectedMember.email || '', phone: selectedMember.phone || '' })
    setEditError(null)
  }

  async function saveMemberEdit() {
    if (!selectedMember || !editForm) return
    setSavingEdit(true)
    setEditError(null)
    const payload = { userId: selectedMember.id }
    const before = {}
    const after = {}
    if (editForm.name !== selectedMember.name) { payload.name = editForm.name; before.name = selectedMember.name; after.name = editForm.name }
    if (editForm.email !== selectedMember.email) { payload.email = editForm.email; before.email = selectedMember.email; after.email = editForm.email }
    if ((editForm.phone || '') !== (selectedMember.phone || '')) { payload.phone = editForm.phone; before.phone = selectedMember.phone || null; after.phone = editForm.phone || null }
    if (Object.keys(payload).length === 1) { setEditForm(null); setSavingEdit(false); return }
    const { data, error } = await supabase.functions.invoke('admin-update-user', { body: payload })
    if (error || data?.error) { setEditError(data?.error || error.message); setSavingEdit(false); return }
    const updated = { ...selectedMember, ...payload }
    delete updated.userId
    setSelectedMember(updated)
    setAllUsers((prev) => prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)))
    logAdminAction('user.edit', { table: 'users', id: selectedMember.id, details: { before, after } })
    setEditForm(null)
    setSavingEdit(false)
  }

  function exportMembersCSV() {
    const headers = ['Namn', 'E-post', 'Telefon', 'Roll']
    const rows = allUsers.map((u) => [u.name, u.email, u.phone || '', u.role])
    downloadCsv(`medlemmar-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows)
  }

  const contextValue = useMemo(() => ({
    year, setYear,
    weeks, totalWeeks,
    allBookings, setAllBookings,
    lotteryApps,
    pendingUsers, allUsers,
    approvingId,
    openIssuesCount,
    selectedMember, setSelectedMember,
    memberBookings,
    editForm, setEditForm,
    savingEdit, editError,
    confirmDialog, setConfirmDialog,
    finalRemaining, formatLastSignIn,
    fetchData, fetchPendingUsers,
    toggleDepositPaid, toggleFinalPaid,
    approveUser, rejectUser,
    toggleAdmin, deleteMember,
    markRefunded, markFinalRefunded,
    showMemberBookings, startEditMember, saveMemberEdit,
    exportMembersCSV,
    cancelBookingAdmin, sendReminder, saveElectricity, toggleElectricityPaid,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [
    year, weeks, totalWeeks, allBookings, lotteryApps,
    pendingUsers, allUsers, approvingId, openIssuesCount,
    selectedMember, memberBookings, editForm, savingEdit,
    editError, confirmDialog,
  ])

  return (
    <AdminContext.Provider value={contextValue}>
      {children}
    </AdminContext.Provider>
  )
}
