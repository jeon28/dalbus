"use client";

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { useServices } from '@/lib/ServiceContext';
import styles from '../admin.module.css';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { Plus, ChevronDown, ChevronUp, Trash2, ArrowRightLeft, Save, Download, Pencil, Upload, LayoutGrid, List, History, PowerOff, Filter, Mail, X, Search, MessageSquareText, Settings } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
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
import { EmailTemplateModal } from '@/components/admin/EmailTemplateModal';

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
    account_id?: string;
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
    amount?: number;
    memo?: string;
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
    const [showDeletedOnly, setShowDeletedOnly] = useState(false);
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
    // Deleted group edit state
    const [isEditDeletedGroupOpen, setIsEditDeletedGroupOpen] = useState(false);
    const [editDeletedGroup, setEditDeletedGroup] = useState<Account | null>(null);
    const [editDeletedGroupForm, setEditDeletedGroupForm] = useState({ login_id: '', payment_email: '', payment_day: 1, memo: '' });
    const [selectedAssignmentIds, setSelectedAssignmentIds] = useState<Set<string>>(new Set());
    const [isNotifyModalOpen, setIsNotifyModalOpen] = useState(false);
    const [notificationMessage, setNotificationMessage] = useState('');
    const [isSendingNotify, setIsSendingNotify] = useState(false);
    const [emailTemplates, setEmailTemplates] = useState<{id?: string, key: string, name: string, subject?: string, content?: string, design?: any, placeholders?: any[]}[]>([]);
    const [selectedTemplateKey, setSelectedTemplateKey] = useState('');
    const [isTemplateEditOpen, setIsTemplateEditOpen] = useState(false);
    const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set());
    
    // Quick Edit Feature State
    const [isQuickEditModalOpen, setIsQuickEditModalOpen] = useState(false);
    const [quickEditValues, setQuickEditValues] = useState<GridValue | null>(null);
    const [initialQuickEditValues, setInitialQuickEditValues] = useState<GridValue | null>(null);
    const [quickEditAccountId, setQuickEditAccountId] = useState<string | null>(null);
    const [quickEditSlotIdx, setQuickEditSlotIdx] = useState<number | null>(null);
    const [quickEditAssignmentId, setQuickEditAssignmentId] = useState('');
    
    // Memo Feature State
    const [isMemoModalOpen, setIsMemoModalOpen] = useState(false);
    const [currentMemoInput, setCurrentMemoInput] = useState('');
    const [memoTargetAccountId, setMemoTargetAccountId] = useState('');
    const [memoTargetSlotIdx, setMemoTargetSlotIdx] = useState<number | null>(null);
    const [memoTargetAssignmentId, setMemoTargetAssignmentId] = useState('');

    const [isOrderDetailModalOpen, setIsOrderDetailModalOpen] = useState(false);
    const [selectedOrderDetails, setSelectedOrderDetails] = useState<Order | null>(null);
    const [, setIsLoadingOrder] = useState(false);

    // --- DAL-20: Column Resizing and Filter States ---
    const [expiredDays, setExpiredDays] = useState(7);
    const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
        'checkbox': 40,
        'slot_col': 80,
        'manage': 60,
        'type': 40,
        'tidal_id': 250,
        'buyer_name': 120,
        'buyer_email': 200,
        'buyer_phone': 140,
        'start_date': 120,
        'end_date': 120,
        'period': 60,
        'amount': 100,
        'memo_col': 400
    });
    const [resizingCol, setResizingCol] = useState<string | null>(null);

    const startResizing = (id: string, e: React.MouseEvent) => {
        e.preventDefault();
        setResizingCol(id);

        const startX = e.pageX;
        const startWidth = columnWidths[id];

        const onMouseMove = (moveEvent: MouseEvent) => {
            const currentX = moveEvent.pageX;
            const newWidth = Math.max(40, startWidth + (currentX - startX));
            setColumnWidths((prev: Record<string, number>) => ({ ...prev, [id]: newWidth }));
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAdmin, isHydrated, router]);


    useEffect(() => {
        if (isHydrated && isAdmin) {
            fetchAccounts();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showDeletedOnly]);

    useEffect(() => {
        if (showExpiredOnly) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const newExpanded = new Set<string>();
            accounts.forEach(acc => {
                const hasExpired = acc.order_accounts?.some(oa => {
                    if (!oa.end_date) return false;
                    const endDate = parseISO(oa.end_date);
                    const diffTime = endDate.getTime() - today.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    return diffDays <= expiredDays;
                });
                if (hasExpired) newExpanded.add(acc.id);
            });
            setExpandedRows(newExpanded);
        }
    }, [showExpiredOnly, accounts, expiredDays]);


    // --- Fetching Functions ---
    const fetchAccounts = useCallback(async () => {
        try {
            const params = new URLSearchParams({ product: 'Tidal' });
            if (showDeletedOnly) {
                params.append('showDeleted', 'true');
            } else {
                params.append('showInactive', 'true');
            }
            const res = await apiFetch(`/api/admin/accounts?${params.toString()}`, { cache: 'no-store' });
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
                        order_id: assignment?.order_id || assignment?.orders?.id || '',
                        type: assignment?.type || (i === 0 ? 'master' : 'user'),
                        period_months: assignment?.period_months || 0,
                        amount: assignment?.orders?.amount || 0,
                        memo: assignment?.memo || '',
                    };
                }
            });
            setGridValues(initialGrid);
        } catch (error) {
            console.error(error);
        }
    }, [showDeletedOnly]);

    const fetchPendingOrders = useCallback(async () => {
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
    }, []);

    // --- Hooks & Effects ---
    useEffect(() => {
        setNotificationMessage(defaultTemplate);
    }, [defaultTemplate]);

    useEffect(() => {
        if (isHydrated && !isAdmin) {
            router.replace('/');
        }
    }, [isAdmin, isHydrated, router]);

    useEffect(() => {
        if (isHydrated && isAdmin) {
            fetchAccounts();
            fetchPendingOrders();
            apiFetch('/api/admin/email-templates').then(res => {
                if (res.ok) res.json().then((data: {key: string, name: string, subject?: string, content?: string}[]) => {
                    setEmailTemplates(data);
                    const firstNonLegacy = data.find(t => !t.key.startsWith('LEGACY'));
                    if (firstNonLegacy) setSelectedTemplateKey(firstNonLegacy.key);
                });
            });
        }
    }, [isAdmin, isHydrated, fetchAccounts, fetchPendingOrders]);


    useEffect(() => {
        if (showExpiredOnly) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const newExpanded = new Set<string>();
            accounts.forEach(acc => {
                const hasExpired = acc.order_accounts?.some(oa => {
                    if (!oa.end_date) return false;
                    const endDate = parseISO(oa.end_date);
                    const diffTime = endDate.getTime() - today.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    return diffDays <= expiredDays;
                });
                if (hasExpired) newExpanded.add(acc.id);
            });
            setExpandedRows(newExpanded);
        }
    }, [showExpiredOnly, accounts, expiredDays]);



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
        const taken = new Set((acc.order_accounts || [])
            .filter(oa => oa && typeof oa.slot_number === 'number')
            .map(oa => oa.slot_number));
        const available = [];
        for (let i = 0; i < 6; i++) {
            if (!taken.has(i)) {
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
            if (showDeletedOnly) {
                // When showing deleted data, show ALL historical deleted assignments
                const deletedAssignments = (acc.order_accounts || []).filter(oa => oa.is_deleted);
                deletedAssignments.forEach(assignment => {
                    const periodNum = getPeriodMonths(assignment.start_date, assignment.end_date);
                    
                    // Search Filter
                    const query = searchQuery.toLowerCase().trim();
                    if (query) {
                        const buyerName = (assignment.buyer_name || assignment.orders?.buyer_name || '').toLowerCase();
                        const buyerEmail = (assignment.buyer_email || assignment.orders?.buyer_email || '').toLowerCase();
                        const tidalId = (assignment.tidal_id || '').toLowerCase();
                        const buyerPhone = (assignment.buyer_phone || assignment.orders?.buyer_phone || '').toLowerCase();
                        if (!buyerName.includes(query) && !buyerEmail.includes(query) && !tidalId.includes(query) && !buyerPhone.includes(query)) return;
                    }

                    flattened.push({
                        id: assignment.id,
                        assignment,
                        account: acc,
                        period: periodNum,
                        originalAccIndex: accIdx
                    });
                });
                return;
            }

            for (let i = 0; i < acc.max_slots; i++) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                let assignment: any = acc.order_accounts?.find(oa => oa.slot_number === i && !oa.is_deleted);
                if (!assignment) {
                    assignment = {
                        id: `empty_${acc.id}_${i}`,
                        slot_number: i,
                        type: i === 0 ? 'master' : 'user',
                        account_id: acc.id,
                        is_active: true,
                        tidal_id: undefined,
                        tidal_password: undefined,
                        buyer_name: undefined,
                        buyer_email: undefined,
                        buyer_phone: undefined,
                        order_number: undefined,
                        start_date: undefined,
                        end_date: undefined
                    };
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

                let periodNum = assignment.period_months || 0;
                if (!periodNum && assignment.start_date && assignment.end_date) {
                    try {
                        periodNum = getPeriodMonths(assignment.start_date, assignment.end_date);
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
            for (let i = 0; i < acc.max_slots; i++) {
                const assignment = acc.order_accounts?.find(oa => oa.slot_number === i);
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

                // Deleted Filter
                if (showDeletedOnly && (!assignment || assignment.id.startsWith('empty_'))) continue;

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

            if (field === 'start_date' || field === 'period_months') {
                const nextMonths = parseInt(String(next.period_months)) || 0;

                // [개선안] 기준점 고정 방식: 최초 데이터(accounts state)를 기준으로 계산하여 누적 오차 방지
                const acc = accounts.find(a => a.id === accountId);
                const original = acc?.order_accounts?.find(oa => oa.slot_number === slotIdx);
                const initialEndDate = original?.end_date;
                const initialMonths = original?.period_months || 0;

                if (field === 'start_date') {
                    if (next.start_date && nextMonths >= 0) {
                        try {
                            const start = parseISO(next.start_date);
                            const end = addDays(start, nextMonths * 30);
                            next.end_date = format(end, 'yyyy-MM-dd');
                        } catch { }
                    }
                } else if (field === 'period_months') {
                    if (initialEndDate) {
                        try {
                            const newEnd = addDays(parseISO(initialEndDate), (nextMonths - initialMonths) * 30);
                            next.end_date = format(newEnd, 'yyyy-MM-dd');
                        } catch { }
                    } else if (next.start_date) {
                        try {
                            const start = parseISO(next.start_date);
                            const end = addDays(start, nextMonths * 30);
                            next.end_date = format(end, 'yyyy-MM-dd');
                        } catch { }
                    }
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

    const handleSaveRow = async (accountId: string, slotIdx: number) => {
        const key = `${accountId}_${slotIdx}`;
        const data = gridValues[key];
        if (!data) return;

        try {
            if (data.assignment_id) {
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
            setEditingSlots(prev => ({ ...prev, [key]: false }));
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

        if (!confirm('해당 기록을 삭제하시겠습니까? (삭제된 데이터 보기에 저장되며, 메인 페이지에서 관리 가능합니다)')) return;
        try {
            const res = await apiFetch(`/api/admin/assignments/${assignmentId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Delete failed');
            fetchAccounts();
            fetchPendingOrders();
        } catch (error) {
            alert('삭제 실패: ' + (error instanceof Error ? error.message : String(error)));
        }
    };

    const handlePermanentDelete = async (assignmentId: string) => {
        if (!confirm('복구가 불가능하도록 "완전히 삭제" 하시겠습니까?')) return;
        try {
            const res = await apiFetch(`/api/admin/assignments/${assignmentId}?hardDelete=true`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Permanent delete failed');
            alert('완전히 삭제되었습니다.');
            fetchAccounts();
            fetchPendingOrders();
        } catch (error) {
            alert('삭제 실패: ' + (error instanceof Error ? error.message : String(error)));
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

    const handleEditMasterAccount = (account: Account) => {
        setEditingAccount(account);
        setIsEditModalOpen(true);
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

    const handleEditDeletedGroup = async () => {
        if (!editDeletedGroup || !editDeletedGroupForm.login_id.trim()) return;
        try {
            const res = await apiFetch(`/api/admin/accounts/${editDeletedGroup.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    login_id: editDeletedGroupForm.login_id.trim(),
                    payment_email: editDeletedGroupForm.payment_email.trim(),
                    payment_day: editDeletedGroupForm.payment_day,
                    memo: editDeletedGroupForm.memo.trim(),
                })
            });
            if (res.status === 409) {
                alert('이미 사용 중인 그룹 ID입니다.');
                return;
            }
            if (!res.ok) throw new Error('수정 실패');
            setIsEditDeletedGroupOpen(false);
            fetchAccounts();
        } catch (error) {
            alert('실패: ' + (error instanceof Error ? error.message : String(error)));
        }
    };

    const handleRestoreDeletedGroup = async (acc: Account) => {
        if (!confirm(`"${acc.login_id}" 그룹을 재등록(복원)하시겠습니까?`)) return;
        try {
            const res = await apiFetch(`/api/admin/accounts/${acc.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'available' })
            });
            if (!res.ok) throw new Error('재등록 실패');
            fetchAccounts();
        } catch (error) {
            alert('실패: ' + (error instanceof Error ? error.message : String(error)));
        }
    };

    const handleEditAndRestoreDeletedGroup = async () => {
        if (!editDeletedGroup || !editDeletedGroupForm.login_id.trim()) return;
        try {
            const res = await apiFetch(`/api/admin/accounts/${editDeletedGroup.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    login_id: editDeletedGroupForm.login_id.trim(),
                    payment_email: editDeletedGroupForm.payment_email.trim(),
                    payment_day: editDeletedGroupForm.payment_day,
                    memo: editDeletedGroupForm.memo.trim(),
                    status: 'available',
                })
            });
            if (res.status === 409) { alert('이미 사용 중인 그룹 ID입니다.'); return; }
            if (!res.ok) throw new Error('재등록 실패');
            setIsEditDeletedGroupOpen(false);
            fetchAccounts();
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
                '소속 ID': '',
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
                    '소속 ID': item.tidal_id || '',
                    '시작일': item.start_date || '',
                    '종료일': item.end_date || '',
                    '개월': getPeriodMonths(item.start_date, item.end_date),
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
                const err = error as Error;
                alert(`엑셀 업로드 실패: ${err.message}`);
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

    useEffect(() => {
        const accountId = searchParams.get('accountId');
        const slotIdx = searchParams.get('slotIdx');
        const action = searchParams.get('action');

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

                    // If action is assign, open the modal
                    if (action === 'assign' && slotIdx !== null) {
                        const acc = accounts.find(a => a.id === accountId);
                        if (acc) {
                            openAssignModal(acc, parseInt(slotIdx));
                        }
                    }

                    setTimeout(() => { if (element) element.style.backgroundColor = ''; }, 3000);
                } else setTimeout(scrollToAndHighlight, 500);
            };
            setTimeout(scrollToAndHighlight, 500);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams, accounts]);


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
                body: JSON.stringify({ recipients, messageTemplate: notificationMessage, templateKey: selectedTemplateKey })
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

    const openQuickEditModal = (accountId: string, slotIdx: number, values: GridValue, assignmentId: string) => {
        setQuickEditAccountId(accountId);
        setQuickEditSlotIdx(slotIdx);
        setQuickEditAssignmentId(assignmentId);
        setQuickEditValues({ ...values });
        setInitialQuickEditValues({ ...values }); // 기준점 고정 방식: 최초 데이터 저장
        setIsQuickEditModalOpen(true);
    };

    const handleSaveQuickEdit = async () => {
        if (!quickEditAssignmentId || !quickEditValues) return;
        try {
            const res = await apiFetch(`/api/admin/assignments/${quickEditAssignmentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(quickEditValues)
            });
            if (!res.ok) throw new Error('Update failed');
            
            // UI 상태 반영 (Grid View 데이터 캐시 업데이트)
            setGridValues(prev => ({
                ...prev,
                [`${quickEditAccountId}_${quickEditSlotIdx}`]: { ...quickEditValues }
            }));
            
            setIsQuickEditModalOpen(false);
            fetchAccounts();
            alert('정보가 수정되었습니다.');
        } catch (e) {
            alert('저장 실패: ' + (e instanceof Error ? e.message : String(e)));
        }
    };

    const handleRestore = async (assignmentId: string) => {
        if (!confirm('배정을 복구하시겠습니까?')) return;
        try {
            const res = await apiFetch(`/api/admin/assignments/${assignmentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_deleted: false, is_active: true })
            });
            if (!res.ok) throw new Error('Restore failed');
            alert('복구되었습니다. (배정 번호 유지)');
            fetchAccounts();
        } catch (error) {
            alert('실패: ' + (error instanceof Error ? error.message : String(error)));
        }
    };

    const startEdit = (accountId: string, slotIdx: number) => {
        setEditingSlots(prev => ({ ...prev, [`${accountId}_${slotIdx}`]: true }));
    };

    const generateTidalPassword = () => {
        const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@$";
        let pass = "";
        for (let i = 0; i < 8; i++) pass += chars.charAt(Math.floor(Math.random() * chars.length));
        return pass;
    };



    const cancelEdit = (accountId: string, slotIdx: number) => {
        const key = `${accountId}_${slotIdx}`;
        setEditingSlots(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
        });

        // Restore gridValue from accounts state locally
        const acc = accounts.find(a => a.id === accountId);
        if (acc) {
            const assignment = acc.order_accounts?.find(oa => oa.slot_number === slotIdx);
            let defaultPw = assignment?.tidal_password || '';
            if (slotIdx === 0 && !defaultPw) defaultPw = acc.login_pw;

            setGridValues(prev => ({
                ...prev,
                [key]: {
                    assignment_id: assignment?.id,
                    tidal_id: assignment?.tidal_id ?? null,
                    tidal_password: defaultPw,
                    buyer_name: assignment?.buyer_name || assignment?.orders?.buyer_name || assignment?.orders?.profiles?.name || '',
                    buyer_phone: assignment?.buyer_phone || assignment?.orders?.buyer_phone || assignment?.orders?.profiles?.phone || '',
                    buyer_email: assignment?.buyer_email || assignment?.orders?.buyer_email || '',
                    start_date: assignment?.start_date || '',
                    end_date: assignment?.end_date || '',
                    order_number: assignment?.order_number || assignment?.orders?.order_number || '',
                    type: assignment?.type || (slotIdx === 0 ? 'master' : 'user'),
                    period_months: assignment?.period_months || 0,
                    amount: assignment?.orders?.amount || 0,
                    memo: assignment?.memo || '',
                }
            }));
        }
    };

    const openMemoModal = (accountId: string, slotIdx: number, currentMemo: string, assignmentId: string) => {
        setMemoTargetAccountId(accountId);
        setMemoTargetSlotIdx(slotIdx);
        setMemoTargetAssignmentId(assignmentId);
        
        const now = new Date();
        const yy = String(now.getFullYear()).slice(-2);
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2, '0');
        const mins = String(now.getMinutes()).padStart(2, '0');
        const timestamp = `${yy}/${mm}/${dd} ${hh}:${mins} `;
        
        let newMemo = currentMemo || "";
        if (newMemo) {
            newMemo = timestamp + "\n" + newMemo;
        } else {
            newMemo = timestamp;
        }
        
        setCurrentMemoInput(newMemo);
        setIsMemoModalOpen(true);
    };

    const fetchOrderDetails = async (orderId: string) => {
        setIsLoadingOrder(true);
        try {
            const res = await apiFetch(`/api/admin/orders/${orderId}`);
            if (res.ok) {
                const data = await res.json();
                setSelectedOrderDetails(data);
                setIsOrderDetailModalOpen(true);
            } else {
                alert('주문 정보를 불러오지 못했습니다.');
            }
        } catch (error) {
            console.error(error);
            alert('오류가 발생했습니다.');
        } finally {
            setIsLoadingOrder(false);
        }
    };

    const handleToggleActive = async (assignmentId: string, currentStatus: boolean | undefined) => {
        const nextStatus = !currentStatus;
        const msg = nextStatus ? '해당 배정을 활성화하시겠습니까?' : '해당 배정을 종료하시겠습니까?\n종료 시 해당 줄이 붉은색으로 표시됩니다.';
        
        if (!confirm(msg)) return;

        try {
            const res = await apiFetch(`/api/admin/assignments/${assignmentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_active: nextStatus })
            });
            if (!res.ok) throw new Error('Update failed');
            
            fetchAccounts();
        } catch (e) {
            alert('변경 실패: ' + (e instanceof Error ? e.message : String(e)));
        }
    };

    const handleSaveMemo = async () => {
        if (!memoTargetAssignmentId) return;
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

    if (!isAdmin) return null;

    return (
        <main className={styles.main}>
            <header className={`${styles.header} glass sticky top-0 z-50`}>
                <div className="container mx-auto px-4 py-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <h1 className={`${styles.title} text-xl md:text-2xl`}>Tidal 계정 관리</h1>
                                <Button variant="outline" size="sm" onClick={() => setIsGridView(!isGridView)} className="h-9">
                                    {isGridView ? <List size={16} className="mr-2" /> : <LayoutGrid size={16} className="mr-2" />}
                                    <span className="hidden sm:inline">{isGridView ? 'List View' : 'Grid View'}</span>
                                </Button>
                            </div>
                            <div className="md:hidden">
                                <Button onClick={() => setIsAddModalOpen(true)} size="sm" className="h-9 gap-2">
                                    <Plus size={16} /> 추가
                                </Button>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                            {/* 1. 검색창 */}
                            <div className="relative flex-1 sm:min-w-[200px] flex items-center bg-white border rounded-md px-3 focus-within:ring-2 focus-within:ring-blue-500 shadow-sm transition-all h-10">
                                <Search size={16} className="text-gray-400 shrink-0" />
                                <Input
                                    type="text"
                                    placeholder="고객명, ID, 전화번호..."
                                    className="border-0 focus-visible:ring-0 h-full w-full text-sm"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <div className="flex items-center gap-1 bg-white border rounded-md px-2 h-9 shadow-sm">
                                    <span className="text-[10px] text-gray-400 font-bold uppercase">EXP</span>
                                    <Input
                                        type="number"
                                        value={expiredDays}
                                        onChange={(e) => setExpiredDays(parseInt(e.target.value) || 0)}
                                        className="w-10 h-7 px-1 text-center text-sm border-none focus-visible:ring-0 font-bold"
                                    />
                                    <span className="text-[10px] text-gray-500">일</span>
                                </div>
                                <Button
                                    variant={showExpiredOnly ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setShowExpiredOnly(!showExpiredOnly)}
                                    className="h-9 gap-1 text-xs"
                                >
                                    <Filter className="w-4 h-4" />
                                    <span className="hidden lg:inline">잔여일 조회</span>
                                </Button>
                                <Button
                                    variant={showDeletedOnly ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setShowDeletedOnly(!showDeletedOnly)}
                                    className="h-9 gap-1 text-xs"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    <span className="hidden lg:inline">삭제 데이터</span>
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => router.push('/admin/tidal/inactive')}
                                    className="h-9 gap-1 text-xs"
                                >
                                    <History className="w-4 h-4" />
                                    <span className="hidden lg:inline">비활성 내역</span>
                                </Button>
                                
                                <div className="hidden md:flex items-center gap-2">
                                    <div className="h-4 w-px bg-gray-200 mx-1" />
                                    <Button onClick={() => setIsAddModalOpen(true)} className="gap-2 h-9 shadow-md" size="sm">
                                        <Plus size={16} /> <span className="hidden lg:inline text-xs">그룹 추가</span>
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    {/* 모바일 하단 알림 보내기 버튼 (Grid View 선택 시) */}
                    {isGridView && selectedAssignmentIds.size > 0 && (
                        <div className="mt-4 flex animate-in slide-in-from-top duration-300">
                             <Button
                                variant="default"
                                size="sm"
                                onClick={() => {
                                    setNotificationMessage(defaultTemplate);
                                    setIsNotifyModalOpen(true);
                                }}
                                className="w-full bg-orange-600 hover:bg-orange-700 h-10 gap-2 shadow-lg"
                            >
                                <Mail size={16} /> 알림 보내기 ({selectedAssignmentIds.size}개 행 선택됨)
                            </Button>
                        </div>
                    )}
                </div>
            </header>

            <div className={`${styles.content} container mx-auto px-4 py-6 pb-24`}>
                {isGridView ? (
                    <div className="bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm min-w-[1400px]">
                            <thead>
                                <tr className="bg-gray-100/80 sticky top-0 z-10 border-b border-gray-200 shadow-sm text-sm">
                                    <th className="relative p-2 text-center border-r border-gray-100" style={{ width: columnWidths['checkbox'] }}>
                                        <input
                                            type="checkbox"
                                            checked={selectedAssignmentIds.size > 0 && getFlattenedAssignments().every(item => selectedAssignmentIds.has(item.assignment.id))}
                                            onChange={(e) => {
                                                const flattened = getFlattenedAssignments();
                                                if (e.target.checked) setSelectedAssignmentIds(new Set(flattened.map(item => item.assignment.id)));
                                                else setSelectedAssignmentIds(new Set());
                                            }}
                                        />
                                    </th>
                                    <th className="relative p-2 text-center border-r" style={{ width: columnWidths['slot_col'] }}>
                                        <div className="flex items-center justify-center gap-1 cursor-pointer hover:bg-gray-200 h-full" onClick={() => handleSort('login_id')}>
                                            배정번호 {sortConfig?.key === 'login_id' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                                        </div>
                                        <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400" onMouseDown={e => startResizing('slot_col', e)} />
                                    </th>
                                    <th className="relative p-2 text-center border-r" style={{ width: columnWidths['manage'] }}>
                                        관리
                                        <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400" onMouseDown={e => startResizing('manage', e)} />
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
                                    <th className="relative p-2 text-center" style={{ width: columnWidths['memo_col'] }}>
                                        메모
                                        <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400" onMouseDown={e => startResizing('memo_col', e)} />
                                    </th>
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
                                                case 'type':
                                                    aVal = a.assignment.type || '';
                                                    bVal = b.assignment.type || '';
                                                    break;
                                                case 'login_id':
                                                    aVal = a.account.login_id;
                                                    bVal = b.account.login_id;
                                                    break;
                                                case 'buyer_email':
                                                    aVal = a.assignment.buyer_email || a.assignment.orders?.buyer_email || '';
                                                    bVal = b.assignment.buyer_email || b.assignment.orders?.buyer_email || '';
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
                                        const isActive = assignment.is_active !== false;

                                        const isEmpty = assignment.id.startsWith('empty_');

                                        return (
                                            <tr key={assignment.id} className={`border-b hover:bg-gray-50 ${isExpired ? 'bg-red-50/30' : ''} ${!isActive ? 'bg-red-50 text-red-600' : ''} ${selectedAssignmentIds.has(assignment.id) ? 'bg-blue-50/50' : ''}`}>
                                                <td className={`text-center py-1 border-r border-gray-100 bg-gray-50/10 ${resizingCol ? '' : 'transition-all'}`} style={{ width: columnWidths['checkbox'] }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedAssignmentIds.has(assignment.id)}
                                                        onChange={() => handleToggleSelection(assignment.id)}
                                                    />
                                                </td>
                                                <td className="p-2 text-center border-r bg-gray-50/5" style={{ width: columnWidths['slot_col'] }}>
                                                    <span className={`${isEmpty ? 'text-green-700' : 'text-blue-600'} font-bold text-xs`}>
                                                        {acc.login_id}-{sIdx + 1}
                                                    </span>
                                                </td>
                                                <td className="p-2 text-center border-r" style={{ width: columnWidths['manage'] }}>
                                                    <div className="flex justify-center gap-1 items-center">
                                                        {isEditing ? (
                                                            <>
                                                                <Button size="sm" variant="default" className="h-6 w-6 p-0 bg-blue-600 hover:bg-blue-700" title="저장" onClick={() => handleSaveRow(acc.id, sIdx)}>
                                                                    <Save size={12} />
                                                                </Button>
                                                                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-gray-500 hover:text-gray-700" title="취소" onClick={() => cancelEdit(acc.id, sIdx)}>
                                                                    <X size={12} />
                                                                </Button>
                                                            </>
                                                        ) : (
                                                            <Popover>
                                                                <PopoverTrigger asChild>
                                                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-blue-600">
                                                                        <Settings size={14} />
                                                                    </Button>
                                                                </PopoverTrigger>
                                                                <PopoverContent className="w-32 p-1" align="start">
                                                                    <div className="flex flex-col gap-1">
                                                                        {!isEmpty && (
                                                                            <>
                                                                                <Button size="sm" variant="ghost" className="h-8 justify-start gap-2 text-xs text-blue-600 font-bold" onClick={() => openQuickEditModal(acc.id, sIdx, val, assignment.id)}>
                                                                                    <Pencil size={12} /> 정보수정
                                                                                </Button>

                                                                            </>
                                                                        )}
                                                                        {!isEmpty && !assignment.is_deleted && (
                                                                            <>
                                                                                <Button size="sm" variant="ghost" className="h-8 justify-start gap-2 text-xs" onClick={() => openMoveModal(assignment)}>
                                                                                    <ArrowRightLeft size={12} /> 이동
                                                                                </Button>
                                                                                <Button size="sm" variant="ghost" className={`h-8 justify-start gap-2 text-xs ${!isActive ? 'text-blue-600' : 'text-orange-600'}`} onClick={() => handleToggleActive(assignment.id, assignment.is_active)}>
                                                                                    <PowerOff size={12} /> {isActive ? '종료' : '복구'}
                                                                                </Button>
                                                                            </>
                                                                        )}
                                                                        {!isEmpty && assignment.is_deleted && (
                                                                            <>
                                                                                <Button size="sm" variant="ghost" className="h-8 justify-start gap-2 text-xs text-green-600 hover:text-green-700" onClick={() => handleRestore(assignment.id)}>
                                                                                    <ArrowRightLeft size={12} /> 복구
                                                                                </Button>
                                                                                <Button size="sm" variant="ghost" className="h-8 justify-start gap-2 text-xs text-red-600 hover:text-red-700" onClick={() => handlePermanentDelete(assignment.id)}>
                                                                                    <Trash2 size={12} /> 완전히 삭제
                                                                                </Button>
                                                                            </>
                                                                        )}
                                                                        {!isEmpty && !assignment.is_deleted && (isExpired || assignment.is_active === false) && (
                                                                            <Button size="sm" variant="ghost" className="h-8 justify-start gap-2 text-xs text-red-600 hover:text-red-700" onClick={() => handleDelete(assignment.id)}>
                                                                                <Trash2 size={12} /> 삭제
                                                                            </Button>
                                                                        )}
                                                                    </div>
                                                                </PopoverContent>
                                                            </Popover>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-2 text-center border-r" style={{ width: columnWidths['type'] }}>
                                                    {!isEmpty && (
                                                        <div className="flex items-center justify-center gap-1">
                                                            <span className={`px-1 rounded text-[10px] w-4 h-4 flex items-center justify-center ${assignment.type === 'master' ? 'bg-purple-100 text-purple-700 font-bold' : 'bg-blue-50 text-blue-600'}`}>
                                                                {assignment.type === 'master' ? 'M' : 'U'}
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
                                                {isEditing ? (
                                                    <>
                                                        <td className="p-1 border-r" style={{ width: columnWidths['tidal_id'] }}>
                                                            <Input className="h-7 text-xs bg-white px-1" value={val.tidal_id || ''} onChange={e => updateGridValue(acc.id, sIdx, 'tidal_id', e.target.value)} />
                                                        </td>

                                                        <td className="p-1 border-r" style={{ width: columnWidths['buyer_name'] }}>
                                                            <Input className="h-7 text-xs bg-white px-1" value={val.buyer_name || ''} onChange={e => updateGridValue(acc.id, sIdx, 'buyer_name', e.target.value)} />
                                                        </td>
                                                        <td className="p-1 border-r" style={{ width: columnWidths['buyer_email'] }}>
                                                            <Input className="h-7 text-xs bg-white px-1" value={val.buyer_email || ''} onChange={e => updateGridValue(acc.id, sIdx, 'buyer_email', e.target.value)} />
                                                        </td>
                                                        <td className="p-1 border-r" style={{ width: columnWidths['buyer_phone'] }}>
                                                            <Input className="h-7 text-xs bg-white px-1" value={val.buyer_phone || ''} onChange={e => updateGridValue(acc.id, sIdx, 'buyer_phone', e.target.value)} />
                                                        </td>

                                                        <td className="p-1 border-r" style={{ width: columnWidths['start_date'] }}>
                                                            <Input type="date" className="h-7 text-xs bg-white px-1" value={val.start_date || ''} onChange={e => updateGridValue(acc.id, sIdx, 'start_date', e.target.value)} />
                                                        </td>
                                                        <td className="p-1 border-r" style={{ width: columnWidths['end_date'] }}>
                                                            <Input type="date" className="h-7 text-xs bg-white px-1" value={val.end_date || ''} onChange={e => updateGridValue(acc.id, sIdx, 'end_date', e.target.value)} />
                                                        </td>
                                                        <td className="p-1 border-r w-12" style={{ width: columnWidths['period'] }}>
                                                            <Input type="number" className="h-7 text-xs bg-white px-1" placeholder="개월" value={val.period_months !== undefined ? val.period_months : (item.period || '')} onChange={e => updateGridValue(acc.id, sIdx, 'period_months', parseInt(e.target.value) || 0)} />
                                                        </td>
                                                        <td className="p-1 border-r w-16" style={{ width: columnWidths['amount'] || 80 }}>
                                                            <Input type="number" className="h-7 text-xs bg-white px-1" placeholder="금액" value={val.amount || ''} onChange={e => updateGridValue(acc.id, sIdx, 'amount', parseInt(e.target.value) || 0)} />
                                                        </td>
                                                    </>
                                                ) : isEmpty ? (
                                                    <>
                                                        <td className="p-2 border-r bg-green-100/50" style={{ width: columnWidths['tidal_id'] }}></td>

                                                        <td className="p-2 border-r bg-green-100/50" style={{ width: columnWidths['buyer_name'] }}></td>
                                                        <td className="p-2 border-r bg-green-100/50" style={{ width: columnWidths['buyer_email'] }}></td>
                                                        <td className="p-2 border-r bg-green-100/50" style={{ width: columnWidths['buyer_phone'] }}></td>

                                                        <td className="p-2 border-r bg-green-100/50" style={{ width: columnWidths['start_date'] }}></td>
                                                        <td className="p-2 border-r bg-green-100/50" style={{ width: columnWidths['end_date'] }}></td>
                                                        <td className="p-2 border-r bg-green-100/50" style={{ width: columnWidths['period'] }}></td>
                                                        <td className="p-2 border-r bg-green-100/50" style={{ width: columnWidths['amount'] }}></td>
                                                    </>
                                                ) : (
                                                    <>
                                                        <td className="p-2 border-r truncate max-w-[120px]" title={assignment.tidal_id || undefined} style={{ width: columnWidths['tidal_id'] }}>
                                                            <span className={pendingDeleteIds.has(assignment.id) ? "text-red-500 font-bold" : ""}>{assignment.tidal_id || '-'}</span>
                                                        </td>

                                                        <td className="p-2 border-r truncate max-w-[80px]" title={assignment.buyer_name || assignment.orders?.buyer_name || undefined} style={{ width: columnWidths['buyer_name'] }}>
                                                            <span className={pendingDeleteIds.has(assignment.id) ? "text-red-500 font-bold" : ""}>{assignment.buyer_name || assignment.orders?.buyer_name || '-'}</span>
                                                        </td>
                                                        <td className="p-2 border-r truncate max-w-[120px]" title={assignment.buyer_email || assignment.orders?.buyer_email || undefined} style={{ width: columnWidths['buyer_email'] }}>
                                                            {assignment.buyer_email || assignment.orders?.buyer_email || '-'}
                                                        </td>
                                                        <td className="p-2 border-r truncate max-w-[100px]" title={assignment.buyer_phone || assignment.orders?.buyer_phone || undefined} style={{ width: columnWidths['buyer_phone'] }}>
                                                            {assignment.buyer_phone || assignment.orders?.buyer_phone || '-'}
                                                        </td>

                                                        <td className="p-2 text-center border-r font-mono" style={{ width: columnWidths['start_date'] }}>{assignment.start_date ? format(parseISO(assignment.start_date), 'yy-MM-dd') : '-'}</td>
                                                        <td className="p-2 text-center border-r font-mono" style={{ width: columnWidths['end_date'] }}>
                                                            <span className={isExpired ? "text-red-600 font-bold" : ""}>
                                                                {assignment.end_date ? format(parseISO(assignment.end_date), 'yy-MM-dd') : '-'}
                                                            </span>
                                                        </td>
                                                        <td className="p-2 text-center border-r font-mono" style={{ width: columnWidths['period'] }}>{item.period}</td>
                                                        <td className="p-2 text-right border-r font-mono" style={{ width: columnWidths['amount'] || 80 }}>{val.amount ? val.amount.toLocaleString() : '-'}</td>
                                                        <td className="p-2 text-left border-r truncate max-w-[400px] text-xs" title={val.memo || undefined} style={{ width: columnWidths['memo_col'] }}>
                                                            <span className="text-gray-500">{val.memo?.split('\n')[0] || '-'}</span>
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
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden">
                        <div className="overflow-x-auto">
                            <div className="grid grid-cols-13 gap-4 p-4 bg-gray-50 font-bold border-b text-base min-w-[1200px]">
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
                                let sortedAssignments: Assignment[] = [];
                                
                                if (showDeletedOnly) {
                                    // List ALL deleted assignments for this account
                                    sortedAssignments = (acc.order_accounts || []).filter(oa => oa.is_deleted);
                                    if (sortedAssignments.length === 0) return null;
                                } else {
                                    const paddedAssignments: Assignment[] = [];
                                    for (let i = 0; i < acc.max_slots; i++) {
                                        const existing = acc.order_accounts?.find(oa => oa.slot_number === i && !oa.is_deleted);
                                        if (existing) {
                                            paddedAssignments.push(existing);
                                        } else {
                                            paddedAssignments.push({
                                                id: `empty_${acc.id}_${i}`,
                                                slot_number: i,
                                                type: i === 0 ? 'master' : 'user',
                                                account_id: acc.id,
                                                is_active: true,
                                                tidal_id: undefined,
                                                tidal_password: undefined,
                                                buyer_name: undefined,
                                                buyer_email: undefined,
                                                buyer_phone: undefined,
                                                order_number: undefined,
                                                start_date: undefined,
                                                end_date: undefined
                                            });
                                        }
                                    }

                                    sortedAssignments = paddedAssignments.sort((a, b) => {
                                        if (a.type === 'master' && b.type !== 'master') return -1;
                                        if (b.type === 'master' && a.type !== 'master') return 1;
                                        return (a.slot_number || 0) - (b.slot_number || 0);
                                    });
                                }

                                // --- Deleted Filter Functionality ---
                                if (showDeletedOnly) {
                                    sortedAssignments = sortedAssignments.filter(assignment => !assignment.id.startsWith('empty_'));
                                    // If no deleted assignments in this account, hide the account row
                                    if (sortedAssignments.length === 0) return null;
                                }

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
                                        const diff = Math.floor(differenceInDays(now, start) / 30);
                                        duration = `${diff}개월`;
                                    } catch { }
                                }

                                return (
                                    <div key={acc.id} id={`account-${acc.id}`} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                                        <div className="grid grid-cols-13 gap-4 p-4 items-center text-base">
                                            <div className="col-span-1 text-gray-700 font-medium cursor-pointer truncate" title={acc.login_id} onClick={() => toggleRow(acc.id)}>
                                                {acc.login_id}
                                            </div>
                                            <div className="col-span-2 truncate cursor-pointer flex items-center" title={acc.payment_email} onClick={() => toggleRow(acc.id)}>
                                                <span className="text-blue-600 font-semibold text-base truncate">{acc.payment_email}</span>
                                            </div>
                                            <div className="col-span-1 text-center text-gray-400 font-mono cursor-pointer" onClick={() => toggleRow(acc.id)}>
                                                {acc.payment_day}일
                                            </div>
                                            <div className="col-span-1 text-gray-500 text-xs text-left truncate cursor-pointer" title={acc.memo} onClick={() => toggleRow(acc.id)}>
                                                {acc.memo}
                                            </div>
                                            <div className="col-span-2 text-gray-700 text-sm truncate cursor-pointer" title={tidalId} onClick={() => toggleRow(acc.id)}>
                                                {tidalId}
                                            </div>
                                            <div className={`col-span-2 font-mono text-sm cursor-pointer ${isWarning ? 'text-red-600 font-bold' : 'text-gray-900'}`} onClick={() => toggleRow(acc.id)}>
                                                {endDate}
                                            </div>
                                            <div className="col-span-1 text-gray-500 font-mono text-sm cursor-pointer" onClick={() => toggleRow(acc.id)}>
                                                {duration}
                                            </div>

                                            <div className="col-span-1 text-center cursor-pointer" onClick={() => toggleRow(acc.id)}>
                                                <span className={`px-2 py-1 rounded-full text-sm font-bold ${(acc.order_accounts?.length || 0) >= 6 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
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
                                                    return (
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
                                                                {sortedAssignments.map((assignment) => {
                                                                    const sIdx = assignment.slot_number;
                                                                    const key = `${acc.id}_${sIdx}`;
                                                                    const val = gridValues[key] || {}; // Current Input Values
                                                                    const isEditing = editingSlots[key];
                                                                    const isActive = assignment.is_active !== false;
                                                                    // Period Calc for display
                                                                    let period = '-';
                                                                    let isExpired = false;
                                                                    if (val.start_date && val.end_date) {
                                                                        try {
                                                                            const start = parseISO(val.start_date);
                                                                            const end = parseISO(val.end_date);
                                                                            const days = differenceInDays(end, start);
                                                                            const diff = Math.floor(days / 30);
                                                                            if (diff > 0) period = `${diff}개월`;

                                                                            // Check expiry
                                                                            const today = new Date();
                                                                            today.setHours(0, 0, 0, 0);
                                                                            if (end < today) isExpired = true;
                                                                        } catch { }
                                                                    }

                                                                    const isEmpty = assignment.id.startsWith('empty_');

                                                                    return (
                                                                        <tr key={assignment.id} className={`border-b last:border-0 h-10 hover:bg-gray-50 ${!isActive ? 'bg-red-50 text-red-600' : ''}`}>
                                                                            <td className="text-center text-[10px] font-bold">
                                                                                <span className={!isActive ? 'text-red-700 font-bold' : isEmpty ? "text-green-700" : "text-gray-900"}>
                                                                                    {acc.login_id}-{assignment.slot_number + 1}
                                                                                </span>
                                                                            </td>

                                                                            {isEditing ? (
                                                                                <>
                                                                                    <td className="px-1">
                                                                                        <Select value={val.type || 'user'} onValueChange={(value) => updateGridValue(acc.id, sIdx, 'type', value)}>
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
                                                                                    <td className="px-1">
                                                                                        <Input type="date" className="h-8 text-xs bg-white px-1" value={val.end_date || ''} onChange={e => updateGridValue(acc.id, sIdx, 'end_date', e.target.value)} />
                                                                                    </td>
                                                                                    <td className="px-1 w-12">
                                                                                        <Input type="number" className="h-8 text-xs bg-white px-1" placeholder="개월" value={val.period_months || ''} onChange={e => updateGridValue(acc.id, sIdx, 'period_months', parseInt(e.target.value) || 0)} />
                                                                                    </td>
                                                                                    <td className="px-1 w-20">
                                                                                        <Input type="number" className="h-8 text-xs bg-white px-1" placeholder="금액" value={val.amount || ''} onChange={e => updateGridValue(acc.id, sIdx, 'amount', parseInt(e.target.value) || 0)} />
                                                                                    </td>
                                                                                </>
                                                                            ) : isEmpty ? (
                                                                                <>
                                                                                    <td colSpan={9} className="bg-green-100/50"></td>
                                                                                </>
                                                                            ) : (
                                                                                <>
                                                                                    <td className="px-2 text-center">
                                                                                        <div className="flex items-center justify-center gap-1">
                                                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${val.type === 'master' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                                                                                {val.type === 'master' ? 'Master' : 'User'}
                                                                                            </span>
                                                                                            <MessageSquareText
                                                                                                size={14}
                                                                                                className={`cursor-pointer ${val.memo ? 'text-blue-500 fill-blue-50' : 'text-gray-300 hover:text-gray-500'}`}
                                                                                                onClick={() => openMemoModal(acc.id, sIdx, val.memo || '', assignment.id)}
                                                                                            />
                                                                                        </div>
                                                                                    </td>
                                                                                    <td className="px-2 text-gray-700 truncate max-w-[120px]" title={val.tidal_id || undefined}>{val.tidal_id || '-'}</td>
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
                                                                                    <td className="text-center text-gray-500 font-mono">{period}</td>
                                                                                    <td className="text-right text-gray-700 font-mono px-2">
                                                                                        {val.amount ? val.amount.toLocaleString() : '-'}
                                                                                    </td>
                                                                                </>
                                                                            )}

                                                                            <td className="px-1 text-center">
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
                                                                                    ) : assignment.is_deleted ? (
                                                                                        <div className="flex gap-1">
                                                                                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-green-600 hover:text-green-700" title="삭제 데이터 복구" onClick={() => handleRestore(assignment.id)}>
                                                                                                <ArrowRightLeft size={14} />
                                                                                            </Button>
                                                                                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-600 hover:text-red-700" title="완전히 삭제" onClick={() => handlePermanentDelete(assignment.id)}>
                                                                                                <Trash2 size={14} />
                                                                                            </Button>
                                                                                        </div>
                                                                                    ) : isEmpty ? (
                                                                                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-blue-600" title="배정" onClick={() => openAssignModal(acc, assignment.slot_number)}>
                                                                                            <Plus size={14} />
                                                                                        </Button>
                                                                                    ) : (
                                                                                        <>
                                                                                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-blue-600" title="수정" onClick={() => startEdit(acc.id, assignment.slot_number)}>
                                                                                                <Pencil size={14} />
                                                                                            </Button>
                                                                                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-blue-600" title="이동" onClick={() => openMoveModal(assignment)}>
                                                                                                <ArrowRightLeft size={14} />
                                                                                            </Button>
                                                                                            <Button 
                                                                                                size="sm" 
                                                                                                variant="ghost" 
                                                                                                className={`h-7 w-7 p-0 ${!isActive ? 'text-blue-600 hover:text-blue-700' : 'text-gray-400 hover:text-orange-600'}`} 
                                                                                                title={!isActive ? "복구" : "종료"} 
                                                                                                onClick={() => handleToggleActive(assignment.id, assignment.is_active)}
                                                                                            >
                                                                                                <PowerOff size={14} />
                                                                                            </Button>
                                                                                            {(isExpired || !isActive) && (
                                                                                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-red-600" title="삭제 (배정해제)" onClick={() => handleDelete(assignment.id)}>
                                                                                                    <Trash2 size={14} />
                                                                                                </Button>
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
                                                    );
                                                })()}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                    </div>
                    </div>
                )}

                {/* Deleted Groups Section */}
                    {showDeletedOnly && (
                        <div className="mt-8">
                            <h3 className="text-sm font-bold text-red-600 mb-3 flex items-center gap-2">
                                <Trash2 size={14} /> 삭제된 그룹
                            </h3>
                            {accounts.filter(acc => (acc as unknown as { status?: string }).status === 'deleted').length === 0 ? (
                                <p className="text-xs text-gray-400 text-center py-6">삭제된 그룹이 없습니다.</p>
                            ) : (
                                <div className="bg-white rounded-xl border border-red-100 overflow-hidden">
                                    <table className="w-full text-xs min-w-[600px]">
                                        <thead>
                                            <tr className="bg-red-50 border-b text-gray-500">
                                                <th className="p-3 text-left">그룹 ID</th>
                                                <th className="p-3 text-left">결제 계정</th>
                                                <th className="p-3 text-center">결제일</th>
                                                <th className="p-3 text-left">메모</th>
                                                <th className="p-3 text-center">관리</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {accounts
                                                .filter(acc => (acc as unknown as { status?: string }).status === 'deleted')
                                                .map(acc => (
                                                    <tr key={acc.id} className="hover:bg-red-50/30">
                                                        <td className="p-3 font-bold text-red-700">{acc.login_id}</td>
                                                        <td className="p-3 text-gray-500">{(acc as unknown as { payment_email?: string }).payment_email || '-'}</td>
                                                        <td className="p-3 text-gray-500 text-center">{(acc as unknown as { payment_day?: number }).payment_day || '-'}</td>
                                                        <td className="p-3 text-gray-400">{acc.memo || '-'}</td>
                                                        <td className="p-3 text-center flex items-center gap-1 justify-center">
                                                            <Button
                                                                size="sm" variant="ghost"
                                                                className="h-7 px-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 text-xs"
                                                                onClick={() => {
                                                                    setEditDeletedGroup(acc);
                                                                    setEditDeletedGroupForm({
                                                                        login_id: acc.login_id || '',
                                                                        payment_email: (acc as unknown as { payment_email?: string }).payment_email || '',
                                                                        payment_day: (acc as unknown as { payment_day?: number }).payment_day || 1,
                                                                        memo: acc.memo || '',
                                                                    });
                                                                    setIsEditDeletedGroupOpen(true);
                                                                }}
                                                            >
                                                                수정
                                                            </Button>
                                                            <Button
                                                                size="sm" variant="ghost"
                                                                className="h-7 px-2 text-green-600 hover:text-green-800 hover:bg-green-50 text-xs"
                                                                onClick={() => handleRestoreDeletedGroup(acc)}
                                                            >
                                                                재등록
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
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

            {/* Edit Deleted Group Modal */}
            <Dialog open={isEditDeletedGroupOpen} onOpenChange={setIsEditDeletedGroupOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>삭제된 그룹 수정</DialogTitle>
                        <DialogDescription className="text-xs text-gray-500">정보를 수정한 후 재등록 버튼으로 복원할 수 있습니다.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="del_login_id" className="text-right text-sm">그룹 ID <span className="text-red-500">*</span></Label>
                            <Input
                                id="del_login_id"
                                value={editDeletedGroupForm.login_id}
                                onChange={(e) => setEditDeletedGroupForm(f => ({ ...f, login_id: e.target.value }))}
                                className="col-span-3"
                                placeholder="예: TG003"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="del_payment_email" className="text-right text-sm">결제 계정</Label>
                            <Input
                                id="del_payment_email"
                                value={editDeletedGroupForm.payment_email}
                                onChange={(e) => setEditDeletedGroupForm(f => ({ ...f, payment_email: e.target.value }))}
                                className="col-span-3"
                                placeholder="payment@email.com"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="del_payment_day" className="text-right text-sm">결제일</Label>
                            <Input
                                id="del_payment_day"
                                type="number" min="1" max="31"
                                value={editDeletedGroupForm.payment_day}
                                onChange={(e) => setEditDeletedGroupForm(f => ({ ...f, payment_day: parseInt(e.target.value) || 1 }))}
                                className="col-span-3"
                                placeholder="1~31"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="del_memo" className="text-right text-sm">메모</Label>
                            <Input
                                id="del_memo"
                                value={editDeletedGroupForm.memo}
                                onChange={(e) => setEditDeletedGroupForm(f => ({ ...f, memo: e.target.value }))}
                                className="col-span-3"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditDeletedGroupOpen(false)}>취소</Button>
                        <Button variant="outline" className="text-green-700 border-green-300 hover:bg-green-50"
                            onClick={handleEditAndRestoreDeletedGroup}
                            disabled={!editDeletedGroupForm.login_id.trim()}
                        >수정 후 재등록</Button>
                        <Button onClick={handleEditDeletedGroup} disabled={!editDeletedGroupForm.login_id.trim()}>수정 완료</Button>
                    </DialogFooter>
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
                    <DialogHeader><DialogTitle>{selectedAssignment?.is_deleted ? '삭제 데이터 배정 복구' : '배정 이동'}</DialogTitle></DialogHeader>
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
                <DialogContent className="max-w-[640px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>만료 알림 메세지 발송 ({selectedAssignmentIds.size}명)</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <div className="flex-1">
                                <Select value={selectedTemplateKey} onValueChange={setSelectedTemplateKey}>
                                    <SelectTrigger className="h-10 border-slate-200">
                                        <SelectValue placeholder="템플릿 선택" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {emailTemplates.filter(t => !t.key.startsWith('LEGACY')).map(t => (
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
                            const sampleId = Array.from(selectedAssignmentIds)[0];
                            const sample = sampleId ? getFlattenedAssignments().find(a => a.id === sampleId) : null;
                            const buyerName = sample?.assignment.buyer_name || sample?.assignment.orders?.buyer_name || '홍길동';
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
                        <Button variant="outline" onClick={() => setIsNotifyModalOpen(false)}>취소</Button>
                        <Button onClick={handleBulkNotify} disabled={isSendingNotify} className="bg-orange-600 hover:bg-orange-700">
                            {isSendingNotify ? '발송 중...' : '메일 발송하기'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <EmailTemplateModal
                isOpen={isTemplateEditOpen}
                onClose={() => setIsTemplateEditOpen(false)}
                template={emailTemplates.find(t => t.key === selectedTemplateKey) as any ?? null}
                onSave={() => {
                    setIsTemplateEditOpen(false);
                    apiFetch('/api/admin/email-templates').then(res => {
                        if (res.ok) res.json().then((data: {id?: string, key: string, name: string, subject?: string, content?: string, design?: any, placeholders?: any[]}[]) => {
                            setEmailTemplates(data);
                        });
                    });
                }}
            />


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

            {/* Quick Edit Modal */}
            <Dialog open={isQuickEditModalOpen} onOpenChange={setIsQuickEditModalOpen}>
                <DialogContent 
                    className="max-w-[480px] w-[95vw] max-h-[90vh] overflow-y-auto rounded-[2.5rem] p-5 md:p-7"
                    onPointerDownOutside={(e) => e.preventDefault()}
                >
                    <DialogHeader className="pt-2">
                        <DialogTitle className="flex justify-between items-center text-xl font-bold py-1 border-b-0">
                            <div className="flex items-center gap-1.5 text-xl font-black">
                                <span>정보수정 / {accounts.find(a => a.id === quickEditAccountId)?.login_id}-{((quickEditSlotIdx as number) || 0) + 1}</span>
                                {quickEditValues?.order_number && (
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            if (quickEditValues.order_id) fetchOrderDetails(quickEditValues.order_id);
                                        }}
                                        className="text-xl text-blue-600 hover:text-blue-800 hover:underline flex items-center font-black bg-transparent border-0 p-0 ml-1"
                                    >
                                        / {quickEditValues.order_number}
                                    </button>
                                )}
                            </div>
                        </DialogTitle>
                    </DialogHeader>
                    <div className="py-2 space-y-4">
                        {/* Row 1: 이름, Tidal ID, PW */}
                        <div className="grid grid-cols-12 gap-3">
                            <div className="col-span-3 space-y-1">
                                <Label className="text-[11px] font-semibold text-gray-500 ml-1">이름</Label>
                                <Input 
                                    className="h-10 rounded-xl border-gray-200 focus:ring-1 focus:ring-blue-500 bg-white"
                                    value={quickEditValues?.buyer_name || ''} 
                                    onChange={(e) => setQuickEditValues(prev => prev ? { ...prev, buyer_name: e.target.value } : null)}
                                    placeholder="전성현"
                                />
                            </div>
                            <div className="col-span-6 space-y-1">
                                <Label className="text-[11px] font-semibold text-gray-500 ml-1">Tidal ID</Label>
                                <Input 
                                    className="h-10 rounded-xl border-gray-200 focus:ring-1 focus:ring-blue-500 bg-white"
                                    value={quickEditValues?.tidal_id || ''} 
                                    onChange={(e) => setQuickEditValues(prev => prev ? { ...prev, tidal_id: e.target.value } : null)}
                                    placeholder="sjeon2801@gmail.com"
                                />
                            </div>
                            <div className="col-span-3 space-y-1">
                                <Label className="text-[11px] font-semibold text-gray-500 ml-1">PW</Label>
                                <Input 
                                    className="h-10 rounded-xl border-gray-200 focus:ring-1 focus:ring-blue-500 bg-white"
                                    value={quickEditValues?.tidal_password || ''} 
                                    onChange={(e) => setQuickEditValues(prev => prev ? { ...prev, tidal_password: e.target.value } : null)}
                                    placeholder="135792"
                                />
                            </div>
                        </div>

                        {/* Row 2: 전화번호, 이메일 */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label className="text-[11px] font-semibold text-gray-500 ml-1">전화번호</Label>
                                <Input 
                                    className="h-10 rounded-xl border-gray-200 focus:ring-1 focus:ring-blue-500 bg-white"
                                    value={quickEditValues?.buyer_phone || ''} 
                                    onChange={(e) => setQuickEditValues(prev => prev ? { ...prev, buyer_phone: e.target.value } : null)}
                                    placeholder="010-2255-2288"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[11px] font-semibold text-gray-500 ml-1">이메일</Label>
                                <Input 
                                    className="h-10 rounded-xl border-gray-200 focus:ring-1 focus:ring-blue-500 bg-white"
                                    value={quickEditValues?.buyer_email || ''} 
                                    onChange={(e) => setQuickEditValues(prev => prev ? { ...prev, buyer_email: e.target.value } : null)}
                                    placeholder="jeon28@gmail.com"
                                />
                            </div>
                        </div>

                        {/* Row 3: 시작일, 종료일, 개월, 계약금액 */}
                        <div className="grid grid-cols-12 gap-3">
                            <div className="col-span-4 space-y-1">
                                <Label className="text-[11px] font-semibold text-gray-500 ml-1">시작일</Label>
                                <Input 
                                    type="date"
                                    className="h-10 rounded-xl border-gray-200 focus:ring-1 focus:ring-blue-500 bg-white"
                                    value={quickEditValues?.start_date || ''} 
                                    onChange={(e) => setQuickEditValues(prev => prev ? { ...prev, start_date: e.target.value } : null)}
                                />
                            </div>
                            <div className="col-span-4 space-y-1">
                                <Label className="text-[11px] font-semibold text-gray-500 ml-1">종료일</Label>
                                <Input 
                                    type="date"
                                    className="h-10 rounded-xl border-gray-200 focus:ring-1 focus:ring-blue-500 bg-white"
                                    value={quickEditValues?.end_date || ''} 
                                    onChange={(e) => setQuickEditValues(prev => prev ? { ...prev, end_date: e.target.value } : null)}
                                />
                            </div>
                            <div className="col-span-2 space-y-1">
                                <Label className="text-[11px] font-semibold text-gray-500 ml-1 text-center truncate">개월</Label>
                                <Input 
                                    type="number"
                                    className="h-10 rounded-xl border-gray-200 focus:ring-1 focus:ring-blue-500 bg-white text-center px-1"
                                    value={quickEditValues?.period_months || 0} 
                                    onChange={(e) => {
                                        const nextM = parseInt(e.target.value) || 0;
                                        const initialM = initialQuickEditValues?.period_months || 0;
                                        const initialEnd = initialQuickEditValues?.end_date;

                                        setQuickEditValues(prev => {
                                            if (!prev) return null;
                                            let ne = prev.end_date;
                                            if (initialEnd) {
                                                try {
                                                    // [개선안] 항상 최초 종료일(initialEnd)을 기준으로 계산
                                                    ne = format(addDays(parseISO(initialEnd), (nextM - initialM) * 30), 'yyyy-MM-dd');
                                                } catch { }
                                            } else if (prev.start_date) {
                                                try {
                                                    ne = format(addDays(parseISO(prev.start_date), nextM * 30), 'yyyy-MM-dd');
                                                } catch { }
                                            }
                                            return { ...prev, period_months: nextM, end_date: ne };
                                        });
                                    }}
                                />
                            </div>
                            <div className="col-span-2 space-y-1">
                                <Label className="text-[11px] font-semibold text-gray-500 ml-1 text-center truncate">금액</Label>
                                <Input 
                                    className="h-10 rounded-xl border-gray-200 focus:ring-1 focus:ring-blue-500 bg-white text-right px-2"
                                    value={quickEditValues?.amount?.toLocaleString() || '0'} 
                                    onChange={(e) => setQuickEditValues(prev => prev ? { ...prev, amount: parseInt(e.target.value.replace(/,/g, '')) || 0 } : null)}
                                />
                            </div>
                        </div>

                        {/* Row 4: 메모 */}
                        <div className="space-y-1">
                            <Label className="text-[11px] font-semibold text-gray-500 ml-1">메모</Label>
                            <textarea 
                                className="w-full min-h-[90px] p-3 border border-gray-200 rounded-2xl focus:ring-1 focus:ring-blue-500 outline-none text-sm bg-white shadow-sm"
                                value={quickEditValues?.memo || ''} 
                                onChange={(e) => setQuickEditValues(prev => prev ? { ...prev, memo: e.target.value } : null)}
                                placeholder="메모할 내용을 입력하세요"
                            />
                        </div>
                    </div>
                    <DialogFooter className="gap-2 sm:gap-2 pt-3 border-t-0 flex-row justify-end">
                        <Button variant="outline" onClick={() => setIsQuickEditModalOpen(false)} className="h-11 px-8 rounded-xl font-semibold border-gray-200 hover:bg-gray-50">취소</Button>
                        <Button onClick={handleSaveQuickEdit} className="bg-blue-600 hover:bg-blue-700 h-11 px-10 rounded-xl font-bold shadow-lg shadow-blue-200">저장</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Order Detail Modal */}
            <Dialog open={isOrderDetailModalOpen} onOpenChange={setIsOrderDetailModalOpen}>
                <DialogContent className="sm:max-w-md rounded-3xl p-6">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold border-b pb-4">주문 상세 내역</DialogTitle>
                    </DialogHeader>
                    {selectedOrderDetails ? (
                        <div className="py-4 space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div className="space-y-1">
                                    <p className="text-gray-500 font-medium">주문번호</p>
                                    <p className="text-blue-600 font-bold">{selectedOrderDetails.order_number}</p>
                                </div>
                                <div className="space-y-1 text-right">
                                    <p className="text-gray-500 font-medium">주문일시</p>
                                    <p>{format(parseISO(selectedOrderDetails.created_at), 'yyyy-MM-dd HH:mm')}</p>
                                </div>
                            </div>
                            
                            <div className="p-4 bg-gray-50 rounded-2xl space-y-3">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-500">신청인(입금자)</span>
                                    <span className="font-bold">{selectedOrderDetails.buyer_name}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-500">연락처</span>
                                    <span>{selectedOrderDetails.buyer_phone}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-500">이메일</span>
                                    <span>{selectedOrderDetails.buyer_email}</span>
                                </div>
                            </div>

                            <div className="space-y-3 pt-2">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-500 font-medium">상세 상품명</span>
                                    <span className="font-bold">{selectedOrderDetails.products?.name}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-500 font-medium">결제 금액</span>
                                    <span className="text-lg font-black text-blue-600">
                                        {selectedOrderDetails.amount?.toLocaleString()}원
                                    </span>
                                </div>
                            </div>

                            <div className="pt-4 flex justify-center">
                                <Button 
                                    onClick={() => setIsOrderDetailModalOpen(false)}
                                    className="w-full h-12 rounded-xl bg-gray-900 hover:bg-black font-bold"
                                >
                                    닫기
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="py-10 text-center">
                            <p className="text-gray-500">주문 내역을 불러오고 있습니다...</p>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
            {/* Excel Actions (Responsive) */}
            <div className="fixed bottom-6 right-6 flex flex-col sm:flex-row gap-3 z-40 pointer-events-none">
                <div className="flex gap-2 pointer-events-auto">
                    <div className="relative">
                        <input
                            id="excel-import"
                            type="file"
                            accept=".xlsx, .xls"
                            className="hidden"
                            onChange={handleImportExcel}
                        />
                        <Button
                            variant="secondary"
                            onClick={() => document.getElementById('excel-import')?.click()}
                            className="bg-green-600 hover:bg-green-700 text-white shadow-xl h-12 px-6 rounded-full gap-2 transition-transform hover:scale-105"
                        >
                            <Upload className="w-5 h-5" />
                            <span className="font-bold">엑셀 가져오기</span>
                        </Button>
                    </div>
                    <Button
                        variant="secondary"
                        onClick={exportToExcel}
                        className="bg-blue-600 hover:bg-blue-700 text-white shadow-xl h-12 px-6 rounded-full gap-2 transition-transform hover:scale-105"
                    >
                        <Download className="w-5 h-5" />
                        <span className="font-bold">엑셀 내보내기</span>
                    </Button>
                </div>
            </div>
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
