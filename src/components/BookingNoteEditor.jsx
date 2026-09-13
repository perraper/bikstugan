import { useState } from 'react'
import { MessageSquare, Pencil, Save } from 'lucide-react'
import Spinner from './Spinner'

export default function BookingNoteEditor({ note, onSave, maxChars = 200 }) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function handleStartEdit() {
    setDraft(note || '')
    setError('')
    setIsEditing(true)
  }

  function handleCancel() {
    setDraft('')
    setError('')
    setIsEditing(false)
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      await onSave(draft.trim().slice(0, maxChars))
      setIsEditing(false)
    } catch (err) {
      setError(err?.message || 'Kunde inte spara anteckningen.')
    } finally {
      setSaving(false)
    }
  }

  if (isEditing) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 space-y-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, maxChars))}
          rows={2}
          autoFocus
          placeholder={`Kommentar (max ${maxChars} tecken)...`}
          className="w-full bg-white border border-slate-200 rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/40 resize-none"
        />
        {error && <div className="text-[11px] text-red-600">{error}</div>}
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-400">
            {draft.length}/{maxChars}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleCancel}
              disabled={saving}
              className="text-[11px] text-slate-500 hover:text-slate-700 px-2 py-1 transition-colors"
            >
              Avbryt
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1 text-[11px] bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-2.5 py-1 rounded transition-colors"
            >
              {saving ? <Spinner className="w-3 h-3" /> : <Save className="w-3 h-3" />}
              <span>Spara</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (note) {
    return (
      <div className="flex items-start gap-2 bg-slate-50 rounded-lg px-3 py-2 group">
        <MessageSquare className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
        <p className="text-xs text-slate-600 flex-1 whitespace-pre-wrap leading-relaxed">{note}</p>
        <button
          onClick={handleStartEdit}
          className="opacity-60 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-slate-600 p-0.5"
          title="Redigera kommentar"
        >
          <Pencil className="w-3 h-3" />
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={handleStartEdit}
      className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
    >
      <MessageSquare className="w-3.5 h-3.5" />
      <span>Lägg till kommentar</span>
    </button>
  )
}
