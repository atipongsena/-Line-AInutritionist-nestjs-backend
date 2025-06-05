import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  AiService,
  FoodAnalysisToolResult,
  NonFoodDescriptionResult,
  VitaminMineralDetail,
} from '../ai/ai.service'
import { UserProfileDto } from '../user/user.interface'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { FoodLog, FoodLogDocument } from '../schemas/food-log.schema'
import {
  DailyReportResponseDto,
  WeeklyReportResponseDto,
  MonthlyReportResponseDto,
  MealDto,
  MicronutrientDetailWithGoal,
} from './dto/report-data.dto'
import { User, UserDocument } from '../schemas/user.schema'
import {
  NutritionGoal,
  NutritionGoalDocument,
} from '../schemas/nutrition-goal.schema'
import { Food, FoodDocument } from '../schemas/food.schema'
import { FoodItem as SharedFoodItemOriginal } from '@ai-nutritionist/shared-types'
import { UserService } from '../user/user.service'
import { TimezoneService } from '../common/timezone.service'

// Define DTOs/Interfaces as needed, e.g.:
// interface MacroDistribution {
//   protein_g: number;
//   carbs_g: number;
//   fat_g: number;
//   protein_percent: number;
//   carbs_percent: number;
//   fat_percent: number;
// }

export interface MacroDistributionResult {
  percentages: {
    protein: number
    carbs: number
    fat: number
  }
  grams: {
    protein: number
    carbs: number
    fat: number
  }
}

export interface MealDistributionResult {
  distribution: {
    breakfast: number
    lunch: number
    dinner: number
    snacks: number
  }
  mealCalories: {
    breakfast: number
    lunch: number
    dinner: number
    snacks: number
  }
}

@Injectable()
export class NutritionService {
  private readonly logger = new Logger(NutritionService.name)

  constructor(
    private readonly configService: ConfigService,
    private readonly aiService: AiService,
    @InjectModel(FoodLog.name) private foodLogModel: Model<FoodLogDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(NutritionGoal.name)
    private nutritionGoalModel: Model<NutritionGoalDocument>,
    @InjectModel(Food.name) private foodModel: Model<FoodDocument>,
    private readonly userService: UserService,
    private readonly timezoneService: TimezoneService,
  ) {
    this.logger.log('NutritionService initialized')
  }

  // --- Calculator Methods ---
  calculateBMI(weightKg: number, heightCm: number): number | null {
    this.logger.log(
      `Calculating BMI for weight: ${weightKg}kg, height: ${heightCm}cm`,
    )
    if (!weightKg || !heightCm || weightKg <= 0 || heightCm <= 0) {
      this.logger.warn(
        `Invalid input for BMI calculation: weight=${weightKg}kg, height=${heightCm}cm`,
      )
      return null
    }
    const heightM = heightCm / 100
    const bmi = weightKg / (heightM * heightM)
    return parseFloat(bmi.toFixed(1))
  }

  getBMIStatus(bmi: number | null, language: string = 'th'): string | null {
    if (bmi === null) return null

    const statusMessages: { [lang: string]: { [status: string]: string } } = {
      th: {
        underweight: 'น้ำหนักน้อยกว่าเกณฑ์',
        normalweight: 'น้ำหนักตามเกณฑ์',
        overweight: 'น้ำหนักเกินเกณฑ์ (ท้วม)',
        obese_level_1: 'โรคอ้วนระดับ 1 (อ้วน)',
        obese_level_2: 'โรคอ้วนระดับ 2 (อ้วนมาก)',
        obese_level_3: 'โรคอ้วนระดับ 3 (อ้วนอันตราย)',
      },
      en: {
        underweight: 'Underweight',
        normalweight: 'Normal weight',
        overweight: 'Overweight',
        obese_level_1: 'Obese Class I',
        obese_level_2: 'Obese Class II',
        obese_level_3: 'Obese Class III',
      },
    }
    const messages = statusMessages[language] || statusMessages.th

    if (bmi < 18.5) return messages.underweight
    if (bmi < 23) return messages.normalweight // Asian criteria: 18.5-22.9 is normal
    if (bmi < 25) return messages.overweight // Asian criteria: 23-24.9 is overweight (at risk)
    if (bmi < 30) return messages.obese_level_1
    if (bmi < 35) return messages.obese_level_2 // WHO criteria matches for higher levels
    return messages.obese_level_3
  }

  calculateBMR(
    gender: string,
    weightKg: number,
    heightCm: number,
    age: number,
  ): number | null {
    this.logger.log(
      `Calculating BMR for gender: ${gender}, weight: ${weightKg}, height: ${heightCm}, age: ${age}`,
    )
    if (
      !gender ||
      !weightKg ||
      weightKg <= 0 ||
      !heightCm ||
      heightCm <= 0 ||
      !age ||
      age <= 0
    ) {
      this.logger.warn(
        `Invalid input for BMR calculation: gender=${gender}, weight=${weightKg}, height=${heightCm}, age=${age}`,
      )
      return null
    }
    let bmrValue: number // Explicitly type bmrValue as number
    if (gender.toLowerCase() === 'male') {
      bmrValue = 10 * weightKg + 6.25 * heightCm - 5 * age + 5
    } else if (gender.toLowerCase() === 'female') {
      bmrValue = 10 * weightKg + 6.25 * heightCm - 5 * age - 161
    } else {
      this.logger.warn(
        `Unknown gender: ${gender} for BMR calculation, returning null.`,
      )
      return null // Return null for unknown gender
    }
    return Math.round(bmrValue) // bmrValue is now guaranteed to be a number if this line is reached
  }

  calculateTDEE(bmr: number | null, activityLevel: string): number | null {
    this.logger.log(
      `Calculating TDEE for BMR: ${bmr}, activity level: ${activityLevel}`,
    )
    if (bmr === null || bmr <= 0 || !activityLevel) {
      this.logger.warn(
        `Invalid input for TDEE calculation: bmr=${bmr}, activityLevel=${activityLevel}`,
      )
      return null
    }
    const activityMultipliers: { [key: string]: number } = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      active: 1.725,
      very_active: 1.9,
    }
    const multiplier =
      activityMultipliers[activityLevel.toLowerCase()] ||
      activityMultipliers.moderate
    const tdee = bmr * multiplier
    return Math.round(tdee)
  }

  calculateTargetCalories(tdee: number | null, goal: string): number | null {
    this.logger.log(
      `Calculating target calories for TDEE: ${tdee}, goal: ${goal}`,
    )
    if (tdee === null || tdee <= 0 || !goal) {
      this.logger.warn(
        `Invalid input for target calories calculation: tdee=${tdee}, goal=${goal}`,
      )
      return null
    }
    const goalLower = goal.toLowerCase()
    switch (goalLower) {
      case 'lose_weight':
      case 'ลดน้ำหนัก':
        return Math.max(1200, Math.round(tdee - 500))
      case 'gain_weight':
      case 'เพิ่มน้ำหนัก':
        return Math.round(tdee + 500)
      case 'gain_muscle':
      case 'muscle_gain':
      case 'build_muscle':
      case 'เพิ่มกล้ามเนื้อ':
        return Math.round(tdee + 300)
      case 'maintain':
      case 'maintain_weight':
      case 'รักษาน้ำหนัก':
        return Math.round(tdee)
      default:
        this.logger.warn(
          `Unknown goal type: ${goal}, using maintenance calories`,
        )
        return Math.round(tdee)
    }
  }

  calculateMacroDistribution(
    targetCalories: number | null,
    goal: string,
    dietType?: string,
  ): MacroDistributionResult | null {
    this.logger.log(
      `Calculating macro distribution for target calories: ${targetCalories}, goal: ${goal}, diet type: ${dietType}`,
    )
    if (targetCalories === null || targetCalories <= 0 || !goal) {
      this.logger.warn(
        `Invalid input for macro distribution: targetCalories=${targetCalories}, goal=${goal}, dietType=${dietType}`,
      )
      return null
    }

    let proteinPercent = 25
    let carbsPercent = 50
    let fatPercent = 25

    if (dietType) {
      switch (dietType.toLowerCase()) {
        case 'keto':
          proteinPercent = 25
          carbsPercent = 5
          fatPercent = 70
          break
        case 'low_carb':
          proteinPercent = 30
          carbsPercent = 20
          fatPercent = 50
          break
        case 'paleo':
          proteinPercent = 30
          carbsPercent = 40
          fatPercent = 30
          break
        case 'mediterranean':
          proteinPercent = 20
          carbsPercent = 50
          fatPercent = 30
          break
        case 'vegetarian':
        case 'vegan':
          proteinPercent = 20
          carbsPercent = 60
          fatPercent = 20
          break
      }
    }

    const goalLower = goal.toLowerCase()
    if (goalLower.includes('lose_weight') || goalLower.includes('ลดน้ำหนัก')) {
      if (
        dietType?.toLowerCase() !== 'keto' &&
        dietType?.toLowerCase() !== 'low_carb'
      ) {
        proteinPercent = Math.min(35, proteinPercent + 5) // Cap protein to prevent excessive shift
        carbsPercent = Math.max(10, carbsPercent - 5)
      }
    } else if (
      goalLower.includes('gain_muscle') ||
      goalLower.includes('muscle_gain') ||
      goalLower.includes('build_muscle') ||
      goalLower.includes('เพิ่มกล้ามเนื้อ')
    ) {
      if (dietType?.toLowerCase() !== 'keto') {
        // allow high protein for keto gain muscle if specified from dietType
        proteinPercent = Math.min(40, Math.max(30, proteinPercent + 5))
        // Adjust fat and carbs proportionally to maintain 100%
        const remainingPercent = 100 - proteinPercent
        if (carbsPercent + fatPercent > 0) {
          // Avoid division by zero
          const ratio = carbsPercent / (carbsPercent + fatPercent)
          carbsPercent = Math.round(remainingPercent * ratio)
          fatPercent = remainingPercent - carbsPercent
        } else {
          // Default if carbs and fat were both zero (unlikely)
          carbsPercent = Math.round(remainingPercent * 0.6) // e.g. 60% of remainder
          fatPercent = remainingPercent - carbsPercent
        }
      }
    }

    // Ensure percentages sum to 100, adjusting the largest if necessary
    let sumPercent = proteinPercent + carbsPercent + fatPercent
    if (sumPercent !== 100) {
      const diff = 100 - sumPercent
      if (proteinPercent >= carbsPercent && proteinPercent >= fatPercent)
        proteinPercent += diff
      else if (carbsPercent >= proteinPercent && carbsPercent >= fatPercent)
        carbsPercent += diff
      else fatPercent += diff
    }
    // Recalculate sum and log if still not 100 (should be extremely rare after adjustment)
    sumPercent = proteinPercent + carbsPercent + fatPercent
    if (sumPercent !== 100) {
      this.logger.warn(
        `Macro percentages do not sum to 100 after adjustment: P${proteinPercent} C${carbsPercent} F${fatPercent} = ${sumPercent}`,
      )
    }

    const caloriesPerGram = { protein: 4, carbs: 4, fat: 9 }
    const proteinGrams = Math.round(
      (targetCalories * proteinPercent) / 100 / caloriesPerGram.protein,
    )
    const carbsGrams = Math.round(
      (targetCalories * carbsPercent) / 100 / caloriesPerGram.carbs,
    )
    const fatGrams = Math.round(
      (targetCalories * fatPercent) / 100 / caloriesPerGram.fat,
    )

    return {
      percentages: {
        protein: proteinPercent,
        carbs: carbsPercent,
        fat: fatPercent,
      },
      grams: { protein: proteinGrams, carbs: carbsGrams, fat: fatGrams },
    }
  }

  calculateWaterNeeds(weightKg: number, activityLevel?: string): number | null {
    this.logger.log(
      `Calculating water needs for weight: ${weightKg}kg, activity level: ${activityLevel}`,
    )
    if (!weightKg || weightKg <= 0) {
      this.logger.warn(
        `Invalid input for water needs calculation: weight=${weightKg}kg, activityLevel=${activityLevel}`,
      )
      return null
    }
    let waterBase = weightKg * 30 // Base 30ml per kg
    if (activityLevel) {
      const activityMultipliers: { [key: string]: number } = {
        sedentary: 1.0,
        light: 1.1,
        moderate: 1.2,
        active: 1.3,
        very_active: 1.4,
      }
      const multiplier =
        activityMultipliers[activityLevel.toLowerCase()] ||
        activityMultipliers.moderate
      waterBase *= multiplier
    }
    return Math.round(waterBase / 100) * 100 // Round to nearest 100ml
  }

  calculateMealDistribution(
    targetCalories: number | null,
    dietType?: string,
  ): MealDistributionResult | null {
    this.logger.log(
      `Calculating meal distribution for target calories: ${targetCalories}, diet type: ${dietType}`,
    )
    if (targetCalories === null || targetCalories <= 0) {
      this.logger.warn(
        `Invalid input for meal distribution: targetCalories=${targetCalories}, dietType=${dietType}`,
      )
      return null
    }
    let distribution = {
      breakfast: 0.25,
      lunch: 0.35,
      dinner: 0.3,
      snacks: 0.1,
    }
    if (dietType && dietType.toLowerCase() === 'intermittent_fasting') {
      distribution = { breakfast: 0, lunch: 0.5, dinner: 0.4, snacks: 0.1 }
    }
    // Ensure distribution sums to 1, adjust snacks if not
    const sumDistribution = Object.values(distribution).reduce(
      (sum, val) => sum + val,
      0,
    )
    if (sumDistribution !== 1) {
      const diff = 1 - sumDistribution
      distribution.snacks += diff // Adjust snacks to make it sum to 1
      if (distribution.snacks < 0) {
        // If snacks become negative, set to 0 and adjust largest meal
        distribution.snacks = 0
        const remainingDiff =
          1 -
          (distribution.breakfast + distribution.lunch + distribution.dinner)
        if (
          distribution.lunch >= distribution.breakfast &&
          distribution.lunch >= distribution.dinner
        )
          distribution.lunch += remainingDiff
        else if (distribution.dinner >= distribution.breakfast)
          distribution.dinner += remainingDiff
        else distribution.breakfast += remainingDiff
      }
    }

    const mealCalories = {
      breakfast: Math.round(targetCalories * distribution.breakfast),
      lunch: Math.round(targetCalories * distribution.lunch),
      dinner: Math.round(targetCalories * distribution.dinner),
      snacks: Math.round(targetCalories * distribution.snacks),
    }

    // Ensure total meal calories match targetCalories due to rounding
    let currentTotalMealCalories = Object.values(mealCalories).reduce(
      (sum, val) => sum + val,
      0,
    )
    const calorieDiff = targetCalories - currentTotalMealCalories
    if (calorieDiff !== 0) {
      // Add/subtract difference to the largest meal (typically lunch or dinner)
      if (
        mealCalories.lunch >= mealCalories.dinner &&
        mealCalories.lunch >= mealCalories.breakfast
      ) {
        mealCalories.lunch += calorieDiff
      } else if (mealCalories.dinner >= mealCalories.breakfast) {
        mealCalories.dinner += calorieDiff
      } else {
        mealCalories.breakfast += calorieDiff
      }
    }
    // Verify final sum
    currentTotalMealCalories = Object.values(mealCalories).reduce(
      (sum, val) => sum + val,
      0,
    )
    if (currentTotalMealCalories !== targetCalories) {
      this.logger.warn(
        `Final meal calories (${currentTotalMealCalories}) do not sum to target (${targetCalories}) after rounding adjustment.`,
      )
    }

    return { distribution, mealCalories }
  }

  // --- Analyzer Methods ---
  async analyzeEatingPattern(
    userId: string,
    days: number = 7,
  ): Promise<{ message: string }> {
    this.logger.log(
      `Analyzing eating pattern for user ID: ${userId}, days: ${days}`,
    )
    // Placeholder for actual implementation
    await Promise.resolve(null) // Added to satisfy linter for async method
    return { message: 'Eating pattern analysis placeholder' }
  }

  async analyzeWeightTrend(
    userId: string,
    days: number = 30,
  ): Promise<{ message: string }> {
    this.logger.log(
      `Analyzing weight trend for user ID: ${userId}, days: ${days}`,
    )
    // Placeholder for actual implementation
    await Promise.resolve(null) // Added to satisfy linter for async method
    return { message: 'Weight trend analysis placeholder' }
  }

  // --- Recommender Methods ---
  async recommendMeal(
    userId: string,
    mealType: string,
  ): Promise<{ message: string }> {
    this.logger.log(
      `Recommending meal for user ID: ${userId}, meal type: ${mealType}`,
    )
    // Placeholder for actual implementation
    await Promise.resolve(null) // Added to satisfy linter for async method
    return { message: 'Meal recommendation placeholder' }
  }

  async recommendAlternatives(
    foodName: string,
    userId: string,
  ): Promise<{ message: string }> {
    this.logger.log(
      `Recommending alternatives for food: ${foodName}, user ID: ${userId}`,
    )
    // Placeholder for actual implementation
    await Promise.resolve(null) // Added to satisfy linter for async method
    return { message: 'Alternative recommendation placeholder' }
  }

  // --- AI-Enhanced Analysis Methods ---

  async analyzeFoodOrBarcodeWithPotentialWebSearch(
    userId: string,
    userProfile: UserProfileDto,
    message: string,
    options: {
      imageUrl?: string
      conversationHistory?: ChatCompletionMessageParam[]
      language?: string
      timeConstraint?: 'fast' | 'normal' | 'accurate'
      messageId?: string
    },
  ): Promise<
    FoodAnalysisToolResult | NonFoodDescriptionResult | { error: string } | null
  > {
    this.logger.log(
      `[${userId}] Analyzing food/barcode: "${message}", Image: ${!!options.imageUrl}, Lang: ${options.language || userProfile.language || 'th'}, TC: ${options.timeConstraint || 'normal'}, MsgId: ${options.messageId || 'N/A'}`,
    )

    const language = options.language || userProfile.language || 'th'
    const timeConstraint = options.timeConstraint || 'normal'

    try {
      // Analyze food or meal directly (barcode analysis removed)
      const analysisResult = await this.aiService.analyzeFoodOrMeal(
        userId,
        message,
        userProfile,
        language,
        timeConstraint,
        options.imageUrl,
        options.messageId,
      )

      if (!analysisResult) {
        this.logger.warn(`[${userId}] AiService returned null.`)
        return null
      }

      if (
        'type' in analysisResult &&
        analysisResult.type === 'non_food_description'
      ) {
        this.logger.warn(
          `[${userId}] Received non-food description from AiService: ${analysisResult.description}. This service expects food/barcode analysis.`,
        )
        return {
          error:
            language === 'th'
              ? 'รูปภาพที่ส่งมาไม่ใช่อาหาร'
              : 'The provided image was not food.',
        }
      }

      if (
        analysisResult &&
        'error' in analysisResult &&
        typeof analysisResult.error === 'string'
      ) {
        this.logger.warn(
          `[${userId}] AiService returned an error: ${analysisResult.error}`,
        )
        return { error: analysisResult.error }
      }
      if (
        analysisResult &&
        ('food_name' in analysisResult || 'barcode_type' in analysisResult)
      ) {
        this.logger.log(
          `[${userId}] Successfully received analysis from AiService.`,
        )
        return analysisResult
      }

      this.logger.error(
        `[${userId}] AiService returned an unexpected or null result after analysis. Result: ${JSON.stringify(analysisResult)}`,
      )
      return {
        error:
          language === 'th'
            ? 'AI service ไม่สามารถวิเคราะห์ข้อมูลได้'
            : 'AI service could not analyze the data.',
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      this.logger.error(
        `[${userId}] Error in analyzeFoodOrBarcodeWithPotentialWebSearch: ${errorMessage}`,
        error instanceof Error ? error.stack : '',
      )
      return {
        error:
          language === 'th'
            ? `เกิดข้อผิดพลาด: ${errorMessage}`
            : `Error: ${errorMessage}`,
      }
    }
  }

  // Placeholder for a method that would actually perform web search and process results
  // private async _fetchProductInfoAndReAnalyze(
  //   originalRequest: {
  //     userId: string,
  //     userProfile: UserProfile,
  //     message: string,
  //     imageUrl?: string,
  //     barcodeType?: string,
  //     barcodeValue?: string,
  //     conversationHistory?: ChatCompletionMessageParam[],
  //     isBarcodeAnalysis: boolean
  //   },
  //   webSearchQuery: string
  // ): Promise<FoodAnalysisToolResult | BarcodeAnalysisToolResult | { error: string }> {
  //   this.logger.log(`[${originalRequest.userId}] Would perform web search for: ${webSearchQuery}`);
  //   // 1. Simulate or perform actual web search
  //   const webResults = { info: "Mock product data from web for " + webSearchQuery };
  //
  //   // 2. Construct new message for AI including web results
  //   const newConversationHistory = [
  //     ...(originalRequest.conversationHistory || []),
  //     { role: 'assistant', content: null, tool_calls: [{id: "web_search_tool_call_mock", type: "function" as const, function: {name: "request_product_information_from_web", arguments: JSON.stringify({search_query: webSearchQuery})}}]},
  //     { role: 'tool', tool_call_id: "web_search_tool_call_mock", content: JSON.stringify(webResults) }
  //   ];
  //
  //   // 3. Re-call AiService
  //   // This part needs careful consideration of how AiService handles pre-fetched tool results.
  //   // For now, this is a conceptual placeholder.
  //   this.logger.warn("Re-analysis with web results is not fully implemented yet.");
  //   return { error: "Re-analysis with web results not implemented" };
  // }

  // --- Reporting Methods ---
  async getDailyReportData(
    lineUserId: string,
    dateString: string, // Expecting YYYY-MM-DD
  ): Promise<DailyReportResponseDto> {
    this.logger.log(
      `[getDailyReportData] Fetching for lineUserId: ${lineUserId}, date: ${dateString}`,
    )

    // ใช้ timezone ของ user เพื่อคำนวณ day bounds
    const userTimezone = await this.userService.getUserTimezone(lineUserId)
    const targetDate = new Date(dateString + 'T00:00:00')
    const { startOfDay, endOfDay: originalEndOfDay } =
      this.timezoneService.getDayBounds(targetDate, userTimezone)

    // Adjust endOfDay to include the very end of the day (milliseconds)
    const endOfDay = new Date(originalEndOfDay)
    endOfDay.setMilliseconds(999)

    this.logger.log(
      `[getDailyReportData] Using timezone: ${userTimezone}, startOfDay: ${startOfDay.toISOString()}, adjusted endOfDay: ${endOfDay.toISOString()}`,
    )

    const user = await this.userModel.findOne({ lineUserId }).exec()
    if (!user) {
      this.logger.warn(`[getDailyReportData] User not found: ${lineUserId}`)
      throw new Error('User not found')
    }

    const nutritionGoal = await this.nutritionGoalModel
      .findOne({
        userId: user._id,
        isActive: true,
        startDate: { $lte: endOfDay },
        $or: [{ endDate: { $gte: startOfDay } }, { endDate: null }],
      })
      .sort({ createdAt: -1 })
      .exec()

    // Initialize goals variable outside the if-else block
    let goals: {
      calories: number
      protein: number
      carbs: number
      fat: number
      fiber: number
      sugar: number
      sodium: number
      cholesterol: number
      saturated_fat: number
      trans_fat: number
      polyunsaturated_fat: number
      monounsaturated_fat: number
      omega3: number
      water: number
      potassium_nutrient: number
      micronutrients: Map<string, { goal?: number; unit?: string; dv?: number }>
    }

    // ✅ Updated priority system for nutrition goals
    // Priority 1: User profile stored nutrition goals (from database) - NEW PRIORITY
    if (user.dailyCaloriesGoal && user.dailyProteinGoal) {
      this.logger.log(
        `[getDailyReportData] Using stored nutrition goals from user profile`,
      )

      goals = {
        calories: user.dailyCaloriesGoal || 2000,
        protein: user.dailyProteinGoal || 75,
        carbs: user.dailyCarbsGoal || 250,
        fat: user.dailyFatGoal || 65,
        fiber: user.dailyFiberGoal || 25,
        sugar: user.dailySugarGoal || 50,
        sodium: user.dailySodiumGoal || 2300,
        cholesterol: user.dailyCholesterolGoal || 300,
        saturated_fat: user.dailySaturatedFatGoal || 20,
        trans_fat: 0, // Goal is to minimize trans fat
        polyunsaturated_fat: Math.round(
          ((user.dailyCaloriesGoal || 2000) * 0.1) / 9,
        ), // ~10% of calories
        monounsaturated_fat: Math.round(
          ((user.dailyCaloriesGoal || 2000) * 0.15) / 9,
        ), // ~15% of calories
        omega3: user.dailyOmega3Goal || (user.gender === 'male' ? 1.6 : 1.1),
        water: user.dailyWaterGoal || 2000,
        potassium_nutrient: 0, // Assuming no potassium nutrient information
        micronutrients: new Map<
          string,
          { goal?: number; unit?: string; dv?: number }
        >(),
      }

      this.logger.log(
        `[getDailyReportData] Using stored goals - Calories: ${goals.calories}, ` +
          `Protein: ${goals.protein}g, Carbs: ${goals.carbs}g, Fat: ${goals.fat}g`,
      )
    }
    // Priority 2: Calculate from user profile if stored goals are not available
    else if (user.weightKg && user.heightCm && user.age && user.gender) {
      this.logger.log(
        `[getDailyReportData] No nutrition goal found, calculating from user profile`,
      )

      // Calculate goals using service methods
      const bmr = this.calculateBMR(
        user.gender,
        user.weightKg,
        user.heightCm,
        user.age,
      )
      const tdee = this.calculateTDEE(bmr, user.activityLevel || 'moderate')
      const targetCalories = this.calculateTargetCalories(
        tdee,
        user.goal || 'maintain_weight',
      )
      const macroDistribution = this.calculateMacroDistribution(
        targetCalories,
        user.goal || 'maintain_weight',
        user.dietType || 'normal',
      )
      const waterNeeds = this.calculateWaterNeeds(
        user.weightKg,
        user.activityLevel,
      )

      // Create dynamic goals object
      goals = {
        calories: targetCalories || 2000,
        protein: macroDistribution?.grams.protein || 75,
        carbs: macroDistribution?.grams.carbs || 250,
        fat: macroDistribution?.grams.fat || 65,
        fiber: Math.round(((targetCalories || 2000) / 1000) * 14), // 14g per 1000 kcal
        sugar: Math.round(((targetCalories || 2000) * 0.1) / 4), // <10% of calories from sugar
        sodium: 2300, // mg, standard recommendation
        cholesterol: 300, // mg, max recommended
        saturated_fat: Math.round(((targetCalories || 2000) * 0.1) / 9), // <10% from saturated fat
        trans_fat: 0, // Goal is to minimize trans fat
        polyunsaturated_fat: Math.round(((targetCalories || 2000) * 0.1) / 9), // ~10% of calories
        monounsaturated_fat: Math.round(((targetCalories || 2000) * 0.15) / 9), // ~15% of calories
        omega3: user.gender === 'male' ? 1.6 : 1.1, // g/day ALA recommendation
        water: waterNeeds || 2000, // ml
        potassium_nutrient: 0, // Assuming no potassium nutrient information
        micronutrients: new Map<
          string,
          { goal?: number; unit?: string; dv?: number }
        >(),
      }

      this.logger.log(
        `[getDailyReportData] Calculated dynamic goals - Calories: ${goals.calories}, ` +
          `Protein: ${goals.protein}g, Carbs: ${goals.carbs}g, Fat: ${goals.fat}g`,
      )
    } else {
      // Priority 3: Use existing nutrition goal or defaults
      const defaultGoalValues = {
        calories: 2000,
        protein: 75,
        carbs: 250,
        fat: 65,
        micronutrients: new Map<
          string,
          { goal?: number; unit?: string; dv?: number }
        >(),
      }

      const dailyGoalsFromDb = nutritionGoal?.daily_goals

      goals = {
        calories: dailyGoalsFromDb?.calories || defaultGoalValues.calories,
        protein: dailyGoalsFromDb?.protein || defaultGoalValues.protein,
        carbs: dailyGoalsFromDb?.carbs || defaultGoalValues.carbs,
        fat: dailyGoalsFromDb?.fat || defaultGoalValues.fat,
        fiber: dailyGoalsFromDb?.fiber || 25,
        sugar: dailyGoalsFromDb?.sugar || 50,
        sodium: dailyGoalsFromDb?.sodium || 2300,
        cholesterol: dailyGoalsFromDb?.cholesterol || 300,
        saturated_fat: dailyGoalsFromDb?.saturated_fat || 20,
        trans_fat: dailyGoalsFromDb?.trans_fat || 0,
        polyunsaturated_fat: dailyGoalsFromDb?.polyunsaturated_fat || 22,
        monounsaturated_fat: dailyGoalsFromDb?.monounsaturated_fat || 33,
        omega3: dailyGoalsFromDb?.omega3 || 1.6,
        water: dailyGoalsFromDb?.water || 2000,
        potassium_nutrient: dailyGoalsFromDb?.potassium_nutrient || 0,
        micronutrients:
          dailyGoalsFromDb?.micronutrients instanceof Map
            ? dailyGoalsFromDb.micronutrients
            : defaultGoalValues.micronutrients,
      }
    }

    const foodLogs = await this.foodLogModel
      .find({
        lineUserId,
        logDate: { $gte: startOfDay, $lte: endOfDay },
      })
      .sort({ logDate: 'asc' })
      .exec()

    this.logger.log(
      `[getDailyReportData] Found ${foodLogs.length} food logs for ${dateString} between ${startOfDay.toISOString()} and ${endOfDay.toISOString()}`,
    )

    const foodIdsToFetch: Types.ObjectId[] = foodLogs
      .map((log) => log.food?.foodId)
      .filter((id): id is Types.ObjectId => id instanceof Types.ObjectId) // Type guard for filtering

    let originalFoodItemsMap: Map<string, FoodDocument> = new Map()
    if (foodIdsToFetch.length > 0) {
      const fetchedFoodItems = await this.foodModel
        .find({ _id: { $in: foodIdsToFetch } })
        .exec()
      originalFoodItemsMap = new Map(
        fetchedFoodItems.map((item) => [
          (item._id as Types.ObjectId).toString(),
          item,
        ]),
      )
    }

    let consumedCalories = 0
    let consumedProtein = 0
    let consumedCarbs = 0
    let consumedFat = 0
    const consumedMicronutrients: {
      [key: string]: MicronutrientDetailWithGoal
    } = {}
    let consumedFiber = 0
    let consumedSugar = 0
    let consumedSodium = 0
    let consumedCholesterol = 0
    let consumedSaturatedFat = 0
    let consumedOmega3 = 0
    let consumedWater = 0
    let consumedTransFat = 0
    let consumedPolyunsaturatedFat = 0
    let consumedMonounsaturatedFat = 0
    let consumedPotassiumNutrient = 0
    let consumedCaffeine = 0
    let consumedAlcohol = 0

    const mealsMap: Map<
      string,
      {
        foodItems: SharedFoodItemOriginal[]
        mealCalories: number
        logIds: string[]
      }
    > = new Map()

    foodLogs.forEach((log: FoodLogDocument) => {
      const foodDetail = log.food
      const originalFoodItem = foodDetail?.foodId
        ? originalFoodItemsMap.get(foodDetail.foodId.toString())
        : undefined

      let itemCalories = 0
      let itemProtein = 0
      let itemCarbs = 0
      let itemFat = 0

      if (foodDetail && foodDetail.nutrition) {
        itemCalories = foodDetail.nutrition.calories || 0
        itemProtein = foodDetail.nutrition.protein || 0
        itemCarbs = foodDetail.nutrition.carbs || 0
        itemFat = foodDetail.nutrition.fat || 0

        consumedCalories += itemCalories
        consumedProtein += itemProtein
        consumedCarbs += itemCarbs
        consumedFat += itemFat

        consumedFiber += foodDetail.nutrition.fiber || 0
        consumedSugar += foodDetail.nutrition.sugar || 0
        consumedSodium += foodDetail.nutrition.sodium || 0
        consumedCholesterol += foodDetail.nutrition.cholesterol || 0
        consumedSaturatedFat += foodDetail.nutrition.saturated_fat || 0
        consumedOmega3 += foodDetail.nutrition.omega3 || 0
        consumedWater += foodDetail.nutrition.water || 0
        consumedTransFat += foodDetail.nutrition.trans_fat || 0
        consumedPolyunsaturatedFat +=
          foodDetail.nutrition.polyunsaturated_fat || 0
        consumedMonounsaturatedFat +=
          foodDetail.nutrition.monounsaturated_fat || 0
        consumedPotassiumNutrient +=
          foodDetail.nutrition.potassium_nutrient || 0
        consumedCaffeine += foodDetail.nutrition.caffeine || 0
        consumedAlcohol += foodDetail.nutrition.alcohol || 0

        const sourceMicros =
          foodDetail.micronutrients ||
          originalFoodItem?.nutrition?.vitamins ||
          originalFoodItem?.nutrition?.minerals
        if (sourceMicros) {
          for (const [key, micro] of sourceMicros instanceof Map
            ? sourceMicros.entries()
            : Object.entries(sourceMicros)) {
            if (micro && typeof micro.value === 'number' && micro.unit) {
              const goalDetail = goals.micronutrients?.get(key)
              if (!consumedMicronutrients[key]) {
                consumedMicronutrients[key] = {
                  value: 0,
                  unit: micro.unit,
                  dv: micro.dv,
                  goal: goalDetail?.goal,
                }
              }
              consumedMicronutrients[key].value += micro.value
              if (goalDetail?.goal && !consumedMicronutrients[key].goal) {
                consumedMicronutrients[key].goal = goalDetail.goal
              }
              if (goalDetail?.unit && !consumedMicronutrients[key].unit) {
                consumedMicronutrients[key].unit = goalDetail.unit
              }
            }
          }
        }
      }

      const sharedFoodItem: SharedFoodItemOriginal = {
        _id:
          (foodDetail?.foodId as Types.ObjectId)?.toString() ||
          (log._id as Types.ObjectId).toString(), // Should be original food item ID if available, otherwise log ID as fallback
        name: {
          th: foodDetail?.foodName?.th || originalFoodItem?.name?.th || 'N/A',
          en: foodDetail?.foodName?.en || originalFoodItem?.name?.en,
        },
        description: {
          th:
            foodDetail?.portion ||
            originalFoodItem?.description?.th ||
            'รายละเอียดส่วนบริโภคไม่ชัดเจน',
          en: foodDetail?.portion || originalFoodItem?.description?.en,
        },
        nutrition: {
          calories: itemCalories,
          protein: itemProtein,
          carbs: itemCarbs,
          fat: itemFat,
          fiber:
            foodDetail?.nutrition?.fiber || originalFoodItem?.nutrition?.fiber,
          sugar:
            foodDetail?.nutrition?.sugar || originalFoodItem?.nutrition?.sugar,
          sodium:
            foodDetail?.nutrition?.sodium ||
            originalFoodItem?.nutrition?.sodium,
          saturated_fat:
            foodDetail?.nutrition?.saturated_fat ||
            originalFoodItem?.nutrition?.saturated_fat,
          cholesterol:
            foodDetail?.nutrition?.cholesterol ||
            originalFoodItem?.nutrition?.cholesterol,
          water:
            foodDetail?.nutrition?.water || originalFoodItem?.nutrition?.water,
          omega3:
            foodDetail?.nutrition?.omega3 ||
            originalFoodItem?.nutrition?.omega3,
          vitamins: {},
          minerals: {},
        },
        serving: {
          size: foodDetail?.amount || originalFoodItem?.serving?.size,
          unit: foodDetail?.unit || originalFoodItem?.serving?.unit,
          weight: originalFoodItem?.serving?.weight,
        },
        category: originalFoodItem?.category,
        brand: originalFoodItem?.brand,
        barcode: originalFoodItem?.barcode,
        imageUrl: log.image?.url || originalFoodItem?.image?.url,
        tags: originalFoodItem?.tags || [],
      }

      const foodItemMicrosSource =
        originalFoodItem?.nutrition?.vitamins ||
        originalFoodItem?.nutrition?.minerals ||
        foodDetail?.micronutrients

      if (foodItemMicrosSource) {
        const vitamins: Record<string, VitaminMineralDetail> = {}
        const minerals: Record<string, VitaminMineralDetail> = {}
        const mineralKeys = [
          'calcium',
          'iron',
          'magnesium',
          'potassium',
          'zinc',
          'phosphorus',
          'selenium',
          'sodium', // sodium is handled separately as a macro-like nutrient usually
        ]

        for (const [key, microDetail] of foodItemMicrosSource instanceof Map
          ? foodItemMicrosSource.entries()
          : Object.entries(foodItemMicrosSource)) {
          if (
            microDetail &&
            typeof microDetail.value === 'number' &&
            microDetail.unit
          ) {
            const detailToStore = {
              value: microDetail.value,
              unit: microDetail.unit,
              dv: microDetail.dv,
            }
            if (
              mineralKeys.includes(key.toLowerCase()) &&
              key.toLowerCase() !== 'sodium'
            ) {
              minerals[key] = detailToStore
            } else if (key.toLowerCase() !== 'sodium') {
              vitamins[key] = detailToStore
            }
          }
        }
        sharedFoodItem.nutrition.vitamins = vitamins
        sharedFoodItem.nutrition.minerals = minerals
      }

      if (foodDetail?.nutrition?.sodium && !sharedFoodItem.nutrition.sodium) {
        sharedFoodItem.nutrition.sodium = foodDetail.nutrition.sodium
      }

      const mealType = log.mealType || 'ไม่ระบุ'
      if (!mealsMap.has(mealType)) {
        mealsMap.set(mealType, { foodItems: [], mealCalories: 0, logIds: [] })
      }
      const currentMeal = mealsMap.get(mealType)!
      currentMeal.foodItems.push(sharedFoodItem)
      currentMeal.mealCalories += itemCalories
      currentMeal.logIds.push((log._id as Types.ObjectId).toString())
    })

    const meals: MealDto[] = Array.from(mealsMap.entries()).map(
      ([mealName, data]) => ({
        id: data.logIds[0] || new Types.ObjectId().toString(), // Use first logId of the meal or generate new one
        name: mealName,
        totalCalories: data.mealCalories,
        foodItems: data.foodItems,
      }),
    )

    return {
      date: dateString,
      calories: {
        consumed: consumedCalories,
        goal: goals.calories,
      },
      macronutrients: {
        protein: {
          consumed: Math.round(consumedProtein),
          goal: goals.protein,
          unit: 'g',
        },
        carbs: {
          consumed: Math.round(consumedCarbs),
          goal: goals.carbs,
          unit: 'g',
        },
        fat: { consumed: Math.round(consumedFat), goal: goals.fat, unit: 'g' },
      },
      otherNutrients: {
        fiber: {
          consumed: Math.round(consumedFiber),
          goal: goals.fiber,
          unit: 'g',
        },
        sugar: {
          consumed: Math.round(consumedSugar),
          goal: goals.sugar,
          unit: 'g',
        },
        sodium: {
          consumed: Math.round(consumedSodium),
          goal: goals.sodium,
          unit: 'mg',
        },
        cholesterol: {
          consumed: Math.round(consumedCholesterol),
          goal: goals.cholesterol,
          unit: 'mg',
        },
        saturated_fat: {
          consumed: Math.round(consumedSaturatedFat),
          goal: goals.saturated_fat,
          unit: 'g',
        },
        omega3: {
          consumed: parseFloat(consumedOmega3.toFixed(1)),
          goal: goals.omega3,
          unit: 'g',
        },
        water: {
          consumed: Math.round(consumedWater),
          goal: goals.water,
          unit: 'ml',
        },
        trans_fat: {
          consumed: parseFloat(consumedTransFat.toFixed(1)),
          goal: goals.trans_fat,
          unit: 'g',
        },
        polyunsaturated_fat: {
          consumed: parseFloat(consumedPolyunsaturatedFat.toFixed(1)),
          goal: goals.polyunsaturated_fat,
          unit: 'g',
        },
        monounsaturated_fat: {
          consumed: parseFloat(consumedMonounsaturatedFat.toFixed(1)),
          goal: goals.monounsaturated_fat,
          unit: 'g',
        },
        potassium_nutrient: {
          consumed: Math.round(consumedPotassiumNutrient),
          goal: goals.potassium_nutrient,
          unit: 'mg',
        },
        caffeine: {
          consumed: Math.round(consumedCaffeine),
          unit: 'mg',
        },
        alcohol: {
          consumed: parseFloat(consumedAlcohol.toFixed(1)),
          unit: 'g',
        },
      },
      micronutrients: consumedMicronutrients,
      meals,
    }
  }

  async getWeeklyReportData(
    lineUserId: string,
    weekStartDateString: string,
  ): Promise<WeeklyReportResponseDto> {
    this.logger.log(
      `[getWeeklyReportData] Fetching for lineUserId: ${lineUserId}, weekStart: ${weekStartDateString}`,
    )

    const weekStart = new Date(
      new Date(weekStartDateString).setHours(0, 0, 0, 0),
    )
    const weekEnd = new Date(
      new Date(weekStart).setDate(weekStart.getDate() + 6),
    )
    weekEnd.setHours(23, 59, 59, 999)

    const user = await this.userModel.findOne({ lineUserId }).exec()
    if (!user) {
      this.logger.warn(`[getWeeklyReportData] User not found: ${lineUserId}`)
      throw new Error('User not found')
    }

    // Use weekStart as the representative date for fetching the nutrition goal
    const representativeGoalDateForWeek = new Date(weekStart)
    const nutritionGoal = await this.nutritionGoalModel
      .findOne({
        userId: user._id,
        isActive: true,
        startDate: {
          $lte: new Date(
            new Date(representativeGoalDateForWeek).setHours(23, 59, 59, 999),
          ),
        },
        $or: [
          {
            endDate: {
              $gte: new Date(
                new Date(representativeGoalDateForWeek).setHours(0, 0, 0, 0),
              ),
            },
          },
          { endDate: null },
        ],
      })
      .sort({ createdAt: -1 })
      .exec()

    let goals: {
      calories: number
      protein: number
      carbs: number
      fat: number
      fiber?: number
      sugar?: number
      sodium?: number
      water?: number
    } = {
      calories: 2000,
      protein: 75,
      carbs: 250,
      fat: 65,
      fiber: 25,
      sugar: 50,
      sodium: 2300,
      water: 2000, // Default values
    }

    if (nutritionGoal) {
      this.logger.log(
        `[getWeeklyReportData] Using active nutrition goal document for the week.`,
      )
      goals = {
        calories: nutritionGoal.daily_goals?.calories ?? goals.calories,
        protein: nutritionGoal.daily_goals?.protein ?? goals.protein,
        carbs: nutritionGoal.daily_goals?.carbs ?? goals.carbs,
        fat: nutritionGoal.daily_goals?.fat ?? goals.fat,
        fiber: nutritionGoal.daily_goals?.fiber ?? goals.fiber,
        sugar: nutritionGoal.daily_goals?.sugar ?? goals.sugar,
        sodium: nutritionGoal.daily_goals?.sodium ?? goals.sodium,
        water: nutritionGoal.daily_goals?.water ?? goals.water,
      }
      this.logger.log(
        `[getWeeklyReportData] Using NutritionGoal doc - Calories: ${goals.calories}, ` +
          `Protein: ${goals.protein}g, Carbs: ${goals.carbs}g, Fat: ${goals.fat}g`,
      )
    } else if (user.dailyCaloriesGoal && user.dailyProteinGoal) {
      this.logger.log(
        `[getWeeklyReportData] Using stored nutrition goals from user profile (NutritionGoal doc not found).`,
      )
      goals = {
        calories: user.dailyCaloriesGoal || 2000,
        protein: user.dailyProteinGoal || 75,
        carbs: user.dailyCarbsGoal || 250,
        fat: user.dailyFatGoal || 65,
        fiber: user.dailyFiberGoal || 25,
        sugar: user.dailySugarGoal || 50,
        sodium: user.dailySodiumGoal || 2300,
        water: user.dailyWaterGoal || 2000,
      }

      this.logger.log(
        `[getWeeklyReportData] Using stored goals - Calories: ${goals.calories}, ` +
          `Protein: ${goals.protein}g, Carbs: ${goals.carbs}g, Fat: ${goals.fat}g`,
      )
    }

    const foodLogs = await this.foodLogModel
      .find({
        lineUserId,
        logDate: { $gte: weekStart, $lte: weekEnd },
      })
      .sort({ logDate: 'asc' })
      .exec()

    const dailyData: {
      [date: string]: {
        calories: number
        protein: number
        carbs: number
        fat: number
      }
    } = {}

    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(weekStart)
      currentDate.setDate(weekStart.getDate() + i)
      const dateStr = currentDate.toISOString().split('T')[0]
      dailyData[dateStr] = { calories: 0, protein: 0, carbs: 0, fat: 0 }
    }

    let totalCaloriesWeek = 0
    let totalProteinWeek = 0
    let totalCarbsWeek = 0
    let totalFatWeek = 0

    foodLogs.forEach((log) => {
      const dateStr = log.logDate.toISOString().split('T')[0]
      if (log.food?.nutrition) {
        const cal = log.food.nutrition.calories || 0
        const prot = log.food.nutrition.protein || 0
        const carb = log.food.nutrition.carbs || 0
        const fatVal = log.food.nutrition.fat || 0

        if (dailyData[dateStr]) {
          dailyData[dateStr].calories += cal
          dailyData[dateStr].protein += prot
          dailyData[dateStr].carbs += carb
          dailyData[dateStr].fat += fatVal
        }
        totalCaloriesWeek += cal
        totalProteinWeek += prot
        totalCarbsWeek += carb
        totalFatWeek += fatVal
      }
    })

    const daysWithLogs = Object.values(dailyData).filter(
      (d) => d.calories > 0 || d.protein > 0 || d.carbs > 0 || d.fat > 0,
    ).length
    const numDaysForAverage = daysWithLogs > 0 ? daysWithLogs : 1

    const orderedDailyCalories: { day: string; calories: number }[] = []
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(weekStart)
      currentDate.setDate(weekStart.getDate() + i)
      const dateStr = currentDate.toISOString().split('T')[0]
      const dayName = currentDate.toLocaleDateString('en-US', {
        weekday: 'short',
      })
      const foundData = dailyData[dateStr]
      orderedDailyCalories.push({
        day: dayName,
        calories: foundData ? Math.round(foundData.calories) : 0,
      })
    }

    return {
      weekStartDate: weekStartDateString,
      weekEndDate: weekEnd.toISOString().split('T')[0],
      avgCalories: Math.round(totalCaloriesWeek / numDaysForAverage),
      avgCaloriesGoal: goals.calories, // เพิ่ม calories goal
      dailyCalories: orderedDailyCalories,
      avgMacronutrients: {
        protein: {
          consumed: Math.round(totalProteinWeek / numDaysForAverage),
          goal: goals.protein,
          unit: 'g',
        },
        carbs: {
          consumed: Math.round(totalCarbsWeek / numDaysForAverage),
          goal: goals.carbs,
          unit: 'g',
        },
        fat: {
          consumed: Math.round(totalFatWeek / numDaysForAverage),
          goal: goals.fat,
          unit: 'g',
        },
      },
      summary: `สัปดาห์นี้คุณบริโภคเฉลี่ยวันละ ${Math.round(totalCaloriesWeek / numDaysForAverage)} แคลอรี่ (เป้าหมาย: ${goals.calories} แคลอรี่/วัน)`,
      tip: 'พยายามรับประทานผักและผลไม้ให้หลากหลายชนิดเพื่อวิตามินและแร่ธาตุที่ครบถ้วน',
    }
  }

  async getMonthlyReportData(
    lineUserId: string,
    monthString: string, // Expecting YYYY-MM
  ): Promise<MonthlyReportResponseDto> {
    this.logger.log(
      `[getMonthlyReportData] Generating monthly report for user: ${lineUserId}, month: ${monthString}`,
    )
    const user = await this.userModel.findOne({ lineUserId }).exec()
    if (!user) {
      this.logger.warn(`[getMonthlyReportData] User not found: ${lineUserId}`)
      throw new Error('User not found')
    }

    // Restore original date logic
    const [year, monthNum] = monthString.split('-').map(Number)
    const monthStart = new Date(year, monthNum - 1, 1, 0, 0, 0, 0)
    const monthEnd = new Date(year, monthNum, 0, 23, 59, 59, 999)

    // Fetch active nutrition goal for the month
    // To find a representative goal, we check for a goal active on the 15th of the month.
    const representativeGoalDateForMonth = new Date(year, monthNum - 1, 15)
    const _nutritionGoal = await this.nutritionGoalModel
      .findOne({
        userId: user._id,
        isActive: true,
        startDate: {
          $lte: new Date(
            new Date(representativeGoalDateForMonth).setHours(23, 59, 59, 999),
          ),
        },
        $or: [
          {
            endDate: {
              $gte: new Date(
                new Date(representativeGoalDateForMonth).setHours(0, 0, 0, 0),
              ),
            },
          },
          { endDate: null },
        ],
      })
      .sort({ createdAt: -1 })
      .exec()

    const _defaultGoalValues = {
      calories: 2000,
      protein: 75,
      carbs: 250,
      fat: 65,
    }

    // ✅ Add dynamic calculation like in getDailyReportData and getWeeklyReportData
    let goals: {
      calories: number
      protein: number
      carbs: number
      fat: number
      fiber?: number
      sugar?: number
      sodium?: number
      water?: number
    } = {
      calories: 2000,
      protein: 75,
      carbs: 250,
      fat: 65,
      fiber: 25,
      sugar: 50,
      sodium: 2300,
      water: 2000,
    }

    // Priority 1: User profile stored nutrition goals (from database) - NEW PRIORITY
    if (user.dailyCaloriesGoal && user.dailyProteinGoal) {
      this.logger.log(
        `[getMonthlyReportData] Using stored nutrition goals from user profile`,
      )

      goals = {
        calories: user.dailyCaloriesGoal || 2000,
        protein: user.dailyProteinGoal || 75,
        carbs: user.dailyCarbsGoal || 250,
        fat: user.dailyFatGoal || 65,
        fiber: user.dailyFiberGoal || 25,
        sugar: user.dailySugarGoal || 50,
        sodium: user.dailySodiumGoal || 2300,
        water: user.dailyWaterGoal || 2000,
      }

      this.logger.log(
        `[getMonthlyReportData] Using stored goals - Calories: ${goals.calories}, ` +
          `Protein: ${goals.protein}g, Carbs: ${goals.carbs}g, Fat: ${goals.fat}g`,
      )
    }
    // Priority 2: Calculate from user profile if stored goals are not available
    else if (user.weightKg && user.heightCm && user.age && user.gender) {
      this.logger.log(
        `[getMonthlyReportData] No nutrition goal found, calculating from user profile`,
      )

      // Calculate goals using service methods
      const bmr = this.calculateBMR(
        user.gender,
        user.weightKg,
        user.heightCm,
        user.age,
      )
      const tdee = this.calculateTDEE(bmr, user.activityLevel || 'moderate')
      const targetCalories = this.calculateTargetCalories(
        tdee,
        user.goal || 'maintain_weight',
      )
      const macroDistribution = this.calculateMacroDistribution(
        targetCalories,
        user.goal || 'maintain_weight',
        user.dietType || 'normal',
      )
      const waterNeeds = this.calculateWaterNeeds(
        user.weightKg,
        user.activityLevel,
      )

      // Create dynamic goals object
      goals = {
        calories: targetCalories || 2000,
        protein: macroDistribution?.grams.protein || 75,
        carbs: macroDistribution?.grams.carbs || 250,
        fat: macroDistribution?.grams.fat || 65,
        fiber: Math.round(((targetCalories || 2000) / 1000) * 14), // 14g per 1000 kcal
        sugar: Math.round(((targetCalories || 2000) * 0.1) / 4), // <10% of calories from sugar
        sodium: 2300, // mg, standard recommendation
        water: waterNeeds || 2000, // ml
      }

      this.logger.log(
        `[getMonthlyReportData] Calculated dynamic goals - Calories: ${goals.calories}, ` +
          `Protein: ${goals.protein}g, Carbs: ${goals.carbs}g, Fat: ${goals.fat}g`,
      )
    }

    const foodLogs = await this.foodLogModel
      .find({
        lineUserId,
        logDate: { $gte: monthStart, $lte: monthEnd },
      })
      .sort({ logDate: 'asc' })
      .exec()

    let totalCaloriesMonth = 0
    let totalProteinMonth = 0
    let totalCarbsMonth = 0
    let totalFatMonth = 0
    const daysInMonth = monthEnd.getDate()
    const dailyCaloriesMap: { [day: number]: number } = {}

    for (let i = 1; i <= daysInMonth; i++) {
      dailyCaloriesMap[i] = 0
    }

    const loggedDaysSet = new Set<string>()

    foodLogs.forEach((log) => {
      const logDate = log.logDate
      const dayOfMonth = logDate.getDate()
      loggedDaysSet.add(logDate.toISOString().split('T')[0])

      if (log.food?.nutrition) {
        const cal = log.food.nutrition.calories || 0
        totalCaloriesMonth += cal
        totalProteinMonth += log.food.nutrition.protein || 0
        totalCarbsMonth += log.food.nutrition.carbs || 0
        totalFatMonth += log.food.nutrition.fat || 0
        dailyCaloriesMap[dayOfMonth] = (dailyCaloriesMap[dayOfMonth] || 0) + cal
      }
    })

    const daysWithLogs = loggedDaysSet.size
    const numDaysForAverage = daysWithLogs > 0 ? daysWithLogs : 1

    const calorieTrend = Object.entries(dailyCaloriesMap).map(
      ([day, calories]) => ({
        day: parseInt(day, 10),
        calories: Math.round(calories),
      }),
    )

    return {
      month: monthString,
      avgCaloriesPerDay: Math.round(totalCaloriesMonth / numDaysForAverage),
      avgCaloriesGoal: goals.calories, // เพิ่ม calories goal
      totalCaloriesMonth: Math.round(totalCaloriesMonth),
      calorieTrend,
      avgMacronutrients: {
        protein: {
          consumed: Math.round(totalProteinMonth / numDaysForAverage),
          goal: goals.protein,
          unit: 'g',
        },
        carbs: {
          consumed: Math.round(totalCarbsMonth / numDaysForAverage),
          goal: goals.carbs,
          unit: 'g',
        },
        fat: {
          consumed: Math.round(totalFatMonth / numDaysForAverage),
          goal: goals.fat,
          unit: 'g',
        },
      },
      summary: `ในเดือน ${monthString} คุณบริโภคเฉลี่ยวันละ ${Math.round(totalCaloriesMonth / numDaysForAverage)} แคลอรี่ (เป้าหมาย: ${goals.calories} แคลอรี่/วัน). รวมทั้งเดือน ${Math.round(totalCaloriesMonth)} แคลอรี่.`,
      insights: [
        'ภาพรวมการบริโภคของคุณค่อนข้างสอดคล้องกับเป้าหมาย แนะนำให้คงระดับการรับประทานอาหารที่มีประโยชน์ต่อไป',
        totalProteinMonth / numDaysForAverage < goals.protein * 0.8
          ? 'ลองเพิ่มปริมาณโปรตีนในแต่ละวัน เช่น จากเนื้อสัตว์ไม่ติดมัน ไข่ หรือผลิตภัณฑ์จากถั่วเหลือง เพื่อช่วยเสริมสร้างกล้ามเนื้อและทำให้อิ่มนานขึ้น'
          : 'การบริโภคโปรตีนของคุณอยู่ในระดับที่ดี! โปรตีนช่วยในการซ่อมแซมและเสริมสร้างกล้ามเนื้อ',
      ],
    }
  }
}
