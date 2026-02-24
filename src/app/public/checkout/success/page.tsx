"use client";

import React, { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Home, UserPlus, Lock, Mail, User, Phone, Calendar, Eye, EyeOff } from 'lucide-react';
import { useServices } from '@/lib/ServiceContext';

function SuccessContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { user } = useServices();

    const serviceName = searchParams.get('service') || '서비스';
    const price = searchParams.get('price') || '0';
    const period = searchParams.get('period') || '';
    const depositor = searchParams.get('depositor') || '';
    const bankInfo = searchParams.get('bank') || '';

    // Guest Info from URL
    const guestName = searchParams.get('name') || '';
    const guestPhone = searchParams.get('phone') || '';
    const guestEmail = searchParams.get('email') || '';

    // Signup Form State
    const [email, setEmail] = useState(guestEmail);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [birthDate, setBirthDate] = useState({
        year: '',
        month: '',
        day: ''
    });
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isJoined, setIsJoined] = useState(false);

    // Email Check State
    const [isCheckingEmail, setIsCheckingEmail] = useState(false);
    const [emailCheckResult, setEmailCheckResult] = useState<{ available: boolean, message: string } | null>(null);

    useEffect(() => {
        if (guestEmail) {
            setEmail(guestEmail);
            // Don't auto-verify, let the user see the "중복 확인" button initially
        }
    }, [guestEmail]);

    const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newEmail = e.target.value;
        setEmail(newEmail);
        setEmailCheckResult(null); // Always reset on change
    };

    const checkEmail = async () => {
        if (!email) {
            alert('이메일을 입력해주세요.');
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            setEmailCheckResult({ available: false, message: '올바른 이메일 형식이 아닙니다.' });
            return;
        }

        setIsCheckingEmail(true);
        try {
            const response = await fetch('/api/auth/check-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const data = await response.json();
            setEmailCheckResult({ available: data.available, message: data.message });
        } catch (error) {
            console.error('Email check error:', error);
            setEmailCheckResult({ available: false, message: '중복 확인 중 오류가 발생했습니다.' });
        } finally {
            setIsCheckingEmail(false);
        }
    };

    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 100 }, (_, i) => currentYear - i);
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    const getDaysInMonth = (year: string, month: string) => {
        if (!year || !month) return 31;
        return new Date(parseInt(year), parseInt(month), 0).getDate();
    };
    const days = Array.from({ length: getDaysInMonth(birthDate.year, birthDate.month) }, (_, i) => i + 1);

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!password || password.length < 6) {
            alert('비밀번호는 6자 이상이어야 합니다.');
            return;
        }
        if (password !== confirmPassword) {
            alert('비밀번호가 일치하지 않습니다.');
            return;
        }
        if (!birthDate.year || !birthDate.month || !birthDate.day) {
            alert('생년월일을 입력해주세요.');
            return;
        }

        setLoading(true);
        try {
            const response = await fetch('/api/auth/guest-signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: email,
                    password,
                    name: guestName,
                    phone: guestPhone,
                    birthdate: `${birthDate.year}.${birthDate.month.padStart(2, '0')}.${birthDate.day.padStart(2, '0')}`
                })
            });

            const result = await response.json();
            if (response.ok) {
                setIsJoined(true);
                alert('회원가입이 완료되었습니다! 이제 주문 내역을 마이페이지에서 확인하실 수 있습니다.');
            } else {
                alert(result.error || '회원가입 처리 중 오류가 발생했습니다.');
            }
        } catch (error) {
            console.error('Signup error:', error);
            alert('서버와의 통신 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container mx-auto px-4 py-12 max-w-lg text-center">
            <div className="mb-6 flex justify-center">
                <div className="bg-green-50 p-4 rounded-full">
                    <CheckCircle2 className="w-12 h-12 text-green-500" />
                </div>
            </div>

            <h1 className="text-3xl font-bold mb-2">주문 접수 완료</h1>
            <p className="text-muted-foreground mb-6 text-sm sm:text-base leading-relaxed">
                주문이 성공적으로 접수되었습니다.<br />
                입금 확인 후 알림톡이 발송됩니다.
            </p>

            <div className="bg-gray-50 rounded-2xl p-6 text-left space-y-4 mb-8 border border-gray-100 shadow-sm">
                <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">구독 서비스</span>
                    <span className="font-bold">{serviceName}</span>
                </div>
                {period && (
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">이용 기간</span>
                        <span className="font-bold">{period}개월</span>
                    </div>
                )}
                <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">결제 금액</span>
                    <span className="font-bold text-primary">{Number(price).toLocaleString()}원</span>
                </div>
                {depositor && (
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">입금자명</span>
                        <span className="font-bold">{depositor}</span>
                    </div>
                )}
                {bankInfo && (
                    <div className="flex flex-col gap-1 border-t pt-4">
                        <span className="text-xs text-muted-foreground">입금 계좌</span>
                        <span className="text-sm font-medium break-all">{bankInfo}</span>
                    </div>
                )}
            </div>

            {/* Guest to Member Conversion Section */}
            {!user && !isJoined && guestEmail && (
                <div className="bg-blue-50/50 rounded-2xl p-6 text-left border border-blue-100 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="flex items-center gap-2 mb-4">
                        <UserPlus className="w-5 h-5 text-blue-600" />
                        <h2 className="text-lg font-bold text-blue-900">회원가입하고 혜택받기</h2>
                    </div>
                    <p className="text-sm text-blue-700 mb-6 leading-relaxed">
                        지금 회원으로 가입하시면 방금 하신 주문과 계정의 상태를 간편하게 조회할 수 있습니다.
                    </p>

                    <form onSubmit={handleSignup} className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5 opacity-70">
                                <Label className="text-xs">이름</Label>
                                <div className="relative">
                                    <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input value={guestName} readOnly className="pl-9 bg-white/50 cursor-not-allowed" />
                                </div>
                            </div>
                            <div className="space-y-1.5 opacity-70">
                                <Label className="text-xs">연락처</Label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input value={guestPhone} readOnly className="pl-9 bg-white/50 cursor-not-allowed" />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs text-blue-900/60 font-semibold">이메일 (아이디)</Label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        type="email"
                                        value={email}
                                        onChange={handleEmailChange}
                                        readOnly={emailCheckResult?.available}
                                        placeholder="이메일을 입력해주세요"
                                        className={`pl-9 border transition-colors ${emailCheckResult ? (emailCheckResult.available ? 'bg-blue-50/50 border-green-300 focus:ring-green-400 cursor-not-allowed text-gray-600' : 'bg-white border-red-400 focus:ring-red-400 text-red-600') : 'bg-white border-blue-100'}`}
                                    />
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={emailCheckResult?.available ? () => setEmailCheckResult(null) : checkEmail}
                                    disabled={isCheckingEmail}
                                    className={`h-10 px-4 whitespace-nowrap transition-all ${emailCheckResult?.available ? 'border-gray-200 text-gray-500 hover:bg-gray-50' : 'border-blue-200 text-blue-700 hover:bg-blue-50 font-semibold shadow-sm'}`}
                                >
                                    {isCheckingEmail ? '확인 중...' : (emailCheckResult?.available ? '변경' : '중복 확인')}
                                </Button>
                            </div>
                            <p className="text-[10px] text-blue-600/70">
                                * 가입하신 이메일은 로그인 시 아이디로 사용됩니다.
                            </p>
                            {emailCheckResult && (
                                <p className={`text-[12px] mt-1.5 ${emailCheckResult.available ? 'text-green-600' : 'text-red-500'} font-medium animate-in fade-in slide-in-from-top-1 px-1`}>
                                    {emailCheckResult.message}
                                </p>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs">생년월일</Label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <select
                                        className="w-full h-10 pl-9 pr-2 rounded-md border border-input bg-white text-sm outline-none focus:ring-1 focus:ring-blue-400"
                                        value={birthDate.year}
                                        onChange={(e) => setBirthDate({ ...birthDate, year: e.target.value })}
                                    >
                                        <option value="">년도</option>
                                        {years.map(y => <option key={y} value={y}>{y}년</option>)}
                                    </select>
                                </div>
                                <select
                                    className="flex-1 h-10 px-2 rounded-md border border-input bg-white text-sm outline-none focus:ring-1 focus:ring-blue-400"
                                    value={birthDate.month}
                                    onChange={(e) => setBirthDate({ ...birthDate, month: e.target.value })}
                                >
                                    <option value="">월</option>
                                    {months.map(m => <option key={m} value={m}>{m}월</option>)}
                                </select>
                                <select
                                    className="flex-1 h-10 px-2 rounded-md border border-input bg-white text-sm outline-none focus:ring-1 focus:ring-blue-400"
                                    value={birthDate.day}
                                    onChange={(e) => setBirthDate({ ...birthDate, day: e.target.value })}
                                >
                                    <option value="">일</option>
                                    {days.map(d => <option key={d} value={d}>{d}일</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs">비밀번호 (6자 이상)</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="비밀번호 입력"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="pl-9 pr-10 bg-white"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-blue-600 transition-colors"
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs">비밀번호 확인</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="비밀번호 다시 입력"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="pl-9 bg-white"
                                />
                            </div>
                        </div>

                        <Button
                            type="submit"
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11"
                            disabled={loading || !emailCheckResult?.available}
                        >
                            {loading ? '가입 처리 중...' : '회원가입 완료하기'}
                        </Button>
                    </form>
                </div>
            )}

            {isJoined && (
                <div className="bg-green-50 rounded-2xl p-8 text-center border border-green-100 mb-8 animate-in zoom-in-95 duration-500">
                    <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-3" />
                    <h2 className="text-xl font-bold text-green-900 mb-2">가입을 축하드립니다!</h2>
                    <p className="text-sm text-green-700 mb-6">
                        이제 로그인을 통해 주문 상세 내역을 확인하실 수 있습니다.
                    </p>
                    <Button onClick={() => router.push('/login')} className="w-full bg-green-600 hover:bg-green-700">
                        로그인하러 가기
                    </Button>
                </div>
            )}

            <div className="space-y-3">
                <Button
                    variant="outline"
                    className="w-full h-14 text-lg font-bold rounded-xl border-gray-200 hover:bg-gray-50 bg-white"
                    onClick={() => router.push('/')}
                >
                    <Home className="mr-2 h-5 w-5" />
                    메인으로 돌아가기
                </Button>
            </div>
        </div>
    );
}

export default function OrderSuccessPage() {
    return (
        <Suspense fallback={
            <div className="container py-20 flex justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
            </div>
        }>
            <SuccessContent />
        </Suspense>
    );
}
