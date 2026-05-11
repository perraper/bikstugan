import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mockad supabase-klient. Vi spårar varje from()/functions.invoke()-anrop
// i `calls` och låter testerna styra svar via `nextResponses`.
const calls = []
let nextResponses = {}

function setResponses(table, op, ...responses) {
  nextResponses[`${table}:${op}`] = responses
}

function createChain(table) {
  const ctx = { table, op: null, payload: null, opts: null, filters: [], modifiers: [] }
  const chain = {
    insert(args) { ctx.op = 'insert'; ctx.payload = args; return chain },
    update(args) { ctx.op = 'update'; ctx.payload = args; return chain },
    upsert(args, opts) { ctx.op = 'upsert'; ctx.payload = args; ctx.opts = opts; return chain },
    delete() { ctx.op = 'delete'; return chain },
    select() { if (!ctx.op) ctx.op = 'select'; return chain },
    eq(col, val) { ctx.filters.push({ col, val }); return chain },
    in(col, vals) { ctx.filters.push({ col, vals }); return chain },
    order(col, opts) { ctx.modifiers.push(['order', col, opts]); return chain },
    limit(n) { ctx.modifiers.push(['limit', n]); return chain },
    maybeSingle() { ctx.modifiers.push(['maybeSingle']); return chain },
    single() { ctx.modifiers.push(['single']); return chain },
    then(onResolve) {
      calls.push(ctx)
      const key = `${ctx.table}:${ctx.op || 'select'}`
      const queue = nextResponses[key]
      const response = queue && queue.length > 0 ? queue.shift() : { data: null, error: null }
      onResolve(response)
    },
  }
  return chain
}

const invokeMock = vi.fn(() => ({ catch: () => {} }))

vi.mock('./supabase', () => ({
  supabase: {
    from: (table) => createChain(table),
    functions: { invoke: (...args) => invokeMock(...args) },
  },
}))

beforeEach(() => {
  calls.length = 0
  nextResponses = {}
  invokeMock.mockClear()
})

import {
  bookWeek,
  cancelBooking,
  acceptReserveOffer,
  joinReserveList,
  leaveReserveList,
  applyForLottery,
  isRefundable,
  weeksUntilCheckin,
} from './booking-actions'

const profile = { id: 'user-1', name: 'Testare' }

describe('weeksUntilCheckin / isRefundable', () => {
  it('isRefundable är false när incheckning ligger nära', () => {
    // Vecka 1 år 2024 — sedan länge passerad → negativ → false
    expect(isRefundable(2024, 1)).toBe(false)
  })

  it('isRefundable är true när incheckning ligger långt fram', () => {
    // Vecka 30 år 2099 — väldigt långt fram → > 4 veckor → true
    expect(isRefundable(2099, 30)).toBe(true)
  })

  it('weeksUntilCheckin returnerar negativt för historiska veckor', () => {
    expect(weeksUntilCheckin(2020, 1)).toBeLessThan(0)
  })
})

describe('bookWeek', () => {
  it('upsertar weeks-rad och insertar booking, skickar två mejl', async () => {
    await bookWeek({ profile, year: 2099, weekNumber: 30, note: '  test  ' })

    const weeksUpsert = calls.find((c) => c.table === 'weeks' && c.op === 'upsert')
    expect(weeksUpsert).toBeDefined()
    expect(weeksUpsert.payload).toMatchObject({
      year: 2099,
      week_number: 30,
      status: 'booked',
      booked_by_user_id: 'user-1',
      price: 2000, // normalsäsong
    })
    expect(weeksUpsert.opts).toEqual({ onConflict: 'year,week_number' })

    const bookingInsert = calls.find((c) => c.table === 'bookings' && c.op === 'insert')
    expect(bookingInsert).toBeDefined()
    expect(bookingInsert.payload).toMatchObject({
      user_id: 'user-1',
      year: 2099,
      week_number: 30,
      price: 2000,
      status: 'confirmed',
      note: 'test', // trim:ad
    })

    // Två mejl: bekräftelse till medlem + admin-notis
    expect(invokeMock).toHaveBeenCalledTimes(2)
    const types = invokeMock.mock.calls.map((c) => c[1].body.type).sort()
    expect(types).toEqual(['booking_admin_notify', 'booking_confirmation'])
  })

  it('sätter note till null om tom sträng', async () => {
    await bookWeek({ profile, year: 2099, weekNumber: 30, note: '   ' })
    const bookingInsert = calls.find((c) => c.table === 'bookings' && c.op === 'insert')
    expect(bookingInsert.payload.note).toBeNull()
  })

  it('använder högsäsongspris för vecka 13', async () => {
    await bookWeek({ profile, year: 2099, weekNumber: 13 })
    const weeksUpsert = calls.find((c) => c.table === 'weeks' && c.op === 'upsert')
    expect(weeksUpsert.payload.price).toBe(3000)
  })

  it('kastar om weeks-upsert misslyckas och hoppar över bookings-insert', async () => {
    setResponses('weeks', 'upsert', { error: { message: 'denied' } })
    await expect(
      bookWeek({ profile, year: 2099, weekNumber: 30 })
    ).rejects.toMatchObject({ message: 'denied' })

    const bookingInsert = calls.find((c) => c.table === 'bookings' && c.op === 'insert')
    expect(bookingInsert).toBeUndefined()
    expect(invokeMock).not.toHaveBeenCalled()
  })
})

describe('cancelBooking', () => {
  const booking = { id: 'b-1', year: 2099, week_number: 30 }

  it('utan reserver: släpper veckan tillbaka till available', async () => {
    setResponses('lottery_applications', 'select', { data: [] })

    await cancelBooking({ profile, booking })

    const bookingsUpdate = calls.find((c) => c.table === 'bookings' && c.op === 'update')
    expect(bookingsUpdate.payload).toMatchObject({
      status: 'cancelled',
      deposit_refundable: true, // 2099 ligger långt fram
    })
    expect(bookingsUpdate.payload.cancelled_at).toBeTypeOf('string')

    const weeksUpdate = calls.find(
      (c) => c.table === 'weeks' && c.op === 'update' && c.payload.status === 'available'
    )
    expect(weeksUpdate).toBeDefined()
    expect(weeksUpdate.payload).toEqual({ status: 'available', booked_by_user_id: null })

    // Inga reserve_offers ska skapas
    expect(calls.find((c) => c.table === 'reserve_offers')).toBeUndefined()

    // Ett mejl till medlemmen som avbokade
    expect(invokeMock).toHaveBeenCalledTimes(1)
    expect(invokeMock.mock.calls[0][1].body.type).toBe('booking_cancelled')
  })

  it('med reserver: erbjuder veckan till första reserven', async () => {
    setResponses('lottery_applications', 'select', {
      data: [
        { id: 'la-1', user_id: 'user-2', reserve_rank: 1 },
        { id: 'la-2', user_id: 'user-3', reserve_rank: 2 },
      ],
    })

    await cancelBooking({ profile, booking })

    // weeks ska sättas booked_by_user_id=null men status oförändrad (förblir 'booked')
    const weeksClear = calls.find(
      (c) => c.table === 'weeks' && c.op === 'update' && c.payload.booked_by_user_id === null
    )
    expect(weeksClear).toBeDefined()
    expect(weeksClear.payload).toEqual({ booked_by_user_id: null })
    expect(weeksClear.payload.status).toBeUndefined()

    const offerInsert = calls.find((c) => c.table === 'reserve_offers' && c.op === 'insert')
    expect(offerInsert).toBeDefined()
    expect(offerInsert.payload).toMatchObject({
      year: 2099,
      week_number: 30,
      offered_to_user_id: 'user-2',
      reserve_rank: 1,
    })

    // Två mejl: erbjudande + bekräftelse på avbokning
    expect(invokeMock).toHaveBeenCalledTimes(2)
    const types = invokeMock.mock.calls.map((c) => c[1].body.type).sort()
    expect(types).toEqual(['booking_cancelled', 'cancellation_offer'])
  })

  it('historisk avbokning markeras icke-återbetalningsbar', async () => {
    setResponses('lottery_applications', 'select', { data: [] })
    await cancelBooking({ profile, booking: { id: 'b-2', year: 2024, week_number: 1 } })
    const bookingsUpdate = calls.find((c) => c.table === 'bookings' && c.op === 'update')
    expect(bookingsUpdate.payload.deposit_refundable).toBe(false)
  })
})

describe('acceptReserveOffer', () => {
  it('uppdaterar offer + weeks + lottery + insertar booking + skickar två mejl', async () => {
    const offer = { id: 'o-1', year: 2099, week_number: 30 }
    await acceptReserveOffer({ profile, offer })

    expect(calls.find((c) => c.table === 'reserve_offers' && c.op === 'update')).toMatchObject({
      payload: { status: 'accepted' },
    })
    expect(calls.find((c) => c.table === 'weeks' && c.op === 'update')).toMatchObject({
      payload: { booked_by_user_id: 'user-1', status: 'booked' },
    })
    expect(calls.find((c) => c.table === 'lottery_applications' && c.op === 'update')).toMatchObject({
      payload: { status: 'won', reserve_rank: null },
    })
    const bookingInsert = calls.find((c) => c.table === 'bookings' && c.op === 'insert')
    expect(bookingInsert.payload).toMatchObject({
      user_id: 'user-1',
      year: 2099,
      week_number: 30,
      price: 2000,
      status: 'confirmed',
    })

    expect(invokeMock).toHaveBeenCalledTimes(2)
  })
})

describe('joinReserveList', () => {
  it('returnerar befintlig rad om man redan är reserv', async () => {
    const existing = { id: 'la-9', status: 'reserve', reserve_rank: 3 }
    setResponses('lottery_applications', 'select', { data: existing })

    const result = await joinReserveList({ profile, year: 2099, weekNumber: 30 })

    expect(result).toEqual(existing)
    // Ingen update eller insert ska ske
    expect(calls.find((c) => c.table === 'lottery_applications' && c.op === 'update')).toBeUndefined()
    expect(calls.find((c) => c.table === 'lottery_applications' && c.op === 'insert')).toBeUndefined()
  })

  it('uppgraderar befintlig icke-reserv-rad till reserve med nästa rank', async () => {
    setResponses('lottery_applications', 'select',
      { data: { id: 'la-9', status: 'lost', reserve_rank: null } }, // existing
      { data: [{ reserve_rank: 4 }] }, // currentReserves
    )
    setResponses('lottery_applications', 'update', { data: { id: 'la-9', status: 'reserve', reserve_rank: 5 }, error: null })

    const result = await joinReserveList({ profile, year: 2099, weekNumber: 30 })

    const update = calls.find((c) => c.table === 'lottery_applications' && c.op === 'update')
    expect(update.payload).toEqual({ status: 'reserve', reserve_rank: 5 })
    expect(result).toMatchObject({ reserve_rank: 5 })
  })

  it('insertar ny rad med rank 1 när inga reserver finns', async () => {
    setResponses('lottery_applications', 'select',
      { data: null }, // existing
      { data: [] }, // currentReserves
    )
    setResponses('lottery_applications', 'insert', { data: { id: 'la-new', reserve_rank: 1 }, error: null })

    await joinReserveList({ profile, year: 2099, weekNumber: 30 })

    const insert = calls.find((c) => c.table === 'lottery_applications' && c.op === 'insert')
    expect(insert.payload).toMatchObject({
      user_id: 'user-1',
      year: 2099,
      week_number: 30,
      status: 'reserve',
      reserve_rank: 1,
    })
  })
})

describe('leaveReserveList', () => {
  it('raderar reserv-rad och kastar vid fel', async () => {
    await leaveReserveList({ profile, year: 2099, weekNumber: 30 })
    const del = calls.find((c) => c.table === 'lottery_applications' && c.op === 'delete')
    expect(del).toBeDefined()
    const filterCols = del.filters.map((f) => f.col).sort()
    expect(filterCols).toEqual(['status', 'user_id', 'week_number', 'year'])

    setResponses('lottery_applications', 'delete', { error: { message: 'no permission' } })
    await expect(
      leaveReserveList({ profile, year: 2099, weekNumber: 30 })
    ).rejects.toMatchObject({ message: 'no permission' })
  })
})

describe('applyForLottery', () => {
  it('insertar pending-rad', async () => {
    await applyForLottery({ profile, year: 2099, weekNumber: 30 })
    const insert = calls.find((c) => c.table === 'lottery_applications' && c.op === 'insert')
    expect(insert.payload).toEqual({
      user_id: 'user-1',
      year: 2099,
      week_number: 30,
      status: 'pending',
    })
  })

  it('kastar om insert misslyckas', async () => {
    setResponses('lottery_applications', 'insert', { error: { message: 'duplicate' } })
    await expect(
      applyForLottery({ profile, year: 2099, weekNumber: 30 })
    ).rejects.toMatchObject({ message: 'duplicate' })
  })
})
