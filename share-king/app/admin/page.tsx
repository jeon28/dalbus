"use client";

import React, { useState } from 'react';
import { useServices } from '@/lib/ServiceContext';
import styles from './admin.module.css';

export default function AdminPage() {
    const { services, updatePrice } = useServices();
    const [orders] = useState([
        { id: 'ORD001', user: '홍길동', service: 'Tidal', status: '입금확인', date: '2026.01.31' },
        { id: 'ORD002', user: '김철수', service: 'Netflix', status: '작업중', date: '2026.01.31' },
        { id: 'ORD003', user: '이영희', service: 'Tidal', status: '완료', date: '2026.01.30' },
    ]);

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
                        <strong>12</strong>
                    </div>
                    <div className={`${styles.statCard} glass`}>
                        <span>매칭 대기</span>
                        <strong>5</strong>
                    </div>
                    <div className={`${styles.statCard} glass`}>
                        <span>누적 매출</span>
                        <strong>₩124,000</strong>
                    </div>
                </section>

                <section className={styles.orderSection}>
                    <h3>최근 주문 내역</h3>
                    <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>주문번호</th>
                                    <th>고객명</th>
                                    <th>서비스</th>
                                    <th>상태</th>
                                    <th>작업</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orders.map(o => (
                                    <tr key={o.id}>
                                        <td>{o.id}</td>
                                        <td>{o.user}</td>
                                        <td>{o.service}</td>
                                        <td><span className={styles.status}>{o.status}</span></td>
                                        <td><button className={styles.actionBtn}>매칭</button></td>
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
                        <button className={styles.saveBtn} onClick={() => alert('가격 설정이 저장되었습니다.')}>
                            설정 저장하기
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
