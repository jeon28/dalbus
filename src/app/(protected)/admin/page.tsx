"use client";

import React, { useEffect, useState } from 'react';
import { useServices } from '@/lib/ServiceContext';
import styles from './admin.module.css';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

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
    const { isAdmin, loginAdmin, isHydrated } = useServices();

    // Auth Form State
    const [loginId, setLoginId] = useState('');
    const [loginPw, setLoginPw] = useState('');
    const [orders, setOrders] = useState<Order[]>([]);

    // Settings State
    const [settings, setSettings] = useState({
        admin_login_id: '',
        admin_login_pw: '',
        admin_email: '',
        admin_phone: ''
    });
    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
    const [newBank, setNewBank] = useState({ bank_name: '', account_number: '', account_holder: '' });

    const fetchStats = async () => {
        try {
            const response = await fetch('/api/admin/orders');
            if (!response.ok) throw new Error('Failed to fetch orders');
            const data = await response.json();
            setOrders(data);
        } catch (error: unknown) {
            console.error('Error fetching stats:', error);
        }
    };

    const fetchSettings = async () => {
        const res = await fetch('/api/admin/settings');
        if (res.ok) {
            const data = await res.json();
            setSettings(data);
        }
    };

    const fetchBankAccounts = async () => {
        const res = await fetch('/api/admin/bank-accounts');
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

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/admin/settings');
            const adminCreds = await res.json();

            if (loginId === adminCreds.admin_login_id && loginPw === adminCreds.admin_login_pw) {
                loginAdmin();
            } else {
                alert('아이디 또는 비밀번호가 올바르지 않습니다.');
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
            alert(`로그인 처리 중 오류가 발생했습니다: ${message}`);
        }
    };

    const handleSaveSettings = async () => {
        const res = await fetch('/api/admin/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        });
        if (res.ok) alert('관리자 설정이 저장되었습니다.');
    };

    const handleAddBank = async () => {
        if (!newBank.bank_name || !newBank.account_number || !newBank.account_holder) {
            alert('모든 정보를 입력해주세요.');
            return;
        }
        const res = await fetch('/api/admin/bank-accounts', {
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
        const res = await fetch(`/api/admin/bank-accounts/${id}`, { method: 'DELETE' });
        if (res.ok) fetchBankAccounts();
    };

    if (!isHydrated) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100">
                <div className="animate-pulse text-gray-500 font-medium">관리자 상태 확인 중...</div>
            </div>
        );
    }

    if (!isAdmin) {
        // If user is logged in but not admin, maybe they shouldn't be here at all? 
        // For now, if user is logged in and isHydrated, but not admin, show login.
        // But if they are admin, we transition.
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
                <Card className="w-full max-w-[400px] shadow-2xl border-none">
                    <CardHeader className="space-y-1 pt-8">
                        <CardTitle className="text-2xl font-bold text-center">Dalbus Admin</CardTitle>
                        <p className="text-sm text-center text-muted-foreground">관리자 계정으로 로그인하세요</p>
                    </CardHeader>
                    <CardContent className="pb-8">
                        <form onSubmit={handleLogin} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="loginId">아이디</Label>
                                <Input
                                    id="loginId"
                                    placeholder="Enter Admin ID"
                                    value={loginId}
                                    onChange={(e) => setLoginId(e.target.value)}
                                    className="h-11"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="loginPw">비밀번호</Label>
                                <Input
                                    id="loginPw"
                                    type="password"
                                    placeholder="Enter Password"
                                    value={loginPw}
                                    onChange={(e) => setLoginPw(e.target.value)}
                                    className="h-11"
                                />
                            </div>
                            <Button type="submit" className="w-full h-11 bg-black hover:bg-gray-800 text-white font-bold mt-2">
                                LOGIN
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <main className={styles.main}>
            <header className={`${styles.header} glass`}>
                <div className="container flex justify-between items-center px-4">
                    <h1 className={styles.title}>관리자 대시보드</h1>
                </div>
            </header>

            <div className={`${styles.content} container px-4 pb-20`}>
                <section className={styles.stats}>
                    <div className={`${styles.statCard} glass shadow-sm`}>
                        <span className="text-gray-500 font-medium">대기 중인 분배</span>
                        <strong className="text-2xl mt-1">{orders.filter(o => o.assignment_status === 'waiting').length}</strong>
                    </div>
                    <div className={`${styles.statCard} glass shadow-sm border-l-4 border-l-blue-500`}>
                        <span className="text-gray-500 font-medium">오늘의 매출</span>
                        <strong className="text-2xl mt-1">₩{orders.reduce((acc, curr) => {
                            const isToday = new Date(curr.created_at).toDateString() === new Date().toDateString();
                            return acc + (isToday && (curr.payment_status === 'paid' || curr.payment_status === 'pending') ? curr.amount : 0);
                        }, 0).toLocaleString()}</strong>
                    </div>
                    <div className={`${styles.statCard} glass shadow-sm border-l-4 border-l-green-500`}>
                        <span className="text-gray-500 font-medium">누적 정산액</span>
                        <strong className="text-2xl mt-1">₩{orders.reduce((acc, curr) => acc + (curr.payment_status === 'paid' ? curr.amount : 0), 0).toLocaleString()}</strong>
                    </div>
                </section>

                <div className="mt-8 mb-12 p-4 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                    <p className="text-sm text-gray-500">
                        * 대시보드는 현황을 요약하여 보여줍니다. 상세 관리는 상단 메뉴를 이용해 주세요.
                    </p>
                </div>

                <div className="grid lg:grid-cols-2 gap-8">
                    {/* Admin Account Settings */}
                    <section className={styles.settingsSection}>
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                            관리자 계정 설정
                        </h3>
                        <div className={`${styles.settingsGrid} glass shadow-sm`}>
                            <div className={styles.settingsItem}>
                                <Label>관리자 아이디</Label>
                                <Input
                                    value={settings.admin_login_id}
                                    onChange={e => setSettings({ ...settings, admin_login_id: e.target.value })}
                                />
                            </div>
                            <div className={styles.settingsItem}>
                                <Label>관리자 비밀번호</Label>
                                <Input
                                    type="password"
                                    value={settings.admin_login_pw}
                                    onChange={e => setSettings({ ...settings, admin_login_pw: e.target.value })}
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
