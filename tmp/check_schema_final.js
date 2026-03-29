
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://etfoluotiejftyqbourd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0Zm9sdW90aWVqZnR5cWJvdXJkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTM5Nzg0OSwiZXhwIjoyMDg2OTczODQ5fQ.-JCNbTt28P7ocs4GBBcgRToZcOsiXseJl0PzViRj9tU');

async function check() {
    const { data: o } = await supabase.from('orders').select('*').limit(1);
    if (o) console.log('Orders:', Object.keys(o[0]));
    const { data: oa } = await supabase.from('order_accounts').select('*').limit(1);
    if (oa) console.log('OrderAccounts:', Object.keys(oa[0]));
}
check();
