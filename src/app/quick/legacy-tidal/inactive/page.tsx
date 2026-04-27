"use client";

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Trash2, Download, Pencil, RotateCcw, History, MessageSquareText } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { format, addDays, differenceInDays, parseISO } from 'date-fns';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import styles from '@/app/(protected)/admin/admin.module.css';
import * as XLSX from 'xlsx';
import { quickFetch } from '@/lib/quickFetch';
import { PasswordGate } from '@/components/admin/PasswordGate';

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
    updated_at?: string;
    master_id?: string;
    account_id?: string;
    memo?: string;
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
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
    const [initialEditEndDate, setInitialEditEndDate] = useState<string>('');
    const [initialEditMonths, setInitialEditMonths] = useState<number>(0);

    // Tidal Login Popup state
    const [tidalLoginEmail, setTidalLoginEmail] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    // Memo modal state
    const [isMemoModalOpen, setIsMemoModalOpen] = useState(false);
    const [currentMemoInput, setCurrentMemoInput] = useState('');
    const [memoTargetAssignmentId, setMemoTargetAssignmentId] = useState('');

    const handleMasterIdClick = (e: React.MouseEvent, id?: string) => {
        e.stopPropagation();
        if (!id || id === '-') return;
        
        navigator.clipboard.writeText(id);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
        
        window.open('https://account.tidal.com/family', '_blank');
    };

    useEffect(() => {
        fetchInactiveRecords();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showDeleted]);

    const fetchInactiveRecords = async () => {
        try {
            setIsLoading(true);
            // 1. Fetch inactive history
            const res = await quickFetch(`/api/quick/legacy-tidal/inactive?showDeleted=${showDeleted}`, { cache: 'no-store' });
            if (!res.ok) throw new Error('Failed to fetch inactive history');
            const inactiveData = await res.json();

            // 2. Clear empty slots if showing deleted
            if (showDeleted) {
                setRecords(inactiveData);
                return;
            }

            // 3. Fetch all HifiTidal accounts to find current empty slots
            // (Legacy Tidal also uses HifiTidal product prefix in this app)
            const accRes = await quickFetch('/api/quick/legacy-tidal?showInactive=true', { cache: 'no-store' });
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
                // If the server injected master_id, it will be kept, otherwise fallback to masterMap
                if (accId && !ina.master_id) ina.master_id = masterMap[accId] || '-';
                if (!ina.master_id) ina.master_id = '-';
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
                if (showDeleted) {
                    const uA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
                    const uB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
                    return uB - uA;
                }
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
            : '해당 기록을 삭제 데이터 내역으로 이동하시겠습니까?';
        
        if (!confirm(confirmMsg)) return;

        try {
            const url = showDeleted 
                ? `/api/quick/legacy-tidal/assignment/${id}?hardDelete=true`
                : `/api/quick/legacy-tidal/assignment/${id}`;
            
            const res = await quickFetch(url, {
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
            const res = await quickFetch(`/api/quick/legacy-tidal/assignment/${id}`, {
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

    const openEditModal = (accountId: string, slotIdx: number, assignment?: LegacyTidalHistory) => {
        setActiveEditAccountId(accountId);
        setActiveEditSlotIdx(slotIdx);
        if (assignment && !assignment.isEmpty) {
            setSelectedAssignmentId(assignment.id);
            let pm = 0;
            if (assignment.start_date && assignment.end_date) {
                try { pm = Math.max(0, Math.floor(differenceInDays(parseISO(assignment.end_date), parseISO(assignment.start_date)) / 30)); } catch { }
            }
            setInitialEditEndDate(assignment.end_date || '');
            setInitialEditMonths(pm);
            setEditAssignData({
                assignment_number: `${assignment.accounts?.login_id || '-'}-${assignment.slot_number + 1}`,
                buyer_name: assignment.buyer_name || '',
                buyer_phone: assignment.buyer_phone || '',
                buyer_email: assignment.buyer_email || '',
                tidal_id: assignment.tidal_id || '',
                start_date: assignment.start_date || '',
                end_date: assignment.end_date || '',
                period_months: pm,
                amount: 0,
                memo: assignment.memo || '',
            });
        } else {
            setInitialEditEndDate('');
            setInitialEditMonths(0);
            setSelectedAssignmentId(null);
            setEditAssignData({
                assignment_number: `${assignment?.accounts?.login_id || '-'}-${slotIdx + 1}`,
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
        }
        setIsEditAssignModalOpen(true);
    };

    const handleUpdateEditAssign = async () => {
        if (!activeEditAccountId || !editAssignData) return;
        
        try {
            if (selectedAssignmentId) {
                // Update existing
                const res = await quickFetch(`/api/quick/legacy-tidal/assignment/${selectedAssignmentId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(editAssignData)
                });
                if (!res.ok) throw new Error('Update failed');
                alert('수정되었습니다.');
            } else {
                // Create new
                if (!editAssignData.buyer_name && !editAssignData.buyer_email) {
                    alert('이름 또는 ID(이메일)를 입력해주세요.');
                    return;
                }
                const res = await quickFetch(`/api/quick/legacy-tidal/assign/${activeEditAccountId}`, { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify({ ...editAssignData, slot_number: activeEditSlotIdx }) 
                });
                if (!res.ok) throw new Error('Create failed');
                alert('배정되었습니다.');
            }
            setIsEditAssignModalOpen(false);
            fetchInactiveRecords();
        } catch (e) {
            alert('저장 실패: ' + (e instanceof Error ? e.message : String(e)));
        }
    };

    const openMemoModal = (currentMemo: string, assignmentId: string) => {
        setMemoTargetAssignmentId(assignmentId);
        setCurrentMemoInput(currentMemo || '');
        setIsMemoModalOpen(true);
    };

    const handleSaveMemo = async () => {
        if (!memoTargetAssignmentId) return;
        try {
            const res = await quickFetch(`/api/quick/legacy-tidal/assignment/${memoTargetAssignmentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ memo: currentMemoInput })
            });
            if (!res.ok) throw new Error('Update failed');
            setIsMemoModalOpen(false);
            fetchInactiveRecords();
            alert('메모가 저장되었습니다.');
        } catch (e) {
            alert('저장 실패: ' + (e instanceof Error ? e.message : String(e)));
        }
    };

    const exportToExcel = () => {
        const excelData = records.map((a: LegacyTidalHistory, idx) => {
            const isEmpty = a.isEmpty === true;
            const data: Record<string, string | number> = {
                'No.': idx + 1,
                '배정번호': `${a.accounts?.login_id || '-'}-${a.slot_number + 1}`,
                '상태': isEmpty ? '빈 슬롯' : '지난 내역',
                'Tidal ID': a.tidal_id,
                '고객명': isEmpty ? '-' : (a.buyer_name || '-'),
                '연락처': isEmpty ? '-' : (a.buyer_phone || '-'),
                '이메일': isEmpty ? '-' : (a.buyer_email || '-'),
                '시작일': a.start_date || '-',
                '종료일': a.end_date || '-',
                '배정일': a.assigned_at ? format(new Date(a.assigned_at), 'MM/dd HH:mm') : '-',
                '메모': a.memo || ''
            };
            if (!showDeleted) {
                data['Master ID'] = a.master_id || '-';
            } else {
                data['삭제일'] = a.updated_at ? format(new Date(a.updated_at), 'MM/dd HH:mm') : '-';
            }
            return data;
        });

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(excelData);
        XLSX.utils.book_append_sheet(wb, ws, '지난 내역');
        XLSX.writeFile(wb, `기존Tidal_지난내역_${format(new Date(), 'yyyyMMdd')}.xlsx`);
    };

    if (isLoading) return <div className="p-8 text-center">Loading...</div>;

    return (
        <main className={styles.main}>
            <header className={`${styles.header} glass border-b border-gray-100`}>
                <div className="container flex flex-col md:flex-row justify-between items-center gap-4 px-4">
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <Button variant="ghost" size="sm" onClick={() => router.back()} className="h-8 w-8 p-0">
                            <ArrowLeft size={18} />
                        </Button>
                        <h1 className={`${styles.title} text-sm sm:text-base line-clamp-1`}>
                            {showDeleted ? '삭제 데이터 (휴지통)' : 'Tidal 지난 내역 (비활성)'}
                        </h1>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto justify-end">
                        <Button 
                            onClick={() => setShowDeleted(!showDeleted)} 
                            variant={showDeleted ? "default" : "outline"} 
                            size="sm"
                            className="gap-1.5 h-8 text-xs flex-1 md:flex-none"
                        >
                            {showDeleted ? <History size={14} /> : <Trash2 size={14} />}
                            <span>{showDeleted ? '내역 보기' : '삭제 내역'}</span>
                        </Button>
                        <Button onClick={exportToExcel} variant="outline" size="sm" className="gap-1.5 h-8 text-xs flex-1 md:flex-none">
                            <Download size={14} /> <span>엑셀</span>
                        </Button>
                    </div>
                </div>
            </header>

            <div className={`${styles.content} container px-4 py-6`}>
                <div className="bg-white rounded-lg shadow overflow-hidden overflow-x-auto w-full">
                    <table className="w-full text-[10px] sm:text-xs min-w-[1000px]">
                        <thead>
                            <tr className="bg-gray-50 border-b">
                                <th className="p-2 sm:p-3 text-center w-10 sm:w-12">No</th>
                                <th className="p-2 sm:p-3 text-center">배정번호</th>
                                {!showDeleted && <th className="p-2 sm:p-3 text-left">Master ID</th>}
                                <th className="p-2 sm:p-3 text-left">Tidal ID</th>
                                <th className="p-2 sm:p-3 text-left">구매자</th>
                                <th className="p-2 sm:p-3 text-left">연락처</th>
                                <th className="p-2 sm:p-3 text-left">이메일</th>
                                <th className="p-2 sm:p-3 text-center">기간</th>
                                <th className="p-2 sm:p-3 text-center">변경일</th>
                                {showDeleted && <th className="p-2 sm:p-3 text-left">메모</th>}
                                <th className="p-2 sm:p-3 text-center">관리</th>
                            </tr>
                        </thead>
                        <tbody>
                            {records.length === 0 ? (
                                <tr>
                                    <td colSpan={showDeleted ? 11 : 10} className="p-8 text-center text-gray-500">
                                        지난 내역이 없습니다.
                                    </td>
                                </tr>
                            ) : (
                                records.map((a: LegacyTidalHistory, idx) => {
                                    const isEmpty = a.isEmpty === true;
                                    return (
                                        <tr key={a.id} className={`border-b hover:bg-gray-50 h-8 ${isEmpty ? 'bg-green-100/50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                            <td className="p-1 text-center opacity-70 overflow-hidden">{idx + 1}</td>
                                            <td className="p-1 text-center font-bold truncate">
                                                {a.accounts?.login_id || '-'}-{a.slot_number + 1}
                                            </td>
                                            {!showDeleted && (
                                                <td 
                                                    className="p-1 font-mono text-gray-500 opacity-80 text-[10px] cursor-pointer select-none relative group truncate" 
                                                    onClick={(e) => handleMasterIdClick(e, a.master_id)} 
                                                    title={a.master_id}
                                                >
                                                    <span className="hover:underline hover:text-blue-600 transition-colors">{a.master_id || '-'}</span>
                                                    {copiedId === a.master_id && (
                                                        <span className="absolute -top-4 left-2 bg-blue-600 text-white text-[9px] px-1 rounded animate-bounce whitespace-nowrap z-10">Copied!</span>
                                                    )}
                                                </td>
                                            )}
                                            <td className="p-1 cursor-pointer select-none truncate" onDoubleClick={() => { if (a.tidal_id && a.tidal_id !== '-') { setTidalLoginEmail(a.tidal_id); setCopied(false); } }} title={a.tidal_id}>
                                                <span className="hover:underline hover:text-blue-600 transition-colors text-[10px]">{a.tidal_id}</span>
                                            </td>
                                            <td className="p-1 font-bold truncate">
                                                {isEmpty ? '빈 슬롯' : (a.buyer_name || '-')}
                                            </td>
                                            <td className="p-1 truncate">{a.buyer_phone || '-'}</td>
                                            <td className="p-1 truncate">{a.buyer_email || '-'}</td>
                                            <td className="p-1 text-center text-[9px] opacity-80 whitespace-nowrap">
                                                {isEmpty ? '-' : `${(a.start_date || '').split('-').slice(1).join('/')} ~ ${(a.end_date || '').split('-').slice(1).join('/')}`}
                                            </td>
                                            <td className="p-1 text-center text-[9px] opacity-70">
                                                {isEmpty ? '-' : (a.assigned_at ? format(new Date(a.assigned_at), 'MM/dd HH:mm') : '-')}
                                            </td>
                                            {showDeleted && (
                                                <td className="p-1">
                                                    {!isEmpty && (
                                                        <div className="flex items-center justify-start gap-1 overflow-hidden" onClick={e => { e.stopPropagation(); openMemoModal(a.memo || '', a.id); }}>
                                                            <MessageSquareText size={12} className={`flex-shrink-0 cursor-pointer ${a.memo ? 'text-blue-500 fill-blue-50' : 'text-gray-300 hover:text-gray-500'}`} />
                                                            <span className="text-[9px] text-gray-500 truncate cursor-pointer">{a.memo?.split('\n')[0] || ''}</span>
                                                        </div>
                                                    )}
                                                </td>
                                            )}
                                            <td className="p-1 text-center">
                                                {isEmpty ? (
                                                    <Button 
                                                        size="sm" 
                                                        variant="ghost" 
                                                        className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-100/50" 
                                                        onClick={() => openEditModal(a.accounts?.id || '', a.slot_number, a)} 
                                                        title="배정하기"
                                                    >
                                                        <Pencil size={14} />
                                                    </Button>
                                                ) : (
                                                    <div className="flex justify-center gap-1">
                                                        {showDeleted ? (
                                                            <>
                                                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-blue-600" title="수정" onClick={() => openEditModal(a.account_id || a.accounts?.id || '', a.slot_number, a)}><Pencil size={12} /></Button>
                                                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-blue-500 hover:text-blue-700" onClick={() => handleRestore(a.id)} title="복구">
                                                                    <RotateCcw size={14} />
                                                                </Button>
                                                            </>
                                                        ) : null}
                                                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" onClick={() => handleDelete(a.id)} title={showDeleted ? "영구 삭제" : "삭제 내역으로 이동"}>
                                                            <Trash2 size={14} />
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
                                        if (ns && editAssignData.period_months) { try { ne = format(addDays(parseISO(ns), editAssignData.period_months * 30), 'yyyy-MM-dd'); } catch { } }
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
                                        if (initialEditEndDate) {
                                            try { ne = format(addDays(parseISO(initialEditEndDate), (m - initialEditMonths) * 30), 'yyyy-MM-dd'); } catch { }
                                        } else if (editAssignData.start_date && m >= 0) {
                                            try { ne = format(addDays(parseISO(editAssignData.start_date), m * 30), 'yyyy-MM-dd'); } catch { }
                                        }
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
                        <Button onClick={handleUpdateEditAssign} className="bg-blue-600 hover:bg-blue-700">저장하기</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Tidal Login Style Popup */}
            {tidalLoginEmail && (
                <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setTidalLoginEmail(null)}>
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                    <div
                        className="relative w-[420px] rounded-2xl overflow-hidden shadow-2xl"
                        onClick={e => e.stopPropagation()}
                        style={{ background: 'linear-gradient(180deg, #0a0a14 0%, #111122 100%)' }}
                    >
                        {/* Close button */}
                        <button
                            onClick={() => setTidalLoginEmail(null)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors z-10"
                        >
                            닫기
                        </button>

                        {/* Tidal Logo */}
                        <div className="flex flex-col items-center pt-10 pb-4">
                            <svg width="40" height="26" viewBox="0 0 40 26" fill="none">
                                <path d="M13.33 0L6.67 6.67L0 0H0L6.67 6.67L0 13.33H6.67L13.33 6.67L20 0H13.33Z" fill="white"/>
                                <path d="M20 0L13.33 6.67L20 13.33H26.67L20 6.67L26.67 0H20Z" fill="white"/>
                                <path d="M33.33 0L26.67 6.67L33.33 13.33H40L33.33 6.67L40 0H33.33Z" fill="white"/>
                                <path d="M13.33 13.33L6.67 20L13.33 26.67L20 20L13.33 13.33Z" fill="white"/>
                            </svg>
                            <span className="text-white tracking-[0.4em] text-sm font-light mt-3">T I D A L</span>
                        </div>

                        {/* Title */}
                        <h2 className="text-center text-white text-xl font-bold mb-6">
                            Sign up or <span className="underline underline-offset-4">log in</span>
                        </h2>

                        {/* Form Card */}
                        <div className="mx-6 mb-6 p-5 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <label className="text-gray-400 text-xs mb-1 block">Email or username</label>
                            <div className="flex items-center gap-2 bg-transparent">
                                <input
                                    readOnly
                                    value={tidalLoginEmail}
                                    className="flex-1 bg-transparent text-white text-base outline-none border-none py-2"
                                    style={{ caretColor: 'transparent' }}
                                />
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(tidalLoginEmail);
                                        setCopied(true);
                                        setTimeout(() => setCopied(false), 2000);
                                    }}
                                    className="flex items-center justify-center w-8 h-8 rounded-lg transition-all"
                                    style={{ background: copied ? '#22c55e' : '#e04040' }}
                                    title="클립보드에 복사"
                                >
                                    {copied ? (
                                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                                    ) : (
                                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                    )}
                                </button>
                            </div>
                            <div className="border-b border-white/10 mt-1 mb-4" />

                            {/* Continue Button */}
                            <button
                                className="w-full py-3 rounded-full text-sm font-semibold transition-all hover:opacity-90"
                                style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.2)' }}
                                onClick={() => {
                                    window.open(`https://login.tidal.com/authorize?client_id=bakYq0nMtpuRYDtM&redirect_uri=${encodeURIComponent('https://account.tidal.com/login/tidal/return')}&response_type=code&geo=KR&campaignId=default&login_hint=${encodeURIComponent(tidalLoginEmail)}`, '_blank');
                                }}
                            >
                                Continue
                            </button>

                            <div className="text-center text-gray-500 text-xs my-4">or</div>

                            {/* Social Buttons */}
                            <button className="w-full py-3 rounded-full text-sm font-semibold mb-2 flex items-center justify-center gap-2 transition-all hover:opacity-80" style={{ background: 'rgba(255,255,255,0.08)', color: 'white', border: '1px solid rgba(255,255,255,0.15)' }}>
                                <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.9 33.5 29.4 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C33.9 5.5 29.2 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.2-2.6-.4-3.9z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.5 18.8 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C33.9 5.5 29.2 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5 0 9.5-1.8 13.1-4.7l-6-5.2c-2 1.5-4.5 2.4-7.1 2.4-5.3 0-9.8-3.5-11.4-8.3l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.1 5.2C37 39.1 44 34 44 24c0-1.3-.2-2.6-.4-3.9z"/></svg>
                                Continue with Google
                            </button>
                            <button className="w-full py-3 rounded-full text-sm font-semibold flex items-center justify-center gap-2 transition-all hover:opacity-80" style={{ background: 'rgba(255,255,255,0.08)', color: 'white', border: '1px solid rgba(255,255,255,0.15)' }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
                                Continue with Apple
                            </button>
                        </div>

                        {/* Copied Toast */}
                        {copied && (
                            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-green-500 text-white text-xs px-4 py-2 rounded-full shadow-lg animate-bounce">
                                클립보드에 복사됨
                            </div>
                        )}
                    </div>
                </div>
            )}

            <Dialog open={isMemoModalOpen} onOpenChange={setIsMemoModalOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader><DialogTitle>메모 편집</DialogTitle></DialogHeader>
                    <div className="py-4">
                        <textarea className="w-full min-h-[100px] p-3 border rounded-md text-sm outline-none focus:ring-2 focus:ring-primary" placeholder="메모를 입력하세요..." value={currentMemoInput} onChange={e => setCurrentMemoInput(e.target.value)} />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsMemoModalOpen(false)}>취소</Button>
                        <Button onClick={handleSaveMemo}>저장</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </main>
    );
}

export default function LegacyTidalInactivePageWrapper() {
    const [isUnlocked, setIsUnlocked] = useState(false);

    useEffect(() => {
        if (sessionStorage.getItem('quick-token')) setIsUnlocked(true);
    }, []);

    if (!isUnlocked) return <PasswordGate onUnlock={() => setIsUnlocked(true)} />;

    return <LegacyTidalInactivePage />
}

function LegacyTidalInactivePage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <LegacyTidalInactiveContent />
        </Suspense>
    );
}
