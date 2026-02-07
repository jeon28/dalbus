"use client";

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import styles from '../login/auth.module.css';

export default function SignupPage() {
    const [formData, setFormData] = useState({
        id: '',
        password: '',
        confirmPassword: '',
        name: ''
    });
    const [errors, setErrors] = useState({
        id: '',
        password: '',
        confirmPassword: '',
        name: ''
    });
    const [loading, setLoading] = useState(false);

    // Refs for focus management
    const idRef = useRef<HTMLInputElement>(null);
    const passwordRef = useRef<HTMLInputElement>(null);
    const confirmPasswordRef = useRef<HTMLInputElement>(null);
    const nameRef = useRef<HTMLInputElement>(null);

    const router = useRouter();

    const validateField = (name: string, value: string) => {
        let error = '';
        if (name === 'id') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!value) error = '아이디(이메일)를 입력해주세요.';
            else if (!emailRegex.test(value)) error = '올바른 이메일 형식이 아닙니다 (예: name@example.com)';
        } else if (name === 'password') {
            if (!value) error = '비밀번호를 입력해주세요.';
            else if (value.length < 6) error = '비밀번호는 최소 6자 이상이어야 합니다.';
        } else if (name === 'confirmPassword') {
            if (!value) error = '비밀번호를 다시 한번 입력해주세요.';
            else if (value !== formData.password) error = '비밀번호가 일치하지 않습니다.';
        } else if (name === 'name') {
            if (!value) error = '이름을 입력해주세요.';
        }
        return error;
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        const { name, value } = e.target;

        // Only validate if there's a value or if we want to enforce it on exit
        const error = validateField(name, value);

        // Isolate error: Only update the current field's error
        setErrors(prev => ({ ...prev, [name]: error }));

        if (error) {
            // Stay in the current field if invalid
            setTimeout(() => {
                const refs: Record<string, React.RefObject<HTMLInputElement | null>> = {
                    id: idRef,
                    password: passwordRef,
                    confirmPassword: confirmPasswordRef,
                    name: nameRef
                };
                refs[name]?.current?.focus();
            }, 10);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        // Clear error as user types
        if (errors[name as keyof typeof errors]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Final validation check
        const idErr = validateField('id', formData.id);
        const passErr = validateField('password', formData.password);
        const confErr = validateField('confirmPassword', formData.confirmPassword);
        const nameErr = validateField('name', formData.name);

        const newErrors = {
            id: idErr,
            password: passErr,
            confirmPassword: confErr,
            name: nameErr
        };

        setErrors(newErrors);

        if (idErr) { idRef.current?.focus(); return; }
        if (passErr) { passwordRef.current?.focus(); return; }
        if (confErr) { confirmPasswordRef.current?.focus(); return; }
        if (nameErr) { nameRef.current?.focus(); return; }

        setLoading(true);

        // 1. Supabase Auth Signup
        const { data, error } = await supabase.auth.signUp({
            email: formData.id,
            password: formData.password,
            options: {
                data: {
                    name: formData.name,
                    login_id: formData.id
                }
            }
        });

        if (error) {
            alert('회원가입 실패: ' + error.message);
            setLoading(false);
            return;
        }

        if (data.user) {
            // 2. Create Profile in public.profiles table
            const { error: profileError } = await supabase
                .from('profiles')
                .insert([
                    { id: data.user.id, name: formData.name, email: formData.id }
                ]);

            if (profileError) {
                console.error('Error creating profile:', profileError);
            }

            alert('회원가입이 완료되었습니다!');
            router.push('/login');
        }
        setLoading(false);
    };

    return (
        <main className={styles.main}>
            <div className={`${styles.card} glass animate-fade-in`}>
                <h1 className={styles.title}>Join<br /><span>Dalbus.</span></h1>

                <form className={styles.form} onSubmit={handleSubmit} noValidate>
                    <div className={styles.inputGroup}>
                        <label>아이디 (이메일)</label>
                        <input
                            ref={idRef}
                            type="email"
                            name="id"
                            placeholder="name@example.com"
                            value={formData.id}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            className={errors.id ? styles.inputError : ''}
                        />
                        {errors.id && <span className={styles.errorText}>{errors.id}</span>}
                    </div>

                    <div className={styles.inputGroup}>
                        <label>비밀번호 (6자 이상)</label>
                        <input
                            ref={passwordRef}
                            type="password"
                            name="password"
                            placeholder="최소 6자 이상"
                            value={formData.password}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            className={errors.password ? styles.inputError : ''}
                        />
                        {errors.password && <span className={styles.errorText}>{errors.password}</span>}
                    </div>

                    <div className={styles.inputGroup}>
                        <label>비밀번호 확인</label>
                        <input
                            ref={confirmPasswordRef}
                            type="password"
                            name="confirmPassword"
                            placeholder="비밀번호 재입력"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            className={errors.confirmPassword ? styles.inputError : ''}
                        />
                        {errors.confirmPassword && <span className={styles.errorText}>{errors.confirmPassword}</span>}
                    </div>

                    <div className={styles.inputGroup}>
                        <label>이름</label>
                        <input
                            ref={nameRef}
                            type="text"
                            name="name"
                            placeholder="홍길동"
                            value={formData.name}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            className={errors.name ? styles.inputError : ''}
                        />
                        {errors.name && <span className={styles.errorText}>{errors.name}</span>}
                    </div>

                    <button
                        type="submit"
                        className={styles.submitBtn}
                        disabled={loading}
                    >
                        {loading ? '처리 중...' : '가입하기'}
                    </button>
                </form>

                <p className={styles.footer}>
                    이미 계정이 있으신가요?
                    <Link href="/login" className={styles.link}>로그인</Link>
                </p>
            </div>
        </main>
    );
}
