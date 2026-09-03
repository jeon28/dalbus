import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { normalizePhone } from '@/lib/utils';
import { requireAdmin } from '@/lib/auth';
import { syncUsedSlots } from '@/lib/assignment-utils';
import { scheduleQobuzSheetSync } from '@/lib/qobuzSheetSync';

export const dynamic = 'force-dynamic';

const accountTable = 'qobuz_accounts';
const assignmentTable = 'qobuz_assignments';

// PUT: 하부계정(슬롯) 수정 — 실제로 바뀐 필드만 UPDATE 한다
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const denied = await requireAdmin(req);
    if (denied) return denied;

    try {
        const { id } = await params;
        const body = await req.json();

        // 1. 현재 값을 먼저 읽는다
        const { data: current, error: fetchError } = await supabaseAdmin
            .from(assignmentTable)
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !current) {
            throw new Error('Assignment not found');
        }

        type FieldValue = string | number | boolean | null;
        const updates: Record<string, FieldValue> = {};
        const currentRow = current as unknown as Record<string, FieldValue>;

        // 값이 실제로 바뀔 때만 updates에 담는다 (불필요한 updated_at 갱신 방지)
        const addIfChanged = (key: string, newValue: FieldValue | undefined) => {
            if (newValue === undefined) return;

            let val: FieldValue = newValue;
            if (key === 'qobuz_id') val = val ? String(val).toLowerCase().trim() : null;
            if (key === 'screen_name') val = val ? String(val).trim() : null;
            if (key === 'buyer_phone') val = val === null ? null : normalizePhone(String(val));
            if (key === 'amount' || key === 'period_months') val = val !== null && val !== '' ? Number(val) : null;
            if (key === 'start_date' || key === 'end_date') val = val === '' ? null : val;

            if (currentRow[key] !== val) {
                updates[key] = val;
            }
        };

        addIfChanged('qobuz_id', body.qobuz_id);
        addIfChanged('qobuz_password', body.qobuz_password);
        addIfChanged('screen_name', body.screen_name);
        addIfChanged('order_number', body.order_number);
        addIfChanged('buyer_name', body.buyer_name);
        addIfChanged('buyer_phone', body.buyer_phone);
        addIfChanged('buyer_email', body.buyer_email);
        addIfChanged('start_date', body.start_date);
        addIfChanged('end_date', body.end_date);
        addIfChanged('is_active', body.is_active);
        addIfChanged('is_deleted', body.is_deleted);
        addIfChanged('amount', body.amount);
        addIfChanged('period_months', body.period_months);
        addIfChanged('memo', body.memo);

        if (Object.keys(updates).length > 0) {
            const { error: updateError } = await supabaseAdmin
                .from(assignmentTable)
                .update(updates)
                .eq('id', id);

            if (updateError) throw updateError;

            // 활성/삭제 상태가 바뀌면 used_slots를 맞춘다 (슬롯 번호는 그대로 유지)
            if (updates.is_active !== undefined || updates.is_deleted !== undefined) {
                await syncUsedSlots(current.account_id, accountTable, assignmentTable);
            }

            // 실제로 바뀐 게 있을 때만 시트를 다시 쓴다
            scheduleQobuzSheetSync();
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        const err = error as { code?: string; message: string };
        if (err.code === '23505') {
            return NextResponse.json({ error: '이미 사용 중인 Qobuz ID입니다.' }, { status: 409 });
        }
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// DELETE: 하부계정(슬롯) 삭제. ?hardDelete=true 면 물리 삭제.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const denied = await requireAdmin(req);
    if (denied) return denied;

    try {
        const { id } = await params;
        const hardDelete = req.nextUrl.searchParams.get('hardDelete') === 'true';

        const { data: assignment, error: fetchError } = await supabaseAdmin
            .from(assignmentTable)
            .select('account_id')
            .eq('id', id)
            .single();

        if (fetchError || !assignment) throw new Error('Assignment not found');

        if (hardDelete) {
            const { error } = await supabaseAdmin
                .from(assignmentTable)
                .delete()
                .eq('id', id);
            if (error) throw error;
        } else {
            const { error } = await supabaseAdmin
                .from(assignmentTable)
                .update({ is_deleted: true, is_active: false })
                .eq('id', id);
            if (error) throw error;
        }

        // 삭제한 슬롯 번호는 그대로 공란으로 남긴다 (뒤 번호를 당기지 않음)
        await syncUsedSlots(assignment.account_id, accountTable, assignmentTable);

        scheduleQobuzSheetSync();
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
