import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const menuItems = [
    { title: "대시보드", href: "/admin", exact: true },
    { title: "주문내역", href: "/admin/orders" },
    { title: "회원정보", href: "/admin/members" },
    { title: "서비스 관리", href: "/admin/services" },
    { title: "공지사항 관리", href: "/admin/notices" },
    { title: "FAQ 관리", href: "/admin/faqs" },
    { title: "Q&A 관리", href: "/admin/qna" },
    { title: "Tidal 계정", href: "/admin/tidal" },
];

export function AdminSidebar() {
    const pathname = usePathname();

    return (
        <div className="hidden md:flex flex-col w-64 bg-gray-50 border-r min-h-screen">
            <div className="p-6 border-b">
                <h2 className="text-xl font-bold">Admin Menu</h2>
            </div>
            <nav className="flex-1 p-4 space-y-1">
                {menuItems.map((item) => {
                    const isActive = item.exact
                        ? pathname === item.href
                        : pathname.startsWith(item.href);

                    return (
                        <Link key={item.href} href={item.href} className="block">
                            <Button
                                variant={isActive ? "secondary" : "ghost"}
                                className={cn(
                                    "w-full justify-start",
                                    isActive ? "bg-white shadow-sm font-bold text-primary border" : "text-gray-500 hover:text-gray-900"
                                )}
                            >
                                {item.title}
                            </Button>
                        </Link>
                    )
                })}
            </nav>
        </div>
    );
}
