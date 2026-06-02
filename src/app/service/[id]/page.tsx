"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useServices } from '@/lib/ServiceContext';
import { apiFetch } from '@/lib/api';
import styles from './service.module.css';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from '@/lib/supabase';
import { addDays, format, parseISO } from 'date-fns';
import { ArrowLeft } from 'lucide-react';
import DOMPurify from 'dompurify';
import { toast } from 'sonner';
import { PageLoading } from '@/components/ui/PageLoading';
import { formatPhoneInput } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import SignupForm from '@/components/auth/SignupForm';
import { BellRing } from 'lucide-react';

export default function ServiceDetail({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user } = useServices();
    const [id, setId] = useState<string | null>(null);

    // interfaces
    interface Plan {
        id: string;
        price: number;
        duration_months: number;
        discount_rate: number;
    }

    interface Product {
        id: string;
        name: string;
        description: string | null;
        detail_content: string | null;
        original_price: number;
        image_url: string | null;
    }

    interface ExtensionOrder {
        id: string;
        order_number: string;
        end_date: string | null;
        tidal_id: string | null;
        buyer_name: string | null;
        buyer_phone: string | null;
        buyer_email: string | null;
        products: {
            name: string;
        };
    }

    interface UserTidalAccount {
        orderId: string;
        orderNumber: string;
        tidalId: string;
        endDate: string | null;
        buyerName: string | null;
        buyerPhone: string | null;
        buyerEmail: string | null;
    }

    const [product, setProduct] = useState<Product | null>(null);
    const [plans, setPlans] = useState<Plan[]>([]);
    const [selectedPeriod, setSelectedPeriod] = useState<number>(12);
    const [isPlanExpanded, setIsPlanExpanded] = useState(false);
    const [loading, setLoading] = useState(false);
    const [orderMode, setOrderMode] = useState<'NEW' | 'EXT'>('NEW');
    const [selectedOrder, setSelectedOrder] = useState<ExtensionOrder | null>(null);
    const [lookupLoading, setLookupLoading] = useState(false);
    const [lookupResults, setLookupResults] = useState<ExtensionOrder[]>([]);
    const [lookupMessage, setLookupMessage] = useState('');
    const [userEmails, setUserEmails] = useState<string[]>([]);
    const [userTidalAccounts, setUserTidalAccounts] = useState<UserTidalAccount[]>([]);

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

    // 비회원 구독 시 회원가입 유도 모달
    const [signupModalOpen, setSignupModalOpen] = useState(false);

    // Unpack params
    useEffect(() => {
        params.then(p => setId(p.id));
    }, [params]);

    // Fetch data when ID is available
    useEffect(() => {
        if (!id) return;

        const fetchData = async () => {
            try {
                // Fetch product details
                const prodRes = await apiFetch(`/api/public/products/${id}`);
                if (prodRes.ok) {
                    const prodData = await prodRes.json();
                    setProduct(prodData);
                    
                    // Unified plans from product_plans relation
                    if (prodData.product_plans && prodData.product_plans.length > 0) {
                        const sortedPlans = [...prodData.product_plans].sort((a, b) => a.duration_months - b.duration_months);
                        setPlans(sortedPlans);
                        const prefer12 = sortedPlans.find(p => p.duration_months === 12);
                        setSelectedPeriod(prefer12 ? 12 : sortedPlans[sortedPlans.length - 1].duration_months);
                    }
                }

            } catch (err) {
                console.error('Failed to fetch product data:', err);
            }
        };

        fetchData();
    }, [id]);

    // Handle initial parameters from URL
    useEffect(() => {
        const mode = searchParams.get('mode');
        const tidalId = searchParams.get('tidalId');
        // const orderId = searchParams.get('orderId');

        if (mode === 'EXT') {
            setOrderMode('EXT');
        }
        if (tidalId) {
            setGuestInfo(prev => ({ ...prev, tidalId }));
        }
    }, [searchParams]);

    // Pre-fill user info if logged in
    useEffect(() => {
        if (user) {
            setGuestInfo(prev => ({
                ...prev,
                name: user.name || '',
                phone: user.phone || '',
                email: user.email || '',
                depositor: prev.depositor || user.name || ''
            }));

            // Fetch all unique buyer_emails from previous orders
            const fetchUserOrderInfo = async () => {
                const { data, error } = await supabase
                    .from('orders')
                    .select('buyer_email')
                    .eq('user_id', user.id);

                if (!error && data) {
                    const emails = new Set<string>();
                    if (user.email) emails.add(user.email);
                    data.forEach(o => {
                        if (o.buyer_email) emails.add(o.buyer_email);
                    });
                    setUserEmails(Array.from(emails));
                } else {
                    setUserEmails(user.email ? [user.email] : []);
                }
            };
            fetchUserOrderInfo();
        } else {
            setUserEmails([]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    // Fetch user's tidal accounts for this product (for EXT tab)
    useEffect(() => {
        if (!user || !id) return;

        const fetchUserTidalAccounts = async () => {
            const res = await apiFetch(`/api/user/tidal-accounts?productId=${id}`);
            if (res.ok) {
                const data = await res.json();
                setUserTidalAccounts(data.accounts || []);
            }
        };

        fetchUserTidalAccounts();
    }, [user, id]);

    const handleLookup = useCallback(async () => {
        if (!guestInfo.tidalId) {
            toast.error('Tidal ID를 입력해주세요.');
            return;
        }

        setLookupLoading(true);
        setLookupMessage('');
        setLookupResults([]);
        setSelectedOrder(null);

        try {
            const res = await apiFetch('/api/orders/lookup', {
                method: 'POST',
                body: JSON.stringify({ tidalId: guestInfo.tidalId, productId: id })
            });
            const data = await res.json();

            if (res.ok) {
                const orders = data.orders || [];
                setLookupResults(orders);
                if (orders.length === 0) {
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
    }, [guestInfo.tidalId, id]);

    const toggleAllAgreements = (checked: boolean) => {
        setAgreements({ all: checked, privacy: checked, terms: checked });
    };

    const handleSubscribe = async () => {
        if (!product) return;

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!guestInfo.name || !guestInfo.phone || !guestInfo.email || !guestInfo.depositor) {
            toast.error('주문 정보를 모두 입력해주세요.');
            return;
        }
        if (!emailRegex.test(guestInfo.email)) {
            toast.error('올바른 이메일 형식이 아닙니다. (예: name@example.com)');
            return;
        }
        if (!user && (!agreements.privacy || !agreements.terms)) {
            toast.error('필수 약관에 동의해주세요.');
            return;
        }

        const selectedPlan = plans.find(p => p.duration_months === selectedPeriod);
        if (!selectedPlan) {
            toast.error('선택한 기간에 해당하는 요금제 정보를 찾을 수 없습니다.');
            return;
        }

        // 비회원이면 주문 진행 전에 회원가입 유도 모달을 띄운다.
        if (!user) {
            setSignupModalOpen(true);
            return;
        }

        await createOrder();
    };

    // 실제 주문 생성 + 결제 안내 페이지 이동
    // userIdOverride: 회원가입 직후 주문을 이어갈 때 새 사용자 ID를 전달
    const createOrder = async (userIdOverride?: string) => {
        if (!product) return;

        const selectedPlan = plans.find(p => p.duration_months === selectedPeriod);
        if (!selectedPlan) {
            toast.error('선택한 기간에 해당하는 요금제 정보를 찾을 수 없습니다.');
            return;
        }

        setLoading(true);

        const amount = selectedPlan.price;
        const effectiveUserId = userIdOverride || user?.id || null;

        const orderData: Record<string, string | number | boolean | null> = {
            product_id: product.id,
            plan_id: selectedPlan.id,
            amount: amount,
            payment_status: 'pending',
            assignment_status: 'waiting',
            is_guest: !effectiveUserId,
            buyer_name: guestInfo.name,
            buyer_phone: guestInfo.phone,
            buyer_email: guestInfo.email,
            depositor_name: guestInfo.depositor,
            order_type: orderMode,
            related_order_id: selectedOrder?.id || null,
        };

        if (effectiveUserId) {
            orderData.user_id = effectiveUserId;
        }

        try {
            const response = await apiFetch('/api/orders', {
                method: 'POST',
                body: JSON.stringify({
                    orderData,
                    product_name: product.name,
                    plan_name: selectedPlan.duration_months + '개월',
                    extend_tidal_id: orderMode === 'EXT' ? (selectedOrder?.tidal_id || null) : null
                })
            });

            const result = await response.json();

            if (!response.ok || result.error) {
                const errorMsg = result.error || 'Failed to create order';
                console.error('Error creating order:', errorMsg);
                toast.error('주문 생성 실패: ' + errorMsg);
                setLoading(false);
            } else {
                // 주문 ID(UUID) 기반으로 결제 안내 페이지 이동
                // 계좌·매칭코드·만료시간은 success 페이지에서 API로 재조회 (sessionStorage 평문 저장 X)
                const orderId = result?.order?.id;
                if (!orderId) {
                    toast.error('주문 처리 중 오류가 발생했습니다. (주문 ID 누락)');
                    setLoading(false);
                    return;
                }
                router.push(`/public/checkout/success?orderId=${encodeURIComponent(orderId)}`);
            }
        } catch (err) {
            console.error('Order creation process failed:', err);
            toast.error('주문 처리 중 오류가 발생했습니다.');
            setLoading(false);
        }
    };


    if (!product) return <PageLoading />;

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
                    <button onClick={() => router.back()} className="absolute left-0 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-black/5 transition-colors" aria-label="뒤로가기"><ArrowLeft className="h-5 w-5" /></button>
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
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(product.detail_content || product.description || '') }}
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
                            plans
                                .filter(plan => isPlanExpanded || selectedPeriod === plan.duration_months)
                                .map((plan) => (
                                <div
                                    key={plan.id}
                                    className={`${styles.optionItem} ${selectedPeriod === plan.duration_months ? styles.active : ''} glass`}
                                    onClick={() => {
                                        if (selectedPeriod === plan.duration_months) {
                                            setIsPlanExpanded(v => !v);
                                        } else {
                                            setSelectedPeriod(plan.duration_months);
                                            setIsPlanExpanded(false);
                                        }
                                    }}
                                >
                                    <span>
                                        {plan.duration_months === 25 ? '24개월 +1개월' : `${plan.duration_months}개월`}
                                        {plan.discount_rate > 0 && (
                                            <span className="ml-1 text-[10px] text-green-600 font-normal">
                                                ({plan.discount_rate}% 할인)
                                            </span>
                                        )}
                                    </span>
                                    <span className="flex items-center gap-2">
                                        {plan.price.toLocaleString()}원
                                        {selectedPeriod === plan.duration_months && !isPlanExpanded && (
                                            <span className="text-[10px] text-slate-400">▼ 변경</span>
                                        )}
                                    </span>
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
                        <div className="glass p-5 rounded-xl space-y-3 border border-primary/20 bg-primary/5">
                            {user ? (
                                // 로그인: 배정된 Tidal ID 목록 직접 표시
                                userTidalAccounts.length > 0 ? (
                                    <>
                                        <p className="text-xs text-center text-slate-500">연장할 구독을 선택하세요.</p>
                                        {userTidalAccounts.map((acc) => (
                                            <div
                                                key={acc.tidalId}
                                                className="flex items-center justify-between p-3 border border-input rounded-lg hover:border-primary cursor-pointer bg-white transition-all shadow-sm"
                                                onClick={() => handleSelectOrderForExtension({
                                                    id: acc.orderId,
                                                    order_number: acc.orderNumber,
                                                    end_date: acc.endDate,
                                                    tidal_id: acc.tidalId,
                                                    buyer_name: acc.buyerName,
                                                    buyer_phone: acc.buyerPhone,
                                                    buyer_email: acc.buyerEmail,
                                                    products: { name: product?.name || '' }
                                                })}
                                            >
                                                <div>
                                                    <p className="text-sm font-bold text-primary">{acc.tidalId}</p>
                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                        종료일: {acc.endDate || '정보없음'}
                                                    </p>
                                                </div>
                                                <span className="text-xs text-primary font-bold shrink-0 ml-2">선택하기 →</span>
                                            </div>
                                        ))}
                                    </>
                                ) : (
                                    <p className="text-sm text-center text-muted-foreground py-4">
                                        배정된 계정 정보가 없습니다.
                                    </p>
                                )
                            ) : (
                                // 비로그인: Tidal ID 직접 입력 후 조회
                                <>
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
                                        <div className="mt-2 space-y-2">
                                            <p className="text-xs font-bold text-muted-foreground">연장 가능한 내역 ({lookupResults.length})</p>
                                            {lookupResults.map((o) => (
                                                <div
                                                    key={o.id}
                                                    className="flex items-center justify-between p-3 border border-input rounded-lg hover:border-primary cursor-pointer bg-white transition-all shadow-sm"
                                                    onClick={() => handleSelectOrderForExtension(o)}
                                                >
                                                    <div>
                                                        <p className="text-sm font-bold text-primary">{o.tidal_id || o.order_number}</p>
                                                        <p className="text-xs text-muted-foreground mt-0.5">
                                                            종료일: {o.end_date || '정보없음'}
                                                        </p>
                                                    </div>
                                                    <span className="text-xs text-primary font-bold shrink-0 ml-2">선택하기 →</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {(orderMode === 'NEW' || selectedOrder) && (
                        <div className="space-y-4">
                            {selectedOrder && (
                                <div className="p-4 bg-primary/10 rounded-xl border border-primary/20 mb-4">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-0.5">
                                            {selectedOrder.tidal_id && (
                                                <p className="text-base font-bold text-primary">{selectedOrder.tidal_id}</p>
                                            )}
                                            <p className="text-xs text-primary font-bold">선택된 연장 대상</p>
                                            <p className="text-sm font-medium">{product.name} ({selectedOrder.order_number})</p>
                                            {selectedOrder.end_date && (() => {
                                                const newEndDate = format(addDays(parseISO(selectedOrder.end_date), selectedPeriod * 30), 'yyyy-MM-dd');
                                                return (
                                                    <>
                                                        <p className="text-xs text-muted-foreground">현재 만료일: {selectedOrder.end_date}</p>
                                                        <p className="text-xs"><span className="font-bold text-primary">연장후 만료일: {newEndDate}</span></p>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                        <button
                                            className="text-xs text-muted-foreground underline shrink-0 ml-2"
                                            onClick={() => setSelectedOrder(null)}
                                        >
                                            변경
                                        </button>
                                    </div>
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
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGuestInfo({ ...guestInfo, phone: formatPhoneInput(e.target.value) })}
                            />
                            {user && userEmails.length > 1 ? (
                                <select
                                    className="w-full p-3 rounded-md border border-input bg-background text-sm focus:ring-2 focus:ring-primary outline-none"
                                    value={guestInfo.email}
                                    onChange={(e) => setGuestInfo({ ...guestInfo, email: e.target.value })}
                                >
                                    {userEmails.map((email) => (
                                        <option key={email} value={email}>
                                            {email}
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <Input
                                    type="email"
                                    placeholder="이메일을 입력해 주세요."
                                    value={guestInfo.email}
                                    readOnly={!!user}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGuestInfo({ ...guestInfo, email: e.target.value })}
                                />
                            )}
                            <p className="text-xs text-green-600 font-medium">* 정보가 틀릴 시 제품 전달에 문제가 생길 수 있으니 정확히 기입해주세요.</p>
                        </div>
                    )}

                    <h3 className="text-xl font-bold text-center mt-8">결제 수단</h3>
                    <div className="glass p-4 rounded-xl">
                        <div className="flex items-center gap-2 mb-4 px-1">
                            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                                <span className="w-2 h-2 rounded-full bg-primary inline-block" />
                                무통장 입금
                            </span>
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                            <p className="text-sm font-semibold text-blue-900 mb-1">
                                결제하기 버튼을 누르시면 입금 계좌를 안내해드립니다
                            </p>
                            <ul className="text-xs text-blue-700 space-y-0.5 list-disc pl-4">
                                <li>안내된 계좌로 정확한 금액을 입금해주세요</li>
                                <li>48시간 내 미입금 시 주문이 자동 취소됩니다</li>
                            </ul>
                        </div>

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
                    disabled={loading || (orderMode === 'EXT' && !selectedOrder) || (!user && (!agreements.privacy || !agreements.terms))}
                    onClick={handleSubscribe}
                >
                    {loading ? '처리 중...' : '구독하기'}
                </button>
            </div>

            {/* 비회원 → 회원가입 유도 모달 */}
            <Dialog open={signupModalOpen} onOpenChange={setSignupModalOpen}>
                <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-center">달버스 회원가입</DialogTitle>
                        <DialogDescription className="sr-only">
                            회원가입 후 주문을 이어가거나 비회원으로 주문할 수 있습니다.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex items-center justify-center gap-1.5 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-800">
                        <BellRing className="w-4 h-4 shrink-0 text-blue-500" />
                        <span>회원가입 시 잔여기간 조회·만료 알림 서비스를 보내드립니다.</span>
                    </div>

                    <SignupForm
                        compact
                        initialValues={{ email: guestInfo.email, name: guestInfo.name, phone: guestInfo.phone }}
                        onSignupSuccess={(uid) => {
                            setSignupModalOpen(false);
                            createOrder(uid);
                        }}
                        onGuestContinue={() => {
                            setSignupModalOpen(false);
                            createOrder();
                        }}
                    />
                </DialogContent>
            </Dialog>
        </main>
    );
}
