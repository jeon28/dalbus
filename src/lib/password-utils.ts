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

/**
 * 저장 직전 비밀번호 변경 확인. 바뀌지 않았거나 처음 넣는 값이면 묻지 않는다.
 * (브라우저 전용: window.confirm 사용)
 */
export function confirmPasswordChange(
    oldValue: string | null | undefined,
    newValue: string | null | undefined,
    label = '비밀번호',
): boolean {
    const o = (oldValue || '').trim();
    const n = (newValue || '').trim();
    if (o === n || !o) return true;
    return window.confirm(
        `${label}가 변경됩니다.\n\n이전: ${o}\n새 값: ${n || '(빈 값)'}\n\n` +
        'Tidal(실제 계정)에서도 같은 값으로 변경했는지 확인했습니까?',
    );
}
