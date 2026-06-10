"use client";

import { useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from 'sonner';

interface LookupOrder {
    id: string;
    order_number: string;
    created_at: string;
    payment_status: string;
    product_id: string | null;
    products: { name: string } | null;
    product_plans: { duration_months: number } | null;
    end_date: string | null;
    tidal_id: string | null;
}

const STATUS_LABEL: Record<string, { text: string; className: string }> = {
    pending: { text: '입금 대기', className: 'bg-yellow-100 text-yellow-800' },
    paid: { text: '결제 완료', className: 'bg-green-100 text-green-800' },
};

export default function OrderLookupPage() {
    const [tidalId, setTidalId] = useState('');
    const [orders, setOrders] = useState<LookupOrder[]>([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);

    const handleLookup = async () => {
        if (!tidalId.trim()) {
            toast.error('Tidal ID를 입력해주세요.');
            return;
        }
        setLoading(true);
        try {
            const res = await apiFetch('/api/orders/lookup', {
                method: 'POST',
                body: JSON.stringify({ tidalId: tidalId.trim() })
            });
            const data = await res.json();
            if (res.ok) {
                setOrders(data.orders || []);
                setSearched(true);
            } else {
                toast.error('조회 중 오류가 발생했습니다.');
            }
        } catch {
            toast.error('조회에 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="container max-w-2xl mx-auto py-12 px-4">
            <h1 className="text-2xl font-bold text-center mb-2">주문조회</h1>
            <p className="text-sm text-muted-foreground text-center mb-8">
                구매 시 사용한 Tidal ID로 이용 정보와 결제 내역을 조회할 수 있습니다.
            </p>

            <div className="glass p-5 rounded-xl space-y-3 mb-8">
                <Input
                    placeholder="Tidal ID (예: tidalid@hifitidal.com)"
                    value={tidalId}
                    onChange={(e) => setTidalId(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleLookup(); }}
                />
                <Button className="w-full" onClick={handleLookup} disabled={loading}>
                    {loading ? '조회 중...' : '주문 조회하기'}
                </Button>
            </div>

            {searched && orders.length === 0 && (
                <p className="text-sm text-center text-muted-foreground py-8">
                    조회된 주문 내역이 없습니다.
                </p>
            )}

            {orders.length > 0 && (
                <div className="space-y-3">
                    <p className="text-xs font-bold text-muted-foreground">조회된 내역 ({orders.length})</p>
                    {orders.map((o) => {
                        const status = STATUS_LABEL[o.payment_status] || { text: o.payment_status, className: 'bg-gray-100 text-gray-600' };
                        return (
                            <div key={o.id} className="glass p-4 rounded-xl flex items-start justify-between gap-3">
                                <div className="space-y-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <p className="text-sm font-bold">{o.products?.name || '구독 상품'}</p>
                                        <Badge variant="secondary" className={status.className}>{status.text}</Badge>
                                    </div>
                                    {o.tidal_id && <p className="text-sm font-medium text-primary">{o.tidal_id}</p>}
                                    <p className="text-xs text-muted-foreground">
                                        주문번호 {o.order_number}
                                        {o.product_plans?.duration_months ? ` · ${o.product_plans.duration_months}개월` : ''}
                                    </p>
                                    {o.end_date && (
                                        <p className="text-xs text-muted-foreground">만료일: {o.end_date}</p>
                                    )}
                                </div>
                                {o.product_id && o.tidal_id && (
                                    <Link
                                        href={`/service/${o.product_id}?mode=EXT&tidalId=${encodeURIComponent(o.tidal_id)}`}
                                        className="text-xs text-primary font-bold shrink-0 underline"
                                    >
                                        기간 연장 →
                                    </Link>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </main>
    );
}
