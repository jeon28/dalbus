/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true, // AbortError는 supabase lock no-op + ErrorHandler + isMounted 가드로 차단됨
    allowedDevOrigins: ['192.168.7.20', '192.168.7.20:3000']
};

export default nextConfig;
