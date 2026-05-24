import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Q&A 게시판 | 달버스',
    description: '달버스 서비스에 대한 문의를 남겨주세요.',
};

export default function QnALayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
