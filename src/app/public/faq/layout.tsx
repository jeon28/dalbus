import { Metadata } from 'next';

export const metadata: Metadata = {
    title: '자주 묻는 질문 | 달버스',
    description: '달버스 서비스 이용 중 궁금하신 점을 카테고리별로 확인해 보세요.',
};

export default function FAQLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
