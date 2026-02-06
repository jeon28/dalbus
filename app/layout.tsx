import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "dalbus.com | 프리미엄 TIDAL 매칭 서비스",
    description: "TIDAL HI-FI 서비스를 가장 합리적인 가격으로 만나보세요.",
};

import { ServiceProvider } from "@/lib/ServiceContext";

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="ko">
            <body>
                <ServiceProvider>
                    <div className="layout-wrapper">
                        {children}
                    </div>
                </ServiceProvider>
            </body>
        </html>
    );
}
