import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { ServiceProvider } from "@/lib/ServiceContext";
import ErrorHandler from "@/components/ErrorHandler";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "달버스 (Dalbus) - 프리미엄 구독 공유 플랫폼",
    description: "Tidal, Netflix, Youtube Premium 등 프리미엄 서비스를 최대 70% 할인된 가격으로 이용하세요.",
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
