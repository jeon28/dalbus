/**
 * 그룹 ID(예: HA01) 생성 규칙.
 *
 * 목록은 보통 내림차순으로 보기 때문에 중간에 빠진(삭제된) 번호가 눈에 띄지 않는다.
 * 그룹 추가 시에는 1번부터 오름차순으로 훑어 비어 있는 첫 번호를 추천하고,
 * 빈 번호가 없으면 마지막 번호 + 1을 추천한다. 그룹 ID는 항상 대문자로 만든다.
 */

export type ParsedGroupId = { prefix: string; num: number; width: number };

/** 뒤쪽 연속 숫자를 번호로, 그 앞을 접두사로 본다. (HA01 → HA / 01) */
const GROUP_ID_RE = /^(.*?)(\d+)$/;

/** 그룹 ID 표기 통일: 공백 제거 + 대문자 */
export function normalizeGroupId(raw: string | null | undefined): string {
    return (raw || '').trim().toUpperCase();
}

export function parseGroupId(raw: string | null | undefined): ParsedGroupId | null {
    const m = GROUP_ID_RE.exec(normalizeGroupId(raw));
    if (!m) return null;
    return { prefix: m[1], num: parseInt(m[2], 10), width: m[2].length };
}

export function formatGroupId(prefix: string, num: number, width: number): string {
    return `${prefix}${String(num).padStart(width, '0')}`;
}

/** 가장 많이 쓰인 접두사를 기준으로 삼는다. (동수면 사전순) */
function pickPrefix(parsed: ParsedGroupId[], fallback: string): string {
    if (parsed.length === 0) return fallback;
    const counts: Record<string, number> = {};
    parsed.forEach(p => { counts[p.prefix] = (counts[p.prefix] || 0) + 1; });
    return Object.keys(counts).sort((a, b) => counts[b] - counts[a] || a.localeCompare(b))[0];
}

export type GroupIdSuggestion = {
    /** 추천 그룹 ID (빈 번호 우선, 없으면 마지막 번호 + 1) */
    id: string;
    prefix: string;
    /** 비어 있는 번호들 (표시용, maxVacancies 개까지) */
    vacancies: string[];
    /** 비어 있는 번호 총 개수 */
    vacancyCount: number;
    /** 빈 번호가 없어 마지막 번호 다음을 추천한 경우 true */
    isAppend: boolean;
};

/**
 * 기존 그룹 ID 목록으로 다음 그룹 ID를 추천한다.
 *
 * @param existingIds 기존 그룹 ID (대소문자/공백 무관)
 * @param options.fallbackPrefix 숫자 형식 ID가 하나도 없을 때 사용할 접두사 (기본 'HA')
 * @param options.minWidth 자리수 하한 (기본 2 → HA01)
 * @param options.maxVacancies vacancies에 담을 최대 개수 (기본 5)
 */
export function suggestGroupId(
    existingIds: (string | null | undefined)[] | null | undefined,
    options: { fallbackPrefix?: string; minWidth?: number; maxVacancies?: number } = {}
): GroupIdSuggestion {
    const fallbackPrefix = normalizeGroupId(options.fallbackPrefix ?? 'HA');
    const minWidth = options.minWidth ?? 2;
    const maxVacancies = options.maxVacancies ?? 5;

    const parsed = (existingIds || [])
        .map(id => parseGroupId(id))
        .filter((p): p is ParsedGroupId => p !== null);

    const prefix = pickPrefix(parsed, fallbackPrefix);
    const sameSeries = parsed.filter(p => p.prefix === prefix);
    const width = sameSeries.reduce((w, p) => Math.max(w, p.width), minWidth);
    const used = new Set(sameSeries.map(p => p.num));
    const maxNum = sameSeries.reduce((m, p) => Math.max(m, p.num), 0);

    const vacancies: string[] = [];
    for (let n = 1; n <= maxNum; n++) {
        if (!used.has(n)) vacancies.push(formatGroupId(prefix, n, width));
    }

    return {
        id: vacancies.length > 0 ? vacancies[0] : formatGroupId(prefix, maxNum + 1, width),
        prefix,
        vacancies: vacancies.slice(0, maxVacancies),
        vacancyCount: vacancies.length,
        isAppend: vacancies.length === 0,
    };
}

/** 추천 결과를 모달 안내 문구로 만든다. */
export function describeGroupIdSuggestion(s: GroupIdSuggestion): string {
    if (s.isAppend) return `빈 번호 없음 · 마지막 번호 다음으로 ${s.id} 추천`;
    const shown = s.vacancies.join(', ');
    const more = s.vacancyCount > s.vacancies.length ? ` 외 ${s.vacancyCount - s.vacancies.length}개` : '';
    return `빈 번호: ${shown}${more} · ${s.id} 추천`;
}
