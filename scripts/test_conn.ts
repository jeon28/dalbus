import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

console.log('Testing Supabase Connection...')
console.log('URL:', supabaseUrl)
console.log('Anon Key defined:', !!supabaseAnonKey)

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing environment variables.')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function test() {
    const { data, error } = await supabase.from('products').select('*').limit(1)
    if (error) {
        console.error('Connection Failed:', error)
    } else {
        console.log('Connection Successful! Data:', data)
    }
}

test()
