"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useServices } from '@/lib/ServiceContext';
import { apiFetch } from '@/lib/api';
import styles from './service.module.css';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export default function ServiceDetail({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = React.use(params);
    const serviceId = resolvedParams.id;
    const { services, user } = useServices();

    /* We need to fetch the full product details including 'detail_content' which might not be in context */
    interface ServiceProduct {
        id: string;
        name: string;
        image_url?: string;
        description?: string;
        detail_content?: string;
        original_price: number;
    }

    interface ProductPlan {
        id: string;
        duration_months: number;
        price: number;
        discount_rate: number;
        is_active: boolean;
    }

    const [serviceDetail, setServiceDetail] = useState<ServiceProduct | null>(null);
    const [plans, setPlans] = useState<ProductPlan[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedPeriod, setSelectedPeriod] = useState<number>(1);

    useEffect(() => {
        let isMounted = true;

        const fetchDetail = async () => {
            if (!serviceId) return;
            setLoading(true);

            try {
                const response = await apiFetch(`/api/public/products/${serviceId}`);
                if (!response.ok) throw new Error('Failed to fetch product detail');

                const productData = await response.json();

                if (isMounted && productData) {
                    setServiceDetail(productData);
                    const plansData = productData.product_plans || [];
                    setPlans(plansData);
                    if (plansData.length > 0) {
                        setSelectedPeriod(plansData[0].duration_months);
                    }
                }
            } catch (error: unknown) {
                if (error instanceof Error) {
                    if (error.name === 'AbortError' || error.message?.includes('aborted') || error.message?.includes('signal is aborted')) {
                        return;
                    }
                }
                if (isMounted) {
                    console.error('Unexpected error in fetchDetail:', error);
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        fetchDetail();

        return () => {
            isMounted = false;
        };
    }, [serviceId]);

    // Fallback to context if detail fetch is pending or failed
    const basicService = services.find(s => s.id === serviceId);
    const product: ServiceProduct | null = serviceDetail || (basicService ? {
        ...basicService,
        image_url: basicService.icon,
        detail_content: undefined,
        original_price: parseInt(basicService.price.toString().replace(/,/g, ''))
    } : null);

    // Bank Accounts State
    interface BankAccount {
        id: string;
        bank_name: string;
        account_number: string;
        account_holder: string;
        is_active: boolean;
    }
    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
    const [selectedBankId, setSelectedBankId] = useState<string>('');

    // Extension Flow State
    interface ExtensionOrder {
        id: string;
        order_number: string;
        products?: { name: string };
        end_date?: string;
        buyer_name?: string;
        buyer_phone?: string;
        buyer_email?: string;
    }
    const [orderMode, setOrderMode] = useState<'NEW' | 'EXT'>('NEW');
    const [lookupLoading, setLookupLoading] = useState(false);
    const [lookupResults, setLookupResults] = useState<ExtensionOrder[]>([]);
    const [selectedOrder, setSelectedOrder] = useState<ExtensionOrder | null>(null);
    const [lookupMessage, setLookupMessage] = useState('');

    useEffect(() => {
        const fetchBanks = async () => {
            try {
                const res = await apiFetch('/api/admin/bank-accounts');
                if (res.ok) {
                    const data = await res.json();
                    const activeBanks = data.filter((b: BankAccount) => b.is_active);
                    setBankAccounts(activeBanks);
                    if (activeBanks.length > 0) setSelectedBankId(activeBanks[0].id);
                }
            } catch (err) {
                const e = err as Error;
                if (e.name !== 'AbortError' && !e.message?.includes('aborted') && !e.message?.includes('signal is aborted')) {
                    console.error('Failed to fetch bank accounts:', err);
                }
            }
        };
        fetchBanks();
    }, []);

    const [guestInfo, setGuestInfo] = useState({
        name: '',
        phone: '',
        email: '',
        depositor: '',
        tidalId: ''
    });
    const [agreements, setAgreements] = useState({
        all: false,
        privacy: false,
        terms: false
    });

    useEffect(() => {
        if (user) {
            setGuestInfo(prev => ({
                ...prev,
                name: user.name || '',
                email: user.email || '',
                phone: user.phone || '',
                depositor: prev.depositor || user.name || ''
            }));
        }
    }, [user]);

    const router = useRouter();

    const toggleAllAgreements = (checked: boolean) => {
        setAgreements({ all: checked, privacy: checked, terms: checked });
    };

    const handleSubscribe = async () => {
        if (!product) return;

        if (!guestInfo.name || !guestInfo.phone || !guestInfo.email || !guestInfo.depositor) {
            alert('주문 정보를 모두 입력해주세요.');
            return;
        }
        if (!user && (!agreements.privacy || !agreements.terms)) {
            alert('필수 약관에 동의해주세요.');
            return;
        }

        const selectedPlan = plans.find(p => p.duration_months === selectedPeriod);
        if (!selectedPlan) {
            alert('선택한 기간에 해당하는 요금제 정보를 찾을 수 없습니다.');
            return;
        }

        setLoading(true);

        const amount = selectedPlan.price;

        const orderData: Record<string, string | number | boolean | null> = {
            product_id: product.id,
            plan_id: selectedPlan.id,
            amount: amount,
            payment_status: 'pending',
            assignment_status: 'waiting',
            is_guest: !user,
            buyer_name: guestInfo.name,
            buyer_phone: guestInfo.phone,
            buyer_email: guestInfo.email,
            depositor_name: guestInfo.depositor,
            order_type: orderMode,
            related_order_id: selectedOrder?.id || null,
        };

        if (user) {
            orderData.user_id = user.id;
        }

        try {
            const response = await apiFetch('/api/orders', {
                method: 'POST',
                body: JSON.stringify({
                    orderData,
                    product_name: product.name,
                    plan_name: selectedPlan.duration_months + '개월'
                })
            });

            const result = await response.json();

            if (!response.ok || result.error) {
                const errorMsg = result.error || 'Failed to create order';
                console.error('Error creating order:', errorMsg);
                alert('주문 생성 실패: ' + errorMsg);
                setLoading(false);
            } else {
                const selectedBank = bankAccounts.find(b => b.id === selectedBankId);
                const bankStr = selectedBank ? `${selectedBank.bank_name} ${selectedBank.account_number} (${selectedBank.account_holder})` : '';

                const params = new URLSearchParams({
                    service: product.name,
                    price: amount.toString(),
                    period: selectedPeriod.toString(),
                    depositor: guestInfo.depositor,
                    bank: bankStr,
                    name: guestInfo.name,
                    phone: guestInfo.phone,
                    email: guestInfo.email
                });

                router.push(`/public/checkout/success?${params.toString()}`);
            }
        } catch (err) {
            console.error('Order creation process failed:', err);
            alert('주문 처리 중 오류가 발생했습니다.');
            setLoading(false);
        }
    };

    if (!product) return <div className="container py-20 text-center">Loading...</div>;

    const handleLookup = async () => {
        if (!guestInfo.tidalId) {
            alert('Tidal ID를 입력해주세요.');
            return;
        }

        setLookupLoading(true);
        setLookupMessage('');
        setLookupResults([]);
        setSelectedOrder(null);

        try {
            const res = await apiFetch('/api/orders/lookup', {
                method: 'POST',
                body: JSON.stringify({ tidalId: guestInfo.tidalId })
            });
            const data = await res.json();

            if (res.ok) {
                const filtered = (data.orders || []).filter((o: ExtensionOrder) => o.products?.name === product.name);
                setLookupResults(filtered);
                if (filtered.length === 0) {
                    setLookupMessage('연장 가능한 주문 내역이 없습니다.');
                }
            } else {
                setLookupMessage('조회 중 오류가 발생했습니다.');
            }
        } catch (err) {
            console.error('Lookup failed:', err);
            setLookupMessage('조회에 실패했습니다.');
        } finally {
            setLookupLoading(false);
        }
    };

    const handleSelectOrderForExtension = (order: ExtensionOrder) => {
        setSelectedOrder(order);
        setGuestInfo(prev => ({
            ...prev,
            name: order.buyer_name || prev.name,
            phone: order.buyer_phone || prev.phone,
            email: order.buyer_email || prev.email,
            depositor: order.buyer_name || prev.depositor || order.buyer_name || ''
        }));
    };

    const currentPlan = plans.find(p => p.duration_months === selectedPeriod);
    const calculatedPrice = currentPlan
        ? currentPlan.price.toLocaleString()
        : product.original_price.toLocaleString();

    return (
        <main className={styles.main}>
            <header className={`${styles.header} glass`}>
                <div className="container relative flex flex-col items-center w-full">
                    <button className={styles.backBtn} onClick={() => router.back()} style={{ position: 'absolute', left: '0', top: '50%', transform: 'translateY(-50%)' }}>←</button>
                    <div className={styles.headerBrand}>
                        {product.image_url ? (
                            <div className="relative w-12 h-12 mr-2">
                                <Image src={product.image_url} alt={product.name} fill className="object-contain" />
                            </div>
                        ) : (
                            <span className="text-4xl">🎧</span>
                        )}
                        <h1 className={styles.title}>{product.name}</h1>
                    </div>
                </div>
            </header>

            <div className={`${styles.content} container max-w-2xl mx-auto py-8`}>
                {(product.detail_content || product.description) && (
                    <div
                        className="glass p-6 rounded-xl mb-8 animate-fade-in text-sm leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: product.detail_content || product.description || '' }}
                    />
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

                <section className={styles.options}>
                    <h3 className="text-lg font-bold mb-3">이용 기간 선택</h3>
                    <div className={styles.optionList}>
                        {plans.length > 0 ? (
                            plans.map((plan) => (
                                <div
                                    key={plan.id}
                                    className={`${styles.optionItem} ${selectedPeriod === plan.duration_months ? styles.active : ''} glass`}
                                    onClick={() => setSelectedPeriod(plan.duration_months)}
                                >
                                    <span>
                                        {plan.duration_months}개월
                                        {plan.discount_rate > 0 && (
                                            <span className="ml-1 text-[10px] text-green-600 font-normal">
                                                ({plan.discount_rate}% 할인)
                                            </span>
                                        )}
                                    </span>
                                    <span>{plan.price.toLocaleString()}원</span>
                                </div>
                            ))
                        ) : (
                            <div className="p-4 text-center text-sm text-muted-foreground glass rounded-xl">
                                사용 가능한 요금제가 없습니다.
                            </div>
                        )}
                    </div>
                </section>

                <div className="mt-8 space-y-6 animate-fade-in">
                    <div className="flex border-b border-input mb-6">
                        <button
                            className={`flex-1 py-3 text-sm font-bold transition-all ${orderMode === 'NEW' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'}`}
                            onClick={() => {
                                setOrderMode('NEW');
                                setSelectedOrder(null);
                                setLookupResults([]);
                            }}
                        >
                            신규 신청
                        </button>
                        <button
                            className={`flex-1 py-3 text-sm font-bold transition-all ${orderMode === 'EXT' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'}`}
                            onClick={() => setOrderMode('EXT')}
                        >
                            기간 연장
                        </button>
                    </div>

                    <h3 className="text-xl font-bold text-center">
                        {user ? '회원 정보' : '구매자 정보'}
                    </h3>

                    {orderMode === 'EXT' && !selectedOrder && (
                        <div className="glass p-5 rounded-xl space-y-4 border border-primary/20 bg-primary/5">
                            <p className="text-sm font-medium text-center text-primary">기존 정보를 입력하여 연장할 주문을 조회하세요.</p>
                            <div className="space-y-4">
                                <Input
                                    placeholder="구매 시 사용한 Tidal ID (예: tidalid@hifitidal.com)"
                                    value={guestInfo.tidalId}
                                    onChange={(e) => setGuestInfo({ ...guestInfo, tidalId: e.target.value })}
                                />
                                <button
                                    className="w-full py-3 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors"
                                    onClick={handleLookup}
                                    disabled={lookupLoading}
                                >
                                    {lookupLoading ? '조회 중...' : '기존 주문 조회하기'}
                                </button>
                            </div>

                            {lookupMessage && <p className="text-xs text-center text-red-500 mt-2">{lookupMessage}</p>}

                            {lookupResults.length > 0 && (
                                <div className="mt-4 space-y-2">
                                    <p className="text-xs font-bold text-muted-foreground mb-2">연장 가능한 내역 ({lookupResults.length})</p>
                                    {lookupResults.map((o) => (
                                        <div
                                            key={o.id}
                                            className="p-3 border border-input rounded-lg hover:border-primary cursor-pointer bg-white transition-all shadow-sm"
                                            onClick={() => handleSelectOrderForExtension(o)}
                                        >
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-bold">{o.products?.name}</span>
                                                <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded text-gray-500">{o.order_number}</span>
                                            </div>
                                            <div className="flex justify-between items-center mt-1">
                                                <span className="text-xs text-muted-foreground">만료일: {o.end_date || '정보없음'}</span>
                                                <span className="text-xs text-primary font-bold">선택하기 →</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {(orderMode === 'NEW' || selectedOrder) && (
                        <div className="space-y-4">
                            {selectedOrder && (
                                <div className="p-4 bg-primary/10 rounded-xl border border-primary/20 mb-4 flex justify-between items-center">
                                    <div>
                                        <p className="text-xs text-primary font-bold">선택된 연장 대상</p>
                                        <p className="text-sm font-medium">{product.name} ({selectedOrder.order_number})</p>
                                    </div>
                                    <button
                                        className="text-xs text-muted-foreground underline"
                                        onClick={() => setSelectedOrder(null)}
                                    >
                                        변경
                                    </button>
                                </div>
                            )}
                            <Input
                                placeholder="성함을 입력해 주세요."
                                value={guestInfo.name}
                                readOnly={!!user}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    const newName = e.target.value;
                                    setGuestInfo(prev => ({
                                        ...prev,
                                        name: newName,
                                        depositor: prev.depositor === prev.name ? newName : prev.depositor
                                    }));
                                }}
                            />
                            <Input
                                type="tel"
                                placeholder="휴대폰번호를 입력해 주세요."
                                value={guestInfo.phone}
                                readOnly={!!user}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGuestInfo({ ...guestInfo, phone: e.target.value })}
                            />
                            <Input
                                type="email"
                                placeholder="이메일을 입력해 주세요."
                                value={guestInfo.email}
                                readOnly={!!user}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGuestInfo({ ...guestInfo, email: e.target.value })}
                            />
                            <p className="text-xs text-green-600 font-medium">* 정보가 틀릴 시 제품 전달에 문제가 생길 수 있으니 정확히 기입해주세요.</p>
                        </div>
                    )}

                    <h3 className="text-xl font-bold text-center mt-8">결제 수단</h3>
                    <div className="glass p-4 rounded-xl">
                        <RadioGroup defaultValue="bank" className="mb-4">
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="bank" id="bank" />
                                <Label htmlFor="bank">무통장 입금</Label>
                            </div>
                        </RadioGroup>

                        <select
                            className="w-full p-3 rounded-md border border-input bg-background mb-3 text-sm focus:ring-2 focus:ring-primary outline-none"
                            value={selectedBankId}
                            onChange={(e) => setSelectedBankId(e.target.value)}
                        >
                            {bankAccounts.map(bank => (
                                <option key={bank.id} value={bank.id}>
                                    {bank.bank_name} {bank.account_number} 예금주: {bank.account_holder}
                                </option>
                            ))}
                            {bankAccounts.length === 0 && (
                                <option disabled>등록된 결제 계좌가 없습니다.</option>
                            )}
                        </select>

                        <Input
                            placeholder="입금자명을 입력해 주세요. (필수)"
                            value={guestInfo.depositor}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGuestInfo({ ...guestInfo, depositor: e.target.value })}
                        />

                        <p className="text-xs text-green-600 mt-2">
                            * 정확한 입금자명을 적어주셔야 입금확인 가능합니다.<br />
                            * 현재 결제수단은 무통장 입금만 가능합니다.
                        </p>
                    </div>

                    {!user && (
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
                    )}
                </div>

                <button
                    className={`${styles.submitBtn} w-full mt-8 font-bold py-4 rounded-xl transition-all shadow-lg hover:shadow-xl`}
                    disabled={loading || (!user && (!agreements.privacy || !agreements.terms))}
                    onClick={handleSubscribe}
                >
                    {loading ? '처리 중...' : '구독하기'}
                </button>
            </div>
        </main>
    );
}
