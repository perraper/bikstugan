import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/useAuth'
import { Home, Lock, ArrowRight, CheckCircle2 } from 'lucide-react'
import Spinner from '../components/Spinner'

export default function ResetPasswordPage() {
  const { clearPasswordRecovery } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('Lösenordet måste vara minst 6 tecken.')
      return
    }
    if (password !== confirm) {
      setError('Lösenorden stämmer inte överens.')
      return
    }

    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setDone(true)
    clearPasswordRecovery()
    setTimeout(() => navigate('/', { replace: true }), 1500)
  }

  const inputClass =
    'w-full bg-white border border-slate-300 rounded-lg px-4 py-3 pl-11 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500 transition-all'

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-red-50 rounded-2xl mb-3">
            <Home className="w-7 h-7 text-red-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-800">BIK-stugan</h1>
          <p className="text-slate-400 text-sm mt-1">Sätt nytt lösenord</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          {done ? (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-50 rounded-2xl mb-3">
                <CheckCircle2 className="w-7 h-7 text-emerald-500" />
              </div>
              <h2 className="text-lg font-semibold text-slate-800 mb-1">Lösenord uppdaterat!</h2>
              <p className="text-sm text-slate-500">Loggar in dig…</p>
            </div>
          ) : (
            <>
              <h2 className="text-base font-semibold text-slate-800 mb-1">Välj ett nytt lösenord</h2>
              <p className="text-xs text-slate-400 mb-4">Minst 6 tecken.</p>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3 mb-4">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="relative">
                  <Lock className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    placeholder="Nytt lösenord"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    autoFocus
                    className={inputClass}
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    placeholder="Bekräfta lösenord"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    minLength={6}
                    className={inputClass}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium rounded-lg px-4 py-3 text-sm flex items-center justify-center gap-2 transition-colors"
                >
                  {loading ? (
                    <Spinner />
                  ) : (
                    <>
                      Spara nytt lösenord
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
