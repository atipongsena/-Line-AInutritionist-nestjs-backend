/** @type {import('next').NextConfig} */
const nextConfigSSG = {
  // 🚀 SSG Configuration - Static Site Generation for Azure Static Web Apps
  output: 'export',
  distDir: 'out',
  trailingSlash: true,

  // ✅ เปิดใช้ SSR features สำหรับทุก environment
  transpilePackages: ['@ai-nutritionist/shared-types'],

  // 🚀 Performance Optimizations (Stable Features Only)
  experimental: {
    scrollRestoration: true,
  },

  // 🌐 Dev Origins (for LIFF and Azure)
  allowedDevOrigins: [
    'ai-nutritionist-backend.wittyground-3784ecfe.southeastasia.azurecontainerapps.io',
    'salmon-pond-09f432200.6.azurestaticapps.net',
    'liff.line.me',
    '*.ngrok-free.app',
  ],

  // 🗜️ Compression
  compress: true,
  poweredByHeader: false,

  // 📱 PWA และ caching
  headers: async () => {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value:
              'Content-Type, Authorization, X-LINE-ID-TOKEN, X-Line-User-ID',
          },
        ],
      },
      {
        source: '/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },

  // 🖼️ Image optimization - ปิดสำหรับ static export
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'profile.line-scdn.net',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'obs.line-scdn.net',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.ngrok-free.app',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'kingengai.blob.core.windows.net',
        pathname: '/food-images/**',
      },
      {
        protocol: 'https',
        hostname: '*.blob.core.windows.net',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.azurestaticapps.net',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.azurecontainerapps.io',
        pathname: '/**',
      },
    ],
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // เพิ่มการตั้งค่าสำหรับ Material UI
  compiler: {
    emotion: true,
    removeConsole: true,
  },

  reactStrictMode: true,

  // ✅ Environment variables validation
  env: {
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
    NEXT_PUBLIC_LIFF_ID: process.env.NEXT_PUBLIC_LIFF_ID,
    NEXT_PUBLIC_DEBUG: process.env.NEXT_PUBLIC_DEBUG,
  },
}

export default nextConfigSSG
