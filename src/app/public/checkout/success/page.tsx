"use client";

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { CheckCircle2, Home, Copy, Clock, AlertTriangle } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';

interface PaymentInfo {
    id: string;
    order_number: string;
    amount: number;
    payment_status: string;
    depositor_name: string;
    payment_due_at: string | null;
    buyer_name: string | null;
    buyer_email: string | null;
    buyer_phone: string | null;
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

    // 입금자명: 사용자가 입력한 값 그대로 사용
    const recommendedDepositor = useMemo(() => {
        if (!paymentInfo) return '';
        return paymentInfo.depositor_name || paymentInfo.buyer_name || '';
    }, [paymentInfo]);

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
                            <p className="text-[11px] text-amber-700 mt-2 leading-relaxed">
                                입금자명이 다르면 입금 확인이 지연될 수 있습니다.
                            </p>
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
