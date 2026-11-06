import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getServerSession, isAdmin } from '@/lib/auth';
import { normalizeSlots } from '@/lib/assignment-utils';

export const dynamic = 'force-dynamic';

const assignmentTable = 'legacy_tidal_assignments';
const accountTable = 'legacy_tidal_accounts';

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(req);
        if (!session || !isAdmin(session)) {
            return NextResponse.json({ error: 'Admin role required' }, { status: 403 });
        }

        const { id } = await params;

        // 1. Get current status and account_id
        const { data: current, error: fetchError } = await supabaseAdmin
            .from(assignmentTable)
            .select('is_active, account_id')
            .eq('id', id)
            .single();

        if (fetchError || !current) {
            throw new Error('Assignment not found');
        }

        // 마스터 슬롯도 비활성 가능. 목록은 항상 showInactive=true 로 조회하므로 비활성 마스터가
        // 있어도 그룹은 그대로 보이고, 비활성 내역에서 삭제하면 normalizeSlots 가 다음 슬롯을 승격한다.

        const nextStatus = !current.is_active;

        // 2. Update status
        const { error: updateError } = await supabaseAdmin
            .from(assignmentTable)
            .update({ is_active: nextStatus })
            .eq('id', id);

        if (updateError) throw updateError;

        // 3. 마스터 표시/사용 슬롯 수만 정리 (비활성 슬롯도 자기 번호를 그대로 유지)
        await normalizeSlots(current.account_id, assignmentTable, accountTable);

        return NextResponse.json({ success: true, is_active: nextStatus });
    } catch (error) {
        console.error('Toggle Active Error:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
