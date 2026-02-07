import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { product_id, duration_months, price, discount_rate, is_active } = body;

        const { data, error } = await supabaseAdmin
            .from('product_plans')
            .insert({
                product_id,
                duration_months,
                price,
                discount_rate,
                is_active
            })
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (e) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
}
