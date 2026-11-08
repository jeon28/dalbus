"use client";

import { useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { describePasswordRule } from '@/lib/password-utils';
import { fetchDerivedPassword, type FetchLike } from '@/lib/password-client';

interface PasswordGenerateButtonProps {
    /** 계산 기준 Tidal ID. 비어 있으면 버튼이 비활성화된다. */
    tidalId?: string | null;
    onGenerate: (password: string) => void;
    className?: string;
    /** 아이콘만 보일지 여부 (기본: 아이콘 + '계산' 글자) */
    iconOnly?: boolean;
    /** 기본 apiFetch 대신 쓸 fetch (기존 타이달 화면의 fetchFn 등) */
    fetchFn?: FetchLike;
    /** ID가 없을 때 보여줄 안내 (기본: ID를 먼저 입력하라는 문구) */
    disabledHint?: string;
}

/** Tidal ID 기준 비밀번호 계산 버튼. 입력란 옆에 붙여서 쓴다. */
export function PasswordGenerateButton({ tidalId, onGenerate, className = '', iconOnly = false, fetchFn, disabledHint }: PasswordGenerateButtonProps) {
    const [busy, setBusy] = useState(false);
    const id = tidalId?.trim() || '';
    const disabled = !id || busy;

    const handleClick = async () => {
        if (!id) return;
        setBusy(true);
        try {
            onGenerate(await fetchDerivedPassword(id, fetchFn));
        } catch (e) {
            alert(e instanceof Error ? e.message : String(e));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            title={!id && disabledHint ? disabledHint : describePasswordRule(id)}
            className={`h-9 shrink-0 gap-1 px-2 text-xs ${className}`}
            onClick={handleClick}
        >
            {busy ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            {!iconOnly && '계산'}
        </Button>
    );
}
