"use client";

import React, { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { CheckCircle2, Home, ArrowRight } from 'lucide-react';

function SuccessContent() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const serviceName = searchParams.get('service') || '서비스';
    const price = searchParams.get('price') || '0';
    const depositor = searchParams.get('depositor') || '';
    const bankInfo = searchParams.get('bank') || '';

    return (
        <div className="container mx-auto px-4 py-20 max-w-md text-center">
            <div className="mb-8 flex justify-center">
                <div className="bg-green-50 p-4 rounded-full">
                    <CheckCircle2 className="w-16 h-16 text-green-500" />
                </div>
            </div>

            <h1 className="text-3xl font-bold mb-2">주문 접수 완료</h1>
            <p className="text-muted-foreground mb-8">
                주문이성공적으로 접수되었습니다.<br />
                입금 확인 후 알림톡이 발송됩니다.
            </p>

            <div className="bg-gray-50 rounded-2xl p-6 text-left space-y-4 mb-8">
                <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">구독 서비스</span>
                    <span className="font-bold">{serviceName}</span>
                </div>
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
                        <span className="text-sm font-medium">{bankInfo}</span>
                    </div>
                )}
            </div>

            <div className="space-y-3">
                <Button
                    className="w-full h-14 text-lg font-bold rounded-xl bg-black text-white hover:bg-gray-800"
                    onClick={() => router.push('/')}
                >
                    <Home className="mr-2 h-5 w-5" />
                    메인으로 돌아가기
                </Button>
                <Button
                    variant="ghost"
                    className="w-full h-12 text-muted-foreground"
                    onClick={() => router.push('/public/products')}
                >
                    다른 서비스 둘러보기
                    <ArrowRight className="ml-2 h-4 w-4" />
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
