"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import styles from './auth.module.css';

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
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: id, password }),
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

    return (
        <main className={styles.main}>
            <div className={`${styles.card} glass animate-fade-in`}>
                <h1 className={styles.title}>Welcome to<br /><span>Dalbus.</span></h1>

                <form className={styles.form} onSubmit={handleSubmit}>
                    <div className={styles.inputGroup}>
                        <label>아이디 (이메일)</label>
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

                <p className={styles.footer}>
                    계정이 없으신가요?
                    <Link href="/signup" className={styles.link}>회원가입</Link>
                </p>
            </div>
        </main>
    );
}
