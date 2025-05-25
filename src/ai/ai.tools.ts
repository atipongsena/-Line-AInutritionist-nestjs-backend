import OpenAI from 'openai'

// -------------------- FOOD ANALYSIS TOOL ---------------------
export const FOOD_ANALYSIS_SCHEMA = {
  type: 'object',
  strict: true,
  properties: {
    food_name: {
      type: 'string',
      description: 'ชื่ออาหารที่วิเคราะห์ (ในภาษาของผู้ใช้)',
    },
    portion: {
      type: 'string',
      description: 'ปริมาณหรือขนาดของอาหาร เช่น "1 จาน (320 กรัม)"',
    },
    components: {
      type: 'array',
      description: 'ส่วนประกอบของอาหาร ผลรวม percentage ต้องเท่ากับ 100',
      items: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'ชื่อส่วนประกอบ',
          },
          amount: {
            type: 'number',
            description: 'ปริมาณในหน่วยกรัมหรือมิลลิลิตร',
          },
          unit: {
            type: 'string',
            description: 'หน่วยของปริมาณ',
          },
          percentage: {
            type: 'number',
            description: 'เปอร์เซ็นต์ของส่วนประกอบเทียบกับทั้งหมด (0-100)',
          },
        },
        required: ['name', 'amount', 'unit', 'percentage'],
        additionalProperties: false,
      },
    },
    calories: {
      type: 'number',
      description: 'จำนวนแคลอรี่ (kcal)',
    },
    protein: {
      type: 'number',
      description: 'ปริมาณโปรตีนในหน่วยกรัม',
    },
    carbs: {
      type: 'number',
      description: 'ปริมาณคาร์โบไฮเดรตในหน่วยกรัม',
    },
    fat: {
      type: 'number',
      description: 'ปริมาณไขมันในหน่วยกรัม',
    },
    fiber: {
      type: 'number',
      description: 'ปริมาณใยอาหารในหน่วยกรัม',
    },
    sugar: {
      type: 'number',
      description: 'ปริมาณน้ำตาลในหน่วยกรัม',
    },
    saturated_fat: {
      type: 'number',
      description: 'ปริมาณไขมันอิ่มตัวในหน่วยกรัม',
    },
    omega3: {
      type: 'number',
      description: 'ปริมาณโอเมก้า-3 ในหน่วยกรัม',
    },
    cholesterol: {
      type: 'number',
      description: 'ปริมาณคอเลสเตอรอลในหน่วยมิลลิกรัม',
    },
    sodium: {
      type: 'number',
      description: 'ปริมาณโซเดียมในหน่วยมิลลิกรัม',
    },
    water: {
      type: 'number',
      description: 'ปริมาณน้ำในหน่วยมิลลิลิตร',
    },
    // Vitamins - Using the original flat structure for compatibility
    vitamin_a: { $ref: '#/definitions/VitaminMineralDetail' },
    vitamin_c: { $ref: '#/definitions/VitaminMineralDetail' },
    vitamin_d: { $ref: '#/definitions/VitaminMineralDetail' },
    vitamin_e: { $ref: '#/definitions/VitaminMineralDetail' },
    vitamin_k: { $ref: '#/definitions/VitaminMineralDetail' },
    vitamin_b1: { $ref: '#/definitions/VitaminMineralDetail' },
    vitamin_b2: { $ref: '#/definitions/VitaminMineralDetail' },
    vitamin_b3: { $ref: '#/definitions/VitaminMineralDetail' },
    vitamin_b5: { $ref: '#/definitions/VitaminMineralDetail' },
    vitamin_b6: { $ref: '#/definitions/VitaminMineralDetail' },
    vitamin_b9: { $ref: '#/definitions/VitaminMineralDetail' },
    vitamin_b12: { $ref: '#/definitions/VitaminMineralDetail' },
    // Minerals
    calcium: { $ref: '#/definitions/VitaminMineralDetail' },
    iron: { $ref: '#/definitions/VitaminMineralDetail' },
    magnesium: { $ref: '#/definitions/VitaminMineralDetail' },
    potassium: { $ref: '#/definitions/VitaminMineralDetail' },
    zinc: { $ref: '#/definitions/VitaminMineralDetail' },
    phosphorus: { $ref: '#/definitions/VitaminMineralDetail' },
    selenium: { $ref: '#/definitions/VitaminMineralDetail' },
    // Health information
    health_benefits: {
      type: 'string',
      description: 'ประโยชน์ต่อสุขภาพของอาหารนี้',
    },
    health_cautions: {
      type: 'string',
      description: 'ข้อควรระวังด้านสุขภาพสำหรับอาหารนี้',
    },
    recommendation: {
      type: 'string',
      description: 'คำแนะนำในการปรับมื้ออาหารนี้เพื่อสุขภาพของผู้ใช้',
    },
  },
  required: [
    'food_name',
    'portion',
    'components',
    'calories',
    'protein',
    'carbs',
    'fat',
    'fiber',
    'sugar',
    'saturated_fat',
    'omega3',
    'cholesterol',
    'sodium',
    'water',
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
    'calcium',
    'iron',
    'magnesium',
    'potassium',
    'zinc',
    'phosphorus',
    'selenium',
    'health_benefits',
    'health_cautions',
    'recommendation',
  ],
  additionalProperties: false,
  definitions: {
    VitaminMineralDetail: {
      type: 'object',
      properties: {
        value: {
          type: 'number',
          description: 'ปริมาณสารอาหาร',
        },
        unit: {
          type: 'string',
          description: 'หน่วยของปริมาณ',
        },
        dv: {
          type: 'number',
          description: 'เปอร์เซ็นต์ของค่าที่แนะนำต่อวัน',
        },
      },
      required: ['value', 'unit', 'dv'],
      additionalProperties: false,
    },
  },
} as const

export const foodAnalysisTool: OpenAI.Chat.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'extract_food_analysis',
    description:
      'Extracts detailed nutritional analysis of food items from user input (text or image) and user profile. Returns a structured JSON object.',
    parameters: FOOD_ANALYSIS_SCHEMA,
  },
}

// -------------------- NUTRITION GOAL TOOL ---------------------
export const NUTRITION_GOAL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    bmr: {
      type: 'number',
      description: 'Basal Metabolic Rate (แคลอรี่)',
    },
    tdee: {
      type: 'number',
      description: 'Total Daily Energy Expenditure (แคลอรี่)',
    },
    daily_goals: {
      type: 'object',
      additionalProperties: false,
      properties: {
        calories: {
          type: 'number',
          description: 'เป้าหมายแคลอรี่ต่อวัน',
        },
        protein: {
          type: 'number',
          description: 'เป้าหมายโปรตีนต่อวัน (กรัม)',
        },
        carbs: {
          type: 'number',
          description: 'เป้าหมายคาร์โบไฮเดรตต่อวัน (กรัม)',
        },
        fat: {
          type: 'number',
          description: 'เป้าหมายไขมันต่อวัน (กรัม)',
        },
      },
      required: ['calories', 'protein', 'carbs', 'fat'],
    },
    macro_distribution: {
      type: 'object',
      additionalProperties: false,
      properties: {
        protein_percent: {
          type: 'integer',
          description: 'เปอร์เซ็นต์ของแคลอรี่ที่มาจากโปรตีน',
        },
        carbs_percent: {
          type: 'integer',
          description: 'เปอร์เซ็นต์ของแคลอรี่ที่มาจากคาร์โบไฮเดรต',
        },
        fat_percent: {
          type: 'integer',
          description: 'เปอร์เซ็นต์ของแคลอรี่ที่มาจากไขมัน',
        },
      },
      required: ['protein_percent', 'carbs_percent', 'fat_percent'],
    },
    meal_recommendations: {
      type: 'object',
      additionalProperties: {
        type: 'number',
      },
      description: 'คำแนะนำแคลอรี่สำหรับแต่ละมื้อ',
    },
    health_advice: {
      type: 'string',
      description: 'คำแนะนำสุขภาพสำหรับเป้าหมายนี้',
    },
  },
  required: [
    'bmr',
    'tdee',
    'daily_goals',
    'macro_distribution',
    'meal_recommendations',
    'health_advice',
  ],
} as const

export const nutritionGoalTool: OpenAI.Chat.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'calculate_nutrition_goals',
    description:
      'Calculates personalized nutrition goals (BMR, TDEE, calories, macros) based on user profile.',
    parameters: NUTRITION_GOAL_SCHEMA,
  },
}

// -------------------- EATING PATTERN TOOL ---------------------
export const EATING_PATTERN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    calories_trend: {
      type: 'string',
      enum: ['improving', 'stable', 'worsening'],
      description: 'แนวโน้มแคลอรี่ที่บริโภค',
    },
    average_daily_calories: {
      type: 'number',
      description: 'แคลอรี่เฉลี่ยต่อวัน',
    },
    meal_timings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          meal_name: {
            type: 'string',
            description: 'ชื่อมื้ออาหาร',
          },
          average_time: {
            type: 'string',
            description: 'เวลาเฉลี่ยที่รับประทาน (รูปแบบ HH:MM)',
          },
          consistency: {
            type: 'number',
            description: 'ความสม่ำเสมอของเวลาที่รับประทาน (0-1)',
          },
        },
        required: ['meal_name', 'average_time', 'consistency'],
      },
      description: 'เวลาเฉลี่ยในการรับประทานอาหารแต่ละมื้อ',
    },
    nutrient_balance: {
      type: 'object',
      additionalProperties: false,
      properties: {
        protein_balance: {
          type: 'number',
          description: 'ความสมดุลของโปรตีน (% เทียบกับเป้าหมาย)',
        },
        carbs_balance: {
          type: 'number',
          description: 'ความสมดุลของคาร์โบไฮเดรต (% เทียบกับเป้าหมาย)',
        },
        fat_balance: {
          type: 'number',
          description: 'ความสมดุลของไขมัน (% เทียบกับเป้าหมาย)',
        },
      },
      required: ['protein_balance', 'carbs_balance', 'fat_balance'],
    },
    identified_patterns: {
      type: 'array',
      items: {
        type: 'string',
      },
      description: 'รูปแบบพฤติกรรมการกินที่ระบุได้',
    },
    improvement_suggestions: {
      type: 'array',
      items: {
        type: 'string',
      },
      description: 'ข้อเสนอแนะในการปรับปรุง',
    },
    personalized_advice: {
      type: 'string',
      description: 'คำแนะนำเฉพาะบุคคล',
    },
  },
  required: [
    'calories_trend',
    'average_daily_calories',
    'meal_timings',
    'nutrient_balance',
    'identified_patterns',
    'improvement_suggestions',
    'personalized_advice',
  ],
} as const

export const eatingPatternTool: OpenAI.Chat.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'analyze_eating_pattern',
    description:
      "Analyzes user's eating patterns from food logs, identifies trends, and provides recommendations.",
    parameters: EATING_PATTERN_SCHEMA,
  },
}

// -------------------- FOOD HISTORY TOOL ---------------------
export const FOOD_HISTORY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    days: {
      type: 'number',
      description:
        'Number of days to retrieve food logs (default: 30, recommended range: 1-90)',
    },
    limit: {
      type: 'number',
      description:
        'Maximum number of food logs to retrieve (default: 100, recommended range: 1-500)',
    },
  },
  required: ['days', 'limit'],
} as const

export const foodHistoryTool: OpenAI.Chat.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'get_food_history',
    description:
      'Retrieves user food logs for eating pattern analysis. Use this before analyzing eating patterns to get the most recent food consumption data.',
    parameters: FOOD_HISTORY_SCHEMA,
  },
}

// -------------------- MEAL RECOMMENDATION TOOL ---------------------
export const MEAL_RECOMMENDATION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    meal_type: {
      type: 'string',
      description: 'ประเภทของมื้ออาหาร',
    },
    foods: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: {
            type: 'string',
            description: 'ชื่ออาหาร',
          },
          description: {
            type: 'string',
            description: 'คำอธิบายอาหาร',
          },
          calories: {
            type: 'number',
            description: 'แคลอรี่',
          },
          protein: {
            type: 'number',
            description: 'โปรตีน (กรัม)',
          },
          carbs: {
            type: 'number',
            description: 'คาร์โบไฮเดรต (กรัม)',
          },
          fat: {
            type: 'number',
            description: 'ไขมัน (กรัม)',
          },
          portion: {
            type: 'string',
            description: 'ขนาดที่แนะนำ',
          },
          ingredients: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'ส่วนประกอบหลัก',
          },
        },
        required: [
          'name',
          'description',
          'calories',
          'protein',
          'carbs',
          'fat',
          'portion',
          'ingredients',
        ],
      },
      description: 'รายการอาหารที่แนะนำ',
    },
    total_calories: {
      type: 'number',
      description: 'แคลอรี่รวมของมื้อนี้',
    },
    total_protein: {
      type: 'number',
      description: 'โปรตีนรวมของมื้อนี้ (กรัม)',
    },
    total_carbs: {
      type: 'number',
      description: 'คาร์โบไฮเดรตรวมของมื้อนี้ (กรัม)',
    },
    total_fat: {
      type: 'number',
      description: 'ไขมันรวมของมื้อนี้ (กรัม)',
    },
    recommendations: {
      type: 'string',
      description: 'คำแนะนำเพิ่มเติม',
    },
  },
  required: [
    'meal_type',
    'foods',
    'total_calories',
    'total_protein',
    'total_carbs',
    'total_fat',
    'recommendations',
  ],
} as const

export const mealRecommendationTool: OpenAI.Chat.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'recommend_meals',
    description:
      'Recommends suitable meals based on user profile, preferences, and nutritional goals.',
    parameters: MEAL_RECOMMENDATION_SCHEMA,
  },
}

// -------------------- CONVERSATIONAL FOOD HISTORY TOOL ---------------------
export const CONVERSATIONAL_FOOD_HISTORY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    query_type: {
      type: 'string',
      enum: [
        'recent_meals',
        'specific_date',
        'date_range',
        'meal_type_analysis',
        'nutrition_summary',
        'eating_patterns',
        'food_frequency',
        'calorie_trends',
        'comparison',
        'general_question',
      ],
      description: 'ประเภทของคำถามที่ user ถาม',
    },
    time_period: {
      type: 'object',
      properties: {
        days: {
          type: 'number',
          description: 'จำนวนวันที่ต้องการดูข้อมูล (1-90 วัน)',
        },
        specific_date: {
          type: 'string',
          description: 'วันที่เฉพาะ (YYYY-MM-DD format)',
        },
        start_date: {
          type: 'string',
          description: 'วันที่เริ่มต้น (YYYY-MM-DD format)',
        },
        end_date: {
          type: 'string',
          description: 'วันที่สิ้นสุด (YYYY-MM-DD format)',
        },
      },
      description: 'ช่วงเวลาที่ต้องการวิเคราะห์',
    },
    filters: {
      type: 'object',
      properties: {
        meal_types: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['breakfast', 'lunch', 'dinner', 'snack'],
          },
          description: 'ประเภทมื้ออาหารที่ต้องการกรอง',
        },
        food_names: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: 'ชื่ออาหารที่ต้องการค้นหา',
        },
        min_calories: {
          type: 'number',
          description: 'แคลอรี่ขั้นต่ำ',
        },
        max_calories: {
          type: 'number',
          description: 'แคลอรี่สูงสุด',
        },
      },
      description: 'เงื่อนไขการกรองข้อมูล',
    },
    analysis_focus: {
      type: 'array',
      items: {
        type: 'string',
        enum: [
          'calories',
          'protein',
          'carbs',
          'fat',
          'fiber',
          'meal_timing',
          'food_variety',
          'portion_sizes',
          'eating_frequency',
          'nutritional_balance',
        ],
      },
      description: 'จุดเน้นในการวิเคราะห์',
    },
    user_question: {
      type: 'string',
      description: 'คำถามเดิมของ user เพื่อให้ AI เข้าใจบริบท',
    },
  },
  required: ['query_type', 'user_question'],
} as const

export const conversationalFoodHistoryTool: OpenAI.Chat.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'answer_food_history_question',
    description:
      'ตอบคำถามเกี่ยวกับประวัติการกินของ user โดยดึงข้อมูลและวิเคราะห์ตามที่ user ถาม สามารถตอบคำถามเช่น "เมื่อวานกินอะไรบ้าง", "สัปดาห์นี้กินโปรตีนเท่าไหร่", "เดือนที่แล้วกินข้าวบ่อยแค่ไหน" เป็นต้น',
    parameters: CONVERSATIONAL_FOOD_HISTORY_SCHEMA,
  },
}
