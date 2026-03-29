/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: false, // Strict Mode 비활성화로 AbortError 방지
    allowedDevOrigins: ['192.168.7.20', '192.168.7.20:3000']
};

export default nextConfig;
