import React from 'react';

/**
 * 전화번호 표시. 폰(터치 기기)에서 누르면 전화/문자 앱이 뜨도록 tel: 링크로 렌더링한다.
 * PC에서는 클릭해도 전화 앱 연결을 막아, 기존처럼 텍스트 선택·행 클릭이 그대로 동작한다.
 */
export function PhoneLink({ phone, className = '' }: { phone?: string | null; className?: string }) {
    const digits = (phone || '').replace(/[^0-9+]/g, '');
    if (!phone || digits.length < 8) return <>{phone || '-'}</>;

    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        const isTouch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
        if (!isTouch) e.preventDefault();
    };

    return (
        <a
            href={`tel:${digits}`}
            onClick={handleClick}
            className={`underline decoration-dotted underline-offset-2 hover:text-blue-600 ${className}`}
        >
            {phone}
        </a>
    );
}
