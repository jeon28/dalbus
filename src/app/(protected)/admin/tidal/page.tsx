"use client";

import React, { useEffect, useState, Suspense } from 'react';
import { useServices } from '@/lib/ServiceContext';
import styles from '../admin.module.css';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, ChevronDown, ChevronUp, Trash2, ArrowRightLeft, Save, Download, Pencil, Upload, LayoutGrid, List, History, PowerOff, Filter } from 'lucide-react';
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
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [isGridView, setIsGridView] = useState(true);

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

    // Order Data
    const [pendingOrders, setPendingOrders] = useState<Order[]>([]);

    // Move Data
    const [moveTargets, setMoveTargets] = useState<Account[]>([]);
    const [selectedTargetAccount, setSelectedTargetAccount] = useState<string>('');
    const [selectedTargetSlot, setSelectedTargetSlot] = useState<number | null>(null);

    // Filter & Search State
    const [showExpiredOnly, setShowExpiredOnly] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Sorting State for Grid View
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    // Forms
    const [newAccount, setNewAccount] = useState({
        login_id: '',
        login_pw: '', // Will stay empty as per user request
        payment_email: '',
        payment_day: 1,
        memo: '',
        product_id: '',
        max_slots: 6
    });

    const [editingAccount, setEditingAccount] = useState<Account | null>(null);

    const [slotPasswordModal, setSlotPasswordModal] = useState('');

    const generateTidalPassword = () => {
        const chars = "abcdefghijklmnopqrstuvwxyz";
        const upperChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        const numbers = "0123456789";
        const special = "!@$";

        let pass = "";
        pass += upperChars.charAt(Math.floor(Math.random() * upperChars.length));
        pass += chars.charAt(Math.floor(Math.random() * chars.length));
        pass += numbers.charAt(Math.floor(Math.random() * numbers.length));
        pass += special.charAt(Math.floor(Math.random() * special.length));

        const allChars = chars + upperChars + numbers + special;
        for (let i = 0; i < 4; i++) {
            pass += allChars.charAt(Math.floor(Math.random() * allChars.length));
        }

        // Shuffle
        return pass.split('').sort(() => 0.5 - Math.random()).join('');
    };

    useEffect(() => {
        if (isHydrated && !isAdmin) {
            router.push('/admin');
        } else if (isHydrated && isAdmin) {
            fetchAccounts();
            fetchPendingOrders();
        }
    }, [isAdmin, isHydrated, router]);

    // URL에서 accountId 읽어서 해당 계정 자동 expand
    useEffect(() => {
        const accountId = searchParams.get('accountId');
        if (accountId && accounts.length > 0) {
            console.log('Detected accountId in URL, expanding group:', accountId);
            // 해당 계정을 expandedRows에 추가
            setExpandedRows(prev => {
                const newSet = new Set(prev);
                newSet.add(accountId);
                return newSet;
            });

            // 해당 계정으로 스크롤 및 하이라이트
            const scrollToAndHighlight = () => {
                const element = document.getElementById(`account-${accountId}`);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    // 하이라이트 효과
                    element.style.transition = 'background-color 0.5s ease-in-out';
                    element.style.backgroundColor = '#e0f2fe'; // blue-100

                    setTimeout(() => {
                        element.style.backgroundColor = '';
                    }, 3000);
                } else {
                    // If element not found yet, retry once
                    setTimeout(scrollToAndHighlight, 500);
                }
            };

            setTimeout(scrollToAndHighlight, 500);
        }
    }, [searchParams, accounts]);

    // Filter Effect: Auto-expand when filter is enabled
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
                if (hasExpired) {
                    newExpanded.add(acc.id);
                }
            });
            setExpandedRows(newExpanded);
        }
    }, [showExpiredOnly, accounts]);

    const fetchAccounts = async () => {

        try {
            const res = await fetch('/api/admin/accounts', { cache: 'no-store' });
            if (!res.ok) throw new Error('Failed to fetch accounts');
            const data = await res.json();
            setAccounts(data);

            // Initialize Grid Values from fetched data
            const initialGrid: Record<string, GridValue> = {};
            data.forEach((acc: Account) => {
                for (let i = 0; i < acc.max_slots; i++) {
                    const assignment = acc.order_accounts?.find((oa: Assignment) => oa.slot_number === i);
                    // For Slot 1 (i===0), default to Master Password if no specific slot password exists
                    let defaultPw = assignment?.tidal_password || '';
                    if (i === 0 && !defaultPw) {
                        defaultPw = acc.login_pw;
                    }

                    initialGrid[`${acc.id}_${i}`] = {
                        assignment_id: assignment?.id,
                        tidal_id: assignment?.tidal_id ?? null,
                        tidal_password: defaultPw,
                        // Prefer buyer info from order_accounts, fallback to orders table
                        buyer_name: assignment?.buyer_name || assignment?.orders?.buyer_name || assignment?.orders?.profiles?.name || '',
                        buyer_phone: assignment?.buyer_phone || assignment?.orders?.buyer_phone || assignment?.orders?.profiles?.phone || '',
                        buyer_email: assignment?.buyer_email || assignment?.orders?.buyer_email || '',
                        start_date: assignment?.start_date || '',
                        end_date: assignment?.end_date || '',
                        order_number: assignment?.order_number || assignment?.orders?.order_number || '',
                        type: assignment?.type || (i === 0 ? 'master' : 'user'), // Slot 1 defaults to master, others to user
                        period_months: assignment?.period_months || 0,
                    };
                }
            });
            setGridValues(initialGrid);

        } catch (error) {
            const err = error as Error;
            if (err.name === 'AbortError' || err.message?.includes('aborted') || err.message?.includes('signal is aborted')) {
                return;
            }
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
            const err = error as Error;
            if (err.name === 'AbortError' || err.message?.includes('aborted') || err.message?.includes('signal is aborted')) {
                return;
            }
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
        setGridValues(prev => {
            const current = prev[key] || {};
            const next = { ...current, [field]: value };

            // Auto-generate Tidal ID when Email is changed
            if (field === 'buyer_email' && typeof value === 'string') {
                const emailPrefix = value.split('@')[0];
                if (emailPrefix) {
                    next.tidal_id = `${emailPrefix}@hifitidal.com`;
                } else {
                    next.tidal_id = null;
                }
            }

            // Auto-calculate end_date if start_date and period_months exist
            if ((field === 'start_date' || field === 'period_months') && (next.start_date && next.period_months)) {
                try {
                    const start = parseISO(next.start_date);
                    const months = parseInt(String(next.period_months)) || 0;
                    if (months > 0) {
                        const end = new Date(start);
                        end.setMonth(end.getMonth() + months);
                        next.end_date = end.toISOString().split('T')[0];
                    }
                } catch (err) {
                    console.error('Date calculation error:', err);
                }
            }

            return {
                ...prev,
                [key]: next
            };
        });
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
                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Update failed');
                }
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
                        order_id: data.order_id,
                        order_number: data.order_number,
                        slot_number: slotIdx,
                        tidal_password: data.tidal_password,
                        tidal_id: data.tidal_id || null,
                        type: data.type,
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
        } catch (e: unknown) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            if (!errorMsg.includes('이미 사용 중인 Tidal ID')) {
                console.error('Save row error:', e);
            }
            alert('저장 실패: ' + errorMsg);
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
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : '삭제 중 오류가 발생했습니다.';
            alert('삭제 실패: ' + message);
        }
    };

    const handleDeactivate = async (assignmentId: string) => {
        if (!confirm('해당 배정을 종료(비활성화)하시겠습니까?\n비활성화된 배정은 "지난 내역" 메뉴에서 확인할 수 있습니다.')) return;
        try {
            const res = await fetch(`/api/admin/assignments/${assignmentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_active: false })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Deactivation failed');
            }

            alert('비활성화 되었습니다.');
            fetchAccounts();
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : '오류가 발생했습니다.';
            alert('비활성화 실패: ' + message);
        }
    };

    const handleCreateAccount = async () => {
        // 1. Validate required fields
        if (!newAccount.login_id || !newAccount.login_id.trim()) {
            alert('❌ 그룹 ID는 필수 입력 항목입니다.');
            return;
        }

        if (!newAccount.payment_email || !newAccount.payment_email.trim()) {
            alert('❌ 결제 계정은 필수 입력 항목입니다.');
            return;
        }

        if (!newAccount.payment_day || newAccount.payment_day < 1 || newAccount.payment_day > 31) {
            alert('❌ 결제일은 1~31 사이의 값이어야 합니다.');
            return;
        }

        // 2. Check if payment_email already exists in another group
        const duplicateGroup = accounts.find(acc =>
            acc.payment_email === newAccount.payment_email.trim()
        );

        if (duplicateGroup) {
            alert(`❌ 결제 계정 중복\n\n결제 계정 '${newAccount.payment_email}'은(는) 이미 다른 그룹에서 사용 중입니다.\n\n【사용 중인 그룹】\n그룹 ID: ${duplicateGroup.login_id}\n\n※ 결제 계정은 한 개의 그룹에만 할당할 수 있습니다.`);
            return;
        }

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

            alert('✅ 그룹이 생성되었습니다.');
            setIsAddModalOpen(false);
            fetchAccounts();
            setNewAccount({ login_id: '', login_pw: '', payment_email: '', payment_day: 1, memo: '', product_id: '', max_slots: 6 });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : '그룹 생성 중 오류가 발생했습니다.';
            alert('❌ 그룹 생성 실패: ' + message);
        }
    };

    const handleEditMasterAccount = (account: Account) => {
        setEditingAccount(account);
        setIsEditModalOpen(true);
    };

    const handleUpdateMasterAccount = async () => {
        if (!editingAccount) return;

        // 1. Validate required fields
        if (!editingAccount.login_id || !editingAccount.login_id.trim()) {
            alert('❌ 그룹 ID는 필수 입력 항목입니다.');
            return;
        }

        if (!editingAccount.payment_email || !editingAccount.payment_email.trim()) {
            alert('❌ 결제 계정은 필수 입력 항목입니다.');
            return;
        }

        if (!editingAccount.payment_day || editingAccount.payment_day < 1 || editingAccount.payment_day > 31) {
            alert('❌ 결제일은 1~31 사이의 값이어야 합니다.');
            return;
        }

        // 2. Check if payment_email already exists in another group (excluding current group)
        const duplicateGroup = accounts.find(acc =>
            acc.payment_email === editingAccount.payment_email.trim() &&
            acc.id !== editingAccount.id // Exclude current group being edited
        );

        if (duplicateGroup) {
            alert(`❌ 결제 계정 중복\n\n결제 계정 '${editingAccount.payment_email}'은(는) 이미 다른 그룹에서 사용 중입니다.\n\n【사용 중인 그룹】\n그룹 ID: ${duplicateGroup.login_id}\n\n※ 결제 계정은 한 개의 그룹에만 할당할 수 있습니다.`);
            return;
        }

        try {
            const res = await fetch(`/api/admin/accounts/${editingAccount.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    login_id: editingAccount.login_id,
                    payment_email: editingAccount.payment_email,
                    payment_day: editingAccount.payment_day,
                    memo: editingAccount.memo
                })
            });

            if (!res.ok) throw new Error('Failed to update account');

            setIsEditModalOpen(false);
            fetchAccounts();
            alert('✅ 수정되었습니다.');
        } catch (error) {
            console.error(error);
            alert('❌ 수정 실패');
        }
    };

    const handleDeleteMasterAccount = async (account: Account) => {
        if ((account.order_accounts?.length || 0) > 0) {
            alert('슬롯이 배정되어 있는 그룹은 삭제할 수 없습니다. 먼저 배정을 해제해 주세요.');
            return;
        }

        if (!confirm(`'${account.login_id}' 그룹을 삭제하시겠습니까?`)) return;

        try {
            const res = await fetch(`/api/admin/accounts/${account.id}`, {
                method: 'DELETE'
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || '삭제 실패');
            }

            fetchAccounts();
            alert('삭제되었습니다.');
        } catch (error) {
            const e = error as Error;
            alert(e.message);
        }
    };

    const exportToExcel = () => {
        interface ExcelRow {
            'No.': string | number;
            '그룹 ID': string;
            '결제 계정': string;
            '결제일': string;
            '메모': string;
            'Slot': string;
            '고객명': string;
            '전화번호': string;
            '주문번호': string;
            '소속 ID': string;
            '소속 PW': string;
            '시작일': string;
            '종료일': string;
            '개월': string | number;
        }
        const excelData: ExcelRow[] = [];

        if (isGridView) {
            // Export flat data equivalent to Grid View
            const flatData = getFlatAssignments();
            flatData.forEach((item, idx) => {
                const val = gridValues[`${item.accountId}_${item.slotIdx}`] || {};
                excelData.push({
                    'No.': idx + 1,
                    '그룹 ID': item.accountLoginId,
                    '결제 계정': item.accountPaymentEmail,
                    '결제일': `${item.accountPaymentDay}일`,
                    '메모': item.accountMemo ?? '',
                    'Slot': `Slot ${item.slotIdx + 1}`,
                    '고객명': val.buyer_name || '',
                    '전화번호': val.buyer_phone || '',
                    '주문번호': val.order_number || '',
                    '소속 ID': val.tidal_id || '',
                    '소속 PW': val.tidal_password || '',
                    '시작일': val.start_date || '',
                    '종료일': val.end_date || '',
                    '개월': getPeriodMonths(val.start_date, val.end_date)
                });
            });
        } else {
            // Keep existing grouped format for List View
            const query = searchQuery.toLowerCase().trim();
            accounts
                .filter(acc => {
                    if (!query) return true;
                    if (acc.login_id.toLowerCase().includes(query) || acc.payment_email.toLowerCase().includes(query)) return true;
                    return acc.order_accounts?.some(oa => {
                        const tidalId = (oa.tidal_id || '').toLowerCase();
                        const buyerName = (oa.buyer_name || oa.orders?.buyer_name || '').toLowerCase();
                        const phone = (oa.buyer_phone || oa.orders?.buyer_phone || '').toLowerCase();
                        return tidalId.includes(query) || buyerName.includes(query) || phone.includes(query);
                    });
                })
                .forEach((acc, accIdx) => {
                    // Master account row
                    excelData.push({
                        'No.': accIdx + 1,
                        '그룹 ID': acc.login_id,
                        '결제 계정': acc.payment_email,
                        '결제일': `${acc.payment_day}일`,
                        '메모': acc.memo ?? '',
                        'Slot': '',
                        '고객명': '',
                        '전화번호': '',
                        '주문번호': '',
                        '소속 ID': '',
                        '소속 PW': '',
                        '시작일': '',
                        '종료일': '',
                        '개월': ''
                    });

                    // Dynamic slot rows
                    const sortedAssignments = getSortedAssignments(acc);
                    sortedAssignments.forEach((assignment) => {
                        const order = assignment.orders;
                        const period = getPeriodMonths(assignment.start_date, assignment.end_date);

                        excelData.push({
                            'No.': '',
                            '그룹 ID': '',
                            '결제 계정': '',
                            '결제일': '',
                            '메모': '',
                            'Slot': `Slot ${assignment.slot_number + 1}`,
                            '고객명': order?.buyer_name || order?.profiles?.name || '',
                            '전화번호': order?.buyer_phone || order?.profiles?.phone || '',
                            '주문번호': order?.order_number || '',
                            '소속 ID': assignment.tidal_id || '',
                            '소속 PW': assignment.tidal_password || '',
                            '시작일': assignment.start_date ? new Date(assignment.start_date).toLocaleDateString() : '',
                            '종료일': assignment.end_date ? new Date(assignment.end_date).toLocaleDateString() : '',
                            '개월': period
                        });
                    });
                });
        }

        // Create workbook
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(excelData);
        XLSX.utils.book_append_sheet(wb, ws, 'Tidal 계정');

        // Generate file
        const fileName = `Tidal계정_${isGridView ? 'Grid' : 'List'}_${new Date().toLocaleDateString()}.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const data = new Uint8Array(event.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            interface ImportRow {
                '그룹 ID': string;
                '결제 계정': string;
                '결제일': number | string;
                '메모': string;
                [key: string]: string | number | undefined;
            }
            const jsonData = XLSX.utils.sheet_to_json<ImportRow>(worksheet);

            // Validation: Check headers
            const requiredHeaders = ['그룹 ID', '결제 계정', '결제일', '메모'];
            const firstRow = jsonData[0];
            if (!firstRow || !requiredHeaders.every(h => h in firstRow)) {
                alert('엑셀 양식이 올바르지 않습니다. 다운로드 양식을 확인해 주세요.');
                return;
            }

            try {
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
            } catch (error) {
                console.error(error);
                alert('임포트 처리 중 오류가 발생했습니다.');
            }
        };
        reader.readAsArrayBuffer(file);
        // Reset input
        e.target.value = '';
    };

    // --- Modals --- (Assign/Move)

    const openAssignModal = (account: Account, slotIndex: number) => {
        try {
            if (!account) throw new Error('계정 정보가 없습니다.');
            setSelectedAccount(account);
            setSelectedSlot(slotIndex);
            setSlotPasswordModal(generateTidalPassword());
            setIsAssignModalOpen(true);
        } catch (e) {
            console.error('Open assign modal error:', e);
            alert('배정 창을 여는 중 오류가 발생했습니다: ' + String(e));
        }
    };

    const getStatusLabel = (order: Order) => {
        if (order.assignment_status === 'completed') return '작업완료';
        if (order.assignment_status === 'assigned') return '배정완료';
        if (order.payment_status === 'paid') return '입금확인';
        return '주문신청';
    };

    const openOrderDetail = (order?: Order) => {
        if (!order) return;
        setViewOrder(order);
        setIsOrderDetailOpen(true);
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
                full_order: order // Store full order for detail view
            }
        }));

        // Optimistically update accounts state to ensure the new slot renders
        setAccounts(prev => prev.map(acc => {
            if (acc.id === selectedAccount.id) {
                const newAssignment: Assignment = {
                    id: `temp-${Date.now()}`,
                    // account_id removed as it's not in Assignment interface
                    slot_number: selectedSlot,
                    type: selectedSlot === 0 ? 'master' : 'user',
                    tidal_id: (emailPrefix ? `${emailPrefix}@hifitidal.com` : null) || undefined,
                    tidal_password: slotPasswordModal || '',
                    order_id: order.id,
                    orders: order
                };

                const newOrderAccounts = [...(acc.order_accounts || [])];
                const existingIdx = newOrderAccounts.findIndex(oa => oa.slot_number === selectedSlot);

                if (existingIdx !== -1) {
                    newOrderAccounts[existingIdx] = { ...newOrderAccounts[existingIdx], ...newAssignment };
                } else {
                    newOrderAccounts.push(newAssignment);
                }

                return { ...acc, used_slots: newOrderAccounts.length, order_accounts: newOrderAccounts };
            }
            return acc;
        }));

        setEditingSlots(prev => ({ ...prev, [key]: true }));
        setIsAssignModalOpen(false);
    };

    const openMoveModal = (currentAssignment: Assignment) => {
        setSelectedAssignment(currentAssignment);
        setMoveTargets(accounts.filter(a => a.used_slots < a.max_slots));
        setSelectedTargetAccount('');
        setSelectedTargetSlot(null);
        setSlotPasswordModal(currentAssignment.tidal_password || '');
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
                    target_tidal_password: selectedAssignment?.tidal_password // Use existing Pw
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

    const getSortedAssignments = (acc: Account) => {
        return [...(acc.order_accounts || [])]
            .filter(oa => oa && typeof oa === 'object')
            .sort((a, b) => {
                if (a.type === 'master') return -1;
                if (b.type === 'master') return 1;
                const dateA = a.end_date || '9999-12-31';
                const dateB = b.end_date || '9999-12-31';
                return dateA.localeCompare(dateB);
            });
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
    const getPeriodMonths = (start?: string, end?: string) => {
        if (!start || !end) return 0;
        try {
            return differenceInMonths(parseISO(end), parseISO(start));
        } catch {
            return 0;
        }
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
                        continue; // Skip if no match
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

        // Sorting
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

                // Safely compare values
                const sA = (typeof valA === 'object' ? JSON.stringify(valA) : valA) as string | number | boolean;
                const sB = (typeof valB === 'object' ? JSON.stringify(valB) : valB) as string | number | boolean;

                if (sA < sB) return sortConfig.direction === 'asc' ? -1 : 1;
                if (sA > sB) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return flat;
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

                        {/* 6. 그룹 추가 */}
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
                                            <tr key={assignment.id} className={`border-b hover:bg-gray-50 ${isExpired ? 'bg-red-50/30' : ''}`}>
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
                            <div className="col-span-1">No.</div>
                            <div className="col-span-2">결제계좌</div>
                            <div className="col-span-1 text-center">결제일</div>
                            <div className="col-span-1 text-left">메모</div>
                            <div className="col-span-2 text-left">마스터계정</div>
                            <div className="col-span-2 text-left text-orange-600">종료예정일</div>
                            <div className="col-span-1 text-left">지속개월</div>
                            <div className="col-span-1 text-center">슬롯</div>
                            <div className="col-span-1 text-center">관리</div>
                            <div className="col-span-1 text-center">상세</div>
                        </div>

                        {accounts
                            .filter(acc => {
                                const query = searchQuery.toLowerCase().trim();
                                if (!query) return true;
                                if (acc.login_id.toLowerCase().includes(query) || acc.payment_email.toLowerCase().includes(query)) return true;
                                return acc.order_accounts?.some(oa => {
                                    const tidalId = (oa.tidal_id || '').toLowerCase();
                                    const buyerName = (oa.buyer_name || oa.orders?.buyer_name || '').toLowerCase();
                                    const phone = (oa.buyer_phone || oa.orders?.buyer_phone || '').toLowerCase();
                                    return tidalId.includes(query) || buyerName.includes(query) || phone.includes(query);
                                });
                            })
                            .map((acc, idx) => {
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





                                return (
                                    <div key={acc.id} id={`account-${acc.id}`} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                                        <div className="grid grid-cols-13 gap-4 p-4 items-center text-sm">
                                            <div className="col-span-1 text-gray-500 font-mono cursor-pointer" onClick={() => toggleRow(acc.id)}>
                                                {String(idx + 1).padStart(3, '0')}
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
                                            {(() => {
                                                const masterSlot = acc.order_accounts?.find(oa => oa.type === 'master');
                                                const tidalId = masterSlot?.tidal_id || '-';
                                                const endDate = masterSlot?.end_date || '-';
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
                                                    <>
                                                        <div className="col-span-2 text-gray-700 text-xs truncate cursor-pointer" title={tidalId} onClick={() => toggleRow(acc.id)}>
                                                            {tidalId}
                                                        </div>
                                                        <div className="col-span-2 text-orange-600 font-mono text-xs cursor-pointer" onClick={() => toggleRow(acc.id)}>
                                                            {endDate}
                                                        </div>
                                                        <div className="col-span-1 text-gray-500 font-mono text-xs cursor-pointer" onClick={() => toggleRow(acc.id)}>
                                                            {duration}
                                                        </div>
                                                    </>
                                                );
                                            })()}
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
