export interface OpenAiChatParameters {
  temperature?: number
  max_tokens?: number
  top_p?: number
  presence_penalty?: number
  frequency_penalty?: number
  // stop?: string | string[]; // Potentially for future use
}

export enum AiTaskType {
  FoodAnalysis = 'foodAnalysis',
  NutritionGoalCalculation = 'nutritionGoalCalculation',
  EatingPatternAnalysis = 'eatingPatternAnalysis',
  MealRecommendation = 'mealRecommendation',
  GeneralNutritionQuery = 'generalNutritionQuery',
  ConversationalFoodHistory = 'conversationalFoodHistory',
  IntentDetection = 'intentDetection',
  // EmbeddingCreation task does not use these chat parameters directly in getChatCompletion
  Default = 'default',
}

// ✅ Control Methods Configuration
export interface ConversationControlConfig {
  /** การจัดการ token ของ conversation history - ลดลงเพื่อประหยัด cost */
  historyTokenLimits: {
    fast: number
    normal: number
    accurate: number
  }

  /** การตั้งค่า output tokens - ปรับให้เหมาะสม */
  outputTokenSettings: {
    baseTokens: {
      fast: number
      normal: number
      accurate: number
    }
    followUpMultiplier: number
    longQueryMultiplier: number
    maxOutputTokens: number
  }

  /** การเลือก context ที่เกี่ยวข้อง */
  contextSelection: {
    followUpMessages: number
    regularMessages: number
    maxContextMessages: number
  }

  /** การตรวจจับประเภทการสนทนา */
  conversationPatterns: {
    followUpKeywords: string[]
    clarificationKeywords: string[]
  }

  /** การตั้งค่าระดับคุณภาพตาม query complexity */
  complexityThresholds: {
    simple: number
    moderate: number
    complex: number
  }

  /** ✅ การตั้งค่าการแยก conversation context */
  exclusionRules: {
    /** ไม่เก็บ food analysis จากภาพใน conversation history */
    excludeFoodAnalysisFromImages: boolean
    /** ไม่เก็บข้อความที่ยาวเกินไปใน conversation history */
    maxMessageLengthForHistory: number
    /** รูปแบบข้อความที่ไม่ควรเก็บใน history */
    excludePatterns: string[]
    /** ข้อความที่ขึ้นต้นด้วยสัญลักษณ์เหล่านี้จะไม่ถูกประมวลผลโดย AI และไม่เก็บใน history */
    commandPrefixes: string[]
  }

  /** การตั้งค่า response truncation แยกต่างหาก */
  responseTruncation: {
    /** ข้อจำกัดความยาว response text (characters) */
    maxResponseLength: number
    /** ไม่ตัดข้อความใน specific contexts */
    noTruncationContexts: string[]
  }
}

export interface AiGlobalConfig {
  defaultParameters: OpenAiChatParameters
  taskSpecificParameters: {
    [key in AiTaskType]?: OpenAiChatParameters
  }
  conversationControl: ConversationControlConfig
}

export const AI_CONFIG: AiGlobalConfig = {
  defaultParameters: {
    temperature: 0.5, // ให้ AI ตัดสินใจเอง
    //max_tokens: 1024, // Default max tokens for OpenAI
    //top_p: 1.0,
    //presence_penalty: 0.0,
    //frequency_penalty: 0.0,
  },
  taskSpecificParameters: {
    [AiTaskType.FoodAnalysis]: {
      temperature: 0.3, // ให้ AI ตัดสินใจความเหมาะสมเอง
      //max_tokens: 1800, // May need more tokens for detailed tool schema
    },
    [AiTaskType.NutritionGoalCalculation]: {
      temperature: 0.3, // ให้ AI ตัดสินใจความเหมาะสมเอง
      //max_tokens: 5200, // เปิดเพื่อป้องกันการตัดข้อความ
    },
    [AiTaskType.EatingPatternAnalysis]: {
      temperature: 0.4, // ให้ AI ตัดสินใจความเหมาะสมเอง
      //max_tokens: 5500, // เปิดเพื่อป้องกันการตัดข้อความ
    },
    [AiTaskType.MealRecommendation]: {
      temperature: 0.7, // ให้ AI ตัดสินใจความเหมาะสมเอง
      //max_tokens: 5500, // เพิ่มจาก 1500 เป็น 2500 เพื่อให้พอกับหลายรายการอาหาร
    },
    [AiTaskType.GeneralNutritionQuery]: {
      temperature: 0.5, // ให้ AI ตัดสินใจความเหมาะสมเอง
      //max_tokens: 800,
    },
    [AiTaskType.ConversationalFoodHistory]: {
      temperature: 0.4, // ให้ AI ตัดสินใจความเหมาะสมเอง
      //max_tokens: 1500,
    },
    [AiTaskType.IntentDetection]: {
      temperature: 0.1, // ต่ำมากเพื่อความแม่นยำสูงสุดในการจำแนกประเภท
      max_tokens: 100, // น้อยมากเนื่องจากเป็น classification task
      // top_p, presence_penalty, frequency_penalty จะใช้ default
    },
  },

  // ✅ Control Methods Configuration
  conversationControl: {
    /** การจัดการ token ของ conversation history - เพิ่มขึ้นเพื่อลดการตัด */
    historyTokenLimits: {
      fast: 1000, // เพิ่มจาก 400 เป็น 1000
      normal: 2000, // เพิ่มจาก 800 เป็น 2000
      accurate: 3000, // เพิ่มจาก 1200 เป็น 3000
    },

    /** การตั้งค่า output tokens - เพิ่มขึ้นเพื่อลดการตัด */
    outputTokenSettings: {
      baseTokens: {
        fast: 1000,
        normal: 2000,
        accurate: 3000,
      },
      followUpMultiplier: 0.8,
      longQueryMultiplier: 1.2,
      maxOutputTokens: 8000, // เพิ่มจาก 600 เป็น 1200
    },

    /** การเลือก context ที่เกี่ยวข้อง */
    contextSelection: {
      followUpMessages: 5, // เพิ่มจาก 3 เป็น 5
      regularMessages: 3, // เพิ่มจาก 2 เป็น 3
      maxContextMessages: 8, // เพิ่มจาก 5 เป็น 8
    },

    /** การตรวจจับประเภทการสนทนา */
    conversationPatterns: {
      followUpKeywords: [
        // Thai
        'ขอ',
        'อีก',
        'เพิ่ม',
        'อื่น',
        'มี',
        'แล้ว',
        'ต่อ',
        'ถัดไป',
        'อร่อย',
        'เปลี่ยน',
        'ใหม่',
        'ดี',
        'ที่',
        'กว่า',
        'นี้',
        // English
        'more',
        'other',
        'another',
        'else',
        'different',
        'better',
        'next',
        'also',
        'what about',
        'how about',
      ],
      clarificationKeywords: [
        // Thai
        'หมายถึง',
        'คือ',
        'อย่างไร',
        'ยังไง',
        'เท่าไหร่',
        'อะไร',
        'ทำไม',
        'ที่ไหน',
        'เมื่อไหร่',
        'ใคร',
        'ไหน',
        // English
        'what',
        'how',
        'why',
        'where',
        'when',
        'which',
        'who',
        'explain',
        'clarify',
        'mean',
      ],
    },

    /** การตั้งค่าระดับคุณภาพตาม query complexity */
    complexityThresholds: {
      simple: 0.3, // คำถามง่าย - ใช้ fast mode
      moderate: 0.7, // คำถามปานกลาง - ใช้ normal mode
      complex: 1.0, // คำถามซับซ้อน - ใช้ accurate mode
    },

    /** ✅ การตั้งค่าการแยก conversation context */
    exclusionRules: {
      /** ไม่เก็บ food analysis จากภาพใน conversation history */
      excludeFoodAnalysisFromImages: true,
      /** ไม่เก็บข้อความที่ยาวเกินไปใน conversation history */
      maxMessageLengthForHistory: 500, // characters
      /** รูปแบบข้อความที่ไม่ควรเก็บใน history */
      excludePatterns: [
        'analyze this food image',
        'วิเคราะห์รูปภาพอาหาร',
        'analyze this food',
        'วิเคราะห์อาหาร',
      ],
      /** ข้อความที่ขึ้นต้นด้วยสัญลักษณ์เหล่านี้จะไม่ถูกประมวลผลโดย AI และไม่เก็บใน history */
      commandPrefixes: ['/'],
    },

    /** การตั้งค่า response truncation แยกต่างหาก */
    responseTruncation: {
      /** ข้อจำกัดความยาว response text (characters) */
      maxResponseLength: 4000, // เพิ่มจาก default 5000 LINE limit
      /** ไม่ตัดข้อความใน specific contexts */
      noTruncationContexts: [
        'meal_recommendation',
        'eating_pattern_analysis',
        'nutrition_goal_calculation',
      ],
    },
  },
}
