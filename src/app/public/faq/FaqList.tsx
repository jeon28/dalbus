"use client";

import React, { useState } from 'react';
import { Badge } from "@/components/ui/badge";

export interface FAQ {
    id: string;
    question: string;
    answer: string;
    category: 'general' | 'payment' | 'account' | 'refund';
    sort_order: number;
}

const CATEGORY_ORDER = ['general', 'payment', 'account', 'refund'];
const CATEGORY_LABELS: Record<string, string> = {
    general: '일반',
    payment: '결제',
    account: '계정',
    refund: '환불',
};

/**
 * FAQ 목록의 인터랙티브 부분(카테고리 필터 + 아코디언)만 담당하는 클라이언트 조각.
 * 데이터는 서버 컴포넌트(page.tsx)에서 미리 조회해 props로 전달받는다.
 */
export function FaqList({ faqs }: { faqs: FAQ[] }) {
    const [openId, setOpenId] = useState<string | null>(null);
    const [activeCategory, setActiveCategory] = useState<string>('all');

    const uniqueCategories = CATEGORY_ORDER.filter(c => faqs.some(f => f.category === c));

    const filteredFaqs = activeCategory === 'all'
        ? faqs
        : faqs.filter(f => f.category === activeCategory);

    return (
        <>
            {/* Category Tabs */}
            <div className="flex flex-wrap justify-center gap-2 mb-10">
                {['all', ...uniqueCategories].map((cat) => (
                    <button
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-200 ${activeCategory === cat
                            ? 'bg-primary text-primary-foreground shadow-md'
                            : 'bg-secondary hover:bg-secondary/80 text-secondary-foreground'
                            }`}
                    >
                        {cat === 'all' ? '전체' : (CATEGORY_LABELS[cat] ?? cat)}
                    </button>
                ))}
            </div>

            <div className="space-y-3">
                {filteredFaqs.length > 0 ? (
                    filteredFaqs.map((faq) => (
                        <div key={faq.id} className="group">
                            <button
                                onClick={() => setOpenId(openId === faq.id ? null : faq.id)}
                                className={`w-full text-left p-5 rounded-xl glass border-none hover:bg-white/40 transition-all duration-300 flex items-center justify-between ${openId === faq.id ? 'bg-white/50 shadow-sm' : ''
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <Badge variant="outline" className="text-[10px] font-normal border-muted-foreground/30">
                                        {faq.category}
                                    </Badge>
                                    <span className="font-semibold text-foreground/90">{faq.question}</span>
                                </div>
                                <span className={`transform transition-transform duration-300 ${openId === faq.id ? 'rotate-180' : ''}`}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="6 9 12 15 18 9"></polyline>
                                    </svg>
                                </span>
                            </button>
                            {openId === faq.id && (
                                <div className="p-6 pt-2 text-sm text-foreground/70 animate-fade-in pl-14">
                                    <div className="border-l-2 border-primary/20 pl-4 py-1 whitespace-pre-wrap leading-relaxed">
                                        {faq.answer}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                ) : (
                    <div className="text-center py-20 bg-muted/30 rounded-lg">
                        <p className="text-muted-foreground">해당 카테고리에 질문이 없습니다.</p>
                    </div>
                )}
            </div>
        </>
    );
}
