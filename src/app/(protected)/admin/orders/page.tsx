/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState } from 'react';
import { useServices } from '@/lib/ServiceContext';
import styles from '../admin.module.css'; // Use same styles or module
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRouter } from 'next/navigation';

export default function OrderHistoryPage() {
    const { isAdmin } = useServices();
    const [orders, setOrders] = useState<Record<string, any>[]>([]);
    // const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        if (!isAdmin) {
            // If not admin, maybe redirect? For now, we just rely on the fact that the link is hidden.
            // But for security:
            router.push('/admin');
        } else {
            fetchOrders();
        }
    }, [isAdmin]);

    const fetchOrders = async () => {
        // setLoading(true);
        try {
            const response = await fetch('/api/admin/orders');
            if (!response.ok) throw new Error('Failed to fetch orders');
            const data = await response.json();
            setOrders(data);
        } catch (error) {
            console.error('Error fetching orders:', error);
        }
        // setLoading(false);
    };

    if (!isAdmin) return null;

    const memberOrders = orders.filter(o => !o.is_guest);
    const guestOrders = orders.filter(o => o.is_guest);

    return (
        <main className={styles.main}>
            <header className={`${styles.header} glass`}>
                <div className="container">
                    <h1 className={styles.title}>주문 내역 관리</h1>
                </div>
            </header>

            <div className={`${styles.content} container`}>
                <section className={styles.orderSection}>
                    <Tabs defaultValue="member" className="w-full">
                        <TabsList className="mb-4">
                            <TabsTrigger value="member">회원 주문 ({memberOrders.length})</TabsTrigger>
                            <TabsTrigger value="guest">비회원 주문 ({guestOrders.length})</TabsTrigger>
                        </TabsList>

                        <TabsContent value="member">
                            <div className={styles.tableWrapper}>
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            <th>날짜/주문번호</th>
                                            <th>고객명 (ID)</th>
                                            <th>연락처/이메일</th>
                                            <th>서비스</th>
                                            <th>금액</th>
                                            <th>상태</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {memberOrders.map(o => (
                                            <tr key={o.id}>
                                                <td>
                                                    <div className="text-sm">{new Date(o.created_at).toLocaleDateString()}</div>
                                                    <div className="text-xs text-gray-500">{o.order_number}</div>
                                                </td>
                                                <td>
                                                    <div className="font-medium">{o.profiles?.name || o.buyer_name || 'Unknown'}</div>
                                                    <div className="text-xs text-gray-400">{o.profiles?.email || o.buyer_email || '-'}</div>
                                                </td>
                                                <td>
                                                    <div className="text-sm">{o.profiles?.phone || o.buyer_phone || '-'}</div>
                                                    <div className="text-xs text-gray-400">{o.profiles?.email || o.buyer_email || '-'}</div>
                                                </td>
                                                <td>{o.products?.name || 'Product'}</td>
                                                <td>₩{o.amount?.toLocaleString()}</td>
                                                <td>
                                                    <span className={`px-2 py-1 rounded text-xs ${o.payment_status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                        {o.payment_status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </TabsContent>

                        <TabsContent value="guest">
                            <div className={styles.tableWrapper}>
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            <th>날짜/주문번호</th>
                                            <th>구매자 (입금자)</th>
                                            <th>연락처/이메일</th>
                                            <th>서비스</th>
                                            <th>금액</th>
                                            <th>상태</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {guestOrders.map(o => (
                                            <tr key={o.id}>
                                                <td>
                                                    <div className="text-sm">{new Date(o.created_at).toLocaleDateString()}</div>
                                                    <div className="text-xs text-gray-500">{o.order_number}</div>
                                                </td>
                                                <td>
                                                    <div className="font-medium">{o.buyer_name}</div>
                                                    {o.depositor_name && o.depositor_name !== o.buyer_name && (
                                                        <div className="text-xs text-gray-400">입금자: {o.depositor_name}</div>
                                                    )}
                                                </td>
                                                <td>
                                                    <div className="text-sm">{o.buyer_phone}</div>
                                                    <div className="text-xs text-gray-400">{o.buyer_email}</div>
                                                </td>
                                                <td>{o.products?.name}</td>
                                                <td>₩{o.amount?.toLocaleString()}</td>
                                                <td>
                                                    <span className={`px-2 py-1 rounded text-xs ${o.payment_status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                        {o.payment_status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </TabsContent>
                    </Tabs>
                </section>
            </div>
        </main>
    );
}
