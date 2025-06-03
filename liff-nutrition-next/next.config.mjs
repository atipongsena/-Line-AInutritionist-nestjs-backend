/** @type {import('next').NextConfig} */
const nextConfig = {
  // 🚀 SSR Configuration for Azure Static Web Apps
  // output: 'export', // ❌ ปิดเพื่อให้ SSR ทำงานได้
  // distDir: 'out', // ❌ ปิดเนื่องจากไม่ใช้ static export

  // ✅ เปิดใช้ SSR features
  transpilePackages: ['@ai-nutritionist/shared-types'],

  // 🚀 Performance Optimizations (Stable Features Only)
  experimental: {
    scrollRestoration: true,
    // appDir: true, // App Router (ใช้แล้วใน Next.js 13+)
  },

  // 🌐 Dev Origins (for LIFF and ngrok)
  allowedDevOrigins: [
    '3b67-2001-fb1-5d-f7ba-44b7-91b3-44d3-a0e.ngrok-free.app',
    'liff.line.me',
    '*.ngrok-free.app',
  ],

  // 📦 Bundle Optimization
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Bundle analyzer in development
    if (!dev && !isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
            priority: 10,
          },
          mui: {
            test: /[\\/]node_modules[\\/]@mui[\\/]/,
            name: 'mui',
            chunks: 'all',
            priority: 20,
          },
          recharts: {
            test: /[\\/]node_modules[\\/]recharts[\\/]/,
            name: 'recharts',
            chunks: 'all',
            priority: 15,
          },
        },
      }
    }

    return config
  },

  // 🗜️ Compression
  compress: true,
  poweredByHeader: false,

  // ✅ Azure Static Web Apps compatibility
  trailingSlash: true,

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

  // 🖼️ Image optimization (แก้ไขจาก deprecated images.domains)
  images: {
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
    ],
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // ถ้าคุณมีการใช้ basePath ใน Vite และต้องการใช้ใน Next.js ด้วย ให้ uncomment บรรทัดด้านล่าง
  // และตั้งค่า NEXT_PUBLIC_BASE_PATH ใน .env ไฟล์ของคุณ
  // basePath: process.env.NEXT_PUBLIC_BASE_PATH,

  // เพิ่มการตั้งค่าสำหรับ Material UI (ถ้าใช้ App Router และต้องการ theme integration)
  // ดูรายละเอียดเพิ่มเติมจากเอกสารของ MUI และ Next.js
  compiler: {
    emotion: true,
    removeConsole: process.env.NODE_ENV === 'production',
  },

  // หากต้องการให้ strict mode ของ React ทำงานใน production ด้วย (ปกติ Next.js เปิดให้เฉพาะ development)
  reactStrictMode: true,

  // การตั้งค่า images (ถ้ามีการใช้ next/image)
  // images: {
  //   unoptimized: true, // ถ้า output: 'export' อาจจะต้องตั้งเป็น true หรือ config provider อื่นๆ
  // },
}

export default nextConfig
