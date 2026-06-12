import { useMemo, useState } from 'react'
import { useAdmin } from '../../context/AdminContext'
import { getSeasonPrice, getWeekDateRange, formatDateShort } from '../../lib/weeks'
import { Download, TrendingUp, CreditCard, Users, BarChart3 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { downloadCsv, downloadJson, fetchBackupData, bookingsToCsv } from '../../lib/backup'

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

export default function StatistikPage() {
  const { year, allBookings, lotteryApps, allUsers, weeks, totalWeeks } = useAdmin()
  const [exportingBackup, setExportingBackup] = useState(false)

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

  async function exportBookingsCsv() {
    const { data } = await supabase.from('bookings').select('*, user:users(name, email)').order('year', { ascending: false }).order('week_number')
    const { headers, rows } = bookingsToCsv(data || [])
    downloadCsv(`bik-bokningar-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows)
  }

  async function exportFullBackup() {
    setExportingBackup(true)
    const data = await fetchBackupData(supabase)
    downloadJson(`bik-backup-${new Date().toISOString().slice(0, 10)}.json`, data)
    setExportingBackup(false)
  }

  return (
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
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Backup &amp; export</h3>
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
  )
}
