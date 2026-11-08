/**
 * 계정 초기 비밀번호 생성 규칙
 *
 * - Tidal ID가 ****@hifitidal.com (자사 도메인) 이거나 아직 정해지지 않은 경우: 6자리 숫자
 * - 그 외(고객 개인 메일 등): 기존 규칙대로 영문·숫자·기호 8자리
 */

export const HIFITIDAL_DOMAIN = 'hifitidal.com';

export function isHifiTidalId(id?: string | null): boolean {
    if (!id) return false;
    return id.trim().toLowerCase().endsWith(`@${HIFITIDAL_DOMAIN}`);
}

function randomInt(maxExclusive: number): number {
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
        const buf = new Uint32Array(1);
        crypto.getRandomValues(buf);
        return buf[0] % maxExclusive;
    }
    return Math.floor(Math.random() * maxExclusive);
}

/** 6자리 숫자 비밀번호 (첫 자리는 0이 아님) */
export function generateNumericPassword(length = 6): string {
    let pass = String(1 + randomInt(9));
    while (pass.length < length) pass += String(randomInt(10));
    return pass;
}

/** 영문 대소문자·숫자·기호 혼합 비밀번호 (기존 규칙) */
export function generateMixedPassword(length = 8): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@$';
    let pass = '';
    for (let i = 0; i < length; i++) pass += chars.charAt(randomInt(chars.length));
    return pass;
}

/**
 * Tidal ID에 맞는 초기 비밀번호를 만든다.
 * ID가 비어 있으면 아직 hifitidal.com 계정이 만들어지기 전(마스터 그룹 생성 등)이므로 6자리 숫자를 준다.
 */
export function generateTidalPassword(tidalId?: string | null): string {
    if (!tidalId || isHifiTidalId(tidalId)) return generateNumericPassword(6);
    return generateMixedPassword(8);
}

/** 버튼 툴팁 등에 쓸 규칙 설명 */
export function describePasswordRule(tidalId?: string | null): string {
    if (!tidalId || isHifiTidalId(tidalId)) return `${HIFITIDAL_DOMAIN} 계정: 6자리 숫자 비밀번호 생성`;
    return '외부 메일 계정: 영문·숫자·기호 8자리 비밀번호 생성';
}
