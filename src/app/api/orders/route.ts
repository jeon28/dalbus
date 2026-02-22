import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendAdminOrderNotification } from '@/lib/email';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { orderData, product_name, plan_name } = body;

        // 1. Insert order into Supabase
        const { data: order, error: insertError } = await supabaseAdmin
            .from('orders')
            .insert([{
                ...orderData,
                order_type: orderData.order_type || 'NEW'
            }])
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
            await sendAdminOrderNotification(adminEmailSetting.value, {
                orderId: order.order_number,
                productName: product_name,
                planName: plan_name,
                amount: orderData.amount,
                buyerName: orderData.buyer_name,
                buyerPhone: orderData.buyer_phone,
                depositorName: orderData.depositor_name
            });
        }

        return NextResponse.json({ success: true, order });

    } catch (error) {
        console.error('Order creation failed:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
