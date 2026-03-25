"use client";

import React, { useEffect, useState, Suspense } from 'react';
import { useServices } from '@/lib/ServiceContext';
import styles from '../admin.module.css';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { Plus, ChevronDown, ChevronUp, Trash2, ArrowRightLeft, Download, Pencil, Upload, LayoutGrid, List, History, PowerOff, Filter, Mail, X, Search, MessageSquareText } from 'lucide-react';
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
    orders?: Order & {
        profiles?: {
            name: string;
            phone: string | null;
            email: string;
            memo?: string | null;
        } | null;
    };
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
    products?: {
        name: string;
    };
    product_plans?: {
        duration_months: number;
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
    amount?: number;
    memo?: string;
    is_active: boolean;
    assignment_number?: string;
}

function TidalAccountsContent() {
    const { isAdmin, isHydrated } = useServices();
    const router = useRouter();
    const searchParams = useSearchParams();

    // --- State ---
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [isGridView, setIsGridView] = useState(true);
    const [gridValues, setGridValues] = useState<Record<string, GridValue>>({});
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
    const [isImportResultModalOpen, setIsImportResultModalOpen] = useState(false);
    const [importResults, setImportResults] = useState<{
        success: {
            masters: { created: number, updated: number },
            slots: { created: number, updated: number }
        },
        failed: { id: string, reason: string }[]
    } | null>(null);
    const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
    const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
    const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
    const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
    const [moveTargets, setMoveTargets] = useState<Account[]>([]);
    const [selectedTargetAccount, setSelectedTargetAccount] = useState<string>('');
    const [selectedTargetSlot, setSelectedTargetSlot] = useState<number | null>(null);
    const [showExpiredOnly, setShowExpiredOnly] = useState(false);
    const [showInactive, setShowInactive] = useState(false); // Default to false (hide deleted)
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
    const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set());
    
    // Memo Feature State
    const [isMemoModalOpen, setIsMemoModalOpen] = useState(false);
    const [currentMemoInput, setCurrentMemoInput] = useState('');
    const [memoTargetAccountId, setMemoTargetAccountId] = useState('');
    const [memoTargetSlotIdx, setMemoTargetSlotIdx] = useState<number | null>(null);
    const [memoTargetAssignmentId, setMemoTargetAssignmentId] = useState('');
    const [isEditAssignModalOpen, setIsEditAssignModalOpen] = useState(false);
    const [editAssignData, setEditAssignData] = useState<GridValue | null>(null);
    const [editAssignKey, setEditAssignKey] = useState<string | null>(null);

    const [lastSavedKey, setLastSavedKey] = useState<string | null>(null);

    // --- DAL-20: Column Resizing and Filter States ---
    const [expiredDays, setExpiredDays] = useState(7);
    const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
        'checkbox': 40,
        'login_id': 100,
        'slot': 60,
        'type': 60,
        'tidal_id': 200,
        'tidal_password': 120,
        'buyer_name': 100,
        'buyer_email': 150,
        'buyer_phone': 140,
        'order_number': 120,
        'start_date': 120,
        'end_date': 120,
        'period': 100, // 개월 수 표기를 위해 넓힘
        'amount': 100, // 금액 표기를 위해 넓힘
        'manage': 140
    });


    const startResizing = (id: string, e: React.MouseEvent) => {
        e.preventDefault();

        const startX = e.pageX;
        const startWidth = columnWidths[id];

        const onMouseMove = (moveEvent: MouseEvent) => {
            const currentX = moveEvent.pageX;
            const newWidth = Math.max(40, startWidth + (currentX - startX));
            setColumnWidths((prev: Record<string, number>) => ({ ...prev, [id]: newWidth }));
        };

        const onMouseUp = () => {
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
            // Switch to List View (grouped view) and scroll to account
            setIsGridView(false);

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


    // --- Fetching Functions ---

    // --- Fetching Functions ---
    const fetchAccounts = async () => {
        try {
            const res = await apiFetch(`/api/admin/accounts?product=Tidal&showInactive=true`, { cache: 'no-store' });
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to fetch accounts');
            }
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
                        period_months: assignment?.period_months || (assignment?.orders?.product_plans as { duration_months?: number })?.duration_months || 0,
                        amount: assignment?.amount || assignment?.orders?.amount || 0,
                        memo: assignment?.orders?.profiles?.memo || assignment?.memo || '',
                        is_active: assignment?.is_active ?? true,
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
            const res = await apiFetch('/api/admin/orders', { cache: 'no-store' });
            if (res.ok) {
                const responseData = await res.json();
                const ordersArray = Array.isArray(responseData) ? responseData : responseData.data;
                
                if (Array.isArray(ordersArray)) {
                    const waiting = ordersArray.filter((o: Order) =>
                        o.payment_status === 'paid' &&
                        o.assignment_status === 'waiting'
                    );
                    setPendingOrders(waiting);
                } else {
                    console.error('Expected array from /api/admin/orders, got:', responseData);
                    setPendingOrders([]);
                }
            }
        } catch (error) {
            console.error(error);
        }
    };

    // --- Computed Helpers ---
    const getPeriodMonths = (start?: string, end?: string) => {
        if (!start || !end) return 0;
        try {
            const startD = parseISO(start);
            const endD = parseISO(end);
            const days = differenceInDays(endD, startD);
            return Math.floor(days / 30);
        } catch {
            return 0;
        }
    };

    const getAvailableSlots = (accountId: string) => {
        const acc = accounts.find(a => a.id === accountId);
        if (!acc) return [];
        const hasMaster = acc.order_accounts?.some(oa => oa.type === 'master');
        const taken = new Set((acc.order_accounts || [])
            .filter(oa => oa && typeof oa.slot_number === 'number')
            .map(oa => oa.slot_number));
        const available = [];
        for (let i = 0; i < 6; i++) {
            if (!taken.has(i)) {
                if (i > 0 && !hasMaster) continue;
                available.push(i);
            }
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
            const hasMaster = acc.order_accounts?.some(oa => oa.type === 'master');
            for (let i = 0; i < acc.max_slots; i++) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                let assignment: any = acc.order_accounts?.find(oa => oa.slot_number === i);
                if (!assignment) {
                    if (i > 0 && !hasMaster) continue;
                    assignment = {
                        id: `empty_${acc.id}_${i}`,
                        slot_number: i,
                        type: i === 0 ? 'master' : 'user',
                        account_id: acc.id,
                        is_active: true,
                        tidal_id: null,
                        tidal_password: null,
                        buyer_name: null,
                        buyer_email: null,
                        buyer_phone: null,
                        order_number: null,
                        start_date: null,
                        end_date: null
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    } as any;
                }

                // Search Filter
                const query = searchQuery.toLowerCase().trim();
                if (query) {
                    const buyerName = (assignment.buyer_name || assignment.orders?.buyer_name || '').toLowerCase();
                    const buyerEmail = (assignment.buyer_email || assignment.orders?.buyer_email || '').toLowerCase();
                    const tidalId = (assignment.tidal_id || '').toLowerCase();
                    const buyerPhone = (assignment.buyer_phone || assignment.orders?.buyer_phone || '').toLowerCase();
                    if (!buyerName.includes(query) && !buyerEmail.includes(query) && !tidalId.includes(query) && !buyerPhone.includes(query)) continue;
                }

                // Expired Filter
                if (showExpiredOnly) {
                    if (!assignment.end_date) continue;
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const endDate = parseISO(assignment.end_date);
                    const diffTime = endDate.getTime() - today.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    if (diffDays > expiredDays) continue;
                }

                // Inactive/Deleted Filter
                if (!showInactive && assignment.is_deleted === true) continue; // Hide deleted from normal view
                if (showInactive && assignment.is_deleted !== true) continue; // Show ONLY deleted in Trash view

                let periodNum = assignment.period_months || 0;
                if (!periodNum && assignment.start_date && assignment.end_date) {
                    try {
                        const start = parseISO(assignment.start_date);
                        const end = parseISO(assignment.end_date);
                        const days = differenceInDays(end, start);
                        periodNum = Math.floor(days / 30);
                    } catch { }
                }

                flattened.push({
                    id: assignment.id,
                    assignment,
                    account: acc,
                    period: periodNum,
                    originalAccIndex: accIdx
                });
            }
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
            const hasMaster = acc.order_accounts?.some(oa => oa.type === 'master');
            for (let i = 0; i < acc.max_slots; i++) {
                const assignment = acc.order_accounts?.find(oa => oa.slot_number === i);
                if (!assignment) {
                    if (i > 0 && !hasMaster) continue;
                }
                const val = gridValues[`${acc.id}_${i}`] || {};

                // Apply Search Filter
                if (query) {
                    const buyerName = (val.buyer_name || '').toLowerCase();
                    const buyerEmail = (val.buyer_email || '').toLowerCase();
                    const tidalId = (val.tidal_id || '').toLowerCase();
                    const buyerPhone = (val.buyer_phone || '').toLowerCase();

                    if (!buyerName.includes(query) &&
                        !buyerEmail.includes(query) &&
                        !tidalId.includes(query) &&
                        !buyerPhone.includes(query)) {
                        continue;
                    }
                }

                // Apply Expired Filter
                if (showExpiredOnly) {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    if (!val.end_date) {
                        continue;
                    }
                    const endDate = parseISO(val.end_date);
                    const diffTime = endDate.getTime() - today.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    if (diffDays > expiredDays) {
                        continue;
                    }
                }

                // Inactive/Deleted Filter
                if (!showInactive && val.is_active === false) continue;
                if (showInactive && val.is_active !== false) continue;

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
                } else if (sortConfig.key === 'buyer_email') {
                    valA = a.buyer_email || '';
                    valB = b.buyer_email || '';
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


    // --- Action Handlers ---


    // --- Action Handlers ---

    // --- Action Handlers ---

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

            if (field === 'start_date' || field === 'period_months') {
                const startStr = next.start_date;
                const months = parseInt(String(next.period_months)) || 0;
                if (startStr && months >= 0) {
                    try {
                        const start = parseISO(startStr);
                        const end = addDays(start, months * 30);
                        next.end_date = end.toISOString().split('T')[0];
                    } catch { }
                }
            } else if (field === 'end_date') {
                const startStr = next.start_date;
                const endStr = next.end_date;
                if (startStr && endStr) {
                    try {
                        const start = parseISO(startStr);
                        const end = parseISO(endStr);
                        const days = differenceInDays(end, start);
                        next.period_months = Math.max(0, Math.floor(days / 30));
                    } catch { }
                }
            }
            return { ...prev, [key]: next };
        });
    };

    const handleSaveRow = async (accountId: string, slotIdx: number, dataOverride?: GridValue) => {
        const key = `${accountId}_${slotIdx}`;
        const data = dataOverride || gridValues[key];
        if (!data) return;

        try {
            if (data.assignment_id && !data.assignment_id.startsWith('empty_')) {
                const res = await apiFetch(`/api/admin/assignments/${data.assignment_id}`, {
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
                const res = await apiFetch(`/api/admin/accounts/${accountId}/assign`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...data, slot_number: slotIdx })
                });
                if (!res.ok) throw new Error('Create failed');
            }
            alert('저장되었습니다.');
            setLastSavedKey(data.assignment_id || key);
            setTimeout(() => setLastSavedKey(null), 3000);
            fetchAccounts();
        } catch (e) {
            alert('저장 실패: ' + (e instanceof Error ? e.message : String(e)));
        }
    };

    const handleDelete = async (assignmentId: string) => {
        let isMaster = false;
        let hasUsers = false;

        for (const acc of accounts) {
            const accAssignments = acc.order_accounts || [];
            const found = accAssignments.find(oa => oa.id === assignmentId);
            if (found) {
                if (found.type === 'master') {
                    isMaster = true;
                    hasUsers = accAssignments.some(oa => oa.type === 'user' && oa.id !== assignmentId);
                }
                break;
            }
        }

        if (isMaster && hasUsers) {
            alert('그룹원이 존재하여 마스터 삭제 불가능 합니다');
            setPendingDeleteIds(prev => new Set(prev).add(assignmentId));
            return;
        }

        if (!confirm('삭제 하시겠습니까?')) return;
        try {
            const res = await apiFetch(`/api/admin/assignments/${assignmentId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Delete failed');
            fetchAccounts();
            fetchPendingOrders();
        } catch (error) {
            alert('삭제 실패: ' + (error instanceof Error ? error.message : String(error)));
        }
    };

    const handleDeactivate = async (assignmentId: string) => {
        // Find current status from accounts state
        let currentActive = true;
        for (const acc of accounts) {
            const found = acc.order_accounts?.find(oa => oa.id === assignmentId);
            if (found) {
                currentActive = found.is_active !== false;
                break;
            }
        }

        if (currentActive) {
            alert('비활성화 합니다');
        }

        try {
            const res = await apiFetch(`/api/admin/assignments/${assignmentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_active: !currentActive })
            });
            if (!res.ok) throw new Error('Action failed');
            
            if (!currentActive) {
                alert('활성화 되었습니다.');
            }
            
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
            const prodRes = await apiFetch('/api/admin/products');
            const products = await prodRes.json();
            const tidal = products.find((p: { name: string }) => p.name.includes('Tidal') && !p.name.toLowerCase().includes('hifi')) || products[0];

            const res = await apiFetch('/api/admin/accounts', {
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


    const handleUpdateMasterAccount = async () => {
        if (!editingAccount) return;
        try {
            const res = await apiFetch(`/api/admin/accounts/${editingAccount.id}`, {
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
            const res = await apiFetch(`/api/admin/accounts/${account.id}`, { method: 'DELETE' });
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
        
        if (flatData.length === 0) {
            excelData.push({
                'No.': '',
                '배정번호': '',
                '결제 계정': '',
                '결제일': '',
                '메모': '',
                '고객명': '',
                '이메일': '',
                '전화번호': '',
                '주문번호': '',
                '소속 ID': '',
                '소속 PW': '',
                '시작일': '',
                '종료일': '',
                '개월': '',
                '계약금액': ''
            });
        } else {
            flatData.forEach((item, idx) => {
                excelData.push({
                    'No.': idx + 1,
                    '배정번호': `${item.accountLoginId}-${item.slotIdx + 1}`,
                    '결제 계정': item.accountPaymentEmail,
                    '결제일': `${item.accountPaymentDay}일`,
                    '메모': item.accountMemo ?? '',
                    '고객명': item.buyer_name || '',
                    '이메일': item.buyer_email || '',
                    '전화번호': item.buyer_phone || '',
                    '주문번호': item.order_number || '',
                    '소속 ID': item.tidal_id || '',
                    '소속 PW': item.tidal_password || '',
                    '시작일': item.start_date || '',
                    '종료일': item.end_date || '',
                    '개월': (() => { const m = getPeriodMonths(item.start_date, item.end_date); return m > 1 ? m : ''; })(),
                    '계약금액': item.amount || 0
                });
            });
        }
        
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
                const res = await apiFetch('/api/admin/accounts/import?product=Tidal', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ accounts: jsonData })
                });
                if (!res.ok) {
                    const errObj = await res.json().catch(() => null);
                    throw new Error(errObj?.error || `서버 오류 (${res.status})`);
                }
                const summary = await res.json();
                setImportResults(summary);
                setIsImportResultModalOpen(true);
                fetchAccounts();
            } catch (error: unknown) {
                const e = error as Error;
                alert(`엑셀 업로드 실패: ${e.message}`);
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
        if (!selectedAssignment) return;

        try {
            const res = await apiFetch('/api/admin/accounts/move', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    assignment_id: selectedAssignment.id,
                    order_id: selectedAssignment.orders?.id,
                    target_account_id: selectedTargetAccount,
                    target_slot_number: selectedTargetSlot,
                    target_tidal_password: selectedAssignment.tidal_password
                })
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                const reason = data?.error || '알 수 없는 오류가 발생했습니다.';
                alert(`이동 실패: ${reason}`);
                return;
            }

            setIsMoveModalOpen(false);
            fetchAccounts();
        } catch {
            alert('이동 실패: 네트워크 오류가 발생했습니다. 인터넷 연결을 확인 후 다시 시도해 주세요.');
        }
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

            const res = await apiFetch('/api/admin/tidal/notify', {
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



    const openMemoModal = (accountId: string, slotIdx: number, currentMemo: string, assignmentId: string) => {
        setMemoTargetAccountId(accountId);
        setMemoTargetSlotIdx(slotIdx);
        setMemoTargetAssignmentId(assignmentId);
        
        // Show current memo, but allow adding new timestamped line if user wants
        const now = new Date();
        const yy = String(now.getFullYear()).slice(-2);
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2, '0');
        const mins = String(now.getMinutes()).padStart(2, '0');
        const timestamp = `${yy}/${mm}/${dd} ${hh}:${mins} `;
        
        if (currentMemo) {
            setCurrentMemoInput(timestamp + "\n" + currentMemo);
        } else {
            setCurrentMemoInput(timestamp);
        }
        setIsMemoModalOpen(true);
    };

    const handleSaveMemo = async () => {
        if (!memoTargetAssignmentId || memoTargetAssignmentId.startsWith('empty_')) {
            alert('배정된 정보가 없어 메모를 저장할 수 없습니다.');
            return;
        }
        try {
            const res = await apiFetch(`/api/admin/assignments/${memoTargetAssignmentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ memo: currentMemoInput })
            });
            if (!res.ok) throw new Error('Update failed');
            
            updateGridValue(memoTargetAccountId, memoTargetSlotIdx as number, 'memo', currentMemoInput);
            setIsMemoModalOpen(false);
            fetchAccounts();
            alert('메모가 저장되었습니다.');
        } catch (e) {
            alert('저장 실패: ' + (e instanceof Error ? e.message : String(e)));
        }
    };

    const openEditAssignModal = (key: string, data: GridValue) => {
        setEditAssignKey(key);
        const [accountId, sIdxStr] = key.split('_');
        const slotIdx = parseInt(sIdxStr);
        const acc = accounts.find(a => a.id === accountId);
        const assignmentNumber = acc ? `${acc.login_id}-${slotIdx + 1}` : '';
        setEditAssignData({ ...data, assignment_number: assignmentNumber });
        setIsEditAssignModalOpen(true);
    };

    const handleUpdateEditAssign = async () => {
        if (!editAssignKey || !editAssignData) return;
        const [accountId, sIdxStr] = editAssignKey.split('_');
        const sIdx = parseInt(sIdxStr);
        await handleSaveRow(accountId, sIdx, editAssignData);
        setIsEditAssignModalOpen(false);
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
                        <Button 
                            variant={showInactive ? "default" : "outline"} 
                            size="sm" 
                            onClick={() => setShowInactive(!showInactive)} 
                            className={`h-8 ${showInactive ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100 font-bold' : ''}`}
                            title="삭제된 데이터(빨간 행) 표시/숨기기"
                        >
                            <Trash2 size={16} className="mr-2" />
                            {showInactive ? '전체 보기' : '삭제 데이터'}
                        </Button>
                    </div>

                    <div className="flex gap-2 items-center">
                        {/* 1. 검색창 */}
                        <div className="relative flex items-center bg-white border rounded-md px-2 focus-within:ring-2 focus-within:ring-blue-500">
                            <Search size={14} className="text-gray-400" />
                            <Input
                                type="text"
                                placeholder="고객명, Tidal ID, 전화번호 검색..."
                                className="border-0 focus-visible:ring-0 h-8 w-60 text-sm"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 bg-white border rounded-md px-2 py-1">
                                <span className="text-xs text-gray-500 whitespace-nowrap">잔여</span>
                                <Input
                                    type="number"
                                    value={expiredDays}
                                    onChange={(e) => setExpiredDays(parseInt(e.target.value) || 0)}
                                    className="w-12 h-7 px-1 text-center text-sm border-none focus-visible:ring-0"
                                />
                                <span className="text-xs text-gray-500 whitespace-nowrap">일</span>
                            </div>
                            <Button
                                variant={showExpiredOnly ? "default" : "outline"}
                                size="sm"
                                onClick={() => setShowExpiredOnly(!showExpiredOnly)}
                                className="flex items-center gap-2 h-8"
                            >
                                <Filter className="w-4 h-4" />
                                잔여일 조회
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => router.push('/admin/tidal/inactive')}
                                className="flex items-center gap-2 h-8"
                            >
                                <History className="w-4 h-4" />
                                내역
                            </Button>
                            <div className="h-4 w-px bg-gray-200" />
                            <div className="relative">
                                <input
                                    id="excel-import"
                                    type="file"
                                    accept=".xlsx, .xls"
                                    className="hidden"
                                    onChange={handleImportExcel}
                                />
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => document.getElementById('excel-import')?.click()}
                                    className="flex items-center gap-2 h-8"
                                >
                                    <Upload className="w-4 h-4" />
                                    엑셀
                                </Button>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={exportToExcel}
                                className="flex items-center gap-2 h-8"
                            >
                                <Download className="w-4 h-4" />
                                엑셀
                            </Button>

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

                            <Button onClick={() => setIsAddModalOpen(true)} className="gap-2 h-8" size="sm">
                                <Plus size={16} /> 그룹 추가
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            <div className={`${styles.content} container`}>
                {isGridView ? (
                    <div className="bg-white rounded-lg shadow overflow-x-auto">
                        <table className="w-full text-sm min-w-[1400px]">
                            <thead>
                                <tr className="bg-gray-100 border-b">
                                    <th className="text-center py-2 border-r border-gray-200" style={{ width: columnWidths['checkbox'] }}>
                                        <input
                                            type="checkbox"
                                            checked={selectedAssignmentIds.size > 0 && selectedAssignmentIds.size === getFlattenedAssignments().length}
                                            onChange={() => toggleSelectAll(getFlattenedAssignments())}
                                        />
                                    </th>
                                    <th className="relative text-center text-xs font-bold py-2 border-r border-gray-200 cursor-pointer hover:bg-gray-200" style={{ width: columnWidths['login_id'] }}>
                                        <div className="flex items-center justify-center gap-1" onClick={() => handleSort('login_id')}>
                                            배정번호 {sortConfig?.key === 'login_id' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                                        </div>
                                        <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400" onMouseDown={e => startResizing('login_id', e)} />
                                    </th>
                                    <th className="relative p-2 text-center border-r cursor-pointer hover:bg-gray-200" style={{ width: columnWidths['type'] }}>
                                        <div className="flex items-center justify-center gap-1" onClick={() => handleSort('type')}>
                                            타입 {sortConfig?.key === 'type' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                                        </div>
                                        <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400" onMouseDown={e => startResizing('type', e)} />
                                    </th>
                                    <th className="relative p-2 text-left border-r" style={{ width: columnWidths['tidal_id'] }}>
                                        Tidal ID
                                        <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400" onMouseDown={e => startResizing('tidal_id', e)} />
                                    </th>
                                    <th className="relative p-2 text-left border-r" style={{ width: columnWidths['tidal_password'] }}>
                                        PW
                                        <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400" onMouseDown={e => startResizing('tidal_password', e)} />
                                    </th>
                                    <th className="relative p-2 text-left border-r" style={{ width: columnWidths['buyer_name'] }}>
                                        고객명
                                        <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400" onMouseDown={e => startResizing('buyer_name', e)} />
                                    </th>
                                    <th className="relative p-2 text-left border-r" style={{ width: columnWidths['buyer_email'] }}>
                                        <div className="flex items-center justify-center gap-1" onClick={() => handleSort('buyer_email')}>
                                            이메일 {sortConfig?.key === 'buyer_email' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                                        </div>
                                        <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400" onMouseDown={e => startResizing('buyer_email', e)} />
                                    </th>
                                    <th className="relative p-2 text-left border-r" style={{ width: columnWidths['buyer_phone'] }}>
                                        전화번호
                                        <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400" onMouseDown={e => startResizing('buyer_phone', e)} />
                                    </th>
                                    <th className="relative p-2 text-center border-r" style={{ width: columnWidths['order_number'] }}>
                                        주문번호
                                        <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400" onMouseDown={e => startResizing('order_number', e)} />
                                    </th>
                                    <th className="relative p-2 text-center border-r cursor-pointer hover:bg-gray-200" style={{ width: columnWidths['start_date'] }}>
                                        <div className="flex items-center justify-center gap-1" onClick={() => handleSort('start_date')}>
                                            시작일 {sortConfig?.key === 'start_date' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                                        </div>
                                        <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400" onMouseDown={e => startResizing('start_date', e)} />
                                    </th>
                                    <th className="relative p-2 text-center border-r cursor-pointer hover:bg-gray-200" style={{ width: columnWidths['end_date'] }}>
                                        <div className="flex items-center justify-center gap-1" onClick={() => handleSort('end_date')}>
                                            종료일 {sortConfig?.key === 'end_date' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                                        </div>
                                        <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400" onMouseDown={e => startResizing('end_date', e)} />
                                    </th>
                                    <th className="relative p-2 text-center border-r cursor-pointer hover:bg-gray-200" style={{ width: columnWidths['period'] }}>
                                        <div className="flex items-center justify-center gap-1" onClick={() => handleSort('period')}>
                                            개월 {sortConfig?.key === 'period' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                                        </div>
                                        <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400" onMouseDown={e => startResizing('period', e)} />
                                    </th>
                                    <th className="relative p-2 text-center border-r cursor-pointer hover:bg-gray-200" style={{ width: columnWidths['amount'] || 80 }}>
                                        <div className="flex items-center justify-center gap-1" onClick={() => handleSort('amount')}>
                                            계약금액 {sortConfig?.key === 'amount' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                                        </div>
                                        <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400" onMouseDown={e => startResizing('amount', e)} />
                                    </th>

                                    <th className="relative p-2 text-center" style={{ width: columnWidths['manage'] }}>
                                        관리
                                        <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400" onMouseDown={e => startResizing('manage', e)} />
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {(() => {
                                    const flattened = getFlattenedAssignments();
                                    if (sortConfig) {
                                        flattened.sort((a, b) => {
                                            let aVal = null;
                                            let bVal = null;
                                            switch (sortConfig.key) {
                                                case 'start_date': aVal = a.assignment.start_date; bVal = b.assignment.start_date; break;
                                                case 'end_date': aVal = a.assignment.end_date; bVal = b.assignment.end_date; break;
                                                case 'period': aVal = a.period; bVal = b.period; break;
                                                case 'login_id': aVal = a.account.login_id; bVal = b.account.login_id; break;
                                                case 'buyer_email': aVal = a.assignment.buyer_email || a.assignment.orders?.buyer_email; bVal = b.assignment.buyer_email || b.assignment.orders?.buyer_email; break;
                                                case 'amount': aVal = a.assignment.orders?.amount; bVal = b.assignment.orders?.amount; break;
                                                default: return 0;
                                            }
                                            const safeA = (sortConfig.key === 'end_date' && !aVal) ? '9999-12-31' : (aVal || '');
                                            const safeB = (sortConfig.key === 'end_date' && !bVal) ? '9999-12-31' : (bVal || '');
                                            if (safeA < safeB) return sortConfig.direction === 'asc' ? -1 : 1;
                                            if (safeA > safeB) return sortConfig.direction === 'asc' ? 1 : -1;
                                            return 0;
                                        });
                                    } else {
                                        // Default sort: end_date ASC (nulls/empty at end)
                                        flattened.sort((a, b) => {
                                            const dateA = a.assignment.end_date || '9999-12-31';
                                            const dateB = b.assignment.end_date || '9999-12-31';
                                            return dateA.localeCompare(dateB);
                                        });
                                    }
                                    return flattened.map((item) => {
                                        const assignment = item.assignment;
                                        const acc = item.account;
                                        const sIdx = assignment.slot_number;
                                        const key = `${acc.id}_${sIdx}`;
                                        const val = gridValues[key] || {};
                                        const isLastSaved = lastSavedKey === assignment.id || lastSavedKey === key;
                                        const today = new Date();
                                        today.setHours(0, 0, 0, 0);
                                        const isExpired = assignment.end_date ? parseISO(assignment.end_date) < today : false;
                                        const isEmpty = !!(assignment.id && assignment.id.startsWith('empty_'));
                                        const isDeactivated = val.is_active === false;

                                        return (
                                            <tr key={assignment.id} className={`${isDeactivated ? 'bg-red-50 text-red-500' : (isExpired ? 'bg-orange-50' : (isLastSaved ? 'bg-blue-50 animate-pulse' : 'hover:bg-gray-50'))} border-b`}>
                                                <td className="text-center py-2 border-r border-gray-200">
                                                    <input type="checkbox" checked={selectedAssignmentIds.has(assignment.id)} onChange={() => handleToggleSelection(assignment.id)} />
                                                </td>
                                                <td className="p-2 border-r text-center text-xs font-bold px-1">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <span>{acc.login_id}-{sIdx + 1}</span>
                                                        {sIdx === 0 && (acc.order_accounts?.length || 0) === 0 && (
                                                            <button type="button" title="빈 마스터계정 삭제" onClick={(e) => { e.stopPropagation(); handleDeleteMasterAccount(acc); }} className="flex-shrink-0">
                                                                <Trash2 size={12} className="text-red-400 hover:text-red-600 cursor-pointer" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-2 border-r text-center">
                                                    {!isEmpty && (
                                                        <div className="flex items-center justify-center gap-1">
                                                            <span className={`px-1 rounded text-xs ${assignment.type === 'master' ? 'bg-purple-100 text-purple-700 font-bold' : 'bg-blue-50 text-blue-600'}`}>
                                                                {assignment.type === 'master' ? 'Master' : 'User'}
                                                            </span>
                                                            <MessageSquareText
                                                                size={14}
                                                                className={`cursor-pointer ${val.memo ? 'text-blue-500 fill-blue-50' : 'text-gray-300 hover:text-gray-500'}`}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    openMemoModal(acc.id, sIdx, val.memo || '', assignment.id);
                                                                }}
                                                            />
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-2 border-r text-left overflow-hidden text-ellipsis whitespace-nowrap">{val.tidal_id || '-'}</td>
                                                <td className="p-2 border-r text-left font-mono text-xs">{val.tidal_password || '-'}</td>
                                                <td className="p-2 border-r text-left">
                                                    <span className={pendingDeleteIds.has(assignment.id) ? "text-red-500 font-bold" : ""}>{val.buyer_name || '-'}</span>
                                                </td>
                                                <td className="p-2 border-r text-left text-xs overflow-hidden text-ellipsis whitespace-nowrap">{val.buyer_email || '-'}</td>
                                                <td className="p-2 border-r text-left text-xs">{val.buyer_phone || '-'}</td>
                                                <td className="p-2 border-r text-center text-xs font-mono">{val.order_number || '-'}</td>
                                                <td className="p-2 border-r text-center text-xs">{val.start_date || '-'}</td>
                                                <td className="p-2 border-r text-center text-xs">{val.end_date || '-'}</td>
                                                <td className="p-2 border-r text-center">{getPeriodMonths(val.start_date, val.end_date) > 1 ? `${getPeriodMonths(val.start_date, val.end_date)}개월` : '-'}</td>
                                                <td className="p-2 border-r text-right">{val.amount?.toLocaleString() || '0'}</td>

                                                <td className="p-2 text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        {isEmpty ? (
                                                            <Button size="sm" onClick={() => openAssignModal(acc, sIdx)}>배정</Button>
                                                        ) : (
                                                            <>
                                                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-blue-600" title="수정" onClick={() => openEditAssignModal(key, val)}><Pencil size={14} /></Button>
                                                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-blue-600" title="이동" onClick={() => openMoveModal(assignment)}><ArrowRightLeft size={14} /></Button>
                                                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-orange-600" title="비활성화" onClick={() => handleDeactivate(assignment.id)}><PowerOff size={14} /></Button>
                                                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-red-600" title="삭제" onClick={() => handleDelete(assignment.id)}><Trash2 size={14} /></Button>
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
                ) : null}
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
                                    <div className="text-sm text-green-600 font-bold mb-2">마스터 계정</div>
                                    <div className="flex justify-around items-end">
                                        <div>
                                            <div className="text-[10px] text-green-500">신규</div>
                                            <div className="text-xl font-bold text-green-700">{importResults.success.masters.created}</div>
                                        </div>
                                        <div className="text-gray-300 mb-1">/</div>
                                        <div>
                                            <div className="text-[10px] text-green-500">업데이트</div>
                                            <div className="text-xl font-bold text-green-700">{importResults.success.masters.updated}</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-blue-50 p-4 rounded-lg text-center">
                                    <div className="text-sm text-blue-600 font-bold mb-2">슬롯</div>
                                    <div className="flex justify-around items-end">
                                        <div>
                                            <div className="text-[10px] text-blue-500">신규</div>
                                            <div className="text-xl font-bold text-blue-700">{importResults.success.slots.created}</div>
                                        </div>
                                        <div className="text-gray-300 mb-1">/</div>
                                        <div>
                                            <div className="text-[10px] text-blue-500">업데이트</div>
                                            <div className="text-xl font-bold text-blue-700">{importResults.success.slots.updated}</div>
                                        </div>
                                    </div>
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

            {/* Edit Assignment Modal */}
            <Dialog open={isEditAssignModalOpen} onOpenChange={setIsEditAssignModalOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>정보수정 {editAssignData?.assignment_number ? `/ ${editAssignData.assignment_number}` : ''}</DialogTitle>
                    </DialogHeader>
                    {editAssignData && (
                        <div className="grid gap-4 py-4 overflow-y-auto max-h-[70vh] px-1">
                            {/* Row 1: 고객명 / Tidal ID / PW */}
                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-1">
                                    <Label htmlFor="edit-buyer-name" className="text-xs text-gray-500">이름</Label>
                                    <Input
                                        id="edit-buyer-name"
                                        value={editAssignData.buyer_name || ''}
                                        onChange={(e) => setEditAssignData({ ...editAssignData, buyer_name: e.target.value })}
                                        className="h-9"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="edit-tidal-id" className="text-xs text-gray-500">Tidal ID</Label>
                                    <Input
                                        id="edit-tidal-id"
                                        value={editAssignData.tidal_id || ''}
                                        onChange={(e) => setEditAssignData({ ...editAssignData, tidal_id: e.target.value })}
                                        className="h-9"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="edit-tidal-pw" className="text-xs text-gray-500">PW</Label>
                                    <Input
                                        id="edit-tidal-pw"
                                        value={editAssignData.tidal_password || ''}
                                        onChange={(e) => setEditAssignData({ ...editAssignData, tidal_password: e.target.value })}
                                        className="h-9"
                                    />
                                </div>
                            </div>

                            {/* Row 2: 전화번호 / 이메일 */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label htmlFor="edit-buyer-phone" className="text-xs text-gray-500">전화번호</Label>
                                    <Input
                                        id="edit-buyer-phone"
                                        value={editAssignData.buyer_phone || ''}
                                        onChange={(e) => setEditAssignData({ ...editAssignData, buyer_phone: e.target.value })}
                                        className="h-9"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="edit-buyer-email" className="text-xs text-gray-500">이메일</Label>
                                    <Input
                                        id="edit-buyer-email"
                                        value={editAssignData.buyer_email || ''}
                                        onChange={(e) => setEditAssignData({ ...editAssignData, buyer_email: e.target.value })}
                                        className="h-9"
                                    />
                                </div>
                            </div>

                            {/* Row 3: 시작일 / 종료일 / 개월 / 계약금액 */}
                            <div className="grid grid-cols-4 gap-2">
                                <div className="space-y-1">
                                    <Label htmlFor="edit-start-date" className="text-[10px] text-gray-500">시작일</Label>
                                    <Input
                                        id="edit-start-date"
                                        type="date"
                                        value={editAssignData.start_date || ''}
                                        onChange={(e) => {
                                            const newStart = e.target.value;
                                            let newEnd = editAssignData.end_date;
                                            if (newStart && editAssignData.period_months) {
                                                try {
                                                    const start = parseISO(newStart);
                                                    const end = addDays(start, editAssignData.period_months * 30);
                                                    newEnd = end.toISOString().split('T')[0];
                                                } catch {}
                                            }
                                            setEditAssignData({ ...editAssignData, start_date: newStart, end_date: newEnd });
                                        }}
                                        className="h-9 text-xs px-1"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="edit-end-date" className="text-[10px] text-gray-500">종료일</Label>
                                    <Input
                                        id="edit-end-date"
                                        type="date"
                                        value={editAssignData.end_date || ''}
                                        onChange={(e) => {
                                            const newEnd = e.target.value;
                                            let newMonths = editAssignData.period_months;
                                            if (editAssignData.start_date && newEnd) {
                                                try {
                                                    const start = parseISO(editAssignData.start_date);
                                                    const end = parseISO(newEnd);
                                                    const days = differenceInDays(end, start);
                                                    newMonths = Math.max(0, Math.floor(days / 30));
                                                } catch {}
                                            }
                                            setEditAssignData({ ...editAssignData, end_date: newEnd, period_months: newMonths });
                                        }}
                                        className="h-9 text-xs px-1"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="edit-months" className="text-[10px] text-gray-500">개월</Label>
                                    <Input
                                        id="edit-months"
                                        type="number"
                                        value={editAssignData.period_months || ''}
                                        onChange={(e) => {
                                            const months = parseInt(e.target.value) || 0;
                                            let newEnd = editAssignData.end_date;
                                            if (editAssignData.start_date && months >= 0) {
                                                try {
                                                    const start = parseISO(editAssignData.start_date);
                                                    const end = addDays(start, months * 30);
                                                    newEnd = end.toISOString().split('T')[0];
                                                } catch {}
                                            }
                                            setEditAssignData({ ...editAssignData, period_months: months, end_date: newEnd });
                                        }}
                                        className="h-9 text-xs px-1"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="edit-amount" className="text-[10px] text-gray-500">계약금액</Label>
                                    <Input
                                        id="edit-amount"
                                        type="number"
                                        value={editAssignData.amount || ''}
                                        onChange={(e) => setEditAssignData({ ...editAssignData, amount: parseInt(e.target.value) || 0 })}
                                        className="h-9 text-xs px-1"
                                    />
                                </div>
                            </div>

                            {/* Row 4: 메모 (3줄) */}
                            <div className="space-y-1">
                                <Label htmlFor="edit-memo" className="text-xs text-gray-500">메모</Label>
                                <textarea
                                    id="edit-memo"
                                    rows={3}
                                    className="w-full p-2 text-sm border rounded-md focus:ring-1 focus:ring-blue-500 outline-none"
                                    value={editAssignData.memo || ''}
                                    onChange={(e) => setEditAssignData({ ...editAssignData, memo: e.target.value })}
                                />
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditAssignModalOpen(false)}>취소</Button>
                        <Button onClick={handleUpdateEditAssign} className="bg-blue-600 hover:bg-blue-700">저장하기</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {/* Memo Modal */}
            <Dialog open={isMemoModalOpen} onOpenChange={setIsMemoModalOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>메모 편집</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <textarea
                            className="w-full min-h-[100px] p-3 border rounded-md text-sm outline-none focus:ring-2 focus:ring-primary"
                            placeholder="메모를 입력하세요..."
                            value={currentMemoInput}
                            onChange={(e) => setCurrentMemoInput(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsMemoModalOpen(false)}>취소</Button>
                        <Button onClick={handleSaveMemo}>저장</Button>
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
