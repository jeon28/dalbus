
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://axfopkixhvqqfpilljlk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4Zm9wa2l4aHZxcWZwaWxsamxrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDM4MTg2MywiZXhwIjoyMDg1OTU3ODYzfQ.2m3WrUtQCa_rs_3A_u0LKnuvK3fhE6Y7qHjqMbYDuAs';
const supabase = createClient(supabaseUrl, supabaseKey);

async function detail() {
    console.log('--- 1. Orders without order_type ---');
    const { data: o1 } = await supabase.from('orders').select('id, depositor_name, status, created_at').is('order_type', null);
    console.log(JSON.stringify(o1, null, 2));

    console.log('\n--- 2. Extension orders missing related_order_id ---');
    const { data: o2 } = await supabase.from('orders').select('id, depositor_name, buyer_email, buyer_phone, created_at').eq('order_type', 'EXT').is('related_order_id', null);
    console.log(JSON.stringify(o2, null, 2));

    console.log('\n--- 3. Duplicate Slot Assignments ---');
    const { data: assignments } = await supabase.from('order_accounts').select('id, account_id, slot_number, buyer_name, order_id');
    const usage: Record<string, any[]> = {};
    assignments?.forEach(a => {
        const k = `${a.account_id}_${a.slot_number}`;
        if (!usage[k]) usage[k] = [];
        usage[k].push(a);
    });
    const dups = Object.entries(usage).filter(([_, list]) => list.length > 1);
    console.log(JSON.stringify(dups, null, 2));
}

detail();
