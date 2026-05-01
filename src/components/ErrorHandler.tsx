"use client";

import { useEffect } from 'react';

export default function ErrorHandler() {
    useEffect(() => {
        // 전역 unhandledrejection 이벤트 핸들러
        const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
            const error = event.reason;
            const msg = error?.message || '';
            const isAbort =
                error?.name === 'AbortError' ||
                error?.name === 'CanceledError' ||
                msg.includes('aborted') ||
                msg.includes('signal is aborted') ||
                msg.includes('Canceled');

            if (isAbort) {
                event.preventDefault();
                event.stopImmediatePropagation();
                return;
            }

            console.error('Unhandled rejection:', error);
        };

        // 전역 error 이벤트 핸들러
        const handleError = (event: ErrorEvent) => {
            const msg = event.message || '';
            const isAbort =
                msg.includes('aborted') ||
                msg.includes('signal is aborted') ||
                msg.includes('AbortError') ||
                msg.includes('Canceled');

            if (isAbort) {
                event.preventDefault();
                event.stopImmediatePropagation();
                return;
            }
        };

        window.addEventListener('unhandledrejection', handleUnhandledRejection, true);
        window.addEventListener('error', handleError, true);

        return () => {
            window.removeEventListener('unhandledrejection', handleUnhandledRejection, true);
            window.removeEventListener('error', handleError, true);
        };
    }, []);

    return null;
}
