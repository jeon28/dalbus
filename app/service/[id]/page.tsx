"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useServices } from '@/lib/ServiceContext';
import { supabase } from '@/lib/supabase';
import styles from './service.module.css';

export default function ServiceDetail({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = React.use(params);
    const serviceId = resolvedParams.id;
    const { services, user } = useServices();
    const service = services.find(s => s.id === serviceId);

    const [agreed, setAgreed] = useState(false);
    const [loading, setLoading] = useState(false);
    const [selectedPeriod, setSelectedPeriod] = useState<1 | 3>(1);
    const router = useRouter();

    const handleSubscribe = async () => {
        if (!user) {
            alert('로그인이 필요한 서비스입니다.');
            router.push('/login');
            return;
        }

        if (!service) {
            alert('서비스 정보를 찾을 수 없습니다.');
            return;
        }

        setLoading(true);

        // Calculate amount
        const basePrice = parseInt(service.price.replace(/,/g, ''));
        const amount = selectedPeriod === 3
            ? Math.floor(basePrice * 3 * 0.95)
            : basePrice;

        // Insert order into Supabase
        const { error } = await supabase
            .from('orders')
            .insert([
                {
                    user_id: user.id,
                    service_id: service.id,
                    duration_months: selectedPeriod,
                    amount: amount,
                    payment_status: '완료', // Mocking successful payment
                    work_status: '접수'
                }
            ]);

        if (error) {
            console.error('Error creating order:', error);
            alert('주문 생성에 실패했습니다: ' + error.message);
            setLoading(false);
        } else {
            // Simulate short delay for "payment processing"
            setTimeout(() => {
                router.push('/mypage');
            }, 1000);
        }
    };

    return (
        <main className={styles.main}>
            <header className={`${styles.header} glass`}>
                <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', width: '100%' }}>
                    <button className={styles.backBtn} onClick={() => router.back()} style={{ position: 'absolute', left: '0', top: '50%', transform: 'translateY(-50%)' }}>←</button>
                    <div className={styles.headerBrand}>
                        <img src="/tidal-logo.svg" alt="Tidal" className={styles.detailLogo} />
                        <h1 className={styles.title}>{service?.name.toUpperCase() || serviceId?.toUpperCase()}</h1>
                    </div>
                </div>
            </header>

            <div className={`${styles.content} container`}>
                <div className={`${styles.infoCard} glass animate-fade-in`}>
                    <div className={styles.priceRow}>
                        <span>월 이용료</span>
                        <span className={styles.price}>{service?.price || '4,900'}원</span>
                    </div>
                    <p className={styles.description}>
                        매칭 완료 시 즉시 이용 가능한 계정 정보를 공유해 드립니다.
                    </p>
                </div>

                <section className={styles.options}>
                    <h3>이용 기간 선택</h3>
                    <div className={styles.optionList}>
                        <div
                            className={`${styles.optionItem} ${selectedPeriod === 1 ? styles.active : ''} glass`}
                            onClick={() => setSelectedPeriod(1)}
                            style={{ cursor: 'pointer' }}
                        >
                            <span>1개월</span>
                            <span>{service?.price || '4,900'}원</span>
                        </div>
                        <div
                            className={`${styles.optionItem} ${selectedPeriod === 3 ? styles.active : ''} glass`}
                            onClick={() => setSelectedPeriod(3)}
                            style={{ cursor: 'pointer' }}
                        >
                            <span>3개월 (5% 할인)</span>
                            <span>{Math.floor(parseInt(service?.price.replace(/,/g, '') || '4900') * 3 * 0.95).toLocaleString()}원</span>
                        </div>
                    </div>
                </section>

                <section className={styles.agreements}>
                    <label className={styles.checkbox}>
                        <input
                            type="checkbox"
                            checked={agreed}
                            onChange={(e) => setAgreed(e.target.checked)}
                        /> 이용약관 및 개인정보 처리방침 동의
                    </label>
                </section>

                <button
                    className={styles.submitBtn}
                    disabled={!agreed || loading}
                    onClick={handleSubscribe}
                >
                    {loading ? '결제 처리 중...' : '결제하고 구독 시작하기'}
                </button>
            </div>
        </main>
    );
}
