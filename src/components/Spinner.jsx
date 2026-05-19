// Liten roterande laddningsindikator. Standard är 4×4 vit (för knappar
// med mörk bakgrund). 'amber' och 'slate' för knappar med ljusare bakgrund.
export default function Spinner({ color = 'white' }) {
  const ring = color === 'amber'
    ? 'border-amber-300/30 border-t-amber-700'
    : color === 'slate'
      ? 'border-slate-300/30 border-t-slate-600'
      : 'border-white/30 border-t-white'
  return <div className={`w-4 h-4 border-2 ${ring} rounded-full animate-spin`} />
}
