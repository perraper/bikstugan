import { useMemo } from 'react'
import { getWeekDateRange } from '../../lib/weeks'
import { History } from 'lucide-react'

export default function HistorySection({ open, setOpen, weekNumber, history }) {
  // Visa endast slutförda veckor — checkOut < idag. useMemo undviker att
  // Date.now() anropas i render (bryter React 19s purity-regel).
  const sorted = useMemo(() => {
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now()
    return [...history]
      .filter((row) => getWeekDateRange(row.year, weekNumber).checkOut.getTime() < now)
      .sort((a, b) => b.year - a.year)
  }, [history, weekNumber])

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
