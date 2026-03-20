import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { addDays, format, parseISO } from 'date-fns';

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
            const { data: acc } = await supabaseAdmin.from('accounts').select('product_id').eq('id', account_id).single();

            let targetProductId = null;
            let targetPlanId = null;

            if (acc?.product_id) {
                targetProductId = acc.product_id;
                const { data: plan } = await supabaseAdmin
                    .from('product_plans')
                    .select('id, duration_months')
                    .eq('product_id', targetProductId)
                    .limit(1)
                    .single();

                if (plan) {
                    targetPlanId = plan.id;
                    const durationMonths = plan.duration_months || 1;
                    const now = new Date();
                    finalStartDate = finalStartDate || format(now, 'yyyy-MM-dd');
                    finalEndDate = finalEndDate || format(addDays(parseISO(finalStartDate), durationMonths * 30), 'yyyy-MM-dd');
                }
            }

            const { data: createdOrder, error: createError } = await supabaseAdmin
                .from('orders')
                .insert([{
                    user_id: null,
                    product_id: targetProductId,
                    plan_id: targetPlanId,
                    payment_status: 'paid',
                    assignment_status: 'waiting',
                    buyer_name: buyer_name || '',
                    buyer_phone: buyer_phone || '',
                    buyer_email: buyer_email || '',
                    amount: 0,
                    is_guest: true
                }])
                .select()
                .single();

            if (createError) throw createError;
            targetOrderId = createdOrder.id;
            finalOrderNumber = createdOrder.order_number;
        }

        if (!targetOrderId) {
            return NextResponse.json({ error: 'Order ID or User Details required' }, { status: 400 });
        }

        let finalBuyerName = buyer_name;
        let finalBuyerPhone = buyer_phone;
        let finalBuyerEmail = buyer_email;

        // Fetch order details if needed
        const { data: ord } = await supabaseAdmin
            .from('orders')
            .select(`
                order_number, 
                buyer_name, 
                buyer_phone, 
                buyer_email, 
                created_at, 
                product_plans ( duration_months )
            `)
            .eq('id', targetOrderId)
            .single();

        if (ord) {
            if (!finalOrderNumber) finalOrderNumber = ord.order_number;
            if (!finalBuyerName) finalBuyerName = ord.buyer_name;
            if (!finalBuyerPhone) finalBuyerPhone = ord.buyer_phone;
            if (!finalBuyerEmail) finalBuyerEmail = ord.buyer_email;

            const orderDate = ord.created_at ? new Date(ord.created_at) : new Date();
            finalStartDate = finalStartDate || format(orderDate, 'yyyy-MM-dd');
            const durationMonths = (ord.product_plans as { duration_months?: number } | null)?.duration_months || 1;
            finalEndDate = finalEndDate || format(addDays(parseISO(finalStartDate), durationMonths * 30), 'yyyy-MM-dd');
        }

        // 2. Determine Slot Number and Type
        let finalSlotNumber = slot_number;
        let finalType = type;

        // Fetch current assignments to determine next slot or validate existing
        const { data: currentAssignments, error: fetchError } = await supabaseAdmin
            .from('order_accounts')
            .select('id, slot_number, type')
            .eq('account_id', account_id)
            .order('slot_number', { ascending: true });

        if (fetchError) throw fetchError;

        if (finalSlotNumber === undefined || finalSlotNumber === null) {
            // Pick next available
            finalSlotNumber = currentAssignments?.length || 0;
        }

        if (!finalType) {
            // If it's the first slot ever (index 0), it's default master
            if (finalSlotNumber === 0 && (!currentAssignments || currentAssignments.length === 0)) {
                finalType = 'master';
            } else {
                finalType = 'user';
            }
        }

        // 3. Check for existing at this slot
        const existingAssignment = currentAssignments?.find(a => a.slot_number === finalSlotNumber) as {
            id?: string;
            order_id?: string;
            buyer_email?: string;
            buyer_name?: string;
            tidal_password?: string;
            tidal_id?: string;
            type?: string;
            buyer_phone?: string;
        } | undefined;

        if (existingAssignment) {
            const { data: targetOrder } = await supabaseAdmin
                .from('orders')
                .select('related_order_id, order_type, buyer_email, buyer_name')
                .eq('id', targetOrderId)
                .single();

            const isSameOrder = targetOrderId === existingAssignment?.order_id;
            const isExtensionOfExisting = targetOrder?.related_order_id === existingAssignment?.order_id;
            const isBuyerMatch = targetOrder?.order_type === 'EXT' &&
                ((targetOrder.buyer_email && targetOrder.buyer_email === existingAssignment?.buyer_email) ||
                    (targetOrder.buyer_name && targetOrder.buyer_name === existingAssignment?.buyer_name));

            if (!isSameOrder && !isExtensionOfExisting && !isBuyerMatch) {
                return NextResponse.json({
                    error: `선택하신 슬롯(${finalSlotNumber + 1}번)은 이미 다른 주문이 점유하고 있습니다.`
                }, { status: 409 });
            }

            const { error: updateError } = await supabaseAdmin
                .from('order_accounts')
                .update({
                    order_id: targetOrderId,
                    order_number: finalOrderNumber,
                    tidal_password: tidal_password || existingAssignment?.tidal_password,
                    tidal_id: tidal_id || existingAssignment?.tidal_id,
                    type: finalType || existingAssignment?.type,
                    buyer_name: finalBuyerName || existingAssignment?.buyer_name,
                    buyer_phone: finalBuyerPhone || existingAssignment?.buyer_phone,
                    buyer_email: finalBuyerEmail || existingAssignment?.buyer_email,
                    start_date: finalStartDate,
                    end_date: end_date || finalEndDate
                })
                .eq('id', existingAssignment?.id);

            if (updateError) throw updateError;
        } else {
            const { error: insertError } = await supabaseAdmin
                .from('order_accounts')
                .insert([{
                    order_id: targetOrderId,
                    order_number: finalOrderNumber,
                    account_id: account_id,
                    slot_number: finalSlotNumber,
                    tidal_password: tidal_password,
                    tidal_id: tidal_id || null,
                    type: finalType,
                    buyer_name: finalBuyerName || null,
                    buyer_phone: finalBuyerPhone || null,
                    buyer_email: finalBuyerEmail || null,
                    start_date: finalStartDate,
                    end_date: finalEndDate
                }]);

            if (insertError) throw insertError;
        }

        // Sync Used Slots
        const { count: actualCount } = await supabaseAdmin
            .from('order_accounts')
            .select('*', { count: 'exact', head: true })
            .eq('account_id', account_id)
            .eq('is_active', true);

        await supabaseAdmin.from('accounts').update({ used_slots: actualCount || 0 }).eq('id', account_id);

        // Update Order Status (But NOT start_date/end_date on order table)
        await supabaseAdmin
            .from('orders')
            .update({
                assignment_status: 'assigned',
                assigned_at: new Date().toISOString()
            })
            .eq('id', targetOrderId);

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Assign Error:', error);
        const err = error as { code?: string; message: string };
        if (err.code === '23505') {
            return NextResponse.json({ error: '이미 사용 중인 Tidal ID입니다.' }, { status: 409 });
        }
        return NextResponse.json({ error: err.message || '알 수 없는 오류가 발생했습니다.' }, { status: 500 });
    }
}
