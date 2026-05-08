import { supabase } from './supabase'
import { getSeasonPrice, getWeekDateRange } from './weeks'
import { REFUND_DEADLINE_WEEKS } from './config'

export function weeksUntilCheckin(year, weekNumber) {
  const checkIn = getWeekDateRange(year, weekNumber).checkIn
  return (checkIn - Date.now()) / (7 * 86400000)
}

export function isRefundable(year, weekNumber) {
  return weeksUntilCheckin(year, weekNumber) >= REFUND_DEADLINE_WEEKS
}

export async function bookWeek({ profile, year, weekNumber, note }) {
  const season = getSeasonPrice(weekNumber)

  const { error: weeksError } = await supabase
    .from('weeks')
    .upsert(
      {
        year,
        week_number: weekNumber,
        status: 'booked',
        booked_by_user_id: profile.id,
        price: season.price,
      },
      { onConflict: 'year,week_number' }
    )

  if (weeksError) throw weeksError

  const { error: bookingError } = await supabase.from('bookings').insert({
    user_id: profile.id,
    year,
    week_number: weekNumber,
    price: season.price,
    status: 'confirmed',
    note: note?.trim() || null,
  })

  if (bookingError) throw bookingError

  supabase.functions
    .invoke('send-email', {
      body: { type: 'booking_confirmation', userId: profile.id, weekNumber, year },
    })
    .catch(console.error)
}

export async function cancelBooking({ profile, booking }) {
  const refundable = isRefundable(booking.year, booking.week_number)

  const { error: cancelError } = await supabase
    .from('bookings')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      deposit_refundable: refundable,
    })
    .eq('id', booking.id)

  if (cancelError) throw cancelError

  const { data: reserves } = await supabase
    .from('lottery_applications')
    .select('*')
    .eq('year', booking.year)
    .eq('week_number', booking.week_number)
    .eq('status', 'reserve')
    .order('reserve_rank')

  if (reserves && reserves.length > 0) {
    const first = reserves[0]
    await supabase
      .from('weeks')
      .update({ booked_by_user_id: null })
      .eq('year', booking.year)
      .eq('week_number', booking.week_number)

    await supabase.from('reserve_offers').insert({
      year: booking.year,
      week_number: booking.week_number,
      offered_to_user_id: first.user_id,
      reserve_rank: first.reserve_rank,
    })

    supabase.functions
      .invoke('send-email', {
        body: {
          type: 'cancellation_offer',
          userId: first.user_id,
          weekNumber: booking.week_number,
          year: booking.year,
          extra: { reserveRank: first.reserve_rank },
        },
      })
      .catch(console.error)
  } else {
    await supabase
      .from('weeks')
      .update({ status: 'available', booked_by_user_id: null })
      .eq('year', booking.year)
      .eq('week_number', booking.week_number)
  }

  supabase.functions
    .invoke('send-email', {
      body: {
        type: 'booking_cancelled',
        userId: profile.id,
        weekNumber: booking.week_number,
        year: booking.year,
      },
    })
    .catch(console.error)
}

export async function acceptReserveOffer({ profile, offer }) {
  const price = getSeasonPrice(offer.week_number).price

  await supabase.from('reserve_offers').update({ status: 'accepted' }).eq('id', offer.id)
  await supabase
    .from('weeks')
    .update({ booked_by_user_id: profile.id, status: 'booked' })
    .eq('year', offer.year)
    .eq('week_number', offer.week_number)
  await supabase.from('bookings').insert({
    user_id: profile.id,
    year: offer.year,
    week_number: offer.week_number,
    price,
    status: 'confirmed',
  })
  await supabase
    .from('lottery_applications')
    .update({ status: 'won', reserve_rank: null })
    .eq('user_id', profile.id)
    .eq('year', offer.year)
    .eq('week_number', offer.week_number)

  supabase.functions
    .invoke('send-email', {
      body: {
        type: 'booking_confirmation',
        userId: profile.id,
        weekNumber: offer.week_number,
        year: offer.year,
      },
    })
    .catch(console.error)
}

export async function joinReserveList({ profile, year, weekNumber }) {
  const { data: existing } = await supabase
    .from('lottery_applications')
    .select('*')
    .eq('user_id', profile.id)
    .eq('year', year)
    .eq('week_number', weekNumber)
    .maybeSingle()

  if (existing && existing.status === 'reserve') {
    return existing
  }

  const { data: currentReserves } = await supabase
    .from('lottery_applications')
    .select('reserve_rank')
    .eq('year', year)
    .eq('week_number', weekNumber)
    .eq('status', 'reserve')
    .order('reserve_rank', { ascending: false })
    .limit(1)

  const nextRank = (currentReserves?.[0]?.reserve_rank || 0) + 1

  if (existing) {
    const { data, error } = await supabase
      .from('lottery_applications')
      .update({ status: 'reserve', reserve_rank: nextRank })
      .eq('id', existing.id)
      .select()
      .single()
    if (error) throw error
    return data
  }

  const { data, error } = await supabase
    .from('lottery_applications')
    .insert({
      user_id: profile.id,
      year,
      week_number: weekNumber,
      status: 'reserve',
      reserve_rank: nextRank,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function leaveReserveList({ profile, year, weekNumber }) {
  const { error } = await supabase
    .from('lottery_applications')
    .delete()
    .eq('user_id', profile.id)
    .eq('year', year)
    .eq('week_number', weekNumber)
    .eq('status', 'reserve')
  if (error) throw error
}

export async function applyForLottery({ profile, year, weekNumber }) {
  const { error } = await supabase.from('lottery_applications').insert({
    user_id: profile.id,
    year,
    week_number: weekNumber,
    status: 'pending',
  })
  if (error) throw error
}
