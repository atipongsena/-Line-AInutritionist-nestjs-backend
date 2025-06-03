import { Injectable, Logger } from '@nestjs/common'
import { UserProfileDto } from '../user/user.interface'

/**
 * Prompt Caching Service for optimizing OpenAI API calls
 * Based on OpenAI Prompt Caching best practices
 */
@Injectable()
export class PromptCachingService {
  private readonly logger = new Logger(PromptCachingService.name)

  /**
   * Create cached system prompt with static content first for better cache hit rates
   * Static content should be placed at the beginning to maximize caching efficiency
   */
  createCachedSystemPrompt(
    staticContent: string,
    additionalStaticContent?: string,
  ): string {
    // Static content first - this will be cached by OpenAI
    return `${staticContent}

=== CACHED STATIC KNOWLEDGE BASE ===
You are an AI nutritionist specializing in comprehensive food analysis and health advice.

CORE CAPABILITIES:
- Advanced nutritional analysis with precise macro and micronutrient calculations
- Thai and international cuisine expertise
- Medical dietary considerations and restrictions
- Personalized recommendation engine
- Evidence-based nutritional science application

ANALYSIS STANDARDS:
- Use peer-reviewed nutritional databases (USDA, Thai FDA, etc.)
- Apply portion size standardization (metric system preferred)
- Consider bioavailability and nutrient absorption factors
- Account for cooking methods and food processing effects
- Integrate cultural and regional dietary patterns

HEALTH CONSIDERATIONS FRAMEWORK:
- BMI and metabolic health indicators
- Age-specific nutritional requirements
- Gender-specific needs and hormonal factors
- Activity level and energy expenditure
- Pregnancy, lactation, and growth phases
- Chronic disease management (diabetes, hypertension, etc.)
- Food allergies and intolerances

RESPONSE QUALITY STANDARDS:
- Provide evidence-based recommendations
- Include confidence levels for estimates
- Suggest alternative options when appropriate
- Consider cost-effectiveness and accessibility
- Maintain cultural sensitivity and preferences

TOOL CALLING PRINCIPLES:
1. Always use the appropriate tool for analysis - never guess or provide direct answers without tool calls
2. Plan your tool usage before execution
3. Parse tool arguments carefully and completely
4. Handle tool errors gracefully with user-friendly messages

AGENTIC WORKFLOW REMINDERS:
- You are an agent: Continue working until the user's query is completely resolved
- Use tools for data gathering, analysis, and verification
- Plan multi-step processes when needed
- Only terminate when the problem is fully solved

TOOL PRIORITY ORDER:
1. extract_food_analysis: Primary tool for food analysis
2. calculate_nutrition_goals: For personalized nutrition target calculation
3. analyze_eating_pattern: For dietary pattern analysis
4. recommend_meals: For meal planning and suggestions

ERROR HANDLING:
- If tool fails, explain the issue clearly to the user
- Suggest alternative approaches when possible
- Maintain helpful tone even during errors
- Log detailed error information for debugging

${additionalStaticContent || ''}

=== END CACHED SECTION ===`
  }

  /**
   * Create dynamic user context section (placed after static content for caching)
   */
  createDynamicUserContext(
    userProfile: UserProfileDto,
    dynamicContent: string,
  ): string {
    return `
=== DYNAMIC USER CONTEXT ===
${this.formatUserProfileForPrompt(userProfile)}

${dynamicContent}

=== EXECUTION GUIDELINES ===
- Prioritize user safety and health
- Provide actionable, specific advice
- Use appropriate language (${userProfile.language || 'th'})
- Consider user's current health status and goals
- Integrate cultural food preferences and availability
- Current timestamp: ${new Date().toISOString()}
- User timezone consideration: Analyze timing appropriately for Thai context
`
  }

  /**
   * Format user profile information for prompt inclusion
   */
  private formatUserProfileForPrompt(userProfile: UserProfileDto): string {
    const profile: string[] = []

    // Basic demographics
    if (userProfile.age) profile.push(`Age: ${userProfile.age} years`)
    if (userProfile.gender) profile.push(`Gender: ${userProfile.gender}`)

    // Physical metrics
    if (userProfile.weightKg && userProfile.heightCm) {
      const bmi = (
        userProfile.weightKg / Math.pow(userProfile.heightCm / 100, 2)
      ).toFixed(1)
      profile.push(
        `BMI: ${bmi} (Weight: ${userProfile.weightKg}kg, Height: ${userProfile.heightCm}cm)`,
      )
    }

    // Metabolic calculations (if available)
    const profileWithCalculations = userProfile as any
    if (profileWithCalculations.calculatedBmr) {
      profile.push(`BMR: ${profileWithCalculations.calculatedBmr} kcal/day`)
    }

    if (profileWithCalculations.calculatedTdee) {
      profile.push(`TDEE: ${profileWithCalculations.calculatedTdee} kcal/day`)
    }

    // Pre-calculated nutrition goals
    const nutritionGoals: string[] = []
    if (profileWithCalculations.dailyCaloriesGoal) {
      nutritionGoals.push(
        `Calories: ${profileWithCalculations.dailyCaloriesGoal} kcal`,
      )
    }
    if (profileWithCalculations.dailyProteinGoal) {
      nutritionGoals.push(
        `Protein: ${profileWithCalculations.dailyProteinGoal}g`,
      )
    }
    if (profileWithCalculations.dailyCarbsGoal) {
      nutritionGoals.push(`Carbs: ${profileWithCalculations.dailyCarbsGoal}g`)
    }
    if (profileWithCalculations.dailyFatGoal) {
      nutritionGoals.push(`Fat: ${profileWithCalculations.dailyFatGoal}g`)
    }
    if (profileWithCalculations.dailyFiberGoal) {
      nutritionGoals.push(`Fiber: ${profileWithCalculations.dailyFiberGoal}g`)
    }
    if (profileWithCalculations.dailyWaterGoal) {
      nutritionGoals.push(`Water: ${profileWithCalculations.dailyWaterGoal}ml`)
    }

    if (nutritionGoals.length > 0) {
      profile.push(`Daily Nutrition Targets: ${nutritionGoals.join(', ')}`)
    }

    // Goals and preferences
    if (userProfile.goal) profile.push(`Goal: ${userProfile.goal}`)
    if (userProfile.activityLevel)
      profile.push(`Activity Level: ${userProfile.activityLevel}`)
    if (userProfile.dietType) profile.push(`Diet Type: ${userProfile.dietType}`)

    // Health considerations
    if (
      userProfile.healthConditions &&
      userProfile.healthConditions.length > 0
    ) {
      profile.push(
        `Health Conditions: ${userProfile.healthConditions.join(', ')}`,
      )
    }
    if (userProfile.foodAllergies && userProfile.foodAllergies.length > 0) {
      profile.push(`Food Allergies: ${userProfile.foodAllergies.join(', ')}`)
    }

    // Food preferences
    if (
      userProfile.preferredCuisine &&
      userProfile.preferredCuisine.length > 0
    ) {
      profile.push(
        `Preferred Cuisines: ${userProfile.preferredCuisine.join(', ')}`,
      )
    }

    return profile.join('\n')
  }

  /**
   * Create optimized prompt structure for maximum cache efficiency
   */
  createOptimizedPrompt(
    taskType: string,
    staticInstructions: string,
    dynamicContext: string,
    userProfile: UserProfileDto,
    additionalTools?: string,
  ): string {
    // Static sections first for caching
    const cachedSection = this.createCachedSystemPrompt(
      staticInstructions,
      additionalTools,
    )

    // Dynamic sections last
    const dynamicTaskContext = `
=== DYNAMIC TASK CONTEXT ===
Task Type: ${taskType}
${dynamicContext}
`

    const dynamicUserSection = this.createDynamicUserContext(
      userProfile,
      dynamicTaskContext,
    )

    return `${cachedSection}\n${dynamicUserSection}`
  }

  /**
   * Estimate prompt tokens for cost optimization and caching eligibility
   */
  estimatePromptTokens(prompt: string): number {
    // Rough estimation: 1 token ≈ 4 characters for English, more for Thai
    const baseEstimate = Math.ceil(prompt.length / 4)

    // Adjust for Thai content (typically requires more tokens)
    const thaiCharCount = (prompt.match(/[\u0E00-\u0E7F]/g) || []).length
    const thaiTokenBonus = Math.ceil(thaiCharCount * 0.3) // 30% more tokens for Thai

    return baseEstimate + thaiTokenBonus
  }

  /**
   * Check if prompt is eligible for caching (>= 1024 tokens)
   */
  isEligibleForCaching(prompt: string): boolean {
    return this.estimatePromptTokens(prompt) >= 1024
  }

  /**
   * Create cache-optimized prompt with token count logging
   */
  createPromptWithMetrics(
    taskType: string,
    staticInstructions: string,
    dynamicContext: string,
    userProfile: UserProfileDto,
    additionalTools?: string,
  ): { prompt: string; estimatedTokens: number; cachingEligible: boolean } {
    const prompt = this.createOptimizedPrompt(
      taskType,
      staticInstructions,
      dynamicContext,
      userProfile,
      additionalTools,
    )

    const estimatedTokens = this.estimatePromptTokens(prompt)
    const cachingEligible = this.isEligibleForCaching(prompt)

    if (cachingEligible) {
      this.logger.debug(
        `✅ Created cache-eligible prompt for ${taskType}: ~${estimatedTokens} tokens (${prompt.length} chars)`,
      )
    } else {
      this.logger.warn(
        `⚠️ Prompt for ${taskType} may not benefit from caching: ~${estimatedTokens} tokens (${prompt.length} chars) - needs ≥1024 tokens`,
      )
    }

    return { prompt, estimatedTokens, cachingEligible }
  }
}
