"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useServices } from '@/lib/ServiceContext';

export default function Header() {
    const { user, isAdmin, logout, logoutAdmin } = useServices();

    return (
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-14 items-center justify-between gap-4">
                <div className="flex items-center gap-4 md:gap-8 flex-1 overflow-hidden">
                    <Link href="/" className="flex items-center space-x-2 shrink-0">
                        <span className="font-bold">Dalbus</span>
                    </Link>
                    <nav className="flex items-center space-x-4 md:space-x-6 text-[13px] md:text-sm font-medium overflow-x-auto whitespace-nowrap scrollbar-hide">
                        <Link href="/public/products" className="transition-colors hover:text-foreground/80 text-foreground/60">
                            서비스
                        </Link>
                        <Link href="/public/notices" className="transition-colors hover:text-foreground/80 text-foreground/60">
                            공지사항
                        </Link>
                        <Link href="/public/faq" className="transition-colors hover:text-foreground/80 text-foreground/60">
                            FAQ
                        </Link>
                        <Link href="/public/qna" className="transition-colors hover:text-foreground/80 text-foreground/60">
                            Q&A
                        </Link>

                    </nav>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <nav className="flex items-center gap-1 md:gap-2">
                        {user ? (
                            <>
                                {isAdmin ? (
                                    <>
                                        <Link href="/admin">
                                            <Button variant="ghost" size="sm" className="h-8 md:h-9 text-xs md:text-sm px-2 md:px-3 font-bold text-primary">관리자</Button>
                                        </Link>
                                        <Button variant="outline" size="sm" onClick={() => { logout(); logoutAdmin(); }} className="border-red-200 text-red-600 hover:bg-red-50 h-8 md:h-9 text-xs md:text-sm">로그아웃</Button>
                                    </>
                                ) : (
                                    <>
                                        <Button variant="ghost" size="sm" className="h-8 md:h-9 text-xs md:text-sm px-2 md:px-3" asChild>
                                            <Link href="/mypage">{user.name}</Link>
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={logout} className="h-8 md:h-9 text-xs md:text-sm px-2 md:px-3">로그아웃</Button>
                                    </>
                                )}
                            </>
                        ) : (
                            <>
                                <Link href="/login">
                                    <Button variant="ghost" size="sm" className="h-8 md:h-9 text-xs md:text-sm px-2 md:px-3">
                                        로그인
                                    </Button>
                                </Link>
                            </>
                        )}
                    </nav>
                </div>
            </div>
        </header>
    );
}
