const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');

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

async function checkProducts() {
    const { data, error } = await supabaseAdmin.from('products').select('*');
    if (error) console.error(error);
    else console.log('Products:', data);
}
checkProducts();
