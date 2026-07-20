/**
 * 이미지 파일/붙여넣기 데이터를 캔버스로 축소·압축하여 Base64 data URL로 변환한다.
 * - 가로/세로 최대 maxDim(px)으로 축소
 * - JPEG 품질을 단계적으로 낮춰 목표 용량(maxBytes) 이하로 맞춤
 * Vercel 요청 본문 한도(약 4.5MB)를 고려해 개별 이미지를 작게 유지한다.
 */
export async function compressImageToDataUrl(
    file: File,
    opts: { maxDim?: number; maxBytes?: number } = {}
): Promise<string> {
    const maxDim = opts.maxDim ?? 1600;
    const maxBytes = opts.maxBytes ?? 700 * 1024; // 약 700KB

    if (!file.type.startsWith('image/')) {
        throw new Error('이미지 파일만 첨부할 수 있습니다.');
    }

    const dataUrl = await readFileAsDataUrl(file);
    const img = await loadImage(dataUrl);

    let { width, height } = img;
    if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl; // 캔버스 미지원 시 원본 반환
    // 투명 PNG를 JPEG로 변환할 때 배경을 흰색으로
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    // GIF/애니메이션은 첫 프레임만 남으므로, 그대로 원본을 유지하고 싶으면 별도 처리 필요.
    let quality = 0.82;
    let out = canvas.toDataURL('image/jpeg', quality);
    while (dataUrlBytes(out) > maxBytes && quality > 0.4) {
        quality -= 0.12;
        out = canvas.toDataURL('image/jpeg', quality);
    }
    return out;
}

/** data URL의 대략적인 바이트 크기 */
export function dataUrlBytes(dataUrl: string): number {
    const comma = dataUrl.indexOf(',');
    const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
    // base64 → 바이트
    return Math.floor((b64.length * 3) / 4);
}

function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('파일을 읽지 못했습니다.'));
        reader.readAsDataURL(file);
    });
}

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('이미지를 불러오지 못했습니다.'));
        img.src = src;
    });
}
