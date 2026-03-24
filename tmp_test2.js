const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(
  'https://etfoluotiejftyqbourd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0Zm9sdW90aWVqZnR5cWJvdXJkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTM5Nzg0OSwiZXhwIjoyMDg2OTczODQ5fQ.-JCNbTt28P7ocs4GBBcgRToZcOsiXseJl0PzViRj9tU'
);

async function test() {
    const { data, error } = await supabaseAdmin.rpc('get_enum_values', { enum_name: 'account_status' });
    if (error) {
        console.error('RPC Error:', error);
        // Fallback: Just select from accounts limit 1 to see status values
        const res = await supabaseAdmin.from('accounts').select('status').limit(5);
        console.log('Sample statuses:', res.data);
    } else {
        console.log('Enum values:', data);
    }
}

test();
