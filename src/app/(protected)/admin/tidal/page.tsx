"use client";

import React, { useEffect, useState, Suspense } from 'react';
import { useServices } from '@/lib/ServiceContext';
import styles from '../admin.module.css';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, ChevronDown, ChevronUp, Trash2, ArrowRightLeft, Save, Download, Pencil, Upload, LayoutGrid, List, History, PowerOff, Filter, Mail, X } from 'lucide-react';
import * as XLSX from 'xlsx';
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
import { differenceInMonths, parseISO, format } from 'date-fns';

interface Assignment {
    id: string;
    slot_number: number;
    tidal_password?: string;
    tidal_id?: string;
    order_id?: string;
    orders?: Order;
    type?: 'master' | 'user';
    buyer_name?: string;
    buyer_phone?: string;
    buyer_email?: string;
    order_number?: string;
    start_date?: string;
    end_date?: string;
    period_months?: number;
}

interface Account {
    id: string;
    login_id: string;
    login_pw: string;
    payment_email: string;
    payment_day: number;
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
    created_at: string;
    start_date?: string;
    end_date?: string;
    user_id?: string;
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
    assignment_id?: string;
    tidal_id: string | null;
    tidal_password: string;
    buyer_name: string;
    buyer_phone: string;
    buyer_email: string;
    start_date: string;
    end_date: string;
    order_number: string;
    type: 'master' | 'user';
    order_id?: string;
    full_order?: Order;
    period_months?: number;
}

function TidalAccountsContent() {
    const { isAdmin, isHydrated } = useServices();
    const router = useRouter();
    const searchParams = useSearchParams();

    // --- State ---
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [isGridView, setIsGridView] = useState(true);
    const [gridValues, setGridValues] = useState<Record<string, GridValue>>({});
    const [editingSlots, setEditingSlots] = useState<Record<string, boolean>>({});
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
    const [isImportResultModalOpen, setIsImportResultModalOpen] = useState(false);
    const [importResults, setImportResults] = useState<{
        success: { masters: number, slots: number },
        failed: { id: string, reason: string }[]
    } | null>(null);
    const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
    const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
    const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
    const [isOrderDetailOpen, setIsOrderDetailOpen] = useState(false);
    const [viewOrder, setViewOrder] = useState<Order | null>(null);
    const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
    const [moveTargets, setMoveTargets] = useState<Account[]>([]);
    const [selectedTargetAccount, setSelectedTargetAccount] = useState<string>('');
    const [selectedTargetSlot, setSelectedTargetSlot] = useState<number | null>(null);
    const [showExpiredOnly, setShowExpiredOnly] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
    const [newAccount, setNewAccount] = useState({
        login_id: '',
        login_pw: '',
        payment_email: '',
        payment_day: 1,
        memo: '',
        product_id: '',
        max_slots: 6
    });
    const [editingAccount, setEditingAccount] = useState<Account | null>(null);
    const [slotPasswordModal, setSlotPasswordModal] = useState('');
    const [selectedAssignmentIds, setSelectedAssignmentIds] = useState<Set<string>>(new Set());
    const [isNotifyModalOpen, setIsNotifyModalOpen] = useState(false);
    const [notificationMessage, setNotificationMessage] = useState('');
    const [isSendingNotify, setIsSendingNotify] = useState(false);

    const defaultTemplate = React.useMemo(() => `{buyer_name}님 
{tidal_id} 서비스가 {end_date}에 만료됩니다.

연장을 원하시면 아래 링크로 접속하여서 신청바랍니다.
${typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_SITE_URL}/public`, []);

    // --- Hooks & Effects ---
    useEffect(() => {
        setNotificationMessage(defaultTemplate);
    }, [defaultTemplate]);

    useEffect(() => {
        if (isHydrated && !isAdmin) router.push('/admin');
        else if (isHydrated && isAdmin) {
            fetchAccounts();
            fetchPendingOrders();
        }
    }, [isAdmin, isHydrated, router]);

    useEffect(() => {
        const accountId = searchParams.get('accountId');
        if (accountId && accounts.length > 0) {
            // Switch to List View (grouped view) and expand only the assigned account
            setIsGridView(false);
            setExpandedRows(new Set([accountId]));

            const scrollToAndHighlight = () => {
                const element = document.getElementById(`account-${accountId}`);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    element.style.transition = 'background-color 0.5s ease-in-out';
                    element.style.backgroundColor = '#e0f2fe';
                    setTimeout(() => { if (element) element.style.backgroundColor = ''; }, 3000);
                } else setTimeout(scrollToAndHighlight, 500);
            };
            setTimeout(scrollToAndHighlight, 500);
        }
    }, [searchParams, accounts]);

    useEffect(() => {
        if (showExpiredOnly) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const newExpanded = new Set<string>();
            accounts.forEach(acc => {
                const hasExpired = acc.order_accounts?.some(oa => {
                    if (!oa.end_date) return false;
                    return parseISO(oa.end_date) < today;
                });
                if (hasExpired) newExpanded.add(acc.id);
            });
            setExpandedRows(newExpanded);
        }
    }, [showExpiredOnly, accounts]);


    // --- Fetching Functions ---
    const fetchAccounts = async () => {
        try {
            const res = await fetch('/api/admin/accounts', { cache: 'no-store' });
            if (!res.ok) throw new Error('Failed to fetch accounts');
            const data = await res.json();
            setAccounts(data);

            const initialGrid: Record<string, GridValue> = {};
            data.forEach((acc: Account) => {
                for (let i = 0; i < acc.max_slots; i++) {
                    const assignment = acc.order_accounts?.find((oa: Assignment) => oa.slot_number === i);
                    let defaultPw = assignment?.tidal_password || '';
                    if (i === 0 && !defaultPw) defaultPw = acc.login_pw;

                    initialGrid[`${acc.id}_${i}`] = {
                        assignment_id: assignment?.id,
                        tidal_id: assignment?.tidal_id ?? null,
                        tidal_password: defaultPw,
                        buyer_name: assignment?.buyer_name || assignment?.orders?.buyer_name || assignment?.orders?.profiles?.name || '',
                        buyer_phone: assignment?.buyer_phone || assignment?.orders?.buyer_phone || assignment?.orders?.profiles?.phone || '',
                        buyer_email: assignment?.buyer_email || assignment?.orders?.buyer_email || '',
                        start_date: assignment?.start_date || '',
                        end_date: assignment?.end_date || '',
                        order_number: assignment?.order_number || assignment?.orders?.order_number || '',
                        type: assignment?.type || (i === 0 ? 'master' : 'user'),
                        period_months: assignment?.period_months || 0,
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
            const res = await fetch('/api/admin/orders', { cache: 'no-store' });
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

    // --- Computed Helpers ---
    const getPeriodMonths = (start?: string, end?: string) => {
        if (!start || !end) return 0;
        try {
            return differenceInMonths(parseISO(end), parseISO(start));
        } catch {
            return 0;
        }
    };

    const getAvailableSlots = (accountId: string) => {
        const acc = accounts.find(a => a.id === accountId);
        if (!acc) return [];
        const taken = new Set((acc.order_accounts || [])
            .filter(oa => oa && typeof oa.slot_number === 'number')
            .map(oa => oa.slot_number));
        const available = [];
        for (let i = 0; i < 6; i++) {
            if (!taken.has(i)) available.push(i);
        }
        return available;
    };



    const getFlattenedAssignments = () => {
        const flattened: {
            id: string;
            assignment: Assignment;
            account: Account;
            period: number;
            originalAccIndex: number;
        }[] = [];

        accounts.forEach((acc, accIdx) => {
            const assignments = [...(acc.order_accounts || [])];
            assignments.forEach(assignment => {
                // Search Filter
                const query = searchQuery.toLowerCase().trim();
                if (query) {
                    const buyerName = (assignment.buyer_name || assignment.orders?.buyer_name || '').toLowerCase();
                    const tidalId = (assignment.tidal_id || '').toLowerCase();
                    const buyerPhone = (assignment.buyer_phone || assignment.orders?.buyer_phone || '').toLowerCase();
                    if (!buyerName.includes(query) && !tidalId.includes(query) && !buyerPhone.includes(query)) return;
                }

                // Expired Filter
                if (showExpiredOnly && assignment.end_date) {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    if (parseISO(assignment.end_date) >= today) return;
                } else if (showExpiredOnly && !assignment.end_date) {
                    return;
                }

                let periodNum = assignment.period_months || 0;
                if (!periodNum && assignment.start_date && assignment.end_date) {
                    try {
                        const start = parseISO(assignment.start_date);
                        const end = parseISO(assignment.end_date);
                        periodNum = differenceInMonths(end, start);
                    } catch { }
                }

                flattened.push({
                    id: assignment.id,
                    assignment,
                    account: acc,
                    period: periodNum,
                    originalAccIndex: accIdx
                });
            });
        });
        return flattened;
    };

    const getFlatAssignments = () => {
        interface FlatAssignment extends GridValue {
            accountId: string;
            accountLoginId: string;
            accountPaymentEmail: string;
            accountPaymentDay: number;
            accountMemo: string | null;
            slotIdx: number;
            assignmentId?: string;
            [key: string]: string | number | boolean | null | undefined | Order | Assignment;
        }
        const flat: FlatAssignment[] = [];
        const query = searchQuery.toLowerCase().trim();

        accounts.forEach(acc => {
            for (let i = 0; i < acc.max_slots; i++) {
                const assignment = acc.order_accounts?.find(oa => oa.slot_number === i);
                const val = gridValues[`${acc.id}_${i}`] || {};

                // Apply Search Filter
                if (query) {
                    const buyerName = (val.buyer_name || '').toLowerCase();
                    const tidalId = (val.tidal_id || '').toLowerCase();
                    const buyerPhone = (val.buyer_phone || '').toLowerCase();

                    if (!buyerName.includes(query) &&
                        !tidalId.includes(query) &&
                        !buyerPhone.includes(query)) {
                        continue;
                    }
                }

                // Apply Expired Filter
                if (showExpiredOnly) {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    if (!val.end_date || parseISO(val.end_date) >= today) {
                        continue;
                    }
                }

                flat.push({
                    accountId: acc.id,
                    accountLoginId: acc.login_id,
                    accountPaymentEmail: acc.payment_email,
                    accountPaymentDay: acc.payment_day,
                    accountMemo: acc.memo,
                    slotIdx: i,
                    assignmentId: assignment?.id,
                    ...val
                });
            }
        });

        // Sorting for Flat View
        if (sortConfig) {
            flat.sort((a, b) => {
                let valA: string | number | boolean | null | undefined | Order | Assignment = a[sortConfig.key];
                let valB: string | number | boolean | null | undefined | Order | Assignment = b[sortConfig.key];

                if (sortConfig.key === 'period') {
                    valA = getPeriodMonths(a.start_date, a.end_date);
                    valB = getPeriodMonths(b.start_date, b.end_date);
                }

                if (valA === undefined || valA === null) valA = '';
                if (valB === undefined || valB === null) valB = '';

                const sA = (typeof valA === 'object' ? JSON.stringify(valA) : valA) as string | number | boolean;
                const sB = (typeof valB === 'object' ? JSON.stringify(valB) : valB) as string | number | boolean;

                if (sA < sB) return sortConfig.direction === 'asc' ? -1 : 1;
                if (sA > sB) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return flat;
    };

    // --- Filtered and Sorted Data for List View ---
    const filteredAccounts = accounts.filter(acc => {
        const query = searchQuery.toLowerCase().trim();
        if (!query) return true;
        if (acc.login_id.toLowerCase().includes(query) || acc.payment_email.toLowerCase().includes(query)) return true;
        return acc.order_accounts?.some(oa => {
            const tidalId = (oa.tidal_id || '').toLowerCase();
            const buyerName = (oa.buyer_name || oa.orders?.buyer_name || '').toLowerCase();
            const phone = (oa.buyer_phone || oa.orders?.buyer_phone || '').toLowerCase();
            return tidalId.includes(query) || buyerName.includes(query) || phone.includes(query);
        });
    });

    const sortedAccounts = [...filteredAccounts].sort((a, b) => {
        if (sortConfig && !isGridView) {
            let aVal: string | number = '';
            let bVal: string | number = '';
            switch (sortConfig.key) {
                case 'login_id': aVal = a.login_id; bVal = b.login_id; break;
                case 'used_slots': aVal = a.order_accounts?.length || 0; bVal = b.order_accounts?.length || 0; break;
                case 'end_date':
                    aVal = a.order_accounts?.find(oa => oa.type === 'master')?.end_date || '0000-00-00';
                    bVal = b.order_accounts?.find(oa => oa.type === 'master')?.end_date || '0000-00-00';
                    break;
                default: return 0;
            }
            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        } else if (!sortConfig) {
            // Default Sort for List View
            const usedA = a.order_accounts?.length || 0;
            const usedB = b.order_accounts?.length || 0;
            if (usedA !== usedB) return usedA - usedB;

            const endA = a.order_accounts?.find(oa => oa.type === 'master')?.end_date || '0000-00-00';
            const endB = b.order_accounts?.find(oa => oa.type === 'master')?.end_date || '0000-00-00';
            if (endA < endB) return 1;
            if (endA > endB) return -1;
            return 0;
        }
        return 0;
    });

    // --- Action Handlers ---
    const toggleRow = (id: string) => {
        setExpandedRows(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleAllRows = () => {
        const allFilteredIds = filteredAccounts.map(acc => acc.id);
        const allExpanded = allFilteredIds.every(id => expandedRows.has(id));
        if (allExpanded) {
            const next = new Set(expandedRows);
            allFilteredIds.forEach(id => next.delete(id));
            setExpandedRows(next);
        } else {
            const next = new Set(expandedRows);
            allFilteredIds.forEach(id => next.add(id));
            setExpandedRows(next);
        }
    };

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
    };

    const updateGridValue = (accountId: string, slotIdx: number, field: string, value: string | number | null) => {
        const key = `${accountId}_${slotIdx}`;
        setGridValues(prev => {
            const current = prev[key] || {};
            const next = { ...current, [field]: value };

            if (field === 'buyer_email' && typeof value === 'string') {
                const emailPrefix = value.split('@')[0];
                next.tidal_id = emailPrefix ? `${emailPrefix}@hifitidal.com` : null;
            }

            if ((field === 'start_date' || field === 'period_months') && (next.start_date && next.period_months)) {
                try {
                    const start = parseISO(next.start_date);
                    const months = parseInt(String(next.period_months)) || 0;
                    if (months > 0) {
                        const end = new Date(start);
                        end.setMonth(end.getMonth() + months);
                        next.end_date = end.toISOString().split('T')[0];
                    }
                } catch { }
            }
            return { ...prev, [key]: next };
        });
    };

    const handleSaveRow = async (accountId: string, slotIdx: number) => {
        const key = `${accountId}_${slotIdx}`;
        const data = gridValues[key];
        if (!data) return;

        try {
            if (data.assignment_id) {
                const res = await fetch(`/api/admin/assignments/${data.assignment_id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                if (!res.ok) throw new Error('Update failed');
            } else {
                if (!data.buyer_name && !data.buyer_email) {
                    alert('이름 또는 ID(이메일)를 입력해주세요.');
                    return;
                }
                const res = await fetch(`/api/admin/accounts/${accountId}/assign`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...data, slot_number: slotIdx })
                });
                if (!res.ok) throw new Error('Create failed');
            }
            alert('저장되었습니다.');
            setEditingSlots(prev => ({ ...prev, [key]: false }));
            fetchAccounts();
        } catch (e) {
            alert('저장 실패: ' + (e instanceof Error ? e.message : String(e)));
        }
    };

    const handleDelete = async (assignmentId: string) => {
        if (!confirm('정말 삭제하시겠습니까?')) return;
        try {
            const res = await fetch(`/api/admin/assignments/${assignmentId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Delete failed');
            fetchAccounts();
            fetchPendingOrders();
        } catch (error) {
            alert('삭제 실패: ' + (error instanceof Error ? error.message : String(error)));
        }
    };

    const handleDeactivate = async (assignmentId: string) => {
        if (!confirm('배정을 종료하시겠습니까?')) return;
        try {
            const res = await fetch(`/api/admin/assignments/${assignmentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_active: false })
            });
            if (!res.ok) throw new Error('Deactivation failed');
            alert('비활성화 되었습니다.');
            fetchAccounts();
        } catch (error) {
            alert('실패: ' + (error instanceof Error ? error.message : String(error)));
        }
    };

    const handleCreateAccount = async () => {
        if (!newAccount.login_id.trim() || !newAccount.payment_email.trim()) {
            alert('필수 항목을 입력해주세요.');
            return;
        }
        try {
            const prodRes = await fetch('/api/admin/products');
            const products = await prodRes.json();
            const tidal = products.find((p: { name: string }) => p.name.includes('Tidal')) || products[0];

            const res = await fetch('/api/admin/accounts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...newAccount, product_id: tidal?.id })
            });
            if (!res.ok) throw new Error('Failed to create');
            alert('생성되었습니다.');
            setIsAddModalOpen(false);
            fetchAccounts();
            setNewAccount({ login_id: '', login_pw: '', payment_email: '', payment_day: 1, memo: '', product_id: '', max_slots: 6 });
        } catch (error) {
            alert('실패: ' + (error instanceof Error ? error.message : String(error)));
        }
    };

    const handleEditMasterAccount = (account: Account) => {
        setEditingAccount(account);
        setIsEditModalOpen(true);
    };

    const handleUpdateMasterAccount = async () => {
        if (!editingAccount) return;
        try {
            const res = await fetch(`/api/admin/accounts/${editingAccount.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editingAccount)
            });
            if (!res.ok) throw new Error('Failed to update');
            setIsEditModalOpen(false);
            fetchAccounts();
            alert('수정되었습니다.');
        } catch (error) {
            alert('실패: ' + (error instanceof Error ? error.message : String(error)));
        }
    };

    const handleDeleteMasterAccount = async (account: Account) => {
        if ((account.order_accounts?.length || 0) > 0) {
            alert('슬롯이 배정되어 있는 그룹은 삭제할 수 없습니다.');
            return;
        }
        if (!confirm('그룹을 삭제하시겠습니까?')) return;
        try {
            const res = await fetch(`/api/admin/accounts/${account.id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Delete failed');
            fetchAccounts();
            alert('삭제되었습니다.');
        } catch (error) {
            alert('실패: ' + (error instanceof Error ? error.message : String(error)));
        }
    };

    const exportToExcel = () => {
        const excelData: Record<string, string | number>[] = [];
        const flatData = getFlatAssignments();
        flatData.forEach((item, idx) => {
            excelData.push({
                'No.': idx + 1,
                '그룹 ID': item.accountLoginId,
                '결제 계정': item.accountPaymentEmail,
                '결제일': `${item.accountPaymentDay}일`,
                '메모': item.accountMemo ?? '',
                'Slot': `Slot ${item.slotIdx + 1}`,
                '고객명': item.buyer_name || '',
                '전화번호': item.buyer_phone || '',
                '주문번호': item.order_number || '',
                '소속 ID': item.tidal_id || '',
                '소속 PW': item.tidal_password || '',
                '시작일': item.start_date || '',
                '종료일': item.end_date || '',
                '개월': getPeriodMonths(item.start_date, item.end_date)
            });
        });
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(excelData);
        XLSX.utils.book_append_sheet(wb, ws, 'Tidal 계정');
        XLSX.writeFile(wb, `Tidal계정_${new Date().toLocaleDateString()}.xlsx`);
    };

    const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = new Uint8Array(event.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                const res = await fetch('/api/admin/accounts/import', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ accounts: jsonData })
                });
                if (!res.ok) throw new Error('Import failed');
                const summary = await res.json();
                setImportResults(summary);
                setIsImportResultModalOpen(true);
                fetchAccounts();
            } catch {
                alert('임포트 오류');
            }
        };
        reader.readAsArrayBuffer(file);
        e.target.value = '';
    };

    const openAssignModal = (account: Account, slotIndex: number) => {
        setSelectedAccount(account);
        setSelectedSlot(slotIndex);
        setSlotPasswordModal(generateTidalPassword());
        setIsAssignModalOpen(true);
    };

    const handleAssign = (orderId: string) => {
        if (!selectedAccount || selectedSlot === null) return;
        const order = pendingOrders.find(o => o.id === orderId);
        if (!order) return;
        const key = `${selectedAccount.id}_${selectedSlot}`;
        const emailPrefix = order.buyer_email?.split('@')[0] || '';

        setGridValues(prev => ({
            ...prev,
            [key]: {
                ...prev[key],
                order_id: order.id,
                buyer_name: order.buyer_name || order.profiles?.name || '',
                buyer_email: order.buyer_email || '',
                buyer_phone: order.buyer_phone || order.profiles?.phone || '',
                start_date: order.start_date || '',
                end_date: order.end_date || '',
                order_number: order.order_number || '',
                tidal_id: emailPrefix ? `${emailPrefix}@hifitidal.com` : null,
                tidal_password: slotPasswordModal || '',
                full_order: order
            }
        }));
        setEditingSlots(prev => ({ ...prev, [key]: true }));
        setIsAssignModalOpen(false);
    };

    const openMoveModal = (currentAssignment: Assignment) => {
        setSelectedAssignment(currentAssignment);
        setMoveTargets(accounts.filter(a => a.used_slots < a.max_slots));
        setSelectedTargetAccount('');
        setSelectedTargetSlot(null);
        setIsMoveModalOpen(true);
    };

    const handleMove = async () => {
        if (!selectedAssignment?.orders?.id) return;
        try {
            const res = await fetch('/api/admin/accounts/move', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    order_id: selectedAssignment.orders.id,
                    target_account_id: selectedTargetAccount,
                    target_slot_number: selectedTargetSlot,
                    target_tidal_password: selectedAssignment.tidal_password
                })
            });
            if (!res.ok) throw new Error('Move failed');
            setIsMoveModalOpen(false);
            fetchAccounts();
        } catch {
            alert('이동 실패');
        }
    };

    const openOrderDetail = (order?: Order) => {
        if (!order) return;
        setViewOrder(order);
        setIsOrderDetailOpen(true);
    };

    const getStatusLabel = (order: Order) => {
        if (order.assignment_status === 'completed') return '작업완료';
        if (order.assignment_status === 'assigned') return '배정완료';
        if (order.payment_status === 'paid') return '입금확인';
        return '주문신청';
    };

    const toggleSelectAll = (filteredFlat: { id: string }[]) => {
        if (selectedAssignmentIds.size === filteredFlat.length) {
            setSelectedAssignmentIds(new Set());
        } else {
            setSelectedAssignmentIds(new Set(filteredFlat.map(item => item.id)));
        }
    };

    const handleToggleSelection = (id: string) => {
        setSelectedAssignmentIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleBulkNotify = async () => {
        if (selectedAssignmentIds.size === 0) return;
        setIsSendingNotify(true);
        try {
            const flattened = getFlattenedAssignments();
            const recipients = flattened
                .filter(item => selectedAssignmentIds.has(item.id))
                .map(item => ({
                    email: item.assignment.buyer_email || item.assignment.orders?.buyer_email,
                    buyerName: item.assignment.buyer_name || item.assignment.orders?.buyer_name || '고객',
                    tidalId: item.assignment.tidal_id || '알 수 없음',
                    endDate: item.assignment.end_date || '알 수 없음'
                }))
                .filter(r => !!r.email);

            const res = await fetch('/api/admin/tidal/notify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recipients, messageTemplate: notificationMessage })
            });

            if (res.ok) {
                alert('발송되었습니다.');
                setIsNotifyModalOpen(false);
                setSelectedAssignmentIds(new Set());
            } else {
                alert('발송 실패');
            }
        } catch {
            alert('오류 발생');
        } finally {
            setIsSendingNotify(false);
        }
    };

    const generateTidalPassword = () => {
        const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@$";
        let pass = "";
        for (let i = 0; i < 8; i++) pass += chars.charAt(Math.floor(Math.random() * chars.length));
        return pass;
    };

    const startEdit = (accountId: string, slotIdx: number) => {
        setEditingSlots(prev => ({ ...prev, [`${accountId}_${slotIdx}`]: true }));
    };

    const cancelEdit = (accountId: string, slotIdx: number) => {
        setEditingSlots(prev => {
            const next = { ...prev };
            delete next[`${accountId}_${slotIdx}`];
            return next;
        });
        fetchAccounts();
    };

    if (!isAdmin) return null;

    return (
        <main className={styles.main}>
            <header className={`${styles.header} glass`}>
                <div className="container flex justify-between items-center bg-white/50 py-2 rounded-lg">
                    <div className="flex items-center gap-4">
                        <h1 className={styles.title}>Tidal 계정 관리</h1>
                        <Button variant="outline" size="sm" onClick={() => setIsGridView(!isGridView)} className="h-8">
                            {isGridView ? <List size={16} className="mr-2" /> : <LayoutGrid size={16} className="mr-2" />}
                            {isGridView ? 'List View' : 'Grid View'}
                        </Button>
                    </div>

                    <div className="flex gap-2 items-center">
                        {/* 1. 검색창 */}
                        <div className="relative flex items-center bg-white border rounded-md px-2 focus-within:ring-2 focus-within:ring-blue-500">
                            <Filter size={14} className="text-gray-400" />
                            <Input
                                type="text"
                                placeholder="고객명, Tidal ID, 전화번호 검색..."
                                className="border-0 focus-visible:ring-0 h-8 w-60 text-sm"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        {/* 2. 만료된 배정만 보기 */}
                        <Button
                            variant={showExpiredOnly ? "default" : "outline"}
                            size="sm"
                            onClick={() => setShowExpiredOnly(!showExpiredOnly)}
                            className={showExpiredOnly ? "bg-red-600 hover:bg-red-700 text-white h-8" : "text-gray-600 h-8"}
                        >
                            만료된 배정만 보기
                        </Button>

                        {/* 3. 지난 내역 */}
                        <Button onClick={() => router.push('/admin/tidal/inactive')} variant="outline" className="gap-2 text-orange-600 border-orange-200 hover:bg-orange-50 h-8">
                            <History size={16} /> 지난 내역
                        </Button>

                        {/* 4. 엑셀 임포트 */}
                        <div className="relative">
                            <input
                                type="file"
                                accept=".xlsx, .xls"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                onChange={handleImportExcel}
                            />
                            <Button variant="outline" className="flex items-center gap-2 h-8">
                                <Upload className="w-4 h-4" />
                                엑셀 임포트
                            </Button>
                        </div>

                        {/* 5. 엑셀 다운로드 */}
                        <Button onClick={exportToExcel} variant="outline" className="gap-2 h-8">
                            <Download size={16} /> 엑셀 다운로드
                        </Button>

                        {/* 6. 알림 보내기 */}
                        {isGridView && (
                            <Button
                                variant="default"
                                size="sm"
                                disabled={selectedAssignmentIds.size === 0}
                                onClick={() => {
                                    setNotificationMessage(defaultTemplate);
                                    setIsNotifyModalOpen(true);
                                }}
                                className={`${selectedAssignmentIds.size > 0 ? 'bg-orange-600 hover:bg-orange-700' : ''} h-8 gap-2`}
                            >
                                <Mail size={16} /> 알림 보내기 ({selectedAssignmentIds.size})
                            </Button>
                        )}

                        {/* 7. 그룹 추가 */}
                        <Button onClick={() => setIsAddModalOpen(true)} className="gap-2 h-8">
                            <Plus size={16} /> 그룹 추가
                        </Button>
                    </div>
                </div>
            </header>

            <div className={`${styles.content} container`}>
                {isGridView ? (
                    <div className="bg-white rounded-lg shadow overflow-x-auto">
                        <table className="w-full text-xs min-w-[1400px]">
                            <thead>
                                <tr className="bg-gray-100 border-b">
                                    <th className="w-10 text-center py-2 border-r border-gray-200">
                                        <input
                                            type="checkbox"
                                            checked={selectedAssignmentIds.size > 0 && selectedAssignmentIds.size === getFlattenedAssignments().length}
                                            onChange={() => toggleSelectAll(getFlattenedAssignments())}
                                        />
                                    </th>
                                    <th className="w-[100px] text-center text-[10px] font-bold py-2 border-r border-gray-200 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('login_id')}>
                                        <div className="flex items-center justify-center gap-1">
                                            GroupID {sortConfig?.key === 'login_id' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                                        </div>
                                    </th>
                                    <th className="p-2 text-left border-r w-32">Tidal ID</th>
                                    <th className="p-2 text-left border-r w-24">PW</th>
                                    <th className="p-2 text-left border-r w-20">고객명</th>
                                    <th className="p-2 text-left border-r w-24">전화번호</th>
                                    <th className="p-2 text-center border-r w-24">주문번호</th>
                                    <th className="p-2 text-center border-r w-24 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('start_date')}>
                                        <div className="flex items-center justify-center gap-1">
                                            시작일 {sortConfig?.key === 'start_date' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                                        </div>
                                    </th>
                                    <th className="p-2 text-center border-r w-24 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('end_date')}>
                                        <div className="flex items-center justify-center gap-1">
                                            종료일 {sortConfig?.key === 'end_date' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                                        </div>
                                    </th>
                                    <th className="p-2 text-center border-r w-12 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('period')}>
                                        <div className="flex items-center justify-center gap-1">
                                            개월 {sortConfig?.key === 'period' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                                        </div>
                                    </th>
                                    <th className="p-2 text-center border-r w-16">타입</th>
                                    <th className="p-2 text-left border-r w-32 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('payment_email')}>
                                        <div className="flex items-center justify-center gap-1">
                                            결제계정 {sortConfig?.key === 'payment_email' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                                        </div>
                                    </th>
                                    <th className="p-2 text-center border-r w-16 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('payment_day')}>
                                        <div className="flex items-center justify-center gap-1">
                                            결제일 {sortConfig?.key === 'payment_day' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                                        </div>
                                    </th>
                                    <th className="p-2 text-center w-32">관리</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(() => {
                                    // 1. Flatten assignments
                                    const flattened = getFlattenedAssignments();

                                    // 2. Sort
                                    if (sortConfig) {
                                        flattened.sort((a, b) => {
                                            let aVal: string | number | null = null;
                                            let bVal: string | number | null = null;

                                            switch (sortConfig.key) {
                                                case 'start_date':
                                                    aVal = a.assignment.start_date || '0000-00-00';
                                                    bVal = b.assignment.start_date || '0000-00-00';
                                                    break;
                                                case 'end_date':
                                                    aVal = a.assignment.end_date || '0000-00-00';
                                                    bVal = b.assignment.end_date || '0000-00-00';
                                                    break;
                                                case 'period':
                                                    aVal = a.period;
                                                    bVal = b.period;
                                                    break;
                                                case 'payment_email':
                                                    aVal = a.account.payment_email;
                                                    bVal = b.account.payment_email;
                                                    break;
                                                case 'payment_day':
                                                    aVal = a.account.payment_day;
                                                    bVal = b.account.payment_day;
                                                    break;
                                                case 'login_id':
                                                    aVal = a.account.login_id;
                                                    bVal = b.account.login_id;
                                                    break;
                                                default:
                                                    return 0;
                                            }

                                            const safeA = aVal ?? '';
                                            const safeB = bVal ?? '';

                                            if (safeA < safeB) return sortConfig.direction === 'asc' ? -1 : 1;
                                            if (safeA > safeB) return sortConfig.direction === 'asc' ? 1 : -1;
                                            return 0;
                                        });
                                    }

                                    // 3. Render
                                    return flattened.map((item) => {
                                        const assignment = item.assignment;
                                        const acc = item.account;
                                        const sIdx = assignment.slot_number;
                                        const key = `${acc.id}_${sIdx}`;
                                        const val = gridValues[key] || {};
                                        const isEditing = editingSlots[key];

                                        const today = new Date();
                                        today.setHours(0, 0, 0, 0);
                                        const isExpired = assignment.end_date ? parseISO(assignment.end_date) < today : false;

                                        return (
                                            <tr key={assignment.id} className={`border-b hover:bg-gray-50 ${isExpired ? 'bg-red-50/30' : ''} ${selectedAssignmentIds.has(assignment.id) ? 'bg-blue-50/50' : ''}`}>
                                                <td className="text-center py-1 border-r border-gray-100 bg-gray-50/10">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedAssignmentIds.has(assignment.id)}
                                                        onChange={() => handleToggleSelection(assignment.id)}
                                                    />
                                                </td>
                                                <td className="text-center text-[10px] py-1 border-r border-gray-100 bg-gray-50/50 font-medium">
                                                    {item.account.login_id}
                                                </td>
                                                {isEditing ? (
                                                    <>
                                                        <td className="p-1 border-r">
                                                            <Input className="h-7 text-[10px] bg-white px-1" value={val.tidal_id || ''} onChange={e => updateGridValue(acc.id, sIdx, 'tidal_id', e.target.value)} />
                                                        </td>
                                                        <td className="p-1 border-r">
                                                            <Input className="h-7 text-[10px] bg-white px-1" value={val.tidal_password || ''} onChange={e => updateGridValue(acc.id, sIdx, 'tidal_password', e.target.value)} />
                                                        </td>
                                                        <td className="p-1 border-r">
                                                            <Input className="h-7 text-[10px] bg-white px-1" value={val.buyer_name || ''} onChange={e => updateGridValue(acc.id, sIdx, 'buyer_name', e.target.value)} />
                                                        </td>
                                                        <td className="p-1 border-r">
                                                            <Input className="h-7 text-[10px] bg-white px-1" value={val.buyer_phone || ''} onChange={e => updateGridValue(acc.id, sIdx, 'buyer_phone', e.target.value)} />
                                                        </td>
                                                        <td className="p-1 border-r text-center text-[10px]">{val.order_number || '-'}</td>
                                                        <td className="p-1 border-r">
                                                            <Input type="date" className="h-7 text-[10px] bg-white px-1" value={val.start_date || ''} onChange={e => updateGridValue(acc.id, sIdx, 'start_date', e.target.value)} />
                                                        </td>
                                                        <td className="p-1 border-r">
                                                            <Input type="date" className="h-7 text-[10px] bg-white px-1" value={val.end_date || ''} onChange={e => updateGridValue(acc.id, sIdx, 'end_date', e.target.value)} />
                                                        </td>
                                                        <td className="p-1 border-r w-12">
                                                            <Input type="number" className="h-7 text-[10px] bg-white px-1" placeholder="개월" value={val.period_months !== undefined ? val.period_months : (item.period || '')} onChange={e => updateGridValue(acc.id, sIdx, 'period_months', parseInt(e.target.value) || 0)} />
                                                        </td>
                                                    </>
                                                ) : (
                                                    <>
                                                        <td className="p-2 border-r truncate max-w-[120px]" title={assignment.tidal_id || undefined}>{assignment.tidal_id || '-'}</td>
                                                        <td className="p-2 border-r font-mono truncate max-w-[80px]" title={assignment.tidal_password || undefined}>{assignment.tidal_password || '-'}</td>
                                                        <td className="p-2 border-r truncate max-w-[80px]" title={assignment.buyer_name || assignment.orders?.buyer_name || undefined}>
                                                            {assignment.buyer_name || assignment.orders?.buyer_name || '-'}
                                                        </td>
                                                        <td className="p-2 border-r truncate max-w-[100px]" title={assignment.buyer_phone || assignment.orders?.buyer_phone || undefined}>
                                                            {assignment.buyer_phone || assignment.orders?.buyer_phone || '-'}
                                                        </td>
                                                        <td className="p-2 text-center border-r font-mono text-[10px]">
                                                            {assignment.order_number || assignment.orders?.order_number ? (
                                                                <button
                                                                    className="text-blue-600 font-bold underline hover:text-blue-800"
                                                                    onClick={() => openOrderDetail(assignment.orders || val.full_order)}
                                                                >
                                                                    {assignment.order_number || assignment.orders?.order_number}
                                                                </button>
                                                            ) : '-'}
                                                        </td>
                                                        <td className="p-2 text-center border-r font-mono">{assignment.start_date ? format(parseISO(assignment.start_date), 'yyyy-MM-dd') : '-'}</td>
                                                        <td className="p-2 text-center border-r font-mono">
                                                            <span className={isExpired ? "text-red-600 font-bold" : ""}>
                                                                {assignment.end_date ? format(parseISO(assignment.end_date), 'yyyy-MM-dd') : '-'}
                                                            </span>
                                                        </td>
                                                        <td className="p-2 text-center border-r font-mono">{item.period}</td>
                                                    </>
                                                )}
                                                <td className="p-2 text-center border-r">
                                                    <span className={`px-1 rounded text-[10px] ${assignment.type === 'master' ? 'bg-purple-100 text-purple-700 font-bold' : 'bg-blue-50 text-blue-600'}`}>
                                                        {assignment.type === 'master' ? 'Master' : 'User'}
                                                    </span>
                                                </td>
                                                <td className="p-2 border-r truncate max-w-[150px]" title={acc.payment_email}>{acc.payment_email}</td>
                                                <td className="p-2 text-center border-r font-mono">{acc.payment_day}일</td>
                                                <td className="p-2 text-center">
                                                    <div className="flex justify-center gap-1 items-center">
                                                        {isEditing ? (
                                                            <>
                                                                <Button size="sm" variant="default" className="h-6 w-6 p-0 bg-blue-600 hover:bg-blue-700" title="저장" onClick={() => handleSaveRow(acc.id, sIdx)}>
                                                                    <Save size={12} />
                                                                </Button>
                                                                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-gray-500 hover:text-gray-700" title="취소" onClick={() => cancelEdit(acc.id, sIdx)}>
                                                                    <Plus size={12} className="rotate-45" />
                                                                </Button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-gray-400 hover:text-blue-600" title="수정" onClick={() => startEdit(acc.id, sIdx)}>
                                                                    <Pencil size={12} />
                                                                </Button>
                                                                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-gray-400 hover:text-blue-600" title="이동" onClick={() => openMoveModal(assignment)}>
                                                                    <ArrowRightLeft size={12} />
                                                                </Button>
                                                                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-gray-400 hover:text-orange-600" title="비활성화 (종료)" onClick={() => handleDeactivate(assignment.id)}>
                                                                    <PowerOff size={12} />
                                                                </Button>
                                                                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-gray-400 hover:text-red-600" title="삭제 (배정해제)" onClick={() => handleDelete(assignment.id)}>
                                                                    <Trash2 size={12} />
                                                                </Button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    });
                                })()}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="bg-white rounded-lg shadow overflow-hidden">
                        <div className="grid grid-cols-13 gap-4 p-4 bg-gray-50 font-bold border-b text-sm">
                            <div className="col-span-1 cursor-pointer hover:bg-gray-100 flex items-center gap-1" onClick={() => handleSort('login_id')}>
                                GroupID {sortConfig?.key === 'login_id' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                            </div>
                            <div className="col-span-2">결제계좌</div>
                            <div className="col-span-1 text-center font-bold">결제일</div>
                            <div className="col-span-1 text-left">메모</div>
                            <div className="col-span-2 text-left">마스터계정</div>
                            <div className="col-span-2 text-left text-gray-900 cursor-pointer hover:bg-gray-100 flex items-center gap-1" onClick={() => handleSort('end_date')}>
                                종료예정일 {sortConfig?.key === 'end_date' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                            </div>
                            <div className="col-span-1 text-left">지속개월</div>
                            <div className="col-span-1 text-center cursor-pointer hover:bg-gray-100 flex items-center justify-center gap-1" onClick={() => handleSort('used_slots')}>
                                슬롯 {sortConfig?.key === 'used_slots' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                            </div>
                            <div className="col-span-1 text-center">관리</div>
                            <div className="col-span-1 text-center cursor-pointer hover:text-blue-600 whitespace-nowrap" onClick={toggleAllRows}>
                                {filteredAccounts.length > 0 && filteredAccounts.every(acc => expandedRows.has(acc.id)) ? '전체접기' : '전체펼치기'}
                            </div>
                        </div>

                        {sortedAccounts
                            .map((acc) => {
                                const isExpanded = expandedRows.has(acc.id);
                                let sortedAssignments = [...(acc.order_accounts || [])].sort((a, b) => {
                                    if (a.type === 'master') return -1;
                                    if (b.type === 'master') return 1;
                                    return (a.end_date || '').localeCompare(b.end_date || '');
                                });

                                // --- Expired Filter Functionality ---
                                if (showExpiredOnly) {
                                    const today = new Date();
                                    today.setHours(0, 0, 0, 0);
                                    sortedAssignments = sortedAssignments.filter(assignment => {
                                        if (!assignment.end_date) return false;
                                        const end = parseISO(assignment.end_date);
                                        return end < today;
                                    });

                                    // If no expired assignments in this account, hide the account row
                                    if (sortedAssignments.length === 0) return null;
                                }





                                const masterSlot = acc.order_accounts?.find(oa => oa.type === 'master');
                                const tidalId = masterSlot?.tidal_id || '-';
                                const endDate = masterSlot?.end_date || '-';

                                let isWarning = false;
                                if (masterSlot?.end_date) {
                                    try {
                                        const end = parseISO(masterSlot.end_date);
                                        const today = new Date();
                                        today.setHours(0, 0, 0, 0);
                                        const warningThreshold = new Date(today);
                                        warningThreshold.setDate(today.getDate() + 30);
                                        if (end < warningThreshold) isWarning = true;
                                    } catch { }
                                }

                                let duration = '-';
                                if (masterSlot?.start_date) {
                                    try {
                                        const start = parseISO(masterSlot.start_date);
                                        const now = new Date();
                                        const diff = differenceInMonths(now, start);
                                        duration = `${diff}개월`;
                                    } catch { }
                                }

                                return (
                                    <div key={acc.id} id={`account-${acc.id}`} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                                        <div className="grid grid-cols-13 gap-4 p-4 items-center text-sm">
                                            <div className="col-span-1 text-gray-700 font-medium cursor-pointer truncate" title={acc.login_id} onClick={() => toggleRow(acc.id)}>
                                                {acc.login_id}
                                            </div>
                                            <div className="col-span-2 truncate cursor-pointer" title={`${acc.login_id}-${acc.payment_email}`} onClick={() => toggleRow(acc.id)}>
                                                <div className="font-medium text-[10px] leading-tight">
                                                    <div className="text-gray-700 truncate">{acc.login_id}</div>
                                                    <div className="text-blue-600 truncate">{acc.payment_email}</div>
                                                </div>
                                            </div>
                                            <div className="col-span-1 text-center text-gray-400 font-mono cursor-pointer" onClick={() => toggleRow(acc.id)}>
                                                {acc.payment_day}일
                                            </div>
                                            <div className="col-span-1 text-gray-500 text-[10px] text-left truncate cursor-pointer" title={acc.memo} onClick={() => toggleRow(acc.id)}>
                                                {acc.memo}
                                            </div>
                                            <div className="col-span-2 text-gray-700 text-xs truncate cursor-pointer" title={tidalId} onClick={() => toggleRow(acc.id)}>
                                                {tidalId}
                                            </div>
                                            <div className={`col-span-2 font-mono text-xs cursor-pointer ${isWarning ? 'text-red-600 font-bold' : 'text-gray-900'}`} onClick={() => toggleRow(acc.id)}>
                                                {endDate}
                                            </div>
                                            <div className="col-span-1 text-gray-500 font-mono text-xs cursor-pointer" onClick={() => toggleRow(acc.id)}>
                                                {duration}
                                            </div>
                                            <div className="col-span-1 text-center cursor-pointer" onClick={() => toggleRow(acc.id)}>
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${(acc.order_accounts?.length || 0) >= 6 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                                                    {acc.order_accounts?.length || 0}/6
                                                </span>
                                            </div>
                                            <div className="col-span-1 text-center flex justify-center gap-1">
                                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-blue-600" title="그룹 수정" onClick={(e) => { e.stopPropagation(); handleEditMasterAccount(acc); }}>
                                                    <Pencil size={14} />
                                                </Button>
                                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-red-600" title="그룹 삭제" onClick={(e) => { e.stopPropagation(); handleDeleteMasterAccount(acc); }}>
                                                    <Trash2 size={14} />
                                                </Button>
                                            </div>
                                            <div className="col-span-1 text-center cursor-pointer" onClick={() => toggleRow(acc.id)}>
                                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                            </div>
                                        </div>

                                        {isExpanded && (
                                            <div className="bg-white border-t p-4 overflow-x-auto">
                                                {(() => {
                                                    const available = getAvailableSlots(acc.id);
                                                    const availableSlotNum = available.length > 0 ? available[0] : -1;
                                                    return (
                                                        <table className="w-full text-xs min-w-[1200px]">
                                                            <thead>
                                                                <tr className="text-gray-400 border-b">
                                                                    <th className="py-2 text-center w-12">Slot</th>
                                                                    <th className="py-2 text-center w-20">Type</th>
                                                                    <th className="py-2 text-left w-32">Tidal ID</th>
                                                                    <th className="py-2 text-left w-24">비밀번호</th>
                                                                    <th className="py-2 text-left w-20">이름</th>
                                                                    <th className="py-2 text-left w-28">이메일</th>
                                                                    <th className="py-2 text-left w-28">전화번호</th>
                                                                    <th className="py-2 text-left w-24">가입일</th>
                                                                    <th className="py-2 text-left w-24">종료일</th>
                                                                    <th className="py-2 text-center w-16">개월</th>
                                                                    <th className="py-2 text-center w-24">주문번호</th>
                                                                    <th className="py-2 text-center w-40">관리</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {sortedAssignments.map((assignment, index) => {
                                                                    const sIdx = assignment.slot_number;
                                                                    const key = `${acc.id}_${sIdx}`;
                                                                    const val = gridValues[key] || {}; // Current Input Values
                                                                    const isEditing = editingSlots[key];

                                                                    // Period Calc for display
                                                                    let period = '-';
                                                                    let isExpired = false;
                                                                    if (val.start_date && val.end_date) {
                                                                        try {
                                                                            const start = parseISO(val.start_date);
                                                                            const end = parseISO(val.end_date);
                                                                            const diff = differenceInMonths(end, start);
                                                                            if (diff > 0) period = `${diff}개월`;

                                                                            // Check expiry
                                                                            const today = new Date();
                                                                            today.setHours(0, 0, 0, 0);
                                                                            if (end < today) isExpired = true;
                                                                        } catch { }
                                                                    }

                                                                    return (
                                                                        <tr key={assignment.id} className="border-b last:border-0 h-10 hover:bg-gray-50">
                                                                            <td className="text-center font-bold text-gray-400">#{index + 1}</td>

                                                                            {isEditing ? (
                                                                                <>
                                                                                    <td className="px-1">
                                                                                        <Select value={val.type || 'user'} onValueChange={(value) => {
                                                                                            if (value === 'master') {
                                                                                                const hasMaster = acc.order_accounts?.some(oa => oa.type === 'master' && oa.slot_number !== sIdx);
                                                                                                if (hasMaster) {
                                                                                                    alert('이미 Master가 설정되어 있습니다.');
                                                                                                    return;
                                                                                                }
                                                                                            }
                                                                                            updateGridValue(acc.id, sIdx, 'type', value);
                                                                                        }}>
                                                                                            <SelectTrigger className="h-8 text-xs bg-white">
                                                                                                <SelectValue />
                                                                                            </SelectTrigger>
                                                                                            <SelectContent>
                                                                                                <SelectItem value="master">Master</SelectItem>
                                                                                                <SelectItem value="user">User</SelectItem>
                                                                                            </SelectContent>
                                                                                        </Select>
                                                                                    </td>
                                                                                    <td className="px-1">
                                                                                        <Input className="h-8 text-xs bg-white" placeholder="Tidal ID" value={val.tidal_id || ''} onChange={e => updateGridValue(acc.id, sIdx, 'tidal_id', e.target.value)} />
                                                                                    </td>
                                                                                    <td className="px-1">
                                                                                        <Input className="h-8 text-xs bg-white" placeholder="PW" value={val.tidal_password || ''} onChange={e => updateGridValue(acc.id, sIdx, 'tidal_password', e.target.value)} />
                                                                                    </td>
                                                                                    <td className="px-1">
                                                                                        <Input className="h-8 text-xs bg-white" placeholder="이름" value={val.buyer_name || ''} onChange={e => updateGridValue(acc.id, sIdx, 'buyer_name', e.target.value)} />
                                                                                    </td>
                                                                                    <td className="px-1">
                                                                                        <Input className="h-8 text-xs bg-white" placeholder="Email" value={val.buyer_email || ''} onChange={e => updateGridValue(acc.id, sIdx, 'buyer_email', e.target.value)} />
                                                                                    </td>
                                                                                    <td className="px-1">
                                                                                        <Input className="h-8 text-xs bg-white" placeholder="전화번호" value={val.buyer_phone || ''} onChange={e => updateGridValue(acc.id, sIdx, 'buyer_phone', e.target.value)} />
                                                                                    </td>
                                                                                    <td className="px-1">
                                                                                        <Input type="date" className="h-8 text-xs bg-white px-1" value={val.start_date || ''} onChange={e => updateGridValue(acc.id, sIdx, 'start_date', e.target.value)} />
                                                                                    </td>
                                                                                    <td className="px-1 w-12">
                                                                                        <Input type="number" className="h-8 text-xs bg-white px-1" placeholder="개월" value={val.period_months || ''} onChange={e => updateGridValue(acc.id, sIdx, 'period_months', parseInt(e.target.value) || 0)} />
                                                                                    </td>
                                                                                    <td className="px-1">
                                                                                        <Input type="date" className="h-8 text-xs bg-white px-1" value={val.end_date || ''} onChange={e => updateGridValue(acc.id, sIdx, 'end_date', e.target.value)} />
                                                                                    </td>
                                                                                </>
                                                                            ) : (
                                                                                <>
                                                                                    <td className="px-2 text-center">
                                                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${val.type === 'master' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                                                                            {val.type === 'master' ? 'Master' : 'User'}
                                                                                        </span>
                                                                                    </td>
                                                                                    <td className="px-2 text-gray-700 truncate max-w-[120px]" title={val.tidal_id || undefined}>{val.tidal_id || '-'}</td>
                                                                                    <td className="px-2 text-gray-700 font-mono truncate max-w-[80px]" title={val.tidal_password || undefined}>{val.tidal_password || '-'}</td>
                                                                                    <td className="px-2 text-gray-700 truncate max-w-[80px]" title={val.buyer_name || undefined}>{val.buyer_name || '-'}</td>
                                                                                    <td className="px-2 text-gray-700 truncate max-w-[120px]" title={val.buyer_email || undefined}>{val.buyer_email || '-'}</td>
                                                                                    <td className="px-2 text-gray-700 truncate max-w-[100px]" title={val.buyer_phone || undefined}>{val.buyer_phone || '-'}</td>
                                                                                    <td className="px-2 text-gray-500 font-mono">{val.start_date || '-'}</td>
                                                                                    <td className="px-2 font-mono">
                                                                                        <span className={isExpired ? "text-red-500 font-bold" : "text-gray-500"}>
                                                                                            {val.end_date || '-'}
                                                                                            {isExpired && <span className="ml-1 text-[10px] bg-red-100 text-red-600 px-1 rounded">만료</span>}
                                                                                        </span>
                                                                                    </td>
                                                                                </>
                                                                            )}

                                                                            <td className="text-center text-gray-500 font-mono">
                                                                                {period}
                                                                            </td>
                                                                            <td className="text-center text-gray-400 font-mono text-[10px]">
                                                                                {val.order_number ? (
                                                                                    <button
                                                                                        className="text-blue-600 font-bold underline hover:text-blue-800"
                                                                                        onClick={() => {
                                                                                            const orderToView = val.full_order || assignment?.orders;
                                                                                            if (orderToView) openOrderDetail(orderToView);
                                                                                        }}
                                                                                    >
                                                                                        {val.order_number}
                                                                                    </button>
                                                                                ) : isEditing ? (
                                                                                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => openAssignModal(acc, assignment.slot_number)}>
                                                                                        배정
                                                                                    </Button>
                                                                                ) : (
                                                                                    <span>-</span>
                                                                                )}
                                                                            </td>
                                                                            <td>
                                                                                <div className="flex justify-center gap-1 items-center">
                                                                                    {isEditing ? (
                                                                                        <>
                                                                                            <Button size="sm" variant="default" className="h-7 w-7 p-0 bg-blue-600 hover:bg-blue-700" title="저장" onClick={() => handleSaveRow(acc.id, assignment.slot_number)}>
                                                                                                <Save size={14} />
                                                                                            </Button>
                                                                                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-500 hover:text-gray-700" title="취소" onClick={() => cancelEdit(acc.id, assignment.slot_number)}>
                                                                                                X
                                                                                            </Button>
                                                                                        </>
                                                                                    ) : (
                                                                                        <>
                                                                                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-blue-600" title="수정" onClick={() => startEdit(acc.id, assignment.slot_number)}>
                                                                                                <Pencil size={14} />
                                                                                            </Button>

                                                                                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-blue-600" title="이동" onClick={() => openMoveModal(assignment)}>
                                                                                                <ArrowRightLeft size={14} />
                                                                                            </Button>

                                                                                            {/* Deactivate Button for Expired/Active Accounts */}
                                                                                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-orange-600" title="비활성화 (종료)" onClick={() => handleDeactivate(assignment.id)}>
                                                                                                <PowerOff size={14} />
                                                                                            </Button>

                                                                                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-red-600" title="삭제 (배정해제)" onClick={() => handleDelete(assignment.id)}>
                                                                                                <Trash2 size={14} />
                                                                                            </Button>
                                                                                        </>
                                                                                    )}
                                                                                </div>
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}

                                                                {sortedAssignments.length < 6 && availableSlotNum !== -1 && (
                                                                    <tr className="border-b last:border-0 h-10 bg-blue-50/30">
                                                                        <td className="text-center font-bold text-gray-300">#{sortedAssignments.length + 1}</td>
                                                                        <td colSpan={10} className="px-4 py-1">
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="text-gray-400 italic">신규 슬롯을 추가하려면 우측 &apos;배정&apos; 버튼을 클릭하세요.</span>
                                                                            </div>
                                                                        </td>
                                                                        <td className="text-center">
                                                                            <Button size="sm" variant="outline" className="h-7 px-3 text-xs border-blue-200 text-blue-600 hover:bg-blue-600 hover:text-white"
                                                                                onClick={() => openAssignModal(acc, availableSlotNum)}
                                                                            >
                                                                                <Plus size={14} className="mr-1" /> 배정
                                                                            </Button>
                                                                        </td>
                                                                    </tr>
                                                                )}
                                                            </tbody>

                                                        </table>
                                                    );
                                                })()}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                    </div>
                )}
            </div>

            {/* ... Modal Code (Assign/Add/Move) remains same ... */}
            {/* Copying previous modal code for completeness */}
            <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>그룹 추가</DialogTitle></DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="login_id" className="text-right">
                                그룹 ID <span className="text-red-500">*</span>
                            </Label>
                            <Input id="login_id" type="text" value={newAccount.login_id} onChange={(e) => setNewAccount({ ...newAccount, login_id: e.target.value })} className="col-span-3" placeholder="GROUP-001" required />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="payment_email" className="text-right">
                                결제 계정 <span className="text-red-500">*</span>
                            </Label>
                            <Input id="payment_email" value={newAccount.payment_email} onChange={(e) => setNewAccount({ ...newAccount, payment_email: e.target.value })} className="col-span-3" placeholder="payment@email.com" required />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="payment_day" className="text-right">
                                결제일 <span className="text-red-500">*</span>
                            </Label>
                            <Input id="payment_day" type="number" min="1" max="31" value={newAccount.payment_day} onChange={(e) => setNewAccount({ ...newAccount, payment_day: parseInt(e.target.value) || 1 })} className="col-span-3" placeholder="1~31" required />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="memo" className="text-right">메모</Label>
                            <Input id="memo" value={newAccount.memo} onChange={(e) => setNewAccount({ ...newAccount, memo: e.target.value })} className="col-span-3" />
                        </div>
                    </div>
                    <DialogFooter><Button onClick={handleCreateAccount}>저장</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>그룹 수정</DialogTitle></DialogHeader>
                    {editingAccount && (
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit_login_id" className="text-right">
                                    그룹 ID <span className="text-red-500">*</span>
                                </Label>
                                <Input id="edit_login_id" value={editingAccount.login_id || ''} onChange={(e) => setEditingAccount({ ...editingAccount, login_id: e.target.value })} className="col-span-3" required />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit_payment_email" className="text-right">
                                    결제 계정 <span className="text-red-500">*</span>
                                </Label>
                                <Input id="edit_payment_email" value={editingAccount.payment_email || ''} onChange={(e) => setEditingAccount({ ...editingAccount, payment_email: e.target.value })} className="col-span-3" required />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit_payment_day" className="text-right">
                                    결제일 <span className="text-red-500">*</span>
                                </Label>
                                <Input id="edit_payment_day" type="number" min="1" max="31" value={editingAccount.payment_day || 1} onChange={(e) => setEditingAccount({ ...editingAccount, payment_day: parseInt(e.target.value) || 1 })} className="col-span-3" required />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit_memo" className="text-right">메모</Label>
                                <Input id="edit_memo" value={editingAccount.memo || ''} onChange={(e) => setEditingAccount({ ...editingAccount, memo: e.target.value })} className="col-span-3" />
                            </div>
                        </div>
                    )}
                    <DialogFooter><Button onClick={handleUpdateMasterAccount}>수정 완료</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>주문 배정 (기존 주문)</DialogTitle></DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Label className="w-20 text-right">비밀번호</Label>
                            <Input
                                value={slotPasswordModal}
                                onChange={(e) => setSlotPasswordModal(e.target.value)}
                                placeholder="비밀번호 (자동 생성됨)"
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
                                        {getAvailableSlots(selectedTargetAccount).map((slotNum: number) => (
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
                                <span className="font-bold text-gray-500">날짜</span>
                                <span className="col-span-2">{viewOrder.created_at ? new Date(viewOrder.created_at).toLocaleString() : '-'}</span>
                            </div>
                            <div className="grid grid-cols-3 border-b pb-2">
                                <span className="font-bold text-gray-500">주문번호</span>
                                <span className="col-span-2 font-mono">{viewOrder.order_number}</span>
                            </div>
                            <div className="grid grid-cols-3 border-b pb-2">
                                <span className="font-bold text-gray-500">이름</span>
                                <span className="col-span-2">{viewOrder.profiles?.name || viewOrder.buyer_name || '-'}</span>
                            </div>
                            <div className="grid grid-cols-3 border-b pb-2">
                                <span className="font-bold text-gray-500">이메일</span>
                                <span className="col-span-2">{viewOrder.profiles?.email || viewOrder.buyer_email || '-'}</span>
                            </div>
                            <div className="grid grid-cols-3 border-b pb-2">
                                <span className="font-bold text-gray-500">연락처</span>
                                <span className="col-span-2">{viewOrder.profiles?.phone || viewOrder.buyer_phone || '-'}</span>
                            </div>
                            <div className="grid grid-cols-3 border-b pb-2">
                                <span className="font-bold text-gray-500">회원 ID</span>
                                <span className="col-span-2 font-mono">{viewOrder.profiles?.email || viewOrder.user_id || '-'}</span>
                            </div>
                            <div className="grid grid-cols-3 border-b pb-2">
                                <span className="font-bold text-gray-500">서비스 (기간)</span>
                                <span className="col-span-2">
                                    {viewOrder.products?.name}
                                    {viewOrder.start_date && viewOrder.end_date && (
                                        <span className="ml-1 text-blue-600">
                                            ({differenceInMonths(parseISO(viewOrder.end_date), parseISO(viewOrder.start_date))}개월)
                                        </span>
                                    )}
                                </span>
                            </div>
                            <div className="grid grid-cols-3 border-b pb-2">
                                <span className="font-bold text-gray-500">금액</span>
                                <span className="col-span-2">₩{viewOrder.amount?.toLocaleString()}</span>
                            </div>
                            <div className="grid grid-cols-3 border-b pb-2">
                                <span className="font-bold text-gray-500">상태</span>
                                <span className="col-span-2">
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${viewOrder.assignment_status === 'completed' ? 'bg-green-100 text-green-700' :
                                        viewOrder.assignment_status === 'assigned' ? 'bg-blue-100 text-blue-700' :
                                            viewOrder.payment_status === 'paid' ? 'bg-blue-50 text-blue-600' :
                                                'bg-gray-100 text-gray-600'
                                        }`}>
                                        {getStatusLabel(viewOrder)}
                                    </span>
                                    <span className="ml-2 text-xs text-gray-400">
                                        ({viewOrder.payment_status} / {viewOrder.assignment_status})
                                    </span>
                                </span>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button onClick={() => setIsOrderDetailOpen(false)}>닫기</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Import Result Modal */}
            <Dialog open={isImportResultModalOpen} onOpenChange={setIsImportResultModalOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>임포트 결과 요약</DialogTitle>
                    </DialogHeader>
                    {importResults && (
                        <div className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-green-50 p-4 rounded-lg text-center">
                                    <div className="text-sm text-green-600">성공 마스터</div>
                                    <div className="text-2xl font-bold text-green-700">{importResults.success.masters}</div>
                                </div>
                                <div className="bg-blue-50 p-4 rounded-lg text-center">
                                    <div className="text-sm text-blue-600">성공 슬롯</div>
                                    <div className="text-2xl font-bold text-blue-700">{importResults.success.slots}</div>
                                </div>
                            </div>

                            {importResults.failed.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="text-sm font-bold text-red-600">실패 목록 ({importResults.failed.length})</h4>
                                    <div className="max-h-40 overflow-y-auto border rounded divide-y text-xs">
                                        {importResults.failed.map((f, i) => (
                                            <div key={i} className="p-2 flex justify-between">
                                                <span className="font-medium">{f.id}</span>
                                                <span className="text-red-500">{f.reason}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    <DialogFooter>
                        <Button onClick={() => setIsImportResultModalOpen(false)}>확인</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog open={isNotifyModalOpen} onOpenChange={setIsNotifyModalOpen}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>만료 알림 메세지 발송</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="p-3 bg-blue-50 text-blue-700 rounded-md text-xs">
                            <p className="font-bold mb-1">💡 안내</p>
                            <p>전체 {selectedAssignmentIds.size}명의 회원에게 메일을 발송합니다.</p>
                            <p>치환 코드: <b>{'{buyer_name}'}, {'{tidal_id}'}, {'{end_date}'}</b></p>
                        </div>
                        <div className="space-y-2">
                            <Label className="flex justify-between items-center">
                                <span>발신 명단 ({selectedAssignmentIds.size})</span>
                                <Button variant="ghost" size="sm" onClick={() => setSelectedAssignmentIds(new Set())} className="h-6 px-2 text-[10px]">전체 삭제</Button>
                            </Label>
                            <div className="grid grid-cols-2 gap-2 p-3 bg-gray-50 border rounded-md max-h-40 overflow-y-auto">
                                {Array.from(selectedAssignmentIds).map(id => {
                                    const item = getFlattenedAssignments().find(a => a.id === id);
                                    if (!item) return null;
                                    const bName = item.assignment.buyer_name || item.assignment.orders?.buyer_name || '고객';
                                    const tId = item.assignment.tidal_id || '알 수 없음';
                                    const eDate = item.assignment.end_date ? format(parseISO(item.assignment.end_date), 'yy/MM/dd') : '알 수 없음';
                                    return (
                                        <div key={id} className="flex items-center justify-between gap-1 bg-white border border-gray-200 px-2 py-1.5 rounded shadow-sm text-[11px] group hover:border-orange-300">
                                            <span className="text-gray-600 truncate">{bName} / {eDate} / {tId}</span>
                                            <button
                                                onClick={() => handleToggleSelection(id)}
                                                className="p-1 hover:bg-red-100 hover:text-red-600 rounded-full transition-colors flex-shrink-0"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>메세지 내용 (메일 본문)</Label>
                            <textarea
                                className="w-full h-80 p-3 text-sm border rounded-md focus:ring-2 focus:ring-primary outline-none whitespace-pre-wrap"
                                value={notificationMessage}
                                onChange={(e) => setNotificationMessage(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsNotifyModalOpen(false)}>취소</Button>
                        <Button onClick={handleBulkNotify} disabled={isSendingNotify} className="bg-orange-600 hover:bg-orange-700">
                            {isSendingNotify ? '발송 중...' : '메일 발송하기'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </main >
    );
}

export default function TidalAccountsPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
            <TidalAccountsContent />
        </Suspense>
    );
}
