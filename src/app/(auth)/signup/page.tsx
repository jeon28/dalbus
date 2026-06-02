"use client";

import React from 'react';
import Link from 'next/link';
import styles from '../login/auth.module.css';
import SignupForm from '@/components/auth/SignupForm';

export default function SignupPage() {
    return (
        <main className={styles.main}>
            <div className={`${styles.card} glass animate-fade-in`}>
                <h1 className={styles.title}>달버스 <span>회원가입</span></h1>

                <SignupForm compact />

                <p className={styles.footer}>
                    이미 계정이 있으신가요?
                    <Link href="/login" className={styles.link}>로그인</Link>
                </p>
            </div>
        </main>
    );
}
