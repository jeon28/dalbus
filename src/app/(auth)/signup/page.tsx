"use client";

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Eye, EyeOff, Lock, Mail, User, Phone } from 'lucide-react';
import styles from '../login/auth.module.css';

export default function SignupPage() {
    const [formData, setFormData] = useState({
        id: '',
        name: '',
        phone: '',
        password: '',
        confirmPassword: ''
    });
    const [errors, setErrors] = useState({
        id: '',
        name: '',
        phone: '',
        password: '',
        confirmPassword: ''
    });
    const [loading, setLoading] = useState(false);
    const [emailChecked, setEmailChecked] = useState(false);
    const [checkingEmail, setCheckingEmail] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Refs for focus management
    const idRef = useRef<HTMLInputElement>(null);
    const nameRef = useRef<HTMLInputElement>(null);
    const phoneRef = useRef<HTMLInputElement>(null);
    const passwordRef = useRef<HTMLInputElement>(null);
    const confirmPasswordRef = useRef<HTMLInputElement>(null);

    const router = useRouter();

    // Check if form is ready to submit
    const isFormValid =
        emailChecked &&
        formData.name.trim() !== '' &&
        formData.phone.trim() !== '' &&
        formData.password.length >= 6 &&
        formData.password === formData.confirmPassword &&
        !errors.id && !errors.name && !errors.phone && !errors.password && !errors.confirmPassword;

    const validateField = (name: string, value: string) => {
        let error = '';
        if (name === 'id') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!value) error = '아이디(이메일)를 입력해주세요.';
            else if (!emailRegex.test(value)) error = '올바른 이메일 형식이 아닙니다 (예: name@example.com)';
            else if (!emailChecked) error = '이메일 중복 확인을 해주세요.';
        } else if (name === 'name') {
            if (!value) error = '이름을 입력해주세요.';
        } else if (name === 'phone') {
            const phoneRegex = /^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/;
            if (!value) error = '전화번호를 입력해주세요.';
            else if (!phoneRegex.test(value.replace(/-/g, ''))) error = '올바른 전화번호 형식이 아닙니다 (예: 010-1234-5678)';
        } else if (name === 'password') {
            if (!value) error = '비밀번호를 입력해주세요.';
            else if (value.length < 6) error = '비밀번호는 최소 6자 이상이어야 합니다.';
        } else if (name === 'confirmPassword') {
            if (!value) error = '비밀번호를 다시 한번 입력해주세요.';
            else if (value !== formData.password) error = '비밀번호가 일치하지 않습니다.';
        }
        return error;
    };

    const handleCheckEmail = async () => {
        const email = formData.id;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!email) {
            setErrors(prev => ({ ...prev, id: '아이디(이메일)를 입력해주세요.' }));
            idRef.current?.focus();
            return;
        }

        if (!emailRegex.test(email)) {
            setErrors(prev => ({ ...prev, id: '올바른 이메일 형식이 아닙니다.' }));
            idRef.current?.focus();
            return;
        }

        setCheckingEmail(true);
        try {
            const response = await fetch('/api/auth/check-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (data.available) {
                setEmailChecked(true);
                setErrors(prev => ({ ...prev, id: '' }));
                alert('✓ ' + data.message);
                // Move to next field (name)
                nameRef.current?.focus();
            } else {
                setEmailChecked(false);
                setErrors(prev => ({ ...prev, id: data.message }));
                idRef.current?.focus();
            }
        } catch (error) {
            console.error('Email check error:', error);
            setErrors(prev => ({ ...prev, id: '중복 확인 중 오류가 발생했습니다.' }));
        } finally {
            setCheckingEmail(false);
        }
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        const { name, value } = e.target;

        // Skip validation for email if not checked yet (will be validated on button click)
        if (name === 'id') {
            return;
        }

        // Just validate and show error, don't force focus
        const error = validateField(name, value);
        setErrors(prev => ({ ...prev, [name]: error }));
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        // Reset email check if email field changes
        if (name === 'id' && emailChecked) {
            setEmailChecked(false);
        }

        // Clear error as user types
        if (errors[name as keyof typeof errors]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Final validation check
        const idErr = validateField('id', formData.id);
        const nameErr = validateField('name', formData.name);
        const phoneErr = validateField('phone', formData.phone);
        const passErr = validateField('password', formData.password);
        const confErr = validateField('confirmPassword', formData.confirmPassword);

        const newErrors = {
            id: idErr,
            name: nameErr,
            phone: phoneErr,
            password: passErr,
            confirmPassword: confErr
        };

        setErrors(newErrors);

        if (idErr) { idRef.current?.focus(); return; }
        if (nameErr) { nameRef.current?.focus(); return; }
        if (phoneErr) { phoneRef.current?.focus(); return; }
        if (passErr) { passwordRef.current?.focus(); return; }
        if (confErr) { confirmPasswordRef.current?.focus(); return; }

        setLoading(true);

        // 1. Supabase Auth Signup
        const { data, error } = await supabase.auth.signUp({
            email: formData.id,
            password: formData.password,
            options: {
                emailRedirectTo: `${window.location.origin}/login`,
                data: {
                    name: formData.name,
                    phone: formData.phone,
                    login_id: formData.id
                }
            }
        });

        if (error) {
            // 이미 가입된 이메일인 경우 특별 처리
            if (error.message.includes('already registered') || error.message.includes('already exists')) {
                alert('⚠️ 이미 가입된 이메일입니다.\n로그인 페이지로 이동하세요.');
                router.push('/login');
            } else if (error.message.includes('rate limit')) {
                alert('⚠️ 이메일 전송 한도 초과\n\nSupabase 설정에서 "Email Confirmation"을 비활성화하거나\n잠시 후 다시 시도해주세요.');
            } else {
                alert('❌ 회원가입 실패: ' + error.message);
            }
            setLoading(false);
            return;
        }

        if (data.user) {
            // 2. Create or Update Profile in public.profiles table
            // upsert: 이미 존재하면 업데이트, 없으면 삽입
            const { error: profileError } = await supabase
                .from('profiles')
                .upsert([
                    {
                        id: data.user.id,
                        name: formData.name,
                        email: formData.id,
                        phone: formData.phone,
                        updated_at: new Date().toISOString()
                    }
                ], {
                    onConflict: 'id' // id가 중복되면 업데이트
                });

            if (profileError) {
                console.error('Error creating profile:', profileError);
                alert('⚠️ 프로필 생성 실패: ' + profileError.message + '\n\n관리자에게 문의하세요.');
                setLoading(false);
                return;
            }

            alert('✅ 회원가입이 완료되었습니다!');
            router.push('/login');
        }
        setLoading(false);
    };

    return (
        <main className={styles.main}>
            <div className={`${styles.card} glass animate-fade-in`}>
                <h1 className={styles.title}>Join<br /><span>Dalbus.</span></h1>

                <form className={styles.form} onSubmit={handleSubmit} noValidate>
                    {/* 1. 이메일 (중복 체크) */}
                    <div className={styles.inputGroup}>
                        <label>아이디 (이메일)</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <div style={{ position: 'relative', flex: 1 }}>
                                <div style={{
                                    position: 'absolute',
                                    left: '15px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    color: '#64748b',
                                    pointerEvents: 'none'
                                }}>
                                    <Mail size={18} />
                                </div>
                                <input
                                    ref={idRef}
                                    type="email"
                                    name="id"
                                    placeholder="name@example.com"
                                    value={formData.id}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    className={errors.id ? styles.inputError : ''}
                                    style={{ width: '100%', paddingLeft: '45px' }}
                                    disabled={emailChecked}
                                />
                            </div>
                            <button
                                type="button"
                                onClick={handleCheckEmail}
                                disabled={checkingEmail || emailChecked}
                                className={styles.checkBtn}
                                style={{
                                    padding: '0 16px',
                                    fontSize: '14px',
                                    whiteSpace: 'nowrap',
                                    backgroundColor: emailChecked ? '#e5e7eb' : undefined,
                                    color: emailChecked ? '#9ca3af' : undefined,
                                    cursor: emailChecked ? 'not-allowed' : 'pointer',
                                    opacity: 1
                                }}
                            >
                                {checkingEmail ? '확인 중...' : emailChecked ? '확인 완료' : '중복 확인'}
                            </button>
                        </div>
                        {errors.id && <span className={styles.errorText}>{errors.id}</span>}
                    </div>

                    {/* 2. 이름 */}
                    <div className={styles.inputGroup}>
                        <label>이름</label>
                        <div style={{ position: 'relative' }}>
                            <div style={{
                                position: 'absolute',
                                left: '15px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                display: 'flex',
                                alignItems: 'center',
                                color: '#64748b',
                                pointerEvents: 'none'
                            }}>
                                <User size={18} />
                            </div>
                            <input
                                ref={nameRef}
                                type="text"
                                name="name"
                                placeholder="홍길동"
                                value={formData.name}
                                onChange={handleChange}
                                onBlur={handleBlur}
                                className={errors.name ? styles.inputError : ''}
                                style={{ paddingLeft: '45px' }}
                                disabled={!emailChecked}
                            />
                        </div>
                        {errors.name && <span className={styles.errorText}>{errors.name}</span>}
                    </div>

                    {/* 3. 전화번호 */}
                    <div className={styles.inputGroup}>
                        <label>전화번호</label>
                        <div style={{ position: 'relative' }}>
                            <div style={{
                                position: 'absolute',
                                left: '15px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                display: 'flex',
                                alignItems: 'center',
                                color: '#64748b',
                                pointerEvents: 'none'
                            }}>
                                <Phone size={18} />
                            </div>
                            <input
                                ref={phoneRef}
                                type="tel"
                                name="phone"
                                placeholder="010-1234-5678"
                                value={formData.phone}
                                onChange={handleChange}
                                onBlur={handleBlur}
                                className={errors.phone ? styles.inputError : ''}
                                style={{ paddingLeft: '45px' }}
                                disabled={!emailChecked}
                            />
                        </div>
                        {errors.phone && <span className={styles.errorText}>{errors.phone}</span>}
                    </div>

                    {/* 4. 비밀번호 */}
                    <div className={styles.inputGroup}>
                        <label>비밀번호 (6자 이상)</label>
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
                                ref={passwordRef}
                                type={showPassword ? 'text' : 'password'}
                                name="password"
                                placeholder="최소 6자 이상"
                                value={formData.password}
                                onChange={handleChange}
                                onBlur={handleBlur}
                                className={errors.password ? styles.inputError : ''}
                                style={{
                                    width: '100%',
                                    paddingLeft: '45px',
                                    paddingRight: '50px'
                                }}
                                disabled={!emailChecked}
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
                        {errors.password && <span className={styles.errorText}>{errors.password}</span>}
                    </div>

                    {/* 5. 비밀번호 확인 */}
                    <div className={styles.inputGroup}>
                        <label>비밀번호 확인</label>
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
                                ref={confirmPasswordRef}
                                type={showConfirmPassword ? 'text' : 'password'}
                                name="confirmPassword"
                                placeholder="비밀번호 재입력"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                onBlur={handleBlur}
                                className={errors.confirmPassword ? styles.inputError : ''}
                                style={{
                                    width: '100%',
                                    paddingLeft: '45px',
                                    paddingRight: '50px'
                                }}
                                disabled={!emailChecked}
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
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
                                {showConfirmPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                            </button>
                        </div>
                        {errors.confirmPassword && <span className={styles.errorText}>{errors.confirmPassword}</span>}
                    </div>

                    <button
                        type="submit"
                        className={styles.submitBtn}
                        disabled={loading || !isFormValid}
                        style={{
                            backgroundColor: isFormValid ? '#000000' : '#e5e7eb',
                            color: isFormValid ? '#ffffff' : '#9ca3af',
                            cursor: isFormValid ? 'pointer' : 'not-allowed',
                            opacity: loading ? 0.7 : 1
                        }}
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
