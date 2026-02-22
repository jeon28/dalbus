"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { menuItems } from "./AdminSidebar";

export function AdminMobileMenu() {
    const pathname = usePathname();
    const [open, setOpen] = React.useState(false);

    return (
        <div className="md:hidden flex items-center justify-between p-4 bg-white border-b sticky top-0 z-50">
            <h2 className="text-lg font-bold">Admin Portal</h2>

            <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                    <Button variant="ghost" size="icon">
                        <Menu className="h-6 w-6" />
                        <span className="sr-only">Toggle Menu</span>
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-64 p-0">
                    <SheetHeader className="p-6 border-b text-left">
                        <SheetTitle className="text-xl font-bold text-left">Admin Menu</SheetTitle>
                    </SheetHeader>
                    <nav className="flex-1 p-4 space-y-1">
                        {menuItems.map((item) => {
                            const isActive = item.exact
                                ? pathname === item.href
                                : pathname.startsWith(item.href);

                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className="block"
                                    onClick={() => setOpen(false)}
                                >
                                    <Button
                                        variant={isActive ? "secondary" : "ghost"}
                                        className={cn(
                                            "w-full justify-start h-12",
                                            isActive ? "bg-slate-100 shadow-sm font-bold text-primary border" : "text-gray-500 hover:text-gray-900"
                                        )}
                                    >
                                        {item.title}
                                    </Button>
                                </Link>
                            )
                        })}
                    </nav>
                </SheetContent>
            </Sheet>
        </div>
    );
}
