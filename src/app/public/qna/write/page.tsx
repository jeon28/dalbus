"use client";

import React, { useState } from 'react';
import { useServices } from '@/lib/ServiceContext';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function QnAWritePage() {
    const { user } = useServices();
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        title: '',
        content: '',
        guest_name: '',
        guest_password: '',
        is_secret: false
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        const checked = (e.target as HTMLInputElement).checked;

        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        // Validation for Guest
        if (!user) {
            if (!formData.guest_name || !formData.guest_password) {
                alert('비회원은 이름과 비밀번호가 필수입니다.');
                setLoading(false);
                return;
            }
        }

        try {
            const body = {
                ...formData,
                user_id: user?.id || null
            };

            const res = await fetch('/api/qna', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (res.ok) {
                alert('문의가 등록되었습니다.');
                router.push('/public/qna');
            } else {
                const err = await res.json();
                alert(`등록 실패: ${err.error || '알 수 없는 오류'}`);
            }
        } catch {
            alert('오류가 발생했습니다.');
        }
        setLoading(false);
    };

    return (
        <div className="container py-12 max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">문의하기</h1>

            <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow border">
                {!user && (
                    <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded border">
                        <div className="space-y-2">
                            <Label htmlFor="guest_name">이름 (필수)</Label>
                            <Input
                                id="guest_name"
                                name="guest_name"
                                value={formData.guest_name}
                                onChange={handleChange}
                                required={!user}
                                placeholder="작성자명"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="guest_password">비밀번호 (필수)</Label>
                            <Input
                                id="guest_password"
                                name="guest_password"
                                type="password"
                                value={formData.guest_password}
                                onChange={handleChange}
                                required={!user}
                                placeholder="수정/삭제용 비밀번호"
                            />
                        </div>
                        <div className="col-span-2 text-xs text-gray-500">
                            * 비회원은 추후 수정/삭제를 위해 비밀번호를 꼭 기억해주세요.
                        </div>
                    </div>
                )}

                <div className="space-y-2">
                    <Label htmlFor="title">제목</Label>
                    <Input
                        id="title"
                        name="title"
                        value={formData.title}
                        onChange={handleChange}
                        required
                        placeholder="제목을 입력해주세요"
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="content">문의 내용</Label>
                    <textarea
                        id="content"
                        name="content"
                        value={formData.content}
                        onChange={handleChange}
                        required
                        className="flex min-h-[150px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder="문의하실 내용을 입력해주세요"
                    />
                </div>

                <div className="flex items-center space-x-2 pt-2">
                    <input
                        type="checkbox"
                        id="is_secret"
                        name="is_secret"
                        checked={formData.is_secret}
                        onChange={handleChange}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <Label htmlFor="is_secret" className="cursor-pointer">비밀글로 작성 (작성자와 관리자만 볼 수 있습니다)</Label>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t mt-4">
                    <Link href="/public/qna">
                        <Button type="button" variant="ghost">취소</Button>
                    </Link>
                    <Button type="submit" disabled={loading}>
                        {loading ? '등록 중...' : '등록하기'}
                    </Button>
                </div>
            </form>
        </div>
    );
}
