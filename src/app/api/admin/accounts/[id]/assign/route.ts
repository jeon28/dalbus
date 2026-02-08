import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: account_id } = await params;
        const body = await req.json();
        const {
            order_id,
            slot_number,
            slot_password,
            // Manual creation fields
            buyer_id, buyer_name, buyer_phone, buyer_email, start_date, end_date
        } = body;

        let targetOrderId = order_id;

        // 1. If no order_id, create a MANUAL order
        if (!targetOrderId && (buyer_name || buyer_email)) {
            // Fetch Account details to get product_id
            const { data: acc } = await supabaseAdmin.from('accounts').select('product_id').eq('id', account_id).single();

            let targetProductId = null;
            let targetPlanId = null;

            if (acc?.product_id) {
                targetProductId = acc.product_id;
                // Fetch a default plan for this product to satisfy NOT NULL constraint
                const { data: plan } = await supabaseAdmin
                    .from('product_plans')
                    .select('id')
                    .eq('product_id', targetProductId)
                    .limit(1)
                    .single();

                // If plan found, use it. If not, we risk constraint violation.
                // Ideally we should handle this, but for now we try best effort or default.
                if (plan) targetPlanId = plan.id;
            }

            // If we rely on triggers for order_number, good.
            // If user_id is nullable (checked schema, yes), we can set null.

            const newOrder = {
                user_id: null,
                product_id: targetProductId,
                plan_id: targetPlanId, // Required
                payment_status: 'paid',
                assignment_status: 'waiting',
                buyer_name: buyer_name || '',
                buyer_phone: buyer_phone || '',
                buyer_email: buyer_email || '',
                start_date: start_date || null,
                end_date: end_date || null,
                amount: 0, // renamed from total_amount, set to 0 for manual
                // quantity removed
                is_guest: true
            };

            const { data: createdOrder, error: createError } = await supabaseAdmin
                .from('orders')
                .insert([newOrder])
                .select()
                .single();

            if (createError) {
                console.error('Manual Order Create Error:', createError);
                throw createError;
            }
            targetOrderId = createdOrder.id;
        }

        if (!targetOrderId) {
            return NextResponse.json({ error: 'Order ID or User Details required' }, { status: 400 });
        }

        // 2. Validate Slot
        // Check if slot is taken
        const { data: existing } = await supabaseAdmin
            .from('order_accounts')
            .select('*')
            .eq('account_id', account_id)
            .eq('slot_number', slot_number) // Assume slot_number is 0-indexed integer
            .single();

        if (existing) {
            return NextResponse.json({ error: 'Slot is already taken' }, { status: 409 });
        }

        // 3. Create Assignment
        const { error: insertError } = await supabaseAdmin
            .from('order_accounts')
            .insert({
                order_id: targetOrderId,
                account_id: account_id,
                slot_number: slot_number,
                slot_password: slot_password
            });

        if (insertError) throw insertError;

        // 4. Update Account Used Slots
        const { data: account } = await supabaseAdmin.from('accounts').select('used_slots').eq('id', account_id).single();
        if (account) {
            await supabaseAdmin.from('accounts').update({ used_slots: account.used_slots + 1 }).eq('id', account_id);
        }

        // 5. Update Order Status
        await supabaseAdmin
            .from('orders')
            .update({
                assignment_status: 'assigned',
                assigned_at: new Date().toISOString()
            })
            .eq('id', targetOrderId);

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Assign Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
