import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getServerSession, isAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET: List all products
export async function GET(req: NextRequest) {
    // 세션 확인 및 관리자 권한 체크
    const session = await getServerSession(req);
    if (!session || !isAdmin(session)) {
        return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
        .from('products')
        .select(`
            *,
            product_plans (*)
        `)
        .order('sort_order', { ascending: true });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}

// POST: Create a new product
export async function POST(req: NextRequest) {
    try {
        // 세션 확인 및 관리자 권한 체크
        const session = await getServerSession(req);
        if (!session || !isAdmin(session)) {
            return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
        }

        const body = await req.json();
        const { slug, name, original_price, description, benefits, image_url, sort_order, is_active } = body;

        const { data, error } = await supabaseAdmin
            .from('products')
            .insert({
                slug,
                name,
                original_price,
                description,
                benefits, // Array
                image_url,
                sort_order,
                is_active
            })
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
}
