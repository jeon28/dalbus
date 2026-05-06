import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const product = searchParams.get('product') || '';

        // tidal_assignments table is used for standard Tidal accounts
        if (!product || product.toLowerCase().includes('tidal')) {
            const { data, error } = await supabaseAdmin
                .from('tidal_assignments')
                .select(`
                    *,
                    accounts:tidal_accounts!inner (
                        id,
                        login_id
                    ),
                    orders (
                        order_number,
                        buyer_name,
                        buyer_email,
                        buyer_phone,
                        profiles ( name, phone )
                    )
                `)
                .eq('is_active', false)
                .not('is_deleted', 'is', true)
                .order('assigned_at', { ascending: false });

            if (error) throw error;
            return NextResponse.json(data);
        }

        // Fallback: order_accounts for other product types
        const { data, error } = await supabaseAdmin
            .from('order_accounts')
            .select(`
                *,
                accounts!inner (
                    login_id,
                    products!inner ( name, slug )
                ),
                orders (
                    order_number,
                    buyer_name,
                    buyer_email,
                    buyer_phone,
                    profiles ( name, phone )
                )
            `)
            .eq('is_active', false)
            .eq('is_deleted', false)
            .ilike('accounts.products.slug', `%${product}%`)
            .order('assigned_at', { ascending: false });

        if (error) throw error;
        return NextResponse.json(data);
    } catch (error) {
        const e = error as Error;
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
