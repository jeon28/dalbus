import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/auth';
import { findFirstEmptySlot, syncUsedSlots } from '@/lib/assignment-utils';
import { normalizePhone } from '@/lib/utils';
import { scheduleQobuzSheetSync } from '@/lib/qobuzSheetSync';

export const dynamic = 'force-dynamic';

const accountTable = 'qobuz_accounts';
const assignmentTable = 'qobuz_assignments';

// POST: 하부계정(슬롯) 배정 생성 또는 재활성
export async function POST(req: NextRequest, { params }: { params: Promise<{ accountId: string }> }) {
    const denied = await requireAdmin(req);
    if (denied) return denied;

    try {
        const { accountId: account_id } = await params;
        const body = await req.json();
        const {
            slot_number,
            qobuz_password,
            qobuz_id,
            screen_name,
            buyer_name,
            buyer_phone,
            buyer_email,
            start_date,
            end_date,
            amount,
            period_months,
            memo,
            order_number
        } = body;

        // 삭제/비활성 행까지 모두 가져온다.
        // - 비활성 행도 자기 슬롯 번호를 계속 점유한다 (화면에 그 번호로 남아 있음)
        // - 삭제 행은 슬롯을 점유하지 않는다. 유니크 인덱스가 부분 인덱스(활성 행만)라서
        //   같은 슬롯에 새 행을 insert할 수 있다. 삭제 행을 덮어쓰면 삭제내역이 사라진다.
        const { data: currentAssignments, error: fetchError } = await supabaseAdmin
            .from(assignmentTable)
            .select('id, slot_number, is_active, is_deleted')
            .eq('account_id', account_id)
            .order('slot_number', { ascending: true });

        if (fetchError) throw fetchError;

        let finalSlotNumber = slot_number;

        if (finalSlotNumber === undefined || finalSlotNumber === null) {
            // 슬롯 번호는 고정이므로 중간이 비어 있을 수 있다. 비어 있는 가장 작은 번호를 채운다.
            finalSlotNumber = findFirstEmptySlot(currentAssignments);
        }

        const payload = {
            order_number: order_number || null,
            qobuz_password: qobuz_password || null,
            qobuz_id: qobuz_id ? String(qobuz_id).toLowerCase().trim() : null,
            screen_name: screen_name ? String(screen_name).trim() : null,
            buyer_name: buyer_name || null,
            buyer_phone: buyer_phone ? normalizePhone(String(buyer_phone)) : null,
            buyer_email: buyer_email || null,
            start_date: start_date || null,
            end_date: end_date || null,
            amount: amount !== undefined && amount !== null ? Number(amount) : null,
            period_months: period_months !== undefined && period_months !== null ? Number(period_months) : null,
            memo: memo || null,
            is_active: true,
            is_deleted: false
        };

        // 같은 슬롯에 살아 있는 행이 있으면 재활성(UPDATE), 없으면 신규 INSERT.
        const existingAssignment = currentAssignments?.find(
            a => a.slot_number === finalSlotNumber && a.is_deleted !== true
        );

        if (existingAssignment) {
            const { error: updateError } = await supabaseAdmin
                .from(assignmentTable)
                .update(payload)
                .eq('id', existingAssignment.id);

            if (updateError) throw updateError;
        } else {
            // 정원 초과 방지: 신규 배정은 정원(max_slots) 안에서만 생성한다.
            // (초과를 허용하면 slot_number가 정원 밖으로 밀려 화면에서 누락된다)
            const { data: account, error: accountError } = await supabaseAdmin
                .from(accountTable)
                .select('max_slots')
                .eq('id', account_id)
                .single();

            if (accountError) throw accountError;

            const activeCount = currentAssignments?.filter(
                a => a.is_deleted !== true && a.is_active !== false
            ).length ?? 0;

            if (activeCount >= account.max_slots) {
                return NextResponse.json(
                    { error: `슬롯 부족 (${activeCount}/${account.max_slots}) — 정원을 늘리거나 기존 배정을 정리해주세요.` },
                    { status: 400 }
                );
            }
            if (finalSlotNumber >= account.max_slots) {
                return NextResponse.json(
                    { error: `정원(${account.max_slots}개)을 벗어난 슬롯 번호입니다.` },
                    { status: 400 }
                );
            }

            const { error: insertError } = await supabaseAdmin
                .from(assignmentTable)
                .insert([{ account_id, slot_number: finalSlotNumber, ...payload }]);

            if (insertError) throw insertError;
        }

        // 마스터 슬롯 개념이 없으므로 used_slots만 맞춘다 (normalizeSlots 불필요)
        await syncUsedSlots(account_id, accountTable, assignmentTable);

        scheduleQobuzSheetSync();
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Qobuz Assign Error:', error);
        const err = error as { code?: string; message: string };
        if (err.code === '23505') {
            return NextResponse.json({ error: '이미 사용 중인 Qobuz ID입니다.' }, { status: 409 });
        }
        return NextResponse.json({ error: err.message || '알 수 없는 오류가 발생했습니다.' }, { status: 500 });
    }
}
