// Supabase Edge Function — Email triggers via Resend
// Deploy: supabase functions deploy send-email
// Required secrets: RESEND_API_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const FROM_EMAIL = 'BIK-stugan <noreply@bik-stockholm.se>'

// Betalningsinställningar — håll synkat med src/lib/config.js
const PAYMENT = {
  depositAmount: 500,
  plusgiro: '572 64-4',
  payee: 'Brandkårens Idrottsklubb',
}
const REFUND_DEADLINE_WEEKS = 4

function paymentReference(name: string, year: number, weekNumber: number) {
  const last = (name || '').split(' ').slice(-1)[0]
  return `V${weekNumber}/${year} ${last}`.trim()
}

interface EmailPayload {
  type: 'booking_confirmation' | 'welcome' | 'cancellation_offer' | 'lottery_result' | 'new_account' | 'booking_cancelled' | 'booking_admin_notify' | 'deposit_reminder' | 'final_reminder' | 'issue_created'
  userId: string
  weekNumber?: number
  year?: number
  extra?: Record<string, unknown>
}

function getWeekDates(year: number, weekNumber: number) {
  const jan4 = new Date(year, 0, 4)
  const dayOfWeek = jan4.getDay() || 7
  const monday = new Date(jan4)
  monday.setDate(jan4.getDate() - dayOfWeek + 1 + (weekNumber - 1) * 7)
  const checkIn = new Date(monday)
  checkIn.setDate(monday.getDate() - 2) // Saturday before the week
  const checkOut = new Date(checkIn)
  checkOut.setDate(checkIn.getDate() + 7) // Next Saturday
  const fmt = (d: Date) => d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' })
  return { checkIn: fmt(checkIn), checkOut: fmt(checkOut) }
}

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
  })
  const result = await res.json()
  console.log('Resend response:', JSON.stringify({ status: res.status, result, to, subject }))
  if (!res.ok) throw new Error(`Resend error: ${JSON.stringify(result)}`)
  return result
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    const isServiceRole = token === SUPABASE_SERVICE_KEY

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    let callingUserId: string | null = null
    let isCallingAdmin = false

    if (!isServiceRole) {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token)
      if (authError || !authUser) {
        return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
          status: 401,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        })
      }
      callingUserId = authUser.id

      const { data: callerProfile } = await supabase
        .from('users')
        .select('role, approved')
        .eq('id', callingUserId)
        .single()

      isCallingAdmin = callerProfile?.role === 'admin'
    }

    const payload: EmailPayload = await req.json()

    // Validera behörigheter för icke-admin / icke-service_role
    if (!isServiceRole && !isCallingAdmin) {
      const allowedMemberTypes: EmailPayload['type'][] = [
        'booking_confirmation',
        'booking_cancelled',
        'booking_admin_notify',
        'new_account',
        'issue_created',
      ]

      if (payload.userId !== callingUserId) {
        return new Response(JSON.stringify({ error: 'Forbidden: Cannot trigger emails for another user' }), {
          status: 403,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        })
      }

      if (!allowedMemberTypes.includes(payload.type)) {
        return new Response(JSON.stringify({ error: `Forbidden: Action '${payload.type}' requires admin privileges` }), {
          status: 403,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        })
      }
    }

    // Fetch target user for email recipient
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', payload.userId)
      .single()

    if (!user) return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 })

    const { weekNumber, year } = payload

    switch (payload.type) {
      case 'booking_confirmation': {
        const dates = getWeekDates(year!, weekNumber!)
        const reference = paymentReference(user.name, year!, weekNumber!)
        await sendEmail(
          user.email,
          `Bokningsbekräftelse — Vecka ${weekNumber}, ${year}`,
          `
          <h2>Hej ${user.name}!</h2>
          <p>Din bokning av BIK-stugan vecka <strong>${weekNumber}</strong> (${year}) är nu bekräftad.</p>
          <p><strong>Incheckning:</strong> ${dates.checkIn} kl 12:00<br/>
          <strong>Utcheckning:</strong> ${dates.checkOut} kl 12:00</p>

          <h3 style="margin-top:24px">Nästa steg — anmälningsavgift</h3>
          <p>Betala <strong>${PAYMENT.depositAmount} kr</strong> för att säkra bokningen:</p>
          <table style="border-collapse:collapse;margin:8px 0">
            <tr><td style="padding:4px 12px 4px 0;color:#888">Plusgiro:</td><td style="padding:4px 0"><strong>${PAYMENT.plusgiro}</strong></td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#888">Mottagare:</td><td style="padding:4px 0"><strong>${PAYMENT.payee}</strong></td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#888">Belopp:</td><td style="padding:4px 0"><strong>${PAYMENT.depositAmount} kr</strong></td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#888">Meddelande:</td><td style="padding:4px 0"><strong>${reference}</strong></td></tr>
          </table>
          <p style="color:#666;font-size:14px">Resterande belopp faktureras separat.</p>
          <p style="color:#a16207;font-size:13px;background:#fef3c7;padding:8px 12px;border-radius:6px;margin-top:12px">
            <strong>Obs:</strong> Vid avbokning senare än ${REFUND_DEADLINE_WEEKS} veckor innan ankomst återbetalas inte anmälningsavgiften.
          </p>

          <p style="margin-top:24px">Du får ett välkomstmejl 7 dagar innan ankomst med portkod och stugregler.</p>
          <p>Mvh, BIK-stugan</p>
          `
        )
        break
      }

      case 'welcome': {
        // Portkoden läses från env-variabeln GATE_CODE (sätts via
        // `supabase secrets set GATE_CODE=...`). payload.extra.portkod
        // är override för manuella testanrop.
        const portkod = payload.extra?.portkod || Deno.env.get('GATE_CODE') || '(saknas — kontakta admin)'
        const welcomeDates = getWeekDates(year!, weekNumber!)
        const mapsUrl = 'https://www.google.com/maps/search/?api=1&query=Haralds%C3%A5sen+59%2C+846+91+Hede'
        await sendEmail(
          user.email,
          `Välkommen till BIK-stugan — Vecka ${weekNumber}`,
          `
          <h2>Hej ${user.name}!</h2>
          <p>Snart är det dags! Här är information inför din vistelse vecka ${weekNumber}.</p>
          <h3>Adress</h3>
          <p style="margin:0">
            <strong>Haraldsåsen 59, 846 91 Hede</strong><br>
            <a href="${mapsUrl}">Öppna i Google Maps</a>
          </p>
          <p style="color:#666;font-size:14px;margin-top:8px">Håll utkik efter hjärtstartare och brandkårsmärke på fasad och dörr.</p>
          <h3>Portkod: ${portkod}</h3>
          <h3>Stugregler</h3>
          <ul>
            <li>Incheckning: ${welcomeDates.checkIn} kl 12:00</li>
            <li>Utcheckning: ${welcomeDates.checkOut} kl 12:00</li>
            <li>6 sängplatser — självhushåll</li>
            <li>Ingen WiFi tillgänglig</li>
            <li>Läs av elmätaren vid ankomst och registrera startvärdet i appen under din bokning</li>
            <li>Läs av elmätaren vid avfärd och registrera slutvärdet i appen</li>
            <li>Städa stugan innan avfärd</li>
            <li>El debiteras med <strong>2,50 kr/kWh</strong> baserat på din registrerade avläsning — betalas till plusgiro <strong>${PAYMENT.plusgiro}</strong> (${PAYMENT.payee})</li>
          </ul>
          <p>Ha en fin vistelse!</p>
          <p>Mvh, BIK-stugan</p>
          `
        )
        break
      }

      case 'cancellation_offer': {
        const reserveRank = payload.extra?.reserveRank || 1
        await sendEmail(
          user.email,
          `Ledig plats — BIK-stugan Vecka ${weekNumber}`,
          `
          <h2>Hej ${user.name}!</h2>
          <p>En avbokning har gjorts för vecka <strong>${weekNumber}</strong> (${year}) och du står som reserv #${reserveRank}.</p>
          <p>Du har <strong>48 timmar</strong> på dig att bekräfta om du vill ta platsen.</p>
          <p>Logga in på bokningssystemet för att acceptera.</p>
          <p>Mvh, BIK-stugan</p>
          `
        )
        break
      }

      case 'new_account': {
        // Notify all admins about new account pending approval
        const { data: admins } = await supabase
          .from('users')
          .select('email, name')
          .eq('role', 'admin')
          .eq('approved', true)

        if (admins && admins.length > 0) {
          for (const admin of admins) {
            await sendEmail(
              admin.email,
              `Nytt konto väntar på godkännande — ${user.name}`,
              `
              <h2>Hej ${admin.name}!</h2>
              <p><strong>${user.name}</strong> (${user.email}) har skapat ett konto och väntar på godkännande.</p>
              <p>Logga in på bokningssystemet och gå till Admin → Medlemmar för att godkänna eller avvisa kontot.</p>
              <p>Mvh, BIK-stugan</p>
              `
            )
          }
        }
        break
      }

      case 'booking_admin_notify': {
        const dates = getWeekDates(year!, weekNumber!)
        const price = payload.extra?.price as number | undefined
        const note = payload.extra?.note as string | undefined
        const source = payload.extra?.source as string | undefined // e.g. 'reserve' for reserves taking over
        const sourceLabel = source === 'reserve' ? ' (via reservplats)' : ''

        const { data: notifyAdmins } = await supabase
          .from('users')
          .select('id, email, name')
          .eq('role', 'admin')
          .eq('approved', true)

        if (notifyAdmins && notifyAdmins.length > 0) {
          for (const admin of notifyAdmins) {
            // Skip notifying the booking user themselves if they're an admin
            if (admin.id === user.id) continue
            await sendEmail(
              admin.email,
              `Ny bokning${sourceLabel} — Vecka ${weekNumber}, ${year}`,
              `
              <h2>Hej ${admin.name}!</h2>
              <p><strong>${user.name}</strong> (${user.email}) har bokat vecka <strong>${weekNumber}</strong> (${year})${sourceLabel}.</p>
              <p><strong>Incheckning:</strong> ${dates.checkIn}<br/>
              <strong>Utcheckning:</strong> ${dates.checkOut}${price ? `<br/><strong>Pris:</strong> ${price} kr` : ''}</p>
              ${note ? `<div style="background:#f8fafc;border-left:3px solid #64748b;padding:8px 12px;margin:12px 0;color:#475569"><strong>Meddelande:</strong> ${note}</div>` : ''}
              <p style="color:#888;font-size:13px">Logga in på bokningssystemet för att se alla bokningar.</p>
              <p>Mvh, BIK-stugan</p>
              `
            )
          }
        }
        break
      }

      case 'booking_cancelled': {
        // Notify admins about cancellation
        const { data: cancelAdmins } = await supabase
          .from('users')
          .select('email, name')
          .eq('role', 'admin')
          .eq('approved', true)

        if (cancelAdmins && cancelAdmins.length > 0) {
          for (const admin of cancelAdmins) {
            await sendEmail(
              admin.email,
              `Avbokning — Vecka ${weekNumber}, ${year}`,
              `
              <h2>Hej ${admin.name}!</h2>
              <p><strong>${user.name}</strong> har avbokat vecka <strong>${weekNumber}</strong> (${year}).</p>
              <p>Veckan är nu markerad som ledig. Kolla om det finns reserver som ska kontaktas.</p>
              <p>Mvh, BIK-stugan</p>
              `
            )
          }
        }

        // Confirm cancellation to user
        await sendEmail(
          user.email,
          `Avbokning bekräftad — Vecka ${weekNumber}, ${year}`,
          `
          <h2>Hej ${user.name}!</h2>
          <p>Din bokning för vecka <strong>${weekNumber}</strong> (${year}) har avbokats.</p>
          <p>Mvh, BIK-stugan</p>
          `
        )
        break
      }

      case 'deposit_reminder': {
        const reminderCount = (payload.extra?.reminderCount as number) || 1
        const reference = paymentReference(user.name, year!, weekNumber!)
        const isFinal = reminderCount >= 2
        await sendEmail(
          user.email,
          isFinal
            ? `Sista påminnelse — anmälningsavgift v${weekNumber}`
            : `Påminnelse — anmälningsavgift v${weekNumber}`,
          `
          <h2>Hej ${user.name}!</h2>
          <p>Vi har inte registrerat din anmälningsavgift på <strong>${PAYMENT.depositAmount} kr</strong> för bokning vecka ${weekNumber}, ${year}.</p>
          <table style="border-collapse:collapse;margin:8px 0">
            <tr><td style="padding:4px 12px 4px 0;color:#888">Plusgiro:</td><td style="padding:4px 0"><strong>${PAYMENT.plusgiro}</strong></td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#888">Mottagare:</td><td style="padding:4px 0"><strong>${PAYMENT.payee}</strong></td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#888">Belopp:</td><td style="padding:4px 0"><strong>${PAYMENT.depositAmount} kr</strong></td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#888">Meddelande:</td><td style="padding:4px 0"><strong>${reference}</strong></td></tr>
          </table>
          ${isFinal
            ? '<p style="color:#a16207;background:#fef3c7;padding:8px 12px;border-radius:6px"><strong>Detta är sista påminnelsen.</strong> Om betalningen inte syns inom kort kan bokningen komma att annulleras.</p>'
            : '<p>Var god betala så snart som möjligt för att säkra bokningen.</p>'
          }
          <p style="color:#888;font-size:13px">Om du redan har betalat — bortse från detta mejl, det kan ta några dagar innan vi registrerat betalningen.</p>
          <p>Mvh, BIK-stugan</p>
          `
        )
        break
      }

      case 'final_reminder': {
        const reminderCount = (payload.extra?.reminderCount as number) || 1
        const remaining = (payload.extra?.remaining as number) || 0
        const reference = paymentReference(user.name, year!, weekNumber!)
        const dates = getWeekDates(year!, weekNumber!)
        const isFinal = reminderCount >= 2
        await sendEmail(
          user.email,
          isFinal
            ? `Sista påminnelse — slutbetalning v${weekNumber}`
            : `Påminnelse — slutbetalning v${weekNumber}`,
          `
          <h2>Hej ${user.name}!</h2>
          <p>Vi har inte registrerat din slutbetalning för bokning vecka <strong>${weekNumber}</strong>, ${year} (incheckning ${dates.checkIn}).</p>
          <table style="border-collapse:collapse;margin:8px 0">
            <tr><td style="padding:4px 12px 4px 0;color:#888">Plusgiro:</td><td style="padding:4px 0"><strong>${PAYMENT.plusgiro}</strong></td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#888">Mottagare:</td><td style="padding:4px 0"><strong>${PAYMENT.payee}</strong></td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#888">Belopp:</td><td style="padding:4px 0"><strong>${remaining} kr</strong></td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#888">Meddelande:</td><td style="padding:4px 0"><strong>${reference}</strong></td></tr>
          </table>
          ${isFinal
            ? '<p style="color:#a16207;background:#fef3c7;padding:8px 12px;border-radius:6px"><strong>Detta är sista påminnelsen.</strong> Slutbetalningen ska vara registrerad innan ankomst.</p>'
            : '<p>Var god slutför betalningen senast en vecka före ankomst.</p>'
          }
          <p style="color:#888;font-size:13px">Om du redan har betalat — bortse från detta mejl, det kan ta några dagar innan vi registrerat betalningen.</p>
          <p>Mvh, BIK-stugan</p>
          `
        )
        break
      }

      case 'issue_created': {
        const title = payload.extra?.title as string
        const description = payload.extra?.description as string

        const { data: issueAdmins } = await supabase
          .from('users')
          .select('email, name')
          .eq('role', 'admin')
          .eq('approved', true)

        if (issueAdmins && issueAdmins.length > 0) {
          for (const admin of issueAdmins) {
            await sendEmail(
              admin.email,
              `Felanmälan från ${user.name}: ${title}`,
              `
              <h2>Hej ${admin.name}!</h2>
              <p><strong>${user.name}</strong> (${user.email}) har skickat in en felanmälan.</p>
              <div style="background:#f8fafc;border-left:3px solid #ef4444;padding:12px 16px;margin:12px 0">
                <h3 style="margin:0 0 8px 0">${title}</h3>
                <p style="margin:0;white-space:pre-wrap">${description}</p>
              </div>
              <p>Logga in på bokningssystemet → Admin → Felanmälningar för att hantera ärendet.</p>
              <p>Mvh, BIK-stugan</p>
              `
            )
          }
        }
        break
      }

      case 'lottery_result': {
        const won = payload.extra?.won as boolean
        const reserveRank = payload.extra?.reserveRank as number | undefined
        const subject = won
          ? `Grattis! Du vann vecka ${weekNumber}`
          : `Resultat lottning — Vecka ${weekNumber}`
        const body = won
          ? `
            <h2>Grattis ${user.name}!</h2>
            <p>Du har vunnit lottningen för vecka <strong>${weekNumber}</strong> (${year}).</p>
            <p>Din bokning är nu bekräftad. Du får mer information närmare ankomst.</p>
            `
          : `
            <h2>Hej ${user.name}!</h2>
            <p>Tyvärr vann du inte lottningen för vecka ${weekNumber} (${year}).</p>
            ${reserveRank
              ? `<p>Du står som <strong>reserv #${reserveRank}</strong>. Om vinnaren avbokar kontaktas du.</p>`
              : '<p>Inga reservplatser kvar denna gång.</p>'
            }
            <p>Det finns fortfarande lediga veckor att boka direkt!</p>
            `

        await sendEmail(user.email, subject, body)
        break
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
})
