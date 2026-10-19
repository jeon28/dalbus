import React, { useRef } from 'react';

/** 한 번 탭과 두 번 탭을 구분하는 대기 시간(ms) */
const DOUBLE_TAP_MS = 300;

/**
 * 전화번호 표시. 폰(터치 기기)에서
 * - 한 번 탭: 전화 연결 (tel:)
 * - 두 번 탭: 문자 연결 (sms:)
 * PC에서는 클릭해도 앱 연결을 막아, 기존처럼 텍스트 선택·행 클릭이 그대로 동작한다.
 */
export function PhoneLink({ phone, className = '' }: { phone?: string | null; className?: string }) {
    const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const digits = (phone || '').replace(/[^0-9+]/g, '');
    if (!phone || digits.length < 8) return <>{phone || '-'}</>;

    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();
        const isTouch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
        if (!isTouch) return;

        if (tapTimer.current) {
            // 두 번째 탭: 대기 중이던 전화 연결을 취소하고 문자 연결
            clearTimeout(tapTimer.current);
            tapTimer.current = null;
            window.location.href = `sms:${digits}`;
            return;
        }
        tapTimer.current = setTimeout(() => {
            tapTimer.current = null;
            window.location.href = `tel:${digits}`;
        }, DOUBLE_TAP_MS);
    };

    return (
        <a
            href={`tel:${digits}`}
            onClick={handleClick}
            title="폰: 한 번 탭 전화 / 두 번 탭 문자"
            style={{ touchAction: 'manipulation' }}
            className={`underline decoration-dotted underline-offset-2 hover:text-blue-600 ${className}`}
        >
            {phone}
        </a>
    );
}
