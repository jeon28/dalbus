import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getServerSession, isAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.error('CRITICAL: SUPABASE_SERVICE_ROLE_KEY is missing in environment');
        return NextResponse.json({ error: 'Server configuration error: Missing API Key' }, { status: 500 });
    }

    // 열람 권한 판정용 세션 (없으면 비로그인)
    const session = await getServerSession(req);
    const admin = isAdmin(session);

    const { searchParams } = new URL(req.url);
    const excludeSecret = searchParams.get('exclude_secret') === 'true';
    const userId = searchParams.get('user_id'); // Optional: fetch my posts

    let query = supabaseAdmin
        .from('qna')
        .select('*')
        .order('created_at', { ascending: false });

    if (excludeSecret) {
        query = query.eq('is_secret', false);
    }

    if (userId) {
        query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Supabase query error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 비밀글은 작성자 본인 또는 관리자만 본문/답변/작성자를 볼 수 있도록 서버에서 마스킹한다.
    // guest_password 는 자격증명이므로 누구에게도 반환하지 않는다.
    const rows = (data ?? []).map((q: Record<string, unknown>) => {
        const rest = { ...q };
        delete rest.guest_password;

        const isOwner = !!q.user_id && !!session?.id && q.user_id === session.id;
        const canView = admin || !q.is_secret || isOwner;

        if (!canView) {
            rest.title = '';
            rest.content = '';
            rest.answer_content = null;
            rest.guest_name = '';
        }
        return rest;
    });

    return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
    // Diagnostic: Check if admin key exists
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.error('CRITICAL: SUPABASE_SERVICE_ROLE_KEY is missing in production environment');
        return NextResponse.json({ error: 'Server configuration error: Missing API Key' }, { status: 500 });
    }

    try {
        const body = await req.json();
        const { title, content, is_secret, user_id, guest_name, guest_password } = body || {};

        if (!title || !content) {
            return NextResponse.json({ error: '제목과 내용을 입력해주세요.' }, { status: 400 });
        }

        // 허용된 필드만 삽입 (status/answer_content 등 클라이언트가 임의로 위조하지 못하도록 화이트리스트)
        const insertData = {
            title,
            content,
            is_secret: !!is_secret,
            user_id: user_id || null,
            guest_name: guest_name || null,
            guest_password: guest_password || null,
        };

        const { data, error } = await supabaseAdmin
            .from('qna')
            .insert(insertData)
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
}
