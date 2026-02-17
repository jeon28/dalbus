"use client";

import React, { useEffect, useState } from 'react';
import { Badge } from "@/components/ui/badge";

interface FAQ {
    id: string;
    question: string;
    answer: string;
    category: 'general' | 'payment' | 'account' | 'refund';
    sort_order: number;
}

interface FAQCategory {
    id: string;
    name: string;
    sort_order: number;
}

export default function FAQPage() {
    const [faqs, setFaqs] = useState<FAQ[]>([]);
    const [categories, setCategories] = useState<FAQCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [openId, setOpenId] = useState<string | null>(null);
    const [activeCategory, setActiveCategory] = useState<string>('all');

    useEffect(() => {
        let isMounted = true;

        const fetchData = async () => {
            try {
                const [faqRes, catRes] = await Promise.all([
                    fetch('/api/public/faqs'),
                    fetch('/api/public/faq-categories')
                ]);

                if (!faqRes.ok || !catRes.ok) {
                    throw new Error('Failed to fetch data');
                }

                const [faqData, catData] = await Promise.all([
                    faqRes.json(),
                    catRes.json()
                ]);

                if (isMounted) {
                    setFaqs(faqData);
                    setCategories(catData);
                }
            } catch (error) {
                const err = error as Error;
                // Ignore AbortError
                if (err.name === 'AbortError' || err.message?.includes('aborted') || err.message?.includes('signal is aborted')) {
                    return;
                }

                if (isMounted) {
                    console.error('Error fetching FAQs:', error);
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        fetchData();

        return () => {
            isMounted = false;
        };
    }, []);

    const filteredFaqs = activeCategory === 'all'
        ? faqs
        : faqs.filter(f => f.category === activeCategory);

    const categoryTabs = ['all', ...categories.map(c => c.name)];

    if (loading) {
        return (
            <div className="container py-20 flex justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-12 px-4 max-w-4xl">
            <div className="text-center mb-12">
                <h1 className="text-3xl font-bold mb-4">자주 묻는 질문</h1>
                <p className="text-muted-foreground">궁금하신 점을 카테고리별로 확인해 보세요.</p>
            </div>

            {/* Category Tabs */}
            <div className="flex flex-wrap justify-center gap-2 mb-10">
                {categoryTabs.map((cat) => (
                    <button
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-200 ${activeCategory === cat
                            ? 'bg-primary text-primary-foreground shadow-md'
                            : 'bg-secondary hover:bg-secondary/80 text-secondary-foreground'
                            }`}
                    >
                        {cat === 'all' ? '전체' : cat}
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

        </div>
    );
}
