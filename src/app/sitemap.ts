import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://dalbus.com';

/**
 * 공개 정적 경로 사이트맵.
 * 상품 상세(/service/[id])는 서비스 페이지가 클라이언트 컴포넌트라 별도 처리가 필요하므로,
 * 추후 서버 패칭 전환 시 동적 항목으로 확장한다.
 */
export default function sitemap(): MetadataRoute.Sitemap {
    const routes = [
        { path: '/', priority: 1.0, changeFrequency: 'weekly' as const },
        { path: '/public/products', priority: 0.9, changeFrequency: 'weekly' as const },
        { path: '/public/faq', priority: 0.6, changeFrequency: 'monthly' as const },
        { path: '/public/notices', priority: 0.6, changeFrequency: 'weekly' as const },
        { path: '/public/qna', priority: 0.5, changeFrequency: 'weekly' as const },
        { path: '/public/terms', priority: 0.3, changeFrequency: 'yearly' as const },
        { path: '/public/privacy', priority: 0.3, changeFrequency: 'yearly' as const },
        { path: '/login', priority: 0.4, changeFrequency: 'yearly' as const },
        { path: '/signup', priority: 0.5, changeFrequency: 'yearly' as const },
    ];

    return routes.map((r) => ({
        url: `${SITE_URL}${r.path}`,
        lastModified: new Date(),
        changeFrequency: r.changeFrequency,
        priority: r.priority,
    }));
}
