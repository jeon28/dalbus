"use client";

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Trash2, Download, Pencil, RotateCcw, History } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { format, addDays, differenceInDays, parseISO } from 'date-fns';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
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
    master_id?: string;
    account_id?: string;
    accounts?: {
        id: string;
        login_id: string;
    };
}

interface EditAssignFormData {
    assignment_number: string;
    buyer_name: string;
    buyer_phone: string;
    buyer_email: string;
    tidal_id: string;
    start_date: string;
    end_date: string;
    period_months: number;
    amount: number;
    memo: string;
}

function LegacyTidalInactiveContent() {
    const router = useRouter();
    const [records, setRecords] = useState<LegacyTidalHistory[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showDeleted, setShowDeleted] = useState(false);

    // Modal state for direct editing
    const [isEditAssignModalOpen, setIsEditAssignModalOpen] = useState(false);
    const [editAssignData, setEditAssignData] = useState<EditAssignFormData | null>(null);
    const [activeEditAccountId, setActiveEditAccountId] = useState<string | null>(null);
    const [activeEditSlotIdx, setActiveEditSlotIdx] = useState<number | null>(null);

    useEffect(() => {
        fetchInactiveRecords();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showDeleted]);

    const fetchInactiveRecords = async () => {
        try {
            setIsLoading(true);
            // 1. Fetch inactive history
            const res = await apiFetch(`/api/admin/legacy-tidal/inactive?showDeleted=${showDeleted}`, { cache: 'no-store' });
            if (!res.ok) throw new Error('Failed to fetch inactive history');
            const inactiveData = await res.json();

            // 2. Clear empty slots if showing deleted
            if (showDeleted) {
                setRecords(inactiveData);
                return;
            }

            // 3. Fetch all HifiTidal accounts to find current empty slots
            // (Legacy Tidal also uses HifiTidal product prefix in this app)
            const accRes = await apiFetch('/api/admin/legacy-tidal?showInactive=true', { cache: 'no-store' });
            if (!accRes.ok) throw new Error('Failed to fetch accounts');
            const accountsData = await accRes.json();

            // 4. Create Master ID map and Identfy empty slots
            const masterMap: Record<string, string> = {};
            accountsData.forEach((acc: { id: string; login_id: string; max_slots: number; order_accounts: { slot_number: number; is_active: boolean; is_deleted?: boolean; type?: string; tidal_id?: string }[] }) => {
                const master = acc.order_accounts?.find((oa: { type?: string; slot_number: number }) => oa.type === 'master' || oa.slot_number === 0);
                if (master) masterMap[acc.id] = (master as { tidal_id?: string }).tidal_id || '';
            });

            inactiveData.forEach((ina: LegacyTidalHistory) => {
                const accId = ina.account_id || ina.accounts?.id;
                if (accId) ina.master_id = masterMap[accId] || '-';
            });

            const emptySlots: LegacyTidalHistory[] = [];
            accountsData.forEach((acc: { id: string; login_id: string; max_slots: number; order_accounts: { slot_number: number; is_active: boolean; is_deleted?: boolean }[] }) => {
                const maxSlots = acc.max_slots || 6;
                for (let i = 0; i < maxSlots; i++) {
                    const isOccupied = acc.order_accounts?.some((oa: { slot_number: number; is_active: boolean; is_deleted?: boolean }) => oa.slot_number === i && oa.is_active && !oa.is_deleted);
                    const hasInactive = inactiveData.some((ina: LegacyTidalHistory) => {
                        const tId = ina.account_id || ina.accounts?.id;
                        return tId === acc.id && ina.slot_number === i;
                    });

                    if (!isOccupied && !hasInactive) {
                        emptySlots.push({
                            id: `empty-${acc.id}-${i}`,
                            slot_number: i,
                            tidal_id: '-',
                            buyer_name: '빈 슬롯',
                            is_active: false,
                            isEmpty: true,
                            master_id: masterMap[acc.id] || '-',
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
        const confirmMsg = showDeleted 
            ? '해당 기록을 영구적으로 삭제하시겠습니까?\n이 작업은 되돌릴 수 없으며 완전히 삭제됩니다.'
            : '해당 기록을 삭제 데이터(휴지통)로 이동하시겠습니까?';
        
        if (!confirm(confirmMsg)) return;

        try {
            const url = showDeleted 
                ? `/api/admin/legacy-tidal/assignment/${id}?hardDelete=true`
                : `/api/admin/legacy-tidal/assignment/${id}`;
            
            const res = await apiFetch(url, {
                method: 'DELETE',
            });
            if (!res.ok) throw new Error('Delete failed');
            alert(showDeleted ? '영구 삭제되었습니다.' : '삭제 데이터로 이동되었습니다.');
            fetchInactiveRecords();
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : '삭제 실패';
            alert('삭제 실패: ' + message);
        }
    };

    const handleRestore = async (id: string) => {
        if (!confirm('해당 기록을 비활성 내역으로 복구하시겠습니까?')) return;
        try {
            const res = await apiFetch(`/api/admin/legacy-tidal/assignment/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ is_deleted: false, is_active: false })
            });
            if (!res.ok) throw new Error('Restore failed');
            alert('복구되었습니다.');
            fetchInactiveRecords();
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : '복구 실패';
            alert('복구 실패: ' + message);
        }
    };

    const openEditModal = (accountId: string, slotIdx: number, loginId: string) => {
        setActiveEditAccountId(accountId);
        setActiveEditSlotIdx(slotIdx);
        setEditAssignData({
            assignment_number: `${loginId}-${slotIdx + 1}`,
            buyer_name: '',
            buyer_phone: '',
            buyer_email: '',
            tidal_id: '',
            start_date: '',
            end_date: '',
            period_months: 0,
            amount: 0,
            memo: '',
        });
        setIsEditAssignModalOpen(true);
    };

    const handleUpdateEditAssign = async () => {
        if (!activeEditAccountId || activeEditSlotIdx === null || !editAssignData) return;
        if (!editAssignData.buyer_name && !editAssignData.buyer_email) {
            alert('이름 또는 ID(이메일)를 입력해주세요.');
            return;
        }
        try {
            const res = await apiFetch(`/api/admin/legacy-tidal/assign/${activeEditAccountId}`, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ ...editAssignData, slot_number: activeEditSlotIdx }) 
            });
            if (!res.ok) throw new Error('Create failed');
            alert('배정되었습니다.');
            setIsEditAssignModalOpen(false);
            fetchInactiveRecords();
        } catch (e) {
            alert('저장 실패: ' + (e instanceof Error ? e.message : String(e)));
        }
    };

    const exportToExcel = () => {
        const excelData = records.map((a: LegacyTidalHistory, idx) => {
            const isEmpty = a.isEmpty === true;
            return {
                'No.': idx + 1,
                '배정번호': `${a.accounts?.login_id || '-'}-${a.slot_number + 1}`,
                '상태': isEmpty ? '빈 슬롯' : '지난 내역',
                'Master ID': a.master_id || '-',
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
                        <h1 className={styles.title}>
                            {showDeleted ? '삭제된 데이터 (휴지통)' : '기존 Tidal 지난 배정 내역 (비활성)'}
                        </h1>
                    </div>
                    <div className="flex gap-2">
                        <Button 
                            onClick={() => setShowDeleted(!showDeleted)} 
                            variant={showDeleted ? "default" : "outline"} 
                            className="gap-2"
                        >
                            {showDeleted ? <History size={16} /> : <Trash2 size={16} />}
                            {showDeleted ? '내역 보기' : '삭제 내역'}
                        </Button>
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
                                <th className="p-3 text-left">Master ID</th>
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
                                records.map((a: LegacyTidalHistory, idx) => {
                                    const isEmpty = a.isEmpty === true;
                                    return (
                                        <tr key={a.id} className={`border-b hover:bg-gray-50 h-10 ${isEmpty ? 'bg-green-100/50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                            <td className="p-2 text-center opacity-70">{idx + 1}</td>
                                            <td className="p-2 text-center font-bold">
                                                {a.accounts?.login_id || '-'}-{a.slot_number + 1}
                                            </td>
                                            <td className="p-2 font-mono text-gray-500 opacity-80 text-[11px]">{a.master_id || '-'}</td>
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
                                                        onClick={() => openEditModal(a.accounts?.id || '', a.slot_number, a.accounts?.login_id || '')} 
                                                        title="배정하기"
                                                    >
                                                        <Pencil size={16} />
                                                    </Button>
                                                ) : (
                                                    <div className="flex justify-center gap-1">
                                                        {showDeleted && (
                                                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-blue-500 hover:text-blue-700" onClick={() => handleRestore(a.id)} title="복구">
                                                                <RotateCcw size={16} />
                                                            </Button>
                                                        )}
                                                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-500 hover:text-red-700" onClick={() => handleDelete(a.id)} title={showDeleted ? "영구 삭제" : "삭제 내역으로 이동"}>
                                                            <Trash2 size={16} />
                                                        </Button>
                                                    </div>
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

            <Dialog open={isEditAssignModalOpen} onOpenChange={setIsEditAssignModalOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader><DialogTitle>정보수정 / {editAssignData?.assignment_number}</DialogTitle></DialogHeader>
                    {editAssignData && (
                        <div className="grid gap-4 py-4 overflow-y-auto max-h-[70vh] px-1">
                            <div className="flex gap-4">
                                <div className="w-[30%] space-y-1"><Label className="text-xs text-gray-500">이름</Label><Input value={editAssignData.buyer_name || ''} onChange={e => setEditAssignData({ ...editAssignData, buyer_name: e.target.value })} className="h-9" /></div>
                                <div className="flex-1 space-y-1"><Label className="text-xs text-gray-500">Tidal ID</Label><Input value={editAssignData.tidal_id || ''} onChange={e => setEditAssignData({ ...editAssignData, tidal_id: e.target.value })} className="h-9" /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1"><Label className="text-xs text-gray-500">전화번호</Label><Input value={editAssignData.buyer_phone || ''} onChange={e => setEditAssignData({ ...editAssignData, buyer_phone: e.target.value })} className="h-9" /></div>
                                <div className="space-y-1"><Label className="text-xs text-gray-500">이메일</Label><Input value={editAssignData.buyer_email || ''} onChange={e => setEditAssignData({ ...editAssignData, buyer_email: e.target.value })} className="h-9" /></div>
                            </div>
                            <div className="flex gap-2">
                                <div className="flex-1 space-y-1">
                                    <Label className="text-[10px] text-gray-500">시작일</Label>
                                    <Input type="date" value={editAssignData.start_date || ''} onChange={e => {
                                        const ns = e.target.value; let ne = editAssignData.end_date;
                                        if (ns && editAssignData.period_months) { try { ne = addDays(parseISO(ns), editAssignData.period_months * 30).toISOString().split('T')[0]; } catch { } }
                                        setEditAssignData({ ...editAssignData, start_date: ns, end_date: ne });
                                    }} className="h-9 text-xs px-1" />
                                </div>
                                <div className="flex-1 space-y-1">
                                    <Label className="text-[10px] text-gray-500">종료일</Label>
                                    <Input type="date" value={editAssignData.end_date || ''} onChange={e => {
                                        const ne = e.target.value; let nm = editAssignData.period_months;
                                        if (editAssignData.start_date && ne) { try { nm = Math.max(0, Math.floor(differenceInDays(parseISO(ne), parseISO(editAssignData.start_date)) / 30)); } catch { } }
                                        setEditAssignData({ ...editAssignData, end_date: ne, period_months: nm });
                                    }} className="h-9 text-xs px-1" />
                                </div>
                                <div className="w-12 space-y-1">
                                    <Label className="text-[10px] text-gray-500">개월</Label>
                                    <Input type="number" value={editAssignData.period_months || ''} onChange={e => {
                                        const m = parseInt(e.target.value) || 0; let ne = editAssignData.end_date;
                                        if (editAssignData.start_date && m >= 0) { try { ne = addDays(parseISO(editAssignData.start_date), m * 30).toISOString().split('T')[0]; } catch { } }
                                        setEditAssignData({ ...editAssignData, period_months: m, end_date: ne });
                                    }} className="h-9 text-xs px-1" />
                                </div>
                                <div className="w-24 space-y-1">
                                    <Label className="text-[10px] text-gray-500">계약금액(원)</Label>
                                    <Input type="text" value={editAssignData.amount ? editAssignData.amount.toLocaleString() : ''} onChange={e => setEditAssignData({ ...editAssignData, amount: parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0 })} className="h-9 text-xs px-1" />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-gray-500">메모</Label>
                                <textarea rows={3} className="w-full p-2 text-sm border rounded-md focus:ring-1 focus:ring-blue-500 outline-none" value={editAssignData.memo || ''} onChange={e => setEditAssignData({ ...editAssignData, memo: e.target.value })} />
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditAssignModalOpen(false)}>취소</Button>
                        <Button onClick={handleUpdateEditAssign} className="bg-blue-600 hover:bg-blue-700">배정하기</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
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
