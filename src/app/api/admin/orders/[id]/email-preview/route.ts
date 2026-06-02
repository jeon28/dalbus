import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * 작업완료 시 발송될 "계정 세팅 완료 안내" 메일의 미리보기를 반환한다.
 * 실제 발송은 하지 않으며, 관리자가 수정 후 발송할 수 있도록 제목/본문/수신자 정보를 제공한다.
 *
 * 배정 정보 조회 로직은 PUT /status 의 발송 로직과 동일하게
 * order_accounts(legacy) → tidal_assignments(new) 순으로 탐색한다.
 */
export async function GET(
    req: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;

    try {
        const { data: orderData, error } = await supabaseAdmin
            .from('orders')
            .select(`
                buyer_email,
                buyer_name,
                products ( name ),
                order_accounts (
                    tidal_id,
                    tidal_password,
                    end_date
                )
            `)
            .eq('id', params.id)
            .single();

        if (error) throw error;

        type OA = { tidal_id: string | null; tidal_password: string | null; end_date: string | null };
        type TidalAcc = { login_pw: string | null };
        type TA = { tidal_id: string | null; tidal_password: string | null; end_date: string | null; is_active: boolean | null; is_deleted: boolean | null; tidal_accounts: TidalAcc | TidalAcc[] | null };
        type OrderRow = {
            buyer_email: string | null;
            buyer_name: string | null;
            products: { name: string } | { name: string }[] | null;
            order_accounts: OA[] | null;
        };

        const order = orderData as OrderRow | null;
        if (!order?.buyer_email) {
            return NextResponse.json({ error: '이메일 정보가 없는 주문입니다.' }, { status: 400 });
        }

        const productName = Array.isArray(order.products)
            ? order.products[0]?.name
            : order.products?.name;
        const buyerName = order.buyer_name || '고객';

        // order_accounts(legacy) → tidal_assignments(new) 순으로 배정 정보 탐색
        let tidalId = '';
        let tidalPw = '';
        let endDate = '';

        const legacyOA = order.order_accounts?.[0];
        if (legacyOA?.tidal_id) {
            tidalId = legacyOA.tidal_id;
            tidalPw = legacyOA.tidal_password || '';
            endDate = legacyOA.end_date || '';
        } else {
            const { data: taRows } = await supabaseAdmin
                .from('tidal_assignments')
                .select(`
                    tidal_id,
                    tidal_password,
                    end_date,
                    is_active,
                    is_deleted,
                    tidal_accounts:account_id ( login_pw )
                `)
                .eq('order_id', params.id)
                .not('is_deleted', 'is', true)
                .eq('is_active', true)
                .limit(1);

            const ta = taRows?.[0] as TA | undefined;
            if (ta?.tidal_id) {
                tidalId = ta.tidal_id;
                const acc = Array.isArray(ta.tidal_accounts) ? ta.tidal_accounts[0] : ta.tidal_accounts;
                tidalPw = ta.tidal_password || acc?.login_pw || '';
                endDate = ta.end_date || '';
            }
        }

        if (!tidalId) {
            return NextResponse.json({ error: '배정된 계정 정보가 없습니다.' }, { status: 400 });
        }

        const { buildAssignmentNotification } = await import('@/lib/email');
        const { subject, html } = await buildAssignmentNotification({
            buyerName,
            productName: productName || '상품',
            tidalId,
            tidalPw,
            endDate
        });

        return NextResponse.json({
            subject,
            html,
            recipientEmail: order.buyer_email,
            recipientName: buyerName
        });
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
