"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
    Plus, ChevronDown, ChevronUp, Trash2, ArrowRightLeft, Download, Pencil, Upload, 
    LayoutGrid, List, History, PowerOff, Filter, Mail, Search, MessageSquareText, 
    Zap, UserPlus, Settings 
} from 'lucide-react';
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { differenceInDays, parseISO, format, addDays } from 'date-fns';
import { EmailTemplateModal } from '@/components/admin/EmailTemplateModal';

interface Assignment {
    id: string;
    slot_number: number;
    tidal_password?: string;
    tidal_id?: string;
    order_id?: string;
    orders?: unknown;
    type?: 'master' | 'user';
    buyer_name?: string;
    buyer_phone?: string;
    buyer_email?: string;
    order_number?: string;
    start_date?: string;
    end_date?: string;
    period_months?: number;
    amount?: number;
    is_active?: boolean;
    is_deleted?: boolean;
    memo?: string;
    assigned_at?: string;
    updated_at?: string;
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
    updated_at?: string;
    assigned_at?: string;
    orders?: unknown;
}

interface LegacyTidalContentProps {
    titlePrefix?: string;
    basePath: string;
    fetchFn?: (url: string, init?: RequestInit) => Promise<Response>;
}

export function LegacyTidalContent({ 
    titlePrefix = "Legacy", 
    basePath, 
    fetchFn = fetch 
}: LegacyTidalContentProps) {
    const router = useRouter();

    const [accounts, setAccounts] = useState<Account[]>([]);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [isGridView, setIsGridView] = useState(true);
    const [gridValues, setGridValues] = useState<Record<string, GridValue>>({});
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
    const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
    const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
    const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);

    const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
    const [moveTargets, setMoveTargets] = useState<Account[]>([]);
    const [selectedTargetAccount, setSelectedTargetAccount] = useState<string>('');
    const [selectedTargetSlot, setSelectedTargetSlot] = useState<number | null>(null);
    const [showExpiredOnly, setShowExpiredOnly] = useState(false);
    

    
    const [searchQuery, setSearchQuery] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    const [newAccount, setNewAccount] = useState({ login_id: '', login_pw: '', payment_email: '', payment_day: 1, memo: '', product_id: '', max_slots: 6 });
    const [editingAccount, setEditingAccount] = useState<Account | null>(null);
    const [slotPasswordModal, setSlotPasswordModal] = useState('');
    const [selectedAssignmentIds, setSelectedAssignmentIds] = useState<Set<string>>(new Set());
    const [isNotifyModalOpen, setIsNotifyModalOpen] = useState(false);
    const [notificationMessage, setNotificationMessage] = useState('');
    const [emailTemplates, setEmailTemplates] = useState<{id?: string, key: string, name: string, subject?: string, content?: string, design?: any, placeholders?: any[]}[]>([]);
    const [selectedTemplateKey, setSelectedTemplateKey] = useState('');
    const [isSendingNotify, setIsSendingNotify] = useState(false);
    const [isTemplateEditOpen, setIsTemplateEditOpen] = useState(false);
    const [isMemoModalOpen, setIsMemoModalOpen] = useState(false);
    const [currentMemoInput, setCurrentMemoInput] = useState('');
    const [memoTargetAccountId, setMemoTargetAccountId] = useState('');
    const [memoTargetSlotIdx, setMemoTargetSlotIdx] = useState<number | null>(null);
    const [memoTargetAssignmentId, setMemoTargetAssignmentId] = useState('');
    const [expiredDays, setExpiredDays] = useState(7);
    const [isQuickEditModalOpen, setIsQuickEditModalOpen] = useState(false);
    const [quickEditValues, setQuickEditValues] = useState<GridValue | null>(null);
    const [initialQuickEditValues, setInitialQuickEditValues] = useState<GridValue | null>(null);
    
    const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
        checkbox: 26, login_id: 56, edit: 30, memo: 60, tidal_id: 90,
        tidal_password: 80, buyer_name: 55, buyer_email: 90, buyer_phone: 80,
        order_number: 80, start_date: 65, end_date: 65, updated_at: 65, period: 48, amount: 58
    });
    const [, setResizingCol] = useState<string | null>(null);

    const [copiedId, setCopiedId] = useState<string | null>(null);

    const handleMasterIdClick = (e: React.MouseEvent, id: string | null | undefined) => {
        if (!id || id === '-') return;
        e.stopPropagation();
        navigator.clipboard.writeText(id).then(() => {
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 2000);
        });
        window.open('https://account.tidal.com/family', '_blank');
    };

    const startResizing = (id: string, e: React.MouseEvent) => {
        e.preventDefault();
        setResizingCol(id);
        const startX = e.pageX;
        const startWidth = columnWidths[id];
        const startMemoWidth = columnWidths['memo'];
        const onMouseMove = (ev: MouseEvent) => {
            const diff = ev.pageX - startX;
            let newWidth = Math.max(40, startWidth + diff);
            if (id !== 'memo') {
                let newMemoWidth = startMemoWidth - diff;
                if (newMemoWidth < 40) { newMemoWidth = 40; newWidth = startWidth + (startMemoWidth - 40); }
                setColumnWidths(prev => ({ ...prev, [id]: newWidth, memo: newMemoWidth }));
            } else {
                setColumnWidths(prev => ({ ...prev, [id]: newWidth }));
            }
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
${typeof window !== 'undefined' ? window.location.origin : ''}/public`, []);

    useEffect(() => { setNotificationMessage(defaultTemplate); }, [defaultTemplate]);

    const fetchAccounts = useCallback(async () => {
        try {
            const params = new URLSearchParams({ product: 'HifiTidal' });
            // 항상 비활성 데이터도 포함해서 가져오되 필터링은 클라이언트에서 수행하거나 
            // product=HifiTidal 파라미터를 그대로 사용 (기존 로직 유지)
            params.append('showInactive', 'true'); 
            
            const res = await fetchFn(`/api/admin/legacy-tidal?${params.toString()}`, { cache: 'no-store' });
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
                        updated_at: assignment?.updated_at || assignment?.assigned_at,
                        assigned_at: assignment?.assigned_at,
                    };
                }
            });
            setGridValues(initialGrid);
        } catch (error) { console.error(error); }
    }, [fetchFn]);

    const fetchPendingOrders = useCallback(async () => {
        try {
            const res = await fetchFn('/api/admin/orders', { cache: 'no-store' });
            if (res.ok) {
                const responseData = await res.json();
                const ordersArray = Array.isArray(responseData) ? responseData : responseData.data;
                if (Array.isArray(ordersArray)) {
                    setPendingOrders(ordersArray.filter((o: Order) => o.payment_status === 'paid' && o.assignment_status === 'waiting'));
                }
            }
        } catch (error) { console.error(error); }
    }, [fetchFn]);

    const fetchTemplates = useCallback(async () => {
        try {
            const res = await fetchFn('/api/admin/email-templates');
            if (res.ok) {
                const data = await res.json();
                setEmailTemplates(data);
                const firstLegacy = data.find((t: {key: string}) => t.key.startsWith('LEGACY'));
                if (firstLegacy) setSelectedTemplateKey(firstLegacy.key);
            }
        } catch (error) { console.error(error); }
    }, [fetchFn]);

    useEffect(() => {
        fetchAccounts();
        fetchPendingOrders();
        fetchTemplates();
    }, [fetchAccounts, fetchPendingOrders, fetchTemplates]);

    const getFlattenedAssignments = useCallback(() => {
        const flattened: { id: string; assignment: Assignment; account: Account; period: number; originalAccIndex: number }[] = [];
        accounts.forEach((acc, accIdx) => {
            for (let i = 0; i < acc.max_slots; i++) {
                let assignmentObj: Assignment | null = acc.order_accounts?.find(oa => oa.slot_number === i) || null;
                if (!assignmentObj) {
                    // 비어있는 슬롯 객체 생성
                    assignmentObj = { 
                        id: `empty_${acc.id}_${i}`, 
                        slot_number: i, 
                        type: i === 0 ? 'master' : 'user', 
                        is_active: true, 
                        is_deleted: false,
                        tidal_id: undefined, 
                        tidal_password: undefined, 
                        buyer_name: undefined, 
                        buyer_email: undefined, 
                        buyer_phone: undefined, 
                        order_number: undefined, 
                        start_date: undefined, 
                        end_date: undefined 
                    } as Assignment;
                }
                const assignment = assignmentObj;

                // 계약개월 미리 계산 (필터링 및 표시용)
                let periodNum = assignment.period_months || 0;
                if (!periodNum && assignment.start_date && assignment.end_date) {
                    try { periodNum = Math.floor(differenceInDays(parseISO(assignment.end_date), parseISO(assignment.start_date)) / 30); } catch { }
                }

                // 1개월 계약 건 제외 (사용자 요청)
                if (periodNum > 0 && periodNum <= 1) continue;

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
                
                // 활성 상태 데이터만 표시 (is_deleted 제외)
                if (assignment.is_deleted === true) continue;
                if (assignment.is_active === false) continue;

                flattened.push({ id: assignment.id, assignment, account: acc, period: periodNum, originalAccIndex: accIdx });
            }
        });
        return flattened;
    }, [accounts, searchQuery, showExpiredOnly, expiredDays]);

    const filteredAccounts = accounts.filter(acc => {
        const query = searchQuery.toLowerCase().trim();
        let queryMatches = !query; // 검색어가 없으면 기본 true

        if (query) {
            if (acc.login_id.toLowerCase().includes(query) || acc.payment_email.toLowerCase().includes(query)) {
                queryMatches = true;
            } else if (acc.order_accounts?.some(oa => {
                // 1개월 계약 건은 검색에서도 제외
                let pMonths = oa.period_months || 0;
                if (!pMonths && oa.start_date && oa.end_date) {
                    try { pMonths = Math.floor(differenceInDays(parseISO(oa.end_date), parseISO(oa.start_date)) / 30); } catch { }
                }
                if (pMonths > 0 && pMonths <= 1) return false;

                const ti = (oa.tidal_id || '').toLowerCase();
                const bn = (oa.buyer_name || '').toLowerCase();
                const bp = (oa.buyer_phone || '').toLowerCase();
                return ti.includes(query) || bn.includes(query) || bp.includes(query);
            })) {
                queryMatches = true;
            }
        }

        if (!queryMatches) return false;

        // 잔여일 조회 필터 (계약개월 1개월 미만 제외 포함)
        if (showExpiredOnly) {
            const hasExpiringSlot = acc.order_accounts?.some(oa => {
                if (!oa.end_date || oa.is_deleted || !oa.is_active) return false;
                
                // 계약개월 1개월 이하 체크
                let pMonths = oa.period_months || 0;
                if (!pMonths && oa.start_date && oa.end_date) {
                    try { pMonths = Math.floor(differenceInDays(parseISO(oa.end_date), parseISO(oa.start_date)) / 30); } catch { }
                }
                if (pMonths > 0 && pMonths <= 1) return false;

                const today = new Date(); today.setHours(0, 0, 0, 0);
                const diff = Math.ceil((parseISO(oa.end_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                return diff <= expiredDays;
            });
            if (!hasExpiringSlot) return false;
        }

        return true;
    });

    const sortedAccounts = [...filteredAccounts].sort((a, b) => {
        if (sortConfig && !isGridView) {
            let aVal: string | number = '', bVal: string | number = '';
            switch (sortConfig.key) {
                case 'login_id': aVal = a.login_id; bVal = b.login_id; break;
                case 'used_slots': aVal = a.order_accounts?.length || 0; bVal = b.order_accounts?.length || 0; break;
                case 'updated_at':
                    aVal = a.order_accounts?.reduce((max, oa) => { const date = oa.updated_at || oa.assigned_at || '1970-01-01'; return date > max ? date : max; }, '1970-01-01') || '1970-01-01';
                    bVal = b.order_accounts?.reduce((max, oa) => { const date = oa.updated_at || oa.assigned_at || '1970-01-01'; return date > max ? date : max; }, '1970-01-01') || '1970-01-01';
                    break;
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

    const handleSort = (key: string) => {
        setSortConfig(prev => ({ key, direction: prev?.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
    };

    const handleSaveRow = async (accountId: string, slotIdx: number, dataOverride?: GridValue) => {
        const key = `${accountId}_${slotIdx}`;
        const data = dataOverride || gridValues[key];
        if (!data) return;
        try {
            if (data.assignment_id) {
                const res = await fetchFn(`/api/admin/legacy-tidal/assignment/${data.assignment_id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
                if (!res.ok) throw new Error('Update failed');
            } else {
                if (!data.buyer_name && !data.buyer_email) { alert('이름 또는 ID(이메일)를 입력해주세요.'); return; }
                const res = await fetchFn(`/api/admin/legacy-tidal/assign/${accountId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...data, slot_number: slotIdx }) });
                if (!res.ok) throw new Error('Create failed');
            }
            alert('저장되었습니다.');
            fetchAccounts();
        } catch { alert('저장 실패'); }
    };

    const handleCreateAccount = async () => {
        if (!newAccount.login_id.trim() || !newAccount.payment_email.trim()) { alert('필수 항목을 입력해주세요.'); return; }
        try {
            const prodRes = await fetchFn('/api/admin/products');
            const products = await prodRes.json();
            const hifitidal = products.find((p: { name: string }) => p.name.toLowerCase() === 'hifitidal') || products.find((p: { name: string }) => p.name.toLowerCase().includes('hifitidal'));
            const res = await fetchFn('/api/admin/legacy-tidal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...newAccount, product_id: hifitidal?.id }) });
            if (!res.ok) throw new Error('Failed to create');
            alert('생성되었습니다.');
            setIsAddModalOpen(false); fetchAccounts();
            setNewAccount({ login_id: '', login_pw: '', payment_email: '', payment_day: 1, memo: '', product_id: '', max_slots: 6 });
        } catch (error) { alert('실패: ' + (error instanceof Error ? error.message : String(error))); }
    };

    const handleUpdateMasterAccount = async () => {
        if (!editingAccount) return;
        try {
            const res = await fetchFn(`/api/admin/legacy-tidal/${editingAccount.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editingAccount) });
            if (!res.ok) throw new Error('Failed to update');
            setIsEditModalOpen(false); fetchAccounts(); alert('수정되었습니다.');
        } catch (error) { alert('실패: ' + (error instanceof Error ? error.message : String(error))); }
    };

    const handleDeleteMasterAccount = async (account: Account) => {
        if ((account.order_accounts?.length || 0) > 0) { alert('슬롯이 배정되어 있는 그룹은 삭제할 수 없습니다.'); return; }
        if (!confirm('그룹을 삭제하시겠습니까?')) return;
        try {
            const res = await fetchFn(`/api/admin/legacy-tidal/${account.id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Delete failed');
            fetchAccounts(); alert('삭제되었습니다.');
        } catch (error) { alert('실패: ' + (error instanceof Error ? error.message : String(error))); }
    };

    const handleToggleActive = async (assignment: Assignment, accountId?: string) => {
        // Optimistic update
        const accId = accountId || accounts.find(acc => acc.order_accounts?.some(oa => oa.id === assignment.id))?.id;
        
        const revertAccounts = accounts;
        const revertGrid = gridValues;

        if (accId) {
            setGridValues(prev => ({
                ...prev,
                [`${accId}_${assignment.slot_number}`]: {
                    ...prev[`${accId}_${assignment.slot_number}`],
                    is_active: !(assignment.is_active ?? true),
                }
            }));
            
            setAccounts(prev => prev.map(acc => {
                if (acc.id === accId) {
                    return {
                        ...acc,
                        order_accounts: acc.order_accounts?.map(oa => oa.id === assignment.id ? { ...oa, is_active: !(assignment.is_active ?? true) } : oa)
                    };
                }
                return acc;
            }));
        }

        try {
            const res = await fetchFn(`/api/admin/legacy-tidal/assignment/${assignment.id}/toggle-active`, { method: 'POST' });
            if (!res.ok) throw new Error('Toggle failed');
            fetchAccounts(); // silently verify
        } catch { 
            alert('상태 변경 실패');
            if (accId) {
                setAccounts(revertAccounts);
                setGridValues(revertGrid);
            }
        }
    };

    const exportToExcel = () => {
        const flatData = getFlattenedAssignments();
        const excelData = flatData.map((item, idx) => ({
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
                const res = await fetchFn('/api/admin/legacy-tidal/import?product=HifiTidal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accounts: jsonData }) });
                if (!res.ok) throw new Error('Excel import failed');
                await res.json();
                fetchAccounts();
            } catch (error: unknown) { 
                const msg = error instanceof Error ? error.message : String(error);
                alert(`엑셀 업로드 실패: ${msg}`); 
            }
        };
        reader.readAsArrayBuffer(file); e.target.value = '';
    };

    const generateTidalPassword = () => {
        const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@$";
        let pass = "";
        for (let i = 0; i < 8; i++) pass += chars.charAt(Math.floor(Math.random() * chars.length));
        return pass;
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
            const res = await fetchFn('/api/admin/legacy-tidal/move', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ assignment_id: selectedAssignment.id, target_account_id: selectedTargetAccount, target_slot_number: selectedTargetSlot })
            });
            if (!res.ok) { alert('이동 실패'); return; }
            setIsMoveModalOpen(false); fetchAccounts();
        } catch { alert('이동 실패'); }
    };

    const getAvailableSlots = (accountId: string) => {
        const acc = accounts.find(a => a.id === accountId);
        if (!acc) return [];
        const taken = new Set((acc.order_accounts || []).map(oa => oa.slot_number));
        const available = [];
        for (let i = 0; i < acc.max_slots; i++) { if (!taken.has(i)) available.push(i); }
        return available;
    };

    const toggleSelectAll = (filteredFlat: { id: string }[]) => {
        if (selectedAssignmentIds.size === filteredFlat.length) setSelectedAssignmentIds(new Set());
        else setSelectedAssignmentIds(new Set(filteredFlat.map(item => item.id)));
    };

    const handleToggleSelection = (id: string) => {
        setSelectedAssignmentIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
    };

    const handleBulkMove = () => {
        if (selectedAssignmentIds.size === 1) {
            const targetId = Array.from(selectedAssignmentIds)[0];
            const item = getFlattenedAssignments().find(i => i.assignment.id === targetId);
            if (item) openMoveModal(item.assignment);
        } else alert('이동은 한 번에 하나씩만 가능합니다.');
    };

    const handleBulkDeactivate = async () => {
        if (!confirm('일괄 비활성/활성 하시겠습니까?')) return;
        try {
            await Promise.all(Array.from(selectedAssignmentIds).map(id => fetchFn(`/api/admin/legacy-tidal/assignment/${id}/toggle-active`, { method: 'POST' })));
            fetchAccounts();
        } catch { alert('일괄 처리 실패'); }
    };

    const handleBulkDelete = async () => {
        if (!confirm('정말 삭제하시겠습니까?')) return;
        try {
            await Promise.all(Array.from(selectedAssignmentIds).map(id => fetchFn(`/api/admin/legacy-tidal/assignment/${id}`, { method: 'DELETE' })));
            setSelectedAssignmentIds(new Set()); fetchAccounts();
        } catch { alert('일괄 삭제 실패'); }
    };

    const handleBulkNotify = async () => {
        if (selectedAssignmentIds.size === 0) return;
        setIsSendingNotify(true);
        try {
            const recipients = getFlattenedAssignments()
                .filter(item => selectedAssignmentIds.has(item.id))
                .map(item => ({ email: item.assignment.buyer_email, buyerName: item.assignment.buyer_name, tidalId: item.assignment.tidal_id, endDate: item.assignment.end_date }))
                .filter(r => !!r.email);
            const res = await fetchFn('/api/admin/tidal/notify', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({
                    recipients,
                    messageTemplate: notificationMessage,
                    templateKey: selectedTemplateKey,
                    senderEmail: 'HiFi Tidal <hifitidal@hifitidal.com>'
                })
            });
            if (res.ok) { alert('발송되었습니다.'); setIsNotifyModalOpen(false); setSelectedAssignmentIds(new Set()); }
            else alert('발송 실패');
        } catch { alert('오류 발생'); } finally { setIsSendingNotify(false); }
    };

    const openQuickEditModal = (accountId: string, slotIdx: number, val: GridValue, assignmentId: string) => {
        setQuickEditValues({ ...val, assignment_id: assignmentId });
        setInitialQuickEditValues({ ...val, assignment_id: assignmentId });
        setMemoTargetAccountId(accountId);
        setMemoTargetSlotIdx(slotIdx);
        setIsQuickEditModalOpen(true);
    };

    const handleSaveQuickEdit = async () => {
        if (!quickEditValues) return;
        await handleSaveRow(memoTargetAccountId, memoTargetSlotIdx as number, quickEditValues);
        setIsQuickEditModalOpen(false);
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
            const res = await fetchFn(`/api/admin/legacy-tidal/assignment/${memoTargetAssignmentId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memo: currentMemoInput }) });
            if (!res.ok) throw new Error('Update failed');
            fetchAccounts();
            setIsMemoModalOpen(false);
        } catch { alert('저장 실패'); }
    };

    return (
        <main className="p-4 bg-[#f8fafc] min-h-screen max-w-[1200px] mx-auto">
            <header className="bg-white border rounded-xl shadow-sm mb-4 p-3">
                <div className="flex flex-col md:flex-row justify-between items-center gap-3">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <h1 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            <span className="bg-orange-100 text-orange-600 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider border border-orange-200">{titlePrefix}</span>
                            기존 Tidal 계정 관리
                        </h1>
                        <Button variant="outline" size="sm" onClick={() => setIsGridView(!isGridView)} className="h-9">
                            {isGridView ? <List size={16} className="mr-2" /> : <LayoutGrid size={16} className="mr-2" />}
                            {isGridView ? 'List View' : 'Grid View'}
                        </Button>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto justify-end">
                        <div className="relative flex items-center bg-gray-50 border rounded-lg px-2 focus-within:ring-2 focus-within:ring-blue-500 w-full md:w-40">
                            <Search size={14} className="text-gray-400" />
                            <Input 
                                type="text" 
                                placeholder="검색..." 
                                className="border-0 bg-transparent focus-visible:ring-0 h-9 text-sm" 
                                value={searchQuery} 
                                onChange={e => setSearchQuery(e.target.value)} 
                            />
                        </div>

                        <div className="flex items-center gap-1 bg-gray-50 border rounded-lg px-2 py-1">
                            <span className="text-[11px] text-gray-500">만료</span>
                            <Input 
                                type="number" 
                                value={expiredDays} 
                                onChange={e => setExpiredDays(parseInt(e.target.value) || 0)} 
                                className="w-10 h-7 px-1 text-center text-sm border-none bg-transparent focus-visible:ring-0" 
                            />
                            <span className="text-[11px] text-gray-500">일전</span>
                        </div>

                        <Button 
                            variant={showExpiredOnly ? "default" : "outline"} 
                            size="sm" 
                            onClick={() => setShowExpiredOnly(!showExpiredOnly)} 
                            className="h-9 px-3 text-xs gap-1.5"
                        >
                            <Filter className="w-3.5 h-3.5" /> 잔여일
                        </Button>

                        <Button 
                            variant={sortConfig?.key === 'updated_at' ? "default" : "outline"}
                            size="sm" 
                            onClick={() => {
                                if (sortConfig?.key === 'updated_at') setSortConfig(null);
                                else setSortConfig({ key: 'updated_at', direction: 'desc' });
                            }} 
                            className="h-9 px-3 text-xs gap-1.5"
                        >
                            <Zap className="w-3.5 h-3.5" /> 변경일
                        </Button>

                        {/* 비활성 드롭다운 메뉴 */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-9 px-3 text-xs gap-1.5">
                                    <History className="w-3.5 h-3.5" /> 비활성 <ChevronDown size={12} />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                                <DropdownMenuItem onClick={() => router.push(`${basePath}/inactive`)}>
                                    비활성 내역
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => router.push(`${basePath}/inactive?showDeleted=true`)}>
                                    삭제 내역
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <div className="flex items-center gap-2">
                            {selectedAssignmentIds.size > 0 && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" size="sm" className="h-9 bg-blue-50 text-blue-700 border-blue-200">
                                            선택 ({selectedAssignmentIds.size}) <ChevronDown size={14} className="ml-1" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-40">
                                        <DropdownMenuItem onClick={handleBulkMove} className="gap-2">
                                            <ArrowRightLeft size={14} /> 이동
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={handleBulkDeactivate} className="gap-2">
                                            <PowerOff size={14} /> 활성/비활성
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={handleBulkDelete} className="text-red-600 gap-2 font-semibold">
                                            <Trash2 size={14} /> 삭제
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}

                            {isGridView && (
                                <Button 
                                    variant="default" 
                                    size="sm" 
                                    disabled={selectedAssignmentIds.size === 0} 
                                    onClick={() => { setNotificationMessage(defaultTemplate); setIsNotifyModalOpen(true); }} 
                                    className={`${selectedAssignmentIds.size > 0 ? 'bg-orange-600 hover:bg-orange-700' : ''} h-9 gap-2 text-xs`}
                                >
                                    <Mail className="w-4 h-4" /> 알림 발송
                                </Button>
                            )}

                            {!isGridView && (
                                <Button onClick={() => setIsAddModalOpen(true)} className="h-9 gap-2 text-xs" size="sm">
                                    <Plus className="w-4 h-4" /> 그룹 추가
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            <div className="content">
                {isGridView ? (
                    /* ===== GRID VIEW ===== */
                    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-[11px] min-w-[780px]">
                                <thead>
                                    <tr className="bg-slate-50 border-b text-slate-500 uppercase font-bold tracking-tight">
                                        <th className="text-center py-3 border-r border-slate-100 whitespace-nowrap" style={{ width: columnWidths.checkbox }}>
                                            <input 
                                                type="checkbox" 
                                                className="rounded border-slate-300 pointer-events-auto"
                                                checked={selectedAssignmentIds.size > 0 && selectedAssignmentIds.size === getFlattenedAssignments().length} 
                                                onChange={() => toggleSelectAll(getFlattenedAssignments())} 
                                            />
                                        </th>
                                        {[
                                            { id: 'login_id', label: '번호', sortable: true },
                                            { id: 'edit', label: '수정', sortable: false },
                                            { id: 'tidal_id', label: 'Tidal ID', sortable: false },
                                            { id: 'buyer_name', label: '고객명', sortable: false },
                                            { id: 'buyer_email', label: '이메일', sortable: true },
                                            { id: 'buyer_phone', label: '전화번호', sortable: false },
                                            { id: 'start_date', label: '시작일', sortable: true },
                                            { id: 'end_date', label: '종료일', sortable: true },
                                            { id: 'period', label: '계약 개월', sortable: true },
                                            { id: 'amount', label: '계약금액', sortable: true },
                                            { id: 'updated_at', label: '변경일', sortable: true },
                                            { id: 'memo', label: '메모', sortable: false },
                                        ].map(col => (
                                            <th key={col.id} className="relative px-2 py-3 text-center border-r border-slate-100 cursor-pointer hover:bg-slate-100 group transition-colors whitespace-nowrap" style={{ width: columnWidths[col.id] }}>
                                                <div className="flex items-center justify-center gap-1.5" onClick={() => col.sortable && handleSort(col.id)}>
                                                    {col.label} 
                                                    {sortConfig?.key === col.id && (
                                                        sortConfig.direction === 'asc' ? <ChevronUp size={10} className="text-blue-500" /> : <ChevronDown size={10} className="text-blue-500" />
                                                    )}
                                                </div>
                                                <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" onMouseDown={e => startResizing(col.id, e)} />
                                            </th>
                                        ))}
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
                                                    case 'updated_at': aVal = a.assignment.updated_at || a.assignment.assigned_at || '0000'; bVal = b.assignment.updated_at || b.assignment.assigned_at || '0000'; break;
                                                    case 'period': aVal = a.period || 0; bVal = b.period || 0; break;
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
                                            const today = new Date(); today.setHours(0, 0, 0, 0);
                                            const isExpired = assignment.end_date ? parseISO(assignment.end_date) < today : false;
                                            const isEmpty = assignment.id.startsWith('empty_');
                                            const isDeactivated = val.is_active === false;
                                            
                                            return (
                                                <tr key={assignment.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${isDeactivated ? 'bg-red-50 text-red-500' : (isExpired ? 'bg-red-50/30' : (isEmpty ? 'bg-emerald-50/50 text-emerald-700' : ''))} ${selectedAssignmentIds.has(assignment.id) ? 'bg-blue-50/50' : ''}`}>
                                                    <td className="text-center py-2 border-r border-slate-100 whitespace-nowrap">
                                                        <input 
                                                            type="checkbox" 
                                                            className="rounded border-slate-300"
                                                            checked={selectedAssignmentIds.has(assignment.id)} 
                                                            onChange={() => handleToggleSelection(assignment.id)} 
                                                        />
                                                    </td>
                                                    <td className="text-center font-bold px-2 border-r border-slate-100 text-slate-700 whitespace-nowrap">
                                                        {acc.login_id}-{assignment.slot_number + 1}
                                                    </td>
                                                    <td className="text-center border-r border-slate-100 whitespace-nowrap">
                                                        <Popover>
                                                            <PopoverTrigger asChild>
                                                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-400 hover:text-blue-600 hover:bg-white border hover:border-blue-200">
                                                                    <Settings size={14} />
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-36 p-1" align="start">
                                                                <div className="flex flex-col gap-1">
                                                                    {!isEmpty && (
                                                                        <Button size="sm" variant="ghost" className="h-8 justify-start gap-2 text-xs text-blue-600 font-bold" onClick={() => openQuickEditModal(acc.id, sIdx, val, assignment.id)}>
                                                                            <Pencil size={12} /> 정보수정
                                                                        </Button>
                                                                    )}
                                                                    {!isEmpty && (
                                                                        <div 
                                                                            className="flex items-center justify-between px-2 py-1.5 hover:bg-slate-50 cursor-pointer rounded"
                                                                            onClick={(e) => { e.preventDefault(); handleToggleActive(assignment, acc.id); }}
                                                                        >
                                                                            <span className={`text-[11px] font-bold flex items-center gap-1 ${!isDeactivated ? 'text-emerald-600' : 'text-slate-500'}`}>
                                                                                <PowerOff size={10} />
                                                                                {!isDeactivated ? '활성중' : '비활성'}
                                                                            </span>
                                                                            <div className={`relative inline-flex h-3 w-6 items-center rounded-full transition-colors ${!isDeactivated ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                                                                                <span className={`inline-block h-2 w-2 transform rounded-full bg-white transition-transform ${!isDeactivated ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    {isEmpty && (
                                                                        <Button size="sm" variant="ghost" className="h-8 justify-start gap-2 text-xs text-emerald-600 font-bold" onClick={() => openAssignModal(acc, sIdx)}>
                                                                            <UserPlus size={12} /> 배정하기
                                                                        </Button>
                                                                    )}
                                                                    {!isEmpty && !assignment.is_deleted && (
                                                                        <Button size="sm" variant="ghost" className="h-8 justify-start gap-2 text-xs font-medium" onClick={() => openMoveModal(assignment)}>
                                                                            <ArrowRightLeft size={12} /> 이동
                                                                        </Button>
                                                                    )}
                                                                    {sIdx === 0 && (acc.order_accounts?.length || 0) === 0 && (
                                                                        <Button size="sm" variant="ghost" className="h-8 justify-start gap-2 text-xs text-red-600" onClick={() => handleDeleteMasterAccount(acc)}>
                                                                            <Trash2 size={12} /> 그룹삭제
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            </PopoverContent>
                                                        </Popover>
                                                    </td>
                                                    <td 
                                                        className={`px-2 py-2 border-r border-slate-100 whitespace-nowrap truncate ${assignment.type === 'master' ? 'bg-violet-50 text-violet-700 font-bold cursor-pointer hover:text-blue-600' : ''}`} 
                                                        title={assignment.tidal_id || undefined}
                                                        onClick={(e) => assignment.type === 'master' && handleMasterIdClick(e, assignment.tidal_id)}
                                                    >
                                                        <div className="relative">
                                                            {assignment.tidal_id || '-'}
                                                            {assignment.type === 'master' && copiedId === assignment.tidal_id && (
                                                                <span className="absolute -top-6 left-0 bg-blue-600 text-white text-[9px] px-2 py-0.5 rounded shadow-lg animate-bounce z-10">ID 복사됨!</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-2 py-2 border-r border-slate-100 whitespace-nowrap truncate max-w-[80px]">{assignment.buyer_name || '-'}</td>
                                                    <td className="px-2 py-2 border-r border-slate-100 whitespace-nowrap truncate max-w-[120px]">{assignment.buyer_email || '-'}</td>
                                                    <td className="px-2 py-2 border-r border-slate-100 whitespace-nowrap truncate text-slate-500 font-mono">{assignment.buyer_phone || '-'}</td>
                                                    <td className="px-2 py-2 border-r border-slate-100 whitespace-nowrap text-center text-slate-500 font-mono">{assignment.start_date ? format(parseISO(assignment.start_date), 'yy-MM-dd') : '-'}</td>
                                                    <td className="px-2 py-2 border-r border-slate-100 whitespace-nowrap text-center font-mono">
                                                        <span className={isExpired ? "text-red-500 font-bold" : "text-slate-700"}>
                                                            {assignment.end_date ? format(parseISO(assignment.end_date), 'yy-MM-dd') : '-'}
                                                        </span>
                                                    </td>
                                                    <td className="px-2 py-2 border-r border-slate-100 whitespace-nowrap text-center text-slate-700 font-medium">{item.period}개월</td>
                                                    <td className="px-2 py-2 border-r border-slate-100 whitespace-nowrap text-right text-slate-700 font-mono font-medium">{val.amount ? val.amount.toLocaleString() : '-'}</td>
                                                    <td className="px-2 py-2 border-r border-slate-100 whitespace-nowrap text-center text-slate-500 font-mono">
                                                        {assignment.updated_at ? format(parseISO(assignment.updated_at), 'MM/dd HH:mm') : (assignment.assigned_at ? format(parseISO(assignment.assigned_at), 'MM/dd HH:mm') : '-')}
                                                    </td>
                                                    <td className="px-2 py-2 border-slate-100 whitespace-nowrap">
                                                        {!isEmpty && (
                                                            <div className="flex items-center gap-1.5 overflow-hidden group/memo" onClick={e => { e.stopPropagation(); openMemoModal(acc.id, sIdx, val.memo || '', assignment.id); }}>
                                                                <MessageSquareText size={14} className={`flex-shrink-0 cursor-pointer transition-colors ${val.memo ? 'text-blue-500' : 'text-slate-300 group-hover/memo:text-slate-500'}`} />
                                                                <span className="text-[10px] text-slate-400 truncate cursor-pointer group-hover/memo:text-slate-600 whitespace-nowrap">
                                                                    {val.memo ? val.memo.split('\n')[0] : ''}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        });
                                    })()}
                                </tbody>
                            </table>
                        </div>
                        <div className="flex justify-end p-4 bg-slate-50 border-t border-slate-100">
                            <Button onClick={() => setIsAddModalOpen(true)} size="sm" className="h-9 px-4 gap-2">
                                <Plus className="w-4 h-4" /> 그룹 계정 추가
                            </Button>
                        </div>
                    </div>
                ) : (
                    /* ===== LIST VIEW ===== */
                    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                        <div className="grid grid-cols-13 gap-1.5 p-2.5 bg-slate-50 font-bold border-b text-slate-500 text-[10px] uppercase tracking-wider whitespace-nowrap">
                            <div className="col-span-1 cursor-pointer hover:text-slate-800 flex items-center gap-1 whitespace-nowrap" onClick={() => handleSort('login_id')}>GroupID {sortConfig?.key === 'login_id' && (sortConfig.direction === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}</div>
                            <div className="col-span-2 whitespace-nowrap">결제계좌</div>
                            <div className="col-span-1 text-center font-bold whitespace-nowrap">결제일</div>
                            <div className="col-span-2 text-left whitespace-nowrap">마스터계정</div>
                            <div className="col-span-1 text-left cursor-pointer hover:text-slate-800 flex items-center gap-1 whitespace-nowrap" onClick={() => handleSort('end_date')}>종료일 {sortConfig?.key === 'end_date' && (sortConfig.direction === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}</div>
                            <div className="col-span-1 text-center whitespace-nowrap">개월</div>
                            <div className="col-span-1 text-right pr-1 whitespace-nowrap">금액</div>
                            <div className="col-span-1 text-left whitespace-nowrap">메모</div>
                            <div className="col-span-1 text-center cursor-pointer hover:text-slate-800 flex items-center justify-center gap-1 whitespace-nowrap" onClick={() => handleSort('used_slots')}>슬롯 {sortConfig?.key === 'used_slots' && (sortConfig.direction === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}</div>
                            <div className="col-span-1 text-center whitespace-nowrap">관리</div>
                            <div className="col-span-1 text-center whitespace-nowrap">펼침</div>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {sortedAccounts.map(acc => {
                                const isExpanded = expandedRows.has(acc.id);
                                const masterSlot = acc.order_accounts?.find(oa => oa.type === 'master');
                                const tidalId = masterSlot?.tidal_id || '-';
                                const endDate = masterSlot?.end_date || '-';
                                
                                let isWarning = false;
                                if (masterSlot?.end_date) {
                                    try {
                                        const end = parseISO(masterSlot.end_date);
                                        const today = new Date(); today.setHours(0, 0, 0, 0);
                                        const warn = new Date(today); warn.setDate(today.getDate() + 30);
                                        if (end < warn) isWarning = true;
                                    } catch { }
                                }
                                
                                let duration = '-';
                                if (masterSlot?.start_date) {
                                    try { duration = `${Math.floor(differenceInDays(new Date(), parseISO(masterSlot.start_date)) / 30)}개월`; } catch { }
                                }

                                return (
                                    <div key={acc.id} id={`account-${acc.id}`} className="group/row">
                                        <div className="grid grid-cols-13 gap-1.5 p-2.5 items-center text-[11px] hover:bg-slate-50 transition-colors whitespace-nowrap">
                                            <div className="col-span-1 text-slate-900 font-bold truncate cursor-pointer whitespace-nowrap" title={acc.login_id} onClick={() => toggleRow(acc.id)}>{acc.login_id}</div>
                                            <div className="col-span-2 truncate cursor-pointer whitespace-nowrap" onClick={() => toggleRow(acc.id)}><span className="text-blue-600 font-semibold">{acc.payment_email}</span></div>
                                            <div className="col-span-1 text-center text-slate-500 font-mono whitespace-nowrap" onClick={() => toggleRow(acc.id)}>{acc.payment_day}일</div>
                                            <div 
                                                className="col-span-2 text-slate-700 truncate cursor-pointer hover:text-blue-600 relative overflow-visible whitespace-nowrap" 
                                                title={tidalId} 
                                                onClick={(e) => handleMasterIdClick(e, tidalId)}
                                            >
                                                {tidalId}
                                                {copiedId === tidalId && (
                                                    <span className="absolute -top-6 left-0 bg-blue-600 text-white text-[9px] px-2 py-0.5 rounded shadow-lg animate-bounce z-10">ID 복사됨!</span>
                                                )}
                                            </div>
                                            <div className={`col-span-1 font-mono whitespace-nowrap ${isWarning ? 'text-red-500 font-bold' : 'text-slate-600'}`} onClick={() => toggleRow(acc.id)}>{endDate}</div>
                                            <div className="col-span-1 text-center text-slate-500 font-mono whitespace-nowrap" onClick={() => toggleRow(acc.id)}>{duration}</div>
                                            <div className="col-span-1 text-right text-slate-500 font-mono pr-1 whitespace-nowrap" onClick={() => toggleRow(acc.id)}>{masterSlot?.amount ? masterSlot.amount.toLocaleString() : '-'}</div>
                                            <div className="col-span-1 text-slate-400 text-[10px] truncate whitespace-nowrap" title={acc.memo} onClick={() => toggleRow(acc.id)}>{acc.memo}</div>
                                            <div className="col-span-1 text-center font-bold text-blue-600 whitespace-nowrap" onClick={() => toggleRow(acc.id)}>{acc.used_slots}/{acc.max_slots}</div>
                                            <div className="col-span-1 flex justify-center">
                                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 hover:bg-blue-50 text-blue-600" onClick={() => { setEditingAccount(acc); setIsEditModalOpen(true); }}><Pencil size={13} /></Button>
                                            </div>
                                            <div className="col-span-1 flex justify-center">
                                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => toggleRow(acc.id)}>
                                                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                </Button>
                                            </div>
                                        </div>
                                        {isExpanded && (
                                            <div className="bg-slate-50/50 p-4 border-t border-b border-slate-100">
                                                <table className="w-full text-xs">
                                                    <thead>
                                                        <tr className="text-slate-400 font-bold border-b border-slate-200 whitespace-nowrap">
                                                            <th className="text-center py-2 w-12 whitespace-nowrap">수정</th>
                                                            <th className="text-left py-2 px-2 whitespace-nowrap">Tidal ID</th>
                                                            <th className="text-left py-2 px-2 whitespace-nowrap">고객명</th>
                                                            <th className="text-left py-2 px-2 w-48 whitespace-nowrap">이메일</th>
                                                            <th className="text-left py-2 px-2 whitespace-nowrap">전화번호</th>
                                                            <th className="text-center py-2 whitespace-nowrap">시작일</th>
                                                            <th className="text-center py-2 whitespace-nowrap">종료일</th>
                                                            <th className="text-center py-2 whitespace-nowrap">계약 개월</th>
                                                            <th className="text-right py-2 px-2 whitespace-nowrap">금액</th>
                                                            <th className="text-center py-2 whitespace-nowrap">변경일</th>
                                                            <th className="text-left py-2 px-2 whitespace-nowrap">메모</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {(() => {
                                                            let slots: Assignment[] = [];
                                                            for (let i=0; i<acc.max_slots; i++) {
                                                                const found = acc.order_accounts?.find(oa => oa.slot_number === i);
                                                                if (found) slots.push(found);
                                                                else if (i===0 || acc.order_accounts?.length) {
                                                                    slots.push({ 
                                                                        id: `empty_${acc.id}_${i}`, 
                                                                        slot_number: i, 
                                                                        type: i===0?'master':'user', 
                                                                        is_active: true,
                                                                        is_deleted: false
                                                                    } as Assignment);
                                                                }
                                                            }

                                                            // 1개월 계약 건 필터링 (항상 적용)
                                                            slots = slots.filter(oa => {
                                                                let pMonths = oa.period_months || 0;
                                                                if (!pMonths && oa.start_date && oa.end_date) {
                                                                    try { pMonths = Math.floor(differenceInDays(parseISO(oa.end_date), parseISO(oa.start_date)) / 30); } catch { }
                                                                }
                                                                if (pMonths > 0 && pMonths <= 1) return false;
                                                                return true;
                                                            });

                                                            // 잔여일 조회 필터링
                                                            if (showExpiredOnly) {
                                                                slots = slots.filter(oa => {
                                                                    if (!oa.end_date || oa.is_deleted || !oa.is_active) return false;
                                                                    
                                                                    const today = new Date(); today.setHours(0, 0, 0, 0);
                                                                    const diff = Math.ceil((parseISO(oa.end_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                                                                    return diff <= expiredDays;
                                                                });
                                                            }

                                                            return slots.sort((a,b) => (a.slot_number||0)-(b.slot_number||0)).map(assignment => {
                                                                const isEmpty = assignment.id.startsWith('empty_');
                                                                const isDeactivated = assignment.is_active === false;
                                                                const val = gridValues[`${acc.id}_${assignment.slot_number}`] || {};
                                                                
                                                                let period = '-';
                                                                if (val.start_date && val.end_date) {
                                                                    try {
                                                                        const diff = Math.floor(differenceInDays(parseISO(val.end_date), parseISO(val.start_date)) / 30);
                                                                        if (diff >= 0) period = `${diff}개월`;
                                                                    } catch {}
                                                                }

                                                                return (
                                                                    <tr key={assignment.id} className={`border-b last:border-0 border-slate-100 h-10 ${isDeactivated ? 'bg-red-50 text-red-500' : (isEmpty ? 'bg-emerald-50/20 text-emerald-600' : 'bg-white')}`}>
                                                                        <td className="text-center whitespace-nowrap">
                                                                            <Popover>
                                                                                <PopoverTrigger asChild>
                                                                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 hover:bg-slate-100">
                                                                                        <Settings size={14} />
                                                                                    </Button>
                                                                                </PopoverTrigger>
                                                                                <PopoverContent className="w-36 p-1" align="start">
                                                                                    <div className="flex flex-col gap-1">
                                                                                        {!isEmpty && (
                                                                                            <Button size="sm" variant="ghost" className="h-8 justify-start gap-2 text-xs text-blue-600 font-bold" onClick={() => openQuickEditModal(acc.id, assignment.slot_number, val, assignment.id)}>
                                                                                                <Pencil size={12} /> 정보수정
                                                                                            </Button>
                                                                                        )}
                                                                                        {!isEmpty && (
                                                                                            <Button size="sm" variant="ghost" className="h-8 justify-start gap-2 text-xs text-slate-600 font-bold" onClick={() => openMoveModal(assignment)}>
                                                                                                <ArrowRightLeft size={12} /> 배정변경
                                                                                            </Button>
                                                                                        )}
                                                                                        {!isEmpty && (
                                                                                            <div 
                                                                                                className="flex items-center justify-between px-2 py-1.5 hover:bg-slate-50 cursor-pointer rounded"
                                                                                                onClick={(e) => { e.preventDefault(); handleToggleActive(assignment, acc.id); }}
                                                                                            >
                                                                                                <span className={`text-[11px] font-bold flex items-center gap-1 ${!isDeactivated ? 'text-emerald-600' : 'text-slate-500'}`}>
                                                                                                    <PowerOff size={10} />
                                                                                                    {!isDeactivated ? '활성중' : '비활성'}
                                                                                                </span>
                                                                                                <div className={`relative inline-flex h-3 w-6 items-center rounded-full transition-colors ${!isDeactivated ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                                                                                                    <span className={`inline-block h-2 w-2 transform rounded-full bg-white transition-transform ${!isDeactivated ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                                                                                                </div>
                                                                                            </div>
                                                                                        )}
                                                                                        {isEmpty && (
                                                                                            <Button size="sm" variant="ghost" className="h-8 justify-start gap-2 text-xs text-emerald-600 font-bold" onClick={() => openAssignModal(acc, assignment.slot_number)}>
                                                                                                <UserPlus size={12} /> 배정하기
                                                                                            </Button>
                                                                                        )}
                                                                                    </div>
                                                                                </PopoverContent>
                                                                            </Popover>
                                                                        </td>
                                                                        {isEmpty ? (
                                                                            <td colSpan={9} className="px-2 text-center text-slate-400 italic whitespace-nowrap">빈 슬롯</td>
                                                                        ) : (
                                                                            <>
                                                                                <td className="px-2 truncate whitespace-nowrap">{val.tidal_id || '-'}</td>
                                                                                <td className="px-2 truncate max-w-[80px] whitespace-nowrap">{val.buyer_name || '-'}</td>
                                                                                <td className="px-2 truncate max-w-[150px] whitespace-nowrap">{val.buyer_email || '-'}</td>
                                                                                <td className="px-2 font-mono whitespace-nowrap">{val.buyer_phone || '-'}</td>
                                                                                <td className="px-2 text-center font-mono whitespace-nowrap">{val.start_date || '-'}</td>
                                                                                <td className="px-2 text-center font-mono whitespace-nowrap">{val.end_date || '-'}</td>
                                                                                <td className="text-center font-medium whitespace-nowrap">{period}</td>
                                                                                <td className="text-right font-mono px-2 whitespace-nowrap">{val.amount?.toLocaleString() || '-'}</td>
                                                                                <td className="px-2 text-center font-mono text-[10px] opacity-70 whitespace-nowrap">
                                                                                    {val.updated_at ? format(parseISO(val.updated_at), 'MM/dd HH:mm') : (val.assigned_at ? format(parseISO(val.assigned_at), 'MM/dd HH:mm') : '-')}
                                                                                </td>
                                                                                <td className="px-2 whitespace-nowrap">
                                                                                    <div className="flex items-center gap-1 cursor-pointer whitespace-nowrap" onClick={() => openMemoModal(acc.id, assignment.slot_number, val.memo || '', assignment.id)}>
                                                                                        <MessageSquareText size={14} className={val.memo ? 'text-blue-500' : 'text-slate-300'} />
                                                                                        <span className="truncate text-[10px] text-slate-400 max-w-[60px] whitespace-nowrap">{val.memo?.split('\n')[0]}</span>
                                                                                    </div>
                                                                                </td>
                                                                            </>
                                                                        )}
                                                                    </tr>
                                                                );
                                                            });
                                                        })()}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        {filteredAccounts.length === 0 && (
                            <div className="p-12 text-center text-slate-400">검색 결과가 없습니다.</div>
                        )}
                    </div>
                )}
            </div>

            {/* EXCEL ACTIONS */}
            <div className="mt-8 flex justify-center gap-4">
                <input id="excel-import-lt" type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportExcel} />
                <Button 
                    variant="outline" 
                    onClick={() => document.getElementById('excel-import-lt')?.click()}
                    className="bg-white hover:bg-emerald-50 text-emerald-700 border-emerald-200"
                >
                    <Upload className="w-4 h-4 mr-2" /> 엑셀 가져오기
                </Button>
                <Button 
                    variant="outline" 
                    onClick={exportToExcel}
                    className="bg-white hover:bg-blue-50 text-blue-700 border-blue-200"
                >
                    <Download className="w-4 h-4 mr-2" /> 엑셀 내보내기
                </Button>
            </div>

            {/* MODALS (Shared) */}
            {/* ... Modal implementations (Create, Edit Group, Assign, Move, Memo, Quick Edit, Import Results, Notify) ... */}
            {/* (생략된 모달 부분은 기존 page.tsx의 모달 로직을 거의 그대로 포함하며 props에 따른 경로 처리 반영) */}
            
            {/* [MODAL: ADD GROUP] */}
            <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>그룹 계정 추가</DialogTitle></DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right text-xs">그룹 ID <span className="text-red-500">*</span></Label>
                            <Input value={newAccount.login_id} onChange={e => setNewAccount({ ...newAccount, login_id: e.target.value })} className="col-span-3 h-9" placeholder="예: HIFI-001" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right text-xs">비밀번호</Label>
                            <Input value={newAccount.login_pw} onChange={e => setNewAccount({ ...newAccount, login_pw: e.target.value })} className="col-span-3 h-9" placeholder="그룹 계정 비번" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right text-xs">결제 이메일 <span className="text-red-500">*</span></Label>
                            <Input value={newAccount.payment_email} onChange={e => setNewAccount({ ...newAccount, payment_email: e.target.value })} className="col-span-3 h-9" placeholder="example@email.com" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right text-xs">결제일 <span className="text-red-500">*</span></Label>
                            <Input type="number" min="1" max="31" value={newAccount.payment_day} onChange={e => setNewAccount({ ...newAccount, payment_day: parseInt(e.target.value) || 1 })} className="col-span-3 h-9" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right text-xs">메모</Label>
                            <Input value={newAccount.memo} onChange={e => setNewAccount({ ...newAccount, memo: e.target.value })} className="col-span-3 h-9" />
                        </div>
                    </div>
                    <DialogFooter><Button onClick={handleCreateAccount} className="h-9">생성하기</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            {/* [MODAL: EDIT GROUP] */}
            <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>그룹 계정 수정</DialogTitle></DialogHeader>
                    {editingAccount && (
                        <div className="grid gap-4 py-4">
                             <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right text-xs">그룹 ID <span className="text-red-500">*</span></Label>
                                <Input value={editingAccount.login_id} onChange={e => setEditingAccount({ ...editingAccount, login_id: e.target.value })} className="col-span-3 h-9" />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right text-xs">결제 이메일 <span className="text-red-500">*</span></Label>
                                <Input value={editingAccount.payment_email} onChange={e => setEditingAccount({ ...editingAccount, payment_email: e.target.value })} className="col-span-3 h-9" />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right text-xs">결제일 <span className="text-red-500">*</span></Label>
                                <Input type="number" min="1" max="31" value={editingAccount.payment_day} onChange={e => setEditingAccount({ ...editingAccount, payment_day: parseInt(e.target.value) || 1 })} className="col-span-3 h-9" />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right text-xs">메모</Label>
                                <Input value={editingAccount.memo} onChange={e => setEditingAccount({ ...editingAccount, memo: e.target.value })} className="col-span-3 h-9" />
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>취소</Button>
                        <Button onClick={handleUpdateMasterAccount}>수정 완료</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* [MODAL: ASSIGN ORDER] */}
            <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader><DialogTitle>배정할 주문 선택 ({selectedAccount?.login_id})</DialogTitle></DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-lg border">
                            <Label className="text-xs font-bold text-slate-500 whitespace-nowrap">초기 비번</Label>
                            <Input value={slotPasswordModal} onChange={e => setSlotPasswordModal(e.target.value)} className="h-9 bg-white" />
                        </div>
                        <div className="border rounded-xl overflow-hidden shadow-inner bg-white min-h-[200px] max-h-[400px] overflow-y-auto">
                            {pendingOrders.length === 0 ? (
                                <div className="p-12 text-center text-slate-400 text-sm">대기 중인 주문이 없습니다.</div>
                            ) : (
                                pendingOrders.map(order => (
                                    <div key={order.id} className="flex justify-between items-center p-3 border-b hover:bg-slate-50 transition-colors">
                                        <div className="space-y-0.5">
                                            <div className="font-bold text-slate-800">{order.buyer_name || order.profiles?.name}</div>
                                            <div className="text-[10px] text-slate-500">{order.products?.name} | {order.order_number}</div>
                                        </div>
                                        <Button size="sm" onClick={() => handleAssign(order.id)} className="h-8">배정</Button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* [MODAL: QUICK EDIT (Sub-item)] */}
            <Dialog open={isQuickEditModalOpen} onOpenChange={setIsQuickEditModalOpen}>
                <DialogContent className="sm:max-w-[450px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-blue-600">
                            <Pencil className="w-4 h-4" /> 정보 수정
                        </DialogTitle>
                    </DialogHeader>
                    {quickEditValues && (
                        <div className="grid gap-5 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-slate-500 font-semibold">이름</Label>
                                    <Input value={quickEditValues.buyer_name || ''} onChange={e => setQuickEditValues({ ...quickEditValues, buyer_name: e.target.value })} className="h-10" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-slate-500 font-semibold">Tidal ID</Label>
                                    <Input value={quickEditValues.tidal_id || ''} onChange={e => setQuickEditValues({ ...quickEditValues, tidal_id: e.target.value })} className="h-10" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-slate-500 font-semibold">전화번호</Label>
                                    <Input value={quickEditValues.buyer_phone || ''} onChange={e => setQuickEditValues({ ...quickEditValues, buyer_phone: e.target.value })} className="h-10" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-slate-500 font-semibold">이메일</Label>
                                    <Input value={quickEditValues.buyer_email || ''} onChange={e => setQuickEditValues({ ...quickEditValues, buyer_email: e.target.value })} className="h-10" />
                                </div>
                            </div>
                            <div className="grid grid-cols-[1fr_1.3fr_0.6fr] gap-3">
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-slate-500 font-semibold">시작일</Label>
                                    <Input type="date" value={quickEditValues.start_date || ''} onChange={e => {
                                        const ns = e.target.value; let ne = quickEditValues.end_date;
                                        if (ns && quickEditValues.period_months) { try { ne = format(addDays(parseISO(ns), quickEditValues.period_months * 30), 'yyyy-MM-dd'); } catch {} }
                                        setQuickEditValues({ ...quickEditValues, start_date: ns, end_date: ne });
                                    }} className="h-10 text-[11px] px-2" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-slate-500 font-semibold">종료일</Label>
                                    <Input type="date" value={quickEditValues.end_date || ''} onChange={e => {
                                        const ne = e.target.value; let nm = quickEditValues.period_months;
                                        if (quickEditValues.start_date && ne) { try { nm = Math.max(0, Math.floor(differenceInDays(parseISO(ne), parseISO(quickEditValues.start_date)) / 30)); } catch {} }
                                        setQuickEditValues({ ...quickEditValues, end_date: ne, period_months: nm });
                                    }} className="h-10 text-[11px] px-2" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-slate-500 font-semibold">개월</Label>
                                    <Input type="number" value={quickEditValues.period_months || ''} onChange={e => {
                                        const nextM = parseInt(e.target.value) || 0;
                                        const initialM = initialQuickEditValues?.period_months || 0;
                                        const initialEnd = initialQuickEditValues?.end_date;

                                        let ne = quickEditValues.end_date;
                                        if (initialEnd) {
                                            try {
                                                ne = format(addDays(parseISO(initialEnd), (nextM - initialM) * 30), 'yyyy-MM-dd');
                                            } catch {}
                                        } else if (quickEditValues.start_date) {
                                            try {
                                                ne = format(addDays(parseISO(quickEditValues.start_date), nextM * 30), 'yyyy-MM-dd');
                                            } catch {}
                                        }
                                        setQuickEditValues({ ...quickEditValues, period_months: nextM, end_date: ne });
                                    }} className="h-10" />
                                </div>
                            </div>
                            <div className="flex justify-end gap-1.5">
                                {([3, 6, 12] as const).map(add => (
                                    <Button key={add} type="button" size="sm" variant="outline"
                                        className="h-7 px-2.5 text-xs text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-400"
                                        onClick={() => {
                                            const nextM = (quickEditValues.period_months || 0) + add;
                                            const initialM = initialQuickEditValues?.period_months || 0;
                                            const initialEnd = initialQuickEditValues?.end_date;
                                            let ne = quickEditValues.end_date;
                                            if (initialEnd) {
                                                try { ne = format(addDays(parseISO(initialEnd), (nextM - initialM) * 30), 'yyyy-MM-dd'); } catch {}
                                            } else if (quickEditValues.start_date) {
                                                try { ne = format(addDays(parseISO(quickEditValues.start_date), nextM * 30), 'yyyy-MM-dd'); } catch {}
                                            }
                                            setQuickEditValues({ ...quickEditValues, period_months: nextM, end_date: ne });
                                        }}
                                    >+{add}개월</Button>
                                ))}
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs text-slate-500 font-semibold">메모</Label>
                                <textarea 
                                    rows={3} 
                                    className="w-full p-3 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none border-slate-200 transition-all" 
                                    value={quickEditValues.memo || ''} 
                                    onChange={e => setQuickEditValues({ ...quickEditValues, memo: e.target.value })} 
                                />
                            </div>
                        </div>
                    )}
                    <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <button
                            type="button"
                            className="text-xs text-blue-500 hover:text-blue-700 underline underline-offset-2 text-left transition-colors"
                            onClick={() => {
                                const endDate = quickEditValues?.end_date
                                    ? (() => { try { return format(parseISO(quickEditValues.end_date!), 'yyyy.MM.dd'); } catch { return quickEditValues.end_date!; } })()
                                    : '';
                                const addedMonths = (quickEditValues?.period_months || 0) - (initialQuickEditValues?.period_months || 0);
                                navigator.clipboard.writeText(`감사합니다 ${endDate} 까지 ${addedMonths}개월 (월 30일) 연장 입니다.`);
                                setExtendMsgCopied(true);
                                setTimeout(() => setExtendMsgCopied(false), 2000);
                            }}
                        >
                            {extendMsgCopied ? '✓ 복사됨' : '연장 문자 복사'}
                        </button>
                        <div className="flex gap-2 justify-end">
                            <Button variant="outline" onClick={() => setIsQuickEditModalOpen(false)} className="h-10">취소</Button>
                            <Button onClick={handleSaveQuickEdit} className="h-10 bg-blue-600 hover:bg-blue-700">정보 업데이트</Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* [MODAL: MEMO EDIT] */}
            <Dialog open={isMemoModalOpen} onOpenChange={setIsMemoModalOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>메모 관리</DialogTitle></DialogHeader>
                    <div className="py-4">
                        <textarea 
                            className="w-full min-h-[150px] p-4 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" 
                            placeholder="메모를 입력하세요..." 
                            value={currentMemoInput} 
                            onChange={e => setCurrentMemoInput(e.target.value)} 
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsMemoModalOpen(false)}>취소</Button>
                        <Button onClick={handleSaveMemo}>메모 저장</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* [MODAL: MOVE ASSIGNMENT] */}
            <Dialog open={isMoveModalOpen} onOpenChange={setIsMoveModalOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>배정 이동</DialogTitle></DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
                            <div className="text-xs text-amber-600 font-bold mb-1">이동 대상:</div>
                            <div className="font-bold text-slate-800">{selectedAssignment?.buyer_name || '이름 없음'} ({selectedAssignment?.tidal_id})</div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-500">이동할 타겟 계정</Label>
                            <Select onValueChange={setSelectedTargetAccount} value={selectedTargetAccount}>
                                <SelectTrigger className="h-10"><SelectValue placeholder="계정 선택" /></SelectTrigger>
                                <SelectContent>
                                    {moveTargets.map(acc => (
                                        <SelectItem key={acc.id} value={acc.id}>{acc.login_id} (잔여: {acc.max_slots - acc.used_slots})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        {selectedTargetAccount && (
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-slate-500">타겟 계정의 슬롯</Label>
                                <Select onValueChange={val => setSelectedTargetSlot(Number(val))} value={selectedTargetSlot?.toString()}>
                                    <SelectTrigger className="h-10"><SelectValue placeholder="슬롯 선택" /></SelectTrigger>
                                    <SelectContent>
                                        {getAvailableSlots(selectedTargetAccount).map(n => (
                                            <SelectItem key={n} value={n.toString()}>Slot #{n + 1}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsMoveModalOpen(false)}>취소</Button>
                        <Button onClick={handleMove} disabled={!selectedTargetAccount || selectedTargetSlot === null} className="bg-blue-600 hover:bg-blue-700">이동 확정</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* [MODAL: NOTIFY] */}
            <Dialog open={isNotifyModalOpen} onOpenChange={setIsNotifyModalOpen}>
                <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>알림 메일 발송 ({selectedAssignmentIds.size}명)</DialogTitle></DialogHeader>
                    <div className="py-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <div className="flex-1">
                                <Select value={selectedTemplateKey} onValueChange={setSelectedTemplateKey}>
                                    <SelectTrigger className="h-10 border-slate-200">
                                        <SelectValue placeholder="템플릿 선택" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {emailTemplates.filter(t => t.key.startsWith('LEGACY')).map(t => (
                                            <SelectItem key={t.key} value={t.key}>{t.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button type="button" variant="outline" size="sm" className="h-10 px-3 text-xs shrink-0"
                                onClick={() => setIsTemplateEditOpen(true)}
                                disabled={!selectedTemplateKey}
                            >
                                메일 수정하기
                            </Button>
                        </div>

                        {(() => {
                            const tmpl = emailTemplates.find(t => t.key === selectedTemplateKey);
                            const sample = getFlattenedAssignments().find(a => selectedAssignmentIds.has(a.id));
                            const buyerName = sample?.assignment.buyer_name || '홍길동';
                            const tidalId = sample?.assignment.tidal_id || 'sample@tidal.com';
                            const endDate = sample?.assignment.end_date || '2027.05.02';
                            const html = tmpl?.content
                                ? tmpl.content.replace(/{buyer_name}/g, buyerName).replace(/{tidal_id}/g, tidalId).replace(/{end_date}/g, endDate).replace(/{message}/g, notificationMessage)
                                : '<div style="padding:24px;color:#999;font-family:sans-serif;text-align:center">템플릿을 선택하면 미리보기가 표시됩니다.</div>';
                            return (
                                <div className="border rounded-xl overflow-hidden shadow-sm">
                                    <div className="bg-slate-100 px-3 py-1.5 text-[10px] text-slate-500 font-mono border-b flex items-center justify-between">
                                        <span>미리보기 — {sample ? `${buyerName} / ${tidalId} / ${endDate}` : '샘플 데이터'}</span>
                                        {tmpl?.subject && <span className="text-slate-400">제목: {tmpl.subject}</span>}
                                    </div>
                                    <iframe srcDoc={html} className="w-full h-80 bg-white" sandbox="allow-same-origin" />
                                </div>
                            );
                        })()}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsNotifyModalOpen(false)} className="h-10">취소</Button>
                        <Button onClick={handleBulkNotify} disabled={isSendingNotify} className="h-10 bg-orange-600 hover:bg-orange-700 text-white font-bold">
                            {isSendingNotify ? '발송 처리 중...' : '메일 발송하기'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <EmailTemplateModal
                isOpen={isTemplateEditOpen}
                onClose={() => setIsTemplateEditOpen(false)}
                template={emailTemplates.find(t => t.key === selectedTemplateKey) as any ?? null}
                onSave={fetchTemplates}
            />
        </main>
    );
}
