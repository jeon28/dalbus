"use client";

import React, { useEffect, useState } from 'react';
import { useServices } from '@/lib/ServiceContext';
import styles from '../admin.module.css';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
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
import { CheckCircle2, Circle, HelpCircle, Timer, Download, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import * as XLSX from 'xlsx';
import { addMonths, differenceInMonths, format, parseISO } from 'date-fns';

interface Profile {
    name?: string;
    email?: string;
    phone?: string;
}

interface Product {
    name: string;
}

interface ProductPlan {
    duration_months: number;
}

interface Order {
    id: string;
    created_at: string;
    order_number: string;
    order_type?: 'NEW' | 'EXT';
    amount: number;
    is_guest: boolean;
    buyer_name?: string;
    buyer_phone?: string;
    buyer_email?: string;
    profiles?: Profile;
    products?: Product;
    product_plans?: ProductPlan;
    assignment_status?: string;
    payment_status?: string;
    order_accounts?: OrderAccount[];
    related_order_id?: string;
    depositor_name?: string;
    end_date?: string;
}

interface OrderAccount {
    id: string;
    account_id: string;
    order_id: string;
    slot_number: number;
    tidal_id?: string;
    start_date?: string;
    end_date?: string;
    type?: 'master' | 'member';
    accounts?: Account;
    orders?: Order;
}

interface Account {
    id: string;
    login_id: string;
    memo?: string;
    max_slots: number;
    used_slots: number;
    order_accounts?: OrderAccount[];
}

export default function OrderHistoryPage() {
    const { isAdmin, isHydrated } = useServices();
    const [orders, setOrders] = useState<Order[]>([]);
    const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
    const [selectedOrderTypes, setSelectedOrderTypes] = useState<string[]>([]);
    const [selectedGuestTypes, setSelectedGuestTypes] = useState<string[]>([]);
    const [phoneSearch, setPhoneSearch] = useState<string>('');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' | null }>({ key: 'created_at', direction: 'desc' });
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

    const orderTypes = [
        {
            value: "NEW",
            label: "신규",
        },
        {
            value: "EXT",
            label: "연장",
        },
    ]

    const guestTypes = [
        {
            value: "member",
            label: "회원",
        },
        {
            value: "guest",
            label: "비회원",
        },
    ]

    // Matching Modal State
    const [isMatchModalOpen, setIsMatchModalOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [availableAccounts, setAvailableAccounts] = useState<Account[]>([]);
    const [selectedAccount, setSelectedAccount] = useState<string>('');
    const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
    const [slotPasswordModal, setSlotPasswordModal] = useState('');
    const [previousAssignment, setPreviousAssignment] = useState<OrderAccount | null>(null);
    const [extDuration, setExtDuration] = useState<number>(7);
    const [extEndDate, setExtEndDate] = useState<string>('');

    // New Order Assignment State
    const [newTidalId, setNewTidalId] = useState('');
    const [newTidalPw, setNewTidalPw] = useState('');
    const [newStartDate, setNewStartDate] = useState('');
    const [newEndDate, setNewEndDate] = useState('');
    const [newDuration, setNewDuration] = useState<number>(1);
    const [newBuyerName, setNewBuyerName] = useState('');
    const [newBuyerEmail, setNewBuyerEmail] = useState('');

    useEffect(() => {
        if (isHydrated && !isAdmin) {
            router.push('/admin');
        } else if (isHydrated && isAdmin) {
            fetchOrders();
        }
    }, [isAdmin, isHydrated, router]);

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

    const getOrderStatus = (order: Order) => {
        if (order.assignment_status === 'completed') return '작업완료';
        if (order.assignment_status === 'assigned') return '배정완료'; // Linked
        if (order.payment_status === 'paid') return '입금확인';
        return '주문신청'; // Pending payment
    };

    const exportToExcel = () => {
        const data = filteredOrders.map(order => ({
            '날짜': new Date(order.created_at).toLocaleDateString(),
            '주문번호': order.order_number,
            '구분': order.order_type === 'NEW' ? '신규' : '연장',
            '회원여부': order.is_guest ? '비회원' : '회원',
            '고객명': (order.profiles?.name || order.buyer_name || 'Unknown') +
                (order.depositor_name && order.depositor_name !== (order.profiles?.name || order.buyer_name) ? ` (${order.depositor_name})` : ''),
            '이메일': order.profiles?.email || order.buyer_email || '-',
            '연락처': order.profiles?.phone || order.buyer_phone || '-',
            '서비스': order.products?.name || 'Product',
            '이용기간': order.product_plans?.duration_months || 0,
            '금액': order.amount?.toLocaleString() + '원',
            '상태': getOrderStatus(order)
        }));

        // Create workbook
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, '주문 내역');

        // Generate file
        const fileName = `주문내역_${new Date().toLocaleDateString()}.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    const handleOpenMatchModal = async (order: Order) => {
        setSelectedOrder(order);
        setSelectedAccount('');
        setSelectedSlot(null);
        setSlotPasswordModal('');
        setPreviousAssignment(null);

        // Reset New Order States
        setNewTidalId('');
        setNewTidalPw('');
        setNewStartDate('');
        setNewEndDate('');
        setNewDuration(order.product_plans?.duration_months || 1);
        setNewBuyerName(order.profiles?.name || order.buyer_name || '');
        setNewBuyerEmail(order.profiles?.email || order.buyer_email || '');

        let prev = null;

        // 1. If it's an extension, find the assignment of the related order
        if (order.order_type === 'EXT') {
            try {
                // Try finding by related_order_id first, then fallback to buyer_email
                const lookupId = order.related_order_id || order.id;
                const res = await fetch(`/api/admin/orders/${lookupId}/assignment`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.assignment) {
                        prev = data.assignment;
                        setPreviousAssignment(prev);
                        console.log('Found previous assignment:', prev);
                    }
                }
            } catch (error) {
                console.error('Failed to fetch previous assignment:', error);
            }
        }

        // 2. Fetch available accounts
        try {
            const res = await fetch('/api/admin/accounts');
            if (res.ok) {
                const data = await res.json();

                // Filter accounts with available slots
                // Note: For extensions, the account of the previous assignment should be included even if it's full (since we'll be re-using a slot)
                let available = data.filter((acc: Account) => acc.used_slots < acc.max_slots);

                if (prev) {
                    const alreadyIn = available.some((acc: Account) => acc.id === prev.account_id);
                    if (!alreadyIn) {
                        const prevAcc = data.find((acc: Account) => acc.id === prev.account_id);
                        if (prevAcc) {
                            available = [prevAcc, ...available];
                        }
                    }
                }

                // Sort by:
                // 1. Master account expiry date (end_date) - descending (most time remaining first)
                // 2. Available slots - descending (most available slots first)
                available.sort((a: Account, b: Account) => {
                    const getExpiry = (acc: Account) => {
                        const masterSlot = acc.order_accounts?.find((oa: OrderAccount) => oa.type === 'master');
                        return masterSlot?.end_date || '0000-00-00';
                    };
                    const expiryA = getExpiry(a);
                    const expiryB = getExpiry(b);

                    if (expiryA !== expiryB) {
                        return expiryB.localeCompare(expiryA);
                    }

                    const slotsA = a.max_slots - a.used_slots;
                    const slotsB = b.max_slots - b.used_slots;
                    return slotsB - slotsA;
                });

                setAvailableAccounts(available);

                // Set selected account and slot if it's an extension
                if (prev) {
                    // Set default extension duration/expiry
                    const duration = 7; // Default as requested
                    setExtDuration(duration);

                    if (prev.end_date || prev.orders?.end_date) {
                        try {
                            const currentEnd = parseISO(prev.end_date || prev.orders.end_date);
                            const newEnd = format(addMonths(currentEnd, duration), 'yyyy-MM-dd');
                            setExtEndDate(newEnd);
                        } catch (e) {
                            console.error('Date calculation error:', e);
                        }
                    }

                    // Use timeout to ensure state is processed and Select component is ready
                    setTimeout(() => {
                        setSelectedAccount(prev.account_id);
                        setSelectedSlot(prev.slot_number);
                        console.log('Set selected account and slot:', prev.account_id, prev.slot_number);
                    }, 0);
                } else {
                    // Pre-calculate for NEW order
                    const email = order.profiles?.email || order.buyer_email || '';
                    const phone = order.profiles?.phone || order.buyer_phone || '';
                    const duration = order.product_plans?.duration_months || 1;
                    const start = format(new Date(), 'yyyy-MM-dd');
                    const end = format(addMonths(parseISO(start), duration), 'yyyy-MM-dd');

                    setNewStartDate(start);
                    setNewEndDate(end);
                    setNewDuration(duration);

                    // Generate Password from phone (last 8 digits or padded)
                    const purePhone = phone.replace(/[^0-9]/g, '');
                    const generatedPw = purePhone.length >= 8 ? purePhone.slice(-8) : purePhone.padEnd(8, '0');
                    setNewTidalPw(generatedPw);

                    // Generate Unique Tidal ID
                    if (email) {
                        const prefix = email.split('@')[0];
                        let finalId = `${prefix}@hifitidal.com`;

                        // Check for duplicates across ALL accounts' slots
                        const allTakenIds = new Set<string>();
                        data.forEach((acc: Account) => {
                            acc.order_accounts?.forEach((oa: OrderAccount) => {
                                if (oa.tidal_id) allTakenIds.add(oa.tidal_id.toLowerCase());
                            });
                        });

                        let counter = 1;
                        while (allTakenIds.has(finalId.toLowerCase())) {
                            finalId = `${prefix}${counter}@hifitidal.com`;
                            counter++;
                        }
                        setNewTidalId(finalId);
                    }
                }

                setIsMatchModalOpen(true);
            }
        } catch (error) {
            console.error('Failed to fetch available accounts:', error);
            alert('계정 목록 불러오기 실패');
        }
    };

    const getMasterInfo = (acc: Account) => {
        const masterSlot = acc.order_accounts?.find((oa: OrderAccount) => oa.type === 'master');
        if (!masterSlot || !masterSlot.orders) {
            return 'master 계정없음';
        }

        const tidalId = masterSlot.tidal_id || '';
        const endDate = masterSlot.end_date || '';
        let duration = '';

        if (masterSlot.start_date) {
            try {
                const startDate = parseISO(masterSlot.start_date);
                const now = new Date();
                const months = differenceInMonths(now, startDate);
                duration = `${months}개월`;
            } catch {
                duration = '-';
            }
        }

        return `${tidalId}/${endDate}/${duration}`;
    };

    const getAvailableSlots = (accountId: string) => {
        const acc = availableAccounts.find(a => a.id === accountId);
        if (!acc) return [];
        const takenSlots = new Set<number>();
        if (acc.order_accounts) {
            acc.order_accounts.forEach((oa: OrderAccount) => takenSlots.add(oa.slot_number));
        }
        const available = [];
        for (let i = 0; i < acc.max_slots; i++) {
            if (!takenSlots.has(i)) available.push(i);
        }
        return available;
    };

    const confirmMatch = async () => {
        if (!selectedOrder || !selectedAccount) return;

        // 자동으로 가장 낮은 번호의 빈 슬롯 선택 (단, 연장인 경우 기존 슬롯 고수)
        let targetSlot = selectedSlot;
        if (targetSlot === null) {
            const availableSlots = getAvailableSlots(selectedAccount);
            if (availableSlots.length === 0) {
                alert('사용 가능한 슬롯이 없습니다.');
                return;
            }
            targetSlot = availableSlots[0]; // 가장 낮은 번호 선택
        }

        try {
            const res = await fetch(`/api/admin/accounts/${selectedAccount}/assign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    order_id: selectedOrder.id,
                    slot_number: targetSlot,
                    tidal_password: selectedOrder.order_type === 'NEW' ? newTidalPw : slotPasswordModal,
                    tidal_id: selectedOrder.order_type === 'NEW' ? newTidalId : undefined,
                    buyer_name: selectedOrder.order_type === 'NEW' ? newBuyerName : undefined,
                    buyer_phone: undefined, // Already in order
                    buyer_email: selectedOrder.order_type === 'NEW' ? newBuyerEmail : undefined,
                    start_date: selectedOrder.order_type === 'NEW' ? newStartDate : undefined,
                    end_date: selectedOrder.order_type === 'NEW' ? newEndDate : extEndDate
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Match failed');
            }

            // Success: Close Modal and Refresh List
            setIsMatchModalOpen(false);
            fetchOrders();

            // Ask to redirect to Tidal Management
            if (confirm('배정되었습니다. Tidal 계정을 확인하시겠습니까?')) {
                router.push(`/admin/tidal?accountId=${selectedAccount}`);
            }

        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
            alert(message);
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

    const handleRevertPayment = async (orderId: string) => {
        if (!confirm('입금 확인을 취소하고 "주문신청" 상태로 되돌리시겠습니까?')) return;
        try {
            const res = await fetch(`/api/admin/orders/${orderId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ payment_status: 'pending' })
            });
            if (!res.ok) throw new Error('Revert failed');
            fetchOrders();
        } catch {
            alert('상태 변경 실패');
        }
    };

    const handleUnassign = async (order: Order) => {
        const assignmentId = order.order_accounts?.[0]?.id;
        if (!assignmentId) {
            alert('배정 정보가 없습니다.');
            return;
        }

        if (!confirm('배정을 취소하고 "입금확인" 상태로 되돌리시겠습니까?')) return;

        try {
            const res = await fetch(`/api/admin/assignments/${assignmentId}`, {
                method: 'DELETE'
            });
            if (!res.ok) throw new Error('Unassign failed');
            alert('배정이 취소되었습니다.');
            fetchOrders();
        } catch {
            alert('배정 취소 실패');
        }
    };

    const markAsCompleted = async (orderId: string) => {
        if (!confirm('작업완료 하시겠습니까 ?')) return;
        try {
            const res = await fetch(`/api/admin/orders/${orderId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ assignment_status: 'completed' })
            });

            if (!res.ok) throw new Error('Update failed');

            const result = await res.json();

            if (result.emailSent) {
                alert('작업이 완료되었으며, 고객에게 안내 메일이 발송되었습니다.');
            } else if (result.emailError) {
                alert(`작업 완료 처리되었으나 메일 발송에 실패했습니다.\n오류: ${result.emailError}`);
            } else {
                alert('작어 완료 처리되었습니다.');
            }

            fetchOrders();
        } catch {
            alert('상태 변경 실패');
        }
    };

    const handleDeleteOrder = async (order: Order) => {
        if (order.order_accounts && order.order_accounts.length > 0) {
            alert('배정된 계정이 있는 주문은 삭제할 수 없습니다. 먼저 배정 취소를 해주세요.');
            return;
        }

        if (!confirm(`주문번호 ${order.order_number} (${order.profiles?.name || order.buyer_name || '비회원'}) 내역을 삭제하시겠습니까?`)) {
            return;
        }

        try {
            const res = await fetch(`/api/admin/orders/${order.id}`, {
                method: 'DELETE'
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || '삭제 실패');
            }

            alert('삭제되었습니다.');
            fetchOrders();
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
            alert(message);
        }
    };

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' | null = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        } else if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = null;
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key: string) => {
        if (sortConfig.key !== key || !sortConfig.direction) return <ArrowUpDown className="ml-1 h-3 w-3" />;
        return sortConfig.direction === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />;
    };

    if (!isAdmin) return null;

    const renderTable = (list: Order[]) => (
        <div className={styles.tableWrapper}>
            <table className={styles.table}>
                <thead>
                    <tr>
                        <th onClick={() => handleSort('created_at')} className="cursor-pointer hover:bg-gray-50 transition-colors" style={{ width: '140px' }}>
                            <div className="flex items-center">날짜/주문번호 {getSortIcon('created_at')}</div>
                        </th>
                        <th>구분</th>
                        <th>회원여부</th>
                        <th onClick={() => handleSort('name')} className="cursor-pointer hover:bg-gray-50 transition-colors">
                            <div className="flex items-center">고객명 {getSortIcon('name')}</div>
                        </th>
                        <th>연락처/이메일</th>
                        <th>서비스</th>
                        <th>이용기간</th>
                        <th>금액</th>
                        <th onClick={() => handleSort('status')} className="cursor-pointer hover:bg-gray-50 transition-colors">
                            <div className="flex items-center">상태 {getSortIcon('status')}</div>
                        </th>
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
                                    <span className={`px-2 py-1 rounded text-xs font-medium
                                        ${o.order_type === 'NEW' ? 'bg-purple-100 text-purple-800' : 'bg-orange-100 text-orange-800'}`}>
                                        {o.order_type === 'NEW' ? '신규' : '연장'}
                                    </span>
                                </td>
                                <td>
                                    <span className={`px-2 py-1 rounded text-xs font-medium
                                        ${o.is_guest ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-800'}`}>
                                        {o.is_guest ? '비회원' : '회원'}
                                    </span>
                                </td>
                                <td>
                                    <div className="font-medium">
                                        {o.profiles?.name || o.buyer_name || 'Unknown'}
                                        {o.depositor_name && o.depositor_name !== (o.profiles?.name || o.buyer_name) && (
                                            <span className="text-xs text-orange-600 ml-1">
                                                ({o.depositor_name})
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td>
                                    <div className="text-sm">{o.profiles?.phone || o.buyer_phone || '-'}</div>
                                    <div className="text-xs text-gray-400">{o.profiles?.email || o.buyer_email || '-'}</div>
                                </td>
                                <td>
                                    <div>{o.products?.name || 'Product'}</div>
                                </td>
                                <td>
                                    <div className="font-mono">{o.product_plans?.duration_months || '-'}</div>
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
                                    <div className="flex flex-col gap-1">
                                        {status === '주문신청' && (
                                            <Button size="sm" variant="secondary" onClick={() => confirmPayment(o.id)}>입금확인</Button>
                                        )}
                                        {status === '입금확인' && (
                                            <>
                                                <Button size="sm" onClick={() => handleOpenMatchModal(o)}>계정배정</Button>
                                                <Button size="sm" variant="ghost" className="text-xs text-gray-400 h-7" onClick={() => handleRevertPayment(o.id)}>입금취소</Button>
                                            </>
                                        )}
                                        {status === '배정완료' && (
                                            <>
                                                <Button size="sm" variant="outline" onClick={() => markAsCompleted(o.id)}>작업완료</Button>
                                                <Button size="sm" variant="ghost" className="text-xs text-gray-400 h-7" onClick={() => handleUnassign(o)}>배정취소</Button>
                                            </>
                                        )}
                                        {o.order_accounts?.length === 0 && (
                                            <Button size="sm" variant="ghost" className="text-xs text-red-400 h-7 hover:text-red-600 hover:bg-red-50" onClick={() => handleDeleteOrder(o)}>삭제</Button>
                                        )}
                                    </div>
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

        // Order Type filter
        if (selectedOrderTypes.length > 0) {
            const type = order.order_type || 'NEW';
            if (!selectedOrderTypes.includes(type)) return false;
        }

        // Guest filter
        if (selectedGuestTypes.length > 0) {
            const guestType = order.is_guest ? 'guest' : 'member';
            if (!selectedGuestTypes.includes(guestType)) return false;
        }

        // Phone number filter
        if (phoneSearch) {
            const phone = order.profiles?.phone || order.buyer_phone || '';
            if (!phone.includes(phoneSearch)) return false;
        }

        return true;
    }).sort((a, b) => {
        if (!sortConfig.direction || !sortConfig.key) return 0;

        let aValue: string | number = '';
        let bValue: string | number = '';

        if (sortConfig.key === 'created_at') {
            aValue = new Date(a.created_at).getTime();
            bValue = new Date(b.created_at).getTime();
        } else if (sortConfig.key === 'name') {
            aValue = a.profiles?.name || a.buyer_name || '';
            bValue = b.profiles?.name || b.buyer_name || '';
        } else if (sortConfig.key === 'status') {
            aValue = getOrderStatus(a);
            bValue = getOrderStatus(b);
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

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
                            title="구분"
                            options={orderTypes}
                            selectedValues={selectedOrderTypes}
                            setFilter={setSelectedOrderTypes}
                        />
                        <DataTableFacetedFilter
                            title="회원여부"
                            options={guestTypes}
                            selectedValues={selectedGuestTypes}
                            setFilter={setSelectedGuestTypes}
                        />
                        <DataTableFacetedFilter
                            title="Status"
                            options={statuses}
                            selectedValues={selectedStatuses}
                            setFilter={setSelectedStatuses}
                        />
                    </div>
                    {renderTable(filteredOrders)}
                </section>
            </div>

            <Dialog open={isMatchModalOpen} onOpenChange={setIsMatchModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>계정 배정</DialogTitle>
                        <DialogDescription className="sr-only">
                            주문에 마스터 계정과 슬롯을 배정합니다.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-2 space-y-4 max-h-[70vh] overflow-y-auto px-1">
                        {previousAssignment ? (
                            <div className="space-y-4">
                                {/* 1. Master Account Info */}
                                <div className="space-y-2">
                                    <h3 className="text-sm font-bold flex items-center gap-2">
                                        <div className="w-1 h-4 bg-blue-500 rounded-full" />
                                        마스터 계정
                                    </h3>
                                    <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs bg-blue-50/50 p-4 rounded-xl border border-blue-100 shadow-sm">
                                        <div className="flex items-center space-x-2">
                                            <span className="text-gray-500 shrink-0">결제계좌:</span>
                                            <span className="font-semibold text-blue-700 truncate">{previousAssignment.accounts?.login_id || '-'}</span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <span className="text-gray-500 shrink-0">잔여개월수:</span>
                                            <span className="font-semibold text-blue-700">{previousAssignment.accounts?.memo || '0개월'}</span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <span className="text-gray-500 shrink-0">잔여 slot:</span>
                                            <span className="font-semibold text-blue-700">{(previousAssignment.accounts?.max_slots || 0) - (previousAssignment.accounts?.used_slots || 0)}개</span>
                                        </div>
                                    </div>
                                </div>

                                {/* 2. Extension Order Info */}
                                <div className="space-y-2">
                                    <h3 className="text-sm font-bold flex items-center gap-2 text-orange-600">
                                        <div className="w-1 h-4 bg-orange-500 rounded-full" />
                                        연장 주문
                                    </h3>
                                    <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs bg-orange-50/30 p-4 rounded-xl border border-orange-100 shadow-sm">
                                        <div className="flex items-center space-x-2">
                                            <span className="text-gray-500 shrink-0">Tidal ID:</span>
                                            <span className="font-semibold text-orange-800">{previousAssignment.tidal_id || '-'}</span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <span className="text-gray-500 shrink-0">이름:</span>
                                            <span className="font-semibold text-orange-800">{selectedOrder?.profiles?.name || selectedOrder?.buyer_name || '-'}</span>
                                        </div>
                                        <div className="col-span-2 flex items-center space-x-2">
                                            <span className="text-gray-500 shrink-0">이메일:</span>
                                            <span className="font-semibold text-orange-800 truncate">{selectedOrder?.profiles?.email || selectedOrder?.buyer_email || '-'}</span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <span className="text-gray-500 shrink-0">가입일:</span>
                                            <span className="font-medium">{previousAssignment.start_date || '-'}</span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <span className="text-gray-600 font-medium shrink-0">종료예정일:</span>
                                            <span className="font-bold text-orange-600 underline">
                                                {previousAssignment.end_date || '-'}
                                            </span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <span className="text-gray-500 shrink-0">개월:</span>
                                            <span className="font-medium">{previousAssignment.orders?.product_plans?.duration_months || '-'}개월</span>
                                        </div>
                                    </div>
                                </div>

                                {/* 3. Change Info (Active Modification) */}
                                <div className="space-y-2 pt-2 border-t border-dashed">
                                    <h3 className="text-sm font-bold flex items-center gap-2 text-green-700">
                                        <div className="w-1 h-4 bg-green-600 rounded-full" />
                                        변경 정보
                                    </h3>
                                    <div className="space-y-4 bg-green-50/20 p-4 rounded-xl border border-green-100/50 shadow-inner">
                                        <div className="flex items-center justify-between gap-4">
                                            <Label className="text-xs font-semibold text-gray-600">개월수 변경</Label>
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    type="number"
                                                    value={extDuration}
                                                    onChange={(e) => {
                                                        const val = parseInt(e.target.value) || 0;
                                                        setExtDuration(val);
                                                        const baseDate = previousAssignment.end_date;
                                                        if (baseDate) {
                                                            try {
                                                                const newEnd = format(addMonths(parseISO(baseDate), val), 'yyyy-MM-dd');
                                                                setExtEndDate(newEnd);
                                                            } catch (err) {
                                                                console.error('Calc Error:', err);
                                                            }
                                                        }
                                                    }}
                                                    className="w-24 h-9 text-center font-bold text-green-700 border-green-200 focus:ring-green-500"
                                                />
                                                <span className="text-xs font-medium text-gray-500">개월</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between gap-4">
                                            <Label className="text-xs font-semibold text-gray-600">수정 종료일</Label>
                                            <Input
                                                type="date"
                                                value={extEndDate}
                                                onChange={(e) => setExtEndDate(e.target.value)}
                                                className="w-40 h-9 text-sm font-semibold text-green-700 border-green-200 focus:ring-green-500"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label className="text-right">마스터 계정</Label>
                                    <Select onValueChange={setSelectedAccount} value={selectedAccount}>
                                        <SelectTrigger className="col-span-3"><SelectValue placeholder="마스터 계정 선택" /></SelectTrigger>
                                        <SelectContent>
                                            {availableAccounts.map(acc => (
                                                <SelectItem key={acc.id} value={acc.id}>
                                                    <div className="text-xs">
                                                        {acc.login_id}/{getMasterInfo(acc)}/잔여 {acc.max_slots - acc.used_slots}
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                {selectedAccount && (
                                    <>
                                        {/* New Order Info Section */}
                                        <div className="space-y-2 pt-2 border-t border-dashed">
                                            <h3 className="text-sm font-bold flex items-center gap-2 text-purple-600">
                                                <div className="w-1 h-4 bg-purple-500 rounded-full" />
                                                신규 고객 정보
                                            </h3>
                                            <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs bg-purple-50/30 p-4 rounded-xl border border-purple-100 shadow-sm">
                                                <div className="col-span-2 space-y-1">
                                                    <Label className="text-[10px] text-gray-400">Tidal ID</Label>
                                                    <Input
                                                        value={newTidalId}
                                                        onChange={(e) => setNewTidalId(e.target.value)}
                                                        className="h-8 text-xs font-semibold text-purple-800"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-[10px] text-gray-400">비밀번호</Label>
                                                    <Input
                                                        value={newTidalPw}
                                                        onChange={(e) => setNewTidalPw(e.target.value)}
                                                        className="h-8 text-xs font-semibold"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-[10px] text-gray-400">이름</Label>
                                                    <Input
                                                        value={newBuyerName}
                                                        onChange={(e) => setNewBuyerName(e.target.value)}
                                                        className="h-8 text-xs font-semibold"
                                                    />
                                                </div>
                                                <div className="col-span-2 space-y-1">
                                                    <Label className="text-[10px] text-gray-400">이메일</Label>
                                                    <Input
                                                        value={newBuyerEmail}
                                                        onChange={(e) => setNewBuyerEmail(e.target.value)}
                                                        className="h-8 text-xs font-semibold"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-[10px] text-gray-400">가입일</Label>
                                                    <Input
                                                        type="date"
                                                        value={newStartDate}
                                                        onChange={(e) => {
                                                            const start = e.target.value;
                                                            setNewStartDate(start);
                                                            try {
                                                                const end = format(addMonths(parseISO(start), newDuration), 'yyyy-MM-dd');
                                                                setNewEndDate(end);
                                                            } catch (err) { console.error(err); }
                                                        }}
                                                        className="h-8 text-xs font-medium"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-[10px] text-gray-400 text-purple-600 font-bold">종료예정일</Label>
                                                    <Input
                                                        type="date"
                                                        value={newEndDate}
                                                        onChange={(e) => setNewEndDate(e.target.value)}
                                                        className="h-8 text-xs font-bold text-purple-700 bg-white"
                                                    />
                                                </div>
                                                <div className="col-span-2 flex items-center justify-between gap-4 pt-1">
                                                    <Label className="text-[10px] text-gray-400">개월수</Label>
                                                    <div className="flex items-center gap-2">
                                                        <Input
                                                            type="number"
                                                            value={newDuration}
                                                            onChange={(e) => {
                                                                const val = parseInt(e.target.value) || 0;
                                                                setNewDuration(val);
                                                                try {
                                                                    const end = format(addMonths(parseISO(newStartDate), val), 'yyyy-MM-dd');
                                                                    setNewEndDate(end);
                                                                } catch (err) { console.error(err); }
                                                            }}
                                                            className="w-16 h-7 text-center text-xs font-bold text-purple-700"
                                                        />
                                                        <span className="text-[10px] text-gray-500">개월</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-[11px] text-gray-500 bg-blue-50/50 p-2 rounded-md flex items-start gap-1.5 border border-blue-100/50">
                                            <HelpCircle className="w-3.5 h-3.5 text-blue-400 mt-0.5" />
                                            <span>슬롯은 가장 낮은 번호의 빈 슬롯으로 자동 배정됩니다.</span>
                                        </div>
                                    </>
                                )}
                            </>
                        )}
                    </div>
                    <DialogFooter>
                        <Button onClick={confirmMatch} disabled={!selectedAccount}>배정 확인</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </main>
    );
}
