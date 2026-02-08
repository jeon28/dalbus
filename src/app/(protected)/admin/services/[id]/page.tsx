/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState } from 'react';
import { useServices } from '@/lib/ServiceContext';
import styles from '../../admin.module.css';
import { useRouter, useParams } from 'next/navigation'; // Use useParams
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from 'next/link';
import { ArrowLeft, Trash2, Plus } from 'lucide-react';

export default function EditServicePage() {
    const { isAdmin } = useServices();
    const router = useRouter();
    const params = useParams();
    const id = params?.id as string;

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Product State
    const [product, setProduct] = useState<any>(null);

    // Plan Form State (for adding new plan)
    const [newPlan, setNewPlan] = useState({
        duration_months: 1,
        price: 0,
        discount_rate: 0,
        is_active: true
    });

    useEffect(() => {
        if (!isAdmin) {
            router.push('/admin');
        } else if (id) {
            fetchProduct();
        }
    }, [isAdmin, id, router]);

    const fetchProduct = async () => {
        setLoading(true);
        try {
            const response = await fetch(`/api/admin/products/${id}`);
            if (!response.ok) throw new Error('Failed to fetch product');
            const data = await response.json();
            setProduct(data);
        } catch (error) {
            console.error('Error fetching product:', error);
            alert('서비스 정보를 불러오는데 실패했습니다.');
            router.push('/admin/services');
        }
        setLoading(false);
    };

    const handleProductChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setProduct((prev: any) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleProductSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const response = await fetch(`/api/admin/products/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...product,
                    original_price: parseInt(product.original_price),
                    sort_order: parseInt(product.sort_order),
                })
            });

            if (!response.ok) throw new Error('Failed to update product');
            alert('서비스 정보가 수정되었습니다.');
        } catch (error: any) {
            alert(`오류 발생: ${error.message}`);
        }
        setSaving(false);
    };

    const handleNewPlanChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setNewPlan(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleAddPlan = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!confirm('요금제를 추가하시겠습니까?')) return;

        try {
            const response = await fetch('/api/admin/plans', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    product_id: id,
                    duration_months: parseInt(newPlan.duration_months.toString()),
                    price: parseInt(newPlan.price.toString()),
                    discount_rate: parseFloat(newPlan.discount_rate.toString()),
                    is_active: newPlan.is_active
                })
            });

            if (!response.ok) throw new Error('Failed to add plan');

            alert('요금제가 추가되었습니다.');
            setNewPlan({ duration_months: 1, price: 0, discount_rate: 0, is_active: true }); // Reset form
            fetchProduct(); // Refresh list
        } catch (error: any) {
            alert(`오류 발생: ${error.message}`);
        }
    };

    const handleDeletePlan = async (planId: string) => {
        if (!confirm('정말 삭제하시겠습니까?')) return;
        try {
            const response = await fetch(`/api/admin/plans/${planId}`, {
                method: 'DELETE',
            });
            if (response.ok) {
                fetchProduct();
            } else {
                alert('삭제 실패');
            }
        } catch (error) {
            console.error('Error deleting plan:', error);
        }
    };

    if (!isAdmin || loading || !product) return null;

    return (
        <main className={styles.main}>
            <header className={`${styles.header} glass`}>
                <div className="container flex items-center gap-4">
                    <Link href="/admin/services">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <h1 className={styles.title}>서비스 수정: {product.name}</h1>
                </div>
            </header>

            <div className={`${styles.content} container grid gap-8 lg:grid-cols-2`}>
                {/* Left: Product Info */}
                <section>
                    <h2 className="text-lg font-semibold mb-4">기본 정보</h2>
                    <form onSubmit={handleProductSubmit} className="space-y-4 bg-white p-6 rounded-lg shadow-sm border">
                        <div className="space-y-2">
                            <Label htmlFor="name">서비스명</Label>
                            <Input id="name" name="name" value={product.name} onChange={handleProductChange} required />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="slug">Slug</Label>
                            <Input id="slug" name="slug" value={product.slug} onChange={handleProductChange} required />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="original_price">기본 가격</Label>
                                <Input id="original_price" name="original_price" type="number" value={product.original_price} onChange={handleProductChange} required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="sort_order">정렬 순서</Label>
                                <Input id="sort_order" name="sort_order" type="number" value={product.sort_order} onChange={handleProductChange} required />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description">설명</Label>
                            <Input id="description" name="description" value={product.description || ''} onChange={handleProductChange} />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="image_url">이미지 경로</Label>
                            <Input id="image_url" name="image_url" value={product.image_url || ''} onChange={handleProductChange} />
                        </div>

                        <div className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                id="is_active"
                                name="is_active"
                                checked={product.is_active}
                                onChange={handleProductChange}
                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            <Label htmlFor="is_active">판매 활성화</Label>
                        </div>

                        <div className="pt-2 flex justify-end">
                            <Button type="submit" disabled={saving}>
                                {saving ? '저장 중...' : '변경사항 저장'}
                            </Button>
                        </div>
                    </form>
                </section>

                {/* Right: Plan Management */}
                <section>
                    <h2 className="text-lg font-semibold mb-4">요금제 관리</h2>

                    {/* Plan List */}
                    <div className="space-y-4 mb-8">
                        {product.product_plans?.length === 0 ? (
                            <p className="text-gray-500 text-sm">등록된 요금제가 없습니다.</p>
                        ) : (
                            product.product_plans?.sort((a: any, b: any) => a.duration_months - b.duration_months).map((plan: any) => (
                                <div key={plan.id} className="flex items-center justify-between p-4 bg-white rounded-lg border shadow-sm">
                                    <div>
                                        <div className="font-semibold">{plan.duration_months}개월권</div>
                                        <div className="text-sm text-gray-500">
                                            {plan.discount_rate}% 할인 ➜ ₩{plan.price.toLocaleString()}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs px-2 py-0.5 rounded ${plan.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                            {plan.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                        <Button variant="ghost" size="icon" onClick={() => handleDeletePlan(plan.id)}>
                                            <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Add Plan Form */}
                    <div className="bg-gray-50 p-4 rounded-lg border">
                        <h3 className="font-medium mb-3 text-sm">새 요금제 추가</h3>
                        <form onSubmit={handleAddPlan} className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label className="text-xs">개월 수</Label>
                                    <Input
                                        type="number"
                                        name="duration_months"
                                        value={newPlan.duration_months}
                                        onChange={handleNewPlanChange}
                                        required
                                        className="h-8 text-sm"
                                    />
                                </div>
                                <div>
                                    <Label className="text-xs">가격 (할인가)</Label>
                                    <Input
                                        type="number"
                                        name="price"
                                        value={newPlan.price}
                                        onChange={handleNewPlanChange}
                                        required
                                        className="h-8 text-sm"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label className="text-xs">할인율 (%)</Label>
                                    <Input
                                        type="number"
                                        name="discount_rate"
                                        value={newPlan.discount_rate}
                                        onChange={handleNewPlanChange}
                                        step="0.1"
                                        required
                                        className="h-8 text-sm"
                                    />
                                </div>
                                <div className="flex items-end pb-2">
                                    <div className="flex items-center space-x-2">
                                        <input
                                            type="checkbox"
                                            name="is_active"
                                            checked={newPlan.is_active}
                                            onChange={handleNewPlanChange}
                                            className="h-4 w-4"
                                        />
                                        <Label className="text-xs">활성화</Label>
                                    </div>
                                </div>
                            </div>
                            <Button type="submit" size="sm" className="w-full">
                                <Plus className="h-4 w-4 mr-1" /> 요금제 등록
                            </Button>
                        </form>
                    </div>
                </section>
            </div>
        </main>
    );
}
