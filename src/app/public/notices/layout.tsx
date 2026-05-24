import { Metadata } from 'next';

export const metadata: Metadata = {
    title: '공지사항 | 달버스',
    description: '달버스의 새로운 소식과 안내를 확인하세요.',
};

export default function NoticesLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
