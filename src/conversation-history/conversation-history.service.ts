import { Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import {
  ConversationHistory,
  ConversationMessage,
  AnalysisResult,
} from './conversation-history.schema'
import { UserProfileDto } from '../user/user.interface' // Changed from ../ai/ai.service
import { AI_CONFIG } from '../ai/ai.config' // Added import

// Configuration for conversation history
const MAX_HISTORY_LENGTH = 60 // Max number of messages to keep
const MAX_TOKEN_COUNT = 3000 // Approximate max tokens for context window (sum of user + assistant messages)
// Average tokens per character (very rough estimate, can be refined)
// English: ~0.25 tokens/char (1 token ~ 4 chars)
// Thai: Could be higher, e.g., 0.5-1 token/char due to multi-byte characters and less sub-word tokenization
// Let's use a general estimate, can be language-specific later
const AVG_TOKENS_PER_CHAR = 0.4

// Define interfaces for structured data within AnalysisResult.data for display purposes
interface FoodAnalysisDisplayData {
  calories?: number | string
  protein?: number | string
  carbs?: number | string
  fat?: number | string
  recommendation?: string
}

interface NutritionGoalDisplayDailyGoals {
  calories?: number | string
  protein?: number | string
  carbs?: number | string
  fat?: number | string
}

interface NutritionGoalDisplayData {
  bmr?: number | string
  tdee?: number | string
  daily_goals?: NutritionGoalDisplayDailyGoals
}

interface MealRecommendationDisplayFood {
  name?: string
  calories?: number | string
}

interface MealRecommendationDisplayData {
  foods?: MealRecommendationDisplayFood[]
}

/**
 * ⚡ Optimized ConversationHistoryService with batch processing and deduplication
 */
@Injectable()
export class ConversationHistoryService {
  private readonly logger = new Logger(ConversationHistoryService.name)

  // 🚀 Batch processing system
  private messageBatch = new Map<string, ConversationMessage[]>()
  private batchTimers = new Map<string, NodeJS.Timeout>()
  private readonly BATCH_DELAY = 1000 // 1 second delay before writing batch
  private readonly MAX_BATCH_SIZE = 10 // Maximum messages per batch

  // 📊 Performance tracking
  private batchWrites = 0
  private individualWrites = 0

  // 🔒 Prevent duplicate analysis storage
  private recentAnalysisIds = new Set<string>()
  private readonly ANALYSIS_DEDUP_TTL = 5 * 60 * 1000 // 5 minutes

  constructor(
    @InjectModel(ConversationHistory.name)
    private readonly conversationHistoryModel: Model<ConversationHistory>,
  ) {}

  private estimateTokenCount(text: string): number {
    if (!text) return 0
    return Math.ceil(text.length * AVG_TOKENS_PER_CHAR)
  }

  /**
   * ⚡ Enhanced message addition with intelligent batching
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async addMessageToHistory(
    lineUserId: string,
    role: 'user' | 'assistant',
    content: string,
    analysisResult?: AnalysisResult,
    responseId?: string,
  ): Promise<void> {
    // ✅ ตรวจสอบว่าควรเก็บข้อความใน history หรือไม่
    if (this.shouldExcludeFromHistory(content)) {
      this.logger.debug(
        `Skipping history storage for user ${lineUserId}: excluded by rules`,
      )
      return
    }

    // 🔍 Check for duplicate analysis
    if (analysisResult?.id && this.recentAnalysisIds.has(analysisResult.id)) {
      this.logger.debug(`Skipping duplicate analysis: ${analysisResult.id}`)
      return
    }

    const newMessage: ConversationMessage = {
      role,
      content,
      timestamp: new Date(),
      analysisResult,
      responseId,
    }

    // 📝 Add to analysis deduplication set
    if (analysisResult?.id) {
      this.recentAnalysisIds.add(analysisResult.id)
      setTimeout(() => {
        this.recentAnalysisIds.delete(analysisResult.id)
      }, this.ANALYSIS_DEDUP_TTL)
    }

    // 🔄 Add to batch processing
    this.addToBatch(lineUserId, newMessage)
  }

  /**
   * 🔄 Smart batch processing system
   */
  private addToBatch(lineUserId: string, message: ConversationMessage): void {
    // Initialize batch if not exists
    if (!this.messageBatch.has(lineUserId)) {
      this.messageBatch.set(lineUserId, [])
    }

    const batch = this.messageBatch.get(lineUserId)!
    batch.push(message)

    // Clear existing timer
    const existingTimer = this.batchTimers.get(lineUserId)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    // Force write if batch is full, otherwise schedule delayed write
    if (batch.length >= this.MAX_BATCH_SIZE) {
      void this.processBatch(lineUserId)
    } else {
      const timer = setTimeout(() => {
        void this.processBatch(lineUserId)
      }, this.BATCH_DELAY)

      this.batchTimers.set(lineUserId, timer)
    }
  }

  /**
   * 💾 Process batch writes efficiently
   */
  private async processBatch(lineUserId: string): Promise<void> {
    const batch = this.messageBatch.get(lineUserId)
    if (!batch || batch.length === 0) return

    // Clear batch and timer
    this.messageBatch.delete(lineUserId)
    const timer = this.batchTimers.get(lineUserId)
    if (timer) {
      clearTimeout(timer)
      this.batchTimers.delete(lineUserId)
    }

    try {
      const startTime = performance.now()

      // Find existing history or create new
      let history = await this.conversationHistoryModel.findOne({ lineUserId })

      if (!history) {
        history = new this.conversationHistoryModel({
          lineUserId,
          messages: batch,
        })
      } else {
        // Add all messages from batch
        history.messages.push(...batch)

        // Trim if exceeds max length
        if (history.messages.length > MAX_HISTORY_LENGTH) {
          history.messages = history.messages.slice(
            history.messages.length - MAX_HISTORY_LENGTH,
          )
        }
      }

      await history.save()
      this.batchWrites++

      const duration = (performance.now() - startTime).toFixed(2)
      this.logger.log(
        `📦 Batch processed for ${lineUserId}: ${batch.length} messages (${duration}ms)`,
      )
    } catch (error) {
      this.logger.error(`Failed to process batch for ${lineUserId}:`, error)

      // Fallback: try individual writes
      for (const message of batch) {
        await this.fallbackIndividualWrite(lineUserId, message)
      }
    }
  }

  /**
   * 🔄 Fallback individual write for failed batches
   */
  private async fallbackIndividualWrite(
    lineUserId: string,
    message: ConversationMessage,
  ): Promise<void> {
    try {
      let history = await this.conversationHistoryModel.findOne({ lineUserId })

      if (!history) {
        history = new this.conversationHistoryModel({
          lineUserId,
          messages: [message],
        })
      } else {
        history.messages.push(message)
        if (history.messages.length > MAX_HISTORY_LENGTH) {
          history.messages = history.messages.slice(-MAX_HISTORY_LENGTH)
        }
      }

      await history.save()
      this.individualWrites++

      this.logger.debug(`✅ Fallback write completed for ${lineUserId}`)
    } catch (error) {
      this.logger.error(`Fallback write failed for ${lineUserId}:`, error)
    }
  }

  /**
   * 🔍 Optimized analysis result storage with deduplication
   */
  async addAnalysisResult(
    lineUserId: string,
    analysisType: AnalysisResult['type'],
    result: Record<string, unknown>,
    title: string,
    summary: string,
    imageUrl?: string,
    responseId?: string,
  ): Promise<string> {
    const analysisId = `${analysisType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // 🔍 Check for duplicate analysis
    if (this.recentAnalysisIds.has(analysisId)) {
      this.logger.warn(`Duplicate analysis ID detected: ${analysisId}`)
      return analysisId
    }

    const analysisResult: AnalysisResult = {
      type: analysisType,
      id: analysisId,
      title,
      summary,
      data: result,
      createdAt: new Date(),
      imageUrl,
    }

    const content = this.formatAnalysisForDisplay(analysisResult)

    // Use regular addMessageToHistory which will use batching
    await this.addMessageToHistory(
      lineUserId,
      'assistant',
      content,
      analysisResult,
      responseId,
    )

    this.logger.log(
      `Analysis result queued for ${lineUserId}: ${analysisType} - ${title}`,
    )
    return analysisId
  }

  /**
   * 📊 Force write all pending batches (useful for shutdown)
   */
  async flushAllBatches(): Promise<void> {
    const userIds = Array.from(this.messageBatch.keys())

    if (userIds.length > 0) {
      this.logger.log(`🔄 Flushing ${userIds.length} pending batches...`)

      const flushPromises = userIds.map((userId) => this.processBatch(userId))
      await Promise.all(flushPromises)

      this.logger.log(`✅ All batches flushed successfully`)
    }
  }

  /**
   * 📈 Get performance metrics
   */
  getBatchMetrics(): {
    batchWrites: number
    individualWrites: number
    pendingBatches: number
    efficiency: number
  } {
    const totalWrites = this.batchWrites + this.individualWrites
    const efficiency =
      totalWrites > 0 ? (this.batchWrites / totalWrites) * 100 : 0

    return {
      batchWrites: this.batchWrites,
      individualWrites: this.individualWrites,
      pendingBatches: this.messageBatch.size,
      efficiency,
    }
  }

  /**
   * จัดรูปแบบการแสดงผลของ analysis สำหรับ chat
   */
  private formatAnalysisForDisplay(analysis: AnalysisResult): string {
    switch (analysis.type) {
      case 'food_analysis': {
        const foodData = analysis.data as FoodAnalysisDisplayData
        return `🍽️ **${analysis.title}**\n\n📊 **คุณค่าทางโภชนาการ:**\n• แคลอรี่: ${String(foodData.calories ?? 'N/A')} kcal\n• โปรตีน: ${String(foodData.protein ?? 'N/A')} g\n• คาร์โบไhydrates: ${String(foodData.carbs ?? 'N/A')} g\n• ไขมัน: ${String(foodData.fat ?? 'N/A')} g\n\n💡 **คำแนะนำ:**\n${foodData.recommendation ?? analysis.summary}\n\n✅ *บันทึกเรียบร้อยแล้ว - สามารถดูย้อนหลังได้*`
      }

      case 'nutrition_goal': {
        const goalData = analysis.data as NutritionGoalDisplayData
        const dailyGoals = goalData.daily_goals
        return `🎯 **เป้าหมายโภชนาการ**\n\n📈 **BMR:** ${String(goalData.bmr ?? 'N/A')} kcal/วัน\n📈 **TDEE:** ${String(goalData.tdee ?? 'N/A')} kcal/วัน\n\n🥗 **เป้าหมายรายวัน:**\n• แคลอรี่: ${String(dailyGoals?.calories ?? 'N/A')} kcal\n• โปรตีน: ${String(dailyGoals?.protein ?? 'N/A')} g\n• คาร์โบไhydrates: ${String(dailyGoals?.carbs ?? 'N/A')} g\n• ไขมัน: ${String(dailyGoals?.fat ?? 'N/A')} g\n\n✅ *บันทึกเรียบร้อยแล้ว - สามารถดูย้อนหลังได้*`
      }

      case 'eating_pattern': {
        return `📊 **การวิเคราะห์รูปแบบการกิน**\n\n${analysis.summary}\n\n✅ *บันทึกเรียบร้อยแล้ว - สามารถดูย้อนหลังได้*`
      }

      case 'meal_recommendation': {
        const mealData = analysis.data as MealRecommendationDisplayData
        const foods = Array.isArray(mealData.foods) ? mealData.foods : []
        const foodsList = foods
          .map(
            (food: MealRecommendationDisplayFood) =>
              `• ${food.name ?? 'Unknown'} (${String(food.calories ?? 'N/A')} kcal)`,
          )
          .join('\n')
        return `🍴 **แนะนำอาหาร: ${analysis.title}**\n\n📋 **เมนูแนะนำ:**\n${foodsList || analysis.summary}\n\n✅ *บันทึกเรียบร้อยแล้ว - สามารถดูย้อนหลังได้*`
      }

      default: {
        return `📝 **${analysis.title}**\n\n${analysis.summary}\n\n✅ *บันทึกเรียบร้อยแล้ว - สามารถดูย้อนหลังได้*`
      }
    }
  }

  /**
   * ดึงรายการ analysis ย้อนหลังสำหรับสร้างปุ่ม
   */
  async getRecentAnalysisResults(
    lineUserId: string,
    limit: number = 5,
    type?: AnalysisResult['type'],
  ): Promise<AnalysisResult[]> {
    try {
      const history = await this.conversationHistoryModel.findOne({
        lineUserId,
      })
      if (!history) return []

      const analysisResults = history.messages
        .filter(
          (msg) =>
            msg.analysisResult && (!type || msg.analysisResult.type === type),
        )
        .map((msg) => msg.analysisResult!)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, limit)

      this.logger.log(
        `Retrieved ${analysisResults.length} analysis results for user ${lineUserId}${type ? ` (type: ${type})` : ''}`,
      )

      return analysisResults
    } catch (error) {
      this.logger.error(
        `Failed to get analysis results for user ${lineUserId}: ${error instanceof Error ? error.message : String(error)}`,
      )
      return []
    }
  }

  /**
   * ดึง analysis result ตาม ID
   */
  async getAnalysisById(
    lineUserId: string,
    analysisId: string,
  ): Promise<AnalysisResult | null> {
    try {
      const history = await this.conversationHistoryModel.findOne({
        lineUserId,
      })
      if (!history) return null

      const message = history.messages.find(
        (msg) => msg.analysisResult && msg.analysisResult.id === analysisId,
      )

      return message?.analysisResult || null
    } catch (error) {
      this.logger.error(
        `Failed to get analysis by ID ${analysisId} for user ${lineUserId}: ${error instanceof Error ? error.message : String(error)}`,
      )
      return null
    }
  }

  /**
   * Retrieves recent conversation history, trimmed by token count.
   * @param lineUserId The LINE user ID.
   * @param userProfile Optional user profile for language context (not used in current logic but good for future).
   * @param maxTokens Maximum tokens to aim for in the returned history. Defaults to MAX_TOKEN_COUNT.
   * @returns Array of ConversationMessage or null if no history.
   */
  async getRecentHistory(
    lineUserId: string,
    userProfile?: UserProfileDto, // Included for future use (e.g., language specific token estimation)
    maxTokens: number = MAX_TOKEN_COUNT,
  ): Promise<ConversationMessage[] | null> {
    this.logger.log(
      `Getting recent history for user ${lineUserId}, max tokens: ${maxTokens}`,
    )
    try {
      const history = await this.conversationHistoryModel.findOne({
        lineUserId,
      })
      if (!history || history.messages.length === 0) {
        this.logger.log(`No history found for user ${lineUserId}`)
        return null
      }

      // Iterate backwards to build history within token limit
      let currentTokenCount = 0
      const recentMessages: ConversationMessage[] = []

      for (let i = history.messages.length - 1; i >= 0; i--) {
        const message = history.messages[i]
        const messageTokenCount = this.estimateTokenCount(message.content)

        if (currentTokenCount + messageTokenCount <= maxTokens) {
          recentMessages.unshift(message) // Add to the beginning to maintain order
          currentTokenCount += messageTokenCount
        } else {
          // Stop if adding this message exceeds token limit
          this.logger.log(
            `Token limit reached. History truncated at ${recentMessages.length} messages.`,
          )
          break
        }
      }
      this.logger.log(
        `Returning ${recentMessages.length} messages for user ${lineUserId}, total tokens: ${currentTokenCount}`,
      )
      return recentMessages
    } catch (error) {
      this.logger.error(
        `Failed to get recent history for user ${lineUserId}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      )
      return null
    }
  }

  // Optional: Method to clear history (e.g., for user request or debugging)
  async clearHistory(lineUserId: string): Promise<void> {
    this.logger.log(`Clearing history for user ${lineUserId}`)
    try {
      await this.conversationHistoryModel.deleteOne({ lineUserId })
      this.logger.log(`History cleared for user ${lineUserId}`)
    } catch (error) {
      this.logger.error(
        `Failed to clear history for user ${lineUserId}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      )
    }
  }

  /**
   * ตรวจสอบว่าควรเก็บข้อความใน history หรือไม่
   */
  private shouldExcludeFromHistory(content: string): boolean {
    const { exclusionRules } = AI_CONFIG.conversationControl

    // ตรวจสอบว่าเป็นคำสั่งที่ขึ้นต้นด้วยสัญลักษณ์เฉพาะหรือไม่
    const trimmedContent = content.trim()
    const isCommand = exclusionRules.commandPrefixes.some((prefix) =>
      trimmedContent.startsWith(prefix),
    )

    if (isCommand) {
      this.logger.debug(
        `Excluding message from history: starts with command prefix (${trimmedContent.substring(0, 20)}...)`,
      )
      return true
    }

    // ตรวจสอบความยาวข้อความ
    if (content.length > exclusionRules.maxMessageLengthForHistory) {
      this.logger.debug(
        `Excluding message from history: too long (${content.length} > ${exclusionRules.maxMessageLengthForHistory})`,
      )
      return true
    }

    // ตรวจสอบ patterns ที่ไม่ควรเก็บ
    const lowerContent = content.toLowerCase()
    const hasExcludedPattern = exclusionRules.excludePatterns.some((pattern) =>
      lowerContent.includes(pattern.toLowerCase()),
    )

    if (hasExcludedPattern) {
      this.logger.debug(
        `Excluding message from history: matches excluded pattern`,
      )
      return true
    }

    return false
  }
}
