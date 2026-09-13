import { CheckCircle2, Clock, Star, Users, Trash2, Info } from 'lucide-react'
import Spinner from '../Spinner'
import BookingPaymentInfo from '../BookingPaymentInfo'
import BookingNoteEditor from '../BookingNoteEditor'

export default function BookedSection({
  isOwnBooking,
  isOthersBooking,
  isLegacy,
  canSeeBookerName,
  bookerName,
  booking,
  reserveCount,
  ownReserve,
  ownReserveRank,
  activeOffer,
  actionLoading,
  onSaveNote,
  onCancelBooking,
  onJoinReserve,
  onLeaveReserve,
  paymentRef,
}) {
  return (
    <>
      {/* Vem äger veckan */}
      <div className="bg-slate-50 rounded-lg p-4 space-y-1.5">
        {isOwnBooking ? (
          <>
            <div className="flex items-center gap-2 text-sm text-slate-700 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Din bokning
            </div>
            {booking?.created_at && (
              <div className="text-xs text-slate-400">
                Bokad {new Date(booking.created_at).toLocaleDateString('sv-SE')}
              </div>
            )}
          </>
        ) : canSeeBookerName && bookerName ? (
          <>
            <div className="text-xs text-slate-400 mb-0.5">Bokad av</div>
            <div className="text-sm text-slate-700 font-medium">{bookerName}</div>
            {!isLegacy && (
              <div className="text-[11px] text-slate-400">
                Du ser namnet eftersom du har en bokning grannveckan.
              </div>
            )}
          </>
        ) : (
          <div className="text-sm text-slate-500">Veckan är bokad.</div>
        )}
      </div>

      {/* Egen bokning: deposit + kommentar + avboka */}
      {isOwnBooking && booking && (
        <>
          <BookingPaymentInfo
            booking={booking}
            paymentRef={paymentRef}
          />

          {/* Egen kommentar med BookingNoteEditor */}
          <BookingNoteEditor
            note={booking.note}
            onSave={onSaveNote}
          />

          {/* Reserver (antal för medlem) */}
          {reserveCount > 0 && (
            <div className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
              <Users className="w-3.5 h-3.5 inline -mt-0.5 mr-1 text-slate-400" />
              {reserveCount} reserv{reserveCount !== 1 ? 'er' : ''} står på kö om du avbokar
            </div>
          )}

          <button
            onClick={onCancelBooking}
            disabled={actionLoading}
            className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-medium rounded-lg px-4 py-2.5 text-sm flex items-center justify-center gap-2 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Avboka
          </button>
        </>
      )}

      {/* Annans bokning: ställ mig som reserv */}
      {isOthersBooking && (
        <>
          {activeOffer && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
              <Clock className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />
              Ett reserverbjudande pågår just nu (väntar på svar i 48h).
            </div>
          )}

          {ownReserve ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm text-amber-800 font-medium">
                <Star className="w-4 h-4" />
                Du står som reserv #{ownReserveRank}
              </div>
              <p className="text-xs text-amber-700">
                Om {bookerName || 'bokaren'} avbokar och du är först i kön får du ett mejl med 48h på dig att tacka ja.
              </p>
              <button
                onClick={onLeaveReserve}
                disabled={actionLoading}
                className="text-xs text-amber-700 hover:text-amber-900 underline"
              >
                Ta bort mig från reservlistan
              </button>
            </div>
          ) : !isLegacy ? (
            <button
              onClick={onJoinReserve}
              disabled={actionLoading}
              className="w-full bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 font-medium rounded-lg px-4 py-2.5 text-sm flex items-center justify-center gap-2 transition-colors"
            >
              {actionLoading ? <Spinner color="amber" /> : <><Star className="w-4 h-4" /> Ställ mig som reserv</>}
            </button>
          ) : (
            <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg p-2.5 text-[11px] text-blue-700 leading-normal">
              <Info className="w-3.5 h-3.5 shrink-0 text-blue-500 mt-0.5" />
              <span>Veckan är registrerad som äldre bokning utan koppling till medlemskonto.</span>
            </div>
          )}
        </>
      )}
    </>
  )
}
