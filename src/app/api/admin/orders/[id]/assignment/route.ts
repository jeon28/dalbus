import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const { data, error } = await supabaseAdmin
            .from('order_accounts')
            .select(`
                *,
                accounts (
                    id,
                    login_id,
                    max_slots,
                    used_slots,
                    memo
                ),
                orders (
                  id,
                  depositor_name,
                  buyer_email,
                  buyer_phone,
                  product_plans ( duration_months )
                )
            `)
            .eq('order_id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                // Fallback: If no direct match, look for ANY active assignment for this buyer
                const { data: order } = await supabaseAdmin.from('orders').select('buyer_email, buyer_phone').eq('id', id).single();
                if (order && (order.buyer_email || order.buyer_phone)) {
                    let query = supabaseAdmin.from('order_accounts').select(`
                        *,
                        accounts (
                            id,
                            login_id,
                            max_slots,
                            used_slots,
                            memo
                        ),
                        orders (
                            id,
                            depositor_name,
                            buyer_email,
                            buyer_phone,
                            product_plans ( duration_months )
                        )
                    `);
                    if (order.buyer_email) query = query.eq('buyer_email', order.buyer_email);
                    if (order.buyer_phone) query = query.eq('buyer_phone', order.buyer_phone);

                    const { data: fallbackData } = await query.limit(1).maybeSingle();
                    if (fallbackData) {
                        return NextResponse.json({ assignment: fallbackData, isFallback: true });
                    }
                }
                return NextResponse.json({ assignment: null });
            }
            throw error;
        }

        return NextResponse.json({ assignment: data });
    } catch (error) {
        console.error('Assignment lookup error:', error);
        const err = error as { message: string };
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
