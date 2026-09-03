/**
 * 메일 템플릿 스코프 판정.
 *
 * 계정 관리 모듈마다 쓰는 템플릿이 다르고, 템플릿 목록은 하나의 API(/api/admin/email-templates)로
 * 내려온다. 예전에는 각 화면이 `!key.startsWith('LEGACY')` 같은 부정 조건으로 걸렀는데, 모듈이
 * 하나 늘어날 때마다 기존 화면이 새 모듈의 템플릿을 흡수해 버렸다. 그래서 접두사를 한곳에 모아
 * "내 것만 고른다"는 긍정 조건으로 판정한다.
 */

/** 모듈 전용 템플릿 접두사. 접두사가 없는 템플릿은 Tidal 계열 공용으로 본다. */
const MODULE_PREFIXES = ['LEGACY', 'QOBUZ'] as const;

export type TemplateScope = 'tidal' | 'legacy' | 'qobuz';

const PREFIX_BY_SCOPE: Record<Exclude<TemplateScope, 'tidal'>, string> = {
    legacy: 'LEGACY',
    qobuz: 'QOBUZ',
};

/** 해당 스코프의 화면에 노출할 템플릿인지 판정한다. */
export function isTemplateInScope(key: string, scope: TemplateScope): boolean {
    if (scope === 'tidal') {
        // Tidal/HifiTidal 화면은 다른 모듈 전용 템플릿을 보여주지 않는다
        return !MODULE_PREFIXES.some(prefix => key.startsWith(prefix));
    }
    return key.startsWith(PREFIX_BY_SCOPE[scope]);
}

/** 목록에서 스코프에 맞는 템플릿만 남긴다. */
export function filterTemplatesByScope<T extends { key: string }>(
    templates: T[],
    scope: TemplateScope
): T[] {
    return templates.filter(t => isTemplateInScope(t.key, scope));
}
