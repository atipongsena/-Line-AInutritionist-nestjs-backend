/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { OpenaiService } from '../openai/openai.service'
import { UserProfileDto } from '../user/user.interface'
import { IntentDetectionMetricsService } from './intent-detection-metrics.service'
import type { ChatCompletion } from 'openai/resources/index.mjs'

export interface IntentDetectionResult {
  intent: 'food_analysis' | 'eating_pattern_analysis' | 'general_nutrition'
  confidence: number
  reasoning?: string
  extractedFoodNames?: string[]
}

interface IntentDetectionResponse {
  intent: 'food_analysis' | 'eating_pattern_analysis' | 'general_nutrition'
  confidence: number
  reasoning?: string
  food_names?: string[]
}

@Injectable()
export class IntentDetectionService implements OnModuleInit {
  private readonly logger = new Logger(IntentDetectionService.name)
  private isInitialized = false

  constructor(
    private readonly openaiService: OpenaiService,
    private readonly intentDetectionMetricsService: IntentDetectionMetricsService,
  ) {}

  onModuleInit(): void {
    this.isInitialized = true
    this.logger.log('GPT-4.1 Nano Intent Detection Service initialized')
  }

  async detectIntent(
    userMessage: string,
    userProfile: UserProfileDto,
    language: string = 'th',
  ): Promise<IntentDetectionResult> {
    if (!this.isInitialized) {
      this.logger.warn(
        'IntentDetectionService not initialized, using fallback detection',
      )
      return this.fallbackKeywordDetection(userMessage, language)
    }

    const startTime = performance.now()
    let wasFallback = false

    try {
      const nanoDeployment = this.openaiService.getGpt41_nanoModelDeployment()
      if (!nanoDeployment) {
        this.logger.warn(
          'GPT-4.1 nano deployment not configured, using fallback',
        )
        wasFallback = true
        const result = this.fallbackKeywordDetection(userMessage, language)
        const latency = performance.now() - startTime

        this.intentDetectionMetricsService.logDetection(
          userMessage,
          result,
          latency,
          wasFallback,
          userProfile.lineUserId,
        )

        return result
      }

      const metaPrompt = this.getIntentDetectionMetaPrompt(language)

      const userInputWithoutContext = userMessage.trim()

      const response: ChatCompletion =
        await this.openaiService.getChatCompletion(
          nanoDeployment,
          [
            { role: 'system', content: metaPrompt },
            { role: 'user', content: userInputWithoutContext },
          ],
          {
            temperature: 0.1,
            max_tokens: 200,
          },
          userProfile.lineUserId, // Add userId for prompt caching optimization
        )

      if (!response.choices || response.choices.length === 0) {
        throw new Error('No choices in response from nano model')
      }

      const firstChoice = response.choices[0]
      if (!firstChoice?.message?.content) {
        throw new Error('No valid content in response from nano model')
      }

      const responseText = firstChoice.message.content.trim()

      if (!responseText) {
        throw new Error('Empty response from nano model')
      }

      let parsedResult: IntentDetectionResponse
      try {
        const jsonMatch = responseText.match(/\{[^}]*\}/s)
        const jsonString = jsonMatch ? jsonMatch[0] : responseText
        parsedResult = JSON.parse(jsonString) as IntentDetectionResponse
      } catch (parseError) {
        this.logger.warn(
          `Failed to parse nano response as JSON: "${responseText}"`,
          parseError,
        )
        wasFallback = true
        const result = this.fallbackKeywordDetection(userMessage, language)
        const latency = performance.now() - startTime

        this.intentDetectionMetricsService.logDetection(
          userMessage,
          result,
          latency,
          wasFallback,
          userProfile.lineUserId,
        )

        return result
      }

      const intent = parsedResult.intent
      const confidence = Math.min(
        Math.max(parsedResult.confidence || 0.5, 0),
        1,
      )
      const reasoning = parsedResult.reasoning || 'GPT-4.1 nano classification'
      const extractedFoodNames = parsedResult.food_names || []

      if (
        ![
          'food_analysis',
          'eating_pattern_analysis',
          'general_nutrition',
        ].includes(intent)
      ) {
        throw new Error(`Invalid intent returned: ${intent}`)
      }

      this.logger.log(
        `Intent detection (nano): ${intent} (confidence: ${confidence.toFixed(3)}) ` +
          `for message: "${userMessage.substring(0, 50)}..."`,
      )

      const result: IntentDetectionResult = {
        intent,
        confidence,
        reasoning,
        extractedFoodNames:
          extractedFoodNames.length > 0 ? extractedFoodNames : undefined,
      }

      const latency = performance.now() - startTime
      this.intentDetectionMetricsService.logDetection(
        userMessage,
        result,
        latency,
        wasFallback,
        userProfile.lineUserId,
      )

      return result
    } catch (error) {
      this.logger.error(
        `Nano-based intent detection failed: ${error instanceof Error ? error.message : String(error)}`,
      )
      wasFallback = true
      const result = this.fallbackKeywordDetection(userMessage, language)
      const latency = performance.now() - startTime

      this.intentDetectionMetricsService.logDetection(
        userMessage,
        result,
        latency,
        wasFallback,
        userProfile.lineUserId,
      )

      return result
    }
  }

  private fallbackKeywordDetection(
    userMessage: string,
    language: string,
  ): IntentDetectionResult {
    const hasEatingPatternKeywords = this.hasEatingPatternIndicators(
      userMessage,
      language,
    )

    if (hasEatingPatternKeywords) {
      return {
        intent: 'eating_pattern_analysis',
        confidence: 0.85,
        reasoning: 'Keyword-based fallback detection (eating pattern analysis)',
      }
    }

    const hasFoodAnalysisKeywords = this.hasStrongFoodAnalysisIndicators(
      userMessage,
      language,
    )

    if (hasFoodAnalysisKeywords) {
      return {
        intent: 'food_analysis',
        confidence: 0.8,
        reasoning: 'Keyword-based fallback detection (food analysis)',
      }
    }

    return {
      intent: 'general_nutrition',
      confidence: 0.6,
      reasoning:
        'Keyword-based fallback detection (general nutrition - includes greetings and off-topic)',
    }
  }

  private hasEatingPatternIndicators(
    userMessage: string,
    language: string,
  ): boolean {
    const lowerMessage = userMessage.toLowerCase()

    const eatingPatternKeywords =
      language === 'th'
        ? [
            'วิเคราะห์การกิน',
            'วิเคราะห์การทาน',
            'วิเคราะห์พฤติกรรมการกิน',
            'วิเคราะห์รูปแบบการกิน',
            'การกินของฉัน',
            'การทานของฉัน',
            'รูปแบบการกิน',
            'รูปแบบการทาน',
            'พฤติกรรมการกิน',
            'พฤติกรรมการทาน',
            'ประวัติการกิน',
            'ประวัติการทาน',
            'ประวัติอาหาร',
            'ดูการกิน',
            'ดูการทาน',
            'เช็คการกิน',
            'เช็คการทาน',
            'สรุปการกิน',
            'สรุปการทาน',
            'ติดตามการกิน',
            'ติดตามการทาน',
            'แนวโน้มการกิน',
            'แนวโน้มการทาน',
          ]
        : [
            'analyze eating',
            'analyze my eating',
            'eating pattern',
            'eating habit',
            'eating behavior',
            'eating analysis',
            'my eating pattern',
            'my eating habits',
            'eating history',
            'food history',
            'analyze pattern',
            'analyze habits',
            'diet pattern',
            'diet analysis',
            'track eating',
            'eating trend',
            'nutrition pattern',
          ]

    return eatingPatternKeywords.some((keyword) =>
      lowerMessage.includes(keyword.toLowerCase()),
    )
  }

  private hasStrongFoodAnalysisIndicators(
    userMessage: string,
    language: string,
  ): boolean {
    const lowerMessage = userMessage.toLowerCase()

    const strongIndicators =
      language === 'th'
        ? [
            'กี่แคล',
            'แคลอรี่',
            'แคล',
            'calories',
            'cal',
            'kcal',
            'โภชนาการของ',
            'สารอาหารของ',
            'คำนวณ',
            'โปรตีน',
            'คาร์บ',
            'ไขมัน',
            'ใยอาหาร',
            'โซเดียม',
            'น้ำตาล',
            'พลังงาน',
            'เช็ค',
            'สแกน',
            'ดูโภชนาการ',
            'ตรวจสอบ',
            'มีแคลอรี่',
            'ได้แคลอรี่',
            'กี่แคลอรี่',
          ]
        : [
            'calories',
            'cal',
            'kcal',
            'nutrition of',
            'nutrients in',
            'calculate',
            'protein',
            'carb',
            'fat',
            'fiber',
            'sodium',
            'sugar',
            'energy',
            'check',
            'scan',
            'macro',
            'micro',
            'nutritional analysis',
          ]

    const hasDirectKeyword = strongIndicators.some((indicator) =>
      lowerMessage.includes(indicator.toLowerCase()),
    )

    if (hasDirectKeyword) {
      return true
    }

    if (language === 'th') {
      const foodAnalysisPatterns = [
        /\b(ข้าว|แกง|ส้มตำ|ลาบ|ผัด|ต้ม|ย่าง|ทอด|นึ่ง|ปิ้ง|สุกี้|บะหมี่|ก๋วยเตี๋ยว)\w*\s*\d*\s*(จาน|ชาม|ถ้วย|ชิ้น|อัน|ใส่)\b/,
        /\b(ไก่|หมู|เนื้อ|ปลา|กุ้ง|ปู|หมึก|ไข่|หอย)\w*\s*\d*\s*(ชิ้น|ตัว|อัน|จาน|ทอด|ย่าง|ต้ม|แกง)\b/,
        /\b(ผัก|ผลไม้|นม|ขนม|เค้ก|ขนมจีน|ปาด)\w*\s*\d*\s*(จาน|ชาม|ลูก|ชิ้น|แก้ว|น้ำ)\b/,
        /\b.{2,}\d+\s*(จาน|ชาม|ถ้วย|ชิ้น|อัน|แก้ว|ลูก|ใส่)\b/,
        /\b(สุกี้|มาม่า|ผัดไทย|แกงเขียวหวาน|แกงมัสมั่น|ต้มยำกุ้ง|ข้าวมันไก่|ขนมจีนน้ำยา|หอยทอด)\b/,
      ]

      return foodAnalysisPatterns.some((pattern) => pattern.test(lowerMessage))
    }

    return false
  }

  private getIntentDetectionMetaPrompt(language: string = 'th'): string {
    if (language === 'th') {
      return `คุณเป็น AI ที่เชี่ยวชาญในการจำแนกประเภทข้อความเกี่ยวกับอาหารและโภชนาการ

ภารกิจ: จำแนกข้อความของผู้ใช้ว่าเป็นประเภทใด

ประเภทที่ต้องจำแนก (เฉพาะ 3 ประเภท):
1. "food_analysis" - คำถามที่ต้องการวิเคราะห์อาหาร/ตรวจสอบโภชนาการ/คำนวณแคลอรี่
2. "eating_pattern_analysis" - คำถามที่ต้องการวิเคราะห์รูปแบบการกิน/พฤติกรรมการกิน/ประวัติการกิน
3. "general_nutrition" - คำถามทั่วไปเกี่ยวกับโภชนาการ/คำแนะนำอาหาร/การทักทาย/นอกเรื่อง

เกณฑ์การจำแนก:

**food_analysis:**
- มีคำเกี่ยวกับการวิเคราะห์อาหาร: "กี่แคล", "แคลอรี่", "โภชนาการของ", "สารอาหาร"
- มีคำเกี่ยวกับการคำนวณ: "คำนวณ", "เช็ค", "ตรวจสอบ", "ดู", "มีแคลอรี่เท่าไหร่"
- มีการถามเกี่ยวกับองค์ประกอบ: "โปรตีน", "คาร์บ", "ไขมัน", "ใยอาหาร"
- มีชื่ออาหารชัดเจนพร้อมคำถามเกี่ยวกับคุณค่า

**eating_pattern_analysis:**
- มีคำเกี่ยวกับการวิเคราะห์รูปแบบ: "วิเคราะห์การกิน", "รูปแบบการกิน", "พฤติกรรมการกิน"
- มีคำเกี่ยวกับประวัติ: "ประวัติการกิน", "ประวัติอาหาร", "การกินของฉัน"
- มีคำเกี่ยวกับการติดตาม: "ติดตามการกิน", "สรุปการกิน", "แนวโน้มการกิน"
- ถามเกี่ยวกับพฤติกรรมการกินโดยรวม ไม่ใช่วิเคราะห์อาหาร

**general_nutrition:**
- คำถามทั่วไป: "แนะนำ", "ช่วย", "อยากได้", "มีอะไร"
- การทักทาย: "สวัสดี", "หวัดดี", "เฮ้ย"
- ข้อความนอกเรื่อง
- คำถามเกี่ยวกับการกิน แต่ไม่ได้ขอวิเคราะห์เฉพาะเจาะจง

ตอบเป็น JSON format เท่านั้น:
{
  "intent": "food_analysis" หรือ "eating_pattern_analysis" หรือ "general_nutrition",
  "confidence": ตัวเลข 0.0-1.0,
  "reasoning": "เหตุผลสั้นๆ",
  "food_names": ["รายชื่ออาหารที่พบ"] (ถ้ามี)
}`
    } else {
      return `You are an AI expert in classifying food and nutrition-related messages.

Task: Classify user messages into one of three categories:

Categories (exactly 3 types):
1. "food_analysis" - Questions requesting single food analysis/nutrition check/calorie calculation
2. "eating_pattern_analysis" - Questions requesting eating pattern/behavior/history analysis
3. "general_nutrition" - General nutrition questions/food recommendations/greetings/off-topic

Classification criteria:

**food_analysis:**
- Analysis keywords for food: "calories", "cal", "kcal", "nutrition of", "nutrients"
- Calculation keywords: "calculate", "check", "how many calories", "nutritional value"
- Component questions: "protein", "carbs", "fat", "fiber", "sodium", "sugar"
- Specific food names with value questions

**eating_pattern_analysis:**
- Pattern analysis keywords: "analyze eating", "eating pattern", "eating behavior", "eating habits"
- History keywords: "eating history", "food history", "my eating pattern", "my eating habits"
- Tracking keywords: "track eating", "eating trend", "diet pattern", "diet analysis"
- Questions about overall eating behavior, not analysis food items

**general_nutrition:**
- General questions: "recommend", "suggest", "help", "what", "advice"
- Greetings: "hello", "hi", "hey"
- Off-topic messages
- Eating questions without specific analysis requests

Respond in JSON format only:
{
  "intent": "food_analysis" or "eating_pattern_analysis" or "general_nutrition",
  "confidence": number 0.0-1.0,
  "reasoning": "brief explanation",
  "food_names": ["detected food names"] (if any)
}`
    }
  }
}
