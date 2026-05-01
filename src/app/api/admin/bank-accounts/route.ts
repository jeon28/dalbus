import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getServerSession, isAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    // 세션 확인 및 관리자 권한 체크
    const session = await getServerSession(req);
    if (!session || !isAdmin(session)) {
        return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
        .from('bank_accounts')
        .select('*')
        .order('sort_order', { ascending: true });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
    try {
        // 세션 확인 및 관리자 권한 체크
        const session = await getServerSession(req);
        if (!session || !isAdmin(session)) {
            return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
        }

        const body = await req.json();
        const { bank_name, account_number, account_holder, sort_order } = body;

        const { data, error } = await supabaseAdmin
            .from('bank_accounts')
            .insert({
                bank_name,
                account_number,
                account_holder,
                sort_order: sort_order || 0
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
