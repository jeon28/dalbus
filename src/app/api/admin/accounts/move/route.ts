import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { order_id, target_account_id, target_slot_number, target_tidal_password } = body;

        if (!order_id || !target_account_id) {
            return NextResponse.json({ error: 'Order ID and Target Account ID are required' }, { status: 400 });
        }

        // 1. Get current assignment to find source account
        const { data: currentAssignment, error: findError } = await supabaseAdmin
            .from('order_accounts')
            .select('account_id, id')
            .eq('order_id', order_id)
            .single();

        if (findError || !currentAssignment) {
            return NextResponse.json({ error: 'Order is not currently assigned' }, { status: 400 });
        }

        const sourceAccountId = currentAssignment.account_id;

        // 2. Check Target Account availability
        const { data: targetAccount, error: targetError } = await supabaseAdmin
            .from('accounts')
            .select('used_slots, max_slots')
            .eq('id', target_account_id)
            .single();

        if (targetError) throw targetError;

        if (targetAccount.used_slots >= targetAccount.max_slots) {
            return NextResponse.json({ error: 'Target account has no available slots' }, { status: 400 });
        }

        // Check unique slot on target
        if (target_slot_number !== undefined) {
            const { data: collision } = await supabaseAdmin
                .from('order_accounts')
                .select('id')
                .eq('account_id', target_account_id)
                .eq('slot_number', target_slot_number)
                .single();

            if (collision) {
                return NextResponse.json({ error: 'Target slot is already occupied' }, { status: 400 });
            }
        }

        // 3. Perform Move (Update order_accounts)
        const { error: moveError } = await supabaseAdmin
            .from('order_accounts')
            .update({
                account_id: target_account_id,
                slot_number: target_slot_number,
                tidal_password: target_tidal_password,
                assigned_at: new Date().toISOString()
            })
            .eq('id', currentAssignment.id);

        if (moveError) throw moveError;

        // 4. Update used_slots counts
        // Decrement source
        // We need to fetch source account used_slots first? Or just decrement.
        // Supabase doesn't have atomic increment/decrement easily without RPC, 
        // so we fetch, calc, update.

        // Fetch Source
        const { data: sourceAccount } = await supabaseAdmin.from('accounts').select('used_slots').eq('id', sourceAccountId).single();
        if (sourceAccount) {
            await supabaseAdmin.from('accounts').update({ used_slots: Math.max(0, sourceAccount.used_slots - 1) }).eq('id', sourceAccountId);
        }

        // Increment Target
        await supabaseAdmin.from('accounts').update({ used_slots: targetAccount.used_slots + 1 }).eq('id', target_account_id);

        return NextResponse.json({ success: true });

    } catch (error) {
        const e = error as Error;
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
