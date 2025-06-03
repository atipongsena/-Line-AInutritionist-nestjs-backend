// API Service for Nutrition Backend
import {
  FoodItem,
  DailyNutritionData,
  WeeklyData,
  MonthlyData,
  NutritionData,
  DailyReportResponse,
  ApiResponse,
} from '../types/food'
import { UpdateFoodLogPayload, LiffFoodLogData } from '../stores/nutritionStore'

// Base API configuration - ปรับปรุงสำหรับ Azure Static Web Apps
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000'

// Types for API responses specific to this service
export interface FoodLogResponseDto {
  success: boolean
  data?: LiffFoodLogData
  message?: string
  error?: string
}

// API Client class
class ApiService {
  private baseURL: string

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL
  }

  /**
   * Generic request method - ปรับปรุงสำหรับ Production Environment
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    token?: string,
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`

    // ✅ Headers สำหรับ Production Environment
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'ngrok-skip-browser-warning': 'true',
      ...(options.headers as Record<string, string>),
    }

    // ✅ เพิ่ม LINE ID Token สำหรับ authentication
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
      headers['X-LINE-ID-TOKEN'] = token
    }

    console.log(
      `[ApiService] Making ${options.method || 'GET'} request to:`,
      url,
    )

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        mode: 'cors',
        credentials: 'omit',
      })

      const contentType = response.headers.get('content-type')
      console.log(
        `[ApiService] Response status: ${response.status}, Content-Type: ${contentType}`,
      )

      if (!response.ok) {
        let errorText = ''
        let errorData: any = null

        try {
          if (contentType?.includes('application/json')) {
            errorData = await response.json()
            errorText = JSON.stringify(errorData)
          } else {
            errorText = await response.text()
          }
          console.error(`[ApiService] Error response:`, errorText)
        } catch (textError) {
          console.error(
            `[ApiService] Could not read error response:`,
            textError,
          )
        }

        // ✅ จัดการ Authentication Error
        if (response.status === 401 || response.status === 403) {
          throw new Error(`Authentication failed: ${errorText}`)
        }

        // ✅ จัดการ Server Error
        if (response.status >= 500) {
          throw new Error(`Server error (${response.status}): ${errorText}`)
        }

        throw new Error(`HTTP error ${response.status}: ${errorText}`)
      }

      // ✅ ตรวจสอบ Content-Type
      if (!contentType?.includes('application/json')) {
        const textResponse = await response.text()
        console.error(`[ApiService] Expected JSON but got ${contentType}`)

        if (
          textResponse.includes('<!DOCTYPE') ||
          textResponse.includes('<html>')
        ) {
          throw new Error(
            'Server returned HTML instead of JSON. Backend may be misconfigured.',
          )
        }

        throw new Error(
          `Invalid response format. Expected JSON but got ${contentType}`,
        )
      }

      const data = await response.json()
      console.log(`[ApiService] Response data received successfully`)
      return data
    } catch (error) {
      console.error(`[ApiService] Request failed:`, error)

      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch')) {
          throw new Error(
            'Network error: Unable to connect to backend server. Please check your internet connection.',
          )
        }
      }

      throw error
    }
  }

  /**
   * GET request
   */
  private async get<T>(endpoint: string, token?: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' }, token)
  }

  /**
   * POST request
   */
  private async post<T>(
    endpoint: string,
    data: any,
    token?: string,
  ): Promise<T> {
    return this.request<T>(
      endpoint,
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      token,
    )
  }

  /**
   * PUT request
   */
  private async put<T>(
    endpoint: string,
    data: any,
    token?: string,
  ): Promise<T> {
    return this.request<T>(
      endpoint,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      },
      token,
    )
  }

  /**
   * DELETE request
   */
  private async delete<T>(endpoint: string, token?: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' }, token)
  }

  // ✅ Fallback data สำหรับกรณีที่ API ไม่ทำงาน
  private getFallbackDailyReport(): DailyReportResponse {
    return {
      success: true,
      data: {
        date: new Date().toISOString().split('T')[0],
        totalCalories: 0,
        totalProtein: 0,
        totalCarbs: 0,
        totalFat: 0,
        totalFiber: 0,
        totalSugar: 0,
        totalSodium: 0,
        meals: [],
        micronutrients: {},
        totalFoodItems: 0,
        averageCaloriesPerMeal: 0,
        calories: { consumed: 0, goal: 2000, unit: 'kcal' },
        macronutrients: {
          protein: { consumed: 0, goal: 50, unit: 'g' },
          carbs: { consumed: 0, goal: 250, unit: 'g' },
          fat: { consumed: 0, goal: 67, unit: 'g' },
        },
        otherNutrients: {
          fiber: { consumed: 0, goal: 25, unit: 'g' },
          water: { consumed: 0, goal: 2000, unit: 'ml' },
        },
      },
    }
  }

  /**
   * Daily Report API - ปรับปรุงสำหรับ production
   */
  async getDailyReport(
    date: string,
    userId: string,
    token: string,
  ): Promise<DailyReportResponse> {
    try {
      console.log(
        `[ApiService] Fetching daily report for ${date}, userId: ${userId}`,
      )

      const response = await this.get<DailyReportResponse>(
        `/api/nutrition/daily-report?date=${date}&userId=${userId}`,
        token,
      )

      console.log(`[ApiService] Daily report API response:`, response)

      // ✅ ตรวจสอบ response structure
      if (response && typeof response === 'object') {
        // Case 1: Response มี success และ data
        if ('success' in response && response.success && 'data' in response) {
          return response as DailyReportResponse
        }
        // Case 2: Response เป็น data โดยตรง
        else if ('calories' in response || 'meals' in response) {
          return {
            success: true,
            data: response as any,
          }
        }
      }

      throw new Error('Invalid response structure from daily report API')
    } catch (error) {
      console.error(`[ApiService] Failed to fetch daily report:`, error)

      // ✅ ไม่ return fallback data ที่นี่ ให้ store จัดการ
      throw error
    }
  }

  // ===================
  // Food Log APIs
  // ===================

  /**
   * Food Log By ID - ปรับปรุงสำหรับ fallback handling
   */
  async getFoodLogById(
    logId: string,
    userId: string,
    token: string,
  ): Promise<FoodLogResponseDto> {
    try {
      const response = await this.get<FoodLogResponseDto>(
        `/api/food-log/${logId}?userId=${userId}`,
        token,
      )
      return response
    } catch (error) {
      console.warn(
        `[ApiService] Failed to fetch food log ${logId}, using fallback:`,
        error,
      )
      return {
        success: false,
        message: 'Could not connect to server. Please try again later.',
      }
    }
  }

  /**
   * Update Food Log - ปรับปรุงสำหรับ error handling
   */
  async updateFoodLog(
    logId: string,
    updateData: Partial<LiffFoodLogData>,
    userId: string,
    token: string,
  ): Promise<FoodLogResponseDto> {
    try {
      const response = await this.put<FoodLogResponseDto>(
        `/api/food-log/${logId}?userId=${userId}`,
        updateData,
        token,
      )
      return response
    } catch (error) {
      console.error(`[ApiService] Failed to update food log ${logId}:`, error)
      return {
        success: false,
        message: 'Failed to update food log. Please try again.',
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  /**
   * Delete Food Log - ปรับปรุงสำหรับ error handling
   */
  async deleteFoodLog(
    logId: string,
    userId: string,
    token: string,
  ): Promise<ApiResponse<null>> {
    try {
      const response = await this.delete<ApiResponse<null>>(
        `/api/food-log/${logId}?userId=${userId}`,
        token,
      )
      return response
    } catch (error) {
      console.error(`[ApiService] Failed to delete food log ${logId}:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  /**
   * Get recent food logs for user
   */
  async getRecentFoodLogs(
    userId: string,
    token: string,
    days?: number,
    limit?: number,
  ): Promise<FoodLogResponseDto[]> {
    let endpoint = `/food-log/recent`
    const params = new URLSearchParams()
    if (days) params.append('days', days.toString())
    if (limit) params.append('limit', limit.toString())
    if (params.toString()) endpoint += `?${params.toString()}`

    return this.request<FoodLogResponseDto[]>(
      endpoint,
      {
        method: 'GET',
        headers: {
          'X-Line-User-ID': userId,
        },
      },
      token,
    )
  }

  // ===================
  // Weekly Report APIs
  // ===================

  /**
   * Get weekly nutrition report
   */
  async getWeeklyReport(
    weekStartDate: string,
    userId: string,
    token: string,
  ): Promise<ApiResponse<WeeklyData>> {
    const endpoint = `/nutrition/weekly-report?weekStartDate=${weekStartDate}&lineUserId=${userId}`
    return this.get<ApiResponse<WeeklyData>>(endpoint, token)
  }

  // ===================
  // Monthly Report APIs
  // ===================

  /**
   * Get monthly nutrition report
   */
  async getMonthlyReport(
    month: string,
    userId: string,
    token: string,
  ): Promise<ApiResponse<MonthlyData>> {
    const endpoint = `/nutrition/monthly-report?month=${month}&lineUserId=${userId}`
    return this.get<ApiResponse<MonthlyData>>(endpoint, token)
  }

  // ===================
  // User Profile APIs
  // ===================

  /**
   * Get user nutrition profile
   */
  async getUserProfile(
    userId: string,
    token: string,
  ): Promise<ApiResponse<any>> {
    const endpoint = `/user/profile/${userId}`
    return this.get<ApiResponse<any>>(endpoint, token)
  }

  /**
   * Update user nutrition profile
   */
  async updateUserProfile(
    userId: string,
    profileData: any,
    token: string,
  ): Promise<ApiResponse<any>> {
    const endpoint = `/user/profile/${userId}`
    return this.put<ApiResponse<any>>(endpoint, profileData, token)
  }

  // ===================
  // Health Check
  // ===================

  /**
   * Check API health status
   */
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return this.get<{ status: string; timestamp: string }>('/health')
  }
}

// Export singleton instance
export const apiService = new ApiService()

// Export individual functions for convenience
export const {
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

// Export the class for testing
export { ApiService }
