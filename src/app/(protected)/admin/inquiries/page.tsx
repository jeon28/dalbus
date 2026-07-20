"use client";

import React, { useEffect, useState } from 'react';
import { useServices } from '@/lib/ServiceContext';
import styles from '../admin.module.css';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Trash2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { ImageAttach, ImageThumbs, addImageFiles, extractImageFilesFromPaste, MAX_IMAGES } from '@/components/ImageAttach';

interface InquiryProfile {
    name: string | null;
    email: string | null;
    phone: string | null;
}

interface Inquiry {
    id: string;
    title: string;
    content: string;
    status: 'waiting' | 'answered';
    answer_content: string | null;
    answered_at: string | null;
    created_at: string;
    images: string[] | null;
    answer_images: string[] | null;
    profiles: InquiryProfile | null;
}

export default function AdminInquiriesPage() {
    const { isAdmin } = useServices();
    const router = useRouter();
    const [inquiries, setInquiries] = useState<Inquiry[]>([]);
    const [loading, setLoading] = useState(true);
    const [answeringId, setAnsweringId] = useState<string | null>(null);
    const [answerContent, setAnswerContent] = useState('');
    const [answerImages, setAnswerImages] = useState<string[]>([]);
    const [submitting, setSubmitting] = useState(false);

    const handleAnswerPaste = async (e: React.ClipboardEvent) => {
        const files = extractImageFilesFromPaste(e);
        if (files.length) {
            e.preventDefault();
            setAnswerImages(await addImageFiles(files, answerImages));
        }
    };

    useEffect(() => {
        if (!isAdmin) {
            router.push('/admin');
        } else {
            fetchInquiries();
        }
    }, [isAdmin, router]);

    const fetchInquiries = async () => {
        setLoading(true);
        try {
            const res = await apiFetch('/api/admin/inquiries');
            if (res.ok) {
                setInquiries(await res.json());
            }
        } catch (error: unknown) {
            console.error('Error fetching inquiries:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAnswerSubmit = async (id: string) => {
        if (!answerContent.trim()) return;
        setSubmitting(true);
        try {
            const res = await apiFetch(`/api/admin/inquiries/${id}/answer`, {
                method: 'POST',
                body: JSON.stringify({ answer_content: answerContent, answer_images: answerImages }),
            });
            if (res.ok) {
                alert('답변이 등록되었습니다. 회원에게 답변 완료 메일이 발송됩니다.');
                setAnsweringId(null);
                setAnswerContent('');
                setAnswerImages([]);
                fetchInquiries();
            } else {
                throw new Error('답변 등록 실패');
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
            alert(`오류: ${message}`);
        } finally {
            setSubmitting(false);
        }
    };

    const handleAnswerDelete = async (id: string) => {
        if (!confirm('등록된 답변을 삭제하시겠습니까? 문의는 다시 미답변 상태가 됩니다.')) return;
        try {
            const res = await apiFetch(`/api/admin/inquiries/${id}/answer`, { method: 'DELETE' });
            if (res.ok) {
                alert('답변이 삭제되었습니다.');
                setAnswerContent('');
                setAnswerImages([]);
                fetchInquiries();
            } else {
                throw new Error('답변 삭제 실패');
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
            alert(`오류: ${message}`);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('정말 삭제하시겠습니까? 문의와 답변이 모두 삭제됩니다.')) return;
        try {
            const res = await apiFetch(`/api/admin/inquiries/${id}`, { method: 'DELETE' });
            if (res.ok) {
                alert('삭제되었습니다.');
                fetchInquiries();
            } else {
                throw new Error('삭제 실패');
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
            alert(`오류: ${message}`);
        }
    };

    if (!isAdmin) return null;

    return (
        <main className={styles.main}>
            <header className={`${styles.header} glass`}>
                <div className="container">
                    <h1 className={styles.title}>1:1 문의 관리</h1>
                </div>
            </header>

            <div className={`${styles.content} container`}>
                <section className={styles.orderSection}>
                    <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>상태</th>
                                    <th>제목 / 내용</th>
                                    <th>작성자</th>
                                    <th>날짜</th>
                                    <th>관리</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={5} className="text-center py-8">로딩 중...</td></tr>
                                ) : inquiries.length === 0 ? (
                                    <tr><td colSpan={5} className="text-center py-8">문의가 없습니다.</td></tr>
                                ) : (
                                    inquiries.map(q => (
                                        <React.Fragment key={q.id}>
                                            <tr className="border-b">
                                                <td className="w-24 text-center">
                                                    <span className={`px-2 py-1 rounded text-xs ${q.status === 'answered' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}`}>
                                                        {q.status === 'answered' ? '답변완료' : '미답변'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="font-medium">{q.title}</div>
                                                    <div className="text-sm text-gray-500 mt-1 line-clamp-1">{q.content}</div>
                                                </td>
                                                <td className="w-40 text-center text-sm">
                                                    <div>{q.profiles?.name || '회원'}</div>
                                                    <div className="text-xs text-gray-400">{q.profiles?.email || ''}</div>
                                                </td>
                                                <td className="w-32 text-center text-sm text-gray-400">
                                                    {new Date(q.created_at).toLocaleDateString()}
                                                </td>
                                                <td className="w-24 text-center">
                                                    <div className="flex justify-center gap-2">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => {
                                                                if (answeringId === q.id) {
                                                                    setAnsweringId(null);
                                                                } else {
                                                                    setAnsweringId(q.id);
                                                                    setAnswerContent(q.answer_content || '');
                                                                    setAnswerImages(q.answer_images || []);
                                                                }
                                                            }}
                                                        >
                                                            {answeringId === q.id ? '닫기' : '답변'}
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="destructive"
                                                            onClick={() => handleDelete(q.id)}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                            {answeringId === q.id && (
                                                <tr className="bg-blue-50">
                                                    <td colSpan={5} className="p-4">
                                                        <div className="mb-4 bg-white p-3 rounded border">
                                                            <p className="font-bold text-sm mb-1">문의 내용 전문:</p>
                                                            <p className="whitespace-pre-wrap">{q.content}</p>
                                                            <ImageThumbs images={q.images} label={q.images && q.images.length > 0 ? '첨부 이미지' : undefined} />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <label className="text-sm font-bold">답변 작성:</label>
                                                            <textarea
                                                                className="w-full p-2 border rounded min-h-[100px]"
                                                                value={answerContent}
                                                                onChange={(e) => setAnswerContent(e.target.value)}
                                                                onPaste={handleAnswerPaste}
                                                                placeholder="답변 내용을 입력하세요... (이미지는 Ctrl+V로 붙여넣기 가능)"
                                                            />
                                                            <ImageAttach images={answerImages} onChange={setAnswerImages} max={MAX_IMAGES} disabled={submitting} />
                                                            <div className="flex justify-end gap-2">
                                                                {q.answer_content && (
                                                                    <Button
                                                                        variant="destructive"
                                                                        onClick={() => handleAnswerDelete(q.id)}
                                                                        disabled={submitting}
                                                                    >
                                                                        답변 삭제
                                                                    </Button>
                                                                )}
                                                                <Button onClick={() => handleAnswerSubmit(q.id)} disabled={submitting}>
                                                                    {submitting ? '등록 중...' : (q.answer_content ? '답변 수정' : '답변 등록')}
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        </main>
    );
}
