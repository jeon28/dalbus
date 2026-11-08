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
    /** 외부에서 강제로 비활성화 */
    disabled?: boolean;
    /** 계산 직전에 호출. false 를 돌려주면 계산하지 않는다 (예: 잠금 해제 확인) */
    beforeGenerate?: () => boolean;
}

/** Tidal ID 기준 비밀번호 계산 버튼. 입력란 옆에 붙여서 쓴다. */
export function PasswordGenerateButton({ tidalId, onGenerate, className = '', iconOnly = false, fetchFn, disabledHint, disabled: forceDisabled = false, beforeGenerate }: PasswordGenerateButtonProps) {
    const [busy, setBusy] = useState(false);
    const id = tidalId?.trim() || '';
    const disabled = forceDisabled || busy;

    const handleClick = async () => {
        // ID가 없으면 버튼을 죽이지 않고 이유를 알려준다 (비활성 버튼은 왜 안 되는지 알기 어려움)
        if (!id) {
            alert(disabledHint || 'Tidal ID를 먼저 입력하세요.');
            return;
        }
        if (beforeGenerate && !beforeGenerate()) return;
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
            title={(forceDisabled || !id) && disabledHint ? disabledHint : describePasswordRule(id)}
            aria-disabled={!id || undefined}
            className={`h-9 shrink-0 gap-1 px-2 text-xs ${!id ? 'opacity-60' : ''} ${className}`}
            onClick={handleClick}
        >
            {busy ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            {!iconOnly && '계산'}
        </Button>
    );
}
