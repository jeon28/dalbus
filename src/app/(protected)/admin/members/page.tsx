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
    ChevronUp 
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

    // Resizing logic
    const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
        email: 200,
        joined: 100,
        name: 100,
        birth: 100,
        status: 60,
        phone: 120,
        memo: 620,
        action: 100
    });
    const startResizing = (id: string, e: React.MouseEvent) => {
        e.preventDefault();

        const startX = e.pageX;
        const startWidth = columnWidths[id];

        const onMouseMove = (moveEvent: MouseEvent) => {
            const currentX = moveEvent.pageX;
            const newWidth = Math.max(50, startWidth + (currentX - startX));
            setColumnWidths((prev: Record<string, number>) => ({ ...prev, [id]: newWidth }));
        };

        const onMouseUp = () => {
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

    const handleOpenAccounts = async (member: Member) => {
        setSelectedMember(member);
        setIsAccountsOpen(true);
        setLoadingAccounts(true);
        setMemberAccounts([]);

        try {
            const res = await apiFetch(`/api/admin/members/${member.id}/accounts`);
            if (!res.ok) throw new Error('Failed to fetch accounts');
            const data = await res.json();
            setMemberAccounts(data);
        } catch (error) {
            console.error('Error fetching accounts:', error);
            alert('주문 계정 정보를 불러오는데 실패했습니다.');
        } finally {
            setLoadingAccounts(false);
        }
    };

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
                        <table className={`${styles.table} ${styles.resizableTable} text-xs mx-auto`} style={{ width: '1400px', minWidth: '1400px' }}>
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
                                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-blue-600" onClick={() => openMemoModal(member)}>
                                                        <FileText className="w-4 h-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-red-500" onClick={() => handleDeleteMember(member)}>
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
                            {selectedMember?.name} 회원의 메모를 수정합니다. (ID: {selectedMember?.email})
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
                                            <th className="px-4 py-2 text-center">Slot</th>
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
                                                        #{account.slot_number + 1}
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
        </main>
    );

}
