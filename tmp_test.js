const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(
  'https://etfoluotiejftyqbourd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0Zm9sdW90aWVqZnR5cWJvdXJkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTM5Nzg0OSwiZXhwIjoyMDg2OTczODQ5fQ.-JCNbTt28P7ocs4GBBcgRToZcOsiXseJl0PzViRj9tU'
);

async function test() {
    console.log('Fetching accounts...');
    const { data, error } = await supabaseAdmin
        .from('accounts')
        .select(`
            *,
            products ( name ),
            order_accounts(
                id,
                assigned_at,
                slot_number,
                tidal_password,
                tidal_id,
                type,
                buyer_name,
                buyer_phone,
                buyer_email,
                order_number,
                start_date,
                end_date,
                is_active,
                amount,
                period_months,
                orders(
                    id,
                    order_number,
                    created_at,
                    amount,
                    payment_status,
                    assignment_status,
                    user_id,
                    profiles(name, phone, email, memo),
                    products(name)
                )
            )
        `)
        .neq('status', 'deleted')
        .order('created_at', { ascending: false });
    
    if (error) {
        console.error('Supabase Error:', error);
    } else {
        console.log('Success, data length:', data.length);
    }
}

test();
