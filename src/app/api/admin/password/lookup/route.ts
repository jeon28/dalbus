import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, isAdmin } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { derivePassword, isPasswordSecretConfigured } from '@/lib/password-derive';

export const dynamic = 'force-dynamic';

export interface PasswordLookupRow {
    source: 'tidal' | 'legacy';
    source_label: string;
    assignment_id: string;
    account_id: string;
    group_id: string;
    slot_number: number;
    type: string;
    tidal_id: string | null;
    stored_password: string | null;
    /** 저장값이 비어 마스터의 그룹 비밀번호로 대체했는지 */
    stored_from_group: boolean;
    derived_password: string | null;
    matches: boolean | null;
    buyer_name: string | null;
    buyer_phone: string | null;
    buyer_email: string | null;
    order_number: string | null;
    start_date: string | null;
    end_date: string | null;
    is_active: boolean;
    is_deleted: boolean;
}

type AssignmentRow = {
    id: string;
    account_id: string;
    slot_number: number | null;
    type: string | null;
    tidal_id: string | null;
    tidal_password: string | null;
    buyer_name: string | null;
    buyer_phone: string | null;
    buyer_email: string | null;
    order_number: string | null;
    start_date: string | null;
    end_date: string | null;
    is_active: boolean | null;
    is_deleted: boolean | null;
};
type AccountRow = { id: string; login_id: string; login_pw: string | null };

const ASSIGNMENT_COLS = 'id, account_id, slot_number, type, tidal_id, tidal_password, buyer_name, buyer_phone, buyer_email, order_number, start_date, end_date, is_active, is_deleted';
const MAX_ROWS = 100;

/** PostgREST or() 필터에 안전하게 넣기 위해 특수문자 제거 */
function sanitizeQuery(q: string): string {
    return q.replace(/[,().*%\\'"]/g, ' ').replace(/\s+/g, ' ').trim();
}

async function searchSource(
    source: 'tidal' | 'legacy',
    q: string,
    includeDeleted: boolean,
): Promise<PasswordLookupRow[]> {
    const assignmentTable = source === 'tidal' ? 'tidal_assignments' : 'legacy_tidal_assignments';
    const accountTable = source === 'tidal' ? 'tidal_accounts' : 'legacy_tidal_accounts';
    const label = source === 'tidal' ? 'Tidal / HifiTidal' : '기존 Tidal';

    const pattern = `%${q}%`;
    let query = supabaseAdmin
        .from(assignmentTable)
        .select(ASSIGNMENT_COLS)
        .or(`tidal_id.ilike.${pattern},buyer_name.ilike.${pattern},buyer_phone.ilike.${pattern},buyer_email.ilike.${pattern},order_number.ilike.${pattern}`)
        .order('end_date', { ascending: false, nullsFirst: false })
        .limit(MAX_ROWS);
    if (!includeDeleted) query = query.or('is_deleted.is.null,is_deleted.eq.false');

    const { data: assignments, error } = await query;
    if (error) throw error;
    const rows = (assignments || []) as AssignmentRow[];
    if (rows.length === 0) return [];

    const accountIds = Array.from(new Set(rows.map(r => r.account_id)));
    const { data: accounts, error: accErr } = await supabaseAdmin
        .from(accountTable)
        .select('id, login_id, login_pw')
        .in('id', accountIds);
    if (accErr) throw accErr;
    const accountMap = new Map<string, AccountRow>((accounts || []).map((a: AccountRow) => [a.id, a]));

    return rows.map(r => {
        const acc = accountMap.get(r.account_id);
        const isMaster = (r.type || (r.slot_number === 0 ? 'master' : 'user')) === 'master';
        const storedFromGroup = !r.tidal_password && isMaster && !!acc?.login_pw;
        const stored = r.tidal_password || (storedFromGroup ? acc?.login_pw ?? null : null);
        const derived = r.tidal_id ? derivePassword(r.tidal_id) : null;
        return {
            source,
            source_label: label,
            assignment_id: r.id,
            account_id: r.account_id,
            group_id: acc?.login_id || '?',
            slot_number: r.slot_number ?? 0,
            type: isMaster ? 'master' : 'user',
            tidal_id: r.tidal_id,
            stored_password: stored,
            stored_from_group: storedFromGroup,
            derived_password: derived,
            matches: stored && derived ? stored === derived : null,
            buyer_name: r.buyer_name,
            buyer_phone: r.buyer_phone,
            buyer_email: r.buyer_email,
            order_number: r.order_number,
            start_date: r.start_date,
            end_date: r.end_date,
            is_active: r.is_active !== false,
            is_deleted: r.is_deleted === true,
        };
    });
}

// GET /api/admin/password/lookup?q=<검색어>&deleted=true
// Tidal ID·이름·전화·이메일·주문번호로 저장된 비밀번호를 찾고, 규칙 계산값과 비교한다.
export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(req);
        if (!session) return NextResponse.json({ error: 'Session not found or invalid' }, { status: 401 });
        if (!isAdmin(session)) return NextResponse.json({ error: 'Admin role required' }, { status: 403 });

        const { searchParams } = new URL(req.url);
        const q = sanitizeQuery(searchParams.get('q') || '');
        const includeDeleted = searchParams.get('deleted') === 'true';
        if (q.length < 2) return NextResponse.json({ error: '검색어를 2자 이상 입력하세요.' }, { status: 400 });

        const [tidal, legacy] = await Promise.all([
            searchSource('tidal', q, includeDeleted),
            searchSource('legacy', q, includeDeleted),
        ]);

        return NextResponse.json({
            query: q,
            secret_configured: isPasswordSecretConfigured(),
            results: [...tidal, ...legacy],
        });
    } catch (error) {
        const e = error as Error;
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
