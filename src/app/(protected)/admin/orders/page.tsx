/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState } from 'react';
import { useServices } from '@/lib/ServiceContext';
import styles from '../admin.module.css';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export default function OrderHistoryPage() {
    const { isAdmin } = useServices();
    const [orders, setOrders] = useState<Record<string, any>[]>([]);
    const router = useRouter();

    // Matching Modal State
    const [isMatchModalOpen, setIsMatchModalOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<any>(null);
    const [availableAccounts, setAvailableAccounts] = useState<any[]>([]);
    const [selectedAccount, setSelectedAccount] = useState<string>('');
    const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
    const [slotPasswordModal, setSlotPasswordModal] = useState('');

    useEffect(() => {
        if (!isAdmin) {
            router.push('/admin');
        } else {
            fetchOrders();
        }
    }, [isAdmin]);

    const fetchOrders = async () => {
        try {
            const response = await fetch('/api/admin/orders');
            if (!response.ok) throw new Error('Failed to fetch orders');
            const data = await response.json();
            setOrders(data);
        } catch (error) {
            console.error('Error fetching orders:', error);
        }
    };

    const getOrderStatus = (order: any) => {
        if (order.assignment_status === 'completed') return '작업완료';
        if (order.assignment_status === 'assigned') return '배정완료'; // Linked
        if (order.payment_status === 'paid') return '입금확인';
        return '주문신청'; // Pending payment
    };

    const handleOpenMatchModal = async (order: any) => {
        setSelectedOrder(order);
        setSelectedAccount('');
        setSelectedSlot(null);
        setSlotPasswordModal('');

        // Fetch available accounts
        try {
            const res = await fetch('/api/admin/accounts');
            if (res.ok) {
                const data = await res.json();
                // Filter accounts with available slots
                const available = data.filter((acc: any) => acc.used_slots < acc.max_slots);
                setAvailableAccounts(available);
                setIsMatchModalOpen(true);
            }
        } catch (e) {
            alert('계정 목록 불러오기 실패');
        }
    };

    const getAvailableSlots = (accountId: string) => {
        const acc = availableAccounts.find(a => a.id === accountId);
        if (!acc) return [];
        const takenSlots = new Set<number>();
        if (acc.order_accounts) {
            acc.order_accounts.forEach((oa: any) => takenSlots.add(oa.slot_number));
        }
        const available = [];
        for (let i = 0; i < acc.max_slots; i++) {
            if (!takenSlots.has(i)) available.push(i);
        }
        return available;
    };

    const confirmMatch = async () => {
        if (!selectedOrder || !selectedAccount || selectedSlot === null) return;
        try {
            const res = await fetch(`/api/admin/accounts/${selectedAccount}/assign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    order_id: selectedOrder.id,
                    slot_number: selectedSlot,
                    slot_password: slotPasswordModal
                })
            });
            if (!res.ok) throw new Error('Match failed');

            alert('배정되었습니다.');
            setIsMatchModalOpen(false);
            fetchOrders();
        } catch (e) {
            alert('배정 실패');
        }
    };

    const confirmPayment = async (orderId: string) => {
        if (!confirm('입금 확인 처리하시겠습니까?')) return;
        try {
            const res = await fetch(`/api/admin/orders/${orderId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ payment_status: 'paid' })
            });
            if (!res.ok) throw new Error('Update failed');
            fetchOrders();
        } catch (e) {
            alert('입금 확인 실패');
        }
    };

    const markAsCompleted = async (orderId: string) => {
        if (!confirm('작업 완료 처리하시겠습니까?')) return;
        try {
            const res = await fetch(`/api/admin/orders/${orderId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ assignment_status: 'completed' })
            });
            if (!res.ok) throw new Error('Update failed');
            fetchOrders();
        } catch (e) {
            alert('상태 변경 실패');
        }
    };

    if (!isAdmin) return null;

    const renderTable = (list: any[]) => (
        <div className={styles.tableWrapper}>
            <table className={styles.table}>
                <thead>
                    <tr>
                        <th>날짜/주문번호</th>
                        <th>고객명 (ID)</th>
                        <th>연락처/이메일</th>
                        <th>서비스</th>
                        <th>금액</th>
                        <th>상태</th>
                        <th>관리</th>
                    </tr>
                </thead>
                <tbody>
                    {list.map(o => {
                        const status = getOrderStatus(o);
                        return (
                            <tr key={o.id}>
                                <td>
                                    <div className="text-sm">{new Date(o.created_at).toLocaleDateString()}</div>
                                    <div className="text-xs text-gray-500">{o.order_number}</div>
                                </td>
                                <td>
                                    <div className="font-medium">{o.profiles?.name || o.buyer_name || 'Unknown'}</div>
                                    <div className="text-xs text-gray-400">{o.profiles?.email || o.buyer_email || '-'}</div>
                                </td>
                                <td>
                                    <div className="text-sm">{o.profiles?.phone || o.buyer_phone || '-'}</div>
                                    <div className="text-xs text-gray-400">{o.profiles?.email || o.buyer_email || '-'}</div>
                                </td>
                                <td>{o.products?.name || 'Product'}</td>
                                <td>₩{o.amount?.toLocaleString()}</td>
                                <td>
                                    <span className={`px-2 py-1 rounded text-xs 
                                        ${status === '작업완료' ? 'bg-gray-100 text-gray-800' :
                                            status === '배정완료' ? 'bg-blue-100 text-blue-800' :
                                                status === '입금확인' ? 'bg-green-100 text-green-800' :
                                                    'bg-yellow-100 text-yellow-800'}`}>
                                        {status}
                                    </span>
                                </td>
                                <td>
                                    {status === '주문신청' && (
                                        <Button size="sm" variant="secondary" onClick={() => confirmPayment(o.id)}>입금확인</Button>
                                    )}
                                    {status === '입금확인' && (
                                        <Button size="sm" onClick={() => handleOpenMatchModal(o)}>매칭</Button>
                                    )}
                                    {status === '배정완료' && (
                                        <Button size="sm" variant="outline" onClick={() => markAsCompleted(o.id)}>작업완료</Button>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );

    const memberOrders = orders.filter(o => !o.is_guest);
    const guestOrders = orders.filter(o => o.is_guest);

    return (
        <main className={styles.main}>
            <header className={`${styles.header} glass`}>
                <div className="container">
                    <h1 className={styles.title}>주문 내역 관리</h1>
                </div>
            </header>

            <div className={`${styles.content} container`}>
                <section className={styles.orderSection}>
                    <Tabs defaultValue="member" className="w-full">
                        <TabsList className="mb-4">
                            <TabsTrigger value="member">회원 주문 ({memberOrders.length})</TabsTrigger>
                            <TabsTrigger value="guest">비회원 주문 ({guestOrders.length})</TabsTrigger>
                        </TabsList>

                        <TabsContent value="member">{renderTable(memberOrders)}</TabsContent>
                        <TabsContent value="guest">{renderTable(guestOrders)}</TabsContent>
                    </Tabs>
                </section>
            </div>

            <Dialog open={isMatchModalOpen} onOpenChange={setIsMatchModalOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>주문 매칭 (Tidal 배정)</DialogTitle></DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">계정 선택</Label>
                            <Select onValueChange={setSelectedAccount} value={selectedAccount}>
                                <SelectTrigger className="col-span-3"><SelectValue placeholder="계정 선택" /></SelectTrigger>
                                <SelectContent>
                                    {availableAccounts.map(acc => (
                                        <SelectItem key={acc.id} value={acc.id}>
                                            {acc.login_id} (잔여: {acc.max_slots - acc.used_slots})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        {selectedAccount && (
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right">Slot 선택</Label>
                                <Select onValueChange={(val) => setSelectedSlot(Number(val))} value={selectedSlot?.toString()}>
                                    <SelectTrigger className="col-span-3"><SelectValue placeholder="슬롯 선택" /></SelectTrigger>
                                    <SelectContent>
                                        {getAvailableSlots(selectedAccount).map(slotNum => (
                                            <SelectItem key={slotNum} value={slotNum.toString()}>Slot #{slotNum + 1}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">Slot PW</Label>
                            <Input value={slotPasswordModal} onChange={(e) => setSlotPasswordModal(e.target.value)} placeholder="설정할 비밀번호 (선택)" className="col-span-3" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={confirmMatch} disabled={!selectedAccount || selectedSlot === null}>배정 확인</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </main>
    );
}
