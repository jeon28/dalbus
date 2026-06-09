import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendAdminOrderNotification, sendUserOrderNotification } from '@/lib/email';
import { getServerSession } from '@/lib/auth';
import { normalizePhone } from '@/lib/utils';
import { validateEmail } from '@/lib/emailValidation';

// validateEmail 이 dns 모듈을 사용 — Edge 런타임 회피
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
    try {
        // getServerSession for logging or optional user info, but allow guests
        await getServerSession(req);

        const body = await req.json();
        const { orderData, product_name, plan_name, extend_tidal_id } = body;

        // 0. 구매자 이메일 검증 (형식 + 차단 도메인 + 실제 수신 가능 여부)
        //    메일을 받을 수 없는 도메인으로는 주문이 완료되지 않도록 서버에서 차단
        if (orderData?.buyer_email) {
            const emailCheck = await validateEmail(orderData.buyer_email);
            if (!emailCheck.valid) {
                return NextResponse.json({ error: emailCheck.message }, { status: 400 });
            }
        }

        // 1. 활성화된 입금 계좌 중 1개 자동 할당 (라운드로빈)
        //    클라이언트의 계좌 선택을 신뢰하지 않고 서버에서 결정
        const { data: activeBanks, error: bankFetchError } = await supabaseAdmin
            .from('bank_accounts')
            .select('id')
            .eq('is_active', true)
            .order('sort_order', { ascending: true });

        if (bankFetchError) {
            console.error('Bank accounts fetch error:', bankFetchError);
            return NextResponse.json({ error: '결제 계좌 정보를 불러올 수 없습니다.' }, { status: 500 });
        }
        if (!activeBanks || activeBanks.length === 0) {
            return NextResponse.json({ error: '등록된 결제 계좌가 없습니다. 관리자에게 문의해주세요.' }, { status: 503 });
        }

        // 가장 최근 pending 주문의 계좌를 회피하여 부하 분산
        const { data: lastPendingOrder } = await supabaseAdmin
            .from('orders')
            .select('assigned_bank_account_id')
            .eq('payment_status', 'pending')
            .not('assigned_bank_account_id', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        const lastBankId = lastPendingOrder?.assigned_bank_account_id;
        const nextBank = activeBanks.find(b => b.id !== lastBankId) || activeBanks[0];

        // Normalize phone number + 서버 측 계좌/입금 메타데이터 주입
        const normalizedOrderData = {
            ...orderData,
            buyer_phone: normalizePhone(orderData.buyer_phone),
            order_type: orderData.order_type || 'NEW',
            assigned_bank_account_id: nextBank.id,
            // match_code, payment_due_at 는 DB 트리거가 자동 부여
        };

        // 2. Insert order into Supabase
        //    bank_accounts join 은 PostgREST schema cache 의존성이 있어 안정성을 위해 분리
        //    계좌 정보는 결제 안내 페이지에서 /api/orders/[id]/payment-info 로 별도 조회
        const { data: order, error: insertError } = await supabaseAdmin
            .from('orders')
            .insert([normalizedOrderData])
            .select('*')
            .single();


        if (insertError) {
            console.error('Order insert error:', insertError);
            return NextResponse.json({ error: insertError.message }, { status: 500 });
        }

        // 3. Fetch Admin Email Settings
        const { data: adminEmailSetting } = await supabaseAdmin
            .from('site_settings')
            .select('value')
            .eq('key', 'admin_email')
            .single();

        // 4. Send Notification if admin email exists
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
