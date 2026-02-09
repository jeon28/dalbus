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
import { DataTableFacetedFilter } from "@/components/ui/data-table-faceted-filter";
import { CheckCircle2, Circle, HelpCircle, Timer, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import * as XLSX from 'xlsx';


export default function OrderHistoryPage() {
    const { isAdmin } = useServices();
    const [orders, setOrders] = useState<Record<string, any>[]>([]);
    const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
    const [phoneSearch, setPhoneSearch] = useState<string>('');
    const router = useRouter();

    const statuses = [
        {
            value: "주문신청",
            label: "주문신청",
            icon: Circle,
        },
        {
            value: "입금확인",
            label: "입금확인",
            icon: Timer,
        },
        {
            value: "배정완료",
            label: "배정완료",
            icon: CheckCircle2,
        },
        {
            value: "작업완료",
            label: "작업완료",
            icon: HelpCircle,
        },
    ]

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
    }, [isAdmin, router]);

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

    const exportToExcel = () => {
        // Prepare data for member orders
        const memberData = memberOrders.map(order => ({
            '날짜': new Date(order.created_at).toLocaleDateString(),
            '주문번호': order.order_number,
            '고객명': order.profiles?.name || order.buyer_name || 'Unknown',
            '이메일': order.profiles?.email || order.buyer_email || '-',
            '연락처': order.profiles?.phone || order.buyer_phone || '-',
            '서비스': order.products?.name || 'Product',
            '이용기간': order.product_plans?.duration_months ? `${order.product_plans.duration_months}개월` : '-',
            '금액': order.amount?.toLocaleString() + '원',
            '상태': getOrderStatus(order)
        }));

        // Prepare data for guest orders
        const guestData = guestOrders.map(order => ({
            '날짜': new Date(order.created_at).toLocaleDateString(),
            '주문번호': order.order_number,
            '고객명': order.profiles?.name || order.buyer_name || 'Unknown',
            '이메일': order.profiles?.email || order.buyer_email || '-',
            '연락처': order.profiles?.phone || order.buyer_phone || '-',
            '서비스': order.products?.name || 'Product',
            '이용기간': order.product_plans?.duration_months ? `${order.product_plans.duration_months}개월` : '-',
            '금액': order.amount?.toLocaleString() + '원',
            '상태': getOrderStatus(order)
        }));

        // Create workbook
        const wb = XLSX.utils.book_new();

        // Create worksheets
        const wsMember = XLSX.utils.json_to_sheet(memberData);
        const wsGuest = XLSX.utils.json_to_sheet(guestData);

        // Add worksheets to workbook
        XLSX.utils.book_append_sheet(wb, wsMember, '회원 주문');
        XLSX.utils.book_append_sheet(wb, wsGuest, '비회원 주문');

        // Generate file
        const fileName = `주문내역_${new Date().toLocaleDateString()}.xlsx`;
        XLSX.writeFile(wb, fileName);
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
        } catch {
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
        } catch {
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
        } catch {
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
        } catch {
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
                                <td>
                                    <div>{o.products?.name || 'Product'}</div>
                                    {o.product_plans?.duration_months && (
                                        <div className="text-[10px] text-gray-400">
                                            이용기간: {o.product_plans.duration_months}개월
                                        </div>
                                    )}
                                </td>
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
                                        <Button size="sm" onClick={() => handleOpenMatchModal(o)}>계정배정</Button>
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

    const filteredOrders = orders.filter(order => {
        // Status filter
        if (selectedStatuses.length > 0) {
            const status = getOrderStatus(order);
            if (!selectedStatuses.includes(status)) return false;
        }

        // Phone number filter
        if (phoneSearch) {
            const phone = order.profiles?.phone || order.buyer_phone || '';
            if (!phone.includes(phoneSearch)) return false;
        }

        return true;
    });

    const memberOrders = filteredOrders.filter(o => !o.is_guest);
    const guestOrders = filteredOrders.filter(o => o.is_guest);

    return (
        <main className={styles.main}>
            <header className={`${styles.header} glass`}>
                <div className="container">
                    <h1 className={styles.title}>주문 내역 관리</h1>
                </div>
            </header>

            <div className={`${styles.content} container`}>
                <section className={styles.orderSection}>
                    <div className="flex items-center gap-4 mb-4 justify-end">
                        <Button onClick={exportToExcel} variant="outline" size="sm">
                            <Download className="mr-2 h-4 w-4" />
                            엑셀 다운로드
                        </Button>
                        <Input
                            placeholder="전화번호 검색..."
                            value={phoneSearch}
                            onChange={(e) => setPhoneSearch(e.target.value)}
                            className="max-w-xs"
                        />
                        <DataTableFacetedFilter
                            title="Status"
                            options={statuses}
                            selectedValues={selectedStatuses}
                            setFilter={setSelectedStatuses}
                        />
                    </div>
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
                            <Label className="text-right">마스터 계정 선택</Label>
                            <Select onValueChange={setSelectedAccount} value={selectedAccount}>
                                <SelectTrigger className="col-span-3"><SelectValue placeholder="마스터 계정 선택" /></SelectTrigger>
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
                    </div>
                    <DialogFooter>
                        <Button onClick={confirmMatch} disabled={!selectedAccount || selectedSlot === null}>배정 확인</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </main>
    );
}
