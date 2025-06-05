import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import {
  DailyNutritionData as ImportedDailyNutritionData,
  WeeklyData,
  MonthlyData,
  FoodItem,
  MicronutrientsMap,
  LiffFoodLogData as ImportedLiffFoodLogData,
  FoodLog,
  MealData,
  NutritionData,
  FoodName,
  FoodLogUpdatePayload,
  MacroProfile,
} from '../types/food'
import { ApiService } from '../services/api.service'

// Exporting these types for use in other components
export type DailyNutritionData = ImportedDailyNutritionData
export type LiffFoodLogData = ImportedLiffFoodLogData
export type { MicronutrientsMap }

// Update and payload types
export interface UpdateFoodLogPayload {
  mealType?: string
  imageUrl?: string
  imageAlt?: string
  food?: FoodLog
  insights?: string[]
}

export interface UpdateVitaminMineralDetailPayload {
  vitamins: MicronutrientsMap
  minerals: MicronutrientsMap
}

// Weekly and Monthly data interfaces
// export interface WeeklyNutritionData {  // <--- REMOVING THIS BLOCK
//   start: string // YYYY-MM-DD (start of week)
//   end: string // YYYY-MM-DD (end of week)
//   avgCalories: number
//   avgCaloriesGoal: number
//   avgMacronutrients: MacroProfile
//   dailyCalories: Array<{
//     day: string
//     calories: number
//     goal?: number
//   }>
//   insights?: string[]
// }

export interface MonthlyNutritionData {
  month: string // YYYY-MM
  avgCaloriesPerDay: number
  totalCaloriesMonth: number
  avgCaloriesGoal: number
  avgMacronutrients: MacroProfile
  calorieTrend: Array<{
    day: number
    calories: number
  }>
  insights?: string[]
}

export interface SelectedWeek {
  start: string
  end: string
}

// Store interface
interface NutritionStore {
  // Daily data
  selectedDate: string
  dailyData: DailyNutritionData | null
  isDailyLoading: boolean
  dailyError: string | null
  currentLiffFoodLog: LiffFoodLogData | null

  // Weekly data
  selectedWeek: SelectedWeek | null
  weeklyData: WeeklyData | null
  isWeeklyLoading: boolean
  weeklyError: string | null

  // Monthly data
  selectedMonth: string | null // YYYY-MM
  monthlyData: MonthlyData | null
  isMonthlyLoading: boolean
  monthlyError: string | null

  // UI state
  refreshCounter: number

  // Actions
  setSelectedDate: (date: string) => void
  setDailyData: (data: DailyNutritionData | null) => void
  setDailyLoading: (loading: boolean) => void
  setDailyError: (error: string | null) => void
  setCurrentLiffFoodLog: (log: LiffFoodLogData | null) => void

  setSelectedWeek: (weekStart: string) => void
  setWeeklyData: (data: WeeklyData | null) => void
  setWeeklyLoading: (loading: boolean) => void
  setWeeklyError: (error: string | null) => void

  setSelectedMonth: (month: string) => void
  setMonthlyData: (data: MonthlyData | null) => void
  setMonthlyLoading: (loading: boolean) => void
  setMonthlyError: (error: string | null) => void

  setRefreshCounter: (updater: (prev: number) => number) => void

  // Fetch functions (will call API)
  fetchDailyReport: (
    date: string,
    userId: string,
    token: string,
  ) => Promise<void>
  fetchWeeklyReport: (
    weekStart: string,
    userId: string,
    token: string,
  ) => Promise<void>
  fetchMonthlyReport: (
    month: string,
    userId: string,
    token: string,
  ) => Promise<void>
  fetchLiffFoodLog: (
    logId: string,
    userId: string,
    token: string,
  ) => Promise<void>

  // Reset functions
  resetDaily: () => void
  resetWeekly: () => void
  resetMonthly: () => void
  resetAll: () => void

  // Placeholder/Mock functions for API interactions that might be in a service
  // These would typically call an API service and then update the store state
  updateFoodItem: (
    foodLogId: string,
    item: FoodItem,
    userId: string,
    token: string,
  ) => Promise<boolean>

  deleteFoodItem: (
    foodLogId: string,
    itemId: string,
    userId: string,
    token: string,
  ) => Promise<boolean>

  updateLiffFoodLog: (
    logId: string,
    data: UpdateFoodLogPayload,
    userId: string,
    token: string,
  ) => Promise<boolean>
}

const apiService = new ApiService()

// ✅ Helper function สำหรับแปลง mealType จากภาษาไทยเป็นภาษาอังกฤษ
const mapMealTypeToEnglish = (mealType: string): string => {
  const mapping: Record<string, string> = {
    อาหารเช้า: 'breakfast',
    อาหารกลางวัน: 'lunch',
    อาหารเย็น: 'dinner',
    ขนมหวาน: 'snack',
    อื่นๆ: 'other',
    breakfast: 'breakfast',
    lunch: 'lunch',
    dinner: 'dinner',
    snack: 'snack',
    other: 'other',
  }
  return mapping[mealType] || 'other'
}

// Zustand store
export const useNutritionStore = create<NutritionStore>((set, get) => ({
  // Initial state
  selectedDate: new Date().toISOString().split('T')[0],
  dailyData: null,
  isDailyLoading: false,
  dailyError: null,
  currentLiffFoodLog: null,

  selectedWeek: null,
  weeklyData: null,
  isWeeklyLoading: false,
  weeklyError: null,

  selectedMonth: null,
  monthlyData: null,
  isMonthlyLoading: false,
  monthlyError: null,

  // UI state
  refreshCounter: 0,

  // Setters
  setSelectedDate: (date) => set({ selectedDate: date }),
  setDailyData: (data) => set({ dailyData: data }),
  setDailyLoading: (loading) => set({ isDailyLoading: loading }),
  setDailyError: (error) => set({ dailyError: error }),
  setCurrentLiffFoodLog: (log) => set({ currentLiffFoodLog: log }),

  setSelectedWeek: (weekStart) => {
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)
    set({
      selectedWeek: {
        start: weekStart,
        end: weekEnd.toISOString().split('T')[0],
      },
    })
  },
  setWeeklyData: (data) => set({ weeklyData: data }),
  setWeeklyLoading: (loading) => set({ isWeeklyLoading: loading }),
  setWeeklyError: (error) => set({ weeklyError: error }),

  setSelectedMonth: (month) => set({ selectedMonth: month }),
  setMonthlyData: (data) => set({ monthlyData: data }),
  setMonthlyLoading: (loading) => set({ isMonthlyLoading: loading }),
  setMonthlyError: (error) => set({ monthlyError: error }),

  setRefreshCounter: (updater) =>
    set({ refreshCounter: updater(get().refreshCounter) }),

  // Fetch functions - Real API implementations
  fetchDailyReport: async (date, userId, token) => {
    set({ isDailyLoading: true, dailyError: null })

    console.log(
      `[NutritionStore] Fetching daily report for ${date}, userId: ${userId}`,
    )

    try {
      // ✅ เรียก real API ก่อน
      const response = await apiService.getDailyReport(date, userId, token)

      if (response.success && response.data) {
        console.log(`[NutritionStore] Real API data received:`, response.data)
        set({
          dailyData: response.data,
          isDailyLoading: false,
          dailyError: null,
        })
        return
      } else {
        throw new Error(response.error || 'Failed to fetch daily report')
      }
    } catch (error: any) {
      console.error(`[NutritionStore] API call failed:`, error)

      // ✅ ใช้ fallback data เฉพาะเมื่อ API ล้มเหลว
      console.log(`[NutritionStore] Using fallback data due to API failure`)

      const fallbackData: DailyNutritionData = {
        date: date,
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
      }

      set({
        dailyData: fallbackData,
        isDailyLoading: false,
        dailyError: `API Error: ${error.message}. Using offline mode.`,
      })
    }
  },

  fetchWeeklyReport: async (weekStart, userId, token) => {
    set({ isWeeklyLoading: true, weeklyError: null })
    try {
      console.log(
        `[NutritionStore] Fetching weekly report for week starting ${weekStart}...`,
      )
      const response = await apiService.getWeeklyReport(
        weekStart,
        userId,
        token,
      )

      console.log(`[NutritionStore] Raw weekly response:`, response)

      if (
        response &&
        typeof response === 'object' &&
        response.success &&
        response.data
      ) {
        const apiData = response.data as any // Access the nested .data object

        // Manual mapping from API response to WeeklyData structure
        const mappedData: WeeklyData = {
          start: apiData.weekStartDate || weekStart,
          end:
            apiData.weekEndDate ||
            new Date(new Date(weekStart).getTime() + 6 * 24 * 60 * 60 * 1000)
              .toISOString()
              .split('T')[0],
          avgCaloriesPerDay:
            typeof apiData.avgCalories === 'number' ? apiData.avgCalories : 0,
          avgCaloriesGoal:
            typeof apiData.avgCaloriesGoal === 'number'
              ? apiData.avgCaloriesGoal
              : 0,
          dailyCalories:
            Array.isArray(apiData.dailyCalories) &&
            apiData.dailyCalories.length > 0
              ? apiData.dailyCalories
              : [],
          avgMacronutrients: apiData.avgMacronutrients || {
            protein: { consumed: 0, goal: 0, unit: 'g' }, // Added unit for consistency
            carbs: { consumed: 0, goal: 0, unit: 'g' }, // Added unit
            fat: { consumed: 0, goal: 0, unit: 'g' }, // Added unit
          },
          totalCaloriesWeek:
            Array.isArray(apiData.dailyCalories) &&
            apiData.dailyCalories.length > 0
              ? apiData.dailyCalories.reduce(
                  (sum: number, day: { calories?: number }) =>
                    sum + (day.calories || 0),
                  0,
                )
              : 0,
          summary: apiData.summary || '',
          tip: apiData.tip || '',
          insights: Array.isArray(apiData.insights) ? apiData.insights : [],
        }

        set({
          weeklyData: mappedData,
          isWeeklyLoading: false,
        })
        console.log(
          `[NutritionStore] Weekly report loaded and mapped successfully:`,
          mappedData,
        )
      } else {
        console.log(
          `[NutritionStore] No valid weekly data from API, using fallback.`,
        )
        const fallbackData: WeeklyData = {
          start: weekStart,
          end: new Date(new Date(weekStart).getTime() + 6 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0],
          avgCaloriesGoal: 2445, // Default or from user profile if available
          avgCaloriesPerDay: 0,
          totalCaloriesWeek: 0,
          avgMacronutrients: {
            protein: { consumed: 0, goal: 183 },
            carbs: { consumed: 0, goal: 287 },
            fat: { consumed: 0, goal: 62 },
          },
          dailyCalories: [],
          insights: ['ข้อมูลไม่พร้อมใช้งาน โปรดลองอีกครั้งในภายหลัง'],
          summary: '',
          tip: '',
        }
        set({
          weeklyData: fallbackData,
          isWeeklyLoading: false,
          weeklyError: 'No data from API',
        })
      }
    } catch (error) {
      console.error(`[NutritionStore] Error fetching weekly report:`, error)
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Unknown error fetching weekly report'
      // Consider setting a more structured error or specific fallback for auth errors
      if (error instanceof Error && error.message.startsWith('AUTH_FAILED')) {
        console.warn(
          `[NutritionStore] Weekly authentication failed, using fallback data for demo`,
        )
        const fallbackData: WeeklyData = {
          start: weekStart,
          end: new Date(new Date(weekStart).getTime() + 6 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0],
          avgCaloriesGoal: 2445,
          avgCaloriesPerDay: 0,
          totalCaloriesWeek: 0,
          avgMacronutrients: {
            protein: { consumed: 95, goal: 183 }, // Example values
            carbs: { consumed: 220, goal: 287 },
            fat: { consumed: 65, goal: 62 },
          },
          dailyCalories: [],
          insights: ['การยืนยันตัวตนล้มเหลว ไม่สามารถโหลดข้อมูลได้'],
          summary: '',
          tip: '',
        }
        set({
          weeklyData: fallbackData,
          isWeeklyLoading: false,
          weeklyError: 'Authentication Failed',
        })
        return
      }
      set({
        weeklyError: errorMessage,
        weeklyData: null,
        isWeeklyLoading: false,
      })
    }
  },

  fetchMonthlyReport: async (month, userId, token) => {
    set({ isMonthlyLoading: true, monthlyError: null })
    try {
      console.log(`[NutritionStore] Fetching monthly report for ${month}...`)
      const response = await apiService.getMonthlyReport(month, userId, token)

      console.log(`[NutritionStore] Raw monthly response:`, response)

      // ✅ Handle different response structures
      let monthlyData: MonthlyData | null = null

      if (response && typeof response === 'object') {
        const anyResponse = response as any

        // Case 1: Direct data response
        if (
          anyResponse.month ||
          anyResponse.avgCaloriesPerDay ||
          anyResponse.calorieTrend
        ) {
          monthlyData = anyResponse as MonthlyData
        }
        // Case 2: Wrapped response with success/data structure
        else if (
          'success' in response &&
          response.success &&
          'data' in response
        ) {
          monthlyData = (response as any).data as MonthlyData
        }
        // Case 3: Wrapped response without success flag but has data
        else if ('data' in anyResponse && anyResponse.data) {
          monthlyData = anyResponse.data as MonthlyData
        }
      }

      if (monthlyData) {
        set({
          monthlyData: monthlyData,
          isMonthlyLoading: false,
        })
        console.log(
          `[NutritionStore] Monthly report loaded successfully:`,
          monthlyData,
        )
      } else {
        // ✅ สร้าง fallback data สำหรับ demo
        console.log(
          `[NutritionStore] No valid monthly data, creating fallback data...`,
        )

        // ✅ จัดการ AUTH_FAILED error สำหรับ Monthly Report
        if (Error instanceof Error && Error.message.startsWith('AUTH_FAILED')) {
          console.warn(
            `[NutritionStore] Monthly authentication failed, using fallback data for demo`,
          )

          // สร้างข้อมูลแคลอรี่สำหรับ 30 วัน
          const calorieTrend = Array.from({ length: 30 }, (_, i) => ({
            day: i + 1,
            calories: Math.floor(Math.random() * 800) + 1600, // 1600-2400 calories
          }))

          const totalCalories = calorieTrend.reduce(
            (sum, day) => sum + day.calories,
            0,
          )
          const avgCaloriesPerDay = totalCalories / 30

          const fallbackData: MonthlyData = {
            month: month,
            avgCaloriesGoal: 2445,
            avgCaloriesPerDay: avgCaloriesPerDay,
            totalCaloriesMonth: totalCalories,
            avgMacronutrients: {
              protein: { consumed: 95, goal: 183 },
              carbs: { consumed: 220, goal: 287 },
              fat: { consumed: 65, goal: 62 },
            },
            calorieTrend: calorieTrend,
            insights: [
              'คุณมีพฤติกรรมการกินที่สม่ำเสมอในเดือนนี้',
              'ควรเพิ่มการออกกำลังกายในวันที่กินเยอะ',
              'การบริโภคผักและผลไม้ยังไม่เพียงพอ',
            ],
          }

          set({
            monthlyData: fallbackData,
            isMonthlyLoading: false,
            monthlyError: null,
          })
          console.log(`[NutritionStore] Using fallback monthly data for demo`)
        }

        const errorMessage =
          Error instanceof Error
            ? Error.message
            : 'Unknown error fetching monthly report'
        set({
          monthlyError: errorMessage,
          monthlyData: null,
          isMonthlyLoading: false,
        })
        console.error(`[NutritionStore] Error fetching monthly report:`, Error)
      }
    } catch (error) {
      // ✅ จัดการ AUTH_FAILED error สำหรับ Monthly Report
      if (error instanceof Error && error.message.startsWith('AUTH_FAILED')) {
        console.warn(
          `[NutritionStore] Monthly authentication failed, using fallback data for demo`,
        )

        // สร้างข้อมูลแคลอรี่สำหรับ 30 วัน
        const calorieTrend = Array.from({ length: 30 }, (_, i) => ({
          day: i + 1,
          calories: Math.floor(Math.random() * 800) + 1600, // 1600-2400 calories
        }))

        const totalCalories = calorieTrend.reduce(
          (sum, day) => sum + day.calories,
          0,
        )
        const avgCaloriesPerDay = totalCalories / 30

        const fallbackData: MonthlyData = {
          month: month,
          avgCaloriesGoal: 2445,
          avgCaloriesPerDay: avgCaloriesPerDay,
          totalCaloriesMonth: totalCalories,
          avgMacronutrients: {
            protein: { consumed: 95, goal: 183 },
            carbs: { consumed: 220, goal: 287 },
            fat: { consumed: 65, goal: 62 },
          },
          calorieTrend: calorieTrend,
          insights: [
            'คุณมีพฤติกรรมการกินที่สม่ำเสมอในเดือนนี้',
            'ควรเพิ่มการออกกำลังกายในวันที่กินเยอะ',
            'การบริโภคผักและผลไม้ยังไม่เพียงพอ',
          ],
        }

        set({
          monthlyData: fallbackData,
          isMonthlyLoading: false,
          monthlyError: null,
        })
        return // ✅ ใช้ fallback data แทนการ throw error
      }

      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Unknown error fetching monthly report'
      set({
        monthlyError: errorMessage,
        monthlyData: null,
        isMonthlyLoading: false,
      })
      console.error(`[NutritionStore] Error fetching monthly report:`, error)
    }
  },

  fetchLiffFoodLog: async (logId, userId, token) => {
    set({ isDailyLoading: true, dailyError: null })
    try {
      console.log(`[NutritionStore] Fetching LIFF food log for ${logId}...`)

      // ✅ ป้องกันการส่ง report types เป็น logId ไปยัง backend
      if (
        logId === 'demo' ||
        logId === 'daily' ||
        logId === 'weekly' ||
        logId === 'monthly'
      ) {
        console.log(`[NutritionStore] Using recent food logs for ${logId}`)
        const response = await apiService.getRecentFoodLogs(
          userId,
          token,
          1,
          10,
        )

        if (response && response.length > 0) {
          // ใช้ log แรกหรือสร้าง demo data
          const demoLog = {
            id: logId,
            userId: userId,
            date: new Date().toISOString().split('T')[0],
            logDate: new Date().toISOString().split('T')[0],
            mealType: 'อาหารเช้า',
            imageUrl: '/demo-food.jpg',
            imageAlt: 'ข้าวผัดกุ้ง',
            meals: [
              {
                mealType: 'อาหารเช้า',
                foodItems: [],
                totalCalories: 450,
              },
            ],
            totalNutrition: {
              calories: 450,
              protein: 18,
              carbs: 65,
              fat: 12,
              fiber: 2,
              sugar: 3,
              sodium: 800,
            },
            createdAt: new Date(),
            updatedAt: new Date(),
            food: {
              foodName: { th: 'ข้าวผัดกุ้ง', en: 'Shrimp Fried Rice' },
              amount: 1,
              unit: 'จาน',
              portion: 'จานกลาง',
              nutrition: {
                calories: 450,
                protein: 18,
                carbs: 65,
                fat: 12,
                fiber: 2,
                sugar: 3,
                sodium: 800,
              },
            },
          }
          set({ currentLiffFoodLog: demoLog, isDailyLoading: false })
        } else {
          // สร้าง demo data ถ้าไม่มีข้อมูล
          const demoLog = {
            id: logId,
            userId: userId,
            date: new Date().toISOString().split('T')[0],
            logDate: new Date().toISOString().split('T')[0],
            mealType: 'อาหารเช้า',
            imageUrl: '/demo-food.jpg',
            imageAlt: 'ข้าวผัดกุ้ง',
            meals: [
              {
                mealType: 'อาหารเช้า',
                foodItems: [],
                totalCalories: 450,
              },
            ],
            totalNutrition: {
              calories: 450,
              protein: 18,
              carbs: 65,
              fat: 12,
              fiber: 2,
              sugar: 3,
              sodium: 800,
            },
            createdAt: new Date(),
            updatedAt: new Date(),
            food: {
              foodName: { th: 'ข้าวผัดกุ้ง', en: 'Shrimp Fried Rice' },
              amount: 1,
              unit: 'จาน',
              portion: 'จานกลาง',
              nutrition: {
                calories: 450,
                protein: 18,
                carbs: 65,
                fat: 12,
                fiber: 2,
                sugar: 3,
                sodium: 800,
              },
            },
          }
          set({ currentLiffFoodLog: demoLog, isDailyLoading: false })
        }
        return // ✅ return เร็วเพื่อป้องกันการเรียก API จริง
      }

      // ✅ เรียก API จริงสำหรับ logId ที่เป็น ID จริง
      const response = await apiService.getFoodLogById(logId, userId, token)

      if (response.success && response.data) {
        set({ currentLiffFoodLog: response.data, isDailyLoading: false })
        console.log(`[NutritionStore] LIFF food log loaded successfully`)
      } else {
        throw new Error(response.error || 'Failed to fetch LIFF food log data')
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Unknown error fetching LIFF food log'
      set({
        dailyError: errorMessage,
        currentLiffFoodLog: null,
        isDailyLoading: false,
      })
      console.error(`[NutritionStore] Error fetching LIFF food log:`, error)
    }
  },

  // ✅ Real implementations for API-interacting functions
  updateFoodItem: async (foodLogId, item, userId, token) => {
    console.log('[NutritionStore] updateFoodItem called:', {
      foodLogId,
      item, // item is FoodItem from frontend, potentially with rich nutrition data
      userId,
    })

    try {
      // Construct the nutrition object for the backend
      // Backend expects only specific fields in food.nutrition
      const backendNutritionPayload: Partial<NutritionData> = {
        calories: item.nutrition?.calories,
        protein: item.nutrition?.protein,
        carbs: item.nutrition?.carbs,
        fat: item.nutrition?.fat,
        // Add other fields if backend /food-log PUT DTO for nutrition expects them directly
        // e.g., fiber, sugar, sodium if they are part of the backend's NutritionDataDto for this context
      }

      // Remove undefined fields from backendNutritionPayload to keep payload clean
      Object.keys(backendNutritionPayload).forEach(
        (key) =>
          backendNutritionPayload[key as keyof Partial<NutritionData>] ===
            undefined &&
          delete backendNutritionPayload[key as keyof Partial<NutritionData>],
      )

      // Prepare other nutrient data that might be at the root of FoodLog or in separate objects
      // This depends heavily on the backend DTO for PUT /food-log
      // For now, we pass micronutrients as they are.
      // Other nutrients (saturated_fat, cholesterol, etc.) from FOOD_ANALYSIS_SCHEMA
      // are currently missing from this construction if they are not part of item.nutrition
      // or item.micronutrients and backend expects them at root of food or food.otherNutrients.

      const foodDetailsToUpdate: FoodLog = {
        foodName: item.name,
        amount: item.serving?.size || 0,
        unit: item.serving?.unit || '',
        portion: item.food?.portion,
        nutrition: backendNutritionPayload as NutritionData, // Use the filtered nutrition object
        micronutrients: item.micronutrients, // Assuming backend expects micronutrients here
        // If backend expects other nutrients (e.g. saturated_fat, cholesterol) directly under foodDetailsToUpdate:
        // saturated_fat: item.nutrition?.saturated_fat, // Example, adjust based on actual FoodItem structure and backend DTO
        // cholesterol: item.nutrition?.cholesterol,
        // water: item.nutrition?.water,
        // omega3: item.nutrition?.omega3,
        // sodium: item.nutrition?.sodium,
        // fiber: item.nutrition?.fiber,
        // sugar: item.nutrition?.sugar,
      }

      // Clean undefined top-level optional fields from foodDetailsToUpdate
      if (foodDetailsToUpdate.portion === undefined)
        delete foodDetailsToUpdate.portion
      if (foodDetailsToUpdate.micronutrients === undefined)
        delete foodDetailsToUpdate.micronutrients
      // ... and for any other top-level optional fields added above (saturated_fat, etc.)

      const apiUpdatePayload: UpdateFoodLogPayload = {
        food: foodDetailsToUpdate,
      }

      console.log(
        '[NutritionStore] Payload for updateLiffFoodLog (before API call):',
        JSON.stringify(apiUpdatePayload, null, 2),
      )

      const success = await get().updateLiffFoodLog(
        foodLogId,
        apiUpdatePayload,
        userId,
        token,
      )

      if (success) {
        const selectedDate = get().selectedDate
        await get().fetchDailyReport(selectedDate, userId, token)
        console.log('[NutritionStore] Food item updated and data refreshed')
        return true
      }
      return false
    } catch (error) {
      console.error('[NutritionStore] Error updating food item:', error)
      return false
    }
  },

  deleteFoodItem: async (foodLogId, itemId, userId, token) => {
    console.log('[NutritionStore] deleteFoodItem called:', {
      foodLogId,
      itemId,
      userId,
    })

    const { selectedDate, fetchDailyReport } = get() // Get fetchDailyReport from store

    try {
      // ✅ เรียก delete API จริง
      const response = await apiService.deleteFoodLog(foodLogId, userId, token)

      console.log('[NutritionStore] Delete API response:', response)

      // ✅ ปรับปรุง: ตรวจสอบความสำเร็จโดยการพิจารณาหลายกรณี
      // 1. ถ้ามี success field และเป็น true
      // 2. ถ้าไม่มี success field แต่มี response (ถือว่าสำเร็จ)
      // 3. ถ้า success field เป็น false ให้ถือว่าไม่สำเร็จ
      let isSuccess = false

      if (response) {
        if ('success' in response) {
          // มี success field
          isSuccess = response.success === true
        } else {
          // ไม่มี success field แต่ได้ response กลับมา ถือว่าสำเร็จ
          isSuccess = true
        }
      }

      if (isSuccess) {
        console.log(
          '[NutritionStore] ✅ Food item deleted successfully from API',
        )

        // ✅ Refresh daily report เพื่อให้ข้อมูลล่าสุด
        //    รอให้ fetchDailyReport ทำงานเสร็จก่อน
        await fetchDailyReport(selectedDate, userId, token)
        console.log('[NutritionStore] ✅ Daily data refreshed after deletion')
        return true
      } else {
        console.warn(
          '[NutritionStore] ❌ Food item deletion failed at API level:',
          response,
        )
        return false
      }
    } catch (error) {
      console.error('[NutritionStore] ❌ Error deleting food item:', error)

      // ✅ ตรวจสอบ HTTP status code ใน error
      if (error && typeof error === 'object' && 'status' in error) {
        const httpError = error as any
        if (httpError.status === 200 || httpError.status === 204) {
          console.log(
            '[NutritionStore] ✅ Delete succeeded despite catch (HTTP 200/204)',
          )
          // ถ้า HTTP status เป็น 200 หรือ 204 แสดงว่าสำเร็จ
          await fetchDailyReport(selectedDate, userId, token)
          console.log(
            '[NutritionStore] ✅ Daily data refreshed after deletion (from catch)',
          )
          return true
        }
      }

      return false
    }
  },

  updateLiffFoodLog: async (logId, data, userId, token) => {
    // 'data' here is UpdateFoodLogPayload from this store, prepared by updateFoodItem or LIFF form
    console.log('[NutritionStore] updateLiffFoodLog (API call) called:', {
      logId,
      data, // This is UpdateFoodLogPayload { food?: FoodLog, mealType?: string ... }
      userId,
    })

    try {
      if (!logId || typeof logId !== 'string' || logId.length !== 24) {
        console.error(
          '[NutritionStore] Invalid logId format for update:',
          logId,
        )
        return false
      }

      const payloadForApiService: any = { ...data }
      if (data.mealType) {
        payloadForApiService.mealType = mapMealTypeToEnglish(data.mealType)
      }

      // Clean undefined or empty objects (especially payloadForApiService.food)
      Object.keys(payloadForApiService).forEach((key) => {
        const k = key as keyof UpdateFoodLogPayload // Type assertion
        if (payloadForApiService[k] === undefined) {
          delete payloadForApiService[k]
        }
      })

      if (
        payloadForApiService.food &&
        typeof payloadForApiService.food === 'object'
      ) {
        const foodPayload = payloadForApiService.food as FoodLog // Type assertion
        Object.keys(foodPayload).forEach((foodKey) => {
          const fk = foodKey as keyof FoodLog // Type assertion
          if (foodPayload[fk] === undefined) {
            delete foodPayload[fk]
          }
        })
        if (Object.keys(foodPayload).length === 0) {
          delete payloadForApiService.food
        }
      }

      console.log(
        '[NutritionStore] Final payload for apiService.updateFoodLog:',
        payloadForApiService,
      )

      const response = await apiService.updateFoodLog(
        logId,
        payloadForApiService, // Send the processed payload
        userId,
        token,
      )

      console.log('[NutritionStore] Update response from API:', response)

      if (response && response.success !== false) {
        const updatedData = (response as any)?.data || get().currentLiffFoodLog
        set({ currentLiffFoodLog: updatedData })
        console.log(
          '[NutritionStore] LIFF food log updated successfully (or assumed success for 204)',
        )
        return true
      } else {
        console.error(
          '[NutritionStore] Update failed - API response did not indicate clear success:',
          response,
        )
        return false
      }
    } catch (error) {
      console.error('[NutritionStore] Error updating LIFF food log:', error)

      // ✅ แสดง error ที่ละเอียดขึ้น
      if (error instanceof Error) {
        console.error('[NutritionStore] Error message:', error.message)
        if (error.message.includes('400')) {
          console.error(
            '[NutritionStore] HTTP 400 - Check data structure and validation. Possible causes:',
          )
          console.error(
            '- Invalid mealType (must be: breakfast, lunch, dinner, snack, other)',
          )
          console.error('- Invalid food object structure')
          console.error('- Missing required fields')
          console.error('- Invalid data types (strings vs numbers)')
        }
      }

      return false
    }
  },

  // Reset functions
  resetDaily: () =>
    set({
      dailyData: null,
      isDailyLoading: false,
      dailyError: null,
      currentLiffFoodLog: null,
    }),

  resetWeekly: () =>
    set({
      weeklyData: null,
      isWeeklyLoading: false,
      weeklyError: null,
      selectedWeek: null,
    }),

  resetMonthly: () =>
    set({
      monthlyData: null,
      isMonthlyLoading: false,
      monthlyError: null,
      selectedMonth: null,
    }),

  resetAll: () =>
    set({
      selectedDate: new Date().toISOString().split('T')[0],
      dailyData: null,
      isDailyLoading: false,
      dailyError: null,
      currentLiffFoodLog: null,
      selectedWeek: null,
      weeklyData: null,
      isWeeklyLoading: false,
      weeklyError: null,
      selectedMonth: null,
      monthlyData: null,
      isMonthlyLoading: false,
      monthlyError: null,
    }),
}))
