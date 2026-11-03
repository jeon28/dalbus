/**
 * 마지막으로 사용한 로그인 수단(카카오/구글/이메일)을 이 브라우저에 기억한다.
 * 로그인 버튼에 "최근 사용" 표시를 붙여, 다른 수단을 눌러 새 계정을 만드는 실수를 줄인다.
 */
export type LoginMethod = 'kakao' | 'google' | 'email';

const KEY = 'dalbus-last-login-method';

export function getLastLoginMethod(): LoginMethod | null {
    try {
        const v = typeof window !== 'undefined' ? window.localStorage.getItem(KEY) : null;
        return v === 'kakao' || v === 'google' || v === 'email' ? v : null;
    } catch {
        return null;
    }
}

export function setLastLoginMethod(method: LoginMethod): void {
    try {
        window.localStorage.setItem(KEY, method);
    } catch { /* 저장소 차단 시 무시 */ }
}
