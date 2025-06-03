// Store re-exports for compatibility with existing imports
export { useNutritionStore } from '../stores/nutritionStore'

// Re-export types for convenience
export type {
  UpdateFoodLogPayload,
  UpdateVitaminMineralDetailPayload,
  MonthlyNutritionData,
} from '../stores/nutritionStore'

// Re-export types from food.ts
export type { WeeklyData, MonthlyData } from '../types/food'
