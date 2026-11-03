import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getMemberFromRequest } from '@/lib/auth';

/**
 * 중복 가입 정리 — SNS로 방금 만든 "빈 계정"을 삭제한다.
 * 추가정보 입력 중 전화번호가 다른 계정과 겹치면 호출되며, 사용자는 기존 계정으로 로그인하게 된다.
 *
 * 안전장치: 호출자 본인 계정만, 주문이 하나도 없고, 가입 24시간 이내, 전화번호가 비어 있을 때만 삭제한다.
 */
export async function POST(req: NextRequest) {
    const member = await getMemberFromRequest(req);
    if (!member) {
        return NextResponse.json({ error: '로그인 정보가 없습니다.' }, { status: 401 });
    }

    try {
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('phone, created_at, role')
            .eq('id', member.id)
            .maybeSingle();

        if (profile?.role === 'admin') {
            return NextResponse.json({ deleted: false, reason: 'admin' });
        }
        if (profile?.phone) {
            return NextResponse.json({ deleted: false, reason: 'has_phone' });
        }
        const createdAt = profile?.created_at ? new Date(profile.created_at).getTime() : 0;
        if (!createdAt || Date.now() - createdAt > 24 * 60 * 60 * 1000) {
            return NextResponse.json({ deleted: false, reason: 'not_new' });
        }

        const { count } = await supabaseAdmin
            .from('orders')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', member.id);
        if ((count ?? 0) > 0) {
            return NextResponse.json({ deleted: false, reason: 'has_orders' });
        }

        // profiles 는 auth.users ON DELETE CASCADE 로 함께 삭제된다
        const { error } = await supabaseAdmin.auth.admin.deleteUser(member.id);
        if (error) {
            console.error('abandon-signup delete failed:', error.message);
            return NextResponse.json({ deleted: false, reason: 'delete_failed' });
        }
        return NextResponse.json({ deleted: true });
    } catch (error) {
        console.error('abandon-signup error:', error);
        return NextResponse.json({ deleted: false, reason: 'error' }, { status: 500 });
    }
}
