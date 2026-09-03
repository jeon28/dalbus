"use client";

import React, { useCallback, useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Trash2, Download, RotateCcw, History, MessageSquareText } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { format, parseISO, differenceInDays } from 'date-fns';
import * as XLSX from 'xlsx';
import { apiFetch } from '@/lib/api';

const API_BASE = '/api/admin/qobuz';

interface QobuzHistory {
    id: string;
    account_id: string;
    slot_number: number;
    qobuz_id?: string;
    screen_name?: string;
    buyer_name?: string;
    buyer_phone?: string;
    buyer_email?: string;
    start_date?: string;
    end_date?: string;
    period_months?: number;
    amount?: number;
    memo?: string;
    is_active: boolean;
    is_deleted?: boolean;
    assigned_at?: string;
    updated_at?: string;
    accounts?: {
        id: string;
        login_id: string;
        master_email?: string;
        master_end_date?: string;
    };
}

/** 개월수가 비어 있을 때만 기간에서 추정한다 (저장 값이 있으면 그대로 사용) */
function resolvePeriodMonths(r: QobuzHistory): number {
    if (r.period_months) return r.period_months;
    if (r.start_date && r.end_date) {
        try { return Math.max(0, Math.floor(differenceInDays(parseISO(r.end_date), parseISO(r.start_date)) / 30)); } catch { }
    }
    return 0;
}

function fmt(date?: string, pattern = 'yy-MM-dd'): string {
    if (!date) return '-';
    try { return format(parseISO(date), pattern); } catch { return date; }
}

function QobuzInactiveContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [records, setRecords] = useState<QobuzHistory[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showDeleted, setShowDeleted] = useState(searchParams.get('showDeleted') === 'true');
    const [search, setSearch] = useState('');

    const [isMemoModalOpen, setIsMemoModalOpen] = useState(false);
    const [currentMemoInput, setCurrentMemoInput] = useState('');
    const [memoTargetId, setMemoTargetId] = useState('');

    const fetchRecords = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await apiFetch(`${API_BASE}/inactive?showDeleted=${showDeleted}`, { cache: 'no-store' });
            if (!res.ok) throw new Error(`Failed to fetch (${res.status})`);
            const data = await res.json();
            setRecords(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error(e);
            setRecords([]);
        } finally {
            setIsLoading(false);
        }
    }, [showDeleted]);

    useEffect(() => { fetchRecords(); }, [fetchRecords]);

    /**
     * 복원.
     *
     * 슬롯 번호는 그대로 두고 활성 상태만 되돌린다. 같은 슬롯이나 같은 Qobuz ID가 이미
     * 활성이면 부분 유니크 인덱스에 걸려 409 가 오므로, 그 메시지를 그대로 보여준다.
     */
    const handleRestore = async (record: QobuzHistory) => {
        const label = `${record.accounts?.login_id || ''}-${record.slot_number + 1}`;
        if (!confirm(`[${label}] ${record.buyer_name || ''} 배정을 복원하시겠습니까?`)) return;
        try {
            const res = await apiFetch(`${API_BASE}/assignment/${record.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_active: true, is_deleted: false })
            });
            if (!res.ok) { const e = await res.json().catch(() => null); throw new Error(e?.error || '복원 실패'); }
            alert('복원되었습니다.');
            fetchRecords();
        } catch (e) { alert(e instanceof Error ? e.message : String(e)); }
    };

    /** 비활성 내역 → 삭제 내역(휴지통)으로 이동 */
    const handleSoftDelete = async (record: QobuzHistory) => {
        if (!confirm('삭제 내역으로 옮기시겠습니까?')) return;
        try {
            const res = await apiFetch(`${API_BASE}/assignment/${record.id}`, { method: 'DELETE' });
            if (!res.ok) { const e = await res.json().catch(() => null); throw new Error(e?.error || '삭제 실패'); }
            fetchRecords();
        } catch (e) { alert(e instanceof Error ? e.message : String(e)); }
    };

    /** 삭제 내역 → 영구 삭제 (되돌릴 수 없음) */
    const handleHardDelete = async (record: QobuzHistory) => {
        if (!confirm(`영구 삭제하면 되돌릴 수 없습니다.\n${record.buyer_name || ''} (${record.qobuz_id || '-'}) 을 완전히 지우시겠습니까?`)) return;
        try {
            const res = await apiFetch(`${API_BASE}/assignment/${record.id}?hardDelete=true`, { method: 'DELETE' });
            if (!res.ok) { const e = await res.json().catch(() => null); throw new Error(e?.error || '영구 삭제 실패'); }
            fetchRecords();
        } catch (e) { alert(e instanceof Error ? e.message : String(e)); }
    };

    /** 메모는 타임스탬프를 맨 위 새 줄로 붙여 최신이 위로 쌓이게 한다. */
    const openMemoModal = (record: QobuzHistory) => {
        setMemoTargetId(record.id);
        const now = new Date();
        const timestamp = `${String(now.getFullYear()).slice(-2)}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} `;
        setCurrentMemoInput(record.memo ? timestamp + "\n" + record.memo : timestamp);
        setIsMemoModalOpen(true);
    };

    const handleSaveMemo = async () => {
        if (!memoTargetId) return;
        try {
            const res = await apiFetch(`${API_BASE}/assignment/${memoTargetId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ memo: currentMemoInput })
            });
            if (!res.ok) throw new Error('저장 실패');
            setIsMemoModalOpen(false);
            fetchRecords();
        } catch (e) { alert(e instanceof Error ? e.message : String(e)); }
    };

    const filtered = records.filter(r => {
        const q = search.toLowerCase().trim();
        if (!q) return true;
        return [r.buyer_name, r.qobuz_id, r.screen_name, r.buyer_email, r.buyer_phone, r.accounts?.login_id, r.accounts?.master_email]
            .some(v => (v || '').toLowerCase().includes(q));
    });

    const exportToExcel = () => {
        const excelData = filtered.map((r, idx) => ({
            'No.': idx + 1,
            '그룹': r.accounts?.login_id ?? '',
            '배정번호': `${r.accounts?.login_id ?? ''}-${r.slot_number + 1}`,
            '대표계정': r.accounts?.master_email ?? '',
            'ID': r.qobuz_id ?? '',
            'SCREEN NAME': r.screen_name ?? '',
            'TEL': r.buyer_phone ?? '',
            '이메일': r.buyer_email ?? '',
            '이름': r.buyer_name ?? '',
            '구독 개시': r.start_date ?? '',
            '구독 종료일': r.end_date ?? '',
            '구독 기간': resolvePeriodMonths(r),
            '계약금액': r.amount ?? 0,
            '메모': r.memo ?? '',
            '변경일': r.updated_at ?? r.assigned_at ?? ''
        }));
        const label = showDeleted ? '삭제내역' : '비활성내역';
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(excelData), `QOBUZ_${label}`);
        XLSX.writeFile(wb, `QOBUZ_${label}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    };

    return (
        <main className="p-4 bg-[#f8fafc] min-h-screen max-w-[1200px] mx-auto">
            <header className="bg-white border rounded-xl shadow-sm mb-4 p-3">
                <div className="flex flex-col md:flex-row justify-between items-center gap-3">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="sm" className="h-9 gap-1.5" onClick={() => router.push('/admin/qobuz')}>
                            <ArrowLeft size={16} /> 목록
                        </Button>
                        <h1 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            <span className="bg-sky-100 text-sky-700 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider border border-sky-200">QOBUZ</span>
                            {showDeleted ? '삭제 내역' : '비활성 내역'}
                        </h1>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                        <input
                            type="text"
                            placeholder="검색..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="h-9 px-3 text-sm border rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-44"
                        />
                        <Button
                            variant={showDeleted ? "default" : "outline"}
                            size="sm"
                            className="h-9 px-3 text-xs gap-1.5"
                            onClick={() => setShowDeleted(v => !v)}
                        >
                            <History className="w-3.5 h-3.5" /> {showDeleted ? '비활성 보기' : '삭제 보기'}
                        </Button>
                        <Button variant="outline" size="sm" className="h-9 px-3 text-xs gap-1.5 text-blue-700 border-blue-200" onClick={exportToExcel}>
                            <Download className="w-3.5 h-3.5" /> 엑셀
                        </Button>
                    </div>
                </div>
            </header>

            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-[11px] min-w-[900px]">
                        <thead>
                            <tr className="bg-slate-50 border-b text-slate-500 uppercase font-bold tracking-tight">
                                <th className="px-2 py-3 text-center border-r border-slate-100 whitespace-nowrap">번호</th>
                                <th className="px-2 py-3 text-left border-r border-slate-100 whitespace-nowrap">대표계정</th>
                                <th className="px-2 py-3 text-left border-r border-slate-100 whitespace-nowrap">ID</th>
                                <th className="px-2 py-3 text-left border-r border-slate-100 whitespace-nowrap">Screen Name</th>
                                <th className="px-2 py-3 text-left border-r border-slate-100 whitespace-nowrap">이름</th>
                                <th className="px-2 py-3 text-left border-r border-slate-100 whitespace-nowrap">TEL</th>
                                <th className="px-2 py-3 text-center border-r border-slate-100 whitespace-nowrap">구독 개시</th>
                                <th className="px-2 py-3 text-center border-r border-slate-100 whitespace-nowrap">구독 종료일</th>
                                <th className="px-2 py-3 text-center border-r border-slate-100 whitespace-nowrap">기간</th>
                                <th className="px-2 py-3 text-right border-r border-slate-100 whitespace-nowrap">계약금액</th>
                                <th className="px-2 py-3 text-center border-r border-slate-100 whitespace-nowrap">변경일</th>
                                <th className="px-2 py-3 text-left border-r border-slate-100 whitespace-nowrap">메모</th>
                                <th className="px-2 py-3 text-center whitespace-nowrap">관리</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr><td colSpan={13} className="p-12 text-center text-slate-400">
                                    <div className="inline-flex items-center gap-2">
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-sky-500" /> 불러오는 중...
                                    </div>
                                </td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={13} className="p-12 text-center text-slate-400">
                                    {showDeleted ? '삭제된 내역이 없습니다.' : '비활성 내역이 없습니다.'}
                                </td></tr>
                            ) : filtered.map(r => (
                                <tr key={r.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${showDeleted ? 'bg-red-50/30' : ''}`}>
                                    <td className="px-2 py-2 text-center font-bold border-r border-slate-100 whitespace-nowrap">
                                        {r.accounts?.login_id || '-'}-{r.slot_number + 1}
                                    </td>
                                    <td className="px-2 py-2 border-r border-slate-100 whitespace-nowrap truncate max-w-[170px]" title={r.accounts?.master_email}>
                                        {r.accounts?.master_email || '-'}
                                    </td>
                                    <td className="px-2 py-2 border-r border-slate-100 whitespace-nowrap truncate max-w-[160px]" title={r.qobuz_id}>{r.qobuz_id || '-'}</td>
                                    <td className="px-2 py-2 border-r border-slate-100 whitespace-nowrap truncate max-w-[110px]">{r.screen_name || '-'}</td>
                                    <td className="px-2 py-2 border-r border-slate-100 whitespace-nowrap truncate max-w-[80px]">{r.buyer_name || '-'}</td>
                                    <td className="px-2 py-2 border-r border-slate-100 whitespace-nowrap font-mono text-slate-500">{r.buyer_phone || '-'}</td>
                                    <td className="px-2 py-2 border-r border-slate-100 text-center font-mono whitespace-nowrap">{fmt(r.start_date)}</td>
                                    <td className="px-2 py-2 border-r border-slate-100 text-center font-mono whitespace-nowrap">{fmt(r.end_date)}</td>
                                    <td className="px-2 py-2 border-r border-slate-100 text-center whitespace-nowrap">{resolvePeriodMonths(r) ? `${resolvePeriodMonths(r)}개월` : '-'}</td>
                                    <td className="px-2 py-2 border-r border-slate-100 text-right font-mono whitespace-nowrap">{r.amount ? r.amount.toLocaleString() : '-'}</td>
                                    <td className="px-2 py-2 border-r border-slate-100 text-center font-mono text-slate-500 whitespace-nowrap">
                                        {fmt(r.updated_at || r.assigned_at, 'MM/dd HH:mm')}
                                    </td>
                                    <td className="px-2 py-2 border-r border-slate-100 whitespace-nowrap">
                                        <div className="flex items-center gap-1.5 cursor-pointer group/memo" onClick={() => openMemoModal(r)}>
                                            <MessageSquareText size={14} className={r.memo ? 'text-blue-500' : 'text-slate-300 group-hover/memo:text-slate-500'} />
                                            <span className="text-[10px] text-slate-400 truncate max-w-[90px]">{r.memo ? r.memo.split('\n')[0] : ''}</span>
                                        </div>
                                    </td>
                                    <td className="px-2 py-2 whitespace-nowrap">
                                        <div className="flex items-center justify-center gap-1">
                                            <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px] gap-1 text-emerald-600 hover:bg-emerald-50" onClick={() => handleRestore(r)}>
                                                <RotateCcw size={12} /> 복원
                                            </Button>
                                            {showDeleted ? (
                                                <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px] gap-1 text-red-600 hover:bg-red-50" onClick={() => handleHardDelete(r)}>
                                                    <Trash2 size={12} /> 영구삭제
                                                </Button>
                                            ) : (
                                                <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px] gap-1 text-slate-500 hover:bg-slate-100" onClick={() => handleSoftDelete(r)}>
                                                    <Trash2 size={12} /> 삭제
                                                </Button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {!isLoading && filtered.length > 0 && (
                    <div className="px-4 py-3 bg-slate-50 border-t text-[11px] text-slate-500">
                        총 {filtered.length}건
                        {showDeleted && ' · 영구삭제는 되돌릴 수 없습니다.'}
                    </div>
                )}
            </div>

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
        </main>
    );
}

export default function AdminQobuzInactivePage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500"></div>
            </div>
        }>
            <QobuzInactiveContent />
        </Suspense>
    );
}
