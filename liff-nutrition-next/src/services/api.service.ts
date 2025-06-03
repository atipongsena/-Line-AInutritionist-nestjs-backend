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

// Base API configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

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
   * Generic request method
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    token?: string,
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
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

        // ✅ ถ้าได้ HTML อาจเป็น ngrok warning page หรือ backend error
        if (
          textResponse.includes('<!DOCTYPE') ||
          textResponse.includes('<html>')
        ) {
          throw new Error(
            `Server returned HTML instead of JSON. This might be a ngrok warning page or backend error. Check backend server status.`,
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

      // ✅ เพิ่มคำแนะนำสำหรับปัญหาพบบ่อย
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch')) {
          console.error(
            `[ApiService] Network error - Check if backend server is running and ngrok tunnel is active`,
          )
        } else if (error.message.includes('HTML instead of JSON')) {
          console.error(
            `[ApiService] HTML Response Error - Possible causes:`,
            '\n1. ngrok showing warning page',
            '\n2. Backend server not running',
            '\n3. Wrong API endpoint',
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

  // ===================
  // Daily Report APIs
  // ===================

  /**
   * Get daily nutrition report
   */
  async getDailyReport(
    date: string,
    userId: string,
    token: string,
  ): Promise<DailyReportResponse> {
    const endpoint = `/nutrition/daily-report?date=${date}&lineUserId=${userId}`
    return this.get<DailyReportResponse>(endpoint, token)
  }

  // ===================
  // Food Log APIs
  // ===================

  /**
   * Get specific food log by ID
   */
  async getFoodLogById(
    logId: string,
    userId: string,
    token: string,
  ): Promise<FoodLogResponseDto> {
    const endpoint = `/food-log/${logId}/${userId}`
    return this.get<FoodLogResponseDto>(endpoint, token)
  }

  /**
   * Update food log
   */
  async updateFoodLog(
    logId: string,
    updateData: Partial<LiffFoodLogData>,
    userId: string,
    token: string,
  ): Promise<FoodLogResponseDto> {
    const endpoint = `/food-log/${logId}/${userId}`
    return this.put<FoodLogResponseDto>(endpoint, updateData, token)
  }

  /**
   * Delete food log
   */
  async deleteFoodLog(
    logId: string,
    userId: string,
    token: string,
  ): Promise<ApiResponse<null>> {
    const endpoint = `/food-log/${logId}/${userId}`
    return this.delete<ApiResponse<null>>(endpoint, token)
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
