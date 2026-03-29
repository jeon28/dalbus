const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://etfoluotiejftyqbourd.supabase.co';
const supabaseServiceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0Zm9sdW90aWVqZnR5cWJvdXJkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTM5Nzg0OSwiZXhwIjoyMDg2OTczODQ5fQ.-JCNbTt28P7ocs4GBBcgRToZcOsiXseJl0PzViRj9tU';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

async function checkRLS() {
    const { data, error } = await supabaseAdmin.rpc('get_policies_for_table', { table_name: 'profiles' });
    if (error) {
        // Fallback: check schema
        const { data: d2, error: e2 } = await supabaseAdmin.from('pg_policies').select('*').eq('tablename', 'profiles');
        console.log('RLS Policies for profiles:', d2 || e2);
    } else {
        console.log('Policies:', data);
    }
}
checkRLS();
