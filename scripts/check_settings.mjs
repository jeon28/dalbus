
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkSettings() {
    console.log('--- site_settings table check ---')
    const { data, error } = await supabase
        .from('site_settings')
        .select('*')

    if (error) {
        console.error('Error fetching site_settings:', error)
    } else {
        console.log('Data:', JSON.stringify(data, null, 2))
    }
}

checkSettings()
