// 🔧 Environment Configuration สำหรับ AI Nutritionist LIFF App

interface EnvironmentConfig {
  apiBaseUrl: string
  liffId: string
  isProduction: boolean
  isDevelopment: boolean
  version: string
  features: {
    enableAnalytics: boolean
    enableLogging: boolean
    enableOfflineMode: boolean
  }
}

// 🌐 Production URLs (Azure จัดการ HTTPS อัตโนมัติ)
const getEnvironmentConfig = (): EnvironmentConfig => {
  const isProduction = process.env.NODE_ENV === 'production'

  return {
    // ✅ Azure Static Web Apps และ Container Apps ใช้ HTTPS อัตโนมัติ
    // ไม่ต้องกำหนด https:// เพิ่มเติม Azure จัดการให้
    apiBaseUrl:
      process.env.REACT_APP_API_BASE_URL ||
      (isProduction
        ? 'https://ai-nutritionist-backend.placeholder.eastasia.azurecontainerapps.io'
        : 'http://localhost:3000'),

    liffId: process.env.REACT_APP_LIFF_ID || '',

    isProduction,
    isDevelopment: !isProduction,
    version: process.env.REACT_APP_VERSION || '1.0.0',

    features: {
      enableAnalytics: isProduction,
      enableLogging: !isProduction, // Debug logs เฉพาะ development
      enableOfflineMode: isProduction,
    },
  }
}

export const env = getEnvironmentConfig()

// 🔒 Security Headers สำหรับ HTTPS (Azure Static Web Apps จัดการอัตโนมัติ)
export const securityConfig = {
  // ✅ Azure Static Web Apps เปิด HSTS อัตโนมัติ
  // ✅ TLS 1.2+ forced อัตโนมัติ
  // ✅ Certificate renewal อัตโนมัติ

  // กำหนด CSP สำหรับ LIFF
  contentSecurityPolicy: {
    'default-src': ["'self'"],
    'connect-src': [
      "'self'",
      env.apiBaseUrl,
      'https://api.line.me',
      'https://liff.line.me',
      'https://*.blob.core.windows.net', // Azure Storage
    ],
    'img-src': [
      "'self'",
      'data:',
      'https://*.blob.core.windows.net', // Azure Storage images
      'https://profile.line-scdn.net', // LINE profile images
    ],
    'script-src': [
      "'self'",
      'https://static.line-scdn.net', // LIFF SDK
    ],
  },
}

// 🧪 Development vs Production Detection
export const isDev = env.isDevelopment
export const isProd = env.isProduction

console.log('🌍 Environment:', {
  mode: isProd ? 'production' : 'development',
  apiUrl: env.apiBaseUrl,
  version: env.version,
  httpsEnabled: env.apiBaseUrl.startsWith('https://'), // Azure ควบคุมอัตโนมัติ
})

// API endpoints
export const API_ENDPOINTS = {
  // Food analysis
  analyzeFood: '/api/nutrition/analyze',
  uploadImage: '/api/image/upload',

  // User management
  profile: '/api/user/profile',
  updateGoals: '/api/user/nutrition-goals',

  // Food log
  foodLog: '/api/food-log',
  dailyLog: '/api/food-log/daily',

  // Reports
  weeklyReport: '/api/nutrition/report/weekly',
  monthlyReport: '/api/nutrition/report/monthly',

  // Health check
  health: '/',
}

// LIFF configuration
export const LIFF_CONFIG = {
  liffId: env.liffId,
  features: {
    shareTargetPicker: true,
    multipleLiff: false,
    bluetooth: false,
    scanner: true,
  },
}
