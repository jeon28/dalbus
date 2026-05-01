
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://axfopkixhvqqfpilljlk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4Zm9wa2l4aHZxcWZwaWxsamxrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDM4MTg2MywiZXhwIjoyMDg1OTU3ODYzfQ.2m3WrUtQCa_rs_3A_u0LKnuvK3fhE6Y7qHjqMbYDuAs';
const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
    const { count: nullTypeCount } = await supabase.from('orders').select('*', { count: 'exact', head: true }).is('order_type', null);
    const { count: orphanedCount } = await supabase.from('orders').select('*', { count: 'exact', head: true }).eq('order_type', 'EXT').is('related_order_id', null);
    const { data: assignments } = await supabase.from('order_accounts').select('id, account_id, slot_number');

    const usage: Record<string, number> = {};
    assignments?.forEach(a => {
        const key = `${a.account_id}_${a.slot_number}`;
        usage[key] = (usage[key] || 0) + 1;
    });
    const dupCount = Object.values(usage).filter(v => v > 1).length;

    console.log(`NULL Types: ${nullTypeCount}`);
    console.log(`Orphaned EXTs: ${orphanedCount}`);
    console.log(`Duplicate Slots: ${dupCount}`);
}

verify();
