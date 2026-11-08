import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, isAdmin } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export interface PasswordHistoryRow {
    id: string;
    source_table: string;
    row_id: string;
    account_id: string | null;
    tidal_id: string | null;
    login_id: string | null;
    field: 'tidal_password' | 'login_pw';
    old_value: string | null;
    new_value: string | null;
    changed_at: string;
    changed_by: string | null;
}

const TABLES: Record<string, string[]> = {
    tidal: ['tidal_assignments', 'tidal_accounts'],
    legacy: ['legacy_tidal_assignments', 'legacy_tidal_accounts'],
};

// GET /api/admin/password/history?source=tidal|legacy&assignment_id=&account_id=
// 배정 비밀번호(tidal_password)와 그 그룹의 비밀번호(login_pw) 변경 이력을 최신순으로 돌려준다.
export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(req);
        if (!session) return NextResponse.json({ error: 'Session not found or invalid' }, { status: 401 });
        if (!isAdmin(session)) return NextResponse.json({ error: 'Admin role required' }, { status: 403 });

        const { searchParams } = new URL(req.url);
        const source = searchParams.get('source') || 'tidal';
        const tables = TABLES[source];
        if (!tables) return NextResponse.json({ error: 'source 는 tidal 또는 legacy 여야 합니다.' }, { status: 400 });

        const ids = [searchParams.get('assignment_id'), searchParams.get('account_id')]
            .map(v => (v || '').trim())
            .filter(Boolean);
        if (ids.length === 0) return NextResponse.json({ error: 'assignment_id 또는 account_id 가 필요합니다.' }, { status: 400 });

        const { data, error } = await supabaseAdmin
            .from('password_history')
            .select('id, source_table, row_id, account_id, tidal_id, login_id, field, old_value, new_value, changed_at, changed_by')
            .in('source_table', tables)
            .in('row_id', ids)
            .order('changed_at', { ascending: false })
            .limit(100);

        if (error) {
            // 마이그레이션 전: 테이블 없음
            if (error.code === '42P01' || /password_history/.test(error.message)) {
                return NextResponse.json(
                    { error: 'password_history 테이블이 없습니다. supabase_migration_password_history.sql 을 먼저 적용하세요.' },
                    { status: 503 },
                );
            }
            throw error;
        }

        return NextResponse.json({ results: (data || []) as PasswordHistoryRow[] });
    } catch (error) {
        const e = error as Error;
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
