"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * SNS 팝업 로그인 완료 페이지.
 * OAuth 리다이렉트가 이 페이지(팝업 창)로 돌아오면 detectSessionInUrl이 세션을 저장한다.
 * 전화번호·생년월일이 없는 신규 SNS 가입자는 같은 팝업 안에서 /signup/complete 로 보내
 * 추가 정보 입력까지 마쳐야 가입이 완료된다. 이미 완료된 회원이면 바로 닫는다.
 */
export default function PopupCompletePage() {
    const [status, setStatus] = useState<'processing' | 'done' | 'error'>('processing');

    useEffect(() => {
        const finish = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                setStatus('error');
                return;
            }

            // 프로필 완성 여부 확인 — 미완성 SNS 가입자는 팝업 안에서 추가 정보 입력으로 이동
            const { data: profile } = await supabase
                .from('profiles')
                .select('phone, birth_date, signup_method')
                .eq('id', session.user.id)
                .maybeSingle();

            const isSocialUser = profile?.signup_method && profile.signup_method !== 'email';
            const isIncomplete = !profile?.phone || !profile?.birth_date;

            if (isSocialUser && isIncomplete) {
                window.location.replace('/signup/complete');
                return;
            }

            setStatus('done');
            try {
                window.opener?.postMessage({ type: 'dalbus-sns-auth-complete' }, window.location.origin);
            } catch { /* opener 접근 불가 시 무시 — BroadcastChannel이 대신 전파한다 */ }
            setTimeout(() => window.close(), 800);
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
