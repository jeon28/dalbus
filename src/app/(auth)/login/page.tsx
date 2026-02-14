"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import styles from './auth.module.css';

export default function LoginPage() {
    const [id, setId] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!id || !password) {
            alert('아이디(이메일)와 비밀번호를 입력해주세요.');
            return;
        }

        // 1. Check if email exists using API (bypasses RLS)
        try {
            const checkResponse = await fetch('/api/auth/check-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: id })
            });

            const checkResult = await checkResponse.json();

            if (!checkResult.exists) {
                // Email doesn't exist
                alert('❌ 가입되지 않은 이메일입니다.\n\n회원가입을 먼저 진행해주세요.');
                return;
            }
        } catch (error) {
            console.error('Email check error:', error);
            // Continue with login attempt even if check fails
        }

        // 2. Email exists, try to login
        const { data, error } = await supabase.auth.signInWithPassword({
            email: id,
            password: password,
        });

        if (error) {
            // Email exists but password is wrong or other error
            if (error.message.includes('Invalid login credentials') ||
                error.message.includes('invalid') ||
                error.message.includes('credentials')) {
                alert('❌ 비밀번호가 일치하지 않습니다.\n\n비밀번호를 다시 확인해주세요.');
            } else {
                // 기타 예상치 못한 오류
                alert('❌ 로그인 중 오류가 발생했습니다.\n\n' + error.message + '\n\n잠시 후 다시 시도해주세요.');
            }
        } else {
            // Success - check if user is admin
            if (data.user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', data.user.id)
                    .single();

                if (profile?.role === 'admin') {
                    // Admin user - redirect to admin page
                    router.push('/admin');
                } else {
                    // Regular user - redirect to home
                    router.push('/');
                }
            } else {
                router.push('/');
            }
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
                    <button type="submit" className={styles.submitBtn}>로그인</button>
                </form>

                <p className={styles.footer}>
                    계정이 없으신가요?
                    <Link href="/signup" className={styles.link}>회원가입</Link>
                </p>
            </div>
        </main>
    );
}
