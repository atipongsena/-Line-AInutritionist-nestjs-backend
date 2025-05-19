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
} from '@line/bot-sdk'
import { ImageService } from '../image/image.service'
import { AiService } from '../ai/ai.service'
import { UserProfileDto } from '../user/user.interface'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { FoodAnalysisToolResult } from '../ai/ai.service' // Import as type only
import {
  createFoodAnalysisFlexMessage,
  FoodAnalysisData,
  VitaminMineralDetail,
  createVitaminMineralDetailsFlexMessage,
} from './flex.messages'
import { UserService } from '../user/user.service'
import { AnalysisCacheService } from '../analysis-cache/analysis-cache.service'

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
    messageId: string,
  ): Promise<void> {
    this.logger.log(
      `Received text message: "${text}" from user: ${userId}, messageId: ${messageId}`,
    )
    let userProfile: UserProfileDto | null = null
    try {
      userProfile = await this.userService.getOrCreateUserProfile({
        lineUserId: userId,
      })
    } catch (error) {
      this.logger.error(
        `Failed to get/create user profile for ${userId} in handleTextMessage:`,
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
        `User profile is null for ${userId} even after getOrCreateUserProfile in handleTextMessage.`,
      )
      await this.replyText(
        replyToken,
        'Sorry, I could not retrieve your profile information.',
      )
      return
    }

    const currentLanguage = userProfile.language || 'th'

    if (text.toLowerCase() === '/help') {
      const helpMessage: TextMessage = {
        type: 'text',
        text:
          currentLanguage === 'th'
            ? `ความช่วยเหลือ AI Nutritionist Bot:\n- ส่งรูปภาพอาหารของคุณเพื่อวิเคราะห์\n- ถามคำถามโภชนาการทั่วไป (เช่น "อกไก่มีโปรตีนเท่าไร?")\n- พิมพ์ชื่ออาหารแล้วตามด้วยคำว่า "วิเคราะห์", "กี่แคล" หรือ "โภชนาการ" เพื่อให้วิเคราะห์จากข้อความ (เช่น "ข้าวมันไก่ วิเคราะห์")\n- ภาษาปัจจุบัน: ${currentLanguage === 'th' ? 'ไทย' : 'English'}. ใช้ /setlang [en/th] เพื่อเปลี่ยน (เช่น /setlang en)`
            : `AI Nutritionist Bot Help:\n- Send a picture of your food for analysis.\n- Ask general nutrition questions (e.g., "How much protein in chicken breast?").\n- Type a food name followed by "analyze", "calories", or "nutrition" to analyze from text (e.g., "Pad Thai analyze").\n- Current language: ${currentLanguage === 'th' ? 'ไทย' : 'English'}. Use /setlang [en/th] to change (e.g., /setlang en)`,
      }
      await this.replyMessages(replyToken, [helpMessage])
      return
    }

    if (text.startsWith('/setlang')) {
      const parts = text.split(' ')
      if (parts.length === 2 && (parts[1] === 'en' || parts[1] === 'th')) {
        try {
          await this.userService.setUserLanguage(userId, parts[1])
          await this.replyText(
            replyToken,
            parts[1] === 'th'
              ? 'ตั้งค่าภาษาเป็นไทยเรียบร้อยแล้วค่ะ'
              : 'Language set to English.',
          )
        } catch (error) {
          this.logger.error(`Error setting language for user ${userId}:`, error)
          await this.replyText(
            replyToken,
            currentLanguage === 'th'
              ? 'ขออภัยค่ะ ไม่สามารถตั้งค่าภาษาของคุณได้'
              : 'Sorry, I could not set your language preference.',
          )
        }
      } else {
        await this.replyText(
          replyToken,
          currentLanguage === 'th'
            ? 'คำสั่งไม่ถูกต้อง. ใช้ /setlang [en/th] (เช่น /setlang en)'
            : 'Invalid command. Use /setlang [en/th] (e.g., /setlang en).',
        )
      }
      return
    }

    // Check if the text is a URL pointing to an image
    const imageRegex = /(http(s?):)([/|.|\w|\s|-])*\.(?:jpg|gif|png|jpeg|webp)/i
    if (imageRegex.test(text)) {
      this.logger.log(
        `Text message is an image URL: ${text} from user ${userId}`,
      )
      const analysisResult = await this.aiService.analyzeFoodOrMeal(
        userId,
        text,
        userProfile,
        currentLanguage,
        'normal',
        text,
        messageId,
      )

      if (analysisResult && 'error' in analysisResult) {
        this.logger.error(
          `Error analyzing food from URL for user ${userId}: ${analysisResult.error}`,
        )
        await this.replyText(
          replyToken,
          currentLanguage === 'th'
            ? `ขออภัยค่ะ ไม่สามารถวิเคราะห์รูปภาพจาก URL ได้: ${analysisResult.error}`
            : `Sorry, I couldn't analyze the image from the URL: ${analysisResult.error}`,
        )
      } else if (
        analysisResult &&
        'status' in analysisResult &&
        analysisResult.status === 'web_search_required'
      ) {
        this.logger.log(
          `Web search requested for food analysis from URL for user ${userId}`,
        )
        await this.replyText(
          replyToken,
          analysisResult.message_to_user_while_searching ||
            (currentLanguage === 'th'
              ? 'กำลังค้นหาข้อมูลเพิ่มเติมสักครู่นะคะ'
              : 'Looking up more information...'),
        )
        // Potentially trigger actual web search and follow-up here in a real scenario
      } else if (analysisResult && 'food_name' in analysisResult) {
        // It's FoodAnalysisToolResult
        this.logger.log(
          `Food analysis from URL result for user ${userId}: ${JSON.stringify(analysisResult)}`,
        )
        const flexMessage = createFoodAnalysisFlexMessage(
          analysisResult as FoodAnalysisData,
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

    // Keywords to detect if user might be asking for food analysis from text
    const analysisKeywords =
      currentLanguage === 'th'
        ? [
            'วิเคราะห์',
            'กี่แคล',
            'แคลอรี่',
            'โภชนาการของ',
            'สารอาหาร',
            'ข้อมูลของ',
          ]
        : [
            'analyze',
            'calories',
            'nutrition of',
            'how many calories',
            'nutritional value',
            'details of',
          ]

    const mightBeFoodAnalysisRequest = analysisKeywords.some((keyword) =>
      text.toLowerCase().includes(keyword.toLowerCase()),
    )
    // Also check if the text isn't too short and doesn't seem like a simple greeting or very short question.
    // This is a heuristic and can be improved.
    const seemsLikeFoodName =
      text.length > 3 &&
      !text.toLowerCase().startsWith('what') &&
      !text.toLowerCase().startsWith('how') &&
      !text.endsWith('?')

    if (mightBeFoodAnalysisRequest && seemsLikeFoodName) {
      this.logger.log(
        `Attempting food analysis from text for user ${userId}: "${text}"`,
      )
      const analysisResult = await this.aiService.analyzeFoodOrMeal(
        userId,
        text,
        userProfile,
        currentLanguage,
        undefined,
        messageId,
      )

      if (analysisResult && 'error' in analysisResult) {
        this.logger.warn(
          `Food analysis from text failed for user ${userId}: ${analysisResult.error}. Falling back to general Q&A.`,
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
              ? 'ขออภัยค่ะ ฉันไม่เข้าใจคำถามของคุณ โปรดลองถามอีกครั้ง'
              : "Sorry, I didn't understand your question. Please try again."),
        )
      } else if (
        analysisResult &&
        'status' in analysisResult &&
        analysisResult.status === 'web_search_required'
      ) {
        this.logger.log(
          `Web search requested for food analysis from text for user ${userId}`,
        )
        await this.replyText(
          replyToken,
          analysisResult.message_to_user_while_searching ||
            (currentLanguage === 'th'
              ? 'กำลังค้นหาข้อมูลเพิ่มเติมสักครู่นะคะ'
              : 'Looking up more information...'),
        )
        // Potentially trigger actual web search and follow-up here
      } else if (
        analysisResult &&
        typeof analysisResult === 'object' &&
        'food_name' in analysisResult &&
        analysisResult.food_name !== 'NON_FOOD_IMAGE_DETECTED'
      ) {
        // Now TypeScript should correctly infer analysisResult as FoodAnalysisToolResult (or a compatible shape)
        this.logger.log(
          `Food analysis from text successful for user ${userId}: ${JSON.stringify(analysisResult)}`,
        )
        // Construct FoodAnalysisData properly for text-based analysis
        const flexData: FoodAnalysisData = {
          ...analysisResult, // Use analysisResult directly, type should be narrowed by the condition
          lineUserId: userId, // Add userId
          messageId: messageId, // Add messageId from the original text message
          // imageUrl will be undefined, which is correct for text analysis
        }
        const flexMessage = createFoodAnalysisFlexMessage(
          flexData,
          currentLanguage,
        )
        await this.replyMessages(replyToken, [flexMessage])
      } else {
        // If it's not an error, not web_search, and not FoodAnalysisToolResult,
        // it might be null or an unexpected structure. Fallback to general Q&A or a generic message.
        this.logger.warn(
          `Unexpected/null result from text-based food analysis for user ${userId}: ${JSON.stringify(analysisResult)}. Falling back to general Q&A.`,
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
              ? 'ฉันได้ลองพยายามวิเคราะห์อาหารจากข้อความแล้วแต่ยังไม่ค่อยเข้าใจค่ะ ลองถามคำถามโภชนาการอื่นๆ หรือส่งรูปภาพมาแทนได้นะคะ'
              : "I tried to analyze the food from your text but couldn't quite understand it. You can try asking other nutrition questions or send an image instead."),
        )
      }
      return
    }

    // Default: General nutrition question or off-topic
    this.logger.log(
      `Treating as general nutrition question or off-topic for user ${userId}: "${text}"`,
    )
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

  private async handleImageMessage(
    replyToken: string,
    messageId: string,
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

      const analysisResult = await this.aiService.analyzeFoodOrMeal(
        userId,
        'Analyze this food image',
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
            const flexData: FoodAnalysisData = {
              ...analysisResult,
              lineUserId: userId,
              messageId,
              imageUrl: uploadedImageUrl,
            }
            const flexMessage = createFoodAnalysisFlexMessage(
              flexData,
              currentLanguage,
            )
            await this.replyMessages(replyToken, [flexMessage])
            return
          } else if (
            'status' in analysisResult && // This implies WebSearchRequestToolResult
            analysisResult.status === 'web_search_required'
          ) {
            const messageToUser =
              analysisResult.message_to_user_while_searching ||
              (currentLanguage === 'th'
                ? 'กำลังค้นหาข้อมูลเพิ่มเติมสักครู่ค่ะ'
                : 'Searching for more information...')
            this.logger.log(
              `WebSearchRequestToolResult for ${userId}: Query - ${analysisResult.search_query_for_assistant}`,
            )
            await this.replyText(replyToken, messageToUser)
            return
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
            return
          } else {
            this.logger.warn(
              `Received unexpected object structure from aiService.analyzeFoodOrMeal for ${userId}`,
              analysisResult,
            )
          }
        }
      } else {
        this.logger.warn(
          `Received null or undefined result from aiService.analyzeFoodOrMeal for ${userId}`,
        )
      }

      const fallbackMessage =
        currentLanguage === 'th'
          ? 'ขออภัยค่ะ ไม่สามารถวิเคราะห์รูปภาพนี้ได้ในขณะนี้'
          : 'Sorry, I could not analyze the image at this time.'
      await this.replyText(replyToken, fallbackMessage)
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
    data: string, // This is the postback data string
    userId: string,
    params?: {
      date?: string
      time?: string
      datetime?: string
      richMenuAliasId?: string
      newRichMenuAliasId?: string
      status?: string
    }, // Correct type for postback.params
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
    const messageIdFromPostback = queryParams.get('messageId') || undefined // Ensure it's string | undefined

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
          action === 'edit_food_analysis')
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

      let cachedData: FoodAnalysisData | undefined
      if (messageIdFromPostback) {
        cachedData = this.analysisCacheService.get(messageIdFromPostback)
        if (!cachedData) {
          this.logger.warn(
            `Cache miss for messageId ${messageIdFromPostback} for postback action '${action}'.`,
          )
          // It's possible for cache to expire, or messageId to be invalid.
          // For view_vitamins_minerals, we already handle this. For others, decide if we should stop or proceed with partial data.
        }
      }

      if (action === 'analyze_again') {
        // const imageUrl = queryParams.get('imageUrl') || undefined // imageUrl might have been removed from postback
        // const textContent = queryParams.get('text') || undefined // textContent might have been removed
        // Rely on cachedData or messageId to get the original context for re-analysis

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
          const foodAnalysisResult = analysisResult as FoodAnalysisData

          const flexMessageData: FoodAnalysisData = {
            ...foodAnalysisResult,
            lineUserId: userProfile.lineUserId,
            messageId: messageIdFromPostback || new Date().getTime().toString(), // Fallback if messageIdFromPostback is undefined
            imageUrl: originalImageUrl,
          }

          const flexMessage = createFoodAnalysisFlexMessage(
            flexMessageData,
            currentLanguage,
          )
          await this.replyMessages(replyToken, [flexMessage])
        } else if (
          analysisResult &&
          'status' in analysisResult &&
          analysisResult.status === 'web_search_required'
        ) {
          const webSearchResult = analysisResult
          await this.replyText(
            replyToken,
            currentLanguage === 'th'
              ? `ฉันกำลังค้นหาข้อมูลเพิ่มเติมเกี่ยวกับ: ${webSearchResult.search_query_for_assistant}. กรุณารอสักครู่แล้วลองอีกครั้ง`
              : `I'm currently searching for more information about: ${webSearchResult.search_query_for_assistant}. Please wait a moment and try again.`,
          )
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
        // const messageIdFromPostback = queryParams.get('messageId') // Already retrieved
        // const foodNameFromPostback = queryParams.get('foodName') || (currentLanguage === 'th' ? 'อาหารของคุณ' : 'your food') // foodName removed from postback

        if (messageIdFromPostback) {
          // const cachedData: FoodAnalysisData | undefined = this.analysisCacheService.get(messageIdFromPostback); // Already retrieved

          if (cachedData) {
            const foodNameFromCache =
              cachedData.food_name ||
              (currentLanguage === 'th' ? 'อาหารของคุณ' : 'your food')
            this.logger.log(
              `Cache hit for messageId ${messageIdFromPostback} for view_vitamins_minerals. Food: ${foodNameFromCache}`,
            )

            // Reconstruct vitamins and minerals from cachedData
            const vitamins: Record<string, VitaminMineralDetail> = {}
            const minerals: Record<string, VitaminMineralDetail> = {}

            // Extract vitamins
            if (cachedData.vitamin_a) vitamins.vitamin_a = cachedData.vitamin_a
            if (cachedData.vitamin_c) vitamins.vitamin_c = cachedData.vitamin_c
            if (cachedData.vitamin_d) vitamins.vitamin_d = cachedData.vitamin_d
            if (cachedData.vitamin_e) vitamins.vitamin_e = cachedData.vitamin_e
            if (cachedData.vitamin_k) vitamins.vitamin_k = cachedData.vitamin_k
            if (cachedData.vitamin_b1)
              vitamins.vitamin_b1 = cachedData.vitamin_b1
            if (cachedData.vitamin_b2)
              vitamins.vitamin_b2 = cachedData.vitamin_b2
            if (cachedData.vitamin_b3)
              vitamins.vitamin_b3 = cachedData.vitamin_b3
            if (cachedData.vitamin_b5)
              vitamins.vitamin_b5 = cachedData.vitamin_b5
            if (cachedData.vitamin_b6)
              vitamins.vitamin_b6 = cachedData.vitamin_b6
            if (cachedData.vitamin_b9)
              vitamins.vitamin_b9 = cachedData.vitamin_b9
            if (cachedData.vitamin_b12)
              vitamins.vitamin_b12 = cachedData.vitamin_b12

            // Extract minerals
            if (cachedData.calcium) minerals.calcium = cachedData.calcium
            if (cachedData.iron) minerals.iron = cachedData.iron
            if (cachedData.magnesium) minerals.magnesium = cachedData.magnesium
            if (cachedData.potassium) minerals.potassium = cachedData.potassium
            if (cachedData.zinc) minerals.zinc = cachedData.zinc
            if (cachedData.phosphorus)
              minerals.phosphorus = cachedData.phosphorus
            if (cachedData.selenium) minerals.selenium = cachedData.selenium

            if (
              Object.keys(vitamins).length > 0 ||
              Object.keys(minerals).length > 0
            ) {
              const detailsFlexMessage = createVitaminMineralDetailsFlexMessage(
                foodNameFromCache,
                vitamins,
                minerals,
                currentLanguage,
              )
              await this.replyMessages(replyToken, [detailsFlexMessage])
            } else {
              const noDetailsText =
                currentLanguage === 'th'
                  ? `ขออภัย ไม่พบข้อมูลวิตามินและแร่ธาตุสำหรับ ${foodNameFromCache} ในขณะนี้`
                  : `Sorry, no vitamin and mineral details found for ${foodNameFromCache} at the moment.`
              await this.replyText(replyToken, noDetailsText)
            }
          } else {
            this.logger.warn(
              `Cache miss for messageId ${messageIdFromPostback} for view_vitamins_minerals action.`,
            )
            const notFoundText =
              currentLanguage === 'th'
                ? 'ขออภัย ไม่พบข้อมูลการวิเคราะห์เดิม โปรดลองวิเคราะห์ใหม่อีกครั้ง'
                : 'Sorry, the original analysis data was not found. Please try analyzing again.'
            await this.replyText(replyToken, notFoundText)
          }
        } else {
          // This case should be caught by the initial messageId check
          this.logger.warn(
            'view_vitamins_minerals postback action called without a messageId (should have been caught earlier).',
          )
          await this.replyText(
            replyToken,
            currentLanguage === 'th'
              ? 'เกิดข้อผิดพลาด: ไม่พบรหัสอ้างอิงสำหรับข้อมูลวิตามินและแร่ธาตุ'
              : 'Error: Reference ID for vitamin and mineral data not found.',
          )
        }
      } else if (
        action === 'save_food_analysis' ||
        action === 'edit_food_analysis'
      ) {
        // These actions would also rely on messageIdFromPostback to get cachedData
        this.logger.log(
          `Postback: Handling '${action}' for user ${userProfile.lineUserId}, messageId: ${messageIdFromPostback}`,
        )
        if (cachedData) {
          // Process save/edit using cachedData
          // Example: const foodNameToSave = cachedData.food_name;
          await this.replyText(
            replyToken,
            `Action '${action}' for ${cachedData.food_name} received (implementation pending).`,
          )
        } else {
          await this.replyText(
            replyToken,
            currentLanguage === 'th'
              ? 'ขออภัย ไม่พบข้อมูลเดิมที่จะดำเนินการนี้ โปรดลองเริ่มใหม่'
              : 'Sorry, the original data for this action was not found. Please try starting over.',
          )
        }
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
  ): Promise<MessageAPIResponseBase> {
    if (text.length === 0) {
      this.logger.warn('Attempted to reply with an empty text message.')
      return Promise.resolve({} as MessageAPIResponseBase)
    }
    try {
      return await this.lineClient.replyMessage(replyToken, {
        type: 'text',
        text: text.substring(0, 5000),
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
  ): Promise<MessageAPIResponseBase> {
    if (text.length === 0) {
      this.logger.warn('Attempted to push an empty text message.')
      return Promise.resolve({} as MessageAPIResponseBase)
    }
    try {
      return await this.lineClient.pushMessage(userId, {
        type: 'text',
        text: text.substring(0, 5000),
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
}
