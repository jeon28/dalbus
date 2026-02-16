"use client";

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Trash2, Download } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { format } from 'date-fns';
import styles from '../../admin.module.css';
import * as XLSX from 'xlsx';

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
    accounts?: {
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
            const res = await fetch('/api/admin/assignments/inactive', { cache: 'no-store' });
            if (!res.ok) throw new Error('Failed to fetch');
            const data = await res.json();
            setAssignments(data);
        } catch (error) {
            console.error(error);
            alert('데이터 로딩 실패');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('정말 영구 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) return;
        try {
            const res = await fetch(`/api/admin/assignments/${id}`, {
                method: 'DELETE',
            });
            if (!res.ok) throw new Error('Delete failed');
            fetchInactiveAssignments();
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : '삭제 실패';
            alert('삭제 실패: ' + message);
        }
    };

    const exportToExcel = () => {
        const excelData = assignments.map((a, idx) => ({
            'No.': idx + 1,
            '그룹 ID': a.accounts?.login_id || '-',
            'Slot': a.slot_number + 1,
            'Tidal ID': a.tidal_id,
            '구매자명': a.buyer_name || a.orders?.buyer_name || a.orders?.profiles?.name || '-',
            '연락처': a.buyer_phone || a.orders?.buyer_phone || a.orders?.profiles?.phone || '-',
            '주문번호': a.order_number || a.orders?.order_number || '-',
            '시작일': a.start_date || '-',
            '종료일': a.end_date || '-',
            '배정일': a.assigned_at ? new Date(a.assigned_at).toLocaleString() : '-'
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(excelData);
        XLSX.utils.book_append_sheet(wb, ws, '지난 내역');
        XLSX.writeFile(wb, `Tidal_지난내역_${format(new Date(), 'yyyyMMdd')}.xlsx`);
    };

    if (isLoading) return <div className="p-8 text-center">Loading...</div>;

    return (
        <main className={styles.main}>
            <header className={`${styles.header} glass`}>
                <div className="container flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="sm" onClick={() => router.back()}>
                            <ArrowLeft size={20} />
                        </Button>
                        <h1 className={styles.title}>Tidal 지난 배정 내역 (비활성)</h1>
                    </div>
                    <div>
                        <Button onClick={exportToExcel} variant="outline" className="gap-2">
                            <Download size={16} /> 엑셀 다운로드
                        </Button>
                    </div>
                </div>
            </header>

            <div className={`${styles.content} container`}>
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="bg-gray-100 border-b">
                                <th className="p-3 text-center w-12">No</th>
                                <th className="p-3 text-left">그룹 ID</th>
                                <th className="p-3 text-center">Slot</th>
                                <th className="p-3 text-left">Tidal ID</th>
                                <th className="p-3 text-left">구매자</th>
                                <th className="p-3 text-left">연락처</th>
                                <th className="p-3 text-center">주문번호</th>
                                <th className="p-3 text-center">기간</th>
                                <th className="p-3 text-center">배정일시</th>
                                <th className="p-3 text-center">관리</th>
                            </tr>
                        </thead>
                        <tbody>
                            {assignments.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="p-8 text-center text-gray-500">
                                        지난 내역이 없습니다.
                                    </td>
                                </tr>
                            ) : (
                                assignments.map((a, idx) => (
                                    <tr key={a.id} className="border-b hover:bg-gray-50">
                                        <td className="p-2 text-center text-gray-500">{idx + 1}</td>
                                        <td className="p-2">{a.accounts?.login_id || '-'}</td>
                                        <td className="p-2 text-center">{a.slot_number + 1}</td>
                                        <td className="p-2">{a.tidal_id}</td>
                                        <td className="p-2">{a.buyer_name || a.orders?.buyer_name || a.orders?.profiles?.name || '-'}</td>
                                        <td className="p-2">{a.buyer_phone || a.orders?.buyer_phone || a.orders?.profiles?.phone || '-'}</td>
                                        <td className="p-2 text-center font-mono">{a.order_number || a.orders?.order_number || '-'}</td>
                                        <td className="p-2 text-center">
                                            {a.start_date} ~ {a.end_date}
                                        </td>
                                        <td className="p-2 text-center text-gray-500">
                                            {a.assigned_at ? new Date(a.assigned_at).toLocaleDateString() : '-'}
                                        </td>
                                        <td className="p-2 text-center">
                                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-gray-400 hover:text-red-600" onClick={() => handleDelete(a.id)} title="영구 삭제">
                                                <Trash2 size={16} />
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
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
