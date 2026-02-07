"use client";

import React, { useEffect, useState } from 'react';
import { useServices } from '@/lib/ServiceContext';
import { supabase } from '@/lib/supabase';
import styles from './admin.module.css';

export default function AdminPage() {
    const { services, updatePrice } = useServices();
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchOrders = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('orders')
            .select(`
                id,
                payment_status,
                assignment_status,
                created_at,
                profiles(name),
                products(name)
            `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching orders:', JSON.stringify(error, null, 2));
        } else if (data) {
            setOrders(data);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchOrders();
    }, []);

    return (
        <main className={styles.main}>
            <header className={`${styles.header} glass`}>
                <div className="container">
                    <h1 className={styles.title}>관리자 대시보드</h1>
                </div>
            </header>

            <div className={`${styles.content} container`}>
                <section className={styles.stats}>
                    <div className={`${styles.statCard} glass`}>
                        <span>신규 주문</span>
                        <strong>{orders.filter(o => o.assignment_status === 'waiting').length}</strong>
                    </div>
                    <div className={`${styles.statCard} glass`}>
                        <span>매칭 완료</span>
                        <strong>{orders.filter(o => o.assignment_status === 'assigned').length}</strong>
                    </div>
                    <div className={`${styles.statCard} glass`}>
                        <span>누적 매출</span>
                        <strong>₩{orders.reduce((acc, curr) => acc + (curr.payment_status === 'paid' ? curr.amount : 0), 0).toLocaleString()}</strong>
                    </div>
                </section>

                <section className={styles.orderSection}>
                    <h3>최근 주문 내역</h3>
                    <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>날짜</th>
                                    <th>고객명</th>
                                    <th>서비스</th>
                                    <th>상태</th>
                                    <th>작업</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orders.map(o => (
                                    <tr key={o.id}>
                                        <td>{new Date(o.created_at).toLocaleDateString()}</td>
                                        <td>{o.profiles?.name || 'Unknown'}</td>
                                        <td>{o.products?.name || 'Product'}</td>
                                        <td><span className={styles.status}>{o.payment_status}</span></td>
                                        <td><button className={styles.actionBtn}>{o.assignment_status}</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

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
