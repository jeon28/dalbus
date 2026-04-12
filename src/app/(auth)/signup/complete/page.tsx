"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { User, Phone, Calendar, CheckCircle } from 'lucide-react';
import styles from '../../login/auth.module.css';

export default function SignupCompletePage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [checking, setChecking] = useState(true);
    const [userId, setUserId] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        birthYear: '',
        birthMonth: '',
        birthDay: '',
        phone: ''
    });

    const [errors, setErrors] = useState({
        name: '',
        birthdate: '',
        phone: ''
    });

    const nameRef = useRef<HTMLInputElement>(null);
    const birthdateRef = useRef<HTMLSelectElement>(null);
    const phoneRef = useRef<HTMLInputElement>(null);

    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 100 }, (_, i) => currentYear - i);
    const months = Array.from({ length: 12 }, (_, i) => i + 1);

    const getDaysInMonth = (year: string, month: string) => {
        if (!year || !month) return 31;
        return new Date(parseInt(year), parseInt(month), 0).getDate();
    };

    const days = Array.from(
        { length: getDaysInMonth(formData.birthYear, formData.birthMonth) },
        (_, i) => i + 1
    );

    // Check if user is authenticated and if profile is already complete
    useEffect(() => {
        let mounted = true;

        const handleUser = async (userId: string, metadata: Record<string, string>) => {
            if (!mounted) return;
            setUserId(userId);

            // Pre-fill name from Google metadata if available
            const googleName = metadata?.full_name || metadata?.name || '';

            // Check if profile already has phone (meaning already completed)
            const { data: profile } = await supabase
                .from('profiles')
                .select('name, phone, birth_date')
                .eq('id', userId)
                .single();

            if (!mounted) return;

            if (profile?.phone && profile?.birth_date) {
                // Already completed, go home
                window.location.replace('/');
                return;
            }

            setFormData(prev => ({
                ...prev,
                name: profile?.name || googleName || ''
            }));

            setChecking(false);
        };

        // First try getSession (works for returning users)
        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession();

            if (session?.user) {
                await handleUser(session.user.id, session.user.user_metadata as Record<string, string>);
            }
            // If no session yet, onAuthStateChange below will catch it
        };

        init();

        // Listen for auth state changes (catches OAuth callback)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (!mounted) return;
                if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
                    await handleUser(session.user.id, session.user.user_metadata as Record<string, string>);
                }
            }
        );

        // Safety timeout: if nothing happens in 5 seconds, redirect to signup
        const timeout = setTimeout(() => {
            if (mounted && checking) {
                router.replace('/signup');
            }
        }, 5000);

        return () => {
            mounted = false;
            subscription.unsubscribe();
            clearTimeout(timeout);
        };
    }, [router, checking]);

    const isFormValid =
        formData.name.trim() !== '' &&
        formData.birthYear !== '' &&
        formData.birthMonth !== '' &&
        formData.birthDay !== '' &&
        formData.phone.trim() !== '' &&
        !errors.name && !errors.birthdate && !errors.phone;

    const validateField = (name: string, value: string) => {
        let error = '';
        if (name === 'name') {
            if (!value.trim()) error = '이름을 입력해주세요.';
        } else if (name === 'birthdate') {
            if (!formData.birthYear || !formData.birthMonth || !formData.birthDay) {
                error = '생년월일을 모두 선택해주세요.';
            }
        } else if (name === 'phone') {
            const phoneRegex = /^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/;
            if (!value) error = '전화번호를 입력해주세요.';
            else if (!phoneRegex.test(value.replace(/-/g, ''))) error = '올바른 전화번호 형식이 아닙니다 (예: 010-1234-5678)';
        }
        return error;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        if (errors[name as keyof typeof errors]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const error = validateField(name, value);
        setErrors(prev => ({ ...prev, [name]: error }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const nameErr = validateField('name', formData.name);
        const birthdateErr = validateField('birthdate', '');
        const phoneErr = validateField('phone', formData.phone);

        const newErrors = { name: nameErr, birthdate: birthdateErr, phone: phoneErr };
        setErrors(newErrors);

        if (nameErr) { nameRef.current?.focus(); return; }
        if (birthdateErr) { birthdateRef.current?.focus(); return; }
        if (phoneErr) { phoneRef.current?.focus(); return; }

        if (!userId) return;

        setLoading(true);

        try {
            const birthDate = `${formData.birthYear}.${formData.birthMonth.padStart(2, '0')}.${formData.birthDay.padStart(2, '0')}`;

            const { error } = await supabase
                .from('profiles')
                .update({
                    name: formData.name,
                    phone: formData.phone,
                    birth_date: birthDate
                })
                .eq('id', userId);

            if (error) {
                console.error('Profile update error:', error);
                alert('프로필 업데이트 중 오류가 발생했습니다. 다시 시도해주세요.');
                setLoading(false);
                return;
            }

            alert('회원가입이 완료되었습니다! 서비스를 이용해 주세요.');
            window.location.replace('/');
        } catch (error) {
            console.error('Submit error:', error);
            alert('오류가 발생했습니다. 다시 시도해주세요.');
            setLoading(false);
        }
    };

    if (checking) {
        return (
            <main className={styles.main}>
                <div className={`${styles.card} glass animate-fade-in`}>
                    <div style={{ textAlign: 'center', padding: '40px 0' }}>
                        <p style={{ color: '#64748b' }}>로딩 중...</p>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className={styles.main}>
            <div className={`${styles.card} glass animate-fade-in`}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 16px'
                    }}>
                        <CheckCircle size={28} color="#fff" />
                    </div>
                    <h1 className={styles.title}>
                        거의 다 됐어요!
                    </h1>
                    <p style={{
                        fontSize: '0.9rem',
                        color: '#64748b',
                        marginTop: '8px',
                        lineHeight: '1.5'
                    }}>
                        서비스 이용을 위해 아래 정보를 입력해주세요.
                    </p>
                </div>

                <form className={styles.form} onSubmit={handleSubmit} noValidate>
                    {/* 이름 */}
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
                                style={{ paddingLeft: '45px', width: '100%' }}
                            />
                        </div>
                        {errors.name && <span className={styles.errorText}>{errors.name}</span>}
                    </div>

                    {/* 생년월일 */}
                    <div className={styles.inputGroup}>
                        <label>생년월일</label>
                        <div style={{ position: 'relative', display: 'flex', gap: '8px' }}>
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
                                <Calendar size={18} />
                            </div>
                            <select
                                ref={birthdateRef}
                                name="birthYear"
                                value={formData.birthYear}
                                onChange={handleChange}
                                onBlur={() => {
                                    const err = validateField('birthdate', '');
                                    setErrors(prev => ({ ...prev, birthdate: err }));
                                }}
                                className={errors.birthdate ? styles.inputError : ''}
                                style={{ flex: 1.2, paddingLeft: '38px' }}
                            >
                                <option value="">년도</option>
                                {years.map(year => (
                                    <option key={year} value={year}>{year}년</option>
                                ))}
                            </select>
                            <select
                                name="birthMonth"
                                value={formData.birthMonth}
                                onChange={handleChange}
                                onBlur={() => {
                                    const err = validateField('birthdate', '');
                                    setErrors(prev => ({ ...prev, birthdate: err }));
                                }}
                                className={errors.birthdate ? styles.inputError : ''}
                                style={{ flex: 1 }}
                            >
                                <option value="">월</option>
                                {months.map(month => (
                                    <option key={month} value={month}>{month}월</option>
                                ))}
                            </select>
                            <select
                                name="birthDay"
                                value={formData.birthDay}
                                onChange={handleChange}
                                onBlur={() => {
                                    const err = validateField('birthdate', '');
                                    setErrors(prev => ({ ...prev, birthdate: err }));
                                }}
                                className={errors.birthdate ? styles.inputError : ''}
                                style={{ flex: 1 }}
                            >
                                <option value="">일</option>
                                {days.map(day => (
                                    <option key={day} value={day}>{day}일</option>
                                ))}
                            </select>
                        </div>
                        {errors.birthdate && <span className={styles.errorText}>{errors.birthdate}</span>}
                    </div>

                    {/* 전화번호 */}
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
                                style={{ paddingLeft: '45px', width: '100%' }}
                            />
                        </div>
                        {errors.phone && <span className={styles.errorText}>{errors.phone}</span>}
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
                        {loading ? '처리 중...' : '회원 가입 완료'}
                    </button>
                </form>

                <button
                    type="button"
                    onClick={() => router.push('/')}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: '#94a3b8',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        textAlign: 'center'
                    }}
                >
                    나중에 입력하기
                </button>
            </div>
        </main>
    );
}
