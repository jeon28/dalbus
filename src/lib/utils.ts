import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

// 입력 중 실시간 포맷: 010-1234-5678
export function formatPhoneInput(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

export function normalizePhone(phone: string | null | undefined): string {
    if (!phone) return '';
    const digits = phone.replace(/[^0-9]/g, '');

    if (digits.startsWith('010')) {
        if (digits.length === 11) {
            return digits.replace(/^(\d{3})(\d{4})(\d{4})$/, '$1-$2-$3');
        } else if (digits.length === 10) {
            return digits.replace(/^(\d{3})(\d{3})(\d{4})$/, '$1-$2-$3');
        }
    }

    return digits;
}

export function normalizeBirthDate(date: string | null | undefined): string {
    if (!date) return '';
    // Handle YYYY.MM.DD
    return date.replace(/\./g, '-');
}

