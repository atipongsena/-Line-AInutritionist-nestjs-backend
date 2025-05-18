import OpenAI from 'openai'

// -------------------- FOOD ANALYSIS TOOL ---------------------
export const FOOD_ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    food_name: {
      type: 'string',
      description: 'ชื่ออาหารที่วิเคราะห์',
    },
    portion: {
      type: 'string',
      description: "ปริมาณหรือขนาดของอาหาร เช่น '1 จาน (320 กรัม)",
    },
    components: {
      type: 'array',
      description: 'ส่วนประกอบของอาหาร',
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
            description: 'หน่วยของปริมาณ เช่น กรัม (g), มิลลิลิตร (ml)',
          },
          percentage: {
            type: 'number',
            description: 'เปอร์เซ็นต์ของส่วนประกอบเทียบกับทั้งหมด',
          },
        },
        required: ['name', 'amount', 'unit', 'percentage'],
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
    trans_fat: {
      type: 'number',
      description: 'ปริมาณไขมันทรานส์ในหน่วยกรัม',
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
      description: 'ปริมาณน้ำในหน่วยกรัม',
    },
    vitamin_a: {
      type: 'object',
      properties: {
        value: { type: 'number' },
        unit: { type: 'string' },
        dv: { type: 'number' },
      },
      description: 'ปริมาณวิตามิน A และเปอร์เซ็นต์ของค่าที่แนะนำต่อวัน',
    },
    vitamin_c: {
      type: 'object',
      properties: {
        value: { type: 'number' },
        unit: { type: 'string' },
        dv: { type: 'number' },
      },
      description: 'ปริมาณวิตามิน C และเปอร์เซ็นต์ของค่าที่แนะนำต่อวัน',
    },
    vitamin_d: {
      type: 'object',
      properties: {
        value: { type: 'number' },
        unit: { type: 'string' },
        dv: { type: 'number' },
      },
      description: 'ปริมาณวิตามิน D และเปอร์เซ็นต์ของค่าที่แนะนำต่อวัน',
    },
    vitamin_e: {
      type: 'object',
      properties: {
        value: { type: 'number' },
        unit: { type: 'string' },
        dv: { type: 'number' },
      },
      description: 'ปริมาณวิตามิน E และเปอร์เซ็นต์ของค่าที่แนะนำต่อวัน',
    },
    vitamin_k: {
      type: 'object',
      properties: {
        value: { type: 'number' },
        unit: { type: 'string' },
        dv: { type: 'number' },
      },
      description: 'ปริมาณวิตามิน K และเปอร์เซ็นต์ของค่าที่แนะนำต่อวัน',
    },
    vitamin_b1: {
      type: 'object',
      properties: {
        value: { type: 'number' },
        unit: { type: 'string' },
        dv: { type: 'number' },
      },
      description:
        'ปริมาณวิตามิน B1 (Thiamine) และเปอร์เซ็นต์ของค่าที่แนะนำต่อวัน',
    },
    vitamin_b2: {
      type: 'object',
      properties: {
        value: { type: 'number' },
        unit: { type: 'string' },
        dv: { type: 'number' },
      },
      description:
        'ปริมาณวิตามิน B2 (Riboflavin) และเปอร์เซ็นต์ของค่าที่แนะนำต่อวัน',
    },
    vitamin_b3: {
      type: 'object',
      properties: {
        value: { type: 'number' },
        unit: { type: 'string' },
        dv: { type: 'number' },
      },
      description:
        'ปริมาณวิตามิน B3 (Niacin) และเปอร์เซ็นต์ของค่าที่แนะนำต่อวัน',
    },
    vitamin_b5: {
      type: 'object',
      properties: {
        value: { type: 'number' },
        unit: { type: 'string' },
        dv: { type: 'number' },
      },
      description:
        'ปริมาณวิตามิน B5 (Pantothenic Acid) และเปอร์เซ็นต์ของค่าที่แนะนำต่อวัน',
    },
    vitamin_b6: {
      type: 'object',
      properties: {
        value: { type: 'number' },
        unit: { type: 'string' },
        dv: { type: 'number' },
      },
      description: 'ปริมาณวิตามิน B6 และเปอร์เซ็นต์ของค่าที่แนะนำต่อวัน',
    },
    vitamin_b9: {
      type: 'object',
      properties: {
        value: { type: 'number' },
        unit: { type: 'string' },
        dv: { type: 'number' },
      },
      description:
        'ปริมาณวิตามิน B9 (Folate) และเปอร์เซ็นต์ของค่าที่แนะนำต่อวัน',
    },
    vitamin_b12: {
      type: 'object',
      properties: {
        value: { type: 'number' },
        unit: { type: 'string' },
        dv: { type: 'number' },
      },
      description: 'ปริมาณวิตามิน B12 และเปอร์เซ็นต์ของค่าที่แนะนำต่อวัน',
    },
    calcium: {
      type: 'object',
      properties: {
        value: { type: 'number' },
        unit: { type: 'string' },
        dv: { type: 'number' },
      },
      description: 'ปริมาณแคลเซียมและเปอร์เซ็นต์ของค่าที่แนะนำต่อวัน',
    },
    iron: {
      type: 'object',
      properties: {
        value: { type: 'number' },
        unit: { type: 'string' },
        dv: { type: 'number' },
      },
      description: 'ปริมาณเหล็กและเปอร์เซ็นต์ของค่าที่แนะนำต่อวัน',
    },
    magnesium: {
      type: 'object',
      properties: {
        value: { type: 'number' },
        unit: { type: 'string' },
        dv: { type: 'number' },
      },
      description: 'ปริมาณแมกนีเซียมและเปอร์เซ็นต์ของค่าที่แนะนำต่อวัน',
    },
    potassium: {
      type: 'object',
      properties: {
        value: { type: 'number' },
        unit: { type: 'string' },
        dv: { type: 'number' },
      },
      description: 'ปริมาณโพแทสเซียมและเปอร์เซ็นต์ของค่าที่แนะนำต่อวัน',
    },
    zinc: {
      type: 'object',
      properties: {
        value: { type: 'number' },
        unit: { type: 'string' },
        dv: { type: 'number' },
      },
      description: 'ปริมาณสังกะสีและเปอร์เซ็นต์ของค่าที่แนะนำต่อวัน',
    },
    phosphorus: {
      type: 'object',
      properties: {
        value: { type: 'number' },
        unit: { type: 'string' },
        dv: { type: 'number' },
      },
      description: 'ปริมาณฟอสฟอรัสและเปอร์เซ็นต์ของค่าที่แนะนำต่อวัน',
    },
    selenium: {
      type: 'object',
      properties: {
        value: { type: 'number' },
        unit: { type: 'string' },
        dv: { type: 'number' },
      },
      description: 'ปริมาณซีลีเนียมและเปอร์เซ็นต์ของค่าที่แนะนำต่อวัน',
    },
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
    'trans_fat',
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
        fiber: {
          type: 'number',
          description: 'เป้าหมายใยอาหารต่อวัน (กรัม)',
        },
        sugar_max: {
          type: 'number',
          description: 'ปริมาณน้ำตาลสูงสุดที่แนะนำต่อวัน (กรัม)',
        },
        water: {
          type: 'number',
          description: 'เป้าหมายการดื่มน้ำต่อวัน (มิลลิลิตร)',
        },
      },
      required: ['calories', 'protein', 'carbs', 'fat'],
    },
    macro_distribution: {
      type: 'object',
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
      description: 'คำแนะนำแคลอรี่สำหรับแต่ละมื้อ',
      additionalProperties: {
        type: 'number',
      },
    },
    health_advice: {
      type: 'string',
      description: 'คำแนะนำสุขภาพสำหรับเป้าหมายนี้',
    },
    food_recommendations: {
      type: 'array',
      items: {
        type: 'string',
      },
      description: 'รายการอาหารที่แนะนำ',
    },
    foods_to_avoid: {
      type: 'array',
      items: {
        type: 'string',
      },
      description: 'รายการอาหารที่ควรหลีกเลี่ยง',
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
    calorie_consistency: {
      type: 'number',
      description: 'ความสม่ำเสมอของการบริโภคแคลอรี่ (0-1)',
    },
    meal_timings: {
      type: 'array',
      items: {
        type: 'object',
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
    most_skipped_meal: {
      type: 'string',
      description: 'มื้อที่มักจะข้ามบ่อยที่สุด',
    },
    nutrient_balance: {
      type: 'object',
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
        fiber_balance: {
          type: 'number',
          description: 'ความสมดุลของใยอาหาร (% เทียบกับเป้าหมาย)',
        },
      },
      required: ['protein_balance', 'carbs_balance', 'fat_balance'],
    },
    eating_window_hours: {
      type: 'number',
      description: 'ช่วงเวลาที่กินอาหารในแต่ละวัน (ชั่วโมง)',
    },
    late_night_eating_frequency: {
      type: 'number',
      description: 'ความถี่ของการกินอาหารดึก (0-1)',
    },
    identified_patterns: {
      type: 'array',
      items: {
        type: 'string',
      },
      description: 'รูปแบบพฤติกรรมการกินที่ระบุได้',
    },
    problematic_behaviors: {
      type: 'array',
      items: {
        type: 'string',
      },
      description: 'พฤติกรรมที่มีปัญหา',
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

// -------------------- MEAL RECOMMENDATION TOOL ---------------------
export const MEAL_RECOMMENDATION_SCHEMA = {
  type: 'object',
  properties: {
    meal_type: {
      type: 'string',
      description: 'ประเภทของมื้ออาหาร',
    },
    foods: {
      type: 'array',
      items: {
        type: 'object',
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
          benefits: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'ประโยชน์ต่อสุขภาพ',
          },
          ingredients: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'ส่วนประกอบหลัก',
          },
          preparation_time: {
            type: 'string',
            description: 'เวลาในการเตรียม',
          },
          cooking_difficulty: {
            type: 'string',
            enum: ['ง่าย', 'ปานกลาง', 'ยาก'],
            description: 'ระดับความยากในการทำ',
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
    alternatives: {
      type: 'array',
      items: {
        type: 'string',
      },
      description: 'ทางเลือกอื่นๆ',
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

// -------------------- BARCODE ANALYSIS TOOL ---------------------
export const BARCODE_ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    barcode_type: {
      type: 'string',
      description: 'ประเภทของบาร์โค้ด',
    },
    barcode_value: {
      type: 'string',
      description: 'ค่าของบาร์โค้ด',
    },
    food_info: {
      type: 'object',
      properties: {
        product_name: {
          type: 'string',
          description: 'ชื่อผลิตภัณฑ์',
        },
        brand: {
          type: 'string',
          description: 'แบรนด์',
        },
        serving_size: {
          type: 'string',
          description: 'ขนาดหนึ่งหน่วยบริโภค',
        },
        servings_per_container: {
          type: 'number',
          description: 'จำนวนหน่วยบริโภคต่อบรรจุภัณฑ์',
        },
        calories: {
          type: 'number',
          description: 'แคลอรี่ต่อหนึ่งหน่วยบริโภค',
        },
        protein: {
          type: 'number',
          description: 'โปรตีนต่อหนึ่งหน่วยบริโภค (กรัม)',
        },
        carbs: {
          type: 'number',
          description: 'คาร์โบไฮเดรตต่อหนึ่งหน่วยบริโภค (กรัม)',
        },
        fat: {
          type: 'number',
          description: 'ไขมันต่อหนึ่งหน่วยบริโภค (กรัม)',
        },
        fiber: {
          type: 'number',
          description: 'ใยอาหารต่อหนึ่งหน่วยบริโภค (กรัม)',
        },
        sugar: {
          type: 'number',
          description: 'น้ำตาลต่อหนึ่งหน่วยบริโภค (กรัม)',
        },
        saturated_fat: {
          type: 'number',
          description: 'ไขมันอิ่มตัวต่อหนึ่งหน่วยบริโภค (กรัม)',
        },
        trans_fat: {
          type: 'number',
          description: 'ไขมันทรานส์ต่อหนึ่งหน่วยบริโภค (กรัม)',
        },
        cholesterol: {
          type: 'number',
          description: 'คอเลสเตอรอลต่อหนึ่งหน่วยบริโภค (มิลลิกรัม)',
        },
        sodium: {
          type: 'number',
          description: 'โซเดียมต่อหนึ่งหน่วยบริโภค (มิลลิกรัม)',
        },
        vitamins_minerals: {
          type: 'object',
          description: 'วิตามินและแร่ธาตุ (% ของค่าที่แนะนำต่อวัน)',
          additionalProperties: {
            type: 'number',
          },
        },
        ingredients: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: 'ส่วนประกอบ',
        },
        allergens: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: 'สารก่อภูมิแพ้',
        },
        storage_instructions: {
          type: 'string',
          description: 'คำแนะนำในการเก็บรักษา',
        },
        expiration_date: {
          type: 'string',
          description: 'วันหมดอายุ',
        },
      },
      required: [
        'product_name',
        'brand',
        'serving_size',
        'calories',
        'protein',
        'carbs',
        'fat',
        'ingredients',
      ],
    },
    nutritional_rating: {
      type: 'integer',
      minimum: 1,
      maximum: 5,
      description: 'คะแนนคุณค่าทางโภชนาการ (1-5)',
    },
    health_benefits: {
      type: 'array',
      items: {
        type: 'string',
      },
      description: 'ประโยชน์ต่อสุขภาพ',
    },
    health_concerns: {
      type: 'array',
      items: {
        type: 'string',
      },
      description: 'ข้อกังวลด้านสุขภาพ',
    },
    personalized_advice: {
      type: 'string',
      description: 'คำแนะนำเฉพาะบุคคล',
    },
    alternatives: {
      type: 'array',
      items: {
        type: 'string',
      },
      description: 'ทางเลือกอื่นที่ดีกว่า',
    },
  },
  required: [
    'barcode_type',
    'barcode_value',
    'food_info',
    'nutritional_rating',
    'health_benefits',
    'health_concerns',
    'personalized_advice',
  ],
} as const

export const barcodeAnalysisTool: OpenAI.Chat.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'analyze_barcode_data',
    description:
      'Analyzes data from a food product barcode, including nutrition, ingredients, and provides initial advice. Extracts information as if from a product label or packaging.',
    parameters: BARCODE_ANALYSIS_SCHEMA,
  },
}

// -------------------- WEB SEARCH REQUEST TOOL ---------------------
export const WEB_SEARCH_REQUEST_SCHEMA = {
  type: 'object',
  properties: {
    search_query: {
      type: 'string',
      description:
        'A specific and detailed search query to find information about a food product on the web. Should include product name, brand, type, and any other identifying details from packaging or user query.',
    },
    product_name: {
      type: 'string',
      description:
        'The name of the product for which web search is being requested.',
    },
    details_from_image_or_text: {
      type: 'string',
      description:
        'Key details or observations from the image or user text that prompt the web search (e.g., "unclear packaging", "unknown brand", "user asking for specific nutrient not in database").',
    },
    language: {
      type: 'string',
      description:
        'The language code (e.g., "th", "en") for the search query and expected results. Defaults to "en" if not specified.',
    },
  },
  required: ['search_query', 'product_name', 'details_from_image_or_text'],
}

export const requestProductInfoFromWebTool: OpenAI.Chat.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'request_product_information_from_web',
    description:
      'Requests additional information about a food product by formulating a web search query. Use this when you cannot identify the product, find its nutritional details from the provided image/text, your existing knowledge, or other available tools.',
    parameters: WEB_SEARCH_REQUEST_SCHEMA,
  },
}

// Array of all tools to be used by the AI service
export const allTools: OpenAI.Chat.ChatCompletionTool[] = [
  foodAnalysisTool,
  nutritionGoalTool,
  eatingPatternTool,
  mealRecommendationTool,
  barcodeAnalysisTool,
  requestProductInfoFromWebTool,
]
