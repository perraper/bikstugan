import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Home, Mail, Lock, User, Phone, ArrowRight, Clock } from 'lucide-react'

export default function LoginPage() {
  const { signIn, signUp } = useAuth()
  const [isRegister, setIsRegister] = useState(false)
  const [isForgot, setIsForgot] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [registered, setRegistered] = useState(false)
  const [autoApproved, setAutoApproved] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [form, setForm] = useState({
    email: '',
    password: '',
    name: '',
    phone: '',
  })

  function update(field) {
    return (e) => setForm({ ...form, [field]: e.target.value })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (isRegister) {
      const { error, autoApproved: approved } = await signUp(form)
      if (error) setError(error.message)
      else {
        setAutoApproved(!!approved)
        setRegistered(true)
      }
    } else {
      const { error } = await signIn({ email: form.email, password: form.password })
      if (error) setError(error.message)
    }

    setLoading(false)
  }

  async function handleForgotPassword(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(form.email, {
      redirectTo: window.location.origin + '/reset-password',
    })
    if (error) setError(error.message)
    else setResetSent(true)
    setLoading(false)
  }

  const inputClass =
    'w-full bg-white border border-slate-300 rounded-lg px-4 py-3 pl-11 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500 transition-all'

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-red-50 rounded-2xl mb-3">
            <Home className="w-7 h-7 text-red-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-800">BIK-stugan</h1>
          <p className="text-slate-400 text-sm mt-1">Bokningssystem</p>
        </div>

        {/* Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          {registered ? (
            <div className="text-center py-4">
              <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3 ${autoApproved ? 'bg-emerald-50' : 'bg-blue-50'}`}>
                {autoApproved
                  ? <ArrowRight className="w-7 h-7 text-emerald-500" />
                  : <Clock className="w-7 h-7 text-blue-500" />}
              </div>
              <h2 className="text-lg font-semibold text-slate-800 mb-2">Konto skapat!</h2>
              <p className="text-sm text-slate-500">
                {autoApproved
                  ? 'Din mejladress fanns på medlemslistan — du kan logga in direkt.'
                  : 'Ditt konto väntar på godkännande av en admin. Du får tillgång så snart det är godkänt.'}
              </p>
              <button
                onClick={() => { setRegistered(false); setAutoApproved(false); setIsRegister(false) }}
                className="mt-4 text-sm text-red-600 hover:text-red-700 transition-colors"
              >
                Tillbaka till inloggning
              </button>
            </div>
          ) : resetSent ? (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-50 rounded-2xl mb-3">
                <Mail className="w-7 h-7 text-emerald-500" />
              </div>
              <h2 className="text-lg font-semibold text-slate-800 mb-2">Mejl skickat!</h2>
              <p className="text-sm text-slate-500">
                Kolla din inkorg för en länk att återställa ditt lösenord.
              </p>
              <button
                onClick={() => { setResetSent(false); setIsForgot(false) }}
                className="mt-4 text-sm text-red-600 hover:text-red-700 transition-colors"
              >
                Tillbaka till inloggning
              </button>
            </div>
          ) : isForgot ? (
            <>
              <h2 className="text-base font-semibold text-slate-800 mb-4">Återställ lösenord</h2>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3 mb-4">
                  {error}
                </div>
              )}

              <form onSubmit={handleForgotPassword} className="space-y-3">
                <div className="relative">
                  <Mail className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                  <input type="email" placeholder="E-post" value={form.email} onChange={update('email')} required className={inputClass} />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium rounded-lg px-4 py-3 text-sm flex items-center justify-center gap-2 transition-colors"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      Skicka återställningslänk
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-4 text-center">
                <button
                  onClick={() => { setIsForgot(false); setError('') }}
                  className="text-sm text-slate-400 hover:text-red-600 transition-colors"
                >
                  Tillbaka till inloggning
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-base font-semibold text-slate-800 mb-4">
                {isRegister ? 'Skapa konto' : 'Logga in'}
              </h2>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3 mb-4">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3">
                {isRegister && (
                  <>
                    <div className="relative">
                      <User className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                      <input type="text" placeholder="Namn" value={form.name} onChange={update('name')} required className={inputClass} />
                    </div>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                      <input type="tel" placeholder="Telefon" value={form.phone} onChange={update('phone')} required className={inputClass} />
                    </div>
                  </>
                )}

                <div className="relative">
                  <Mail className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                  <input type="email" placeholder="E-post" value={form.email} onChange={update('email')} required className={inputClass} />
                </div>

                <div className="relative">
                  <Lock className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                  <input type="password" placeholder="Lösenord" value={form.password} onChange={update('password')} required minLength={6} className={inputClass} />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium rounded-lg px-4 py-3 text-sm flex items-center justify-center gap-2 transition-colors"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      {isRegister ? 'Skapa konto' : 'Logga in'}
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-4 text-center space-y-2">
                {!isRegister && (
                  <button
                    onClick={() => { setIsForgot(true); setError('') }}
                    className="block w-full text-sm text-slate-400 hover:text-red-600 transition-colors"
                  >
                    Glömt lösenord?
                  </button>
                )}
                <button
                  onClick={() => { setIsRegister(!isRegister); setError('') }}
                  className="block w-full text-sm text-slate-400 hover:text-red-600 transition-colors"
                >
                  {isRegister ? 'Har du redan konto? Logga in' : 'Inget konto? Skapa ett'}
                </button>
              </div>
            </>
          )}
        </div>

        <div className="mt-4 text-center text-xs text-slate-400 space-y-0.5">
          <p>6 sängplatser · Självhushåll · Ingen WiFi</p>
          <p>In lördag 12:00 · Ut lördag 12:00</p>
        </div>
      </div>
    </div>
  )
}
