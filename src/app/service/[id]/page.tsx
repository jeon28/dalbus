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

    // SNS(카카오/구글) 간편가입 — 가입 후 현재 주문 페이지로 복귀하면 회원 정보가 자동 입력된다.
    const handleSnsSignup = async (provider: 'kakao' | 'google') => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider,
            options: { redirectTo: window.location.href }
        });
        if (error) {
            console.error('SNS signup failed:', error);
            toast.error('SNS 로그인 연결에 실패했습니다. 잠시 후 다시 시도해주세요.');
        }
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

        // 실제 수신 가능한 이메일인지 점검 (메일을 받을 수 없는 도메인이면 주문 차단)
        try {
            const emailRes = await apiFetch('/api/auth/validate-email', {
                method: 'POST',
                body: JSON.stringify({ email: guestInfo.email })
            });
            const emailResult = await emailRes.json();
            if (!emailResult.valid) {
                toast.error(emailResult.message || '사용할 수 없는 이메일입니다.');
                return;
            }
        } catch {
            toast.error('이메일 확인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
            return;
        }

        const selectedPlan = plans.find(p => p.duration_months === selectedPeriod);
        if (!selectedPlan) {
            toast.error('선택한 기간에 해당하는 요금제 정보를 찾을 수 없습니다.');
            return;
        }

        // 비회원도 가입 없이 즉시 주문한다. (회원 전환은 결제완료 페이지에서 권유)
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
                        {product.image_url && product.image_url.startsWith('/') ? (
                            // 로컬(/public) 경로만 next/image로 최적화. 외부 URL은 remotePatterns 미설정 시
                            // 런타임 에러가 나므로 안전하게 이모지로 폴백한다. (상품 목록과 동일 규칙)
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
                        <li>상단 주문조회 메뉴에서 이용 정보 및 결제 내역 조회가 가능합니다.</li>
                        <li>디지털 상품 특성 상, 상품 인도 후 구매자의 단순 변심으로 인한 환불은 불가합니다.</li>
                    </ul>
                </div>

                <section className={styles.options}>
                    <h3 className="text-lg font-bold mb-3">이용 기간 선택</h3>
                    <div className={styles.optionList}>
                        {plans.length > 0 ? (
                            // 모든 플랜을 항상 노출 — 다른 기간 옵션을 펼침 없이 한눈에 비교
                            plans.map((plan) => (
                                <div
                                    key={plan.id}
                                    role="radio"
                                    aria-checked={selectedPeriod === plan.duration_months}
                                    className={`${styles.optionItem} ${selectedPeriod === plan.duration_months ? styles.active : ''} glass cursor-pointer`}
                                    onClick={() => setSelectedPeriod(plan.duration_months)}
                                >
                                    <span>
                                        {plan.duration_months === 25 ? '24개월 +1개월' : `${plan.duration_months}개월`}
                                        {plan.discount_rate > 0 && (
                                            <span className="ml-1 text-[10px] text-green-600 font-normal">
                                                ({plan.discount_rate}% 할인)
                                            </span>
                                        )}
                                    </span>
                                    <span className="text-right">
                                        <span className="block">{plan.price.toLocaleString()}원</span>
                                        <span className="block text-[11px] text-muted-foreground font-normal">
                                            월 {Math.round(plan.price / plan.duration_months).toLocaleString()}원
                                        </span>
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

                            {/* SNS 간편가입 유도 — 가입하면 이름·이메일이 자동 입력된다 (주문은 가입 없이도 가능) */}
                            {!user && (
                                <div className="pt-1">
                                    <p className="text-xs text-muted-foreground text-center mb-2">
                                        SNS로 가입하면 회원 정보가 자동으로 입력되고, 만료 알림·이용내역 조회를 이용할 수 있어요.
                                    </p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            type="button"
                                            onClick={() => handleSnsSignup('kakao')}
                                            className="flex items-center justify-center gap-2 py-3 rounded-lg bg-[#FEE500] text-[#191919] text-sm font-bold hover:brightness-95 transition-all"
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                                <path d="M12 3C6.48 3 2 6.58 2 11c0 2.84 1.86 5.33 4.64 6.74-.2.75-.74 2.72-.85 3.14-.13.52.19.51.4.37.17-.11 2.66-1.81 3.74-2.55.66.1 1.35.15 2.07.15 5.52 0 10-3.58 10-8s-4.48-8-10-8z" />
                                            </svg>
                                            카카오로 가입
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleSnsSignup('google')}
                                            className="flex items-center justify-center gap-2 py-3 rounded-lg bg-white border border-input text-sm font-bold text-gray-700 hover:bg-gray-50 transition-all"
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                                                <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
                                                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
                                                <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
                                                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z" />
                                            </svg>
                                            구글로 가입
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 결제수단은 무통장입금 하나뿐이므로 한 줄 안내 + 입금자명 입력으로 축소 */}
                    <div className="glass p-4 rounded-xl mt-8 space-y-3">
                        <p className="text-sm">
                            <span className="inline-flex items-center gap-1.5 font-semibold text-primary mr-2">
                                <span className="w-2 h-2 rounded-full bg-primary inline-block" />
                                무통장 입금
                            </span>
                            <span className="text-muted-foreground text-xs">
                                주문 후 입금 계좌를 안내해드립니다 · 48시간 내 미입금 시 자동 취소
                            </span>
                        </p>

                        <Input
                            placeholder="입금자명을 입력해 주세요. (필수)"
                            value={guestInfo.depositor}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGuestInfo({ ...guestInfo, depositor: e.target.value })}
                        />

                        <p className="text-xs text-green-600">
                            * 정확한 입금자명을 적어주셔야 입금확인 가능합니다.
                        </p>
                    </div>

                </div>

                {/* 약관은 별도 체크 대신 버튼에 통합 — 링크 한 줄 + "동의하고 주문하기" 문구로 고지 */}
                <button
                    className={`${styles.submitBtn} w-full mt-8 font-bold py-4 rounded-xl transition-all shadow-lg hover:shadow-xl hidden md:block`}
                    disabled={loading || (orderMode === 'EXT' && !selectedOrder)}
                    onClick={handleSubscribe}
                >
                    {loading ? '처리 중...' : (user ? '구독하기' : '동의하고 주문하기')}
                </button>
                <p className="text-[11px] text-muted-foreground text-center mt-3 pb-24 md:pb-0">
                    주문 시{' '}
                    <a href="/public/terms" target="_blank" className="underline">이용약관</a> 및{' '}
                    <a href="/public/privacy" target="_blank" className="underline">개인정보 수집·이용</a>에
                    동의하는 것으로 간주됩니다.
                </p>
            </div>

            {/* 모바일 하단 고정 결제 바 — 스크롤 위치와 무관하게 가격·CTA 상시 노출 */}
            <div className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-background/95 backdrop-blur border-t px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-muted-foreground leading-tight">
                        {currentPlan ? (currentPlan.duration_months === 25 ? '24개월 +1개월' : `${currentPlan.duration_months}개월`) : product.name}
                    </p>
                    <p className="text-lg font-extrabold leading-tight">{calculatedPrice}원</p>
                </div>
                <button
                    className="shrink-0 bg-primary text-primary-foreground font-bold text-sm px-6 py-3 rounded-xl shadow-lg disabled:bg-gray-300 disabled:text-gray-400 transition-all"
                    disabled={loading || (orderMode === 'EXT' && !selectedOrder)}
                    onClick={handleSubscribe}
                >
                    {loading ? '처리 중...' : (user ? '구독하기' : '동의하고 주문하기')}
                </button>
            </div>
        </main>
    );
}
