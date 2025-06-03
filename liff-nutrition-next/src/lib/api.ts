// Next.js optimized API client
const _API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001'

/**
 * Handle common API response patterns
 */
const _handleApiResponse = <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const error: any = new Error(`HTTP error! status: ${response.status}`)
    throw new Error(`API Error: ${error.message}`)
  }
  return response.json() as Promise<T>
}

/**
 * Create standard headers for API requests
 */
const _createAuthHeaders = (token: string): Headers => {
  const headers = new Headers()
  headers.append('Content-Type', 'application/json')
  headers.append('Authorization', `Bearer ${token}`)
  return headers
}

// API Error Class
export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public data?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// API re-exports for compatibility with existing imports
import { apiService } from '../services/api.service'

// Import the destructured functions from apiService
const {
  getDailyReport,
  getFoodLogById,
  updateFoodLog,
  deleteFoodLog,
  getWeeklyReport,
  getMonthlyReport,
  getUserProfile,
  updateUserProfile,
  healthCheck,
} = apiService

// Re-export the functions
export {
  apiService,
  getDailyReport,
  getFoodLogById,
  updateFoodLog,
  deleteFoodLog,
  getWeeklyReport,
  getMonthlyReport,
  getUserProfile,
  updateUserProfile,
  healthCheck,
}

// Re-export types
export type { FoodLogResponseDto } from '../services/api.service'

// Re-export all food types
export type {
  LiffFoodLogData,
  DailyNutritionData,
  DailyReportResponse,
  LiffFoodLogResponse,
  ApiResponse,
  FoodItem,
} from '../types/food'

// API helper functions for backward compatibility
export const withRetry = async <T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delay: number = 1000,
): Promise<T> => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn()
    } catch (error) {
      if (i === retries - 1) throw error
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
  throw new Error('All retries failed')
}

// Helper functions that match the expected API interface
export const fetchDailyReport = getDailyReport
export const fetchWeeklyReport = getWeeklyReport
export const fetchMonthlyReport = getMonthlyReport
export const fetchLiffFoodLog = getFoodLogById
export const updateLiffFoodLog = updateFoodLog
export const updateFoodItem = updateFoodLog
export const deleteFoodItem = deleteFoodLog
