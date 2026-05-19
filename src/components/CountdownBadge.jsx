import { useMemo } from 'react'

// Visar dagar kvar till incheckning. useMemo gör att Date.now() inte
// anropas direkt i render (bryter React 19s purity-regel).
//
// Returnerar null för avslutade bokningar.
export default function CountdownBadge({ checkIn, checkOut }) {
  const state = useMemo(() => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const inDay = new Date(checkIn); inDay.setHours(0, 0, 0, 0)
    const outDay = new Date(checkOut); outDay.setHours(0, 0, 0, 0)

    if (now >= outDay) return null
    if (now >= inDay) return { label: 'Pågår nu', tone: 'amber' }

    const days = Math.round((inDay.getTime() - now.getTime()) / 86400000)
    if (days === 0) return { label: 'Idag!', tone: 'emerald' }
    if (days === 1) return { label: 'I morgon', tone: 'emerald' }
    if (days <= 14) return { label: `Om ${days} dagar`, tone: 'emerald' }
    return { label: `Om ${days} dagar`, tone: 'slate' }
  }, [checkIn, checkOut])

  if (!state) return null

  const tones = {
    emerald: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-700',
    slate: 'bg-slate-100 text-slate-600',
  }

  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${tones[state.tone]}`}>
      {state.label}
    </span>
  )
}
