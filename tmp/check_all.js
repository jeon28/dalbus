const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://etfoluotiejftyqbourd.supabase.co';
const supabaseServiceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0Zm9sdW90aWVqZnR5cWJvdXJkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTM5Nzg0OSwiZXhwIjoyMDg2OTczODQ5fQ.-JCNbTt28P7ocs4GBBcgRToZcOsiXseJl0PzViRj9tU';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

async function checkProducts() {
    const { data: products, error } = await supabaseAdmin.from('products').select('*');
    if (error) console.error(error);
    else console.log('Products:', JSON.stringify(products, null, 2));

    const { data: profiles, error: pErr } = await supabaseAdmin.from('profiles').select('*').eq('role', 'admin');
    if (pErr) console.error(pErr);
    else console.log('Admins:', JSON.stringify(profiles, null, 2));
}
checkProducts();
