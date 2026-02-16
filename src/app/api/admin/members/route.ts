import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET() {
    // In production, valid session check is required.
    // Fetching profiles with role 'user'
    const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('id, name, email, phone, created_at, memo')
        .eq('role', 'user')
        .order('created_at', { ascending: false });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}

export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, memo } = body;

        if (!id) {
            return NextResponse.json({ error: '사용자 ID가 필요합니다.' }, { status: 400 });
        }

        const { error } = await supabaseAdmin
            .from('profiles')
            .update({ memo })
            .eq('id', id);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: '메모가 업데이트되었습니다.' });
    } catch (error) {
        console.error('Update member memo error:', error);
        return NextResponse.json({ error: '메모 업데이트 중 오류가 발생했습니다.' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('id');

        if (!userId) {
            return NextResponse.json({ error: '사용자 ID가 필요합니다.' }, { status: 400 });
        }

        // 1. Check if user has any orders
        const { data: orders, error: orderError } = await supabaseAdmin
            .from('orders')
            .select('id')
            .eq('user_id', userId);

        if (orderError) {
            return NextResponse.json({ error: orderError.message }, { status: 500 });
        }

        if (orders && orders.length > 0) {
            return NextResponse.json({
                error: '주문 내역이 있는 회원은 삭제할 수 없습니다.'
            }, { status: 400 });
        }

        // 2. Delete from profiles (will cascade delete from auth.users due to FK)
        const { error: deleteError } = await supabaseAdmin
            .from('profiles')
            .delete()
            .eq('id', userId);

        if (deleteError) {
            return NextResponse.json({ error: deleteError.message }, { status: 500 });
        }

        // 3. Also delete from auth.users
        const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

        if (authDeleteError) {
            console.error('Auth delete error:', authDeleteError);
            // Continue even if auth delete fails, as profile is already deleted
        }

        return NextResponse.json({ success: true, message: '회원이 삭제되었습니다.' });

    } catch (error) {
        console.error('Delete member error:', error);
        return NextResponse.json({ error: '회원 삭제 중 오류가 발생했습니다.' }, { status: 500 });
    }
}
