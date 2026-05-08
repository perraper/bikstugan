// Supabase Edge Function — admin-update-user
// Deploy: supabase functions deploy admin-update-user
// Updates a user's name, email and/or phone. Email change syncs auth.users + public.users.
// Caller must be an admin (verified via JWT).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface UpdatePayload {
  userId: string
  name?: string
  email?: string
  phone?: string | null
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing authorization' }, 401)

    // Verify the caller's JWT and confirm they're an admin
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user: caller }, error: authErr } = await userClient.auth.getUser()
    if (authErr || !caller) return json({ error: 'Invalid token' }, 401)

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const { data: callerProfile } = await adminClient
      .from('users')
      .select('role')
      .eq('id', caller.id)
      .single()

    if (callerProfile?.role !== 'admin') return json({ error: 'Forbidden' }, 403)

    const payload: UpdatePayload = await req.json()
    if (!payload.userId) return json({ error: 'Missing userId' }, 400)

    // Sync email in auth schema first — if this fails we abort before touching public.users
    if (payload.email !== undefined) {
      const trimmed = payload.email.trim().toLowerCase()
      if (!trimmed || !trimmed.includes('@')) return json({ error: 'Invalid email' }, 400)
      const { error: updErr } = await adminClient.auth.admin.updateUserById(payload.userId, {
        email: trimmed,
        email_confirm: true,
      })
      if (updErr) return json({ error: `Auth: ${updErr.message}` }, 400)
      payload.email = trimmed
    }

    const update: Record<string, unknown> = {}
    if (payload.name !== undefined) update.name = payload.name.trim()
    if (payload.email !== undefined) update.email = payload.email
    if (payload.phone !== undefined) update.phone = payload.phone?.toString().trim() || null

    if (Object.keys(update).length > 0) {
      const { error: dbErr } = await adminClient
        .from('users')
        .update(update)
        .eq('id', payload.userId)
      if (dbErr) return json({ error: `DB: ${dbErr.message}` }, 400)
    }

    return json({ ok: true })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
