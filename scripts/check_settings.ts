import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
    console.log('Checking site_settings table...');
    const { data, error } = await supabaseAdmin.from('site_settings').select('*');
    if (error) {
        console.error('Error:', error.message);
    } else {
        console.log('Settings found:', JSON.stringify(data, null, 2));
    }
}

check();
