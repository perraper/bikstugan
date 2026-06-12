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
  // Try to find any booking
  const { data: bookings, error: bErr } = await supabase.from('bookings').select('*').limit(5)
  console.log('Bookings:', bookings)

  if (bookings && bookings.length > 0) {
    const booking = bookings[0]
    // Try to select from electricity_readings for this booking
    const { data: readings, error: rErr } = await supabase.from('electricity_readings').select('*')
    console.log('All electricity readings:', readings, rErr)
  }
}
run()
