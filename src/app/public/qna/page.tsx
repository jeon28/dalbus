import type { Metadata } from 'next';
import { QnaBoard } from './QnaBoard';

export const metadata: Metadata = {
    title: 'Q&A 게시판 | 달버스',
    description: '달버스 이용 문의를 남기고 답변을 확인하세요.',
};

/**
 * 서버 컴포넌트 래퍼: 페이지 메타데이터만 담당.
 * 실제 목록은 로그인 사용자에 종속(비밀글/작성자 라벨)이라 QnaBoard에서 클라이언트 렌더한다.
 */
export default function QnAPage() {
    return <QnaBoard />;
}
