"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { User, Phone, Calendar, CheckCircle } from 'lucide-react';
import styles from '../../login/auth.module.css';
import { toast } from 'sonner';
import { formatPhoneInput } from '@/lib/utils';

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

    // SNS 가입 팝업 안에서 열렸으면, 완료 시 페이지 이동 대신 원래 창에 알리고 닫는다.
    const isPopup = typeof window !== 'undefined' && window.opener != null;
    const closePopup = () => {
        try {
            window.opener?.postMessage({ type: 'dalbus-sns-auth-complete' }, window.location.origin);
        } catch { /* opener 접근 불가 시 무시 */ }
        window.close();
    };

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

            const { data: profile } = await supabase
                .from('profiles')
                .select('name, phone, birth_date, signup_method')
                .eq('id', userId)
                .single();

            if (!mounted) return;

            // Email users: redirect to mypage if info is complete, or home if not (they shouldn't be here)
            const isEmailUser = !profile?.signup_method || profile.signup_method === 'email';
            if (isEmailUser) {
                if (isPopup) { closePopup(); return; }
                window.location.replace(profile?.phone && profile?.birth_date ? '/mypage' : '/');
                return;
            }

            // Social users: redirect home if already completed
            if (profile?.phone && profile?.birth_date) {
                if (isPopup) { closePopup(); return; }
                window.location.replace('/');
                return;
            }

            // Social user with incomplete profile — show the form
            // 주문 시 백필된 프로필 값(이름·전화번호)이 있으면 미리 채워 생년월일만 입력하면 되게 한다.
            const socialName = metadata?.full_name || metadata?.name || '';
            setFormData(prev => ({
                ...prev,
                name: profile?.name || socialName || '',
                phone: profile?.phone ? formatPhoneInput(profile.phone) : prev.phone
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
        const { name } = e.target;
        const value = name === 'phone' ? formatPhoneInput(e.target.value) : e.target.value;
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
                toast.error('프로필 업데이트 중 오류가 발생했습니다. 다시 시도해주세요.');
                setLoading(false);
                return;
            }

            toast.success('회원가입이 완료되었습니다! 서비스를 이용해 주세요.');
            if (isPopup) {
                // 주문 페이지에 완료를 알리고 팝업을 닫는다 (주문 입력값은 원래 창에 유지됨)
                closePopup();
                return;
            }
            window.location.replace('/');
        } catch (error) {
            console.error('Submit error:', error);
            toast.error('오류가 발생했습니다. 다시 시도해주세요.');
            setLoading(false);
        }
    };

    if (checking) {
        return (
            <main className={styles.main}>
                <div className={`${styles.card} glass animate-fade-in`}>
                    <div className="flex flex-col items-center gap-3 py-10">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
                        <p className="text-sm text-muted-foreground">로딩 중...</p>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className={styles.main}>
            <div className={`${styles.card} glass animate-fade-in`}>
                <div className="text-center">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center mx-auto mb-4">
                        <CheckCircle size={28} color="#fff" />
                    </div>
                    <h1 className={styles.title}>
                        거의 다 됐어요!
                    </h1>
                    <p className="text-[0.9rem] text-muted-foreground mt-2 leading-normal">
                        서비스 이용을 위해 아래 정보를 입력해주세요.
                    </p>
                </div>

                <form className={styles.form} onSubmit={handleSubmit} noValidate>
                    {/* 이름 */}
                    <div className={styles.inputGroup}>
                        <label>이름</label>
                        <div className="relative">
                            <div className="absolute left-[15px] top-1/2 -translate-y-1/2 flex items-center text-muted-foreground pointer-events-none">
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
                                className={`${errors.name ? styles.inputError : ''} !pl-[45px] w-full`}
                            />
                        </div>
                        {errors.name && <span className={styles.errorText}>{errors.name}</span>}
                    </div>

                    {/* 생년월일 */}
                    <div className={styles.inputGroup}>
                        <label>생년월일</label>
                        <div className="relative flex gap-2">
                            <div className="absolute left-[15px] top-1/2 -translate-y-1/2 flex items-center text-muted-foreground pointer-events-none z-[1]">
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
                                className={`${errors.birthdate ? styles.inputError : ''} flex-[1.2] !pl-[38px]`}
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
                                className={`${errors.birthdate ? styles.inputError : ''} flex-1`}
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
                                className={`${errors.birthdate ? styles.inputError : ''} flex-1`}
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
                        <div className="relative">
                            <div className="absolute left-[15px] top-1/2 -translate-y-1/2 flex items-center text-muted-foreground pointer-events-none">
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
                                className={`${errors.phone ? styles.inputError : ''} !pl-[45px] w-full`}
                            />
                        </div>
                        {errors.phone && <span className={styles.errorText}>{errors.phone}</span>}
                    </div>

                    <button
                        type="submit"
                        className={`${styles.submitBtn} ${isFormValid ? 'bg-primary text-primary-foreground cursor-pointer' : 'bg-gray-200 text-gray-400 cursor-not-allowed'} ${loading ? 'opacity-70' : 'opacity-100'}`}
                        disabled={loading || !isFormValid}
                    >
                        {loading ? '처리 중...' : '회원 가입 완료'}
                    </button>
                </form>

                <button
                    type="button"
                    onClick={async () => {
                        await supabase.auth.signOut();
                        window.location.href = '/';
                    }}
                    className="mt-4 w-full h-12 rounded-xl text-sm font-medium transition-all duration-200 border border-gray-200 hover:bg-gray-50 flex items-center justify-center gap-2 text-muted-foreground cursor-pointer text-center"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    다른 계정으로 로그인 (로그아웃)
                </button>
            </div>
        </main>
    );
}
