"use client";

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useServices } from "@/lib/ServiceContext";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminMobileMenu } from "@/components/admin/AdminMobileMenu";
import { PasswordGate } from "@/components/admin/PasswordGate";

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { loginAdmin } = useServices();
    const router = useRouter();
    const pathname = usePathname();
    const [unlocked, setUnlocked] = useState(false);
    const [checked, setChecked] = useState(false);

    // 진입 시 비밀번호 게이트를 통과한 토큰이 있으면 자동 잠금해제
    useEffect(() => {
        const token = sessionStorage.getItem('quick-token');
        if (token) {
            setUnlocked(true);
            loginAdmin();
        }
        setChecked(true);
    }, [loginAdmin]);

    const handleUnlock = () => {
        setUnlocked(true);
        loginAdmin();
        // 기본 진입 화면을 주문내역으로
        if (pathname === '/admin') {
            router.replace('/admin/orders');
        }
    };

    if (!checked) return null;

    if (!unlocked) {
        return (
            <PasswordGate
                onUnlock={handleUnlock}
                title="달버스 관리자"
                subtitle="관리자 비밀번호를 입력하세요"
            />
        );
    }

    return (
        <div className="flex min-h-screen overflow-x-hidden">
            <AdminSidebar />
            <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
                <AdminMobileMenu />
                <main className="flex-1 w-full bg-slate-50/50">
                    {children}
                </main>
            </div>
        </div>
    );
}
