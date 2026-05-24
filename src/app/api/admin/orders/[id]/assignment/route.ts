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
                if (order) {
                    const orConditions: string[] = [];
                    if (order.buyer_email) orConditions.push(`buyer_email.eq.${order.buyer_email}`);
                    if (order.buyer_phone) orConditions.push(`buyer_phone.eq.${order.buyer_phone}`);

                    if (orConditions.length > 0) {
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
                        query = query.or(orConditions.join(','));

                        const { data: fallbackData } = await query.limit(1).maybeSingle();
                        if (fallbackData) {
                            return NextResponse.json({ assignment: fallbackData, isFallback: true });
                        }
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
