import { fetchDerivedPassword } from './password-client';

/**
 * 저장된 개별 비밀번호가 있으면 그것을, 없으면 Tidal ID 규칙으로 계산한 비밀번호를 돌려준다.
 * 계산도 실패하면 빈 문자열.
 */
export async function resolveLoginPassword(tidalId: string, stored?: string | null): Promise<string> {
    const pw = (stored || '').trim();
    if (pw) return pw;
    try {
        return await fetchDerivedPassword(tidalId);
    } catch {
        return '';
    }
}

/** 클립보드용 텍스트: "아이디\n비밀번호" (비밀번호가 없으면 아이디만) */
export function formatCredentials(tidalId: string, password: string): string {
    return password ? `${tidalId}\n${password}` : tidalId;
}

/**
 * 아이디+비밀번호를 클립보드에 복사한다.
 * 반환값: 비밀번호가 함께 복사됐는지 여부
 */
export async function copyCredentials(tidalId: string, stored?: string | null): Promise<boolean> {
    const id = tidalId.trim();
    const password = await resolveLoginPassword(id, stored);
    await navigator.clipboard.writeText(formatCredentials(id, password));
    return Boolean(password);
}
