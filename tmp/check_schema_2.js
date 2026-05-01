
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkColumns() {
    const { data: oData } = await supabase.from('orders').select('*').limit(1);
    if (oData && oData.length > 0) console.log('Order Columns:', Object.keys(oData[0]));
    
    const { data: oaData } = await supabase.from('order_accounts').select('*').limit(1);
    if (oaData && oaData.length > 0) console.log('OrderAccount Columns:', Object.keys(oaData[0]));
}

checkColumns();
