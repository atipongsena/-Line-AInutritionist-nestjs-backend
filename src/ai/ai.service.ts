import { Injectable, Logger } from '@nestjs/common'
import { OpenAI } from 'openai'
import {
  OpenaiService,
  OpenaiResponseCreateParams,
  OpenaiResponseInputMessage,
  // Removed old custom type guards as AiService will now work with official SDK types
  // ResponsesApiContentItem, // No longer needed
  // hasOutputArray, // No longer needed / will be replaced
  // hasOutputText, // No longer needed / will be replaced
  // hasUsage, // No longer needed / will be replaced
  // isResponsesApiMessage, // No longer needed / will be replaced
} from '../openai/openai.service'
import { APIError } from 'openai/error'
import {
  eatingPatternTool,
  foodAnalysisTool,
  foodHistoryTool,
  mealRecommendationTool,
  nutritionGoalTool,
  conversationalFoodHistoryTool,
} from './ai.tools'
import { ConversationHistoryService } from '../conversation-history/conversation-history.service'
import { AnalysisCacheService } from '../analysis-cache/analysis-cache.service'
import { UserProfileDto } from '../user/user.interface' // Import UserProfileDto
import { AI_CONFIG, AiTaskType, OpenAiChatParameters } from './ai.config' // Added import
import { PromptCachingService } from './prompt-caching.service' // Added for prompt optimization
import { MetaPromptsService } from './meta-prompts.service' // Added for advanced prompting
import { FoodLogService } from '../food-log/food-log.service' // Added for food history retrieval

// Define the new result type for non-food images
export interface NonFoodDescriptionResult {
  type: 'non_food_description'
  description: string // Combined description and joke
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
  // Fat breakdown
  saturated_fat?: number
  trans_fat?: number // Added trans_fat
  polyunsaturated_fat?: number // Added polyunsaturated_fat
  monounsaturated_fat?: number // Added monounsaturated_fat
  omega3?: number
  cholesterol?: number
  // Carbohydrate breakdown
  fiber?: number
  sugar?: number
  added_sugar?: number // Added added_sugar
  // Other nutrients
  water?: number
  sodium?: number
  potassium_nutrient?: number // Added potassium_nutrient (from schema)
  caffeine?: number // Added caffeine
  alcohol?: number // Added alcohol
  // Vitamins - matching example + schema
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
  copper?: VitaminMineralDetail // Added copper
  manganese?: VitaminMineralDetail // Added manganese
  iodine?: VitaminMineralDetail // Added iodine
  health_benefits: string
  health_cautions: string
  recommendation: string
  confidence_score?: number // Added
  tags?: string[] // Added
  imageUrl?: string // Added imageUrl
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

// --- FOOD HISTORY TOOL ---
// Args for get_food_history tool
export interface FoodHistoryArgs {
  days?: number // Number of days to retrieve (default: 30, max: 90)
  limit?: number // Maximum number of logs (default: 100, max: 500)
}

// Result from handleGetFoodHistory, returns array of food logs for AI analysis
export interface FoodHistoryToolResult {
  food_logs: Array<{
    timestamp: string // ISO string for easier JSON handling
    mealType: string
    foodName: string
    calories: number
    protein: number
    carbs: number
    fat: number
    fiber?: number
  }>
  summary: {
    total_logs: number
    days_covered: number
    date_range: {
      start: string // ISO string
      end: string // ISO string
    }
    meal_types_distribution: {
      breakfast: number
      lunch: number
      dinner: number
      snack: number
      other: number
    }
  }
  message: string // Human-readable summary for AI context
}

// --- CONVERSATIONAL FOOD HISTORY TOOL ---
export interface ConversationalFoodHistoryArgs {
  query_type:
    | 'recent_meals'
    | 'specific_date'
    | 'date_range'
    | 'meal_type_analysis'
    | 'nutrition_summary'
    | 'eating_patterns'
    | 'food_frequency'
    | 'calorie_trends'
    | 'comparison'
    | 'general_question'
  time_period?: {
    days?: number
    specific_date?: string
    start_date?: string
    end_date?: string
  }
  filters?: {
    meal_types?: ('breakfast' | 'lunch' | 'dinner' | 'snack')[]
    food_names?: string[]
    min_calories?: number
    max_calories?: number
  }
  analysis_focus?: (
    | 'calories'
    | 'protein'
    | 'carbs'
    | 'fat'
    | 'fiber'
    | 'meal_timing'
    | 'food_variety'
    | 'portion_sizes'
    | 'eating_frequency'
    | 'nutritional_balance'
  )[]
  user_question: string
}

export interface ConversationalFoodHistoryResult {
  answer: string
  data_summary: {
    total_logs_analyzed: number
    date_range: {
      start: string
      end: string
    }
    key_insights: string[]
  }
  recommendations?: string[]
  follow_up_suggestions?: string[]
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

// เพิ่ม interface ใหม่หลัง line 116
export interface EnhancedAnalysisComponents {
  personalizedAdvice: string
  identifiedPatterns: string[]
  improvementSuggestions: string[]
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name)

  // Available tools mapping - ensure names match exactly what AI is trained to use
  private readonly availableTools = {
    [foodAnalysisTool.function.name]: foodAnalysisTool,
    [nutritionGoalTool.function.name]: nutritionGoalTool,
    [eatingPatternTool.function.name]: eatingPatternTool,
    [mealRecommendationTool.function.name]: mealRecommendationTool,
    [foodHistoryTool.function.name]: foodHistoryTool,
    [conversationalFoodHistoryTool.function.name]:
      conversationalFoodHistoryTool,
  }

  constructor(
    private readonly openaiService: OpenaiService,
    private readonly conversationHistoryService: ConversationHistoryService, // Injected service
    private readonly analysisCacheService: AnalysisCacheService, // Added injection
    private readonly promptCachingService: PromptCachingService, // Added for prompt optimization
    private readonly metaPromptsService: MetaPromptsService, // Added for advanced prompting
    private readonly foodLogService: FoodLogService, // Added for food history retrieval
  ) {
    // Validate configuration on startup
    if (!this.openaiService.getGpt41DeploymentName()) {
      this.logger.warn(
        'GPT-4.1 deployment not configured. Some features may be limited.',
      )
    }
  }

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
      'condition',
      'symptom',
      'allergy',
      'restriction',
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
        (c) =>
          c.toLowerCase() === 'none' ||
          c.toLowerCase() === 'ไม่มี' ||
          c.trim() === '',
      )
    ) {
      score += 5
      healthRelated = true
    }
    if (
      userProfile.foodAllergies &&
      userProfile.foodAllergies.length > 0 &&
      !userProfile.foodAllergies.some(
        (a) =>
          a.toLowerCase() === 'none' ||
          a.toLowerCase() === 'ไม่มีแพ้' ||
          a.trim() === '',
      )
    ) {
      score += 4
      healthRelated = true
    }

    let complexityLevel = 1 // Default to mini
    if (score >= 4 && score < 7) {
      complexityLevel = 2
    } else if (score >= 7 && score < 10) {
      complexityLevel = 3
    } else if (score >= 20) {
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
    taskType: AiTaskType, // Changed from isFoodAnalysisTask
  ): {
    deploymentName: string
    complexityLevel: number
    score: number
    params: OpenAiChatParameters // Changed from temperature to params
  } {
    const {
      complexityLevel,
      score,
      healthRelated,
    } = // healthRelated is kept for model selection logic
      this.classifyQueryInternal(query, userProfile)

    let useFullModel = false

    // Determine base model (full or mini) - This logic remains largely the same
    if (complexityLevel === 4) {
      useFullModel = true
      this.logger.log(
        `High complexity (level 4, score ${score}), selecting gpt-4.1 for task: ${taskType}`,
      )
    } else if (complexityLevel === 3) {
      if (timeConstraint === 'accurate') {
        useFullModel = true
      }
      this.logger.log(
        `Complexity level 3 (score ${score}), healthRelated: ${healthRelated}, timeConstraint: '${timeConstraint}'. Task: ${taskType}. Use full model: ${useFullModel}`,
      )
    } else {
      // Complexity level 1 or 2, generally use mini model unless 'accurate' constraint bumps it up
      this.logger.log(
        `Complexity level ${complexityLevel} (score ${score}), normally selecting gpt-4.1-mini for task: ${taskType}`,
      )
    }

    // Adjust useFullModel based on constraints if not already determined by high complexity
    if (
      !useFullModel &&
      timeConstraint === 'accurate' &&
      complexityLevel >= 2
    ) {
      useFullModel = true
      this.logger.log(
        `'accurate' constraint with complexity level ${complexityLevel}, overriding to gpt-4.1 for task: ${taskType}`,
      )
    } else if (
      useFullModel &&
      timeConstraint === 'fast' &&
      complexityLevel < 4
    ) {
      useFullModel = false
      this.logger.log(
        `'fast' constraint with complexity level ${complexityLevel}, overriding to gpt-4.1-mini for task: ${taskType}`,
      )
    }

    const gpt41DeploymentName = this.openaiService.getGpt41DeploymentName()
    const gpt41_miniDeploymentName =
      this.openaiService.getGpt41_miniModelDeployment()
    let deploymentName: string

    if (useFullModel) {
      if (gpt41DeploymentName) {
        deploymentName = gpt41DeploymentName
      } else if (gpt41_miniDeploymentName) {
        this.logger.warn(
          'GPT-4.1 preferred but not configured, falling back to GPT-4.1 (mini).',
        )
        deploymentName = gpt41_miniDeploymentName
        // useFullModel = false; // Reflect that we are not using the full model (already handled)
      } else {
        this.logger.error(
          'Neither GPT-4.1 nor GPT-4.1 (mini) deployments are configured لیے task: ${taskType}',
        )
        throw new Error(
          'No suitable OpenAI model deployments are configured for this task.',
        )
      }
    } else {
      if (gpt41_miniDeploymentName) {
        deploymentName = gpt41_miniDeploymentName
      } else if (gpt41DeploymentName) {
        this.logger.warn(
          'GPT-4.1 (mini) preferred but not configured, falling back to GPT-4.1 for task: ${taskType}',
        )
        deploymentName = gpt41DeploymentName
      } else {
        this.logger.error(
          'Neither GPT-4.1 (mini) nor GPT-4.1 deployments are configured for task: ${taskType}',
        )
        throw new Error(
          'No suitable OpenAI model deployments are configured for this task.',
        )
      }
    }

    // Get parameters from config
    const taskParams = AI_CONFIG.taskSpecificParameters[taskType] || {}
    const defaultParams = AI_CONFIG.defaultParameters
    const finalParams: OpenAiChatParameters = {
      ...defaultParams,
      ...taskParams, // Task-specific params override defaults
    }

    this.logger.log(
      `Selected model for task ${taskType}: ${deploymentName} (Full model used: ${useFullModel}). Parameters: ${JSON.stringify(finalParams)}`,
    )
    return { deploymentName, complexityLevel, score, params: finalParams }
  }

  // --- System Prompt Creation Methods ---
  private createFoodAnalysisSystemPrompt(
    userProfile: UserProfileDto,
    language: string, // Language now taken from userProfile if available, else default
    imageUrl?: string,
    foodDescription?: string,
  ): string {
    // Use new prompt optimization services
    const metaPrompt = this.metaPromptsService.generateTaskMetaPrompt(
      AiTaskType.FoodAnalysis,
      userProfile,
      {
        hasImage: !!imageUrl,
        description: foodDescription,
      },
    )

    const staticInstructions = `You are a friendly AI nutritionist chatbot operating on LINE messaging platform, specializing in analyzing Thai and international food. You communicate warmly and use emojis generously to make interactions engaging and supportive.

AGENTIC WORKFLOW REMINDERS:
- You are an agent: Keep working until the problem is completely solved
- Use tools - don't guess
- Plan before each function call

MAIN MISSION: Analyze food and provide accurate, personalized nutritional recommendations for LINE users

Handling non-food images:
If you find that the sent image is not food (e.g., animals, objects, people, nature, packaging):
- Respond in a friendly, humorous, and entertaining way 😄
- Call the user by name: "${userProfile.displayName || 'เพื่อน'}"
- Make playful jokes and witty comments about what you see 🎭
- Be creative and entertaining while staying friendly 🌟
- Invite them to send food images instead
- Use lots of emojis to enhance engagement (😂, 🤣, 😄, 🍽️, 📸, 🍎, 🥗, 💪, etc.)
- DO NOT use extract_food_analysis tool when it's not food
- Keep the tone light, fun, and conversational

Food analysis principles:
1. **🍽️ Identify and separate multiple foods in the image**
   - If there are multiple dishes/foods in one image, analyze each separately
   - Provide individual nutritional breakdown for each food item
   - Consider cross-contamination of flavors/ingredients between dishes
   - Note if foods are served together intentionally (like rice with curry)

2. **🔍 Estimate remaining food quantity naturally (VERY IMPORTANT!)**
   - Describe remaining amount in natural language with actual measurements
   - Use realistic portion descriptions instead of percentages

3. **📏 Estimate realistic portion sizes**
   - Use standard serving sizes as reference
   - Consider plate/bowl size in the image
   - Account for food density and weight

4. **🧮 Calculate nutritional values accurately**
   - Use standard nutrition databases (USDA, Thai Department of Health)
   - **Adjust calculations based on actual remaining quantity described**
   - Account for cooking method effects on nutrition

5. **👤 Provide personalized recommendations**
   - Consider user's health profile and dietary needs
   - Suggest improvements or alternatives when appropriate

**🎯 Natural quantity assessment examples:**
- **Nearly full serving**: "This looks like a standard portion of [food], approximately [amount] grams"
- **Partially consumed**: "About half the original serving remains, roughly [amount] grams left"
- **Almost finished**: "Just a few spoonfuls remaining, approximately [amount] grams"
- **Multiple items**: "Rice: about 1/3 cup left (80g), Curry: 4-5 tablespoons remaining (100ml)"

**🍱 Multiple foods handling:**
- **Separate analysis**: Analyze each food item individually
- **Combined effects**: Note how foods complement each other nutritionally
- **Portion relationships**: Consider if foods are meant to be eaten together
- **Individual recommendations**: Provide specific advice for each food type

Health assessment:
- Analyze health benefits and risks
- Consider medical conditions, food allergies, and health goals
- Provide improvement or substitution recommendations
- Suggest appropriate consumption portions

Quality standards for LINE chatbot:
- Use metric units (grams, kilograms, centimeters)
- Specify confidence level in assessment
- Consider user's cultural context
- Provide practical, actionable recommendations
- Use friendly but professional language
- Include generous emojis for engagement
- Address user by name naturally
- Make interactions feel personal and supportive`

    const dynamicContext = `
Analyze this food image in detail:
${imageUrl ? `Food image: ${imageUrl}` : ''}
${foodDescription ? `Description: ${foodDescription}` : ''}

Analysis Instructions:
- If multiple foods/dishes are visible, analyze each one separately
- Describe remaining quantities using natural language with actual measurements
- Use realistic portion sizes (grams, cups, tablespoons, etc.)
- For products or packaging: Analyze based on visible information, estimate if data is insufficient

Please use the extract_food_analysis tool to analyze and return complete nutritional information. If multiple foods are present, focus on the main dish or ask for clarification if needed.`

    // Create optimized prompt with caching
    const { prompt, cachingEligible } =
      this.promptCachingService.createPromptWithMetrics(
        'Food Analysis',
        staticInstructions,
        dynamicContext,
        userProfile,
      )

    if (!cachingEligible) {
      this.logger.warn(
        `Food analysis prompt may not benefit from caching optimization`,
      )
    }

    // Combine optimized prompt with meta-prompt (static instructions first for priority)
    return `${prompt}\n\n${metaPrompt}`
  }

  private createNutritionGoalSystemPrompt(
    userProfile: UserProfileDto,
    language: string = 'th',
  ): string {
    const {
      gender,
      age,
      weightKg,
      heightCm,
      activityLevel,
      goal,
      dietType,
      healthConditions,
      foodAllergies,
      pregnancyLactationStatus, // New
      ethicalFoodConsiderations, // New
      // preferredCuisine, // Potentially useful but not directly for goal calculation
      // preferredFlavorProfiles, // Potentially useful but not directly for goal calculation
    } = userProfile

    let bmi = 'not specified'
    if (userProfile.weightKg && userProfile.heightCm) {
      // Changed
      bmi = (userProfile.weightKg / (userProfile.heightCm / 100) ** 2).toFixed(
        1,
      )
    }

    // GPT-4.1 Prompting Guide Recommendations
    const agentPersistenceReminder =
      "You are an agent - please keep going until the user's query is completely resolved, before ending your turn and yielding back to the user. Only terminate your turn when you are sure that the problem is solved."
    const agentToolCallingReminder = `You MUST use the '${nutritionGoalTool.function.name}' tool to provide the calculated nutrition goals. Do not attempt to answer directly without using the tool.`
    // Planning reminder might be less critical here as it's a direct calculation task by a tool.

    return `You are an AI nutritionist. Your task is to calculate personalized nutrition goals for the user.

${agentPersistenceReminder}
${agentToolCallingReminder}

USER INFO (for context, do not repeat in tool output unless specified by schema):
- Lang: ${language}
- Gender: ${gender || 'not specified'}
- Age: ${age || 'not specified'} years
- Weight: ${weightKg || 'not specified'} kg
- Height: ${heightCm || 'not specified'} cm
- BMI: ${bmi}
- Activity Level: ${activityLevel || 'not specified'}
- Goal: ${goal || 'not specified'}
- Diet Type: ${dietType || 'normal'}
- Pregnancy/Lactation: ${pregnancyLactationStatus || 'N/A'} // New
- Ethical Food Considerations: ${ethicalFoodConsiderations?.join(', ') || 'N/A'} // New
- Food Allergies: ${foodAllergies?.join(', ') || 'none'}
- Health Conditions: ${healthConditions?.join(', ') || 'none'}

TASK SPECIFICS:
1. Calculate BMR (Mifflin-St Jeor equation based on User Info).
2. Calculate TDEE (Total Daily Energy Expenditure) based on activity level from User Info.
3. Determine optimal macronutrient distribution based on goal and diet type from User Info.
4. Set targets for vitamins, minerals, fiber, and water where appropriate, considering User Info.
5. ALL TEXTUAL OUTPUTS within the tool arguments MUST BE in ${language.toUpperCase()}.
6. You MUST call the '${nutritionGoalTool.function.name}' tool with all the calculated values as per its schema. Do not provide a conversational answer; the tool call is your primary output.
`
  }

  private createEatingPatternSystemPrompt(
    userProfile: UserProfileDto,
    language: string = 'th',
    foodLogsSummary?: string,
    nutritionGoalSummary?: string,
  ): string {
    const {
      gender,
      age,
      weightKg,
      heightCm,
      goal,
      dietType,
      activityLevel,
      pregnancyLactationStatus,
      ethicalFoodConsiderations,
      preferredCuisine,
      preferredFlavorProfiles,
      foodAllergies,
      healthConditions,
    } = userProfile

    let bmi = 'not specified'
    if (weightKg && heightCm) {
      bmi = (weightKg / (heightCm / 100) ** 2).toFixed(1)
    }

    // GPT-4.1 Prompting Guide Recommendations
    const agentPersistenceReminder =
      "You are an agent - please keep going until the user's query is completely resolved, before ending your turn and yielding back to the user. Only terminate your turn when you are sure that the problem is solved."
    const agentToolCallingReminder = `You MUST use the '${eatingPatternTool.function.name}' tool to provide the analysis of eating patterns. Do not attempt to answer directly without using the tool.`
    const agentPlanningReminder =
      'You MUST plan extensively before calling the tool, considering all provided user information, food log summaries, and nutrition goal summaries. Reflect on how these pieces of information connect to identify patterns.'

    return `You are an AI nutritionist specializing in analyzing eating patterns.

${agentPersistenceReminder}
${agentToolCallingReminder}
${agentPlanningReminder}

USER INFO (for context, do not repeat in tool output unless specified by schema):
- Lang: ${language}
- Gender: ${gender || 'not specified'}
- Age: ${age || 'not specified'} years
- Weight: ${weightKg || 'not specified'} kg
- Height: ${heightCm || 'not specified'} cm
- BMI: ${bmi}
- Goal: ${goal || 'not specified'}
- Diet Type: ${dietType || 'normal'}
- Activity Level: ${activityLevel || 'not specified'}
- Pregnancy/Lactation: ${pregnancyLactationStatus || 'N/A'}
- Ethical Food Considerations: ${ethicalFoodConsiderations?.join(', ') || 'N/A'}
- Preferred Cuisine: ${preferredCuisine?.join(', ') || 'N/A'}
- Preferred Flavors: ${preferredFlavorProfiles?.join(', ') || 'N/A'}
- Food Allergies: ${foodAllergies?.join(', ') || 'none'}
- Health Conditions: ${healthConditions?.join(', ') || 'none'}

DATA SUMMARIES (for your analysis before calling the tool):
- Food Logs Summary: ${foodLogsSummary || 'No food logs provided or logs are empty.'}
- Nutrition Goal Summary: ${nutritionGoalSummary || 'Nutrition goal not set or not provided.'}

TASK SPECIFICS:
1. Analyze the user's eating patterns based on all available information (User Info, Food Logs Summary, Nutrition Goal Summary).
2. Identify trends, habits, and potential issues.
3. Provide personalized recommendations and insights THROUGH the tool.
4. ALL TEXTUAL OUTPUTS within the tool arguments MUST BE in ${language.toUpperCase()}.
5. You MUST call the '${eatingPatternTool.function.name}' tool with your comprehensive analysis as per its schema.

ANALYSIS REQUIREMENTS (guide your thinking before populating tool arguments):
- Caloric distribution across meals.
- Macronutrient balance against goals or general recommendations.
- Meal timing patterns and consistency.
- Identification of nutritional gaps.
- Common eating behaviors (e.g., skipped meals, late-night eating, eating window).
- How current patterns align or misalign with the user's stated 'Goal' and 'Diet Type'.
`
  }

  private createMealRecommendationSystemPrompt(
    userProfile: UserProfileDto,
    language: string = 'th',
    mealContext: string = 'any meal', // e.g., "breakfast", "a high-protein snack"
  ): string {
    const {
      goal,
      dietType,
      foodAllergies,
      healthConditions,
      gender,
      age,
      weightKg,
      heightCm,
      activityLevel,
      pregnancyLactationStatus, // New
      ethicalFoodConsiderations, // New
      preferredCuisine, // New
      preferredFlavorProfiles, // New
    } = userProfile

    let bmi = 'not specified'
    if (weightKg && heightCm) {
      bmi = (weightKg / (heightCm / 100) ** 2).toFixed(1)
    }

    // GPT-4.1 Prompting Guide Recommendations
    const agentPersistenceReminder =
      "You are an agent - please keep going until the user's query is completely resolved, before ending your turn and yielding back to the user. Only terminate your turn when you are sure that the problem is solved."
    const agentToolCallingReminder = `You MUST use the '${mealRecommendationTool.function.name}' tool to provide meal recommendations. Do not attempt to answer directly without using the tool.`
    const agentPlanningReminder =
      "You SHOULD plan and consider the user's profile (goal, diet, allergies, preferences, etc.) and the meal context carefully before formulating the arguments for the tool call. Briefly outline your reasoning if it helps select appropriate recommendations."

    return `You are a friendly AI nutritionist chatbot operating on LINE messaging platform. Your task is to recommend suitable meals for "${mealContext}" based on the user's profile. You communicate warmly and will eventually present results in an engaging, emoji-rich format to LINE users.

${agentPersistenceReminder}
${agentToolCallingReminder}
${agentPlanningReminder}

USER INFO (for context, do not repeat in tool output unless specified by schema):
- Name: ${userProfile.displayName || 'User'}
- Lang: ${language}
- Gender: ${gender || 'not specified'}
- Age: ${age || 'not specified'}
- Weight: ${weightKg || 'not specified'} kg
- Height: ${heightCm || 'not specified'} cm
- BMI: ${bmi}
- Goal: ${goal || 'not specified'}
- Diet Type: ${dietType || 'normal'}
- Activity Level: ${activityLevel || 'moderate'}
- Pregnancy/Lactation: ${pregnancyLactationStatus || 'N/A'}
- Ethical Food Considerations: ${ethicalFoodConsiderations?.join(', ') || 'N/A'}
- Preferred Cuisine: ${preferredCuisine?.join(', ') || 'N/A'}
- Preferred Flavors: ${preferredFlavorProfiles?.join(', ') || 'N/A'}
- Food Allergies: ${foodAllergies?.join(', ') || 'none'}
- Health Conditions: ${healthConditions?.join(', ') || 'none'}

TASK SPECIFICS AS LINE CHATBOT:
1. Recommend 1-3 suitable meal options based on the user's profile and the specified "${mealContext}".
2. Focus on meals that support their health 'Goal' and align with their 'Diet Type'.
3. Strictly consider dietary restrictions, 'Food Allergies', and 'Health Conditions'.
4. Factor in 'Ethical Food Considerations', 'Preferred Cuisine', and 'Preferred Flavor Profiles'.
5. Provide detailed nutritional information for each recommendation when calling the tool.
6. ALL TEXTUAL OUTPUTS within the tool arguments (food names, descriptions, ingredients, etc.) MUST BE in ${language.toUpperCase()}.
7. You MUST call the '${mealRecommendationTool.function.name}' tool with your recommendations as per its schema.
8. Remember that your recommendations will be presented to users on LINE with emojis and engaging formatting.

MEAL CRITERIA (guide your thinking for tool arguments):
- Match potential caloric needs for the "${mealContext}".
- Ensure proper macronutrient distribution suitable for the user.
- Be culturally appropriate (especially if language is 'th', lean towards Thai or adaptable international dishes).
- Suggest meals with easily accessible ingredients where possible.
- Recommendations should be practical to prepare.
- Consider that presentation will be engaging and emoji-rich for LINE users.
`
  }

  private createConversationalFoodHistorySystemPrompt(
    userProfile: UserProfileDto,
    language: string = 'th',
  ): string {
    return `You are a friendly AI nutritionist chatbot operating on LINE messaging platform. You specialize in answering questions about user's food history in a natural, engaging, and supportive way. You communicate with warmth and use emojis generously to make conversations more lively and encouraging.

User Profile:
- Name: ${userProfile.displayName || 'User'}
- Age: ${userProfile.age || 'Not specified'} years
- Gender: ${userProfile.gender || 'Not specified'}
- Weight: ${userProfile.weightKg || 'Not specified'} kg
- Height: ${userProfile.heightCm || 'Not specified'} cm
- Activity Level: ${userProfile.activityLevel || 'Not specified'}
- Goal: ${userProfile.goal || 'Not specified'}
- Health Conditions: ${userProfile.healthConditions?.join(', ') || 'None'}
- Food Allergies: ${userProfile.foodAllergies?.join(', ') || 'None'}

Your responsibilities as a LINE chatbot:
1. Analyze user's questions about their food history with empathy and understanding
2. Use the answer_food_history_question tool to retrieve and analyze relevant data
3. Provide natural, conversational answers with helpful recommendations
4. Use generous emojis throughout responses to enhance engagement (🍎, 🥗, 💪, ✨, 💡, 👍, 🌟, 💚, 🎯, 📊)
5. Maintain an encouraging, supportive tone even when discussing areas for improvement
6. Address user by name naturally in responses
7. Make insights feel accessible and actionable

Communication guidelines as LINE chatbot:
- Respond in ${language.toUpperCase()} language
- Use friendly, easy-to-understand language
- Provide accurate and helpful information with scientific backing
- Always offer positive, constructive recommendations
- Use emojis naturally to enhance readability and engagement
- If no data is available, explain supportively and suggest helpful alternatives
- Celebrate positive patterns and gently guide improvements
- Make conversations feel personal and encouraging`
  }

  private createGeneralNutritionPrompt(
    userProfile: UserProfileDto,
    language: string = 'th',
  ): string {
    const {
      gender,
      age,
      goal,
      dietType,
      healthConditions,
      foodAllergies,
      pregnancyLactationStatus,
      ethicalFoodConsiderations,
      preferredCuisine,
      preferredFlavorProfiles,
      weightKg,
      heightCm,
    } = userProfile
    this.logger.debug(
      `Creating general nutrition prompt for language: ${language}`,
    )

    // GPT-4.1 Prompting Guide Recommendations
    const agentPersistenceReminder =
      "You are an agent - please keep going until the user's query is completely resolved. If you have answered the question thoroughly, you can end your turn. If the user asks a follow-up, continue the conversation."
    // Modified tool calling reminder for non-tool use case
    const agentNoToolReminder =
      "For this request, you should NOT use any tools. Your task is to provide a direct, comprehensive textual answer to the user's nutrition-related question based on your knowledge and the provided user context."
    // Planning reminder is still good for structuring a good answer.
    const agentPlanningReminder =
      "Think step-by-step to formulate a clear, accurate, and helpful answer. Consider the user's profile when tailoring your response."

    return `You are a friendly AI nutritionist chatbot operating on LINE messaging platform. You are warm, supportive, and knowledgeable in providing nutrition and food consultation. You communicate in an engaging, encouraging manner and use emojis generously to make conversations more lively and supportive.

${agentPersistenceReminder}
${agentNoToolReminder}
${agentPlanningReminder}

User Profile (for customizing answers - do not repeat these details unless directly relevant to the question):
- Name: ${userProfile.displayName || 'User'}
- Language: ${language}
- Gender: ${gender || 'Not specified'}
- Age: ${age || 'Not specified'} years
- Weight: ${weightKg || 'Not specified'} kg
- Height: ${heightCm || 'Not specified'} cm
- Goal: ${goal || 'Not specified'}
- Diet Type: ${dietType || 'Normal'}
- Health Conditions: ${healthConditions?.join(', ') || 'None'}
- Food Allergies: ${foodAllergies?.join(', ') || 'None'}
- Pregnancy/Lactation Status: ${pregnancyLactationStatus || 'Not applicable'}
- Ethical Food Considerations: ${ethicalFoodConsiderations?.join(', ') || 'None'}
- Preferred Cuisine: ${preferredCuisine?.join(', ') || 'Not specified'}
- Preferred Flavors: ${preferredFlavorProfiles?.join(', ') || 'Not specified'}

Your main responsibilities as a LINE chatbot:
1. Answer nutrition and food-related questions accurately
2. Base responses on scientific evidence
3. Provide personalized recommendations when relevant to user profile
4. Always respond in ${language.toUpperCase()} only
5. Do not use any tools - provide direct textual responses
6. Address user naturally as "${userProfile.displayName || 'User'}"
7. Use emojis generously throughout responses (🍎, 🥗, 💪, ✨, 💡, 👍, 🌟, 💚, 🎯, 📚)
8. Maintain an encouraging, supportive tone

Handling off-topic questions:
- If user's question is not related to food, nutrition, health, or eating (e.g., asking about weather, politics, personal opinions, or unrelated topics):
    1. Politely mention that your expertise is in nutrition and food
    2. Add light humor like "I'm more expert in nutritional atmosphere than weather atmosphere, ${userProfile.displayName || 'User'}! But I hope it's a good day for healthy meals"
    3. Do not attempt to answer the unrelated question
    4. Guide conversation back to nutrition when possible

Guidelines for nutrition-related questions:
- Be clear, concise, and practical
- Use encouraging and positive language
- Make recommendations feel achievable
- Use emojis naturally to enhance engagement
- Celebrate healthy choices and motivate progress`
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
    | NonFoodDescriptionResult // Added new result type
    | { error: string }
    | null
  > {
    try {
      this.logger.log(
        `🚀 [analyzeFoodOrMeal] Starting food analysis for user ${lineUserId} - messageId: ${messageId}`,
      )

      // 🔍 ติดตาม API calls
      this.logger.warn(
        `🔍 [API TRACKING] analyzeFoodOrMeal - API Call #1 incoming for user ${lineUserId}`,
      )

      // Generate meta-prompt for enhanced reasoning
      const metaPrompt = this.metaPromptsService.generateTaskMetaPrompt(
        AiTaskType.FoodAnalysis,
        userProfile,
        { hasImage: !!imageUrl, description: text },
      )

      // Create optimized system prompt with caching
      const systemPrompt = this.promptCachingService.createOptimizedPrompt(
        'Food Analysis',
        metaPrompt,
        text,
        userProfile,
        'Food analysis tools available',
      )

      // Prepare user input for Responses API with proper image handling
      const userInput: OpenaiResponseInputMessage[] = [
        {
          role: 'user',
          content: imageUrl
            ? [
                {
                  type: 'input_text',
                  text: `Please analyze this food: ${text}`,
                },
                {
                  type: 'input_image',
                  image_url: imageUrl,
                  detail: 'high',
                },
              ]
            : [
                {
                  type: 'input_text',
                  text: `Please analyze this food: ${text}`,
                },
              ],
        },
      ]

      // Use Responses API with agentic workflow
      const result = await this.executeAgenticTaskWithResponsesAPI<
        FoodAnalysisToolResult,
        FoodAnalysisToolResult
      >(
        lineUserId,
        systemPrompt,
        userInput,
        [foodAnalysisTool], // Only use foodAnalysisTool for direct analysis
        foodAnalysisTool.function.name,
        this.handleExtractFoodAnalysisWrapper,
        userProfile,
        language,
        AiTaskType.FoodAnalysis,
        timeConstraint,
        undefined, // foodLogsForHandler
        undefined, // nutritionGoalForHandler
        messageId,
      )

      // Check for non-food detection
      if (
        result &&
        typeof result === 'object' &&
        'food_name' in result &&
        result.food_name === 'NON_FOOD_IMAGE_DETECTED'
      ) {
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

      // Log caching metrics
      const promptMetrics = this.promptCachingService.createPromptWithMetrics(
        'Food Analysis',
        metaPrompt,
        text,
        userProfile,
      )

      if (!promptMetrics.cachingEligible) {
        this.logger.warn(
          `Food analysis prompt may not benefit from caching optimization`,
        )
      }

      this.logger.debug(
        `Food analysis prompt tokens: ${promptMetrics.estimatedTokens} (caching eligible: ${promptMetrics.cachingEligible})`,
      )

      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.error(
        `analyzeFoodOrMeal error for user ${lineUserId}: ${message}`,
      )
      return { error: `Food analysis failed: ${message}` }
    }
  }

  async calculateNutritionGoalsForUser(
    lineUserId: string,
    userProfile: UserProfileDto,
    language: string = 'th',
    timeConstraint: 'fast' | 'normal' | 'accurate' = 'normal',
  ): Promise<NutritionGoalToolResult | { error: string } | null> {
    try {
      this.logger.log(
        `[Enhanced Responses API] Starting nutrition goal calculation for user ${lineUserId}`,
      )

      // Generate meta-prompt for enhanced reasoning
      const metaPrompt = this.metaPromptsService.generateTaskMetaPrompt(
        AiTaskType.NutritionGoalCalculation,
        userProfile,
      )

      // Create optimized system prompt with caching
      const systemPrompt = this.promptCachingService.createOptimizedPrompt(
        'Nutrition Goal Calculation',
        metaPrompt,
        'Calculate personalized nutrition goals',
        userProfile,
        'Nutrition goal calculation tools available',
      )

      // Prepare user input for Responses API
      const userInput: OpenaiResponseInputMessage[] = [
        {
          role: 'user',
          content: `Please calculate personalized nutrition goals for me based on my profile.`,
        },
      ]

      // Use Responses API with agentic workflow
      const result = await this.executeAgenticTaskWithResponsesAPI<
        NutritionGoalArgs,
        NutritionGoalToolResult
      >(
        lineUserId,
        systemPrompt,
        userInput,
        [nutritionGoalTool],
        nutritionGoalTool.function.name,
        this.handleCalculateNutritionGoalsWrapper,
        userProfile,
        language,
        AiTaskType.NutritionGoalCalculation,
        timeConstraint,
      )

      // Type guard to handle unexpected WebSearchRequestToolResult
      if (result && typeof result === 'object' && 'status' in result) {
        this.logger.warn(
          '[calculateNutritionGoalsForUser] Unexpected WebSearchRequestToolResult received.',
        )
        return {
          error:
            'Unexpected web search request during nutrition goal calculation.',
        }
      }

      // Log caching metrics
      const promptMetrics = this.promptCachingService.createPromptWithMetrics(
        'Nutrition Goal Calculation',
        metaPrompt,
        'Calculate personalized nutrition goals',
        userProfile,
      )

      if (!promptMetrics.cachingEligible) {
        this.logger.warn(
          `Nutrition goal calculation prompt may not benefit from caching optimization`,
        )
      }

      this.logger.debug(
        `Nutrition goal calculation prompt tokens: ${promptMetrics.estimatedTokens} (caching eligible: ${promptMetrics.cachingEligible})`,
      )

      return result as NutritionGoalToolResult | { error: string } | null
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.error(
        `calculateNutritionGoalsForUser error for user ${lineUserId}: ${message}`,
      )
      return { error: `Nutrition goal calculation failed: ${message}` }
    }
  }

  async analyzeEatingPattern(
    lineUserId: string,
    userProfile: UserProfileDto,
    foodLogs: FoodLogEntryDto[],
    nutritionGoal: NutritionGoalDtoForAI | null,
    language: string = 'th',
    timeConstraint: 'fast' | 'normal' | 'accurate' = 'normal',
  ): Promise<EatingPatternToolResult | { error: string } | null> {
    try {
      this.logger.log(
        `[Enhanced Responses API] Starting eating pattern analysis for user ${lineUserId}`,
      )

      // Prepare structured food logs and nutrition goal summaries
      let foodLogsSummary = 'No food logs provided or logs are empty.'
      if (foodLogs.length > 0) {
        foodLogsSummary = `User has ${foodLogs.length} food logs. Recent examples (up to 3):\n`
        foodLogs.slice(0, 3).forEach((log) => {
          foodLogsSummary += `- ${log.timestamp.toISOString().split('T')[0]} ${log.mealType}: ${log.foodName} (${log.calories} kcal)\n`
        })
        if (foodLogs.length > 3) foodLogsSummary += 'And more logs exist...\n'
      }

      let nutritionGoalSummary = 'Nutrition goal not set or not provided.'
      if (nutritionGoal) {
        nutritionGoalSummary = `Current Goal: Target Calories: ${nutritionGoal.daily_calories || 'N/A'} kcal, Protein: ${nutritionGoal.daily_protein_g || 'N/A'}g, Carbs: ${nutritionGoal.daily_carbs_g || 'N/A'}g, Fat: ${nutritionGoal.daily_fat_g || 'N/A'}g, Fiber: ${nutritionGoal.daily_fiber_g || 'N/A'}g.`
      }

      // Generate meta-prompt for enhanced reasoning
      const metaPrompt = this.metaPromptsService.generateTaskMetaPrompt(
        AiTaskType.EatingPatternAnalysis,
        userProfile,
        {
          daysCount: 7, // Based on food logs analysis
          autonomous: false, // Using optimized manual workflow with intelligent analysis
          hasNutritionGoal: !!nutritionGoal,
          foodLogsCount: foodLogs.length,
          summary: `${foodLogsSummary}\n${nutritionGoalSummary}`,
        },
      )

      // Create optimized system prompt with caching
      const systemPrompt = this.promptCachingService.createOptimizedPrompt(
        'Eating Pattern Analysis',
        metaPrompt,
        `Analyze eating patterns from ${foodLogs.length} food logs`,
        userProfile,
        'Eating pattern analysis tools available',
      )

      // Prepare user input for Responses API with detailed food logs data
      const detailedFoodLogsText =
        foodLogs.length > 0
          ? foodLogs
              .map(
                (log, index) =>
                  `${index + 1}. ${log.timestamp.toISOString().split('T')[0]} ${log.mealType}: ${log.foodName} - ${log.calories} kcal (P:${log.protein}g, C:${log.carbs}g, F:${log.fat}g${log.fiber ? `, Fiber:${log.fiber}g` : ''})`,
              )
              .join('\n')
          : 'No food logs available for analysis.'

      const userInput: OpenaiResponseInputMessage[] = [
        {
          role: 'user',
          content: `Please analyze my eating patterns comprehensively based on the following data:

**MY COMPLETE FOOD LOG DATA (${foodLogs.length} entries):**
${detailedFoodLogsText}

**NUTRITION GOAL CONTEXT:**
${nutritionGoalSummary}

**ANALYSIS REQUEST:**
Using the meta-prompt framework and the comprehensive food log data above, please:
1. Analyze my caloric trends and consistency patterns
2. Evaluate meal timing and frequency patterns
3. Assess nutritional balance against my goals (if available)
4. Identify behavioral patterns and issues
5. Provide personalized improvement recommendations

Please call the '${eatingPatternTool.function.name}' tool with your thorough analysis based on the actual food log data provided above.`,
        },
      ]

      // Use Responses API with agentic workflow
      const result = await this.executeAgenticTaskWithResponsesAPI<
        EatingPatternArgs,
        EatingPatternToolResult
      >(
        lineUserId,
        systemPrompt,
        userInput,
        [eatingPatternTool],
        eatingPatternTool.function.name,
        this.handleAnalyzeEatingPatternWrapper,
        userProfile,
        language,
        AiTaskType.EatingPatternAnalysis,
        timeConstraint,
        foodLogs, // foodLogsForHandler
        nutritionGoal, // nutritionGoalForHandler
      )

      // Type guard to handle unexpected WebSearchRequestToolResult
      if (result && typeof result === 'object' && 'status' in result) {
        this.logger.warn(
          '[analyzeEatingPattern] Unexpected WebSearchRequestToolResult received.',
        )
        return {
          error:
            'Unexpected web search request during eating pattern analysis.',
        }
      }

      // Log caching metrics
      const promptMetrics = this.promptCachingService.createPromptWithMetrics(
        'Eating Pattern Analysis',
        metaPrompt,
        `Analyze eating patterns from ${foodLogs.length} food logs`,
        userProfile,
      )

      if (!promptMetrics.cachingEligible) {
        this.logger.warn(
          `Eating pattern analysis prompt may not benefit from caching optimization`,
        )
      }

      this.logger.debug(
        `Eating pattern analysis prompt tokens: ${promptMetrics.estimatedTokens} (caching eligible: ${promptMetrics.cachingEligible})`,
      )

      return result as EatingPatternToolResult | { error: string } | null
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.error(
        `analyzeEatingPattern error for user ${lineUserId}: ${message}`,
      )
      return { error: `Eating pattern analysis failed: ${message}` }
    }
  }

  async recommendMeals(
    lineUserId: string,
    userProfile: UserProfileDto,
    mealContext: string,
    language: string = 'th',
    timeConstraint: 'fast' | 'normal' | 'accurate' = 'normal',
  ): Promise<MealRecommendationToolResult | { error: string } | null> {
    try {
      this.logger.log(
        `[Enhanced Responses API] Starting meal recommendation for user ${lineUserId}, context: "${mealContext}"`,
      )

      // Generate meta-prompt for enhanced reasoning
      const metaPrompt = this.metaPromptsService.generateTaskMetaPrompt(
        AiTaskType.MealRecommendation,
        userProfile,
        {
          mealContext,
          language,
          userPreferences: userProfile.goal || 'general health',
        },
      )

      // Create optimized system prompt with caching
      const systemPrompt = this.promptCachingService.createOptimizedPrompt(
        'Meal Recommendation',
        metaPrompt,
        `Generate meal recommendations for: ${mealContext}`,
        userProfile,
        'Meal recommendation tools available',
      )

      // Prepare user input for Responses API
      const userInput: OpenaiResponseInputMessage[] = [
        {
          role: 'user',
          content: `Please recommend meals for: ${mealContext}. 

Consider my dietary preferences, health goals, and nutritional needs based on my profile. 

Please call the '${mealRecommendationTool.function.name}' tool to provide detailed meal recommendations with nutritional information.`,
        },
      ]

      // Use Responses API with agentic workflow
      const result = await this.executeAgenticTaskWithResponsesAPI<
        MealRecommendationArgs,
        MealRecommendationToolResult
      >(
        lineUserId,
        systemPrompt,
        userInput,
        [mealRecommendationTool],
        mealRecommendationTool.function.name,
        this.handleRecommendMealsWrapper,
        userProfile,
        language,
        AiTaskType.MealRecommendation,
        timeConstraint,
        undefined, // foodLogsForHandler
        undefined, // nutritionGoalForHandler
      )

      // Type guard to handle unexpected WebSearchRequestToolResult
      if (result && typeof result === 'object' && 'status' in result) {
        this.logger.warn(
          '[recommendMeals] Unexpected WebSearchRequestToolResult received.',
        )
        return {
          error: 'Unexpected web search request during meal recommendation.',
        }
      }

      // Log caching metrics
      const promptMetrics = this.promptCachingService.createPromptWithMetrics(
        'Meal Recommendation',
        metaPrompt,
        `Generate meal recommendations for: ${mealContext}`,
        userProfile,
      )

      if (!promptMetrics.cachingEligible) {
        this.logger.warn(
          `Meal recommendation prompt may not benefit from caching optimization`,
        )
      }

      this.logger.debug(
        `Meal recommendation prompt tokens: ${promptMetrics.estimatedTokens} (caching eligible: ${promptMetrics.cachingEligible})`,
      )

      return result as MealRecommendationToolResult | { error: string } | null
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.error(
        `recommendMeals error for user ${lineUserId}: ${message}`,
      )
      return { error: `Meal recommendation failed: ${message}` }
    }
  }

  async answerFoodHistoryQuestion(
    lineUserId: string,
    userQuery: string,
    userProfile: UserProfileDto,
    language: string = 'th',
    timeConstraint: 'fast' | 'normal' | 'accurate' = 'normal',
  ): Promise<ConversationalFoodHistoryResult | { error: string } | null> {
    this.logger.log(
      `Answering food history question for user: ${lineUserId}, query: ${userQuery.substring(0, 100)}...`,
    )

    try {
      const systemPrompt = this.createConversationalFoodHistorySystemPrompt(
        userProfile,
        language,
      )

      const result = await this.executeAgenticTaskWithResponsesAPI<
        ConversationalFoodHistoryArgs,
        ConversationalFoodHistoryResult
      >(
        lineUserId,
        systemPrompt,
        userQuery,
        [conversationalFoodHistoryTool],
        conversationalFoodHistoryTool.function.name,
        this.handleConversationalFoodHistoryWrapper,
        userProfile,
        language,
        AiTaskType.ConversationalFoodHistory,
        timeConstraint,
      )

      if (result && 'error' in result) {
        this.logger.error(`Error in answerFoodHistoryQuestion: ${result.error}`)
        return result
      }

      return result as ConversationalFoodHistoryResult | null
    } catch (error) {
      this.logger.error(
        `Error in answerFoodHistoryQuestion: ${error instanceof Error ? error.message : String(error)}`,
      )
      return {
        error: `Failed to answer food history question: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
    }
  }

  async answerGeneralNutritionQuestion(
    lineUserId: string,
    userQuery: string,
    userProfile: UserProfileDto,
    language: string = 'th',
    timeConstraint: 'fast' | 'normal' | 'accurate' = 'normal',
  ): Promise<string | null> {
    this.logger.log(
      `answerGeneralNutritionQuestion called for user: ${lineUserId}, query: ${userQuery}`,
    )

    // สำหรับคำถามทั่วไป ใช้ Completions API แทน Responses API เพื่อหลีกเลี่ยง tool calls
    const taskType = AiTaskType.GeneralNutritionQuery
    const modelConfig = this.selectModelInternal(
      userQuery,
      userProfile,
      timeConstraint,
      taskType,
    )
    const deploymentName = modelConfig.deploymentName
    const systemPrompt = this.createGeneralNutritionPrompt(
      userProfile,
      language,
    )

    const rawHistory = await this.conversationHistoryService.getRecentHistory(
      lineUserId,
      userProfile,
      this.getMaxHistoryTokensByConstraint(timeConstraint),
    )

    // สร้าง messages array สำหรับ Completions API
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: systemPrompt,
      },
    ]

    // เพิ่ม conversation history
    if (rawHistory && rawHistory.length > 0) {
      for (const historyItem of rawHistory.slice(-10)) {
        // จำกัดแค่ 10 ข้อความล่าสุด
        messages.push({
          role: historyItem.role as 'user' | 'assistant',
          content: historyItem.content,
        })
      }
    }

    // เพิ่ม user query ปัจจุบัน
    messages.push({
      role: 'user',
      content: userQuery,
    })

    try {
      // ใช้ Completions API โดยไม่มี tools
      const response = await this.openaiService.getChatCompletion(
        deploymentName,
        messages,
        {
          temperature: modelConfig.params.temperature || 0.5,
          max_tokens: 1600,
          top_p: modelConfig.params.top_p || 1.0,
        },
      )

      if (
        response &&
        response.choices &&
        response.choices[0]?.message?.content
      ) {
        const assistantResponse = response.choices[0].message.content

        // บันทึกในประวัติการสนทนา
        await this.conversationHistoryService.addMessageToHistory(
          lineUserId,
          'assistant',
          assistantResponse,
          undefined,
          response.id || undefined,
        )

        // Log token usage
        if (response.usage) {
          this.logger.log(
            `[TOKEN USAGE] User: ${lineUserId}, Input: ${response.usage.prompt_tokens || 0}, Output: ${response.usage.completion_tokens || 0}, Total: ${response.usage.total_tokens || 0}`,
          )
        }

        return assistantResponse
      } else {
        this.logger.error('No content in chat completion response')
        return language === 'th'
          ? 'ขออภัยค่ะ ไม่สามารถดึงคำตอบจาก AI ได้ในขณะนี้'
          : 'Sorry, could not retrieve an answer from the AI at this time.'
      }
    } catch (error) {
      this.logger.error(
        `Chat completion API call failed for general question: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      )
      return language === 'th'
        ? 'ขออภัยค่ะ มีข้อผิดพลาดในการสื่อสารกับ AI กรุณาลองใหม่อีกครั้ง'
        : 'Sorry, there was an error communicating with the AI. Please try again.'
    }
  }

  // --- Tool Handler Implementations ---
  private async handleExtractFoodAnalysis(
    args: FoodAnalysisToolResult, // Changed from FoodAnalysisArgs to FoodAnalysisToolResult
    userProfile: UserProfileDto,
    language: string,
  ): Promise<FoodAnalysisToolResult> {
    // Added Promise<>
    this.logger.debug(
      `Handling extract_food_analysis for lang '${language}' with args: ${JSON.stringify(args)} for user ${userProfile.lineUserId || 'unknown'}`,
    )
    // The AI is expected to provide all data according to FOOD_ANALYSIS_SCHEMA.
    // This handler's job is primarily to validate and return it.
    // Basic validation (can be expanded):
    if (!args.food_name || typeof args.calories !== 'number') {
      this.logger.warn(
        `Received incomplete or malformed FoodAnalysisToolResult from AI for user ${userProfile.lineUserId || 'unknown'}. Args: ${JSON.stringify(args)}`,
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
      `Handling calculate_nutrition_goals for user ${userProfile.lineUserId || 'unknown'} with lang '${language}'. Args: ${JSON.stringify(args)}`,
    )

    // AI จะส่งข้อมูลมาใน args ในรูปแบบที่ถูกต้องแล้ว
    // เราจึงควรใช้ข้อมูลจาก AI โดยตรง แทนการสร้าง fallback data

    // ตรวจสอบว่า AI ส่งข้อมูลมาครบถ้วนหรือไม่
    const aiData = args as any // Cast เพื่อให้เข้าถึง properties ที่ AI ส่งมา

    if (aiData.bmr && aiData.tdee && aiData.daily_goals) {
      // ใช้ข้อมูลจาก AI โดยตรง
      return {
        bmr: aiData.bmr || 0,
        tdee: aiData.tdee || 0,
        daily_goals: aiData.daily_goals || {
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
        },
        macro_distribution: aiData.macro_distribution || {
          protein_percent: 0,
          carbs_percent: 0,
          fat_percent: 0,
        },
        meal_recommendations: aiData.meal_recommendations || {},
        health_advice: aiData.health_advice || '',
        food_recommendations: aiData.food_recommendations || [],
        foods_to_avoid: aiData.foods_to_avoid || [],
      }
    }

    // Fallback เฉพาะกรณีที่ AI ไม่ส่งข้อมูลมา (ไม่ควรเกิดขึ้น)
    this.logger.warn(
      `AI did not provide proper nutrition goals data, using fallback for user ${userProfile.lineUserId}`,
    )

    // สำหรับ fallback ใช้การคำนวณเบื้องต้น
    const baseBMR = 1500
    const baseTDEE = 2000

    const calculatedBMR = baseBMR
    let calculatedTDEE = baseTDEE
    let proteinModifier = 0
    let calorieModifier = 0
    const additionalHealthAdvice: string[] = []

    if (userProfile.pregnancyLactationStatus === 'pregnant') {
      calorieModifier += 300
      proteinModifier += 15
      additionalHealthAdvice.push(
        language === 'th'
          ? 'เนื่องจากกำลังตั้งครรภ์ โปรดปรึกษาแพทย์เกี่ยวกับความต้องการสารอาหารเฉพาะบุคคล'
          : 'As you are pregnant, please consult your doctor for specific nutritional needs.',
      )
    } else if (userProfile.pregnancyLactationStatus === 'lactating') {
      calorieModifier += 500
      proteinModifier += 20
      additionalHealthAdvice.push(
        language === 'th'
          ? 'เนื่องจากกำลังให้นมบุตร ความต้องการสารอาหารของคุณอาจเพิ่มขึ้น'
          : 'As you are lactating, your nutritional needs may be increased.',
      )
    }

    calculatedTDEE += calorieModifier
    const initialProteinGoal =
      Math.round((calculatedTDEE * 0.2) / 4) + proteinModifier

    const baseHealthAdvice =
      language === 'th'
        ? 'นี่คือเป้าหมายโภชนาการเบื้องต้นของคุณ ปรับเปลี่ยนตามความเหมาะสม'
        : 'These are your initial nutrition goals. Adjust as needed.'

    const finalHealthAdvice = [
      baseHealthAdvice,
      ...additionalHealthAdvice,
    ].join(' \n')

    return {
      bmr: calculatedBMR,
      tdee: calculatedTDEE,
      daily_goals: {
        calories: calculatedTDEE,
        protein: initialProteinGoal,
        carbs: Math.round((calculatedTDEE * 0.5) / 4),
        fat: Math.round((calculatedTDEE * 0.3) / 9),
        fiber: 25,
        sugar_max: 25,
        water: 2500,
      },
      macro_distribution: {
        protein_percent: Math.round(
          (initialProteinGoal * 4 * 100) / calculatedTDEE,
        ),
        carbs_percent: 50,
        fat_percent: 30,
      },
      meal_recommendations: {
        breakfast: Math.round(calculatedTDEE * 0.25),
        lunch: Math.round(calculatedTDEE * 0.35),
        dinner: Math.round(calculatedTDEE * 0.3),
        snacks: Math.round(calculatedTDEE * 0.1),
      },
      health_advice: finalHealthAdvice,
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

  private async handleAnalyzeEatingPattern(
    args: EatingPatternArgs,
    userProfile: UserProfileDto,
    language: string,
    foodLogs: FoodLogEntryDto[] = [], // Provide default empty array if undefined
    nutritionGoal: NutritionGoalDtoForAI | null = null, // Provide default null if undefined
  ): Promise<EatingPatternToolResult> {
    this.logger.debug(
      `Handling analyze_eating_pattern for user ${userProfile.lineUserId || 'unknown'}, lang '${language}'. ` +
        `Args: ${JSON.stringify(args)}. Food logs count: ${foodLogs.length}. Goal set: ${!!nutritionGoal}`,
    )

    if (foodLogs.length === 0) {
      return {
        calories_trend: 'insufficient_data',
        average_daily_calories: 0,
        identified_patterns: [],
        problematic_behaviors: [],
        improvement_suggestions: [
          language === 'th'
            ? 'เริ่มบันทึกอาหารเพื่อการวิเคราะห์ที่แม่นยำยิ่งขึ้น'
            : 'Start logging your food for more accurate analysis',
        ],
        personalized_advice:
          language === 'th'
            ? 'ยังไม่มีข้อมูลการกินที่บันทึกไว้ กรุณาบันทึกอาหารอย่างสม่ำเสมอเพื่อการวิเคราะห์ที่ดีขึ้น'
            : 'No food logs recorded yet. Please log your meals consistently for better analysis.',
        basic_analysis_details: {
          days_analyzed: 0,
          total_logs: 0,
          skipped_meal_counts: { breakfast: 0, lunch: 0, dinner: 0 },
        },
        calorie_consistency: undefined,
        meal_timings: [],
        most_skipped_meal: undefined,
        nutrient_balance: undefined,
        eating_window_hours: undefined,
        late_night_eating_frequency: undefined,
      }
    }

    // Real analysis implementation
    const daysAnalyzed = new Set(
      foodLogs.map((log) => new Date(log.timestamp).toDateString()),
    ).size

    // Calculate daily calories
    const dailyCalories: { [date: string]: number } = {}
    const mealCounts: { breakfast: number; lunch: number; dinner: number } = {
      breakfast: 0,
      lunch: 0,
      dinner: 0,
    }
    const mealTimingData: { [mealType: string]: Date[] } = {}

    foodLogs.forEach((log) => {
      const date = new Date(log.timestamp).toDateString()
      dailyCalories[date] = (dailyCalories[date] || 0) + log.calories

      // Count meal types
      const mealType = log.mealType.toLowerCase()
      if (mealType.includes('breakfast')) mealCounts.breakfast++
      else if (mealType.includes('lunch')) mealCounts.lunch++
      else if (mealType.includes('dinner')) mealCounts.dinner++

      // Track meal timings
      if (!mealTimingData[mealType]) mealTimingData[mealType] = []
      mealTimingData[mealType].push(new Date(log.timestamp))
    })

    const totalCalories = Object.values(dailyCalories).reduce(
      (sum, cal) => sum + cal,
      0,
    )
    const averageDailyCalories = Math.round(
      totalCalories / Math.max(daysAnalyzed, 1),
    )

    // Calculate calorie trend (simple analysis)
    const sortedDates = Object.keys(dailyCalories).sort()
    let caloriesTrend:
      | 'improving'
      | 'stable'
      | 'worsening'
      | 'insufficient_data' = 'insufficient_data'

    if (sortedDates.length >= 3) {
      const firstHalf = sortedDates.slice(0, Math.floor(sortedDates.length / 2))
      const secondHalf = sortedDates.slice(Math.floor(sortedDates.length / 2))

      const firstHalfAvg =
        firstHalf.reduce((sum, date) => sum + dailyCalories[date], 0) /
        firstHalf.length
      const secondHalfAvg =
        secondHalf.reduce((sum, date) => sum + dailyCalories[date], 0) /
        secondHalf.length

      const difference = secondHalfAvg - firstHalfAvg
      const changePercent = Math.abs(difference) / firstHalfAvg

      if (changePercent < 0.1) {
        caloriesTrend = 'stable'
      } else if (userProfile.goal === 'lose_weight' && difference < 0) {
        caloriesTrend = 'improving'
      } else if (userProfile.goal === 'gain_weight' && difference > 0) {
        caloriesTrend = 'improving'
      } else if (
        userProfile.goal === 'maintain_weight' &&
        Math.abs(difference) < firstHalfAvg * 0.05
      ) {
        caloriesTrend = 'improving'
      } else {
        caloriesTrend = 'worsening'
      }
    }

    // Calculate meal timings
    const mealTimings = Object.entries(mealTimingData)
      .map(([mealType, times]) => {
        if (times.length === 0) return null

        const avgHour =
          times.reduce((sum, time) => sum + time.getHours(), 0) / times.length
        const avgMinute =
          times.reduce((sum, time) => sum + time.getMinutes(), 0) / times.length

        return {
          meal_name: mealType,
          average_time: `${Math.floor(avgHour).toString().padStart(2, '0')}:${Math.floor(avgMinute).toString().padStart(2, '0')}`,
          consistency: times.length / daysAnalyzed, // How consistently this meal is eaten
        }
      })
      .filter(Boolean) as Array<{
      meal_name: string
      average_time: string
      consistency: number
    }>

    // 🚀 Advanced pattern analysis
    const identifiedPatterns: string[] = []
    const problematicBehaviors: string[] = []
    const improvementSuggestions: string[] = []

    // 🔍 1. Basic calorie analysis
    if (averageDailyCalories < 1200) {
      problematicBehaviors.push(
        language === 'th'
          ? 'แคลอรี่ต่อวันต่ำเกินไป (น้อยกว่า 1200 kcal)'
          : 'Daily calories too low (below 1200 kcal)',
      )
      improvementSuggestions.push(
        language === 'th'
          ? 'เพิ่มปริมาณอาหารหรือเลือกอาหารที่มีแคลอรี่สูงขึ้น'
          : 'Increase food portions or choose higher-calorie foods',
      )
    } else if (averageDailyCalories > 2500) {
      problematicBehaviors.push(
        language === 'th'
          ? 'แคลอรี่ต่อวันสูงเกินไป (มากกว่า 2500 kcal)'
          : 'Daily calories too high (above 2500 kcal)',
      )
      improvementSuggestions.push(
        language === 'th'
          ? 'ลดปริมาณอาหารหรือเลือกอาหารที่มีแคลอรี่ต่ำกว่า'
          : 'Reduce portion sizes or choose lower-calorie foods',
      )
    }

    // 🔍 2. Weekend vs Weekday pattern analysis
    const weekendLogs = foodLogs.filter((log) => {
      const day = new Date(log.timestamp).getDay()
      return day === 0 || day === 6 // Sunday = 0, Saturday = 6
    })
    const weekdayLogs = foodLogs.filter((log) => {
      const day = new Date(log.timestamp).getDay()
      return day >= 1 && day <= 5
    })

    if (weekendLogs.length > 0 && weekdayLogs.length > 0) {
      const weekendAvgCalories =
        weekendLogs.reduce((sum, log) => sum + log.calories, 0) /
        weekendLogs.length
      const weekdayAvgCalories =
        weekdayLogs.reduce((sum, log) => sum + log.calories, 0) /
        weekdayLogs.length
      const weekendWeekdayDiff =
        ((weekendAvgCalories - weekdayAvgCalories) / weekdayAvgCalories) * 100

      if (Math.abs(weekendWeekdayDiff) > 20) {
        if (weekendWeekdayDiff > 20) {
          identifiedPatterns.push(
            language === 'th'
              ? `วันหยุดกินมากกว่าวันทำงาน ${Math.round(weekendWeekdayDiff)}%`
              : `Weekend eating ${Math.round(weekendWeekdayDiff)}% higher than weekdays`,
          )
          problematicBehaviors.push(
            language === 'th'
              ? 'มีแนวโน้มกินมากเกินไปในวันหยุด'
              : 'Tendency to overeat on weekends',
          )
          improvementSuggestions.push(
            language === 'th'
              ? 'พยายามควบคุมปริมาณอาหารในวันหยุดให้สอดคล้องกับวันทำงาน'
              : 'Try to maintain consistent eating patterns on weekends',
          )
        } else {
          identifiedPatterns.push(
            language === 'th'
              ? `วันทำงานกินมากกว่าวันหยุด ${Math.round(Math.abs(weekendWeekdayDiff))}%`
              : `Weekday eating ${Math.round(Math.abs(weekendWeekdayDiff))}% higher than weekends`,
          )
        }
      } else {
        identifiedPatterns.push(
          language === 'th'
            ? 'รูปแบบการกินสม่ำเสมอระหว่างวันทำงานและวันหยุด'
            : 'Consistent eating pattern between weekdays and weekends',
        )
      }
    }

    // 🔍 3. Late night eating analysis (emotional eating indicator)
    const lateNightLogs = foodLogs.filter(
      (log) => new Date(log.timestamp).getHours() >= 22,
    )
    const lateNightFrequency = lateNightLogs.length / Math.max(daysAnalyzed, 1)

    if (lateNightFrequency > 0.3) {
      // More than 30% of days
      problematicBehaviors.push(
        language === 'th'
          ? `กินดึกบ่อยครั้ง (${Math.round(lateNightFrequency * 100)}% ของวัน)`
          : `Frequent late-night eating (${Math.round(lateNightFrequency * 100)}% of days)`,
      )
      improvementSuggestions.push(
        language === 'th'
          ? 'หลีกเลี่ยงการกินหลัง 22:00 น. และหาทางจัดการความเครียดในรูปแบบอื่น'
          : 'Avoid eating after 10 PM and find alternative stress management techniques',
      )
    } else if (lateNightFrequency <= 0.1) {
      identifiedPatterns.push(
        language === 'th'
          ? 'ไม่ค่อยกินดึก แสดงถึงวินัยในการควบคุมตัวเองที่ดี'
          : 'Minimal late-night eating shows good self-control',
      )
    }

    // 🔍 4. Nutritional quality score calculation
    const calculateNutritionalQualityScore = (): number => {
      let score = 50 // Base score

      // Protein adequacy (20 points max)
      const avgDailyProtein =
        foodLogs.reduce((sum, log) => sum + log.protein, 0) / daysAnalyzed
      const proteinRatio = avgDailyProtein / (userProfile.weightKg || 70) // g per kg body weight
      if (proteinRatio >= 1.2) score += 20
      else if (proteinRatio >= 0.8) score += 15
      else if (proteinRatio >= 0.6) score += 10

      // Meal consistency (15 points max)
      const mealConsistency =
        (mealCounts.breakfast + mealCounts.lunch + mealCounts.dinner) /
        (daysAnalyzed * 3)
      score += mealConsistency * 15

      // Calorie appropriateness (15 points max)
      if (averageDailyCalories >= 1200 && averageDailyCalories <= 2500)
        score += 15
      else if (averageDailyCalories >= 1000 && averageDailyCalories <= 3000)
        score += 10
      else score += 5

      return Math.min(Math.max(score, 0), 100)
    }

    const nutritionalQualityScore = calculateNutritionalQualityScore()

    // 🔍 5. Eating window analysis
    if (mealTimings.length >= 2) {
      const eatingWindowHours =
        Math.max(
          ...mealTimings.map((t) => parseInt(t.average_time.split(':')[0])),
        ) -
        Math.min(
          ...mealTimings.map((t) => parseInt(t.average_time.split(':')[0])),
        )

      if (eatingWindowHours <= 8) {
        identifiedPatterns.push(
          language === 'th'
            ? `รูปแบบการกินแบบ Time-Restricted (${eatingWindowHours} ชั่วโมง)`
            : `Time-restricted eating pattern (${eatingWindowHours} hours)`,
        )
      } else if (eatingWindowHours >= 14) {
        problematicBehaviors.push(
          language === 'th'
            ? `ช่วงเวลาการกินยาวเกินไป (${eatingWindowHours} ชั่วโมง)`
            : `Extended eating window (${eatingWindowHours} hours)`,
        )
        improvementSuggestions.push(
          language === 'th'
            ? 'พิจารณาจำกัดช่วงเวลาการกินให้อยู่ในช่วง 10-12 ชั่วโมง'
            : 'Consider limiting eating window to 10-12 hours',
        )
      }
    }

    // 🔍 6. Meal frequency pattern analysis
    if (mealCounts.breakfast < daysAnalyzed * 0.7) {
      problematicBehaviors.push(
        language === 'th'
          ? 'ข้ามอาหารเช้าบ่อยครั้ง'
          : 'Frequently skipping breakfast',
      )
      improvementSuggestions.push(
        language === 'th'
          ? 'พยายามทานอาหารเช้าให้สม่ำเสมอเพื่อเพิ่มพลังงานในตอนเช้า'
          : 'Try to eat breakfast consistently for better morning energy',
      )
    }

    // 🔍 7. Seasonal/Monthly pattern analysis (if we have enough historical data)
    const currentMonth = new Date().getMonth()
    const monthlyLogs = foodLogs.filter(
      (log) => new Date(log.timestamp).getMonth() === currentMonth,
    )
    if (monthlyLogs.length > 0 && foodLogs.length > monthlyLogs.length) {
      const monthlyAvgCalories =
        monthlyLogs.reduce((sum, log) => sum + log.calories, 0) /
        monthlyLogs.length
      const otherMonthsLogs = foodLogs.filter(
        (log) => new Date(log.timestamp).getMonth() !== currentMonth,
      )
      const otherMonthsAvgCalories =
        otherMonthsLogs.reduce((sum, log) => sum + log.calories, 0) /
        otherMonthsLogs.length

      const monthlyDiff =
        ((monthlyAvgCalories - otherMonthsAvgCalories) /
          otherMonthsAvgCalories) *
        100
      if (Math.abs(monthlyDiff) > 15) {
        identifiedPatterns.push(
          language === 'th'
            ? `เดือนนี้กิน${monthlyDiff > 0 ? 'มากกว่า' : 'น้อยกว่า'}เดือนอื่นๆ ${Math.round(Math.abs(monthlyDiff))}%`
            : `This month eating ${monthlyDiff > 0 ? 'more' : 'less'} than other months by ${Math.round(Math.abs(monthlyDiff))}%`,
        )
      }
    }

    // 🔍 8. Basic pattern identification
    if (daysAnalyzed >= 7) {
      identifiedPatterns.push(
        language === 'th'
          ? `ทานอาหารเช้า ${Math.round((mealCounts.breakfast / daysAnalyzed) * 100)}% ของวัน`
          : `Eating breakfast ${Math.round((mealCounts.breakfast / daysAnalyzed) * 100)}% of days`,
      )

      identifiedPatterns.push(
        language === 'th'
          ? `คะแนนคุณภาพโภชนาการ: ${Math.round(nutritionalQualityScore)}/100`
          : `Nutritional quality score: ${Math.round(nutritionalQualityScore)}/100`,
      )

      // Add quality assessment
      if (nutritionalQualityScore >= 80) {
        identifiedPatterns.push(
          language === 'th'
            ? 'รูปแบบการกินมีคุณภาพดีมาก'
            : 'Excellent eating pattern quality',
        )
      } else if (nutritionalQualityScore >= 60) {
        identifiedPatterns.push(
          language === 'th'
            ? 'รูปแบบการกินมีคุณภาพปานกลาง มีที่ปรับปรุงได้'
            : 'Moderate eating pattern quality with room for improvement',
        )
      } else {
        problematicBehaviors.push(
          language === 'th'
            ? 'รูปแบบการกินต้องปรับปรุงอย่างเร่งด่วน'
            : 'Eating pattern needs significant improvement',
        )
      }
    }

    // Calculate nutrient balance if nutrition goal is available
    let nutrientBalance: EatingPatternToolResult['nutrient_balance'] = undefined
    if (nutritionGoal) {
      const totalProtein = foodLogs.reduce((sum, log) => sum + log.protein, 0)
      const totalCarbs = foodLogs.reduce((sum, log) => sum + log.carbs, 0)
      const totalFat = foodLogs.reduce((sum, log) => sum + log.fat, 0)
      const totalFiber = foodLogs.reduce(
        (sum, log) => sum + (log.fiber || 0),
        0,
      )

      const avgDailyProtein = totalProtein / daysAnalyzed
      const avgDailyCarbs = totalCarbs / daysAnalyzed
      const avgDailyFat = totalFat / daysAnalyzed
      const avgDailyFiber = totalFiber / daysAnalyzed

      nutrientBalance = {
        protein_balance: nutritionGoal.daily_protein_g
          ? Math.round((avgDailyProtein / nutritionGoal.daily_protein_g) * 100)
          : null,
        carbs_balance: nutritionGoal.daily_carbs_g
          ? Math.round((avgDailyCarbs / nutritionGoal.daily_carbs_g) * 100)
          : null,
        fat_balance: nutritionGoal.daily_fat_g
          ? Math.round((avgDailyFat / nutritionGoal.daily_fat_g) * 100)
          : null,
        fiber_balance: nutritionGoal.daily_fiber_g
          ? Math.round((avgDailyFiber / nutritionGoal.daily_fiber_g) * 100)
          : null,
      }
    }

    // 🤖 Generate AI-enhanced personalized advice
    const basePersonalizedAdvice =
      language === 'th'
        ? `จากการวิเคราะห์ ${daysAnalyzed} วัน พบว่าคุณทานอาหารเฉลี่ย ${averageDailyCalories} แคลอรี่ต่อวัน แนวโน้มแคลอรี่: ${caloriesTrend === 'improving' ? 'ดีขึ้น' : caloriesTrend === 'stable' ? 'คงที่' : caloriesTrend === 'worsening' ? 'แย่ลง' : 'ข้อมูลไม่เพียงพอ'}`
        : `Based on ${daysAnalyzed} days analysis, you consume an average of ${averageDailyCalories} calories per day. Calorie trend: ${caloriesTrend}`

    // 🚀 Use AI to enhance all analysis components with personality and engagement
    let finalPersonalizedAdvice = basePersonalizedAdvice
    let finalIdentifiedPatterns = identifiedPatterns
    let finalImprovementSuggestions = improvementSuggestions

    // 🚀 ปิดการเรียก Full Autonomous AI Analysis เพื่อลด API calls
    // เนื่องจากการวิเคราะห์ eating pattern ไม่ควรเรียก AI หลายครั้ง
    // ใช้ manual analysis ที่มีคุณภาพแล้ว
    this.logger.debug(
      `🚀 Skipping Full Autonomous AI Analysis to reduce API calls. Using manual analysis for ${daysAnalyzed} days, ${foodLogs.length} logs`,
    )

    try {
      // 🤖 FULL AUTONOMOUS AI - ให้ AI สร้างทุกอย่างเอง
      if (daysAnalyzed >= 1 && foodLogs.length >= 1) {
        this.logger.log(
          `🤖 Running FULL AUTONOMOUS AI Analysis: ${daysAnalyzed} days, ${foodLogs.length} logs`,
        )

        const autonomousResult = await this.generateFullAutonomousAnalysis(
          foodLogs,
          userProfile,
          nutritionGoal,
          language,
          caloriesTrend,
          averageDailyCalories,
          nutritionalQualityScore,
        )

        if (autonomousResult) {
          finalPersonalizedAdvice = autonomousResult.personalizedAdvice
          finalIdentifiedPatterns = autonomousResult.identifiedPatterns
          finalImprovementSuggestions = autonomousResult.improvementSuggestions

          this.logger.log(`✨ Full Autonomous AI Analysis successful!`)
        } else {
          this.logger.warn(`⚠️ Autonomous AI failed, using manual fallback`)
        }
      } else {
        this.logger.warn(
          `⚠️ Insufficient data for AI analysis - days: ${daysAnalyzed}, logs: ${foodLogs.length}`,
        )
      }
    } catch (aiError) {
      this.logger.warn(`❌ Autonomous AI analysis failed: ${aiError}`)
      // ใช้ manual fallback
    }

    return {
      calories_trend: caloriesTrend,
      average_daily_calories: averageDailyCalories,
      calorie_consistency:
        sortedDates.length > 1
          ? 1 -
            (Math.max(...Object.values(dailyCalories)) -
              Math.min(...Object.values(dailyCalories))) /
              averageDailyCalories
          : undefined,
      meal_timings: mealTimings,
      most_skipped_meal:
        mealCounts.breakfast < mealCounts.lunch &&
        mealCounts.breakfast < mealCounts.dinner
          ? 'breakfast'
          : mealCounts.lunch < mealCounts.dinner
            ? 'lunch'
            : mealCounts.dinner < mealCounts.breakfast
              ? 'dinner'
              : undefined,
      nutrient_balance: nutrientBalance,
      eating_window_hours:
        mealTimings.length > 1
          ? Math.max(
              ...mealTimings.map((t) => parseInt(t.average_time.split(':')[0])),
            ) -
            Math.min(
              ...mealTimings.map((t) => parseInt(t.average_time.split(':')[0])),
            )
          : undefined,
      late_night_eating_frequency:
        foodLogs.filter((log) => new Date(log.timestamp).getHours() >= 22)
          .length / foodLogs.length,
      identified_patterns: finalIdentifiedPatterns,
      problematic_behaviors: problematicBehaviors,
      improvement_suggestions: finalImprovementSuggestions,
      personalized_advice: finalPersonalizedAdvice,
      basic_analysis_details: {
        days_analyzed: daysAnalyzed,
        total_logs: foodLogs.length,
        skipped_meal_counts: {
          breakfast: Math.max(0, daysAnalyzed - mealCounts.breakfast),
          lunch: Math.max(0, daysAnalyzed - mealCounts.lunch),
          dinner: Math.max(0, daysAnalyzed - mealCounts.dinner),
        },
        average_eating_window_hours:
          mealTimings.length > 1
            ? Math.max(
                ...mealTimings.map((t) =>
                  parseInt(t.average_time.split(':')[0]),
                ),
              ) -
              Math.min(
                ...mealTimings.map((t) =>
                  parseInt(t.average_time.split(':')[0]),
                ),
              )
            : undefined,
        calculated_late_night_eating_frequency:
          foodLogs.filter((log) => new Date(log.timestamp).getHours() >= 22)
            .length / foodLogs.length,
      },
    }
  }

  private handleRecommendMeals(
    args: MealRecommendationArgs, // AI might send preferences here too
    userProfile: UserProfileDto,
    language: string,
    mealContext: string, // e.g., "breakfast", "a high-protein snack"
  ): MealRecommendationToolResult {
    this.logger.debug(
      `Handling recommend_meals for user ${userProfile.lineUserId || 'unknown'}, lang '${language}', context '${mealContext}'. Args: ${JSON.stringify(args)}`,
    )

    // AI จะส่งข้อมูลมาใน args ในรูปแบบที่ถูกต้องแล้ว
    // เราจึงควรใช้ข้อมูลจาก AI โดยตรง แทนการสร้าง fallback data

    // ตรวจสอบว่า AI ส่งข้อมูลมาครบถ้วนหรือไม่
    const aiData = args as any // Cast เพื่อให้เข้าถึง properties ที่ AI ส่งมา

    if (
      aiData.foods &&
      Array.isArray(aiData.foods) &&
      aiData.foods.length > 0
    ) {
      // ใช้ข้อมูลจาก AI โดยตรง
      return {
        meal_type: aiData.meal_type || 'general',
        foods: aiData.foods,
        total_calories: aiData.total_calories || 0,
        total_protein: aiData.total_protein || 0,
        total_carbs: aiData.total_carbs || 0,
        total_fat: aiData.total_fat || 0,
        recommendations: aiData.recommendations || '',
        alternatives: aiData.alternatives || [],
      }
    }

    // Fallback เฉพาะกรณีที่ AI ไม่ส่งข้อมูลมา (ไม่ควรเกิดขึ้น)
    this.logger.warn(
      `AI did not provide proper meal data, using fallback for user ${userProfile.lineUserId}`,
    )

    const recommendations: string[] = []
    const alternatives: string[] = []

    if (userProfile.preferredCuisine) {
      recommendations.push(
        language === 'th'
          ? `เราจะพยายามหาอาหารประเภท ${userProfile.preferredCuisine.join(', ')} ที่เหมาะกับคุณ`
          : `We will try to find ${userProfile.preferredCuisine.join(', ')} dishes suitable for you.`,
      )
    }

    if (
      userProfile.preferredFlavorProfiles &&
      userProfile.preferredFlavorProfiles.length > 0
    ) {
      recommendations.push(
        language === 'th'
          ? `รสชาติที่คุณชอบคือ: ${userProfile.preferredFlavorProfiles.join(', ')}`
          : `Your preferred flavors are: ${userProfile.preferredFlavorProfiles.join(', ')}`,
      )
    }

    const mealTypeForResponse = 'general'
    const exampleFoods: MealRecommendationToolResult['foods'] = [
      {
        name:
          language === 'th'
            ? 'ข้าวกะเพราไก่ไข่ดาว (ตัวอย่าง)'
            : 'Sample: Stir-fried Chicken with Basil and Fried Egg',
        description:
          language === 'th'
            ? 'อาหารจานด่วนยอดนิยม ปรับให้ดีต่อสุขภาพได้'
            : 'A popular quick meal, can be made healthier.',
        calories: 550,
        protein: 30,
        carbs: 50,
        fat: 25,
        portion: language === 'th' ? '1 จาน' : '1 plate',
        ingredients:
          language === 'th'
            ? ['ไก่', 'ข้าว', 'กะเพรา', 'ไข่']
            : ['Chicken', 'Rice', 'Holy Basil', 'Egg'],
      },
    ]

    return {
      meal_type: mealTypeForResponse,
      foods: exampleFoods,
      total_calories: exampleFoods.reduce(
        (sum, food) => sum + food.calories,
        0,
      ),
      total_protein: exampleFoods.reduce((sum, food) => sum + food.protein, 0),
      total_carbs: exampleFoods.reduce((sum, food) => sum + food.carbs, 0),
      total_fat: exampleFoods.reduce((sum, food) => sum + food.fat, 0),
      recommendations:
        recommendations.join(' \n') ||
        (language === 'th'
          ? 'เลือกอาหารที่เหมาะสมกับคุณ'
          : 'Choose meals suitable for you.'),
      alternatives: alternatives,
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

  // REFACTORED CORE METHOD - Enhanced Responses API Integration
  private async executeAgenticTaskWithResponsesAPI<
    ArgsDto,
    ResultDto extends object,
  >(
    lineUserId: string,
    instructions: string,
    userInput: string | OpenaiResponseInputMessage[],
    tools: OpenAI.Chat.Completions.ChatCompletionTool[], // This is for ChatCompletions. Tools for Responses API are different.
    expectedToolName: string,
    toolHandler: ToolHandler<ArgsDto, ResultDto>,
    userProfile: UserProfileDto,
    language: string,
    taskType: AiTaskType,
    timeConstraint: 'fast' | 'normal' | 'accurate' = 'normal',
    foodLogsForHandler?: FoodLogEntryDto[],
    nutritionGoalForHandler?: NutritionGoalDtoForAI | null,
    _messageId?: string,
  ): Promise<ResultDto | NonFoodDescriptionResult | { error: string } | null> {
    try {
      // 🔍 ติดตาม API calls
      this.logger.warn(
        `🔍 [API TRACKING] executeAgenticTaskWithResponsesAPI - About to call OpenAI API for ${taskType} - user: ${lineUserId}`,
      )

      this.logger.debug(
        `executeAgenticTaskWithResponsesAPI initiated for user: ${lineUserId}, taskType: ${taskType}, expectedTool: ${expectedToolName}`,
      )

      // Check for conversation history only for non-food analysis tasks
      // 🚀 ปรับปรุง: ลดการเรียก conversation history สำหรับ food analysis
      const conversationHistory =
        taskType !== AiTaskType.FoodAnalysis
          ? await this.conversationHistoryService.getRecentHistory(
              lineUserId,
              userProfile,
              this.getMaxHistoryTokensByConstraint(timeConstraint),
            )
          : null

      if (taskType === AiTaskType.FoodAnalysis) {
        this.logger.debug(
          `Skipping conversation history for food analysis task to reduce API calls`,
        )
      }

      // 🔍 เพิ่ม detailed tracking ก่อนเรียก OpenAI
      this.logger.warn(
        `🔍 [API TRACKING] About to call openaiService.createOpenaiResponse - TaskType: ${taskType} - User: ${lineUserId}`,
      )

      // 🚀 ปรับปรุง: เรียก selectModelInternal ครั้งเดียวแล้วใช้ซ้ำ
      const modelSelection = this.selectModelInternal(
        instructions,
        userProfile,
        timeConstraint,
        taskType,
      )

      this.logger.debug(
        `🚀 [OPTIMIZATION] Model selected once: ${modelSelection.deploymentName} for ${taskType} - avoiding multiple selectModelInternal calls`,
      )

      // 🔧 ปรับปรุง: ตรวจสอบและแก้ไข previous_response_id ให้เข้ากับ Responses API
      let validPreviousResponseId: string | undefined = undefined
      if (conversationHistory && conversationHistory.length > 0) {
        const lastResponseId =
          conversationHistory[conversationHistory.length - 1]?.responseId
        if (lastResponseId) {
          // Responses API คาดหวัง ID ที่ขึ้นต้นด้วย 'resp-'
          // Chat Completions API ใช้ ID ที่ขึ้นต้นด้วย 'chatcmpl-'
          if (lastResponseId.startsWith('resp-')) {
            validPreviousResponseId = lastResponseId
            this.logger.debug(
              `✅ Valid Responses API previous_response_id found: ${lastResponseId.substring(0, 12)}...`,
            )
          } else if (lastResponseId.startsWith('chatcmpl-')) {
            this.logger.debug(
              `⚠️ Skipping Chat Completions API ID for Responses API: ${lastResponseId.substring(0, 12)}... (incompatible format)`,
            )
          } else {
            this.logger.warn(
              `❓ Unknown response ID format: ${lastResponseId.substring(0, 12)}... - skipping previous_response_id`,
            )
          }
        }
      }

      const openAIResponse = await this.openaiService.createOpenaiResponse(
        modelSelection.deploymentName,
        {
          instructions,
          input: userInput,
          tools: tools?.map(
            (
              tool: OpenAI.Chat.Completions.ChatCompletionTool,
            ): OpenAI.Responses.FunctionTool => ({
              type: 'function',
              // Linter insists 'function' property does not exist. Flattening the structure.
              name: tool.function.name, // Flattened: name directly on FunctionTool
              description: tool.function.description, // Flattened: description directly on FunctionTool
              parameters: tool.function.parameters as Record<string, unknown>, // Changed to Record<string, unknown>
              strict: tool.function.strict ?? null, // Changed to ?? null
            }),
          ),
          tool_choice: 'auto', // Responses API might have different or more specific tool_choice options
          temperature: modelSelection.params.temperature,
          previous_response_id: validPreviousResponseId, // ✅ ใช้ validated response ID
          max_output_tokens: modelSelection.params.max_tokens,
          metadata: {
            lineUserId,
            messageId: _messageId || '',
            taskType,
            language,
          },
        },
      )

      this.logger.log(
        `🔍 Raw OpenAI Response for ${lineUserId}: ${JSON.stringify(openAIResponse, null, 2).substring(0, 1000)}...`,
      )

      if (
        openAIResponse &&
        typeof openAIResponse === 'object' &&
        'error' in openAIResponse &&
        openAIResponse.error !== null
      ) {
        const errorMessage =
          typeof openAIResponse.error === 'string'
            ? openAIResponse.error
            : JSON.stringify(openAIResponse.error)
        this.logger.error(`OpenAI Responses API call failed: ${errorMessage}`)
        return { error: errorMessage }
      }

      // Cast to OpenAI.Responses.Response after error check
      const successfulResponse = openAIResponse as OpenAI.Responses.Response

      // Save the current response for conversation state (using its ID)
      if (successfulResponse.id) {
        // 🔍 เพิ่ม logging เพื่อตรวจสอบประเภทของ response ID
        const responseIdType = successfulResponse.id.startsWith('resp-')
          ? 'Responses API'
          : successfulResponse.id.startsWith('chatcmpl-')
            ? 'Chat Completions API'
            : 'Unknown'

        this.logger.debug(
          `📝 Response ID from ${responseIdType}: ${successfulResponse.id.substring(0, 15)}... (will be saved to conversation history)`,
        )

        // 🚀 ปรับปรุง: ลดการบันทึก conversation history สำหรับ food analysis
        // เนื่องจากไม่จำเป็นต้องเก็บ intermediate tool calls
        if (taskType !== AiTaskType.FoodAnalysis) {
          await this.conversationHistoryService.addMessageToHistory(
            lineUserId,
            'assistant',
            JSON.stringify(successfulResponse),
            undefined,
            successfulResponse.id, // บันทึก ID ไว้ใน conversation history
          )
          this.logger.debug(
            `✅ Saved ${responseIdType} response to conversation history for user ${lineUserId}`,
          )
        } else {
          this.logger.debug(
            `Skipping intermediate conversation history for food analysis to reduce database writes`,
          )
        }
      } else {
        this.logger.warn(
          `⚠️ OpenAI Response does not contain ID - cannot save to conversation history for user ${lineUserId}`,
        )
      }

      return await this.processResponsesAPIOutput(
        successfulResponse, // Pass the successful response
        expectedToolName,
        toolHandler,
        userProfile,
        language,
        lineUserId,
        foodLogsForHandler,
        nutritionGoalForHandler,
        _messageId,
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.error(
        `executeAgenticTaskWithResponsesAPI error for user ${lineUserId}: ${message}`,
      )
      return { error: `Failed to execute agentic task: ${message}` }
    }
  }

  /**
   * Enhanced method to process Responses API output and handle tool calls
   * Now supports autonomous multi-tool workflows
   */
  private async processResponsesAPIOutput<ArgsDto, ResultDto extends object>(
    openAIResponse: OpenAI.Responses.Response | { error: string },
    expectedToolName: string,
    toolHandler: ToolHandler<ArgsDto, ResultDto>,
    userProfile: UserProfileDto,
    language: string,
    lineUserId: string,
    foodLogsForHandler?: FoodLogEntryDto[],
    nutritionGoalForHandler?: NutritionGoalDtoForAI | null,
    _messageId?: string,
  ): Promise<ResultDto | NonFoodDescriptionResult | { error: string } | null> {
    this.logger.log(
      `🔍 processResponsesAPIOutput called for user ${lineUserId}, expectedTool: ${expectedToolName}`,
    )

    if (
      typeof openAIResponse === 'object' &&
      'error' in openAIResponse &&
      openAIResponse.error
    ) {
      this.logger.error(
        `Error received directly in processResponsesAPIOutput: ${openAIResponse.error}`,
      )
      return { error: String(openAIResponse.error) }
    }

    const response = openAIResponse as OpenAI.Responses.Response
    let retrievedFoodLogs: FoodLogEntryDto[] | undefined = foodLogsForHandler
    let finalResult:
      | ResultDto
      | NonFoodDescriptionResult
      | { error: string }
      | null = null

    if (response.output && Array.isArray(response.output)) {
      this.logger.log(
        `📊 Response has output array with ${response.output.length} items`,
      )

      for (const outputItem of response.output) {
        // Check for function_call type in the output array
        const typedOutputItem =
          outputItem as OpenAI.Responses.ResponseOutputItem
        if (typedOutputItem.type === 'function_call') {
          const functionCallItem = typedOutputItem as any

          const toolName = functionCallItem.name as string
          const toolArgs = functionCallItem.arguments as string

          if (typeof toolName === 'string' && typeof toolArgs === 'string') {
            this.logger.log(
              `🛠️ AI called tool: ${toolName} via Responses API for user ${lineUserId}`,
            )
            // 🚀 ปรับปรุง: ลดการบันทึก tool calls สำหรับ food analysis
            if (expectedToolName !== foodAnalysisTool.function.name) {
              await this.conversationHistoryService.addMessageToHistory(
                lineUserId,
                'assistant',
                `[Tool Call: ${toolName} with args: ${toolArgs.substring(0, 100)}...]`,
                undefined,
                response.id,
              )
            } else {
              this.logger.debug(
                `Skipping tool call history for food analysis to reduce database writes`,
              )
            }

            try {
              const parsedArgs = JSON.parse(toolArgs) as unknown

              if (toolName === foodHistoryTool.function.name) {
                this.logger.log(
                  `🗂️ Processing food history retrieval for autonomous workflow`,
                )
                const foodHistoryResult = (await this.handleGetFoodHistory(
                  parsedArgs as any,
                  userProfile,
                  language,
                )) as FoodHistoryToolResult

                if ('error' in foodHistoryResult) {
                  this.logger.error(
                    `Error retrieving food history: ${foodHistoryResult.error}`,
                  )
                  finalResult = { error: String(foodHistoryResult.error) }
                  break
                }
                retrievedFoodLogs = foodHistoryResult.food_logs.map(
                  (log) =>
                    ({
                      ...log,
                      timestamp: new Date(log.timestamp),
                    }) as FoodLogEntryDto,
                )
                this.logger.log(
                  `Retrieved ${retrievedFoodLogs.length} food logs.`,
                )
                continue
              }

              if (toolName === expectedToolName) {
                this.logger.log(
                  `✅ Expected tool ${expectedToolName} called by AI. Handling...`,
                )
                finalResult = await toolHandler(
                  parsedArgs as ArgsDto,
                  userProfile,
                  language,
                  expectedToolName === eatingPatternTool.function.name ||
                    expectedToolName ===
                      conversationalFoodHistoryTool.function.name
                    ? retrievedFoodLogs
                    : foodLogsForHandler,
                  nutritionGoalForHandler,
                )

                // 🚀 ปรับปรุง: ลดการบันทึก tool results สำหรับ food analysis
                if (expectedToolName !== foodAnalysisTool.function.name) {
                  await this.conversationHistoryService.addMessageToHistory(
                    lineUserId,
                    'assistant',
                    `[Tool Result for ${toolName}]: ${JSON.stringify(finalResult).substring(0, 200)}...`,
                    undefined,
                    response.id,
                  )
                } else {
                  this.logger.debug(
                    `Skipping tool result history for food analysis to reduce database writes`,
                  )
                }
                break
              } else {
                this.logger.warn(
                  `AI called tool "${toolName}" but expected "${expectedToolName}".`,
                )
              }
            } catch (e) {
              const errorContent = e instanceof Error ? e.message : String(e)
              this.logger.error(
                `Error processing tool ${toolName}: ${errorContent}`,
              )
              // 🚀 ปรับปรุง: ลดการบันทึก error messages สำหรับ food analysis
              if (expectedToolName !== foodAnalysisTool.function.name) {
                await this.conversationHistoryService.addMessageToHistory(
                  lineUserId,
                  'assistant',
                  `[Tool Error for ${toolName}]: ${errorContent.substring(0, 200)}...`,
                  undefined,
                  response.id,
                )
              } else {
                this.logger.debug(
                  `Skipping tool error history for food analysis to reduce database writes`,
                )
              }
              finalResult = {
                error: `Error processing tool ${toolName}: ${errorContent}`,
              }
              break
            }
          } else {
            this.logger.warn(
              `AI event type 'function_call' but function name or arguments are missing/invalid. Item: ${JSON.stringify(functionCallItem)}`,
            )
            finalResult = { error: 'Malformed function_call data from AI.' }
            break
          }
        } else if (typedOutputItem.type === 'message') {
          // Added check for 'message' type for direct text
          const messageItem =
            typedOutputItem as OpenAI.Responses.ResponseOutputMessage
          if (
            messageItem.role === 'assistant' &&
            typeof messageItem.content === 'string'
          ) {
            this.logger.log(
              `💬 Received direct message content in output array: ${(messageItem.content as string).substring(0, 100)}...`, // Explicit cast to string
            )
            if (!finalResult && !expectedToolName) {
              // Only use if no tool was expected
              finalResult = {
                message: messageItem.content,
              } as unknown as ResultDto
              break
            } else if (!finalResult && expectedToolName) {
              this.logger.warn(
                `Received direct message content when tool '${expectedToolName}' was expected. AI might have answered directly.`,
              )
              finalResult = {
                error: `AI answered directly with a message when tool ${expectedToolName} was expected. Content: ${messageItem.content}`,
              }
              break
            }
          }
        }
        // Ensure no other 'else if (typedOutputItem.type === 'text')' exists in this loop
      }

      if (finalResult) {
        if (
          !(
            typeof finalResult === 'object' &&
            'error' in finalResult &&
            finalResult.error
          )
        ) {
          await this.cacheSuccessfulResults(
            finalResult,
            expectedToolName,
            lineUserId,
            response,
            _messageId,
          )
        }
        return finalResult
      } else if (response.output_text && !finalResult) {
        this.logger.log(
          `💬 Fallback/Primary: Received direct output_text from AI: ${response.output_text.substring(0, 100)}...`,
        )
        if (!expectedToolName && typeof response.output_text === 'string') {
          return { message: response.output_text } as unknown as ResultDto // For general queries
        } else if (expectedToolName === 'extract_food_analysis') {
          this.logger.log(
            `🎭 Non-food description detected when food analysis expected: ${response.output_text.substring(0, 100)}...`,
          )
          // ✨ Handle non-food images as valid responses, not errors
          return {
            type: 'non_food_description',
            description: response.output_text,
          } as NonFoodDescriptionResult as unknown as ResultDto
        } else if (expectedToolName) {
          return {
            error: `AI provided direct output_text when tool ${expectedToolName} was expected. Content: ${response.output_text}`,
          }
        }
      }

      this.logger.warn(
        `No actionable tool call or direct text output processed for expected tool: ${expectedToolName} in Responses API output.`,
      )
      return {
        error: `AI response did not result in an expected action for tool: ${expectedToolName}`,
      }
    } else if (response.output_text) {
      this.logger.log(
        `💬 Received direct output_text from AI (no output array): ${response.output_text.substring(0, 100)}...`,
      )
      if (!expectedToolName && typeof response.output_text === 'string') {
        return { message: response.output_text } as unknown as ResultDto // For general queries
      } else if (expectedToolName === 'extract_food_analysis') {
        this.logger.log(
          `🎭 Non-food description detected: ${response.output_text.substring(0, 100)}...`,
        )
        // ✨ Handle non-food images as valid responses, not errors
        return {
          type: 'non_food_description',
          description: response.output_text,
        } as NonFoodDescriptionResult as unknown as ResultDto
      } else if (expectedToolName) {
        return {
          error: `AI provided direct output_text instead of using the expected tool: ${expectedToolName}. Content: ${response.output_text}`,
        }
      }
    }

    this.logger.error(
      `Failed to process OpenAI Responses API output. No recognizable tool calls or text output found for ${expectedToolName}. Response: ${JSON.stringify(response).substring(0, 500)}`,
    )
    return { error: 'Failed to process OpenAI Responses API output structure.' }
  }

  /**
   * Helper method to cache successful analysis results
   */
  private async cacheSuccessfulResults<ResultDto extends object>(
    result: ResultDto | NonFoodDescriptionResult | { error: string } | null,
    expectedToolName: string,
    lineUserId: string,
    openAIResponse: unknown,
    _messageId?: string,
  ): Promise<void> {
    // Cache successful food analysis results
    if (
      result &&
      typeof result === 'object' &&
      !(
        'status' in result &&
        typeof result.status === 'string' &&
        result.status.includes('web_search_required')
      ) &&
      expectedToolName === foodAnalysisTool.function.name &&
      'food_name' in result &&
      typeof result.food_name === 'string' &&
      'calories' in result &&
      typeof result.calories === 'number'
    ) {
      try {
        this.logger.debug(
          `🗄️ Caching food analysis result: ${result.food_name}`,
        )

        const foodAnalysisResult = result as unknown as FoodAnalysisToolResult
        const title = `${foodAnalysisResult.food_name} - ${foodAnalysisResult.calories} kcal`
        const summary = `${foodAnalysisResult.portion || 'ไม่ระบุปริมาณ'} | โปรตีน: ${foodAnalysisResult.protein || 'N/A'}g | คาร์บ: ${foodAnalysisResult.carbs || 'N/A'}g | ไขมัน: ${foodAnalysisResult.fat || 'N/A'}g`

        // Extract response ID
        let responseId: string | undefined
        if (
          typeof openAIResponse === 'object' &&
          openAIResponse !== null &&
          'id' in openAIResponse
        ) {
          responseId = String(openAIResponse.id)
        }

        const analysisId =
          await this.conversationHistoryService.addAnalysisResult(
            lineUserId,
            'food_analysis',
            foodAnalysisResult,
            title,
            summary,
            foodAnalysisResult.imageUrl,
            responseId,
          )

        this.logger.log(
          `💾 Structured food analysis saved with ID: ${analysisId}`,
        )

        // Cache for immediate use if messageId is available
        if (_messageId && _messageId.trim() !== '') {
          this.analysisCacheService.set(
            _messageId,
            result as unknown as FoodAnalysisToolResult,
          )
          this.logger.debug(`🏷️ Also cached with messageId: ${_messageId}`)
        }
      } catch (structuredStorageError) {
        this.logger.warn(
          `⚠️ Structured storage error: ${structuredStorageError}`,
        )
      }
    }

    // Cache eating pattern analysis results
    if (
      result &&
      typeof result === 'object' &&
      expectedToolName === eatingPatternTool.function.name &&
      'calories_trend' in result &&
      'personalized_advice' in result
    ) {
      try {
        const eatingPatternResult = result as unknown as EatingPatternToolResult
        const title = `รูปแบบการกิน - ${eatingPatternResult.calories_trend === 'improving' ? 'ดีขึ้น' : eatingPatternResult.calories_trend === 'stable' ? 'คงที่' : eatingPatternResult.calories_trend === 'worsening' ? 'แย่ลง' : 'ข้อมูลไม่เพียงพอ'}`
        const summary = `แคลอรี่เฉลี่ย: ${eatingPatternResult.average_daily_calories || 'N/A'} kcal | รูปแบบ: ${eatingPatternResult.identified_patterns?.join(', ') || 'ไม่พบรูปแบบเฉพาะ'}`

        const analysisId =
          await this.conversationHistoryService.addAnalysisResult(
            lineUserId,
            'eating_pattern',
            eatingPatternResult,
            title,
            summary,
          )

        this.logger.log(
          `📊 Eating pattern analysis saved with ID: ${analysisId}`,
        )
      } catch (storageError) {
        this.logger.warn(`⚠️ Eating pattern storage error: ${storageError}`)
      }
    }
  }

  /**
   * Type-safe wrapper methods for tool handlers
   */
  private readonly handleExtractFoodAnalysisWrapper: ToolHandler<
    FoodAnalysisToolResult,
    FoodAnalysisToolResult
  > = async (args, userProfile, language) => {
    return this.handleExtractFoodAnalysis(args, userProfile, language)
  }

  private readonly handleCalculateNutritionGoalsWrapper: ToolHandler<
    NutritionGoalArgs,
    NutritionGoalToolResult
  > = (args, userProfile, language) => {
    return this.handleCalculateNutritionGoals(args, userProfile, language)
  }

  private readonly handleAnalyzeEatingPatternWrapper: ToolHandler<
    EatingPatternArgs,
    EatingPatternToolResult
  > = (args, userProfile, language, foodLogs, nutritionGoal) => {
    return this.handleAnalyzeEatingPattern(
      args,
      userProfile,
      language,
      foodLogs,
      nutritionGoal,
    )
  }

  private readonly handleRecommendMealsWrapper: ToolHandler<
    MealRecommendationArgs,
    MealRecommendationToolResult
  > = (args, userProfile, language) => {
    // Note: This wrapper doesn't use mealContext parameter since it's not in ToolHandler interface
    return this.handleRecommendMeals(args, userProfile, language, 'any meal')
  }

  private readonly handleGetFoodHistoryWrapper: ToolHandler<
    FoodHistoryArgs,
    FoodHistoryToolResult
  > = async (args, userProfile, language) => {
    return this.handleGetFoodHistory(args, userProfile, language)
  }

  private readonly handleConversationalFoodHistoryWrapper: ToolHandler<
    ConversationalFoodHistoryArgs,
    ConversationalFoodHistoryResult
  > = async (args, userProfile, language) => {
    return this.handleConversationalFoodHistory(args, userProfile, language)
  }

  // === NEW: ANALYSIS HISTORY METHODS ===

  /**
   * ดึงประวัติการวิเคราะห์สำหรับสร้างปุ่ม Quick Reply หรือ Rich Menu
   */
  async getAnalysisHistory(
    lineUserId: string,
    limit: number = 5,
    type?:
      | 'food_analysis'
      | 'nutrition_goal'
      | 'eating_pattern'
      | 'meal_recommendation',
  ) {
    try {
      const results =
        await this.conversationHistoryService.getRecentAnalysisResults(
          lineUserId,
          limit,
          type,
        )

      this.logger.log(
        `Retrieved ${results.length} analysis history items for user ${lineUserId}${type ? ` (type: ${type})` : ''}`,
      )

      return results.map((analysis) => ({
        id: analysis.id,
        type: analysis.type,
        title: analysis.title,
        summary: analysis.summary,
        createdAt: analysis.createdAt,
        imageUrl: analysis.imageUrl,
      }))
    } catch (error) {
      this.logger.error(
        `Failed to get analysis history for user ${lineUserId}: ${error instanceof Error ? error.message : String(error)}`,
      )
      return []
    }
  }

  /**
   * ดึงข้อมูลการวิเคราะห์แบบเต็มตาม ID สำหรับแสดงรายละเอียด
   */
  async getAnalysisDetail(lineUserId: string, analysisId: string) {
    try {
      const analysis = await this.conversationHistoryService.getAnalysisById(
        lineUserId,
        analysisId,
      )

      if (!analysis) {
        this.logger.warn(
          `Analysis not found: ${analysisId} for user ${lineUserId}`,
        )
        return null
      }

      this.logger.log(
        `Retrieved analysis detail: ${analysisId} for user ${lineUserId}`,
      )

      return analysis
    } catch (error) {
      this.logger.error(
        `Failed to get analysis detail ${analysisId} for user ${lineUserId}: ${error instanceof Error ? error.message : String(error)}`,
      )
      return null
    }
  }

  // ✅ Control Method Helper Functions
  private getMaxHistoryTokensByConstraint(
    timeConstraint: 'fast' | 'normal' | 'accurate',
  ): number {
    return AI_CONFIG.conversationControl.historyTokenLimits[timeConstraint]
  }

  private analyzeConversationContext(
    conversationHistory: Array<{
      role: 'user' | 'assistant'
      content: string
      responseId?: string // Assuming responseId might be stored here
    }> | null,
    currentQuery: string,
  ): {
    contextType:
      | 'new_conversation'
      | 'follow_up'
      | 'clarification'
      | 'related_topic'
    isFollowUp: boolean
    previousTopic: string | null
    lastResponseId: string | undefined
  } {
    if (!conversationHistory || conversationHistory.length === 0) {
      return {
        contextType: 'new_conversation',
        isFollowUp: false,
        previousTopic: null,
        lastResponseId: undefined,
      }
    }

    const assistantMessages = conversationHistory.filter(
      (msg) => msg.role === 'assistant',
    )
    const lastAssistantMessage = assistantMessages[assistantMessages.length - 1]

    const lastAssistantMessageContent =
      lastAssistantMessage?.content?.toLowerCase()
    const lastResponseId = lastAssistantMessage?.responseId // Extract responseId here

    const currentQueryLower = currentQuery.toLowerCase()

    // ใช้การตั้งค่าจาก config
    const { followUpKeywords, clarificationKeywords } =
      AI_CONFIG.conversationControl.conversationPatterns

    const isFollowUp = followUpKeywords.some((keyword) =>
      currentQueryLower.includes(keyword.toLowerCase()),
    )

    const isClarification = clarificationKeywords.some((keyword) =>
      currentQueryLower.includes(keyword.toLowerCase()),
    )

    // Extract previous topic from last assistant message
    let previousTopic: string | null = null
    if (lastAssistantMessageContent) {
      // Simple topic extraction (can be enhanced)
      const foodMentions = lastAssistantMessageContent.match(
        /(อาหาร|ผัก|ผลไม้|เนื้อ|ไก่|หมู|ปลา|ข้าว|แกง)/g,
      )
      if (foodMentions && foodMentions.length > 0) {
        previousTopic = foodMentions[0]
      }
    }

    let contextType:
      | 'new_conversation'
      | 'follow_up'
      | 'clarification'
      | 'related_topic'
    if (isClarification) {
      contextType = 'clarification'
    } else if (isFollowUp) {
      contextType = 'follow_up'
    } else if (conversationHistory.length > 2) {
      contextType = 'related_topic'
    } else {
      contextType = 'new_conversation'
    }

    return {
      contextType,
      isFollowUp: isFollowUp || isClarification,
      previousTopic,
      lastResponseId, // Use the extracted lastResponseId
    }
  }

  private selectRelevantConversationContext(
    conversationHistory: Array<{
      role: 'user' | 'assistant'
      content: string
      responseId?: string // Assuming responseId might be stored here
    }> | null,
    currentQuery: string,
    isFollowUp: boolean,
  ): Array<{ role: 'user' | 'assistant'; content: string }> | null {
    if (!conversationHistory || conversationHistory.length === 0) {
      return null
    }

    const { contextSelection } = AI_CONFIG.conversationControl

    // ใช้การตั้งค่าจาก config
    const messageCount = isFollowUp
      ? contextSelection.followUpMessages
      : contextSelection.regularMessages

    // จำกัดไม่ให้เกิน maxContextMessages
    const finalMessageCount = Math.min(
      messageCount,
      contextSelection.maxContextMessages,
    )

    return conversationHistory.slice(-finalMessageCount)
  }

  private constructOptimizedInputMessages(
    relevantContext: Array<{
      role: 'user' | 'assistant'
      content: string
    }> | null,
    currentQuery: string,
    maxTokens: number,
  ): OpenaiResponseInputMessage[] {
    const messages: OpenaiResponseInputMessage[] = []

    if (relevantContext && relevantContext.length > 0) {
      // เพิ่ม context messages โดยตรวจสอบ token limit
      let currentTokenCount = this.estimateTokenCount(currentQuery)

      for (const msg of relevantContext) {
        const msgTokenCount = this.estimateTokenCount(msg.content)
        if (currentTokenCount + msgTokenCount > maxTokens) {
          break // หยุดเมื่อใกล้เกิน token limit
        }

        messages.push({
          role: msg.role,
          content: msg.content,
        })
        currentTokenCount += msgTokenCount
      }
    }

    // เพิ่มข้อความปัจจุบัน
    messages.push({
      role: 'user',
      content: currentQuery,
    })

    return messages
  }

  private calculateOptimalOutputTokens(
    timeConstraint: 'fast' | 'normal' | 'accurate',
    contextAnalysis: { contextType: string; isFollowUp: boolean },
    queryLength: number,
  ): number {
    const { outputTokenSettings } = AI_CONFIG.conversationControl

    // Base tokens ตาม timeConstraint ใช้การตั้งค่าจาก config
    let baseTokens = outputTokenSettings.baseTokens[timeConstraint]

    // ปรับตาม context type ใช้ multiplier จาก config
    if (
      contextAnalysis.isFollowUp ||
      contextAnalysis.contextType === 'clarification'
    ) {
      baseTokens = Math.floor(
        baseTokens * outputTokenSettings.followUpMultiplier,
      )
    }

    // ปรับตามความยาวของคำถาม ใช้ multiplier จาก config
    if (queryLength > 100) {
      baseTokens = Math.floor(
        baseTokens * outputTokenSettings.longQueryMultiplier,
      )
    }

    // จำกัดไม่ให้เกิน maxOutputTokens
    return Math.min(baseTokens, outputTokenSettings.maxOutputTokens)
  }

  private estimateTokenCount(text: string): number {
    // ใช้ค่าคงที่สำหรับการประมาณ token (4 ตัวอักษร = 1 token สำหรับภาษาไทย/อังกฤษผสม)
    const charactersPerToken = 4
    return Math.ceil(text.length / charactersPerToken)
  }

  /**
   * Handle get_food_history tool call - retrieve user's food logs for AI analysis
   */
  private async handleConversationalFoodHistory(
    args: ConversationalFoodHistoryArgs,
    userProfile: UserProfileDto,
    language: string,
  ): Promise<ConversationalFoodHistoryResult> {
    this.logger.log(
      `Handling conversational food history query: ${args.query_type} for user profile: ${userProfile.lineUserId}`,
    )

    // 🔒 Security: Validate userProfile has required fields
    if (!userProfile.lineUserId) {
      this.logger.error('Security violation: Missing lineUserId in userProfile')
      throw new Error('Invalid user profile: missing lineUserId')
    }

    // 🔒 Security: Log the query for audit purposes
    this.logger.log(
      `Food history query audit - User: ${userProfile.lineUserId}, Query: ${args.user_question.substring(0, 100)}, Type: ${args.query_type}`,
    )

    try {
      // Determine time period for data retrieval
      let days = 30 // default
      let startDate: Date | undefined
      let endDate: Date | undefined

      if (args.time_period) {
        if (args.time_period.days) {
          days = Math.min(Math.max(args.time_period.days, 1), 90)
        }
        if (args.time_period.specific_date) {
          const specificDate = new Date(args.time_period.specific_date)
          startDate = new Date(specificDate.setHours(0, 0, 0, 0))
          endDate = new Date(specificDate.setHours(23, 59, 59, 999))
          days = 1
        }
        if (args.time_period.start_date && args.time_period.end_date) {
          startDate = new Date(args.time_period.start_date)
          endDate = new Date(args.time_period.end_date)
          days = Math.ceil(
            (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
          )
        }
      }

      // 🔒 Security: Get food logs with explicit lineUserId validation
      // This method already validates lineUserId internally
      const foodLogs = await this.foodLogService.getFoodLogsForAIAnalysis(
        userProfile.lineUserId,
        days,
        500, // higher limit for comprehensive analysis
      )

      // 🔒 Security: The underlying getFoodLogsForAIAnalysis already validates lineUserId
      // Additional validation is not needed here as the service layer handles it

      // 🔒 Security: Log data access for audit
      this.logger.log(
        `Data access audit - User: ${userProfile.lineUserId}, Retrieved: ${foodLogs.length} logs, Period: ${days} days`,
      )

      // Filter food logs based on criteria
      let filteredLogs = foodLogs

      if (startDate && endDate) {
        filteredLogs = foodLogs.filter((log) => {
          const logDate = new Date(log.timestamp)
          return logDate >= startDate && logDate <= endDate
        })
      }

      if (args.filters) {
        if (args.filters.meal_types && args.filters.meal_types.length > 0) {
          filteredLogs = filteredLogs.filter((log) =>
            args.filters!.meal_types!.includes(
              log.mealType as 'breakfast' | 'lunch' | 'dinner' | 'snack',
            ),
          )
        }
        if (args.filters.food_names && args.filters.food_names.length > 0) {
          filteredLogs = filteredLogs.filter((log) =>
            args.filters!.food_names!.some((name) =>
              log.foodName.toLowerCase().includes(name.toLowerCase()),
            ),
          )
        }
        if (args.filters.min_calories !== undefined) {
          filteredLogs = filteredLogs.filter(
            (log) => log.calories >= args.filters!.min_calories!,
          )
        }
        if (args.filters.max_calories !== undefined) {
          filteredLogs = filteredLogs.filter(
            (log) => log.calories <= args.filters!.max_calories!,
          )
        }
      }

      // Analyze data based on query type and focus
      const analysis = this.analyzeFilteredFoodLogs(
        filteredLogs,
        args.query_type,
        args.analysis_focus || [],
        userProfile,
        language,
      )

      // Generate natural language answer
      const answer = this.generateConversationalAnswer(
        args.user_question,
        args.query_type,
        filteredLogs,
        analysis,
        userProfile,
        language,
      )

      const result: ConversationalFoodHistoryResult = {
        answer,
        data_summary: {
          total_logs_analyzed: filteredLogs.length,
          date_range: {
            start:
              filteredLogs.length > 0
                ? new Date(
                    Math.min(
                      ...filteredLogs.map((log) =>
                        new Date(log.timestamp).getTime(),
                      ),
                    ),
                  )
                    .toISOString()
                    .split('T')[0]
                : new Date().toISOString().split('T')[0],
            end:
              filteredLogs.length > 0
                ? new Date(
                    Math.max(
                      ...filteredLogs.map((log) =>
                        new Date(log.timestamp).getTime(),
                      ),
                    ),
                  )
                    .toISOString()
                    .split('T')[0]
                : new Date().toISOString().split('T')[0],
          },
          key_insights: analysis.insights,
        },
        recommendations: analysis.recommendations,
        follow_up_suggestions: analysis.followUpSuggestions,
      }

      // 🔒 Security: Log successful query completion
      this.logger.log(
        `Food history query completed - User: ${userProfile.lineUserId}, Analyzed: ${filteredLogs.length} logs`,
      )

      return result
    } catch (error) {
      // 🔒 Security: Log security-related errors
      this.logger.error(
        `Error in handleConversationalFoodHistory for user ${userProfile.lineUserId}: ${error instanceof Error ? error.message : String(error)}`,
      )
      throw error
    }
  }

  private analyzeFilteredFoodLogs(
    logs: FoodLogEntryDto[],
    queryType: string,
    analysisFocus: string[],
    userProfile: UserProfileDto,
    language: string,
  ): {
    insights: string[]
    recommendations: string[]
    followUpSuggestions: string[]
  } {
    const insights: string[] = []
    const recommendations: string[] = []
    const followUpSuggestions: string[] = []

    if (logs.length === 0) {
      insights.push(
        language === 'th'
          ? 'ไม่พบข้อมูลการกินในช่วงเวลาที่ระบุ'
          : 'No food logs found for the specified period',
      )
      return { insights, recommendations, followUpSuggestions }
    }

    // Basic statistics
    const totalCalories = logs.reduce((sum, log) => sum + log.calories, 0)
    const avgCalories = totalCalories / logs.length
    const totalProtein = logs.reduce((sum, log) => sum + log.protein, 0)
    const totalCarbs = logs.reduce((sum, log) => sum + log.carbs, 0)
    const totalFat = logs.reduce((sum, log) => sum + log.fat, 0)

    // Meal type distribution
    const mealTypes = logs.reduce(
      (acc, log) => {
        acc[log.mealType] = (acc[log.mealType] || 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )

    // Generate insights based on query type
    switch (queryType) {
      case 'nutrition_summary':
        insights.push(
          language === 'th'
            ? `แคลอรี่เฉลี่ย: ${avgCalories.toFixed(0)} kcal ต่อมื้อ`
            : `Average calories: ${avgCalories.toFixed(0)} kcal per meal`,
        )
        insights.push(
          language === 'th'
            ? `โปรตีนรวม: ${totalProtein.toFixed(1)}g, คาร์บ: ${totalCarbs.toFixed(1)}g, ไขมัน: ${totalFat.toFixed(1)}g`
            : `Total protein: ${totalProtein.toFixed(1)}g, carbs: ${totalCarbs.toFixed(1)}g, fat: ${totalFat.toFixed(1)}g`,
        )
        break

      case 'meal_type_analysis':
        Object.entries(mealTypes).forEach(([mealType, count]) => {
          insights.push(
            language === 'th'
              ? `${mealType}: ${count} มื้อ`
              : `${mealType}: ${count} meals`,
          )
        })
        break

      case 'calorie_trends': {
        const dailyCalories = this.calculateDailyCalories(logs)
        const trend = this.calculateTrend(dailyCalories)
        insights.push(
          language === 'th'
            ? `แนวโน้มแคลอรี่: ${trend === 'increasing' ? 'เพิ่มขึ้น' : trend === 'decreasing' ? 'ลดลง' : 'คงที่'}`
            : `Calorie trend: ${trend}`,
        )
        break
      }
    }

    // Generate recommendations
    if (avgCalories < 300) {
      recommendations.push(
        language === 'th'
          ? 'ควรเพิ่มปริมาณอาหารในแต่ละมื้อ'
          : 'Consider increasing portion sizes',
      )
    }

    // Generate follow-up suggestions
    followUpSuggestions.push(
      language === 'th'
        ? 'ต้องการดูรายละเอียดของมื้ออาหารเฉพาะวันไหนไหม?'
        : 'Would you like to see details for specific days?',
    )

    return { insights, recommendations, followUpSuggestions }
  }

  private calculateDailyCalories(logs: FoodLogEntryDto[]): number[] {
    const dailyCalories: Record<string, number> = {}

    logs.forEach((log) => {
      const date = new Date(log.timestamp).toISOString().split('T')[0]
      dailyCalories[date] = (dailyCalories[date] || 0) + log.calories
    })

    return Object.values(dailyCalories)
  }

  private calculateTrend(
    values: number[],
  ): 'increasing' | 'decreasing' | 'stable' {
    if (values.length < 2) return 'stable'

    const firstHalf = values.slice(0, Math.floor(values.length / 2))
    const secondHalf = values.slice(Math.floor(values.length / 2))

    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length

    const diff = secondAvg - firstAvg
    if (Math.abs(diff) < 50) return 'stable'
    return diff > 0 ? 'increasing' : 'decreasing'
  }

  private generateConversationalAnswer(
    userQuestion: string,
    queryType: string,
    logs: FoodLogEntryDto[],
    analysis: {
      insights: string[]
      recommendations: string[]
      followUpSuggestions: string[]
    },
    userProfile: UserProfileDto,
    language: string,
  ): string {
    if (logs.length === 0) {
      return language === 'th'
        ? 'ขออภัยค่ะ ไม่พบข้อมูลการกินในช่วงเวลาที่คุณถามนะคะ อาจจะลองถามในช่วงเวลาอื่นดูไหมคะ?'
        : "Sorry, I couldn't find any food logs for the period you asked about. Would you like to try a different time period?"
    }

    let answer =
      language === 'th' ? 'จากข้อมูลการกินของคุณ ' : 'Based on your food logs, '

    // Add insights
    if (analysis.insights.length > 0) {
      answer +=
        analysis.insights.join(language === 'th' ? ' และ ' : ' and ') + '. '
    }

    // Add recommendations if any
    if (analysis.recommendations.length > 0) {
      answer += language === 'th' ? 'คำแนะนำ: ' : 'Recommendations: '
      answer +=
        analysis.recommendations.join(language === 'th' ? ' และ ' : ' and ') +
        '. '
    }

    return answer
  }

  private async handleGetFoodHistory(
    args: FoodHistoryArgs,
    userProfile: UserProfileDto,
    language: string,
  ): Promise<FoodHistoryToolResult> {
    const days = Math.min(args.days || 30, 90) // Default 30 days, max 90
    const limit = Math.min(args.limit || 100, 500) // Default 100 logs, max 500

    this.logger.log(
      `Getting food history for user ${userProfile.lineUserId}: ${days} days, limit ${limit}`,
    )

    try {
      const foodLogs = await this.foodLogService.getFoodLogsForAIAnalysis(
        userProfile.lineUserId,
        days,
        limit,
      )

      // Calculate summary statistics
      const mealTypesDistribution = {
        breakfast: 0,
        lunch: 0,
        dinner: 0,
        snack: 0,
        other: 0,
      }

      const dateRange = {
        start: '',
        end: '',
      }

      if (foodLogs.length > 0) {
        // Sort by timestamp to get date range
        const sortedLogs = [...foodLogs].sort(
          (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
        )
        dateRange.start = sortedLogs[0].timestamp.toISOString()
        dateRange.end =
          sortedLogs[sortedLogs.length - 1].timestamp.toISOString()

        // Count meal types
        foodLogs.forEach((log) => {
          const mealType = log.mealType.toLowerCase()
          if (mealType in mealTypesDistribution) {
            mealTypesDistribution[
              mealType as keyof typeof mealTypesDistribution
            ]++
          } else {
            mealTypesDistribution.other++
          }
        })
      }

      // Calculate days covered
      const daysCovered =
        foodLogs.length > 0
          ? Math.ceil(
              (new Date(dateRange.end).getTime() -
                new Date(dateRange.start).getTime()) /
                (1000 * 60 * 60 * 24),
            ) + 1
          : 0

      const message =
        language === 'th'
          ? `พบประวัติการกิน ${foodLogs.length} รายการ ใน ${daysCovered} วัน (ช่วง ${days} วันที่ผ่านมา)`
          : `Found ${foodLogs.length} food logs in ${daysCovered} days (past ${days} days)`

      return {
        food_logs: foodLogs.map((log) => ({
          timestamp: log.timestamp.toISOString(),
          mealType: log.mealType,
          foodName: log.foodName,
          calories: log.calories,
          protein: log.protein,
          carbs: log.carbs,
          fat: log.fat,
          fiber: log.fiber,
        })),
        summary: {
          total_logs: foodLogs.length,
          days_covered: daysCovered,
          date_range: dateRange,
          meal_types_distribution: mealTypesDistribution,
        },
        message,
      }
    } catch (error) {
      this.logger.error(
        `Error getting food history for user ${userProfile.lineUserId}: ${error instanceof Error ? error.message : String(error)}`,
      )

      const errorMessage =
        language === 'th'
          ? 'ไม่สามารถดึงประวัติการกินได้ในขณะนี้'
          : 'Unable to retrieve food history at this time'

      return {
        food_logs: [],
        summary: {
          total_logs: 0,
          days_covered: 0,
          date_range: { start: '', end: '' },
          meal_types_distribution: {
            breakfast: 0,
            lunch: 0,
            dinner: 0,
            snack: 0,
            other: 0,
          },
        },
        message: errorMessage,
      }
    }
  }

  /**
   * NEW: Manual workflow eating pattern analysis - Sequential tool calls
   * Reliable alternative to autonomous AI workflow
   */
  async analyzeEatingPatternWithAI(
    lineUserId: string,
    userProfile: UserProfileDto,
    nutritionGoal: NutritionGoalDtoForAI | null = null,
    language: string = 'th',
    timeConstraint: 'fast' | 'normal' | 'accurate' = 'normal',
  ): Promise<EatingPatternToolResult | { error: string } | null> {
    try {
      this.logger.log(
        `🔧 [Manual Workflow] Starting eating pattern analysis for user ${lineUserId}`,
      )

      // Step 1: Get food history manually
      this.logger.log(
        `📋 Step 1: Retrieving food history for user ${lineUserId}`,
      )
      const foodHistoryResult = await this.getFoodHistoryForAI(
        lineUserId,
        userProfile,
        30, // days
        100, // limit
        language,
      )

      if ('error' in foodHistoryResult) {
        this.logger.error(
          `❌ Failed to retrieve food history: ${foodHistoryResult.error}`,
        )
        return {
          error: `Failed to retrieve food history: ${foodHistoryResult.error}`,
        }
      }

      // Convert food history to format expected by eating pattern handler
      const foodLogs: FoodLogEntryDto[] = foodHistoryResult.food_logs.map(
        (log) => ({
          timestamp: new Date(log.timestamp),
          mealType: log.mealType,
          foodName: log.foodName,
          calories: log.calories,
          protein: log.protein,
          carbs: log.carbs,
          fat: log.fat,
          fiber: log.fiber,
        }),
      )

      this.logger.log(
        `✅ Step 1 completed: Retrieved ${foodLogs.length} food logs from ${foodHistoryResult.summary.days_covered} days`,
      )

      // Step 2: Analyze eating patterns with retrieved data
      this.logger.log(
        `📊 Step 2: Analyzing eating patterns for user ${lineUserId}`,
      )

      const analysisResult = await this.analyzeEatingPattern(
        lineUserId,
        userProfile,
        foodLogs,
        nutritionGoal,
        language,
        timeConstraint,
      )

      if (
        analysisResult &&
        typeof analysisResult === 'object' &&
        'error' in analysisResult
      ) {
        this.logger.error(
          `❌ Failed to analyze eating patterns: ${analysisResult.error}`,
        )
        return analysisResult
      }

      // Enhanced logging for manual workflow completion
      if (
        analysisResult &&
        typeof analysisResult === 'object' &&
        'calories_trend' in analysisResult
      ) {
        this.logger.log(
          `✅ Manual workflow completed successfully for user ${lineUserId}`,
        )
        this.logger.log(
          `📈 Analysis results: Trend: ${analysisResult.calories_trend}, Patterns: ${analysisResult.identified_patterns?.length || 0} identified, Advice: ${analysisResult.personalized_advice.substring(0, 100)}...`,
        )

        // Add food history context to the result
        const enhancedResult: EatingPatternToolResult = {
          ...analysisResult,
          basic_analysis_details: {
            days_analyzed:
              analysisResult.basic_analysis_details?.days_analyzed ||
              foodHistoryResult.summary.days_covered,
            total_logs:
              analysisResult.basic_analysis_details?.total_logs ||
              foodHistoryResult.summary.total_logs,
            skipped_meal_counts: analysisResult.basic_analysis_details
              ?.skipped_meal_counts || { breakfast: 0, lunch: 0, dinner: 0 },
            average_eating_window_hours:
              analysisResult.basic_analysis_details
                ?.average_eating_window_hours,
            calculated_late_night_eating_frequency:
              analysisResult.basic_analysis_details
                ?.calculated_late_night_eating_frequency,
          },
        }

        return enhancedResult
      }

      return analysisResult as EatingPatternToolResult | null
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.error(
        `❌ analyzeEatingPatternWithAI (manual workflow) error for user ${lineUserId}: ${message}`,
        error instanceof Error ? error.stack : undefined,
      )
      return {
        error: `Manual eating pattern analysis failed: ${message}`,
      }
    }
  }

  /**
   * NEW: Get Food History for AI Analysis (Public Method)
   * Allows external services to retrieve food history for AI processing
   */
  async getFoodHistoryForAI(
    lineUserId: string,
    userProfile: UserProfileDto,
    days: number = 30,
    limit: number = 100,
    language: string = 'th',
  ): Promise<FoodHistoryToolResult | { error: string }> {
    try {
      this.logger.log(
        `📋 Getting food history for AI analysis: user ${lineUserId}, ${days} days, limit ${limit}`,
      )

      const result = await this.handleGetFoodHistory(
        { days, limit },
        userProfile,
        language,
      )

      this.logger.log(
        `✅ Retrieved ${result.food_logs.length} food logs for AI analysis`,
      )

      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.error(
        `❌ getFoodHistoryForAI error for user ${lineUserId}: ${message}`,
      )
      return { error: `Failed to retrieve food history: ${message}` }
    }
  }

  /**
   * 🤖 FULL AUTONOMOUS AI ANALYSIS
   * ให้ AI สร้างการวิเคราะห์ทั้งหมดเองโดยไม่พึ่ง manual patterns
   */
  private async generateFullAutonomousAnalysis(
    foodLogs: FoodLogEntryDto[],
    userProfile: UserProfileDto,
    nutritionGoal: NutritionGoalDtoForAI | null,
    language: string,
    caloriesTrend: string,
    averageDailyCalories: number,
    nutritionalQualityScore: number,
  ): Promise<{
    personalizedAdvice: string
    identifiedPatterns: string[]
    improvementSuggestions: string[]
  } | null> {
    try {
      // เตรียมข้อมูลสำหรับ AI วิเคราะห์
      const foodDataSummary = foodLogs
        .map((log) => ({
          date: log.timestamp.toISOString().split('T')[0],
          time: log.timestamp.toTimeString().split(' ')[0],
          meal: log.mealType,
          food: log.foodName,
          calories: log.calories,
          protein: log.protein,
          carbs: log.carbs,
          fat: log.fat,
        }))
        .slice(0, 20) // จำกัดข้อมูลเพื่อไม่ให้ token เกิน

      const userContext = {
        name: userProfile.displayName || 'คุณ',
        goal: userProfile.goal || 'ไม่ระบุ',
        age: userProfile.age || null,
        gender: userProfile.gender || 'ไม่ระบุ',
        dietType: userProfile.dietType || 'ปกติ',
        healthConditions: userProfile.healthConditions || [],
        currentCalories: averageDailyCalories,
        trend: caloriesTrend,
        qualityScore: nutritionalQualityScore,
        goalCalories: nutritionGoal?.daily_calories || null,
      }

      // System prompt สำหรับ Full Autonomous Analysis
      const autonomousPrompt = `คุณเป็นนักโภชนาการ AI ผู้เชี่ยวชาญในการวิเคราะห์รูปแบบการกิน

ภารกิจ: วิเคราะห์ข้อมูลการกินและสร้างการวิเคราะห์ที่สมบูรณ์

กฎสำคัญ:
- ใช้ข้อมูลที่ให้มาเท่านั้น อย่าแต่งเพิ่ม
- เรียกชื่อ "${userContext.name}" ในการสนทนา
- ใช้ภาษาไทยที่เป็นธรรมชาติและเป็นกันเอง
- ห้ามใช้ ** หรือ markdown formatting ใดๆ เด็ดขาด
- ใช้ emoji เบาๆ ให้เหมาะสม (ไม่เกิน 2-3 ตัวต่อข้อความ)
- เน้นจุดเด่นก่อน แล้วค่อยแนะนำส่วนที่ปรับปรุงได้
- สร้างข้อความที่สร้างแรงบันดาลใจ

โปรดตอบกลับเป็น JSON format:
{
  "personalizedAdvice": "คำแนะนำส่วนบุคคลที่สมบูรณ์ รวมแนวโน้มแคลอรี่และข้อมูลสำคัญ",
  "identifiedPatterns": ["รูปแบบที่พบ 1", "รูปแบบที่พบ 2", "รูปแบบที่พบ 3"],
  "improvementSuggestions": ["ข้อเสนอแนะ 1", "ข้อเสนอแนะ 2", "ข้อเสนอแนะ 3"]
}

ข้อมูลผู้ใช้:
${JSON.stringify(userContext, null, 2)}

ข้อมูลการกิน (${foodDataSummary.length} รายการล่าสุด):
${JSON.stringify(foodDataSummary, null, 2)}`

      // เรียก AI
      const deploymentName =
        this.openaiService.getGpt41_miniModelDeployment() ||
        this.openaiService.getGpt41DeploymentName()

      if (!deploymentName) {
        this.logger.warn('No AI model available for autonomous analysis')
        return null
      }

      const aiResponse = (await this.openaiService.getChatCompletion(
        deploymentName,
        [
          {
            role: 'system',
            content: autonomousPrompt,
          },
          {
            role: 'user',
            content: `กรุณาวิเคราะห์ข้อมูลการกินของ ${userContext.name} และสร้างการวิเคราะห์ที่สมบูรณ์โดยไม่ใช้ ** formatting`,
          },
        ],
        {
          temperature: 0.7,
          max_tokens: 6000,
        },
      )) as OpenAI.Chat.Completions.ChatCompletion | { error: string }

      if ('error' in aiResponse) {
        this.logger.warn(`Autonomous AI failed: ${aiResponse.error}`)
        return null
      }

      const aiContent = aiResponse.choices[0]?.message?.content?.trim()

      if (aiContent && aiContent.length > 50) {
        try {
          const analysisData: unknown = JSON.parse(aiContent)

          // Type guard
          const isValidAnalysis = (
            data: unknown,
          ): data is EnhancedAnalysisComponents => {
            return (
              typeof data === 'object' &&
              data !== null &&
              typeof (data as Record<string, unknown>).personalizedAdvice ===
                'string' &&
              Array.isArray(
                (data as Record<string, unknown>).identifiedPatterns,
              ) &&
              Array.isArray(
                (data as Record<string, unknown>).improvementSuggestions,
              )
            )
          }

          if (isValidAnalysis(analysisData)) {
            return {
              personalizedAdvice: analysisData.personalizedAdvice,
              identifiedPatterns: analysisData.identifiedPatterns,
              improvementSuggestions: analysisData.improvementSuggestions,
            }
          } else {
            this.logger.warn('Invalid autonomous analysis structure')
            return null
          }
        } catch (parseError) {
          this.logger.warn(
            `Autonomous analysis JSON parse failed: ${parseError}`,
          )
          return null
        }
      } else {
        this.logger.warn('Autonomous analysis produced insufficient content')
        return null
      }
    } catch (error) {
      this.logger.error(
        `Autonomous analysis error: ${error instanceof Error ? error.message : String(error)}`,
      )
      return null
    }
  }

  /**
   * 🤖 AI-Enhanced Text Generation for All Analysis Components
   * ใช้ AI สำหรับทำให้ข้อความทุกส่วนมีชีวิตชีวาและเป็นส่วนตัว
   * ส่วนการคำนวณใช้ manual logic เพื่อความแม่นยำ
   */
  private async enhanceAnalysisComponentsWithAI(
    baseAdvice: string,
    basePatterns: string[],
    baseProblematicBehaviors: string[],
    baseImprovementSuggestions: string[],
    userProfile: UserProfileDto,
    language: string,
    nutritionalQualityScore: number,
    caloriesTrend: string,
    averageDailyCalories: number,
    weekendWeekdayDiff?: number,
    lateNightFrequency?: number,
  ): Promise<{
    personalizedAdvice: string
    identifiedPatterns: string[]
    improvementSuggestions: string[]
  }> {
    try {
      // เตรียมข้อมูลที่ AI จะใช้สร้างข้อความ
      const contextData = {
        userName: userProfile.displayName || 'คุณ',
        goal: userProfile.goal || 'ไม่ระบุ',
        age: userProfile.age || null,
        gender: userProfile.gender || 'ไม่ระบุ',
        baseAdvice,
        patterns: basePatterns,
        issues: baseProblematicBehaviors,
        suggestions: baseImprovementSuggestions,
        qualityScore: nutritionalQualityScore,
        caloriesTrend: caloriesTrend,
        averageCalories: averageDailyCalories,
        weekendEffect: weekendWeekdayDiff,
        lateNightIssue: lateNightFrequency,
        dietType: userProfile.dietType || 'ปกติ',
        healthConditions: userProfile.healthConditions || [],
      }

      // System prompt สำหรับ AI text enhancement
      const enhancementPrompt = `คุณเป็นนักโภชนาการ AI ที่เชี่ยวชาญในการเขียนข้อความที่เป็นกันเองและสร้างแรงบันดาลใจ

ภารกิจ: แปลงข้อมูลการวิเคราะห์เป็นข้อความที่น่าสนใจ เป็นกันเอง และใช้ชื่อผู้ใช้

กฎสำคัญ:
- ใช้ข้อมูลที่ให้มาเท่านั้น อย่าแต่งเพิ่ม
- เรียกชื่อ "${contextData.userName}" ในการสนทนา
- ใช้ภาษาไทยที่เป็นธรรมชาติและเป็นกันเอง
- ไม่ใช้ ** หรือ markdown formatting ใดๆ
- ใช้ emoji เบาๆ ให้เหมาะสม
- เน้นจุดเด่นก่อน แล้วค่อยแนะนำส่วนที่ปรับปรุงได้

โปรดตอบกลับเป็น JSON format ตามรูปแบบนี้:
{
  "personalizedAdvice": "คำแนะนำส่วนบุคคลแบบเต็ม รวมข้อมูลแนวโน้มแคลอรี่ด้วย",
  "identifiedPatterns": ["รูปแบบที่พบ 1", "รูปแบบที่พบ 2"],
  "improvementSuggestions": ["ข้อเสนอแนะ 1", "ข้อเสนอแนะ 2"]
}

ข้อมูลการวิเคราะห์:
${JSON.stringify(contextData, null, 2)}`

      // เรียก AI สำหรับ text generation
      const deploymentName =
        this.openaiService.getGpt41_miniModelDeployment() ||
        this.openaiService.getGpt41DeploymentName()

      if (!deploymentName) {
        this.logger.warn(
          'No AI model available for text enhancement, using base texts',
        )
        return {
          personalizedAdvice: baseAdvice,
          identifiedPatterns: basePatterns,
          improvementSuggestions: baseImprovementSuggestions,
        }
      }

      const enhancedResponse = (await this.openaiService.getChatCompletion(
        deploymentName,
        [
          {
            role: 'system',
            content: enhancementPrompt,
          },
          {
            role: 'user',
            content: `กรุณาปรับปรุงข้อความทั้งหมดสำหรับ ${contextData.userName} จากข้อมูลการวิเคราะห์ข้างต้น โดยส่งกลับเป็น JSON format`,
          },
        ],
        {
          temperature: 0.7, // เพิ่มความเป็นธรรมชาติ
          max_tokens: 800, // เพิ่มขนาดเพื่อรองรับทุกส่วน
        },
      )) as OpenAI.Chat.Completions.ChatCompletion | { error: string }

      if ('error' in enhancedResponse) {
        const errorMessage =
          typeof enhancedResponse.error === 'string'
            ? enhancedResponse.error
            : 'Unknown error'
        this.logger.warn(`AI text enhancement failed: ${errorMessage}`)
        return {
          personalizedAdvice: baseAdvice,
          identifiedPatterns: basePatterns,
          improvementSuggestions: baseImprovementSuggestions,
        }
      }

      const enhancedContent =
        enhancedResponse.choices[0]?.message?.content?.trim()

      if (enhancedContent && enhancedContent.length > 50) {
        try {
          // พยายาม parse JSON response
          const enhancedData: unknown = JSON.parse(enhancedContent)

          // Type guard function
          const isValidEnhancedData = (
            data: unknown,
          ): data is EnhancedAnalysisComponents => {
            return (
              typeof data === 'object' &&
              data !== null &&
              typeof (data as Record<string, unknown>).personalizedAdvice ===
                'string' &&
              Array.isArray(
                (data as Record<string, unknown>).identifiedPatterns,
              ) &&
              Array.isArray(
                (data as Record<string, unknown>).improvementSuggestions,
              )
            )
          }

          // ตรวจสอบว่ามีข้อมูลครบถ้วน
          if (isValidEnhancedData(enhancedData)) {
            this.logger.log(
              `✨ Enhanced all analysis components with AI for ${userProfile.lineUserId}`,
            )
            return {
              personalizedAdvice: enhancedData.personalizedAdvice,
              identifiedPatterns: enhancedData.identifiedPatterns,
              improvementSuggestions: enhancedData.improvementSuggestions,
            }
          } else {
            this.logger.warn(
              'AI enhancement JSON missing required fields, using base texts',
            )
            return {
              personalizedAdvice: baseAdvice,
              identifiedPatterns: basePatterns,
              improvementSuggestions: baseImprovementSuggestions,
            }
          }
        } catch (parseError) {
          this.logger.warn(
            `AI enhancement JSON parse failed, using base texts: ${parseError}`,
          )
          return {
            personalizedAdvice: baseAdvice,
            identifiedPatterns: basePatterns,
            improvementSuggestions: baseImprovementSuggestions,
          }
        }
      } else {
        this.logger.warn(
          'AI enhancement produced insufficient content, using base texts',
        )
        return {
          personalizedAdvice: baseAdvice,
          identifiedPatterns: basePatterns,
          improvementSuggestions: baseImprovementSuggestions,
        }
      }
    } catch (error) {
      this.logger.error(
        `AI text enhancement error: ${error instanceof Error ? error.message : String(error)}`,
      )
      return {
        personalizedAdvice: baseAdvice,
        identifiedPatterns: basePatterns,
        improvementSuggestions: baseImprovementSuggestions,
      }
    }
  }

  async generateMealPlanningPresentation(
    lineUserId: string,
    mealRecommendationResult: MealRecommendationToolResult,
    userProfile: UserProfileDto,
    language: string = 'th',
    timeConstraint: 'fast' | 'normal' | 'accurate' = 'normal',
  ): Promise<string | null> {
    try {
      this.logger.log(
        `[Enhanced Responses API] Generating meal planning presentation for user ${lineUserId}`,
      )

      // สร้าง system prompt สำหรับการเจนเนอเรทข้อความแสดงผล
      const systemPrompt = this.createMealPlanningPresentationSystemPrompt(
        userProfile,
        language,
      )

      // เตรียม user input สำหรับ Responses API
      const userInput = `กรุณาสร้างข้อความการแสดงผลแผนมื้ออาหารที่สวยงามและเป็นมิตรจากข้อมูลต่อไปนี้:

${JSON.stringify(mealRecommendationResult, null, 2)}

ข้อกำหนด:
1. ใช้ข้อความต้อนรับที่เป็นมิตรและเรียกชื่อผู้ใช้ "${userProfile.displayName || 'คุณ'}"
2. แสดงเมนูอาหารในรูปแบบที่จัดหมวดหมู่ตามมื้อ (เช้า กลางวัน เย็น)
3. ใส่รายละเอียดโภชนาการและประโยชน์ของแต่ละเมนู
4. ให้คำแนะนำเพิ่มเติมด้านโภชนาการ
5. ใช้รูปแบบที่อ่านง่ายและสวยงาม
6. ตอบเป็นภาษาไทยทั้งหมด
7. ใช้โทนเสียงที่เป็นมิตรและให้กำลังใจ`

      // ใช้ Completions API แทน Responses API เพื่อหลีกเลี่ยง tool calls
      const taskType = AiTaskType.GeneralNutritionQuery
      const modelConfig = this.selectModelInternal(
        userInput,
        userProfile,
        timeConstraint,
        taskType,
      )
      const deploymentName = modelConfig.deploymentName

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userInput,
        },
      ]

      // เรียกใช้ OpenAI Completions API
      const response = (await this.openaiService.getChatCompletion(
        deploymentName,
        messages,
        {
          temperature: 0.7,
          max_tokens: 6000,
        },
      )) as OpenAI.Chat.Completions.ChatCompletion | { error: string }

      if ('error' in response) {
        this.logger.error(
          `generateMealPlanningPresentation error for user ${lineUserId}: ${response.error}`,
        )
        return null
      }

      const generatedText =
        response.choices?.[0]?.message?.content?.trim() || null

      if (!generatedText) {
        this.logger.warn(
          `No presentation text generated for user ${lineUserId}`,
        )
        return null
      }

      this.logger.debug(
        `Generated meal planning presentation for user ${lineUserId}: ${generatedText.substring(0, 200)}...`,
      )

      return generatedText
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.error(
        `generateMealPlanningPresentation error for user ${lineUserId}: ${message}`,
      )
      return null
    }
  }

  private createMealPlanningPresentationSystemPrompt(
    userProfile: UserProfileDto,
    language: string = 'th',
  ): string {
    const {
      goal,
      dietType,
      foodAllergies,
      healthConditions,
      preferredCuisine,
      preferredFlavorProfiles,
    } = userProfile

    return `You are a friendly AI nutritionist chatbot operating on LINE messaging platform. You specialize in creating beautiful and engaging meal planning presentations. You communicate in a warm, supportive manner and use emojis generously to make conversations more lively and encouraging.

User Profile:
- Name: ${userProfile.displayName || 'User'}
- Goal: ${goal || 'Not specified'}
- Diet Type: ${dietType || 'Normal'}
- Food Allergies: ${foodAllergies?.join(', ') || 'None'}
- Health Conditions: ${healthConditions?.join(', ') || 'None'}
- Preferred Cuisine: ${preferredCuisine?.join(', ') || 'Not specified'}
- Preferred Flavors: ${preferredFlavorProfiles?.join(', ') || 'Not specified'}

Your responsibilities as a LINE chatbot:
1. Create beautiful and engaging meal planning presentations
2. Use warm, friendly greetings and address users by name
3. Organize content in easy-to-read format with clear sections
4. Include detailed nutritional information in an accessible way
5. Provide practical health recommendations suitable for users
6. Use generous emojis and formatting for visual appeal (✨, 🍽️, 📋, 💡, 🥗, 🍎, 💪, 🌟, 👍, 💚, 🎯)
7. Maintain an encouraging, friendly tone throughout
8. Make meal planning feel achievable and enjoyable

Presentation format desired:
- Warm greeting with emojis
- Meal categorization (breakfast, lunch, dinner)
- Detailed menu descriptions with nutritional benefits
- Additional health tips and recommendations
- Encouraging closing message

Communication style as LINE chatbot:
- Friendly and conversational
- Use emojis naturally and generously
- Be encouraging and positive
- Avoid overly formal language
- Make recommendations feel practical and doable
- Celebrate healthy choices and motivate continued progress

Guidelines to avoid:
- Overly formal or medical tone
- Repetitive unnecessary information
- Recommendations not suitable for the user`
  }

  async generateNutritionGoalPresentation(
    lineUserId: string,
    nutritionGoalResult: NutritionGoalToolResult,
    userProfile: UserProfileDto,
    language: string = 'th',
    timeConstraint: 'fast' | 'normal' | 'accurate' = 'normal',
  ): Promise<string | null> {
    try {
      this.logger.log(
        `[Enhanced Responses API] Generating nutrition goal presentation for user ${lineUserId}`,
      )

      // สร้าง system prompt สำหรับการเจนเนอเรทข้อความแสดงผล
      const systemPrompt = this.createNutritionGoalPresentationSystemPrompt(
        userProfile,
        language,
      )

      // เตรียม user input สำหรับ Responses API
      const userInput = `กรุณาสร้างข้อความการแสดงผลเป้าหมายโภชนาการที่สวยงามและเป็นมิตรจากข้อมูลต่อไปนี้:

${JSON.stringify(nutritionGoalResult, null, 2)}

ข้อกำหนด:
1. ใช้ข้อความต้อนรับที่เป็นมิตรและเรียกชื่อผู้ใช้ "${userProfile.displayName || 'คุณ'}"
2. แสดงเป้าหมายโภชนาการในรูปแบบที่เข้าใจง่าย
3. อธิบาย BMR และ TDEE ให้เข้าใจง่าย
4. แสดงการกระจายของ macronutrients ในรูปแบบที่ชัดเจน
5. ให้คำแนะนำด้านการกินและออกกำลังกาย
6. ตอบเป็นภาษาไทยทั้งหมด
7. ใช้โทนเสียงที่เป็นมิตรและให้กำลังใจ`

      // ใช้ Completions API
      const taskType = AiTaskType.GeneralNutritionQuery
      const modelConfig = this.selectModelInternal(
        userInput,
        userProfile,
        timeConstraint,
        taskType,
      )
      const deploymentName = modelConfig.deploymentName

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userInput,
        },
      ]

      // เรียกใช้ OpenAI Completions API
      const response = (await this.openaiService.getChatCompletion(
        deploymentName,
        messages,
        {
          temperature: 0.7,
          max_tokens: 5200,
        },
      )) as OpenAI.Chat.Completions.ChatCompletion | { error: string }

      if ('error' in response) {
        this.logger.error(
          `generateNutritionGoalPresentation error for user ${lineUserId}: ${response.error}`,
        )
        return null
      }

      const generatedText =
        response.choices?.[0]?.message?.content?.trim() || null

      if (!generatedText) {
        this.logger.warn(
          `No nutrition goal presentation text generated for user ${lineUserId}`,
        )
        return null
      }

      this.logger.debug(
        `Generated nutrition goal presentation for user ${lineUserId}: ${generatedText.substring(0, 200)}...`,
      )

      return generatedText
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.error(
        `generateNutritionGoalPresentation error for user ${lineUserId}: ${message}`,
      )
      return null
    }
  }

  private createNutritionGoalPresentationSystemPrompt(
    userProfile: UserProfileDto,
    language: string = 'th',
  ): string {
    const { goal, dietType, activityLevel, age, gender, weightKg, heightCm } =
      userProfile

    return `You are a friendly AI nutritionist chatbot operating on LINE messaging platform. You specialize in explaining nutrition goals in simple, easy-to-understand, and encouraging ways. You communicate warmly and use emojis generously to make conversations more engaging and supportive.

User Profile:
- Name: ${userProfile.displayName || 'User'}
- Gender: ${gender || 'Not specified'}
- Age: ${age || 'Not specified'} years
- Weight: ${weightKg || 'Not specified'} kg
- Height: ${heightCm || 'Not specified'} cm
- Goal: ${goal || 'Not specified'}
- Diet Type: ${dietType || 'Normal'}
- Activity Level: ${activityLevel || 'Not specified'}

Your responsibilities as a LINE chatbot:
1. Create friendly and easy-to-understand nutrition goal presentations
2. Explain BMR (Basal Metabolic Rate) and TDEE (Total Daily Energy Expenditure) in simple terms
3. Present calorie and nutrient goals clearly and encouragingly
4. Explain macronutrient distribution (protein, carbs, fat) in accessible language
5. Provide practical recommendations that users can actually follow
6. Use generous emojis and formatting for visual appeal (🎯, 💪, 📊, ✨, 🌟, 💡, 👍, 💚, 🍎, 🥗)
7. Maintain an encouraging, motivational tone throughout
8. Make nutrition goals feel achievable and exciting

Presentation format desired:
- Warm, personalized greeting with emojis
- Simple explanations of BMR and TDEE
- Clear calorie and nutrient goals
- Macronutrient distribution breakdown
- Practical actionable recommendations
- Encouraging motivational message

Communication style as LINE chatbot:
- Friendly and conversational
- Use emojis naturally throughout
- Be encouraging and positive
- Avoid complex medical terminology
- Make goals feel achievable and exciting
- Celebrate progress and motivate continued success

Guidelines to avoid:
- Complex medical terminology
- Information overload that causes confusion
- Hard-to-remember numbers presented without context`
  }

  async generateEatingPatternPresentation(
    lineUserId: string,
    eatingPatternResult: EatingPatternToolResult,
    userProfile: UserProfileDto,
    language: string = 'th',
    timeConstraint: 'fast' | 'normal' | 'accurate' = 'normal',
  ): Promise<string | null> {
    try {
      this.logger.log(
        `[Enhanced Responses API] Generating eating pattern presentation for user ${lineUserId}`,
      )

      // สร้าง system prompt สำหรับการเจนเนอเรทข้อความแสดงผล
      const systemPrompt = this.createEatingPatternPresentationSystemPrompt(
        userProfile,
        language,
      )

      // เตรียม user input สำหรับ Responses API
      const userInput = `Please create a beautiful and friendly eating pattern analysis presentation from the following data:

${JSON.stringify(eatingPatternResult, null, 2)}

Requirements:
1. Use friendly greeting and address user as "${userProfile.displayName || 'คุณ'}"
2. Present eating pattern analysis in an easy-to-understand format
3. Explain trends and patterns in a supportive way
4. Provide actionable recommendations
5. Use encouraging tone throughout
6. Respond in ${language.toUpperCase()} language only
7. Use emojis and formatting for better readability
8. Be supportive and motivational`

      // ใช้ Completions API
      const taskType = AiTaskType.GeneralNutritionQuery
      const modelConfig = this.selectModelInternal(
        userInput,
        userProfile,
        timeConstraint,
        taskType,
      )
      const deploymentName = modelConfig.deploymentName

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userInput,
        },
      ]

      // เรียกใช้ OpenAI Completions API
      const response = (await this.openaiService.getChatCompletion(
        deploymentName,
        messages,
        {
          temperature: 0.7,
          max_tokens: 5500,
        },
      )) as OpenAI.Chat.Completions.ChatCompletion | { error: string }

      if ('error' in response) {
        this.logger.error(
          `generateEatingPatternPresentation error for user ${lineUserId}: ${response.error}`,
        )
        return null
      }

      const generatedText =
        response.choices?.[0]?.message?.content?.trim() || null

      if (!generatedText) {
        this.logger.warn(
          `No eating pattern presentation text generated for user ${lineUserId}`,
        )
        return null
      }

      this.logger.debug(
        `Generated eating pattern presentation for user ${lineUserId}: ${generatedText.substring(0, 200)}...`,
      )

      return generatedText
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.error(
        `generateEatingPatternPresentation error for user ${lineUserId}: ${message}`,
      )
      return null
    }
  }

  private createEatingPatternPresentationSystemPrompt(
    userProfile: UserProfileDto,
    language: string = 'th',
  ): string {
    const { goal, dietType, activityLevel, age, gender, weightKg, heightCm } =
      userProfile

    return `You are a friendly AI nutritionist chatbot operating on LINE messaging platform. You specialize in creating beautiful and encouraging eating pattern analysis presentations. You communicate in a warm, supportive manner and use emojis generously to make conversations more engaging and friendly.

User Profile:
- Name: ${userProfile.displayName || 'User'}
- Gender: ${gender || 'Not specified'}
- Age: ${age || 'Not specified'} years
- Weight: ${weightKg || 'Not specified'} kg
- Height: ${heightCm || 'Not specified'} cm
- Goal: ${goal || 'Not specified'}
- Diet Type: ${dietType || 'Normal'}
- Activity Level: ${activityLevel || 'Not specified'}

Your responsibilities as a LINE chatbot:
1. Create beautiful and encouraging eating pattern analysis presentations
2. Use warm, friendly greetings and address users by name
3. Present complex nutritional data in simple, understandable formats
4. Provide supportive analysis of eating trends and patterns
5. Offer practical, actionable recommendations
6. Use generous emojis and formatting to enhance readability (💪, 📊, ⭐, 🎯, 💡, 🍽️, ⏰, 📈, 📉, ✨, 🌟, 👍, 💚)
7. Maintain an encouraging, motivational tone throughout
8. Be supportive even when discussing areas for improvement

Presentation format desired:
- Warm, personalized greeting with emojis
- Clear sections for different analysis aspects
- Visual representation using emojis and symbols
- Trend explanations in supportive language
- Practical recommendations with action steps
- Encouraging closing message

Communication style as LINE chatbot:
- Friendly and conversational
- Use emojis naturally throughout the text
- Be encouraging and positive
- Avoid overly technical medical terminology
- Make recommendations feel achievable
- Celebrate positive patterns and gently guide improvements`
  }
}
