import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { getSeasonPrice, getWeekDateRange, formatDateShort } from '../lib/weeks'
import { X, Ticket, AlertTriangle } from 'lucide-react'

export default function LotteryModal({ week, year, onClose }) {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState('')

  const season = getSeasonPrice(week.week_number)
  const dates = getWeekDateRange(year, week.week_number)

  async function handleApply() {
    setLoading(true)
    setError('')

    const { error: err } = await supabase.from('lottery_applications').insert({
      user_id: profile.id,
      year,
      week_number: week.week_number,
      status: 'pending',
    })

    if (err) {
      setError(err.message)
    } else {
      setConfirmed(true)
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-sm px-4 pb-4">
      <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-800">
            {confirmed ? 'Intresse anmält!' : 'Lottning – Vecka ' + week.week_number}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {confirmed ? (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-purple-50 rounded-2xl mb-3">
                <Ticket className="w-7 h-7 text-purple-600" />
              </div>
              <p className="text-slate-500 text-sm">
                Ditt intresse för vecka {week.week_number} är registrerat. Du meddelas via e-post efter lottningen.
              </p>
            </div>
          ) : (
            <>
              <div className="bg-purple-50 border border-purple-100 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <Ticket className="w-4 h-4 text-purple-600" />
                  <span className="text-sm font-medium text-purple-700">Lottning pågår</span>
                </div>
                <p className="text-sm text-slate-500">
                  Denna vecka ingår i lottningsperioden. Anmäl ditt intresse så deltar du i dragningen.
                </p>
              </div>

              <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Period</span>
                  <span className="text-slate-700">{formatDateShort(dates.checkIn)} – {formatDateShort(dates.checkOut)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Säsong</span>
                  <span className="text-slate-700">{season.label}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Pris</span>
                  <span className="text-slate-700 font-semibold">{season.price} kr</span>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <button
                onClick={handleApply}
                disabled={loading}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium rounded-lg px-4 py-3 text-sm flex items-center justify-center gap-2 transition-colors"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Ticket className="w-4 h-4" />
                    Anmäl intresse
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
