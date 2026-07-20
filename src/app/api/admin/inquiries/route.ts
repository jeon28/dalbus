import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/inquiries
 * 관리자용 전체 1:1 문의 목록. 작성자 정보(이름/이메일/연락처)를 함께 반환한다.
 */
export async function GET(req: NextRequest) {
    const denied = await requireAdmin(req);
    if (denied) return denied;

    const { data, error } = await supabaseAdmin
        .from('inquiries')
        .select('*, profiles(name, email, phone)')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Supabase query error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
}
