import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/useAuth'
import { User, Mail, Phone, Save, Check } from 'lucide-react'

export default function ProfilePage() {
  const { profile, signOut, refreshProfile } = useAuth()
  const [form, setForm] = useState({
    name: profile?.name || '',
    phone: profile?.phone || '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  function update(field) {
    return (e) => { setForm({ ...form, [field]: e.target.value }); setSaved(false) }
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('users').update({ name: form.name, phone: form.phone }).eq('id', profile.id)
    await refreshProfile()
    setSaved(true)
    setSaving(false)
  }

  const inputClass =
    'w-full bg-white border border-slate-300 rounded-lg px-4 py-2.5 pl-10 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500 transition-all'

  return (
    <div className="max-w-md mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <User className="w-5 h-5 text-red-600" />
          Min profil
        </h1>
      </div>

      <form onSubmit={handleSave} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1">E-post</label>
          <div className="relative">
            <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input type="email" value={profile?.email || ''} disabled className={`${inputClass} bg-slate-50 text-slate-400 cursor-not-allowed`} />
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">Namn</label>
          <div className="relative">
            <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input type="text" value={form.name} onChange={update('name')} required className={inputClass} />
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">Telefon</label>
          <div className="relative">
            <Phone className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input type="tel" value={form.phone} onChange={update('phone')} className={inputClass} />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium rounded-lg px-4 py-2.5 text-sm flex items-center justify-center gap-2 transition-colors"
        >
          {saving ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : saved ? (
            <>
              <Check className="w-4 h-4" />
              Sparat
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Spara ändringar
            </>
          )}
        </button>
      </form>

      <button
        onClick={signOut}
        className="w-full text-sm text-slate-400 hover:text-red-500 transition-colors py-2"
      >
        Logga ut
      </button>
    </div>
  )
}
