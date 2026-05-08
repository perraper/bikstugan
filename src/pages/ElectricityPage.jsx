import { useState } from 'react'
import { Zap, Calculator, ArrowRight } from 'lucide-react'

const PRICE_PER_KWH = 2.5

export default function ElectricityPage() {
  const [startKwh, setStartKwh] = useState('')
  const [endKwh, setEndKwh] = useState('')

  const usage = endKwh && startKwh ? Math.max(0, Number(endKwh) - Number(startKwh)) : null
  const cost = usage !== null ? usage * PRICE_PER_KWH : null

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-500" />
          El-kalkylator
        </h1>
        <p className="text-slate-400 text-sm mt-0.5">
          Läs av elmätaren vid ankomst och avfärd för att beräkna elkostnaden.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-700">Instruktioner</span>
          </div>
          <ol className="text-sm text-slate-500 list-decimal list-inside space-y-1">
            <li>Läs av elmätaren vid incheckning (lördag 12:00)</li>
            <li>Läs av igen vid utcheckning (lördag 12:00)</li>
            <li>Mata in värdena nedan</li>
            <li>Swisha beloppet till föreningen</li>
          </ol>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm text-slate-500 mb-1">Start-kWh (vid ankomst)</label>
            <input
              type="number"
              value={startKwh}
              onChange={(e) => setStartKwh(e.target.value)}
              placeholder="t.ex. 12345"
              className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-lg text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-all"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-500 mb-1">Slut-kWh (vid avfärd)</label>
            <input
              type="number"
              value={endKwh}
              onChange={(e) => setEndKwh(e.target.value)}
              placeholder="t.ex. 12390"
              className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-lg text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-all"
            />
          </div>
        </div>

        {cost !== null && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center space-y-2">
            <div className="text-sm text-slate-500">
              Förbrukning: <span className="font-medium text-slate-700">{usage} kWh</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
              <span>{usage} kWh</span>
              <span>×</span>
              <span>{PRICE_PER_KWH.toFixed(2)} kr</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
            <div className="text-4xl font-bold text-amber-600">
              {cost.toFixed(0)} kr
            </div>
            <p className="text-xs text-slate-400">Swisha detta belopp till föreningen</p>
          </div>
        )}
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center gap-3">
        <Calculator className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <p className="text-xs text-slate-400">
          Elpriset är {PRICE_PER_KWH.toFixed(2)} kr/kWh. Beloppet avrundas till närmaste hel krona.
        </p>
      </div>
    </div>
  )
}
