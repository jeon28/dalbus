"use client";

import React, { useEffect, useState } from 'react';
import { useServices } from '@/lib/ServiceContext';
import styles from '../admin.module.css';
import { useRouter } from 'next/navigation';
import { Plus, ChevronDown, ChevronUp, Trash2, ArrowRightLeft, Save } from 'lucide-react';
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { differenceInMonths, parseISO } from 'date-fns';

interface Assignment {
    id: string;
    slot_number: number;
    slot_password?: string;
    order_id?: string;
    orders?: Order;
}

interface Account {
    id: string;
    login_id: string;
    login_pw: string;
    payment_email: string;
    memo: string;
    product_id: string;
    max_slots: number;
    used_slots: number;
    order_accounts?: Assignment[];
}

interface Order {
    id: string;
    order_number: string;
    buyer_name: string;
    buyer_email: string;
    buyer_phone: string;
    amount?: number;
    payment_status?: string;
    assignment_status?: string;
    start_date: string;
    end_date: string;
    products?: {
        name: string;
    };
    profiles?: {
        name: string;
        phone?: string;
        email?: string;
    };
}
interface GridValue {
    login_id?: string;
    login_pw?: string;
    order_number?: string;
    buyer_name?: string;
    start_date?: string;
    end_date?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
}

export default function TidalAccountsPage() {
    const { isAdmin } = useServices();
    const router = useRouter();
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

    // Grid State: Store edits locally before save
    const [gridValues, setGridValues] = useState<Record<string, GridValue>>({});
    const [editingSlots, setEditingSlots] = useState<Record<string, boolean>>({});

    const startEdit = (accountId: string, slotIdx: number) => {
        setEditingSlots(prev => ({ ...prev, [`${accountId}_${slotIdx}`]: true }));
    };

    const cancelEdit = (accountId: string, slotIdx: number) => {
        setEditingSlots(prev => {
            const newEditingSlots = { ...prev };
            delete newEditingSlots[`${accountId}_${slotIdx}`];
            return newEditingSlots;
        });
        // Revert gridValues for this slot to original fetched data
        fetchAccounts(); // Re-fetch all to ensure data consistency
    };

    // Modals
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);

    const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
    const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
    const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
    const [isOrderDetailOpen, setIsOrderDetailOpen] = useState(false);
    const [viewOrder, setViewOrder] = useState<Order | null>(null);

    // Order Data
    const [pendingOrders, setPendingOrders] = useState<Order[]>([]);

    // Move Data
    const [moveTargets, setMoveTargets] = useState<Account[]>([]);
    const [selectedTargetAccount, setSelectedTargetAccount] = useState<string>('');
    const [selectedTargetSlot, setSelectedTargetSlot] = useState<number | null>(null);

    // Forms
    const [newAccount, setNewAccount] = useState({
        login_id: '',
        login_pw: '',
        payment_email: '',
        memo: '',
        product_id: '',
        max_slots: 6
    });

    const [slotPasswordModal, setSlotPasswordModal] = useState('');

    useEffect(() => {
        if (!isAdmin) {
            router.push('/admin');
        } else {
            fetchAccounts();
            fetchPendingOrders();
        }
    }, [isAdmin, router]);

    const fetchAccounts = async () => {

        try {
            const res = await fetch('/api/admin/accounts');
            if (!res.ok) throw new Error('Failed to fetch accounts');
            const data = await res.json();
            setAccounts(data);

            // Initialize Grid Values from fetched data
            const initialGrid: Record<string, GridValue> = {};
            data.forEach((acc: Account) => {
                for (let i = 0; i < acc.max_slots; i++) {
                    const assignment = acc.order_accounts?.find((oa: Assignment) => oa.slot_number === i);
                    // For Slot 1 (i===0), default to Master Password if no specific slot password exists
                    let defaultPw = assignment?.slot_password || '';
                    if (i === 0 && !defaultPw) {
                        defaultPw = acc.login_pw;
                    }

                    initialGrid[`${acc.id}_${i}`] = {
                        assignment_id: assignment?.id,
                        buyer_email: assignment?.orders?.buyer_email || '',
                        slot_password: defaultPw,
                        buyer_name: assignment?.orders?.buyer_name || assignment?.orders?.profiles?.name || '',
                        buyer_phone: assignment?.orders?.buyer_phone || assignment?.orders?.profiles?.phone || '',
                        start_date: assignment?.orders?.start_date || '',
                        end_date: assignment?.orders?.end_date || '',
                        order_number: assignment?.orders?.order_number || '', // Readonly mostly
                    };
                }
            });
            setGridValues(initialGrid);

        } catch (error) {
            console.error(error);
        }

    };

    const fetchPendingOrders = async () => {
        try {
            const res = await fetch('/api/admin/orders');
            if (res.ok) {
                const data = await res.json();
                const waiting = data.filter((o: Order) =>
                    o.payment_status === 'paid' &&
                    o.assignment_status === 'waiting'
                );
                setPendingOrders(waiting);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const toggleRow = (id: string) => {
        const newSet = new Set(expandedRows);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setExpandedRows(newSet);
    };

    const updateGridValue = (accountId: string, slotIdx: number, field: string, value: string | number | null) => {
        const key = `${accountId}_${slotIdx}`;
        setGridValues(prev => ({
            ...prev,
            [key]: {
                ...prev[key],
                [field]: value
            }
        }));
    };

    // --- Actions ---

    const handleSaveRow = async (accountId: string, slotIdx: number) => {
        const key = `${accountId}_${slotIdx}`;
        const data = gridValues[key];

        if (!data) return;

        try {
            if (data.assignment_id) {
                // UPDATE existing assignment
                const res = await fetch(`/api/admin/assignments/${data.assignment_id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                if (!res.ok) throw new Error('Update failed');
            } else {
                // CREATE new assignment (Manual Order)
                if (!data.buyer_name && !data.buyer_email) {
                    alert('이름 또는 ID(이메일)를 입력해주세요.');
                    return;
                }

                const res = await fetch(`/api/admin/accounts/${accountId}/assign`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        slot_number: slotIdx,
                        slot_password: data.slot_password,
                        // Manual fields
                        buyer_name: data.buyer_name,
                        buyer_phone: data.buyer_phone,
                        buyer_email: data.buyer_email,
                        start_date: data.start_date,
                        end_date: data.end_date
                    })
                });
                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Create failed');
                }
            }

            // Success
            alert('저장되었습니다.');
            setEditingSlots(prev => ({ ...prev, [key]: false })); // Exit edit mode
            fetchAccounts();
        } catch (e) {
            const error = e as Error;
            alert('저장 실패: ' + error.message);
        }
    };

    const handleDelete = async (assignmentId: string) => {
        if (!confirm('정말 삭제(배정 해제)하시겠습니까?')) return;
        try {
            const res = await fetch(`/api/admin/assignments/${assignmentId}`, {
                method: 'DELETE',
            });
            if (!res.ok) throw new Error('Delete failed');
            fetchAccounts();
            fetchPendingOrders();
        } catch {
            alert('삭제 실패');
        }
    };

    const handleCreateAccount = async () => {
        try {
            const prodRes = await fetch('/api/admin/products');
            const products = await prodRes.json();
            const tidal = products.find((p: { name: string; id: string }) => p.name.includes('Tidal')) || products[0];

            const payload = { ...newAccount, product_id: tidal?.id };

            const res = await fetch('/api/admin/accounts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error('Failed to create account');

            setIsAddModalOpen(false);
            fetchAccounts();
            setNewAccount({ login_id: '', login_pw: '', payment_email: '', memo: '', product_id: '', max_slots: 6 });
        } catch {
            alert('계정 생성 실패');
        }
    };

    // --- Modals --- (Assign/Move)

    const openAssignModal = (account: Account, slotIndex: number) => {
        setSelectedAccount(account);
        setSelectedSlot(slotIndex);
        setSlotPasswordModal('');
        setIsAssignModalOpen(true);
    };

    const openOrderDetail = (order: Order) => {
        setViewOrder(order);
        setIsOrderDetailOpen(true);
    };

    const handleAssign = async (orderId: string) => {
        if (!selectedAccount || selectedSlot === null) return;
        try {
            const res = await fetch(`/api/admin/accounts/${selectedAccount.id}/assign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    order_id: orderId,
                    slot_number: selectedSlot,
                    slot_password: slotPasswordModal
                })
            });
            if (!res.ok) throw new Error('Failed');

            // Success: Exit Edit Mode for this slot
            const key = `${selectedAccount.id}_${selectedSlot}`;
            setEditingSlots(prev => ({ ...prev, [key]: false }));

            setIsAssignModalOpen(false);
            fetchAccounts();
            fetchPendingOrders();
        } catch {
            alert('배정 실패');
        }
    };

    const openMoveModal = (currentAssignment: Assignment) => {
        setSelectedAssignment(currentAssignment);
        setMoveTargets(accounts.filter(a => a.used_slots < a.max_slots));
        setSelectedTargetAccount('');
        setSelectedTargetSlot(null);
        setSlotPasswordModal(currentAssignment.slot_password || '');
        setIsMoveModalOpen(true);
    };

    const handleMove = async () => {
        // ... Move logic ...
        try {
            if (!selectedAssignment?.orders?.id) {
                alert('이동할 주문 정보가 없습니다.');
                return;
            }
            const res = await fetch('/api/admin/accounts/move', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    order_id: selectedAssignment.orders.id,
                    target_account_id: selectedTargetAccount,
                    target_slot_number: selectedTargetSlot,
                    target_slot_password: selectedAssignment?.slot_password // Use existing Pw
                })
            });
            if (!res.ok) throw new Error('Failed');
            setIsMoveModalOpen(false);
            fetchAccounts();
        } catch {
            alert('이동 실패');
        }
    };

    // ...

    const getAvailableSlots = (accountId: string) => {
        const acc = accounts.find(a => a.id === accountId);
        if (!acc) return [];
        const takenSlots = new Set<number>();
        if (acc.order_accounts) {
            acc.order_accounts.forEach((oa: Assignment) => takenSlots.add(oa.slot_number));
        }
        const available = [];
        for (let i = 0; i < acc.max_slots; i++) {
            if (!takenSlots.has(i)) available.push(i);
        }
        return available;
    };


    if (!isAdmin) return null;

    return (
        <main className={styles.main}>
            <header className={`${styles.header} glass`}>
                <div className="container flex justify-between items-center">
                    <h1 className={styles.title}>Tidal 계정 관리 (V2.2)</h1>
                    <Button onClick={() => setIsAddModalOpen(true)} className="gap-2">
                        <Plus size={16} /> 계정 추가
                    </Button>
                </div>
            </header>

            <div className={`${styles.content} container`}>
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="grid grid-cols-12 gap-4 p-4 bg-gray-50 font-bold border-b text-sm">
                        <div className="col-span-1">No.</div>
                        <div className="col-span-3">마스터 ID / 결제 ID</div>
                        <div className="col-span-2">비밀번호 (마스터)</div>
                        <div className="col-span-4">메모</div>
                        <div className="col-span-1 text-center">슬롯</div>
                        <div className="col-span-1 text-center">상세</div>
                    </div>

                    {accounts.map((acc, idx) => {
                        const isExpanded = expandedRows.has(acc.id);
                        const slots = Array.from({ length: 6 });

                        return (
                            <div key={acc.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                                <div className="grid grid-cols-12 gap-4 p-4 items-center text-sm cursor-pointer" onClick={() => toggleRow(acc.id)}>
                                    <div className="col-span-1 text-gray-500 font-mono">
                                        {String(idx + 1).padStart(3, '0')}
                                    </div>
                                    <div className="col-span-3">
                                        <div className="font-medium">{acc.login_id}</div>
                                        <div className="text-xs text-blue-600">{acc.payment_email}</div>
                                    </div>
                                    <div className="col-span-2 text-gray-400 font-mono">
                                        {acc.login_pw}
                                    </div>
                                    <div className="col-span-4 text-gray-500 text-xs">
                                        {acc.memo}
                                    </div>
                                    <div className="col-span-1 text-center">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${acc.used_slots >= 6 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                                            {acc.used_slots}/6
                                        </span>
                                    </div>
                                    <div className="col-span-1 text-center">
                                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="bg-white border-t p-4 overflow-x-auto">
                                        <table className="w-full text-xs min-w-[1200px]">
                                            <thead>
                                                <tr className="text-gray-400 border-b">
                                                    <th className="py-2 text-center w-12">Slot</th>
                                                    <th className="py-2 text-left w-32">ID (Email)</th>
                                                    <th className="py-2 text-left w-24">비밀번호</th>
                                                    <th className="py-2 text-left w-20">이름</th>
                                                    <th className="py-2 text-left w-28">전화번호</th>
                                                    <th className="py-2 text-left w-24">시작일</th>
                                                    <th className="py-2 text-left w-24">종료일</th>
                                                    <th className="py-2 text-center w-16">기간</th>
                                                    <th className="py-2 text-center w-24">주문번호</th>
                                                    <th className="py-2 text-center w-40">관리</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {slots.map((_, sIdx) => {
                                                    const assignment = acc.order_accounts?.find((oa: Assignment) => oa.slot_number === sIdx);
                                                    const key = `${acc.id}_${sIdx}`;
                                                    const val = gridValues[key] || {}; // Current Input Values
                                                    const isEditing = editingSlots[key];

                                                    // Period Calc for display
                                                    let period = '-';
                                                    if (val.start_date && val.end_date) {
                                                        try {
                                                            const start = parseISO(val.start_date);
                                                            const end = parseISO(val.end_date);
                                                            const diff = differenceInMonths(end, start);
                                                            if (diff > 0) period = `${diff}개월`;
                                                        } catch { }
                                                    }

                                                    return (
                                                        <tr key={sIdx} className="border-b last:border-0 h-10 hover:bg-gray-50">
                                                            <td className="text-center font-bold text-gray-500">#{sIdx + 1}</td>

                                                            {isEditing ? (
                                                                <>
                                                                    <td className="px-1">
                                                                        <Input className="h-8 text-xs bg-white" placeholder="ID/Email" value={val.buyer_email || ''} onChange={e => updateGridValue(acc.id, sIdx, 'buyer_email', e.target.value)} />
                                                                    </td>
                                                                    <td className="px-1">
                                                                        <Input className="h-8 text-xs bg-white" placeholder="PW" value={val.slot_password || ''} onChange={e => updateGridValue(acc.id, sIdx, 'slot_password', e.target.value)} />
                                                                    </td>
                                                                    <td className="px-1">
                                                                        <Input className="h-8 text-xs bg-white" placeholder="이름" value={val.buyer_name || ''} onChange={e => updateGridValue(acc.id, sIdx, 'buyer_name', e.target.value)} />
                                                                    </td>
                                                                    <td className="px-1">
                                                                        <Input className="h-8 text-xs bg-white" placeholder="전화번호" value={val.buyer_phone || ''} onChange={e => updateGridValue(acc.id, sIdx, 'buyer_phone', e.target.value)} />
                                                                    </td>
                                                                    <td className="px-1">
                                                                        <Input type="date" className="h-8 text-xs bg-white px-1" value={val.start_date || ''} onChange={e => updateGridValue(acc.id, sIdx, 'start_date', e.target.value)} />
                                                                    </td>
                                                                    <td className="px-1">
                                                                        <Input type="date" className="h-8 text-xs bg-white px-1" value={val.end_date || ''} onChange={e => updateGridValue(acc.id, sIdx, 'end_date', e.target.value)} />
                                                                    </td>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <td className="px-2 text-gray-700 truncate max-w-[120px]" title={val.buyer_email}>{val.buyer_email || '-'}</td>
                                                                    <td className="px-2 text-gray-700 font-mono truncate max-w-[80px]" title={val.slot_password}>{val.slot_password || '-'}</td>
                                                                    <td className="px-2 text-gray-700 truncate max-w-[80px]" title={val.buyer_name}>{val.buyer_name || '-'}</td>
                                                                    <td className="px-2 text-gray-700 truncate max-w-[100px]" title={val.buyer_phone}>{val.buyer_phone || '-'}</td>
                                                                    <td className="px-2 text-gray-500 font-mono">{val.start_date || '-'}</td>
                                                                    <td className="px-2 text-gray-500 font-mono">{val.end_date || '-'}</td>
                                                                </>
                                                            )}

                                                            <td className="text-center text-gray-500 font-mono">
                                                                {period}
                                                            </td>
                                                            <td className="text-center text-gray-400 font-mono text-[10px]">
                                                                {isEditing ? (
                                                                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => openAssignModal(acc, sIdx)}>
                                                                        주문
                                                                    </Button>
                                                                ) : (
                                                                    assignment?.orders ? (
                                                                        <button className="underline hover:text-blue-600" onClick={() => assignment.orders && openOrderDetail(assignment.orders)}>
                                                                            {val.order_number || 'No Number'}
                                                                        </button>
                                                                    ) : (
                                                                        <span>-</span>
                                                                    )
                                                                )}
                                                            </td>
                                                            <td className="text-center">
                                                                <div className="flex justify-center gap-1 items-center">
                                                                    {isEditing ? (
                                                                        <>
                                                                            <Button size="sm" variant="default" className="h-7 w-7 p-0 bg-blue-600 hover:bg-blue-700" title="저장" onClick={() => handleSaveRow(acc.id, sIdx)}>
                                                                                <Save size={14} />
                                                                            </Button>
                                                                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-500 hover:text-gray-700" title="취소" onClick={() => cancelEdit(acc.id, sIdx)}>
                                                                                X
                                                                            </Button>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs border-dashed text-gray-500 hover:text-blue-600 hover:border-blue-300"
                                                                                onClick={() => startEdit(acc.id, sIdx)}
                                                                            >
                                                                                {assignment ? '수정' : '신규'}
                                                                            </Button>

                                                                            {assignment && (
                                                                                <>
                                                                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-blue-600 ml-1" title="이동" onClick={() => openMoveModal(assignment)}>
                                                                                        <ArrowRightLeft size={14} />
                                                                                    </Button>
                                                                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-red-600" title="해제" onClick={() => handleDelete(assignment.id)}>
                                                                                        <Trash2 size={14} />
                                                                                    </Button>
                                                                                </>
                                                                            )}
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ... Modal Code (Assign/Add/Move) remains same ... */}
            {/* Copying previous modal code for completeness */}
            <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>새 계정 추가</DialogTitle></DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="login_id" className="text-right">ID (Email)</Label>
                            <Input id="login_id" value={newAccount.login_id} onChange={(e) => setNewAccount({ ...newAccount, login_id: e.target.value })} className="col-span-3" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="login_pw" className="text-right">Password</Label>
                            <Input id="login_pw" value={newAccount.login_pw} onChange={(e) => setNewAccount({ ...newAccount, login_pw: e.target.value })} className="col-span-3" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="payment_email" className="text-right">결제 ID</Label>
                            <Input id="payment_email" value={newAccount.payment_email} onChange={(e) => setNewAccount({ ...newAccount, payment_email: e.target.value })} className="col-span-3" placeholder="master@payment.com" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="memo" className="text-right">메모</Label>
                            <Input id="memo" value={newAccount.memo} onChange={(e) => setNewAccount({ ...newAccount, memo: e.target.value })} className="col-span-3" />
                        </div>
                    </div>
                    <DialogFooter><Button onClick={handleCreateAccount}>저장</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>주문 배정 (기존 주문)</DialogTitle></DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Label className="w-20 text-right">개별 PW</Label>
                            <Input
                                value={slotPasswordModal}
                                onChange={(e) => setSlotPasswordModal(e.target.value)}
                                placeholder="해당 슬롯용 비밀번호 (선택)"
                                className="flex-1"
                            />
                        </div>
                        <div className="border rounded-md max-h-60 overflow-y-auto">
                            {pendingOrders.length === 0 ? (
                                <div className="p-4 text-center text-gray-500 text-sm">대기 중인 결제 완료 주문이 없습니다.</div>
                            ) : (
                                pendingOrders.map(order => (
                                    <div key={order.id} className="flex justify-between items-center p-3 border-b last:border-0 hover:bg-gray-50">
                                        <div>
                                            <div className="font-bold text-sm">{order.buyer_name || order.profiles?.name}</div>
                                            <div className="text-xs text-gray-500">{order.products?.name}</div>
                                        </div>
                                        <Button size="sm" onClick={() => handleAssign(order.id)}>선택</Button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isMoveModalOpen} onOpenChange={setIsMoveModalOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>배정 이동</DialogTitle></DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="border p-2 rounded bg-gray-50 text-sm mb-4">
                            <div className="font-bold mb-1">이동 대상:</div>
                            <div>{selectedAssignment?.orders?.buyer_name} ({selectedAssignment?.orders?.buyer_phone})</div>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">이동할 계정</Label>
                            <Select onValueChange={setSelectedTargetAccount} value={selectedTargetAccount}>
                                <SelectTrigger className="col-span-3"><SelectValue placeholder="계정 선택" /></SelectTrigger>
                                <SelectContent>
                                    {moveTargets.map(acc => (
                                        <SelectItem key={acc.id} value={acc.id}>{acc.login_id} (잔여: {acc.max_slots - acc.used_slots})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        {selectedTargetAccount && (
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right">대상 Slot</Label>
                                <Select onValueChange={(val) => setSelectedTargetSlot(Number(val))} value={selectedTargetSlot?.toString()}>
                                    <SelectTrigger className="col-span-3"><SelectValue placeholder="슬롯 선택" /></SelectTrigger>
                                    <SelectContent>
                                        {getAvailableSlots(selectedTargetAccount).map(slotNum => (
                                            <SelectItem key={slotNum} value={slotNum.toString()}>Slot #{slotNum + 1}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        {/* Slot Password Input Removed as requested */}
                    </div>
                    <DialogFooter><Button onClick={handleMove} disabled={!selectedTargetAccount || selectedTargetSlot === null}>이동 확인</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isOrderDetailOpen} onOpenChange={setIsOrderDetailOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>주문 상세 정보</DialogTitle></DialogHeader>
                    {viewOrder && (
                        <div className="py-4 space-y-2 text-sm">
                            <div className="grid grid-cols-3 border-b pb-2">
                                <span className="font-bold text-gray-500">주문번호</span>
                                <span className="col-span-2">{viewOrder.order_number}</span>
                            </div>
                            <div className="grid grid-cols-3 border-b pb-2">
                                <span className="font-bold text-gray-500">구매자</span>
                                <span className="col-span-2">{viewOrder.buyer_name} / {viewOrder.buyer_email}</span>
                            </div>
                            <div className="grid grid-cols-3 border-b pb-2">
                                <span className="font-bold text-gray-500">연락처</span>
                                <span className="col-span-2">{viewOrder.buyer_phone}</span>
                            </div>
                            <div className="grid grid-cols-3 border-b pb-2">
                                <span className="font-bold text-gray-500">상품</span>
                                <span className="col-span-2">{viewOrder.products?.name}</span>
                            </div>
                            <div className="grid grid-cols-3 border-b pb-2">
                                <span className="font-bold text-gray-500">금액</span>
                                <span className="col-span-2">₩{viewOrder.amount?.toLocaleString()}</span>
                            </div>
                            <div className="grid grid-cols-3 border-b pb-2">
                                <span className="font-bold text-gray-500">이용 기간</span>
                                <span className="col-span-2">{viewOrder.start_date} ~ {viewOrder.end_date}</span>
                            </div>
                            <div className="grid grid-cols-3 border-b pb-2">
                                <span className="font-bold text-gray-500">상태</span>
                                <span className="col-span-2">{viewOrder.payment_status} / {viewOrder.assignment_status}</span>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button onClick={() => setIsOrderDetailOpen(false)}>닫기</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </main>
    );
}
