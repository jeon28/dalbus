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
            try {
                type OrderWithDetails = {
                    buyer_email: string | null;
                    buyer_name: string | null;
                    products: { name: string } | { name: string }[] | null;
                    order_accounts: {
                        tidal_id: string | null;
                        tidal_password: string | null;
                        end_date: string | null;
                    }[] | null;
                };

                const { data } = await supabaseAdmin
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

                const order = data as OrderWithDetails | null;

                if (order && order.buyer_email && order.order_accounts && order.order_accounts.length > 0) {
                    const { sendAssignmentNotification } = await import('@/lib/email');
                    const oa = order.order_accounts[0];
                    const productName = Array.isArray(order.products)
                        ? order.products[0]?.name
                        : order.products?.name;

                    const emailResult = await sendAssignmentNotification(order.buyer_email, {
                        buyerName: order.buyer_name || '고객',
                        productName: productName || '상품',
                        tidalId: oa.tidal_id || '',
                        tidalPw: oa.tidal_password || '',
                        endDate: oa.end_date || ''
                    });

                    if (!emailResult.success) {
                        console.error('Assignment email failed for order', params.id, ':', emailResult.error);
                    }

                    return NextResponse.json({
                        success: true,
                        emailSent: emailResult.success,
                        emailError: emailResult.error
                    });
                }
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
