"use client";

import React from 'react';
import { useRouter } from 'next/navigation';

export default function TermsPage() {
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

                <h1 className="text-3xl font-bold mb-8 text-center text-primary">이용약관</h1>

                <div className="space-y-8 text-sm leading-relaxed text-foreground/80">
                    <section>
                        <h2 className="text-lg font-bold text-foreground mb-3">제 1 조 (목적)</h2>
                        <p>본 약관은 Dalbus(이하 &quot;회사&quot;)가 제공하는 인터넷 관련 서비스(이하 &quot;서비스&quot;)를 이용함에 있어 회사와 이용자의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.</p>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-foreground mb-3">제 2 조 (서비스의 제공 및 변경)</h2>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>회사는 다음과 같은 업무를 수행합니다.
                                <ul className="list-disc pl-5 mt-1">
                                    <li>재화 또는 용역에 대한 정보 제공 및 구매계약의 체결</li>
                                    <li>구매계약이 체결된 재화 또는 용역의 배송(디지털 전송 포함)</li>
                                    <li>기타 회사가 정하는 업무</li>
                                </ul>
                            </li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-foreground mb-3">제 3 조 (구매신청 및 개인정보 제공 동의 등)</h2>
                        <p>이용자는 서비스상에서 다음 또는 이와 유사한 방법에 의하여 구매를 신청하며, 회사는 이용자가 구매신청을 함에 있어서 다음의 각 내용을 알기 쉽게 제공하여야 합니다.</p>
                        <ul className="list-disc pl-5 mt-2 space-y-1">
                            <li>재화 등의 검색 및 선택</li>
                            <li>성명, 주소, 전화번호, 전자우편주소(또는 이동전화번호) 등의 입력</li>
                            <li>약관내용, 청약철회권이 제한되는 서비스, 배송료 등의 비용부담과 관련한 내용에 대한 확인</li>
                            <li>결제방법의 선택</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-foreground mb-3">제 4 조 (청약철회 등)</h2>
                        <p className="font-bold text-primary italic mb-2">※ 디지털 상품의 특성 상, 상품 인도 후 구매자의 단순 변심으로 인한 환불은 불가합니다.</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>회사의 서비스는 디지털 콘텐츠를 기반으로 하며, 상품이 구매자의 계정 혹은 메일로 전송/배정된 이후에는 상품의 가치가 훼손된 것으로 간주하여 청약철회가 제한됩니다.</li>
                            <li>단, 서비스 자체의 결함으로 인해 정상적인 이용이 불가능한 경우 회사는 환불 혹은 서비스 연장 등의 조치를 취합니다.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-foreground mb-3">제 5 조 (회사의 의무)</h2>
                        <p>회사는 법령과 이 약관이 금지하거나 공서양속에 반하는 행위를 하지 않으며 이 약관이 정하는 바에 따라 지속적이고, 안정적으로 재화/용역을 제공하는데 최선을 다하여야 합니다.</p>
                    </section>
                </div>

                <div className="mt-12 pt-8 border-t text-center text-xs text-muted-foreground">
                    시행일자: 2024년 2월 17일
                </div>
            </div>
        </main>
    );
}
