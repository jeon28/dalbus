"use client";

import { useServices } from "@/lib/ServiceContext";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminMobileMenu } from "@/components/admin/AdminMobileMenu";

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { isAdmin } = useServices();

    return (
        <div className="flex min-h-screen">
            {/* Show Sidebar only if admin is verified (isAdmin === true) */}
            {isAdmin && (
                <>
                    <AdminSidebar />
                    <div className="flex-1 flex flex-col min-h-screen">
                        <AdminMobileMenu />
                        <main className="flex-1 w-full bg-slate-50/50">
                            {children}
                        </main>
                    </div>
                </>
            )}

            {!isAdmin && (
                <main className="flex-1 w-full bg-slate-50/50">
                    {children}
                </main>
            )}
        </div>
    );
}
