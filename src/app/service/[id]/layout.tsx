import { Metadata } from 'next';

export const metadata: Metadata = {
    title: '서비스 상세 | 달버스',
    description: '달버스 프리미엄 구독 서비스 상세 정보를 확인하고 구독을 시작하세요.',
};

export default function ServiceLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
