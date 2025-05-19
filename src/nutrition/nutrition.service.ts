import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  AiService,
  FoodAnalysisToolResult,
  BarcodeAnalysisToolResult,
  WebSearchRequestToolResult,
  NonFoodDescriptionResult,
} from '../ai/ai.service'
import { UserProfileDto } from '../user/user.interface'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
// import { FoodAnalysisData, FoodComponentDetail } from '../line/flex.messages'
// import { InjectModel } from '@nestjs/mongoose'
// import { Model } from 'mongoose'
// Import Mongoose models as needed, e.g.:
// import { User, UserDocument } from '../schemas/user.schema';
// import { FoodLog, FoodLogDocument } from '../schemas/food-log.schema';
// import { NutritionGoal, NutritionGoalDocument } from '../schemas/nutrition-goal.schema';

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
    // @InjectModel(User.name) private userModel: Model<UserDocument>,
    // @InjectModel(FoodLog.name) private foodLogModel: Model<FoodLogDocument>,
    // @InjectModel(NutritionGoal.name) private nutritionGoalModel: Model<NutritionGoalDocument>,
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
      case 'เพิ่มกล้ามเนื้อ':
        return Math.round(tdee + 300)
      case 'maintain':
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
  async analyzeEatingPattern(userId: string, days: number = 7): Promise<any> {
    this.logger.log(
      `Analyzing eating pattern for user ID: ${userId}, days: ${days}`,
    )
    // Placeholder for actual implementation
    await Promise.resolve(null) // Added to satisfy linter for async method
    return { message: 'Eating pattern analysis placeholder' }
  }

  async analyzeWeightTrend(userId: string, days: number = 30): Promise<any> {
    this.logger.log(
      `Analyzing weight trend for user ID: ${userId}, days: ${days}`,
    )
    // Placeholder for actual implementation
    await Promise.resolve(null) // Added to satisfy linter for async method
    return { message: 'Weight trend analysis placeholder' }
  }

  // --- Recommender Methods ---
  async recommendMeal(userId: string, mealType: string): Promise<any> {
    this.logger.log(
      `Recommending meal for user ID: ${userId}, meal type: ${mealType}`,
    )
    // Placeholder for actual implementation
    await Promise.resolve(null) // Added to satisfy linter for async method
    return { message: 'Meal recommendation placeholder' }
  }

  async recommendAlternatives(foodName: string, userId: string): Promise<any> {
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
      barcodeValue?: string
      conversationHistory?: ChatCompletionMessageParam[]
      isBarcodeAnalysis: boolean
      language?: string
      timeConstraint?: 'fast' | 'normal' | 'accurate'
      messageId?: string
    },
  ): Promise<
    | FoodAnalysisToolResult
    | BarcodeAnalysisToolResult
    | WebSearchRequestToolResult
    | NonFoodDescriptionResult
    | { error: string }
    | null
  > {
    this.logger.log(
      `[${userId}] Analyzing food/barcode: "${message}", Image: ${!!options.imageUrl}, Barcode: ${!!options.barcodeValue}, Lang: ${options.language || userProfile.language || 'th'}, TC: ${options.timeConstraint || 'normal'}, MsgId: ${options.messageId || 'N/A'}`,
    )

    const language = options.language || userProfile.language || 'th'
    const timeConstraint = options.timeConstraint || 'normal'

    try {
      let analysisResult:
        | FoodAnalysisToolResult
        | BarcodeAnalysisToolResult
        | WebSearchRequestToolResult
        | NonFoodDescriptionResult
        | { error: string }
        | null

      if (options.isBarcodeAnalysis) {
        analysisResult = await this.aiService.analyzeBarcode(
          userId,
          userProfile,
          options.barcodeValue || message,
          language,
          timeConstraint,
          options.messageId,
        )
      } else {
        analysisResult = await this.aiService.analyzeFoodOrMeal(
          userId,
          message,
          userProfile,
          language,
          timeConstraint,
          options.imageUrl,
          options.messageId,
        )
      }

      if (analysisResult && typeof analysisResult === 'object') {
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
          'status' in analysisResult &&
          analysisResult.status === 'web_search_required'
        ) {
          this.logger.log(
            `[${userId}] Web search required. Query: "${analysisResult.search_query_for_assistant}", Product: "${analysisResult.original_product_name}"`,
          )
          return analysisResult
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
      }

      if (analysisResult === null) {
        this.logger.warn(`[${userId}] AiService returned null.`)
        return null
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
}
