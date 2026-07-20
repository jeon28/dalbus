import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/auth';
import { sendInquiryAnswerNotification } from '@/lib/email';
import { sanitizeImages } from '@/lib/inquiryImages';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/inquiries/[id]/answer
 * 관리자가 답변을 등록하고, 문의한 회원에게 답변 완료 메일을 발송한다.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const denied = await requireAdmin(req);
    if (denied) return denied;

    const { id } = await params;
    try {
        const { answer_content, answer_images } = await req.json();

        if (!answer_content?.trim()) {
            return NextResponse.json({ error: '답변 내용을 입력해주세요.' }, { status: 400 });
        }

        const sanitizedImages = sanitizeImages(answer_images);
        if (sanitizedImages === null) {
            return NextResponse.json({ error: '첨부 이미지 형식이 올바르지 않습니다.' }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from('inquiries')
            .update({
                answer_content: answer_content.trim(),
                answer_images: sanitizedImages,
                status: 'answered',
                answered_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select('*, profiles(name, email)')
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // 문의한 회원에게 답변 완료 알림 메일 발송 (실패해도 답변 등록은 성공 처리)
        try {
            const profile = (data as { profiles?: { name?: string; email?: string } }).profiles;
            if (profile?.email) {
                await sendInquiryAnswerNotification(profile.email, {
                    userName: profile.name || '회원',
                    title: data.title,
                    answer: data.answer_content,
                    imageCount: sanitizedImages.length,
                });
            } else {
                console.warn('[inquiries] 회원 이메일 없음 — 답변 알림 메일 생략');
            }
        } catch (mailErr) {
            console.error('[inquiries] 답변 알림 메일 발송 실패:', mailErr);
        }

        return NextResponse.json(data);
    } catch {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
}

/**
 * DELETE /api/admin/inquiries/[id]/answer
 * 관리자가 등록한 답변만 삭제하고 문의를 다시 '미답변' 상태로 되돌린다. (문의 자체는 유지)
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const denied = await requireAdmin(req);
    if (denied) return denied;

    const { id } = await params;

    const { data, error } = await supabaseAdmin
        .from('inquiries')
        .update({
            answer_content: null,
            answer_images: [],
            status: 'waiting',
            answered_at: null,
            updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}
