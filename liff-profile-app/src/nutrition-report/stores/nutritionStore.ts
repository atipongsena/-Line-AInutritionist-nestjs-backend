import { create } from 'zustand'
import { nutritionApi } from '../services/api.service'
// Import shared types using the configured path alias
import {
  FoodItem as SharedFoodItemOriginal, // Rename original import
  // NutritionData as SharedNutritionData, // Uncomment if direct use is needed
  // VitaminMineralDetail as SharedVitaminMineralDetail, // Uncomment if direct use is needed
} from '@ai-nutritionist/shared-types'

// Note: Frontend calculation utilities available if needed as fallback
// import { calculateProgress, calculateNutritionGoals, etc } from '../utils/nutritionCalculator'

// Re-export API payload types for LIFF form usage
export type {
  UpdateFoodLogPayload,
  UpdateFoodDetailPayload,
  UpdateFoodNutritionPayload,
  UpdateFoodNamePayload,
  UpdateVitaminMineralDetailPayload,
} from '../services/api.service'

// Import FoodLogResponseDto from api.service.ts
import type {
  FoodLogResponseDto,
  UpdateFoodLogPayload,
} from '../services/api.service'

// Re-export SharedFoodItem so components can import it from the store
export type { SharedFoodItemOriginal as FoodItem } // Export with the name FoodItem for easier refactoring in components

// Interfaces (สามารถย้ายไปไฟล์ types.ts แยกได้ในอนาคต)
// ควรจะตรงกับโครงสร้างข้อมูลที่ Backend API จะส่งมา

// New interface for micronutrient details that includes an optional goal
export interface MicronutrientDetailWithGoal {
  value: number // Represents consumed value
  unit: string
  dv?: number
  goal?: number // Optional goal
}

// New interface for individual nutrient details with a goal (matches backend DTO)
export interface NutrientDetailWithGoal {
  consumed: number
  goal?: number
  unit: string
}

export interface DailyNutritionData {
  date: string // YYYY-MM-DD
  calories: {
    consumed: number
    goal: number
  }
  macronutrients: {
    protein: NutrientDetailWithGoal // Use the new type
    carbs: NutrientDetailWithGoal // Use the new type
    fat: NutrientDetailWithGoal // Use the new type
  }
  // New field for other nutrients, mirroring backend DTO
  otherNutrients?: {
    fiber?: NutrientDetailWithGoal
    sugar?: NutrientDetailWithGoal
    sodium?: NutrientDetailWithGoal
    cholesterol?: NutrientDetailWithGoal
    saturated_fat?: NutrientDetailWithGoal
    omega3?: NutrientDetailWithGoal
    water?: NutrientDetailWithGoal
  }
  micronutrients?: {
    [key: string]: MicronutrientDetailWithGoal // Already uses a similar structure
  }
  meals: Meal[]
}

export interface Meal {
  id: string // foodLogId จาก backend
  name: string // ชื่อมื้ออาหาร เช่น "เช้า", "กลางวัน" หรืออาจจะเป็น "บันทึกเมื่อ 10:30"
  totalCalories: number
  foodItems: SharedFoodItemOriginal[] // Use imported SharedFoodItem
}

// Removed old local FoodItem definition as it's now imported as SharedFoodItem
// export interface FoodItem { ... old definition ... }

// เพิ่ม interface สำหรับข้อมูลรายงานรายสัปดาห์
export interface WeeklyNutritionData {
  weekStartDate: string
  weekEndDate: string
  avgCalories: number
  avgCaloriesGoal?: number // เพิ่ม goal สำหรับ calories
  dailyCalories: Array<{
    day: string
    calories: number
  }>
  avgMacronutrients: {
    protein: NutrientDetailWithGoal
    carbs: NutrientDetailWithGoal
    fat: NutrientDetailWithGoal
  }
  summary: string
  tip: string
}

// เพิ่ม interface สำหรับข้อมูลรายงานรายเดือน
export interface MonthlyNutritionData {
  month: string // YYYY-MM
  avgCaloriesPerDay: number
  avgCaloriesGoal?: number // เพิ่ม goal สำหรับ calories
  totalCaloriesMonth: number
  calorieTrend: Array<{
    day: number
    calories: number
  }>
  summary: string
  insights: string[]
  avgMacronutrients?: {
    protein: NutrientDetailWithGoal
    carbs: NutrientDetailWithGoal
    fat: NutrientDetailWithGoal
  }
}

// Definition for a single food log entry, as expected from the backend API GET /food-log/:id/:lineUserId
// This will be used for currentLiffFoodLog and in api.service.ts
// export interface FoodLogResponseDto { // This interface is now defined in api.service.ts
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

interface NutritionState {
  // Daily Report
  selectedDate: string // YYYY-MM-DD, ค่าเริ่มต้นเป็นวันปัจจุบัน
  dailyData: DailyNutritionData | null
  currentLiffFoodLog: FoodLogResponseDto | null // State สำหรับเก็บ FoodLog ที่ดึงจาก LIFF URL
  isDailyLoading: boolean
  dailyError: string | null

  // Weekly Report
  selectedWeek: { start: string; end: string } | null // อาจจะเก็บแค่ start date
  weeklyData: WeeklyNutritionData | null
  isWeeklyLoading: boolean
  weeklyError: string | null

  // Monthly Report
  selectedMonth: string | null // YYYY-MM
  monthlyData: MonthlyNutritionData | null
  isMonthlyLoading: boolean
  monthlyError: string | null

  // Actions
  setSelectedDate: (date: string) => void
  fetchDailyReport: (
    date: string,
    lineUserId: string,
    idToken: string | null,
  ) => Promise<void>
  updateFoodItem: (
    mealId: string,
    updatedFoodItem: SharedFoodItemOriginal,
    lineUserId: string,
    idToken: string | null,
  ) => Promise<boolean>
  deleteFoodItem: (
    mealId: string,
    foodItemId: string,
    lineUserId: string,
    idToken: string | null,
  ) => Promise<boolean>

  // เพิ่ม Actions สำหรับรายงานรายสัปดาห์และรายเดือน
  setSelectedWeek: (weekStart: string) => void
  fetchWeeklyReport: (
    weekStartDate: string,
    lineUserId: string,
    idToken: string | null,
  ) => Promise<void>

  setSelectedMonth: (month: string) => void
  fetchMonthlyReport: (
    month: string,
    lineUserId: string,
    idToken: string | null,
  ) => Promise<void>

  fetchFoodLogByIdForLiff: (
    logId: string,
    lineUserId: string,
    idToken: string | null,
  ) => Promise<void> // Action ใหม่

  updateLiffFoodLog: (
    logId: string,
    foodLogData: UpdateFoodLogPayload,
    lineUserId: string,
    idToken: string | null,
  ) => Promise<boolean> // Returns true on success, false on failure

  // เพิ่ม action สำหรับ set current LIFF food log
  setCurrentLiffFoodLog: (foodLog: FoodLogResponseDto | null) => void

  // เพิ่ม action สำหรับ reset error states
  resetErrors: () => void
}

export const useNutritionStore = create<NutritionState>((set, get) => ({
  // Initial state for Daily Report
  selectedDate: (() => {
    // คำนวณวันที่ปัจจุบันเพื่อป้องกันการกำหนดวันที่ในอนาคต
    try {
      console.log('[DEBUG] Calculating initial selectedDate in store')
      // ใช้เวลาปัจจุบันตาม local timezone (ไม่ใช่ UTC)
      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const day = String(now.getDate()).padStart(2, '0')
      const dateStr = `${year}-${month}-${day}`
      console.log(`[DEBUG] Setting initial selectedDate to: ${dateStr}`)
      return dateStr
    } catch (err) {
      console.error('[ERROR] Failed to set initial date, using fallback', err)
      // ใช้อีกวิธีในการสร้างวันที่ปัจจุบัน
      const d = new Date()
      const fallbackDate = `${d.getFullYear()}-${String(
        d.getMonth() + 1,
      ).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      console.log(`[DEBUG] Using fallback date: ${fallbackDate}`)
      return fallbackDate
    }
  })(),
  dailyData: null,
  currentLiffFoodLog: null, // Initial state สำหรับ FoodLog จาก LIFF URL
  isDailyLoading: false,
  dailyError: null,

  // Initial state for Weekly Report
  selectedWeek: null,
  weeklyData: null,
  isWeeklyLoading: false,
  weeklyError: null,

  // Initial state for Monthly Report
  selectedMonth: null,
  monthlyData: null,
  isMonthlyLoading: false,
  monthlyError: null,

  // --- ACTIONS ---
  setSelectedDate: (date) =>
    set({ selectedDate: date, dailyData: null, dailyError: null }), // Reset data on date change

  // Action สำหรับรายสัปดาห์
  setSelectedWeek: (weekStart) =>
    set({
      selectedWeek: {
        start: weekStart,
        end: (() => {
          const startDate = new Date(weekStart)
          const endDate = new Date(startDate)
          endDate.setDate(startDate.getDate() + 6)
          return endDate.toISOString().split('T')[0]
        })(),
      },
      weeklyData: null,
      weeklyError: null,
    }),

  // Action สำหรับรายเดือน
  setSelectedMonth: (month) =>
    set({ selectedMonth: month, monthlyData: null, monthlyError: null }),

  fetchDailyReport: async (date, lineUserId, idToken) => {
    set({ isDailyLoading: true, dailyError: null })
    try {
      const response = await nutritionApi.getDailyReport(
        date,
        lineUserId,
        idToken,
      )

      if (!response.success || !response.data) {
        throw new Error(response.error || 'ไม่สามารถดึงข้อมูลรายวันได้')
      }

      set({ dailyData: response.data, isDailyLoading: false })
    } catch (error) {
      console.error('Failed to fetch daily report:', error)
      let errorMessage = 'Failed to fetch daily report'
      if (error instanceof Error) {
        errorMessage = error.message
      }
      set({
        dailyError: errorMessage,
        isDailyLoading: false,
      })
    }
  },

  // เพิ่ม Action สำหรับดึงข้อมูลรายสัปดาห์
  fetchWeeklyReport: async (weekStartDate, lineUserId, idToken) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(
        `[DEBUG] Starting fetchWeeklyReport for week start: ${weekStartDate}`,
      )
    }

    // ตรวจสอบวันที่
    const selectedDate = new Date(weekStartDate)
    const today = new Date()

    if (selectedDate > today) {
      console.warn(
        `[WARNING] Selected week ${weekStartDate} is in the future. Using current week instead.`,
      )

      // คำนวณวันแรกของสัปดาห์ปัจจุบัน
      const currentWeekStart = new Date(today)
      currentWeekStart.setDate(today.getDate() - today.getDay()) // ตั้งเป็นวันอาทิตย์
      weekStartDate = currentWeekStart.toISOString().split('T')[0]
    }

    set({ isWeeklyLoading: true, weeklyError: null })
    try {
      const response = await nutritionApi.getWeeklyReport(
        weekStartDate,
        lineUserId,
        idToken,
      )

      if (!response.success) {
        throw new Error(response.error || 'ไม่สามารถดึงข้อมูลรายสัปดาห์ได้')
      }

      set({
        weeklyData: response.data as WeeklyNutritionData,
        isWeeklyLoading: false,
        selectedWeek: {
          start: weekStartDate,
          end: (() => {
            const startDate = new Date(weekStartDate)
            const endDate = new Date(startDate)
            endDate.setDate(startDate.getDate() + 6)
            return endDate.toISOString().split('T')[0]
          })(),
        },
      })
    } catch (error) {
      console.error('Failed to fetch weekly report:', error)
      let errorMessage = 'ไม่สามารถโหลดข้อมูลรายสัปดาห์ได้'
      if (error instanceof Error) {
        errorMessage = error.message
      }
      set({
        weeklyError: errorMessage,
        isWeeklyLoading: false,
      })
    }
  },

  // เพิ่ม Action สำหรับดึงข้อมูลรายเดือน
  fetchMonthlyReport: async (month, lineUserId, idToken) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEBUG] Starting fetchMonthlyReport for month: ${month}`)
    }

    // ตรวจสอบเดือน
    const selectedMonth = new Date(`${month}-01`)
    const today = new Date()
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`

    if (selectedMonth > today) {
      console.warn(
        `[WARNING] Selected month ${month} is in the future. Using current month instead.`,
      )
      month = currentMonth
    }

    set({ isMonthlyLoading: true, monthlyError: null })
    try {
      const response = await nutritionApi.getMonthlyReport(
        month,
        lineUserId,
        idToken,
      )

      if (!response.success) {
        throw new Error(response.error || 'ไม่สามารถดึงข้อมูลรายเดือนได้')
      }

      set({
        monthlyData: response.data as MonthlyNutritionData,
        isMonthlyLoading: false,
        selectedMonth: month,
      })
    } catch (error) {
      console.error('Failed to fetch monthly report:', error)
      let errorMessage = 'ไม่สามารถโหลดข้อมูลรายเดือนได้'
      if (error instanceof Error) {
        errorMessage = error.message
      }
      set({
        monthlyError: errorMessage,
        isMonthlyLoading: false,
      })
    }
  },

  updateFoodItem: async (
    mealId,
    updatedFoodItem: SharedFoodItemOriginal,
    lineUserId,
    idToken,
  ) => {
    try {
      // เรียกใช้ API จริง
      const response = await nutritionApi.updateFoodItem(
        mealId,
        updatedFoodItem,
        lineUserId,
        idToken,
      )

      if (!response.success) {
        throw new Error(response.error || 'ไม่สามารถอัพเดทข้อมูลได้')
      }

      // หลังจาก API call สำเร็จ ดึงข้อมูลใหม่
      await get().fetchDailyReport(get().selectedDate, lineUserId, idToken)

      return true // Indicate success
    } catch (error) {
      console.error('Failed to update food item:', error)
      // Consider providing more specific feedback to the user based on the error
      return false // Indicate failure
    }
  },

  deleteFoodItem: async (mealId, foodItemId, lineUserId, idToken) => {
    try {
      // เรียกใช้ API จริง
      const response = await nutritionApi.deleteFoodItem(
        mealId,
        foodItemId,
        lineUserId,
        idToken,
      )

      if (!response.success) {
        throw new Error(response.error || 'ไม่สามารถลบข้อมูลได้')
      }

      // หลังจาก API call สำเร็จ ดึงข้อมูลใหม่
      await get().fetchDailyReport(get().selectedDate, lineUserId, idToken)

      return true // Indicate success
    } catch (error) {
      console.error('Failed to delete food item:', error)
      // Consider providing more specific feedback to the user
      return false // Indicate failure
    }
  },

  fetchFoodLogByIdForLiff: async (logId, lineUserId, idToken) => {
    set({ isDailyLoading: true, dailyError: null, currentLiffFoodLog: null })
    try {
      const response = await nutritionApi.getFoodLogById(
        logId,
        lineUserId,
        idToken,
      )

      if (!response.success || !response.data) {
        // ถ้า response.error มีค่า ให้ใช้ค่านั้น, มิฉะนั้นใช้ default message
        const backendError =
          response.error || 'ไม่สามารถดึงข้อมูล Food Log เฉพาะรายการได้'
        throw new Error(backendError)
      }

      // The data from response should already be FoodLogResponseDto if api.service is typed correctly
      const foodLog: FoodLogResponseDto = response.data
      set({ currentLiffFoodLog: foodLog, isDailyLoading: false })

      if (foodLog.logDate) {
        const logDateStr = new Date(foodLog.logDate).toISOString().split('T')[0]
        if (get().selectedDate !== logDateStr) {
          set({ selectedDate: logDateStr })
        }
      }
    } catch (error) {
      // error is now typed based on what getFoodLogById might throw (Error) or return (ApiResponse with error string)
      console.error(`Failed to fetch FoodLog by ID ${logId}:`, error)
      let errorMessage = 'Failed to fetch specific food log'
      if (error instanceof Error) {
        errorMessage = error.message // This will now correctly get the message from Error instances (including backendError from above)
      }
      // Removed the more complex error.response.data.message checking
      // as nutritionApi.getFoodLogById already structures the error message.
      set({
        dailyError: errorMessage,
        isDailyLoading: false,
      })
    }
  },

  updateLiffFoodLog: async (logId, foodLogData, lineUserId, idToken) => {
    set({ isDailyLoading: true, dailyError: null }) // Indicate loading
    try {
      const response = await nutritionApi.updateFoodLog(
        logId,
        foodLogData,
        lineUserId,
        idToken,
      )

      if (!response.success || !response.data) {
        const backendError = response.error || 'ไม่สามารถอัปเดต Food Log ได้'
        throw new Error(backendError)
      }

      const updatedFoodLog: FoodLogResponseDto = response.data
      set({
        currentLiffFoodLog: updatedFoodLog,
        isDailyLoading: false,
      })

      // Optionally, refresh dailyData if the updated log belongs to the currently selectedDate
      if (get().selectedDate === updatedFoodLog.logDate) {
        await get().fetchDailyReport(get().selectedDate, lineUserId, idToken)
      }

      return true
    } catch (error) {
      console.error(`Failed to update FoodLog by ID ${logId}:`, error)
      let errorMessage = 'Failed to update food log'
      if (error instanceof Error) {
        errorMessage = error.message
      }
      set({
        dailyError: errorMessage,
        isDailyLoading: false,
      })
      return false
    }
  },

  // เพิ่ม action สำหรับ set current LIFF food log
  setCurrentLiffFoodLog: (foodLog) => set({ currentLiffFoodLog: foodLog }),

  // เพิ่ม action สำหรับ reset error states
  resetErrors: () =>
    set({
      dailyError: null,
      isDailyLoading: false,
      weeklyError: null,
      isWeeklyLoading: false,
      monthlyError: null,
      isMonthlyLoading: false,
    }),
}))

// Example of how to get LIFF profile and use it (outside the store, in a component)
// import liff from '@line/liff';
// const profile = await liff.getProfile();
// const userId = profile.userId;
// const idToken = liff.getIDToken();
// useNutritionStore.getState().fetchDailyReport(selectedDate, userId, idToken);
