/**
 * 계정 초기 비밀번호 규칙 (브라우저·서버 공용, 순수 함수만)
 *
 * 실제 계산은 서버(src/lib/password-derive.ts)에서 비밀키로 한다.
 * - Tidal ID가 ****@hifitidal.com 이면 6자리 숫자
 * - 그 외 외부 메일이면 영문·숫자·기호 8자리
 * 같은 ID는 항상 같은 비밀번호가 나오므로 ID만 알면 /admin/password 에서 조회할 수 있다.
 */

export const HIFITIDAL_DOMAIN = 'hifitidal.com';

export function isHifiTidalId(id?: string | null): boolean {
    if (!id) return false;
    return id.trim().toLowerCase().endsWith(`@${HIFITIDAL_DOMAIN}`);
}

/** 버튼 툴팁 등에 쓸 규칙 설명 */
export function describePasswordRule(tidalId?: string | null): string {
    if (!tidalId?.trim()) return 'Tidal ID를 먼저 입력하면 ID 기준으로 비밀번호를 계산합니다';
    if (isHifiTidalId(tidalId)) return `${HIFITIDAL_DOMAIN} 계정: ID 기준 6자리 숫자 계산`;
    return '외부 메일 계정: ID 기준 영문·숫자·기호 8자리 계산';
}
