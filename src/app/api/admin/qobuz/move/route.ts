import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/auth';
import { syncUsedSlots } from '@/lib/assignment-utils';
import { scheduleQobuzSheetSync } from '@/lib/qobuzSheetSync';

export const dynamic = 'force-dynamic';

const accountTable = 'qobuz_accounts';
const assignmentTable = 'qobuz_assignments';

// POST: 하부계정을 다른 그룹의 빈 슬롯으로 이동
export async function POST(req: NextRequest) {
    const denied = await requireAdmin(req);
    if (denied) return denied;

    try {
        const body = await req.json();
        const { assignment_id, target_account_id, target_slot_number, target_qobuz_password } = body;

        if (!assignment_id || !target_account_id) {
            return NextResponse.json({ error: '필수 정보가 누락되었습니다.' }, { status: 400 });
        }

        // 1. 원본 배정
        const { data: currentAssignment, error: findError } = await supabaseAdmin
            .from(assignmentTable)
            .select('account_id, id')
            .eq('id', assignment_id)
            .single();

        if (findError || !currentAssignment) {
            return NextResponse.json({ error: '배정 정보를 찾을 수 없습니다.' }, { status: 400 });
        }

        const sourceAccountId = currentAssignment.account_id;

        if (sourceAccountId === target_account_id && target_slot_number === undefined) {
            return NextResponse.json({ error: '이동할 대상을 선택해주세요.' }, { status: 400 });
        }

        // 2. 대상 그룹 정원 확인
        const { count: activeCount } = await supabaseAdmin
            .from(assignmentTable)
            .select('*', { count: 'exact', head: true })
            .eq('account_id', target_account_id)
            .eq('is_active', true)
            .eq('is_deleted', false);

        const { data: targetAccount, error: targetError } = await supabaseAdmin
            .from(accountTable)
            .select('max_slots')
            .eq('id', target_account_id)
            .single();

        if (targetError) throw targetError;

        if (sourceAccountId !== target_account_id && activeCount !== null && activeCount >= targetAccount.max_slots) {
            return NextResponse.json(
                { error: `슬롯 부족 (${activeCount}/${targetAccount.max_slots})` },
                { status: 400 }
            );
        }

        if (target_slot_number !== undefined && target_slot_number !== null) {
            if (target_slot_number >= targetAccount.max_slots) {
                return NextResponse.json(
                    { error: `정원(${targetAccount.max_slots}개)을 벗어난 슬롯 번호입니다.` },
                    { status: 400 }
                );
            }

            // 대상 슬롯 충돌 확인
            const { data: collision } = await supabaseAdmin
                .from(assignmentTable)
                .select('id, is_active')
                .eq('account_id', target_account_id)
                .eq('slot_number', target_slot_number)
                .eq('is_deleted', false)
                .neq('id', assignment_id)
                .maybeSingle();

            if (collision && collision.is_active) {
                return NextResponse.json(
                    { error: `${target_slot_number + 1}번 슬롯은 이미 사용 중입니다.` },
                    { status: 400 }
                );
            }
        }

        // 3. 이동
        const updatePayload: Record<string, string | number | boolean | null> = {
            account_id: target_account_id,
            slot_number: target_slot_number,
            assigned_at: new Date().toISOString(),
            is_deleted: false,
            is_active: true
        };
        if (target_qobuz_password) updatePayload.qobuz_password = target_qobuz_password;

        const { error: moveError } = await supabaseAdmin
            .from(assignmentTable)
            .update(updatePayload)
            .eq('id', assignment_id);

        if (moveError) throw moveError;

        // 4. 양쪽 used_slots 동기화
        await syncUsedSlots(sourceAccountId, accountTable, assignmentTable);
        if (sourceAccountId !== target_account_id) {
            await syncUsedSlots(target_account_id, accountTable, assignmentTable);
        }

        scheduleQobuzSheetSync();
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
