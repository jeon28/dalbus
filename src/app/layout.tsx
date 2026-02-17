import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { ServiceProvider } from "@/lib/ServiceContext";
import ErrorHandler from "@/components/ErrorHandler";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "달버스 (Dalbus) | 음악에만 집중하세요, 나머지는 달버스가 책임집니다.",
    description: "타이달(Tidal) 프리미엄 구독 공유 플랫폼. 음악에만 집중하세요, 나머지는 달버스가 책임집니다.",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="ko">
            <body className={inter.className}>
                <ServiceProvider>
                    <ErrorHandler />
                    <Header />
                    {children}
                    <Footer />
                </ServiceProvider>
            </body>
        </html>
    );
}
