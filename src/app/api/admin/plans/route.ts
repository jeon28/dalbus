import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getServerSession, isAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        // 세션 확인 및 관리자 권한 체크
        const session = await getServerSession(req);
        if (!session || !isAdmin(session)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

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
            console.error('Error creating plan:', error);
            if (error.code === '23505') {
                return NextResponse.json({ error: '이미 동일한 개월 수의 활성 요금제가 존재합니다.' }, { status: 400 });
            }
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
