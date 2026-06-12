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
  // We can query pg_policies using RPC if we had one, but we don't.
  // Instead, let's try to query public schemas or see if we can read from pg_catalog.pg_policies.
  const { data, error } = await supabase.from('electricity_readings').select('*')
  console.log('Readings:', data, error)
}
run()
