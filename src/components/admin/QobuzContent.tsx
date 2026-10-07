"use client";

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { describeGroupIdSuggestion, normalizeGroupId, suggestGroupId } from '@/lib/group-id-utils';
import {
    Plus, ChevronDown, ChevronUp, Trash2, ArrowRightLeft, Download, Pencil,
    LayoutGrid, List, History, PowerOff, Filter, Mail, Search, MessageSquareText,
    Zap, UserPlus, Settings, Copy
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
import { EmailTemplateModal, type EmailTemplate } from '@/components/admin/EmailTemplateModal';
import { filterTemplatesByScope, isTemplateInScope } from '@/lib/email-template-scope';

/** 하부계정(슬롯) */
interface Assignment {
    id: string;
    slot_number: number;
    qobuz_id?: string;
    qobuz_password?: string;
    screen_name?: string;
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
    accounts?: { id: string; login_id: string; master_email?: string; master_end_date?: string };
}

/**
 * 대표계정(그룹).
 *
 * Tidal 계열과 달리 대표계정은 슬롯을 차지하지 않는다. master_email/master_end_date 는
 * 그룹 자체의 속성이고, 5개 슬롯은 전부 하부계정이다.
 */
interface Account {
    id: string;
    login_id: string;
    login_pw?: string;
    master_email?: string;
    master_end_date?: string;
    payment_email?: string;
    payment_day: number;
    memo?: string;
    max_slots: number;
    used_slots: number;
    assignments?: Assignment[];
}

interface GridValue {
    assignment_id?: string;
    qobuz_id: string | null;
    qobuz_password: string;
    screen_name: string;
    buyer_name: string;
    buyer_phone: string;
    buyer_email: string;
    start_date: string;
    end_date: string;
    order_number: string;
    period_months?: number;
    amount?: number;
    memo?: string;
    is_active: boolean;
    is_deleted?: boolean;
    updated_at?: string;
    assigned_at?: string;
}

interface QobuzContentProps {
    titlePrefix?: string;
    basePath: string;
    fetchFn?: (url: string, init?: RequestInit) => Promise<Response>;
}

/** 임포트 기본 계약금액 (75,000원) */
const DEFAULT_AMOUNT = 75000;
/** 대표계정 1개당 하부계정 5개 */
const DEFAULT_MAX_SLOTS = 5;

/** 진입 시 기본 정렬: 구독 종료일 오름차순 */
const DEFAULT_SORT: { key: string; direction: 'asc' | 'desc' } = { key: 'end_date', direction: 'asc' };

/**
 * 그룹의 슬롯 렌더 범위.
 *
 * 중복 등록 등으로 slot_number 가 max_slots 이상인 행이 생기면, max_slots 까지만 순회하면
 * 그 행이 조용히 사라진다. 실제 배정된 최대 슬롯 번호까지 범위를 넓혀 초과분도 노출시킨다.
 */
function getSlotRenderCount(acc: Account): number {
    const maxAssigned = (acc.assignments || []).reduce(
        (max, a) => Math.max(max, (a.slot_number ?? 0) + 1),
        0
    );
    return Math.max(acc.max_slots, maxAssigned);
}

/** 계약 개월 수. period_months 가 비어 있으면 시작/종료일로 추정한다. */
function resolvePeriodMonths(a: { period_months?: number; start_date?: string; end_date?: string }): number {
    if (a.period_months) return a.period_months;
    if (a.start_date && a.end_date) {
        try {
            return Math.floor(differenceInDays(parseISO(a.end_date), parseISO(a.start_date)) / 30);
        } catch { /* 파싱 실패 시 0 */ }
    }
    return 0;
}

/** 종료일까지 남은 일수. 종료일이 없으면 null. */
function getRemainingDays(endDate?: string): number | null {
    if (!endDate) return null;
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return Math.ceil((parseISO(endDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    } catch {
        return null;
    }
}

/**
 * 잔여일 필터 통과 여부.
 *
 * 1개월 계약 건은 기본 노출하되 잔여일 조회에서는 제외한다 (매월 갱신 건이라 항상 걸린다).
 */
function passesExpiryFilter(
    a: { period_months?: number; start_date?: string; end_date?: string },
    expiredDays: number
): boolean {
    const months = resolvePeriodMonths(a);
    if (months > 0 && months <= 1) return false;
    const remaining = getRemainingDays(a.end_date);
    if (remaining === null) return false;
    return remaining <= expiredDays;
}

export function QobuzContent({
    titlePrefix = "QOBUZ",
    basePath,
    fetchFn = fetch
}: QobuzContentProps) {
    const router = useRouter();

    const [accounts, setAccounts] = useState<Account[]>([]);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [isGridView, setIsGridView] = useState(false);
    const [gridValues, setGridValues] = useState<Record<string, GridValue>>({});
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
    const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
    const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
    const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);

    const [moveTargets, setMoveTargets] = useState<Account[]>([]);
    const [selectedTargetAccount, setSelectedTargetAccount] = useState<string>('');
    const [selectedTargetSlot, setSelectedTargetSlot] = useState<number | null>(null);
    const [showExpiredOnly, setShowExpiredOnly] = useState(false);

    const [searchQuery, setSearchQuery] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(DEFAULT_SORT);
    const [newAccount, setNewAccount] = useState({
        login_id: '', login_pw: '', master_email: '', master_end_date: '',
        payment_email: '', payment_day: 1, memo: '', max_slots: DEFAULT_MAX_SLOTS
    });
    const [editingAccount, setEditingAccount] = useState<Account | null>(null);
    const [slotPasswordModal, setSlotPasswordModal] = useState('');
    const [selectedAssignmentIds, setSelectedAssignmentIds] = useState<Set<string>>(new Set());
    const [isNotifyModalOpen, setIsNotifyModalOpen] = useState(false);
    const [notificationMessage, setNotificationMessage] = useState('');
    const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
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
        checkbox: 26, login_id: 56, edit: 30, memo: 60, qobuz_id: 90,
        screen_name: 80, buyer_name: 55, buyer_phone: 80,
        start_date: 65, end_date: 65, updated_at: 65, period: 48, amount: 58
    });
    const [, setResizingCol] = useState<string | null>(null);

    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [extendMsgCopied, setExtendMsgCopied] = useState(false);

    // 배정 모달용 상태
    const [assignTab, setAssignTab] = useState<'direct' | 'restore'>('direct');
    const [directForm, setDirectForm] = useState({
        qobuz_id: '', screen_name: '', buyer_name: '', buyer_phone: '', buyer_email: '',
        start_date: '', end_date: '', period_months: 0, amount: DEFAULT_AMOUNT, order_number: '', memo: ''
    });
    const [deletedAssignments, setDeletedAssignments] = useState<Assignment[]>([]);
    const [isLoadingDeleted, setIsLoadingDeleted] = useState(false);
    const [deletedSearch, setDeletedSearch] = useState('');

    const apiBase = '/api' + basePath;

    /** 대표계정 이메일 복사 후, 확인 시에만 Qobuz 패밀리 멤버 관리 페이지 열기 */
    const handleMasterEmailClick = (e: React.MouseEvent, email: string | null | undefined) => {
        if (!email || email === '-') return;
        e.stopPropagation();
        navigator.clipboard.writeText(email).then(() => {
            setCopiedId(email);
            setTimeout(() => setCopiedId(null), 2000);
        });
        if (confirm(`${email} 복사됨.\n\nQobuz 패밀리 관리 페이지를 열까요?`)) {
            window.open('https://www.qobuz.com/profile/household/', '_blank');
        }
    };

    /** 대표계정 이메일의 @ 앞부분으로 `***@dalbus.com` 주소를 만들어 복사 */
    const handleDalbusEmailCopy = (e: React.MouseEvent, email: string | null | undefined, key: string) => {
        e.stopPropagation();
        const local = (email || '').split('@')[0].trim();
        if (!local || local === '-') return;
        navigator.clipboard.writeText(`${local}@dalbus.com`).then(() => {
            setCopiedId(key);
            setTimeout(() => setCopiedId(null), 2000);
        });
    };

    /**
     * 하부계정 ID(이메일) 클립보드 복사.
     * 셀에 select-all 을 걸어 클릭/드래그 선택도 이메일 한 덩어리로 잡히게 한다.
     */
    const handleQobuzIdClick = (e: React.MouseEvent, email: string | null | undefined, key: string) => {
        if (!email || email === '-') return;
        e.stopPropagation();
        navigator.clipboard.writeText(email).then(() => {
            setCopiedId(key);
            setTimeout(() => setCopiedId(null), 2000);
        });
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
{qobuz_id} 서비스가 {end_date}에 만료됩니다.

연장을 원하시면 아래 링크로 접속하여서 신청바랍니다.
${typeof window !== 'undefined' ? window.location.origin : ''}/public`, []);

    useEffect(() => { setNotificationMessage(defaultTemplate); }, [defaultTemplate]);

    const fetchAccounts = useCallback(async () => {
        try {
            // 비활성 데이터도 함께 받아 두고 표시 여부는 화면에서 판단한다
            const res = await fetchFn(`${apiBase}?showInactive=true`, { cache: 'no-store' });
            if (!res.ok) throw new Error(`Failed to fetch (${res.status})`);
            const data = await res.json();
            setAccounts(data);
            const initialGrid: Record<string, GridValue> = {};
            data.forEach((acc: Account) => {
                const slotCount = getSlotRenderCount(acc);
                for (let i = 0; i < slotCount; i++) {
                    const assignment = acc.assignments?.find((a: Assignment) => a.slot_number === i);
                    initialGrid[`${acc.id}_${i}`] = {
                        assignment_id: assignment?.id,
                        qobuz_id: assignment?.qobuz_id ?? null,
                        qobuz_password: assignment?.qobuz_password || '',
                        screen_name: assignment?.screen_name || '',
                        buyer_name: assignment?.buyer_name || '',
                        buyer_phone: assignment?.buyer_phone || '',
                        buyer_email: assignment?.buyer_email || '',
                        start_date: assignment?.start_date || '',
                        end_date: assignment?.end_date || '',
                        order_number: assignment?.order_number || '',
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
    }, [fetchFn, apiBase]);

    const fetchTemplates = useCallback(async () => {
        try {
            const res = await fetchFn('/api/admin/email-templates');
            if (res.ok) {
                const data = await res.json();
                setEmailTemplates(data);
                const first = data.find((t: { key: string }) => isTemplateInScope(t.key, 'qobuz'));
                if (first) setSelectedTemplateKey(first.key);
            }
        } catch (error) { console.error(error); }
    }, [fetchFn]);

    const fetchDeletedAssignments = useCallback(async () => {
        setIsLoadingDeleted(true);
        setDeletedAssignments([]);
        try {
            const res = await fetchFn(`${apiBase}/inactive?showDeleted=true`, { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                setDeletedAssignments(Array.isArray(data) ? data : []);
            }
        } catch (e) { console.error(e); }
        finally { setIsLoadingDeleted(false); }
    }, [fetchFn, apiBase]);

    useEffect(() => {
        fetchAccounts();
        fetchTemplates();
    }, [fetchAccounts, fetchTemplates]);

    const getFlattenedAssignments = useCallback(() => {
        const flattened: { id: string; assignment: Assignment; account: Account; period: number }[] = [];
        accounts.forEach(acc => {
            const slotCount = getSlotRenderCount(acc);
            for (let i = 0; i < slotCount; i++) {
                let assignmentObj: Assignment | null = acc.assignments?.find(a => a.slot_number === i) || null;
                if (!assignmentObj) {
                    // 정원(max_slots) 밖의 빈 자리는 배정 가능한 슬롯이 아니므로 만들지 않는다
                    if (i >= acc.max_slots) continue;
                    assignmentObj = {
                        id: `empty_${acc.id}_${i}`,
                        slot_number: i,
                        is_active: true,
                        is_deleted: false
                    };
                }
                const assignment = assignmentObj;
                const periodNum = resolvePeriodMonths(assignment);

                const query = searchQuery.toLowerCase().trim();
                if (query) {
                    const haystack = [
                        assignment.buyer_name, assignment.buyer_email, assignment.qobuz_id,
                        assignment.buyer_phone, assignment.screen_name, acc.login_id, acc.master_email
                    ].map(v => (v || '').toLowerCase());
                    if (!haystack.some(v => v.includes(query))) continue;
                }

                if (showExpiredOnly && !passesExpiryFilter(assignment, expiredDays)) continue;

                // 활성 상태 데이터만 표시
                if (assignment.is_deleted === true) continue;
                if (assignment.is_active === false) continue;

                flattened.push({ id: assignment.id, assignment, account: acc, period: periodNum });
            }
        });
        return flattened;
    }, [accounts, searchQuery, showExpiredOnly, expiredDays]);

    const filteredAccounts = accounts.filter(acc => {
        const query = searchQuery.toLowerCase().trim();

        if (query) {
            const groupMatches =
                acc.login_id.toLowerCase().includes(query) ||
                (acc.master_email || '').toLowerCase().includes(query) ||
                (acc.payment_email || '').toLowerCase().includes(query);

            const slotMatches = acc.assignments?.some(a => {
                if (showExpiredOnly && !passesExpiryFilter(a, expiredDays)) return false;
                return [a.qobuz_id, a.buyer_name, a.buyer_phone, a.screen_name, a.buyer_email]
                    .some(v => (v || '').toLowerCase().includes(query));
            });

            if (!groupMatches && !slotMatches) return false;
        }

        if (showExpiredOnly) {
            const hasExpiringSlot = acc.assignments?.some(a => {
                if (a.is_deleted || !a.is_active) return false;
                return passesExpiryFilter(a, expiredDays);
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
                case 'used_slots': aVal = a.assignments?.length || 0; bVal = b.assignments?.length || 0; break;
                case 'updated_at':
                    aVal = a.assignments?.reduce((max, x) => { const d = x.updated_at || x.assigned_at || '1970-01-01'; return d > max ? d : max; }, '1970-01-01') || '1970-01-01';
                    bVal = b.assignments?.reduce((max, x) => { const d = x.updated_at || x.assigned_at || '1970-01-01'; return d > max ? d : max; }, '1970-01-01') || '1970-01-01';
                    break;
                case 'end_date':
                    aVal = a.master_end_date || '9999-12-31';
                    bVal = b.master_end_date || '9999-12-31';
                    break;
                default: return 0;
            }
            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        }
        // 기본 정렬: 대표계정 종료일 오름차순 → 그룹 ID
        const endA = a.master_end_date || '9999-12-31';
        const endB = b.master_end_date || '9999-12-31';
        if (endA !== endB) return endA.localeCompare(endB);
        return a.login_id.localeCompare(b.login_id);
    });

    const toggleRow = (id: string) => setExpandedRows(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });

    const handleSort = (key: string) => {
        setSortConfig(prev => ({ key, direction: prev?.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
    };

    const handleSaveRow = async (accountId: string, slotIdx: number, dataOverride?: GridValue) => {
        const key = `${accountId}_${slotIdx}`;
        const data = dataOverride || gridValues[key];
        if (!data) return;
        try {
            if (data.assignment_id) {
                const res = await fetchFn(`${apiBase}/assignment/${data.assignment_id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                if (!res.ok) { const e = await res.json().catch(() => null); throw new Error(e?.error || 'Update failed'); }
            } else {
                if (!data.buyer_name && !data.buyer_email) { alert('이름 또는 ID(이메일)를 입력해주세요.'); return; }
                const res = await fetchFn(`${apiBase}/assign/${accountId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...data, slot_number: slotIdx })
                });
                if (!res.ok) { const e = await res.json().catch(() => null); throw new Error(e?.error || 'Create failed'); }
            }
            alert('저장되었습니다.');
            fetchAccounts();
        } catch (e) { alert('저장 실패: ' + (e instanceof Error ? e.message : String(e))); }
    };

    // 그룹 추가 시 비어 있는 번호(삭제된 그룹 자리)를 우선 추천하고, 없으면 마지막 번호 + 1을 추천한다.
    const groupIdSuggestion = useMemo(
        () => suggestGroupId(accounts.map(a => a.login_id), { fallbackPrefix: 'QG' }),
        [accounts]
    );

    useEffect(() => {
        if (!isAddModalOpen) return;
        setNewAccount(prev => (prev.login_id.trim() ? prev : { ...prev, login_id: groupIdSuggestion.id }));
    }, [isAddModalOpen, groupIdSuggestion.id]);

    const handleCreateAccount = async () => {
        const loginId = normalizeGroupId(newAccount.login_id);
        if (!loginId || !newAccount.master_email.trim()) { alert('그룹 ID와 대표계정을 입력해주세요.'); return; }
        if (accounts.some(a => normalizeGroupId(a.login_id) === loginId)) { alert(`이미 사용 중인 그룹 ID입니다. (${loginId})`); return; }
        try {
            const res = await fetchFn(apiBase, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...newAccount, login_id: loginId })
            });
            if (!res.ok) { const e = await res.json().catch(() => null); throw new Error(e?.error || 'Failed to create'); }
            alert('생성되었습니다.');
            setIsAddModalOpen(false); fetchAccounts();
            setNewAccount({
                login_id: '', login_pw: '', master_email: '', master_end_date: '',
                payment_email: '', payment_day: 1, memo: '', max_slots: DEFAULT_MAX_SLOTS
            });
        } catch (error) { alert('실패: ' + (error instanceof Error ? error.message : String(error))); }
    };

    const handleUpdateAccount = async () => {
        if (!editingAccount) return;
        try {
            const res = await fetchFn(`${apiBase}/${editingAccount.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editingAccount)
            });
            if (!res.ok) {
                const detail = await res.json().catch(() => null);
                throw new Error(detail?.error || 'Failed to update');
            }
            setIsEditModalOpen(false); fetchAccounts(); alert('수정되었습니다.');
        } catch (error) { alert('실패: ' + (error instanceof Error ? error.message : String(error))); }
    };

    const handleDeleteAccount = async (account: Account) => {
        if ((account.assignments?.length || 0) > 0) { alert('슬롯이 배정되어 있는 그룹은 삭제할 수 없습니다.'); return; }
        if (!confirm(`그룹 ${account.login_id}을 삭제하시겠습니까?`)) return;
        try {
            const res = await fetchFn(`${apiBase}/${account.id}`, { method: 'DELETE' });
            if (!res.ok) { const e = await res.json().catch(() => null); throw new Error(e?.error || 'Delete failed'); }
            fetchAccounts(); alert('삭제되었습니다.');
        } catch (error) { alert('실패: ' + (error instanceof Error ? error.message : String(error))); }
    };

    /**
     * 하부계정 활성 ↔ 비활성 토글.
     *
     * 대표계정이 슬롯을 차지하지 않으므로 어떤 슬롯이든 비활성할 수 있다.
     */
    const handleToggleActive = async (assignment: Assignment, accountId?: string) => {
        const isCurrentlyActive = assignment.is_active ?? true;
        if (isCurrentlyActive) {
            const accId0 = accountId || accounts.find(acc => acc.assignments?.some(a => a.id === assignment.id))?.id;
            const loginId = accounts.find(acc => acc.id === accId0)?.login_id;
            const slotLabel = loginId ? `${loginId}-${assignment.slot_number + 1}` : '';
            const label = `${slotLabel}${assignment.buyer_name ? ` (${assignment.buyer_name})` : ''}`.trim();
            if (!confirm(`${label ? `[${label}] ` : ''}배정을 비활성화하시겠습니까?\n비활성 내역으로 이동됩니다.`)) return;
        }

        const accId = accountId || accounts.find(acc => acc.assignments?.some(a => a.id === assignment.id))?.id;

        const revertAccounts = accounts;
        const revertGrid = gridValues;

        if (accId) {
            // Optimistic update
            setGridValues(prev => ({
                ...prev,
                [`${accId}_${assignment.slot_number}`]: {
                    ...prev[`${accId}_${assignment.slot_number}`],
                    is_active: !isCurrentlyActive,
                }
            }));

            setAccounts(prev => prev.map(acc => acc.id === accId
                ? { ...acc, assignments: acc.assignments?.map(a => a.id === assignment.id ? { ...a, is_active: !isCurrentlyActive } : a) }
                : acc
            ));
        }

        try {
            const res = await fetchFn(`${apiBase}/assignment/${assignment.id}/toggle-active`, { method: 'POST' });
            if (!res.ok) { const e = await res.json().catch(() => null); throw new Error(e?.error || 'Toggle failed'); }
            fetchAccounts();
        } catch (e) {
            alert('상태 변경 실패: ' + (e instanceof Error ? e.message : String(e)));
            if (accId) {
                setAccounts(revertAccounts);
                setGridValues(revertGrid);
            }
        }
    };

    const handleDirectAssign = async () => {
        if (!selectedAccount || selectedSlot === null) return;
        if (!directForm.buyer_name && !directForm.buyer_email) { alert('이름 또는 이메일을 입력해주세요.'); return; }
        try {
            const res = await fetchFn(`${apiBase}/assign/${selectedAccount.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...directForm, slot_number: selectedSlot, qobuz_password: slotPasswordModal })
            });
            if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Create failed'); }
            setIsAssignModalOpen(false);
            fetchAccounts();
        } catch (e) { alert('저장 실패: ' + (e instanceof Error ? e.message : String(e))); }
    };

    const handleLoadFromDeleted = (deleted: Assignment) => {
        setDirectForm({
            qobuz_id: deleted.qobuz_id || '',
            screen_name: deleted.screen_name || '',
            buyer_name: deleted.buyer_name || '',
            buyer_phone: deleted.buyer_phone || '',
            buyer_email: deleted.buyer_email || '',
            start_date: deleted.start_date || '',
            end_date: deleted.end_date || '',
            period_months: deleted.period_months || 0,
            amount: deleted.amount || DEFAULT_AMOUNT,
            order_number: deleted.order_number || '',
            memo: deleted.memo || ''
        });
        setAssignTab('direct');
    };

    const exportToExcel = () => {
        const flatData = getFlattenedAssignments();
        const excelData = flatData.map((item, idx) => ({
            'No.': idx + 1,
            '그룹': item.account.login_id,
            '배정번호': `${item.account.login_id}-${item.assignment.slot_number + 1}`,
            '대표계정': item.account.master_email ?? '',
            '대표계정 종료일': item.account.master_end_date ?? '',
            'ID': item.assignment.qobuz_id || '',
            'SCREEN NAME': item.assignment.screen_name || '',
            'TEL': item.assignment.buyer_phone || '',
            '이메일': item.assignment.buyer_email || '',
            '이름': item.assignment.buyer_name || '',
            '구독 개시': item.assignment.start_date || '',
            '구독 종료일': item.assignment.end_date || '',
            '구독 기간': item.period,
            '계약금액': item.assignment.amount || 0,
            '메모': item.assignment.memo ?? ''
        }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(excelData), 'QOBUZ계정');
        XLSX.writeFile(wb, `QOBUZ계정_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    };

    const generatePassword = () => {
        const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@$";
        let pass = "";
        for (let i = 0; i < 8; i++) pass += chars.charAt(Math.floor(Math.random() * chars.length));
        return pass;
    };

    const openAssignModal = (account: Account, slotIndex: number) => {
        setSelectedAccount(account); setSelectedSlot(slotIndex);
        setSlotPasswordModal(generatePassword());
        setAssignTab('direct');
        setDeletedSearch('');
        const today = format(new Date(), 'yyyy-MM-dd');
        const defaultEnd = format(addDays(new Date(), 12 * 30), 'yyyy-MM-dd');
        setDirectForm({
            qobuz_id: '', screen_name: '', buyer_name: '', buyer_phone: '', buyer_email: '',
            start_date: today, end_date: defaultEnd, period_months: 12,
            amount: DEFAULT_AMOUNT, order_number: '', memo: ''
        });
        setIsAssignModalOpen(true);
    };

    const openMoveModal = (currentAssignment: Assignment) => {
        setSelectedAssignment(currentAssignment);
        setMoveTargets(accounts.filter(a => a.used_slots < a.max_slots));
        setSelectedTargetAccount(''); setSelectedTargetSlot(null); setIsMoveModalOpen(true);
    };

    const handleMove = async () => {
        if (!selectedAssignment) return;
        try {
            const res = await fetchFn(`${apiBase}/move`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    assignment_id: selectedAssignment.id,
                    target_account_id: selectedTargetAccount,
                    target_slot_number: selectedTargetSlot
                })
            });
            if (!res.ok) { const e = await res.json().catch(() => null); alert('이동 실패: ' + (e?.error || '')); return; }
            setIsMoveModalOpen(false); fetchAccounts();
        } catch { alert('이동 실패'); }
    };

    const getAvailableSlots = (accountId: string) => {
        const acc = accounts.find(a => a.id === accountId);
        if (!acc) return [];
        const taken = new Set((acc.assignments || []).map(a => a.slot_number));
        const available = [];
        for (let i = 0; i < acc.max_slots; i++) { if (!taken.has(i)) available.push(i); }
        return available;
    };

    const toggleSelectAll = (filteredFlat: { id: string }[]) => {
        if (selectedAssignmentIds.size === filteredFlat.length) setSelectedAssignmentIds(new Set());
        else setSelectedAssignmentIds(new Set(filteredFlat.map(item => item.id)));
    };

    const handleToggleSelection = (id: string) => {
        setSelectedAssignmentIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
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
            const results = await Promise.all(
                Array.from(selectedAssignmentIds).map(id =>
                    fetchFn(`${apiBase}/assignment/${id}/toggle-active`, { method: 'POST' })
                )
            );
            const failed = results.filter(r => !r.ok).length;
            fetchAccounts();
            if (failed > 0) alert(`${failed}건 처리 실패`);
        } catch { alert('일괄 처리 실패'); }
    };

    const handleBulkDelete = async () => {
        if (!confirm('정말 삭제하시겠습니까?')) return;
        try {
            // 실패한 요청을 조용히 넘기면 "삭제했는데 삭제내역에 없다"가 된다. 응답을 확인한다.
            const results = await Promise.all(
                Array.from(selectedAssignmentIds).map(id =>
                    fetchFn(`${apiBase}/assignment/${id}`, { method: 'DELETE' })
                )
            );
            const failed = results.filter(r => !r.ok).length;
            setSelectedAssignmentIds(new Set()); fetchAccounts();
            if (failed > 0) alert(`${failed}건 삭제 실패 (권한 또는 서버 오류)`);
        } catch { alert('일괄 삭제 실패'); }
    };

    const handleBulkNotify = async () => {
        if (selectedAssignmentIds.size === 0) return;
        setIsSendingNotify(true);
        try {
            const recipients = getFlattenedAssignments()
                .filter(item => selectedAssignmentIds.has(item.id))
                // notify 라우트는 Tidal 계열과 공용이라 필드명이 tidalId 다. 템플릿에서는 {qobuz_id} 로 참조된다.
                .map(item => ({
                    email: item.assignment.buyer_email,
                    buyerName: item.assignment.buyer_name,
                    tidalId: item.assignment.qobuz_id,
                    endDate: item.assignment.end_date
                }))
                .filter(r => !!r.email);

            if (recipients.length === 0) { alert('이메일이 등록된 대상이 없습니다.'); return; }

            const res = await fetchFn('/api/admin/tidal/notify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipients,
                    messageTemplate: notificationMessage,
                    templateKey: selectedTemplateKey
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

    /** 메모는 타임스탬프를 맨 위 새 줄로 붙여 최신이 위로 쌓이게 한다. */
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
            const res = await fetchFn(`${apiBase}/assignment/${memoTargetAssignmentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ memo: currentMemoInput })
            });
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
                            <span className="bg-sky-100 text-sky-700 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider border border-sky-200">{titlePrefix}</span>
                            QOBUZ 관리
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
                                if (sortConfig?.key === 'updated_at') setSortConfig(DEFAULT_SORT);
                                else {
                                    // 변경일 조회: 잔여일 필터 해제 + 그리드 모드로 결과 출력
                                    setShowExpiredOnly(false);
                                    setIsGridView(true);
                                    setSortConfig({ key: 'updated_at', direction: 'desc' });
                                }
                            }}
                            className="h-9 px-3 text-xs gap-1.5"
                        >
                            <Zap className="w-3.5 h-3.5" /> 변경일
                        </Button>

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
                                    className={`${selectedAssignmentIds.size > 0 ? 'bg-sky-600 hover:bg-sky-700' : ''} h-9 gap-2 text-xs`}
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
                            <table className="w-full text-[11px] min-w-[860px]">
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
                                            { id: 'qobuz_id', label: 'ID', sortable: false },
                                            { id: 'screen_name', label: 'Screen Name', sortable: false },
                                            { id: 'buyer_name', label: '이름', sortable: false },
                                            { id: 'buyer_phone', label: 'TEL', sortable: false },
                                            { id: 'start_date', label: '구독 개시', sortable: true },
                                            { id: 'end_date', label: '구독 종료일', sortable: true },
                                            { id: 'period', label: '구독 기간', sortable: true },
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
                                                    case 'amount': aVal = a.assignment.amount || 0; bVal = b.assignment.amount || 0; break;
                                                    default: return 0;
                                                }
                                                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                                                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                                                return 0;
                                            });
                                        } else {
                                            // 기본 정렬: 대표계정 종료일 오름차순 → 그룹 ID → 슬롯 번호.
                                            // 하부계정 종료일로 정렬하면 같은 그룹의 슬롯이 표 전체에 흩어진다.
                                            flattened.sort((a, b) => {
                                                const da = a.account.master_end_date || '9999-12-31';
                                                const db = b.account.master_end_date || '9999-12-31';
                                                if (da !== db) return da.localeCompare(db);
                                                if (a.account.login_id !== b.account.login_id) {
                                                    return a.account.login_id.localeCompare(b.account.login_id);
                                                }
                                                return (a.assignment.slot_number || 0) - (b.assignment.slot_number || 0);
                                            });
                                        }
                                        if (flattened.length === 0) {
                                            return (
                                                <tr><td colSpan={13} className="p-12 text-center text-slate-400">표시할 데이터가 없습니다.</td></tr>
                                            );
                                        }
                                        return flattened.map(item => {
                                            const { assignment, account: acc } = item;
                                            const sIdx = assignment.slot_number;
                                            const key = `${acc.id}_${sIdx}`;
                                            const val = gridValues[key] || ({} as GridValue);
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
                                                    <td
                                                        className={`text-center font-bold px-2 border-r border-slate-100 whitespace-nowrap cursor-pointer hover:text-blue-600 hover:underline ${sIdx >= acc.max_slots ? 'text-amber-600' : 'text-slate-700'}`}
                                                        title={sIdx >= acc.max_slots
                                                            ? `정원 초과 슬롯 (정원 ${acc.max_slots}개). 중복 배정 여부를 확인하세요.`
                                                            : `리스트 뷰에서 그룹 열기 (대표계정: ${acc.master_email || '-'})`}
                                                        onClick={() => {
                                                            setIsGridView(false);
                                                            setExpandedRows(new Set([acc.id]));
                                                            setTimeout(() => {
                                                                document.getElementById(`account-${acc.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                            }, 100);
                                                        }}
                                                    >
                                                        {acc.login_id}-{sIdx + 1}
                                                        {sIdx >= acc.max_slots && <span className="ml-1 text-[9px] font-normal">초과</span>}
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
                                                                    {(acc.assignments?.length || 0) === 0 && (
                                                                        <Button size="sm" variant="ghost" className="h-8 justify-start gap-2 text-xs text-red-600" onClick={() => handleDeleteAccount(acc)}>
                                                                            <Trash2 size={12} /> 그룹삭제
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            </PopoverContent>
                                                        </Popover>
                                                    </td>
                                                    <td className="px-2 py-2 border-r border-slate-100 whitespace-nowrap truncate" title={assignment.qobuz_id || undefined}>
                                                        {assignment.qobuz_id || '-'}
                                                    </td>
                                                    <td className="px-2 py-2 border-r border-slate-100 whitespace-nowrap truncate max-w-[110px]" title={assignment.screen_name || undefined}>{assignment.screen_name || '-'}</td>
                                                    <td className="px-2 py-2 border-r border-slate-100 whitespace-nowrap truncate max-w-[80px]">{assignment.buyer_name || '-'}</td>
                                                    <td className="px-2 py-2 border-r border-slate-100 whitespace-nowrap truncate text-slate-500 font-mono">{assignment.buyer_phone || '-'}</td>
                                                    <td className="px-2 py-2 border-r border-slate-100 whitespace-nowrap text-center text-slate-500 font-mono">{assignment.start_date ? format(parseISO(assignment.start_date), 'yy-MM-dd') : '-'}</td>
                                                    <td className="px-2 py-2 border-r border-slate-100 whitespace-nowrap text-center font-mono">
                                                        <span className={isExpired ? "text-red-500 font-bold" : "text-slate-700"}>
                                                            {assignment.end_date ? format(parseISO(assignment.end_date), 'yy-MM-dd') : '-'}
                                                        </span>
                                                    </td>
                                                    <td className="px-2 py-2 border-r border-slate-100 whitespace-nowrap text-center text-slate-700 font-medium">{item.period ? `${item.period}개월` : '-'}</td>
                                                    <td className="px-2 py-2 border-r border-slate-100 whitespace-nowrap text-right text-slate-700 font-mono font-medium">{assignment.amount ? assignment.amount.toLocaleString() : '-'}</td>
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
                                <Plus className="w-4 h-4" /> 대표계정 추가
                            </Button>
                        </div>
                    </div>
                ) : (
                    /* ===== LIST VIEW ===== */
                    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                        <div className="grid grid-cols-13 gap-1.5 p-2.5 bg-slate-50 font-bold border-b text-slate-500 text-[10px] uppercase tracking-wider whitespace-nowrap">
                            <div className="col-span-1 cursor-pointer hover:text-slate-800 flex items-center gap-1 whitespace-nowrap" onClick={() => handleSort('login_id')}>그룹 {sortConfig?.key === 'login_id' && (sortConfig.direction === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}</div>
                            <div className="col-span-3 whitespace-nowrap">대표계정</div>
                            <div className="col-span-2 text-left cursor-pointer hover:text-slate-800 flex items-center gap-1 whitespace-nowrap" onClick={() => handleSort('end_date')}>대표계정 종료일 {sortConfig?.key === 'end_date' && (sortConfig.direction === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}</div>
                            <div className="col-span-4 text-left whitespace-nowrap">메모</div>
                            <div className="col-span-1 text-center cursor-pointer hover:text-slate-800 flex items-center justify-center gap-1 whitespace-nowrap" onClick={() => handleSort('used_slots')}>슬롯 {sortConfig?.key === 'used_slots' && (sortConfig.direction === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}</div>
                            <div className="col-span-1 text-center whitespace-nowrap">관리</div>
                            <div className="col-span-1 text-center whitespace-nowrap">펼침</div>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {sortedAccounts.map(acc => {
                                const isExpanded = expandedRows.has(acc.id);
                                const masterEmail = acc.master_email || '-';
                                const masterEnd = acc.master_end_date || '-';

                                // 대표계정 종료일이 30일 이내면 경고 표시
                                let isWarning = false;
                                const remaining = getRemainingDays(acc.master_end_date);
                                if (remaining !== null && remaining <= 30) isWarning = true;

                                return (
                                    <div key={acc.id} id={`account-${acc.id}`} className="group/row">
                                        <div className="grid grid-cols-13 gap-1.5 p-2.5 items-center text-[11px] hover:bg-slate-50 transition-colors whitespace-nowrap">
                                            <div className="col-span-1 text-slate-900 font-bold truncate cursor-pointer whitespace-nowrap" title={acc.login_id} onClick={() => toggleRow(acc.id)}>{acc.login_id}</div>
                                            <div
                                                className="col-span-3 flex items-center min-w-0 text-slate-700 cursor-pointer hover:text-blue-600 relative overflow-visible whitespace-nowrap"
                                                title={`${masterEmail} (클릭하면 복사, 패밀리 페이지 열기 선택)`}
                                                onClick={(e) => handleMasterEmailClick(e, acc.master_email)}
                                            >
                                                <span className="font-semibold text-blue-600 truncate min-w-0">{masterEmail}</span>
                                                {acc.master_email && (
                                                    <button
                                                        type="button"
                                                        className="ml-1 shrink-0 inline-flex items-center justify-center h-5 w-5 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                                                        title={`${acc.master_email.split('@')[0]}@dalbus.com 복사`}
                                                        onClick={(e) => handleDalbusEmailCopy(e, acc.master_email, `dalbus_${acc.id}`)}
                                                    >
                                                        <Copy size={11} />
                                                    </button>
                                                )}
                                                {copiedId === acc.master_email && (
                                                    <span className="absolute -top-6 left-0 bg-blue-600 text-white text-[9px] px-2 py-0.5 rounded shadow-lg animate-bounce z-10">복사됨!</span>
                                                )}
                                                {copiedId === `dalbus_${acc.id}` && (
                                                    <span className="absolute -top-6 left-0 bg-blue-600 text-white text-[9px] px-2 py-0.5 rounded shadow-lg animate-bounce z-10">@dalbus.com 복사됨!</span>
                                                )}
                                            </div>
                                            <div className={`col-span-2 font-mono whitespace-nowrap ${isWarning ? 'text-red-500 font-bold' : 'text-slate-600'}`} onClick={() => toggleRow(acc.id)}>{masterEnd}</div>
                                            <div className="col-span-4 text-slate-400 text-[10px] truncate whitespace-nowrap" title={acc.memo} onClick={() => toggleRow(acc.id)}>{acc.memo}</div>
                                            <div
                                                className={`col-span-1 text-center font-bold whitespace-nowrap ${acc.used_slots > acc.max_slots ? 'text-amber-600' : 'text-blue-600'}`}
                                                title={acc.used_slots > acc.max_slots ? `정원 초과: 활성 배정 ${acc.used_slots}건 / 정원 ${acc.max_slots}개. 중복 배정 여부를 확인하세요.` : undefined}
                                                onClick={() => toggleRow(acc.id)}
                                            >{acc.used_slots}/{acc.max_slots}</div>
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
                                                            <th className="text-left py-2 px-2 whitespace-nowrap">ID</th>
                                                            <th className="text-left py-2 px-2 whitespace-nowrap">Screen Name</th>
                                                            <th className="text-left py-2 px-2 whitespace-nowrap">이름</th>
                                                            <th className="text-left py-2 px-2 whitespace-nowrap">TEL</th>
                                                            <th className="text-center py-2 whitespace-nowrap">구독 개시</th>
                                                            <th className="text-center py-2 whitespace-nowrap">구독 종료일</th>
                                                            <th className="text-center py-2 whitespace-nowrap">구독 기간</th>
                                                            <th className="text-right py-2 px-2 whitespace-nowrap">계약금액</th>
                                                            <th className="text-center py-2 whitespace-nowrap">변경일</th>
                                                            <th className="text-left py-2 px-2 whitespace-nowrap">메모</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {(() => {
                                                            let slots: Assignment[] = [];
                                                            const slotCount = getSlotRenderCount(acc);
                                                            for (let i = 0; i < slotCount; i++) {
                                                                const found = acc.assignments?.find(a => a.slot_number === i);
                                                                if (found) slots.push(found);
                                                                // 정원 밖의 빈 자리는 배정 가능한 슬롯이 아니므로 만들지 않는다
                                                                else if (i < acc.max_slots) {
                                                                    slots.push({
                                                                        id: `empty_${acc.id}_${i}`,
                                                                        slot_number: i,
                                                                        is_active: true,
                                                                        is_deleted: false
                                                                    });
                                                                }
                                                            }

                                                            if (showExpiredOnly) {
                                                                slots = slots.filter(a => {
                                                                    if (a.is_deleted || !a.is_active) return false;
                                                                    return passesExpiryFilter(a, expiredDays);
                                                                });
                                                            }

                                                            return slots.sort((a, b) => (a.slot_number || 0) - (b.slot_number || 0)).map(assignment => {
                                                                const isEmpty = assignment.id.startsWith('empty_');
                                                                const isDeactivated = assignment.is_active === false;
                                                                const isOverCapacity = assignment.slot_number >= acc.max_slots;
                                                                const val = gridValues[`${acc.id}_${assignment.slot_number}`] || ({} as GridValue);
                                                                const period = resolvePeriodMonths(assignment);

                                                                return (
                                                                    <tr
                                                                        key={assignment.id}
                                                                        title={isOverCapacity ? `정원 초과 슬롯 (정원 ${acc.max_slots}개). 중복 배정 여부를 확인하세요.` : undefined}
                                                                        className={`border-b last:border-0 border-slate-100 h-10 ${isDeactivated ? 'bg-red-50 text-red-500' : (isEmpty ? 'bg-emerald-50/20 text-emerald-600' : (isOverCapacity ? 'bg-amber-50 text-amber-700' : 'bg-white'))}`}
                                                                    >
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
                                                                            <td colSpan={10} className="px-2 text-center text-slate-400 italic whitespace-nowrap">빈 슬롯 ({acc.login_id}-{assignment.slot_number + 1})</td>
                                                                        ) : (
                                                                            <>
                                                                                <td className="px-2 whitespace-nowrap relative">
                                                                                    {val.qobuz_id ? (
                                                                                        <span
                                                                                            className="inline-block max-w-[180px] truncate align-middle select-all cursor-pointer font-semibold text-blue-600 hover:underline"
                                                                                            title={`${val.qobuz_id} (클릭하면 복사)`}
                                                                                            onClick={(e) => handleQobuzIdClick(e, val.qobuz_id, `qid_${assignment.id}`)}
                                                                                        >
                                                                                            {val.qobuz_id}
                                                                                        </span>
                                                                                    ) : '-'}
                                                                                    {copiedId === `qid_${assignment.id}` && (
                                                                                        <span className="absolute -top-4 left-2 bg-blue-600 text-white text-[9px] px-2 py-0.5 rounded shadow-lg z-10 whitespace-nowrap">복사됨!</span>
                                                                                    )}
                                                                                </td>
                                                                                <td className="px-2 truncate max-w-[110px] whitespace-nowrap">{val.screen_name || '-'}</td>
                                                                                <td className="px-2 truncate max-w-[80px] whitespace-nowrap">{val.buyer_name || '-'}</td>
                                                                                <td className="px-2 font-mono whitespace-nowrap">{val.buyer_phone || '-'}</td>
                                                                                <td className="px-2 text-center font-mono whitespace-nowrap">{val.start_date || '-'}</td>
                                                                                <td className="px-2 text-center font-mono whitespace-nowrap">{val.end_date || '-'}</td>
                                                                                <td className="text-center font-medium whitespace-nowrap">{period ? `${period}개월` : '-'}</td>
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

            {/* EXCEL EXPORT */}
            <div className="mt-8 flex justify-center gap-4">
                <Button
                    variant="outline"
                    onClick={exportToExcel}
                    className="bg-white hover:bg-blue-50 text-blue-700 border-blue-200"
                >
                    <Download className="w-4 h-4 mr-2" /> 엑셀 내보내기
                </Button>
            </div>

            {/* [MODAL: ADD GROUP] */}
            <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>대표계정(그룹) 추가</DialogTitle></DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right text-xs">그룹 <span className="text-red-500">*</span></Label>
                            <div className="col-span-3">
                                <Input value={newAccount.login_id} onChange={e => setNewAccount({ ...newAccount, login_id: e.target.value.toUpperCase() })} className="h-9" placeholder={groupIdSuggestion.id} />
                                <p className="mt-1 text-xs text-gray-500">{describeGroupIdSuggestion(groupIdSuggestion)}</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right text-xs">대표계정 <span className="text-red-500">*</span></Label>
                            <Input value={newAccount.master_email} onChange={e => setNewAccount({ ...newAccount, master_email: e.target.value })} className="col-span-3 h-9" placeholder="master@gmail.com" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right text-xs">대표계정 종료일</Label>
                            <Input type="date" value={newAccount.master_end_date} onChange={e => setNewAccount({ ...newAccount, master_end_date: e.target.value })} className="col-span-3 h-9" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right text-xs">대표계정 비번</Label>
                            <Input value={newAccount.login_pw} onChange={e => setNewAccount({ ...newAccount, login_pw: e.target.value })} className="col-span-3 h-9" placeholder="선택 입력" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right text-xs">결제 이메일</Label>
                            <Input value={newAccount.payment_email} onChange={e => setNewAccount({ ...newAccount, payment_email: e.target.value })} className="col-span-3 h-9" placeholder="선택 입력" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right text-xs">결제일</Label>
                            <Input type="number" min="1" max="31" value={newAccount.payment_day} onChange={e => setNewAccount({ ...newAccount, payment_day: parseInt(e.target.value) || 1 })} className="col-span-3 h-9" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right text-xs">슬롯 정원</Label>
                            <Input type="number" min="1" max="20" value={newAccount.max_slots} onChange={e => setNewAccount({ ...newAccount, max_slots: parseInt(e.target.value) || DEFAULT_MAX_SLOTS })} className="col-span-3 h-9" />
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
                    <DialogHeader>
                        <div className="flex items-center justify-between gap-4 pr-8">
                            <DialogTitle>대표계정(그룹) 수정</DialogTitle>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => setIsEditModalOpen(false)}>취소</Button>
                                <Button size="sm" onClick={handleUpdateAccount}>수정 완료</Button>
                            </div>
                        </div>
                    </DialogHeader>
                    {editingAccount && (
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right text-xs">그룹 <span className="text-red-500">*</span></Label>
                                <Input value={editingAccount.login_id} onChange={e => setEditingAccount({ ...editingAccount, login_id: e.target.value.toUpperCase() })} className="col-span-3 h-9" />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right text-xs">대표계정 <span className="text-red-500">*</span></Label>
                                <Input value={editingAccount.master_email || ''} onChange={e => setEditingAccount({ ...editingAccount, master_email: e.target.value })} className="col-span-3 h-9" />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right text-xs">대표계정 종료일</Label>
                                <Input type="date" value={editingAccount.master_end_date || ''} onChange={e => setEditingAccount({ ...editingAccount, master_end_date: e.target.value })} className="col-span-3 h-9" />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right text-xs">메모</Label>
                                <Input value={editingAccount.memo || ''} onChange={e => setEditingAccount({ ...editingAccount, memo: e.target.value })} className="col-span-3 h-9" />
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* [MODAL: ASSIGN] */}
            <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
                <DialogContent className="sm:max-w-[520px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <UserPlus className="w-4 h-4 text-emerald-600" />
                            회원 배정 — {selectedAccount?.login_id}-{(selectedSlot ?? 0) + 1}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="flex gap-0 border-b mb-3">
                        <button
                            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${assignTab === 'direct' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-700'}`}
                            onClick={() => setAssignTab('direct')}
                        >직접 입력</button>
                        <button
                            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${assignTab === 'restore' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-700'}`}
                            onClick={() => { setAssignTab('restore'); if (deletedAssignments.length === 0 && !isLoadingDeleted) fetchDeletedAssignments(); }}
                        >삭제 기록에서 불러오기</button>
                    </div>

                    {assignTab === 'direct' ? (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-lg border">
                                <Label className="text-xs font-semibold text-slate-500 whitespace-nowrap w-14">초기 비번</Label>
                                <Input value={slotPasswordModal} onChange={e => setSlotPasswordModal(e.target.value)} className="h-8 flex-1 bg-white text-xs font-mono" />
                                <Button size="sm" variant="outline" className="h-8 px-2.5 text-xs shrink-0" onClick={() => setSlotPasswordModal(generatePassword())}>재생성</Button>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <Label className="text-xs text-slate-500 font-semibold">이름</Label>
                                    <Input value={directForm.buyer_name} onChange={e => setDirectForm(p => ({ ...p, buyer_name: e.target.value }))} className="h-9" placeholder="홍길동" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-slate-500 font-semibold">ID</Label>
                                    <Input value={directForm.qobuz_id} onChange={e => setDirectForm(p => ({ ...p, qobuz_id: e.target.value }))} className="h-9" placeholder="user@yahoo.com" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <Label className="text-xs text-slate-500 font-semibold">Screen Name</Label>
                                    <Input value={directForm.screen_name} onChange={e => setDirectForm(p => ({ ...p, screen_name: e.target.value }))} className="h-9" placeholder="Hong Gil Dong" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-slate-500 font-semibold">TEL</Label>
                                    <Input value={directForm.buyer_phone} onChange={e => setDirectForm(p => ({ ...p, buyer_phone: e.target.value }))} className="h-9" placeholder="010-0000-0000" />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-slate-500 font-semibold">이메일</Label>
                                <Input value={directForm.buyer_email} onChange={e => setDirectForm(p => ({ ...p, buyer_email: e.target.value }))} className="h-9" placeholder="user@email.com" />
                            </div>
                            <div className="grid grid-cols-[1fr_1fr_0.55fr] gap-2">
                                <div className="space-y-1">
                                    <Label className="text-xs text-slate-500 font-semibold">구독 개시</Label>
                                    <Input type="date" value={directForm.start_date} onChange={e => {
                                        const s = e.target.value;
                                        let ne = directForm.end_date;
                                        if (s && directForm.period_months) { try { ne = format(addDays(parseISO(s), directForm.period_months * 30), 'yyyy-MM-dd'); } catch { } }
                                        setDirectForm(p => ({ ...p, start_date: s, end_date: ne }));
                                    }} className="h-9 text-xs px-2" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-slate-500 font-semibold">구독 종료일</Label>
                                    <Input type="date" value={directForm.end_date} onChange={e => {
                                        const ne = e.target.value;
                                        let nm = directForm.period_months;
                                        if (directForm.start_date && ne) { try { nm = Math.max(0, Math.floor(differenceInDays(parseISO(ne), parseISO(directForm.start_date)) / 30)); } catch { } }
                                        setDirectForm(p => ({ ...p, end_date: ne, period_months: nm }));
                                    }} className="h-9 text-xs px-2" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-slate-500 font-semibold">기간</Label>
                                    <Input type="number" value={directForm.period_months || ''} onChange={e => {
                                        const m = parseInt(e.target.value) || 0;
                                        let ne = directForm.end_date;
                                        if (directForm.start_date) { try { ne = format(addDays(parseISO(directForm.start_date), m * 30), 'yyyy-MM-dd'); } catch { } }
                                        setDirectForm(p => ({ ...p, period_months: m, end_date: ne }));
                                    }} className="h-9" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <Label className="text-xs text-slate-500 font-semibold">계약금액</Label>
                                    <Input type="number" value={directForm.amount || ''} onChange={e => setDirectForm(p => ({ ...p, amount: Number(e.target.value) || 0 }))} className="h-9" placeholder={String(DEFAULT_AMOUNT)} />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-slate-500 font-semibold">주문번호 (선택)</Label>
                                    <Input value={directForm.order_number} onChange={e => setDirectForm(p => ({ ...p, order_number: e.target.value }))} className="h-9" placeholder="자유 입력" />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-slate-500 font-semibold">메모 (선택)</Label>
                                <Input value={directForm.memo} onChange={e => setDirectForm(p => ({ ...p, memo: e.target.value }))} className="h-9" />
                            </div>
                            <DialogFooter className="pt-1">
                                <Button variant="outline" onClick={() => setIsAssignModalOpen(false)} className="h-9">취소</Button>
                                <Button onClick={handleDirectAssign} className="h-9 bg-emerald-600 hover:bg-emerald-700">배정하기</Button>
                            </DialogFooter>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <Input placeholder="이름, ID, 이메일로 검색..." className="pl-8 h-9 text-sm" value={deletedSearch} onChange={e => setDeletedSearch(e.target.value)} />
                            </div>
                            <div className="border rounded-xl overflow-hidden bg-white min-h-[180px] max-h-[340px] overflow-y-auto">
                                {isLoadingDeleted ? (
                                    <div className="flex items-center justify-center p-12 text-slate-400 text-sm">
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500 mr-2" /> 불러오는 중...
                                    </div>
                                ) : (() => {
                                    const q = deletedSearch.toLowerCase();
                                    const filtered = deletedAssignments.filter(d =>
                                        !q || (d.buyer_name || '').toLowerCase().includes(q) || (d.qobuz_id || '').toLowerCase().includes(q) || (d.buyer_email || '').toLowerCase().includes(q)
                                    );
                                    if (filtered.length === 0) return <div className="p-12 text-center text-slate-400 text-sm">삭제된 데이터가 없습니다.</div>;
                                    return filtered.map(d => (
                                        <div key={d.id} className="flex items-center justify-between px-3 py-2.5 border-b last:border-0 hover:bg-slate-50">
                                            <div className="min-w-0">
                                                <div className="font-semibold text-sm text-slate-800 truncate">{d.buyer_name || '(이름없음)'}</div>
                                                <div className="text-[10px] text-slate-400 font-mono truncate">
                                                    {d.qobuz_id || '-'} · {d.end_date ? format(parseISO(d.end_date), 'yy-MM-dd') : '-'} · {d.accounts?.login_id || '-'}
                                                </div>
                                            </div>
                                            <Button size="sm" variant="outline" className="ml-2 h-7 px-2.5 text-xs text-blue-600 border-blue-200 hover:bg-blue-50 shrink-0" onClick={() => handleLoadFromDeleted(d)}>
                                                불러오기
                                            </Button>
                                        </div>
                                    ));
                                })()}
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsAssignModalOpen(false)} className="h-9">취소</Button>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* [MODAL: QUICK EDIT] */}
            <Dialog open={isQuickEditModalOpen} onOpenChange={setIsQuickEditModalOpen}>
                <DialogContent className="sm:max-w-[450px] max-h-[92vh] overflow-y-auto">
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
                                    <Label className="text-xs text-slate-500 font-semibold">ID</Label>
                                    <Input value={quickEditValues.qobuz_id || ''} onChange={e => setQuickEditValues({ ...quickEditValues, qobuz_id: e.target.value })} className="h-10" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-slate-500 font-semibold">Screen Name</Label>
                                    <Input value={quickEditValues.screen_name || ''} onChange={e => setQuickEditValues({ ...quickEditValues, screen_name: e.target.value })} className="h-10" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-slate-500 font-semibold">TEL</Label>
                                    <Input value={quickEditValues.buyer_phone || ''} onChange={e => setQuickEditValues({ ...quickEditValues, buyer_phone: e.target.value })} className="h-10" />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs text-slate-500 font-semibold">이메일</Label>
                                <Input value={quickEditValues.buyer_email || ''} onChange={e => setQuickEditValues({ ...quickEditValues, buyer_email: e.target.value })} className="h-10" />
                            </div>
                            <div className="grid grid-cols-[1fr_1.3fr_0.6fr] gap-3">
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-slate-500 font-semibold">구독 개시</Label>
                                    <Input type="date" value={quickEditValues.start_date || ''} onChange={e => {
                                        const ns = e.target.value; let ne = quickEditValues.end_date;
                                        if (ns && quickEditValues.period_months) { try { ne = format(addDays(parseISO(ns), quickEditValues.period_months * 30), 'yyyy-MM-dd'); } catch { } }
                                        setQuickEditValues({ ...quickEditValues, start_date: ns, end_date: ne });
                                    }} className="h-10 text-[11px] px-2" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-slate-500 font-semibold">구독 종료일</Label>
                                    <Input type="date" value={quickEditValues.end_date || ''} onChange={e => {
                                        const ne = e.target.value; let nm = quickEditValues.period_months;
                                        if (quickEditValues.start_date && ne) { try { nm = Math.max(0, Math.floor(differenceInDays(parseISO(ne), parseISO(quickEditValues.start_date)) / 30)); } catch { } }
                                        setQuickEditValues({ ...quickEditValues, end_date: ne, period_months: nm });
                                    }} className="h-10 text-[11px] px-2" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-slate-500 font-semibold">기간</Label>
                                    <Input type="number" value={quickEditValues.period_months || ''} onChange={e => {
                                        // 개월 변경은 "원래 종료일 기준 델타"로 계산한다. 매번 시작일 기준으로 다시 계산하면
                                        // 이미 연장된 건의 종료일이 뒤로 밀린다.
                                        const nextM = parseInt(e.target.value) || 0;
                                        const initialM = initialQuickEditValues?.period_months || 0;
                                        const initialEnd = initialQuickEditValues?.end_date;

                                        let ne = quickEditValues.end_date;
                                        if (initialEnd) {
                                            try { ne = format(addDays(parseISO(initialEnd), (nextM - initialM) * 30), 'yyyy-MM-dd'); } catch { }
                                        } else if (quickEditValues.start_date) {
                                            try { ne = format(addDays(parseISO(quickEditValues.start_date), nextM * 30), 'yyyy-MM-dd'); } catch { }
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
                                                try { ne = format(addDays(parseISO(initialEnd), (nextM - initialM) * 30), 'yyyy-MM-dd'); } catch { }
                                            } else if (quickEditValues.start_date) {
                                                try { ne = format(addDays(parseISO(quickEditValues.start_date), nextM * 30), 'yyyy-MM-dd'); } catch { }
                                            }
                                            setQuickEditValues({ ...quickEditValues, period_months: nextM, end_date: ne });
                                        }}
                                    >+{add}개월</Button>
                                ))}
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs text-slate-500 font-semibold">계약금액(원)</Label>
                                <Input
                                    type="text"
                                    inputMode="numeric"
                                    value={quickEditValues.amount ? quickEditValues.amount.toLocaleString() : ''}
                                    onChange={e => setQuickEditValues({ ...quickEditValues, amount: parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0 })}
                                    className="h-10"
                                    placeholder={String(DEFAULT_AMOUNT)}
                                />
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
                            <div className="font-bold text-slate-800">{selectedAssignment?.buyer_name || '이름 없음'} ({selectedAssignment?.qobuz_id || '-'})</div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-500">이동할 대표계정</Label>
                            <Select onValueChange={setSelectedTargetAccount} value={selectedTargetAccount}>
                                <SelectTrigger className="h-10"><SelectValue placeholder="대표계정 선택" /></SelectTrigger>
                                <SelectContent>
                                    {moveTargets.map(acc => (
                                        <SelectItem key={acc.id} value={acc.id}>
                                            {acc.login_id} · {acc.master_email || '-'} (잔여: {acc.max_slots - acc.used_slots})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        {selectedTargetAccount && (
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-slate-500">대상 슬롯</Label>
                                <Select onValueChange={val => setSelectedTargetSlot(Number(val))} value={selectedTargetSlot?.toString()}>
                                    <SelectTrigger className="h-10"><SelectValue placeholder="슬롯 선택" /></SelectTrigger>
                                    <SelectContent>
                                        {getAvailableSlots(selectedTargetAccount).map(n => (
                                            <SelectItem key={n} value={n.toString()}>
                                                {accounts.find(a => a.id === selectedTargetAccount)?.login_id}-{n + 1}
                                            </SelectItem>
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
                                        {filterTemplatesByScope(emailTemplates, 'qobuz').map(t => (
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
                            const qobuzId = sample?.assignment.qobuz_id || 'sample@yahoo.com';
                            const endDate = sample?.assignment.end_date || '2027.05.02';
                            const html = tmpl?.content
                                ? tmpl.content
                                    .replace(/{buyer_name}/g, buyerName)
                                    .replace(/{qobuz_id}/g, qobuzId)
                                    .replace(/{tidal_id}/g, qobuzId)
                                    .replace(/{end_date}/g, endDate)
                                    .replace(/{message}/g, notificationMessage)
                                : '<div style="padding:24px;color:#999;font-family:sans-serif;text-align:center">템플릿을 선택하면 미리보기가 표시됩니다.</div>';
                            return (
                                <div className="border rounded-xl overflow-hidden shadow-sm">
                                    <div className="bg-slate-100 px-3 py-1.5 text-[10px] text-slate-500 font-mono border-b flex items-center justify-between">
                                        <span>미리보기 — {sample ? `${buyerName} / ${qobuzId} / ${endDate}` : '샘플 데이터'}</span>
                                        {tmpl?.subject && <span className="text-slate-400">제목: {tmpl.subject}</span>}
                                    </div>
                                    <iframe srcDoc={html} className="w-full h-80 bg-white" sandbox="allow-same-origin" />
                                </div>
                            );
                        })()}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsNotifyModalOpen(false)} className="h-10">취소</Button>
                        <Button onClick={handleBulkNotify} disabled={isSendingNotify} className="h-10 bg-sky-600 hover:bg-sky-700 text-white font-bold">
                            {isSendingNotify ? '발송 처리 중...' : '메일 발송하기'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <EmailTemplateModal
                isOpen={isTemplateEditOpen}
                onClose={() => setIsTemplateEditOpen(false)}
                template={emailTemplates.find(t => t.key === selectedTemplateKey) ?? null}
                onSave={fetchTemplates}
            />
        </main>
    );
}
