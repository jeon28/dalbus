/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState } from 'react';
import { useServices } from '@/lib/ServiceContext';
import styles from '../../admin.module.css';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from 'next/link'; // Corrected import
import { ArrowLeft } from 'lucide-react';

export default function NewServicePage() {
    const { isAdmin } = useServices();
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        slug: '',
        original_price: '0',
        description: '',
        image_url: '',
        sort_order: '0',
        is_active: true
    });

    if (!isAdmin) {
        if (typeof window !== 'undefined') router.push('/admin');
        return null;
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const response = await fetch('/api/admin/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    original_price: parseInt(formData.original_price),
                    sort_order: parseInt(formData.sort_order),
                    benefits: [] // Default empty benefits for now
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to create product');
            }

            alert('서비스가 생성되었습니다.');
            router.push('/admin/services');
        } catch (error: any) {
            console.error('Error creating product:', error);
            alert(`오류 발생: ${error.message}`);
        }
        setLoading(false);
    };

    return (
        <main className={styles.main}>
            <header className={`${styles.header} glass`}>
                <div className="container flex items-center gap-4">
                    <Link href="/admin/services">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <h1 className={styles.title}>새 서비스 추가</h1>
                </div>
            </header>

            <div className={`${styles.content} container max-w-2xl`}>
                <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow-sm border">
                    <div className="space-y-2">
                        <Label htmlFor="name">서비스명</Label>
                        <Input id="name" name="name" value={formData.name} onChange={handleChange} required placeholder="예: Spotify" />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="slug">Slug (URL 식별자)</Label>
                        <Input id="slug" name="slug" value={formData.slug} onChange={handleChange} required placeholder="예: spotify-premium" />
                        <p className="text-xs text-gray-500">영문 소문자, 숫자, 하이픈(-)만 사용 가능</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="original_price">기본 가격 (표시용 정가)</Label>
                            <Input id="original_price" name="original_price" type="number" value={formData.original_price} onChange={handleChange} required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="sort_order">정렬 순서</Label>
                            <Input id="sort_order" name="sort_order" type="number" value={formData.sort_order} onChange={handleChange} required />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">설명</Label>
                        <Input id="description" name="description" value={formData.description} onChange={handleChange} placeholder="간단한 서비스 설명" />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="image_url">이미지 경로</Label>
                        <Input id="image_url" name="image_url" value={formData.image_url} onChange={handleChange} placeholder="예: /spotify-logo.svg" />
                    </div>

                    <div className="flex items-center space-x-2">
                        <input
                            type="checkbox"
                            id="is_active"
                            name="is_active"
                            checked={formData.is_active}
                            onChange={handleChange}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <Label htmlFor="is_active">판매 활성화</Label>
                    </div>

                    <div className="pt-4 flex justify-end gap-2">
                        <Link href="/admin/services">
                            <Button type="button" variant="outline">취소</Button>
                        </Link>
                        <Button type="submit" disabled={loading}>
                            {loading ? '저장 중...' : '서비스 생성'}
                        </Button>
                    </div>
                </form>
            </div>
        </main>
    );
}
