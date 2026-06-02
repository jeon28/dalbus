"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Eye, EyeOff, Lock, Mail, User, Phone, Calendar } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import styles from '../../app/(auth)/login/auth.module.css';
import { toast } from 'sonner';
import { formatPhoneInput } from '@/lib/utils';

export interface SignupFormProps {
    /** 이메일/이름/전화번호 사전 입력값 (비회원 주문 정보에서 전달) */
    initialValues?: { email?: string; name?: string; phone?: string };
    /** true면 모달용 컴팩트(높이 축소) 스타일 적용 */
    compact?: boolean;
    /**
     * 회원가입 성공 시 호출. 지정하면 기본 리다이렉트 대신 이 콜백이 실행된다.
     * (서비스 페이지 모달에서 주문 이어가기에 사용)
     */
    onSignupSuccess?: (newUserId: string) => void;
    /** 지정하면 가입 버튼 아래에 "비회원으로 주문하기" 버튼을 노출한다. */
    onGuestContinue?: () => void;
    /** 비회원 계속 버튼 라벨 */
    guestContinueLabel?: string;
}

export default function SignupForm({
    initialValues,
    compact = false,
    onSignupSuccess,
    onGuestContinue,
    guestContinueLabel = '비회원으로 주문하기',
}: SignupFormProps) {
    const [formData, setFormData] = useState({
        id: initialValues?.email || '',
        name: initialValues?.name || '',
        birthYear: '',
        birthMonth: '',
        birthDay: '',
        phone: initialValues?.phone ? formatPhoneInput(initialValues.phone) : '',
        password: '',
        confirmPassword: ''
    });
    const [isGuestDiscrepancyConfirmed, setIsGuestDiscrepancyConfirmed] = useState(false);
    const [errors, setErrors] = useState({
        id: '',
        name: '',
        birthdate: '',
        phone: '',
        password: '',
        confirmPassword: ''
    });

    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 100 }, (_, i) => currentYear - i);
    const months = Array.from({ length: 12 }, (_, i) => i + 1);

    const getDaysInMonth = (year: string, month: string) => {
        if (!year || !month) return 31;
        return new Date(parseInt(year), parseInt(month), 0).getDate();
    };

    const days = Array.from({ length: getDaysInMonth(formData.birthYear, formData.birthMonth) }, (_, i) => i + 1);
    const [loading, setLoading] = useState(false);
    const [emailChecked, setEmailChecked] = useState(false);
    const [checkingEmail, setCheckingEmail] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const idRef = useRef<HTMLInputElement>(null);
    const nameRef = useRef<HTMLInputElement>(null);
    const birthdateRef = useRef<HTMLSelectElement>(null);
    const phoneRef = useRef<HTMLInputElement>(null);
    const passwordRef = useRef<HTMLInputElement>(null);
    const confirmPasswordRef = useRef<HTMLInputElement>(null);

    const router = useRouter();

    const isFormValid =
        emailChecked &&
        formData.name.trim() !== '' &&
        formData.birthYear !== '' &&
        formData.birthMonth !== '' &&
        formData.birthDay !== '' &&
        formData.phone.trim() !== '' &&
        formData.password.length >= 6 &&
        formData.password === formData.confirmPassword &&
        !errors.id && !errors.name && !errors.birthdate && !errors.phone && !errors.password && !errors.confirmPassword;

    const validateField = (name: string, value: string) => {
        let error = '';
        if (name === 'id') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!value) error = '이메일(아이디)을 입력해주세요.';
            else if (!emailRegex.test(value)) error = '올바른 이메일 형식이 아닙니다 (예: name@example.com)';
            else if (!emailChecked) error = '이메일 중복 확인을 해주세요.';
        } else if (name === 'name') {
            if (!value) error = '이름을 입력해주세요.';
        } else if (name === 'birthdate') {
            if (!formData.birthYear || !formData.birthMonth || !formData.birthDay) {
                error = '생년월일을 모두 선택해주세요.';
            }
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

    const handleCheckEmail = async (silent = false) => {
        const email = formData.id.toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!email) {
            if (!silent) {
                setErrors(prev => ({ ...prev, id: '이메일(아이디)을 입력해주세요.' }));
                idRef.current?.focus();
            }
            return;
        }

        if (!emailRegex.test(email)) {
            if (!silent) {
                setErrors(prev => ({ ...prev, id: '올바른 이메일 형식이 아닙니다.' }));
                idRef.current?.focus();
            }
            return;
        }

        setCheckingEmail(true);
        try {
            const response = await apiFetch('/api/auth/check-email', {
                method: 'POST',
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (data.available) {
                setEmailChecked(true);
                setErrors(prev => ({ ...prev, id: '' }));
                if (!silent) {
                    toast.success(data.message);
                    nameRef.current?.focus();
                }
            } else {
                setEmailChecked(false);
                setErrors(prev => ({ ...prev, id: data.message }));
                if (!silent) idRef.current?.focus();
            }
        } catch (error) {
            console.error('Email check error:', error);
            if (!silent) setErrors(prev => ({ ...prev, id: '중복 확인 중 오류가 발생했습니다.' }));
        } finally {
            setCheckingEmail(false);
        }
    };

    // 사전 입력된 이메일이 있으면 마운트 시 자동으로 중복확인 (이후 필드 활성화)
    useEffect(() => {
        if (initialValues?.email) {
            handleCheckEmail(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const checkGuestDiscrepancy = async () => {
        if (!formData.phone) return false;

        try {
            const response = await apiFetch('/api/auth/check-guest-email', {
                method: 'POST',
                body: JSON.stringify({
                    phone: formData.phone,
                    currentEmail: formData.id
                })
            });
            const data = await response.json();

            if (data.different && !isGuestDiscrepancyConfirmed) {
                const confirmed = window.confirm(
                    `⚠️ 이전에 입력한 주문 이메일(${data.prevEmail})과 현재 가입 이메일(${formData.id})이 다릅니다.\n\n` +
                    `회원가입을 진행하시면 현재 입력하신 [ ${formData.id} ]으로 모든 주문 내역이 통합 관리됩니다.\n\n` +
                    `진행하시겠습니까?`
                );

                if (confirmed) {
                    setIsGuestDiscrepancyConfirmed(true);
                    return true;
                }
                return false;
            }
            return true;
        } catch (error) {
            console.error('Guest email check error:', error);
            return true;
        }
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        if (name === 'id') return;
        const error = validateField(name, value);
        setErrors(prev => ({ ...prev, [name]: error }));
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name } = e.target;
        const value = name === 'phone' ? formatPhoneInput(e.target.value) : e.target.value;
        setFormData(prev => ({ ...prev, [name]: value }));

        if (name === 'id' && emailChecked) {
            setEmailChecked(false);
        }

        if (errors[name as keyof typeof errors]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const idErr = validateField('id', formData.id);
        const nameErr = validateField('name', formData.name);
        const birthdateErr = validateField('birthdate', '');
        const phoneErr = validateField('phone', formData.phone);
        const passErr = validateField('password', formData.password);
        const confErr = validateField('confirmPassword', formData.confirmPassword);

        const newErrors = {
            id: idErr,
            name: nameErr,
            birthdate: birthdateErr,
            phone: phoneErr,
            password: passErr,
            confirmPassword: confErr
        };

        setErrors(newErrors);

        if (idErr) { idRef.current?.focus(); return; }
        if (nameErr) { nameRef.current?.focus(); return; }
        if (birthdateErr) { birthdateRef.current?.focus(); return; }
        if (phoneErr) { phoneRef.current?.focus(); return; }
        if (passErr) { passwordRef.current?.focus(); return; }
        if (confErr) { confirmPasswordRef.current?.focus(); return; }

        const canProceed = await checkGuestDiscrepancy();
        if (!canProceed) return;

        setLoading(true);

        const normalizedEmail = formData.id.toLowerCase();

        const { data, error } = await supabase.auth.signUp({
            email: normalizedEmail,
            password: formData.password,
            options: {
                emailRedirectTo: `${window.location.origin}/login`,
                data: {
                    name: formData.name,
                    birthdate: `${formData.birthYear}.${formData.birthMonth.padStart(2, '0')}.${formData.birthDay.padStart(2, '0')}`,
                    phone: formData.phone,
                    login_id: normalizedEmail
                }
            }
        });

        if (error) {
            if (error.message.includes('already registered') || error.message.includes('already exists')) {
                toast.error('이미 가입된 이메일입니다. 로그인 페이지로 이동합니다.');
                router.push('/login');
            } else if (error.message.includes('rate limit')) {
                toast.error('이메일 전송 한도를 초과했습니다. 잠시 후 다시 시도해주세요.');
            } else {
                toast.error('회원가입 실패: ' + error.message);
            }
            setLoading(false);
            return;
        }

        if (data.user) {
            // 커스텀 성공 핸들러가 있으면 (모달에서 주문 이어가기 등) 위임
            if (onSignupSuccess) {
                toast.success('회원가입이 완료되었습니다!');
                onSignupSuccess(data.user.id);
                setLoading(false);
                return;
            }

            if (data.session) {
                toast.success('회원가입이 완료되었습니다! 자동으로 로그인합니다.');
                window.location.replace('/');
            } else {
                toast.success('회원가입이 완료되었습니다. 이메일 인증이 필요한 경우 메일을 확인해주세요.');
                router.push('/login');
            }
        }
        setLoading(false);
    };

    const handleSocialLogin = async (provider: 'google' | 'kakao') => {
        setLoading(true);
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider,
                options: {
                    redirectTo: `${window.location.origin}/signup/complete`,
                    queryParams: provider === 'google' ? { prompt: 'select_account' } : undefined,
                }
            });
            if (error) throw error;
        } catch (error) {
            console.error('Social Login Error:', error);
            toast.error(`${provider === 'google' ? 'Google' : 'Kakao'} 연동 중 오류가 발생했습니다.`);
            setLoading(false);
        }
    };

    return (
        <div className={compact ? styles.compact : undefined}>
            <div className={styles.socialGroup}>
                <button
                    type="button"
                    className={`${styles.socialBtn} ${styles.kakaoBtn}`}
                    onClick={() => handleSocialLogin('kakao')}
                    disabled={loading}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 3C6.477 3 2 6.552 2 10.932c0 2.825 1.83 5.3 4.61 6.643l-1 3.5c-.066.236.216.417.412.28l4.084-2.736c.602.08 1.236.124 1.894.124 5.523 0 10-3.553 10-7.933C22 6.552 17.523 3 12 3z"/>
                    </svg>
                    Kakao로 3초만에 가입하기
                </button>

                <button
                    type="button"
                    className={`${styles.socialBtn} ${styles.googleBtn}`}
                    onClick={() => handleSocialLogin('google')}
                    disabled={loading}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Google로 계속하기
                </button>
            </div>

            <div className={styles.divider}>
                <span className={styles.dividerText}>또는 이메일로 가입하기</span>
            </div>

            <form className={styles.form} onSubmit={handleSubmit} noValidate>
                {/* 1. 이메일 (계정 아이디) */}
                <div className={styles.inputGroup}>
                    <label>이메일 (아이디)</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                            <div style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', color: '#64748b', pointerEvents: 'none' }}>
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
                            onClick={() => handleCheckEmail(false)}
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
                        <div style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', color: '#64748b', pointerEvents: 'none' }}>
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

                {/* 생일 */}
                <div className={styles.inputGroup}>
                    <label>생년월일</label>
                    <div style={{ position: 'relative', display: 'flex', gap: '8px' }}>
                        <div style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', color: '#64748b', pointerEvents: 'none', zIndex: 1 }}>
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
                            disabled={!emailChecked}
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
                            disabled={!emailChecked}
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
                            disabled={!emailChecked}
                        >
                            <option value="">일</option>
                            {days.map(day => (
                                <option key={day} value={day}>{day}일</option>
                            ))}
                        </select>
                    </div>
                    {errors.birthdate && <span className={styles.errorText}>{errors.birthdate}</span>}
                </div>

                {/* 3. 전화번호 */}
                <div className={styles.inputGroup}>
                    <label>전화번호</label>
                    <div style={{ position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', color: '#64748b', pointerEvents: 'none' }}>
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
                        <div style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', color: '#64748b', pointerEvents: 'none', zIndex: 1 }}>
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
                            style={{ width: '100%', paddingLeft: '45px', paddingRight: '50px' }}
                            disabled={!emailChecked}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            tabIndex={-1}
                            style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', zIndex: 2, width: '20px', height: '20px' }}
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
                        <div style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', color: '#64748b', pointerEvents: 'none', zIndex: 1 }}>
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
                            style={{ width: '100%', paddingLeft: '45px', paddingRight: '50px' }}
                            disabled={!emailChecked}
                        />
                        <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            tabIndex={-1}
                            style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', zIndex: 2, width: '20px', height: '20px' }}
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

                {onGuestContinue && (
                    <button
                        type="button"
                        className={styles.guestBtn}
                        onClick={onGuestContinue}
                        disabled={loading}
                    >
                        {guestContinueLabel}
                    </button>
                )}
            </form>
        </div>
    );
}
