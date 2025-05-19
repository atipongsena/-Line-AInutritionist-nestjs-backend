import { Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import {
  ConversationHistory,
  ConversationMessage,
} from './conversation-history.schema'
import { UserProfileDto } from '../user/user.interface' // Changed from ../ai/ai.service

// Configuration for conversation history
const MAX_HISTORY_LENGTH = 10 // Max number of messages to keep
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

  async addMessageToHistory(
    lineUserId: string,
    role: 'user' | 'assistant',
    content: string, // For images, this could be a placeholder like "[Image Received]" or a stringified URL object
  ): Promise<void> {
    this.logger.log(
      `Adding message for user ${lineUserId}. Role: ${role}, Content: ${content.substring(0, 50)}...`,
    )
    try {
      const newMessage: ConversationMessage = {
        role,
        content,
        timestamp: new Date(),
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
