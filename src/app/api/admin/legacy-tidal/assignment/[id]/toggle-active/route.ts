import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getServerSession, isAdmin } from '@/lib/auth';
import { reindexSlots, syncUsedSlots } from '@/lib/assignment-utils';

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
            .select('is_active, account_id, type, slot_number')
            .eq('id', id)
            .single();

        if (fetchError || !current) {
            throw new Error('Assignment not found');
        }

        // 마스터 슬롯(그룹 대표)은 비활성화 금지: 비활성 시 그룹 전체가 화면에서 사라짐
        // (재활성화는 허용)
        const isMaster = current.type === 'master' || current.slot_number === 0;
        if (isMaster && current.is_active) {
            return NextResponse.json(
                { error: '마스터 슬롯은 비활성할 수 없습니다.' },
                { status: 400 }
            );
        }

        const nextStatus = !current.is_active;

        // 2. Update status
        const { error: updateError } = await supabaseAdmin
            .from(assignmentTable)
            .update({ is_active: nextStatus })
            .eq('id', id);

        if (updateError) throw updateError;

        // 3. Re-index and Sync (to ensure slot ordering and counts are correct)
        await reindexSlots(current.account_id, assignmentTable, accountTable);

        return NextResponse.json({ success: true, is_active: nextStatus });
    } catch (error) {
        console.error('Toggle Active Error:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
