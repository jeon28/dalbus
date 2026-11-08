import { apiFetch } from './api';

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * 서버에 Tidal ID 기준 비밀번호 계산을 요청한다.
 * 실패하면 Error 를 던진다 (비밀키 미설정, 권한 없음 등).
 */
export async function fetchDerivedPassword(tidalId: string, fetchFn: FetchLike = apiFetch): Promise<string> {
    const id = tidalId.trim();
    if (!id) throw new Error('Tidal ID를 먼저 입력하세요.');
    const res = await fetchFn(`/api/admin/password/derive?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || '비밀번호 계산에 실패했습니다.');
    if (!data?.password) throw new Error('비밀번호 계산 결과가 비어 있습니다.');
    return data.password as string;
}
