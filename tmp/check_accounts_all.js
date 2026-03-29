const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://etfoluotiejftyqbourd.supabase.co';
const supabaseServiceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0Zm9sdW90aWVqZnR5cWJvdXJkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTM5Nzg0OSwiZXhwIjoyMDg2OTczODQ5fQ.-JCNbTt28P7ocs4GBBcgRToZcOsiXseJl0PzViRj9tU';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

async function checkAccounts() {
    const { data, error } = await supabaseAdmin.from('accounts').select('*, products(name)');
    if (error) console.error(error);
    else console.log('Accounts:', JSON.stringify(data, null, 2));
}
checkAccounts();
