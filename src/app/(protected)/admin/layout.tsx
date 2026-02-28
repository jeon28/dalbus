"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useServices } from "@/lib/ServiceContext";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminMobileMenu } from "@/components/admin/AdminMobileMenu";

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { isAdmin, isHydrated } = useServices();
    const router = useRouter();

    useEffect(() => {
        if (isHydrated && !isAdmin) {
            console.warn('Unauthorized access to admin area. Redirecting...');
            router.replace('/');
        }
    }, [isHydrated, isAdmin, router]);

    if (!isHydrated) return null;
    if (!isAdmin) return null;

    return (
        <div className="flex min-h-screen">
            <AdminSidebar />
            <div className="flex-1 flex flex-col min-h-screen">
                <AdminMobileMenu />
                <main className="flex-1 w-full bg-slate-50/50">
                    {children}
                </main>
            </div>
        </div>
    );
}
