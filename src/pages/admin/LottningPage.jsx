import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAdmin } from '../../context/AdminContext'
import { getSeasonPrice, getWeekDateRange, formatDateShort } from '../../lib/weeks'
import {
  Shuffle, Eye, Send, Users, AlertTriangle, Check, X,
  Trophy, GripVertical,
} from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Spinner from '../../components/Spinner'

function SortableApplicant({ app, index, isWinner }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: app.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 rounded-lg border ${
        isWinner ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'
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

export default function LottningPage() {
  const { year, weeks, fetchData } = useAdmin()
  const [draftResults, setDraftResults] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [resending, setResending] = useState(false)
  const [resentCount, setResentCount] = useState(null)

  const lotteryWeeks = weeks.filter((w) => w.status === 'lottery')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  )

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
        body: { type: 'lottery_result', userId: app.user_id, weekNumber: app.week_number, year, extra: { won: app.status === 'won', reserveRank: app.reserve_rank ?? undefined } },
      })
      if (error || result?.error) {
        errors.push(`V${app.week_number} (${app.status}): ${error?.message || result?.error}`)
      } else {
        sent++
      }
    }
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
      auditSummary[wn] = { winner_id: winner.user_id, reserves: apps.slice(1).map((a, i) => ({ rank: i + 1, user_id: a.user_id })) }
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
      supabase.functions.invoke('send-email', { body: { type: 'lottery_result', userId: winner.user_id, weekNumber: wn, year, extra: { won: true } } }).catch(console.error)
      for (let i = 1; i < apps.length; i++) {
        supabase.functions.invoke('send-email', { body: { type: 'lottery_result', userId: apps[i].user_id, weekNumber: wn, year, extra: { won: false, reserveRank: i } } }).catch(console.error)
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
    setDraftResults(null)
    setPublishing(false)
    fetchData()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">Skicka om lottningsmail till vinnare och reserver</span>
        <button
          onClick={resendLotteryEmails}
          disabled={resending}
          className="flex items-center gap-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          {resending ? <div className="w-3 h-3 border-2 border-slate-400/30 border-t-slate-500 rounded-full animate-spin" /> : <Send className="w-3 h-3" />}
          {resending ? 'Skickar...' : 'Skicka om'}
        </button>
      </div>

      {resentCount !== null && (
        <div className="space-y-1.5">
          <div className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${resentCount.sent > 0 ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-slate-50 border border-slate-200 text-slate-500'}`}>
            <Check className="w-3.5 h-3.5" />
            {resentCount.sent === 0 && resentCount.errors.length === 0 ? 'Inga publicerade lottningsresultat hittades.' : `${resentCount.sent} mail skickade.`}
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
            {generating ? <Spinner /> : <><Shuffle className="w-4 h-4" />Generera lottningsutkast</>}
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
                <X className="w-4 h-4" />Avbryt
              </button>
              <button
                onClick={publishResults}
                disabled={publishing}
                className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium rounded-lg px-4 py-2.5 text-sm flex items-center justify-center gap-1 transition-colors"
              >
                {publishing ? <Spinner /> : <><Send className="w-4 h-4" />Publicera &amp; skicka mejl</>}
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
  )
}
