"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useServices } from '@/lib/ServiceContext';
import styles from '../../admin.module.css';
import { useRouter, useParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from 'next/link';
import { ArrowLeft, Trash2, Plus } from 'lucide-react';
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from '@/lib/api';

export default function EditServicePage() {
    const { isAdmin } = useServices();
    const router = useRouter();
    const params = useParams();
    const id = params?.id as string;

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [submittingPlan, setSubmittingPlan] = useState(false);
    const [deleteErrorPlanId, setDeleteErrorPlanId] = useState<string | null>(null);
    const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null);

    interface AdminPlan {
        id: string;
        duration_months: number;
        price: number;
        discount_rate: number;
        is_active: boolean;
    }

    interface AdminService {
        id: string;
        name: string;
        slug: string;
        original_price: number;
        sort_order: number;
        description: string | null;
        detail_content: string | null;
        image_url: string | null;
        is_active: boolean;
        product_plans: AdminPlan[];
    }

    // Product State
    const [product, setProduct] = useState<AdminService | null>(null);

    // Plan Form State (for adding new plan)
    const [newPlan, setNewPlan] = useState({
        duration_months: 1,
        price: 0,
        discount_rate: 0,
        is_active: true
    });

    const fetchProduct = useCallback(async () => {
        setLoading(true);
        try {
            const response = await apiFetch(`/api/admin/products/${id}`);
            if (!response.ok) throw new Error('Failed to fetch product');
            const data = await response.json();
            setProduct(data);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
            console.error('Error fetching product:', error);
            alert(`서비스 정보를 불러오는데 실패했습니다: ${message}`);
            router.push('/admin/services');
        }
        setLoading(false);
    }, [id, router]);

    useEffect(() => {
        if (!isAdmin) {
            router.push('/admin');
        } else if (id) {
            fetchProduct();
        }
    }, [isAdmin, id, router, fetchProduct]);

    const handleProductChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        const checked = (e.target as HTMLInputElement).checked;
        setProduct((prev: AdminService | null) => {
            if (!prev) return null;
            return {
                ...prev,
                [name]: type === 'checkbox' ? checked : value
            } as AdminService;
        });
    };

    const handleProductSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (!product) return;
            const response = await apiFetch(`/api/admin/products/${id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    ...product,
                    original_price: parseInt(product.original_price.toString()),
                    sort_order: parseInt(product.sort_order.toString()),
                })
            });

            if (!response.ok) throw new Error('Failed to update product');
            alert('서비스 정보가 수정되었습니다.');
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
            alert(`오류 발생: ${message}`);
        } finally {
            setSaving(false);
        }
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
        setSubmittingPlan(true);

        try {
            const response = await apiFetch('/api/admin/plans', {
                method: 'POST',
                body: JSON.stringify({
                    product_id: id,
                    duration_months: parseInt(newPlan.duration_months.toString()),
                    price: parseInt(newPlan.price.toString()),
                    discount_rate: parseFloat(newPlan.discount_rate.toString()),
                    is_active: newPlan.is_active
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to add plan');
            }

            setNewPlan({ duration_months: 1, price: 0, discount_rate: 0, is_active: true }); // Reset form
            fetchProduct(); // Refresh list
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
            alert(`오류 발생: ${message}`);
        } finally {
            setSubmittingPlan(false);
        }
    };

    const handleTogglePlan = async (plan: AdminPlan) => {
        try {
            const response = await apiFetch(`/api/admin/plans/${plan.id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    is_active: !plan.is_active
                })
            });
            if (!response.ok) throw new Error('Failed to update plan status');
            fetchProduct();
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
            alert(`오류 발생: ${message}`);
        }
    };

    const handleDeletePlan = async (planId: string) => {
        setDeleteErrorPlanId(null);
        setDeletingPlanId(planId);
        try {
            const response = await apiFetch(`/api/admin/plans/${planId}`, {
                method: 'DELETE',
            });
            if (response.ok) {
                fetchProduct();
            } else {
                setDeleteErrorPlanId(planId);
                // Attempt to parse error data silently for logging, but don't blow up the console
                // if the UI is already showing a friendly message.
                try {
                    const errorData = await response.json();
                    console.log('[Plan Deletion] Failed with status:', response.status, errorData);
                } catch {
                    console.log('[Plan Deletion] Failed with status:', response.status);
                }
            }
        } catch (error: unknown) {
            console.error('Error deleting plan:', error);
            setDeleteErrorPlanId(planId);
        } finally {
            setDeletingPlanId(null);
        }
    };

    if (!isAdmin || loading || !product) return null;

    return (
        <main className={styles.main}>
            <header className={`${styles.header} glass`}>
                <div className="container flex items-center gap-2 sm:gap-4 overflow-hidden">
                    <Link href="/admin/services">
                        <Button variant="ghost" size="icon" className="flex-shrink-0">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <h1 className={`${styles.title} truncate`}>서비스 수정: {product.name}</h1>
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

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                            <Label htmlFor="description">설명 (서비스 카드 노출)</Label>
                            <Input id="description" name="description" value={product.description || ''} onChange={handleProductChange} placeholder="서비스 카드에 요약 표시될 내용" />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="detail_content">상세 설명 (상세 화면 노출)</Label>
                            <Textarea
                                id="detail_content"
                                name="detail_content"
                                value={product.detail_content || ''}
                                onChange={handleProductChange}
                                placeholder="상세 화면에서 보여줄 특징 및 정보를 입력하세요."
                                className="min-h-[200px]"
                            />
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
                            [...product.product_plans].sort((a, b) => a.duration_months - b.duration_months).map((plan) => (
                                <div key={plan.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white rounded-lg border shadow-sm gap-4">
                                    <div className="flex justify-between items-center sm:block">
                                        <div>
                                            <div className="font-semibold text-base sm:text-lg">{plan.duration_months}개월권</div>
                                            <div className="text-xs sm:text-sm text-gray-500">
                                                {plan.discount_rate}% 할인 ➜ ₩{plan.price.toLocaleString()}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between sm:justify-end gap-2 border-t pt-3 sm:border-t-0 sm:pt-0">
                                        <button
                                            type="button"
                                            onClick={() => handleTogglePlan(plan)}
                                            className={`px-4 py-2 sm:px-3 sm:py-1 rounded-full text-xs font-bold sm:font-medium flex-1 sm:flex-none text-center ${plan.is_active
                                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                }`}
                                            title="상태 변경 (Active/Inactive)"
                                        >
                                            {plan.is_active ? 'Active' : 'Inactive'}
                                        </button>
                                        <div className="flex flex-col items-end gap-1">
                                            <div className="flex items-center gap-1">
                                                {deleteErrorPlanId === plan.id && (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-9 px-3 text-xs text-gray-500 underline sm:h-8 sm:px-2"
                                                        onClick={() => setDeleteErrorPlanId(null)}
                                                    >
                                                        닫기
                                                    </Button>
                                                )}
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className={`h-10 w-10 sm:h-8 sm:w-8 ${deletingPlanId === plan.id ? 'animate-pulse' : ''}`}
                                                    onClick={() => handleDeletePlan(plan.id)}
                                                    disabled={deletingPlanId !== null}
                                                >
                                                    <Trash2 className={`h-5 w-5 sm:h-4 sm:w-4 ${deleteErrorPlanId === plan.id ? 'text-red-500' : 'text-red-500 opacity-60 hover:opacity-100'}`} />
                                                </Button>
                                            </div>
                                            {deleteErrorPlanId === plan.id && (
                                                <p className="text-[10px] text-red-500 text-right leading-tight max-w-[200px] bg-red-50 p-2 rounded border border-red-100 inline-block">
                                                    이미 주문한 요금제는 삭제되지 않습니다.<br />
                                                    주문내역에서 먼저 삭제 후 시도하세요.
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Add Plan Form */}
                    <div className="bg-gray-50 p-4 rounded-lg border">
                        <h3 className="font-medium mb-3 text-sm">새 요금제 추가</h3>
                        <form
                            onSubmit={handleAddPlan}
                            className="space-y-3"
                        >
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <Label className="text-xs">개월 수</Label>
                                    <Input
                                        type="number"
                                        name="duration_months"
                                        value={newPlan.duration_months}
                                        onChange={handleNewPlanChange}
                                        required
                                        className="h-10 sm:h-8 text-sm"
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
                                        className="h-10 sm:h-8 text-sm"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <Label className="text-xs">할인율 (%)</Label>
                                    <Input
                                        type="number"
                                        name="discount_rate"
                                        value={newPlan.discount_rate}
                                        onChange={handleNewPlanChange}
                                        step="0.1"
                                        required
                                        className="h-10 sm:h-8 text-sm"
                                    />
                                </div>
                                <div className="flex items-end pb-2">
                                    <div className="flex items-center space-x-2 bg-white p-2 rounded border sm:bg-transparent sm:p-0 sm:border-0 w-full">
                                        <input
                                            type="checkbox"
                                            name="is_active"
                                            id="new_plan_active"
                                            checked={newPlan.is_active}
                                            onChange={handleNewPlanChange}
                                            className="h-5 w-5 sm:h-4 sm:w-4"
                                        />
                                        <Label htmlFor="new_plan_active" className="text-sm sm:text-xs font-semibold sm:font-normal">활성화</Label>
                                    </div>
                                </div>
                            </div>
                            <Button
                                type="submit"
                                size="lg"
                                className="w-full sm:size-sm h-12 sm:h-8 font-bold sm:font-medium"
                                disabled={submittingPlan}
                            >
                                {submittingPlan ? (
                                    <>등록 중...</>
                                ) : (
                                    <>
                                        <Plus className="h-4 w-4 mr-1" /> 요금제 등록
                                    </>
                                )}
                            </Button>
                        </form>
                    </div>
                </section>
            </div>
        </main>
    );
}
