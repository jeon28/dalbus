import { NextRequest, NextResponse } from 'next/server';
import { getMemberFromRequest } from '@/lib/auth';
import { duplicatePhoneMessage, findPhoneOwner, maskEmail, phoneDigits } from '@/lib/phoneDuplicate';

/**
 * 전화번호 중복 확인 (1인 1계정).
 * 로그인 상태로 호출하면 본인 계정은 제외하고 찾는다.
 * 응답: { duplicate: false } | { duplicate: true, method, maskedEmail, message }
 */
export async function POST(req: NextRequest) {
    try {
        const { phone } = await req.json();
        if (phoneDigits(phone).length < 10) {
            return NextResponse.json({ duplicate: false });
        }

        const member = await getMemberFromRequest(req);
        const owner = await findPhoneOwner(phone, member?.id);
        if (!owner) return NextResponse.json({ duplicate: false });

        return NextResponse.json({
            duplicate: true,
            method: owner.signup_method || 'email',
            maskedEmail: maskEmail(owner.email),
            message: duplicatePhoneMessage(owner)
        });
    } catch (error) {
        console.error('check-phone error:', error);
        // 확인 실패로 가입·주문을 막지는 않는다 (DB 유니크 인덱스가 최종 방어선)
        return NextResponse.json({ duplicate: false });
    }
}
