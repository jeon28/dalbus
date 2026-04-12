"use client";

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Trash2, Download, Pencil } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { format } from 'date-fns';
import styles from '../../admin.module.css';
import * as XLSX from 'xlsx';
import { apiFetch } from '@/lib/api';

interface AssignmentHistory {
    id: string;
    slot_number: number;
    tidal_id: string;
    tidal_password?: string;
    buyer_name?: string;
    buyer_phone?: string;
    buyer_email?: string;
    order_number?: string;
    start_date?: string;
    end_date?: string;
    assigned_at?: string;
    is_active: boolean;
    isEmpty?: boolean;
    account_id?: string;
    accounts?: {
        id: string;
        login_id: string;
    };
    orders?: {
        order_number: string;
        buyer_name: string;
        buyer_email: string;
        buyer_phone: string;
        profiles?: {
            name: string;
            phone: string;
        };
    };
}

function InactiveAccountsContent() {
    const router = useRouter();
    const [assignments, setAssignments] = useState<AssignmentHistory[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchInactiveAssignments();
    }, []);

    const fetchInactiveAssignments = async () => {
        try {
            setIsLoading(true);
            // 1. Fetch inactive history
            const res = await apiFetch('/api/admin/assignments/inactive?product=Tidal', { cache: 'no-store' });
            if (!res.ok) throw new Error('Failed to fetch inactive history');
            const inactiveData = await res.json();

            // 2. Fetch all Tidal accounts to find current empty slots
            const accRes = await apiFetch('/api/admin/accounts?product=Tidal', { cache: 'no-store' });
            if (!accRes.ok) throw new Error('Failed to fetch accounts');
            const accountsData = await accRes.json();

            // 3. Identify empty slots
            const emptySlots: AssignmentHistory[] = [];
            accountsData.forEach((acc: { id: string; login_id: string; max_slots: number; order_accounts: { slot_number: number; is_active: boolean; is_deleted?: boolean }[] }) => {
                const maxSlots = acc.max_slots || 5; // Default to 5 for Tidal if not specified
                for (let i = 0; i < maxSlots; i++) {
                    // Check if there is an ACTIVE assignment for this slot
                    const isOccupied = acc.order_accounts?.some((oa: { slot_number: number; is_active: boolean; is_deleted?: boolean }) => oa.slot_number === i && oa.is_active && !oa.is_deleted);
                    // Check if there is an INACTIVE history for this slot
                    const hasInactive = inactiveData.some((ina: AssignmentHistory) => ina.account_id === acc.id && ina.slot_number === i);
                    
                    if (!isOccupied && !hasInactive) {
                        emptySlots.push({
                            id: `empty-${acc.id}-${i}`,
                            slot_number: i,
                            tidal_id: '-',
                            buyer_name: '빈 슬롯',
                            is_active: false,
                            isEmpty: true,
                            accounts: { id: acc.id, login_id: acc.login_id }
                        });
                    }
                }
            });

            // 4. Combine and Sort
            const combined = [...emptySlots, ...inactiveData];
            combined.sort((a, b) => {
                const idA = a.accounts?.login_id || '';
                const idB = b.accounts?.login_id || '';
                if (idA !== idB) return idA.localeCompare(idB);
                
                if (a.slot_number !== b.slot_number) return a.slot_number - b.slot_number;
                
                if (a.isEmpty && !b.isEmpty) return -1;
                if (!a.isEmpty && b.isEmpty) return 1;

                const dateA = a.assigned_at ? new Date(a.assigned_at).getTime() : 0;
                const dateB = b.assigned_at ? new Date(b.assigned_at).getTime() : 0;
                return dateB - dateA;
            });

            setAssignments(combined);
        } catch (error) {
            console.error(error);
            alert('데이터 로딩 실패');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('해당 기록을 삭제하시겠습니까? (삭제된 데이터 보기에 저장되며, 메인 페이지에서 관리 가능합니다)')) return;
        try {
            const res = await apiFetch(`/api/admin/assignments/${id}?product=Tidal`, {
                method: 'DELETE',
            });
            if (!res.ok) throw new Error('Delete failed');
            alert('삭제된 데이터 보기(휴지통)로 이동되었습니다.');
            fetchInactiveAssignments();
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : '삭제 실패';
            alert('삭제 실패: ' + message);
        }
    };

    const exportToExcel = () => {
        const excelData = assignments.map((a: AssignmentHistory & { isEmpty?: boolean }, idx) => {
            const isEmpty = a.isEmpty === true;
            return {
                'No.': idx + 1,
                '배정번호': `${a.accounts?.login_id || '-'}-${a.slot_number + 1}`,
                '상태': isEmpty ? '빈 슬롯' : '지난 내역',
                'Tidal ID': a.tidal_id,
                '구매자명': isEmpty ? '-' : (a.buyer_name || a.orders?.buyer_name || a.orders?.profiles?.name || '-'),
                '연락처': isEmpty ? '-' : (a.buyer_phone || a.orders?.buyer_phone || a.orders?.profiles?.phone || '-'),
                '시작일': a.start_date || '-',
                '종료일': a.end_date || '-',
                '배정일': a.assigned_at ? new Date(a.assigned_at).toLocaleString() : '-'
            };
        });

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(excelData);
        XLSX.utils.book_append_sheet(wb, ws, '지난 내역');
        XLSX.writeFile(wb, `Tidal_지난내역_${format(new Date(), 'yyyyMMdd')}.xlsx`);
    };

    if (isLoading) return <div className="p-8 text-center">Loading...</div>;

    return (
        <main className={`${styles.main} bg-gray-50 min-h-screen pb-20 md:pb-8`}>
            <header className={`${styles.header} glass sticky top-0 z-10 py-3 md:py-4`}>
                <div className="container mx-auto px-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-2 md:gap-4">
                        <Button variant="ghost" size="sm" onClick={() => router.back()} className="h-8 w-8 p-0">
                            <ArrowLeft size={18} />
                        </Button>
                        <h1 className={`${styles.title} text-lg md:text-xl font-bold truncate`}>Tidal 지난 배정 내역 (비활성)</h1>
                    </div>
                    <div className="hidden sm:block">
                        <Button onClick={exportToExcel} variant="outline" className="gap-2 bg-white/50 hover:bg-white shadow-sm transition-all duration-200">
                            <Download size={16} /> 엑셀 다운로드
                        </Button>
                    </div>
                </div>
            </header>

            <div className={`${styles.content} container mx-auto px-4 mt-6`}>
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto scrollbar-hide">
                        <table className="w-full text-xs min-w-[800px]">
                            <thead>
                                <tr className="bg-gray-50/80 border-b">
                                    <th className="p-3 text-center w-12 font-semibold text-gray-600">No</th>
                                    <th className="p-3 text-center font-semibold text-gray-600">배정번호</th>
                                    <th className="p-3 text-left font-semibold text-gray-600">Tidal ID</th>
                                    <th className="p-3 text-left font-semibold text-gray-600">구매자</th>
                                    <th className="p-3 text-left font-semibold text-gray-600">연락처</th>
                                    <th className="p-3 text-center font-semibold text-gray-600">기간</th>
                                    <th className="p-3 text-center font-semibold text-gray-600">배정일시</th>
                                    <th className="p-3 text-center font-semibold text-gray-600">관리</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {assignments.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="p-12 text-center text-gray-400 bg-white">
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="p-4 bg-gray-50 rounded-full">
                                                    <Trash2 size={24} className="text-gray-300" />
                                                </div>
                                                <p>지난 내역이 없습니다.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    assignments.map((a: AssignmentHistory & { isEmpty?: boolean }, idx) => {
                                        const isEmpty = a.isEmpty === true;
                                        return (
                                            <tr key={a.id} className={`transition-colors h-11 ${isEmpty ? 'bg-emerald-50/30 hover:bg-emerald-50/50 text-emerald-800' : 'bg-rose-50/30 hover:bg-rose-50/50 text-rose-800'}`}>
                                                <td className="p-2 text-center text-gray-400 font-medium">{idx + 1}</td>
                                                <td className="p-2 text-center font-bold">
                                                    <span className="bg-white/50 px-2 py-0.5 rounded border border-current/10">
                                                        {a.accounts?.login_id || '-'}-{a.slot_number + 1}
                                                    </span>
                                                </td>
                                                <td className="p-2 font-medium">{a.tidal_id}</td>
                                                <td className="p-2 font-bold">
                                                    {isEmpty ? (
                                                        <span className="text-emerald-600">빈 슬롯</span>
                                                    ) : (
                                                        <span className="text-rose-600">{a.buyer_name || a.orders?.buyer_name || a.orders?.profiles?.name || '-'}</span>
                                                    )}
                                                </td>
                                                <td className="p-2 text-gray-600">{a.buyer_phone || a.orders?.buyer_phone || a.orders?.profiles?.phone || '-'}</td>
                                                <td className="p-2 text-center text-[10px] text-gray-500 font-medium">
                                                    {isEmpty ? '-' : `${a.start_date} ~ ${a.end_date}`}
                                                </td>
                                                <td className="p-2 text-center text-[10px] text-gray-400">
                                                    {isEmpty ? '-' : (a.assigned_at ? new Date(a.assigned_at).toLocaleDateString() : '-')}
                                                </td>
                                                <td className="p-2 text-center">
                                                    {isEmpty ? (
                                                        <Button 
                                                            size="sm" 
                                                            variant="ghost" 
                                                            className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100/50 rounded-lg transition-colors" 
                                                            onClick={() => router.push(`/admin/tidal?accountId=${a.accounts?.id || ''}&slotIdx=${a.slot_number}&action=assign`)} 
                                                            title="배정하기"
                                                        >
                                                            <Pencil size={14} />
                                                        </Button>
                                                    ) : (
                                                        <Button 
                                                            size="sm" 
                                                            variant="ghost" 
                                                            className="h-8 w-8 p-0 text-rose-400 hover:text-rose-600 hover:bg-rose-100/50 rounded-lg transition-colors" 
                                                            onClick={() => handleDelete(a.id)} 
                                                            title="영구 삭제"
                                                        >
                                                            <Trash2 size={14} />
                                                        </Button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Mobile Floating Action Button */}
            <div className="fixed bottom-6 right-6 flex flex-col gap-3 sm:hidden z-20">
                <Button 
                    onClick={exportToExcel} 
                    className="w-12 h-12 rounded-full shadow-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center p-0 border-none transition-transform active:scale-95"
                >
                    <Download size={20} />
                </Button>
            </div>
        </main>

    );
}

export default function InactiveAccountsPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <InactiveAccountsContent />
        </Suspense>
    );
}
