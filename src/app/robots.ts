import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://dalbus.com';

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: '*',
            allow: '/',
            // 인증/관리자/마이페이지 등 비공개 영역은 크롤링 제외
            disallow: ['/admin', '/admin/', '/mypage', '/api/', '/quick', '/signup/complete'],
        },
        sitemap: `${SITE_URL}/sitemap.xml`,
    };
}
