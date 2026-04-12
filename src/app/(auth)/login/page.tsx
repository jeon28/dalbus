"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import styles from './auth.module.css';
import { ForgotPasswordDialog } from './ForgotPasswordDialog';

export default function LoginPage() {
    const [id, setId] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!id || !password) {
            alert('아이디(이메일)와 비밀번호를 입력해주세요.');
            return;
        }

        setIsLoading(true);
        console.log('Login: Attempting login for', id);

        try {
            const normalizedEmail = id.toLowerCase();
            const response = await apiFetch('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email: normalizedEmail, password }),
                cache: 'no-store'
            });

            console.log('Login: API response status', response.status);
            const data = await response.json();
            console.log('Login: API response data received');

            if (!response.ok) {
                console.warn('Login: API error', data.error);
                if (data.error === 'USER_NOT_FOUND') {
                    alert('❌ 가입되지 않은 이메일입니다.\n\n회원가입을 먼저 진행해주세요.');
                } else if (data.error === 'INVALID_PASSWORD') {
                    alert('❌ 비밀번호가 일치하지 않습니다.\n\n비밀번호를 다시 확인해주세요.');
                } else {
                    alert(`❌ 로그인 실패: ${data.message || data.error || '알 수 없는 오류'}`);
                }
                setIsLoading(false);
                return;
            }

            if (data.session) {
                console.log('Login: Setting session');

                // Wrap setSession in a timeout to prevent hanging
                const setSessionPromise = supabase.auth.setSession(data.session);
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('SetSession Timeout')), 2000)
                );

                try {
                    await Promise.race([setSessionPromise, timeoutPromise]);
                    console.log('Login: Session set success');
                } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    console.warn('Login: Session set warning (proceeding anyway):', errorMessage);
                }

                console.log('Login: Forcing navigation...');
                const targetUrl = data.role === 'admin' ? '/admin' : '/';
                window.location.replace(targetUrl);
            } else {
                console.warn('Login: No session in response');
                alert('로그인 성공했으나 세션 정보가 없습니다.');
                setIsLoading(false);
            }

        } catch (error) {
            const err = error as { name?: string; message?: string };
            if (err.name === 'AbortError' || err.message?.includes('aborted')) {
                console.warn('Login: Request aborted');
                return;
            }
            console.error('Login: Fetch error', error);
            alert('로그인 요청 중 오류가 발생했습니다. (네트워크 상태를 확인해주세요)');
            setIsLoading(false);
        }
    };

    const handleSocialLogin = async (provider: 'google' | 'kakao') => {
        setIsLoading(true);
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider,
                options: {
                    redirectTo: `${window.location.origin}/signup/complete`,
                }
            });
            if (error) throw error;
        } catch (error) {
            console.error('Social Login Error:', error);
            alert(`${provider === 'google' ? 'Google' : 'Kakao'} 로그인 중 오류가 발생했습니다.`);
            setIsLoading(false);
        }
    };


    return (
        <main className={styles.main}>
            <div className={`${styles.card} glass animate-fade-in`}>
                <h1 className={styles.title}>Welcome to <span>Dalbus</span></h1>

                <div className={styles.socialGroup}>
                    <button
                        type="button"
                        className={`${styles.socialBtn} ${styles.kakaoBtn}`}
                        onClick={() => handleSocialLogin('kakao')}
                        disabled={isLoading}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 3C6.477 3 2 6.552 2 10.932c0 2.825 1.83 5.3 4.61 6.643l-1 3.5c-.066.236.216.417.412.28l4.084-2.736c.602.08 1.236.124 1.894.124 5.523 0 10-3.553 10-7.933C22 6.552 17.523 3 12 3z"/>
                        </svg>
                        Kakao로 계속하기
                    </button>
                    
                    <button
                        type="button"
                        className={`${styles.socialBtn} ${styles.googleBtn}`}
                        onClick={() => handleSocialLogin('google')}
                        disabled={isLoading}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                        Google로 계속하기
                    </button>
                </div>

                <div className={styles.divider}>
                    <span className={styles.dividerText}>또는 이메일로 로그인</span>
                </div>

                <form className={styles.form} onSubmit={handleSubmit}>
                    <div className={styles.inputGroup}>
                        <label>이메일 (아이디)</label>
                        <div style={{ position: 'relative' }}>
                            <div style={{
                                position: 'absolute',
                                left: '15px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                display: 'flex',
                                alignItems: 'center',
                                color: '#64748b',
                                pointerEvents: 'none',
                                zIndex: 1
                            }}>
                                <Mail size={18} />
                            </div>
                            <input
                                type="email"
                                placeholder="name@example.com"
                                value={id}
                                onChange={(e) => setId(e.target.value)}
                                style={{ paddingLeft: '45px' }}
                                disabled={isLoading}
                                required
                            />
                        </div>
                    </div>
                    <div className={styles.inputGroup}>
                        <label>비밀번호</label>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <div style={{
                                position: 'absolute',
                                left: '15px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                display: 'flex',
                                alignItems: 'center',
                                color: '#64748b',
                                pointerEvents: 'none',
                                zIndex: 1
                            }}>
                                <Lock size={18} />
                            </div>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                placeholder="비밀번호를 입력하세요"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                style={{
                                    width: '100%',
                                    paddingLeft: '45px',
                                    paddingRight: '50px'
                                }}
                                disabled={isLoading}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                tabIndex={-1}
                                style={{
                                    position: 'absolute',
                                    right: '15px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: '0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#64748b',
                                    zIndex: 2,
                                    width: '20px',
                                    height: '20px'
                                }}
                            >
                                {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                            </button>
                        </div>
                    </div>
                    <button
                        type="submit"
                        className={styles.submitBtn}
                        disabled={isLoading}
                    >
                        {isLoading ? '로그인 처리 중...' : '로그인'}
                    </button>
                </form>
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '12px' }}>
                    <ForgotPasswordDialog />
                </div>

                <p className={styles.footer}>
                    계정이 없으신가요?
                    <Link href="/signup" className={styles.link}>회원가입</Link>
                </p>
            </div>
        </main>
    );
}
