import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { addMonths, format, parseISO } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: account_id } = await params;
        const body = await req.json();
        const {
            order_id,
            order_number,
            slot_number,
            tidal_password,
            tidal_id,
            type,
            // Manual creation fields
            buyer_name, buyer_phone, buyer_email, start_date, end_date
        } = body;

        let targetOrderId = order_id;
        let finalOrderNumber = order_number;
        let finalStartDate = start_date;
        let finalEndDate = end_date;

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
                    .select('id, duration_months')
                    .eq('product_id', targetProductId)
                    .limit(1)
                    .single();

                if (plan) {
                    targetPlanId = plan.id;
                    const durationMonths = plan.duration_months || 1;

                    // Automate dates for manual order
                    const now = new Date();
                    finalStartDate = finalStartDate || format(now, 'yyyy-MM-dd');
                    finalEndDate = finalEndDate || format(addMonths(parseISO(finalStartDate), durationMonths), 'yyyy-MM-dd');
                }
            }

            const newOrder = {
                user_id: null,
                product_id: targetProductId,
                plan_id: targetPlanId,
                payment_status: 'paid',
                assignment_status: 'waiting',
                buyer_name: buyer_name || '',
                buyer_phone: buyer_phone || '',
                buyer_email: buyer_email || '',
                start_date: finalStartDate,
                end_date: finalEndDate,
                amount: 0,
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
            finalOrderNumber = createdOrder.order_number; // Use generated order_number
        }

        if (!targetOrderId) {
            return NextResponse.json({ error: 'Order ID or User Details required' }, { status: 400 });
        }

        // If order_id was provided but not order_number, fetch it
        let finalBuyerName = buyer_name;
        let finalBuyerPhone = buyer_phone;
        let finalBuyerEmail = buyer_email;

        // If order_id was provided, fetch any missing info from the orders table
        if (targetOrderId) {
            const { data: ord } = await supabaseAdmin
                .from('orders')
                .select(`
                    order_number, 
                    buyer_name, 
                    buyer_phone, 
                    buyer_email, 
                    created_at, 
                    start_date, 
                    end_date,
                    product_plans ( duration_months )
                `)
                .eq('id', targetOrderId)
                .single();

            if (ord) {
                if (!finalOrderNumber) finalOrderNumber = ord.order_number;
                if (!finalBuyerName) finalBuyerName = ord.buyer_name;
                if (!finalBuyerPhone) finalBuyerPhone = ord.buyer_phone;
                if (!finalBuyerEmail) finalBuyerEmail = ord.buyer_email;

                // Date automation for existing order
                // "주문날을 가입일에 저장" -> start_date = created_at
                const orderDate = ord.created_at ? new Date(ord.created_at) : new Date();
                finalStartDate = ord.start_date || format(orderDate, 'yyyy-MM-dd');

                const durationMonths = (ord.product_plans as unknown as { duration_months: number })?.duration_months || 1;
                finalEndDate = ord.end_date || format(addMonths(parseISO(finalStartDate), durationMonths), 'yyyy-MM-dd');

                // Sync dates back to orders table
                await supabaseAdmin
                    .from('orders')
                    .update({
                        start_date: finalStartDate,
                        end_date: finalEndDate
                    })
                    .eq('id', targetOrderId);
            }
        }

        // 2. Validate Slot
        const { data: existing } = await supabaseAdmin
            .from('order_accounts')
            .select('*')
            .eq('account_id', account_id)
            .eq('slot_number', slot_number)
            .single();

        if (existing) {
            return NextResponse.json({ error: 'Slot is already taken' }, { status: 409 });
        }

        // 3. Create Assignment
        const { error: insertError } = await supabaseAdmin
            .from('order_accounts')
            .insert({
                order_id: targetOrderId,
                order_number: finalOrderNumber,
                account_id: account_id,
                slot_number: slot_number,
                tidal_password: tidal_password,
                tidal_id: tidal_id || null,
                type: type || (slot_number === 0 ? 'master' : 'user'),
                buyer_name: finalBuyerName || null,
                buyer_phone: finalBuyerPhone || null,
                buyer_email: finalBuyerEmail || null
            });

        if (insertError) throw insertError;

        // 4. Update Account Used Slots (Robust Sync)
        const { count: actualCount } = await supabaseAdmin
            .from('order_accounts')
            .select('*', { count: 'exact', head: true })
            .eq('account_id', account_id);

        await supabaseAdmin.from('accounts').update({ used_slots: actualCount || 0 }).eq('id', account_id);

        // 5. Update Order Status
        await supabaseAdmin
            .from('orders')
            .update({
                assignment_status: 'assigned',
                assigned_at: new Date().toISOString()
            })
            .eq('id', targetOrderId);

        return NextResponse.json({ success: true });

    } catch (error) {
        const e = error as { code?: string; message: string };
        console.error('Assign Error:', e);
        if (e.code === '23505') {
            return NextResponse.json({ error: '이미 사용 중인 Tidal ID입니다. 다른 ID를 입력해주세요.' }, { status: 409 });
        }
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
