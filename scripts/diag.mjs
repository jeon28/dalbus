
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://axfopkixhvqqfpilljlk.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4Zm9wa2l4aHZxcWZwaWxsamxrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDM4MTg2MywiZXhwIjoyMDg1OTU3ODYzfQ.2m3WrUtQCa_rs_3A_u0LKnuvK3fhE6Y7qHjqMbYDuAs'

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
