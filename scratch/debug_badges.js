import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

// Parse .env manually
const envText = fs.readFileSync('.env', 'utf-8')
const envConfig = {}
for (const line of envText.split('\n')) {
  const match = line.match(/^\s*([\w\.\-]+)\s*=\s*(.*)?\s*$/)
  if (match) {
    let value = match[2] || ''
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1)
    envConfig[match[1]] = value
  }
}

const supabase = createClient(envConfig.VITE_SUPABASE_URL, envConfig.VITE_SUPABASE_ANON_KEY)

async function test() {
  const { data: users, error: uErr } = await supabase.from('users').select('*').eq('approved', false)
  const { data: issues, error: iErr } = await supabase.from('issues').select('*').eq('status', 'open')
  const { data: rpcData, error: rpcErr } = await supabase.rpc('get_admin_users_with_auth')

  console.log('Unapproved users:', users?.length, uErr || '')
  console.log('Open issues:', issues?.length, iErr || '')
  console.log('RPC unapproved users:', rpcData?.filter(u => !u.approved).length, rpcErr || '')
}

test()
