import { Injectable, Logger } from '@nestjs/common'
import { OpenaiService } from '../openai/openai.service'
import OpenAI from 'openai'
import { APIError } from 'openai/error'
import {
  foodAnalysisTool as importedFoodAnalysisTool,
  nutritionGoalTool as importedNutritionGoalTool,
  eatingPatternTool as importedEatingPatternTool,
  mealRecommendationTool as importedMealRecommendationTool,
  barcodeAnalysisTool as importedBarcodeAnalysisTool,
  requestProductInfoFromWebTool as importedRequestProductInfoFromWebTool,
} from './ai.tools'
import { ConversationHistoryService } from '../conversation-history/conversation-history.service'
import { AnalysisCacheService } from '../analysis-cache/analysis-cache.service'
import { FoodAnalysisData } from '../line/flex.messages' // Added import for FoodAnalysisData

// Define the new result type for non-food images
export interface NonFoodDescriptionResult {
  type: 'non_food_description'
  description: string // Combined description and joke
}

// DTO for User Profile (can be moved to a dedicated types file)
export interface UserProfileDto {
  id?: string
  goal?: string
  gender?: string
  age?: number
  weight_kg?: number
  height_cm?: number
  activityLevel?: string // e.g., sedentary, light, moderate, active, very_active
  dietType?: string // e.g., normal, keto, vegetarian
  healthConditions?: string[]
  foodAllergies?: string[]
  foodRestrictions?: string[]
  language?: string // Added language to userProfile for consistency
  [key: string]: any
}

// --- FOOD LOG DTO for AiService ---
export interface FoodLogEntryDto {
  timestamp: Date
  mealType: string // e.g., breakfast, lunch, dinner, snack
  foodName: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber?: number
  // other fields from FoodLog schema if needed by AI or basic analysis
}

// --- NUTRITION GOAL DTO for AiService (simplified for AI context) ---
export interface NutritionGoalDtoForAI {
  daily_calories?: number
  daily_protein_g?: number
  daily_carbs_g?: number
  daily_fat_g?: number
  daily_fiber_g?: number
  // other fields from NutritionGoal schema if needed
}

// Result of the extract_food_analysis tool handler, matching FOOD_ANALYSIS_SCHEMA
export interface FoodAnalysisToolResult {
  food_name: string
  portion: string
  components: FoodComponentDetail[]
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber?: number
  sugar?: number
  saturated_fat?: number
  trans_fat?: number
  omega3?: number
  cholesterol?: number
  sodium?: number
  water?: number
  vitamin_a?: VitaminMineralDetail
  vitamin_c?: VitaminMineralDetail
  vitamin_d?: VitaminMineralDetail
  vitamin_e?: VitaminMineralDetail
  vitamin_k?: VitaminMineralDetail
  vitamin_b1?: VitaminMineralDetail // Thiamine
  vitamin_b2?: VitaminMineralDetail // Riboflavin
  vitamin_b3?: VitaminMineralDetail // Niacin
  vitamin_b5?: VitaminMineralDetail // Pantothenic Acid
  vitamin_b6?: VitaminMineralDetail
  vitamin_b9?: VitaminMineralDetail // Folate
  vitamin_b12?: VitaminMineralDetail
  calcium?: VitaminMineralDetail
  iron?: VitaminMineralDetail
  magnesium?: VitaminMineralDetail
  potassium?: VitaminMineralDetail
  zinc?: VitaminMineralDetail
  phosphorus?: VitaminMineralDetail
  selenium?: VitaminMineralDetail
  health_benefits: string
  health_cautions: string
  recommendation: string
}

export interface FoodComponentDetail {
  name: string
  amount: number
  unit: string
  percentage: number
}

export interface VitaminMineralDetail {
  value: number
  unit: string
  dv?: number
}

// Args for calculate_nutrition_goals tool
// AI doesn't typically send arguments for this; the handler uses userProfile.
export type NutritionGoalArgs = Record<string, never> // Explicitly an empty object type

export interface NutritionGoalToolResult {
  // Based on NUTRITION_GOAL_SCHEMA
  bmr: number
  tdee: number
  daily_goals: {
    calories: number
    protein: number // grams
    carbs: number // grams
    fat: number // grams
    fiber?: number // grams
    sugar_max?: number // grams
    water?: number // ml
  }
  macro_distribution: {
    protein_percent: number
    carbs_percent: number
    fat_percent: number
  }
  meal_recommendations: Record<string, number> // e.g., { breakfast: 400, lunch: 600, dinner: 600, snacks: 200 }
  health_advice: string
  food_recommendations?: string[]
  foods_to_avoid?: string[]
  // Removed status and message, AI will generate final response text
}

// --- EATING PATTERN TOOL ---
// Args for analyze_eating_pattern (AI might send a summary it generated)
export interface EatingPatternArgs {
  food_logs_summary?: string // AI might provide a summary of logs based on what it received
  nutrition_goal_summary?: string // AI might provide a summary of goals
  // If AI doesn't send these, the handler will use the raw data passed to it.
}

// Result from handleAnalyzeEatingPattern, matching EATING_PATTERN_SCHEMA and including basic analysis
export interface EatingPatternToolResult {
  // Fields from EATING_PATTERN_SCHEMA (AI will populate these based on its interpretation)
  calories_trend: 'improving' | 'stable' | 'worsening' | 'insufficient_data'
  average_daily_calories: number
  calorie_consistency?: number // 0-1
  meal_timings: Array<{
    meal_name: string
    average_time: string // HH:MM or N/A
    consistency?: number // 0-1
  }>
  most_skipped_meal?: string // e.g., breakfast, lunch, dinner, or none
  nutrient_balance?: {
    // Balances can be null if goal is not set
    protein_balance: number | null // % vs goal
    carbs_balance: number | null // % vs goal
    fat_balance: number | null // % vs goal
    fiber_balance: number | null // % vs goal, if fiber goal exists
  }
  eating_window_hours?: number | null
  late_night_eating_frequency?: number // 0-1 (e.g., 0.3 means 3 out of 10 recent days)
  identified_patterns: string[]
  problematic_behaviors?: string[]
  improvement_suggestions: string[]
  personalized_advice: string

  // Fields from basic analysis (calculated by the tool handler)
  basic_analysis_details?: {
    days_analyzed: number
    total_logs: number
    skipped_meal_counts: {
      breakfast: number
      lunch: number
      dinner: number
    }
    // Add other calculated metrics here if needed by AI to form its final response
    average_eating_window_hours?: number | null // Added for consistency with root level
    calculated_late_night_eating_frequency?: number // Added for consistency
  }
}

// --- MEAL RECOMMENDATION TOOL ---
// Args for recommend_meals (AI might specify meal type or preferences based on schema)
// The MEAL_RECOMMENDATION_SCHEMA itself describes the output of the handler.
// What the AI sends as arguments to the tool function might be simpler.
// For example, the AI might decide on a meal_type based on user query and pass that.
export interface MealRecommendationArgs {
  meal_type_preference?: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'any'
  dietary_focus?: string // e.g., low_carb, high_protein, vegetarian, vegan
  calorie_target_for_meal?: number
  cuisine_preferences?: string[] // e.g., ['Thai', 'Italian']
  ingredients_to_include?: string[]
  ingredients_to_exclude?: string[]
  number_of_options?: number // e.g., 1 to 3
}

// Result from handleRecommendMeals, matching MEAL_RECOMMENDATION_SCHEMA
export interface MealRecommendationToolResult {
  meal_type: string // e.g., Breakfast, Lunch, Dinner, Snack (actual type for the recommendation)
  foods: Array<{
    name: string
    description: string
    calories: number
    protein: number // grams
    carbs: number // grams
    fat: number // grams
    portion: string // e.g., "1 bowl (300g)", "2 slices"
    benefits?: string[]
    ingredients: string[] // Key ingredients
    preparation_time?: string // e.g., "15 minutes"
    cooking_difficulty?: 'easy' | 'medium' | 'hard' // Corresponds to 'ง่าย', 'ปานกลาง', 'ยาก'
  }>
  total_calories: number
  total_protein: number
  total_carbs: number
  total_fat: number
  recommendations?: string // General recommendations for this meal set
  alternatives?: string[] // Alternative food items or meal ideas
}

// --- BARCODE ANALYSIS TOOL ---
// Args for analyze_barcode_data (AI sends barcode data or product identifier)
export interface BarcodeAnalysisArgs {
  barcode_type?: string // e.g., EAN_13, UPC_A
  barcode_value: string // The actual barcode string
  // AI might also send product_name if it could identify it before calling the tool
  product_name_from_ai?: string
}

// Result from handleAnalyzeBarcodeData, matching BARCODE_ANALYSIS_SCHEMA
export interface BarcodeAnalysisToolResult {
  barcode_type: string
  barcode_value: string
  food_info: {
    product_name: string
    brand?: string
    serving_size?: string
    servings_per_container?: number
    calories: number // Per serving
    protein: number // g, per serving
    carbs: number // g, per serving
    fat: number // g, per serving
    fiber?: number // g, per serving
    sugar?: number // g, per serving
    saturated_fat?: number // g, per serving
    trans_fat?: number // g, per serving
    cholesterol?: number // mg, per serving
    sodium?: number // mg, per serving
    vitamins_minerals?: Record<string, number> // e.g., { VitaminC_DV: 10, Iron_DV: 15 } (% DV)
    ingredients: string[]
    allergens?: string[]
    storage_instructions?: string
    // expiration_date is too dynamic for a generic tool result, AI can mention if found on package
  }
  nutritional_rating: number // 1-5 (1=Poor, 5=Excellent)
  health_benefits?: string[]
  health_concerns?: string[]
  personalized_advice: string
  alternatives?: string[] // Healthier alternative products or food types
}

// --- WEB SEARCH REQUEST TOOL TYPES ---
// Args for request_product_information_from_web tool (input AI provides to the tool)
export interface WebSearchRequestArgs {
  search_query: string
  product_name: string
  details_from_image_or_text: string
  language?: string
}

// Result of the request_product_information_from_web tool handler
// This signals to the calling system (assistant) that a web search is needed.
export interface WebSearchRequestToolResult {
  status:
    | 'web_search_required'
    | 'web_search_not_needed_already_found'
    | 'error_creating_query'
  search_query_for_assistant?: string // The query to be used by the assistant for web search
  original_product_name?: string
  message_to_user_while_searching?: string // A message to show the user
  error_message?: string // If status is error
}

// Type for a generic tool handler function
interface ToolHandler<ArgsDto, ResultDto> {
  (
    args: ArgsDto,
    userProfile: UserProfileDto,
    language: string,
    // Adding optional raw data for handlers that might need more than AI provides in args
    foodLogs?: FoodLogEntryDto[],
    nutritionGoal?: NutritionGoalDtoForAI | null,
  ): Promise<ResultDto> | ResultDto
}

// --- Embedding Creation Interface (can be moved to a types file) ---
export interface EmbeddingResult {
  embedding: number[]
  usage: {
    prompt_tokens: number
    total_tokens: number
  }
  modelUsed: string
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name)

  // Available tools mapping - ensure names match exactly what AI is trained to use
  private readonly availableTools = {
    [importedFoodAnalysisTool.function.name]: importedFoodAnalysisTool,
    [importedNutritionGoalTool.function.name]: importedNutritionGoalTool,
    [importedEatingPatternTool.function.name]: importedEatingPatternTool,
    [importedMealRecommendationTool.function.name]:
      importedMealRecommendationTool,
    [importedBarcodeAnalysisTool.function.name]: importedBarcodeAnalysisTool,
    [importedRequestProductInfoFromWebTool.function.name]:
      importedRequestProductInfoFromWebTool,
  }

  constructor(
    private readonly openaiService: OpenaiService,
    private readonly conversationHistoryService: ConversationHistoryService, // Injected service
    private readonly analysisCacheService: AnalysisCacheService, // Added injection
  ) {}

  // --- Query Classification and Model Selection ---
  private classifyQueryInternal(
    query: string,
    userProfile: UserProfileDto,
  ): { complexityLevel: number; score: number; healthRelated: boolean } {
    this.logger.debug(`Classifying query: ${query.substring(0, 50)}...`)
    let score = 0
    let healthRelated = false

    // Query length
    score += Math.min(query.length / 100, 3)

    // Complex keywords
    const complexKeywords = [
      'เปรียบเทียบ',
      'วิเคราะห์',
      'ความสัมพันธ์',
      'ผลกระทบ',
      'คำนวณ',
      'แผนอาหาร',
      'แผน',
      'วางแผน',
      'compare',
      'analyze',
      'analysis',
      'relationship',
      'impact',
      'calculate',
      'plan',
      'recipe',
    ]
    for (const keyword of complexKeywords) {
      if (query.toLowerCase().includes(keyword.toLowerCase())) {
        score += 1.5
      }
    }

    // Health-related keywords in query
    const healthKeywords = [
      'โรค',
      'อาการ',
      'แพ้',
      'ข้อจำกัด',
      'สุขภาพ',
      'condition',
      'symptom',
      'allergy',
      'restriction',
      'health',
    ]
    for (const keyword of healthKeywords) {
      if (query.toLowerCase().includes(keyword.toLowerCase())) {
        score += 5
        healthRelated = true
        break
      }
    }

    // User profile health conditions
    if (
      userProfile.healthConditions &&
      userProfile.healthConditions.length > 0 &&
      !userProfile.healthConditions.some(
        (c) => c.toLowerCase() === 'none' || c.trim() === '',
      )
    ) {
      score += 5
      healthRelated = true
    }
    if (
      userProfile.foodAllergies &&
      userProfile.foodAllergies.length > 0 &&
      !userProfile.foodAllergies.some(
        (a) => a.toLowerCase() === 'none' || a.trim() === '',
      )
    ) {
      score += 4
      healthRelated = true
    }
    if (
      userProfile.foodRestrictions &&
      userProfile.foodRestrictions.length > 0 &&
      !userProfile.foodRestrictions.some(
        (r) => r.toLowerCase() === 'none' || r.trim() === '',
      )
    ) {
      score += 3
      healthRelated = true
    }

    let complexityLevel = 1 // Default to mini
    if (score >= 4 && score < 7) {
      complexityLevel = 2
    } else if (score >= 7 && score < 10) {
      complexityLevel = 3
    } else if (score >= 10) {
      complexityLevel = 4
    }

    // Downgrade non-health level 4 to 3
    if (complexityLevel === 4 && !healthRelated) {
      complexityLevel = 3
      this.logger.debug(
        `Downgraded complexity from 4 to 3 as it wasn't directly health-related. Score: ${score}`,
      )
    }

    this.logger.debug(
      `Query classification: level=${complexityLevel}, score=${score}, healthRelated=${healthRelated}`,
    )
    return { complexityLevel, score, healthRelated }
  }

  private selectModelInternal(
    query: string,
    userProfile: UserProfileDto,
    timeConstraint: 'fast' | 'normal' | 'accurate' = 'normal',
  ): { deploymentName: string; complexityLevel: number; score: number } {
    const { complexityLevel, score } = this.classifyQueryInternal(
      query,
      userProfile,
    )

    let useFullModel = false
    if (complexityLevel === 4) {
      useFullModel = true
      this.logger.log(
        `High complexity (level 4, score ${score}) detected, selecting gpt-4.1.`,
      )
    } else if (timeConstraint === 'accurate' && complexityLevel >= 3) {
      useFullModel = true
      this.logger.log(
        `'accurate' constraint with complexity level ${complexityLevel} (score ${score}), selecting gpt-4.1.`,
      )
    } else if (timeConstraint === 'fast' && complexityLevel >= 3) {
      this.logger.log(
        `'fast' constraint with complexity level ${complexityLevel} (score ${score}), prioritizing gpt-4.1-mini.`,
      )
      // Keep useFullModel as false
    } else {
      this.logger.log(
        `Complexity level ${complexityLevel} (score ${score}) and time constraint '${timeConstraint}', selecting gpt-4.1-mini.`,
      )
    }

    const gpt4DeploymentName = this.openaiService.getGpt4DeploymentName()
    const gpt35DeploymentName = this.openaiService.getGpt35DeploymentName()

    // Fallback logic if a specific deployment name is not configured
    // Assuming gpt4 is "full" and gpt35 is "mini"
    let deploymentName: string
    if (useFullModel) {
      if (gpt4DeploymentName) {
        deploymentName = gpt4DeploymentName
      } else if (gpt35DeploymentName) {
        this.logger.warn(
          'GPT-4 preferred but not configured, falling back to GPT-3.5.',
        )
        deploymentName = gpt35DeploymentName
        useFullModel = false // Reflect that we are not using the full model
      } else {
        this.logger.error(
          'Neither GPT-4 nor GPT-3.5 deployments are configured.',
        )
        throw new Error('No suitable OpenAI model deployments are configured.')
      }
    } else {
      // Prefer mini model (GPT-3.5)
      if (gpt35DeploymentName) {
        deploymentName = gpt35DeploymentName
      } else if (gpt4DeploymentName) {
        this.logger.warn(
          'GPT-3.5 preferred but not configured, falling back to GPT-4.',
        )
        deploymentName = gpt4DeploymentName
        // useFullModel could be set to true here if we want to track it, but deploymentName is key
      } else {
        this.logger.error(
          'Neither GPT-3.5 nor GPT-4 deployments are configured.',
        )
        throw new Error('No suitable OpenAI model deployments are configured.')
      }
    }

    this.logger.log(
      `Selected model deployment: ${deploymentName} (Full model used: ${useFullModel})`,
    )
    return { deploymentName, complexityLevel, score }
  }

  // --- System Prompt Creation Methods ---
  private createFoodAnalysisSystemPrompt(
    userProfile: UserProfileDto,
    language: string, // Language now taken from userProfile if available, else default
  ): string {
    const lang = userProfile.language || language || 'th'
    const {
      goal,
      gender,
      age,
      weight_kg,
      height_cm,
      dietType,
      activityLevel,
      healthConditions,
      foodAllergies,
      foodRestrictions,
    } = userProfile

    let bmi = 'not specified'
    if (weight_kg && height_cm) {
      bmi = (weight_kg / (height_cm / 100) ** 2).toFixed(1)
    }

    // Helper for localized examples, not for main prompt structure
    const ex_half_plate = lang === 'th' ? 'ครึ่งจาน' : 'Half a plate'
    const ex_approx_100g =
      lang === 'th' ? 'ประมาณ 100 กรัม จากที่เห็น' : 'Approx. 100g as seen'
    const ex_3_pieces = lang === 'th' ? '3 ชิ้น' : '3 pieces'
    const ex_recommendation_incomplete =
      lang === 'th'
        ? 'ข้อมูลบางอย่างอาจไม่ครบถ้วน หากมีชื่อผลิตภัณฑ์หรือบาร์โค้ดที่ชัดเจน ลองใช้การค้นหาเพิ่มเติมได้'
        : 'Some information might be incomplete. If you have a clear product name or barcode, further search might provide more details.'

    return `You are an AI nutritionist specializing in analyzing food and providing health advice. Your primary interaction language for this request MUST be ${lang.toUpperCase()}.

USER INFO (for your context, do not repeat in tool output unless specified by schema):
- Lang: ${lang}
- Gender: ${gender || 'not specified'}
- Age: ${age || 'not specified'} years
- Weight: ${weight_kg || 'not specified'} kg
- Height: ${height_cm || 'not specified'} cm
- BMI: ${bmi}
- Goal: ${goal || 'not specified'}
- Diet Type: ${dietType || 'normal'}
- Activity Level: ${activityLevel || 'moderate'}
- Restrictions: ${foodRestrictions?.join(', ') || 'none'}
- Health Conditions: ${healthConditions?.join(', ') || 'none'}
- Food Allergies: ${foodAllergies?.join(', ') || 'none'}

**TASK OVERVIEW:**
Your main task is to analyze food based on user's text and/or image input. You MUST use the '${importedFoodAnalysisTool.function.name}' tool for this. If essential product information is missing for a *specific packaged product*, you may use the '${importedRequestProductInfoFromWebTool.function.name}' tool instead. If the image is not food, respond directly as instructed under NON-FOOD IMAGE HANDLING.

**LANGUAGE GUARANTEE (CRITICAL):**
ALL textual fields within the arguments for the '${importedFoodAnalysisTool.function.name}' tool (e.g., food_name, portion description, component names, units if textual, health_benefits, health_cautions, recommendation) MUST be in the language code '${lang}'. For example, if '${lang}' is 'th', all such text must be in Thai. If '${lang}' is 'en', all text must be in English. Numerical values and standard unit abbreviations (g, mg, kcal, µg, IU) are universal.

**IMAGE ANALYSIS (IF IMAGE URL IS PROVIDED):**
- Analyze all food items visible in the image.
- If multiple distinct food items are clearly visible and part of a single meal, try to identify them as components of one overall dish if logical, or list them if they are separate items consumed together.
- Focus on edible items. Ignore non-food items unless it's packaging with readable text relevant to the food itself.
- **PORTION SIZE FROM IMAGE (VERY IMPORTANT):** Pay EXTREMELY close attention to the visible food quantity. 
    - If the image suggests a partial portion (e.g., a half-eaten plate, a few items remaining, a specific count like '3 chicken wings'), you MUST estimate nutrients for the *visible portion only*. 
    - Adjust the 'portion' field in your tool arguments accordingly (e.g., "${ex_half_plate}", "${ex_approx_100g}", "${ex_3_pieces}"). 
    - Do NOT assume a standard full serving if the image clearly indicates otherwise. 
    - If the image is unclear about the portion or shows a full, uneaten standard portion, then analyze it as a standard portion for that type of food and state the assumed standard portion (e.g., "1 bowl (approx. 300g)").

**TEXT ANALYSIS (IF TEXT DESCRIPTION IS PROVIDED):**
- Analyze based on the textual description. Use it to clarify or supplement image analysis if both are provided.
- If ambiguous, make reasonable assumptions based on common preparations, especially for Thai cuisine if '${lang}' is 'th'.

**COMBINED ANALYSIS (IF BOTH IMAGE AND TEXT ARE PROVIDED):**
- Use both image and text. Text can clarify (e.g., 'spicy version' for an image of fried chicken). Prioritize specific text details that supplement the visual.
- If text and image conflict significantly, primarily analyze the image, but you can note the discrepancy in the 'recommendation' field if it's very stark.

**TOOL INVOCATION AND SCHEMA ADHERENCE ('${importedFoodAnalysisTool.function.name}'):**
- You MUST call the '${importedFoodAnalysisTool.function.name}' tool for food analysis.
- Populate ALL fields in its schema as comprehensively as possible, including all specified vitamins and minerals if inferable. Estimate if necessary, and if a value is an estimate, you can briefly note this in the 'recommendation' or 'portion' field if it adds clarity (e.g., portion: "ประมาณ 100 กรัม (โดยประมาณจากภาพ)").
- Units for vitamins/minerals: Use 'mg', 'µg' (or 'mcg'), 'IU'. 'dv' (Daily Value %) is optional.
- All nutrient values (calories, protein, fat, carbs, vitamins, minerals) must be numbers.
- Health benefits, cautions, and recommendations must be concise, practical, and in '${lang}'.

**HANDLING MISSING INFORMATION / SPECIFIC PACKAGED PRODUCTS:**
- If input (text or image) is insufficient for a reasonably complete analysis OR if it's a *very specific packaged product* for which you lack detailed data:
    1. If it's a general food type with some ambiguity: Provide the best possible analysis using '${importedFoodAnalysisTool.function.name}' with available data, and in the 'recommendation' field, add: "${ex_recommendation_incomplete}".
    2. If it's a specific packaged product and you truly lack data: Consider using the '${importedRequestProductInfoFromWebTool.function.name}' tool INSTEAD of '${importedFoodAnalysisTool.function.name}'. Base this on whether the query is about a general food (use '${importedFoodAnalysisTool.function.name}') versus a specific, potentially obscure, named product (consider '${importedRequestProductInfoFromWebTool.function.name}').

**USER PROFILE CONSIDERATION (Subtle tailoring for advice):**
- While the core analysis is objective, if 'recommendation', 'health_benefits', or 'health_cautions' can be subtly and relevantly tailored to the user's profile (Goal: ${goal || 'N/A'}, Diet: ${dietType || 'N/A'}), that's beneficial. For example, for a weight loss goal, a high-calorie food might have a gentle caution regarding portion size in the context of that goal.

**NON-FOOD IMAGE HANDLING:**

    If the image DOES NOT PRIMARILY DEPICT FOOD/MEAL (e.g., it's a pet, a landscape, an object, a person not eating):**
    - Call the "extract_food_analysis" tool.
    - Set the "food_name" field in the tool to the exact string: "NON_FOOD_IMAGE_DETECTED".
    - In the "recommendation" field of the tool, provide a SHORT, light-hearted, and funny observation or joke about what you see in the image. This observation/joke MUST be in the user's language (${lang}). Keep it brief and playful. For example, if you see a cat, you could say something like: "นั่นน้องแมวเหรอครับ น่ารักจังเลย! แอบหิวข้าวอยู่รึเปล่าน้า? 😸" or if it's a landscape: "วิวสวยจังเลยครับ! เห็นแล้วอยากไปเที่ยวเลย แต่เอ๊ะ...ภาพนี้ทานไม่ได้นะครับ! 😂".
    - For all other fields in the "extract_food_analysis" tool (calories, protein, components, vitamins, etc.), provide placeholder values like 0, "N/A", or empty arrays/objects as appropriate for their type, to indicate no nutritional analysis is applicable. Do not attempt to analyze non-food items for nutrition.

**FINAL REMINDER:** Your primary goal is a comprehensive food analysis via the '${importedFoodAnalysisTool.function.name}' tool, with all textual arguments in '${lang}'. Ensure your final user-facing response (after any tool calls) is also in '${lang}'.
`
  }

  private createNutritionGoalSystemPrompt(
    userProfile: UserProfileDto,
    language: string = 'th',
  ): string {
    const {
      gender,
      age,
      weight_kg,
      height_cm,
      activityLevel,
      goal,
      dietType,
      foodRestrictions,
      healthConditions,
    } = userProfile

    let bmi = 'not specified'
    if (weight_kg && height_cm) {
      bmi = (weight_kg / (height_cm / 100) ** 2).toFixed(1)
    }

    return `You are an AI nutritionist. Calculate personalized nutrition goals for the user.
USER INFO:
- Lang: ${language}
- Gender: ${gender || 'not specified'}
- Age: ${age || 'not specified'} years
- Weight: ${weight_kg || 'not specified'} kg
- Height: ${height_cm || 'not specified'} cm
- BMI: ${bmi}
- Activity Level: ${activityLevel || 'not specified'}
- Goal: ${goal || 'not specified'}
- Diet Type: ${dietType || 'normal'}
- Restrictions: ${foodRestrictions?.join(', ') || 'none'}
- Health Conditions: ${healthConditions?.join(', ') || 'none'}

TASK:
1. Calculate BMR (Mifflin-St Jeor equation).
2. Calculate TDEE (Total Daily Energy Expenditure) based on activity level.
3. Determine optimal macronutrient distribution based on goal and diet type.
4. Set targets for vitamins, minerals, fiber, and water where appropriate.
5. ALWAYS RESPOND IN ${language.toUpperCase()} ONLY.
6. ALWAYS CALL the '${importedNutritionGoalTool.function.name}' tool with the calculated values.`
  }

  private createEatingPatternSystemPrompt(
    userProfile: UserProfileDto,
    language: string = 'th',
    foodLogsSummary?: string,
    nutritionGoalSummary?: string,
  ): string {
    const { gender, age, weight_kg, height_cm, goal, dietType, activityLevel } =
      userProfile

    let bmi = 'not specified'
    if (weight_kg && height_cm) {
      bmi = (weight_kg / (height_cm / 100) ** 2).toFixed(1)
    }

    return `You are an AI nutritionist specializing in analyzing eating patterns.
USER INFO:
- Lang: ${language}
- Gender: ${gender || 'not specified'}
- Age: ${age || 'not specified'} years
- Weight: ${weight_kg || 'not specified'} kg
- Height: ${height_cm || 'not specified'} cm
- BMI: ${bmi}
- Goal: ${goal || 'not specified'}
- Diet Type: ${dietType || 'normal'}
- Activity Level: ${activityLevel || 'not specified'}

TASK:
1. Analyze the user's eating patterns (hypothetically, based on provided logs or general knowledge if logs are absent).
2. Identify trends, habits, and potential issues.
3. Provide personalized recommendations.
4. ALWAYS RESPOND IN ${language.toUpperCase()} ONLY.
5. ALWAYS CALL the '${importedEatingPatternTool.function.name}' tool.

ANALYSIS REQUIREMENTS (for the tool call):
- Caloric distribution across meals (if data allows).
- Macronutrient balance (if data allows).
- Meal timing patterns (if data allows).
- Nutritional gaps (general advice if no specific data).
- Eating behaviors (e.g., skipped meals, late-night eating - general advice if no specific data).

SUMMARY:
- Food Logs Summary: ${foodLogsSummary || 'No food logs provided or logs are empty.'}
- Nutrition Goal Summary: ${nutritionGoalSummary || 'Nutrition goal not set or not provided.'}

FOOD LOG ANALYSIS:
- Focus on understanding the user's eating patterns and dietary habits.
- Identify any patterns of skipped meals, late-night eating, or irregular meal times.
- Consider the user's goal and diet type when interpreting the data.

NUTRITIONAL GOAL ANALYSIS:
- Understand the user's current nutritional needs and goals.
- Consider the user's diet type and activity level when setting targets.
- Adjust targets if necessary to align with the user's goals.

RECOMMENDATIONS:
- Based on the analysis, provide personalized advice on improving eating habits.
- Suggest meal options that support the user's goals and dietary preferences.
- Consider the user's food allergies and restrictions when making recommendations.
- Provide clear, actionable advice on how to incorporate healthier foods into the user's diet.`
  }

  private createMealRecommendationSystemPrompt(
    userProfile: UserProfileDto,
    language: string = 'th',
    mealContext: string = 'any meal', // e.g., "breakfast", "a high-protein snack"
  ): string {
    const {
      goal,
      dietType,
      foodRestrictions,
      foodAllergies,
      healthConditions,
      gender,
      age,
      weight_kg,
      height_cm,
      activityLevel,
    } = userProfile

    let bmi = 'not specified'
    if (weight_kg && height_cm) {
      bmi = (weight_kg / (height_cm / 100) ** 2).toFixed(1)
    }

    return `You are an AI nutritionist. Recommend suitable meals for "${mealContext}".
USER INFO:
- Lang: ${language}
- Gender: ${gender || 'not specified'}
- Age: ${age || 'not specified'}
- Weight: ${weight_kg || 'not specified'} kg
- Height: ${height_cm || 'not specified'} cm
- BMI: ${bmi}
- Goal: ${goal || 'not specified'}
- Diet Type: ${dietType || 'normal'}
- Activity Level: ${activityLevel || 'moderate'}
- Restrictions: ${foodRestrictions?.join(', ') || 'none'}
- Food Allergies: ${foodAllergies?.join(', ') || 'none'}
- Health Conditions: ${healthConditions?.join(', ') || 'none'}

TASK:
1. Recommend 1-3 suitable meal options based on user's profile and preferences (derived from mealContext and User Info).
2. Focus on meals that support their health goal.
3. Consider dietary restrictions, allergies, and health conditions.
4. Provide nutritional information for each recommendation when calling the tool.
5. ALWAYS RESPOND IN ${language.toUpperCase()} ONLY.
6. ALWAYS CALL the '${importedMealRecommendationTool.function.name}' tool.

MEAL RECOMMENDATIONS FOR THE TOOL SHOULD:
- Match the user's potential caloric needs for the given meal context.
- Provide proper macronutrient distribution.
- Be culturally appropriate if possible (especially for Thai language requests).
- Include easily accessible ingredients.
- Be practical to prepare.`
  }

  private createBarcodeAnalysisSystemPrompt(
    userProfile: UserProfileDto,
    language: string = 'th',
  ): string {
    const {
      goal,
      dietType,
      foodRestrictions,
      foodAllergies,
      healthConditions,
    } = userProfile
    return `You are an AI nutritionist. Analyze product information (e.g., from a barcode or product image/text).
USER INFO:
- Lang: ${language}
- Goal: ${goal || 'not specified'}
- Diet Type: ${dietType || 'normal'}
- Restrictions: ${foodRestrictions?.join(', ') || 'none'}
- Food Allergies: ${foodAllergies?.join(', ') || 'none'}
- Health Conditions: ${healthConditions?.join(', ') || 'none'}

TASK:
1. Attempt to identify the product and its key nutritional info based on provided data (barcode, product name, image description) using the '${importedBarcodeAnalysisTool.function.name}' tool first.
2. If the '${importedBarcodeAnalysisTool.function.name}' tool cannot find the product or returns insufficient/low-confidence information (e.g., "product not found in database", "generic information only"), then use the '${importedRequestProductInfoFromWebTool.function.name}' tool to request a web search. Formulate a specific search query based on the barcode value, product name (if any from user), and any visible packaging details.
3. Provide a nutritional rating (1-5) and personalized advice based on the comprehensive information gathered (from initial analysis or web search).
4. ALWAYS RESPOND IN ${language.toUpperCase()} ONLY.

FOCUS ON (for the tool call to '${importedBarcodeAnalysisTool.function.name}'):
- Accurate product identification from provided data.
- Nutritional value analysis.
- Ingredient quality assessment.
- Suitability for user's diet and health conditions.`
  }

  private createGeneralNutritionPrompt(
    userProfile: UserProfileDto,
    language: string = 'th',
  ): string {
    const { gender, age, goal, dietType, healthConditions } = userProfile
    this.logger.debug(
      `Creating general nutrition prompt for language: ${language}`,
    )

    return `You are an AI nutritionist providing evidence-based nutrition advice.

USER INFO:
- Lang: ${language}
- Gender: ${gender || 'not specified'}
- Age: ${age || 'not specified'} years
- Goal: ${goal || 'not specified'}
- Diet Type: ${dietType || 'normal'}
- Health Conditions: ${healthConditions?.join(', ') || 'none'}

TASK:
1. Answer nutrition and food-related questions accurately.
2. Base answers on scientific evidence.
3. Personalize advice when relevant to the user's profile.
4. ALWAYS RESPOND IN ${language.toUpperCase()} ONLY.
5. Do NOT use any tools for this request. Provide a direct textual answer.

OFF-TOPIC QUERY HANDLING:
- If the user's query is clearly NOT related to food, nutrition, health, or diet (e.g., asking about the weather, politics, your personal opinions, or completely random topics):
    1. Politely state that your expertise is in nutrition and food.
    2. You MAY add a lighthearted or witty comment. For example, if asked "What's the weather like?", you could say: "I'm an expert in nutritional climates, not atmospheric ones! But I hope it's a great day for a healthy meal." or if asked "Who will win the election?", respond with "My analysis is usually on protein vs carbs, not candidates! I can tell you which foods are winning in the health department though."
    3. Do NOT attempt to answer the off-topic question itself.
    4. Gently guide the conversation back to nutrition if possible.

GUIDELINES (for nutrition-related queries):
- Be clear, concise, and practical.
- Avoid extreme or controversial claims.
- Emphasize balance and moderation.
- Use culturally appropriate examples if relevant.
- Provide context for nutritional recommendations.

RESPONSE STRUCTURE (for nutrition-related queries):
- Direct answer to the question.
- Brief supporting explanation.
- Personalized relevance (if applicable).
- Practical application tips.`
  }

  // --- Main Service Methods (Public API of AiService) ---
  async analyzeFoodOrMeal(
    lineUserId: string,
    text: string, // Can be a description or an image URL if not using imageUrl directly
    userProfile: UserProfileDto,
    language: string = 'th',
    timeConstraint: 'fast' | 'normal' | 'accurate' = 'normal',
    imageUrl?: string,
    messageId?: string, // Added messageId
  ): Promise<
    | FoodAnalysisToolResult
    | WebSearchRequestToolResult
    | NonFoodDescriptionResult // Added new result type
    | { error: string }
    | null
  > {
    const queryForModelSelection = imageUrl ? 'Image Analysis' : text
    const systemPrompt = this.createFoodAnalysisSystemPrompt(
      userProfile,
      language,
    )
    const userMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: systemPrompt,
      },
    ]

    if (imageUrl) {
      userMessages.push({
        role: 'user',
        content: [
          { type: 'text', text: text || 'Analyze the provided image.' },
          { type: 'image_url', image_url: { url: imageUrl, detail: 'auto' } },
        ],
      })
    } else {
      userMessages.push({
        role: 'user',
        content: text,
      })
    }

    let historyMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
      []
    try {
      // Use the correct method name and handle potential null
      const conversationHistory =
        await this.conversationHistoryService.getRecentHistory(
          lineUserId,
          undefined,
          500,
        ) // Pass lineUserId, userProfile (optional), maxTokens
      if (conversationHistory) {
        historyMessages = conversationHistory.map((h) => ({
          role: h.role,
          content: h.content,
        }))
      }
    } catch (err) {
      this.logger.error(
        `Failed to retrieve conversation history for ${lineUserId}: ${err instanceof Error ? err.message : String(err)}`,
      )
      // Continue without history if it fails
    }

    const messagesWithHistory = [...historyMessages, ...userMessages.slice(1)]
    const finalMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
      [userMessages[0], ...messagesWithHistory]

    try {
      this.logger.debug(
        `Calling OpenAI for food analysis for user ${lineUserId} with image: ${!!imageUrl}`,
      )

      const result = await this.callOpenAIWithToolHandling<
        FoodAnalysisToolResult, // Args DTO type for extract_food_analysis (actually the result itself is sent as args by AI)
        FoodAnalysisToolResult // Result DTO type from the tool handler
      >(
        lineUserId,
        finalMessages,
        [this.availableTools[importedFoodAnalysisTool.function.name]], // Corrected: Pass the actual tool object
        'extract_food_analysis',
        (
          args: FoodAnalysisToolResult,
          profile: UserProfileDto,
          lang: string,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          _foodLogs?: FoodLogEntryDto[], // Included to match ToolHandler signature
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          _nutritionGoal?: NutritionGoalDtoForAI | null, // Included to match ToolHandler signature
        ) => this.handleExtractFoodAnalysis(args, profile, lang),
        userProfile,
        language,
        queryForModelSelection,
        timeConstraint,
        false, // skipHistoryForToolInteraction - false because we want to save this interaction
        undefined, // foodLogsForHandler
        undefined, // nutritionGoalForHandler
        messageId,
      )

      if (
        result &&
        'food_name' in result &&
        result.food_name === 'NON_FOOD_IMAGE_DETECTED'
      ) {
        // This is our non-food scenario
        this.logger.log(
          `Non-food image detected for user ${lineUserId}. Description: ${result.recommendation}`,
        )
        return {
          type: 'non_food_description',
          description:
            result.recommendation ||
            (language === 'th'
              ? 'เจอภาพแปลกๆ แต่ไม่ใช่อาหารแฮะ! 😂'
              : "Found a peculiar image, but it's not food! 😂"),
        } as NonFoodDescriptionResult
      }

      // Check if result is FoodAnalysisToolResult, WebSearchRequestToolResult, or error
      if (
        result &&
        ('food_name' in result || 'status' in result || 'error' in result)
      ) {
        // If it's a normal food analysis, WebSearchRequestToolResult, or an error object from callOpenAIWithToolHandling
        return result as
          | FoodAnalysisToolResult
          | WebSearchRequestToolResult
          | { error: string }
      }

      this.logger.warn(
        `Unexpected null or improperly structured result from callOpenAIWithToolHandling for food analysis for user ${lineUserId}`,
      )
      return null
    } catch (error) {
      // ... (existing error handling)
      const message = error instanceof Error ? error.message : String(error)
      this.logger.error(
        `Error in analyzeFoodOrMeal for user ${lineUserId}: ${message}`,
        error instanceof Error ? error.stack : undefined,
      )
      return {
        error: `Internal error: ${message}`,
      }
    }
  }

  async calculateNutritionGoalsForUser(
    lineUserId: string,
    userProfile: UserProfileDto,
    language: string = 'th',
    timeConstraint: 'fast' | 'normal' | 'accurate' = 'normal',
  ): Promise<NutritionGoalToolResult | { error: string } | null> {
    const lang = userProfile.language || language
    this.logger.log(
      `Calculating nutrition goals for user ID: ${userProfile.id || 'Unknown'} with constraint: ${timeConstraint}, lang: ${lang}`,
    )
    const systemPrompt = this.createNutritionGoalSystemPrompt(userProfile, lang)
    const userQueryForModelSelection = 'calculate nutrition goals'
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: 'Please calculate my nutrition goals based on my profile.',
      },
    ]
    const toolToCall = importedNutritionGoalTool

    const result = await this.callOpenAIWithToolHandling<
      NutritionGoalArgs,
      NutritionGoalToolResult
    >(
      lineUserId,
      messages,
      [toolToCall],
      toolToCall.function.name,
      (args: NutritionGoalArgs, profile: UserProfileDto, langParam: string) =>
        this.handleCalculateNutritionGoals(args, profile, langParam),
      userProfile,
      lang,
      userQueryForModelSelection,
      timeConstraint,
      false, // skipHistoryForToolInteraction: false
    )

    if (
      result &&
      typeof result === 'object' &&
      'status' in result &&
      result.status === 'web_search_required'
    ) {
      this.logger.error(
        '[calculateNutritionGoalsForUser] Unexpected WebSearchRequestToolResult received.',
      )
      return {
        error:
          'Internal error: Unexpected web search request during goal calculation.',
      }
    }
    return result as NutritionGoalToolResult | { error: string } | null
  }

  async analyzeEatingPattern(
    lineUserId: string,
    userProfile: UserProfileDto,
    foodLogs: FoodLogEntryDto[],
    nutritionGoal: NutritionGoalDtoForAI | null,
    language: string = 'th',
    timeConstraint: 'fast' | 'normal' | 'accurate' = 'normal',
  ): Promise<EatingPatternToolResult | { error: string } | null> {
    const lang = userProfile.language || language
    this.logger.log(
      `Analyzing eating pattern for user ID: ${userProfile.id || 'Unknown'} with constraint: ${timeConstraint}, lang: ${lang}. Logs count: ${foodLogs.length}, Goal set: ${!!nutritionGoal}`,
    )

    let foodLogsSummary = 'No food logs provided or logs are empty.'
    if (foodLogs.length > 0) {
      foodLogsSummary = `User has ${foodLogs.length} food logs. Recent examples (up to 3):
`
      foodLogs.slice(0, 3).forEach((log) => {
        foodLogsSummary += `- ${log.timestamp.toISOString().split('T')[0]} ${log.mealType}: ${log.foodName} (${log.calories} kcal)\n`
      })
      if (foodLogs.length > 3) foodLogsSummary += 'And more logs exist...\n'
    }

    let nutritionGoalSummary = 'Nutrition goal not set or not provided.'
    if (nutritionGoal) {
      nutritionGoalSummary = `Current Goal: Target Calories: ${nutritionGoal.daily_calories || 'N/A'} kcal, Protein: ${nutritionGoal.daily_protein_g || 'N/A'}g, Carbs: ${nutritionGoal.daily_carbs_g || 'N/A'}g, Fat: ${nutritionGoal.daily_fat_g || 'N/A'}g, Fiber: ${nutritionGoal.daily_fiber_g || 'N/A'}g.`
    }

    const systemPrompt = this.createEatingPatternSystemPrompt(
      userProfile,
      lang,
      foodLogsSummary,
      nutritionGoalSummary,
    )

    const userQuery = `Based on my profile, the provided food log summary, and nutrition goal summary, please analyze my eating patterns and call the '${importedEatingPatternTool.function.name}' tool. Focus on interpreting these summaries to generate relevant arguments for the tool if possible.`

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userQuery },
    ]
    const toolToCall = importedEatingPatternTool

    const result = await this.callOpenAIWithToolHandling<
      EatingPatternArgs,
      EatingPatternToolResult
    >(
      lineUserId,
      messages,
      [toolToCall],
      toolToCall.function.name,
      (
        toolArgs: EatingPatternArgs,
        profile: UserProfileDto,
        langParam: string,
      ) =>
        this.handleAnalyzeEatingPattern(
          toolArgs,
          profile,
          langParam,
          foodLogs,
          nutritionGoal,
        ),
      userProfile,
      lang,
      userQuery,
      timeConstraint,
      false, // skipHistoryForToolInteraction: false
      foodLogs,
      nutritionGoal,
    )

    if (
      result &&
      typeof result === 'object' &&
      'status' in result &&
      result.status === 'web_search_required'
    ) {
      this.logger.error(
        '[analyzeEatingPattern] Unexpected WebSearchRequestToolResult received.',
      )
      return {
        error:
          'Internal error: Unexpected web search request during eating pattern analysis.',
      }
    }
    return result as EatingPatternToolResult | { error: string } | null
  }

  async recommendMeals(
    lineUserId: string,
    userProfile: UserProfileDto,
    mealContext: string,
    language: string = 'th',
    timeConstraint: 'fast' | 'normal' | 'accurate' = 'normal',
  ): Promise<MealRecommendationToolResult | { error: string } | null> {
    this.logger.log(
      `Recommending meals for context: "${mealContext}" for user ID: ${userProfile.id || 'Unknown'}, constraint: ${timeConstraint}`,
    )
    const systemPrompt = this.createMealRecommendationSystemPrompt(
      userProfile,
      language,
      mealContext,
    )
    const userQuery = `Recommend meals for: ${mealContext}.`
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userQuery },
    ]
    const toolToCall = importedMealRecommendationTool

    const result = await this.callOpenAIWithToolHandling<
      MealRecommendationArgs,
      MealRecommendationToolResult
    >(
      lineUserId,
      messages,
      [toolToCall],
      toolToCall.function.name,
      (args: MealRecommendationArgs) =>
        this.handleRecommendMeals(args, userProfile, language, mealContext),
      userProfile,
      language,
      userQuery,
      timeConstraint,
      false, // skipHistoryForToolInteraction: false
    )

    if (
      result &&
      typeof result === 'object' &&
      'status' in result &&
      result.status === 'web_search_required'
    ) {
      this.logger.error(
        '[recommendMeals] Unexpected WebSearchRequestToolResult received.',
      )
      return {
        error:
          'Internal error: Unexpected web search request during meal recommendation.',
      }
    }
    return result as MealRecommendationToolResult | { error: string } | null
  }

  async analyzeBarcode(
    lineUserId: string,
    userProfile: UserProfileDto,
    barcodeDataOrProductInfo: string, // Can be barcode string or product name if AI thinks it found one
    language: string = 'th',
    timeConstraint: 'fast' | 'normal' | 'accurate' = 'normal',
    messageId?: string, // Added messageId
  ): Promise<
    | BarcodeAnalysisToolResult
    | WebSearchRequestToolResult
    | { error: string }
    | null
  > {
    this.logger.log(
      `Analyzing barcode for user ${lineUserId}, data: ${barcodeDataOrProductInfo}, lang: ${language}, messageId: ${messageId}`,
    )
    const systemPrompt = this.createBarcodeAnalysisSystemPrompt(
      userProfile,
      language,
    )
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Please analyze the following barcode data or product information: ${barcodeDataOrProductInfo}`,
      },
    ]

    return this.callOpenAIWithToolHandling<
      BarcodeAnalysisArgs,
      BarcodeAnalysisToolResult
    >(
      lineUserId,
      messages,
      [this.availableTools[importedBarcodeAnalysisTool.function.name]], // Corrected: Pass the actual tool object
      'analyze_barcode_data',
      (args, profile, lang) =>
        this.handleAnalyzeBarcodeData(
          args,
          profile,
          lang,
          barcodeDataOrProductInfo, // Pass the original data to the handler
        ),
      userProfile,
      language,
      `Barcode: ${barcodeDataOrProductInfo}`,
      timeConstraint,
      false, // Don't skip history for barcode analysis unless decided otherwise
      undefined,
      undefined,
      messageId, // Pass messageId
    )
  }

  async answerGeneralNutritionQuestion(
    lineUserId: string,
    userQuery: string,
    userProfile: UserProfileDto,
    language: string = 'th',
    timeConstraint: 'fast' | 'normal' | 'accurate' = 'normal',
    // skipHistoryForToolInteraction is not relevant here as it doesn't call callOpenAIWithToolHandling
  ): Promise<string | null> {
    this.logger.log(
      `Answering general nutrition question: "${userQuery.substring(0, 50)}..." for lang: ${language}, user: ${lineUserId}, constraint: ${timeConstraint}`,
    )

    const systemPrompt = this.createGeneralNutritionPrompt(
      userProfile,
      language,
    )

    // Before calling OpenAI for general questions, get conversation history.
    let messagesForOpenAI: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userQuery },
      ]

    try {
      const history = await this.conversationHistoryService.getRecentHistory(
        lineUserId,
        userProfile,
      )
      if (history && history.length > 0) {
        this.logger.log(
          `Prepending ${history.length} messages from history for general Q&A for user ${lineUserId}.`,
        )
        messagesForOpenAI = [...history, ...messagesForOpenAI]
      }

      // Add current user query to history
      await this.conversationHistoryService.addMessageToHistory(
        lineUserId,
        'user',
        userQuery,
      )

      const { deploymentName, complexityLevel, score } =
        this.selectModelInternal(userQuery, userProfile, timeConstraint)

      this.logger.log(
        `Using deployment: ${deploymentName} (Complexity Level: ${complexityLevel}, Score: ${score}) for general Q&A.`,
      )

      const response = (await this.openaiService.getChatCompletion(
        deploymentName,
        messagesForOpenAI,
        {
          temperature: 0.5,
        },
      )) as OpenAI.Chat.Completions.ChatCompletion | { error: string } // Assertion here

      if ('error' in response) {
        this.logger.error(
          `OpenAI call failed for general Q&A: ${response.error}`,
        )
        if (language === 'th') {
          return `ขออภัยค่ะ เกิดข้อผิดพลาดในการสื่อสารกับ AI: ${response.error}`
        }
        return `Sorry, an error occurred while communicating with the AI: ${response.error}`
      }

      // At this point, response is OpenAI.Chat.Completions.ChatCompletion
      this.logger.log('Received OpenAI response for general Q&A.')
      const choice = response.choices[0]
      if (choice && choice.message && choice.message.content) {
        // Add AI's direct response to history
        await this.conversationHistoryService.addMessageToHistory(
          lineUserId,
          'assistant',
          choice.message.content,
        )
        return choice.message.content
      } else {
        this.logger.error(
          'Invalid response structure from OpenAI for general Q&A.',
        )
        if (language === 'th') {
          return 'ขออภัยค่ะ ไม่สามารถรับข้อมูลการตอบกลับที่ถูกต้องจาก AI ได้ในขณะนี้'
        }
        return 'Sorry, could not get a valid response from the AI at this moment.'
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      this.logger.error(
        `Error in answerGeneralNutritionQuestion: ${message}`,
        error instanceof Error ? error.stack : undefined,
      )
      if (language === 'th') {
        return 'ขออภัยค่ะ เกิดข้อผิดพลาดในการตอบคำถามของคุณในขณะนี้ โปรดลองอีกครั้งภายหลัง'
      }
      return 'Sorry, an error occurred while answering your question. Please try again later.'
    }
  }

  // --- Generic Tool Calling Logic ---
  private async callOpenAIWithToolHandling<ArgsDto, ResultDto extends object>(
    lineUserId: string,
    initialMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    tools: OpenAI.Chat.ChatCompletionTool[],
    expectedToolName: string,
    toolHandler: ToolHandler<ArgsDto, ResultDto>,
    userProfile: UserProfileDto,
    language: string,
    queryForModelSelection: string,
    timeConstraint: 'fast' | 'normal' | 'accurate' = 'normal',
    skipHistoryForToolInteraction: boolean = false,
    foodLogsForHandler?: FoodLogEntryDto[],
    nutritionGoalForHandler?: NutritionGoalDtoForAI | null,
    messageId?: string, // Added messageId, will be used now
  ): Promise<
    ResultDto | WebSearchRequestToolResult | { error: string } | null
  > {
    this.logger.debug(
      `callOpenAIWithToolHandling initiated for user: ${lineUserId}, expectedTool: ${expectedToolName}`,
    )

    let messagesForOpenAI: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
      [...initialMessages]

    try {
      const history = await this.conversationHistoryService.getRecentHistory(
        lineUserId,
        userProfile,
      )
      if (history && history.length > 0) {
        this.logger.log(
          `Prepending ${history.length} messages from history for user ${lineUserId}.`,
        )
        messagesForOpenAI = [...history, ...messagesForOpenAI]
      }

      const userMessageContent = initialMessages
        .filter((msg) => msg.role === 'user')
        .map((msg) => {
          if (typeof msg.content === 'string') {
            return msg.content
          } else if (Array.isArray(msg.content)) {
            return msg.content
              .map((part) => {
                if (part.type === 'text') return part.text
                if (part.type === 'image_url')
                  return `[Image: ${part.image_url.url.substring(0, 50)}...]`
                return '[Unsupported content part]'
              })
              .join(' ')
          }
          return '[Unsupported message format]'
        })
        .join('\n')

      if (userMessageContent && !skipHistoryForToolInteraction) {
        // Modified condition
        await this.conversationHistoryService.addMessageToHistory(
          lineUserId,
          'user',
          userMessageContent,
        )
      } else if (userMessageContent && skipHistoryForToolInteraction) {
        this.logger.log(
          `Skipping user message for history due to skipHistoryForToolInteraction for user ${lineUserId}.`,
        )
      }
      // Removed the warning for empty user message content as it might be intentional when skipping.

      const { deploymentName: resolvedDeploymentName } =
        this.selectModelInternal(
          queryForModelSelection,
          userProfile,
          timeConstraint,
        )

      this.logger.debug(
        `Calling OpenAI service for chat completion with deployment: ${resolvedDeploymentName}, language: ${language}`,
      )

      const toolChoice = tools.find((t) => t.function.name === expectedToolName)
        ? ({ type: 'function', function: { name: expectedToolName } } as const)
        : tools.length > 0
          ? ('auto' as const)
          : undefined

      const response = (await this.openaiService.getChatCompletion(
        resolvedDeploymentName,
        messagesForOpenAI,
        {
          tools: tools,
          tool_choice: toolChoice,
        },
      )) as OpenAI.Chat.Completions.ChatCompletion | { error: string } // Assertion here

      if ('error' in response) {
        this.logger.error(
          `OpenAI call failed in callOpenAIWithToolHandling: ${response.error}`,
        )
        return {
          error:
            language === 'th'
              ? `เกิดข้อผิดพลาดในการสื่อสารกับ AI: ${response.error}`
              : `Error communicating with AI: ${response.error}`,
        }
      }

      // At this point, response is OpenAI.Chat.Completions.ChatCompletion
      const responseMessage = response.choices[0]?.message

      if (
        responseMessage?.tool_calls &&
        responseMessage.tool_calls.length > 0
      ) {
        const toolCall = responseMessage.tool_calls[0]
        if (!toolCall.function) {
          this.logger.error('Tool call object missing function details.')
          return {
            error:
              language === 'th'
                ? 'AI ตอบกลับมาในรูปแบบที่ไม่ถูกต้อง (tool call function missing)'
                : 'AI returned invalid tool call (missing function).',
          }
        }
        this.logger.log(
          `AI called tool: ${toolCall.function.name} for user ${lineUserId}`,
        )

        if (!skipHistoryForToolInteraction) {
          // Modified condition
          const toolCallSummary = `Called tool ${toolCall.function.name} with args: ${toolCall.function.arguments}`
          await this.conversationHistoryService.addMessageToHistory(
            lineUserId,
            'assistant',
            `[Tool Call: ${toolCallSummary}]`,
          )
        } else {
          this.logger.log(
            `Skipping AI tool call summary for history due to skipHistoryForToolInteraction for user ${lineUserId}. Tool: ${toolCall.function.name}`,
          )
        }

        let result:
          | ResultDto
          | WebSearchRequestToolResult
          | { error: string }
          | null = null

        if (
          toolCall.function.name ===
          importedRequestProductInfoFromWebTool.function.name
        ) {
          try {
            if (typeof toolCall.function.arguments === 'string') {
              const toolArgs = JSON.parse(
                toolCall.function.arguments,
              ) as WebSearchRequestArgs
              result = this.handleRequestProductInfoFromWeb(
                toolArgs,
                userProfile,
                language,
              )
            } else {
              this.logger.error(
                `Tool arguments for ${importedRequestProductInfoFromWebTool.function.name} are not a string: ${typeof toolCall.function.arguments}`,
              )
              result = { error: 'Invalid tool arguments format.' }
            }
          } catch (e) {
            this.logger.error(
              `Error parsing arguments or handling ${importedRequestProductInfoFromWebTool.function.name}: ${e instanceof Error ? e.message : String(e)}`,
            )
            result = {
              error:
                language === 'th'
                  ? `เกิดข้อผิดพลาดในการประมวลผลอาร์กิวเมนต์สำหรับ ${importedRequestProductInfoFromWebTool.function.name}`
                  : `Error processing arguments for ${importedRequestProductInfoFromWebTool.function.name}`,
            }
          }
        } else if (toolCall.function.name === expectedToolName) {
          try {
            if (typeof toolCall.function.arguments === 'string') {
              let argsString = toolCall.function.arguments
              this.logger.debug(
                `Original tool arguments for ${expectedToolName}: ${argsString}`,
              )

              // Attempt to clean up common JSON errors from AI
              // 1. Remove trailing commas before a closing brace or bracket (e.g. [1,2,])
              argsString = argsString.replace(/,\s*([}\]])/g, '$1')
              // 2. Remove duplicate commas (e.g. 1,,2)
              argsString = argsString.replace(/,(\s*,)+/g, ',')
              // 3. Remove leading commas after an opening brace or bracket (e.g. {,1,2 or [,1,2)
              argsString = argsString.replace(/([{[])\s*,/g, '$1')
              // 4. Attempt to fix comma between property and value if it looks like "prop": , "value" (very specific)
              // This is heuristic and might need refinement based on actual AI outputs.
              // Example: "food_name":"ข้าวผัดกุ้ง", ,"portion": --> "food_name":"ข้าวผัดกุ้ง","portion":
              // This regex looks for a quote, colon, then spaces/comma(s), then a quote for the next property's value.
              argsString = argsString.replace(/(":\s*),+(?=\s*"\w+":)/g, '$1')
              // Simpler one for "key": ,, "nextKey"
              argsString = argsString.replace(
                /("):\s*,\s*,(?=\s*"\w+":)/g,
                '$1',
              )
              // Specifically for the case: "food_name":"ข้าวผัดกุ้ง", ,"portion"
              argsString = argsString.replace(
                /("[^"]+":"[^"]*"),\s*,(?="[^"]+":)/g,
                '$1,$2',
              )

              this.logger.debug(
                `Attempting to parse cleaned tool arguments for ${expectedToolName}: ${argsString}`,
              )

              try {
                const toolArgs = JSON.parse(argsString) as ArgsDto
                result = await toolHandler(
                  toolArgs,
                  userProfile,
                  language,
                  foodLogsForHandler,
                  nutritionGoalForHandler,
                )

                // CACHING LOGIC STARTS HERE
                if (
                  messageId &&
                  result && // Ensure result is not null or error before caching
                  !(typeof result === 'object' && 'error' in result) && // Not an error object
                  !(
                    typeof result === 'object' &&
                    'status' in result &&
                    (result as WebSearchRequestToolResult).status === // Type assertion for status check
                      'web_search_required'
                  ) && // Not a web search request
                  expectedToolName === importedFoodAnalysisTool.function.name && // Specifically cache food analysis
                  typeof (result as FoodAnalysisToolResult).food_name ===
                    'string' // Basic check for FoodAnalysisToolResult structure
                ) {
                  this.logger.log(
                    `Attempting to cache result for messageId: ${messageId}, tool: ${expectedToolName}`,
                  )
                  this.analysisCacheService.set(
                    messageId,
                    result as FoodAnalysisData, // Type assertion to FoodAnalysisData
                  )
                } else if (messageId) {
                  this.logger.debug(
                    `Skipping cache for messageId: ${messageId}, tool: ${expectedToolName}. Reason: Result type not cachable or condition not met. Result: ${JSON.stringify(result)}`,
                  )
                }
                // CACHING LOGIC ENDS HERE
              } catch (parseError) {
                this.logger.error(
                  `Failed to parse cleaned JSON arguments for ${expectedToolName}. Original string: ${toolCall.function.arguments}. Cleaned string: ${argsString}`,
                  parseError instanceof Error
                    ? parseError.stack
                    : String(parseError),
                )
                result = {
                  error:
                    language === 'th'
                      ? `เกิดข้อผิดพลาดในการประมวลผลข้อมูลจาก AI (JSON Parse Error หลัง clean): ${parseError instanceof Error ? parseError.message : String(parseError)}`
                      : `Error processing data from AI (JSON Parse Error after clean): ${parseError instanceof Error ? parseError.message : String(parseError)}`,
                }
              }

              if (
                result &&
                !(typeof result === 'object' && 'error' in result) &&
                !(
                  typeof result === 'object' &&
                  'status' in result &&
                  (result as WebSearchRequestToolResult).status ===
                    'web_search_required'
                ) &&
                !skipHistoryForToolInteraction // Modified condition
              ) {
                await this.conversationHistoryService.addMessageToHistory(
                  lineUserId,
                  'assistant',
                  `[Tool Result for ${toolCall.function.name}: ${JSON.stringify(result).substring(0, 200)}...]`,
                )
              } else if (
                skipHistoryForToolInteraction &&
                result &&
                !(typeof result === 'object' && 'error' in result) &&
                !(typeof result === 'object' && 'status' in result)
              ) {
                this.logger.log(
                  `Skipping AI tool result for history due to skipHistoryForToolInteraction for user ${lineUserId}. Tool: ${toolCall.function.name}`,
                )
              }
            } else {
              this.logger.error(
                `Tool call arguments are not a string for ${expectedToolName}. Arguments: ${JSON.stringify(toolCall.function.arguments)}`,
              )
              result = {
                error:
                  language === 'th'
                    ? `อาร์กิวเมนต์สำหรับเครื่องมือ '${expectedToolName}' ไม่ถูกต้อง`
                    : `Invalid tool arguments for '${expectedToolName}'`,
              }
            }
          } catch (e) {
            this.logger.error(
              `Error executing tool handler for ${expectedToolName} (outside JSON parsing of args): ${e instanceof Error ? e.message : String(e)}`,
              e instanceof Error ? e.stack : undefined,
            )
            const potentialError = e as {
              status?: unknown
              message?: unknown
              error?: { message?: unknown; [key: string]: any }
              [key: string]: any
            }

            const statusStr =
              typeof potentialError.status === 'string' ||
              typeof potentialError.status === 'number'
                ? String(potentialError.status)
                : 'Unknown Status'
            const messageStr =
              typeof potentialError.message === 'string'
                ? String(potentialError.message)
                : 'No message available'

            if (potentialError.status && potentialError.message) {
              result = {
                error: `Error ${statusStr}: ${messageStr}`,
              }
            } else if (
              potentialError.error &&
              typeof potentialError.error === 'object' &&
              potentialError.error !== null
            ) {
              const nestedError = potentialError.error
              const nestedMessageStr =
                typeof nestedError.message === 'string'
                  ? String(nestedError.message)
                  : 'No nested message available'
              if (nestedError.message) {
                result = {
                  error: `Error: ${nestedMessageStr}`,
                }
              } else {
                result = {
                  error: `Error: ${JSON.stringify(nestedError)}`,
                }
              }
            } else {
              result = {
                error:
                  language === 'th'
                    ? `เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุขณะประมวลผล '${expectedToolName}'`
                    : `Unknown error processing '${expectedToolName}'. Details: ${String(e)}`,
              }
            }
          }
        } else {
          this.logger.warn(
            `AI called an unexpected tool: ${toolCall.function.name}. Expected: ${expectedToolName} or ${importedRequestProductInfoFromWebTool.function.name}`,
          )
          result = {
            error:
              language === 'th'
                ? `AI เรียกใช้เครื่องมือที่ไม่คาดคิด: ${toolCall.function.name}`
                : `AI called an unexpected tool: ${toolCall.function.name}`,
          }
        }
        return result
      } else if (responseMessage?.content) {
        this.logger.log(
          `Received direct text response from AI for user ${lineUserId}. Content length: ${responseMessage.content.length}`,
        )
        if (
          typeof responseMessage.content === 'string' &&
          responseMessage.content.trim() !== ''
        ) {
          await this.conversationHistoryService.addMessageToHistory(
            lineUserId,
            'assistant',
            responseMessage.content,
          )
        } else {
          this.logger.warn(
            `AI response content was null, empty, or not a string for user ${lineUserId}. Not saving to history.`,
          )
        }

        if (
          responseMessage.content && // No need to check typeof string again, already done.
          typeof responseMessage.content === 'string' // Keep for clarity with linter
        ) {
          this.logger.log(
            `AI responded directly for user ${lineUserId} (no tool call): "${responseMessage.content.substring(0, 100)}"`,
          )
          return { error: `AI_DIRECT_RESPONSE: ${responseMessage.content}` }
        } else {
          this.logger.warn(
            `AI response content was null or not a string when expecting direct response for user ${lineUserId}.`,
          )
          return {
            error:
              language === 'th'
                ? 'AI ตอบกลับแต่เนื้อหาไม่ถูกต้อง'
                : 'AI responded but content was invalid',
          }
        }
      } else {
        this.logger.warn(
          `AI did not call any tool nor provided content for user ${lineUserId}. Query: ${queryForModelSelection}. Response: ${JSON.stringify(response)}`,
        )
        return {
          error:
            language === 'th'
              ? 'ขออภัย ฉันไม่สามารถดำเนินการตามคำขอได้ในขณะนี้ (AI ไม่ได้เรียกเครื่องมือและไม่มีการตอบกลับโดยตรง)'
              : 'Sorry, I could not process the request at this time (AI did not call a tool and provided no direct response).',
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.error(
        `Error in callOpenAIWithToolHandling for user ${lineUserId}, tool ${expectedToolName}: ${message}`,
        error instanceof Error ? error.stack : undefined,
      )
      return {
        error:
          language === 'th'
            ? `เกิดข้อผิดพลาดภายใน aoService ขณะเรียก OpenAI: ${message}`
            : `Internal aoService error during OpenAI call: ${message}`,
      }
    }
    return null // Should be handled by specific error returns or results above
  }

  // --- Tool Handler Implementations ---
  private async handleExtractFoodAnalysis(
    args: FoodAnalysisToolResult, // Changed from FoodAnalysisArgs to FoodAnalysisToolResult
    userProfile: UserProfileDto,
    language: string,
  ): Promise<FoodAnalysisToolResult> {
    // Added Promise<>
    this.logger.debug(
      `Handling extract_food_analysis for lang '${language}' with args: ${JSON.stringify(args)} for user ${userProfile.id || 'unknown'}`,
    )
    // The AI is expected to provide all data according to FOOD_ANALYSIS_SCHEMA.
    // This handler's job is primarily to validate and return it.
    // Basic validation (can be expanded):
    if (!args.food_name || typeof args.calories !== 'number') {
      this.logger.warn(
        `Received incomplete or malformed FoodAnalysisToolResult from AI for user ${userProfile.id || 'unknown'}. Args: ${JSON.stringify(args)}`,
      )
      // Potentially return a modified args or throw an error if critical data is missing
      // For now, returning as is, but with a warning logged.
    }

    // Ensure all textual fields are in the correct language (as a fallback, though AI should do this)
    // This is a simplistic check; more robust localization might be needed if AI fails.
    const ensureLang = (text: string | undefined, defaultTextKey: string) => {
      if (text === undefined || text.trim() === '') {
        if (language === 'th') {
          if (defaultTextKey === 'food_name') return 'ไม่ระบุชื่ออาหาร'
          if (defaultTextKey === 'portion') return 'ไม่ระบุปริมาณ'
          return 'รอการวิเคราะห์'
        }
        if (defaultTextKey === 'food_name') return 'Food name not specified'
        if (defaultTextKey === 'portion') return 'Portion not specified'
        return 'Awaiting analysis'
      }
      return text
    }

    // Added to satisfy @typescript-eslint/require-await
    await Promise.resolve()

    return {
      ...args,
      food_name: ensureLang(args.food_name, 'food_name'),
      portion: ensureLang(args.portion, 'portion'),
      // Assuming components, if any, are already in the correct language by AI
      health_benefits: ensureLang(args.health_benefits, 'health_benefits'),
      health_cautions: ensureLang(args.health_cautions, 'health_cautions'),
      recommendation: ensureLang(args.recommendation, 'recommendation'),
      // Numerical values are returned as is.
      // Vitamin/Mineral objects are returned as is, assuming units are standard or AI handles lang.
    }
  }

  private handleCalculateNutritionGoals(
    args: NutritionGoalArgs,
    userProfile: UserProfileDto,
    language: string,
  ): NutritionGoalToolResult {
    this.logger.debug(
      `Handling calculate_nutrition_goals for user ${userProfile.id || 'unknown'} with lang '${language}'. Args (should be empty): ${JSON.stringify(args)}`,
    )
    // TODO: Replace with actual BMR/TDEE calculation based on userProfile
    const calculatedBMR = 1500
    const calculatedTDEE = 2000

    return {
      bmr: calculatedBMR,
      tdee: calculatedTDEE,
      daily_goals: {
        calories: calculatedTDEE,
        protein: Math.round((calculatedTDEE * 0.2) / 4),
        carbs: Math.round((calculatedTDEE * 0.5) / 4),
        fat: Math.round((calculatedTDEE * 0.3) / 9),
        fiber: 25,
        sugar_max: 25,
        water: 2500,
      },
      macro_distribution: {
        protein_percent: 20,
        carbs_percent: 50,
        fat_percent: 30,
      },
      meal_recommendations: {
        breakfast: Math.round(calculatedTDEE * 0.25),
        lunch: Math.round(calculatedTDEE * 0.35),
        dinner: Math.round(calculatedTDEE * 0.3),
        snacks: Math.round(calculatedTDEE * 0.1),
      },
      health_advice:
        language === 'th'
          ? 'นี่คือเป้าหมายโภชนาการเบื้องต้นของคุณ ปรับเปลี่ยนตามความเหมาะสม'
          : 'These are your initial nutrition goals. Adjust as needed.',
      food_recommendations:
        language === 'th'
          ? ['ผักใบเขียว', 'โปรตีนไม่ติดมัน']
          : ['Leafy greens', 'Lean protein'],
      foods_to_avoid:
        language === 'th'
          ? ['น้ำตาลแปรรูป', 'ไขมันทรานส์']
          : ['Processed sugars', 'Trans fats'],
    }
  }

  private handleAnalyzeEatingPattern(
    args: EatingPatternArgs,
    userProfile: UserProfileDto,
    language: string,
    foodLogs: FoodLogEntryDto[] = [], // Provide default empty array if undefined
    nutritionGoal: NutritionGoalDtoForAI | null = null, // Provide default null if undefined
  ): EatingPatternToolResult {
    this.logger.debug(
      `Handling analyze_eating_pattern for user ${userProfile.id || 'unknown'}, lang '${language}'. ` +
        `Args: ${JSON.stringify(args)}. Food logs count: ${foodLogs.length}. Goal set: ${!!nutritionGoal}`,
    )

    // Basic calculations (can be expanded significantly)
    const daysAnalyzed = new Set(
      foodLogs.map((log) => new Date(log.timestamp).toDateString()),
    ).size
    const totalLogs = foodLogs.length
    // TODO: Implement more detailed analysis based on foodLogs and nutritionGoal as in original Node.js version.

    return {
      calories_trend: 'insufficient_data',
      average_daily_calories: 0,
      // ... (other fields as placeholders or based on minimal calculation)
      identified_patterns: [],
      problematic_behaviors: [],
      improvement_suggestions: [],
      personalized_advice:
        language === 'th'
          ? 'ข้อมูลไม่เพียงพอสำหรับการวิเคราะห์รูปแบบการกินโดยละเอียด'
          : 'Insufficient data for detailed eating pattern analysis.',
      basic_analysis_details: {
        days_analyzed: daysAnalyzed,
        total_logs: totalLogs,
        skipped_meal_counts: { breakfast: 0, lunch: 0, dinner: 0 }, // Placeholder
      },
      // Ensure all fields from EatingPatternToolResult are present
      calorie_consistency: undefined,
      meal_timings: [],
      most_skipped_meal: undefined,
      nutrient_balance: undefined,
      eating_window_hours: undefined,
      late_night_eating_frequency: undefined,
    }
  }

  private handleRecommendMeals(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _args: MealRecommendationArgs,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _userProfile: UserProfileDto,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _language: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _mealContext: string,
  ): MealRecommendationToolResult {
    // Implementation of handleRecommendMeals method
    // This is a placeholder and should be replaced with the actual implementation
    return {
      meal_type: '',
      foods: [],
      total_calories: 0,
      total_protein: 0,
      total_carbs: 0,
      total_fat: 0,
      recommendations: '',
      alternatives: [],
    }
  }

  private handleRequestProductInfoFromWeb(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _args: WebSearchRequestArgs,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _userProfile: UserProfileDto,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _language: string,
  ): WebSearchRequestToolResult {
    // Implementation of handleRequestProductInfoFromWeb method
    // This is a placeholder and should be replaced with the actual implementation
    return {
      status: 'web_search_required',
      search_query_for_assistant: '',
      original_product_name: '',
      message_to_user_while_searching: '',
      error_message: '',
    }
  }

  private handleAnalyzeBarcodeData(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _args: BarcodeAnalysisArgs,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _userProfile: UserProfileDto,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _language: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _barcodeDataOrProductInfo: string,
  ): BarcodeAnalysisToolResult {
    // Implementation of handleAnalyzeBarcodeData method
    // This is a placeholder and should be replaced with the actual implementation
    return {
      barcode_type: '',
      barcode_value: '',
      food_info: {
        product_name: '',
        brand: '',
        serving_size: '',
        servings_per_container: 0,
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        sugar: 0,
        saturated_fat: 0,
        trans_fat: 0,
        cholesterol: 0,
        sodium: 0,
        vitamins_minerals: {},
        ingredients: [],
        allergens: [],
        storage_instructions: '',
      },
      nutritional_rating: 0,
      health_benefits: [],
      health_concerns: [],
      personalized_advice: '',
      alternatives: [],
    }
  }

  async createEmbedding(
    text: string,
  ): Promise<EmbeddingResult | { error: string }> {
    try {
      const deploymentName = this.openaiService.getEmbeddingDeploymentName()
      if (!deploymentName) {
        this.logger.error(
          'Embedding deployment name is not configured. Cannot create embedding.',
        )
        return {
          error:
            'Embedding service is not configured. Please contact administrator.',
        }
      }

      this.logger.debug(
        `Requesting embedding from deployment: ${deploymentName} for text: "${text.substring(0, 50)}..."`,
      )

      const response = (await this.openaiService.createEmbedding(
        deploymentName,
        text,
      )) as OpenAI.Embeddings.CreateEmbeddingResponse | { error: string } // Assertion here

      if ('error' in response) {
        this.logger.error(`OpenAI call failed for embedding: ${response.error}`)
        return {
          error: `Failed to create embedding: ${response.error}`,
        }
      }

      // At this point, response is OpenAI.Embeddings.CreateEmbeddingResponse
      if (
        !response.data ||
        !Array.isArray(response.data) ||
        response.data.length === 0
      ) {
        this.logger.error('Invalid or empty data array in embedding response.')
        return {
          error: 'Failed to create embedding: No embedding data returned.',
        }
      }

      const firstEmbeddingData = response.data[0]
      if (
        !firstEmbeddingData ||
        !firstEmbeddingData.embedding ||
        !Array.isArray(firstEmbeddingData.embedding)
      ) {
        this.logger.error(
          'Invalid embedding vector in embedding response data.',
        )
        return {
          error: 'Failed to create embedding: Invalid embedding vector.',
        }
      }

      const usage = response.usage
      if (
        !usage ||
        typeof usage.prompt_tokens !== 'number' ||
        typeof usage.total_tokens !== 'number'
      ) {
        this.logger.error(
          `Invalid or missing usage data in embedding response: ${JSON.stringify(usage)}`,
        )
        return { error: 'Failed to create embedding: Invalid usage data.' }
      }

      const modelUsed = response.model
      if (typeof modelUsed !== 'string') {
        this.logger.error(
          `Invalid or missing model data in embedding response: ${JSON.stringify(modelUsed)}`,
        )
        return { error: 'Failed to create embedding: Invalid model data.' }
      }

      return {
        embedding: firstEmbeddingData.embedding,
        usage: {
          prompt_tokens: usage.prompt_tokens,
          total_tokens: usage.total_tokens,
        },
        modelUsed: modelUsed,
      }
    } catch (error: unknown) {
      this.logger.error(
        `AiService: Failed to create embedding: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
        error instanceof Error ? error.stack : undefined,
      )

      let specificMessage = 'Unknown error during embedding creation.'
      if (error instanceof Error) {
        specificMessage = error.message
      }

      if (error instanceof APIError) {
        specificMessage = `API Error ${error.status || 'Unknown Status'}: ${error.message || 'No specific message from APIError.'}`
        this.logger.error(
          `Specific APIError details - Status: ${error.status}, Type: ${error.type}, Code: ${error.code}, Headers: ${JSON.stringify(error.headers)}`,
        )
      } else if (typeof error === 'object' && error !== null) {
        const potentialError = error as {
          status?: unknown
          message?: unknown
          error?: { message?: unknown; [key: string]: any }
          [key: string]: any
        }

        const statusStr =
          typeof potentialError.status === 'string' ||
          typeof potentialError.status === 'number'
            ? String(potentialError.status)
            : 'Unknown Status'
        const messageStr =
          typeof potentialError.message === 'string'
            ? String(potentialError.message)
            : 'No message available'

        if (potentialError.status && potentialError.message) {
          specificMessage = `Error ${statusStr}: ${messageStr}`
        } else if (
          potentialError.error &&
          typeof potentialError.error === 'object' &&
          potentialError.error !== null
        ) {
          const nestedError = potentialError.error
          const nestedMessageStr =
            typeof nestedError.message === 'string'
              ? String(nestedError.message)
              : 'No nested message available'
          if (nestedError.message) {
            specificMessage = `Error: ${nestedMessageStr}`
          } else {
            specificMessage = `Error: ${JSON.stringify(nestedError)}`
          }
        }
      }

      return {
        error: `Failed to create embedding: ${specificMessage}`,
      }
    }
  }
}
