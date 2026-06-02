import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const menuItems = [
    { title: "대시보드", href: "/admin", exact: true },
    { title: "주문내역", href: "/admin/orders" },
    { title: "회원정보", href: "/admin/members" },
    { title: "Tidal 계정", href: "/admin/tidal" },
    { title: "HifiTidal 관리", href: "/admin/hifitidal" },
    { title: "기존 Tidal 계정", href: "/admin/legacy-tidal" },
    { title: "메일 발송 이력", href: "/admin/mail-history" },
    { title: "메일 템플릿 관리", href: "/admin/email-templates" },
];
// 서비스/공지사항/FAQ/Q&A 관리는 대시보드 '메뉴 표시 설정' 카드의 링크로 이동

export function AdminSidebar() {
    const pathname = usePathname();

    return (
        <div className="hidden lg:flex flex-col w-[150px] min-w-[150px] max-w-[150px] bg-gray-50 border-r min-h-screen flex-shrink-0">
            <div className="p-4 border-b">
                <h2 className="text-lg font-bold">Admin Menu</h2>
            </div>
            <nav className="flex-1 p-3 space-y-1">
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
