"use client";

import React, { useEffect, useState } from 'react';
import { useServices } from '@/lib/ServiceContext';
import styles from '../admin.module.css'; // Reusing admin styles
import { useRouter } from 'next/navigation';
import { Trash2, FileText, Search, Download } from 'lucide-react';
import { Input } from '@/components/ui/input';
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
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedMember, setSelectedMember] = useState<Member | null>(null);
    const [memoInput, setMemoInput] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

    const [isMemoOpen, setIsMemoOpen] = useState(false);

    // Accounts Modal State
    const [memberAccounts, setMemberAccounts] = useState<MemberAccount[]>([]);
    const [isAccountsOpen, setIsAccountsOpen] = useState(false);
    const [loadingAccounts, setLoadingAccounts] = useState(false);

    // Resizing logic
    const [columnWidths, setColumnWidths] = useState({
        email: 220,
        joined: 120,
        name: 100,
        birth: 110,
        status: 100,
        phone: 150,
        memo: 300,
        action: 100
    });
    const [isResizing, setIsResizing] = useState<string | null>(null);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing) return;

            const tableElement = document.querySelector(`.${styles.resizableTable}`);
            if (!tableElement) return;

            const thElements = tableElement.querySelectorAll('th');
            const columnKeys = ['email', 'joined', 'name', 'birth', 'status', 'phone', 'memo', 'action'];
            const columnIndex = columnKeys.indexOf(isResizing);

            if (columnIndex !== -1) {
                const th = thElements[columnIndex];
                const newWidth = e.clientX - th.getBoundingClientRect().left;
                if (newWidth > 50) {
                    setColumnWidths(prev => ({
                        ...prev,
                        [isResizing]: newWidth
                    }));
                }
            }
        };

        const handleMouseUp = () => {
            setIsResizing(null);
        };

        if (isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing]);

    const router = useRouter();

    useEffect(() => {
        if (!isAdmin) {
            router.push('/admin');
        } else {
            fetchMembers();
        }
    }, [isAdmin, router]);

    const fetchMembers = async () => {
        setLoading(true);
        try {
            const response = await apiFetch('/api/admin/members');
            if (!response.ok) throw new Error('Failed to fetch members');
            const data = await response.json();
            setMembers(data);
        } catch (error: unknown) {
            console.error('Error fetching members:', error);
        }
        setLoading(false);
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
        setMemoInput(member.memo || "");
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
            // alert('✅ 메모가 저장되었습니다.'); // Optional feedback
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

    const handleExportExcel = () => {
        if (members.length === 0) {
            alert('내보낼 데이터가 없습니다.');
            return;
        }

        const exportData = members.map(m => ({
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

        // Set column widths
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
    };

    const filteredMembers = members.filter(member => {
        const search = searchTerm.toLowerCase();
        const matchesSearch = (
            member.name.toLowerCase().includes(search) ||
            member.email.toLowerCase().includes(search) ||
            (member.phone && member.phone.toLowerCase().includes(search))
        );

        if (statusFilter === 'active') return matchesSearch && member.is_active;
        if (statusFilter === 'inactive') return matchesSearch && !member.is_active;
        return matchesSearch;
    });

    if (!isAdmin) return null;

    return (
        <main className={styles.main}>
            <header className={`${styles.header} glass`}>
                <div className="container">
                    <h1 className={styles.title}>회원 정보 관리</h1>
                </div>
            </header>

            <div className={`${styles.content} container`}>
                <section className={styles.orderSection}>
                    <div className={styles.headerActions} style={{ marginBottom: '20px', justifyContent: 'space-between', gap: '15px' }}>
                        <div className="flex items-center gap-3 flex-1 max-w-2xl">
                            <div className="relative w-full flex-1">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                                <Input
                                    placeholder="이름, 이메일, 연락처로 검색..."
                                    className="pl-10 h-10"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-600 whitespace-nowrap">상태 필터:</span>
                                <select
                                    className="h-10 px-3 py-1 border border-gray-200 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                >
                                    <option value="all">전체</option>
                                    <option value="active">활성</option>
                                    <option value="inactive">비활성</option>
                                </select>
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            className="gap-2 h-10"
                            onClick={handleExportExcel}
                        >
                            <Download size={18} />
                            <span>엑셀</span>
                        </Button>
                    </div>

                    <div className="mb-4 flex items-center justify-between">
                        <div className="text-sm text-gray-500">
                            총 회원수: <span className="font-bold text-blue-600">{members.length}</span>명
                            {(searchTerm || statusFilter !== 'all') && (
                                <span className="ml-2">
                                    (검색/필터 결과: <span className="font-bold">{filteredMembers.length}</span>명)
                                </span>
                            )}
                        </div>
                    </div>

                    <div className={`${styles.tableWrapper} ${styles.desktopOnly}`}>
                        <table className={`${styles.table} ${styles.resizableTable}`}>
                            <thead>
                                <tr>
                                    <th style={{ width: `${columnWidths.email}px` }}>
                                        ID (Email)
                                        <div className={styles.resizer} onMouseDown={() => setIsResizing('email')} />
                                    </th>
                                    <th style={{ width: `${columnWidths.joined}px` }}>
                                        가입일
                                        <div className={styles.resizer} onMouseDown={() => setIsResizing('joined')} />
                                    </th>
                                    <th style={{ width: `${columnWidths.name}px` }}>
                                        이름
                                        <div className={styles.resizer} onMouseDown={() => setIsResizing('name')} />
                                    </th>
                                    <th style={{ width: `${columnWidths.birth}px` }}>
                                        생년월일
                                        <div className={styles.resizer} onMouseDown={() => setIsResizing('birth')} />
                                    </th>
                                    <th style={{ width: `${columnWidths.status}px` }}>
                                        상태
                                        <div className={styles.resizer} onMouseDown={() => setIsResizing('status')} />
                                    </th>
                                    <th style={{ width: `${columnWidths.phone}px` }}>
                                        연락처
                                        <div className={styles.resizer} onMouseDown={() => setIsResizing('phone')} />
                                    </th>
                                    <th style={{ width: `${columnWidths.memo}px` }}>
                                        관리자 메모
                                        <div className={styles.resizer} onMouseDown={() => setIsResizing('memo')} />
                                    </th>
                                    <th className="text-center" style={{ width: `${columnWidths.action}px` }}>
                                        관리
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={8} className="text-center py-8">로딩 중...</td>
                                    </tr>
                                ) : filteredMembers.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="text-center py-8">
                                            {(searchTerm || statusFilter !== 'all') ? '검색/필터 결과가 없습니다.' : '가입된 회원이 없습니다.'}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredMembers.map(member => (
                                        <tr key={member.id}>
                                            <td
                                                className="cursor-pointer text-blue-600 hover:underline text-xs truncate max-w-[220px]"
                                                onClick={() => handleOpenAccounts(member)}
                                                title={`UUID: ${member.id}\n클릭하여 주문 계정 보기`}
                                            >
                                                {member.email}
                                            </td>
                                            <td>{new Date(member.created_at).toLocaleDateString()}</td>
                                            <td className="font-medium">{member.name}</td>
                                            <td className="text-sm">{member.birth_date || '-'}</td>
                                            <td>
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${member.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                                    {member.is_active ? '활성' : '비활성'}
                                                </span>
                                            </td>
                                            <td className="text-sm">{member.phone || '-'}</td>
                                            <td>
                                                <div
                                                    className="w-full truncate cursor-pointer hover:text-blue-600 text-sm"
                                                    onClick={() => openMemoModal(member)}
                                                    title={member.memo || "메모 없음 (클릭하여 추가)"}
                                                >
                                                    {member.memo || <span className="text-gray-300">Empty</span>}
                                                </div>
                                            </td>
                                            <td className="text-center flex items-center justify-center gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-8 w-8 p-0 text-gray-400 hover:text-blue-600"
                                                    title="메모 편집"
                                                    onClick={() => openMemoModal(member)}
                                                >
                                                    <FileText size={16} />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-8 w-8 p-0 text-gray-400 hover:text-red-600"
                                                    title="회원 삭제"
                                                    onClick={() => handleDeleteMember(member)}
                                                >
                                                    <Trash2 size={16} />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card Layout */}
                    <div className={`${styles.orderCards} ${styles.mobileOnly}`}>
                        {loading ? (
                            <div className="text-center py-8">로딩 중...</div>
                        ) : filteredMembers.length === 0 ? (
                            <div className="text-center py-8">
                                {searchTerm ? '검색 결과가 없습니다.' : '가입된 회원이 없습니다.'}
                            </div>
                        ) : (
                            filteredMembers.map(member => (
                                <div key={member.id} className={styles.orderCard}>
                                    <div className={styles.orderCardHeader}>
                                        <div>
                                            <div className={styles.productName}>{member.name}</div>
                                            <div className={styles.orderDate}>가입일: {new Date(member.created_at).toLocaleDateString()}</div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-9 w-9 p-0 bg-gray-50 border border-gray-200"
                                                onClick={() => openMemoModal(member)}
                                            >
                                                <FileText size={16} />
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-9 w-9 p-0 bg-gray-50 border border-gray-200 text-red-500"
                                                onClick={() => handleDeleteMember(member)}
                                            >
                                                <Trash2 size={16} />
                                            </Button>
                                        </div>
                                    </div>
                                    <div className={styles.orderCardContent}>
                                        <div className={styles.memberInfo}>
                                            <div className="flex justify-between py-1 border-b border-gray-50">
                                                <span className="text-gray-500">ID (Email)</span>
                                                <span
                                                    className="text-xs text-blue-600 cursor-pointer truncate max-w-[150px]"
                                                    onClick={() => handleOpenAccounts(member)}
                                                >
                                                    {member.email}
                                                </span>
                                            </div>
                                            <div className="flex justify-between py-1 border-b border-gray-50">
                                                <span className="text-gray-500">이름</span>
                                                <span>{member.name}</span>
                                            </div>
                                            <div className="flex justify-between py-1 border-b border-gray-50">
                                                <span className="text-gray-500">상태</span>
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${member.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                                    {member.is_active ? '활성' : '비활성'}
                                                </span>
                                            </div>
                                            <div className="flex justify-between py-1 border-b border-gray-50">
                                                <span className="text-gray-500">연락처</span>
                                                <span>{member.phone || '-'}</span>
                                            </div>
                                            <div className="flex justify-between py-1 border-b border-gray-50">
                                                <span className="text-gray-500">생년월일</span>
                                                <span>{member.birth_date || '-'}</span>
                                            </div>
                                            <div className="mt-2 text-sm text-gray-600 italic">
                                                <strong>메모:</strong> {member.memo || '없음'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </section>
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

            {/* Accounts List Modal */}
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
