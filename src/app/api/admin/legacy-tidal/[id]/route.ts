import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getServerSession, isAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const accountTable = 'legacy_tidal_accounts';

// PUT: Update legacy_tidal_account entry
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(req);
        if (!session || !isAdmin(session)) {
            return NextResponse.json({ error: 'Admin role required' }, { status: 403 });
        }

        const { id } = await params;
        const body = await req.json();

        // Filter out fields that are not in the accounts table
        const updatableFields = [
            'login_id',
            'login_pw',
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
            updateData.login_id = (updateData.login_id as string).toLowerCase().trim();
        }

        const { data, error } = await supabaseAdmin
            .from(accountTable)
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json(data);
    } catch (error) {
        const e = error as Error;
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// DELETE: Delete legacy_tidal_account entry
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(req);
        if (!session || !isAdmin(session)) {
            return NextResponse.json({ error: 'Admin role required' }, { status: 403 });
        }

        const { id } = await params;

        // Check if there are active assignments
        const { count, error: checkError } = await supabaseAdmin
            .from('legacy_tidal_assignments')
            .select('*', { count: 'exact', head: true })
            .eq('account_id', id)
            .eq('is_deleted', false);

        if (checkError) throw checkError;
        
        if (count && count > 0) {
            return NextResponse.json({ error: '활성 배정이 있는 계정은 삭제할 수 없습니다. 먼저 배정을 해제하거나 삭제해 주세요.' }, { status: 400 });
        }

        const { error } = await supabaseAdmin
            .from(accountTable)
            .delete()
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ success: true, message: 'Account deleted' });
    } catch (error) {
        const e = error as Error;
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
