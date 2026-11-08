import { createHmac } from 'crypto';
import { isHifiTidalId } from './password-utils';

/**
 * 규칙 계산형 비밀번호 (서버 전용)
 *
 * 같은 Tidal ID + 같은 비밀키 → 항상 같은 비밀번호.
 * - ****@hifitidal.com : 6자리 숫자 (첫 자리 1~9)
 * - 그 외 외부 메일     : 영문·숫자·기호 8자리
 *
 * 비밀키(TIDAL_PASSWORD_SECRET)는 서버 환경변수에만 둔다. 키가 바뀌면 모든 계산값이 바뀌므로
 * 운영 환경(Vercel)과 로컬 .env.local 에 같은 값을 넣어야 한다.
 */

export const PASSWORD_SECRET_ENV = 'TIDAL_PASSWORD_SECRET';

export function normalizeTidalId(id: string): string {
    return id.trim().toLowerCase();
}

function getSecret(): string | null {
    const s = process.env[PASSWORD_SECRET_ENV]?.trim();
    return s ? s : null;
}

export function isPasswordSecretConfigured(): boolean {
    return getSecret() !== null;
}

const MIXED_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@$';

/** 계산값. 비밀키가 없으면 null. */
export function derivePassword(tidalId: string): string | null {
    const secret = getSecret();
    if (!secret) return null;
    const id = normalizeTidalId(tidalId);
    if (!id) return null;

    const digest = createHmac('sha256', secret).update(id).digest();

    if (isHifiTidalId(id)) {
        // 앞 6바이트 → 숫자 → 100000~999999
        const n = Number(digest.readUIntBE(0, 6));
        return String(100000 + (n % 900000));
    }

    let pass = '';
    for (let i = 0; i < 8; i++) pass += MIXED_CHARS.charAt(digest[i] % MIXED_CHARS.length);
    return pass;
}
