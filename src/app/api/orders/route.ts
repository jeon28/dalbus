import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendAdminOrderNotification, sendUserOrderNotification } from '@/lib/email';
import { getServerSession } from '@/lib/auth';
import { normalizePhone } from '@/lib/utils';

export async function POST(req: NextRequest) {
    try {
        // getServerSession for logging or optional user info, but allow guests
        await getServerSession(req);

        const body = await req.json();
        const { orderData, product_name, plan_name, extend_tidal_id } = body;

        // Normalize phone number
        const normalizedOrderData = {
            ...orderData,
            buyer_phone: normalizePhone(orderData.buyer_phone),
            order_type: orderData.order_type || 'NEW'
        };

        // 1. Insert order into Supabase
        const { data: order, error: insertError } = await supabaseAdmin
            .from('orders')
            .insert([normalizedOrderData])
            .select()
            .single();


        if (insertError) {
            console.error('Order insert error:', insertError);
            return NextResponse.json({ error: insertError.message }, { status: 500 });
        }

        // 2. Fetch Admin Email Settings
        const { data: adminEmailSetting } = await supabaseAdmin
            .from('site_settings')
            .select('value')
            .eq('key', 'admin_email')
            .single();

        // 3. Send Notification if admin email exists
        if (adminEmailSetting?.value) {
            const notificationParams = {
                orderId: order.order_number,
                productName: product_name,
                planName: plan_name,
                amount: orderData.amount,
                buyerName: normalizedOrderData.buyer_name,
                buyerPhone: normalizedOrderData.buyer_phone,
                depositorName: normalizedOrderData.depositor_name,
                orderType: normalizedOrderData.order_type,
                extendTidalId: extend_tidal_id || null
            };

            // Admin notification
            await sendAdminOrderNotification(adminEmailSetting.value, notificationParams);

            // User notification (using buyer_email from the request)
            if (orderData.buyer_email) {
                await sendUserOrderNotification(orderData.buyer_email, notificationParams);
            }
        }

        return NextResponse.json({ success: true, order });

    } catch (error) {
        console.error('Order creation failed:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
