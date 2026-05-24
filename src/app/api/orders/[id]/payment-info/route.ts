import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/orders/[id]/payment-info
 *
 * 주문 ID(UUID)는 추측 불가능한 식별자이므로 URL 토큰 역할을 수행합니다.
 * sessionStorage 에 계좌 정보를 평문 저장하는 대신, 이 엔드포인트로 매번 조회합니다.
 *
 * - 결제 대기(payment_status = 'pending') 주문에 한해 계좌 정보를 반환
 * - 결제 완료된 주문은 계좌 정보를 다시 노출하지 않음 (재이용·재유포 방지)
 * - PostgREST FK 자동인식 의존성을 피하기 위해 join 대신 별도 쿼리로 처리
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

        // 1. 주문 본체 조회
        const { data: order, error } = await supabaseAdmin
            .from('orders')
            .select(`
                id,
                order_number,
                amount,
                payment_status,
                depositor_name,
                payment_due_at,
                buyer_name,
                buyer_email,
                product_id,
                plan_id,
                assigned_bank_account_id
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

        // 2. 결제 완료된 주문은 계좌 정보를 다시 노출하지 않음
        if (order.payment_status !== 'pending') {
            return NextResponse.json({
                order_number: order.order_number,
                payment_status: order.payment_status,
                bank: null,
                message: '이미 처리된 주문입니다.'
            });
        }

        // 3. 상품/플랜/계좌 정보 병렬 조회 (PostgREST FK 의존성 회피)
        const [productRes, planRes, bankRes] = await Promise.all([
            order.product_id
                ? supabaseAdmin.from('products').select('name').eq('id', order.product_id).maybeSingle()
                : Promise.resolve({ data: null, error: null }),
            order.plan_id
                ? supabaseAdmin.from('product_plans').select('duration_months').eq('id', order.plan_id).maybeSingle()
                : Promise.resolve({ data: null, error: null }),
            order.assigned_bank_account_id
                ? supabaseAdmin
                      .from('bank_accounts')
                      .select('bank_name, account_number, account_holder')
                      .eq('id', order.assigned_bank_account_id)
                      .maybeSingle()
                : Promise.resolve({ data: null, error: null }),
        ]);

        return NextResponse.json({
            id: order.id,
            order_number: order.order_number,
            amount: order.amount,
            payment_status: order.payment_status,
            depositor_name: order.depositor_name,
            payment_due_at: order.payment_due_at,
            buyer_name: order.buyer_name,
            buyer_email: order.buyer_email,
            product_name: productRes.data?.name || null,
            duration_months: planRes.data?.duration_months || null,
            bank: bankRes.data
                ? {
                      bank_name: bankRes.data.bank_name,
                      account_number: bankRes.data.account_number,
                      account_holder: bankRes.data.account_holder,
                  }
                : null,
        });
    } catch (err) {
        console.error('Payment info handler failed:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
