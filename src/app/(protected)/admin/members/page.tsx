"use client";

import React, { useEffect, useState } from 'react';
import { useServices } from '@/lib/ServiceContext';
import styles from '../admin.module.css'; // Reusing admin styles
import { useRouter } from 'next/navigation';
import { Trash2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
    created_at: string;
    memo?: string | null;
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

    const [isMemoOpen, setIsMemoOpen] = useState(false);

    // Accounts Modal State
    const [memberAccounts, setMemberAccounts] = useState<MemberAccount[]>([]);
    const [isAccountsOpen, setIsAccountsOpen] = useState(false);
    const [loadingAccounts, setLoadingAccounts] = useState(false);

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
            const response = await fetch('/api/admin/members');
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
            const response = await fetch(`/api/admin/members?id=${member.id}`, {
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
            const response = await fetch('/api/admin/members', {
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
            const res = await fetch(`/api/admin/members/${member.id}/accounts`);
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
                    <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>가입일</th>
                                    <th>이름</th>
                                    <th>이메일</th>
                                    <th>연락처</th>
                                    <th>관리자 메모</th>
                                    <th className="text-center" style={{ width: '100px' }}>관리</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="text-center py-8">로딩 중...</td>
                                    </tr>
                                ) : members.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="text-center py-8">가입된 회원이 없습니다.</td>
                                    </tr>
                                ) : (
                                    members.map(member => (
                                        <tr key={member.id}>
                                            <td
                                                className="cursor-pointer text-blue-600 hover:underline font-mono text-xs"
                                                onClick={() => handleOpenAccounts(member)}
                                                title="클릭하여 주문 계정 보기"
                                            >
                                                {member.id.substring(0, 8)}...
                                            </td>
                                            <td>{new Date(member.created_at).toLocaleDateString()}</td>
                                            <td className="font-medium">{member.name}</td>
                                            <td>{member.email}</td>
                                            <td>{member.phone || '-'}</td>
                                            <td>
                                                <div
                                                    className="max-w-[200px] truncate cursor-pointer hover:text-blue-600"
                                                    onClick={() => openMemoModal(member)}
                                                    title={member.memo || "메모 없음 (클릭하여 추가)"}
                                                >
                                                    {member.memo || <span className="text-gray-400 text-sm">Empty</span>}
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
                </section>
            </div>

            <Dialog open={isMemoOpen} onOpenChange={setIsMemoOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>관리자 메모 편집</DialogTitle>
                        <DialogDescription>
                            {selectedMember?.name} ({selectedMember?.email}) 회원의 메모를 수정합니다.
                            이 내용은 관리자에게만 보여집니다.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <Textarea
                            placeholder="메모를 입력하세요..."
                            value={memoInput}
                            onChange={(e) => setMemoInput(e.target.value)}
                            rows={5}
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
