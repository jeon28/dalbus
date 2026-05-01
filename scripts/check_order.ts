import { createClient } from '@supabase/supabase-js';

// dotenv logic removed to avoid dependency issue in temp script

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
    const relatedOrderId = '209b2784-fff4-4574-8d10-44070e8d836e';

    console.log('Checking Order:', relatedOrderId);
    const { data: order } = await supabaseAdmin.from('orders').select('*').eq('id', relatedOrderId).single();
    console.log('Order Data:', order);

    console.log('Checking Assignments for Order ID:', relatedOrderId);
    const { data: assignments } = await supabaseAdmin.from('order_accounts').select('*').eq('order_id', relatedOrderId);
    console.log('Assignments:', assignments);

    console.log('Checking all assignments for any order that has this as related_order_id');
    const { data: extensions } = await supabaseAdmin.from('orders').select('*').eq('related_order_id', relatedOrderId);
    console.log('Extension Orders:', extensions);
}

check();
