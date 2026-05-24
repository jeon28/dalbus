"use client";

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Home, UserPlus, Lock, Mail, User, Phone, Calendar, Eye, EyeOff, Copy, Clock, AlertTriangle } from 'lucide-react';
import { useServices } from '@/lib/ServiceContext';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';

interface PaymentInfo {
    id: string;
    order_number: string;
    amount: number;
    payment_status: string;
    depositor_name: string;
    match_code: string | null;
    payment_due_at: string | null;
    buyer_name: string | null;
    buyer_email: string | null;
    product_name: string | null;
    duration_months: number | null;
    bank: {
        bank_name: string;
        account_number: string;
        account_holder: string;
    } | null;
}

function CountdownBadge({ dueAt }: { dueAt: string | null }) {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    if (!dueAt) return null;

    const remainMs = new Date(dueAt).getTime() - now;
    if (remainMs <= 0) {
        return (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 rounded-full text-red-700 text-xs font-semibold">
                <AlertTriangle className="w-3.5 h-3.5" />
                입금 마감
            </div>
        );
    }

    const totalSeconds = Math.floor(remainMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const urgent = remainMs < 60 * 60 * 1000;

    return (
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${urgent ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
            <Clock className="w-3.5 h-3.5" />
            {hours > 0 && <span>{hours}시간 </span>}
            <span>{String(minutes).padStart(2, '0')}분 {String(seconds).padStart(2, '0')}초 남음</span>
        </div>
    );
}

function CopyButton({ value, label }: { value: string; label?: string }) {
    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(value);
            toast.success(`${label || '내용'}이(가) 복사되었습니다.`);
        } catch {
            toast.error('복사에 실패했습니다.');
        }
    };
    return (
        <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors"
            aria-label={`${label || '내용'} 복사`}
        >
            <Copy className="w-3 h-3" />
            복사
        </button>
    );
}

function SuccessContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user } = useServices();

    const orderId = searchParams.get('orderId');

    const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [loadingInfo, setLoadingInfo] = useState(true);

    // 결제 안내 조회 (sessionStorage 평문 저장 대신 API 사용)
    useEffect(() => {
        if (!orderId) {
            setFetchError('주문 정보가 없습니다. 잘못된 접근입니다.');
            setLoadingInfo(false);
            return;
        }

        const fetchPaymentInfo = async () => {
            try {
                const res = await apiFetch(`/api/orders/${encodeURIComponent(orderId)}/payment-info`);
                if (!res.ok) {
                    setFetchError('주문 정보를 불러올 수 없습니다.');
                    return;
                }
                const data = await res.json();
                setPaymentInfo(data);
            } catch (e) {
                console.error('Payment info fetch failed:', e);
                setFetchError('주문 정보를 불러오는 중 오류가 발생했습니다.');
            } finally {
                setLoadingInfo(false);
            }
        };

        fetchPaymentInfo();
    }, [orderId]);

    // 입금자 표시 문구: 이름 + 매칭코드 권장 형태
    const recommendedDepositor = useMemo(() => {
        if (!paymentInfo) return '';
        const base = paymentInfo.depositor_name || paymentInfo.buyer_name || '';
        const code = paymentInfo.match_code || '';
        if (!base) return code;
        return code ? `${base}${code}` : base;
    }, [paymentInfo]);

    // === Guest signup form state (기존 기능 유지) ===
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [birthDate, setBirthDate] = useState({ year: '', month: '', day: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isJoined, setIsJoined] = useState(false);
    const [isCheckingEmail, setIsCheckingEmail] = useState(false);
    const [emailCheckResult, setEmailCheckResult] = useState<{ available: boolean, message: string } | null>(null);

    const guestEmail = paymentInfo?.buyer_email || '';
    const guestName = paymentInfo?.buyer_name || '';

    useEffect(() => {
        if (guestEmail) setEmail(guestEmail);
    }, [guestEmail]);

    const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setEmail(e.target.value);
        setEmailCheckResult(null);
    };

    const checkEmail = async () => {
        if (!email) {
            toast.error('이메일을 입력해주세요.');
            return;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            setEmailCheckResult({ available: false, message: '올바른 이메일 형식이 아닙니다.' });
            return;
        }
        setIsCheckingEmail(true);
        try {
            const response = await apiFetch('/api/auth/check-email', {
                method: 'POST',
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
            toast.error('비밀번호는 6자 이상이어야 합니다.');
            return;
        }
        if (password !== confirmPassword) {
            toast.error('비밀번호가 일치하지 않습니다.');
            return;
        }
        if (!birthDate.year || !birthDate.month || !birthDate.day) {
            toast.error('생년월일을 입력해주세요.');
            return;
        }
        if (email !== guestEmail) {
            const confirmed = window.confirm(
                `⚠️ 주문 시 입력한 이메일(${guestEmail})과 가입하시려는 이메일(${email})이 다릅니다.\n\n` +
                `가입하신 [ ${email} ] 계정으로 현재 주문 내역이 통합 관리됩니다. 진행하시겠습니까?`
            );
            if (!confirmed) return;
        }

        setLoading(true);
        try {
            const response = await apiFetch('/api/auth/guest-signup', {
                method: 'POST',
                body: JSON.stringify({
                    email,
                    password,
                    name: guestName,
                    phone: paymentInfo?.buyer_name ? '' : '',
                    birthdate: `${birthDate.year}.${birthDate.month.padStart(2, '0')}.${birthDate.day.padStart(2, '0')}`
                })
            });
            const result = await response.json();
            if (response.ok) {
                setIsJoined(true);
                toast.success('회원가입이 완료되었습니다! 이제 주문 내역을 마이페이지에서 확인하실 수 있습니다.');
            } else {
                toast.error(result.error || '회원가입 처리 중 오류가 발생했습니다.');
            }
        } catch (error) {
            console.error('Signup error:', error);
            toast.error('서버와의 통신 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    if (loadingInfo) {
        return (
            <div className="container mx-auto px-4 py-16 max-w-lg text-center">
                <div className="animate-pulse text-muted-foreground">주문 정보를 불러오는 중...</div>
            </div>
        );
    }

    if (fetchError || !paymentInfo) {
        return (
            <div className="container mx-auto px-4 py-16 max-w-lg text-center">
                <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                <h1 className="text-xl font-bold mb-2">주문 정보를 확인할 수 없습니다</h1>
                <p className="text-sm text-muted-foreground mb-6">{fetchError || '잘못된 접근입니다.'}</p>
                <Button onClick={() => router.push('/')} variant="outline">
                    메인으로 돌아가기
                </Button>
            </div>
        );
    }

    const paid = paymentInfo.payment_status !== 'pending';
    const bank = paymentInfo.bank;
    const amountStr = paymentInfo.amount.toLocaleString();

    // 토스 송금 딥링크 (전국 어느 은행 계좌로도 송금 가능)
    const tossDeepLink = bank
        ? `supertoss://send?bank=${encodeURIComponent(bank.bank_name)}&accountNo=${encodeURIComponent(bank.account_number)}&amount=${paymentInfo.amount}&msg=${encodeURIComponent(recommendedDepositor)}`
        : null;

    return (
        <div className="container mx-auto px-4 py-10 max-w-lg">
            <div className="mb-5 flex justify-center">
                <div className="bg-green-50 p-4 rounded-full">
                    <CheckCircle2 className="w-12 h-12 text-green-500" />
                </div>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold mb-1 text-center">주문 접수 완료</h1>
            <p className="text-muted-foreground mb-6 text-sm text-center leading-relaxed">
                아래 안내된 계좌로 입금해주세요.<br />
                입금 확인 후 이메일/알림톡이 발송됩니다.
            </p>

            {/* 입금 안내 카드 (가장 중요) */}
            {!paid && bank ? (
                <div className="bg-white rounded-2xl border-2 border-blue-200 shadow-sm mb-6 overflow-hidden">
                    <div className="px-5 py-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
                        <span className="text-sm font-bold text-blue-900">💳 입금 안내</span>
                        <CountdownBadge dueAt={paymentInfo.payment_due_at} />
                    </div>

                    <div className="p-5 space-y-4">
                        {/* 입금 금액 */}
                        <div>
                            <div className="text-xs text-muted-foreground mb-1">입금 금액</div>
                            <div className="flex items-center justify-between gap-2">
                                <div className="text-2xl font-bold text-primary">{amountStr}원</div>
                                <CopyButton value={String(paymentInfo.amount)} label="금액" />
                            </div>
                        </div>

                        {/* 계좌 정보 */}
                        <div className="bg-gray-50 rounded-xl p-4 space-y-2.5">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">은행</span>
                                <span className="text-sm font-semibold">{bank.bank_name}</span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-xs text-muted-foreground">계좌번호</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-base font-bold tracking-wide">{bank.account_number}</span>
                                    <CopyButton value={bank.account_number} label="계좌번호" />
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">예금주</span>
                                <span className="text-sm font-semibold">{bank.account_holder}</span>
                            </div>
                        </div>

                        {/* 입금자명 (가장 중요한 안내) */}
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                            <div className="text-xs font-semibold text-amber-900 mb-1">⚠️ 반드시 아래 입금자명으로 입금</div>
                            <div className="flex items-center justify-between gap-2 mt-2">
                                <span className="text-lg font-bold text-amber-900 tracking-wide break-all">
                                    {recommendedDepositor}
                                </span>
                                <CopyButton value={recommendedDepositor} label="입금자명" />
                            </div>
                            {paymentInfo.match_code && (
                                <p className="text-[11px] text-amber-700 mt-2 leading-relaxed">
                                    뒤 4자리 <strong>{paymentInfo.match_code}</strong>는 이 주문의 고유 코드입니다.
                                    빠뜨리시면 입금 확인이 지연될 수 있습니다.
                                </p>
                            )}
                        </div>

                        {/* 토스 송금 바로가기 (모바일 전용) */}
                        {tossDeepLink && (
                            <a
                                href={tossDeepLink}
                                className="block w-full text-center bg-[#0064FF] hover:bg-[#0050CC] text-white font-bold py-3 rounded-xl transition-colors active:scale-[0.98]"
                            >
                                🟦 토스로 송금하기
                            </a>
                        )}

                        <ul className="text-[11px] text-muted-foreground space-y-1 list-disc pl-4 mt-2">
                            <li>입금자명이 다르면 입금 확인이 지연될 수 있습니다.</li>
                            <li>마감 시간까지 입금이 확인되지 않으면 주문이 자동 취소됩니다.</li>
                            <li>이 페이지를 닫아도 이메일로 동일한 안내가 발송됩니다.</li>
                        </ul>
                    </div>
                </div>
            ) : paid ? (
                <div className="bg-green-50 rounded-2xl border border-green-200 p-5 mb-6 text-center">
                    <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-green-900">이미 결제가 완료된 주문입니다.</p>
                    <p className="text-xs text-green-700 mt-1">마이페이지에서 상세 내역을 확인하실 수 있습니다.</p>
                </div>
            ) : (
                <div className="bg-red-50 rounded-2xl border border-red-200 p-5 mb-6 text-center">
                    <AlertTriangle className="w-8 h-8 text-red-600 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-red-900">입금 계좌 정보를 불러올 수 없습니다.</p>
                    <p className="text-xs text-red-700 mt-1">고객센터로 문의해주세요. 주문번호: {paymentInfo.order_number}</p>
                </div>
            )}

            {/* 주문 요약 */}
            <div className="bg-gray-50 rounded-2xl p-5 text-left space-y-3 mb-8 border border-gray-100">
                <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">주문번호</span>
                    <span className="font-mono text-xs font-semibold">{paymentInfo.order_number}</span>
                </div>
                {paymentInfo.product_name && (
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">구독 서비스</span>
                        <span className="font-bold">{paymentInfo.product_name}</span>
                    </div>
                )}
                {paymentInfo.duration_months && (
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">이용 기간</span>
                        <span className="font-bold">{paymentInfo.duration_months}개월</span>
                    </div>
                )}
            </div>

            {/* Guest to Member Conversion Section (기존 기능 유지) */}
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
                                    <Input value="" readOnly placeholder="" className="pl-9 bg-white/50 cursor-not-allowed" />
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
        <Suspense fallback={<div className="container mx-auto px-4 py-16 max-w-lg text-center text-muted-foreground">로딩 중...</div>}>
            <SuccessContent />
        </Suspense>
    );
}
