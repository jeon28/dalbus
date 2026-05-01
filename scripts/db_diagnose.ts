
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://axfopkixhvqqfpilljlk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4Zm9wa2l4aHZxcWZwaWxsamxrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDM4MTg2MywiZXhwIjoyMDg1OTU3ODYzfQ.2m3WrUtQCa_rs_3A_u0LKnuvK3fhE6Y7qHjqMbYDuAs';
const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
    console.log('--- DIAGNOSIS START ---');

    // 1. Orders with missing order_type
    const { data: noTypeOrders } = await supabase.from('orders').select('id, depositor_name, status').is('order_type', null);
    console.log(`1. Orders without order_type: ${noTypeOrders?.length || 0}`);
    if (noTypeOrders?.length) console.log(noTypeOrders.slice(0, 5));

    // 2. Extension orders missing related_order_id
    const { data: badExtOrders } = await supabase.from('orders').select('id, depositor_name').eq('order_type', 'EXT').is('related_order_id', null);
    console.log(`2. EXT orders missing related_order_id: ${badExtOrders?.length || 0}`);
    if (badExtOrders?.length) console.log(badExtOrders.slice(0, 5));

    // 3. Orphaned assignments
    const { data: allOrders } = await supabase.from('orders').select('id');
    const orderIds = new Set(allOrders?.map(o => o.id));
    const { data: allAssignments } = await supabase.from('order_accounts').select('id, order_id');
    const orphaned = allAssignments?.filter(a => !orderIds.has(a.order_id));
    console.log(`3. Orphaned assignments (no matching order): ${orphaned?.length || 0}`);
    if (orphaned?.length) console.log(orphaned.slice(0, 5));

    // 4. Duplicate slot assignments
    const slotUsage: Record<string, string[]> = {};
    const { data: assignments } = await supabase.from('order_accounts').select('id, account_id, slot_number');
    assignments?.forEach(a => {
        const key = `${a.account_id}_${a.slot_number}`;
        if (!slotUsage[key]) slotUsage[key] = [];
        slotUsage[key].push(a.id);
    });
    const duplicates = Object.entries(slotUsage).filter(([_, ids]) => ids.length > 1);
    console.log(`4. Duplicate slot assignments: ${duplicates.length}`);
    if (duplicates.length) console.log(duplicates.slice(0, 5));

    // 5. Completed orders without assignment
    const { data: missingAssignments } = await supabase.from('orders').select('id, depositor_name').eq('status', 'completed');
    const assignedOrderIds = new Set(allAssignments?.map(a => a.order_id));
    const unassignedCompleted = missingAssignments?.filter(o => !assignedOrderIds.has(o.id));
    console.log(`5. Completed orders without an assignment: ${unassignedCompleted?.length || 0}`);
    if (unassignedCompleted?.length) console.log(unassignedCompleted.slice(0, 5));

    console.log('--- DIAGNOSIS END ---');
}

diagnose();
