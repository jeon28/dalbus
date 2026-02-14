"use client";

import { useEffect } from 'react';

export default function ErrorHandler() {
    useEffect(() => {
        // 전역 unhandledrejection 이벤트 핸들러
        const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
            const error = event.reason;

            // AbortError는 조용히 무시 (React Strict Mode cleanup)
            if (
                error?.name === 'AbortError' ||
                error?.message?.includes('aborted') ||
                error?.message?.includes('signal is aborted')
            ) {
                event.preventDefault(); // 콘솔 에러 출력 방지
                return;
            }

            // 다른 에러는 정상적으로 처리
            console.error('Unhandled rejection:', error);
        };

        window.addEventListener('unhandledrejection', handleUnhandledRejection);

        return () => {
            window.removeEventListener('unhandledrejection', handleUnhandledRejection);
        };
    }, []);

    return null;
}
