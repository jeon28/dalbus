"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useServices } from '@/lib/ServiceContext';
import { supabase } from '@/lib/supabase';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import styles from './mypage.module.css';

interface UserSubscription {
    service_name: string;
    duration: string;
    end_date: string;
    account_id: string;
    account_pw: string;
    status: string;
}

interface OrderHistoryItem {
    id: string;
    order_number: string;
    product_name: string;
    plan_name: string;
    amount: number;
    created_at: string;
    assignment_status: string;
}

interface SupabaseOrder {
    id: string;
    order_number: string;
    amount: number;
    created_at: string;
    assignment_status: string;
    products: { name: string } | null;
    product_plans: { duration_months: number } | null;
}

interface SupabaseAccountAssignment {
    id: string;
    account_id: string;
    account_pw?: string;
    end_date: string | null;
    orders: {
        products: {
            name: string;
        } | null;
    } | null;
}

export default function MyPage() {
    const { user, logout, isHydrated, refreshUser } = useServices();
    const [subscriptions, setSubscriptions] = useState<UserSubscription[]>([]);
    const [orders, setOrders] = useState<OrderHistoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const router = useRouter();

    // Profile form state
    const [profileForm, setProfileForm] = useState({
        name: '',
        phone: '',
        email: ''
    });

    useEffect(() => {
        if (user) {
            setProfileForm({
                name: user.name || '',
                phone: user.phone || '',
                email: user.email || ''
            });
        }
    }, [user]);

    const fetchData = useCallback(async () => {
        if (!user) return;
        setLoading(true);

        try {
            // Fetch all orders for history
            const { data: orderData, error: orderError } = await supabase
                .from('orders')
                .select(`
                    id,
                    order_number,
                    amount,
                    created_at,
                    assignment_status,
                    products(name),
                    product_plans(duration_months)
                `)
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (orderError) throw orderError;

            if (orderData) {
                const typedOrders = orderData as unknown as SupabaseOrder[];
                const history: OrderHistoryItem[] = typedOrders.map(item => ({
                    id: item.id,
                    order_number: item.order_number,
                    product_name: item.products?.name || 'Service',
                    plan_name: item.product_plans?.duration_months ? `${item.product_plans.duration_months}개월` : '-',
                    amount: item.amount,
                    created_at: new Date(item.created_at).toLocaleDateString(),
                    assignment_status: item.assignment_status
                }));
                setOrders(history);

                // Derive active subscriptions from completed assignments
                const activeSubs: UserSubscription[] = typedOrders
                    .filter(item => item.assignment_status === 'completed')
                    .map(item => ({
                        service_name: item.products?.name || 'Service',
                        duration: item.product_plans?.duration_months ? `${item.product_plans.duration_months}개월` : '-',
                        end_date: '-',
                        account_id: '정보 확인 중',
                        account_pw: '정보 확인 중',
                        status: '이용 중'
                    }));

                // Get account info if possible
                const { data: accountData } = await supabase
                    .from('order_accounts')
                    .select('*, orders(products(name))')
                    .in('order_id', typedOrders.map(o => o.id));

                if (accountData && accountData.length > 0) {
                    const typedAccounts = accountData as unknown as SupabaseAccountAssignment[];
                    const enrichedSubs: UserSubscription[] = typedAccounts.map(acc => ({
                        service_name: acc.orders?.products?.name || 'Service',
                        duration: '-',
                        end_date: acc.end_date || '-',
                        account_id: acc.account_id || '정보 없음',
                        account_pw: acc.account_pw || '정보 없음',
                        status: '이용 중'
                    }));
                    setSubscriptions(enrichedSubs);
                } else {
                    setSubscriptions(activeSubs);
                }
            }
        } catch (error) {
            console.error('Error fetching MyPage data:', error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (isHydrated && user) {
            fetchData();
        } else if (isHydrated && !user) {
            setLoading(false);
        }
    }, [isHydrated, user, fetchData]);

    const handleUpdateProfile = async () => {
        if (!user) return;
        setUpdating(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    name: profileForm.name,
                    phone: profileForm.phone,
                    email: profileForm.email
                })
                .eq('id', user.id);

            if (error) throw error;
            await refreshUser();
            alert('개인정보가 수정되었습니다.');
        } catch (error) {
            console.error('Profile update error:', error);
            alert('수정 중 오류가 발생했습니다.');
        } finally {
            setUpdating(false);
        }
    };

    if (!isHydrated || loading) return <div className="container py-20 text-center">Loading...</div>;

    if (!user) {
        return (
            <div className="container py-20 text-center">
                <p className="text-muted-foreground mb-4">로그인이 필요한 페이지입니다.</p>
                <Button onClick={() => router.push('/login')}>로그인하러 가기</Button>
            </div>
        );
    }

    return (
        <main className={styles.main}>
            <header className={`${styles.header} glass`}>
                <div className="container">
                    <h1 className={styles.title}>마이페이지</h1>
                </div>
            </header>

            <div className={`${styles.content} container max-w-4xl mx-auto py-10 px-4 space-y-12`}>

                {/* 1. 개인정보 변경 */}
                <section className={`${styles.section} glass p-8 rounded-2xl shadow-sm`}>
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                        👤 개인정보 변경
                    </h3>
                    <div className="space-y-4 max-w-md">
                        <div className="space-y-2">
                            <Label htmlFor="name">이름</Label>
                            <Input
                                id="name"
                                value={profileForm.name}
                                onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phone">연락처</Label>
                            <Input
                                id="phone"
                                type="tel"
                                value={profileForm.phone}
                                onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">이메일</Label>
                            <Input
                                id="email"
                                type="email"
                                value={profileForm.email}
                                onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                            />
                        </div>
                        <Button
                            className="w-full mt-4"
                            onClick={handleUpdateProfile}
                            disabled={updating}
                        >
                            {updating ? '저장 중...' : '정보 수정하기'}
                        </Button>
                    </div>
                </section>

                {/* 2. 내 구독 정보 */}
                <section className={`${styles.section} glass p-8 rounded-2xl shadow-sm`}>
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                        🎧 내 구독 정보
                    </h3>
                    {subscriptions.length > 0 ? (
                        <div className="grid gap-4 sm:grid-cols-2">
                            {subscriptions.map((sub, idx) => (
                                <div key={idx} className="bg-primary/5 border border-primary/10 p-5 rounded-xl space-y-3">
                                    <div className="flex justify-between items-start">
                                        <h4 className="font-bold text-lg">{sub.service_name}</h4>
                                        <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-bold">이용 중</span>
                                    </div>
                                    <div className="text-sm space-y-1 text-muted-foreground">
                                        <p>기간: {sub.duration}</p>
                                        <p>만료일: {sub.end_date}</p>
                                    </div>
                                    <div className="bg-white/50 p-3 rounded-lg text-sm font-mono space-y-1 border border-white/20">
                                        <div className="flex justify-between">
                                            <span className="text-xs text-muted-foreground">ID:</span>
                                            <span className="font-bold">{sub.account_id}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-xs text-muted-foreground">PW:</span>
                                            <span className="font-bold">{sub.account_pw}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-10 bg-gray-50/50 rounded-xl border border-dashed">
                            <p className="text-muted-foreground">이용 중인 구독이 없습니다.</p>
                        </div>
                    )}
                </section>

                {/* 3. 내 주문 이력 */}
                <section className={`${styles.section} glass p-8 rounded-2xl shadow-sm`}>
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                        📄 내 주문 이력
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-muted-foreground uppercase border-b">
                                <tr>
                                    <th className="py-3 px-4">주문번호</th>
                                    <th className="py-3 px-4">상품명</th>
                                    <th className="py-3 px-4">금액</th>
                                    <th className="py-3 px-4">주문일</th>
                                    <th className="py-3 px-4">상태</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orders.map((order) => (
                                    <tr key={order.id} className="border-b hover:bg-gray-50/50 transition-colors">
                                        <td className="py-4 px-4 font-mono text-xs">{order.order_number}</td>
                                        <td className="py-4 px-4 font-medium">{order.product_name} ({order.plan_name})</td>
                                        <td className="py-4 px-4 font-bold">{order.amount.toLocaleString()}원</td>
                                        <td className="py-4 px-4 text-muted-foreground">{order.created_at}</td>
                                        <td className="py-4 px-4">
                                            <span className={`px-2 py-1 rounded text-[10px] font-bold ${order.assignment_status === 'completed' || order.assignment_status === 'assigned' ? 'bg-green-100 text-green-700' :
                                                order.assignment_status === 'waiting' ? 'bg-blue-100 text-blue-700' :
                                                    'bg-gray-100 text-gray-700'
                                                }`}>
                                                {order.assignment_status === 'completed' ? '완료' :
                                                    order.assignment_status === 'assigned' ? '완료' :
                                                        order.assignment_status === 'waiting' ? '대기' :
                                                            order.assignment_status === 'pending' ? '입금대기' : order.assignment_status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {orders.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="py-10 text-center text-muted-foreground">주문 내역이 없습니다.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>

                <div className="text-center pt-10">
                    <Button variant="outline" className="text-red-500 border-red-200 hover:bg-red-50" onClick={logout}>로그아웃</Button>
                </div>
            </div>
        </main>
    );
}
