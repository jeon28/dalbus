"use client";

import { useState } from 'react';
import { History, Lock, LockOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordGenerateButton } from '@/components/admin/PasswordGenerateButton';
import { PasswordHistoryDialog, type PasswordHistoryTarget } from '@/components/admin/PasswordHistoryDialog';
import type { FetchLike } from '@/lib/password-client';

interface PasswordFieldProps {
    value: string;
    onChange: (value: string) => void;
    /** 저장돼 있던 값. 비어 있지 않으면 입력란이 잠긴 채로 시작한다. */
    initialValue?: string | null;
    /** 계산 버튼 기준 Tidal ID */
    tidalId?: string | null;
    fetchFn?: FetchLike;
    placeholder?: string;
    className?: string;
    inputClassName?: string;
    buttonClassName?: string;
    disabledHint?: string;
    /** 주면 이력 버튼이 생긴다 */
    history?: PasswordHistoryTarget;
}

const UNLOCK_MESSAGE =
    '저장된 비밀번호를 바꾸려고 합니다.\n\n' +
    '여기 값만 바꾸면 실제 Tidal 계정과 어긋나 고객이 로그인하지 못합니다.\n' +
    'Tidal(실제 계정)에서 먼저 비밀번호를 변경했는지 확인하세요.\n\n' +
    '잠금을 해제할까요?';

/**
 * 비밀번호 입력란 (잠금 + 계산 + 이력)
 * - 값이 이미 있으면 읽기전용으로 시작, 자물쇠를 눌러 확인 후 편집
 * - 계산 버튼은 잠금 해제 상태(또는 빈 값)에서만 동작
 */
export function PasswordField({
    value, onChange, initialValue, tidalId, fetchFn, placeholder,
    className = '', inputClassName = '', buttonClassName = '', disabledHint, history,
}: PasswordFieldProps) {
    const hasStored = !!(initialValue && initialValue.trim());
    // 어떤 행(저장값+대상)에 대해 잠금을 풀었는지 기억한다. 다른 행을 열면 키가 달라져 자동으로 다시 잠긴다.
    const lockKey = `${history?.assignmentId || ''}|${history?.accountId || ''}|${initialValue || ''}`;
    const [unlockedFor, setUnlockedFor] = useState<string | null>(null);
    const [historyOpen, setHistoryOpen] = useState(false);
    const locked = hasStored && unlockedFor !== lockKey;

    /** 잠겨 있으면 확인창을 띄우고, 승인 시 잠금을 푼다. 계속 진행해도 되면 true */
    const ensureUnlocked = (): boolean => {
        if (!locked) return true;
        if (!window.confirm(UNLOCK_MESSAGE)) return false;
        setUnlockedFor(lockKey);
        return true;
    };

    const toggleLock = () => {
        if (locked) {
            ensureUnlocked();
        } else {
            // 다시 잠그면 원래 값으로 되돌린다
            onChange(initialValue || '');
            setUnlockedFor(null);
        }
    };

    return (
        <div className={`flex gap-1 min-w-0 ${className}`}>
            <Input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                readOnly={locked}
                placeholder={placeholder}
                title={locked ? '잠겨 있습니다. 자물쇠를 눌러 해제하세요.' : undefined}
                className={`font-mono min-w-0 flex-1 ${locked ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : 'bg-white'} ${inputClassName}`}
            />
            {hasStored && (
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    title={locked ? '잠금 해제 (확인 필요)' : '다시 잠그기 (원래 값으로 되돌림)'}
                    className={`h-9 shrink-0 px-2 ${locked ? 'text-gray-500' : 'text-orange-600 border-orange-300 bg-orange-50'} ${buttonClassName}`}
                    onClick={toggleLock}
                >
                    {locked ? <Lock size={13} /> : <LockOpen size={13} />}
                </Button>
            )}
            <PasswordGenerateButton
                iconOnly
                tidalId={tidalId}
                fetchFn={fetchFn}
                beforeGenerate={ensureUnlocked}
                disabledHint={disabledHint}
                className={buttonClassName}
                onGenerate={onChange}
            />
            {history && (
                <>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        title="비밀번호 변경 이력"
                        className={`h-9 shrink-0 px-2 text-gray-500 ${buttonClassName}`}
                        onClick={() => setHistoryOpen(true)}
                    >
                        <History size={13} />
                    </Button>
                    <PasswordHistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} target={history} fetchFn={fetchFn} />
                </>
            )}
        </div>
    );
}
