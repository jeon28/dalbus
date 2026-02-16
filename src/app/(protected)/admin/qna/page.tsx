"use client";

import React, { useEffect, useState } from 'react';
import { useServices } from '@/lib/ServiceContext';
import styles from '../admin.module.css';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Lock } from 'lucide-react';

interface Question {
    id: string;
    title: string;
    content: string;
    guest_name: string | null;
    is_secret: boolean;
    status: 'pending' | 'answered';
    answer_content: string | null;
    created_at: string;
}

export default function AdminQnAPage() {
    const { isAdmin } = useServices();
    const router = useRouter();
    const [qnas, setQnas] = useState<Question[]>([]);
    const [loading, setLoading] = useState(true);
    const [answeringId, setAnsweringId] = useState<string | null>(null);
    const [answerContent, setAnswerContent] = useState('');

    useEffect(() => {
        if (!isAdmin) {
            router.push('/admin');
        } else {
            fetchQnas();
        }
    }, [isAdmin, router]);

    const fetchQnas = async () => {
        setLoading(true);
        try {
            // Admin fetches all, including secrets
            const res = await fetch('/api/qna?exclude_secret=false');
            if (res.ok) {
                const data = await res.json();
                setQnas(data);
            }
        } catch (error: unknown) {
            console.error('Error fetching QnA data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAnswerSubmit = async (id: string) => {
        if (!answerContent.trim()) return;

        try {
            const res = await fetch(`/api/admin/qna/${id}/answer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ answer_content: answerContent })
            });

            if (res.ok) {
                alert('답변이 등록되었습니다.');
                setAnsweringId(null);
                setAnswerContent('');
                fetchQnas(); // Refresh
            } else {
                throw new Error('답변 등록 실패');
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
                    <h1 className={styles.title}>Q&A 관리</h1>
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
                                ) : qnas.length === 0 ? (
                                    <tr><td colSpan={5} className="text-center py-8">문의가 없습니다.</td></tr>
                                ) : (
                                    qnas.map(q => (
                                        <React.Fragment key={q.id}>
                                            <tr className="border-b">
                                                <td className="w-24 text-center">
                                                    <span className={`px-2 py-1 rounded text-xs ${q.status === 'answered' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}`}>
                                                        {q.status === 'answered' ? '답변완료' : '미답변'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="font-medium flex items-center gap-2">
                                                        {q.is_secret && <Lock className="w-3 h-3 text-red-400" />}
                                                        {q.title}
                                                    </div>
                                                    <div className="text-sm text-gray-500 mt-1 line-clamp-1">{q.content}</div>
                                                </td>
                                                <td className="w-32 text-center text-sm">
                                                    {q.guest_name || '회원'}
                                                </td>
                                                <td className="w-32 text-center text-sm text-gray-400">
                                                    {new Date(q.created_at).toLocaleDateString()}
                                                </td>
                                                <td className="w-24 text-center">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => {
                                                            if (answeringId === q.id) {
                                                                setAnsweringId(null);
                                                            } else {
                                                                setAnsweringId(q.id);
                                                                setAnswerContent(q.answer_content || '');
                                                            }
                                                        }}
                                                    >
                                                        {answeringId === q.id ? '닫기' : '답변'}
                                                    </Button>
                                                </td>
                                            </tr>
                                            {answeringId === q.id && (
                                                <tr className="bg-blue-50">
                                                    <td colSpan={5} className="p-4">
                                                        <div className="mb-4 bg-white p-3 rounded border">
                                                            <p className="font-bold text-sm mb-1">문의 내용 전문:</p>
                                                            <p>{q.content}</p>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <label className="text-sm font-bold">답변 작성:</label>
                                                            <textarea
                                                                className="w-full p-2 border rounded min-h-[100px]"
                                                                value={answerContent}
                                                                onChange={(e) => setAnswerContent(e.target.value)}
                                                                placeholder="답변 내용을 입력하세요..."
                                                            />
                                                            <div className="flex justify-end">
                                                                <Button onClick={() => handleAnswerSubmit(q.id)}>
                                                                    답변 등록
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
