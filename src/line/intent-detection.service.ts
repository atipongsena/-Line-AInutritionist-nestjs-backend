import { Injectable, Logger } from '@nestjs/common'
import { UserProfileDto } from '../user/user.interface'
import { IntentDetectionMetricsService } from './intent-detection-metrics.service'

export interface IntentDetectionResult {
  intent: 'food_analysis' | 'general_nutrition'
  confidence: number
  reasoning: string
}

@Injectable()
export class IntentDetectionService {
  private readonly logger = new Logger(IntentDetectionService.name)

  constructor(
    private readonly intentDetectionMetricsService: IntentDetectionMetricsService,
  ) {
    this.logger.log('IntentDetectionService initialized with simplified logic.')
  }

  async detectIntent(
    userMessage: string,
    userProfile: UserProfileDto,
    language: string,
  ): Promise<IntentDetectionResult> {
    const startTime = Date.now()
    const lowerCaseMessage = userMessage.toLowerCase().trim()

    // 1. Check for very specific calorie/nutrition analysis requests
    if (
      this.hasStrongFoodAnalysisIndicatorsSimplified(lowerCaseMessage, language)
    ) {
      this.logger.log(
        `Food analysis intent detected by strong indicators: "${userMessage}"`,
      )
      return this.createDetectionResult(
        'food_analysis',
        0.95,
        'Strong food analysis indicators',
        startTime,
        false,
        userMessage,
        userProfile,
      )
    }

    // 2. Check for very specific keywords like "กี่แคล"
    const specificFoodAnalysisKeywords =
      language === 'th'
        ? [
            'กี่แคล', // Very specific and common
            'แคลอรี่ของ',
            'โภชนาการของ',
          ]
        : ['how many calories', 'calories in', 'nutrition for']

    for (const keyword of specificFoodAnalysisKeywords) {
      // Check if the keyword is followed by food name or comes after food name
      if (
        lowerCaseMessage.includes(keyword) &&
        (lowerCaseMessage.split(keyword)[1]?.trim() || // text after keyword
          lowerCaseMessage.split(keyword)[0]?.trim()) // text before keyword
      ) {
        this.logger.log(
          `Food analysis intent detected by specific keyword: "${keyword}"`,
        )
        return this.createDetectionResult(
          'food_analysis',
          0.9,
          `Specific Keyword: ${keyword}`,
          startTime,
          false,
          userMessage,
          userProfile,
        )
      }
    }

    // 3. All other messages are general nutrition
    this.logger.log(`General nutrition intent detected for: "${userMessage}"`)
    return this.createDetectionResult(
      'general_nutrition',
      0.8,
      'Default fallback',
      startTime,
      true,
      userMessage,
      userProfile,
    )
  }

  private createDetectionResult(
    intent: 'food_analysis' | 'general_nutrition',
    confidence: number,
    reasoning: string,
    startTime: number,
    wasFallback: boolean,
    userMessage: string,
    userProfile: UserProfileDto,
  ): IntentDetectionResult {
    const duration = Date.now() - startTime

    // Log detection metrics
    this.intentDetectionMetricsService.logDetection(
      userMessage,
      { intent, confidence, reasoning },
      duration,
      wasFallback,
      userProfile.lineUserId,
    )

    this.logger.log(
      `Intent detected: ${intent} (confidence: ${confidence.toFixed(2)}, duration: ${duration}ms, reasoning: ${reasoning})`,
    )

    return {
      intent,
      confidence,
      reasoning,
    }
  }

  // เก็บไว้เพื่อใช้ตรวจจับคำขอเฉพาะเจาะจง
  private hasStrongFoodAnalysisIndicatorsSimplified(
    userMessage: string, // Already lowercased when passed
    language: string,
  ): boolean {
    // รูปแบบที่เฉพาะเจาะจงมากสำหรับการวิเคราะห์อาหาร
    const strongIndicators =
      language === 'th'
        ? [
            'กี่แคล', // "how many calories"
            'แคลอรี่ของ', // "calories of"
            'โภชนาการของ', // "nutrition of"
          ]
        : [
            'how many calories',
            'calories in',
            'nutrition for',
            'nutritional value of',
          ]

    return strongIndicators.some((indicator) => userMessage.includes(indicator))
  }

  // Helper methods for compatibility
  isExplicitFoodAnalysisRequest(
    userMessage: string,
    language: string,
  ): boolean {
    return this.hasStrongFoodAnalysisIndicatorsSimplified(
      userMessage.toLowerCase(),
      language,
    )
  }

  isSimpleGreetingOrThanks(userMessage: string, language: string): boolean {
    const lowerMessage = userMessage.toLowerCase().trim()
    const greetingsAndThanks =
      language === 'th'
        ? ['สวัสดี', 'ขอบคุณ', 'ครับ', 'ค่ะ', 'ได้', 'โอเค', 'ตกลง']
        : ['hello', 'hi', 'thanks', 'thank you', 'ok', 'okay', 'yes', 'no']

    return greetingsAndThanks.some((phrase) => lowerMessage === phrase)
  }
}
