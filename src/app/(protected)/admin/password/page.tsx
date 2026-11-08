"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Copy, History, KeyRound, Loader2, Search, X } from 'lucide-react';
import { useServices } from '@/lib/ServiceContext';
import { apiFetch } from '@/lib/api';
import { fetchDerivedPassword } from '@/lib/password-client';
import { describePasswordRule, isHifiTidalId } from '@/lib/password-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordHistoryDialog, type PasswordHistoryTarget } from '@/components/admin/PasswordHistoryDialog';
import styles from '../admin.module.css';

interface LookupRow {
    source: 'tidal' | 'legacy';
    source_label: string;
    assignment_id: string;
    account_id: string;
    group_id: string;
    slot_number: number;
    type: string;
    tidal_id: string | null;
    stored_password: string | null;
    stored_from_group: boolean;
    derived_password: string | null;
    matches: boolean | null;
    buyer_name: string | null;
    buyer_phone: string | null;
    buyer_email: string | null;
    order_number: string | null;
    start_date: string | null;
    end_date: string | null;
    is_active: boolean;
    is_deleted: boolean;
}

function CopyButton({ value }: { value: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <button
            type="button"
            title="복사"
            className="inline-flex items-center text-gray-400 hover:text-blue-600"
            onClick={async () => {
                try {
                    await navigator.clipboard.writeText(value);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1200);
                } catch {
                    alert('복사에 실패했습니다.');
                }
            }}
        >
            {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
        </button>
    );
}

export default function PasswordLookupPage() {
    const { isAdmin, isHydrated } = useServices();
    const router = useRouter();

    // 계산기
    const [calcId, setCalcId] = useState('');
    const [calcResult, setCalcResult] = useState<{ id: string; password: string } | null>(null);
    const [calcBusy, setCalcBusy] = useState(false);

    // 저장값 검색
    const [query, setQuery] = useState('');
    const [includeDeleted, setIncludeDeleted] = useState(false);
    const [rows, setRows] = useState<LookupRow[] | null>(null);
    const [searchBusy, setSearchBusy] = useState(false);
    const [secretConfigured, setSecretConfigured] = useState<boolean | null>(null);
    const [historyTarget, setHistoryTarget] = useState<PasswordHistoryTarget | null>(null);

    useEffect(() => {
        if (isHydrated && !isAdmin) router.push('/admin');
    }, [isAdmin, isHydrated, router]);

    const handleCalc = async () => {
        const id = calcId.trim();
        if (!id) return;
        setCalcBusy(true);
        try {
            const password = await fetchDerivedPassword(id);
            setCalcResult({ id, password });
        } catch (e) {
            setCalcResult(null);
            alert(e instanceof Error ? e.message : String(e));
        } finally {
            setCalcBusy(false);
        }
    };

    const handleSearch = async () => {
        const q = query.trim();
        if (q.length < 2) { alert('검색어를 2자 이상 입력하세요.'); return; }
        setSearchBusy(true);
        try {
            const params = new URLSearchParams({ q });
            if (includeDeleted) params.set('deleted', 'true');
            const res = await apiFetch(`/api/admin/password/lookup?${params.toString()}`, { cache: 'no-store' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || '검색에 실패했습니다.');
            setRows(data.results || []);
            setSecretConfigured(data.secret_configured ?? null);
        } catch (e) {
            setRows(null);
            alert(e instanceof Error ? e.message : String(e));
        } finally {
            setSearchBusy(false);
        }
    };

    if (!isAdmin) return null;

    return (
        <div className="p-4 md:p-6">
            <div className={styles.header}>
                <h1 className={styles.title}>비밀번호 조회</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Tidal ID만 알면 규칙으로 비밀번호를 바로 계산하고, 저장된 비밀번호와 비교합니다.
                    hifitidal.com 계정은 6자리 숫자, 외부 메일은 8자리 혼합 규칙입니다.
                </p>
            </div>

            {secretConfigured === false && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    서버에 비밀번호 계산 키(TIDAL_PASSWORD_SECRET)가 없어 계산값을 만들 수 없습니다. 환경변수를 설정한 뒤 다시 시도하세요.
                </div>
            )}

            {/* 계산기 */}
            <div className="bg-white p-4 rounded-lg shadow-sm border mb-6">
                <div className="flex items-center gap-2 mb-3">
                    <KeyRound size={16} className="text-purple-600" />
                    <h2 className="font-bold text-sm">Tidal ID로 계산</h2>
                </div>
                <div className="flex flex-wrap gap-3 items-end">
                    <div className="flex-1 min-w-[240px]">
                        <Label className="text-xs font-medium text-gray-500 mb-1 block">Tidal ID</Label>
                        <Input
                            value={calcId}
                            onChange={(e) => setCalcId(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleCalc()}
                            placeholder="user@hifitidal.com"
                            className="font-mono"
                        />
                    </div>
                    <Button onClick={handleCalc} disabled={calcBusy || !calcId.trim()} className="gap-1">
                        {calcBusy ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
                        계산
                    </Button>
                    {calcResult && (
                        <div className="flex items-center gap-3 rounded-lg border bg-purple-50 px-4 py-2">
                            <div>
                                <div className="text-[11px] text-gray-500 font-mono">{calcResult.id}</div>
                                <div className="text-xl font-black font-mono tracking-widest text-purple-800">{calcResult.password}</div>
                            </div>
                            <CopyButton value={calcResult.password} />
                            <button type="button" className="text-gray-400 hover:text-gray-700" onClick={() => setCalcResult(null)} title="지우기">
                                <X size={14} />
                            </button>
                        </div>
                    )}
                </div>
                <p className="mt-2 text-[11px] text-gray-400">{describePasswordRule(calcId)}{calcId.trim() && !isHifiTidalId(calcId) ? ' (hifitidal.com 이 아닙니다)' : ''}</p>
            </div>

            {/* 저장값 검색 */}
            <div className="bg-white p-4 rounded-lg shadow-sm border mb-4">
                <div className="flex items-center gap-2 mb-3">
                    <Search size={16} className="text-blue-600" />
                    <h2 className="font-bold text-sm">저장된 비밀번호 검색</h2>
                    <span className="text-[11px] text-gray-400">Tidal · HifiTidal · 기존 Tidal 전체</span>
                </div>
                <div className="flex flex-wrap gap-3 items-end">
                    <div className="flex-1 min-w-[240px]">
                        <Label className="text-xs font-medium text-gray-500 mb-1 block">Tidal ID / 이름 / 전화번호 / 이메일 / 주문번호</Label>
                        <div className="relative">
                            <Input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                placeholder="검색어 2자 이상"
                                className="pl-9"
                            />
                            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        </div>
                    </div>
                    <label className="flex items-center gap-1.5 text-xs text-gray-600 pb-2.5 cursor-pointer">
                        <input type="checkbox" checked={includeDeleted} onChange={(e) => setIncludeDeleted(e.target.checked)} />
                        삭제된 배정 포함
                    </label>
                    <Button onClick={handleSearch} disabled={searchBusy} className="gap-1">
                        {searchBusy ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                        검색
                    </Button>
                </div>
            </div>

            {rows && (
                <div className="bg-white rounded-lg shadow-sm border overflow-x-auto">
                    <table className="w-full text-xs min-w-[1100px]">
                        <thead>
                            <tr className="text-gray-400 border-b bg-gray-50">
                                <th className="py-2 px-2 text-left">화면</th>
                                <th className="py-2 px-2 text-left">그룹-슬롯</th>
                                <th className="py-2 px-2 text-left">Tidal ID</th>
                                <th className="py-2 px-2 text-left">저장 PW</th>
                                <th className="py-2 px-2 text-left">계산 PW</th>
                                <th className="py-2 px-2 text-center">일치</th>
                                <th className="py-2 px-2 text-left">이름</th>
                                <th className="py-2 px-2 text-left">전화번호</th>
                                <th className="py-2 px-2 text-left">종료일</th>
                                <th className="py-2 px-2 text-center">상태</th>
                                <th className="py-2 px-2 text-center">이력</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 ? (
                                <tr><td colSpan={11} className="p-8 text-center text-gray-400">검색 결과가 없습니다.</td></tr>
                            ) : rows.map((r) => {
                                const href = r.source === 'tidal'
                                    ? `/admin/tidal?accountId=${r.account_id}&slotIdx=${r.slot_number}`
                                    : '/admin/legacy-tidal';
                                return (
                                    <tr key={`${r.source}_${r.assignment_id}`} className={`border-b last:border-0 h-10 ${r.is_deleted ? 'bg-gray-50 text-gray-400' : !r.is_active ? 'bg-red-50 text-red-600' : ''}`}>
                                        <td className="px-2 whitespace-nowrap">{r.source_label}</td>
                                        <td className="px-2 whitespace-nowrap">
                                            <Link href={href} className="text-blue-600 hover:underline font-bold">
                                                {r.group_id}-{r.slot_number + 1}
                                            </Link>
                                            <span className={`ml-1 px-1 rounded text-[10px] font-bold ${r.type === 'master' ? 'bg-purple-100 text-purple-700' : 'bg-blue-50 text-blue-600'}`}>
                                                {r.type === 'master' ? 'M' : 'U'}
                                            </span>
                                        </td>
                                        <td className="px-2 font-mono truncate max-w-[200px]" title={r.tidal_id || undefined}>{r.tidal_id || '-'}</td>
                                        <td className="px-2 font-mono whitespace-nowrap">
                                            {r.stored_password ? (
                                                <span className="inline-flex items-center gap-1">
                                                    {r.stored_password}
                                                    <CopyButton value={r.stored_password} />
                                                    {r.stored_from_group && <span className="text-[10px] text-gray-400" title="배정에 비밀번호가 없어 그룹 비밀번호를 표시">그룹</span>}
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td className="px-2 font-mono whitespace-nowrap">
                                            {r.derived_password ? (
                                                <span className="inline-flex items-center gap-1">
                                                    {r.derived_password}
                                                    <CopyButton value={r.derived_password} />
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td className="px-2 text-center">
                                            {r.matches === null ? <span className="text-gray-300">-</span>
                                                : r.matches ? <span className="text-green-600 font-bold">일치</span>
                                                : <span className="text-orange-600 font-bold" title="저장값이 규칙 계산값과 다릅니다 (규칙 도입 전 계정이거나 수동 변경)">불일치</span>}
                                        </td>
                                        <td className="px-2 truncate max-w-[100px]" title={r.buyer_name || undefined}>{r.buyer_name || '-'}</td>
                                        <td className="px-2 whitespace-nowrap">{r.buyer_phone || '-'}</td>
                                        <td className="px-2 font-mono whitespace-nowrap">{r.end_date || '-'}</td>
                                        <td className="px-2 text-center whitespace-nowrap">
                                            {r.is_deleted ? '삭제' : r.is_active ? '활성' : '비활성'}
                                        </td>
                                        <td className="px-2 text-center">
                                            <button
                                                type="button"
                                                title="비밀번호 변경 이력"
                                                className="inline-flex items-center text-gray-400 hover:text-blue-600"
                                                onClick={() => setHistoryTarget({ source: r.source, assignmentId: r.assignment_id, accountId: r.account_id, label: `${r.group_id}-${r.slot_number + 1}` })}
                                            >
                                                <History size={14} />
                                            </button>
                                        </td>
</tr>
                                );
                            })}
                        </tbody>
                    </table>
                    <div className="px-3 py-2 text-[11px] text-gray-400 border-t">
                        {rows.length}건 (화면당 최대 100건). 불일치는 규칙 도입 전에 무작위로 만든 비밀번호이거나 수동으로 바꾼 경우입니다. 실제 로그인은 저장 PW 기준입니다.
                    </div>
                </div>
            )}

            <PasswordHistoryDialog open={!!historyTarget} onOpenChange={(o) => { if (!o) setHistoryTarget(null); }} target={historyTarget} />
        </div>
    );
}
