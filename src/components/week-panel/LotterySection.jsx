import { Ticket, CheckCircle2 } from 'lucide-react'
import Spinner from '../Spinner'

export default function LotterySection({ season, applied, loading, onApply, onWithdraw }) {
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
        <div className="space-y-2">
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-3 text-sm text-emerald-700">
            <CheckCircle2 className="w-4 h-4" />
            Du är anmäld till lottningen
          </div>
          <button
            onClick={onWithdraw}
            disabled={loading}
            className="w-full text-xs text-slate-500 hover:text-red-600 transition-colors py-1.5 flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
          >
            {loading ? <Spinner /> : 'Ta bort min intresseanmälan'}
          </button>
        </div>
      ) : (
        <button
          onClick={onApply}
          disabled={loading}
          className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium rounded-lg px-4 py-3 text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          {loading ? <Spinner /> : <><Ticket className="w-4 h-4" /> Anmäl intresse</>}
        </button>
      )}
    </>
  )
}
