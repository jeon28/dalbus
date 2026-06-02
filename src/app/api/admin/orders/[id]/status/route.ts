import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NextRequest, NextResponse } from 'next/server';

export async function PUT(
    req: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;

    try {
        const body = await req.json();
        const updates: Record<string, string> = {};

        if (body.payment_status) updates.payment_status = body.payment_status;
        if (body.assignment_status) updates.assignment_status = body.assignment_status;

        // Backward compatibility
        if (body.status && !body.assignment_status) updates.assignment_status = body.status;

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'No status provided' }, { status: 400 });
        }

        const { error } = await supabaseAdmin
            .from('orders')
            .update(updates)
            .eq('id', params.id);

        if (error) throw error;

        // If status is updated to 'completed', send email to buyer
        if (updates.assignment_status === 'completed') {
            // 관리자가 미리보기에서 메일을 발송하지 않기로 선택한 경우
            if (body.skipEmail) {
                return NextResponse.json({ success: true, emailSent: false });
            }
            try {
                const { data: orderData } = await supabaseAdmin
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
                    return NextResponse.json({ success: true, emailSent: false, emailError: 'No buyer email' });
                }

                const productName = Array.isArray(order.products)
                    ? order.products[0]?.name
                    : order.products?.name;
                const buyerName = order.buyer_name || '고객';

                // Try order_accounts first (legacy), then tidal_assignments (new system)
                let tidalId = '';
                let tidalPw = '';
                let endDate = '';

                const legacyOA = order.order_accounts?.[0];
                if (legacyOA?.tidal_id) {
                    tidalId = legacyOA.tidal_id;
                    tidalPw = legacyOA.tidal_password || '';
                    endDate = legacyOA.end_date || '';
                } else {
                    // Fetch from tidal_assignments
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
                    return NextResponse.json({ success: true, emailSent: false, emailError: 'No assignment found' });
                }

                let emailResult;
                // 관리자가 미리보기에서 제목/본문을 수정해 보낸 경우 그대로 사용
                if (typeof body.emailSubject === 'string' && typeof body.emailHtml === 'string') {
                    const { sendEmail } = await import('@/lib/email');
                    emailResult = await sendEmail({
                        recipient_email: order.buyer_email,
                        recipient_name: buyerName,
                        subject: body.emailSubject,
                        html: body.emailHtml,
                        mailType: '계정 세팅 완료 안내'
                    });
                } else {
                    const { sendAssignmentNotification } = await import('@/lib/email');
                    emailResult = await sendAssignmentNotification(order.buyer_email, {
                        buyerName,
                        productName: productName || '상품',
                        tidalId,
                        tidalPw,
                        endDate
                    });
                }

                if (!emailResult.success) {
                    console.error('Assignment email failed for order', params.id, ':', emailResult.error);
                }

                return NextResponse.json({
                    success: true,
                    emailSent: emailResult.success,
                    emailError: emailResult.error
                });
            } catch (notifyError) {
                console.error('Failed to send assignment notification:', notifyError);
                return NextResponse.json({
                    success: true,
                    emailSent: false,
                    emailError: notifyError instanceof Error ? notifyError.message : 'Unknown notification error'
                });
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
