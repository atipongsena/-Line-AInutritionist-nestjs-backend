import { FoodItem as SharedFoodItemOriginal } from '@ai-nutritionist/shared-types'

// Re-export SharedFoodItem so components can import it from the store
// export type { SharedFoodItemOriginal as FoodItem } // This line seems to be from nutritionStore.ts, remove if not needed here or ensure correct usage.
// For api.service.ts, we directly use SharedFoodItemOriginal or a more specific DTO if available

// Import specific response data types expected from the backend
import type {
  DailyNutritionData,
  WeeklyNutritionData,
  MonthlyNutritionData,
  // FoodLogResponseDto, // Removed import from nutritionStore
} from '../stores/nutritionStore' // Or from shared-types if they exist there

// Define a type for the payload of the updateFoodLog API call, mirroring backend's UpdateFoodLogDto
// Exporting these for use in the store/components
export interface UpdateVitaminMineralDetailPayload {
  value?: number
  unit?: string
  dv?: number
}

export interface UpdateFoodNutritionPayload {
  calories?: number
  protein?: number
  carbs?: number
  fat?: number
  fiber?: number
  sugar?: number
  sodium?: number
  cholesterol?: number
  saturated_fat?: number
  water?: number
  omega3?: number
}

export interface UpdateFoodNamePayload {
  th?: string
  en?: string
}

export interface UpdateFoodDetailPayload {
  foodName?: UpdateFoodNamePayload
  amount?: number
  unit?: string
  portion?: string
  nutrition?: UpdateFoodNutritionPayload
  micronutrients?: Record<string, UpdateVitaminMineralDetailPayload>
}

export interface UpdateFoodLogPayload {
  // Export this so it can be used by the store/component
  mealType?: string
  food?: UpdateFoodDetailPayload
  imageUrl?: string
  imageAlt?: string
}

// Definition for a single food log entry, as expected from the backend API GET /food-log/:id/:lineUserId
// This will be used for currentLiffFoodLog and in api.service.ts
// export interface FoodLogResponseDto {
//   _id: string
//   lineUserId: string
//   logDate: string // Should be YYYY-MM-DD string format from backend
//   mealType: string // e.g., "breakfast", "lunch", "dinner", "snack"
//   foodItems: SharedFoodItemOriginal[] // Array of detailed food items
//   totalCalories?: number // Optional, might be calculated on frontend or backend
//   notes?: string // User's notes for this log entry
//   imageUrl?: string // URL of the image associated with this log, if any
//   createdAt?: string | Date
//   updatedAt?: string | Date
//   // Include other fields that the backend's FoodLogController.findOnePersonal endpoint might return
// }

// Equivalent to backend's FoodNutritionResponseDto for LIFF display
export interface LiffFoodNutritionDto {
  calories: number
  protein?: number
  carbs?: number
  fat?: number
  fiber?: number
  sugar?: number
  sodium?: number
  cholesterol?: number
  saturated_fat?: number
  water?: number
  omega3?: number
}

// Using UpdateVitaminMineralDetailPayload as it's already defined and fits the purpose
export type LiffMicronutrientDetailDto = UpdateVitaminMineralDetailPayload

// Equivalent to backend's FoodDetailResponseDto for LIFF display
export interface LiffFoodDetailDto {
  foodName: { th?: string; en?: string }
  amount?: number
  unit?: string
  portion?: string // e.g., "1 bowl (approx 300g)"
  nutrition: LiffFoodNutritionDto
  micronutrients?: Record<string, LiffMicronutrientDetailDto>
}

// Revised FoodLogResponseDto to match backend's src/food-log/dto/food-log-response.dto.ts
export interface FoodLogResponseDto {
  id: string // Changed from _id to match backend DTO
  lineUserId: string
  logDate: string // Keep as string (YYYY-MM-DD or ISO string from backend)
  mealType: string // e.g., "breakfast", "lunch", "dinner", "snack"
  food: LiffFoodDetailDto // Changed from foodItems: SharedFoodItemOriginal[]
  imageUrl?: string
  imageAlt?: string // Added from backend DTO
  aiAnalyzed?: boolean // Added from backend DTO
  confidenceScore?: number // Added from backend DTO
  tags?: string[] // Added from backend DTO
  // Fields like totalCalories, notes, createdAt, updatedAt might be missing if not in backend DTO
  // Kept createdAt/updatedAt for now, but should be confirmed if backend sends them for this DTO.
  // For strict DTO matching, if backend src/food-log/dto/food-log-response.dto.ts does not have them, they should be removed.
  // For now, assuming they might still be part of a wider FoodLogDocument structure the client might use.
  createdAt?: string | Date
  updatedAt?: string | Date
}

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api'

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// สร้าง header สำหรับ API request ด้วย LINE ID token
const createHeaders = (idToken: string | null) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (idToken) {
    headers['X-LINE-ID-TOKEN'] = idToken // เปลี่ยนชื่อ header และใช้ raw token
  }
  return headers
}

// สร้าง URL สำหรับเรียกใช้ API
const createUrl = (endpoint: string) => {
  return `${API_BASE_URL}${endpoint}`
}

// API service สำหรับดึงข้อมูลโภชนาการจาก backend
export const nutritionApi = {
  // ดึงรายงานโภชนาการรายวัน
  async getDailyReport(
    date: string,
    lineUserId: string,
    idToken: string | null,
  ): Promise<ApiResponse<DailyNutritionData>> {
    try {
      const response = await fetch(
        createUrl(
          `/nutrition/daily-report?date=${date}&lineUserId=${lineUserId}`,
        ),
        {
          method: 'GET',
          headers: createHeaders(idToken),
        },
      )

      if (!response.ok) {
        let errorJson: { message?: string } = {}
        try {
          errorJson = (await response.json()) as { message?: string }
        } catch {
          // Ignore JSON parsing errors
        }
        throw new Error(
          `API error: ${response.status} - ${errorJson.message || response.statusText}`,
        )
      }

      const data = (await response.json()) as DailyNutritionData
      return { success: true, data }
    } catch (error) {
      console.error('Error fetching daily report:', error)
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้',
      }
    }
  },

  // ดึงรายงานโภชนาการรายสัปดาห์
  async getWeeklyReport(
    weekStartDate: string,
    lineUserId: string,
    idToken: string | null,
  ): Promise<ApiResponse<WeeklyNutritionData>> {
    try {
      const response = await fetch(
        createUrl(
          `/nutrition/weekly-report?weekStartDate=${weekStartDate}&lineUserId=${lineUserId}`,
        ),
        {
          method: 'GET',
          headers: createHeaders(idToken),
        },
      )

      if (!response.ok) {
        let errorJson: { message?: string } = {}
        try {
          errorJson = (await response.json()) as { message?: string }
        } catch {
          // Ignore JSON parsing errors
        }
        throw new Error(
          `API error: ${response.status} - ${errorJson.message || response.statusText}`,
        )
      }

      const data = (await response.json()) as WeeklyNutritionData
      return { success: true, data }
    } catch (error) {
      console.error('Error fetching weekly report:', error)
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้',
      }
    }
  },

  // ดึงรายงานโภชนาการรายเดือน
  async getMonthlyReport(
    month: string,
    lineUserId: string,
    idToken: string | null,
  ): Promise<ApiResponse<MonthlyNutritionData>> {
    try {
      const response = await fetch(
        createUrl(
          `/nutrition/monthly-report?month=${month}&lineUserId=${lineUserId}`,
        ),
        {
          method: 'GET',
          headers: createHeaders(idToken),
        },
      )

      if (!response.ok) {
        let errorJson: { message?: string } = {}
        try {
          errorJson = (await response.json()) as { message?: string }
        } catch {
          // Ignore JSON parsing errors
        }
        throw new Error(
          `API error: ${response.status} - ${errorJson.message || response.statusText}`,
        )
      }

      const data = (await response.json()) as MonthlyNutritionData
      return { success: true, data }
    } catch (error) {
      console.error('Error fetching monthly report:', error)
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้',
      }
    }
  },

  // อัพเดทรายการอาหาร - แก้ไขให้ใช้ UpdateFoodLogPayload แทน
  async updateFoodItem(
    mealId: string, // This is actually foodLogId
    foodItem: SharedFoodItemOriginal, // Use the imported type directly
    lineUserId: string,
    idToken: string | null,
  ): Promise<ApiResponse<SharedFoodItemOriginal>> {
    try {
      // สร้าง payload ที่เฉพาะ fields ที่ backend รองรับ
      const updatePayload: UpdateFoodLogPayload = {
        food: {
          foodName: {
            th:
              typeof foodItem.name === 'string'
                ? foodItem.name
                : foodItem.name?.th,
            en:
              typeof foodItem.name === 'string' ? undefined : foodItem.name?.en,
          },
          amount: foodItem.serving?.size || 1,
          unit: foodItem.serving?.unit || 'กรัม',
          portion: foodItem.description?.th || foodItem.description?.en || '',
          nutrition: {
            calories: foodItem.nutrition?.calories || 0,
            protein: foodItem.nutrition?.protein || 0,
            carbs: foodItem.nutrition?.carbs || 0,
            fat: foodItem.nutrition?.fat || 0,
            fiber: foodItem.nutrition?.fiber,
            sugar: foodItem.nutrition?.sugar,
            sodium: foodItem.nutrition?.sodium,
            // เอา fields ที่ backend ไม่รองรับออก
            // cholesterol: foodItem.nutrition?.cholesterol,
            // saturated_fat: foodItem.nutrition?.saturated_fat,
            // water: foodItem.nutrition?.water,
            // omega3: foodItem.nutrition?.omega3,
          },
          micronutrients:
            foodItem.nutrition?.vitamins || foodItem.nutrition?.minerals
              ? {
                  ...Object.fromEntries(
                    Object.entries(foodItem.nutrition.vitamins || {}).map(
                      ([key, detail]) => [
                        key,
                        {
                          value: detail.value,
                          unit: detail.unit,
                          dv: detail.dv,
                        },
                      ],
                    ),
                  ),
                  ...Object.fromEntries(
                    Object.entries(foodItem.nutrition.minerals || {}).map(
                      ([key, detail]) => [
                        key,
                        {
                          value: detail.value,
                          unit: detail.unit,
                          dv: detail.dv,
                        },
                      ],
                    ),
                  ),
                }
              : undefined,
        },
      }

      const response = await fetch(
        createUrl(`/food-log/${mealId}/${lineUserId}`),
        {
          method: 'PUT',
          headers: createHeaders(idToken),
          body: JSON.stringify(updatePayload),
        },
      )

      if (!response.ok) {
        let errorJson: { message?: string } = {}
        try {
          errorJson = (await response.json()) as { message?: string }
        } catch {
          // Ignore JSON parsing errors
        }
        throw new Error(
          `API error: ${response.status} - ${errorJson.message || response.statusText}`,
        )
      }

      // Backend ส่ง FoodLogResponseDto กลับมา ต้องแปลงเป็น SharedFoodItem
      const foodLogData = (await response.json()) as FoodLogResponseDto
      const updatedFoodItem: SharedFoodItemOriginal = {
        _id: foodLogData.id,
        name: {
          th: foodLogData.food.foodName.th || 'ไม่ระบุชื่อ',
          en: foodLogData.food.foodName.en,
        },
        description: {
          th: `${foodLogData.food.portion || ''}`,
          en: `${foodLogData.food.portion || ''}`,
        },
        nutrition: {
          calories: foodLogData.food.nutrition.calories,
          protein: foodLogData.food.nutrition.protein || 0,
          carbs: foodLogData.food.nutrition.carbs || 0,
          fat: foodLogData.food.nutrition.fat || 0,
          fiber: foodLogData.food.nutrition.fiber,
          sugar: foodLogData.food.nutrition.sugar,
          sodium: foodLogData.food.nutrition.sodium,
          // ไม่รวม fields ที่ backend ไม่รองรับ
          vitamins:
            foodLogData.food.micronutrients &&
            Object.keys(foodLogData.food.micronutrients).length > 0
              ? Object.fromEntries(
                  Object.entries(foodLogData.food.micronutrients).map(
                    ([key, detail]) => [
                      key,
                      {
                        value: detail.value || 0,
                        unit: detail.unit || '',
                        dv: detail.dv,
                      },
                    ],
                  ),
                )
              : undefined,
        },
        serving: {
          size: foodLogData.food.amount || 1,
          unit: foodLogData.food.unit || 'กรัม',
          weight: foodLogData.food.amount || 1,
        },
      }

      return { success: true, data: updatedFoodItem }
    } catch (error) {
      console.error('Error updating food item:', error)
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'ไม่สามารถอัพเดทข้อมูลได้',
      }
    }
  },

  // ลบรายการอาหาร - ลองใช้ DELETE endpoint สำหรับ food log
  async deleteFoodItem(
    mealId: string, // This is actually foodLogId
    foodItemId: string, // ไม่ได้ใช้เพราะลบทั้ง food log
    lineUserId: string,
    idToken: string | null,
  ): Promise<ApiResponse<{ message: string }>> {
    try {
      // ลองใช้ DELETE endpoint สำหรับ food log ทั้งล็อก
      const response = await fetch(
        createUrl(`/food-log/${mealId}/${lineUserId}`),
        {
          method: 'DELETE',
          headers: createHeaders(idToken),
        },
      )

      if (!response.ok) {
        let errorJson: { message?: string } = {}
        try {
          errorJson = (await response.json()) as { message?: string }
        } catch {
          // Ignore JSON parsing errors
        }

        if (response.status === 404) {
          return {
            success: false,
            error: 'ไม่พบรายการอาหารที่ต้องการลบ',
          }
        } else if (response.status === 403) {
          return {
            success: false,
            error: 'ไม่มีสิทธิ์ในการลบรายการนี้',
          }
        } else {
          return {
            success: false,
            error: errorJson.message || 'ไม่สามารถลบรายการอาหารได้',
          }
        }
      }

      const result = (await response.json()) as { message: string }
      return {
        success: true,
        data: result,
      }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์',
      }
    }
  },

  // ดึงข้อมูล FoodLog เฉพาะรายการสำหรับ LIFF App
  async getFoodLogById(
    logId: string,
    lineUserId: string,
    idToken: string | null,
  ): Promise<ApiResponse<FoodLogResponseDto>> {
    try {
      const response = await fetch(
        createUrl(`/food-log/${logId}/${lineUserId}`), // Use lineUserId in path
        {
          method: 'GET',
          headers: createHeaders(idToken),
        },
      )

      if (!response.ok) {
        let errorJson: { message?: string } = {}
        try {
          errorJson = (await response.json()) as { message?: string }
        } catch {
          // Ignore JSON parsing errors
        }
        throw new Error(
          `API error: ${response.status} - ${errorJson.message || response.statusText}`,
        )
      }
      const data = (await response.json()) as FoodLogResponseDto
      return { success: true, data }
    } catch (error) {
      console.error('Error fetching food log by ID:', error)
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'ไม่สามารถดึงข้อมูลมื้ออาหารได้',
      }
    }
  },

  // Update Food Log using the specific payload
  async updateFoodLog(
    logId: string,
    foodLogUpdatePayload: UpdateFoodLogPayload, // Use the new payload type
    lineUserId: string,
    idToken: string | null,
  ): Promise<ApiResponse<FoodLogResponseDto>> {
    // Still expect FoodLogResponseDto as response
    try {
      const response = await fetch(
        createUrl(`/food-log/${logId}/${lineUserId}`),
        {
          method: 'PUT',
          headers: createHeaders(idToken),
          body: JSON.stringify(foodLogUpdatePayload), // Send the new payload
        },
      )

      if (!response.ok) {
        let errorJson: { message?: string } = {}
        try {
          errorJson = (await response.json()) as { message?: string }
        } catch {
          // Ignore JSON parsing errors
        }
        throw new Error(
          `API error: ${response.status} - ${errorJson.message || response.statusText}`,
        )
      }

      const data = (await response.json()) as FoodLogResponseDto // Backend returns the full updated DTO
      return { success: true, data }
    } catch (error) {
      console.error('Error updating food log:', error)
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'ไม่สามารถอัปเดตข้อมูลมื้ออาหารได้',
      }
    }
  },
}

// Example of how this might be used by a store (conceptual)
/*
async function handleUpdateFoodLog(
  logId: string,
  formData: UpdateFoodLogPayload, // Data from the form matching the payload structure
  lineUserId: string,
  idToken: string | null,
) {
  const result = await nutritionApi.updateFoodLog(logId, formData, lineUserId, idToken);
  if (result.success && result.data) {
    console.log('Food log updated successfully:', result.data);
    // Update local state with result.data
  } else {
    console.error('Failed to update food log:', result.error);
  }
}
*/
