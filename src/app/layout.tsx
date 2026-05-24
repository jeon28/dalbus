import type { Metadata } from "next";
import { Inter, Noto_Sans_KR } from "next/font/google";
import "./globals.css";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { ServiceProvider } from "@/lib/ServiceContext";
import ErrorHandler from "@/components/ErrorHandler";
import { Toaster } from "sonner";

const inter = Inter({
    subsets: ["latin"],
    variable: "--font-inter",
});

const notoSansKr = Noto_Sans_KR({
    subsets: ["latin"],
    weight: ["400", "500", "700", "900"],
    variable: "--font-noto-sans-kr",
});

export const metadata: Metadata = {
    title: "달버스 (Dalbus) | 음악에만 집중하세요, 달버스가 책임집니다.",
    description: "타이달(Tidal) 프리미엄 구독 공유 플랫폼. 음악에만 집중하세요, 달버스가 책임집니다.",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="ko">
            <body className={`${inter.variable} ${notoSansKr.variable} font-sans`}>
                <ServiceProvider>
                    <ErrorHandler />
                    <Header />
                    {children}
                    <Footer />
                    <Toaster position="top-center" richColors />
                </ServiceProvider>
            </body>
        </html>
    );
}
