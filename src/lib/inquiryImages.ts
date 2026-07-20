// 문의/답변 첨부 이미지(Base64 data URL) 서버측 검증 유틸 (순수 함수, 서버/클라 공용)

export const MAX_INQUIRY_IMAGES = 5;
// 개별 이미지 최대 크기(약 1.2MB). 클라이언트에서 700KB 목표로 압축하지만 여유를 둔다.
export const MAX_IMAGE_BYTES = 1_200_000;

/** data URL의 대략적인 바이트 크기 */
function dataUrlBytes(dataUrl: string): number {
    const comma = dataUrl.indexOf(',');
    const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
    return Math.floor((b64.length * 3) / 4);
}

/**
 * 클라이언트가 보낸 images 값을 검증한다.
 * - undefined/null/빈 값 → 빈 배열 반환
 * - 배열이 아니거나, 이미지 data URL이 아니거나, 개수/용량 초과 → null (거부)
 */
export function sanitizeImages(images: unknown): string[] | null {
    if (images == null) return [];
    if (!Array.isArray(images)) return null;
    if (images.length > MAX_INQUIRY_IMAGES) return null;

    const out: string[] = [];
    for (const item of images) {
        if (typeof item !== 'string') return null;
        if (!item.startsWith('data:image/')) return null;
        if (dataUrlBytes(item) > MAX_IMAGE_BYTES) return null;
        out.push(item);
    }
    return out;
}
