// LIFF Navigation Utilities

export const LIFF_PATHS = {
  PROFILE: '/',
  NUTRITION_REPORT: '/nutrition-report',
} as const

export const LIFF_ID = import.meta.env.VITE_LIFF_ID || '2007349762-AJ9J432d'

export const getLiffUrl = (path: keyof typeof LIFF_PATHS): string => {
  const liffPath = LIFF_PATHS[path]
  return `https://liff.line.me/${LIFF_ID}${liffPath}`
}

export const generateRichMenuUrls = () => {
  return {
    profile: getLiffUrl('PROFILE'),
    nutritionReport: getLiffUrl('NUTRITION_REPORT'),
  }
}

// สำหรับใช้ใน Rich Menu setup
export const RICH_MENU_CONFIG = {
  profile: {
    bounds: { x: 0, y: 0, width: 1250, height: 1686 },
    action: {
      type: 'uri' as const,
      uri: getLiffUrl('PROFILE'),
    },
  },
  nutritionReport: {
    bounds: { x: 1250, y: 0, width: 1250, height: 1686 },
    action: {
      type: 'uri' as const,
      uri: getLiffUrl('NUTRITION_REPORT'),
    },
  },
}

// Helper function สำหรับการนำทาง
export const navigateToNutritionReport = () => {
  if (typeof window !== 'undefined') {
    window.location.href = LIFF_PATHS.NUTRITION_REPORT
  }
}

export const navigateToProfile = () => {
  if (typeof window !== 'undefined') {
    window.location.href = LIFF_PATHS.PROFILE
  }
}
