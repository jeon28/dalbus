const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

function loadEnv() {
    const envPath = path.resolve(process.cwd(), '.env.local')
    if (!fs.existsSync(envPath)) return {}
    const content = fs.readFileSync(envPath, 'utf8')
    const env = {}
    content.split('\n').forEach(line => {
        const [key, ...value] = line.split('=')
        if (key && value.length > 0) {
            env[key.trim()] = value.join('=').trim()
        }
    })
    return env
}

const env = loadEnv()
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY

console.log('Testing Supabase Service Role Connection...')
console.log('URL:', supabaseUrl)
console.log('Service Key length:', supabaseServiceKey ? supabaseServiceKey.length : 0)

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing environment variables (Service Role) in .env.local.')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function test() {
    try {
        const { data, error } = await supabase.from('products').select('*').limit(1)
        if (error) {
            console.error('Connection Failed:', error)
        } else {
            console.log('Connection Successful! First product name:', data?.[0]?.name || 'No data found')
        }
    } catch (err) {
        console.error('Unexpected Error:', err)
    }
}

test()
