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

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://dalbus.com";
const SITE_TITLE = "달버스 (Dalbus) | 음악에만 집중하세요, 달버스가 책임집니다.";
const SITE_DESCRIPTION = "타이달(Tidal) 프리미엄 구독 공유 플랫폼. 복잡한 우회 가입 없이, 월 최저가로 안정적인 TIDAL HIFI를 이용하세요.";

export const metadata: Metadata = {
    metadataBase: new URL(SITE_URL),
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    keywords: ["달버스", "Dalbus", "타이달", "TIDAL", "타이달 구독", "음악 스트리밍", "구독 공유"],
    openGraph: {
        type: "website",
        siteName: "달버스 (Dalbus)",
        title: SITE_TITLE,
        description: SITE_DESCRIPTION,
        url: SITE_URL,
        locale: "ko_KR",
    },
    twitter: {
        card: "summary_large_image",
        title: SITE_TITLE,
        description: SITE_DESCRIPTION,
    },
    robots: {
        index: true,
        follow: true,
    },
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
