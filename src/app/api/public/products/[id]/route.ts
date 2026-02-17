import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { data, error } = await supabaseAdmin
            .from('products')
            .select(`
                *,
                product_plans (*)
            `)
            .eq('id', id)
            .eq('product_plans.is_active', true)
            .single();

        if (error) {
            console.error('Error fetching public product detail:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Unexpected error in public product detail api:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
