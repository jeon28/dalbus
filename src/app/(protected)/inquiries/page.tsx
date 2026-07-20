"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useServices } from '@/lib/ServiceContext';
import { apiFetch } from '@/lib/api';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PageLoading } from '@/components/ui/PageLoading';
import { toast } from 'sonner';
import { Lock, MessageCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { ImageAttach, ImageThumbs, addImageFiles, extractImageFilesFromPaste, MAX_IMAGES } from '@/components/ImageAttach';

interface Inquiry {
    id: string;
    title: string;
    content: string;
    status: 'waiting' | 'answered';
    answer_content: string | null;
    answered_at: string | null;
    created_at: string;
    images?: string[] | null;
    answer_images?: string[] | null;
}

export default function InquiriesPage() {
    const { user, isHydrated } = useServices();
    const router = useRouter();

    const [inquiries, setInquiries] = useState<Inquiry[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [images, setImages] = useState<string[]>([]);
    const [submitting, setSubmitting] = useState(false);

    const handlePaste = async (e: React.ClipboardEvent) => {
        const files = extractImageFilesFromPaste(e);
        if (files.length) {
            e.preventDefault();
            setImages(await addImageFiles(files, images));
        }
    };

    // 비로그인 시 로그인 페이지로 (로그인 후 다시 문의 페이지로 복귀)
    useEffect(() => {
        if (isHydrated && !user) {
            router.replace('/login?redirect=/inquiries');
        }
    }, [isHydrated, user, router]);

    const fetchInquiries = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiFetch('/api/inquiries', { cache: 'no-store' });
            if (res.ok) {
                setInquiries(await res.json());
            } else {
                toast.error('문의 내역을 불러오지 못했습니다.');
            }
        } catch {
            toast.error('문의 내역을 불러오지 못했습니다.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isHydrated && user) {
            fetchInquiries();
        }
    }, [isHydrated, user, fetchInquiries]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !content.trim()) {
            toast.error('제목과 내용을 입력해주세요.');
            return;
        }
        setSubmitting(true);
        try {
            const res = await apiFetch('/api/inquiries', {
                method: 'POST',
                body: JSON.stringify({ title, content, images }),
            });
            if (res.ok) {
                toast.success('문의가 등록되었습니다. 답변은 등록되면 이메일로도 알려드립니다.');
                setTitle('');
                setContent('');
                setImages([]);
                fetchInquiries();
            } else {
                const err = await res.json().catch(() => ({}));
                toast.error(err.error || '문의 등록에 실패했습니다.');
            }
        } catch {
            toast.error('문의 등록에 실패했습니다.');
        } finally {
            setSubmitting(false);
        }
    };

    if (!isHydrated || (isHydrated && user && loading)) {
        return <PageLoading />;
    }
    if (!user) return null;

    return (
        <main className="container max-w-3xl py-8 px-4">
            <div className="mb-6">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <MessageCircle className="w-6 h-6 text-primary" />
                    1:1 문의
                </h1>
                <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5" />
                    작성하신 문의는 본인과 관리자만 볼 수 있습니다.
                </p>
            </div>

            {/* 문의 작성 폼 */}
            <form onSubmit={handleSubmit} className="glass p-5 rounded-xl shadow-sm mb-8 space-y-4">
                <h2 className="font-bold">문의 남기기</h2>
                <div className="space-y-1.5">
                    <Label htmlFor="title">제목</Label>
                    <Input
                        id="title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="문의 제목을 입력하세요"
                        maxLength={100}
                    />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="content">내용</Label>
                    <textarea
                        id="content"
                        className="w-full p-3 border rounded-md min-h-[120px] text-sm bg-background"
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        onPaste={handlePaste}
                        placeholder="궁금하신 점이나 요청 사항을 자유롭게 남겨주세요. (이미지는 Ctrl+V로 붙여넣기 가능)"
                    />
                </div>
                <ImageAttach images={images} onChange={setImages} max={MAX_IMAGES} disabled={submitting} />
                <div className="flex justify-end">
                    <Button type="submit" disabled={submitting}>
                        {submitting ? '등록 중...' : '문의 등록'}
                    </Button>
                </div>
            </form>

            {/* 내 문의 내역 */}
            <div>
                <h2 className="font-bold mb-3">내 문의 내역</h2>
                {inquiries.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 text-sm border rounded-xl">
                        아직 등록한 문의가 없습니다.
                    </div>
                ) : (
                    <ul className="space-y-3">
                        {inquiries.map((q) => {
                            const open = expandedId === q.id;
                            return (
                                <li key={q.id} className="border rounded-xl overflow-hidden">
                                    <button
                                        type="button"
                                        onClick={() => setExpandedId(open ? null : q.id)}
                                        className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-gray-50 transition-colors"
                                    >
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className={`px-2 py-0.5 rounded text-xs font-semibold shrink-0 ${q.status === 'answered' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}`}>
                                                    {q.status === 'answered' ? '답변완료' : '답변대기'}
                                                </span>
                                                <span className="font-medium truncate">{q.title}</span>
                                            </div>
                                            <div className="text-xs text-gray-400 mt-1">
                                                {new Date(q.created_at).toLocaleString('ko-KR')}
                                            </div>
                                        </div>
                                        {open ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
                                    </button>
                                    {open && (
                                        <div className="px-4 pb-4 space-y-3">
                                            <div className="bg-gray-50 rounded-lg p-3">
                                                <p className="text-xs font-bold text-gray-500 mb-1">문의 내용</p>
                                                <p className="text-sm whitespace-pre-wrap">{q.content}</p>
                                                <ImageThumbs images={q.images} />
                                            </div>
                                            {q.status === 'answered' && q.answer_content ? (
                                                <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                                                    <p className="text-xs font-bold text-blue-700 mb-1">
                                                        관리자 답변
                                                        {q.answered_at && (
                                                            <span className="font-normal text-blue-400 ml-2">
                                                                {new Date(q.answered_at).toLocaleString('ko-KR')}
                                                            </span>
                                                        )}
                                                    </p>
                                                    <p className="text-sm whitespace-pre-wrap">{q.answer_content}</p>
                                                    <ImageThumbs images={q.answer_images} />
                                                </div>
                                            ) : (
                                                <p className="text-sm text-gray-400 px-1">아직 답변이 등록되지 않았습니다.</p>
                                            )}
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </main>
    );
}
