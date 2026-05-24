import { Metadata } from 'next';

export const metadata: Metadata = {
    title: '서비스 목록 | 달버스',
    description: '달버스에서 제공하는 프리미엄 구독 서비스를 놀라운 가격에 만나보세요.',
};

export default function ProductsLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
