/** @type {import('next').NextConfig} */
const nextConfig = {
  // 🚀 Azure Static Web Apps Configuration - Static Export + Client Dynamics
  // ✅ ใช้ static export สำหรับ Azure แต่เพิ่ม client-side dynamics
  output: process.env.NODE_ENV === 'production' ? 'export' : undefined,

  // ✅ ใช้ default Next.js behavior สำหรับ development
  distDir: 'out',

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
          // ✅ CORS headers สำหรับ Azure Static Web Apps
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

  // 🖼️ Image optimization (แก้ไขสำหรับ Static Export + Client Dynamics)
  images: {
    // ✅ ปิด image optimization สำหรับ static export แต่เปิดสำหรับ development
    unoptimized: process.env.NODE_ENV === 'production',
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
      // ✅ เพิ่ม Azure Static Web Apps domains
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

  // ✅ Azure Static Web Apps base path (ถ้าจำเป็น)
  // basePath: process.env.NEXT_PUBLIC_BASE_PATH,

  // เพิ่มการตั้งค่าสำหรับ Material UI (ถ้าใช้ App Router และต้องการ theme integration)
  compiler: {
    emotion: true,
    removeConsole: process.env.NODE_ENV === 'production',
  },

  // หากต้องการให้ strict mode ของ React ทำงานใน production ด้วย
  reactStrictMode: true,

  // ✅ Environment variables validation
  env: {
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
    NEXT_PUBLIC_LIFF_ID: process.env.NEXT_PUBLIC_LIFF_ID,
    NEXT_PUBLIC_DEBUG: process.env.NEXT_PUBLIC_DEBUG,
  },
}

export default nextConfig
