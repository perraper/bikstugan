import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

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

async function run() {
  const { data: cols, error } = await supabase.rpc('get_admin_users_with_auth').limit(1)
  // Let's do a direct select on information_schema or just fetch one row from each table
  const { data: readData, error: readErr } = await supabase.from('electricity_readings').select('*').limit(1)
  console.log('electricity_readings sample:', readData, readErr)

  const { data: bData, error: bErr } = await supabase.from('bookings').select('*').limit(1)
  console.log('bookings sample:', bData, bErr)
}
run()
