"use client";

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useServices } from '@/lib/ServiceContext';
import { supabase } from '@/lib/supabase';
import { apiFetch } from '@/lib/api';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import styles from './mypage.module.css';

interface UserSubscription {
    service_name: string;
    duration: string;
    start_date: string;
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
    tidal_id?: string;
    tidal_password?: string;
    account_pw?: string;
    start_date: string | null;
    end_date: string | null;
    orders: {
        products: {
            name: string;
        } | null;
        product_plans: {
            duration_months: number;
        } | null;
    } | null;
}

export default function MyPage() {
    const { user, logout, isHydrated, refreshUser } = useServices();
    const [subscriptions, setSubscriptions] = useState<UserSubscription[]>([]);
    const [orders, setOrders] = useState<OrderHistoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const fetchingRef = useRef(false);
    const router = useRouter();

    const isMounted = useRef(true);
    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
        };
    }, []);

    // Profile form state
    const [profileForm, setProfileForm] = useState({
        name: '',
        phone: '',
        email: '',
        birth_date: ''
    });

    useEffect(() => {
        if (user) {
            setProfileForm({
                name: user.name || '',
                phone: user.phone || '',
                email: user.email || '',
                birth_date: user.birth_date || ''
            });
        }
    }, [user]);

    const lastFetchTimeRef = useRef(0);

    const fetchData = useCallback(async () => {
        // Double check user existence and fetching state
        if (!user?.id || fetchingRef.current) return;

        // Rate limit: don't fetch more than once every 5 seconds
        const now = Date.now();
        if (now - lastFetchTimeRef.current < 5000) {
            console.log('MyPage: Fetch debounced to prevent loop');
            return;
        }

        lastFetchTimeRef.current = now;
        fetchingRef.current = true;
        setLoading(true);

        try {
            console.log('MyPage: Starting data fetch for user:', user.id);

            const res = await apiFetch('/api/user/mypage', {
                cache: 'no-store'
            });

            if (!isMounted.current) return;

            if (res.ok) {
                const data = await res.json();
                const { orders: orderData, assignments: accountData } = data as {
                    orders: SupabaseOrder[],
                    assignments: SupabaseAccountAssignment[]
                };

                if (orderData) {
                    const history: OrderHistoryItem[] = orderData.map(item => ({
                        id: item.id,
                        order_number: item.order_number,
                        product_name: item.products?.name || 'Service',
                        plan_name: item.product_plans?.duration_months ? `${item.product_plans.duration_months}개월` : '-',
                        amount: item.amount,
                        created_at: new Date(item.created_at).toLocaleDateString(),
                        assignment_status: item.assignment_status
                    }));
                    setOrders(history);

                    const activeSubs: UserSubscription[] = orderData
                        .filter(item => item.assignment_status === 'completed')
                        .map(item => ({
                            service_name: item.products?.name || 'Service',
                            duration: item.product_plans?.duration_months ? `${item.product_plans.duration_months}개월` : '-',
                            start_date: '-',
                            end_date: '-',
                            account_id: '정보 확인 중',
                            account_pw: '정보 확인 중',
                            status: '이용 중'
                        }));

                    if (accountData && accountData.length > 0) {
                        const enrichedSubs: UserSubscription[] = accountData.map(acc => ({
                            service_name: acc.orders?.products?.name || 'Service',
                            duration: acc.orders?.product_plans?.duration_months ? `${acc.orders.product_plans.duration_months}개월` : '-',
                            start_date: acc.start_date || '-',
                            end_date: acc.end_date || '-',
                            account_id: acc.tidal_id || acc.account_id || '정보 없음',
                            account_pw: acc.tidal_password || acc.account_pw || '정보 없음',
                            status: '이용 중'
                        }));
                        setSubscriptions(enrichedSubs);
                    } else {
                        setSubscriptions(activeSubs);
                    }
                }
            } else {
                console.error('MyPage API error:', res.status);
            }
        } catch (error) {
            console.error('Error fetching MyPage data:', error);
        } finally {
            if (isMounted.current) {
                setLoading(false);
                // Reset fetchingRef after a delay to allow for legitimate updates
                setTimeout(() => {
                    if (isMounted.current) fetchingRef.current = false;
                }, 1000);
            }
        }
    }, [user?.id]); // Only depend on stable user ID

    useEffect(() => {
        if (isHydrated && user?.id) {
            fetchData();
        } else if (isHydrated && !user) {
            setLoading(false);
        }
    }, [isHydrated, user, user?.id, fetchData]); // Only depend on user.id to avoid reference-related loops

    const [isEditing, setIsEditing] = useState(false);

    const handleUpdateProfile = async () => {
        if (!user) return;
        setUpdating(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    name: profileForm.name,
                    phone: profileForm.phone,
                    email: profileForm.email,
                    birth_date: profileForm.birth_date
                })
                .eq('id', user.id);

            if (error) throw error;
            await refreshUser();
            setIsEditing(false);
            alert('개인정보가 수정되었습니다.');
        } catch (error) {
            console.error('Profile update error:', error);
            alert('수정 중 오류가 발생했습니다.');
        } finally {
            setUpdating(false);
        }
    };

    const handleCancelEdit = () => {
        if (user) {
            setProfileForm({
                name: user.name || '',
                phone: user.phone || '',
                email: user.email || '',
                birth_date: user.birth_date || ''
            });
        }
        setIsEditing(false);
    };

    useEffect(() => {
        if (isHydrated && !user) {
            console.warn('Unauthorized access to MyPage. Redirecting to login...');
            router.replace('/login');
        }
    }, [isHydrated, user, router]);

    if (!isHydrated || loading) return <div className="container py-20 text-center">Loading...</div>;

    if (!user) return null;

    return (
        <main className={styles.main}>
            <header className={`${styles.header} glass`}>
                <div className="container">
                    <h1 className={styles.title}>마이페이지</h1>
                </div>
            </header>

            <div className={`${styles.content} container max-w-4xl mx-auto py-10 px-4 space-y-12`}>

                {/* 1. 개인정보 */}
                <section className={`${styles.section} glass p-8 rounded-2xl shadow-sm`}>
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold flex items-center gap-2">
                            👤 개인정보
                        </h3>
                        {!isEditing && (
                            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                                정보 수정하기
                            </Button>
                        )}
                    </div>

                    {!isEditing ? (
                        <div className="grid gap-6 sm:grid-cols-2 max-w-2xl">
                            <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">이름</p>
                                <p className="font-medium text-lg">{profileForm.name}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">생년월일</p>
                                <p className="font-medium text-lg">{profileForm.birth_date || '-'}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">연락처</p>
                                <p className="font-medium text-lg">{profileForm.phone || '-'}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">이메일</p>
                                <p className="font-medium text-lg">{profileForm.email}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4 max-w-md">
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <Label htmlFor="name">이름</Label>
                                    <span className="text-[10px] text-muted-foreground">변경 불가 (관리자 문의)</span>
                                </div>
                                <Input
                                    id="name"
                                    value={profileForm.name}
                                    readOnly
                                    className="bg-muted/30 cursor-not-allowed"
                                />
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <Label htmlFor="birth_date">생년월일</Label>
                                    <span className="text-[10px] text-muted-foreground">변경 불가 (관리자 문의)</span>
                                </div>
                                <Input
                                    id="birth_date"
                                    placeholder="YYYY.MM.DD"
                                    value={profileForm.birth_date}
                                    readOnly
                                    className="bg-muted/30 cursor-not-allowed"
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
                            <div className="flex gap-2 pt-2">
                                <Button
                                    className="flex-1"
                                    onClick={handleUpdateProfile}
                                    disabled={updating}
                                >
                                    {updating ? '저장 중...' : '저장'}
                                </Button>
                                <Button
                                    className="flex-1"
                                    variant="outline"
                                    onClick={handleCancelEdit}
                                    disabled={updating}
                                >
                                    취소
                                </Button>
                            </div>
                        </div>
                    )}
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
                                        <p>기간: {sub.start_date} ~ {sub.end_date} ({sub.duration})</p>
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
