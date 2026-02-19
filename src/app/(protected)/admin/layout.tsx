"use client";

import { useServices } from "@/lib/ServiceContext";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { isAdmin } = useServices();

    return (
        <div className="flex min-h-screen">
            {/* Show Sidebar only if admin is verified (isAdmin === true) */}
            {isAdmin && <AdminSidebar />}

            <main className="flex-1 w-full bg-slate-50/50">
                {children}
            </main>
        </div>
    );
}
