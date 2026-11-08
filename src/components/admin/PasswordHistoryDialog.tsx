"use client";

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { apiFetch } from '@/lib/api';
import type { FetchLike } from '@/lib/password-client';

export interface PasswordHistoryTarget {
    source: 'tidal' | 'legacy';
    assignmentId?: string;
    accountId?: string;
    /** 제목에 보여줄 이름 (예: TG003-1 / user@hifitidal.com) */
    label?: string;
}

interface HistoryRow {
    id: string;
    field: 'tidal_password' | 'login_pw';
    old_value: string | null;
    new_value: string | null;
    changed_at: string;
    login_id: string | null;
    tidal_id: string | null;
}

interface PasswordHistoryDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    target: PasswordHistoryTarget | null;
    fetchFn?: FetchLike;
}

/** 배정 비밀번호 + 그룹 비밀번호 변경 이력 팝업 */
export function PasswordHistoryDialog({ open, onOpenChange, target, fetchFn = apiFetch }: PasswordHistoryDialogProps) {
    const [rows, setRows] = useState<HistoryRow[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!open || !target) return;
        let cancelled = false;
        (async () => {
            setBusy(true); setError(null); setRows(null);
            try {
                const params = new URLSearchParams({ source: target.source });
                if (target.assignmentId) params.set('assignment_id', target.assignmentId);
                if (target.accountId) params.set('account_id', target.accountId);
                const res = await fetchFn(`/api/admin/password/history?${params.toString()}`, { cache: 'no-store' });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data?.error || '이력을 불러오지 못했습니다.');
                if (!cancelled) setRows(data.results || []);
            } catch (e) {
                if (!cancelled) setError(e instanceof Error ? e.message : String(e));
            } finally {
                if (!cancelled) setBusy(false);
            }
        })();
        return () => { cancelled = true; };
    }, [open, target, fetchFn]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[560px]">
                <DialogHeader>
                    <DialogTitle>비밀번호 변경 이력{target?.label ? ` / ${target.label}` : ''}</DialogTitle>
                    <DialogDescription className="text-xs text-gray-500">
                        배정 비밀번호와 그 그룹의 비밀번호가 바뀐 기록입니다. DB에서 자동 기록되므로 모든 변경 경로가 남습니다.
                    </DialogDescription>
                </DialogHeader>
                <div className="max-h-[60vh] overflow-y-auto">
                    {busy ? (
                        <div className="flex items-center justify-center gap-2 p-8 text-sm text-gray-400"><Loader2 size={16} className="animate-spin" /> 불러오는 중</div>
                    ) : error ? (
                        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
                    ) : !rows || rows.length === 0 ? (
                        <div className="p-8 text-center text-sm text-gray-400">변경 이력이 없습니다. (이력 기능 도입 이후의 변경만 기록됩니다)</div>
                    ) : (
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="text-gray-400 border-b">
                                    <th className="py-2 px-2 text-left">일시</th>
                                    <th className="py-2 px-2 text-left">대상</th>
                                    <th className="py-2 px-2 text-left">이전</th>
                                    <th className="py-2 px-2 text-left">이후</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map(r => (
                                    <tr key={r.id} className="border-b last:border-0">
                                        <td className="py-2 px-2 font-mono text-gray-500 whitespace-nowrap">
                                            {(() => { try { return format(parseISO(r.changed_at), 'yy.MM.dd HH:mm'); } catch { return r.changed_at; } })()}
                                        </td>
                                        <td className="py-2 px-2 whitespace-nowrap">
                                            {r.field === 'login_pw'
                                                ? <span className="px-1 rounded bg-purple-100 text-purple-700 font-bold">그룹 {r.login_id || ''}</span>
                                                : <span className="px-1 rounded bg-blue-50 text-blue-600 font-bold">배정</span>}
                                        </td>
                                        <td className="py-2 px-2 font-mono text-gray-500">{r.old_value || <span className="text-gray-300">(없음)</span>}</td>
                                        <td className="py-2 px-2 font-mono font-bold">{r.new_value || <span className="text-gray-300">(없음)</span>}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
