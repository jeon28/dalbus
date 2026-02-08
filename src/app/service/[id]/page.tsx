/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useServices } from '@/lib/ServiceContext';
import { supabase } from '@/lib/supabase';
import styles from './service.module.css';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export default function ServiceDetail({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = React.use(params);
    const serviceId = resolvedParams.id;
    const { services, user } = useServices();
    /* We need to fetch the full product details including 'detail_content' which might not be in context */
    const [serviceDetail, setServiceDetail] = useState<Record<string, any> | null>(null);
    const [plans, setPlans] = useState<Record<string, any>[]>([]);

    useEffect(() => {
        const fetchDetail = async () => {
            if (!serviceId) return;

            // Fetch product
            const { data: productData } = await supabase
                .from('products')
                .select('*')
                .eq('id', serviceId)
                .single();

            if (productData) setServiceDetail(productData);

            // Fetch plans
            const { data: plansData } = await supabase
                .from('product_plans')
                .select('*')
                .eq('product_id', serviceId);

            if (plansData) setPlans(plansData);
        };
        fetchDetail();
    }, [serviceId]);

    // Fallback to context if detail fetch is pending or failed (though detail has more fields)
    const basicService = services.find(s => s.id === serviceId);
    const product = serviceDetail || (basicService ? { ...basicService, detail_content: null, original_price: parseInt(basicService.price.replace(/,/g, '')) } : null);

    const [loading, setLoading] = useState(false);
    const [selectedPeriod, setSelectedPeriod] = useState<1 | 3>(1);

    // Guest Form State
    const [guestInfo, setGuestInfo] = useState({
        name: '',
        phone: '',
        email: '',
        depositor: ''
    });
    const [agreements, setAgreements] = useState({
        all: false,
        privacy: false,
        terms: false
    });

    const router = useRouter();

    const toggleAllAgreements = (checked: boolean) => {
        setAgreements({ all: checked, privacy: checked, terms: checked });
    };

    const handleSubscribe = async () => {
        if (!product) return;

        // Validation for Guest
        if (!user) {
            if (!guestInfo.name || !guestInfo.phone || !guestInfo.email || !guestInfo.depositor) {
                alert('구매자 정보를 모두 입력해주세요.');
                return;
            }
            if (!agreements.privacy || !agreements.terms) {
                alert('필수 약관에 동의해주세요.');
                return;
            }
        }

        const selectedPlan = plans.find(p => p.duration_months === selectedPeriod);
        if (!selectedPlan) {
            alert('선택한 기간에 해당하는 요금제 정보를 찾을 수 없습니다.');
            return;
        }

        setLoading(true);

        const amount = selectedPlan.price; // Use price from plan table

        const orderData: Record<string, any> = {
            product_id: product.id,
            plan_id: selectedPlan.id,
            amount: amount,
            payment_status: 'pending', // Waiting for deposit
            assignment_status: 'waiting',
            is_guest: !user,
            buyer_name: user ? user.name : guestInfo.name,
            buyer_phone: user ? null : guestInfo.phone,
            buyer_email: user ? user.email : guestInfo.email,
            depositor_name: user ? user.name : guestInfo.depositor,
        };

        if (user) {
            orderData.user_id = user.id;
        }

        const { error } = await supabase.from('orders').insert([orderData]);

        if (error) {
            console.error('Error creating order:', error);
            alert('주문 생성 실패: ' + error.message);
            setLoading(false);
        } else {
            alert(user ? '구독 신청이 완료되었습니다.' : '주문이 접수되었습니다. 입금 확인 후 알림톡이 발송됩니다.');
            if (user) router.push('/mypage');
            else router.push('/'); // Redirect to home or a guest order status page
        }
    };

    if (!product) return <div className="container py-20 text-center">Loading...</div>;

    // Use plan prices for display if available, fallback to calculation
    const plan1 = plans.find(p => p.duration_months === 1);
    const plan3 = plans.find(p => p.duration_months === 3);

    const price1Month = plan1 ? plan1.price : product.original_price;
    const price3Month = plan3 ? plan3.price : Math.floor(product.original_price * 3 * 0.95);

    const calculatedPrice = selectedPeriod === 3
        ? price3Month.toLocaleString()
        : price1Month.toLocaleString();

    return (
        <main className={styles.main}>
            <header className={`${styles.header} glass`}>
                <div className="container relative flex flex-col items-center w-full">
                    <button className={styles.backBtn} onClick={() => router.back()} style={{ position: 'absolute', left: '0', top: '50%', transform: 'translateY(-50%)' }}>←</button>
                    <div className={styles.headerBrand}>
                        {product.image_url ? <img src={product.image_url} alt={product.name} className={styles.detailLogo} /> : <span className="text-4xl">🎧</span>}
                        <h1 className={styles.title}>{product.name}</h1>
                    </div>
                </div>
            </header>

            <div className={`${styles.content} container max-w-2xl mx-auto py-8`}>
                {/* Product Detail Content (TextArea) */}
                {product.detail_content && (
                    <div className="glass p-6 rounded-xl mb-8 animate-fade-in text-sm leading-relaxed whitespace-pre-line" dangerouslySetInnerHTML={{ __html: product.detail_content }} />
                )}

                <div className={`${styles.infoCard} glass animate-fade-in mb-8`}>
                    <div className={styles.priceRow}>
                        <span>결제금액</span>
                        <span className={styles.price}>{calculatedPrice}원</span>
                    </div>
                    <ul className="text-xs text-muted-foreground mt-4 space-y-1 list-disc pl-4">
                        <li>모든 구독 상품은 추후 기간연장하여 동일 계정으로 계속 사용할 수 있습니다.</li>
                        <li>만료 일주일 전 알림톡으로 연장 메세지를 보내드립니다.</li>
                        <li>상단 결제내역 메뉴에서 이용 정보 및 결제 내역 조회가 가능합니다.</li>
                        <li>디지털 상품 특성 상, 상품 인도 후 구매자의 단순 변심으로 인한 환불은 불가합니다.</li>
                    </ul>
                </div>

                {/* Period Selection */}
                <section className={styles.options}>
                    <h3 className="text-lg font-bold mb-3">이용 기간 선택</h3>
                    <div className={styles.optionList}>
                        <div
                            className={`${styles.optionItem} ${selectedPeriod === 1 ? styles.active : ''} glass`}
                            onClick={() => setSelectedPeriod(1)}
                        >
                            <span>1개월</span>
                            <span>{product.original_price.toLocaleString()}원</span>
                        </div>
                        <div
                            className={`${styles.optionItem} ${selectedPeriod === 3 ? styles.active : ''} glass`}
                            onClick={() => setSelectedPeriod(3)}
                        >
                            <span>3개월 (5% 할인)</span>
                            <span>{Math.floor(product.original_price * 3 * 0.95).toLocaleString()}원</span>
                        </div>
                    </div>
                </section>

                {/* Guest Checkout Form */}
                {!user && (
                    <div className="mt-8 space-y-6 animate-fade-in">
                        <h3 className="text-xl font-bold text-center">구매자 정보</h3>
                        <div className="space-y-4">
                            <Input
                                placeholder="성함을 입력해 주세요."
                                value={guestInfo.name}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGuestInfo({ ...guestInfo, name: e.target.value })}
                            />
                            <Input
                                type="tel"
                                placeholder="휴대폰번호를 입력해 주세요."
                                value={guestInfo.phone}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGuestInfo({ ...guestInfo, phone: e.target.value })}
                            />
                            <Input
                                type="email"
                                placeholder="이메일을 입력해 주세요."
                                value={guestInfo.email}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGuestInfo({ ...guestInfo, email: e.target.value })}
                            />
                            <p className="text-xs text-green-600 font-medium">* 정보가 틀릴 시 제품 전달에 문제가 생길 수 있으니 정확히 기입해주세요.</p>
                        </div>

                        <h3 className="text-xl font-bold text-center mt-8">결제 수단</h3>
                        <div className="glass p-4 rounded-xl">
                            <RadioGroup defaultValue="bank" className="mb-4">
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="bank" id="bank" />
                                    <Label htmlFor="bank">무통장 입금</Label>
                                </div>
                            </RadioGroup>

                            <select className="w-full p-3 rounded-md border border-input bg-background mb-3 text-sm">
                                <option>하나은행 39091001317704 예금주: 유한회사 소프트데이</option>
                            </select>

                            <Input
                                placeholder="입금자명을 입력해 주세요. (필수)"
                                value={guestInfo.depositor}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGuestInfo({ ...guestInfo, depositor: e.target.value })}
                            />

                            <p className="text-xs text-green-600 mt-2">
                                * 정확한 입금자명을 적어주셔야 자동매칭 되어 즉시 발송됩니다.<br />
                                * 국내 카드사 정책에 따라, 디지털 상품의 경우 카드결제가 제한되시 않는 점 양해 부탁드립니다. 추후 해외 PG사 연동 예정입니다.
                            </p>
                        </div>

                        <div className="space-y-2 mt-4">
                            <div className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    id="all"
                                    checked={agreements.all}
                                    onChange={(e) => toggleAllAgreements(e.target.checked)}
                                    className="rounded border-gray-300"
                                />
                                <label htmlFor="all" className="text-sm font-bold cursor-pointer">전체동의</label>
                            </div>
                            <hr className="my-2" />
                            <div className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    id="privacy"
                                    checked={agreements.privacy}
                                    onChange={(e) => setAgreements({ ...agreements, privacy: e.target.checked })}
                                    className="rounded border-gray-300"
                                />
                                <label htmlFor="privacy" className="text-xs text-muted-foreground cursor-pointer">개인정보 수집 동의</label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    id="terms"
                                    checked={agreements.terms}
                                    onChange={(e) => setAgreements({ ...agreements, terms: e.target.checked })}
                                    className="rounded border-gray-300"
                                />
                                <label htmlFor="terms" className="text-xs text-muted-foreground cursor-pointer">구매조건 확인 및 이용약관 동의</label>
                            </div>
                        </div>
                    </div>
                )}

                <button
                    className={`${styles.submitBtn} w-full mt-8 bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-4 rounded-xl transition-all shadow-lg hover:shadow-xl`}
                    disabled={loading}
                    onClick={handleSubscribe}
                >
                    {loading ? '처리 중...' : '구독하기'}
                </button>
            </div>
        </main>
    );
}
