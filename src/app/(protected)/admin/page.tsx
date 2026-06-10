"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useServices } from '@/lib/ServiceContext';
import { useRouter } from 'next/navigation';
import styles from './admin.module.css';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from '@/lib/api';

interface Order {
    id: string;
    created_at: string;
    amount: number;
    payment_status: string;
    assignment_status: string;
}

interface BankAccount {
    id: string;
    bank_name: string;
    account_number: string;
    account_holder: string;
}

export default function AdminPage() {
    const { isAdmin, isHydrated } = useServices();
    const router = useRouter();

    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);

    // Settings State
    const [settings, setSettings] = useState({
        admin_login_pw: '',
        admin_sender_email: '',
        admin_email: '',
        admin_phone: '',
        brand_primary: '#18181b'
    });
    const [originalSettings, setOriginalSettings] = useState(settings);

    // Menu Visibility State
    const [menuSettings, setMenuSettings] = useState({
        menu_services_enabled: 'true',
        menu_notices_enabled: 'true',
        menu_faq_enabled: 'true',
        menu_qna_enabled: 'true',
    });
    const [originalMenuSettings, setOriginalMenuSettings] = useState(menuSettings);
    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
    const [newBank, setNewBank] = useState({ bank_name: '', account_number: '', account_holder: '' });

    const fetchStats = async () => {
        try {
            setLoading(true);
            const res = await apiFetch('/api/admin/orders');
            if (res.ok) {
                const result = await res.json();
                // The API now returns { data: Order[], pagination: ... }
                setOrders(result.data || []);
            }
        } catch (error: unknown) {
            console.error('Error fetching stats:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchSettings = async () => {
        const res = await apiFetch('/api/admin/settings');
        if (res.ok) {
            const data = await res.json();
            // 기본값과 병합하여 brand_primary 등 미저장 키도 항상 정의되게 한다.
            const merged = {
                admin_login_pw: data.admin_login_pw ?? '',
                admin_sender_email: data.admin_sender_email ?? '',
                admin_email: data.admin_email ?? '',
                admin_phone: data.admin_phone ?? '',
                brand_primary: data.brand_primary || '#18181b',
            };
            setSettings(merged);
            setOriginalSettings(merged);
            const ms = {
                menu_services_enabled: data.menu_services_enabled ?? 'true',
                menu_notices_enabled: data.menu_notices_enabled ?? 'true',
                menu_faq_enabled: data.menu_faq_enabled ?? 'true',
                menu_qna_enabled: data.menu_qna_enabled ?? 'true',
            };
            setMenuSettings(ms);
            setOriginalMenuSettings(ms);
        }
    };

    const fetchBankAccounts = async () => {
        const res = await apiFetch('/api/admin/bank-accounts');
        if (res.ok) {
            const data = await res.json();
            setBankAccounts(data);
        }
    };

    useEffect(() => {
        if (isAdmin) {
            fetchStats();
            fetchSettings();
            fetchBankAccounts();
        }
    }, [isAdmin]);


    const handleSaveSettings = async () => {
        const updates: Record<string, string> = {};

        // Calculate diff
        (Object.keys(settings) as Array<keyof typeof settings>).forEach(key => {
            if (settings[key] !== originalSettings[key]) {
                updates[key] = settings[key];
            }
        });

        if (Object.keys(updates).length === 0) {
            alert('변경사항이 없습니다.');
            return;
        }

        const res = await apiFetch('/api/admin/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });

        if (res.ok) {
            alert('관리자 설정이 저장되었습니다.');
            // Update original settings to match current state
            setOriginalSettings(prev => ({ ...prev, ...updates }));
        }
    };

    // hex(#rrggbb) → "H S% L%" (Tailwind hsl(var(--primary)) 용). 라이브 미리보기에 사용.
    const hexToHsl = (hex: string): { primary: string; foreground: string } => {
        const h = hex.replace('#', '');
        if (!/^[0-9a-fA-F]{6}$/.test(h)) return { primary: '222 47% 11%', foreground: '0 0% 100%' };
        const r = parseInt(h.substring(0, 2), 16) / 255;
        const g = parseInt(h.substring(2, 4), 16) / 255;
        const b = parseInt(h.substring(4, 6), 16) / 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let hue = 0, sat = 0; const light = (max + min) / 2;
        if (max !== min) {
            const d = max - min;
            sat = light > 0.5 ? d / (2 - max - min) : d / (max + min);
            if (max === r) hue = (g - b) / d + (g < b ? 6 : 0);
            else if (max === g) hue = (b - r) / d + 2;
            else hue = (r - g) / d + 4;
            hue /= 6;
        }
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        return {
            primary: `${Math.round(hue * 360)} ${Math.round(sat * 100)}% ${Math.round(light * 100)}%`,
            foreground: lum > 0.55 ? '222 47% 11%' : '0 0% 100%',
        };
    };

    const applyBrandLive = (hex: string) => {
        const { primary, foreground } = hexToHsl(hex);
        const root = document.documentElement;
        root.style.setProperty('--primary', primary);
        root.style.setProperty('--primary-foreground', foreground);
        root.style.setProperty('--ring', primary);
    };

    const BRAND_PRESETS = [
        { hex: '#18181b', name: '블랙' },
        { hex: '#0066ff', name: '블루' },
        { hex: '#6d28d9', name: '퍼플' },
        { hex: '#0891b2', name: '틸' },
        { hex: '#e11d48', name: '로즈' },
        { hex: '#059669', name: '그린' },
    ];

    const handleSaveBrand = async () => {
        const res = await apiFetch('/api/admin/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ brand_primary: settings.brand_primary })
        });
        if (res.ok) {
            setOriginalSettings(prev => ({ ...prev, brand_primary: settings.brand_primary }));
            applyBrandLive(settings.brand_primary);
            alert('브랜드 색상이 저장되었습니다. 사이트 전체에 반영됩니다.');
        } else {
            alert('저장 실패. 다시 시도해주세요.');
        }
    };

    const handleAddBank = async () => {
        if (!newBank.bank_name || !newBank.account_number || !newBank.account_holder) {
            alert('모든 정보를 입력해주세요.');
            return;
        }
        const res = await apiFetch('/api/admin/bank-accounts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newBank)
        });
        if (res.ok) {
            fetchBankAccounts();
            setNewBank({ bank_name: '', account_number: '', account_holder: '' });
        }
    };

    const handleDeleteBank = async (id: string) => {
        if (!confirm('삭제하시겠습니까?')) return;
        const res = await apiFetch(`/api/admin/bank-accounts/${id}`, { method: 'DELETE' });
        if (res.ok) {
            fetchBankAccounts();
        } else {
            const data = await res.json().catch(() => ({}));
            alert('삭제 실패: ' + (data.error || '서버 오류가 발생했습니다.'));
        }
    };

    const handleSaveMenuSettings = async () => {
        const updates: Record<string, string> = {};
        (Object.keys(menuSettings) as Array<keyof typeof menuSettings>).forEach(key => {
            if (menuSettings[key] !== originalMenuSettings[key]) {
                updates[key] = menuSettings[key];
            }
        });

        if (Object.keys(updates).length === 0) {
            alert('변경사항이 없습니다.');
            return;
        }

        const res = await apiFetch('/api/admin/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });

        if (res.ok) {
            alert('메뉴 설정이 저장되었습니다.');
            setOriginalMenuSettings(prev => ({ ...prev, ...updates }));
        } else {
            alert('저장 실패. 다시 시도해주세요.');
        }
    };

    const toggleMenu = (key: keyof typeof menuSettings) => {
        setMenuSettings(prev => ({
            ...prev,
            [key]: prev[key] === 'false' ? 'true' : 'false'
        }));
    };

    useEffect(() => {
        // 비밀번호 게이트(레이아웃)를 통과하지 못한 경우만 홈으로
        if (isHydrated && !isAdmin) {
            router.replace('/');
        }
    }, [isHydrated, isAdmin, router]);

    if (!isHydrated) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100">
                <div className="animate-pulse text-gray-500 font-medium">관리자 상태 확인 중...</div>
            </div>
        );
    }

    // 관리자가 아니면 렌더링 중단 (useEffect에서 리다이렉트 처리)
    if (!isAdmin) return null;

    if (loading) return <div className="p-8">Loading...</div>;

    const waitingDistributions = (orders || []).filter(o => o?.assignment_status === 'waiting').length;
    const todaySales = (orders || [])
        .filter(o => {
            if (!o?.created_at) return false;
            const date = new Date(o.created_at);
            const today = new Date();
            return date.toDateString() === today.toDateString();
        })
        .reduce((sum, o) => sum + (o?.payment_status === 'paid' || o?.payment_status === 'pending' ? o.amount : 0), 0);

    const totalSettledAmount = (orders || []).reduce((acc, curr) => acc + (curr?.payment_status === 'paid' ? curr.amount : 0), 0);


    return (
        <main className={styles.main}>
            <header className={`${styles.header} glass border-b border-gray-100`}>
                <div className="container flex flex-col sm:flex-row justify-between items-center px-4 gap-3 sm:gap-0">
                    <h1 className={`${styles.title} text-center sm:text-left`}>관리자 대시보드</h1>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 hidden xs:inline">Today: {new Date().toLocaleDateString()}</span>
                    </div>
                </div>
            </header>

            <div className={`${styles.content} container px-4 pb-20 pt-6 sm:pt-8`}>
                <section className={styles.stats}>
                    <div className={`${styles.statCard} glass shadow-sm border-l-4 border-l-orange-500`}>
                        <span className="text-gray-500 font-medium">대기 중인 분배</span>
                        <strong className="text-2xl mt-1">{waitingDistributions}</strong>
                    </div>
                    <div className={`${styles.statCard} glass shadow-sm border-l-4 border-l-blue-500`}>
                        <span className="text-gray-500 font-medium">오늘의 매출</span>
                        <strong className="text-2xl mt-1">₩{todaySales.toLocaleString()}</strong>
                    </div>
                    <div className={`${styles.statCard} glass shadow-sm border-l-4 border-l-green-500`}>
                        <span className="text-gray-500 font-medium">누적 정산액</span>
                        <strong className="text-2xl mt-1">₩{totalSettledAmount.toLocaleString()}</strong>
                    </div>
                </section>

                <div className="mt-6 mb-8 p-4 bg-gray-50/80 rounded-lg border border-dashed border-gray-200">
                    <p className="text-xs sm:text-sm text-gray-500 text-center sm:text-left">
                        * 대시보드는 현황을 요약하여 보여줍니다. 상세 관리는 상단 메뉴 또는 사이드바를 이용해 주세요.
                    </p>
                </div>

                {/* Menu Visibility Settings */}
                <section className="mb-8">
                    <h3 className="text-lg font-bold mb-4">메뉴 표시 설정</h3>
                    <div className="glass p-6 rounded-xl shadow-sm">
                        <p className="text-sm text-gray-500 mb-5">헤더 네비게이션에 표시할 메뉴를 선택하세요.</p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                            {([
                                { key: 'menu_services_enabled', label: '서비스 관리', href: '/admin/services' },
                                { key: 'menu_notices_enabled', label: '공지사항 관리', href: '/admin/notices' },
                                { key: 'menu_faq_enabled', label: 'FAQ 관리', href: '/admin/faqs' },
                                { key: 'menu_qna_enabled', label: 'Q&A 관리', href: '/admin/qna' },
                            ] as { key: keyof typeof menuSettings; label: string; href: string }[]).map(({ key, label, href }) => {
                                const isOn = menuSettings[key] !== 'false';
                                return (
                                    <div key={key} className="flex flex-col items-center gap-2 p-4 rounded-lg border bg-white">
                                        <Link href={href} className="text-sm font-bold text-primary hover:underline">{label}</Link>
                                        <button
                                            type="button"
                                            onClick={() => toggleMenu(key)}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isOn ? 'bg-black' : 'bg-gray-300'}`}
                                        >
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${isOn ? 'translate-x-6' : 'translate-x-1'}`} />
                                        </button>
                                        <span className={`text-xs font-semibold ${isOn ? 'text-green-600' : 'text-gray-400'}`}>
                                            {isOn ? '표시' : '숨김'}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                        <Button onClick={handleSaveMenuSettings} className="w-full bg-black text-white hover:bg-gray-800">
                            메뉴 설정 저장
                        </Button>
                    </div>
                </section>

                {/* Brand Color Settings */}
                <section className="mb-8">
                    <h3 className="text-lg font-bold mb-4">브랜드 색상</h3>
                    <div className="glass p-6 rounded-xl shadow-sm">
                        <p className="text-sm text-gray-500 mb-5">버튼·강조·선택 상태 등 사이트 전체의 메인 색상을 변경합니다.</p>

                        {/* 프리셋 */}
                        <div className="flex flex-wrap gap-3 mb-5">
                            {BRAND_PRESETS.map(({ hex, name }) => {
                                const active = (settings.brand_primary || '').toLowerCase() === hex.toLowerCase();
                                return (
                                    <button
                                        key={hex}
                                        type="button"
                                        onClick={() => { setSettings({ ...settings, brand_primary: hex }); applyBrandLive(hex); }}
                                        className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-all ${active ? 'border-2 border-gray-900 scale-105' : 'border-gray-200 hover:border-gray-400'}`}
                                    >
                                        <span className="block w-10 h-10 rounded-full shadow-inner" style={{ backgroundColor: hex }} />
                                        <span className="text-[11px] font-medium text-gray-600">{name}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* 커스텀 색상 + 미리보기 */}
                        <div className="flex flex-wrap items-center gap-4 mb-6">
                            <div className="flex items-center gap-2">
                                <input
                                    type="color"
                                    value={/^#[0-9a-fA-F]{6}$/.test(settings.brand_primary) ? settings.brand_primary : '#18181b'}
                                    onChange={e => { setSettings({ ...settings, brand_primary: e.target.value }); applyBrandLive(e.target.value); }}
                                    className="w-12 h-10 rounded border border-gray-200 cursor-pointer bg-white p-0.5"
                                    aria-label="브랜드 색상 선택"
                                />
                                <Input
                                    value={settings.brand_primary}
                                    onChange={e => setSettings({ ...settings, brand_primary: e.target.value })}
                                    onBlur={e => { if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) applyBrandLive(e.target.value); }}
                                    placeholder="#0066ff"
                                    className="w-32 font-mono"
                                />
                            </div>
                            {/* 라이브 미리보기 */}
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400">미리보기</span>
                                <span className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-bold bg-primary text-primary-foreground shadow">
                                    구독하기
                                </span>
                            </div>
                        </div>

                        <Button onClick={handleSaveBrand} className="w-full bg-primary text-primary-foreground hover:opacity-90">
                            브랜드 색상 저장
                        </Button>
                    </div>
                </section>

                {/* 메일 관리 바로가기 */}
                <section className="mb-8">
                    <h3 className="text-lg font-bold mb-4">메일 관리</h3>
                    <div className="glass p-6 rounded-xl shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Link
                            href="/admin/mail-history"
                            className="flex items-center justify-center p-4 rounded-lg border bg-white text-sm font-bold text-primary hover:bg-gray-50 hover:underline transition-colors"
                        >
                            메일 발송 이력
                        </Link>
                        <Link
                            href="/admin/email-templates"
                            className="flex items-center justify-center p-4 rounded-lg border bg-white text-sm font-bold text-primary hover:bg-gray-50 hover:underline transition-colors"
                        >
                            메일 템플릿 관리
                        </Link>
                    </div>
                </section>

                <div className="grid lg:grid-cols-2 gap-8">
                    {/* Admin Account Settings */}
                    <section className={styles.settingsSection}>
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                            관리자 계정 설정
                        </h3>
                        <div className={`${styles.settingsGrid} glass shadow-sm`}>
                            <div className={styles.settingsItem}>
                                <Label>관리자 비밀번호</Label>
                                <Input
                                    type="password"
                                    value={settings.admin_login_pw}
                                    onChange={e => setSettings({ ...settings, admin_login_pw: e.target.value })}
                                />
                            </div>
                            <div className={styles.settingsItem}>
                                <Label>발신자 메일계정</Label>
                                <Input
                                    type="email"
                                    placeholder="sender@example.com"
                                    value={settings.admin_sender_email || ''}
                                    onChange={e => setSettings({ ...settings, admin_sender_email: e.target.value })}
                                />
                            </div>
                            <div className={styles.settingsItem}>
                                <Label>알림용 이메일</Label>
                                <Input
                                    type="email"
                                    placeholder="admin@example.com"
                                    value={settings.admin_email || ''}
                                    onChange={e => setSettings({ ...settings, admin_email: e.target.value })}
                                />
                            </div>
                            <div className={styles.settingsItem}>
                                <Label>알림용 휴대폰번호</Label>
                                <Input
                                    placeholder="010-1234-5678"
                                    value={settings.admin_phone || ''}
                                    onChange={e => setSettings({ ...settings, admin_phone: e.target.value })}
                                />
                            </div>
                            <Button onClick={handleSaveSettings} className="w-full bg-black text-white hover:bg-gray-800">
                                설정 저장하기
                            </Button>
                        </div>
                    </section>

                    {/* Bank Account Settings */}
                    <section className={styles.bankSection}>
                        <h3 className="text-lg font-bold mb-4">무통장 입금 계좌 관리</h3>
                        <div className="glass p-6 rounded-xl shadow-sm">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                                <Input
                                    placeholder="은행명"
                                    value={newBank.bank_name}
                                    onChange={e => setNewBank({ ...newBank, bank_name: e.target.value })}
                                />
                                <Input
                                    placeholder="계좌번호"
                                    value={newBank.account_number}
                                    onChange={e => setNewBank({ ...newBank, account_number: e.target.value })}
                                />
                                <Input
                                    placeholder="예금주"
                                    value={newBank.account_holder}
                                    onChange={e => setNewBank({ ...newBank, account_holder: e.target.value })}
                                />
                            </div>
                            <Button onClick={handleAddBank} variant="outline" className="w-full mb-6 border-2 border-black font-bold">
                                + 계좌 추가하기
                            </Button>

                            <div className="overflow-x-auto">
                                <table className={styles.bankTable}>
                                    <thead>
                                        <tr>
                                            <th>은행</th>
                                            <th>계좌번호</th>
                                            <th>예금주</th>
                                            <th>관리</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {bankAccounts.map(bank => (
                                            <tr key={bank.id}>
                                                <td className="font-semibold">{bank.bank_name}</td>
                                                <td>{bank.account_number}</td>
                                                <td>{bank.account_holder}</td>
                                                <td>
                                                    <Button variant="ghost" size="sm" onClick={() => handleDeleteBank(bank.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                                                        삭제
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                        {bankAccounts.length === 0 && (
                                            <tr>
                                                <td colSpan={4} className="text-center py-8 text-gray-400">등록된 계좌가 없습니다.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </main>
    );
}
