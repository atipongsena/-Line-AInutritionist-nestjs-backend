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
const MAX_HISTORY_LENGTH = 30 // Max number of messages to keep
const MAX_TOKEN_COUNT = 3000 // Approximate max tokens for context window (sum of user + assistant messages)
// Average tokens per character (very rough estimate, can be refined)
// English: ~0.25 tokens/char (1 token ~ 4 chars)
// Thai: Could be higher, e.g., 0.5-1 token/char due to multi-byte characters and less sub-word tokenization
// Let's use a general estimate, can be language-specific later
const AVG_TOKENS_PER_CHAR = 0.4

@Injectable()
export class ConversationHistoryService {
  private readonly logger = new Logger(ConversationHistoryService.name)

  constructor(
    @InjectModel(ConversationHistory.name)
    private readonly conversationHistoryModel: Model<ConversationHistory>,
  ) {}

  private estimateTokenCount(text: string): number {
    if (!text) return 0
    return Math.ceil(text.length * AVG_TOKENS_PER_CHAR)
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

  async addMessageToHistory(
    lineUserId: string,
    role: 'user' | 'assistant',
    content: string, // For images, this could be a placeholder like "[Image Received]" or a stringified URL object
    analysisResult?: AnalysisResult,
    responseId?: string,
  ): Promise<void> {
    // ✅ ตรวจสอบว่าควรเก็บข้อความใน history หรือไม่
    if (this.shouldExcludeFromHistory(content)) {
      this.logger.log(
        `Skipping history storage for user ${lineUserId}. Reason: excluded by rules`,
      )
      return
    }

    this.logger.log(
      `Adding message for user ${lineUserId}. Role: ${role}, Content: ${content.substring(0, 50)}...${analysisResult ? ', Analysis: ' + analysisResult.type : ''}${responseId ? ', ResponseID: ' + responseId : ''}`,
    )
    try {
      const newMessage: ConversationMessage = {
        role,
        content,
        timestamp: new Date(),
        analysisResult,
        responseId,
      }

      // Find existing history or create a new one
      let history = await this.conversationHistoryModel.findOne({ lineUserId })

      if (!history) {
        history = new this.conversationHistoryModel({
          lineUserId,
          messages: [newMessage],
        })
      } else {
        history.messages.push(newMessage)
        // Trim history if it exceeds max length
        if (history.messages.length > MAX_HISTORY_LENGTH) {
          history.messages = history.messages.slice(
            history.messages.length - MAX_HISTORY_LENGTH,
          )
        }
      }
      await history.save()
      this.logger.log(
        `Message history updated for user ${lineUserId}. New length: ${history.messages.length}`,
      )
    } catch (error) {
      this.logger.error(
        `Failed to add message to history for user ${lineUserId}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      )
      // Depending on policy, we might want to rethrow or handle silently
    }
  }

  /**
   * บันทึกผลการวิเคราะห์เป็น structured format สำหรับสร้างปุ่ม
   */
  async addAnalysisResult(
    lineUserId: string,
    analysisType: AnalysisResult['type'],
    result: Record<string, any>,
    title: string,
    summary: string,
    imageUrl?: string,
    responseId?: string,
  ): Promise<string> {
    const analysisId = `${analysisType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

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

    await this.addMessageToHistory(
      lineUserId,
      'assistant',
      content,
      analysisResult,
      responseId,
    )

    this.logger.log(
      `Analysis result saved for user ${lineUserId}: ${analysisType} - ${title}`,
    )

    return analysisId
  }

  /**
   * จัดรูปแบบการแสดงผลของ analysis สำหรับ chat
   */
  private formatAnalysisForDisplay(analysis: AnalysisResult): string {
    switch (analysis.type) {
      case 'food_analysis': {
        const foodData = analysis.data
        return `🍽️ **${analysis.title}**\n\n📊 **คุณค่าทางโภชนาการ:**\n• แคลอรี่: ${foodData.calories ?? 'N/A'} kcal\n• โปรตีน: ${foodData.protein ?? 'N/A'} g\n• คาร์โบไhydrates: ${foodData.carbs ?? 'N/A'} g\n• ไขมัน: ${foodData.fat ?? 'N/A'} g\n\n💡 **คำแนะนำ:**\n${foodData.recommendation ?? analysis.summary}\n\n✅ *บันทึกเรียบร้อยแล้ว - สามารถดูย้อนหลังได้*`
      }

      case 'nutrition_goal': {
        const goalData = analysis.data
        const dailyGoals = goalData.daily_goals as
          | Record<string, any>
          | undefined
        return `🎯 **เป้าหมายโภชนาการ**\n\n📈 **BMR:** ${goalData.bmr ?? 'N/A'} kcal/วัน\n📈 **TDEE:** ${goalData.tdee ?? 'N/A'} kcal/วัน\n\n🥗 **เป้าหมายรายวัน:**\n• แคลอรี่: ${dailyGoals?.calories ?? 'N/A'} kcal\n• โปรตีน: ${dailyGoals?.protein ?? 'N/A'} g\n• คาร์โบไhydrates: ${dailyGoals?.carbs ?? 'N/A'} g\n• ไขมัน: ${dailyGoals?.fat ?? 'N/A'} g\n\n✅ *บันทึกเรียบร้อยแล้ว - สามารถดูย้อนหลังได้*`
      }

      case 'eating_pattern': {
        return `📊 **การวิเคราะห์รูปแบบการกิน**\n\n${analysis.summary}\n\n✅ *บันทึกเรียบร้อยแล้ว - สามารถดูย้อนหลังได้*`
      }

      case 'meal_recommendation': {
        const mealData = analysis.data
        const foods = Array.isArray(mealData.foods)
          ? (mealData.foods as Array<Record<string, any>>)
          : []
        const foodsList = foods
          .map(
            (food: Record<string, any>) =>
              `• ${food.name ?? 'Unknown'} (${food.calories ?? 'N/A'} kcal)`,
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
}
