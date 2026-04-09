import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getServerSession, isAdmin } from '@/lib/auth';
import { syncUsedSlots } from '@/lib/assignment-utils';

export const dynamic = 'force-dynamic';

const assignmentTable = 'legacy_tidal_assignments';
const accountTable = 'legacy_tidal_accounts';

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(req);
        if (!session || !isAdmin(session)) {
            return NextResponse.json({ error: 'Admin role required' }, { status: 403 });
        }

        const body = await req.json();
        const { assignment_id, target_account_id, target_slot_number, target_tidal_password } = body;

        if (!assignment_id || !target_account_id) {
            return NextResponse.json({ error: '필수 정보가 누락되었습니다.' }, { status: 400 });
        }

        // 1. Get current assignment
        const { data: currentAssignment, error: findError } = await supabaseAdmin
            .from(assignmentTable)
            .select('account_id, id')
            .eq('id', assignment_id)
            .single();

        if (findError || !currentAssignment) {
            return NextResponse.json({ error: '배정 정보를 찾을 수 없습니다.' }, { status: 400 });
        }

        const sourceAccountId = currentAssignment.account_id;

        // 2. Check Target Account
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

        if (activeCount !== null && activeCount >= targetAccount.max_slots) {
            return NextResponse.json({ error: `슬롯 부족 (${activeCount}/${targetAccount.max_slots})` }, { status: 400 });
        }

        // Check collision on target
        if (target_slot_number !== undefined) {
            const { data: collision } = await supabaseAdmin
                .from(assignmentTable)
                .select('id, is_active')
                .eq('account_id', target_account_id)
                .eq('slot_number', target_slot_number)
                .eq('is_deleted', false)
                .single();

            if (collision && collision.is_active) {
                return NextResponse.json({ error: `Slot #${target_slot_number + 1} is already active.` }, { status: 400 });
            }
        }

        // 3. Move
        const updatePayload: Record<string, string | number | boolean | null> = {
            account_id: target_account_id,
            slot_number: target_slot_number,
            assigned_at: new Date().toISOString(),
            is_deleted: false,
            is_active: true
        };
        if (target_tidal_password) updatePayload.tidal_password = target_tidal_password;

        const { error: moveError } = await supabaseAdmin
            .from(assignmentTable)
            .update(updatePayload)
            .eq('id', assignment_id);

        if (moveError) throw moveError;

        // 4. Sync Used Slots for both
        await syncUsedSlots(sourceAccountId, accountTable, assignmentTable);
        await syncUsedSlots(target_account_id, accountTable, assignmentTable);

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
