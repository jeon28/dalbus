"use client";

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Trash2, Download, Pencil } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { format } from 'date-fns';
import styles from '../../admin.module.css';
import * as XLSX from 'xlsx';
import { apiFetch } from '@/lib/api';

interface LegacyTidalHistory {
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
    is_deleted?: boolean;
    isEmpty?: boolean;
    accounts?: {
        id: string;
        login_id: string;
    };
}

function LegacyTidalInactiveContent() {
    const router = useRouter();
    const [records, setRecords] = useState<LegacyTidalHistory[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchInactiveRecords();
    }, []);

    const fetchInactiveRecords = async () => {
        try {
            setIsLoading(true);
            // 1. Fetch inactive history
            const res = await apiFetch('/api/admin/legacy-tidal-account/inactive', { cache: 'no-store' });
            if (!res.ok) throw new Error('Failed to fetch inactive history');
            const inactiveData = await res.json();

            // 2. Fetch all HifiTidal accounts to find current empty slots
            // (Legacy Tidal also uses HifiTidal product prefix in this app)
            const accRes = await apiFetch('/api/admin/accounts?product=HifiTidal', { cache: 'no-store' });
            if (!accRes.ok) throw new Error('Failed to fetch accounts');
            const accountsData = await accRes.json();

            // 3. Identify empty slots
            const emptySlots: any[] = [];
            accountsData.forEach((acc: any) => {
                const maxSlots = acc.max_slots || 6;
                for (let i = 0; i < maxSlots; i++) {
                    const isOccupied = acc.order_accounts?.some((oa: any) => oa.slot_number === i && oa.is_active && !oa.is_deleted);
                    if (!isOccupied) {
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
                const dA = a.assigned_at ? new Date(a.assigned_at).getTime() : 0;
                const dB = b.assigned_at ? new Date(b.assigned_at).getTime() : 0;
                return dB - dA;
            });

            setRecords(combined);
        } catch (error) {
            console.error(error);
            alert('데이터 로딩 실패');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('해당 기록을 삭제하시겠습니까?\n삭제된 데이터는 메인 페이지 \'삭제 데이터\' 보기에서 관리할 수 있습니다.')) return;
        try {
            const res = await apiFetch(`/api/admin/legacy-tidal-account/${id}`, {
                method: 'DELETE',
            });
            if (!res.ok) throw new Error('Delete failed');
            alert('삭제 완료. 기존 Tidal 메인 페이지 → 삭제 데이터 보기에서 확인하세요.');
            fetchInactiveRecords();
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : '삭제 실패';
            alert('삭제 실패: ' + message);
        }
    };

    const exportToExcel = () => {
        const excelData = records.map((a: any, idx) => {
            const isEmpty = a.isEmpty === true;
            return {
                'No.': idx + 1,
                '배정번호': `${a.accounts?.login_id || '-'}-${a.slot_number + 1}`,
                '상태': isEmpty ? '빈 슬롯' : '지난 내역',
                'Tidal ID': a.tidal_id,
                '구매자명': isEmpty ? '-' : (a.buyer_name || '-'),
                '연락처': isEmpty ? '-' : (a.buyer_phone || '-'),
                '이메일': isEmpty ? '-' : (a.buyer_email || '-'),
                '시작일': a.start_date || '-',
                '종료일': a.end_date || '-',
                '배정일': a.assigned_at ? new Date(a.assigned_at).toLocaleString() : '-'
            };
        });

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(excelData);
        XLSX.utils.book_append_sheet(wb, ws, '지난 내역');
        XLSX.writeFile(wb, `기존Tidal_지난내역_${format(new Date(), 'yyyyMMdd')}.xlsx`);
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
                        <h1 className={styles.title}>기존 Tidal 지난 배정 내역 (비활성)</h1>
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
                                <th className="p-3 text-center">배정번호</th>
                                <th className="p-3 text-left">Tidal ID</th>
                                <th className="p-3 text-left">구매자</th>
                                <th className="p-3 text-left">연락처</th>
                                <th className="p-3 text-left">이메일</th>
                                <th className="p-3 text-center">기간</th>
                                <th className="p-3 text-center">배정일시</th>
                                <th className="p-3 text-center">관리</th>
                            </tr>
                        </thead>
                        <tbody>
                            {records.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="p-8 text-center text-gray-500">
                                        지난 내역이 없습니다.
                                    </td>
                                </tr>
                            ) : (
                                records.map((a: any, idx) => {
                                    const isEmpty = (a as any).isEmpty === true;
                                    return (
                                        <tr key={a.id} className={`border-b hover:bg-gray-50 h-10 ${isEmpty ? 'bg-green-100/50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                            <td className="p-2 text-center opacity-70">{idx + 1}</td>
                                            <td className="p-2 text-center font-bold">
                                                {a.accounts?.login_id || '-'}-{a.slot_number + 1}
                                            </td>
                                            <td className="p-2">{a.tidal_id}</td>
                                            <td className="p-2 font-bold">
                                                {isEmpty ? '빈 슬롯' : (a.buyer_name || '-')}
                                            </td>
                                            <td className="p-2">{a.buyer_phone || '-'}</td>
                                            <td className="p-2">{a.buyer_email || '-'}</td>
                                            <td className="p-2 text-center text-[10px] opacity-80">
                                                {isEmpty ? '-' : `${a.start_date} ~ ${a.end_date}`}
                                            </td>
                                            <td className="p-2 text-center text-[10px] opacity-70">
                                                {isEmpty ? '-' : (a.assigned_at ? new Date(a.assigned_at).toLocaleDateString() : '-')}
                                            </td>
                                            <td className="p-2 text-center">
                                                {isEmpty ? (
                                                    <Button 
                                                        size="sm" 
                                                        variant="ghost" 
                                                        className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-100/50" 
                                                        onClick={() => router.push(`/admin/legacy-tidal?accountId=${a.accounts.id}&slotIdx=${a.slot_number}&action=assign`)} 
                                                        title="배정하기"
                                                    >
                                                        <Pencil size={16} />
                                                    </Button>
                                                ) : (
                                                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-400 hover:text-red-700" onClick={() => handleDelete(a.id)} title="영구 삭제">
                                                        <Trash2 size={16} />
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
        </main>
    );
}

export default function LegacyTidalInactivePage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <LegacyTidalInactiveContent />
        </Suspense>
    );
}
