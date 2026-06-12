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
  const url = `${envConfig.VITE_SUPABASE_URL}/rest/v1/?apikey=${envConfig.VITE_SUPABASE_ANON_KEY}`
  const response = await fetch(url)
  const spec = await response.json()
  
  console.log('Spec top-level keys:', Object.keys(spec))
  if (spec.components) {
    console.log('Components keys:', Object.keys(spec.components))
    if (spec.components.schemas) {
      console.log('Schemas keys:', Object.keys(spec.components.schemas))
      console.log('Bookings properties:', Object.keys(spec.components.schemas.bookings?.properties || {}))
      console.log('Electricity readings properties:', Object.keys(spec.components.schemas.electricity_readings?.properties || {}))
    }
  }
  if (spec.definitions) {
    console.log('Definitions keys:', Object.keys(spec.definitions))
  }
}
run()
