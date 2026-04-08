"use client";

import React, { useEffect, useState, Suspense } from 'react';
import { useServices } from '@/lib/ServiceContext';
import styles from '../admin.module.css';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { Plus, ChevronDown, ChevronUp, Trash2, ArrowRightLeft, Save, Download, Pencil, Upload, LayoutGrid, List, History, PowerOff, Filter, Mail, X, Search, MessageSquareText, CheckCircle2, MoreHorizontal, Eye } from 'lucide-react';
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
import { differenceInDays, parseISO, format, addDays } from 'date-fns';

interface Assignment {
    id: string;
    slot_number: number;
    tidal_password?: string;
    tidal_id?: string;
    order_id?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    orders?: any;
    type?: 'master' | 'user';
    buyer_name?: string;
    buyer_phone?: string;
    buyer_email?: string;
    order_number?: string;
    start_date?: string;
    end_date?: string;
    period_months?: number;
    amount?: number;
    memo?: string;
    is_active?: boolean;
    is_deleted?: boolean;
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
    products?: { name: string };
    product_plans?: { duration_months: number };
    profiles?: { name: string; phone?: string; email?: string };
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
    amount?: number;
    memo?: string;
    is_active: boolean;
    is_deleted?: boolean;
    assignment_number?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    orders?: any;
}

function LegacyTidalContent() {
    const { isAdmin, isHydrated } = useServices();
    const router = useRouter();
    const searchParams = useSearchParams();

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
        success: { masters: { created: number; updated: number }; slots: { created: number; updated: number } };
        failed: { id: string; reason: string }[];
    } | null>(null);
    const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
    const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
    const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);

    const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
    const [moveTargets, setMoveTargets] = useState<Account[]>([]);
    const [selectedTargetAccount, setSelectedTargetAccount] = useState<string>('');
    const [selectedTargetSlot, setSelectedTargetSlot] = useState<number | null>(null);
    const [showExpiredOnly, setShowExpiredOnly] = useState(false);
    const [showInactive, setShowInactive] = useState(false);
    const [isEditAssignModalOpen, setIsEditAssignModalOpen] = useState(false);
    const [editAssignData, setEditAssignData] = useState<GridValue | null>(null);
    const [editAssignKey, setEditAssignKey] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    const [newAccount, setNewAccount] = useState({ login_id: '', login_pw: '', payment_email: '', payment_day: 1, memo: '', product_id: '', max_slots: 6 });
    const [editingAccount, setEditingAccount] = useState<Account | null>(null);
    const [slotPasswordModal, setSlotPasswordModal] = useState('');
    const [selectedAssignmentIds, setSelectedAssignmentIds] = useState<Set<string>>(new Set());
    const [isNotifyModalOpen, setIsNotifyModalOpen] = useState(false);
    const [notificationMessage, setNotificationMessage] = useState('');
    const [isSendingNotify, setIsSendingNotify] = useState(false);
    const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set());
    const [isMemoModalOpen, setIsMemoModalOpen] = useState(false);
    const [currentMemoInput, setCurrentMemoInput] = useState('');
    const [memoTargetAccountId, setMemoTargetAccountId] = useState('');
    const [memoTargetSlotIdx, setMemoTargetSlotIdx] = useState<number | null>(null);
    const [memoTargetAssignmentId, setMemoTargetAssignmentId] = useState('');
    const [expiredDays, setExpiredDays] = useState(7);
    const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
    const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
        checkbox: 40, login_id: 100, slot: 60, type: 60, tidal_id: 200,
        tidal_password: 120, buyer_name: 100, buyer_email: 150, buyer_phone: 140,
        order_number: 120, start_date: 120, end_date: 120, period: 60, manage: 140
    });
    const [, setResizingCol] = useState<string | null>(null);

    const startResizing = (id: string, e: React.MouseEvent) => {
        e.preventDefault();
        setResizingCol(id);
        const startX = e.pageX;
        const startWidth = columnWidths[id];
        const onMouseMove = (ev: MouseEvent) => {
            const newWidth = Math.max(40, startWidth + (ev.pageX - startX));
            setColumnWidths(prev => ({ ...prev, [id]: newWidth }));
        };
        const onMouseUp = () => {
            setResizingCol(null);
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    const defaultTemplate = React.useMemo(() => `{buyer_name}님
{tidal_id} 서비스가 {end_date}에 만료됩니다.

연장을 원하시면 아래 링크로 접속하여서 신청바랍니다.
${typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_SITE_URL}/public`, []);

    useEffect(() => { setNotificationMessage(defaultTemplate); }, [defaultTemplate]);

    useEffect(() => {
        if (isHydrated && isAdmin) {
            fetchAccounts();
            fetchPendingOrders();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAdmin, isHydrated, showInactive, router]);


    useEffect(() => {
        if (showExpiredOnly) {
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const newExpanded = new Set<string>();
            accounts.forEach(acc => {
                const hasExpired = acc.order_accounts?.some(oa => {
                    if (!oa.end_date) return false;
                    const diff = Math.ceil((parseISO(oa.end_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    return diff <= expiredDays;
                });
                if (hasExpired) newExpanded.add(acc.id);
            });
            setExpandedRows(newExpanded);
        }
    }, [showExpiredOnly, accounts, expiredDays]);

    const fetchAccounts = React.useCallback(async () => {
        try {
            const params = new URLSearchParams({ product: 'HifiTidal' });
            if (showInactive) {
                params.append('showDeleted', 'true');
            } else {
                params.append('showInactive', 'true');
            }
            const res = await apiFetch(`/api/admin/accounts?${params.toString()}`, { cache: 'no-store' });
            if (!res.ok) throw new Error(`Failed to fetch (${res.status})`);
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
                        buyer_name: assignment?.buyer_name || '',
                        buyer_phone: assignment?.buyer_phone || '',
                        buyer_email: assignment?.buyer_email || '',
                        start_date: assignment?.start_date || '',
                        end_date: assignment?.end_date || '',
                        order_number: assignment?.order_number || '',
                        type: assignment?.type || (i === 0 ? 'master' : 'user'),
                        period_months: assignment?.period_months || 0,
                        amount: assignment?.amount || 0,
                        memo: assignment?.memo || '',
                        is_active: assignment?.is_active ?? true,
                        is_deleted: assignment?.is_deleted ?? false,
                    };
                }
            });
            setGridValues(initialGrid);
        } catch (error) { console.error(error); }
    }, [showInactive]);

    const fetchPendingOrders = async () => {
        try {
            const res = await apiFetch('/api/admin/orders', { cache: 'no-store' });
            if (res.ok) {
                const responseData = await res.json();
                const ordersArray = Array.isArray(responseData) ? responseData : responseData.data;
                if (Array.isArray(ordersArray)) {
                    setPendingOrders(ordersArray.filter((o: Order) => o.payment_status === 'paid' && o.assignment_status === 'waiting'));
                }
            }
        } catch (error) { console.error(error); }
    };


    const getAvailableSlots = (accountId: string) => {
        const acc = accounts.find(a => a.id === accountId);
        if (!acc) return [];
        const hasMaster = acc.order_accounts?.some(oa => oa.type === 'master');
        const taken = new Set((acc.order_accounts || []).filter(oa => typeof oa.slot_number === 'number').map(oa => oa.slot_number));
        const available = [];
        for (let i = 0; i < 6; i++) {
            if (!taken.has(i)) { if (i > 0 && !hasMaster) continue; available.push(i); }
        }
        return available;
    };

    const getFlattenedAssignments = () => {
        const flattened: { id: string; assignment: Assignment; account: Account; period: number; originalAccIndex: number }[] = [];
        accounts.forEach((acc, accIdx) => {
            for (let i = 0; i < 6; i++) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                let assignmentObj: any = acc.order_accounts?.find(oa => oa.slot_number === i);
                if (!assignmentObj) {
                    assignmentObj = { id: `empty_${acc.id}_${i}`, slot_number: i, type: i === 0 ? 'master' : 'user', account_id: acc.id, is_active: true, tidal_id: null, tidal_password: null, buyer_name: null, buyer_email: null, buyer_phone: null, order_number: null, start_date: null, end_date: null };
                }
                const assignment = assignmentObj as Assignment;
                const query = searchQuery.toLowerCase().trim();
                if (query) {
                    const bn = (assignment.buyer_name || '').toLowerCase();
                    const be = (assignment.buyer_email || '').toLowerCase();
                    const ti = (assignment.tidal_id || '').toLowerCase();
                    const bp = (assignment.buyer_phone || '').toLowerCase();
                    if (!bn.includes(query) && !be.includes(query) && !ti.includes(query) && !bp.includes(query)) continue;
                }
                if (showExpiredOnly) {
                    if (!assignment.end_date) continue;
                    const today = new Date(); today.setHours(0, 0, 0, 0);
                    const diff = Math.ceil((parseISO(assignment.end_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    if (diff > expiredDays) continue;
                }
                if (!showInactive && assignment.is_deleted === true) continue;
                if (showInactive && assignment.is_deleted !== true) continue;
                let periodNum = assignment.period_months || 0;
                if (!periodNum && assignment.start_date && assignment.end_date) {
                    try { periodNum = Math.floor(differenceInDays(parseISO(assignment.end_date), parseISO(assignment.start_date)) / 30); } catch { }
                }
                if ((showExpiredOnly || showInactive) && periodNum === 1) continue;
                if (periodNum < 1) continue;
                flattened.push({ id: assignment.id, assignment, account: acc, period: periodNum, originalAccIndex: accIdx });
            }
        });
        return flattened;
    };

    const filteredAccounts = accounts.filter(acc => {
        const query = searchQuery.toLowerCase().trim();
        if (!query) return true;
        if (acc.login_id.toLowerCase().includes(query) || acc.payment_email.toLowerCase().includes(query)) return true;
        return acc.order_accounts?.some(oa => {
            const ti = (oa.tidal_id || '').toLowerCase();
            const bn = (oa.buyer_name || '').toLowerCase();
            const bp = (oa.buyer_phone || '').toLowerCase();
            return ti.includes(query) || bn.includes(query) || bp.includes(query);
        });
    });

    const sortedAccounts = [...filteredAccounts].sort((a, b) => {
        if (sortConfig && !isGridView) {
            let aVal: string | number = '', bVal: string | number = '';
            switch (sortConfig.key) {
                case 'login_id': aVal = a.login_id; bVal = b.login_id; break;
                case 'used_slots': aVal = a.order_accounts?.length || 0; bVal = b.order_accounts?.length || 0; break;
                case 'end_date':
                    aVal = a.order_accounts?.find(oa => oa.type === 'master')?.end_date || '9999-12-31';
                    bVal = b.order_accounts?.find(oa => oa.type === 'master')?.end_date || '9999-12-31';
                    break;
                default: return 0;
            }
            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        }
        const masterA = a.order_accounts?.find(oa => oa.type === 'master');
        const masterB = b.order_accounts?.find(oa => oa.type === 'master');
        const endA = masterA?.end_date || '9999-12-31';
        const endB = masterB?.end_date || '9999-12-31';
        if (endA !== endB) return endA.localeCompare(endB);
        return (a.order_accounts?.length || 0) - (b.order_accounts?.length || 0);
    });

    const toggleRow = (id: string) => setExpandedRows(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
    const toggleAllRows = () => {
        const allIds = filteredAccounts.map(acc => acc.id);
        const allExpanded = allIds.every(id => expandedRows.has(id));
        const next = new Set(expandedRows);
        allIds.forEach(id => allExpanded ? next.delete(id) : next.add(id));
        setExpandedRows(next);
    };
    const handleSort = (key: string) => {
        setSortConfig(prev => ({ key, direction: prev?.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
    };

    const updateGridValue = (accountId: string, slotIdx: number, field: string, value: string | number | null) => {
        const key = `${accountId}_${slotIdx}`;
        setGridValues(prev => {
            const current = prev[key] || {};
            const next = { ...current, [field]: value };
            if (field === 'buyer_email' && typeof value === 'string') {
                const prefix = value.split('@')[0];
                next.tidal_id = prefix ? `${prefix}@hifitidal.com` : null;
            }
            if (field === 'start_date' || field === 'period_months') {
                const startStr = next.start_date; const months = parseInt(String(next.period_months)) || 0;
                if (startStr && months >= 0) { try { next.end_date = addDays(parseISO(startStr), months * 30).toISOString().split('T')[0]; } catch { } }
            } else if (field === 'end_date') {
                const startStr = next.start_date; const endStr = next.end_date;
                if (startStr && endStr) { try { next.period_months = Math.max(0, Math.floor(differenceInDays(parseISO(endStr), parseISO(startStr)) / 30)); } catch { } }
            }
            return { ...prev, [key]: next };
        });
    };

    const handleSaveRow = async (accountId: string, slotIdx: number, dataOverride?: GridValue) => {
        const key = `${accountId}_${slotIdx}`;
        const data = dataOverride || gridValues[key];
        if (!data) return;
        try {
            if (data.assignment_id) {
                const res = await apiFetch(`/api/admin/legacy-tidal-account/${data.assignment_id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
                if (!res.ok) throw new Error('Update failed');
            } else {
                if (!data.buyer_name && !data.buyer_email) { alert('이름 또는 ID(이메일)를 입력해주세요.'); return; }
                const res = await apiFetch(`/api/admin/legacy-tidal-account/assign/${accountId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...data, slot_number: slotIdx }) });
                if (!res.ok) throw new Error('Create failed');
            }
            alert('저장되었습니다.');
            setEditingSlots(prev => ({ ...prev, [key]: false }));
            fetchAccounts();
        } catch (e) { alert('저장 실패: ' + (e instanceof Error ? e.message : String(e))); }
    };

    const handleDelete = async (assignmentId: string) => {
        let isMaster = false; let hasUsers = false;
        for (const acc of accounts) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const found = (acc.order_accounts as any[])?.find(oa => oa.id === assignmentId);
            if (found) {
                if (found.type === 'master') { isMaster = true; hasUsers = (acc.order_accounts as Assignment[]).some(oa => oa.type === 'user' && oa.id !== assignmentId); }
                break;
            }
        }
        if (isMaster && hasUsers) { alert('그룹원이 존재하여 마스터 삭제 불가능 합니다'); setPendingDeleteIds(prev => new Set(prev).add(assignmentId)); return; }
        let currentAssignment: Assignment | undefined;
        for (const acc of accounts) { currentAssignment = acc.order_accounts?.find(oa => oa.id === assignmentId); if (currentAssignment) break; }
        if (currentAssignment && currentAssignment.is_active !== false) { alert('비활성화(빨간 행) 상태인 계정만 삭제 가능합니다.'); return; }
        if (!confirm('해당 기록을 삭제하시겠습니까? (삭제된 데이터 보기에 저장되며, 메인 페이지에서 관리 가능합니다)')) return;
        try {
            const res = await apiFetch(`/api/admin/legacy-tidal-account/${assignmentId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Delete failed');
            fetchAccounts(); fetchPendingOrders();
        } catch (error) { alert('삭제 실패: ' + (error instanceof Error ? error.message : String(error))); }
    };

    const handleDeactivate = async (assignmentId: string) => {
        let currentActive = true; let isDeleted = false;
        Object.keys(gridValues).forEach(key => {
            if (gridValues[key].assignment_id === assignmentId) { currentActive = gridValues[key].is_active !== false; isDeleted = gridValues[key].is_deleted === true; }
        });
        const msg = isDeleted ? '다시 활성화(복구) 하시겠습니까?' : (currentActive ? '비활성화 하시겠습니까?' : '다시 활성화 하시겠습니까?');
        if (!confirm(msg)) return;
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const updates: any = { is_active: !currentActive };
            if (isDeleted) { updates.is_deleted = false; updates.is_active = true; }
            const res = await apiFetch(`/api/admin/legacy-tidal-account/${assignmentId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) });
            if (!res.ok) throw new Error('Action failed');
            alert(isDeleted ? '복구되었습니다.' : (currentActive ? '비활성화 되었습니다.' : '활성화 되었습니다.'));
            fetchAccounts();
        } catch (error) { alert('오류: ' + (error instanceof Error ? error.message : String(error))); }
    };

    const handleCreateAccount = async () => {
        if (!newAccount.login_id.trim() || !newAccount.payment_email.trim()) { alert('필수 항목을 입력해주세요.'); return; }
        try {
            const prodRes = await apiFetch('/api/admin/products');
            const products = await prodRes.json();
            const hifitidal = products.find((p: { name: string }) => p.name.toLowerCase() === 'hifitidal') || products.find((p: { name: string }) => p.name.toLowerCase().includes('hifitidal'));
            const res = await apiFetch('/api/admin/accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...newAccount, product_id: hifitidal?.id }) });
            if (!res.ok) throw new Error('Failed to create');
            alert('생성되었습니다.');
            setIsAddModalOpen(false); fetchAccounts();
            setNewAccount({ login_id: '', login_pw: '', payment_email: '', payment_day: 1, memo: '', product_id: '', max_slots: 6 });
        } catch (error) { alert('실패: ' + (error instanceof Error ? error.message : String(error))); }
    };

    const handleUpdateMasterAccount = async () => {
        if (!editingAccount) return;
        try {
            const res = await apiFetch(`/api/admin/accounts/${editingAccount.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editingAccount) });
            if (!res.ok) throw new Error('Failed to update');
            setIsEditModalOpen(false); fetchAccounts(); alert('수정되었습니다.');
        } catch (error) { alert('실패: ' + (error instanceof Error ? error.message : String(error))); }
    };

    const handleDeleteMasterAccount = async (account: Account) => {
        if ((account.order_accounts?.length || 0) > 0) { alert('슬롯이 배정되어 있는 그룹은 삭제할 수 없습니다.'); return; }
        if (!confirm('그룹을 삭제하시겠습니까?')) return;
        try {
            const res = await apiFetch(`/api/admin/accounts/${account.id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Delete failed');
            fetchAccounts(); alert('삭제되었습니다.');
        } catch (error) { alert('실패: ' + (error instanceof Error ? error.message : String(error))); }
    };

    const exportToExcel = () => {
        const flatData = getFlattenedAssignments();
        const excelData: Record<string, string | number>[] = flatData.length === 0
            ? [{ 'No.': '', '배정번호': '', '결제 계정': '', '결제일': '', '메모': '', '고객명': '', '이메일': '', '전화번호': '', '소속 ID': '', '시작일': '', '종료일': '', '개월': '', '계약금액': '' }]
            : flatData.map((item, idx) => ({
                'No.': idx + 1,
                '배정번호': `${item.account.login_id}-${item.assignment.slot_number + 1}`,
                '결제 계정': item.account.payment_email,
                '결제일': `${item.account.payment_day}일`,
                '메모': item.account.memo ?? '',
                '고객명': item.assignment.buyer_name || '',
                '이메일': item.assignment.buyer_email || '',
                '전화번호': item.assignment.buyer_phone || '',
                '소속 ID': item.assignment.tidal_id || '',
                '시작일': item.assignment.start_date || '',
                '종료일': item.assignment.end_date || '',
                '개월': item.period,
                '계약금액': item.assignment.amount || 0
            }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(excelData), '기존Tidal계정');
        XLSX.writeFile(wb, `기존Tidal계정_${new Date().toLocaleDateString()}.xlsx`);
    };

    const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = new Uint8Array(event.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                const res = await apiFetch('/api/admin/accounts/import?product=HifiTidal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accounts: jsonData }) });
                if (!res.ok) { const errObj = await res.json().catch(() => null); throw new Error(errObj?.error || `서버 오류 (${res.status})`); }
                const summary = await res.json();
                setImportResults(summary); setIsImportResultModalOpen(true); fetchAccounts();
            } catch (error: unknown) { alert(`엑셀 업로드 실패: ${(error as Error).message}`); }
        };
        reader.readAsArrayBuffer(file); e.target.value = '';
    };

    const openAssignModal = (account: Account, slotIndex: number) => {
        setSelectedAccount(account); setSelectedSlot(slotIndex);
        setSlotPasswordModal(generateTidalPassword()); setIsAssignModalOpen(true);
    };

    const handleAssign = (orderId: string) => {
        if (!selectedAccount || selectedSlot === null) return;
        const order = pendingOrders.find(o => o.id === orderId); if (!order) return;
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
        setSelectedTargetAccount(''); setSelectedTargetSlot(null); setIsMoveModalOpen(true);
    };

    const handleMove = async () => {
        if (!selectedAssignment) return;
        try {
            const res = await apiFetch('/api/admin/accounts/move', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ assignment_id: selectedAssignment.id, order_id: selectedAssignment.orders?.id, target_account_id: selectedTargetAccount, target_slot_number: selectedTargetSlot, target_tidal_password: selectedAssignment.tidal_password, source_table: 'legacy_tidal_account' })
            });
            if (!res.ok) { const data = await res.json().catch(() => ({})); alert(`이동 실패: ${data?.error || '알 수 없는 오류'}`); return; }
            setIsMoveModalOpen(false); fetchAccounts();
        } catch { alert('이동 실패: 네트워크 오류'); }
    };



    const toggleSelectAll = (filteredFlat: { id: string }[]) => {
        if (selectedAssignmentIds.size === filteredFlat.length) setSelectedAssignmentIds(new Set());
        else setSelectedAssignmentIds(new Set(filteredFlat.map(item => item.id)));
    };

    const handleToggleSelection = (id: string) => {
        setSelectedAssignmentIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
    };

    const handleBulkNotify = async () => {
        if (selectedAssignmentIds.size === 0) return;
        setIsSendingNotify(true);
        try {
            const recipients = getFlattenedAssignments()
                .filter(item => selectedAssignmentIds.has(item.id))
                .map(item => ({ email: item.assignment.buyer_email, buyerName: item.assignment.buyer_name || '고객', tidalId: item.assignment.tidal_id || '알 수 없음', endDate: item.assignment.end_date || '알 수 없음' }))
                .filter(r => !!r.email);
            const res = await apiFetch('/api/admin/tidal/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recipients, messageTemplate: notificationMessage }) });
            if (res.ok) { alert('발송되었습니다.'); setIsNotifyModalOpen(false); setSelectedAssignmentIds(new Set()); }
            else alert('발송 실패');
        } catch { alert('오류 발생'); } finally { setIsSendingNotify(false); }
    };

    const generateTidalPassword = () => {
        const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@$";
        let pass = "";
        for (let i = 0; i < 8; i++) pass += chars.charAt(Math.floor(Math.random() * chars.length));
        return pass;
    };

    const cancelEdit = (accountId: string, slotIdx: number) => {
        setEditingSlots(prev => { const next = { ...prev }; delete next[`${accountId}_${slotIdx}`]; return next; });
        fetchAccounts();
    };

    const openEditAssignModal = (accountId: string, slotIdx: number) => {
        const key = `${accountId}_${slotIdx}`;
        const data = gridValues[key]; if (!data) return;
        const acc = accounts.find(a => a.id === accountId);
        setEditAssignKey(key);
        setEditAssignData({ ...data, assignment_number: acc ? `${acc.login_id}-${slotIdx + 1}` : '' });
        setIsEditAssignModalOpen(true);
    };

    const handleUpdateEditAssign = async () => {
        if (!editAssignKey || !editAssignData) return;
        const [accountId, sIdxStr] = editAssignKey.split('_');
        await handleSaveRow(accountId, parseInt(sIdxStr), editAssignData);
        setIsEditAssignModalOpen(false);
    };

    const openMemoModal = (accountId: string, slotIdx: number, currentMemo: string, assignmentId: string) => {
        setMemoTargetAccountId(accountId); setMemoTargetSlotIdx(slotIdx); setMemoTargetAssignmentId(assignmentId);
        const now = new Date();
        const timestamp = `${String(now.getFullYear()).slice(-2)}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} `;
        setCurrentMemoInput(currentMemo ? timestamp + "\n" + currentMemo : timestamp);
        setIsMemoModalOpen(true);
    };

    const handleSaveMemo = async () => {
        if (!memoTargetAssignmentId) return;
        try {
            const res = await apiFetch(`/api/admin/legacy-tidal-account/${memoTargetAssignmentId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memo: currentMemoInput }) });
            if (!res.ok) throw new Error('Update failed');
            updateGridValue(memoTargetAccountId, memoTargetSlotIdx as number, 'memo', currentMemoInput);
            setIsMemoModalOpen(false); fetchAccounts(); alert('메모가 저장되었습니다.');
        } catch (e) { alert('저장 실패: ' + (e instanceof Error ? e.message : String(e))); }
    };

    if (!isAdmin) return null;

    return (
        <main className={styles.main}>
            <header className={`${styles.header} glass relative z-50`}>
                <div className="container flex justify-between items-center bg-white/50 py-2 rounded-lg">
                    <div className="flex items-center gap-4">
                        <h1 className={styles.title}>기존 Tidal 계정 관리</h1>
                        <Button variant="outline" size="sm" onClick={() => setIsGridView(!isGridView)} className="h-8">
                            {isGridView ? <List size={16} className="mr-2" /> : <LayoutGrid size={16} className="mr-2" />}
                            {isGridView ? 'List View' : 'Grid View'}
                        </Button>
                    </div>
                    <div className="flex gap-2 items-center">
                        <div className="relative flex items-center bg-white border rounded-md px-2 focus-within:ring-2 focus-within:ring-blue-500">
                            <Search size={14} className="text-gray-400" />
                            <Input type="text" placeholder="고객명, Tidal ID, 전화번호 검색..." className="border-0 focus-visible:ring-0 h-8 w-60 text-sm" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 bg-white border rounded-md px-2 py-1">
                                <span className="text-xs text-gray-500 whitespace-nowrap">잔여</span>
                                <Input type="number" value={expiredDays} onChange={e => setExpiredDays(parseInt(e.target.value) || 0)} className="w-12 h-7 px-1 text-center text-sm border-none focus-visible:ring-0" />
                                <span className="text-xs text-gray-500 whitespace-nowrap">일</span>
                            </div>
                            <Button variant={showExpiredOnly ? "default" : "outline"} size="sm" onClick={() => setShowExpiredOnly(!showExpiredOnly)} className="flex items-center gap-2 h-8">
                                <Filter className="w-4 h-4" /> 잔여일 조회
                            </Button>
                            <div className="relative">
                                <input id="excel-import-lt" type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportExcel} />
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setIsMoreMenuOpen(v => !v)}
                                    className="flex items-center gap-1 h-8"
                                >
                                    <MoreHorizontal className="w-4 h-4" />
                                </Button>
                                {isMoreMenuOpen && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setIsMoreMenuOpen(false)} />
                                        <div className="absolute right-0 top-9 z-20 w-44 bg-white border rounded-lg shadow-lg py-1 text-sm">
                                            <button
                                                className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 ${showInactive ? 'text-blue-600' : 'text-gray-700'}`}
                                                onClick={() => { setShowInactive(!showInactive); setIsMoreMenuOpen(false); }}
                                            >
                                                {showInactive ? <Eye className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                                                {showInactive ? '전체 보기' : '삭제 데이터'}
                                            </button>
                                            <button
                                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-gray-700"
                                                onClick={() => { router.push('/admin/legacy-tidal/inactive'); setIsMoreMenuOpen(false); }}
                                            >
                                                <History className="w-4 h-4" /> 내역
                                            </button>
                                            <div className="border-t my-1" />
                                            <button
                                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-gray-700"
                                                onClick={() => { document.getElementById('excel-import-lt')?.click(); setIsMoreMenuOpen(false); }}
                                            >
                                                <Upload className="w-4 h-4" /> 엑셀 가져오기
                                            </button>
                                            <button
                                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-gray-700"
                                                onClick={() => { exportToExcel(); setIsMoreMenuOpen(false); }}
                                            >
                                                <Download className="w-4 h-4" /> 엑셀 내보내기
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                            {isGridView && (
                                <Button variant="default" size="sm" disabled={selectedAssignmentIds.size === 0} onClick={() => { setNotificationMessage(defaultTemplate); setIsNotifyModalOpen(true); }} className={`${selectedAssignmentIds.size > 0 ? 'bg-orange-600 hover:bg-orange-700' : ''} h-8 gap-2`}>
                                    <Mail size={16} /> 알림 보내기 ({selectedAssignmentIds.size})
                                </Button>
                            )}
                            <Button onClick={() => setIsAddModalOpen(true)} className="gap-2 h-8" size="sm">
                                <Plus size={16} /> 그룹 추가
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            <div className={`${styles.content} container`}>
                {isGridView ? (
                    /* ===== GRID VIEW ===== */
                    <div className="bg-white rounded-lg shadow overflow-x-auto">
                        <table className="w-full text-sm min-w-[1400px]">
                            <thead>
                                <tr className="bg-gray-100 border-b">
                                    <th className="text-center py-2 border-r border-gray-200" style={{ width: columnWidths.checkbox }}>
                                        <input type="checkbox" checked={selectedAssignmentIds.size > 0 && selectedAssignmentIds.size === getFlattenedAssignments().length} onChange={() => toggleSelectAll(getFlattenedAssignments())} />
                                    </th>
                                    {[
                                        { id: 'login_id', label: '배정번호', sortable: true },
                                        { id: 'type', label: '타입', sortable: true },
                                        { id: 'tidal_id', label: 'Tidal ID', sortable: false },
                                        { id: 'buyer_name', label: '고객명', sortable: false },
                                        { id: 'buyer_email', label: '이메일', sortable: true },
                                        { id: 'buyer_phone', label: '전화번호', sortable: false },
                                        { id: 'start_date', label: '시작일', sortable: true },
                                        { id: 'end_date', label: '종료일', sortable: true },
                                        { id: 'period', label: '개월', sortable: true },
                                        { id: 'amount', label: '계약금액', sortable: true },
                                    ].map(col => (
                                        <th key={col.id} className="relative p-2 text-center border-r cursor-pointer hover:bg-gray-200" style={{ width: columnWidths[col.id] }}>
                                            <div className="flex items-center justify-center gap-1" onClick={() => col.sortable && handleSort(col.id)}>
                                                {col.label} {sortConfig?.key === col.id && (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                                            </div>
                                            <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400" onMouseDown={e => startResizing(col.id, e)} />
                                        </th>
                                    ))}
                                    <th className="relative p-2 text-center" style={{ width: columnWidths.manage }}>관리</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(() => {
                                    const flattened = getFlattenedAssignments();
                                    if (sortConfig) {
                                        flattened.sort((a, b) => {
                                            let aVal: string | number = '', bVal: string | number = '';
                                            switch (sortConfig.key) {
                                                case 'start_date': aVal = a.assignment.start_date || '0000'; bVal = b.assignment.start_date || '0000'; break;
                                                case 'end_date': aVal = a.assignment.end_date || '9999'; bVal = b.assignment.end_date || '9999'; break;
                                                case 'period': aVal = a.period; bVal = b.period; break;
                                                case 'type': aVal = a.assignment.type || ''; bVal = b.assignment.type || ''; break;
                                                case 'login_id': aVal = a.account.login_id; bVal = b.account.login_id; break;
                                                case 'buyer_email': aVal = a.assignment.buyer_email || ''; bVal = b.assignment.buyer_email || ''; break;
                                                case 'amount': aVal = a.assignment.amount || 0; bVal = b.assignment.amount || 0; break;
                                                default: return 0;
                                            }
                                            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                                            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                                            return 0;
                                        });
                                    } else {
                                        flattened.sort((a, b) => {
                                            const da = a.assignment.end_date || '9999'; const db = b.assignment.end_date || '9999';
                                            if (da !== db) return da.localeCompare(db);
                                            return a.account.login_id.localeCompare(b.account.login_id);
                                        });
                                    }
                                    return flattened.map(item => {
                                        const { assignment, account: acc } = item;
                                        const sIdx = assignment.slot_number;
                                        const key = `${acc.id}_${sIdx}`;
                                        const val = gridValues[key] || {};
                                        const isEditing = editingSlots[key];
                                        const today = new Date(); today.setHours(0, 0, 0, 0);
                                        const isExpired = assignment.end_date ? parseISO(assignment.end_date) < today : false;
                                        const isEmpty = assignment.id.startsWith('empty_');
                                        const isDeactivated = val.is_active === false;
                                        return (
                                            <tr key={assignment.id} className={`border-b hover:bg-gray-50 ${isDeactivated ? 'bg-red-100 text-red-500' : (isExpired ? 'bg-red-50/30' : '')} ${selectedAssignmentIds.has(assignment.id) ? 'bg-blue-50/50' : ''}`}>
                                                <td className="text-center py-1 border-r border-gray-100" style={{ width: columnWidths.checkbox }}>
                                                    <input type="checkbox" checked={selectedAssignmentIds.has(assignment.id)} onChange={() => handleToggleSelection(assignment.id)} />
                                                </td>
                                                <td className="text-center text-xs py-1 border-r border-gray-100 font-bold whitespace-nowrap px-1" style={{ width: columnWidths.login_id }}>
                                                    <div className="flex items-center justify-center gap-1">
                                                        <span className={isEmpty ? "text-green-600" : "text-gray-900"}>{acc.login_id}-{assignment.slot_number + 1}</span>
                                                        {sIdx === 0 && (acc.order_accounts?.length || 0) === 0 && (
                                                            <button type="button" onClick={e => { e.stopPropagation(); handleDeleteMasterAccount(acc); }}>
                                                                <Trash2 size={12} className="text-red-400 hover:text-red-600" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-2 text-center border-r" style={{ width: columnWidths.type }}>
                                                    {!isEmpty && (
                                                        <div className="flex items-center justify-center gap-1">
                                                            <span className={`px-1 rounded text-xs ${assignment.type === 'master' ? 'bg-purple-100 text-purple-700 font-bold' : 'bg-blue-50 text-blue-600'}`}>{assignment.type === 'master' ? 'Master' : 'User'}</span>
                                                            <MessageSquareText size={14} className={`cursor-pointer ${val.memo ? 'text-blue-500 fill-blue-50' : 'text-gray-300 hover:text-gray-500'}`} onClick={e => { e.stopPropagation(); openMemoModal(acc.id, sIdx, val.memo || '', assignment.id); }} />
                                                        </div>
                                                    )}
                                                </td>
                                                {isEditing ? (
                                                    <>
                                                        <td className="p-1 border-r" style={{ width: columnWidths.tidal_id }}><Input className="h-7 text-xs bg-white px-1" value={val.tidal_id || ''} onChange={e => updateGridValue(acc.id, sIdx, 'tidal_id', e.target.value)} /></td>
                                                        <td className="p-1 border-r" style={{ width: columnWidths.buyer_name }}><Input className="h-7 text-xs bg-white px-1" value={val.buyer_name || ''} onChange={e => updateGridValue(acc.id, sIdx, 'buyer_name', e.target.value)} /></td>
                                                        <td className="p-1 border-r" style={{ width: columnWidths.buyer_email }}><Input className="h-7 text-xs bg-white px-1" value={val.buyer_email || ''} onChange={e => updateGridValue(acc.id, sIdx, 'buyer_email', e.target.value)} /></td>
                                                        <td className="p-1 border-r" style={{ width: columnWidths.buyer_phone }}><Input className="h-7 text-xs bg-white px-1" value={val.buyer_phone || ''} onChange={e => updateGridValue(acc.id, sIdx, 'buyer_phone', e.target.value)} /></td>
                                                        <td className="p-1 border-r" style={{ width: columnWidths.start_date }}><Input type="date" className="h-7 text-xs bg-white px-1" value={val.start_date || ''} onChange={e => updateGridValue(acc.id, sIdx, 'start_date', e.target.value)} /></td>
                                                        <td className="p-1 border-r" style={{ width: columnWidths.end_date }}><Input type="date" className="h-7 text-xs bg-white px-1" value={val.end_date || ''} onChange={e => updateGridValue(acc.id, sIdx, 'end_date', e.target.value)} /></td>
                                                        <td className="p-1 border-r w-12" style={{ width: columnWidths.period }}><Input type="number" className="h-7 text-xs bg-white px-1" placeholder="개월" value={val.period_months || ''} onChange={e => updateGridValue(acc.id, sIdx, 'period_months', parseInt(e.target.value) || 0)} /></td>
                                                        <td className="p-1 border-r w-16"><Input type="number" className="h-7 text-xs bg-white px-1" placeholder="금액" value={val.amount || ''} onChange={e => updateGridValue(acc.id, sIdx, 'amount', parseInt(e.target.value) || 0)} /></td>
                                                    </>
                                                ) : isEmpty ? (
                                                    <><td className="p-2 border-r" style={{ width: columnWidths.tidal_id }} /><td className="p-2 border-r" style={{ width: columnWidths.buyer_name }} /><td className="p-2 border-r" style={{ width: columnWidths.buyer_email }} /><td className="p-2 border-r" style={{ width: columnWidths.buyer_phone }} /><td className="p-2 border-r" style={{ width: columnWidths.start_date }} /><td className="p-2 border-r" style={{ width: columnWidths.end_date }} /><td className="p-2 border-r" style={{ width: columnWidths.period }} /><td className="p-2 border-r" /></>
                                                ) : (
                                                    <>
                                                        <td className="p-2 border-r truncate max-w-[120px]" title={assignment.tidal_id || undefined} style={{ width: columnWidths.tidal_id }}><span className={pendingDeleteIds.has(assignment.id) ? "text-red-500 font-bold" : ""}>{assignment.tidal_id || '-'}</span></td>
                                                        <td className="p-2 border-r truncate max-w-[80px]" title={assignment.buyer_name || undefined} style={{ width: columnWidths.buyer_name }}><span className={pendingDeleteIds.has(assignment.id) ? "text-red-500 font-bold" : ""}>{assignment.buyer_name || '-'}</span></td>
                                                        <td className="p-2 border-r truncate max-w-[120px]" title={assignment.buyer_email || undefined} style={{ width: columnWidths.buyer_email }}>{assignment.buyer_email || '-'}</td>
                                                        <td className="p-2 border-r truncate max-w-[100px]" title={assignment.buyer_phone || undefined} style={{ width: columnWidths.buyer_phone }}>{assignment.buyer_phone || '-'}</td>
                                                        <td className="p-2 text-center border-r font-mono" style={{ width: columnWidths.start_date }}>{assignment.start_date ? format(parseISO(assignment.start_date), 'yy-MM-dd') : '-'}</td>
                                                        <td className="p-2 text-center border-r font-mono" style={{ width: columnWidths.end_date }}><span className={isExpired ? "text-red-600 font-bold" : ""}>{assignment.end_date ? format(parseISO(assignment.end_date), 'yy-MM-dd') : '-'}</span></td>
                                                        <td className="p-2 text-center border-r font-mono" style={{ width: columnWidths.period }}>{item.period}</td>
                                                        <td className="p-2 text-right border-r font-mono">{val.amount ? val.amount.toLocaleString() : '-'}</td>
                                                    </>
                                                )}
                                                <td className="p-2 text-center" style={{ width: columnWidths.manage }}>
                                                    <div className="flex justify-center gap-1 items-center">
                                                        {isEditing ? (
                                                            <>
                                                                <Button size="sm" variant="default" className="h-6 w-6 p-0 bg-blue-600 hover:bg-blue-700" title="저장" onClick={() => handleSaveRow(acc.id, sIdx)}><Save size={12} /></Button>
                                                                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-gray-500" title="취소" onClick={() => cancelEdit(acc.id, sIdx)}><X size={12} /></Button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-gray-400 hover:text-blue-600" title="수정" onClick={() => openEditAssignModal(acc.id, sIdx)}><Pencil size={12} /></Button>
                                                                {!isEmpty && (
                                                                    <>
                                                                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-gray-400 hover:text-blue-600" title="이동" onClick={() => openMoveModal(assignment)}><ArrowRightLeft size={12} /></Button>
                                                                        <Button size="sm" variant="ghost" className={`${isDeactivated ? 'text-red-500 hover:text-green-600' : 'text-gray-400 hover:text-orange-600'} h-6 w-6 p-0`} title={isDeactivated ? '활성화' : '비활성화'} onClick={() => handleDeactivate(assignment.id)}>
                                                                            {isDeactivated ? <CheckCircle2 size={12} /> : <PowerOff size={12} />}
                                                                        </Button>
                                                                        {isDeactivated && <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-400 hover:text-red-600" title="삭제" onClick={() => handleDelete(assignment.id)}><Trash2 size={12} /></Button>}
                                                                    </>
                                                                )}
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
                    /* ===== LIST VIEW ===== */
                    <div className="bg-white rounded-lg shadow overflow-hidden">
                        <div className="grid grid-cols-14 gap-4 p-4 bg-gray-50 font-bold border-b text-base">
                            <div className="col-span-1 cursor-pointer hover:bg-gray-100 flex items-center gap-1" onClick={() => handleSort('login_id')}>GroupID {sortConfig?.key === 'login_id' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}</div>
                            <div className="col-span-2">결제계좌</div>
                            <div className="col-span-1 text-center font-bold">결제일</div>
                            <div className="col-span-1 text-left">메모</div>
                            <div className="col-span-2 text-left">마스터계정</div>
                            <div className="col-span-2 text-left cursor-pointer hover:bg-gray-100 flex items-center gap-1" onClick={() => handleSort('end_date')}>종료예정일 {sortConfig?.key === 'end_date' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}</div>
                            <div className="col-span-1 text-left">지속개월</div>
                            <div className="col-span-1 text-right pr-2">계약금액</div>
                            <div className="col-span-1 text-center cursor-pointer hover:bg-gray-100 flex items-center justify-center gap-1" onClick={() => handleSort('used_slots')}>슬롯 {sortConfig?.key === 'used_slots' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}</div>
                            <div className="col-span-1 text-center">관리</div>
                            <div className="col-span-1 text-center cursor-pointer hover:text-blue-600 whitespace-nowrap" onClick={toggleAllRows}>{filteredAccounts.length > 0 && filteredAccounts.every(acc => expandedRows.has(acc.id)) ? '전체접기' : '전체펼치기'}</div>
                        </div>
                        {sortedAccounts.map(acc => {
                            const isExpanded = expandedRows.has(acc.id);
                            const hasMaster = acc.order_accounts?.some(oa => oa.type === 'master');
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const paddedAssignments: any[] = [];
                            for (let i = 0; i < acc.max_slots; i++) {
                                const existing = acc.order_accounts?.find(oa => oa.slot_number === i);
                                if (existing) { paddedAssignments.push(existing); }
                                else { if (i > 0 && !hasMaster) continue; paddedAssignments.push({ id: `empty_${acc.id}_${i}`, slot_number: i, type: i === 0 ? 'master' : 'user', account_id: acc.id, is_active: true, tidal_id: null, tidal_password: null, buyer_name: null, buyer_email: null, buyer_phone: null, order_number: null, start_date: null, end_date: null }); }
                            }
                            let sortedAssignments = paddedAssignments.sort((a, b) => {
                                if (a.type === 'master' && b.type !== 'master') return -1;
                                if (b.type === 'master' && a.type !== 'master') return 1;
                                return (a.slot_number || 0) - (b.slot_number || 0);
                            });
                            if (showExpiredOnly) {
                                const today = new Date(); today.setHours(0, 0, 0, 0);
                                sortedAssignments = sortedAssignments.filter(a => a.end_date && parseISO(a.end_date) < today);
                                if (sortedAssignments.length === 0) return null;
                            }
                            if (showInactive) { sortedAssignments = sortedAssignments.filter(oa => oa.is_active === false); if (sortedAssignments.length === 0) return null; }
                            else { sortedAssignments = sortedAssignments.filter(oa => oa.is_active !== false); }

                            const masterSlot = acc.order_accounts?.find(oa => oa.type === 'master');
                            const tidalId = masterSlot?.tidal_id || '-';
                            const endDate = masterSlot?.end_date || '-';
                            let isWarning = false;
                            if (masterSlot?.end_date) {
                                try {
                                    const end = parseISO(masterSlot.end_date); const today = new Date(); today.setHours(0, 0, 0, 0);
                                    const warn = new Date(today); warn.setDate(today.getDate() + 30);
                                    if (end < warn) isWarning = true;
                                } catch { }
                            }
                            let duration = '-';
                            if (masterSlot?.start_date) {
                                try { duration = `${Math.floor(differenceInDays(new Date(), parseISO(masterSlot.start_date)) / 30)}개월`; } catch { }
                            }
                            return (
                                <div key={acc.id} id={`account-${acc.id}`} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                                    <div className="grid grid-cols-14 gap-4 p-4 items-center text-base">
                                        <div className="col-span-1 text-gray-700 font-medium cursor-pointer truncate" title={acc.login_id} onClick={() => toggleRow(acc.id)}>{acc.login_id}</div>
                                        <div className="col-span-2 truncate cursor-pointer" title={acc.payment_email} onClick={() => toggleRow(acc.id)}><span className="text-blue-600 font-semibold text-base truncate">{acc.payment_email}</span></div>
                                        <div className="col-span-1 text-center text-gray-400 font-mono cursor-pointer" onClick={() => toggleRow(acc.id)}>{acc.payment_day}일</div>
                                        <div className="col-span-1 text-gray-500 text-xs text-left truncate cursor-pointer" title={acc.memo} onClick={() => toggleRow(acc.id)}>{acc.memo}</div>
                                        <div className="col-span-2 text-gray-700 text-sm truncate cursor-pointer" title={tidalId} onClick={() => toggleRow(acc.id)}>{tidalId}</div>
                                        <div className={`col-span-2 font-mono text-sm cursor-pointer ${isWarning ? 'text-red-600 font-bold' : 'text-gray-900'}`} onClick={() => toggleRow(acc.id)}>{endDate}</div>
                                        <div className="col-span-1 text-gray-500 font-mono text-sm cursor-pointer" onClick={() => toggleRow(acc.id)}>{duration}</div>
                                        <div className="col-span-1 text-right text-gray-500 font-mono text-sm pr-2 cursor-pointer" onClick={() => toggleRow(acc.id)}>-</div>
                                        <div className="col-span-1 text-center cursor-pointer" onClick={() => toggleRow(acc.id)}>
                                            <span className={`px-2 py-1 rounded-full text-sm font-bold ${(acc.order_accounts?.length || 0) >= 6 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>{acc.order_accounts?.length || 0}/6</span>
                                        </div>
                                        <div className="col-span-1 text-center flex justify-center gap-1">
                                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-blue-600" title="그룹 수정" onClick={e => { e.stopPropagation(); setEditingAccount(acc); setIsEditModalOpen(true); }}><Pencil size={14} /></Button>
                                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-red-600" title="그룹 삭제" onClick={e => { e.stopPropagation(); handleDeleteMasterAccount(acc); }}><Trash2 size={14} /></Button>
                                        </div>
                                        <div className="col-span-1 text-center cursor-pointer" onClick={() => toggleRow(acc.id)}>{isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</div>
                                    </div>
                                    {isExpanded && (
                                        <div className="bg-white border-t p-4 overflow-x-auto">
                                            <table className="w-full text-sm min-w-[1200px]">
                                                <thead>
                                                    <tr className="text-gray-400 border-b">
                                                        <th className="py-2 text-center w-16">배정번호</th>
                                                        <th className="py-2 text-center w-20">Type</th>
                                                        <th className="py-2 text-left w-32">Tidal ID</th>
                                                        <th className="py-2 text-left w-20">이름</th>
                                                        <th className="py-2 text-left w-28">이메일</th>
                                                        <th className="py-2 text-left w-28">전화번호</th>
                                                        <th className="py-2 text-left w-24">가입일</th>
                                                        <th className="py-2 text-left w-24">종료일</th>
                                                        <th className="py-2 text-center w-16">개월</th>
                                                        <th className="py-2 text-right w-20 pr-2">계약금액</th>
                                                        <th className="py-2 text-center w-40">관리</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {sortedAssignments.map(assignment => {
                                                        const sIdx = assignment.slot_number;
                                                        const key = `${acc.id}_${sIdx}`;
                                                        const val = gridValues[key] || {};
                                                        const isEditing = editingSlots[key];
                                                        let period = '-'; let isExpired = false;
                                                        if (val.start_date && val.end_date) {
                                                            try {
                                                                const start = parseISO(val.start_date); const end = parseISO(val.end_date);
                                                                const diff = Math.floor(differenceInDays(end, start) / 30);
                                                                if (diff > 0) period = `${diff}개월`;
                                                                const today = new Date(); today.setHours(0, 0, 0, 0);
                                                                if (end < today) isExpired = true;
                                                            } catch { }
                                                        }
                                                        const isEmpty = assignment.id.startsWith('empty_');
                                                        const isDeactivated = assignment.is_active === false;
                                                        return (
                                                            <tr key={assignment.id} className={`border-b last:border-0 h-10 hover:bg-gray-50 ${isDeactivated ? 'bg-red-100 text-red-500' : (isExpired ? 'bg-red-50/20' : '')}`}>
                                                                <td className="text-center text-[10px] font-bold"><span className={isEmpty ? "text-green-600" : "text-gray-900"}>{acc.login_id}-{assignment.slot_number + 1}</span></td>
                                                                {isEditing ? (
                                                                    <>
                                                                        <td className="px-1">
                                                                            <Select value={val.type || 'user'} onValueChange={async (value) => {
                                                                                if (value === 'master') {
                                                                                    const hasMasterLocal = acc.order_accounts?.some(oa => oa.type === 'master' && oa.slot_number !== sIdx);
                                                                                    if (hasMasterLocal) { alert('이미 Master가 설정되어 있습니다.'); return; }
                                                                                    if (sIdx !== 0) {
                                                                                        const slot0InUse = acc.order_accounts?.some(oa => oa.slot_number === 0 && !oa.id.startsWith('empty_'));
                                                                                        if (slot0InUse) { alert('1번 슬롯이 이미 사용 중입니다.'); return; }
                                                                                        if (assignment && !assignment.id.startsWith('empty_')) {
                                                                                            if (confirm('마스터로 변경 시 즉시 1번 슬롯으로 이동합니다. 계속하시겠습니까?')) {
                                                                                                try {
                                                                                                    const res = await apiFetch(`/api/admin/legacy-tidal-account/${assignment.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'master' }) });
                                                                                                    if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || '변경 실패');
                                                                                                    cancelEdit(acc.id, sIdx); fetchAccounts(); alert('마스터로 변경되었습니다.');
                                                                                                } catch (error) { alert('변경 실패: ' + (error instanceof Error ? error.message : String(error))); }
                                                                                            }
                                                                                            return;
                                                                                        } else { alert('신규 마스터 배정은 1번 슬롯을 통해 진행해주세요.'); return; }
                                                                                    }
                                                                                }
                                                                                updateGridValue(acc.id, sIdx, 'type', value);
                                                                            }}>
                                                                                <SelectTrigger className="h-8 text-xs bg-white"><SelectValue /></SelectTrigger>
                                                                                <SelectContent><SelectItem value="master">Master</SelectItem><SelectItem value="user">User</SelectItem></SelectContent>
                                                                            </Select>
                                                                        </td>
                                                                        <td className="px-1"><Input className="h-8 text-xs bg-white" placeholder="Tidal ID" value={val.tidal_id || ''} onChange={e => updateGridValue(acc.id, sIdx, 'tidal_id', e.target.value)} /></td>
                                                                        <td className="px-1"><Input className="h-8 text-xs bg-white" placeholder="이름" value={val.buyer_name || ''} onChange={e => updateGridValue(acc.id, sIdx, 'buyer_name', e.target.value)} /></td>
                                                                        <td className="px-1"><Input className="h-8 text-xs bg-white" placeholder="Email" value={val.buyer_email || ''} onChange={e => updateGridValue(acc.id, sIdx, 'buyer_email', e.target.value)} /></td>
                                                                        <td className="px-1"><Input className="h-8 text-xs bg-white" placeholder="전화번호" value={val.buyer_phone || ''} onChange={e => updateGridValue(acc.id, sIdx, 'buyer_phone', e.target.value)} /></td>
                                                                        <td className="px-1"><Input type="date" className="h-8 text-xs bg-white px-1" value={val.end_date || ''} onChange={e => updateGridValue(acc.id, sIdx, 'end_date', e.target.value)} /></td>
                                                                        <td className="px-1 w-16"><Input type="number" className="h-8 text-xs bg-white px-1" placeholder="금액" value={val.amount || ''} onChange={e => updateGridValue(acc.id, sIdx, 'amount', parseInt(e.target.value) || 0)} /></td>
                                                                    </>
                                                                ) : isEmpty ? (
                                                                    <><td /><td /><td /><td /><td /><td /><td /><td /></>
                                                                ) : (
                                                                    <>
                                                                        <td className="px-2 text-center">
                                                                            <div className="flex items-center justify-center gap-1">
                                                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${val.type === 'master' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>{val.type === 'master' ? 'Master' : 'User'}</span>
                                                                                {assignment.id && !assignment.id.startsWith('empty') && <MessageSquareText size={14} className={`cursor-pointer ${val.memo ? 'text-blue-500 fill-blue-50' : 'text-gray-300 hover:text-gray-500'}`} onClick={e => { e.stopPropagation(); openMemoModal(acc.id, sIdx, val.memo || '', assignment.id); }} />}
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-2 text-gray-700 truncate max-w-[120px]" title={val.tidal_id || undefined}><span className={pendingDeleteIds.has(assignment.id) ? "text-red-500 font-bold" : ""}>{val.tidal_id || '-'}</span></td>
                                                                        <td className="px-2 text-gray-700 truncate max-w-[80px]"><span className={pendingDeleteIds.has(assignment.id) ? "text-red-500 font-bold" : ""}>{val.buyer_name || '-'}</span></td>
                                                                        <td className="px-2 text-gray-700 truncate max-w-[120px]">{val.buyer_email || '-'}</td>
                                                                        <td className="px-2 text-gray-700 truncate max-w-[100px]">{val.buyer_phone || '-'}</td>
                                                                        <td className="px-2 text-gray-500 font-mono">{val.start_date || '-'}</td>
                                                                        <td className="px-2 font-mono"><span className={isExpired ? "text-red-500 font-bold" : "text-gray-500"}>{val.end_date || '-'}{isExpired && <span className="ml-1 text-[10px] bg-red-100 text-red-600 px-1 rounded">만료</span>}</span></td>
                                                                    </>
                                                                )}
                                                                <td className="text-center text-gray-500 font-mono">{!isEmpty ? period : ''}</td>
                                                                <td className="text-right text-gray-700 font-mono px-2">{!isEmpty ? (val.amount ? val.amount.toLocaleString() : '-') : ''}</td>
                                                                <td>
                                                                    <div className="flex justify-center gap-1 items-center">
                                                                        {isEditing ? (
                                                                            <>
                                                                                <Button size="sm" variant="default" className="h-7 w-7 p-0 bg-blue-600" title="저장" onClick={() => handleSaveRow(acc.id, assignment.slot_number)}><Save size={14} /></Button>
                                                                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-500" title="취소" onClick={() => cancelEdit(acc.id, assignment.slot_number)}>X</Button>
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-blue-600" title="수정" onClick={() => openEditAssignModal(acc.id, assignment.slot_number)}><Pencil size={14} /></Button>
                                                                                {isEmpty && <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-blue-600" title="배정" onClick={() => openAssignModal(acc, assignment.slot_number)}><Plus size={14} /></Button>}
                                                                                {!isEmpty && (
                                                                                    <>
                                                                                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-blue-600" title="이동" onClick={() => openMoveModal(assignment)}><ArrowRightLeft size={14} /></Button>
                                                                                        <Button size="sm" variant="ghost" className={`h-7 w-7 p-0 ${isDeactivated ? 'text-red-500 hover:text-green-600' : 'text-gray-400 hover:text-orange-600'}`} title={isDeactivated ? "활성화" : "비활성화"} onClick={() => handleDeactivate(assignment.id)}>
                                                                                            {isDeactivated ? <CheckCircle2 size={14} /> : <PowerOff size={14} />}
                                                                                        </Button>
                                                                                        {isDeactivated && <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" title="삭제" onClick={() => handleDelete(assignment.id)}><Trash2 size={14} /></Button>}
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
                )}
            </div>

            {/* ===== MODALS ===== */}
            <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>그룹 추가</DialogTitle></DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">그룹 ID <span className="text-red-500">*</span></Label><Input value={newAccount.login_id} onChange={e => setNewAccount({ ...newAccount, login_id: e.target.value })} className="col-span-3" placeholder="GROUP-001" /></div>
                        <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">결제 계정 <span className="text-red-500">*</span></Label><Input value={newAccount.payment_email} onChange={e => setNewAccount({ ...newAccount, payment_email: e.target.value })} className="col-span-3" placeholder="payment@email.com" /></div>
                        <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">결제일 <span className="text-red-500">*</span></Label><Input type="number" min="1" max="31" value={newAccount.payment_day} onChange={e => setNewAccount({ ...newAccount, payment_day: parseInt(e.target.value) || 1 })} className="col-span-3" /></div>
                        <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">메모</Label><Input value={newAccount.memo} onChange={e => setNewAccount({ ...newAccount, memo: e.target.value })} className="col-span-3" /></div>
                    </div>
                    <DialogFooter><Button onClick={handleCreateAccount}>저장</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>그룹 수정</DialogTitle></DialogHeader>
                    {editingAccount && (
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">그룹 ID <span className="text-red-500">*</span></Label><Input value={editingAccount.login_id || ''} onChange={e => setEditingAccount({ ...editingAccount, login_id: e.target.value })} className="col-span-3" /></div>
                            <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">결제 계정 <span className="text-red-500">*</span></Label><Input value={editingAccount.payment_email || ''} onChange={e => setEditingAccount({ ...editingAccount, payment_email: e.target.value })} className="col-span-3" /></div>
                            <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">결제일 <span className="text-red-500">*</span></Label><Input type="number" min="1" max="31" value={editingAccount.payment_day || 1} onChange={e => setEditingAccount({ ...editingAccount, payment_day: parseInt(e.target.value) || 1 })} className="col-span-3" /></div>
                            <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">메모</Label><Input value={editingAccount.memo || ''} onChange={e => setEditingAccount({ ...editingAccount, memo: e.target.value })} className="col-span-3" /></div>
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
                            <Input value={slotPasswordModal} onChange={e => setSlotPasswordModal(e.target.value)} placeholder="비밀번호 (자동 생성됨)" className="flex-1" />
                        </div>
                        <div className="border rounded-md max-h-60 overflow-y-auto">
                            {pendingOrders.length === 0 ? <div className="p-4 text-center text-gray-500 text-sm">대기 중인 결제 완료 주문이 없습니다.</div>
                                : pendingOrders.map(order => (
                                    <div key={order.id} className="flex justify-between items-center p-3 border-b last:border-0 hover:bg-gray-50">
                                        <div><div className="font-bold text-sm">{order.buyer_name || order.profiles?.name}</div><div className="text-xs text-gray-500">{order.products?.name}</div></div>
                                        <Button size="sm" onClick={() => handleAssign(order.id)}>선택</Button>
                                    </div>
                                ))}
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
                            <div>{selectedAssignment?.buyer_name || selectedAssignment?.orders?.buyer_name} ({selectedAssignment?.buyer_phone || selectedAssignment?.orders?.buyer_phone})</div>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">이동할 계정</Label>
                            <Select onValueChange={setSelectedTargetAccount} value={selectedTargetAccount}>
                                <SelectTrigger className="col-span-3"><SelectValue placeholder="계정 선택" /></SelectTrigger>
                                <SelectContent>{moveTargets.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.login_id} (잔여: {acc.max_slots - acc.used_slots})</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        {selectedTargetAccount && (
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right">대상 Slot</Label>
                                <Select onValueChange={val => setSelectedTargetSlot(Number(val))} value={selectedTargetSlot?.toString()}>
                                    <SelectTrigger className="col-span-3"><SelectValue placeholder="슬롯 선택" /></SelectTrigger>
                                    <SelectContent>{getAvailableSlots(selectedTargetAccount).map(n => <SelectItem key={n} value={n.toString()}>Slot #{n + 1}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>
                    <DialogFooter><Button onClick={handleMove} disabled={!selectedTargetAccount || selectedTargetSlot === null}>이동 확인</Button></DialogFooter>
                </DialogContent>
            </Dialog>



            <Dialog open={isImportResultModalOpen} onOpenChange={setIsImportResultModalOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>임포트 결과 요약</DialogTitle></DialogHeader>
                    {importResults && (
                        <div className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-green-50 p-4 rounded-lg text-center">
                                    <div className="text-sm text-green-600 font-bold mb-2">마스터 계정</div>
                                    <div className="flex justify-around">
                                        <div><div className="text-[10px] text-green-500">신규</div><div className="text-xl font-bold text-green-700">{importResults.success.masters.created}</div></div>
                                        <div><div className="text-[10px] text-green-500">업데이트</div><div className="text-xl font-bold text-green-700">{importResults.success.masters.updated}</div></div>
                                    </div>
                                </div>
                                <div className="bg-blue-50 p-4 rounded-lg text-center">
                                    <div className="text-sm text-blue-600 font-bold mb-2">슬롯</div>
                                    <div className="flex justify-around">
                                        <div><div className="text-[10px] text-blue-500">신규</div><div className="text-xl font-bold text-blue-700">{importResults.success.slots.created}</div></div>
                                        <div><div className="text-[10px] text-blue-500">업데이트</div><div className="text-xl font-bold text-blue-700">{importResults.success.slots.updated}</div></div>
                                    </div>
                                </div>
                            </div>
                            {importResults.failed.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="text-sm font-bold text-red-600">실패 목록 ({importResults.failed.length})</h4>
                                    <div className="max-h-40 overflow-y-auto border rounded divide-y text-xs">
                                        {importResults.failed.map((f, i) => <div key={i} className="p-2 flex justify-between"><span className="font-medium">{f.id}</span><span className="text-red-500">{f.reason}</span></div>)}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    <DialogFooter><Button onClick={() => setIsImportResultModalOpen(false)}>확인</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isNotifyModalOpen} onOpenChange={setIsNotifyModalOpen}>
                <DialogContent className="max-w-xl">
                    <DialogHeader><DialogTitle>만료 알림 메세지 발송</DialogTitle></DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="p-3 bg-blue-50 text-blue-700 rounded-md text-xs">
                            <p className="font-bold mb-1">💡 안내</p>
                            <p>전체 {selectedAssignmentIds.size}명의 회원에게 메일을 발송합니다.</p>
                            <p>치환 코드: <b>{'{buyer_name}'}, {'{tidal_id}'}, {'{end_date}'}</b></p>
                        </div>
                        <textarea className="w-full h-80 p-3 text-sm border rounded-md focus:ring-2 focus:ring-primary outline-none whitespace-pre-wrap" value={notificationMessage} onChange={e => setNotificationMessage(e.target.value)} />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsNotifyModalOpen(false)}>취소</Button>
                        <Button onClick={handleBulkNotify} disabled={isSendingNotify} className="bg-orange-600 hover:bg-orange-700">{isSendingNotify ? '발송 중...' : '메일 발송하기'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isEditAssignModalOpen} onOpenChange={setIsEditAssignModalOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader><DialogTitle>정보수정 / {editAssignData?.assignment_number}</DialogTitle></DialogHeader>
                    {editAssignData && (
                        <div className="grid gap-4 py-4 overflow-y-auto max-h-[70vh] px-1">
                            <div className="flex gap-4">
                                <div className="w-[30%] space-y-1"><Label className="text-xs text-gray-500">이름</Label><Input value={editAssignData.buyer_name || ''} onChange={e => setEditAssignData({ ...editAssignData, buyer_name: e.target.value })} className="h-9" /></div>
                                <div className="flex-1 space-y-1"><Label className="text-xs text-gray-500">Tidal ID</Label><Input value={editAssignData.tidal_id || ''} onChange={e => setEditAssignData({ ...editAssignData, tidal_id: e.target.value })} className="h-9" /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1"><Label className="text-xs text-gray-500">전화번호</Label><Input value={editAssignData.buyer_phone || ''} onChange={e => setEditAssignData({ ...editAssignData, buyer_phone: e.target.value })} className="h-9" /></div>
                                <div className="space-y-1"><Label className="text-xs text-gray-500">이메일</Label><Input value={editAssignData.buyer_email || ''} onChange={e => setEditAssignData({ ...editAssignData, buyer_email: e.target.value })} className="h-9" /></div>
                            </div>
                            <div className="flex gap-2">
                                <div className="flex-1 space-y-1">
                                    <Label className="text-[10px] text-gray-500">시작일</Label>
                                    <Input type="date" value={editAssignData.start_date || ''} onChange={e => {
                                        const ns = e.target.value; let ne = editAssignData.end_date;
                                        if (ns && editAssignData.period_months) { try { ne = addDays(parseISO(ns), editAssignData.period_months * 30).toISOString().split('T')[0]; } catch { } }
                                        setEditAssignData({ ...editAssignData, start_date: ns, end_date: ne });
                                    }} className="h-9 text-xs px-1" />
                                </div>
                                <div className="flex-1 space-y-1">
                                    <Label className="text-[10px] text-gray-500">종료일</Label>
                                    <Input type="date" value={editAssignData.end_date || ''} onChange={e => {
                                        const ne = e.target.value; let nm = editAssignData.period_months;
                                        if (editAssignData.start_date && ne) { try { nm = Math.max(0, Math.floor(differenceInDays(parseISO(ne), parseISO(editAssignData.start_date)) / 30)); } catch { } }
                                        setEditAssignData({ ...editAssignData, end_date: ne, period_months: nm });
                                    }} className="h-9 text-xs px-1" />
                                </div>
                                <div className="w-12 space-y-1">
                                    <Label className="text-[10px] text-gray-500">개월</Label>
                                    <Input type="number" value={editAssignData.period_months || ''} onChange={e => {
                                        const m = parseInt(e.target.value) || 0; let ne = editAssignData.end_date;
                                        if (editAssignData.start_date && m >= 0) { try { ne = addDays(parseISO(editAssignData.start_date), m * 30).toISOString().split('T')[0]; } catch { } }
                                        setEditAssignData({ ...editAssignData, period_months: m, end_date: ne });
                                    }} className="h-9 text-xs px-1" />
                                </div>
                                <div className="w-24 space-y-1">
                                    <Label className="text-[10px] text-gray-500">계약금액(원)</Label>
                                    <Input type="text" value={editAssignData.amount ? editAssignData.amount.toLocaleString() : ''} onChange={e => setEditAssignData({ ...editAssignData, amount: parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0 })} className="h-9 text-xs px-1" />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-gray-500">메모</Label>
                                <textarea rows={3} className="w-full p-2 text-sm border rounded-md focus:ring-1 focus:ring-blue-500 outline-none" value={editAssignData.memo || ''} onChange={e => setEditAssignData({ ...editAssignData, memo: e.target.value })} />
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditAssignModalOpen(false)}>취소</Button>
                        <Button onClick={handleUpdateEditAssign} className="bg-blue-600 hover:bg-blue-700">저장하기</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isMemoModalOpen} onOpenChange={setIsMemoModalOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader><DialogTitle>메모 편집</DialogTitle></DialogHeader>
                    <div className="py-4">
                        <textarea className="w-full min-h-[100px] p-3 border rounded-md text-sm outline-none focus:ring-2 focus:ring-primary" placeholder="메모를 입력하세요..." value={currentMemoInput} onChange={e => setCurrentMemoInput(e.target.value)} />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsMemoModalOpen(false)}>취소</Button>
                        <Button onClick={handleSaveMemo}>저장</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </main>
    );
}

export default function LegacyTidalPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
            <LegacyTidalContent />
        </Suspense>
    );
}
