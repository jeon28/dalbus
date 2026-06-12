/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true, // AbortError는 supabase lock no-op + ErrorHandler + isMounted 가드로 차단됨
    allowedDevOrigins: ['192.168.7.20', '192.168.7.20:3000'],
    async redirects() {
        return [
            // dalbus.vercel.app은 Supabase OAuth redirect 허용 목록에 없어 SNS 팝업 가입이
            // 조용히 깨진다(Site URL 폴백). 운영 실주소 www.dalbus.com으로 강제 이동.
            {
                source: '/:path*',
                has: [{ type: 'host', value: 'dalbus.vercel.app' }],
                destination: 'https://www.dalbus.com/:path*',
                permanent: true
            }
        ];
    }
};

export default nextConfig;
