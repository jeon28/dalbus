import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();

        // Check if tidal_accounts first
        const { data: tidalAcc } = await supabaseAdmin
            .from('tidal_accounts')
            .select('id')
            .eq('id', id)
            .maybeSingle();

        if (tidalAcc) {
            // Duplicate login_id check (exclude current and deleted accounts)
            if (body.login_id) {
                const { data: dup } = await supabaseAdmin
                    .from('tidal_accounts')
                    .select('id')
                    .eq('login_id', body.login_id)
                    .neq('id', id)
                    .neq('status', 'deleted')
                    .maybeSingle();
                if (dup) {
                    return NextResponse.json({ error: '이미 사용 중인 그룹 ID입니다.' }, { status: 409 });
                }
            }

            const tidalFields = ['login_id', 'login_pw', 'payment_email', 'payment_day', 'status', 'max_slots', 'memo'];
            const updateData = Object.keys(body)
                .filter(key => tidalFields.includes(key))
                .reduce((obj, key) => { obj[key] = body[key]; return obj; }, {} as Record<string, unknown>);

            const { data, error } = await supabaseAdmin
                .from('tidal_accounts')
                .update(updateData)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return NextResponse.json(data);
        }

        // Fallback: accounts table
        const updatableFields = ['login_id', 'login_pw', 'payment_email', 'payment_day', 'status', 'max_slots', 'used_slots', 'memo', 'product_id'];
        const updateData = Object.keys(body)
            .filter(key => updatableFields.includes(key))
            .reduce((obj, key) => { obj[key] = body[key]; return obj; }, {} as Record<string, unknown>);

        const { data, error } = await supabaseAdmin
            .from('accounts')
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

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;

        // Check if tidal_accounts first
        const { data: tidalAcc } = await supabaseAdmin
            .from('tidal_accounts')
            .select('id')
            .eq('id', id)
            .maybeSingle();

        if (tidalAcc) {
            const { error } = await supabaseAdmin
                .from('tidal_accounts')
                .update({ status: 'deleted' })
                .eq('id', id);

            if (error) throw error;
            return NextResponse.json({ success: true });
        }

        // Fallback: accounts table
        const { error } = await supabaseAdmin
            .from('accounts')
            .update({ status: 'disabled' })
            .eq('id', id);

        if (error) throw error;
        return NextResponse.json({ success: true, message: 'Account marked as disabled' });
    } catch (error) {
        const e = error as Error;
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
