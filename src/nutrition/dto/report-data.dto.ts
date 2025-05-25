import { FoodItem as SharedFoodItemOriginal } from '@ai-nutritionist/shared-types'

// Interface for micronutrient details that includes an optional goal
// Matching liff-profile-app/src/nutrition-report/stores/nutritionStore.ts
export interface MicronutrientDetailWithGoal {
  value: number // Represents consumed value
  unit: string
  dv?: number
  goal?: number // Optional goal
}

// Interface for a single meal within a daily report
// Matching liff-profile-app/src/nutrition-report/stores/nutritionStore.ts
export interface MealDto {
  id: string // foodLogId from backend
  name: string // Meal type (e.g., "breakfast", "lunch") or custom name
  totalCalories: number
  foodItems: SharedFoodItemOriginal[] // Array of detailed food items
}

// New interface for individual nutrient details with a goal
export interface NutrientDetailWithGoal {
  consumed: number
  goal?: number // Optional, as not all nutrients might have a defined goal from user settings
  unit: string
}

// DTO for Daily Nutrition Report Data
// Matching liff-profile-app/src/nutrition-report/stores/nutritionStore.ts
export class DailyReportResponseDto {
  date: string // YYYY-MM-DD
  calories: {
    consumed: number
    goal: number
  }
  macronutrients: {
    protein: NutrientDetailWithGoal
    carbs: NutrientDetailWithGoal
    fat: NutrientDetailWithGoal
  }
  // New field for other nutrients like fiber, sugar, sodium
  otherNutrients?: {
    fiber?: NutrientDetailWithGoal
    sugar?: NutrientDetailWithGoal // Typically a max limit
    sodium?: NutrientDetailWithGoal // Typically a max limit
    cholesterol?: NutrientDetailWithGoal // Typically a max limit
    saturated_fat?: NutrientDetailWithGoal // Typically a max limit
    omega3?: NutrientDetailWithGoal
    water?: NutrientDetailWithGoal // Typically a min target
    // Add more as needed based on NutritionGoal schema and what frontend needs
  }
  micronutrients?: {
    [key: string]: MicronutrientDetailWithGoal
  }
  meals: MealDto[]
}

// DTO for Weekly Nutrition Report Data
// Matching liff-profile-app/src/nutrition-report/stores/nutritionStore.ts
export class WeeklyReportResponseDto {
  weekStartDate: string // YYYY-MM-DD
  weekEndDate: string // YYYY-MM-DD
  avgCalories: number
  avgCaloriesGoal?: number // เพิ่ม goal สำหรับ calories
  dailyCalories: Array<{
    day: string // e.g., "Mon", "Tue" or full date
    calories: number
  }>
  avgMacronutrients: {
    protein: NutrientDetailWithGoal
    carbs: NutrientDetailWithGoal
    fat: NutrientDetailWithGoal
  }
  summary: string // AI-generated summary
  tip: string // AI-generated tip
}

// DTO for Monthly Nutrition Report Data
// Matching liff-profile-app/src/nutrition-report/stores/nutritionStore.ts
export class MonthlyReportResponseDto {
  month: string // YYYY-MM
  avgCaloriesPerDay: number
  avgCaloriesGoal?: number // เพิ่ม goal สำหรับ calories
  totalCaloriesMonth: number
  calorieTrend: Array<{
    day: number // Day of the month (1-31)
    calories: number
  }>
  avgMacronutrients?: {
    protein: NutrientDetailWithGoal
    carbs: NutrientDetailWithGoal
    fat: NutrientDetailWithGoal
  }
  summary: string // AI-generated summary
  insights: string[] // AI-generated insights
}
