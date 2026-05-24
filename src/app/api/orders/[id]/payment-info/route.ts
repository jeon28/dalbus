import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/orders/[id]/payment-info
 *
 * 주문 ID(UUID)는 추측 불가능한 식별자이므로 URL 토큰 역할을 수행합니다.
 * sessionStorage에 계좌 정보를 평문 저장하는 대신, 이 엔드포인트로 매번 조회합니다.
 *
 * - 결제 대기(payment_status = 'pending') 주문에 한해 계좌 정보를 반환
 * - 결제 완료된 주문은 계좌 정보를 다시 노출하지 않음 (재이용·재유포 방지)
 */
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        if (!id || typeof id !== 'string') {
            return NextResponse.json({ error: '잘못된 주문 ID 입니다.' }, { status: 400 });
        }

        const { data: order, error } = await supabaseAdmin
            .from('orders')
            .select(`
                id,
                order_number,
                amount,
                payment_status,
                depositor_name,
                match_code,
                payment_due_at,
                buyer_name,
                buyer_email,
                products ( name ),
                product_plans ( duration_months ),
                assigned_bank_account:bank_accounts!assigned_bank_account_id (
                    id, bank_name, account_number, account_holder
                )
            `)
            .eq('id', id)
            .maybeSingle();

        if (error) {
            console.error('Payment info fetch error:', error);
            return NextResponse.json({ error: '주문 정보를 불러올 수 없습니다.' }, { status: 500 });
        }

        if (!order) {
            return NextResponse.json({ error: '주문을 찾을 수 없습니다.' }, { status: 404 });
        }

        // 결제 완료된 주문은 계좌 정보를 다시 노출하지 않음
        if (order.payment_status !== 'pending') {
            return NextResponse.json({
                order_number: order.order_number,
                payment_status: order.payment_status,
                bank: null,
                match_code: null,
                message: '이미 처리된 주문입니다.'
            });
        }

        const product = Array.isArray(order.products) ? order.products[0] : order.products;
        const plan = Array.isArray(order.product_plans) ? order.product_plans[0] : order.product_plans;
        const bank = Array.isArray(order.assigned_bank_account)
            ? order.assigned_bank_account[0]
            : order.assigned_bank_account;

        return NextResponse.json({
            id: order.id,
            order_number: order.order_number,
            amount: order.amount,
            payment_status: order.payment_status,
            depositor_name: order.depositor_name,
            match_code: order.match_code,
            payment_due_at: order.payment_due_at,
            buyer_name: order.buyer_name,
            buyer_email: order.buyer_email,
            product_name: product?.name || null,
            duration_months: plan?.duration_months || null,
            bank: bank ? {
                bank_name: bank.bank_name,
                account_number: bank.account_number,
                account_holder: bank.account_holder,
            } : null,
        });
    } catch (err) {
        console.error('Payment info handler failed:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
