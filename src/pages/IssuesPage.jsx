import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/useAuth'
import { Bug, Plus, Send, Check, Hammer, AlertTriangle, Camera, X, Image as ImageIcon } from 'lucide-react'
import Spinner from '../components/Spinner'

const STATUS_CONFIG = {
  open:        { bg: 'bg-red-50',     border: 'border-red-200',     text: 'text-red-700',     icon: AlertTriangle, label: 'Öppet' },
  in_progress: { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   icon: Hammer,        label: 'Pågår' },
  resolved:    { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', icon: Check,         label: 'Löst' },
}

export default function IssuesPage() {
  const { profile } = useAuth()
  const [issues, setIssues] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ title: '', description: '' })
  const [imageFile, setImageFile] = useState(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null)
  const [previewModal, setPreviewModal] = useState(null)

  const fetchIssues = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('issues')
      .select('*, user:users!user_id(name)')
      .order('created_at', { ascending: false })
    setIssues(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchIssues()
  }, [fetchIssues])

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
    }
  }, [imagePreviewUrl])

  function handleImageChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      alert('Bilden får vara max 5 MB.')
      return
    }
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
    setImageFile(file)
    setImagePreviewUrl(URL.createObjectURL(file))
  }

  function clearImage() {
    setImageFile(null)
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
    setImagePreviewUrl(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim() || !form.description.trim()) return
    setSubmitting(true)

    let imageUrl = null
    if (imageFile) {
      const ext = imageFile.name.split('.').pop() || 'jpg'
      const filePath = `${profile.id}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('issue-attachments')
        .upload(filePath, imageFile)

      if (uploadError) {
        console.error('Kunde inte ladda upp bild:', uploadError)
      } else {
        const { data } = supabase.storage
          .from('issue-attachments')
          .getPublicUrl(filePath)
        imageUrl = data?.publicUrl || null
      }
    }

    const { error } = await supabase.from('issues').insert({
      user_id: profile.id,
      title: form.title.trim().slice(0, 100),
      description: form.description.trim().slice(0, 1000),
      image_url: imageUrl,
    })

    if (!error) {
      supabase.functions.invoke('send-email', {
        body: {
          type: 'issue_created',
          userId: profile.id,
          extra: { title: form.title.trim(), description: form.description.trim() },
        },
      }).catch(console.error)

      clearImage()
      setForm({ title: '', description: '' })
      setShowForm(false)
      fetchIssues()
    }
    setSubmitting(false)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Bug className="w-5 h-5 text-red-600" />
            Felanmälan
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">Rapportera problem i stugan så åtgärdar admin</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Ny felanmälan
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Rubrik</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value.slice(0, 100) })}
              required
              placeholder="T.ex. Trasig kran i köket"
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500"
            />
            <div className="text-[10px] text-slate-400 text-right mt-0.5">{form.title.length}/100</div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Beskrivning</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value.slice(0, 1000) })}
              required
              rows={4}
              placeholder="Beskriv problemet så detaljerat som möjligt..."
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500 resize-none"
            />
            <div className="text-[10px] text-slate-400 text-right mt-0.5">{form.description.length}/1000</div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Foto (valfritt)</label>
            {imagePreviewUrl ? (
              <div className="relative inline-block mt-1">
                <img
                  src={imagePreviewUrl}
                  alt="Förhandsgranskning"
                  className="w-24 h-24 object-cover rounded-lg border border-slate-200 shadow-sm"
                />
                <button
                  type="button"
                  onClick={clearImage}
                  aria-label="Ta bort vald bild"
                  className="absolute -top-2 -right-2 bg-red-600 hover:bg-red-700 text-white rounded-full p-1 shadow-sm transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 border border-dashed border-slate-300 hover:border-slate-400 rounded-lg p-3 text-xs text-slate-600 cursor-pointer transition-colors bg-slate-50/50 hover:bg-slate-50">
                <Camera className="w-4 h-4 text-slate-500" />
                <span>Bifoga bild eller ta foto</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </label>
            )}
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => { setShowForm(false); setForm({ title: '', description: '' }); clearImage(); }}
              className="flex-1 border border-slate-200 text-slate-600 rounded-lg py-2 text-sm hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Avbryt
            </button>
            <button
              type="submit"
              disabled={submitting || !form.title.trim() || !form.description.trim()}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium rounded-lg py-2 text-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              {submitting ? (
                <Spinner />
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Skicka
                </>
              )}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Anmälningar ({issues.length})
        </h2>
        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />)}
          </div>
        ) : issues.length === 0 ? (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center text-slate-500 text-sm">
            Inga felanmälningar — bra jobbat!
          </div>
        ) : (
          issues.map((issue) => {
            const cfg = STATUS_CONFIG[issue.status] || STATUS_CONFIG.open
            const Icon = cfg.icon
            const isOwn = issue.user_id === profile?.id
            return (
              <div key={issue.id} className={`bg-white border ${cfg.border} rounded-xl p-4 shadow-sm space-y-2`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className={`w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0`}>
                      <Icon className={`w-4 h-4 ${cfg.text}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-slate-800 truncate">{issue.title}</h3>
                      <p className="text-xs text-slate-500">
                        {isOwn ? 'Du' : issue.user?.name} · {new Date(issue.created_at).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase shrink-0 ${cfg.bg} ${cfg.text}`}>
                    {cfg.label}
                  </span>
                </div>
                <p className="text-sm text-slate-700 whitespace-pre-wrap pl-10">{issue.description}</p>
                {issue.image_url && (
                  <div className="pl-10 pt-1">
                    <button
                      type="button"
                      onClick={() => setPreviewModal(issue.image_url)}
                      aria-label="Förstora bild"
                      className="group relative inline-block rounded-lg overflow-hidden border border-slate-200 cursor-pointer text-left"
                    >
                      <img
                        src={issue.image_url}
                        alt={issue.title}
                        className="h-28 w-auto max-w-xs object-cover rounded-lg group-hover:opacity-90 transition-opacity"
                      />
                      <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1">
                        <ImageIcon className="w-3 h-3" /> Visa bild
                      </span>
                    </button>
                  </div>
                )}
                {issue.admin_response && (
                  <div className="ml-10 bg-blue-50 border-l-2 border-blue-300 rounded px-3 py-2">
                    <div className="text-[10px] uppercase tracking-wide text-blue-600 font-semibold mb-0.5">Svar från admin</div>
                    <p className="text-xs text-slate-700 whitespace-pre-wrap">{issue.admin_response}</p>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {previewModal && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setPreviewModal(null)}
        >
          <div
            className="relative max-w-3xl max-h-[90vh] bg-white rounded-xl overflow-hidden p-2 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewModal(null)}
              aria-label="Stäng bildvisning"
              className="absolute top-4 right-4 z-10 bg-black/70 hover:bg-black/90 text-white rounded-full p-1.5 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewModal}
              alt="Bifogad bild"
              className="max-h-[80vh] w-auto mx-auto rounded-lg object-contain"
            />
          </div>
        </div>
      )}
    </div>
  )
}
