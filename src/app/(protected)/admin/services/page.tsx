/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState } from 'react';
import { useServices } from '@/lib/ServiceContext';
import styles from '../admin.module.css';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import Link from 'next/link';
import Image from 'next/image';
import { Trash2, Edit } from 'lucide-react';

export default function ServiceListPage() {
    const { isAdmin } = useServices();
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        if (!isAdmin) {
            router.push('/admin');
        } else {
            fetchProducts();
        }
    }, [isAdmin, router]);

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/admin/products');
            if (!response.ok) throw new Error('Failed to fetch products');
            const data = await response.json();
            setProducts(data);
        } catch (error) {
            console.error('Error fetching products:', error);
        }
        setLoading(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('정말 삭제하시겠습니까? 관련 된 모든 주문과 데이터가 영향을 받을 수 있습니다.')) return;

        try {
            const response = await fetch(`/api/admin/products/${id}`, {
                method: 'DELETE',
            });
            if (response.ok) {
                alert('삭제되었습니다.');
                fetchProducts();
            } else {
                alert('삭제 실패');
            }
        } catch (error) {
            console.error('Error deleting product:', error);
            alert('오류가 발생했습니다.');
        }
    };

    if (!isAdmin) return null;

    return (
        <main className={styles.main}>
            <header className={`${styles.header} glass`}>
                <div className="container flex justify-between items-center">
                    <h1 className={styles.title}>서비스 관리</h1>
                    <Link href="/admin/services/new">
                        <Button>서비스 추가</Button>
                    </Link>
                </div>
            </header>

            <div className={`${styles.content} container`}>
                <section className={styles.orderSection}>
                    <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>순서</th>
                                    <th>이미지</th>
                                    <th>서비스명</th>
                                    <th>Slug</th>
                                    <th>기본가</th>
                                    <th>상태</th>
                                    <th>요금제 수</th>
                                    <th>관리</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={8} className="text-center py-8">로딩 중...</td>
                                    </tr>
                                ) : products.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="text-center py-8">등록된 서비스가 없습니다.</td>
                                    </tr>
                                ) : (
                                    products.map(p => (
                                        <tr key={p.id}>
                                            <td>{p.sort_order}</td>
                                            <td>
                                                {p.image_url && (
                                                    <div className="relative w-8 h-8 flex-shrink-0">
                                                        <Image src={p.image_url} alt={p.name} fill className="object-contain rounded" />
                                                    </div>
                                                )}
                                            </td>
                                            <td className="font-medium">{p.name}</td>
                                            <td>{p.slug}</td>
                                            <td>₩{p.original_price.toLocaleString()}</td>
                                            <td>
                                                <span className={`px-2 py-1 rounded text-xs ${p.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                                    {p.is_active ? '판매중' : '숨김'}
                                                </span>
                                            </td>
                                            <td>{p.product_plans?.length || 0}개</td>
                                            <td>
                                                <div className="flex gap-2">
                                                    <Link href={`/admin/services/${p.id}`}>
                                                        <Button variant="outline" size="icon" className="h-8 w-8">
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                    </Link>
                                                    <Button
                                                        variant="destructive"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        onClick={() => handleDelete(p.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
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
