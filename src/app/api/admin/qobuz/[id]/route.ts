import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/auth';
import { scheduleQobuzSheetSync } from '@/lib/qobuzSheetSync';

export const dynamic = 'force-dynamic';

const accountTable = 'qobuz_accounts';
const assignmentTable = 'qobuz_assignments';

// PUT: 대표계정(그룹) 수정
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const denied = await requireAdmin(req);
    if (denied) return denied;

    try {
        const { id } = await params;
        const body = await req.json();

        // accounts 테이블에 없는 필드는 걸러낸다
        const updatableFields = [
            'login_id',
            'login_pw',
            'master_email',
            'master_end_date',
            'payment_email',
            'status',
            'max_slots',
            'used_slots',
            'memo',
            'payment_day'
        ];

        const updateData = Object.keys(body)
            .filter(key => updatableFields.includes(key))
            .reduce((obj, key) => {
                obj[key] = body[key];
                return obj;
            }, {} as Record<string, unknown>);

        if (updateData.login_id) {
            // 그룹 ID는 항상 대문자로 저장한다 (QG01 형식)
            updateData.login_id = String(updateData.login_id).toUpperCase().trim();
        }
        if (updateData.master_email) {
            updateData.master_email = String(updateData.master_email).toLowerCase().trim();
        }
        if (updateData.payment_email) {
            updateData.payment_email = String(updateData.payment_email).toLowerCase().trim();
        }
        // 빈 문자열은 date 컬럼에 들어갈 수 없다
        if (updateData.master_end_date === '') updateData.master_end_date = null;

        const { data, error } = await supabaseAdmin
            .from(accountTable)
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        scheduleQobuzSheetSync();
        return NextResponse.json(data);
    } catch (error) {
        const err = error as { code?: string; message: string };
        if (err.code === '23505') {
            return NextResponse.json({ error: '이미 사용 중인 그룹 ID입니다.' }, { status: 409 });
        }
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// DELETE: 대표계정(그룹) 삭제
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const denied = await requireAdmin(req);
    if (denied) return denied;

    try {
        const { id } = await params;

        // 살아 있는 배정이 남아 있으면 삭제를 막는다
        const { count, error: checkError } = await supabaseAdmin
            .from(assignmentTable)
            .select('*', { count: 'exact', head: true })
            .eq('account_id', id)
            .eq('is_deleted', false);

        if (checkError) throw checkError;

        if (count && count > 0) {
            return NextResponse.json(
                { error: '활성 배정이 있는 계정은 삭제할 수 없습니다. 먼저 배정을 해제하거나 삭제해 주세요.' },
                { status: 400 }
            );
        }

        const { error } = await supabaseAdmin
            .from(accountTable)
            .delete()
            .eq('id', id);

        if (error) throw error;

        scheduleQobuzSheetSync();
        return NextResponse.json({ success: true, message: 'Account deleted' });
    } catch (error) {
        const e = error as Error;
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
