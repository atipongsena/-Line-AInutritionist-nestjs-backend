import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Schema as MongooseSchema } from 'mongoose'
import { User } from './user.schema' // Import User schema for ref

export type NutritionGoalDocument = NutritionGoal & Document

// Interface for consumed/current nutrient values that methods might receive
interface ConsumedNutrientValues {
  calories?: number
  protein?: number
  carbs?: number
  fat?: number
  fiber?: number
  sugar?: number
  sodium?: number
}

// Interface for detailing progress of a single nutrient
interface NutrientProgressDetail {
  current?: number
  goal?: number
  percentage?: number
}

// Interface for detailing check status of a single nutrient
interface NutrientCheckStatusDetail extends NutrientProgressDetail {
  status?: 'under' | 'met' | 'over'
}

// Sub-schema for Daily Nutrition Goals (these are the GOAL values)
@Schema({ _id: false })
export class DailyNutrientGoals implements ConsumedNutrientValues {
  // Structure matches consumed values for properties
  @Prop({ default: 2000 }) calories: number
  @Prop({ default: 60 }) protein: number
  @Prop({ default: 250 }) carbs: number
  @Prop({ default: 65 }) fat: number
  @Prop({ default: 25 }) fiber?: number
  @Prop({ default: 50 }) sugar?: number
  @Prop({ default: 2300 }) sodium?: number
  @Prop({ default: 2000 }) water?: number // in ml
}

// Sub-schema for Meal Distribution (can be percentage or calories)
@Schema({ _id: false })
export class MealDistribution {
  @Prop({ default: 25 }) breakfast: number
  @Prop({ default: 35 }) lunch: number
  @Prop({ default: 30 }) dinner: number
  @Prop({ default: 10 }) snacks: number
}

// Sub-schema for Weight Goal Information
@Schema({ _id: false })
export class WeightGoalInfo {
  @Prop({ default: 0 }) target?: number
  @Prop({ default: 0.5 }) weekly_rate?: number
  @Prop() current?: number
  @Prop({ default: Date.now }) start_date?: Date
  @Prop() target_date?: Date
}

// Sub-schema for Calculation Factors used for goal setting
@Schema({ _id: false })
export class GoalCalculationFactors {
  @Prop({
    enum: ['sedentary', 'light', 'moderate', 'active', 'very_active'],
    default: 'moderate',
  })
  activity_level: string
  @Prop({
    enum: [
      'lose_weight',
      'gain_weight',
      'maintain_weight',
      'build_muscle',
      'general_health',
    ],
    default: 'general_health',
  })
  goal_type: string
  @Prop({
    enum: [
      'normal',
      'if_16_8',
      'if_5_2',
      'keto',
      'low_carb',
      'paleo',
      'vegetarian',
      'vegan',
      'mediterranean',
    ],
    default: 'normal',
  })
  diet_type: string
}

// Sub-schema for Tracking Statistics
@Schema({ _id: false })
export class TrackingStats {
  @Prop({ default: 0 }) streak_days?: number
  @Prop({ default: 0 }) total_logs?: number
  @Prop() last_log_date?: Date
  @Prop({ default: 0 }) success_rate?: number
}

@Schema({ timestamps: true })
export class NutritionGoal {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId: User
  @Prop({ required: true, unique: true, index: true })
  lineUserId: string
  @Prop({ required: true, min: 0 })
  weight: number
  @Prop({ required: true, min: 0 })
  height: number
  @Prop({ required: true, min: 0, max: 120 })
  age: number
  @Prop({ enum: ['male', 'female', 'other'], required: true })
  gender: string
  @Prop({
    enum: ['sedentary', 'light', 'moderate', 'active', 'very_active'],
    required: true,
  })
  activityLevel: string
  @Prop({
    enum: [
      'lose_weight',
      'gain_weight',
      'build_muscle',
      'maintain_weight',
      'general_health',
    ],
    required: true,
  })
  healthGoal: string
  @Prop({
    enum: [
      'normal',
      'if_16_8',
      'if_5_2',
      'keto',
      'low_carb',
      'paleo',
      'vegetarian',
      'vegan',
      'mediterranean',
    ],
    required: true,
  })
  dietType: string
  @Prop({ type: DailyNutrientGoals, default: () => new DailyNutrientGoals() })
  daily_goals: DailyNutrientGoals
  @Prop({ type: MealDistribution, default: () => new MealDistribution() })
  meal_distribution: MealDistribution
  @Prop({ type: WeightGoalInfo, default: () => new WeightGoalInfo() })
  weight_goal: WeightGoalInfo
  @Prop({ type: [String], default: [] })
  restrictions?: string[]
  @Prop({
    type: GoalCalculationFactors,
    default: () => new GoalCalculationFactors(),
  })
  calculation_factors: GoalCalculationFactors
  @Prop({ type: TrackingStats, default: () => new TrackingStats() })
  tracking_stats: TrackingStats
  @Prop({ default: '' })
  notes?: string
  @Prop({ enum: ['active', 'archived'], default: 'active' })
  status?: string
  @Prop({ default: true })
  aiGenerated?: boolean

  calculateBMR(): number {
    if (!this.weight || !this.height || !this.age || !this.gender) return 0
    if (this.gender === 'male') {
      return (
        88.362 + 13.397 * this.weight + 4.799 * this.height - 5.677 * this.age
      )
    } else {
      return (
        447.593 + 9.247 * this.weight + 3.098 * this.height - 4.33 * this.age
      )
    }
  }

  calculateTDEE(): number {
    if (!this.activityLevel) return this.calculateBMR()
    const bmr = this.calculateBMR()
    const activityMultipliers = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      active: 1.725,
      very_active: 1.9,
    }
    return bmr * (activityMultipliers[this.activityLevel] || 1.55)
  }

  calculateCalorieGoal(): number {
    if (!this.healthGoal) return this.calculateTDEE()
    const tdee = this.calculateTDEE()
    switch (this.healthGoal) {
      case 'lose_weight':
        return tdee - 500
      case 'gain_weight':
        return tdee + 500
      case 'build_muscle':
        return tdee + 300
      default:
        return tdee
    }
  }

  calculateMacroRatio(): {
    proteinRatio: number
    carbRatio: number
    fatRatio: number
  } {
    let proteinRatio = 0.3
    let carbRatio = 0.4
    let fatRatio = 0.3
    switch (this.dietType) {
      case 'keto':
        proteinRatio = 0.25
        carbRatio = 0.05
        fatRatio = 0.7
        break
      case 'low_carb':
        proteinRatio = 0.3
        carbRatio = 0.2
        fatRatio = 0.5
        break
      case 'paleo':
        proteinRatio = 0.35
        carbRatio = 0.35
        fatRatio = 0.3
        break
      case 'vegetarian':
      case 'vegan':
        proteinRatio = 0.25
        carbRatio = 0.5
        fatRatio = 0.25
        break
      case 'mediterranean':
        proteinRatio = 0.25
        carbRatio = 0.45
        fatRatio = 0.3
        break
      default:
        if (this.healthGoal === 'build_muscle') {
          proteinRatio = 0.35
          carbRatio = 0.45
          fatRatio = 0.2
        } else if (this.healthGoal === 'lose_weight') {
          proteinRatio = 0.35
          carbRatio = 0.35
          fatRatio = 0.3
        }
    }
    return { proteinRatio, carbRatio, fatRatio }
  }

  calculateNutritionGoals(): DailyNutrientGoals {
    const calorieGoal = Math.round(this.calculateCalorieGoal())
    const { proteinRatio, carbRatio, fatRatio } = this.calculateMacroRatio()
    const proteinGoal = Math.round((calorieGoal * proteinRatio) / 4)
    const carbGoal = Math.round((calorieGoal * carbRatio) / 4)
    const fatGoal = Math.round((calorieGoal * fatRatio) / 9)
    const fiberGoal = Math.round((this.weight * 0.14 * 1000) / 100)
    const sugarGoal = Math.round(carbGoal * 0.1)
    const sodiumGoal = 2300

    this.daily_goals = {
      calories: calorieGoal,
      protein: proteinGoal,
      carbs: carbGoal,
      fat: fatGoal,
      fiber: fiberGoal,
      sugar: sugarGoal,
      sodium: sodiumGoal,
      water: this.daily_goals?.water || 2000,
    }

    const dist = this.meal_distribution || new MealDistribution()
    this.meal_distribution = {
      breakfast: Math.round(calorieGoal * (dist.breakfast / 100)),
      lunch: Math.round(calorieGoal * (dist.lunch / 100)),
      dinner: Math.round(calorieGoal * (dist.dinner / 100)),
      snacks: Math.round(calorieGoal * (dist.snacks / 100)),
    }

    if (this.calculation_factors) {
      this.calculation_factors.diet_type = this.dietType || 'normal'
      this.calculation_factors.goal_type = this.healthGoal || 'general_health'
      this.calculation_factors.activity_level = this.activityLevel || 'moderate'
    }
    return this.daily_goals
  }

  checkProgress(
    currentNutrition: ConsumedNutrientValues,
  ): Record<string, NutrientProgressDetail> {
    const progress: Record<string, NutrientProgressDetail> = {}
    // Ensure iteration is over keys that are valid for both daily_goals and currentNutrition
    const mainNutrients: (keyof ConsumedNutrientValues &
      keyof DailyNutrientGoals)[] = ['calories', 'protein', 'carbs', 'fat']
    mainNutrients.forEach((key) => {
      const goalVal = this.daily_goals?.[key] || 0
      const currentVal = currentNutrition?.[key] || 0
      progress[key] = {
        current: currentVal,
        goal: goalVal,
        percentage: goalVal > 0 ? Math.round((currentVal / goalVal) * 100) : 0,
      }
    })
    return progress
  }

  getMealCalories(): MealDistribution {
    return this.meal_distribution || new MealDistribution()
  }

  checkDailyGoalsMet(
    nutritionConsumed: ConsumedNutrientValues,
  ): Record<string, NutrientCheckStatusDetail> {
    const result: Record<string, NutrientCheckStatusDetail> = {}
    // Ensure iteration is over keys that are valid for both daily_goals and nutritionConsumed
    const nutrientsToCheck: (keyof ConsumedNutrientValues &
      keyof DailyNutrientGoals)[] = ['calories', 'protein', 'carbs', 'fat']

    nutrientsToCheck.forEach((nutrientKey) => {
      const goalVal = this.daily_goals?.[nutrientKey] || 0
      const consumedVal = nutritionConsumed?.[nutrientKey] || 0
      let status: 'under' | 'met' | 'over' = 'under'
      const percentage =
        goalVal > 0 ? Math.round((consumedVal / goalVal) * 100) : 0

      if (percentage < 90) status = 'under'
      else if (percentage <= 110) status = 'met'
      else status = 'over'

      result[nutrientKey] = {
        current: consumedVal,
        goal: goalVal,
        percentage,
        status,
      }
    })
    return result
  }

  async updateStreak(
    this: NutritionGoalDocument,
    logDate?: Date,
  ): Promise<NutritionGoalDocument> {
    const today = logDate || new Date()
    today.setHours(0, 0, 0, 0)
    if (!this.tracking_stats) this.tracking_stats = new TrackingStats()
    const lastLog = this.tracking_stats.last_log_date
      ? new Date(this.tracking_stats.last_log_date)
      : null
    if (lastLog) lastLog.setHours(0, 0, 0, 0)
    if (!lastLog) {
      this.tracking_stats.streak_days = 1
    } else {
      const diffTime = today.getTime() - lastLog.getTime()
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      if (diffDays === 1) {
        this.tracking_stats.streak_days =
          (this.tracking_stats.streak_days || 0) + 1
      } else if (diffDays > 1) {
        this.tracking_stats.streak_days = 1
      }
    }
    this.tracking_stats.total_logs = (this.tracking_stats.total_logs || 0) + 1
    this.tracking_stats.last_log_date = today
    return this.save()
  }
}

export const NutritionGoalSchema = SchemaFactory.createForClass(NutritionGoal)

NutritionGoalSchema.pre('save', function (next) {
  const doc = this as NutritionGoalDocument
  if (
    doc.isNew ||
    doc.isModified('weight') ||
    doc.isModified('height') ||
    doc.isModified('age') ||
    doc.isModified('gender') ||
    doc.isModified('activityLevel') ||
    doc.isModified('healthGoal') ||
    doc.isModified('dietType')
  ) {
    doc.calculateNutritionGoals()
  }
  next()
})
