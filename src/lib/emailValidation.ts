import { promises as dns } from 'dns';

/**
 * 이메일 검증 유틸리티
 *
 * 정책:
 * - 화이트리스트 도메인은 별도 점검 없이 즉시 통과한다.
 * - 그 외 도메인은 DNS MX 레코드를 조회하여 실제 메일 수신이 가능한 도메인인지 확인한다.
 *   (MX가 없으면 A 레코드로 폴백 — RFC 5321상 MX 부재 시 A 레코드로 메일 전송 가능)
 */

/** 점검 없이 즉시 가입 가능한 신뢰 도메인 화이트리스트 (소문자) */
export const EMAIL_WHITELIST_DOMAINS: ReadonlySet<string> = new Set([
    // 글로벌
    'gmail.com',
    'googlemail.com',
    'outlook.com',
    'hotmail.com',
    'live.com',
    'icloud.com',
    'me.com',
    'yahoo.com',
    'protonmail.com',
    'proton.me',
    // 국내
    'naver.com',
    'daum.net',
    'hanmail.net',
    'kakao.com',
    'nate.com',
    'korea.com',
    'hanafos.com',
    'paran.com',
    'empas.com',
    'dreamwiz.com',
]);

/** 가입을 차단하는 내부/예약 도메인 (소문자) */
export const EMAIL_BLOCKLIST_DOMAINS: ReadonlySet<string> = new Set([
    'hifitidal.com',
]);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface EmailValidationResult {
    /** 가입 진행 가능 여부 */
    valid: boolean;
    /** 사용자에게 보여줄 메시지 */
    message: string;
    /** 판정 사유 (디버깅/로깅용) */
    reason:
        | 'whitelist'      // 화이트리스트 통과
        | 'mx_ok'          // MX(또는 A) 레코드 확인됨
        | 'invalid_format' // 이메일 형식 오류
        | 'blocked'        // 차단 도메인
        | 'no_mx'          // 메일 수신 불가 도메인
        | 'dns_error';     // DNS 조회 실패
}

/** 이메일에서 도메인 부분을 소문자로 추출 */
export function getEmailDomain(email: string): string {
    return email.toLowerCase().split('@')[1] ?? '';
}

/** 이메일 형식이 올바른지 검사 */
export function isValidEmailFormat(email: string): boolean {
    return EMAIL_REGEX.test(email.toLowerCase());
}

/**
 * 도메인이 실제 메일을 수신할 수 있는지 DNS로 확인한다.
 * MX 레코드가 있으면 true, 없으면 A 레코드(폴백)를 확인한다.
 */
export async function hasMailExchanger(domain: string): Promise<boolean> {
    try {
        const mx = await dns.resolveMx(domain);
        if (mx && mx.length > 0 && mx.some((r) => r.exchange)) {
            return true;
        }
    } catch {
        // MX 조회 실패 시 A 레코드 폴백으로 진행
    }

    try {
        const a = await dns.resolve(domain);
        return a.length > 0;
    } catch {
        return false;
    }
}

/**
 * 이메일을 검증한다.
 * 1. 형식 검사
 * 2. 차단 도메인 검사
 * 3. 화이트리스트면 즉시 통과
 * 4. 그 외에는 DNS MX 조회로 실제 수신 가능 여부 확인
 */
export async function validateEmail(rawEmail: string): Promise<EmailValidationResult> {
    const email = rawEmail.trim().toLowerCase();

    if (!isValidEmailFormat(email)) {
        return { valid: false, message: '올바른 이메일 형식이 아닙니다.', reason: 'invalid_format' };
    }

    const domain = getEmailDomain(email);

    if (EMAIL_BLOCKLIST_DOMAINS.has(domain)) {
        return { valid: false, message: '가입할 수 없는 메일입니다.', reason: 'blocked' };
    }

    if (EMAIL_WHITELIST_DOMAINS.has(domain)) {
        return { valid: true, message: '사용 가능한 이메일입니다.', reason: 'whitelist' };
    }

    let canReceive: boolean;
    try {
        canReceive = await hasMailExchanger(domain);
    } catch {
        return {
            valid: false,
            message: '이메일 도메인 확인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
            reason: 'dns_error',
        };
    }

    if (!canReceive) {
        return {
            valid: false,
            message: '메일을 받을 수 없는 도메인입니다. 이메일 주소를 다시 확인해주세요.',
            reason: 'no_mx',
        };
    }

    return { valid: true, message: '사용 가능한 이메일입니다.', reason: 'mx_ok' };
}
