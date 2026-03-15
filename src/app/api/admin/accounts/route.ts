import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getServerSession, isAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET: Fetch all accounts
export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(req);
        if (!isAdmin(session)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

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
                    orders(
                        id,
                        order_number,
                        created_at,
                        amount,
                        payment_status,
                        assignment_status,
                        user_id,
                        profiles(name, phone, email),
                        products(name)
                    )
                )
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Filter out inactive assignments, re-sort by slot_number, and recalculate used_slots locally for accuracy
        const filteredData = data?.map(account => {
            const activeAssignments = (account.order_accounts || [])
                .filter((oa: { is_active?: boolean }) => oa.is_active !== false)
                .sort((a: { slot_number: number }, b: { slot_number: number }) => a.slot_number - b.slot_number);
            return {
                ...account,
                order_accounts: activeAssignments,
                used_slots: activeAssignments.length
            };
        });

        return NextResponse.json(filteredData);
    } catch (error) {
        const e = error as Error;
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// POST: Create a new shared account
export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(req);
        if (!isAdmin(session)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const body = await req.json();
        // body: product_id, login_id, login_pw, payment_email, payment_day, max_slots, memo

        const normalizedBody = {
            ...body,
            login_id: body.login_id ? body.login_id.toLowerCase().trim() : body.login_id,
            payment_email: body.payment_email ? body.payment_email.toLowerCase().trim() : body.payment_email
        };

        const { data, error } = await supabaseAdmin
            .from('accounts')
            .insert([normalizedBody])
            .select()
            .single();


        if (error) throw error;

        return NextResponse.json(data);
    } catch (error) {
        const e = error as Error;
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
