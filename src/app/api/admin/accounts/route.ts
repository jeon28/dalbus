import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

// GET: Fetch all accounts
export async function GET() {
    try {
        const { data, error } = await supabaseAdmin
            .from('accounts')
            .select(`
                *,
                products ( name ),
                order_accounts (
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
                    orders (
                        id,
                        order_number,
                        start_date,
                        end_date,
                        created_at,
                        amount,
                        payment_status,
                        assignment_status,
                        user_id,
                        profiles ( name, phone, email ),
                        products ( name )
                    )
                )
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Also fetch order_accounts to see current assignments if needed, 
        // but for now simpler to just fetch accounts and let frontend query details or we join here.
        // Actually, let's fetch orders assigned to these accounts.

        // Better strategy: Fetch accounts, then for each account, fetch active assignments.
        // Or RLS policy might be enough? Admin has full access.

        // Let's rely on client fetching or a joined query if Supabase supports it well.
        // For simpler UI, we can just return accounts first.

        return NextResponse.json(data);
    } catch (error) {
        const e = error as Error;
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// POST: Create a new shared account
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        // body: product_id, login_id, login_pw, payment_email, payment_day, max_slots, memo

        const { data, error } = await supabaseAdmin
            .from('accounts')
            .insert([body])
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json(data);
    } catch (error) {
        const e = error as Error;
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
