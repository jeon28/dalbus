"use client";

import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { describePasswordRule, generateTidalPassword } from '@/lib/password-utils';

interface PasswordGenerateButtonProps {
    /** 규칙 판정에 쓰는 Tidal ID (****@hifitidal.com 이면 6자리 숫자) */
    tidalId?: string | null;
    onGenerate: (password: string) => void;
    className?: string;
    /** 아이콘만 보일지 여부 (기본: 아이콘 + '생성' 글자) */
    iconOnly?: boolean;
}

/** 초기 비밀번호 생성 버튼. 입력란 옆에 붙여서 쓴다. */
export function PasswordGenerateButton({ tidalId, onGenerate, className = '', iconOnly = false }: PasswordGenerateButtonProps) {
    return (
        <Button
            type="button"
            size="sm"
            variant="outline"
            title={describePasswordRule(tidalId)}
            className={`h-9 shrink-0 gap-1 px-2 text-xs ${className}`}
            onClick={() => onGenerate(generateTidalPassword(tidalId))}
        >
            <RefreshCw size={13} />
            {!iconOnly && '생성'}
        </Button>
    );
}
