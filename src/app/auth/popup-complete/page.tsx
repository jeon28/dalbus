"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * SNS 팝업 로그인 완료 페이지.
 * OAuth 리다이렉트가 이 페이지(팝업 창)로 돌아오면 detectSessionInUrl이 세션을 저장하고,
 * supabase-js의 BroadcastChannel이 원래 창(주문 페이지)에 SIGNED_IN을 전파한다.
 * 여기서는 세션 확정을 확인하고 창을 닫기만 한다.
 */
export default function PopupCompletePage() {
    const [status, setStatus] = useState<'processing' | 'done' | 'error'>('processing');

    useEffect(() => {
        const finish = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                setStatus('done');
                try {
                    window.opener?.postMessage({ type: 'dalbus-sns-auth-complete' }, window.location.origin);
                } catch { /* opener 접근 불가 시 무시 — BroadcastChannel이 대신 전파한다 */ }
                setTimeout(() => window.close(), 800);
            } else {
                setStatus('error');
            }
        };
        finish();
    }, []);

    return (
        <main className="min-h-screen flex items-center justify-center bg-background">
            <div className="text-center space-y-3 px-6">
                {status === 'processing' && (
                    <>
                        <p className="text-2xl">⏳</p>
                        <p className="text-sm font-medium">로그인 처리 중입니다...</p>
                    </>
                )}
                {status === 'done' && (
                    <>
                        <p className="text-2xl">✅</p>
                        <p className="text-sm font-medium">가입이 완료되었습니다.</p>
                        <p className="text-xs text-muted-foreground">이 창은 자동으로 닫힙니다.</p>
                    </>
                )}
                {status === 'error' && (
                    <>
                        <p className="text-2xl">⚠️</p>
                        <p className="text-sm font-medium">로그인에 실패했습니다.</p>
                        <button className="text-xs underline text-muted-foreground" onClick={() => window.close()}>
                            창 닫기
                        </button>
                    </>
                )}
            </div>
        </main>
    );
}
