import { unstable_cache } from 'next/cache';
import { supabaseAdmin } from './supabaseAdmin';

/** 기본 브랜드 색상 (globals.css 의 --primary 와 동일 계열) */
export const DEFAULT_BRAND_HEX = '#18181b';

/** site_settings 에 저장된 브랜드 색상(hex)을 읽는다. 60초 캐시 + 'brand-primary' 태그로 즉시 무효화 가능. */
export const getBrandPrimaryHex = unstable_cache(
    async (): Promise<string> => {
        try {
            const { data } = await supabaseAdmin
                .from('site_settings')
                .select('value')
                .eq('key', 'brand_primary')
                .maybeSingle();
            const v = (data?.value as string | undefined)?.trim();
            return v && isValidHex(v) ? v : DEFAULT_BRAND_HEX;
        } catch {
            return DEFAULT_BRAND_HEX;
        }
    },
    ['brand-primary'],
    { revalidate: 60, tags: ['brand-primary'] }
);

/** #rrggbb 형식 검증 */
export function isValidHex(hex: string): boolean {
    return /^#?[0-9a-fA-F]{6}$/.test(hex.trim());
}

/**
 * hex(#rrggbb) → shadcn/Tailwind 용 HSL 변수 문자열.
 * Tailwind 가 hsl(var(--primary)) 로 사용하므로 "H S% L%" 공백 구분 포맷으로 반환한다.
 * 전경색(--primary-foreground)은 배경 명도에 따라 흰/검정으로 자동 선택.
 */
export function hexToThemeVars(hex: string): { primary: string; foreground: string; ring: string } {
    if (!isValidHex(hex)) hex = DEFAULT_BRAND_HEX;
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16) / 255;
    const g = parseInt(h.substring(2, 4), 16) / 255;
    const b = parseInt(h.substring(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let hue = 0;
    let sat = 0;
    const light = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        sat = light > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === r) hue = (g - b) / d + (g < b ? 6 : 0);
        else if (max === g) hue = (b - r) / d + 2;
        else hue = (r - g) / d + 4;
        hue /= 6;
    }

    const H = Math.round(hue * 360);
    const S = Math.round(sat * 100);
    const L = Math.round(light * 100);
    const primary = `${H} ${S}% ${L}%`;

    // 상대 휘도로 전경색 대비 결정
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const foreground = luminance > 0.55 ? '222 47% 11%' : '0 0% 100%';

    return { primary, foreground, ring: primary };
}
