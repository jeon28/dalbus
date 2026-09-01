import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;

        if (!id) {
            return NextResponse.json({ error: '상품 ID가 제공되지 않았습니다.' }, { status: 400 });
        }

        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        let query = supabaseAdmin
            .from('products')
            .select(`
                *,
                product_plans (*)
            `)
            .eq('is_active', true)
            .not('name', 'ilike', '%HifiTidal%');

        if (isUuid) {
            query = query.eq('id', id);
        } else {
            query = query.eq('slug', id);
        }

        const { data, error } = await query.maybeSingle();

        if (error) {
            console.error('Error fetching public product detail:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        if (!data) {
            return NextResponse.json({ error: '상품을 찾을 수 없습니다.' }, { status: 404 });
        }

        // 활성화된 요금제만 필터링
        if (data.product_plans && Array.isArray(data.product_plans)) {
            data.product_plans = data.product_plans.filter((plan: { is_active?: boolean }) => plan.is_active !== false);
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Unexpected error in public product detail api:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
