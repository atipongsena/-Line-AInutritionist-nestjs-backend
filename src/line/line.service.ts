import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
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
import { IntentDetectionService } from './intent-detection.service'
import { ConversationHistoryService } from '../conversation-history/conversation-history.service'
import { AI_CONFIG } from '../ai/ai.config' // Added import

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

  // Method to send typing indicator
  private async sendTypingIndicator(
    userId: string,
    durationSeconds = 20,
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
    // Send typing indicator
    await this.sendTypingIndicator(userId, 30)

    let userProfile: UserProfileDto | null = null
    let currentLanguage = 'th'

    try {
      userProfile = await this.userService.getOrCreateUserProfile({
        lineUserId: userId,
      })
      currentLanguage = userProfile.language || 'th'
    } catch (error) {
      this.logger.error(
        `Failed to get user profile for ${userId}:`,
        error instanceof Error ? error.stack : error,
      )
      await this.replyText(
        replyToken,
        currentLanguage === 'th'
          ? 'ขออภัยค่ะ เกิดข้อผิดพลาดในการดึงข้อมูลโปรไฟล์ของคุณ โปรดลองใหม่อีกครั้ง'
          : 'Sorry, there was an error retrieving your profile. Please try again.',
      )
      return
    }

    this.logger.log(
      `Received text from user ${userId}: "${text}", language: ${currentLanguage}`,
    )

    // ✅ ตรวจสอบว่าเป็นคำสั่งที่ขึ้นต้นด้วยสัญลักษณ์เฉพาะหรือไม่
    const trimmedText = text.trim()
    const { commandPrefixes } = AI_CONFIG.conversationControl.exclusionRules
    const isCommand = commandPrefixes.some((prefix) =>
      trimmedText.startsWith(prefix),
    )

    if (isCommand) {
      this.logger.log(
        `Processing command message from user ${userId}: "${trimmedText.substring(0, 50)}..." (starts with ${commandPrefixes.find((prefix) => trimmedText.startsWith(prefix))})`,
      )
      // จัดการคำสั่งเฉพาะแทนการส่งไป AI
      await this.handleCommand(
        replyToken,
        trimmedText,
        userId,
        userProfile,
        currentLanguage,
      )
      return
    }

    // Special handling for URLs (existing logic)
    const urlRegex = /(https?:\/\/[^\s]+)/g
    const urls = text.match(urlRegex)

    if (urls && urls.length > 0) {
      this.logger.log(`Found URLs in message: ${urls.join(', ')}`)
      // Try to analyze as food image URL
      const analysisResult = await this.aiService.analyzeFoodOrMeal(
        userId,
        text,
        userProfile,
        currentLanguage,
        'normal',
        urls[0], // Use first URL as image
        messageId,
      )

      if (
        analysisResult &&
        'food_name' in analysisResult &&
        analysisResult.food_name !== 'NON_FOOD_IMAGE_DETECTED'
      ) {
        const flexData: FlexFoodAnalysisData = {
          ...analysisResult,
          lineUserId: userId,
          messageId: messageId,
        }
        const flexMessage = createFoodAnalysisFlexMessage(
          flexData,
          currentLanguage,
        )
        await this.replyMessages(replyToken, [flexMessage])
      } else {
        this.logger.warn(
          `Unexpected result from analyzeFoodOrMeal (URL) for user ${userId}: ${JSON.stringify(analysisResult)}`,
        )
        await this.replyText(
          replyToken,
          currentLanguage === 'th'
            ? 'ขออภัยค่ะ ไม่สามารถดำเนินการวิเคราะห์อาหารจาก URL ได้ในขณะนี้'
            : "Sorry, I couldn't process the food analysis from the URL at this time.",
        )
      }
      return
    }

    // ✅ ตรวจสอบว่า user อยู่ในโหมด reanalyze หรือไม่
    const reanalyzeContextKey = `reanalyze_context:${userId}`
    const reanalyzeContext = this.analysisCacheService.get<{
      originalMessageId: string
      originalAnalysisData: FoodAnalysisToolResult
      originalImageUrl?: string
      timestamp: number
    }>(reanalyzeContextKey)

    if (reanalyzeContext) {
      this.logger.log(
        `User ${userId} is in reanalyze mode. Processing reanalysis with additional details: "${text}"`,
      )

      // ลบ context เพื่อป้องกันการใช้งานซ้ำ
      this.analysisCacheService.delete(reanalyzeContextKey)

      try {
        // วิเคราะห์ใหม่พร้อมรายละเอียดเพิ่มเติม
        const reanalysisResult = await this.aiService.analyzeFoodOrMeal(
          userId,
          `วิเคราะห์อาหารใหม่: ${reanalyzeContext.originalAnalysisData.food_name}. รายละเอียดเพิ่มเติม: ${text}`, // รวมชื่ออาหารเดิมกับรายละเอียดใหม่
          userProfile,
          currentLanguage,
          'normal',
          reanalyzeContext.originalImageUrl, // ใช้ภาพเดิม
          reanalyzeContext.originalMessageId, // ใช้ messageId เดิม เพื่อ cache ทับ
        )

        if (
          reanalysisResult &&
          'food_name' in reanalysisResult &&
          reanalysisResult.food_name !== 'NON_FOOD_IMAGE_DETECTED'
        ) {
          this.logger.log(
            `Reanalysis successful for user ${userId}: ${reanalysisResult.food_name}`,
          )

          const flexData: FlexFoodAnalysisData = {
            ...reanalysisResult,
            lineUserId: userId,
            messageId: reanalyzeContext.originalMessageId, // ใช้ messageId เดิม
            imageUrl: reanalyzeContext.originalImageUrl, // ใช้ภาพเดิม
          }
          const flexMessage = createFoodAnalysisFlexMessage(
            flexData,
            currentLanguage,
          )
          await this.replyMessages(replyToken, [flexMessage])
          return
        } else {
          this.logger.warn(
            `Reanalysis failed for user ${userId}:`,
            reanalysisResult,
          )
          await this.replyText(
            replyToken,
            currentLanguage === 'th'
              ? 'ขออภัยค่ะ ไม่สามารถวิเคราะห์ใหม่ได้ โปรดลองอีกครั้ง หรือเริ่มการวิเคราะห์ใหม่'
              : 'Sorry, I could not reanalyze the food. Please try again or start a new analysis.',
          )
          return
        }
      } catch (reanalysisError) {
        this.logger.error(
          `Error during reanalysis for user ${userId}:`,
          reanalysisError,
        )
        await this.replyText(
          replyToken,
          currentLanguage === 'th'
            ? 'ขออภัยค่ะ เกิดข้อผิดพลาดในการวิเคราะห์ใหม่ โปรดลองอีกครั้ง'
            : 'Sorry, an error occurred during reanalysis. Please try again.',
        )
        return
      }
    }

    // **NEW: Use AI-based Intent Detection**
    try {
      // ✅ ไม่ส่ง conversation history ไปกับ intent detection เพื่อลด token และ latency
      const intentResult = await this.intentDetectionService.detectIntent(
        text,
        userProfile,
        currentLanguage,
      )

      this.logger.log(
        `Intent detected for user ${userId}: ${intentResult.intent} (confidence: ${intentResult.confidence})`,
      )

      // Handle based on detected intent
      switch (intentResult.intent) {
        case 'food_analysis':
          // Lower threshold for food analysis - many valid queries have medium confidence
          if (intentResult.confidence > 0.4) {
            // Food analysis request - try to analyze
            this.logger.log(
              `Processing food analysis request for user ${userId} with confidence ${intentResult.confidence}`,
            )

            const analysisResult = await this.aiService.analyzeFoodOrMeal(
              userId,
              text,
              userProfile,
              currentLanguage,
              'normal',
              undefined, // no image
              messageId,
            )

            if (
              analysisResult &&
              'food_name' in analysisResult &&
              analysisResult.food_name !== 'NON_FOOD_IMAGE_DETECTED'
            ) {
              // Success - send Flex Message
              this.logger.log(
                `Food analysis successful for user ${userId}: ${analysisResult.food_name}`,
              )

              const flexData: FlexFoodAnalysisData = {
                ...analysisResult,
                lineUserId: userId,
                messageId: messageId,
              }
              const flexMessage = createFoodAnalysisFlexMessage(
                flexData,
                currentLanguage,
              )
              await this.replyMessages(replyToken, [flexMessage])
              return
            } else {
              // Food analysis failed - still try to give nutrition info
              this.logger.log(
                `Food analysis failed for user ${userId}, but still treating as food-related query`,
              )
            }
          } else {
            // Very low confidence - log and fallback
            this.logger.log(
              `Very low confidence (${intentResult.confidence}) for food analysis, falling back to general nutrition`,
            )
          }
          // If confidence is low or analysis failed, fallback to general Q&A but mention it's food-related
          break

        case 'eating_pattern_analysis':
          // Handle eating pattern analysis with manual workflow
          this.logger.log(
            `Processing eating pattern analysis request for user ${userId} with confidence ${intentResult.confidence}`,
          )

          try {
            const eatingPatternResult =
              await this.aiService.analyzeEatingPatternWithAI(
                userId,
                userProfile,
                null, // No nutrition goal for now
                currentLanguage,
                'normal',
              )

            if (
              eatingPatternResult &&
              typeof eatingPatternResult === 'object' &&
              'calories_trend' in eatingPatternResult
            ) {
              // Success - format and send the analysis result
              this.logger.log(
                `Eating pattern analysis successful for user ${userId}: ${eatingPatternResult.calories_trend}`,
              )

              const responseText =
                currentLanguage === 'th'
                  ? `🔍 การวิเคราะห์รูปแบบการกินของคุณ

📈 แนวโน้มแคลอรี่:\n${eatingPatternResult.calories_trend === 'improving' ? 'ดีขึ้น' : eatingPatternResult.calories_trend === 'stable' ? 'คงที่' : eatingPatternResult.calories_trend === 'worsening' ? 'แย่ลง' : 'ข้อมูลไม่เพียงพอ'}

📊 แคลอรี่เฉลี่ยต่อวัน:\n${eatingPatternResult.average_daily_calories || 'ไม่สามารถคำนวณได้'} กิโลแคลอรี่

🍽️ จำนวนบันทึกอาหาร:\n${eatingPatternResult.basic_analysis_details?.total_logs || 0} รายการ ใน ${eatingPatternResult.basic_analysis_details?.days_analyzed || 0} วัน

🔍 รูปแบบที่พบ:\n${eatingPatternResult.identified_patterns && eatingPatternResult.identified_patterns.length > 0 ? eatingPatternResult.identified_patterns.join(', ') : 'ยังไม่พบรูปแบบเฉพาะ'}

💡 คำแนะนำ:\n${eatingPatternResult.personalized_advice || 'กรุณาบันทึกอาหารให้สม่ำเสมอเพื่อการวิเคราะห์ที่แม่นยำ'}

${
  eatingPatternResult.improvement_suggestions &&
  eatingPatternResult.improvement_suggestions.length > 0
    ? `📝 ข้อเสนอแนะการปรับปรุง:\n${eatingPatternResult.improvement_suggestions.map((s) => `• ${s}`).join('\n')}`
    : ''
}`
                  : `🔍 Your Eating Pattern Analysis

📈 Calorie Trend:\n${eatingPatternResult.calories_trend}

📊 Average Daily Calories:\n${eatingPatternResult.average_daily_calories || 'Cannot calculate'} kcal

🍽️ Food Log Count:\n${eatingPatternResult.basic_analysis_details?.total_logs || 0} entries in ${eatingPatternResult.basic_analysis_details?.days_analyzed || 0} days

🔍 Patterns Found:\n${eatingPatternResult.identified_patterns && eatingPatternResult.identified_patterns.length > 0 ? eatingPatternResult.identified_patterns.join(', ') : 'No specific patterns found'}

💡 Advice: ${eatingPatternResult.personalized_advice || 'Please log your food consistently for more accurate analysis'}

${
  eatingPatternResult.improvement_suggestions &&
  eatingPatternResult.improvement_suggestions.length > 0
    ? `📝 Improvement Suggestions:\n${eatingPatternResult.improvement_suggestions.map((s) => `• ${s}`).join('\n')}`
    : ''
}`

              await this.replyText(
                replyToken,
                responseText,
                'eating_pattern_analysis',
              )
              return
            } else if (
              eatingPatternResult &&
              typeof eatingPatternResult === 'object' &&
              'error' in eatingPatternResult
            ) {
              // Error from eating pattern analysis
              this.logger.error(
                `Eating pattern analysis error for user ${userId}: ${eatingPatternResult.error}`,
              )
              await this.replyText(
                replyToken,
                currentLanguage === 'th'
                  ? 'ขออภัยค่ะ เกิดข้อผิดพลาดในการวิเคราะห์รูปแบบการกิน โปรดลองใหม่อีกครั้ง'
                  : 'Sorry, there was an error analyzing your eating pattern. Please try again.',
              )
              return
            } else {
              // Unexpected result
              this.logger.warn(
                `Unexpected eating pattern analysis result for user ${userId}:`,
                eatingPatternResult,
              )
            }
          } catch (eatingPatternError) {
            this.logger.error(
              `Error in eating pattern analysis for user ${userId}:`,
              eatingPatternError,
            )
            await this.replyText(
              replyToken,
              currentLanguage === 'th'
                ? 'ขออภัยค่ะ เกิดข้อผิดพลาดในการวิเคราะห์รูปแบบการกิน โปรดลองใหม่อีกครั้ง'
                : 'Sorry, there was an error analyzing your eating pattern. Please try again.',
            )
            return
          }
          break

        case 'general_nutrition':
        default: {
          // Handle as general nutrition question (includes greetings, off-topic, and nutrition questions)
          break
        }
      }

      // Default: General nutrition question handling (includes all non-food-analysis queries)
      this.logger.log(
        `Treating as general nutrition question for user ${userId}: "${text}"`,
      )
      const answer = await this.aiService.answerGeneralNutritionQuestion(
        userId,
        text,
        userProfile,
        currentLanguage,
      )
      await this.replyText(
        replyToken,
        answer ||
          (currentLanguage === 'th'
            ? 'ขออภัยค่ะ ฉันไม่สามารถตอบคำถามนี้ได้ในขณะนี้'
            : "Sorry, I couldn't answer that question right now."),
        'general_nutrition', // เพิ่ม context เพื่อไม่ให้ตัดข้อความ
      )
    } catch (intentError) {
      this.logger.error(
        `Intent detection failed for user ${userId}, using fallback:`,
        intentError,
      )

      // Fallback to general nutrition Q&A if intent detection fails
      try {
        const answer = await this.aiService.answerGeneralNutritionQuestion(
          userId,
          text,
          userProfile,
          currentLanguage,
        )
        await this.replyText(
          replyToken,
          answer ||
            (currentLanguage === 'th'
              ? 'ขออภัยค่ะ ฉันไม่สามารถตอบคำถามนี้ได้ในขณะนี้'
              : "Sorry, I couldn't answer that question right now."),
          'general_nutrition', // เพิ่ม context เพื่อไม่ให้ตัดข้อความ
        )
      } catch (error) {
        this.logger.error(
          `Error answering general nutrition question for user ${userId}:`,
          error,
        )
        await this.replyText(
          replyToken,
          currentLanguage === 'th'
            ? 'ขออภัยค่ะ เกิดข้อผิดพลาดในการพยายามตอบคำถามของคุณ โปรดลองถามใหม่หรือถามอย่างอื่นนะคะ'
            : 'Sorry, I encountered an error trying to answer your question. Please try rephrasing or ask something else.',
        )
      }
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
          ? 'ขออภัยค่ะ มีปัญหาในการเข้าถึงข้อมูลโปรไฟล์ของคุณ โปรดลองอีกครั้งในภายหลัง'
          : 'Sorry, there was an issue accessing your profile. Please try again later.',
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
            await this.replyMessages(replyToken, [flexMessage])
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
        )
      }
    } catch (error) {
      this.logger.error(
        `Error handling image message for messageId ${messageId}:`,
        error instanceof Error ? error.stack : undefined,
      )
      await this.pushText(
        userId,
        'Sorry, there was an error processing your image. Please try again.',
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
      await this.replyMessages(replyToken, [welcomeMessage])
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
    const userProfile = await this.userService.getOrCreateUserProfile({
      lineUserId: userId,
    })
    const currentLanguage = userProfile.language || 'th'

    const queryParams = new URLSearchParams(data)
    const action = queryParams.get('action')
    const messageIdFromPostback = queryParams.get('messageId') || undefined
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
          action === 'reanalyze_food') // ✅ เปลี่ยนจาก edit_food_analysis เป็น reanalyze_food
      ) {
        this.logger.warn(
          `Postback action '${action}' called without a messageId. Cannot retrieve cached data.`,
        )
        await this.replyText(
          replyToken,
          currentLanguage === 'th'
            ? 'ขออภัยค่ะ ข้อมูลการวิเคราะห์เดิมไม่สมบูรณ์ โปรดลองวิเคราะห์ใหม่อีกครั้ง'
            : 'Sorry, the original analysis data is incomplete. Please try analyzing again.',
        )
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
          // It's possible for cache to expire, or messageId to be invalid.
        }
      }

      if (action === 'analyze_again') {
        this.logger.log(
          `Postback: Handling 'analyze_again' for user ${userProfile.lineUserId}. MessageId: ${messageIdFromPostback}`,
        )

        if (!cachedData) {
          await this.replyText(
            replyToken,
            currentLanguage === 'th'
              ? 'ขออภัย ไม่พบข้อมูลเดิมที่จะวิเคราะห์อีกครั้ง โปรดลองเริ่มใหม่'
              : 'Sorry, the original data to analyze again was not found. Please try starting over.',
          )
          return
        }

        // Determine original analysis type (image or text) from cachedData or how it was initiated
        const originalImageUrl = cachedData.imageUrl
        const originalTextQuery = cachedData.food_name // Or a more specific field if available from initial analysis

        const analysisResult = await this.aiService.analyzeFoodOrMeal(
          userProfile.lineUserId,
          originalTextQuery, // Text prompt for AI, could be generic like "Analyze this food" if it was an image
          userProfile,
          currentLanguage,
          undefined, // mode - let AI decide or use cached mode if available
          originalImageUrl, // imageUrl - pass if it was an image analysis
          messageIdFromPostback, // original messageId for context (now string | undefined)
        )

        if (analysisResult && 'food_name' in analysisResult) {
          // Assuming analysisResult is already FoodAnalysisToolResult due to the 'food_name' in analysisResult check
          const foodAnalysisResult = analysisResult

          const flexMessageData: FlexFoodAnalysisData = {
            // Explicitly type flexMessageData
            ...foodAnalysisResult, // Spread analysisResult, ensure its type is compatible with parts of FlexFoodAnalysisData
            lineUserId: userProfile.lineUserId,
            messageId: messageIdFromPostback || new Date().getTime().toString(),
            imageUrl: originalImageUrl,
          }

          const flexMessage = createFoodAnalysisFlexMessage(
            flexMessageData,
            currentLanguage,
          )
          await this.replyMessages(replyToken, [flexMessage])
        } else {
          await this.replyText(
            replyToken,
            currentLanguage === 'th'
              ? 'ขออภัย ไม่สามารถวิเคราะห์ผลลัพธ์ได้ในขณะนี้'
              : `Sorry, I couldn't process the analysis result at this time.`,
          )
        }
      } else if (action === 'view_vitamins_minerals') {
        this.logger.log(
          `Postback: Handling 'view_vitamins_minerals' for user ${userProfile.lineUserId}, messageId: ${messageIdFromPostback}`,
        )
        if (cachedData) {
          const { vitamins, minerals } =
            this.extractVitaminsAndMinerals(cachedData)

          const flexMessage = createVitaminMineralDetailsFlexMessage(
            cachedData.food_name,
            vitamins, // This is Record<string, AiVitaminMineralDetail>
            minerals, // This is Record<string, AiVitaminMineralDetail>
            currentLanguage,
            // messageIdFromPostback // Removed: createVitaminMineralDetailsFlexMessage doesn't take this according to its definition in flex.messages.ts
          )
          await this.replyMessages(replyToken, [flexMessage])
        } else {
          this.logger.warn(
            `Cache miss for messageId ${messageIdFromPostback} for view_vitamins_minerals action. Attempting to fetch from database.`,
          )
          // Attempt to fetch from FoodLog using lineUserId and sourceMessageId
          const foodLogEntry = await this.foodLogModel
            .findOne({
              lineUserId: userId,
              sourceMessageId: messageIdFromPostback,
            })
            .sort({ createdAt: -1 }) // Get the most recent one if multiple exist (though unlikely for same sourceMessageId)

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

            // Convert Map<string, VitaminMineralDetailSchemaDocument> to Record<string, AiVitaminMineralDetail>
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
            // const mineralKeys = [ // Not strictly needed for separation logic here, but good for reference
            //   'calcium', 'iron', 'magnesium', 'potassium', 'zinc', 'phosphorus', 'selenium'
            // ];

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

            this.logger.debug(
              `Vitamins from DB for ${foodNameFromDb}: ${Object.keys(vitaminsFromDb).join(', ')}`,
            )
            this.logger.debug(
              `Minerals from DB for ${foodNameFromDb}: ${Object.keys(mineralsFromDb).join(', ')}`,
            )

            const flexMessage = createVitaminMineralDetailsFlexMessage(
              foodNameFromDb,
              vitaminsFromDb,
              mineralsFromDb,
              currentLanguage,
            )
            await this.replyMessages(replyToken, [flexMessage])
          } else {
            this.logger.warn(
              `Food log entry not found for user ${userId} and sourceMessageId ${messageIdFromPostback} after cache miss.`,
            )
            const notFoundText =
              currentLanguage === 'th'
                ? 'ขออภัย ไม่พบข้อมูลการวิเคราะห์เดิมหรือที่บันทึกไว้ โปรดลองวิเคราะห์ใหม่อีกครั้ง'
                : 'Sorry, the original or saved analysis data was not found. Please try analyzing again.'
            await this.replyText(replyToken, notFoundText)
          }
        }
      } else if (action === 'save_food_analysis') {
        this.logger.log(
          `Postback: Handling 'save_food_analysis' (initiate save) for user ${userProfile.lineUserId}, messageId: ${messageIdFromPostback}`,
        )

        if (!messageIdFromPostback) {
          // This should be caught by the initial check, but as a safeguard:
          this.logger.error('save_food_analysis called without messageId.')
          await this.replyText(
            replyToken,
            currentLanguage === 'th'
              ? 'เกิดข้อผิดพลาด: ไม่พบข้อมูลการวิเคราะห์เดิม'
              : 'Error: Original analysis data not found.',
          )
          return
        }

        // Check if cachedData exists, though we might not need it here, just the messageId for the next step.
        if (!cachedData) {
          this.logger.warn(
            `Cache miss for messageId ${messageIdFromPostback} when initiating save_food_analysis. This might be okay if only messageId is forwarded.`,
          )
          // Optionally, reply if data is absolutely necessary for context before showing meal types
          // For now, we assume messageId is enough to carry forward.
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
          {
            label: currentLanguage === 'th' ? '🍽️ อื่นๆ' : '🍽️ Other',
            type: 'other',
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
            quickReply: {
              items: quickReplyItems,
            },
          },
        ])
      } else if (action === 'confirm_save_meal') {
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
          )
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
          )
          return
        }

        try {
          const userDoc = await this.userService.getUserDocumentByLineId(
            userId,
            // true, // createIfNotExist - Removed second argument based on linter error
          )
          if (!userDoc) {
            this.logger.error(
              `User not found for lineUserId: ${userId} during confirm_save_meal. Cannot save food log.`,
            )
            await this.replyText(
              replyToken,
              currentLanguage === 'th'
                ? 'ขออภัยค่ะ ไม่พบข้อมูลผู้ใช้ของคุณในระบบ ไม่สามารถบันทึกข้อมูลได้'
                : 'Sorry, your user profile was not found. Unable to save food log.',
            )
            return
          }

          // Attempt to parse amount and unit from portion
          let foodAmount = 1
          let foodUnit = 'หน่วย' // Changed default unit
          if (cachedData.portion) {
            // Regex to capture:
            // 1. Optional leading text (e.g., "ประมาณ ")
            // 2. The amount (digits, possibly with a decimal)
            // 3. The unit (common food units, trying to be more specific)
            // 4. Optional trailing text (e.g., " (ประมาณ 300 กรัม)")
            const portionRegex =
              /^(?:ประมาณ\s*)?([\d.]+)\s*(กล่อง|จาน|ชาม|ชิ้น|ถ้วย|กรัม|กก\.|กิโลกรัม|มล\.|ลิตร|หน่วย|portion|serving|piece|g|kg|ml|l)(?:\s*\(.*\))?/i
            const portionParts = cachedData.portion.match(portionRegex)

            if (portionParts && portionParts.length >= 3) {
              // portionParts[0] is full match, [1] is amount, [2] is unit
              foodAmount = parseFloat(portionParts[1]) || 1
              foodUnit = portionParts[2] || 'หน่วย'
            } else {
              // Fallback for simpler cases or if the above regex fails
              const simplerParts = cachedData.portion.match(/([\d.]+)\s*(\S+)/)
              if (simplerParts && simplerParts.length === 3) {
                foodAmount = parseFloat(simplerParts[1]) || 1
                foodUnit = simplerParts[2] || 'หน่วย'
              }
              this.logger.warn(
                `[confirm_save_meal] Could not parse unit precisely from portion: "${cachedData.portion}". Using amount: ${foodAmount}, unit: ${foodUnit}`,
              )
            }
          }

          // Log cachedData for debugging image issue
          this.logger.log(
            `[confirm_save_meal] Cached data for messageId ${messageIdFromPostback}: Food Name - "${cachedData.food_name}", Image URL - "${cachedData.imageUrl}"`,
          )

          // Define azureBaseUrl before its use
          const azureBaseUrl = this.configService.get<string>(
            'AZURE_STORAGE_CONTAINER_URL',
          )

          const foodLog = new this.foodLogModel({
            userId: userDoc._id,
            lineUserId: userId,
            sourceMessageId: messageIdFromPostback, // Save the original messageId
            logDate: new Date(postbackDate || Date.now()),
            mealType: mealTypeFromPostback,
            food: {
              foodName: {
                th: cachedData.food_name, // Use food_name for th
                en: cachedData.food_name, // Fallback to food_name for en for now
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
                cholesterol: cachedData.cholesterol, // Added
                saturated_fat: cachedData.saturated_fat, // Added
                water: cachedData.water, // Added
                omega3: cachedData.omega3, // Add if schema supports
              },
              micronutrients: this.extractMicronutrients(cachedData), // Ensure this returns a Map compatible with the schema
            },
            tags: cachedData.tags || [], // Added tags from cachedData
            imageUrl: cachedData.imageUrl,
            image: cachedData.imageUrl
              ? {
                  url: cachedData.imageUrl,
                  blobName:
                    azureBaseUrl && cachedData.imageUrl.startsWith(azureBaseUrl)
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
                      : cachedData.imageUrl.includes('/') // Basic check if it's a URL
                        ? cachedData.imageUrl
                            .substring(cachedData.imageUrl.lastIndexOf('/') + 1)
                            .split('?')[0]
                        : undefined,
                  alt: cachedData.food_name, // Use food_name for alt text
                  uploadDate: new Date(),
                  isPermanent: true, // Mark as permanent as it's part of a saved log
                  retentionDays: 30, // Set retention for 30 days for saved logs
                }
              : undefined,
            aiAnalyzed: true,
            confidenceScore: cachedData.confidence_score,
          })

          const savedFoodLog: FoodLogDocument = await foodLog.save()
          this.logger.log(
            `Food log saved successfully for user ${userId}, meal type ${mealTypeFromPostback}, food log ID: ${String(savedFoodLog._id)}`,
          )

          // Clear temporary image log ONLY if the original input was an image that we temporarily stored
          // The current cachedData.imageUrl might be the AI's analysis image or the original uploaded one.
          // Need a more robust way to know if cachedData.imageUrl refers to a temp blob we own.
          if (
            messageIdFromPostback &&
            cachedData.imageUrl &&
            azureBaseUrl &&
            cachedData.imageUrl.startsWith(azureBaseUrl)
          ) {
            // This check is a heuristic. A better way is to pass a specific tempBlobName in cachedData if applicable.
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
          // Use savedFoodLog.logDate for the LIFF URL date parameter
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
                  {
                    type: 'spacer',
                    size: 'sm',
                  },
                ],
                flex: 0,
              },
            },
          }
          await this.replyMessages(replyToken, replyFlexMessage)
        } catch (error) {
          this.logger.error(
            `Error saving food log for user ${userId}:`,
            error instanceof Error ? error.stack : error, // Log stack if available
          )
          await this.replyText(
            replyToken,
            currentLanguage === 'th'
              ? 'ขออภัยค่ะ เกิดข้อผิดพลาดในการบันทึกข้อมูลมื้ออาหาร'
              : 'Sorry, an error occurred while saving your meal.',
          )
        }
      } else if (action === 'reanalyze_food') {
        // ✅ ใหม่: ถาม user ให้ระบุรายละเอียดเพิ่มเติมสำหรับการวิเคราะห์ใหม่
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
          )
          return
        }

        // ✅ เก็บ context สำหรับการวิเคราะห์ใหม่
        const reanalyzeContextKey = `reanalyze_context:${userId}`
        const contextToCache = {
          originalMessageId: messageIdFromPostback,
          originalAnalysisData: cachedData,
          originalImageUrl: cachedData.imageUrl, // เก็บ imageUrl เดิม
          timestamp: new Date().getTime(),
        }
        this.analysisCacheService.set(
          reanalyzeContextKey,
          contextToCache,
          600 * 1000, // Cache for 10 minutes (in milliseconds)
        )
        this.logger.log(
          `Cached reanalyze context for user ${userId}, messageId ${messageIdFromPostback}, imageUrl: ${cachedData.imageUrl ? 'present' : 'none'}`,
        )

        // ✅ ถาม user ให้ระบุรายละเอียดเพิ่มเติม พร้อม Quick Reply สำหรับยกเลิก
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
                ? `กรุณาบอกรายละเอียดเพิ่มเติมเกี่ยวกับ "${cachedData.food_name}" ที่ต้องการให้วิเคราะห์ใหม่ค่ะ

📝 ตัวอย่างรายละเอียดที่ช่วยได้:
• ชื่ออาหารที่ถูกต้อง
• ส่วนประกอบที่แน่ใจ  
• ปริมาณที่แท้จริง
• สิ่งที่ผิดจากการวิเคราะห์เดิม

💬 พิมพ์รายละเอียดในข้อความเดียว หรือกดยกเลิกถ้าเปลี่ยนใจ`
                : `Please provide additional details about "${cachedData.food_name}" for reanalysis.

📝 Helpful details examples:
• Correct food name
• Known ingredients
• Actual portion size  
• What was wrong in previous analysis

💬 Type details in one message or cancel if you changed your mind`,
            quickReply: {
              items: [cancelQuickReply],
            },
          },
        ])
      } else if (action === 'cancel_reanalyze') {
        // ✅ ใหม่: ยกเลิกการวิเคราะห์ใหม่
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
          // ลบ context การวิเคราะห์ใหม่
          this.analysisCacheService.delete(reanalyzeContextKey)
          this.logger.log(`Cancelled reanalyze context for user ${userId}`)

          await this.replyText(
            replyToken,
            currentLanguage === 'th'
              ? '✅ ยกเลิกการวิเคราะห์ใหม่เรียบร้อยแล้ว คุณสามารถถามคำถามหรือส่งรูปอาหารใหม่ได้เลยค่ะ'
              : '✅ Reanalysis cancelled successfully. You can now ask questions or send new food images.',
          )
        } else {
          this.logger.warn(
            `Cancel reanalyze called but no context found for user ${userId}`,
          )
          await this.replyText(
            replyToken,
            currentLanguage === 'th'
              ? 'ไม่พบสถานะการวิเคราะห์ใหม่ที่จะยกเลิก คุณสามารถใช้งานปกติได้เลยค่ะ'
              : 'No reanalysis status found to cancel. You can continue using normally.',
          )
        }
      } else if (action === 'request_delete_food_log') {
        // Placeholder from original, might need different handling
        this.logger.log(
          `Postback: Handling 'request_delete_food_log' for user ${userProfile.lineUserId}`,
        )
        // This would likely involve getting a foodLogId from the postback data
        // and then possibly confirming deletion with the user or directly deleting.
        // Example: const foodLogIdToDelete = queryParams.get('foodLogId');
        await this.replyText(
          replyToken,
          'Delete functionality for saved logs is under development.',
        )
      } else {
        this.logger.log(
          `Received unhandled postback action: ${action} for user ${userProfile.lineUserId}`,
        )
        await this.replyText(
          replyToken,
          `ขออภัย การดำเนินการ '${action}' ยังไม่รองรับในขณะนี้`,
        )
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
  ): Promise<MessageAPIResponseBase> {
    if (text.length === 0) {
      this.logger.warn('Attempted to reply with an empty text message.')
      return Promise.resolve({} as MessageAPIResponseBase)
    }
    try {
      return await this.lineClient.replyMessage(replyToken, {
        type: 'text',
        text: this.smartTruncateText(text, context), // ใช้ smartTruncateText แทน substring
      } as TextMessage)
    } catch (error: unknown) {
      if (error instanceof HTTPError) {
        this.logger.error(
          `LINE HTTP Error during reply: ${error.statusCode} ${error.message}`,
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
            'LINE HTTP Original Error details for replyText:',
            detailsToLog,
          )
        }
      } else if (error instanceof Error) {
        this.logger.error(`Error replying text: ${error.message}`, error.stack)
      } else {
        this.logger.error('Unknown error occurred during replyText', error)
      }
      return Promise.resolve({} as MessageAPIResponseBase)
    }
  }

  async replyMessages(
    replyToken: string,
    messages: Message | Message[],
  ): Promise<MessageAPIResponseBase> {
    if (!messages || (Array.isArray(messages) && messages.length === 0)) {
      this.logger.warn(
        'Attempted to reply with an empty message or message array.',
      )
      return Promise.resolve({} as MessageAPIResponseBase) // Or throw error
    }
    try {
      return await this.lineClient.replyMessage(replyToken, messages)
    } catch (error: unknown) {
      // Consolidate error logging from replyText
      if (error instanceof HTTPError) {
        this.logger.error(
          `LINE HTTP Error during reply via replyMessages: ${error.statusCode} ${error.message}`,
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
            'LINE HTTP Original Error details for replyMessages:',
            detailsToLog,
          )
        }
      } else if (error instanceof Error) {
        this.logger.error(
          `Error replying messages: ${error.message}`,
          error.stack,
        )
      } else {
        this.logger.error('Unknown error occurred during replyMessages', error)
      }
      // Depending on policy, could throw, or return a specific error object, or resolve empty.
      // For now, resolving empty to avoid unhandled promise rejections if caller doesn't catch.
      return Promise.resolve({} as MessageAPIResponseBase)
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
        case '/help':
        case '/start':
          await this.handleHelpCommand(replyToken, language)
          break

        case '/setlang':
        case '/language':
          await this.handleLanguageCommand(replyToken, userId, args, language)
          break

        case '/profile':
        case '/me':
          await this.handleProfileCommand(replyToken, userProfile, language)
          break

        case '/menu':
          await this.handleMenuCommand(replyToken, language)
          break

        case '/clear':
        case '/reset':
          await this.handleClearCommand(replyToken, userId, language)
          break

        case '/stats':
        case '/status':
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

  private async handleMenuCommand(
    replyToken: string,
    language: string,
  ): Promise<void> {
    const menuText =
      language === 'th'
        ? `📋 เมนูหลัก

🍽️ การวิเคราะห์อาหาร:
• ส่งรูปอาหาร
• พิมพ์ชื่ออาหาร

📊 การวิเคราะห์:
• "วิเคราะห์รูปแบบการกิน"
• "คำนวณเป้าหมายโภชนาการ"
• "แนะนำอาหาร"

❓ การถามคำถาม:
• ถามเกี่ยวกับโภชนาการ
• ถามประวัติการกิน
• ขอคำแนะนำสุขภาพ`
        : `📋 Main Menu

🍽️ Food Analysis:
• Send food photos
• Type food names

📊 Analysis:
• "Analyze eating patterns"
• "Calculate nutrition goals"
• "Recommend meals"

❓ Questions:
• Ask about nutrition
• Ask food history
• Request health advice`

    await this.replyText(replyToken, menuText)
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
}
