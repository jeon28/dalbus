import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getServerSession, isAdmin, requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await getServerSession(req);
    const admin = isAdmin(session);

    const { data, error } = await supabaseAdmin
        .from('qna')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // guest_password 는 반환 금지. 비밀글은 작성자 본인/관리자만 본문 열람.
    const rest = { ...(data as Record<string, unknown>) };
    delete rest.guest_password;

    const isOwner = !!data?.user_id && !!session?.id && data.user_id === session.id;
    if (data?.is_secret && !admin && !isOwner) {
        rest.title = '';
        rest.content = '';
        rest.answer_content = null;
        rest.guest_name = '';
    }

    return NextResponse.json(rest);
}

// 편집 UI는 없으며, 임의 수정/삭제 방지를 위해 관리자만 허용한다.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const denied = await requireAdmin(req);
    if (denied) return denied;

    const { id } = await params;
    try {
        const body = await req.json();
        const { title, content, is_secret } = body;

        const { data, error } = await supabaseAdmin
            .from('qna')
            .update({ title, content, is_secret, updated_at: new Date() })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch {
        return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const denied = await requireAdmin(req);
    if (denied) return denied;

    const { id } = await params;
    const { error } = await supabaseAdmin
        .from('qna')
        .delete()
        .eq('id', id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
