// A temporary API route to check the constraints on the order_accounts table directly via PostgreSQL system catalogs.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // Query the PostgreSQL pg_indexes or pg_constraint tables
        await supabaseAdmin.rpc('get_schema_info');
        
        // If rpc isn't available, we'll try a raw sql query if possible (supabase js doesn't support raw sql directly)
        // Let's attempt to insert two nulls and see the EXACT error message 
        
        // Setup mock master
        const { data: products } = await supabaseAdmin.from('products').select('id').limit(1);
        
        const testLogin = 'XYZ-NULL-TEST-' + Date.now();
        const { data: master } = await supabaseAdmin.from('accounts').insert({
            login_id: testLogin,
            payment_email: 'test@test.com',
            payment_day: 1,
            product_id: products[0].id,
            max_slots: 6,
            used_slots: 0
        }).select('id').single();
        
        const errors = [];
        
        // Insert Slot 1
        const { error: err1 } = await supabaseAdmin.from('order_accounts').insert({
            account_id: master.id,
            slot_number: 1,
            tidal_id: null,
            tidal_password: null
        });
        if (err1) errors.push({ phase: 'Slot 1 Insert', error: err1 });
        
        // Insert Slot 2
        const { error: err2 } = await supabaseAdmin.from('order_accounts').insert({
            account_id: master.id,
            slot_number: 2,
            tidal_id: null,
            tidal_password: null
        });
        if (err2) errors.push({ phase: 'Slot 2 Insert', error: err2 });
        
        // Insert Slot 3 (Empty string)
        const { error: err3 } = await supabaseAdmin.from('order_accounts').insert({
            account_id: master.id,
            slot_number: 3,
            tidal_id: '',
            tidal_password: ''
        });
        if (err3) errors.push({ phase: 'Slot 3 Insert (Empty string)', error: err3 });

        // Clean up
        await supabaseAdmin.from('accounts').delete().eq('id', master.id);
        
        return NextResponse.json({
            status: 'Test Completed',
            errors_encountered: errors
        });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
