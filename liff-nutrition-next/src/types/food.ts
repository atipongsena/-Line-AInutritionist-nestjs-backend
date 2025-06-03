// Food and Nutrition Type Definitions for LIFF App

export interface NutritionData {
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber?: number
  sugar?: number
  sodium?: number
  cholesterol?: number
  saturated_fat?: number
  trans_fat?: number
  polyunsaturated_fat?: number
  monounsaturated_fat?: number
  water?: number
  omega3?: number
  potassium_nutrient?: number
}

export interface NutrientGoalData {
  consumed: number
  goal: number
  unit?: string
}

export interface MicronutrientData {
  value: number
  unit: string
  dv?: number // Daily Value percentage
  goal?: number // Target goal
  consumed?: number
}

export interface MicronutrientsMap {
  [key: string]: MicronutrientData
}

export interface FoodName {
  th: string
  en?: string
}

export interface ServingInfo {
  size: number
  unit: string
  weight?: number
}

export interface FoodItem {
  _id?: string
  name: FoodName
  serving?: ServingInfo
  nutrition: NutritionData
  micronutrients?: MicronutrientsMap
  imageUrl?: string
  imageAlt?: string
  food?: FoodLog
}

export interface FoodLog {
  foodName: FoodName
  amount: number
  unit: string
  portion?: string
  nutrition: NutritionData
  micronutrients?: MicronutrientsMap
}

export interface MealEntry {
  id: string
  foodId: string
  foodName: string
  amount: number
  unit: string
  calories: number
  timestamp: Date
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  totalCalories?: number
}

export interface MealData {
  id?: string
  name?: string
  mealType: string
  foodItems: any[]
  totalCalories: number
}

export interface NutritionSummary {
  totalCalories: number
  totalProtein: number
  totalCarbs: number
  totalFat: number
  totalFiber?: number
  totalSugar?: number
  totalSodium?: number
}

export interface DailyMealPlan {
  date: string
  meals: {
    breakfast: MealEntry[]
    lunch: MealEntry[]
    dinner: MealEntry[]
    snack: MealEntry[]
  }
  nutritionSummary: NutritionSummary
}

export interface FoodLogEntry {
  id: string
  userId: string
  date: string
  mealType: string
  foodItem: FoodItem
  amount: number
  unit: string
  imageUrl?: string
  imageAlt?: string
  notes?: string
  createdAt: Date
  updatedAt: Date
  logDate?: string
}

// Additional types needed by the application
export interface LiffFoodLogData {
  id: string
  userId: string
  date: string
  meals: MealData[]
  totalNutrition: NutritionData
  imageUrl?: string
  imageAlt?: string
  createdAt: Date
  updatedAt: Date
  food?: FoodLog
  mealType?: string
  logDate?: string
  source?: string
  metadata?: {
    notes?: string
  }
}

export interface DailyNutritionData {
  date: string
  totalCalories: number
  totalProtein: number
  totalCarbs: number
  totalFat: number
  totalFiber?: number
  totalSugar?: number
  totalSodium?: number
  meals: MealData[]
  micronutrients?: MicronutrientsMap
  totalFoodItems?: number
  averageCaloriesPerMeal?: number

  // Additional nested data structure
  calories: NutrientGoalData
  macronutrients: {
    protein: NutrientGoalData
    carbs: NutrientGoalData
    fat: NutrientGoalData
  }
  otherNutrients?: {
    fiber?: NutrientGoalData
    sugar?: NutrientGoalData
    sodium?: NutrientGoalData
    water?: NutrientGoalData
    cholesterol?: NutrientGoalData
    saturated_fat?: NutrientGoalData
    trans_fat?: NutrientGoalData
    polyunsaturated_fat?: NutrientGoalData
    monounsaturated_fat?: NutrientGoalData
    omega3?: NutrientGoalData
    potassium_nutrient?: NutrientGoalData
    caffeine?: NutrientGoalData
    alcohol?: NutrientGoalData
  }
}

export interface DailyReportResponse {
  success: boolean
  data: DailyNutritionData
  error?: string
}

export interface LiffFoodLogResponse {
  success: boolean
  data: LiffFoodLogData[]
  error?: string
}

export interface MacroProfile {
  calories: number
  protein: NutrientGoalData
  carbs: NutrientGoalData
  fat: NutrientGoalData
}

export interface WeeklyMacronutrients {
  protein?: NutrientGoalData
  carbs?: NutrientGoalData
  fat?: NutrientGoalData
}

export interface WeeklyData {
  start: string // YYYY-MM-DD
  end: string // YYYY-MM-DD
  avgCaloriesGoal?: number // Goal for average daily calories over the week
  avgCaloriesPerDay?: number // Actual average daily calories consumed over the week
  totalCaloriesWeek?: number // Total calories consumed over the week
  avgMacronutrients: WeeklyMacronutrients
  dailyCalories: Array<{
    day: string // e.g., 'Mon', 'Tue' or day number/name for chart
    calories: number
  }>
  summary?: string
  tip?: string
  insights?: string[]
  // Add any other fields that WeeklyReportView might expect from API response.data
}

export interface MonthlyData {
  month: string // YYYY-MM
  avgCaloriesGoal?: number // Goal for average daily calories over the month
  avgCaloriesPerDay?: number // Actual average daily calories consumed over the month
  totalCaloriesMonth?: number // Total calories consumed over the month
  avgMacronutrients: WeeklyMacronutrients // Reuses the same macronutrient structure
  calorieTrend: Array<{
    day: number // Day of the month (1-31)
    calories: number
  }>
  insights?: string[]
  // Add any other fields that MonthlyReportView might expect from API response.data
}

export interface FoodLogUpdate {
  id: string
  nutrition: NutritionData
  micronutrients?: MicronutrientsMap
}

// แก้ไข FoodLogUpdatePayload ให้มี properties ครบ
export interface FoodLogUpdatePayload {
  id: string
  data: Partial<LiffFoodLogData>
  foodName?: FoodName
  amount?: number
  unit?: string
  portion?: string
  nutrition?: NutritionData
  micronutrients?: MicronutrientsMap
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
}

// Export types that might be needed by other modules
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export type NutrientType =
  | 'calories'
  | 'protein'
  | 'carbs'
  | 'fat'
  | 'fiber'
  | 'sugar'
  | 'sodium'
