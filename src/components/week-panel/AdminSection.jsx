import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { PAYMENT } from '../../lib/config'
import {
  Shield, Wrench, Trash2, Check, RotateCcw, Send, Zap,
} from 'lucide-react'

function LegacyBlock({
  label, icon: Icon, accent, addLabel, placeholder,
  existingName, busy, formOpen, setFormOpen,
  name, setName, note, setNote, onSave, onRemove,
}) {
  const accentClasses = accent === 'amber'
    ? { btn: 'bg-amber-500 hover:bg-amber-600 text-white', addBtn: 'text-amber-700 hover:text-amber-900' }
    : { btn: 'bg-slate-700 hover:bg-slate-800 text-white', addBtn: 'text-slate-500 hover:text-slate-700' }

  return (
    <div className="space-y-1.5 border-b border-slate-100 pb-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-slate-400 uppercase tracking-wide">
          {Icon && <Icon className="w-3 h-3" />}
          {label}
        </div>
        {!formOpen && !existingName && (
          <button
            onClick={() => setFormOpen(true)}
            className={`text-[11px] font-medium ${accentClasses.addBtn}`}
          >
            + {addLabel}
          </button>
        )}
      </div>
      {existingName && !formOpen && (
        <div className="flex items-center justify-between gap-2 bg-slate-50 rounded px-2 py-1">
          <span className="text-xs text-slate-600 truncate">{existingName}</span>
          <button
            disabled={busy}
            onClick={onRemove}
            className="text-[11px] text-slate-400 hover:text-red-500 transition-colors shrink-0 flex items-center gap-1"
            title="Ta bort"
          >
            <Trash2 className="w-3 h-3" />
            Ta bort
          </button>
        </div>
      )}
      {formOpen && (
        <div className="space-y-1.5">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={placeholder}
            autoFocus
            className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Anteckning (valfritt)"
            className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
          <div className="flex gap-1.5">
            <button
              onClick={() => { setName(''); setNote(''); setFormOpen(false) }}
              className="text-[11px] text-slate-500 hover:text-slate-700 px-2 py-1"
            >
              Avbryt
            </button>
            <button
              disabled={busy || !name.trim()}
              onClick={onSave}
              className={`flex-1 text-[11px] disabled:opacity-50 px-2 py-1 rounded ${accentClasses.btn}`}
            >
              Spara
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminSection({ open, setOpen, reserves, booking, week, year, activeOffer, onAfterAction }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [electricity, setElectricity] = useState(null)

  // Två separata formulär — ett för underhåll, ett för manuell bokning
  const [maintenanceName, setMaintenanceName] = useState('')
  const [maintenanceNote, setMaintenanceNote] = useState('')
  const [maintenanceFormOpen, setMaintenanceFormOpen] = useState(false)

  const [manualName, setManualName] = useState('')
  const [manualNote, setManualNote] = useState('')
  const [manualFormOpen, setManualFormOpen] = useState(false)

  // Hämta el-avläsning när bokning finns
  useEffect(() => {
    let isMounted = true
    if (!booking?.id) {
      return () => { isMounted = false }
    }
    supabase
      .from('electricity_readings')
      .select('id, booking_id, start_kwh, end_kwh, cost, electricity_paid, electricity_paid_at')
      .eq('booking_id', booking.id)
      .maybeSingle()
      .then(({ data }) => {
        if (isMounted) setElectricity(data || null)
      })
    return () => {
      isMounted = false
      setElectricity(null)
    }
  }, [booking?.id])

  const hasRealBooking = !!booking
  const existingMaintenance = week.isMaintenance ? week.legacyName : null
  const existingManual = (week.isLegacy && !week.isMaintenance) ? week.legacyName : null

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

  async function saveLegacy(type, name, note, resetForm) {
    if (!name.trim()) return
    setBusy(true); setErr('')
    const { error } = await supabase.from('legacy_bookings').insert({
      year,
      week_number: week.week_number,
      booked_by_name: name.trim(),
      type,
      notes: note.trim() || null,
    })
    if (error) {
      setErr(error.message)
    } else {
      if (type === 'booking' && week.status !== 'booked') {
        await supabase.from('weeks').upsert(
          { year, week_number: week.week_number, status: 'booked', price: week.price || 2000 },
          { onConflict: 'year,week_number' }
        )
      }
      resetForm()
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

  async function sendFinalReminder() {
    if (!booking) return
    setBusy(true); setErr('')
    try {
      const remaining = Math.max(0, (booking.price || 0) - (booking.deposit_amount || PAYMENT.depositAmount))
      await supabase.functions.invoke('send-email', {
        body: {
          type: 'final_reminder',
          userId: booking.user_id,
          weekNumber: week.week_number,
          year,
          extra: { reminderCount: (booking.final_reminder_count || 0) + 1, remaining },
        },
      })
      await supabase.from('bookings').update({
        final_reminder_count: (booking.final_reminder_count || 0) + 1,
        final_reminder_last_at: new Date().toISOString(),
      }).eq('id', booking.id)
      await onAfterAction()
    } catch (e) {
      setErr(e.message)
    }
    setBusy(false)
  }

  async function markFinalPaid() {
    if (!booking) return
    setBusy(true); setErr('')
    const newPaid = !booking.final_paid
    const { error } = await supabase
      .from('bookings')
      .update({ final_paid: newPaid, final_paid_at: newPaid ? new Date().toISOString() : null })
      .eq('id', booking.id)
    if (error) setErr(error.message)
    else await onAfterAction()
    setBusy(false)
  }

  async function toggleElectricityPaid() {
    if (!electricity) return
    setBusy(true); setErr('')
    const newPaid = !electricity.electricity_paid
    const { error } = await supabase
      .from('electricity_readings')
      .update({ electricity_paid: newPaid, electricity_paid_at: newPaid ? new Date().toISOString() : null })
      .eq('id', electricity.id)
    if (error) setErr(error.message)
    else setElectricity({ ...electricity, electricity_paid: newPaid })
    setBusy(false)
  }

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <span className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
          <Shield className="w-3.5 h-3.5 text-red-500" /> Adminåtgärder
        </span>
        <span className="text-slate-400">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div className="divide-y divide-slate-100">
          {err && (
            <div className="px-4 py-2 text-xs text-red-600 bg-red-50 border-b border-red-100">{err}</div>
          )}

          {/* Status */}
          <div className="px-4 py-3 space-y-2">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Veckans status</div>
            <div className="flex gap-2">
              {[
                { key: 'available', label: 'Ledig',    active: 'bg-emerald-500 text-white shadow-sm', idle: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
                { key: 'lottery',   label: 'Lottning', active: 'bg-purple-500 text-white shadow-sm',  idle: 'bg-purple-50 text-purple-700 border border-purple-200' },
                { key: 'booked',    label: 'Bokad',    active: 'bg-red-500 text-white shadow-sm',     idle: 'bg-red-50 text-red-700 border border-red-200' },
              ].map((s) => (
                <button
                  key={s.key}
                  disabled={busy}
                  onClick={() => setStatus(s.key)}
                  className={`flex-1 text-xs font-semibold rounded-lg py-2 transition-colors ${week.status === s.key ? s.active : s.idle}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            {week.status === 'booked' && !hasRealBooking && !existingManual && !existingMaintenance && (
              <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                Veckan är bokad men saknar bokare. Lägg till manuell bokning eller underhåll nedan.
              </div>
            )}
          </div>

          {/* Underhåll / renovering */}
          {!hasRealBooking && !existingManual && (
            <div className="px-4 py-3">
              <LegacyBlock
                label="Underhåll / renovering"
                icon={Wrench}
                accent="amber"
                addLabel="Markera för underhåll"
                placeholder="T.ex. Renovering kök, VVS"
                existingName={existingMaintenance}
                busy={busy}
                formOpen={maintenanceFormOpen}
                setFormOpen={setMaintenanceFormOpen}
                name={maintenanceName}
                setName={setMaintenanceName}
                note={maintenanceNote}
                setNote={setMaintenanceNote}
                onSave={() => saveLegacy('maintenance', maintenanceName, maintenanceNote, () => {
                  setMaintenanceName(''); setMaintenanceNote(''); setMaintenanceFormOpen(false)
                })}
                onRemove={removeLegacy}
              />
            </div>
          )}

          {/* Manuell bokning utan medlemskonto */}
          {!hasRealBooking && !existingMaintenance && (
            <div className="px-4 py-3">
              <LegacyBlock
                label="Manuell bokning (utan konto)"
                icon={null}
                accent="slate"
                addLabel="Lägg till bokning"
                placeholder="Namn på bokare (t.ex. Mälarn)"
                existingName={existingManual}
                busy={busy}
                formOpen={manualFormOpen}
                setFormOpen={setManualFormOpen}
                name={manualName}
                setName={setManualName}
                note={manualNote}
                setNote={setManualNote}
                onSave={() => saveLegacy('booking', manualName, manualNote, () => {
                  setManualName(''); setManualNote(''); setManualFormOpen(false)
                })}
                onRemove={removeLegacy}
              />
            </div>
          )}

          {/* Bokare + betalningar */}
          {booking && (
            <div className="px-4 py-3 space-y-3">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Bokare</div>

              {/* Kontaktkort */}
              <div className="bg-slate-50 rounded-xl p-3 space-y-1">
                <div className="text-sm font-semibold text-slate-800">{booking.user?.name}</div>
                <a href={`mailto:${booking.user?.email}`} className="text-xs text-blue-600 block truncate">{booking.user?.email}</a>
                {booking.user?.phone && (
                  <a href={`tel:${booking.user.phone}`} className="text-xs text-blue-600 block">{booking.user.phone}</a>
                )}
              </div>

              {booking.note && (
                <div className="text-[11px] text-slate-500 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 italic">
                  "{booking.note}"
                </div>
              )}

              {/* Betalningskort — anmälningsavgift */}
              <div className={`rounded-xl border p-3 space-y-2 ${booking.deposit_paid ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">Anmälningsavgift</span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${booking.deposit_paid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-200 text-amber-800'}`}>
                    {booking.deposit_paid ? '✓ Betald' : 'Obetald'} · {booking.deposit_amount || PAYMENT.depositAmount} kr
                  </span>
                </div>
                <div className="flex gap-2">
                  {booking.deposit_paid ? (
                    <button
                      disabled={busy}
                      onClick={markDepositUnpaid}
                      className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" /> Ångra
                    </button>
                  ) : (
                    <>
                      <button
                        disabled={busy}
                        onClick={markDepositPaid}
                        className="flex-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" /> Markera betald
                      </button>
                      <button
                        disabled={busy}
                        onClick={sendReminder}
                        className="flex-1 text-xs font-semibold bg-white border border-amber-300 hover:bg-amber-50 text-amber-800 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                        title={booking.deposit_reminder_count ? `${booking.deposit_reminder_count} påminnelser skickade` : 'Inga påminnelser skickade'}
                      >
                        <Send className="w-3.5 h-3.5" /> Påminn{booking.deposit_reminder_count > 0 ? ` (${booking.deposit_reminder_count})` : ''}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Betalningskort — slutbetalning */}
              {Math.max(0, (booking.price || 0) - (booking.deposit_amount || PAYMENT.depositAmount)) > 0 && (() => {
                const finalRemaining = Math.max(0, (booking.price || 0) - (booking.deposit_amount || PAYMENT.depositAmount))
                return (
                  <div className={`rounded-xl border p-3 space-y-2 ${booking.final_paid ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-700">Slutbetalning</span>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${booking.final_paid ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                        {booking.final_paid ? '✓ Betald' : `Obetald · ${finalRemaining.toLocaleString('sv-SE')} kr`}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      {booking.final_paid ? (
                        <button
                          disabled={busy}
                          onClick={markFinalPaid}
                          className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" /> Ångra
                        </button>
                      ) : (
                        <>
                          <button
                            disabled={busy}
                            onClick={markFinalPaid}
                            className="flex-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <Check className="w-3.5 h-3.5" /> Markera betald
                          </button>
                          <button
                            disabled={busy}
                            onClick={sendFinalReminder}
                            className="flex-1 text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                            title={booking.final_reminder_count ? `${booking.final_reminder_count} påminnelser skickade` : 'Inga påminnelser skickade'}
                          >
                            <Send className="w-3.5 h-3.5" /> Påminn{booking.final_reminder_count > 0 ? ` (${booking.final_reminder_count})` : ''}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })()}

              {/* Betalningskort — el */}
              {electricity && electricity.end_kwh != null && (
                <div className={`rounded-xl border p-3 space-y-2 ${electricity.electricity_paid ? 'bg-emerald-50 border-emerald-200' : 'bg-orange-50 border-orange-200'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-orange-500" /> El
                    </span>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${electricity.electricity_paid ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-200 text-orange-800'}`}>
                      {electricity.electricity_paid ? '✓ Betald' : `Obetald · ${Math.round(Number(electricity.cost || 0)).toLocaleString('sv-SE')} kr`}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {electricity.start_kwh} → {electricity.end_kwh} kWh ({Math.max(0, electricity.end_kwh - electricity.start_kwh)} kWh)
                  </div>
                  <div className="flex gap-2">
                    {electricity.electricity_paid ? (
                      <button
                        disabled={busy}
                        onClick={toggleElectricityPaid}
                        className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" /> Ångra
                      </button>
                    ) : (
                      <button
                        disabled={busy}
                        onClick={toggleElectricityPaid}
                        className="w-full text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" /> Markera betald
                      </button>
                    )}
                  </div>
                </div>
              )}
              {electricity && electricity.end_kwh == null && (
                <div className="rounded-xl border border-orange-200 bg-orange-50 p-3">
                  <span className="text-xs text-orange-700 flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5" /> El påbörjad: {electricity.start_kwh} kWh — slutavläsning saknas
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Reservlista */}
          <div className="px-4 py-3 space-y-2">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
              Reservlista {reserves.length > 0 && <span className="ml-1 bg-slate-200 text-slate-600 rounded-full px-1.5 py-0.5 text-[10px]">{reserves.length}</span>}
            </div>
            {reserves.length === 0 ? (
              <div className="text-xs text-slate-400">Inga reserver</div>
            ) : (
              <ul className="space-y-1.5">
                {reserves.map((r) => (
                  <li key={r.id} className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                    <span className="text-xs text-slate-700">
                      <span className="text-slate-400 font-mono mr-1">#{r.reserve_rank}</span>
                      {r.user?.name}
                    </span>
                    <button
                      disabled={busy}
                      onClick={() => removeReserve(r.id)}
                      className="text-slate-300 hover:text-red-500 transition-colors p-1"
                      title="Ta bort"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {activeOffer && (
            <div className="px-4 py-3">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                <span className="font-semibold">Erbjudande pågår</span> till {activeOffer.user?.name} · deadline{' '}
                {new Date(activeOffer.deadline).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
