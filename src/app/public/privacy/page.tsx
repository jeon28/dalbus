"use client";

import React from 'react';
import { useRouter } from 'next/navigation';

export default function PrivacyPage() {
    const router = useRouter();

    return (
        <main className="min-h-screen bg-background py-16 px-4">
            <div className="container max-w-3xl mx-auto glass p-8 rounded-2xl shadow-xl">
                <button
                    onClick={() => router.back()}
                    className="mb-6 text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                >
                    ← 뒤로가기
                </button>

                <h1 className="text-3xl font-bold mb-8 text-center text-primary">개인정보처리방침</h1>

                <div className="space-y-8 text-sm leading-relaxed text-foreground/80">
                    <section>
                        <h2 className="text-lg font-bold text-foreground mb-3">1. 수집하는 개인정보의 항목</h2>
                        <p>회사는 서비스 제공을 위해 아래와 같은 개인정보를 수집하고 있습니다.</p>
                        <ul className="list-disc pl-5 mt-2 space-y-1">
                            <li>수집항목: 성명, 전화번호, 이메일 주소, 입금자명, 결제 정보</li>
                            <li>개인정보 수집방법: 홈페이지(주문 신청서 작성)</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-foreground mb-3">2. 개인정보의 수집 및 이용목적</h2>
                        <p>회사는 수집한 개인정보를 다음의 목적을 위해 활용합니다.</p>
                        <ul className="list-disc pl-5 mt-2 space-y-1">
                            <li>서비스 제공에 관한 계약 이행 및 서비스 제공에 따른 요금정산</li>
                            <li>디지털 콘텐츠 제공, 구매 및 결제, 물품배송 또는 청구지 등 발송</li>
                            <li>회원 관리: 서비스 이용에 따른 본인확인, 개인 식별, 불량회원의 부정이용 방지와 비인가 사용 방지, 고지사항 전달</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-foreground mb-3">3. 개인정보의 보유 및 이용기간</h2>
                        <p>원칙적으로 개인정보 수집 및 이용목적이 달성된 후에는 해당 정보를 지체 없이 파기합니다. 단, 관계법령의 규정에 의하여 보존할 필요가 있는 경우 회사는 아래와 같이 관계법령에서 정한 일정한 기간 동안 회원정보를 보관합니다.</p>
                        <ul className="list-disc pl-5 mt-2 space-y-1">
                            <li>보관 항목: 계약 또는 청약철회 등에 관한 기록</li>
                            <li>보존 기간: 5년 (전자상거래 등에서의 소비자보호에 관한 법률)</li>
                            <li>보관 항목: 소비자의 불만 또는 분쟁처리에 관한 기록</li>
                            <li>보존 기간: 3년 (전자상거래 등에서의 소비자보호에 관한 법률)</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-foreground mb-3">4. 개인정보의 파기절차 및 방법</h2>
                        <p>회사는 원칙적으로 개인정보 수집 및 이용목적이 달성된 후에는 해당 정보를 지체없이 파기합니다. 파기절차 및 방법은 다음과 같습니다.</p>
                        <ul className="list-disc pl-5 mt-2 space-y-1">
                            <li>파기절차: 회원님이 서비스 이용 등을 위해 입력하신 정보는 목적이 달성된 후 별도의 DB로 옮겨져 관련 법령에 의한 정보보호 사유에 따라 일정 기간 저장된 후 파기됩니다.</li>
                            <li>파기방법: 전자적 파일형태로 저장된 개인정보는 기록을 재생할 수 없는 기술적 방법을 사용하여 삭제합니다.</li>
                        </ul>
                    </section>
                </div>

                <div className="mt-12 pt-8 border-t text-center text-xs text-muted-foreground">
                    시행일자: 2024년 2월 17일
                </div>
            </div>
        </main>
    );
}
