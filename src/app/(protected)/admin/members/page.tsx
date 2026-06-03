"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useServices } from '@/lib/ServiceContext';
import styles from '../admin.module.css'; // Reusing admin styles
import { useRouter } from 'next/navigation';
import {
    Trash2,
    FileText,
    Search,
    Download,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    ChevronDown,
    ChevronUp,
    Monitor,
    Eye,
    EyeOff
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

export interface Member {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    birth_date: string | null;
    created_at: string;
    memo?: string | null;
    is_active: boolean;
    signup_method?: string | null;
}

interface MemberAccount {
    id: string;
    tidal_id: string | null;
    tidal_password: string | null;
    slot_number: number;
    assigned_at: string | null;
    start_date: string | null;
    end_date: string | null;
    orders: {
        products: {
            name: string;
        } | null;
        product_plans: {
            duration_months: number;
        } | null;
    } | null;
    accounts?: {
        login_id: string | null;
    } | null;
}

interface MypageSub {
    service_name: string;
    duration: string;
    start_date: string;
    end_date: string;
    account_id: string;
    account_pw: string;
    order_number: string;
    order_id: string;
}

interface MypageOrder {
    id: string;
    order_number: string;
    product_name: string;
    plan_name: string;
    amount: number;
    created_at: string;
    assignment_status: string;
}

export default function MemberListPage() {
    const { isAdmin } = useServices();
    const router = useRouter();
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedMember, setSelectedMember] = useState<Member | null>(null);
    const [memoInput, setMemoInput] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

    const [isMemoOpen, setIsMemoOpen] = useState(false);
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

    // Pagination State
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(25);
    const [pagination, setPagination] = useState({
        total: 0,
        page: 1,
        limit: 25,
        totalPages: 0
    });

    // Accounts Modal State
    const [memberAccounts, setMemberAccounts] = useState<MemberAccount[]>([]);
    const [isAccountsOpen, setIsAccountsOpen] = useState(false);
    const [loadingAccounts, setLoadingAccounts] = useState(false);
    const [assignInput, setAssignInput] = useState("");
    const [assigning, setAssigning] = useState(false);

    // MyPage Preview Modal State (회원이 보는 마이페이지 그대로)
    const [isMypageOpen, setIsMypageOpen] = useState(false);
    const [loadingMypage, setLoadingMypage] = useState(false);
    const [mypageProfile, setMypageProfile] = useState<{ name?: string; email?: string; phone?: string | null; birth_date?: string | null } | null>(null);
    const [mypageSubs, setMypageSubs] = useState<MypageSub[]>([]);
    const [mypageOrders, setMypageOrders] = useState<MypageOrder[]>([]);
    const [visiblePws, setVisiblePws] = useState<Record<string, boolean>>({});
    const [orderLinkInput, setOrderLinkInput] = useState("");
    const [linkingOrder, setLinkingOrder] = useState(false);

    // Resizing logic
    const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
        email: 200,
        joined: 100,
        signupMethod: 80,
        name: 100,
        birth: 100,
        status: 60,
        phone: 120,
        memo: 400,
        action: 100
    });

    useEffect(() => {
        const savedWidths = localStorage.getItem('memberListColumnWidths');
        if (savedWidths) {
            try {
                setColumnWidths(JSON.parse(savedWidths));
            } catch (e) {
                console.error('Failed to parse saved column widths:', e);
            }
        }
    }, []);

    const startResizing = (id: string, e: React.MouseEvent) => {
        e.preventDefault();

        const startX = e.pageX;
        const startWidth = columnWidths[id];
        let currentWidth = startWidth;

        const onMouseMove = (moveEvent: MouseEvent) => {
            const currentX = moveEvent.pageX;
            currentWidth = Math.max(50, startWidth + (currentX - startX));
            setColumnWidths((prev: Record<string, number>) => ({ ...prev, [id]: currentWidth }));
        };

        const onMouseUp = () => {
            localStorage.setItem('memberListColumnWidths', JSON.stringify({ ...columnWidths, [id]: currentWidth }));
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    useEffect(() => {
        if (!isAdmin) {
            router.push('/admin');
        }
    }, [isAdmin, router]);



    const fetchMembers = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (searchTerm) params.append('search', searchTerm);
            if (statusFilter !== 'all') params.append('status', statusFilter);
            params.append('page', page.toString());
            params.append('limit', limit.toString());
            if (sortConfig) {
                params.append('sort', sortConfig.key);
                params.append('direction', sortConfig.direction);
            }

            const response = await apiFetch(`/api/admin/members?${params.toString()}`);
            if (response.ok) {
                const result = await response.json();
                setMembers(result.data);
                setPagination(result.pagination);
            }
        } catch (error: unknown) {
            console.error('Error fetching members:', error);
        }
        setLoading(false);
    }, [searchTerm, statusFilter, sortConfig, page, limit]);

    // Reset page to 1 when search or filter changes
    useEffect(() => {
        setPage(1);
    }, [searchTerm, statusFilter]);

    useEffect(() => {
        if (isAdmin) {
            const timer = setTimeout(() => {
                fetchMembers();
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [isAdmin, fetchMembers]);

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const handleDeleteMember = async (member: Member) => {
        if (!confirm(`'${member.name}' (${member.email}) 회원을 삭제하시겠습니까?\n\n주의: 이 작업은 되돌릴 수 없습니다.`)) {
            return;
        }

        try {
            const response = await apiFetch(`/api/admin/members?id=${member.id}`, {
                method: 'DELETE'
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || '삭제 실패');
            }

            alert('✅ ' + result.message);
            fetchMembers(); // Refresh the list
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
            alert('❌ ' + message);
        }
    };

    const openMemoModal = (member: Member) => {
        setSelectedMember(member);
        const now = new Date();
        const yy = String(now.getFullYear()).slice(-2);
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2, '0');
        const mins = String(now.getMinutes()).padStart(2, '0');
        const timestamp = `${yy}/${mm}/${dd} ${hh}:${mins} `;
        
        let newMemo = member.memo || "";
        if (newMemo) {
            newMemo = timestamp + "\n" + newMemo;
        } else {
            newMemo = timestamp;
        }
        
        setMemoInput(newMemo);
        setIsMemoOpen(true);
    };

    const handleSaveMemo = async () => {
        if (!selectedMember) return;

        try {
            const response = await apiFetch('/api/admin/members', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: selectedMember.id, memo: memoInput })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || '메모 업데이트 실패');
            }

            // Update local state
            setMembers(members.map(m =>
                m.id === selectedMember.id ? { ...m, memo: memoInput } : m
            ));
            setIsMemoOpen(false);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
            alert('❌ ' + message);
        }
    };

    const loadMemberAccounts = useCallback(async (memberId: string) => {
        setLoadingAccounts(true);
        try {
            const res = await apiFetch(`/api/admin/members/${memberId}/accounts`);
            if (!res.ok) throw new Error('Failed to fetch accounts');
            const data = await res.json();
            setMemberAccounts(data);
        } catch (error) {
            console.error('Error fetching accounts:', error);
            alert('주문 계정 정보를 불러오는데 실패했습니다.');
        } finally {
            setLoadingAccounts(false);
        }
    }, []);

    const handleOpenAccounts = async (member: Member) => {
        setSelectedMember(member);
        setIsAccountsOpen(true);
        setMemberAccounts([]);
        setAssignInput("");
        await loadMemberAccounts(member.id);
    };

    const handleForceAssign = async () => {
        if (!selectedMember || !assignInput.trim() || assigning) return;
        setAssigning(true);
        try {
            const res = await apiFetch(`/api/admin/members/${selectedMember.id}/accounts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ assignmentNumber: assignInput.trim() })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || '연결에 실패했습니다.');
            alert('✅ ' + (data.message || '연결되었습니다.'));
            setAssignInput("");
            await loadMemberAccounts(selectedMember.id);
        } catch (error) {
            alert('❌ ' + (error instanceof Error ? error.message : '연결에 실패했습니다.'));
        } finally {
            setAssigning(false);
        }
    };

    // 회원이 보는 마이페이지 미리보기
    const loadMypage = useCallback(async (memberId: string) => {
        setLoadingMypage(true);

        type ProdRel = { name?: string } | null;
        type PlanRel = { duration_months?: number } | null;
        interface RawOrder { id: string; order_number: string; amount: number; created_at: string; assignment_status: string; products?: ProdRel; product_plans?: PlanRel; }
        interface RawAssign { id: string; order_id?: string | null; order_number?: string | null; tidal_id?: string | null; tidal_password?: string | null; account_pw?: string | null; account_id?: string | null; start_date?: string | null; end_date?: string | null; orders?: { order_number?: string | null; products?: ProdRel; product_plans?: PlanRel } | null; }

        try {
            const res = await apiFetch(`/api/admin/members/${memberId}/mypage`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || '불러오기 실패');

            setMypageProfile(data.profile || null);

            const subs: MypageSub[] = (data.assignments as RawAssign[] || []).map((a) => ({
                service_name: a.orders?.products?.name || 'Service',
                duration: a.orders?.product_plans?.duration_months ? `${a.orders.product_plans.duration_months}개월` : '-',
                start_date: a.start_date || '-',
                end_date: a.end_date || '-',
                account_id: a.tidal_id || a.account_id || '정보 없음',
                account_pw: a.tidal_password || a.account_pw || '정보 없음',
                order_number: a.orders?.order_number || a.order_number || '',
                order_id: a.order_id || a.id,
            }));
            setMypageSubs(subs);

            const ords: MypageOrder[] = (data.orders as RawOrder[] || []).map((o) => ({
                id: o.id,
                order_number: o.order_number,
                product_name: o.products?.name || 'Service',
                plan_name: o.product_plans?.duration_months ? `${o.product_plans.duration_months}개월` : '-',
                amount: o.amount,
                created_at: o.created_at,
                assignment_status: o.assignment_status,
            }));
            setMypageOrders(ords);
        } catch (error) {
            alert('❌ ' + (error instanceof Error ? error.message : '마이페이지 정보를 불러오지 못했습니다.'));
            setIsMypageOpen(false);
        } finally {
            setLoadingMypage(false);
        }
    }, []);

    const handleOpenMypage = async (member: Member) => {
        setSelectedMember(member);
        setIsMypageOpen(true);
        setMypageProfile(null);
        setMypageSubs([]);
        setMypageOrders([]);
        setVisiblePws({});
        setOrderLinkInput("");
        await loadMypage(member.id);
    };

    const handleLinkOrder = async () => {
        if (!selectedMember || !orderLinkInput.trim() || linkingOrder) return;
        setLinkingOrder(true);
        try {
            const res = await apiFetch(`/api/admin/members/${selectedMember.id}/mypage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderNumber: orderLinkInput.trim() })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || '연동에 실패했습니다.');
            alert('✅ ' + (data.message || '연동되었습니다.'));
            setOrderLinkInput("");
            await loadMypage(selectedMember.id);
        } catch (error) {
            alert('❌ ' + (error instanceof Error ? error.message : '연동에 실패했습니다.'));
        } finally {
            setLinkingOrder(false);
        }
    };

    const orderStatusLabel = (s: string) => {
        if (s === 'completed') return '이용중';
        if (s === 'assigned') return '배정완료';
        if (s === 'waiting') return '대기중';
        return s || '-';
    };

    const togglePw = (key: string) => setVisiblePws(prev => ({ ...prev, [key]: !prev[key] }));

    const handleExportExcel = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (searchTerm) params.append('search', searchTerm);
            if (statusFilter !== 'all') params.append('status', statusFilter);
            params.append('page', '1');
            params.append('limit', '10000'); // Fetch enough for general export
            if (sortConfig) {
                params.append('sort', sortConfig.key);
                params.append('direction', sortConfig.direction);
            }

            const response = await apiFetch(`/api/admin/members?${params.toString()}`);
            if (!response.ok) throw new Error('Failed to fetch data for export');
            
            const result = await response.json();
            const allMembers = result.data;

            if (!allMembers || allMembers.length === 0) {
                alert('내보낼 데이터가 없습니다.');
                return;
            }

            const exportData = allMembers.map((m: Member) => ({
                'ID': m.email,
                '가입일': new Date(m.created_at).toLocaleDateString(),
                '가입경로': m.signup_method || 'email',
                '이름': m.name,
                '생년월일': m.birth_date || '-',
                '이메일': m.email,
                '연락처': m.phone || '-',
                '상태': m.is_active ? '활성' : '비활성',
                '메모': m.memo || ''
            }));

            const worksheet = XLSX.utils.json_to_sheet(exportData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Members");

            const wscols = [
                { wch: 30 }, // ID (email)
                { wch: 15 }, // 가입일
                { wch: 15 }, // 이름
                { wch: 15 }, // 생년월일
                { wch: 30 }, // 이메일
                { wch: 20 }, // 연락처
                { wch: 10 }, // 상태
                { wch: 40 }, // 메모
            ];
            worksheet['!cols'] = wscols;

            XLSX.writeFile(workbook, `dalbus_members_${new Date().toISOString().split('T')[0]}.xlsx`);
        } catch (error) {
            console.error('Export error:', error);
            alert('엑셀 내보내기 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
            fetchMembers(); // Refresh current page view
        }
    };


    if (!isAdmin) return null;

    return (
        <main className={styles.main}>
            <header className={`${styles.header} glass`}>
                <div className="container flex justify-between items-center bg-white/50 py-2 rounded-lg">
                    <div className="flex items-center gap-4">
                        <h1 className={styles.title}>회원 정보 관리</h1>
                        <div className="flex items-center gap-2 bg-white/80 rounded-full px-4 py-1.5 shadow-sm border border-slate-200">
                            <Search className="w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="이름, 이메일, 연락처 검색..."
                                className="bg-transparent border-none outline-none text-sm w-64 placeholder:text-slate-400"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <select
                            className="text-sm border rounded-md px-2 py-1 bg-white/80 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="all">전체 상태</option>
                            <option value="active">활성</option>
                            <option value="inactive">비활성</option>
                        </select>
                        <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-2 bg-white/80 hover:bg-white text-slate-600">
                            <Download className="w-4 h-4" />
                            엑셀 내보내기
                        </Button>
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-x-auto p-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className={`${styles.table} ${styles.resizableTable} text-xs mx-auto`} style={{ width: '100%', minWidth: '1000px' }}>
                            <thead className="bg-gray-100 border-b">
                                <tr>
                                    <th style={{ width: columnWidths.email }} className="relative group p-3 text-xs font-bold text-gray-600 uppercase">
                                        <div className="flex items-center gap-2 cursor-pointer select-none" onClick={() => handleSort('email')}>
                                            아이디(이메일)
                                            {sortConfig?.key === 'email' && (
                                                sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                                            )}
                                        </div>
                                        <div onMouseDown={(e) => startResizing('email', e)} className={styles.resizer} />
                                    </th>
                                    <th style={{ width: columnWidths.joined }} className="relative group p-3 text-xs font-bold text-gray-600 uppercase">
                                        <div className="flex items-center gap-2 cursor-pointer select-none" onClick={() => handleSort('created_at')}>
                                            가입일
                                            {sortConfig?.key === 'created_at' && (
                                                sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                                            )}
                                        </div>
                                        <div onMouseDown={(e) => startResizing('joined', e)} className={styles.resizer} />
                                    </th>
                                    <th style={{ width: columnWidths.signupMethod }} className="relative group p-3 text-xs font-bold text-gray-600 uppercase">
                                        <div className="flex items-center gap-2 cursor-pointer select-none">가입경로</div>
                                        <div onMouseDown={(e) => startResizing('signupMethod', e)} className={styles.resizer} />
                                    </th>
                                    <th style={{ width: columnWidths.name }} className="relative group p-3 text-xs font-bold text-gray-600 uppercase">
                                        <div className="flex items-center gap-2 cursor-pointer select-none" onClick={() => handleSort('name')}>
                                            이름
                                            {sortConfig?.key === 'name' && (
                                                sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                                            )}
                                        </div>
                                        <div onMouseDown={(e) => startResizing('name', e)} className={styles.resizer} />
                                    </th>
                                    <th style={{ width: columnWidths.birth }} className="relative group p-3 text-xs font-bold text-gray-600 uppercase">
                                        <div className="flex items-center gap-2 cursor-pointer select-none" onClick={() => handleSort('birth_date')}>
                                            생년월일
                                            {sortConfig?.key === 'birth_date' && (
                                                sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                                            )}
                                        </div>
                                        <div onMouseDown={(e) => startResizing('birth', e)} className={styles.resizer} />
                                    </th>
                                    <th style={{ width: columnWidths.phone }} className="relative group p-3 text-xs font-bold text-gray-600 uppercase">
                                        <div className="flex items-center gap-2 cursor-pointer select-none">연락처</div>
                                        <div onMouseDown={(e) => startResizing('phone', e)} className={styles.resizer} />
                                    </th>
                                    <th style={{ width: columnWidths.status }} className="relative group p-3 text-xs font-bold text-gray-600 uppercase text-center">
                                        <div className="cursor-pointer select-none" onClick={() => handleSort('is_active')}>
                                            상태
                                            {sortConfig?.key === 'is_active' && (
                                                sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 inline ml-1" /> : <ChevronDown className="w-3 h-3 inline ml-1" />
                                            )}
                                        </div>
                                        <div onMouseDown={(e) => startResizing('status', e)} className={styles.resizer} />
                                    </th>
                                    <th style={{ width: columnWidths.memo }} className="relative group p-3 text-xs font-bold text-gray-600 uppercase">
                                        <div className="cursor-pointer select-none" onClick={() => handleSort('memo')}>
                                            메모
                                            {sortConfig?.key === 'memo' && (
                                                sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 inline ml-1" /> : <ChevronDown className="w-3 h-3 inline ml-1" />
                                            )}
                                        </div>
                                        <div onMouseDown={(e) => startResizing('memo', e)} className={styles.resizer} />
                                    </th>
                                    <th style={{ width: columnWidths.action }} className="relative group p-3 text-xs font-bold text-gray-600 uppercase text-center">
                                        관리
                                        <div onMouseDown={(e) => startResizing('action', e)} className={styles.resizer} />
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan={8} className="text-center py-20 text-slate-400">
                                            회원 정보를 불러오는 중...
                                        </td>
                                    </tr>
                                ) : members.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="text-center py-20 text-slate-400">
                                            등록된 회원이 없습니다.
                                        </td>
                                    </tr>
                                ) : (
                                    members.map((member) => (
                                        <tr key={member.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-3 text-xs text-blue-600 hover:underline cursor-pointer truncate" onClick={() => handleOpenAccounts(member)}>
                                                {member.email}
                                            </td>
                                            <td className="p-3 text-xs text-slate-600">
                                                {new Date(member.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="p-3 text-xs text-center">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                    member.signup_method === 'google' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 
                                                    member.signup_method === 'kakao' ? 'bg-yellow-50 text-yellow-700 border border-yellow-100' : 
                                                    'bg-slate-50 text-slate-600 border border-slate-100'
                                                }`}>
                                                    {member.signup_method === 'google' ? 'Google' : 
                                                     member.signup_method === 'kakao' ? 'Kakao' : 'Email'}
                                                </span>
                                            </td>
                                            <td className="p-3 text-xs font-medium text-slate-800">
                                                {member.name}
                                            </td>
                                            <td className="p-3 text-xs text-slate-600">
                                                {member.birth_date || '-'}
                                            </td>
                                            <td className="p-3 text-xs text-slate-600">
                                                {member.phone || '-'}
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${member.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                                    {member.is_active ? '활성' : '비활성'}
                                                </span>
                                            </td>
                                            <td className="p-3">
                                                <div
                                                    className="w-full cursor-pointer hover:text-blue-600 text-[11px] text-gray-500"
                                                    onClick={() => openMemoModal(member)}
                                                    title={member.memo || ''}
                                                >
                                                    {member.memo ? (
                                                        member.memo.length > 40 
                                                            ? `${member.memo.substring(0, 40)}...` 
                                                            : member.memo
                                                    ) : (
                                                        <span className="text-slate-300 italic">메모 없음</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-3 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-green-600" title="회원 마이페이지 미리보기" onClick={() => handleOpenMypage(member)}>
                                                        <Monitor className="w-4 h-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-blue-600" title="메모" onClick={() => openMemoModal(member)}>
                                                        <FileText className="w-4 h-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-red-500" title="삭제" onClick={() => handleDeleteMember(member)}>
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination UI */}
                    <div className="px-6 py-4 bg-gray-50/50 border-t flex flex-col sm:grid sm:grid-cols-3 items-center gap-4 sm:gap-0">
                        {/* Limit Selector (Left) */}
                        <div className="flex items-center gap-2 justify-self-start">
                            <span className="text-xs text-gray-500 whitespace-nowrap">페이지당 표시:</span>
                            <Select
                                value={limit.toString()}
                                onValueChange={(val) => {
                                    setLimit(parseInt(val));
                                    setPage(1);
                                }}
                            >
                                <SelectTrigger className="h-8 w-[70px] bg-white border-gray-200">
                                    <SelectValue placeholder={limit.toString()} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="25">25</SelectItem>
                                    <SelectItem value="50">50</SelectItem>
                                    <SelectItem value="100">100</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Navigation Buttons (Center) */}
                        <div className="flex items-center gap-1 justify-self-center">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(1)}
                                disabled={page === 1}
                                className="h-8 w-8 p-0 bg-white border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                                title="첫 페이지"
                            >
                                <ChevronsLeft className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(prev => Math.max(1, prev - 1))}
                                disabled={page === 1}
                                className="h-8 w-8 p-0 bg-white border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            
                            {/* Page Numbers */}
                            <div className="flex items-center gap-1 mx-2">
                                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                                    let pageNum;
                                    if (pagination.totalPages <= 5) {
                                        pageNum = i + 1;
                                    } else {
                                        const start = Math.max(1, Math.min(page - 2, pagination.totalPages - 4));
                                        pageNum = start + i;
                                    }
                                    
                                    return (
                                        <Button
                                            key={pageNum}
                                            variant={page === pageNum ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => setPage(pageNum)}
                                            className={`h-8 w-8 p-0 text-xs ${page === pageNum ? "bg-blue-600 hover:bg-blue-700" : "bg-white border-gray-200 hover:bg-gray-50"}`}
                                        >
                                            {pageNum}
                                        </Button>
                                    );
                                })}
                            </div>

                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(prev => Math.min(pagination.totalPages, prev + 1))}
                                disabled={page === pagination.totalPages || pagination.totalPages === 0}
                                className="h-8 w-8 p-0 bg-white border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(pagination.totalPages)}
                                disabled={page === pagination.totalPages || pagination.totalPages === 0}
                                className="h-8 w-8 p-0 bg-white border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                                title="마지막 페이지"
                            >
                                <ChevronsRight className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Total Count Label (Right) */}
                        <div className="text-xs text-gray-500 justify-self-end">
                            전체 <span className="font-medium text-gray-900">{pagination.total}</span>개의 항목
                        </div>
                    </div>
                </div>
            </div>

            <Dialog open={isMemoOpen} onOpenChange={setIsMemoOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>관리자 메모 편집</DialogTitle>
                        <DialogDescription>
                            {selectedMember?.name} 회원의 메모를 수정합니다. ({selectedMember?.email})
                            이 내용은 관리자에게만 보여집니다.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <Textarea
                            placeholder="메모를 입력하세요..."
                            value={memoInput}
                            onChange={(e) => setMemoInput(e.target.value)}
                            rows={10}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsMemoOpen(false)}>취소</Button>
                        <Button onClick={handleSaveMemo}>저장</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isAccountsOpen} onOpenChange={setIsAccountsOpen}>
                <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>주문 계정 목록 - {selectedMember?.name}</DialogTitle>
                        <DialogDescription>
                            이 회원이 주문한 계정 목록입니다.
                        </DialogDescription>
                    </DialogHeader>

                    {/* 배정번호로 강제 연결 */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg border border-blue-100 bg-blue-50/60 p-3">
                        <span className="text-xs font-semibold text-blue-800 shrink-0">배정번호 강제 지정</span>
                        <input
                            type="text"
                            value={assignInput}
                            onChange={(e) => setAssignInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleForceAssign(); }}
                            placeholder="예: TG001-5"
                            className="flex-1 h-8 px-3 rounded-md border border-blue-200 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-400"
                        />
                        <Button size="sm" onClick={handleForceAssign} disabled={assigning || !assignInput.trim()} className="shrink-0">
                            {assigning ? '연결 중...' : '이 회원에 연결'}
                        </Button>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">
                        배정번호(로그인ID-슬롯)를 입력하면 해당 배정을 이 회원 이메일로 연결합니다.
                    </p>

                    <div className="py-4">
                        {loadingAccounts ? (
                            <div className="text-center py-8">로딩 중...</div>
                        ) : memberAccounts.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">주문 내역이 없습니다.</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-2 text-left">Tidal ID</th>
                                            <th className="px-4 py-2 text-left">상품명</th>
                                            <th className="px-4 py-2 text-center">개월수</th>
                                            <th className="px-4 py-2 text-center">시작일</th>
                                            <th className="px-4 py-2 text-center">종료일</th>
                                            <th className="px-4 py-2 text-center">배정번호</th>
                                            <th className="px-4 py-2 text-center">상태</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {memberAccounts.map((account) => {
                                            const isActive = account.end_date ? new Date(account.end_date) > new Date() : false;
                                            return (
                                                <tr key={account.id} className="hover:bg-gray-50">
                                                    <td className="px-4 py-3 font-medium">{account.tidal_id || '-'}</td>
                                                    <td className="px-4 py-3 text-gray-600">
                                                        {account.orders?.products?.name || '-'}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        {account.orders?.product_plans?.duration_months ? `${account.orders.product_plans.duration_months}개월` : '-'}
                                                    </td>
                                                    <td className="px-4 py-3 text-center text-gray-500">
                                                        {account.start_date ? new Date(account.start_date).toLocaleDateString() : '-'}
                                                    </td>
                                                    <td className="px-4 py-3 text-center text-gray-500">
                                                        {account.end_date ? new Date(account.end_date).toLocaleDateString() : '-'}
                                                    </td>
                                                    <td className="px-4 py-3 text-center font-bold text-gray-400">
                                                        {account.accounts?.login_id ? `${account.accounts.login_id} - #${account.slot_number + 1}` : `#${account.slot_number + 1}`}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                                            {isActive ? '활성' : '만료'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button onClick={() => setIsAccountsOpen(false)}>닫기</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 회원 마이페이지 미리보기 (회원이 보는 그대로, 읽기전용) */}
            <Dialog open={isMypageOpen} onOpenChange={setIsMypageOpen}>
                <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>회원 마이페이지 미리보기 - {selectedMember?.name}</DialogTitle>
                        <DialogDescription>
                            이 회원이 마이페이지에서 보는 화면입니다. (읽기전용)
                        </DialogDescription>
                    </DialogHeader>

                    {/* 주문번호로 강제 연동 (주문이 회원과 연결 안 된 경우) */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                        <span className="text-xs font-semibold text-amber-800 shrink-0">주문번호 강제 연동</span>
                        <input
                            type="text"
                            value={orderLinkInput}
                            onChange={(e) => setOrderLinkInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleLinkOrder(); }}
                            placeholder="예: 06060201"
                            className="flex-1 h-8 px-3 rounded-md border border-amber-200 bg-white text-sm outline-none focus:ring-2 focus:ring-amber-400"
                        />
                        <Button size="sm" onClick={handleLinkOrder} disabled={linkingOrder || !orderLinkInput.trim()} className="shrink-0">
                            {linkingOrder ? '연동 중...' : '이 회원에 연동'}
                        </Button>
                    </div>
                    <p className="text-[11px] text-gray-400 -mt-1">
                        주문이 회원과 연결되지 않은 경우, 주문번호를 입력하면 해당 주문을 이 회원 계정에 연동합니다.
                    </p>

                    {loadingMypage ? (
                        <div className="text-center py-12 text-gray-500">로딩 중...</div>
                    ) : (
                        <div className="space-y-6 py-2">
                            {/* 개인정보 */}
                            <section className="bg-slate-50 border rounded-xl p-5">
                                <h3 className="text-sm font-bold mb-3 flex items-center gap-2">👤 개인정보</h3>
                                <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
                                    <div><span className="text-xs text-gray-400 block">이메일</span>{mypageProfile?.email || '-'}</div>
                                    <div><span className="text-xs text-gray-400 block">이름</span>{mypageProfile?.name || '-'}</div>
                                    <div><span className="text-xs text-gray-400 block">생년월일</span>{mypageProfile?.birth_date || '-'}</div>
                                    <div><span className="text-xs text-gray-400 block">연락처</span>{mypageProfile?.phone || '-'}</div>
                                </div>
                            </section>

                            {/* 내 구독 정보 */}
                            <section>
                                <h3 className="text-sm font-bold mb-3 flex items-center gap-2">🎧 내 구독 정보</h3>
                                {mypageSubs.length > 0 ? (
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        {mypageSubs.map((sub, idx) => (
                                            <div key={idx} className="bg-primary/5 border border-primary/10 p-4 rounded-xl space-y-2">
                                                <div className="flex justify-between items-start">
                                                    <h4 className="font-bold">{sub.service_name}</h4>
                                                    <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-bold">이용 중</span>
                                                </div>
                                                <div className="text-xs space-y-0.5 text-gray-500">
                                                    <p>기간: {sub.start_date} ~ {sub.end_date} ({sub.duration})</p>
                                                    <p>만료일: {sub.end_date}</p>
                                                    {sub.order_number && <p>주문번호: {sub.order_number.replace(/^DAL-/, '')}</p>}
                                                </div>
                                                <div className="bg-white/60 p-2.5 rounded-lg text-sm font-mono space-y-1 border">
                                                    <div className="flex justify-between">
                                                        <span className="text-xs text-gray-400">ID:</span>
                                                        <span className="font-bold">{sub.account_id}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-xs text-gray-400">PW:</span>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-bold tracking-widest">
                                                                {visiblePws[sub.order_id] ? sub.account_pw : '●●●●●●'}
                                                            </span>
                                                            <button type="button" onClick={() => togglePw(sub.order_id)} className="text-gray-400 hover:text-gray-700">
                                                                {visiblePws[sub.order_id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-6 text-gray-400 text-sm border rounded-xl">이용 중인 구독이 없습니다.</div>
                                )}
                            </section>

                            {/* 주문 이력 */}
                            <section>
                                <h3 className="text-sm font-bold mb-3 flex items-center gap-2">🧾 주문 이력</h3>
                                {mypageOrders.length > 0 ? (
                                    <div className="overflow-x-auto border rounded-xl">
                                        <table className="w-full text-sm">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-3 py-2 text-left">주문번호</th>
                                                    <th className="px-3 py-2 text-left">상품</th>
                                                    <th className="px-3 py-2 text-center">기간</th>
                                                    <th className="px-3 py-2 text-right">금액</th>
                                                    <th className="px-3 py-2 text-center">주문일</th>
                                                    <th className="px-3 py-2 text-center">상태</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {mypageOrders.map((o) => (
                                                    <tr key={o.id} className="hover:bg-gray-50">
                                                        <td className="px-3 py-2">{o.order_number?.replace(/^DAL-/, '') || '-'}</td>
                                                        <td className="px-3 py-2 text-gray-600">{o.product_name}</td>
                                                        <td className="px-3 py-2 text-center">{o.plan_name}</td>
                                                        <td className="px-3 py-2 text-right">₩{o.amount?.toLocaleString()}</td>
                                                        <td className="px-3 py-2 text-center text-gray-500">{new Date(o.created_at).toLocaleDateString()}</td>
                                                        <td className="px-3 py-2 text-center">{orderStatusLabel(o.assignment_status)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="text-center py-6 text-gray-400 text-sm border rounded-xl">주문 이력이 없습니다.</div>
                                )}
                            </section>
                        </div>
                    )}

                    <DialogFooter>
                        <Button onClick={() => setIsMypageOpen(false)}>닫기</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </main>
    );

}
