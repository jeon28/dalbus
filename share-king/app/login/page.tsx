"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useServices } from '@/lib/ServiceContext';
import styles from './auth.module.css';

export default function LoginPage() {
    const [id, setId] = useState('');
    const [password, setPassword] = useState('');
    const { login } = useServices();
    const router = useRouter();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Simulate login
        if (id && password) {
            login(id, '사용자', `${id}@example.com`);
            router.push('/');
        } else {
            alert('아이디와 비밀번호를 입력해주세요.');
        }
    };

    return (
        <main className={styles.main}>
            <div className={`${styles.card} glass animate-fade-in`}>
                <h1 className={styles.title}>Welcome to<br /><span>Share King.</span></h1>

                <form className={styles.form} onSubmit={handleSubmit}>
                    <div className={styles.inputGroup}>
                        <label>아이디</label>
                        <input
                            type="text"
                            placeholder="아이디를 입력하세요"
                            value={id}
                            onChange={(e) => setId(e.target.value)}
                        />
                    </div>
                    <div className={styles.inputGroup}>
                        <label>비밀번호</label>
                        <input
                            type="password"
                            placeholder="비밀번호를 입력하세요"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
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
