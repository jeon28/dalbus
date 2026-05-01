
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://axfopkixhvqqfpilljlk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4Zm9wa2l4aHZxcWZwaWxsamxrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDM4MTg2MywiZXhwIjoyMDg1OTU3ODYzfQ.2m3WrUtQCa_rs_3A_u0LKnuvK3fhE6Y7qHjqMbYDuAs';
const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanse() {
    console.log('--- CLEANSING START ---');

    // 1. Standardize Order Types
    console.log('1. Standardizing order_type...');
    const { data: updated, error: updateError } = await supabase
        .from('orders')
        .update({ order_type: 'NEW' })
        .is('order_type', null)
        .select();

    if (updateError) {
        console.error('Update Error:', updateError);
    } else {
        console.log(`Standardized ${updated?.length || 0} orders.`);
    }

    // 2. Recover Extension Links
    console.log('\n2. Recovering extension links...');
    const { data: orphanedExts } = await supabase
        .from('orders')
        .select('id, buyer_email, buyer_phone, created_at')
        .eq('order_type', 'EXT')
        .is('related_order_id', null);

    console.log(`Found ${orphanedExts?.length || 0} orphaned extension orders.`);

    for (const ext of orphanedExts || []) {
        let query = supabase
            .from('orders')
            .select('id, created_at')
            .lt('created_at', ext.created_at)
            .neq('id', ext.id)
            .order('created_at', { ascending: false })
            .limit(1);

        if (ext.buyer_email) query = query.eq('buyer_email', ext.buyer_email);
        else if (ext.buyer_phone) query = query.eq('buyer_phone', ext.buyer_phone);
        else continue;

        const { data: parent } = await query.maybeSingle();

        if (parent) {
            const { error: linkError } = await supabase
                .from('orders')
                .update({ related_order_id: parent.id })
                .eq('id', ext.id);

            if (linkError) {
                console.error(`Failed to link EXT ${ext.id}:`, linkError);
            } else {
                console.log(`Linked EXT ${ext.id} to parent ${parent.id}`);
            }
        }
    }

    // 3. Duplicate Slot Report
    console.log('\n3. Generating Duplicate Slot Report...');
    const { data: assignments } = await supabase
        .from('order_accounts')
        .select('id, account_id, slot_number, buyer_name, order_id, accounts(login_id)');

    const usage: Record<string, any[]> = {};
    assignments?.forEach(a => {
        const key = `${a.account_id}_${a.slot_number}`;
        if (!usage[key]) usage[key] = [];
        usage[key].push(a);
    });

    const dups = Object.entries(usage).filter(([_, list]) => list.length > 1);
    console.log('\n--- DUPLICATE SLOTS (Requires Manual Check) ---');
    console.log(JSON.stringify(dups, null, 2));

    console.log('--- CLEANSING END ---');
}

cleanse();
