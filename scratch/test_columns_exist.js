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

async function checkColumn(table, col) {
  const { data, error } = await supabase.from(table).select(col).limit(1)
  if (error) {
    return { exists: false, error: error.message }
  }
  return { exists: true }
}

async function run() {
  const candidates = ['paid', 'electricity_paid', 'is_paid', 'status', 'electricity_paid_at']
  
  console.log('--- Probing electricity_readings ---')
  for (const c of candidates) {
    const res = await checkColumn('electricity_readings', c)
    console.log(`electricity_readings.${c}:`, res.exists ? 'EXISTS' : `NO (${res.error})`)
  }

  console.log('--- Probing bookings ---')
  for (const c of candidates) {
    const res = await checkColumn('bookings', c)
    console.log(`bookings.${c}:`, res.exists ? 'EXISTS' : `NO (${res.error})`)
  }
}
run()
