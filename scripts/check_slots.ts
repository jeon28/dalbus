import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseRoleKey || supabaseAnonKey);

async function check() {
    const { data: accounts, error: err1 } = await supabase
        .from('accounts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

    if (err1) {
        console.error('Error fetching accounts:', err1);
        return;
    }

    if (accounts && accounts.length > 0) {
        console.log('Latest Account:', accounts[0]);
        
        const { data: slots, error: err2 } = await supabase
            .from('order_accounts')
            .select('*')
            .eq('account_id', accounts[0].id);

        if (err2) {
            console.error('Error fetching slots:', err2);
        } else {
            console.log('Slots for Latest Account:', slots);
        }
    } else {
        console.log('No accounts found.');
    }
}

check();
