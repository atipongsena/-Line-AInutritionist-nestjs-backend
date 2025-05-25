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
  @Prop({ default: 50 }) sugar?: number // Typically for added sugars, max limit
  @Prop({ default: 2300 }) sodium?: number // Max limit
  @Prop({ default: 2000 }) water?: number // in ml, will be refined
  @Prop() cholesterol?: number // Max limit, in mg
  @Prop() saturated_fat?: number // Max limit, in g
  @Prop() omega3?: number // Recommended intake, in g (e.g., ALA)

  @Prop({
    type: MongooseSchema.Types.Map,
    of: { goal: Number, unit: String, dv: Number },
    default: () => new Map(),
  })
  micronutrients?: Map<string, { goal?: number; unit?: string; dv?: number }>
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
    if (!this.weight || !this.height || !this.age || !this.gender) {
      console.warn(
        '[BMR Calculation] Missing required fields for BMR calculation.',
      )
      return 0
    }

    // Mifflin-St Jeor Equation:
    // For men: BMR = (10 * weight in kg) + (6.25 * height in cm) - (5 * age in years) + 5
    // For women: BMR = (10 * weight in kg) + (6.25 * height in cm) - (5 * age in years) - 161
    let bmr: number
    if (this.gender === 'male') {
      bmr = 10 * this.weight + 6.25 * this.height - 5 * this.age + 5
    } else if (this.gender === 'female') {
      bmr = 10 * this.weight + 6.25 * this.height - 5 * this.age - 161
    } else {
      // For 'other' or unspecified genders, using the female formula as an approximation for BMR.
      // This is a simplification and may not be accurate for all individuals.
      // Ideally, specific guidelines or user input for metabolic rate would be used.
      console.warn(
        `[BMR Calculation] Gender is '${this.gender}'. Using female formula as an approximation for BMR.`,
      )
      bmr = 10 * this.weight + 6.25 * this.height - 5 * this.age - 161
    }
    return Math.round(bmr)
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
        return (
          tdee -
          (this.weight_goal?.weekly_rate
            ? (this.weight_goal.weekly_rate * 7700) / 7
            : 500)
        ) // Approx 7700 kcal per kg fat
      case 'gain_weight':
        return (
          tdee +
          (this.weight_goal?.weekly_rate
            ? (this.weight_goal.weekly_rate * 7700) / 7
            : 500)
        )
      case 'build_muscle':
        return (
          tdee +
          (this.weight_goal?.weekly_rate
            ? (this.weight_goal.weekly_rate * 7700) / 7
            : 300)
        ) // Building muscle also requires surplus
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
    // Consider revising this if too high. Standard recommendations are 25-38g.
    // For example, a fixed 25g for women, 38g for men, or 14g per 1000 kcal.
    // Let's use 14g per 1000 kcal as a more dynamic approach.
    const calculatedFiberGoal = Math.round((calorieGoal / 1000) * 14)

    // Aim for <10% of carbs from added sugar (this is an approximation)
    // More precisely, <10% of total calories from added sugar.
    const calculatedSugarGoal = Math.round((calorieGoal * 0.1) / 4) // <10% of total calories, converted to grams.

    const sodiumGoal = 2300 // mg, general recommendation for max intake

    // Water Goal Calculation
    let baseWaterGoal = this.weight * 30 // ml per kg of body weight (assuming this.weight is in kg)
    switch (this.activityLevel) {
      case 'light':
        baseWaterGoal *= 1.1
        break
      case 'moderate':
        baseWaterGoal *= 1.2
        break
      case 'active':
        baseWaterGoal *= 1.3
        break
      case 'very_active':
        baseWaterGoal *= 1.4
        break
    }
    const waterGoal = Math.round(baseWaterGoal)

    // Cholesterol, Saturated Fat, Trans Fat, Omega-3 Goals
    const cholesterolGoal = 300 // mg, max recommended
    const saturatedFatGoal = Math.round((calorieGoal * 0.1) / 9) // <10% of total calories from saturated fat, converted to grams

    let omega3Goal = 1.1 // g/day for ALA (female adult)
    if (this.gender === 'male') {
      omega3Goal = 1.6 // g/day for ALA (male adult)
    } else if (this.gender !== 'female') {
      // For 'other' genders, use average or prompt for more specific needs if possible in a different context.
      // Using average of male and female for now.
      omega3Goal = (1.1 + 1.6) / 2
    }

    this.daily_goals = {
      calories: calorieGoal,
      protein: proteinGoal,
      carbs: carbGoal,
      fat: fatGoal,
      fiber: calculatedFiberGoal, // Using new calculation
      sugar: calculatedSugarGoal, // Using new calculation based on total calories
      sodium: sodiumGoal,
      water: waterGoal,
      cholesterol: cholesterolGoal,
      saturated_fat: saturatedFatGoal,
      omega3: parseFloat(omega3Goal.toFixed(1)),
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
