"use client";

import React, { useEffect, useState } from 'react';
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
        admin_phone: ''
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
            setSettings(data);
            setOriginalSettings(data);
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
                                { key: 'menu_services_enabled', label: '서비스' },
                                { key: 'menu_notices_enabled', label: '공지사항' },
                                { key: 'menu_faq_enabled', label: 'FAQ' },
                                { key: 'menu_qna_enabled', label: 'Q&A' },
                            ] as { key: keyof typeof menuSettings; label: string }[]).map(({ key, label }) => {
                                const isOn = menuSettings[key] !== 'false';
                                return (
                                    <div key={key} className="flex flex-col items-center gap-2 p-4 rounded-lg border bg-white">
                                        <span className="text-sm font-medium text-gray-700">{label}</span>
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
