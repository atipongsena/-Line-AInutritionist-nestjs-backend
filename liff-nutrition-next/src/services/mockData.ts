// Mock Data Service
import { DailyReportResponse } from '../types/food'

export const getMockDailyReport = (date: string): DailyReportResponse => {
  return {
    success: true,
    data: {
      date,
      totalCalories: 850,
      targetCalories: 2418,
      totalProtein: 40.0,
      totalCarbs: 120.0,
      totalFat: 24.0,
      macronutrients: {
        protein: { consumed: 40.0, goal: 151.0, unit: 'g' },
        carbs: { consumed: 120.0, goal: 302.0, unit: 'g' },
        fat: { consumed: 24.0, goal: 67.0, unit: 'g' },
      },
      calories: { consumed: 850, goal: 2418, unit: 'kcal' },
      macros: {
        protein: { current: 40.0, target: 151.0, percentage: 26 },
        carbs: { current: 120.0, target: 302.0, percentage: 40 },
        fat: { current: 24.0, target: 67.0, percentage: 36 },
      },
      meals: [
        {
          id: 'lunch-1',
          name: 'lunch',
          mealType: 'lunch',
          foodItems: [],
          totalCalories: 850,
          calories: 850,
          protein: 40.0,
          carbs: 120.0,
          fat: 24.0,
          timestamp: new Date().toISOString(),
        },
      ],
      weeklyTrend: [],
      recommendations: [
        'ลำเหลือนาครั้งบนวิเ',
        'อยากินลสีพิทิทำลาย น่าจอย 8-10 แก้วต่อวัน',
      ],
      micronutrients: {},
      otherNutrients: {
        fiber: { consumed: 5, goal: 25, unit: 'g' },
        sugar: { consumed: 20, goal: 50, unit: 'g' },
        sodium: { consumed: 1200, goal: 2300, unit: 'mg' },
      },
    },
  }
}
