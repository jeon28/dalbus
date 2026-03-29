const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://etfoluotiejftyqbourd.supabase.co';
const supabaseServiceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0Zm9sdW90aWVqZnR5cWJvdXJkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTM5Nzg0OSwiZXhwIjoyMDg2OTczODQ5fQ.-JCNbTt28P7ocs4GBBcgRToZcOsiXseJl0PzViRj9tU';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

async function checkOrders() {
    const { data: assignments, error } = await supabaseAdmin.from('order_accounts').select('*, accounts(products(name))').limit(10);
    if (error) console.error(error);
    else console.log('Sample Assignments:', JSON.stringify(assignments, null, 2));
}
checkOrders();
