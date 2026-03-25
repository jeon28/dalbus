const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');

// Load .env.local if exists
const envFile = 'c:/Users/전성현/dalbus/.env.local';
if (fs.existsSync(envFile)) {
    const envConfig = dotenv.parse(fs.readFileSync(envFile));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

async function checkAdminProfiles() {
    const { data: profiles, error } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('role', 'admin');
    
    if (error) {
        console.error('Error checking profiles:', error);
        return;
    }
    
    console.log('Admin profiles:', profiles);
}

checkAdminProfiles();
