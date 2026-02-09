/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useServices } from '@/lib/ServiceContext';
import { supabase } from '@/lib/supabase';
import styles from './mypage.module.css';

interface UserSubscription {
    service_name: string;
    duration: string;
    end_date: string;
    account_id: string;
    account_pw: string;
    status: string;
}

export default function MyPage() {
    const { user, logout, isHydrated } = useServices();
    const [subscriptions, setSubscriptions] = useState<UserSubscription[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    const fetchUserSubscriptions = useCallback(async () => {
        if (!user) return;
        setLoading(true);

        // Fetch orders and related data using v2 schema
        const { data, error } = await supabase
            .from('orders')
            .select(`
                assignment_status,
                products(name),
                product_plans(duration_months),
                order_number
            `)
            .eq('user_id', user?.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching subscriptions:', error);
        } else if (data) {
            const mapped: UserSubscription[] = data.map((item: any) => {
                const duration = item.product_plans?.duration_months || 0;
                return {
                    service_name: item.products?.name || 'Service',
                    duration: duration > 0 ? `${duration}개월` : '-',
                    end_date: item.end_date || '-', // end_date is on order in v2
                    account_id: '계정 정보 확인 중', // In a full impl, we'd join order_accounts -> accounts
                    account_pw: '계정 정보 확인 중',
                    status: item.assignment_status
                };
            });
            setSubscriptions(mapped);
        }
        setLoading(false);
    }, [user]);

    useEffect(() => {
        if (isHydrated && user) {
            fetchUserSubscriptions();
        } else if (isHydrated && !user) {
            setLoading(false);
        }
    }, [isHydrated, user, fetchUserSubscriptions]);

    if (!isHydrated || loading) return <div className="container" style={{ color: 'white', padding: '100px', textAlign: 'center' }}>Loading...</div>;

    if (!user) {
        return (
            <main className={styles.main}>
                <header className={`${styles.header} glass`}>
                    <div className="container">
                        <h1 className={styles.title}>내 구독 정보</h1>
                    </div>
                </header>
                <div className="container" style={{ textAlign: 'center', paddingTop: '100px' }}>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>로그인이 필요한 페이지입니다.</p>
                    <button
                        className={styles.actionBtn}
                        style={{ padding: '12px 24px', background: 'var(--primary)', color: 'white', borderRadius: '12px' }}
                        onClick={() => router.push('/login')}
                    >
                        로그인하러 가기
                    </button>
                </div>
            </main>
        );
    }

    return (
        <main className={styles.main}>
            <header className={`${styles.header} glass`}>
                <div className="container">
                    <h1 className={styles.title}>내 구독 정보</h1>
                </div>
            </header>

            <div className={`${styles.content} container`}>
                <section className={styles.section}>
                    <h3>이용 중인 서비스</h3>

                    {subscriptions.length > 0 ? (
                        subscriptions.map((sub, idx) => (
                            <div key={idx} className={`${styles.activeCard} glass animate-fade-in`} style={{ marginBottom: '20px' }}>
                                <div className={styles.cardTop}>
                                    <span className={styles.serviceIcon}>🎧</span>
                                    <div className={styles.serviceInfo}>
                                        <h4>{sub.service_name} ({sub.duration})</h4>
                                        <p>{sub.end_date} 까지</p>
                                    </div>
                                    <span className={styles.statusBadge}>{sub.status}</span>
                                </div>

                                <div className={styles.credentials}>
                                    <div className={styles.credItem}>
                                        <span>아이디</span>
                                        <strong>{sub.account_id}</strong>
                                    </div>
                                    <div className={styles.credItem}>
                                        <span>비밀번호</span>
                                        <strong>{sub.account_pw}</strong>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className={`${styles.activeCard} glass`} style={{ textAlign: 'center', padding: '40px' }}>
                            <p style={{ color: 'var(--text-muted)' }}>이용 중인 구독이 없습니다.</p>
                            <Link href="/" className={styles.actionBtn} style={{ marginTop: '20px', display: 'inline-block', color: 'var(--primary)' }}>
                                서비스 둘러보기
                            </Link>
                        </div>
                    )}
                </section>

                <section className={styles.section}>
                    <h3>내 정보 관리</h3>
                    <div className={`${styles.menuList} glass`}>
                        <div className={styles.menuItem}>결제 내역 확인<span>›</span></div>
                        <div className={styles.menuItem}>알림 설정<span>›</span></div>
                        <div className={styles.menuItem}>고객 센터<span>›</span></div>
                        <div className={styles.menuItem} onClick={() => { logout(); router.push('/'); }}>로그아웃<span>›</span></div>
                    </div>
                </section>
            </div>

            <nav className={`${styles.bottomNav} glass`}>
                <Link href="/" className={styles.navItem}>🏠</Link>
                <Link href="/mypage" className={styles.navItem}>👤</Link>
            </nav>
        </main>
    );
}
