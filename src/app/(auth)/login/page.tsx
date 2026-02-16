"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import styles from './auth.module.css';

export default function LoginPage() {
    const [id, setId] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!id || !password) {
            alert('아이디(이메일)와 비밀번호를 입력해주세요.');
            return;
        }

        setIsLoading(true);
        logger.debug('Login attempt started for:', id);

        // 1. Check if email exists using API (bypasses RLS)
        try {
            const checkResponse = await fetch('/api/auth/check-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: id })
            });

            logger.debug('Check-user response status:', checkResponse.status);
            const checkResult = await checkResponse.json();

            if (!checkResult.exists) {
                // Email doesn't exist
                alert('❌ 가입되지 않은 이메일입니다.\n\n회원가입을 먼저 진행해주세요.');
                setIsLoading(false);
                return;
            }
            logger.info('Email exists, proceeding to signInWithPassword');
        } catch (error) {
            logger.error('Email check error:', error);
            // Continue with login attempt even if check fails
        }

        // 2. Email exists, try to login
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: id,
                password: password,
            });

            console.log('signInWithPassword result:', data.user ? 'Success' : 'Fail', error ? error.message : '');

            if (error) {
                // Email exists but password is wrong or other error
                if (error.message.includes('Invalid login credentials') ||
                    error.message.includes('invalid') ||
                    error.message.includes('credentials')) {
                    alert('❌ 비밀번호가 일치하지 않습니다.\n\n비밀번호를 다시 확인해주세요.');
                } else {
                    // 기타 예상치 못한 오류
                    if (!error.message.includes('aborted')) {
                        alert('❌ 로그인 중 오류가 발생했습니다.\n\n' + error.message + '\n\n잠시 후 다시 시도해주세요.');
                    }
                }
                setIsLoading(false);
                return;
            }

            // Success - check if user is admin
            if (data.user) {
                try {
                    const { data: profile, error: profileErr } = await supabase
                        .from('profiles')
                        .select('role')
                        .eq('id', data.user.id)
                        .single();

                    if (profileErr) {
                        // Silent fail for AbortError during navigation
                        if (!profileErr.message.includes('AbortError') && !profileErr.message.includes('aborted')) {
                            console.error('Profile fetch error:', profileErr);
                        }
                    }

                    if (profile?.role === 'admin') {
                        console.log('User is admin, navigating to /admin');
                        router.push('/admin');
                    } else {
                        console.log('User is regular user, navigating to /');
                        router.push('/');
                    }
                } catch (profileCatchErr) {
                    // If navigation already triggered and fetch aborted
                    const err = profileCatchErr as { message?: string };
                    if (!err.message?.includes('aborted')) {
                        router.push('/');
                    }
                }
            } else {
                router.push('/');
            }
        } catch (loginError) {
            const err = loginError as { message?: string };
            if (!err.message?.includes('aborted')) {
                console.error('Unhandled login error:', loginError);
                alert('로그인 처리 중 예기치 못한 오류가 발생했습니다.');
            }
        } finally {
            // Do not setIsLoading(false) if we are navigating, but if we stay on page (error case), we should.
            // However, it's safer to keep it true if navigation might take time.
            // If the user reaches here without a redirect, let's reset it.
            setTimeout(() => setIsLoading(false), 5000);
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
