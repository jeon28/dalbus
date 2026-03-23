const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(
  'https://etfoluotiejftyqbourd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0Zm9sdW90aWVqZnR5cWJvdXJkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTM5Nzg0OSwiZXhwIjoyMDg2OTczODQ5fQ.-JCNbTt28P7ocs4GBBcgRToZcOsiXseJl0PzViRj9tU'
);

async function checkSchema() {
    const { data, error } = await supabaseAdmin.from('order_accounts').select('*').limit(1);
    if (error) {
        console.error('Error:', error);
    } else if (data && data.length > 0) {
        console.log('Columns in order_accounts:', Object.keys(data[0]));
    } else {
        console.log('No rows returned, inserting a dummy to test columns? Or we just accept empty');
    }
}
checkSchema();
