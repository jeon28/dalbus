"use client";

import React, { useEffect, useState } from 'react';
import { useServices } from '@/lib/ServiceContext';
import { supabase } from '@/lib/supabase';
import styles from './admin.module.css';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function AdminPage() {
    const { services, updatePrice, isAdmin, loginAdmin, logoutAdmin } = useServices();

    // Auth Form State
    const [loginId, setLoginId] = useState('');
    const [loginPw, setLoginPw] = useState('');

    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (loginId === 'dalbus' && loginPw === '1q2w3e4r5t!!') {
            loginAdmin();
        } else {
            alert('아이디 또는 비밀번호가 올바르지 않습니다.');
        }
    };

    const fetchStats = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/admin/orders');
            if (!response.ok) throw new Error('Failed to fetch orders');
            const data = await response.json();
            setOrders(data);
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
        setLoading(false);
    };

    useEffect(() => {
        if (isAdmin) {
            fetchStats();
        }
    }, [isAdmin]);

    if (!isAdmin) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100">
                <Card className="w-[350px] shadow-xl">
                    <CardHeader>
                        <CardTitle className="text-center">관리자 로그인</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleLogin} className="space-y-4">
                            <Input
                                placeholder="아이디"
                                value={loginId}
                                onChange={(e) => setLoginId(e.target.value)}
                            />
                            <Input
                                type="password"
                                placeholder="비밀번호"
                                value={loginPw}
                                onChange={(e) => setLoginPw(e.target.value)}
                            />
                            <Button type="submit" className="w-full bg-black hover:bg-gray-800 text-white">
                                로그인
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <main className={styles.main}>
            <header className={`${styles.header} glass`}>
                <div className="container flex justify-between items-center">
                    <h1 className={styles.title}>관리자 대시보드</h1>
                    <Button variant="outline" size="sm" onClick={logoutAdmin}>로그아웃</Button>
                </div>
            </header>

            <div className={`${styles.content} container`}>
                <section className={styles.stats}>
                    <div className={`${styles.statCard} glass`}>
                        <span>신규 주문</span>
                        <strong>{orders.filter(o => o.assignment_status === 'waiting').length}</strong>
                    </div>
                    <div className={`${styles.statCard} glass`}>
                        <span>오늘의 매출</span>
                        <strong>₩{orders.reduce((acc, curr) => {
                            const isToday = new Date(curr.created_at).toDateString() === new Date().toDateString();
                            return acc + (isToday && (curr.payment_status === 'paid' || curr.payment_status === 'pending') ? curr.amount : 0);
                        }, 0).toLocaleString()}</strong>
                    </div>
                    <div className={`${styles.statCard} glass`}>
                        <span>누적 매출</span>
                        <strong>₩{orders.reduce((acc, curr) => acc + (curr.payment_status === 'paid' ? curr.amount : 0), 0).toLocaleString()}</strong>
                    </div>
                </section>

                <div className="mb-8">
                    <p className="text-gray-500">
                        * 주문 내역 확인은 상단 메뉴의 <strong>[주문내역]</strong> 페이지를 이용해주세요.
                    </p>
                </div>

                <section className={styles.priceSection}>
                    <h3>서비스 가격 설정</h3>
                    <div className={`${styles.priceGrid} glass`}>
                        {services.map(s => (
                            <div key={s.id} className={styles.priceItem}>
                                <label>{s.name}</label>
                                <div className={styles.inputWrapper}>
                                    <input
                                        type="text"
                                        value={s.price}
                                        onChange={(e) => updatePrice(s.id, e.target.value)}
                                    />
                                    <span>원</span>
                                </div>
                            </div>
                        ))}
                        <button className={styles.saveBtn} onClick={() => alert('가격 설정은 실시간 반영됩니다.')}>
                            설정 확인
                        </button>
                    </div>
                </section>

                <section className={styles.accountSection}>
                    <h3>공유 계정 관리 (ID/PW 입력)</h3>
                    <div className={`${styles.inputGroup} glass`}>
                        <input type="text" placeholder="서비스 선택 (Tidal...)" />
                        <input type="text" placeholder="계정 아이디" />
                        <input type="password" placeholder="비밀번호" />
                        <button className={styles.saveBtn}>정보 업데이트</button>
                    </div>
                </section>
            </div>
        </main>
    );
}
