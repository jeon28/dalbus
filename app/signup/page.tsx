"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import styles from '../login/auth.module.css';

export default function SignupPage() {
    const [formData, setFormData] = useState({
        id: '',
        password: '',
        email: '',
        name: ''
    });
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const { id, password, email, name } = formData;

        if (!id || !password || !email || !name) {
            alert('모든 필드를 입력해주세요.');
            return;
        }

        // 1. Supabase Auth Signup
        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    name: name,
                    login_id: id
                }
            }
        });

        if (error) {
            alert('회원가입 실패: ' + error.message);
            return;
        }

        if (data.user) {
            // 2. Create Profile in public.profiles table
            const { error: profileError } = await supabase
                .from('profiles')
                .insert([
                    { id: data.user.id, name: name, email: email }
                ]);

            if (profileError) {
                console.error('Error creating profile:', profileError);
                alert('회원정보 저장에 실패했습니다: ' + profileError.message);
                return;
            }

            alert('회원가입이 완료되었습니다!');
            router.push('/');
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    return (
        <main className={styles.main}>
            <div className={`${styles.card} glass animate-fade-in`}>
                <h1 className={styles.title}>Join<br /><span>Dalbus.</span></h1>

                <form className={styles.form} onSubmit={handleSubmit}>
                    <div className={styles.inputGroup}>
                        <label>아이디</label>
                        <input
                            type="text"
                            name="id"
                            placeholder="사용할 아이디"
                            value={formData.id}
                            onChange={handleChange}
                        />
                    </div>
                    <div className={styles.inputGroup}>
                        <label>비밀번호</label>
                        <input
                            type="password"
                            name="password"
                            placeholder="비밀번호"
                            value={formData.password}
                            onChange={handleChange}
                        />
                    </div>
                    <div className={styles.inputGroup}>
                        <label>이메일</label>
                        <input
                            type="email"
                            name="email"
                            placeholder="example@email.com"
                            value={formData.email}
                            onChange={handleChange}
                        />
                    </div>
                    <div className={styles.inputGroup}>
                        <label>이름</label>
                        <input
                            type="text"
                            name="name"
                            placeholder="홍길동"
                            value={formData.name}
                            onChange={handleChange}
                        />
                    </div>
                    <button type="submit" className={styles.submitBtn}>가입하기</button>
                </form>

                <p className={styles.footer}>
                    이미 계정이 있으신가요?
                    <Link href="/login" className={styles.link}>로그인</Link>
                </p>
            </div>
        </main>
    );
}
