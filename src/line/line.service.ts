import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common'
import { ConfigService, ConfigType } from '@nestjs/config'
import { HttpService } from '@nestjs/axios'
import { firstValueFrom } from 'rxjs'
import { AxiosError } from 'axios'
import {
  Client,
  WebhookEvent,
  MessageAPIResponseBase,
  TextMessage,
  validateSignature as lineValidateSignature,
  HTTPError,
  Message,
  QuickReplyItem,
} from '@line/bot-sdk'
import { ImageService } from '../image/image.service'
import { AiService } from '../ai/ai.service'
import type {
  FoodAnalysisToolResult,
  VitaminMineralDetail as AiVitaminMineralDetail,
} from '../ai/ai.service' // For AI results
import { UserProfileDto } from '../user/user.interface'
import {
  createFoodAnalysisFlexMessage,
  FoodAnalysisData as FlexFoodAnalysisData, // For data structure expected by flex.messages functions
  // VitaminMineralDetail as FlexVitaminMineralDetail, // This might be unused if AiVitaminMineralDetail is passed directly
  createVitaminMineralDetailsFlexMessage,
} from './flex.messages'
import { UserService } from '../user/user.service'
import { AnalysisCacheService } from '../analysis-cache/analysis-cache.service'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import {
  FoodLog,
  FoodLogDocument,
  // ImageInfo as FoodLogImageInfo, // Reverted to aliasing if ImageInfo is the correct export
  // VitaminMineralDetailSchemaDocument, // Removed unused import
} from '../schemas/food-log.schema'
// import * as path from 'path' // Removed unused import
import {
  TemporaryImageLog,
  TemporaryImageLogDocument,
} from '../schemas/temporary-image-log.schema'
import { format } from 'date-fns'
import {
  IntentDetectionService,
  IntentDetectionResult,
} from './intent-detection.service'
import { ConversationHistoryService } from '../conversation-history/conversation-history.service'
import { AI_CONFIG } from '../ai/ai.config' // Added import
import { IntentDetectionMetricsService } from './intent-detection-metrics.service'
import { SharedUserProfileDto } from '@ai-nutritionist/shared-types' // Corrected import
import { NonFoodDescriptionResult } from '../ai/ai.service' // Added import for NonFoodDescriptionResult
import {
  EatingPatternToolResult,
  NutritionGoalToolResult,
  MealRecommendationToolResult,
} from '../ai/ai.service' // Added import for EatingPatternToolResult and NutritionGoalToolResult
import { TimezoneService } from '../common/timezone.service'
import { NutritionGoalDtoForAI } from '../ai/ai.service' // Added import for NutritionGoalDtoForAI

// Define the expected structure of the parsed webhook body
interface ParsedWebhookBody {
  destination?: string
  events: WebhookEvent[]
}

@Injectable()
export class LineService {
  private readonly logger = new Logger(LineService.name)
  private lineClient: Client
  private channelSecret: string

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly imageService: ImageService,
    private readonly aiService: AiService,
    private readonly userService: UserService,
    private readonly analysisCacheService: AnalysisCacheService,
    @InjectModel(FoodLog.name) private foodLogModel: Model<FoodLogDocument>,
    @InjectModel(TemporaryImageLog.name)
    private temporaryImageLogModel: Model<TemporaryImageLogDocument>,
    private readonly intentDetectionService: IntentDetectionService,
    private readonly conversationHistoryService: ConversationHistoryService,
    private readonly intentDetectionMetricsService: IntentDetectionMetricsService,
    private readonly timezoneService: TimezoneService,
  ) {
    const channelAccessToken = this.configService.get<string>(
      'LINE_CHANNEL_ACCESS_TOKEN',
    )!
    this.channelSecret = this.configService.get<string>('LINE_CHANNEL_SECRET')!

    if (!channelAccessToken || !this.channelSecret) {
      this.logger.error(
        'LINE Channel Access Token or Secret is not configured. LineService cannot operate.',
      )
      throw new Error(
        'LINE Channel Access Token or Secret is missing in configuration.',
      )
    }

    this.lineClient = new Client({
      channelAccessToken,
      channelSecret: this.channelSecret,
    })
    this.logger.log('LineService initialized and LINE client configured.')
  }

  /**
   * ได้เวลาสำหรับบันทึก food log โดยพิจารณา timezone ของ user
   */
  private async getLogDateWithTimezone(
    lineUserId: string,
    postbackDate?: string,
  ): Promise<Date> {
    try {
      const userTimezone = await this.userService.getUserTimezone(lineUserId)

      if (postbackDate) {
        // หากมี postbackDate ให้แปลงจาก user timezone เป็น UTC
        const localTime = new Date(postbackDate)
        return this.timezoneService.convertToUtc(localTime, userTimezone)
      } else {
        // หากไม่มี postbackDate ให้ใช้เวลาปัจจุบันใน timezone ของ user
        const nowInUserTimezone =
          this.timezoneService.getNowInTimezone(userTimezone)
        return this.timezoneService.convertToUtc(
          nowInUserTimezone,
          userTimezone,
        )
      }
    } catch (error) {
      this.logger.warn(
        `Failed to get timezone for user ${lineUserId}, using server time: ${error.message}`,
      )
      return new Date(postbackDate || Date.now())
    }
  }

  // Method to send typing indicator
  private async sendTypingIndicator(
    userId: string,
    durationSeconds = 30,
  ): Promise<void> {
    const channelAccessToken = this.configService.get<string>(
      'LINE_CHANNEL_ACCESS_TOKEN',
    )
    const apiUrl = 'https://api.line.me/v2/bot/chat/loading/start'
    if (!channelAccessToken) {
      this.logger.error(
        'LINE_CHANNEL_ACCESS_TOKEN is not configured. Cannot send typing indicator.',
      )
      return
    }
    try {
      await firstValueFrom(
        this.httpService.post(
          apiUrl,
          {
            chatId: userId,
            loadingSeconds: durationSeconds,
          },
          {
            headers: {
              Authorization: `Bearer ${channelAccessToken}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      )
      this.logger.debug(
        `Sent typing indicator to user ${userId} for ${durationSeconds}s`,
      )
    } catch (error) {
      let logMessage = `Failed to send typing indicator to user ${userId}`
      let errorDetails: string = 'Unknown error during typing indicator'

      if (error instanceof AxiosError) {
        logMessage += ' (AxiosError)'
        const response = error.response
        const responseData: unknown = response?.data

        if (responseData) {
          if (typeof responseData === 'string') {
            errorDetails = responseData
          } else if (
            typeof responseData === 'object' &&
            responseData !== null &&
            'message' in responseData &&
            typeof (responseData as { message: unknown }).message === 'string'
          ) {
            errorDetails = (responseData as { message: string }).message
          } else {
            try {
              errorDetails = JSON.stringify(responseData)
            } catch /* istanbul ignore next */ {
              // Ignore unused variable for test coverage
              errorDetails = 'Unparseable AxiosError response data'
            }
          }
        } else if (error.message) {
          errorDetails = error.message
        } else {
          errorDetails = 'No additional details in AxiosError'
        }
        this.logger.error(
          `${logMessage}: ${errorDetails}`,
          `Status: ${response?.status || 'N/A'}`,
          `URL: ${error.config?.url || 'N/A'}`,
        )
      } else if (error instanceof Error) {
        logMessage += ' (Error)'
        errorDetails = error.message
        this.logger.error(`${logMessage}: ${errorDetails}`, error.stack)
      } else {
        logMessage += ' (Unknown Error Type)'
        try {
          errorDetails = JSON.stringify(error)
        } catch /* istanbul ignore next */ {
          // Ignore unused variable for test coverage
          errorDetails = 'Unparseable unknown error object'
        }
        this.logger.error(`${logMessage}: ${errorDetails}`)
      }
    }
  }

  private validateLineSignature(
    requestBody: string,
    signature: string,
  ): boolean {
    if (!this.channelSecret) {
      this.logger.error(
        'Channel secret is not available for signature validation.',
      )
      return false
    }
    return lineValidateSignature(requestBody, this.channelSecret, signature)
  }

  async processWebhook(
    rawBody: string,
    signatureFromHeader: string,
  ): Promise<void> {
    this.logger.log(
      `Processing webhook. Signature: ${signatureFromHeader ? 'Present' : 'Missing'}`,
    )
    if (!signatureFromHeader) {
      this.logger.error('Missing X-Line-Signature header')
      throw new HttpException(
        'Missing X-Line-Signature header',
        HttpStatus.BAD_REQUEST,
      )
    }

    if (!rawBody) {
      this.logger.error('Request body is empty for webhook processing.')
      throw new HttpException('Request body is empty', HttpStatus.BAD_REQUEST)
    }

    const isValid = this.validateLineSignature(rawBody, signatureFromHeader)
    if (!isValid) {
      this.logger.error('Invalid LINE signature. Request rejected.')
      throw new HttpException('Invalid signature', HttpStatus.FORBIDDEN)
    }

    this.logger.log('LINE signature validated successfully.')

    try {
      const parsedBody = JSON.parse(rawBody) as ParsedWebhookBody
      const events: WebhookEvent[] = parsedBody.events

      if (!events || !Array.isArray(events)) {
        this.logger.error(
          'Webhook body does not contain a valid events array.',
          rawBody,
        )
        await this.handleWebhookEvents([])
        return
      }

      this.logger.log(`Parsed ${events.length} event(s) from webhook.`)
      await this.handleWebhookEvents(events)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      this.logger.error(
        `Error parsing webhook JSON body or handling events: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      )
    }
  }

  async handleWebhookEvents(events: WebhookEvent[]): Promise<void> {
    if (!events || events.length === 0) {
      this.logger.log('No events to process.')
      return
    }
    for (const event of events) {
      this.logger.log(
        `Processing event type: ${event.type}, source: ${JSON.stringify(event.source)}`,
      )
      await this.handleWebhookEvent(event)
    }
  }

  private async handleWebhookEvent(event: WebhookEvent): Promise<void> {
    this.logger.log(`Received event: ${JSON.stringify(event)}`)

    // Ensure user profile exists (moved up for earlier access to userId if possible)
    const userIdFromSource = event.source?.userId
    if (
      userIdFromSource &&
      event.type !== 'unfollow' &&
      event.type !== 'follow'
    ) {
      try {
        // Attempt to ensure user profile exists and potentially update last active time.
        // Individual handlers (message, postback) will also attempt to fetch the profile if needed by them.
        await this.userService.getOrCreateUserProfile({
          lineUserId: userIdFromSource,
        })
        this.logger.debug(
          `User profile ensured for userId: ${userIdFromSource}`,
        )
      } catch (error) {
        this.logger.error(
          `Error during initial attempt to get/create user profile for ${userIdFromSource} (Event: ${event.type}). Processing will continue, and subsequent handlers will attempt to fetch the profile again if needed.`,
          error,
        )
        // DECISION: Continue processing. Subsequent handlers (e.g., for messages, postbacks)
        // are responsible for their own profile fetching and error handling if a profile is critical for their operation.
        // This allows the main event handling flow to proceed to the switch statement.
      }
    }

    switch (event.type) {
      case 'message':
        if (userIdFromSource && event.replyToken && event.message) {
          const messageIdFromEvent = event.message.id
          switch (event.message.type) {
            case 'text':
              // Typing indicator for text messages
              await this.sendTypingIndicator(userIdFromSource)
              await this.handleTextMessage(
                event.replyToken,
                event.message.text,
                userIdFromSource,
                messageIdFromEvent,
              )
              break
            case 'image':
              // Typing indicator for image messages
              await this.sendTypingIndicator(userIdFromSource)
              await this.handleImageMessage(
                event.replyToken,
                messageIdFromEvent,
                userIdFromSource,
              )
              break
            default:
              this.logger.log(
                `Unhandled message type: ${JSON.stringify(event.message)} for user ${userIdFromSource}`,
              )
              // Optional: Reply for unhandled message types (typing indicator not strictly needed if immediate reply)
              // if (event.replyToken) { await this.replyText(event.replyToken, "Sorry, I can't handle this type of message yet."); }
              break
          }
        } else {
          this.logger.warn(
            `Message event without userId, replyToken, or message object: ${JSON.stringify(event)}`,
          )
        }
        break
      case 'follow':
        if (userIdFromSource && event.replyToken) {
          // Typing indicator for follow event if processing takes time (e.g., creating user, sending welcome)
          // await this.sendTypingIndicator(userIdFromSource, 5); // Shorter duration for welcome
          await this.handleFollowEvent(event.replyToken, userIdFromSource)
        } else {
          this.logger.warn(
            `Follow event missing userId or replyToken: ${JSON.stringify(event)}`,
          )
        }
        break
      case 'unfollow':
        // No replyToken for unfollow, so no typing indicator or reply message
        if (userIdFromSource) {
          await this.handleUnfollowEvent(userIdFromSource)
        } else {
          this.logger.warn(
            `Unfollow event missing userId: ${JSON.stringify(event)}`,
          )
        }
        break
      case 'postback':
        if (userIdFromSource && event.replyToken && event.postback) {
          // Typing indicator for postback events
          await this.sendTypingIndicator(userIdFromSource, 10) // Typically shorter processing for postbacks
          await this.handlePostbackEvent(
            event.replyToken,
            event.postback.data,
            userIdFromSource,
            event.postback.params,
          )
        } else {
          this.logger.warn(
            `Postback event without userId, replyToken, or postback object: ${JSON.stringify(event)}`,
          )
        }
        break
      default:
        this.logger.log(`Unhandled event type: ${event.type}`)
        break
    }
  }

  private async handleTextMessage(
    replyToken: string,
    text: string,
    userId: string,
    messageId: string, // LINE message ID for the text message
  ): Promise<void> {
    await this.sendTypingIndicator(userId)
    const userProfile = await this.userService.getOrCreateUserProfile({
      lineUserId: userId,
    }) // Changed: ensureUserProfile to getOrCreateUserProfile
    await this.sendTypingIndicator(userId) // Send again as ensureUserProfile can take time

    const currentLanguage = userProfile.language || 'th'
    this.logger.log(
      `Received text from user ${userId}: "${text}", language: ${currentLanguage}`,
    )

    // Add to conversation history (User's message)
    await this.conversationHistoryService.addMessageToHistory(
      // Changed: addMessage to addMessageToHistory
      userId,
      'user',
      text,
      undefined, // No analysisResult for user's plain text
      messageId, // Pass messageId here
    )

    // Check for commands first
    if (text.startsWith('/')) {
      await this.handleCommand(
        replyToken,
        text.substring(1),
        userId,
        userProfile,
        currentLanguage,
      )
      return
    }

    // Check if user is in reanalyze context and provided additional details
    const reanalyzeContextKey = `reanalyze_context:${userId}`
    const reanalyzeContext = this.analysisCacheService.get<{
      originalMessageId: string
      originalAnalysisData: FoodAnalysisToolResult
      originalImageUrl?: string
      timestamp: number
    }>(reanalyzeContextKey)

    if (reanalyzeContext) {
      this.logger.log(
        `User ${userId} provided reanalysis details: "${text.substring(0, 100)}..."`,
      )

      try {
        // Combine original image URL (if exists) with user's additional description
        const analysisText = `${reanalyzeContext.originalAnalysisData.food_name}\n\nรายละเอียดเพิ่มเติมจากผู้ใช้: ${text}`

        // Send typing indicator for longer analysis
        await this.sendTypingIndicator(userId, 30)

        // Analyze with user's additional context
        const analysisResult = await this.aiService.analyzeFoodOrMeal(
          userId,
          analysisText,
          userProfile,
          currentLanguage,
          'normal',
          reanalyzeContext.originalImageUrl, // Send original image if available
          reanalyzeContext.originalMessageId,
        )

        if (
          analysisResult &&
          'food_name' in analysisResult &&
          analysisResult.food_name !== 'NON_FOOD_IMAGE_DETECTED'
        ) {
          const foodAnalysisResult = analysisResult
          this.logger.log(
            `Reanalysis successful for user ${userId}: ${foodAnalysisResult.food_name}`,
          )

          const flexMessageData: FlexFoodAnalysisData = {
            ...foodAnalysisResult,
            lineUserId: userId,
            messageId: reanalyzeContext.originalMessageId,
            imageUrl: reanalyzeContext.originalImageUrl,
          }

          const flexMessage = createFoodAnalysisFlexMessage(
            flexMessageData,
            currentLanguage,
          )

          await this.replyMessages(
            replyToken,
            [flexMessage],
            false,
            currentLanguage,
          )

          // Clear reanalyze context
          this.analysisCacheService.delete(reanalyzeContextKey)

          this.logger.log(`Cleared reanalyze context for user ${userId}`)
        } else {
          await this.replyText(
            replyToken,
            currentLanguage === 'th'
              ? 'ขออภัยค่ะ ไม่สามารถวิเคราะห์อาหารใหม่ได้ในขณะนี้ โปรดลองอีกครั้งหรือส่งรูปภาพใหม่'
              : 'Sorry, unable to reanalyze the food at this time. Please try again or send a new image.',
            'reanalysis_failed',
            true,
            currentLanguage,
          )

          // Clear reanalyze context on failure
          this.analysisCacheService.delete(reanalyzeContextKey)
        }
      } catch (error) {
        this.logger.error(
          `Error during reanalysis for user ${userId}: ${error instanceof Error ? error.message : String(error)}`,
          error instanceof Error ? error.stack : undefined,
        )

        await this.replyText(
          replyToken,
          currentLanguage === 'th'
            ? 'ขออภัยค่ะ เกิดข้อผิดพลาดในการวิเคราะห์ใหม่'
            : 'Sorry, an error occurred during reanalysis.',
          'reanalysis_error',
          true,
          currentLanguage,
        )

        // Clear reanalyze context on error
        this.analysisCacheService.delete(reanalyzeContextKey)
      }
      return
    }

    // Check for reanalyze last food if "reanalyze" or "วิเคราะห์ใหม่" is sent
    const reanalyzeKeywords = ['reanalyze', 'วิเคราะห์ใหม่']
    if (reanalyzeKeywords.includes(text.toLowerCase())) {
      const cachedContext = await this.analysisCacheService.get<{
        type: 'image' | 'text'
        value: string // messageId for image, original text for text
        messageId?: string // original messageId of the request that was analyzed
      }>(`reanalyze_context:${userId}`) // Changed: getReanalyzeContext to generic get

      if (cachedContext) {
        this.logger.log(
          `Re-analyzing based on cached context for user ${userId}`,
        )
        if (cachedContext.type === 'image' && cachedContext.value) {
          await this.handleImageMessage(replyToken, cachedContext.value, userId)
        } else if (cachedContext.type === 'text' && cachedContext.value) {
          const newReanalysisMessageId = `reanalysis-${Date.now()}-${messageId}`
          await this.handleTextMessage(
            replyToken,
            cachedContext.value,
            userId,
            newReanalysisMessageId,
          )
        } else {
          await this.replyText(
            replyToken,
            currentLanguage === 'th'
              ? 'ขออภัยค่ะ ไม่พบข้อมูลสำหรับวิเคราะห์ใหม่ หรือข้อมูลไม่ถูกต้อง'
              : 'Sorry, no valid context found to reanalyze.',
            'reanalyze_error',
            true,
            currentLanguage,
          )
        }
        return
      } else {
        this.logger.log(
          `User ${userId} requested reanalysis, but no context was found.`,
        )
        await this.replyText(
          replyToken,
          currentLanguage === 'th'
            ? 'ยังไม่มีการวิเคราะห์ก่อนหน้านี้ให้วิเคราะห์ใหม่ค่ะ ลองส่งรูปหรือข้อความมาวิเคราะห์ได้เลย'
            : "There's no previous analysis to reanalyze. Feel free to send an image or text to analyze!",
          'reanalyze_no_context',
          true,
          currentLanguage,
        )
        return
      }
    }

    // Intent Detection
    const intentResult = await this.intentDetectionService.detectIntent(
      text,
      userProfile,
      currentLanguage,
    )
    this.logger.log(
      `Intent detected for user ${userId}: ${intentResult.intent} (confidence: ${intentResult.confidence})`,
    )

    // Handle based on intent
    if (
      this.intentDetectionService.isSimpleGreetingOrThanks(
        text,
        currentLanguage,
      )
    ) {
      this.logger.log(
        `Simple greeting or thanks from user ${userId}: "${text}"`,
      )
      const greeting =
        currentLanguage === 'th'
          ? `สวัสดีค่ะ ${userProfile.displayName || ''} มีอะไรให้ช่วยไหมคะ?` // Handle potential null displayName
          : `Hello ${userProfile.displayName || ''}! How can I help you today?` // Handle potential null displayName
      await this.replyText(
        replyToken,
        greeting,
        'greeting',
        true,
        currentLanguage,
      )
      return
    }

    switch (intentResult.intent) {
      case 'food_analysis':
        this.logger.log(
          `Processing food analysis request for user ${userId} based on detected intent`,
        )
        try {
          const analysisAiResult = await this.aiService.analyzeFoodOrMeal(
            // Changed: analyzeFoodFromText to analyzeFoodOrMeal
            userId,
            text, // text to analyze
            userProfile,
            currentLanguage,
            'normal', // timeConstraint
            undefined, // imageUrl - not an image
            messageId, // Pass messageId
          )

          // Check if analysisAiResult is FoodAnalysisToolResult and not NonFoodDescriptionResult or error
          if (
            analysisAiResult &&
            'food_name' in analysisAiResult &&
            analysisAiResult.food_name !== 'NON_FOOD_IMAGE_DETECTED'
          ) {
            const foodAnalysisDataFromAI = analysisAiResult
            this.logger.log(
              `Food analysis successful for user ${userId}: ${foodAnalysisDataFromAI.food_name}`,
            )

            const foodDataForFlex: FlexFoodAnalysisData = {
              ...foodAnalysisDataFromAI,
              // Ensure properties for flex message are correctly assigned if names differ
              // or if some properties are only for flex
              // FlexFoodAnalysisData in flex.messages.ts expects specific vitamin/mineral properties
              // and some control properties like lineUserId, messageId for postbacks.
              lineUserId: userId, // Added for flex message context
              messageId: messageId, // Added for flex message context
              // imageUrl: foodAnalysisDataFromAI.imageUrl, // Already part of FoodAnalysisToolResult, so spread operator covers it
              // language is a separate param for createFoodAnalysisFlexMessage
            }

            const flexMessage = createFoodAnalysisFlexMessage(
              foodDataForFlex,
              currentLanguage,
            )
            await this.replyMessages(
              replyToken,
              [flexMessage],
              false,
              currentLanguage,
            )

            await this.analysisCacheService.set<{
              type: 'image' | 'text'
              value: string
              messageId?: string
            }>(`reanalyze_context:${userId}`, {
              // Changed: setReanalyzeContext to generic set
              type: 'text',
              value: text,
              messageId: messageId,
            })
          } else if (analysisAiResult && 'description' in analysisAiResult) {
            // NonFoodDescriptionResult
            const nonFoodData = analysisAiResult
            this.logger.log(
              `Non-food description for user ${userId}: ${nonFoodData.description}`,
            )
            await this.replyText(
              replyToken,
              nonFoodData.description,
              'non_food_description',
              true,
              currentLanguage,
            )
          } else {
            // This case handles null, { error: string }, or NON_FOOD_IMAGE_DETECTED if it somehow slips through 'food_name' check
            const fallbackReason =
              (analysisAiResult as any)?.error ||
              'Analysis did not return valid food data.'
            this.logger.warn(
              `Food analysis from text failed or non-food for user ${userId}. Fallback to general nutrition. Reason: ${fallbackReason}`,
            )
            const fallbackMessage =
              currentLanguage === 'th'
                ? 'ขออภัยค่ะ ระบบไม่สามารถวิเคราะห์อาหารจากข้อความของคุณได้ ลองถามคำถามทั่วไปเกี่ยวกับโภชนาการ หรือส่งรูปภาพอาหารมาวิเคราะห์นะคะ'
                : "Sorry, I couldn't analyze the food from your text. Try asking a general nutrition question, or send a food image for analysis."
            await this.replyText(
              replyToken,
              fallbackMessage,
              'food_analysis_fallback',
              true,
              currentLanguage,
            )
          }
        } catch (error) {
          this.logger.error(
            `Error during food analysis from text for user ${userId}: ${error instanceof Error ? error.message : String(error)}`,
            error instanceof Error ? error.stack : undefined,
          )
          await this.replyText(
            replyToken,
            currentLanguage === 'th'
              ? 'ขออภัยค่ะ เกิดข้อผิดพลาดในการวิเคราะห์อาหารจากข้อความ'
              : 'Sorry, an error occurred while analyzing food from text.',
            'food_analysis_text_error',
            true,
            currentLanguage,
          )
        }
        break

      case 'general_nutrition':
      default:
        this.logger.log(
          `Treating as general nutrition question for user ${userId}: "${text}" (Intent: ${intentResult.intent})`,
        )
        try {
          const aiResponse =
            await this.aiService.answerGeneralNutritionQuestion(
              userId,
              text,
              userProfile,
              currentLanguage,
            )
          await this.replyText(
            replyToken,
            aiResponse ||
              (currentLanguage === 'th'
                ? 'ฉันไม่แน่ใจว่าจะตอบอย่างไร ลองถามใหม่นะคะ'
                : 'I am not sure how to respond to that. Please try rephrasing.'), // Added fallback for null aiResponse
            'general_nutrition',
            true,
            currentLanguage,
          )
        } catch (error) {
          this.logger.error(
            `Error getting general nutrition answer for user ${userId}: "${text}". Error: ${error instanceof Error ? error.message : String(error)}`,
            error instanceof Error ? error.stack : undefined,
          )
          const errorMessage =
            currentLanguage === 'th'
              ? 'ขออภัยค่ะ มีข้อผิดพลาดในการสื่อสารกับ AI กรุณาลองใหม่อีกครั้งค่ะ'
              : 'Sorry, there was an error communicating with the AI. Please try again.'
          await this.replyText(
            replyToken,
            errorMessage,
            'general_ai_error',
            true,
            currentLanguage,
          )
        }
        break
    }
  }

  private async handleImageMessage(
    replyToken: string,
    messageId: string, // LINE message ID for the image
    userId: string,
  ): Promise<void> {
    this.logger.log(
      `Received image message ID: ${messageId} from user: ${userId}`,
    )
    let userProfile: UserProfileDto | null = null
    try {
      userProfile = await this.userService.getOrCreateUserProfile({
        lineUserId: userId,
      })
    } catch (error) {
      this.logger.error(
        `Failed to get/create user profile for ${userId} in handleImageMessage:`,
        error,
      )
      const langForError = userProfile?.language || 'th'
      await this.replyText(
        replyToken,
        langForError === 'th'
          ? 'ขออภัยค่ะ เกิดข้อผิดพลาดในการดึงข้อมูลโปรไฟล์ของคุณ โปรดลองใหม่อีกครั้ง'
          : 'Sorry, there was an error retrieving your profile. Please try again.',
        'user_profile_error_image_flow',
        false, // No main menu QR on critical error
        // currentLanguage, // Not needed if false
      )
      return
    }

    if (!userProfile) {
      this.logger.error(
        `User profile is null for ${userId} even after getOrCreateUserProfile in handleImageMessage.`,
      )
      await this.replyText(
        replyToken,
        'Sorry, I could not retrieve your profile information.',
      )
      return
    }

    const currentLanguage = userProfile.language || 'th'

    try {
      const imageBuffer = await this.getMessageContent(messageId)
      const originalFileName = `line_image_${messageId}.jpg`
      const contentType = 'image/jpeg'

      const uploadedImageUrl = await this.imageService.uploadImageFromBuffer(
        imageBuffer,
        originalFileName,
        contentType,
      )
      this.logger.log(`Image uploaded from LINE: ${uploadedImageUrl}`)

      // Save to TemporaryImageLog
      try {
        const expiresAtDate = new Date()
        expiresAtDate.setDate(expiresAtDate.getDate() + 7) // Set to 7 days from now

        const temporaryLog = new this.temporaryImageLogModel({
          lineUserId: userId,
          blobName: originalFileName,
          url: uploadedImageUrl,
          // messageId: messageId, // messageId is not part of TemporaryImageLogSchema
          expiresAt: expiresAtDate, // Explicitly set expiresAt
        })
        await temporaryLog.save()
        this.logger.log(
          `Temporary image log saved for blob: ${originalFileName}, user: ${userId}`,
        )
      } catch (dbError) {
        this.logger.error(
          `Failed to save temporary image log for blob ${originalFileName}: ${
            dbError instanceof Error ? dbError.message : String(dbError)
          }`,
          dbError instanceof Error ? dbError.stack : undefined,
        )
        // Continue without re-throwing, as the primary goal (image upload and AI analysis) might still proceed
        // or has already sent a reply.
      }

      // Log intent for image message as food_analysis
      const imageIntentResult: IntentDetectionResult = {
        intent: 'food_analysis',
        confidence: 1.0, // Image is always considered food analysis
        reasoning: 'Image received, assumed food analysis',
      }
      this.intentDetectionMetricsService.logDetection(
        // Corrected: use intentDetectionMetricsService
        `Image: ${originalFileName}`, // User message can be image identifier
        imageIntentResult,
        0, // Latency for intent detection itself is minimal/not applicable here
        false, // Not a fallback in the traditional sense for this path
        userId,
      )

      const analysisResult = await this.aiService.analyzeFoodOrMeal(
        userId,
        '', // ✅ ใช้ empty string แทน "Analyze this food image" เพื่อไม่ให้ไปรวมใน conversation history
        userProfile,
        currentLanguage,
        'normal',
        uploadedImageUrl,
        messageId,
      )

      if (analysisResult) {
        if (typeof analysisResult === 'object' && analysisResult !== null) {
          // Check for NonFoodDescriptionResult first
          if (
            'type' in analysisResult &&
            analysisResult.type === 'non_food_description'
          ) {
            this.logger.log(
              `Sending non-food description to user ${userId}: ${analysisResult.description}`,
            )
            await this.replyText(replyToken, analysisResult.description)
            return
          }

          // Then check for FoodAnalysisToolResult
          if ('food_name' in analysisResult) {
            this.logger.log(
              `FoodAnalysisToolResult for ${userId}: ${analysisResult.food_name}`,
            )

            // === Begin Added/Modified Block ===
            const foodResultForCache = analysisResult

            if (
              uploadedImageUrl &&
              foodResultForCache.imageUrl !== uploadedImageUrl
            ) {
              this.logger.warn(
                `[handleImageMessage] AI's imageUrl ('${foodResultForCache.imageUrl}') differs from uploadedImageUrl ('${uploadedImageUrl}'). Updating analysis result for cache.`,
              )
              foodResultForCache.imageUrl = uploadedImageUrl
              this.analysisCacheService.set(
                messageId,
                foodResultForCache,
                600 * 1000, // Re-cache
              )
              this.logger.log(
                `[handleImageMessage] Re-cached analysis result for ${messageId} with corrected imageUrl: ${foodResultForCache.imageUrl}`,
              )
            } else if (uploadedImageUrl && !foodResultForCache.imageUrl) {
              this.logger.log(
                `[handleImageMessage] AI's imageUrl is missing. Setting to uploadedImageUrl ('${uploadedImageUrl}') and re-caching.`,
              )
              foodResultForCache.imageUrl = uploadedImageUrl
              this.analysisCacheService.set(
                messageId,
                foodResultForCache,
                600 * 1000, // Re-cache
              )
              this.logger.log(
                `[handleImageMessage] Re-cached analysis result for ${messageId} with added imageUrl: ${foodResultForCache.imageUrl}`,
              )
            }
            // === End Added/Modified Block ===

            const flexData: FlexFoodAnalysisData = {
              // ...foodResultForCache, // Spread the potentially modified result
              ...analysisResult, // Use original analysisResult spread, but ensure imageUrl below is correct
              lineUserId: userId,
              messageId,
              imageUrl: foodResultForCache.imageUrl, // Use the corrected imageUrl
            }
            const flexMessage = createFoodAnalysisFlexMessage(
              flexData,
              currentLanguage,
            )
            // Log the full Flex Message JSON for debugging if needed, especially for 400 errors
            if (process.env.NODE_ENV === 'development') {
              // Only log in development
              try {
                this.logger.debug(
                  `[handleImageMessage] Flex Message JSON for ${userId} (replyToken: ${replyToken}): ${JSON.stringify(flexMessage, null, 2)}`,
                )
              } catch (e) {
                this.logger.warn(
                  `[handleImageMessage] Could not stringify flexMessage for logging: ${e}`,
                )
              }
            }
            await this.replyMessages(
              replyToken,
              [flexMessage],
              true,
              currentLanguage,
            )
          } else if (
            'error' in analysisResult &&
            typeof analysisResult.error === 'string'
          ) {
            const errorResult = analysisResult
            this.logger.warn(
              `Analysis Error for ${userId}: ${errorResult.error}`,
            )
            await this.replyText(
              replyToken,
              currentLanguage === 'th'
                ? `ขออภัยค่ะ เกิดข้อผิดพลาดในการวิเคราะห์รูปภาพ: ${errorResult.error}`
                : `Sorry, an error occurred while analyzing the image: ${errorResult.error}`,
              'image_analysis_error',
              true,
              currentLanguage,
            )
          } else {
            this.logger.warn(
              `Received unexpected object structure from aiService.analyzeFoodOrMeal for ${userId}`,
              analysisResult,
            )
            // Only reply with fallback if no other reply has been sent with this token
            await this.replyText(
              replyToken,
              currentLanguage === 'th'
                ? 'ขออภัยค่ะ ไม่สามารถวิเคราะห์รูปภาพนี้ได้ในขณะนี้'
                : 'Sorry, I could not analyze the image at this time.',
              'image_analysis_unexpected',
              true,
              currentLanguage,
            )
          }
        } else {
          // analysisResult is null or undefined
          this.logger.warn(
            `Received null or undefined result from aiService.analyzeFoodOrMeal for ${userId}`,
          )
          await this.replyText(
            replyToken,
            currentLanguage === 'th'
              ? 'ขออภัยค่ะ ไม่สามารถวิเคราะห์รูปภาพนี้ได้ในขณะนี้'
              : 'Sorry, I could not analyze the image at this time.',
            'image_analysis_null',
            true,
            currentLanguage,
          )
        }
      } else {
        // analysisResult from aiService.analyzeFoodOrMeal was falsy initially (should not happen with current types but as a safe guard)
        this.logger.warn(
          `Received null or undefined result from aiService.analyzeFoodOrMeal for ${userId} (outer check)`,
        )
        await this.replyText(
          replyToken,
          currentLanguage === 'th'
            ? 'ขออภัยค่ะ ไม่สามารถวิเคราะห์รูปภาพนี้ได้ในขณะนี้'
            : 'Sorry, I could not analyze the image at this time.',
          'image_analysis_falsy',
          true,
          currentLanguage,
        )
      }
    } catch (error) {
      this.logger.error(
        `Error handling image message for messageId ${messageId}:`,
        error instanceof Error ? error.stack : undefined,
      )
      // ใช้ replyText แทน pushText เพื่อให้มี Quick Reply
      await this.replyText(
        replyToken,
        currentLanguage === 'th' // Use currentLanguage if available from userProfile, else default
          ? 'ขออภัยค่ะ เกิดข้อผิดพลาดในการประมวลผลรูปภาพของคุณ โปรดลองอีกครั้ง'
          : 'Sorry, there was an error processing your image. Please try again.',
        'image_processing_error',
        true,
        currentLanguage,
      )
    }
  }

  private async handleFollowEvent(
    replyToken: string,
    userId: string,
  ): Promise<void> {
    this.logger.log(`Followed by user: ${userId}`)
    try {
      let displayName = 'friend'
      let pictureUrl: string | undefined = undefined
      try {
        const lineProfile = await this.lineClient.getProfile(userId)
        displayName = lineProfile.displayName
        pictureUrl = lineProfile.pictureUrl
        this.logger.log(
          `Fetched profile for ${userId} from LINE API: ${displayName}`,
        )
      } catch (lineApiError) {
        this.logger.warn(
          `Could not fetch profile from LINE API for ${userId}:`,
          lineApiError,
        )
      }

      const userProfile = await this.userService.getOrCreateUserProfile({
        lineUserId: userId,
        displayName: displayName,
        pictureUrl: pictureUrl,
      })
      this.logger.log(
        `User profile created/retrieved on follow: ${JSON.stringify(userProfile)}`,
      )

      const welcomeMessage: TextMessage = {
        type: 'text',
        text: `Welcome to AI Nutritionist, ${userProfile.displayName || 'friend'}! I'm here to help. Send a food pic or ask a nutrition question. Use /help for more.`,
      }
      await this.replyMessages(
        replyToken,
        [welcomeMessage],
        true,
        userProfile.language || 'th',
      )
      // ไม่ต้องส่งข้อความแยกเพิ่มเติม เนื่องจากมี Quick Reply แล้ว
    } catch (error) {
      this.logger.error(
        `Error in handleFollowEvent for userId ${userId}:`,
        error,
      )
    }
  }

  private async handleUnfollowEvent(userId: string): Promise<void> {
    this.logger.log(`Unfollowed by user: ${userId}`)
    try {
      await this.userService.setUserInactive(userId)
      this.logger.log(`User ${userId} marked as inactive.`)
    } catch (error) {
      this.logger.error(`Error marking user ${userId} as inactive:`, error)
    }
  }

  private async handlePostbackEvent(
    replyToken: string,
    data: string,
    userId: string,
    params?: {
      date?: string // This is the postbackDate
      time?: string
      datetime?: string
      richMenuAliasId?: string
      newRichMenuAliasId?: string
      status?: string
    },
  ): Promise<void> {
    this.logger.log(
      `Received postback data: "${data}" from user: ${userId}, params: ${params ? JSON.stringify(params) : 'undefined'}`,
    )

    // Rate limiting for postback events - prevent rapid clicking
    const queryParams = new URLSearchParams(data)
    const action = queryParams.get('action')
    const messageIdFromPostback = queryParams.get('messageId') || undefined

    // Create a unique rate limit key based on userId, action, and messageId
    const rateLimitKey = `postback_rate_limit:${userId}:${action}:${messageIdFromPostback || 'no_message_id'}`
    const rateLimitDuration = 3000 // 3 seconds cooldown

    // Check if user recently performed the same action
    const lastActionTime = this.analysisCacheService.get<number>(rateLimitKey)
    const currentTime = Date.now()

    if (lastActionTime && currentTime - lastActionTime < rateLimitDuration) {
      this.logger.warn(
        `Rate limit triggered for user ${userId}, action ${action}. Last action: ${lastActionTime}, current: ${currentTime}, diff: ${currentTime - lastActionTime}ms`,
      )

      // Silent block - no message sent to user
      return
    }

    // Set rate limit timestamp
    this.analysisCacheService.set(rateLimitKey, currentTime, rateLimitDuration)

    const userProfile = await this.userService.getOrCreateUserProfile({
      lineUserId: userId,
    })
    const currentLanguage = userProfile.language || 'th'

    const mealTypeFromPostback = queryParams.get('mealType') // This is the mealType
    const postbackDate = params?.date // Assign postbackDate from params

    this.logger.log(
      `Processing postback action: '${action}' for user ${userProfile.lineUserId}, messageId: ${messageIdFromPostback}`,
    )

    try {
      // Ensure messageId is present for actions that need cached data
      if (
        !messageIdFromPostback &&
        (action === 'analyze_again' ||
          action === 'view_vitamins_minerals' ||
          action === 'save_food_analysis' ||
          action === 'confirm_save_meal' ||
          action === 'reanalyze_food')
      ) {
        this.logger.warn(
          `Postback action '${action}' called without a messageId. Cannot retrieve cached data.`,
        )
        await this.replyText(
          replyToken,
          currentLanguage === 'th'
            ? 'ขออภัยค่ะ ข้อมูลการวิเคราะห์เดิมไม่สมบูรณ์ โปรดลองวิเคราะห์ใหม่อีกครั้ง'
            : 'Sorry, the original analysis data is incomplete. Please try analyzing again.',
          'postback_missing_messageId',
          true,
          currentLanguage,
        )
        // ไม่ต้องส่งข้อความแยกเพิ่มเติม เนื่องจากมี Quick Reply แล้ว
        return
      }

      let cachedData: FoodAnalysisToolResult | undefined
      if (messageIdFromPostback) {
        cachedData = this.analysisCacheService.get<FoodAnalysisToolResult>(
          messageIdFromPostback,
        )
        if (!cachedData) {
          this.logger.warn(
            `Cache miss for messageId ${messageIdFromPostback} for postback action '${action}'.`,
          )
        }
      }

      switch (action) {
        case 'analyze_again': {
          this.logger.log(
            `Postback: Handling 'analyze_again' for user ${userProfile.lineUserId}. MessageId: ${messageIdFromPostback}`,
          )

          if (!cachedData) {
            await this.replyText(
              replyToken,
              currentLanguage === 'th'
                ? 'ขออภัย ไม่พบข้อมูลเดิมที่จะวิเคราะห์อีกครั้ง โปรดลองเริ่มใหม่'
                : 'Sorry, the original data to analyze again was not found. Please try starting over.',
              'analyze_again_no_cache',
              true,
              currentLanguage,
            )
            // ไม่ต้องส่งข้อความแยกเพิ่มเติม เนื่องจากมี Quick Reply แล้ว
            return
          }
          const originalImageUrl = cachedData.imageUrl
          const originalTextQuery = cachedData.food_name

          const analysisResult = await this.aiService.analyzeFoodOrMeal(
            userProfile.lineUserId,
            originalTextQuery,
            userProfile,
            currentLanguage,
            undefined,
            originalImageUrl,
            messageIdFromPostback,
          )

          if (analysisResult && 'food_name' in analysisResult) {
            const foodAnalysisResult = analysisResult
            const flexMessageData: FlexFoodAnalysisData = {
              ...foodAnalysisResult,
              lineUserId: userProfile.lineUserId,
              messageId:
                messageIdFromPostback || new Date().getTime().toString(),
              imageUrl: originalImageUrl,
            }
            const flexMessage = createFoodAnalysisFlexMessage(
              flexMessageData,
              currentLanguage,
            )
            await this.replyMessages(
              replyToken,
              [flexMessage],
              false,
              currentLanguage,
            )
          } else {
            await this.replyText(
              replyToken,
              currentLanguage === 'th'
                ? 'ขออภัย ไม่สามารถวิเคราะห์ผลลัพธ์ได้ในขณะนี้'
                : `Sorry, I couldn't process the analysis result at this time.`,
              'food_analysis_text_error',
              true,
              currentLanguage,
            )
            // ไม่ต้องส่งข้อความแยกเพิ่มเติม เนื่องจากมี Quick Reply แล้ว
          }
          break
        }
        case 'view_vitamins_minerals': {
          this.logger.log(
            `Postback: Handling 'view_vitamins_minerals' for user ${userProfile.lineUserId}, messageId: ${messageIdFromPostback}`,
          )
          if (cachedData) {
            const { vitamins, minerals } =
              this.extractVitaminsAndMinerals(cachedData)
            const flexMessage = createVitaminMineralDetailsFlexMessage(
              cachedData.food_name,
              vitamins,
              minerals,
              currentLanguage,
            )
            await this.replyMessages(
              replyToken,
              [flexMessage],
              false,
              currentLanguage,
            )
          } else {
            this.logger.warn(
              `Cache miss for messageId ${messageIdFromPostback} for view_vitamins_minerals action. Attempting to fetch from database.`,
            )
            const foodLogEntry = await this.foodLogModel
              .findOne({
                lineUserId: userId,
                sourceMessageId: messageIdFromPostback,
              })
              .sort({ createdAt: -1 })

            if (
              foodLogEntry &&
              foodLogEntry.food &&
              foodLogEntry.food.micronutrients
            ) {
              this.logger.log(
                `Found food log entry for user ${userId} and sourceMessageId ${messageIdFromPostback}. Extracting micronutrients.`,
              )
              const foodNameFromDb =
                foodLogEntry.food.foodName?.th ||
                foodLogEntry.food.foodName?.en ||
                (currentLanguage === 'th' ? 'อาหารที่บันทึกไว้' : 'Saved Food')
              const vitaminsFromDb: Record<string, AiVitaminMineralDetail> = {}
              const mineralsFromDb: Record<string, AiVitaminMineralDetail> = {}
              const vitaminKeys = [
                'vitamin_a',
                'vitamin_c',
                'vitamin_d',
                'vitamin_e',
                'vitamin_k',
                'vitamin_b1',
                'vitamin_b2',
                'vitamin_b3',
                'vitamin_b5',
                'vitamin_b6',
                'vitamin_b9',
                'vitamin_b12',
              ]
              foodLogEntry.food.micronutrients.forEach((detail, key) => {
                const aiDetail: AiVitaminMineralDetail = {
                  value: detail.value,
                  unit: detail.unit,
                  dv: detail.dv,
                }
                if (vitaminKeys.includes(key)) {
                  vitaminsFromDb[key] = aiDetail
                } else {
                  mineralsFromDb[key] = aiDetail
                }
              })
              const flexMessage = createVitaminMineralDetailsFlexMessage(
                foodNameFromDb,
                vitaminsFromDb,
                mineralsFromDb,
                currentLanguage,
              )
              await this.replyMessages(
                replyToken,
                [flexMessage],
                false,
                currentLanguage,
              )
            } else {
              this.logger.warn(
                `Food log entry not found for user ${userId} and sourceMessageId ${messageIdFromPostback} after cache miss.`,
              )
              const notFoundText =
                currentLanguage === 'th'
                  ? 'ขออภัย ไม่พบข้อมูลการวิเคราะห์เดิมหรือที่บันทึกไว้ โปรดลองวิเคราะห์ใหม่อีกครั้ง'
                  : 'Sorry, the original or saved analysis data was not found. Please try analyzing again.'
              await this.replyText(
                replyToken,
                notFoundText,
                'vitamins_minerals_not_found',
                true,
                currentLanguage,
              )
              // ไม่ต้องส่งข้อความแยกเพิ่มเติม เนื่องจากมี Quick Reply แล้ว
            }
          }
          break
        }
        case 'save_food_analysis': {
          this.logger.log(
            `Postback: Handling 'save_food_analysis' (initiate save) for user ${userProfile.lineUserId}, messageId: ${messageIdFromPostback}`,
          )
          if (!messageIdFromPostback) {
            this.logger.error('save_food_analysis called without messageId.')
            await this.replyText(
              replyToken,
              currentLanguage === 'th'
                ? 'เกิดข้อผิดพลาด: ไม่พบข้อมูลการวิเคราะห์เดิม'
                : 'Error: Original analysis data not found.',
              'save_food_analysis_no_data',
              true,
              currentLanguage,
            )
            // ไม่ต้องส่งข้อความแยกเพิ่มเติม เนื่องจากมี Quick Reply แล้ว
            return
          }
          if (!cachedData) {
            this.logger.warn(
              `Cache miss for messageId ${messageIdFromPostback} when initiating save_food_analysis. This might be okay if only messageId is forwarded.`,
            )
          }
          const mealTypes = [
            {
              label: currentLanguage === 'th' ? '☀️ อาหารเช้า' : '☀️ Breakfast',
              type: 'breakfast',
            },
            {
              label: currentLanguage === 'th' ? '🕛 อาหารกลางวัน' : '🕛 Lunch',
              type: 'lunch',
            },
            {
              label: currentLanguage === 'th' ? '🌙 อาหารเย็น' : '🌙 Dinner',
              type: 'dinner',
            },
            {
              label: currentLanguage === 'th' ? '🍎 อาหารว่าง' : '🍎 Snack',
              type: 'snack',
            },
          ]
          const quickReplyItems: QuickReplyItem[] = mealTypes.map((meal) => ({
            type: 'action' as const,
            action: {
              type: 'postback',
              label: meal.label,
              data: `action=confirm_save_meal&messageId=${messageIdFromPostback}&mealType=${meal.type}`,
              displayText: meal.label,
            },
          }))
          await this.replyMessages(replyToken, [
            {
              type: 'text',
              text:
                currentLanguage === 'th'
                  ? 'ต้องการบันทึกเป็นมื้ออาหารประเภทใดคะ?'
                  : 'Which meal type would you like to save this as?',
              quickReply: { items: quickReplyItems },
            },
          ])
          break
        }
        case 'confirm_save_meal': {
          this.logger.log(
            `Postback: Handling 'confirm_save_meal' for user ${userId}, mealType: ${mealTypeFromPostback}, messageId: ${messageIdFromPostback}`,
          )
          if (!messageIdFromPostback || !cachedData) {
            this.logger.warn(
              `confirm_save_meal called without messageId or cachedData for user ${userId}.`,
            )
            await this.replyText(
              replyToken,
              currentLanguage === 'th'
                ? 'ขออภัยค่ะ ไม่พบข้อมูลเดิมที่จะบันทึก โปรดลองเริ่มการวิเคราะห์ใหม่อีกครั้ง'
                : 'Sorry, the original data for saving was not found. Please try starting a new analysis.',
              'confirm_save_meal_no_data',
              true,
              currentLanguage,
            )
            // ไม่ต้องส่งข้อความแยกเพิ่มเติม เนื่องจากมี Quick Reply แล้ว
            return
          }
          if (!mealTypeFromPostback) {
            this.logger.error(
              `mealType not found in postback data for confirm_save_meal. User: ${userId}`,
            )
            await this.replyText(
              replyToken,
              currentLanguage === 'th'
                ? 'เกิดข้อผิดพลาด: ไม่พบประเภทมื้ออาหาร โปรดลองอีกครั้ง'
                : 'Error: Meal type not found. Please try again.',
              'confirm_save_meal_no_meal_type',
              true,
              currentLanguage,
            )
            // ไม่ต้องส่งข้อความแยกเพิ่มเติม เนื่องจากมี Quick Reply แล้ว
            return
          }
          try {
            const userDoc =
              await this.userService.getUserDocumentByLineId(userId)
            if (!userDoc) {
              this.logger.error(
                `User not found for lineUserId: ${userId} during confirm_save_meal. Cannot save food log.`,
              )
              await this.replyText(
                replyToken,
                currentLanguage === 'th'
                  ? 'ขออภัยค่ะ ไม่พบข้อมูลโปรไฟล์ของคุณ ไม่สามารถบันทึกข้อมูลอาหารได้'
                  : 'Sorry, your user profile was not found. Unable to save food log.',
                'confirm_save_meal_no_profile',
                true,
                currentLanguage,
              )
              // ไม่ต้องส่งข้อความแยกเพิ่มเติม เนื่องจากมี Quick Reply แล้ว
              return
            }
            let foodAmount = 1
            let foodUnit = 'หน่วย'
            if (cachedData.portion) {
              const portionRegex =
                /^(?:ประมาณ\s*)?([\d.]+)\s*(กล่อง|จาน|ชาม|ชิ้น|ถ้วย|กรัม|กก\.|กิโลกรัม|มล\.|ลิตร|หน่วย|portion|serving|piece|g|kg|ml|l)(?:\s*\(.*\))?/i
              const portionParts = cachedData.portion.match(portionRegex)
              if (portionParts && portionParts.length >= 3) {
                foodAmount = parseFloat(portionParts[1]) || 1
                foodUnit = portionParts[2] || 'หน่วย'
              } else {
                const simplerParts =
                  cachedData.portion.match(/([\d.]+)\s*(\S+)/)
                if (simplerParts && simplerParts.length === 3) {
                  foodAmount = parseFloat(simplerParts[1]) || 1
                  foodUnit = simplerParts[2] || 'หน่วย'
                }
                this.logger.warn(
                  `[confirm_save_meal] Could not parse unit precisely from portion: "${cachedData.portion}". Using amount: ${foodAmount}, unit: ${foodUnit}`,
                )
              }
            }
            const azureBaseUrl = this.configService.get<string>(
              'AZURE_STORAGE_CONTAINER_URL',
            )
            const foodLog = new this.foodLogModel({
              userId: userDoc._id,
              lineUserId: userId,
              sourceMessageId: messageIdFromPostback,
              logDate: await this.getLogDateWithTimezone(userId, postbackDate),
              mealType: mealTypeFromPostback,
              food: {
                foodName: {
                  th: cachedData.food_name,
                  en: cachedData.food_name,
                },
                amount: foodAmount,
                unit: foodUnit,
                portion: cachedData.portion,
                nutrition: {
                  calories: cachedData.calories || 0,
                  protein: cachedData.protein,
                  carbs: cachedData.carbs,
                  fat: cachedData.fat,
                  fiber: cachedData.fiber,
                  sugar: cachedData.sugar,
                  sodium: cachedData.sodium,
                  cholesterol: cachedData.cholesterol,
                  saturated_fat: cachedData.saturated_fat,
                  water: cachedData.water,
                  omega3: cachedData.omega3,
                  potassium_nutrient: cachedData.potassium_nutrient,
                  caffeine: cachedData.caffeine,
                  alcohol: cachedData.alcohol,
                  trans_fat: cachedData.trans_fat, // Added trans_fat
                  polyunsaturated_fat: cachedData.polyunsaturated_fat, // Added polyunsaturated_fat
                  monounsaturated_fat: cachedData.monounsaturated_fat, // Added monounsaturated_fat
                  added_sugar: cachedData.added_sugar, // Added added_sugar
                  copper: cachedData.copper, // Added copper
                  manganese: cachedData.manganese, // Added manganese
                  iodine: cachedData.iodine, // Added iodine
                },
                micronutrients: this.extractMicronutrients(cachedData),
              },
              tags: cachedData.tags || [],
              imageUrl: cachedData.imageUrl,
              image: cachedData.imageUrl
                ? {
                    url: cachedData.imageUrl,
                    blobName:
                      azureBaseUrl &&
                      cachedData.imageUrl.startsWith(azureBaseUrl)
                        ? cachedData.imageUrl
                            .substring(
                              azureBaseUrl.length +
                                (cachedData.imageUrl.startsWith(
                                  azureBaseUrl + '/',
                                )
                                  ? 1
                                  : 0),
                            )
                            .split('?')[0]
                        : cachedData.imageUrl.includes('/')
                          ? cachedData.imageUrl
                              .substring(
                                cachedData.imageUrl.lastIndexOf('/') + 1,
                              )
                              .split('?')[0]
                          : undefined,
                    alt: cachedData.food_name,
                    uploadDate: new Date(),
                    isPermanent: true,
                    retentionDays: 30,
                  }
                : undefined,
              aiAnalyzed: true,
              confidenceScore: cachedData.confidence_score,
            })
            const savedFoodLog: FoodLogDocument = await foodLog.save()
            this.logger.log(
              `Food log saved successfully for user ${userId}, meal type ${mealTypeFromPostback}, food log ID: ${String(savedFoodLog._id)}`,
            )
            if (
              messageIdFromPostback &&
              cachedData.imageUrl &&
              azureBaseUrl &&
              cachedData.imageUrl.startsWith(azureBaseUrl)
            ) {
              const tempBlobName = cachedData.imageUrl.substring(
                azureBaseUrl.length,
              )
              if (tempBlobName) {
                this.logger.log(
                  `Attempting to delete temporary image log for potential blob: ${tempBlobName} based on cached imageUrl.`,
                )
                await this.temporaryImageLogModel.deleteOne({
                  blobName: tempBlobName,
                  lineUserId: userId,
                })
              }
            }
            this.analysisCacheService.delete(messageIdFromPostback)
            const liffId =
              this.configService.get<string>('LIFF_ID_FOOD_REPORT') ||
              'YOUR_LIFF_ID_FOR_FOOD_REPORT'
            const foodLogId = String(savedFoodLog._id)
            const liffUrl = `https://liff.line.me/${liffId}/daily-report?logId=${foodLogId}&date=${format(new Date(savedFoodLog.logDate), 'yyyy-MM-dd')}`
            const successMessage =
              currentLanguage === 'th'
                ? `บันทึก "${cachedData.food_name}" เป็น "${this.getThaiMealName(mealTypeFromPostback)}" เรียบร้อยแล้วค่ะ! 🍽️`
                : `"${cachedData.food_name}" has been saved as "${mealTypeFromPostback}"! 🍽️`
            const viewDetailsMessage =
              currentLanguage === 'th'
                ? 'ดู/แก้ไขรายละเอียด'
                : 'View/Edit Details'
            const replyFlexMessage: Message = {
              type: 'flex',
              altText: successMessage,
              contents: {
                type: 'bubble',
                body: {
                  type: 'box',
                  layout: 'vertical',
                  contents: [
                    {
                      type: 'text',
                      text: successMessage,
                      wrap: true,
                      weight: 'bold',
                      size: 'md',
                    },
                    {
                      type: 'text',
                      text:
                        currentLanguage === 'th'
                          ? 'คุณสามารถดูรายละเอียดหรือแก้ไขข้อมูลได้โดยคลิกปุ่มด้านล่าง'
                          : 'You can view or edit the details by clicking the button below.',
                      wrap: true,
                      size: 'sm',
                      margin: 'md',
                    },
                  ],
                },
                footer: {
                  type: 'box',
                  layout: 'vertical',
                  spacing: 'sm',
                  contents: [
                    {
                      type: 'button',
                      style: 'link',
                      height: 'sm',
                      action: {
                        type: 'uri',
                        label: viewDetailsMessage,
                        uri: liffUrl,
                      },
                    },
                    { type: 'spacer', size: 'sm' },
                  ],
                  flex: 0,
                },
              },
            }
            await this.replyMessages(
              replyToken,
              replyFlexMessage,
              true,
              currentLanguage,
            )
            // ไม่ต้องส่งข้อความแยกเพิ่มเติม เนื่องจากมี Quick Reply แล้ว
          } catch (error) {
            this.logger.error(
              `Error saving food log for user ${userId}:`,
              error instanceof Error ? error.stack : error,
            )
            await this.replyText(
              replyToken,
              currentLanguage === 'th'
                ? 'ขออภัยค่ะ เกิดข้อผิดพลาดในการบันทึกข้อมูลมื้ออาหาร'
                : 'Sorry, an error occurred while saving your meal.',
              'save_meal_error',
              true,
              currentLanguage,
            )
            // ไม่ต้องส่งข้อความแยกเพิ่มเติม เนื่องจากมี Quick Reply แล้ว
          }
          break
        }
        case 'reanalyze_food': {
          this.logger.log(
            `Postback: Handling 'reanalyze_food' for user ${userProfile.lineUserId}, messageId: ${messageIdFromPostback}`,
          )
          if (!messageIdFromPostback || !cachedData) {
            this.logger.warn(
              `reanalyze_food called without messageId (${messageIdFromPostback}) or missing cachedData for user ${userId}.`,
            )
            await this.replyText(
              replyToken,
              currentLanguage === 'th'
                ? 'ขออภัยค่ะ ไม่พบข้อมูลเดิมที่จะวิเคราะห์ใหม่ โปรดลองเริ่มการวิเคราะห์ใหม่อีกครั้ง'
                : 'Sorry, the original data for reanalysis was not found. Please try starting a new analysis.',
              'reanalyze_food_no_data',
              true,
              currentLanguage,
            )
            // ไม่ต้องส่งข้อความแยกเพิ่มเติม เนื่องจากมี Quick Reply แล้ว
            return
          }
          const reanalyzeContextKey = `reanalyze_context:${userId}`
          const contextToCache = {
            originalMessageId: messageIdFromPostback,
            originalAnalysisData: cachedData,
            originalImageUrl: cachedData.imageUrl,
            timestamp: new Date().getTime(),
          }
          this.analysisCacheService.set(
            reanalyzeContextKey,
            contextToCache,
            600 * 1000,
          )
          this.logger.log(
            `Cached reanalyze context for user ${userId}, messageId ${messageIdFromPostback}, imageUrl: ${cachedData.imageUrl ? 'present' : 'none'}`,
          )
          const cancelQuickReply: QuickReplyItem = {
            type: 'action',
            action: {
              type: 'postback',
              label: currentLanguage === 'th' ? '❌ ยกเลิก' : '❌ Cancel',
              data: `action=cancel_reanalyze&userId=${userId}`,
              displayText:
                currentLanguage === 'th'
                  ? 'ยกเลิกการวิเคราะห์ใหม่'
                  : 'Cancel reanalysis',
            },
          }
          await this.replyMessages(replyToken, [
            {
              type: 'text',
              text:
                currentLanguage === 'th'
                  ? `กรุณาบอกรายละเอียดเพิ่มเติมเกี่ยวกับ "${cachedData.food_name}" ที่ต้องการให้วิเคราะห์ใหม่ค่ะ\n\n📝 ตัวอย่างรายละเอียดที่ช่วยได้:\n• ชื่ออาหารที่ถูกต้อง\n• ส่วนประกอบที่แน่ใจ\n• ปริมาณที่แท้จริง\n• สิ่งที่ผิดจากการวิเคราะห์เดิม\n\n💬 พิมพ์รายละเอียดในข้อความเดียว หรือกดยกเลิกถ้าเปลี่ยนใจ`
                  : `Please provide additional details about "${cachedData.food_name}" for reanalysis.\n\n📝 Helpful details examples:\n• Correct food name\n• Known ingredients\n• Actual portion size\n• What was wrong in previous analysis\n\n💬 Type details in one message or cancel if you changed your mind`,
              quickReply: { items: [cancelQuickReply] },
            },
          ])
          // No MainMenuQR here, as user is in a specific flow with a cancel QR
          break
        }
        case 'cancel_reanalyze': {
          this.logger.log(
            `Postback: Handling 'cancel_reanalyze' for user ${userProfile.lineUserId}`,
          )
          const reanalyzeContextKey = `reanalyze_context:${userId}`
          const reanalyzeContext = this.analysisCacheService.get<{
            originalMessageId: string
            originalAnalysisData: FoodAnalysisToolResult
            originalImageUrl?: string
            timestamp: number
          }>(reanalyzeContextKey)
          if (reanalyzeContext) {
            this.analysisCacheService.delete(reanalyzeContextKey)
            this.logger.log(`Cancelled reanalyze context for user ${userId}`)
            await this.replyText(
              replyToken,
              currentLanguage === 'th'
                ? '✅ ยกเลิกการวิเคราะห์ใหม่เรียบร้อยแล้ว คุณสามารถถามคำถามหรือส่งรูปอาหารใหม่ได้เลยค่ะ'
                : '✅ Reanalysis cancelled successfully. You can now ask questions or send new food images.',
              'cancel_reanalyze_success',
              true,
              currentLanguage,
            )
            // ไม่ต้องส่งข้อความแยกเพิ่มเติม เนื่องจากมี Quick Reply แล้ว
          } else {
            this.logger.warn(
              `Cancel reanalyze called but no context found for user ${userId}`,
            )
            await this.replyText(
              replyToken,
              currentLanguage === 'th'
                ? 'ไม่พบสถานะการวิเคราะห์ใหม่ที่จะยกเลิก คุณสามารถใช้งานปกติได้เลยค่ะ'
                : 'No reanalysis status found to cancel. You can continue using normally.',
              'cancel_reanalyze_no_context',
              true,
              currentLanguage,
            )
            // ไม่ต้องส่งข้อความแยกเพิ่มเติม เนื่องจากมี Quick Reply แล้ว
          }
          break
        }
        case 'request_delete_food_log': {
          this.logger.log(
            `Postback: Handling 'request_delete_food_log' for user ${userProfile.lineUserId}`,
          )
          await this.replyText(
            replyToken,
            'Delete functionality for saved logs is under development.',
            'delete_food_log_not_implemented',
            true,
            currentLanguage,
          )
          // ไม่ต้องส่งข้อความแยกเพิ่มเติม เนื่องจากมี Quick Reply แล้ว
          break
        }
        case 'trigger_calculate_nutrition_goals': {
          try {
            const userProfileResult =
              await this.userService.getUserProfile(userId)
            if (!userProfileResult) {
              await this.replyText(
                replyToken,
                currentLanguage === 'th'
                  ? 'ไม่พบข้อมูลผู้ใช้ค่ะ'
                  : 'User profile not found.',
                'nutrition_goal_profile_error',
                true,
                currentLanguage,
              )
              return
            }
            const aiUserProfile: UserProfileDto = userProfileResult

            // ใช้ Direct Chat Completion แทนการเรียก tool + presentation แยกกัน
            const directNutritionGoalResponse =
              await this.aiService.answerGeneralNutritionQuestion(
                userId,
                currentLanguage === 'th'
                  ? 'คำนวณเป้าหมายโภชนาการประจำวันตามโปรไฟล์และเป้าหมายสุขภาพของฉัน ให้แสดงผล BMR, TDEE, และเป้าหมายแคลอรี่ โปรตีน คาร์บ ไขมัน ในรูปแบบที่สวยงามและครบถ้วน พร้อมคำแนะนำเพิ่มเติม'
                  : 'Calculate my daily nutrition goals based on my profile and health goals. Display BMR, TDEE, and targets for calories, protein, carbs, fat in beautiful and comprehensive format with additional advice.',
                aiUserProfile,
                currentLanguage,
              )

            if (directNutritionGoalResponse) {
              await this.replyText(
                replyToken,
                directNutritionGoalResponse,
                'nutrition_goal_success',
                true,
                currentLanguage,
              )
            } else {
              await this.replyText(
                replyToken,
                currentLanguage === 'th'
                  ? 'ขออภัยค่ะ ไม่สามารถคำนวณเป้าหมายได้ในขณะนี้'
                  : 'Sorry, unable to calculate goals at this time.',
                'nutrition_goal_error',
                true,
                currentLanguage,
              )
            }
          } catch (error) {
            this.logger.error(
              `Error in trigger_calculate_nutrition_goals: ${error.message}`,
              error.stack,
            )
            await this.replyText(
              replyToken,
              currentLanguage === 'th'
                ? 'ขออภัยค่ะ เกิดข้อผิดพลาดในการคำนวณเป้าหมายโภชนาการ'
                : 'Sorry, an error occurred while calculating nutrition goals.',
              'nutrition_goal_exception',
              true,
              currentLanguage,
            )
          }
          break
        }
        case 'trigger_meal_planning': {
          try {
            const userProfileResult =
              await this.userService.getUserProfile(userId)
            if (!userProfileResult) {
              await this.replyText(
                replyToken,
                currentLanguage === 'th'
                  ? 'ไม่พบข้อมูลผู้ใช้ค่ะ'
                  : 'User profile not found.',
                'meal_planning_profile_error',
                true,
                currentLanguage,
              )
              return
            }
            const aiUserProfile: UserProfileDto = userProfileResult

            // ใช้ Direct Chat Completion แทนการเรียก tool + presentation แยกกัน
            const directMealPlanResponse =
              await this.aiService.answerGeneralNutritionQuestion(
                userId,
                currentLanguage === 'th'
                  ? 'วางแผนมื้ออาหารประจำวันตามโปรไฟล์และเป้าหมายสุขภาพของฉัน ให้แนะนำอาหารพร้อมรายละเอียดโภชนาการ แคลอรี่ โปรตีน คาร์บ ไขมัน และคำแนะนำเพิ่มเติม ในรูปแบบที่สวยงามและครบถ้วน'
                  : 'Create a daily meal plan based on my profile and health goals. Recommend foods with detailed nutrition info (calories, protein, carbs, fat) and additional advice in beautiful and comprehensive format.',
                aiUserProfile,
                currentLanguage,
              )

            if (directMealPlanResponse) {
              await this.replyText(
                replyToken,
                directMealPlanResponse,
                'meal_planning_success',
                true,
                currentLanguage,
              )
            } else {
              await this.replyText(
                replyToken,
                currentLanguage === 'th'
                  ? 'ขออภัยค่ะ ไม่สามารถสร้างแผนมื้ออาหารได้ในขณะนี้'
                  : 'Sorry, unable to create meal plan at this time.',
                'meal_planning_error',
                true,
                currentLanguage,
              )
            }
          } catch (error) {
            this.logger.error(
              `Error in trigger_meal_planning: ${error.message}`,
              error.stack,
            )
            await this.replyText(
              replyToken,
              currentLanguage === 'th'
                ? 'ขออภัยค่ะ เกิดข้อผิดพลาดในการสร้างแผนมื้ออาหาร'
                : 'Sorry, an error occurred while creating meal plan.',
              'meal_planning_exception',
              true,
              currentLanguage,
            )
          }
          break
        }
        case 'trigger_food_history_summary': {
          // เปลี่ยนเป็นการวิเคราะห์ eating pattern แบบเต็ม
          this.logger.log(
            `Processing eating pattern analysis request for user ${userId}`,
          )

          try {
            const userProfileResult =
              await this.userService.getUserProfile(userId)
            if (!userProfileResult) {
              await this.replyText(
                replyToken,
                currentLanguage === 'th'
                  ? 'ไม่พบข้อมูลผู้ใช้ค่ะ'
                  : 'User profile not found.',
                'eating_pattern_profile_error',
                true,
                currentLanguage,
              )
              return
            }

            const aiUserProfile: UserProfileDto = userProfileResult

            // 🚀 ใช้ Tool Response แบบ structured data แทนการเรียก Chat Completion
            // ดึงข้อมูล food logs สำหรับการวิเคราะห์
            const foodLogs = await this.aiService.getFoodHistoryForAI(
              userId,
              aiUserProfile,
              7, // วิเคราะห์ 7 วันย้อนหลัง
              50, // จำกัด 50 รายการ
              currentLanguage,
            )

            if ('error' in foodLogs) {
              await this.replyText(
                replyToken,
                currentLanguage === 'th'
                  ? 'ไม่สามารถดึงข้อมูลประวัติอาหารได้ค่ะ'
                  : 'Unable to retrieve food history.',
                'eating_pattern_data_error',
                true,
                currentLanguage,
              )
              return
            }

            // ดึงข้อมูล nutrition goal (ถ้ามี)
            const nutritionGoal =
              await this.aiService.calculateNutritionGoalsForUser(
                userId,
                aiUserProfile,
                currentLanguage,
              )

            const nutritionGoalForAI: NutritionGoalDtoForAI | null =
              nutritionGoal && !('error' in nutritionGoal)
                ? {
                    daily_calories: nutritionGoal.daily_goals.calories,
                    daily_protein_g: nutritionGoal.daily_goals.protein,
                    daily_carbs_g: nutritionGoal.daily_goals.carbs,
                    daily_fat_g: nutritionGoal.daily_goals.fat,
                    daily_fiber_g: nutritionGoal.daily_goals.fiber,
                  }
                : null

            // เรียก analyzeEatingPattern เพื่อได้ structured response
            const eatingPatternResult =
              await this.aiService.analyzeEatingPattern(
                userId,
                aiUserProfile,
                foodLogs.food_logs.map((log) => ({
                  timestamp: new Date(log.timestamp),
                  mealType: log.mealType,
                  foodName: log.foodName,
                  calories: log.calories,
                  protein: log.protein,
                  carbs: log.carbs,
                  fat: log.fat,
                  fiber: log.fiber,
                })),
                nutritionGoalForAI,
                currentLanguage,
              )

            if (eatingPatternResult && !('error' in eatingPatternResult)) {
              // สร้าง response text จาก structured data
              const responseText = this.formatEatingPatternResponse(
                eatingPatternResult,
                currentLanguage,
              )

              await this.replyText(
                replyToken,
                responseText,
                'eating_pattern_success',
                true,
                currentLanguage,
              )
            } else {
              await this.replyText(
                replyToken,
                currentLanguage === 'th'
                  ? 'ขออภัยค่ะ ไม่สามารถวิเคราะห์พฤติกรรมการกินได้ในขณะนี้'
                  : 'Sorry, unable to analyze eating patterns at this time.',
                'eating_pattern_error',
                true,
                currentLanguage,
              )
            }
          } catch (error) {
            this.logger.error(
              `Error in trigger_food_history_summary: ${error.message}`,
              error.stack,
            )
            await this.replyText(
              replyToken,
              currentLanguage === 'th'
                ? 'ขออภัยค่ะ เกิดข้อผิดพลาดในการวิเคราะห์พฤติกรรมการกิน'
                : 'Sorry, an error occurred while analyzing eating patterns.',
              'eating_pattern_exception',
              true,
              currentLanguage,
            )
          }
          break
        }
        default: {
          this.logger.log(
            `Received unhandled postback action: ${action} for user ${userProfile.lineUserId}`,
          )
          await this.replyText(
            replyToken,
            currentLanguage === 'th'
              ? `ขออภัย การดำเนินการ '${action}' ยังไม่รองรับในขณะนี้`
              : `Sorry, action '${action}' is not supported at this time.`,
            'unhandled_postback',
            true,
            currentLanguage,
          )
          break
        }
      }
    } catch (error) {
      this.logger.error(
        `Error processing postback data for ${userId}: "${data}"`,
        error instanceof Error ? error.stack : error,
      )
      await this.replyText(
        replyToken,
        currentLanguage === 'th'
          ? 'ขออภัยค่ะ เกิดข้อผิดพลาดในการประมวลผลการดำเนินการของคุณ'
          : 'Sorry, an error occurred while processing your action.',
        'postback_error',
        true,
        currentLanguage,
      )
    }
  }

  async getMessageContent(messageId: string): Promise<Buffer> {
    try {
      const stream = await this.lineClient.getMessageContent(messageId)
      const chunks: Buffer[] = []
      return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => {
          chunks.push(
            Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string),
          )
        })
        stream.on('end', () => {
          resolve(Buffer.concat(chunks))
        })
        stream.on('error', (err) => {
          this.logger.error(
            `Error streaming message content for ID ${messageId}:`,
            err,
          )
          reject(
            new HttpException(
              `Failed to retrieve content from LINE: ${err.message || 'Stream error'}`,
              HttpStatus.INTERNAL_SERVER_ERROR,
            ),
          )
        })
      })
    } catch (error: unknown) {
      let errMsg = 'Unknown error during getMessageContent'
      let errStack: string | undefined
      let httpStatus = HttpStatus.INTERNAL_SERVER_ERROR

      if (error instanceof HTTPError) {
        errMsg = `LINE HTTP Error in getMessageContent: ${error.statusCode} ${error.statusMessage}`
        errStack = error.stack
        httpStatus = error.statusCode || HttpStatus.INTERNAL_SERVER_ERROR
        this.logger.error(errMsg, JSON.stringify(error.originalError || error))
        throw new HttpException(
          error.statusMessage || 'LINE API Error',
          httpStatus,
        )
      } else if (error instanceof Error) {
        errMsg = error.message
        errStack = error.stack
        this.logger.error(
          `General error in getMessageContent for ID ${messageId}: ${errMsg}`,
          errStack,
        )
        throw new HttpException(
          errMsg || 'Failed to get message content',
          httpStatus,
        )
      } else if (typeof error === 'string') {
        errMsg = error
        this.logger.error(
          `String error in getMessageContent for ID ${messageId}: ${errMsg}`,
        )
        throw new HttpException(errMsg, httpStatus)
      }
      this.logger.error(
        `Unknown type error in getMessageContent for ID ${messageId}:`,
        error,
      )
      throw new HttpException(errMsg, httpStatus)
    }
  }

  async replyText(
    replyToken: string,
    text: string,
    context?: string, // เพิ่ม context parameter
    addMainMenuQuickReply: boolean = false,
    languageForQuickReply?: string,
  ): Promise<MessageAPIResponseBase> {
    const message: TextMessage = {
      type: 'text',
      text: this.smartTruncateText(text, context),
    }

    if (addMainMenuQuickReply && languageForQuickReply) {
      if (message.type === 'text') {
        // Ensure it's a TextMessage before adding quickReply
        message.quickReply = {
          items: this.createMainMenuQuickReplyItems(languageForQuickReply),
        }
      } else {
        this.logger.warn(
          `Cannot add MainMenuQuickReply to a non-text message type: ${message.type}`,
        )
      }
    }

    this.logger.log(
      `Replying with text to token ${replyToken.substring(0, 10)}... (context: ${context || 'none'}, QR: ${addMainMenuQuickReply}): "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`,
    )
    try {
      return await this.lineClient.replyMessage(replyToken, message)
    } catch (error) {
      this.logger.error(
        `Error replying with text (context: ${context || 'none'}): ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
        JSON.stringify(message, null, 2),
      )
      throw error
    }
  }

  async replyMessages(
    replyToken: string,
    messages: Message | Message[],
    addMainMenuQuickReply: boolean = false,
    languageForQuickReply?: string,
  ): Promise<MessageAPIResponseBase> {
    let messagesArray = Array.isArray(messages) ? messages : [messages]

    messagesArray = messagesArray.map((msg) => {
      if (msg.type === 'text' && typeof msg.text === 'string') {
        return {
          ...msg,
          text: this.smartTruncateText(msg.text, 'replyMessages'),
        }
      }
      return msg
    })

    if (
      addMainMenuQuickReply &&
      languageForQuickReply &&
      messagesArray.length > 0
    ) {
      const lastMessage = messagesArray[messagesArray.length - 1]
      if (lastMessage.type === 'text') {
        // Ensure it's a TextMessage before adding quickReply
        lastMessage.quickReply = {
          items: this.createMainMenuQuickReplyItems(languageForQuickReply),
        }
      } else if (lastMessage.type === 'flex') {
        // For FlexMessages, quickReply is a direct property
        lastMessage.quickReply = {
          items: this.createMainMenuQuickReplyItems(languageForQuickReply),
        }
      } else {
        this.logger.warn(
          `Cannot add MainMenuQuickReply to the last message of type: ${lastMessage.type}. It must be 'text' or 'flex'.`,
        )
      }
    }
    this.logger.log(
      `Replying with ${messagesArray.length} message(s) to token ${replyToken.substring(0, 10)}... (QR: ${addMainMenuQuickReply})`,
    )
    try {
      return await this.lineClient.replyMessage(replyToken, messagesArray)
    } catch (error) {
      this.logger.error(
        `Error replying with messages: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
        JSON.stringify(messagesArray, null, 2),
      )
      throw error
    }
  }

  async pushText(
    userId: string,
    text: string,
    context?: string, // เพิ่ม context parameter
  ): Promise<MessageAPIResponseBase> {
    if (text.length === 0) {
      this.logger.warn('Attempted to push an empty text message.')
      return Promise.resolve({} as MessageAPIResponseBase)
    }
    try {
      return await this.lineClient.pushMessage(userId, {
        type: 'text',
        text: this.smartTruncateText(text, context), // ใช้ smartTruncateText แทน substring
      } as TextMessage)
    } catch (error: unknown) {
      if (error instanceof HTTPError) {
        this.logger.error(
          `LINE HTTP Error during push to ${userId}: ${error.statusCode} ${error.message}`,
          error.stack,
        )
        if (error.originalError) {
          let detailsToLog: string
          if (error.originalError instanceof Error) {
            detailsToLog = `OriginalError: ${error.originalError.message}`
            if (error.originalError.stack) {
              detailsToLog += `\nStack: ${error.originalError.stack}`
            }
          } else if (
            typeof error.originalError === 'object' &&
            error.originalError !== null
          ) {
            detailsToLog = JSON.stringify(error.originalError)
          } else {
            detailsToLog = String(error.originalError)
          }
          this.logger.error(
            'LINE HTTP Original Error details for pushText:',
            detailsToLog,
          )
        }
      } else if (error instanceof Error) {
        this.logger.error(
          `Error pushing text to ${userId}: ${error.message}`,
          error.stack,
        )
      } else {
        this.logger.error(
          `Unknown error occurred during pushText to ${userId}`,
          error,
        )
      }
      return Promise.resolve({} as MessageAPIResponseBase)
    }
  }

  async pushMessages(
    userId: string,
    messages: Message | Message[],
  ): Promise<MessageAPIResponseBase> {
    if (!messages || (Array.isArray(messages) && messages.length === 0)) {
      this.logger.warn('Attempted to push an empty message or message array.')
      return Promise.resolve({} as MessageAPIResponseBase)
    }
    try {
      return await this.lineClient.pushMessage(userId, messages)
    } catch (error: unknown) {
      // Consolidate error logging from pushText
      if (error instanceof HTTPError) {
        this.logger.error(
          `LINE HTTP Error during pushMessages to ${userId}: ${error.statusCode} ${error.message}`,
          error.stack,
        )
        if (error.originalError) {
          let detailsToLog: string
          if (error.originalError instanceof Error) {
            detailsToLog = `OriginalError: ${error.originalError.message}`
            if (error.originalError.stack) {
              detailsToLog += `\nStack: ${error.originalError.stack}`
            }
          } else if (
            typeof error.originalError === 'object' &&
            error.originalError !== null
          ) {
            detailsToLog = JSON.stringify(error.originalError)
          } else {
            detailsToLog = String(error.originalError)
          }
          this.logger.error(
            'LINE HTTP Original Error details for pushMessages:',
            detailsToLog,
          )
        }
      } else if (error instanceof Error) {
        this.logger.error(
          `Error pushing messages to ${userId}: ${error.message}`,
          error.stack,
        )
      } else {
        this.logger.error(
          `Unknown error occurred during pushMessages to ${userId}`,
          error,
        )
      }
      return Promise.resolve({} as MessageAPIResponseBase)
    }
  }

  // Helper function to get translated labels (can be expanded or moved)
  // This is a simplified version. You might want a more robust i18n solution.
  private getTranslatedNutritionLabel(key: string, lang: string): string {
    const translations: Record<string, Record<string, string>> = {
      th: {
        vitamin_a: 'วิตามิน A',
        vitamin_c: 'วิตามิน C',
        vitamin_d: 'วิตามิน D',
        vitamin_e: 'วิตามิน E',
        vitamin_k: 'วิตามิน K',
        vitamin_b1: 'วิตามิน B1',
        vitamin_b2: 'วิตามิน B2',
        vitamin_b3: 'วิตามิน B3',
        vitamin_b5: 'วิตามิน B5',
        vitamin_b6: 'วิตามิน B6',
        vitamin_b9: 'วิตามิน B9',
        vitamin_b12: 'วิตามิน B12',
        calcium: 'แคลเซียม',
        iron: 'เหล็ก',
        magnesium: 'แมกนีเซียม',
        potassium: 'โพแทสเซียม',
        zinc: 'สังกะสี',
        phosphorus: 'ฟอสฟอรัส',
        selenium: 'ซีลีเนียม',
        // Add more as needed from flex.messages.ts TranslationSet
      },
      en: {
        vitamin_a: 'Vitamin A',
        vitamin_c: 'Vitamin C',
        vitamin_d: 'Vitamin D',
        vitamin_e: 'Vitamin E',
        vitamin_k: 'Vitamin K',
        vitamin_b1: 'Vitamin B1',
        vitamin_b2: 'Vitamin B2',
        vitamin_b3: 'Vitamin B3',
        vitamin_b5: 'Vitamin B5',
        vitamin_b6: 'Vitamin B6',
        vitamin_b9: 'Vitamin B9',
        vitamin_b12: 'Vitamin B12',
        calcium: 'Calcium',
        iron: 'Iron',
        magnesium: 'Magnesium',
        potassium: 'Potassium',
        zinc: 'Zinc',
        phosphorus: 'Phosphorus',
        selenium: 'Selenium',
      },
    }
    return (
      translations[lang]?.[key.toLowerCase()] ||
      key.replace('vitamin_', '').toUpperCase()
    )
  }

  private extractMicronutrients(
    foodData: FoodAnalysisToolResult,
  ): Map<string, AiVitaminMineralDetail> {
    const micronutrients = new Map<string, AiVitaminMineralDetail>()

    // วิตามิน
    if (foodData.vitamin_a) micronutrients.set('vitamin_a', foodData.vitamin_a)
    if (foodData.vitamin_c) micronutrients.set('vitamin_c', foodData.vitamin_c)
    if (foodData.vitamin_d) micronutrients.set('vitamin_d', foodData.vitamin_d)
    if (foodData.vitamin_e) micronutrients.set('vitamin_e', foodData.vitamin_e)
    if (foodData.vitamin_k) micronutrients.set('vitamin_k', foodData.vitamin_k)
    if (foodData.vitamin_b1)
      micronutrients.set('vitamin_b1', foodData.vitamin_b1)
    if (foodData.vitamin_b2)
      micronutrients.set('vitamin_b2', foodData.vitamin_b2)
    if (foodData.vitamin_b3)
      micronutrients.set('vitamin_b3', foodData.vitamin_b3)
    if (foodData.vitamin_b5)
      micronutrients.set('vitamin_b5', foodData.vitamin_b5)
    if (foodData.vitamin_b6)
      micronutrients.set('vitamin_b6', foodData.vitamin_b6)
    if (foodData.vitamin_b9)
      micronutrients.set('vitamin_b9', foodData.vitamin_b9)
    if (foodData.vitamin_b12)
      micronutrients.set('vitamin_b12', foodData.vitamin_b12)

    // แร่ธาตุ
    if (foodData.calcium) micronutrients.set('calcium', foodData.calcium)
    if (foodData.iron) micronutrients.set('iron', foodData.iron)
    if (foodData.magnesium) micronutrients.set('magnesium', foodData.magnesium)
    if (foodData.potassium) micronutrients.set('potassium', foodData.potassium)
    if (foodData.zinc) micronutrients.set('zinc', foodData.zinc)
    if (foodData.phosphorus)
      micronutrients.set('phosphorus', foodData.phosphorus)
    if (foodData.selenium) micronutrients.set('selenium', foodData.selenium)

    return micronutrients
  }

  private extractVitaminsAndMinerals(toolResult: FoodAnalysisToolResult): {
    vitamins: Record<string, AiVitaminMineralDetail>
    minerals: Record<string, AiVitaminMineralDetail>
  } {
    const vitamins: Record<string, AiVitaminMineralDetail> = {}
    const minerals: Record<string, AiVitaminMineralDetail> = {}

    // Vitamins
    if (toolResult.vitamin_a) vitamins.vitamin_a = toolResult.vitamin_a
    if (toolResult.vitamin_c) vitamins.vitamin_c = toolResult.vitamin_c
    // ... (add all other vitamins from toolResult)
    if (toolResult.vitamin_d) vitamins.vitamin_d = toolResult.vitamin_d
    if (toolResult.vitamin_e) vitamins.vitamin_e = toolResult.vitamin_e
    if (toolResult.vitamin_k) vitamins.vitamin_k = toolResult.vitamin_k
    if (toolResult.vitamin_b1) vitamins.vitamin_b1 = toolResult.vitamin_b1
    if (toolResult.vitamin_b2) vitamins.vitamin_b2 = toolResult.vitamin_b2
    if (toolResult.vitamin_b3) vitamins.vitamin_b3 = toolResult.vitamin_b3
    if (toolResult.vitamin_b5) vitamins.vitamin_b5 = toolResult.vitamin_b5
    if (toolResult.vitamin_b6) vitamins.vitamin_b6 = toolResult.vitamin_b6
    if (toolResult.vitamin_b9) vitamins.vitamin_b9 = toolResult.vitamin_b9
    if (toolResult.vitamin_b12) vitamins.vitamin_b12 = toolResult.vitamin_b12

    // Minerals
    if (toolResult.calcium) minerals.calcium = toolResult.calcium
    if (toolResult.iron) minerals.iron = toolResult.iron
    // ... (add all other minerals from toolResult)
    if (toolResult.magnesium) minerals.magnesium = toolResult.magnesium
    if (toolResult.potassium) minerals.potassium = toolResult.potassium
    if (toolResult.zinc) minerals.zinc = toolResult.zinc
    if (toolResult.phosphorus) minerals.phosphorus = toolResult.phosphorus
    if (toolResult.selenium) minerals.selenium = toolResult.selenium

    return { vitamins, minerals }
  }

  private getThaiMealName(mealType: string): string {
    switch (mealType.toLowerCase()) {
      case 'breakfast':
        return 'เช้า'
      case 'lunch':
        return 'กลางวัน'
      case 'dinner':
        return 'เย็น'
      case 'snack':
        return 'ว่าง'
      default:
        return 'อื่นๆ'
    }
  }

  /**
   * Smart text truncation ที่ใช้ AI_CONFIG settings
   */
  private smartTruncateText(
    text: string,
    context?: string,
    maxLength?: number,
  ): string {
    const { responseTruncation } = AI_CONFIG.conversationControl

    // ใช้ maxLength ที่ส่งมา หรือ config default
    const limit = maxLength || responseTruncation.maxResponseLength

    // ตรวจสอบว่า context นี้ไม่ควรตัด
    if (context && responseTruncation.noTruncationContexts.includes(context)) {
      return text
    }

    // ถ้าข้อความสั้นกว่า limit ไม่ต้องตัด
    if (text.length <= limit) {
      return text
    }

    // ตัดข้อความแบบ smart - หาจุดตัดที่เหมาะสม
    let cutPoint = limit

    // หาจุดตัดที่ดี (หลัง sentence, word boundary)
    const sentences = text.substring(0, limit).lastIndexOf('.')
    const questions = text.substring(0, limit).lastIndexOf('?')
    const exclamations = text.substring(0, limit).lastIndexOf('!')
    const newlines = text.substring(0, limit).lastIndexOf('\n')

    const goodCutPoints = [sentences, questions, exclamations, newlines]
      .filter((point) => point > limit * 0.8) // อย่างน้อย 80% ของ limit
      .sort((a, b) => b - a)

    if (goodCutPoints.length > 0) {
      cutPoint = goodCutPoints[0] + 1
    } else {
      // ถ้าหาจุดดีไม่เจอ หาช่วงว่าง
      const lastSpace = text.substring(0, limit).lastIndexOf(' ')
      if (lastSpace > limit * 0.9) {
        cutPoint = lastSpace
      }
    }

    const truncated = text.substring(0, cutPoint).trim()
    this.logger.debug(
      `Text truncated from ${text.length} to ${truncated.length} chars (context: ${context || 'none'})`,
    )

    return truncated
  }

  // ========== COMMAND HANDLING ==========

  /**
   * จัดการคำสั่งเฉพาะที่ขึ้นต้นด้วยสัญลักษณ์กำหนด (เช่น /)
   * ไม่ส่งไปประมวลผลด้วย AI แต่จัดการภายในระบบ
   */
  private async handleCommand(
    replyToken: string,
    command: string,
    userId: string,
    userProfile: UserProfileDto,
    language: string,
  ): Promise<void> {
    const cmd = command.toLowerCase().trim()

    try {
      // แยกคำสั่งและพารามิเตอร์
      const parts = cmd.split(' ')
      const mainCommand = parts[0]
      const args = parts.slice(1)

      this.logger.log(
        `Processing command: ${mainCommand} with args: [${args.join(', ')}]`,
      )

      switch (mainCommand) {
        case 'help':
        case 'start':
          await this.handleHelpCommand(replyToken, language)
          break

        case 'setlang':
        case 'language':
          await this.handleLanguageCommand(replyToken, userId, args, language)
          break

        case 'profile':
        case 'me':
          await this.handleProfileCommand(replyToken, userProfile, language)
          break

        case 'clear':
        case 'reset':
          await this.handleClearCommand(replyToken, userId, language)
          break

        case 'stats':
        case 'status':
          await this.handleStatsCommand(replyToken, userId, language)
          break

        default:
          await this.handleUnknownCommand(replyToken, mainCommand, language)
          break
      }
    } catch (error) {
      this.logger.error(
        `Error processing command "${command}" for user ${userId}:`,
        error,
      )
      await this.replyText(
        replyToken,
        language === 'th'
          ? 'ขออภัยค่ะ เกิดข้อผิดพลาดในการประมวลผลคำสั่ง'
          : 'Sorry, an error occurred while processing the command.',
        'command_error',
        true,
        language,
      )
    }
  }

  private async handleHelpCommand(
    replyToken: string,
    language: string,
  ): Promise<void> {
    const helpText =
      language === 'th'
        ? `🤖 คำสั่งที่สามารถใช้ได้:

📚 /help - แสดงคำสั่งทั้งหมด
🌐 /setlang [th/en] - เปลี่ยนภาษา
👤 /profile - ดูข้อมูลโปรไฟล์
📋 /menu - แสดงเมนูหลัก
🗑️ /clear - ล้างประวัติการสนทนา
📊 /stats - สถิติการใช้งาน

💡 คุณสามารถส่งรูปอาหารหรือพิมพ์ชื่ออาหารเพื่อวิเคราะห์คุณค่าทางโภชนาการได้เลยค่ะ!`
        : `🤖 Available commands:

📚 /help - Show all commands
🌐 /setlang [th/en] - Change language
👤 /profile - View profile
📋 /menu - Show main menu
🗑️ /clear - Clear conversation history
📊 /stats - Usage statistics

💡 You can send food photos or type food names to analyze nutritional values!`

    await this.replyText(replyToken, helpText)
  }

  private async handleLanguageCommand(
    replyToken: string,
    userId: string,
    args: string[],
    currentLanguage: string,
  ): Promise<void> {
    if (args.length === 0) {
      const langText =
        currentLanguage === 'th'
          ? `🌐 ภาษาปัจจุบัน: ไทย\n\nเปลี่ยนภาษา:\n/setlang th - ภาษาไทย\n/setlang en - English`
          : `🌐 Current language: English\n\nChange language:\n/setlang th - ภาษาไทย\n/setlang en - English`

      await this.replyText(replyToken, langText)
      return
    }

    const newLang = args[0].toLowerCase()
    if (newLang !== 'th' && newLang !== 'en') {
      const errorText =
        currentLanguage === 'th'
          ? 'รองรับเฉพาะ th (ไทย) หรือ en (English) เท่านั้น'
          : 'Only supports th (Thai) or en (English)'

      await this.replyText(replyToken, errorText)
      return
    }

    try {
      await this.userService.setUserLanguage(userId, newLang)
      const successText =
        newLang === 'th'
          ? '✅ เปลี่ยนภาษาเป็นไทยเรียบร้อยแล้ว'
          : '✅ Language changed to English successfully'

      await this.replyText(replyToken, successText)
    } catch (error) {
      this.logger.error(`Error updating language for user ${userId}:`, error)
      const errorText =
        currentLanguage === 'th'
          ? 'เกิดข้อผิดพลาดในการเปลี่ยนภาษา'
          : 'Error changing language'

      await this.replyText(replyToken, errorText)
    }
  }

  private async handleProfileCommand(
    replyToken: string,
    userProfile: UserProfileDto,
    language: string,
  ): Promise<void> {
    const profileText =
      language === 'th'
        ? `👤 ข้อมูลโปรไฟล์

📛 ชื่อ: ${userProfile.displayName || 'ไม่ระบุ'}
🌐 ภาษา: ${userProfile.language === 'th' ? 'ไทย' : 'English'}
🎯 เป้าหมาย: ${userProfile.goal || 'ยังไม่ได้ตั้งค่า'}
🍽️ ประเภทอาหาร: ${userProfile.dietType || 'ยังไม่ได้ระบุ'}
📅 สมาชิกตั้งแต่: ${userProfile.createdAt ? new Date(userProfile.createdAt).toLocaleDateString('th-TH') : 'ไม่ทราบ'}`
        : `👤 Profile Information

📛 Name: ${userProfile.displayName || 'Not specified'}
🌐 Language: ${userProfile.language === 'th' ? 'Thai' : 'English'}
🎯 Goal: ${userProfile.goal || 'Not set'}
🍽️ Diet Type: ${userProfile.dietType || 'Not specified'}
📅 Member since: ${userProfile.createdAt ? new Date(userProfile.createdAt).toLocaleDateString('en-US') : 'Unknown'}`

    await this.replyText(replyToken, profileText)
  }

  private async handleClearCommand(
    replyToken: string,
    userId: string,
    language: string,
  ): Promise<void> {
    try {
      await this.conversationHistoryService.clearHistory(userId)
      const successText =
        language === 'th'
          ? '🗑️ ล้างประวัติการสนทนาเรียบร้อยแล้ว'
          : '🗑️ Conversation history cleared successfully'

      await this.replyText(replyToken, successText)
    } catch (error) {
      this.logger.error(`Error clearing history for user ${userId}:`, error)
      const errorText =
        language === 'th'
          ? 'เกิดข้อผิดพลาดในการล้างประวัติ'
          : 'Error clearing history'

      await this.replyText(replyToken, errorText)
    }
  }

  private async handleStatsCommand(
    replyToken: string,
    userId: string,
    language: string,
  ): Promise<void> {
    try {
      // ดึงสถิติพื้นฐาน
      const history =
        await this.conversationHistoryService.getRecentHistory(userId)
      const historyCount = history ? history.length : 0

      const statsText =
        language === 'th'
          ? `📊 สถิติการใช้งาน

💬 ข้อความในประวัติ: ${historyCount}
🤖 ระบบ: ทำงานปกติ
⚡ สถานะ: พร้อมใช้งาน

💡 เคล็ดลับ: ส่งรูปอาหารหรือถามคำถามเกี่ยวกับโภชนาการได้เลย!`
          : `📊 Usage Statistics

💬 Messages in history: ${historyCount}
🤖 System: Running normally
⚡ Status: Ready

💡 Tip: Send food photos or ask nutrition questions anytime!`

      await this.replyText(replyToken, statsText)
    } catch (error) {
      this.logger.error(`Error getting stats for user ${userId}:`, error)
      const errorText =
        language === 'th'
          ? 'เกิดข้อผิดพลาดในการดึงสถิติ'
          : 'Error retrieving statistics'

      await this.replyText(replyToken, errorText)
    }
  }

  private async handleUnknownCommand(
    replyToken: string,
    command: string,
    language: string,
  ): Promise<void> {
    const unknownText =
      language === 'th'
        ? `❓ ไม่รู้จักคำสั่ง "${command}"\n\nใช้ /help เพื่อดูคำสั่งที่ใช้ได้`
        : `❓ Unknown command "${command}"\n\nUse /help to see available commands`

    await this.replyText(replyToken, unknownText)
  }

  // ========== TEST METHODS FOR DEBUGGING ==========

  /**
   * Test method for autonomous eating pattern analysis
   */
  async testAutonomousEatingAnalysis(
    lineUserId: string,
    userProfile: UserProfileDto,
    language: string = 'th',
    timeConstraint: 'fast' | 'normal' | 'accurate' = 'normal',
  ) {
    try {
      this.logger.log(
        `🧪 Testing autonomous eating analysis for user: ${lineUserId}`,
      )

      const result = await this.aiService.analyzeEatingPatternWithAI(
        lineUserId,
        userProfile,
        null, // nutrition goal
        language,
        timeConstraint,
      )

      this.logger.log(`✅ Test completed for user: ${lineUserId}`)
      return result
    } catch (error) {
      this.logger.error(`❌ Test failed for user: ${lineUserId}`, error)
      throw error
    }
  }

  /**
   * Test method for food history retrieval
   */
  async testGetFoodHistory(
    lineUserId: string,
    userProfile: UserProfileDto,
    days: number = 30,
    limit: number = 100,
    language: string = 'th',
  ) {
    try {
      this.logger.log(
        `🧪 Testing food history retrieval for user: ${lineUserId}`,
      )

      const result = await this.aiService.getFoodHistoryForAI(
        lineUserId,
        userProfile,
        days,
        limit,
        language,
      )

      this.logger.log(`✅ Food history test completed for user: ${lineUserId}`)
      return result
    } catch (error) {
      this.logger.error(
        `❌ Food history test failed for user: ${lineUserId}`,
        error,
      )
      throw error
    }
  }

  // ========== QUICK REPLY HELPERS ==========
  private createMainMenuQuickReplyItems(language: string): QuickReplyItem[] {
    const t = (textKey: string) => {
      // Simple translator stub, replace with a more robust i18n solution if needed
      const translations: Record<string, Record<string, string>> = {
        th: {
          camera: 'ถ่ายรูปอาหาร',
          cameraRoll: 'เลือกรูป',
          foodHistory: '📊 วิเคราะห์การกิน',
          nutritionGoals: '🎯 เป้าหมายสุขภาพ',
          mealPlanning: '🍽️ วางแผนมื้ออาหาร',
        },
        en: {
          camera: 'Take Photo',
          cameraRoll: 'Choose from Album',
          foodHistory: '📊 Food Analysis',
          nutritionGoals: '🎯 Health Goals',
          mealPlanning: '🍽️ Meal Planning',
        },
      }
      return translations[language]?.[textKey] || translations['en'][textKey]
    }

    return [
      {
        type: 'action',
        action: {
          type: 'camera',
          label: t('camera'),
        },
      },
      {
        type: 'action',
        action: {
          type: 'cameraRoll',
          label: t('cameraRoll'),
        },
      },
      {
        type: 'action',
        action: {
          type: 'postback',
          label: t('foodHistory'),
          data: 'action=trigger_food_history_summary',
          displayText: t('foodHistory'),
        },
      },
      {
        type: 'action',
        action: {
          type: 'postback',
          label: t('nutritionGoals'),
          data: 'action=trigger_calculate_nutrition_goals',
          displayText: t('nutritionGoals'),
        },
      },
      {
        type: 'action',
        action: {
          type: 'postback',
          label: t('mealPlanning'),
          data: 'action=trigger_meal_planning',
          displayText: t('mealPlanning'),
        },
      },
    ]
  }

  // ========== NEW: Helper to send Main Menu Quick Reply if appropriate ==========
  private async sendMainMenuQuickReplyIfNeeded(
    userId: string,
    language: string,
    // TODO: Add a parameter or mechanism to check if a sub-flow QR is active
    // to prevent sending this QR when another specific QR is expected.
    // For now, it will send unless explicitly skipped by the calling logic.
  ): Promise<void> {
    // แทนที่จะส่งข้อความแยก เราจะแค่ log ไว้
    // Quick reply จะถูกเพิ่มโดย caller ที่เรียกใช้
    this.logger.log(
      `Main menu quick reply requested for user ${userId} (language: ${language}) - will be added by caller`,
    )

    // ไม่ส่งข้อความแยก เพื่อหลีกเลี่ยงความซ้ำซ้อน
    // Quick reply จะถูกเพิ่มใน replyText และ replyMessages โดยตรง
  }

  private formatEatingPatternResponse(
    result: EatingPatternToolResult,
    language: string,
  ): string {
    const isThaiLang = language === 'th'

    // Header
    let response = isThaiLang
      ? '📊 **รายงานการวิเคราะห์พฤติกรรมการกิน** 📊\n\n'
      : '📊 **Eating Pattern Analysis Report** 📊\n\n'

    // Calorie Analysis
    const trendText = isThaiLang
      ? result.calories_trend === 'improving'
        ? '📈 ดีขึ้น'
        : result.calories_trend === 'stable'
          ? '➡️ คงที่'
          : result.calories_trend === 'worsening'
            ? '📉 แย่ลง'
            : '❓ ข้อมูลไม่เพียงพอ'
      : result.calories_trend === 'improving'
        ? '📈 Improving'
        : result.calories_trend === 'stable'
          ? '➡️ Stable'
          : result.calories_trend === 'worsening'
            ? '📉 Worsening'
            : '❓ Insufficient Data'

    response += isThaiLang
      ? `🔥 **แคลอรี่เฉลี่ยต่อวัน:** ${result.average_daily_calories} แคลอรี่\n`
      : `🔥 **Average Daily Calories:** ${result.average_daily_calories} calories\n`

    response += isThaiLang
      ? `📊 **แนวโน้มแคลอรี่:** ${trendText}\n\n`
      : `📊 **Calorie Trend:** ${trendText}\n\n`

    // Meal Timing Analysis
    if (result.meal_timings && result.meal_timings.length > 0) {
      response += isThaiLang
        ? '⏰ **เวลาทานอาหาร:**\n'
        : '⏰ **Meal Timings:**\n'

      result.meal_timings.forEach((timing) => {
        const consistencyText = timing.consistency
          ? isThaiLang
            ? timing.consistency >= 0.8
              ? ' (สม่ำเสมอมาก)'
              : timing.consistency >= 0.6
                ? ' (สม่ำเสมอดี)'
                : timing.consistency >= 0.4
                  ? ' (สม่ำเสมอปานกลาง)'
                  : ' (ไม่สม่ำเสมอ)'
            : timing.consistency >= 0.8
              ? ' (Very Consistent)'
              : timing.consistency >= 0.6
                ? ' (Good Consistency)'
                : timing.consistency >= 0.4
                  ? ' (Moderate Consistency)'
                  : ' (Inconsistent)'
          : ''

        response += `   • ${timing.meal_name}: ${timing.average_time}${consistencyText}\n`
      })
      response += '\n'
    }

    // Nutrition Balance
    if (result.nutrient_balance) {
      response += isThaiLang
        ? '🥗 **สมดุลสารอาหาร (เทียบกับเป้าหมาย):**\n'
        : '🥗 **Nutrient Balance (vs Goals):**\n'

      if (result.nutrient_balance.protein_balance !== null) {
        response += isThaiLang
          ? `   • โปรตีน: ${result.nutrient_balance.protein_balance.toFixed(1)}%\n`
          : `   • Protein: ${result.nutrient_balance.protein_balance.toFixed(1)}%\n`
      }
      if (result.nutrient_balance.carbs_balance !== null) {
        response += isThaiLang
          ? `   • คาร์โบไฮเดรต: ${result.nutrient_balance.carbs_balance.toFixed(1)}%\n`
          : `   • Carbohydrates: ${result.nutrient_balance.carbs_balance.toFixed(1)}%\n`
      }
      if (result.nutrient_balance.fat_balance !== null) {
        response += isThaiLang
          ? `   • ไขมัน: ${result.nutrient_balance.fat_balance.toFixed(1)}%\n`
          : `   • Fat: ${result.nutrient_balance.fat_balance.toFixed(1)}%\n`
      }
      if (result.nutrient_balance.fiber_balance !== null) {
        response += isThaiLang
          ? `   • ใยอาหาร: ${result.nutrient_balance.fiber_balance.toFixed(1)}%\n`
          : `   • Fiber: ${result.nutrient_balance.fiber_balance.toFixed(1)}%\n`
      }
      response += '\n'
    }

    // Additional Insights
    if (result.eating_window_hours) {
      response += isThaiLang
        ? `⏱️ **ช่วงเวลาการกิน:** ${result.eating_window_hours} ชั่วโมง\n`
        : `⏱️ **Eating Window:** ${result.eating_window_hours} hours\n`
    }

    if (result.most_skipped_meal) {
      response += isThaiLang
        ? `⚠️ **มื้อที่ข้ามบ่อยที่สุด:** ${result.most_skipped_meal}\n`
        : `⚠️ **Most Skipped Meal:** ${result.most_skipped_meal}\n`
    }

    if (
      result.late_night_eating_frequency &&
      result.late_night_eating_frequency > 0
    ) {
      const percentage = (result.late_night_eating_frequency * 100).toFixed(1)
      response += isThaiLang
        ? `🌙 **การกินดึก:** ${percentage}% ของวัน\n`
        : `🌙 **Late Night Eating:** ${percentage}% of days\n`
    }

    response += '\n'

    // Identified Patterns
    if (result.identified_patterns && result.identified_patterns.length > 0) {
      response += isThaiLang
        ? '🔍 **รูปแบบที่พบ:**\n'
        : '🔍 **Identified Patterns:**\n'

      result.identified_patterns.forEach((pattern) => {
        response += `   • ${pattern}\n`
      })
      response += '\n'
    }

    // Problematic Behaviors
    if (
      result.problematic_behaviors &&
      result.problematic_behaviors.length > 0
    ) {
      response += isThaiLang
        ? '⚠️ **พฤติกรรมที่ควรปรับปรุง:**\n'
        : '⚠️ **Areas for Improvement:**\n'

      result.problematic_behaviors.forEach((behavior) => {
        response += `   • ${behavior}\n`
      })
      response += '\n'
    }

    // Improvement Suggestions
    if (
      result.improvement_suggestions &&
      result.improvement_suggestions.length > 0
    ) {
      response += isThaiLang
        ? '💡 **คำแนะนำการปรับปรุง:**\n'
        : '💡 **Improvement Suggestions:**\n'

      result.improvement_suggestions.forEach((suggestion) => {
        response += `   • ${suggestion}\n`
      })
      response += '\n'
    }

    // Personalized Advice
    if (result.personalized_advice) {
      response += isThaiLang
        ? '🎯 **คำแนะนำเฉพาะบุคคล:**\n'
        : '🎯 **Personalized Advice:**\n'
      response += `${result.personalized_advice}\n\n`
    }

    // Footer
    response += isThaiLang
      ? '📈 ขอให้คุณมีสุขภาพที่ดีและการกินที่สมดุลนะคะ! 🌟'
      : '📈 Wishing you good health and balanced eating! 🌟'

    return response
  }
}
