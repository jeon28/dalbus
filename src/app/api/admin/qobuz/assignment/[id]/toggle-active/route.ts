import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/auth';
import { syncUsedSlots } from '@/lib/assignment-utils';
import { scheduleQobuzSheetSync } from '@/lib/qobuzSheetSync';

export const dynamic = 'force-dynamic';

const accountTable = 'qobuz_accounts';
const assignmentTable = 'qobuz_assignments';

/**
 * 하부계정(슬롯) 활성 ↔ 비활성 토글.
 *
 * Tidal 계열과 달리 마스터 슬롯 차단이 없다. 대표계정은 그룹 레벨 속성이라 슬롯을
 * 차지하지 않으므로, 어떤 슬롯을 비활성해도 그룹이 화면에서 사라지지 않는다.
 */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const denied = await requireAdmin(req);
    if (denied) return denied;

    try {
        const { id } = await params;

        const { data: current, error: fetchError } = await supabaseAdmin
            .from(assignmentTable)
            .select('is_active, account_id')
            .eq('id', id)
            .single();

        if (fetchError || !current) {
            throw new Error('Assignment not found');
        }

        const nextStatus = !current.is_active;

        const { error: updateError } = await supabaseAdmin
            .from(assignmentTable)
            .update({ is_active: nextStatus })
            .eq('id', id);

        if (updateError) throw updateError;

        // 비활성 슬롯도 자기 번호를 그대로 유지한다. used_slots만 맞춘다.
        await syncUsedSlots(current.account_id, accountTable, assignmentTable);

        scheduleQobuzSheetSync();
        return NextResponse.json({ success: true, is_active: nextStatus });
    } catch (error) {
        console.error('Qobuz Toggle Active Error:', error);
        const err = error as { code?: string; message: string };
        if (err.code === '23505') {
            return NextResponse.json(
                { error: '같은 Qobuz ID가 이미 활성 상태입니다. 먼저 그 배정을 정리해주세요.' },
                { status: 409 }
            );
        }
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
