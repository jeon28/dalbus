"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useServices } from '@/lib/ServiceContext';

export default function Header() {
    const { user, isAdmin, logout, logoutAdmin } = useServices();

    return (
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-14 items-center">
                <div className="mr-4 hidden md:flex">
                    <Link href="/" className="mr-6 flex items-center space-x-2">
                        <span className="hidden font-bold sm:inline-block">Dalbus</span>
                    </Link>
                    <nav className="flex items-center space-x-6 text-sm font-medium">
                        <Link href="/public/products" className="transition-colors hover:text-foreground/80 text-foreground/60">
                            서비스 목록
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
                        {isAdmin && (
                            <>
                                <Link href="/admin/orders" className="transition-colors hover:text-primary font-bold text-foreground/80">
                                    주문내역
                                </Link>
                                <Link href="/admin/members" className="transition-colors hover:text-primary font-bold text-foreground/80">
                                    회원정보
                                </Link>
                                <Link href="/admin/services" className="transition-colors hover:text-primary font-bold text-foreground/80">
                                    서비스 관리
                                </Link>
                                <Link href="/admin/qna" className="transition-colors hover:text-primary font-bold text-foreground/80">
                                    Q&A 관리
                                </Link>
                                <Link href="/admin/tidal" className="transition-colors hover:text-primary font-bold text-foreground/80">
                                    Tidal 계정
                                </Link>
                            </>
                        )}
                    </nav>
                </div>
                <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
                    <div className="w-full flex-1 md:w-auto md:flex-none">
                        {/* Search or other items */}
                    </div>
                    <nav className="flex items-center gap-2">
                        {isAdmin ? (
                            <Button variant="outline" size="sm" onClick={logoutAdmin} className="border-red-200 text-red-600 hover:bg-red-50">로그아웃</Button>
                        ) : user ? (
                            <>
                                <Link href="/mypage">
                                    <Button variant="ghost" size="sm">마이페이지</Button>
                                </Link>
                                <Button variant="outline" size="sm" onClick={logout}>로그아웃</Button>
                            </>
                        ) : (
                            <>
                                <Link href="/login">
                                    <Button variant="ghost" size="sm">
                                        로그인
                                    </Button>
                                </Link>
                                <Link href="/signup">
                                    <Button size="sm">회원가입</Button>
                                </Link>
                            </>
                        )}
                    </nav>
                </div>
            </div>
        </header>
    );
}
