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

async function run() {
  const url = `${envConfig.VITE_SUPABASE_URL}/rest/v1/`
  const response = await fetch(url, {
    headers: {
      'apikey': envConfig.VITE_SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${envConfig.VITE_SUPABASE_ANON_KEY}`
    }
  })
  const spec = await response.json()
  console.log(spec)
}
run()
