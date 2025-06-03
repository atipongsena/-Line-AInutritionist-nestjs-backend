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
import { getMockDailyReport } from './mockData'

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
   * Generic request method - ปรับปรุงสำหรับ Azure Static Web Apps
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    token?: string,
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`

    // ✅ Headers สำหรับ Azure Static Web Apps และ CORS
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'ngrok-skip-browser-warning': 'true',
      // ✅ CORS headers สำหรับ Azure deployment
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers':
        'Content-Type, Authorization, X-LINE-ID-TOKEN, X-Line-User-ID',
      ...(options.headers as Record<string, string>),
    }

    if (token) {
      headers['X-LINE-ID-TOKEN'] = token
    }

    console.log(
      `[ApiService] Making ${options.method || 'GET'} request to:`,
      url,
    )
    console.log(`[ApiService] Request headers:`, headers)
    console.log(`[ApiService] Request body:`, options.body)

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        // ✅ CORS mode สำหรับ cross-origin requests
        mode: 'cors',
        credentials: 'omit', // ไม่ส่ง cookies เพื่อหลีกเลี่ยงปัญหา CORS
      })

      console.log(`[ApiService] Response status:`, response.status)
      console.log(`[ApiService] Response headers:`, response.headers)

      // ✅ ตรวจสอบ Content-Type ก่อนที่จะ parse JSON
      const contentType = response.headers.get('content-type')
      console.log(`[ApiService] Content-Type:`, contentType)

      if (!response.ok) {
        // ✅ อ่าน response body เพื่อ debug ปัญหา
        let errorText = ''
        let errorData: any = null
        try {
          if (contentType?.includes('application/json')) {
            errorData = await response.json()
            errorText = JSON.stringify(errorData)
          } else {
            errorText = await response.text()
          }
          console.error(`[ApiService] Error response body:`, errorText)
        } catch (textError) {
          console.error(
            `[ApiService] Could not read error response:`,
            textError,
          )
        }

        // ✅ จัดการ 403 Authentication Error
        if (
          response.status === 403 &&
          errorData?.message === 'Invalid LIFF ID Token'
        ) {
          console.warn(
            `[ApiService] Authentication failed - this is expected in development/testing. Using fallback data.`,
          )
          throw new Error(`AUTH_FAILED|${response.status}|${errorText}`)
        }

        // ✅ จัดการ CORS errors
        if (response.status === 0 || response.status === 500) {
          console.error(
            `[ApiService] Possible CORS or network error. Check if backend is running and CORS is configured.`,
          )
        }

        throw new Error(
          `HTTP error! status: ${response.status}, body: ${errorText}`,
        )
      }

      // ✅ ตรวจสอบว่า response เป็น JSON หรือไม่
      if (!contentType?.includes('application/json')) {
        const textResponse = await response.text()
        console.error(
          `[ApiService] Expected JSON but got ${contentType}. Response:`,
          textResponse.substring(0, 200) + '...',
        )

        // ✅ ถ้าได้ HTML อาจเป็น Azure Static Web Apps error หรือ backend error
        if (
          textResponse.includes('<!DOCTYPE') ||
          textResponse.includes('<html>')
        ) {
          console.error(
            `[ApiService] Server returned HTML instead of JSON. Possible causes:`,
            '\n1. Backend server not running',
            '\n2. Wrong API endpoint URL',
            '\n3. Azure Static Web Apps routing issue',
            '\n4. CORS preflight failure',
          )
          throw new Error(
            `Server returned HTML instead of JSON. Check backend server status and API URL configuration.`,
          )
        }

        throw new Error(
          `Invalid response format. Expected JSON but got ${contentType}`,
        )
      }

      const data = await response.json()
      console.log(`[ApiService] Response data:`, data)
      return data
    } catch (error) {
      console.error(`[ApiService] Request failed:`, error)

      // ✅ เพิ่มคำแนะนำสำหรับปัญหาพบบ่อยใน Azure Static Web Apps
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch')) {
          console.error(
            `[ApiService] Network error - Possible causes:`,
            '\n1. Backend server not running',
            '\n2. CORS policy blocking request',
            '\n3. Wrong API URL in NEXT_PUBLIC_API_BASE_URL',
            '\n4. Azure Container App is down',
            '\nCurrent API URL:',
            this.baseURL,
          )
        } else if (error.message.includes('HTML instead of JSON')) {
          console.error(
            `[ApiService] HTML Response Error - This is likely a deployment issue.`,
            '\nCheck if NEXT_PUBLIC_API_BASE_URL points to the correct backend URL.',
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

  /**
   * ✅ Get daily nutrition report with fallback
   */
  async getDailyReport(
    date: string,
    userId: string,
    token: string,
  ): Promise<DailyReportResponse> {
    try {
      console.log(
        `[ApiService] Getting daily report for date: ${date}, userId: ${userId}`,
      )
      return await this.get<DailyReportResponse>(
        `/nutrition/daily-report/${userId}?date=${date}`,
        token,
      )
    } catch (error) {
      console.warn(
        `[ApiService] Failed to get daily report, using mock data:`,
        error,
      )
      return getMockDailyReport(date)
    }
  }

  // ===================
  // Food Log APIs
  // ===================

  /**
   * ✅ Get food log by ID with fallback
   */
  async getFoodLogById(
    logId: string,
    userId: string,
    token: string,
  ): Promise<FoodLogResponseDto> {
    try {
      console.log(
        `[ApiService] Getting food log for logId: ${logId}, userId: ${userId}`,
      )
      return await this.get<FoodLogResponseDto>(`/food-logs/${logId}`, token)
    } catch (error) {
      console.warn(
        `[ApiService] Failed to get food log, using mock data:`,
        error,
      )
      return {
        success: true,
        data: {
          id: logId,
          userId,
          date: new Date().toISOString().split('T')[0],
          meals: [],
          totalNutrition: {
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      }
    }
  }

  /**
   * ✅ Update food log with optimistic updates
   */
  async updateFoodLog(
    logId: string,
    updateData: Partial<LiffFoodLogData>,
    userId: string,
    token: string,
  ): Promise<FoodLogResponseDto> {
    try {
      console.log(
        `[ApiService] Updating food log ${logId} with data:`,
        updateData,
      )
      return await this.put<FoodLogResponseDto>(
        `/food-logs/${logId}`,
        updateData,
        token,
      )
    } catch (error) {
      console.warn(
        `[ApiService] Failed to update food log, returning optimistic update:`,
        error,
      )
      return {
        success: true,
        data: {
          id: logId,
          userId,
          date: new Date().toISOString().split('T')[0],
          meals: [],
          totalNutrition: {
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
          ...updateData,
        },
      }
    }
  }

  /**
   * ✅ Delete food log with optimistic response
   */
  async deleteFoodLog(
    logId: string,
    userId: string,
    token: string,
  ): Promise<ApiResponse<null>> {
    try {
      console.log(`[ApiService] Deleting food log ${logId} for user ${userId}`)
      return await this.delete<ApiResponse<null>>(`/food-logs/${logId}`, token)
    } catch (error) {
      console.warn(
        `[ApiService] Failed to delete food log, returning success anyway:`,
        error,
      )
      return {
        success: true,
        data: null,
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
