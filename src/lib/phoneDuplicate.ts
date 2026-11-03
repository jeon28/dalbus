import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * 전화번호 1인 1계정 — 같은 번호로 가입된 다른 회원을 찾는다. (서버 전용: service role 사용)
 *
 * 프로필 전화번호는 "010-1234-5678" 과 "01012345678" 두 형식이 섞여 있어
 * 숫자만 뽑은 값과 하이픈 형식을 모두 조회한다.
 */

export interface PhoneOwner {
    id: string;
    email: string | null;
    signup_method: string | null;
}

export function phoneDigits(phone: string | null | undefined): string {
    return (phone || '').replace(/[^0-9]/g, '');
}

/** 저장 형식이 섞여 있어도 찾을 수 있도록 가능한 표기를 모두 만든다 */
function phoneVariants(digits: string): string[] {
    const v = new Set<string>([digits]);
    if (digits.length === 11) v.add(`${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`);
    if (digits.length === 10) v.add(`${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`);
    return Array.from(v);
}

/** 같은 번호를 쓰는 다른 회원(본인 제외). 없으면 null */
export async function findPhoneOwner(phone: string | null | undefined, excludeUserId?: string | null): Promise<PhoneOwner | null> {
    const digits = phoneDigits(phone);
    if (digits.length < 10) return null;

    let query = supabaseAdmin
        .from('profiles')
        .select('id, email, signup_method, created_at')
        .in('phone', phoneVariants(digits))
        .order('created_at', { ascending: true })
        .limit(5);
    if (excludeUserId) query = query.neq('id', excludeUserId);

    const { data, error } = await query;
    if (error) {
        console.error('[findPhoneOwner] lookup failed:', error.message);
        return null;
    }
    const owner = data?.[0];
    return owner ? { id: owner.id, email: owner.email, signup_method: owner.signup_method } : null;
}

/** k***@daum.net 형태로 가린다 */
export function maskEmail(email: string | null | undefined): string {
    if (!email || !email.includes('@')) return '';
    const [local, domain] = email.split('@');
    const head = local.slice(0, Math.min(2, Math.max(1, local.length - 1)));
    return `${head}***@${domain}`;
}

/** 가입 수단 한글 이름 */
export function signupMethodLabel(method: string | null | undefined): string {
    switch (method) {
        case 'kakao': return '카카오';
        case 'google': return '구글';
        default: return '이메일';
    }
}

/** 화면에 보여줄 안내 문구 */
export function duplicatePhoneMessage(owner: PhoneOwner): string {
    const masked = maskEmail(owner.email);
    return `이 전화번호는 이미 ${signupMethodLabel(owner.signup_method)}${masked ? `(${masked})` : ''}로 가입되어 있습니다. 그 방법으로 로그인해 주세요.`;
}
