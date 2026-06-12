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
  const r1 = await supabase.from('bookings').insert({ dummy_nonexistent_column: 'test' })
  console.log('bookings error:', r1.error?.message)

  const r2 = await supabase.from('electricity_readings').insert({ dummy_nonexistent_column: 'test' })
  console.log('electricity_readings error:', r2.error?.message)
}
run()
