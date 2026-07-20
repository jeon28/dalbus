import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getServerSession, isAdmin } from '@/lib/auth';
import { sendInquiryNotification } from '@/lib/email';
import { sanitizeImages } from '@/lib/inquiryImages';

export const dynamic = 'force-dynamic';

/**
 * GET /api/inquiries
 * 로그인 회원 본인의 1:1 문의 목록만 반환한다. (비공개 보장)
 */
export async function GET(req: NextRequest) {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.error('CRITICAL: SUPABASE_SERVICE_ROLE_KEY is missing in environment');
        return NextResponse.json({ error: 'Server configuration error: Missing API Key' }, { status: 500 });
    }

    const session = await getServerSession(req);
    if (!session) {
        return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    // 관리자 게이트(quick-access)는 개인 문의 소유자가 아니므로 빈 목록 반환.
    if (isAdmin(session) && session.id === 'quick-access-admin') {
        return NextResponse.json([]);
    }

    const { data, error } = await supabaseAdmin
        .from('inquiries')
        .select('*')
        .eq('user_id', session.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Supabase query error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
}

/**
 * POST /api/inquiries
 * 로그인 회원이 본인 명의로 문의를 등록하고, 관리자에게 알림 메일을 발송한다.
 */
export async function POST(req: NextRequest) {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.error('CRITICAL: SUPABASE_SERVICE_ROLE_KEY is missing in environment');
        return NextResponse.json({ error: 'Server configuration error: Missing API Key' }, { status: 500 });
    }

    const session = await getServerSession(req);
    if (!session || session.id === 'quick-access-admin') {
        return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { title, content, images } = body || {};

        if (!title?.trim() || !content?.trim()) {
            return NextResponse.json({ error: '제목과 내용을 입력해주세요.' }, { status: 400 });
        }

        const sanitizedImages = sanitizeImages(images);
        if (sanitizedImages === null) {
            return NextResponse.json({ error: '첨부 이미지 형식이 올바르지 않습니다.' }, { status: 400 });
        }

        // status/answer_content 등은 서버에서만 설정 (클라이언트 위조 방지)
        const { data, error } = await supabaseAdmin
            .from('inquiries')
            .insert({
                user_id: session.id,
                title: title.trim(),
                content: content.trim(),
                images: sanitizedImages,
            })
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // 관리자에게 알림 메일 발송 (실패해도 문의 등록 자체는 성공 처리)
        try {
            const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('name, email')
                .eq('id', session.id)
                .single();

            const { data: adminEmailSetting } = await supabaseAdmin
                .from('site_settings')
                .select('value')
                .eq('key', 'admin_email')
                .maybeSingle();

            const adminEmail = adminEmailSetting?.value?.trim();
            if (adminEmail) {
                await sendInquiryNotification(adminEmail, {
                    inquiryId: data.id,
                    userName: profile?.name || '회원',
                    userEmail: profile?.email || session.email,
                    title: data.title,
                    content: data.content,
                    imageCount: sanitizedImages.length,
                });
            } else {
                console.warn('[inquiries] admin_email 미설정 — 관리자 알림 메일 생략');
            }
        } catch (mailErr) {
            console.error('[inquiries] 관리자 알림 메일 발송 실패:', mailErr);
        }

        return NextResponse.json(data);
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
}
