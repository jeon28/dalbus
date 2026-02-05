import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "Share King | 프리미엄 계정 공유 서비스",
    description: "타이달, 넷플릭스 등 프리미엄 서비스를 가장 저렴하게 이용하세요.",
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
