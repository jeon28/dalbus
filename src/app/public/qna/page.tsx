"use client";

import React, { useEffect, useState } from 'react';
import { useServices } from '@/lib/ServiceContext';
import { Button } from "@/components/ui/button";
import Link from 'next/link';
import { Lock } from 'lucide-react';

interface QnA {
    id: string;
    title: string;
    content: string;
    guest_name: string;
    is_secret: boolean;
    status: 'waiting' | 'answered';
    answer_content?: string;
    answered_at?: string;
    created_at: string;
    user_id?: string;
}

export default function QnAPage() {
    const { user, isAdmin } = useServices();
    // const router = useRouter();
    const [qnas, setQnas] = useState<QnA[]>([]);
    const [loading, setLoading] = useState(true);
    const [excludeSecret, setExcludeSecret] = useState(false);

    // For password verification modal
    // const [verifyId, setVerifyId] = useState<string | null>(null);
    // const [password, setPassword] = useState('');

    useEffect(() => {
        fetchQnas();
    }, [excludeSecret]);

    const fetchQnas = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/qna?exclude_secret=${excludeSecret}`);
            if (res.ok) {
                const data = await res.json();
                setQnas(data);
            }
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    /*
    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!verifyId) return;

        try {
            const res = await fetch(`/api/qna/${verifyId}/verify`, {
                method: 'POST',
                body: JSON.stringify({ password })
            });
            const data = await res.json();

            if (res.ok && data.success) {
                // Determine action (View or Edit) - here we probably just show content or go to edit page
                // Ideally we'd have a way to know intent. For now let's just alert success and allow View.
                alert('확인되었습니다.');
                setVerifyId(null);
                setPassword('');
                // In a real app, we might store a temp token or redirect to a detail page with token
            } else {
                alert('비밀번호가 일치하지 않습니다.');
            }
        } catch {
            alert('오류가 발생했습니다.');
        }
    };
    */

    return (
        <div className="container py-12 max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold">Q&A 게시판</h1>
                <Link href="/public/qna/write">
                    <Button>문의하기</Button>
                </Link>
            </div>

            <div className="flex justify-end mb-4 items-center gap-2">
                <input
                    type="checkbox"
                    id="excludeSecret"
                    checked={excludeSecret}
                    onChange={(e) => setExcludeSecret(e.target.checked)}
                    className="h-4 w-4"
                />
                <label htmlFor="excludeSecret" className="text-sm text-gray-600 cursor-pointer">비밀글 제외</label>
            </div>

            <div className="bg-white rounded-lg shadow border overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-700 font-medium border-b">
                        <tr>
                            <th className="py-3 px-4 w-20 text-center">상태</th>
                            <th className="py-3 px-4">제목</th>
                            <th className="py-3 px-4 w-32 text-center">작성자</th>
                            <th className="py-3 px-4 w-32 text-center">작성일</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={4} className="py-8 text-center text-gray-500">로딩 중...</td></tr>
                        ) : qnas.length === 0 ? (
                            <tr><td colSpan={4} className="py-8 text-center text-gray-500">등록된 문의가 없습니다.</td></tr>
                        ) : (
                            qnas.map(q => (
                                <React.Fragment key={q.id}>
                                    <tr className="border-b hover:bg-gray-50 transition-colors">
                                        <td className="py-3 px-4 text-center">
                                            <span className={`px-2 py-1 rounded text-xs ${q.status === 'answered' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}`}>
                                                {q.status === 'answered' ? '답변완료' : '미답변'}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-2">
                                                {q.is_secret && <Lock className="w-3 h-3 text-gray-400" />}
                                                <span
                                                    className="cursor-pointer hover:underline font-medium"
                                                    onClick={() => {
                                                        // Toggle detail view logic here or redirect
                                                        // For simplicity, let's toggle a simple state or component
                                                        const el = document.getElementById(`content-${q.id}`);
                                                        if (el) el.classList.toggle('hidden');
                                                    }}
                                                >
                                                    {q.is_secret ? '비밀글입니다.' : q.title}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            {q.user_id ? (q.user_id === user?.id ? '나' : '회원') : q.guest_name}
                                        </td>
                                        <td className="py-3 px-4 text-center text-gray-500">
                                            {new Date(q.created_at).toLocaleDateString()}
                                        </td>
                                    </tr>
                                    {/* Detail Row (Quick Implementation) */}
                                    <tr id={`content-${q.id}`} className="hidden bg-gray-50 border-b">
                                        <td colSpan={4} className="p-6">
                                            {/* Security Check */}
                                            {q.is_secret && !isAdmin && (!user || user.id !== q.user_id) && (
                                                <div className="text-center py-4">
                                                    <p className="mb-2 text-gray-600">비밀글입니다. 비밀번호를 입력해주세요 (비회원) 또는 본인만 확인 가능합니다.</p>
                                                    {/* Proper implementation requires verified state. 
                                                        For this MVP step, we will assume if guest_password is set, we ask for it.
                                                     */}
                                                    {!q.user_id && (
                                                        <div className="flex justify-center gap-2">
                                                            <input
                                                                type="password"
                                                                placeholder="비밀번호"
                                                                className="border p-1 rounded"
                                                                onChange={(e) => {
                                                                    if (e.target.value === 'TEMP_FIX') { /* Verify logic needed */ }
                                                                }}
                                                            />
                                                            {/* This needs robust state logic not easily done in this quick map. 
                                                                 Better to redirect to specific page for secure verification. */}
                                                            <Button size="sm" variant="outline">확인</Button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Content View (If allowed) */}
                                            {(!q.is_secret || isAdmin || (user && user.id === q.user_id)) && (
                                                <div className="space-y-4">
                                                    <div className="bg-white p-4 rounded border">
                                                        <h3 className="font-bold mb-2">질문 내용</h3>
                                                        <p className="whitespace-pre-wrap text-gray-800">{q.content}</p>
                                                    </div>

                                                    {q.answer_content && (
                                                        <div className="bg-blue-50 p-4 rounded border border-blue-100 ml-8">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded">답변</span>
                                                                <span className="text-xs text-blue-800">관리자 • {q.answered_at && new Date(q.answered_at).toLocaleDateString()}</span>
                                                            </div>
                                                            <p className="whitespace-pre-wrap text-gray-800">{q.answer_content}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                </React.Fragment>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
