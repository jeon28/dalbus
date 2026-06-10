import type { Metadata } from 'next';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { FaqList, type FAQ } from './FaqList';

// FAQ는 자주 바뀌지 않으므로 5분 단위로 정적 재생성 (SEO + 빠른 초기 렌더)
export const revalidate = 300;

export const metadata: Metadata = {
    title: '자주 묻는 질문 (FAQ) | 달버스',
    description: '달버스 이용 중 궁금한 점을 결제·계정·환불 등 카테고리별로 확인하세요.',
};

async function getFaqs(): Promise<FAQ[]> {
    const { data, error } = await supabaseAdmin
        .from('faqs')
        .select('*')
        .eq('is_published', true)
        .order('sort_order', { ascending: true });

    if (error) {
        console.error('Error fetching public FAQs (SSR):', error);
        return [];
    }
    return (data as FAQ[]) ?? [];
}

export default async function FAQPage() {
    const faqs = await getFaqs();

    return (
        <div className="container mx-auto py-12 px-4 max-w-4xl">
            <div className="text-center mb-12">
                <h1 className="text-3xl sm:text-5xl font-bold mb-4">자주 묻는 질문</h1>
                <p className="text-muted-foreground">궁금하신 점을 카테고리별로 확인해 보세요.</p>
            </div>

            <FaqList faqs={faqs} />
        </div>
    );
}
