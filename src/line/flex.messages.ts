import { FlexMessage, FlexBubble, FlexComponent, Message } from '@line/bot-sdk'
import { Logger } from '@nestjs/common' // For logging errors

// --------------- LOGGER ---------------
const logger = new Logger('FlexMessages')

// --------------- FORMATTER STUBS ---------------
const formatNumber = (
  num: number | undefined | null,
  precision: number,
): string => {
  if (num === undefined || num === null) return '-'
  return num.toFixed(precision)
}

const truncateText = (
  text: string | undefined,
  maxLength: number,
  lang: string, // lang might be used for more complex truncation rules later
  t: TranslationSet, // t might be used if we add "... (see more)" in a translated way
): string => {
  if (!text) return t.not_specified
  if (text.length <= maxLength) return text
  // Basic truncation, could be made smarter (e.g., not cutting mid-word if possible)
  return text.substring(0, maxLength - 3) + '...'
}
// --------------- END FORMATTER STUBS ---------------

// --------------- MAX LENGTH CONSTANTS ---------------
const MAX_ALT_TEXT_LENGTH = 400
const MAX_POSTBACK_DATA_LENGTH = 300 // Recommended max length for postback data
const MAX_BUTTON_LABEL_LENGTH = 20
const MAX_TEXT_DISPLAY_LENGTH = 60 // For titles, descriptions etc. in the message body
const MAX_FLEX_MESSAGE_SIZE_BYTES = 48 * 1024 // 48KB (LINE limit is 50KB, leave some buffer)
// --------------- END MAX LENGTH CONSTANTS ---------------

// --------------- INTERFACES ---------------
interface FoodComponentDetail {
  name: string
  amount?: number
  unit?: string
  percentage?: number
}

export interface VitaminMineralDetail {
  // Ensure this is exported if used elsewhere
  value?: number
  unit?: string
  dv?: number // Daily Value percentage
}

export interface FoodAnalysisData {
  food_name: string
  portion?: string
  components?: FoodComponentDetail[]
  calories?: number
  protein?: number
  carbs?: number
  fat?: number
  // Fat breakdown
  saturated_fat?: number
  trans_fat?: number // เพิ่มไขมันทรานส์
  polyunsaturated_fat?: number // เพิ่มไขมันไม่อิ่มตัวหลายพันธะ
  monounsaturated_fat?: number // เพิ่มไขมันไม่อิ่มตัวเดี่ยว
  omega3?: number // เพิ่ม omega3 จาก AI tools
  cholesterol?: number
  // Carbohydrate breakdown
  fiber?: number
  sugar?: number
  added_sugar?: number // เพิ่มน้ำตาลที่เติม
  // Other nutrients
  water?: number
  sodium?: number
  potassium_nutrient?: number // เพิ่มโพแทสเซียมในส่วนสารอาหารเพิ่มเติม (แยกจาก mineral)
  // Vitamins - matching example + schema
  vitamin_a?: VitaminMineralDetail
  vitamin_c?: VitaminMineralDetail
  vitamin_d?: VitaminMineralDetail
  vitamin_e?: VitaminMineralDetail // Added
  vitamin_k?: VitaminMineralDetail // Added
  vitamin_b1?: VitaminMineralDetail // Added (Thiamine)
  vitamin_b2?: VitaminMineralDetail // Added (Riboflavin)
  vitamin_b3?: VitaminMineralDetail // Added (Niacin)
  vitamin_b5?: VitaminMineralDetail // Added (Pantothenic Acid)
  vitamin_b6?: VitaminMineralDetail // Added
  vitamin_b9?: VitaminMineralDetail // Added (Folate)
  vitamin_b12?: VitaminMineralDetail // Added
  // Minerals - matching example + schema
  calcium?: VitaminMineralDetail
  iron?: VitaminMineralDetail
  magnesium?: VitaminMineralDetail // Added
  potassium?: VitaminMineralDetail // Added (แร่ธาตุโพแทสเซียม)
  zinc?: VitaminMineralDetail // Added
  phosphorus?: VitaminMineralDetail // Added
  selenium?: VitaminMineralDetail // Added
  copper?: VitaminMineralDetail // เพิ่มทองแดง
  manganese?: VitaminMineralDetail // เพิ่มแมงกานีส
  iodine?: VitaminMineralDetail // เพิ่มไอโอดีน
  // Health Advice
  health_benefits?: string
  health_cautions?: string
  recommendation?: string
  // New fields for additional nutrients
  caffeine?: number // Added for caffeine
  alcohol?: number // Added for alcohol
  // For postback buttons
  lineUserId?: string // Optional: if needed for specific actions
  messageId?: string // For 'save_meal_image' type actions
  imageUrl?: string // For 'save_meal_image' type actions
}

interface TranslationSet {
  title: string
  portion: string
  components: string
  nutrition_section_title: string // Renamed for clarity
  macronutrients_group_title: string // Renamed for clarity
  calories: string
  protein: string
  carbs: string
  fat: string
  fat_breakdown_group_title: string // เพิ่มหัวข้อสำหรับไขมันย่อย
  saturated_fat: string
  trans_fat: string // เพิ่มไขมันทรานส์
  polyunsaturated_fat: string // เพิ่มไขมันไม่อิ่มตัวหลายพันธะ
  monounsaturated_fat: string // เพิ่มไขมันไม่อิ่มตัวเดี่ยว
  omega3: string // เพิ่ม omega3
  cholesterol: string
  carbs_breakdown_group_title: string // เพิ่มหัวข้อสำหรับคาร์โบไฮเดรตย่อย
  fiber: string
  sugar: string
  additional_nutrients_group_title: string // Added
  water: string // Added
  sodium: string
  potassium_nutrient: string // เพิ่มโพแทสเซียมในส่วนสารอาหารเพิ่มเติม
  vitamins_group_title: string // Changed to be more generic
  vitamin_a: string
  vitamin_c: string
  vitamin_d: string
  vitamin_e: string // Added
  vitamin_k: string // Added
  vitamin_b1: string // Added
  vitamin_b2: string // Added
  vitamin_b3: string // Added
  vitamin_b5: string // Added
  vitamin_b6: string // Added
  vitamin_b9: string // Added
  vitamin_b12: string // Added
  minerals_group_title: string // Changed to be more generic
  calcium: string
  iron: string
  magnesium: string // Added
  potassium: string // Added
  zinc: string // Added
  phosphorus: string // Added
  selenium: string // Added
  copper: string // เพิ่มทองแดง
  manganese: string // เพิ่มแมงกานีส
  iodine: string // เพิ่มไอโอดีน
  health_advice_section_title: string // Renamed for clarity
  benefits_subtitle: string // Renamed for clarity
  cautions_subtitle: string // Renamed for clarity
  recommendation_subtitle: string // Renamed for clarity
  save_food_button: string // Renamed for clarity
  view_details_button: string // REMOVE THIS or RENAME
  view_vitamins_minerals_button: string // ADDED
  vitamins_minerals_summary_text: string // ADDED: For placeholder text
  edit_food_button: string // Added
  not_specified: string
  unit_g: string
  unit_mg: string
  unit_mcg: string // Added for vitamins like B12, Selenium etc.
  unit_iu: string // Added for vitamins like A, D, E
  unit_ml: string // Added for water
  unit_kcal: string
  unit_percent: string
  dv_label: string // Added for "DV"
  caffeineLabel: string // Added for caffeine
  alcoholLabel: string // Added for alcohol
  error_fallback_title: string
  error_fallback_text: string
}

const translations: Record<string, TranslationSet> = {
  th: {
    title: '🍽️ วิเคราะห์อาหาร',
    portion: 'ปริมาณ',
    components: '📋 ส่วนประกอบหลัก',
    nutrition_section_title: '📊 คุณค่าทางโภชนาการ',
    macronutrients_group_title: 'สารอาหารหลัก',
    calories: 'แคลอรี่',
    protein: 'โปรตีน',
    carbs: 'คาร์โบไฮเดรต',
    fat: 'ไขมัน',
    fat_breakdown_group_title: 'ไขมันย่อย',
    saturated_fat: 'ไขมันอิ่มตัว',
    trans_fat: 'ไขมันทรานส์',
    polyunsaturated_fat: 'ไขมันไม่อิ่มตัวเชิงซ้อน',
    monounsaturated_fat: 'ไขมันไม่อิ่มตัวเชิงเดี่ยว',
    omega3: 'omega3',
    cholesterol: 'คอเลสเตอรอล',
    carbs_breakdown_group_title: 'คาร์โบไฮเดรตย่อย',
    fiber: 'ใยอาหาร',
    sugar: 'น้ำตาล',
    additional_nutrients_group_title: 'สารอาหารเพิ่มเติม',
    water: 'น้ำ',
    sodium: 'โซเดียม',
    potassium_nutrient: 'โพแทสเซียม',
    vitamins_group_title: '🌈 วิตามิน',
    vitamin_a: 'วิตามิน A',
    vitamin_c: 'วิตามิน C',
    vitamin_d: 'วิตามิน D',
    vitamin_e: 'วิตามิน E',
    vitamin_k: 'วิตามิน K',
    vitamin_b1: 'วิตามิน B1', // Thiamine
    vitamin_b2: 'วิตามิน B2', // Riboflavin
    vitamin_b3: 'วิตามิน B3', // Niacin
    vitamin_b5: 'วิตามิน B5', // Pantothenic Acid
    vitamin_b6: 'วิตามิน B6',
    vitamin_b9: 'วิตามิน B9', // Folate
    vitamin_b12: 'วิตามิน B12',
    minerals_group_title: '🧪 แร่ธาตุ',
    calcium: 'แคลเซียม',
    iron: 'เหล็ก',
    magnesium: 'แมกนีเซียม',
    potassium: 'โพแทสเซียม',
    zinc: 'สังกะสี',
    phosphorus: 'ฟอสฟอรัส',
    selenium: 'ซีลีเนียม',
    copper: 'ทองแดง',
    manganese: 'แมงกานีส',
    iodine: 'ไอโอดีน',
    health_advice_section_title: '💡 คำแนะนำสุขภาพ',
    benefits_subtitle: 'ประโยชน์ต่อสุขภาพ',
    cautions_subtitle: 'ข้อควรระวัง',
    recommendation_subtitle: 'คำแนะนำเพิ่มเติม',
    save_food_button: 'บันทึกมื้ออาหาร',
    view_details_button: 'ดูรายละเอียดทั้งหมด', // Kept for now, but likely unused due to vitamin/mineral button
    view_vitamins_minerals_button: 'ดูวิตามินและแร่ธาตุ',
    vitamins_minerals_summary_text:
      'มีวิตามินและแร่ธาตุหลายชนิด กดปุ่มเพื่อดูเพิ่มเติม',
    edit_food_button: 'วิเคราะห์ใหม่',
    not_specified: 'ไม่ระบุ',
    unit_g: 'ก.',
    unit_mg: 'มก.',
    unit_mcg: 'มคก.',
    unit_iu: 'IU',
    unit_ml: 'มล.',
    unit_kcal: 'kcal',
    unit_percent: '%',
    dv_label: 'DV', // Daily Value
    caffeineLabel: 'คาเฟอีน', // Added for caffeine
    alcoholLabel: 'แอลกอฮอล์', // Added for alcohol
    error_fallback_title: 'เกิดข้อผิดพลาด',
    error_fallback_text:
      'ไม่สามารถแสดงผลวิเคราะห์อาหารได้ในขณะนี้ โปรดลองอีกครั้ง',
  },
  en: {
    title: '🍽️ Food Analysis',
    portion: 'Portion',
    components: '📋 Main Ingredients',
    nutrition_section_title: '📊 Nutritional Information',
    macronutrients_group_title: 'Macronutrients',
    calories: 'Calories',
    protein: 'Protein',
    carbs: 'Carbohydrates',
    fat: 'Fat',
    fat_breakdown_group_title: 'Fat Breakdown',
    saturated_fat: 'Saturated Fat',
    trans_fat: 'Trans Fat',
    polyunsaturated_fat: 'Polyunsaturated Fat',
    monounsaturated_fat: 'Monounsaturated Fat',
    omega3: 'Omega-3 Fatty Acids',
    cholesterol: 'Cholesterol',
    carbs_breakdown_group_title: 'Carbohydrate Breakdown',
    fiber: 'Fiber',
    sugar: 'Sugar',
    additional_nutrients_group_title: 'Additional Nutrients',
    water: 'Water',
    sodium: 'Sodium',
    potassium_nutrient: 'Potassium',
    vitamins_group_title: '🌈 Vitamins',
    vitamin_a: 'Vitamin A',
    vitamin_c: 'Vitamin C',
    vitamin_d: 'Vitamin D',
    vitamin_e: 'Vitamin E',
    vitamin_k: 'Vitamin K',
    vitamin_b1: 'Vitamin B1', // Thiamine
    vitamin_b2: 'Vitamin B2', // Riboflavin
    vitamin_b3: 'Vitamin B3', // Niacin
    vitamin_b5: 'Vitamin B5', // Pantothenic Acid
    vitamin_b6: 'Vitamin B6',
    vitamin_b9: 'Vitamin B9', // Folate
    vitamin_b12: 'Vitamin B12',
    minerals_group_title: '🧪 Minerals',
    calcium: 'Calcium',
    iron: 'Iron',
    magnesium: 'Magnesium',
    potassium: 'Potassium',
    zinc: 'Zinc',
    phosphorus: 'Phosphorus',
    selenium: 'Selenium',
    copper: 'Copper',
    manganese: 'Manganese',
    iodine: 'Iodine',
    health_advice_section_title: '💡 Health Advice',
    benefits_subtitle: 'Health Benefits',
    cautions_subtitle: 'Health Cautions',
    recommendation_subtitle: 'Recommendations',
    save_food_button: 'Save this Analysis',
    view_details_button: 'View Full Details',
    view_vitamins_minerals_button: 'Vitamins&Minerals',
    vitamins_minerals_summary_text:
      'Contains various vitamins and minerals. Press button to see details.',
    edit_food_button: 'Reanalyze',
    not_specified: 'Not specified',
    unit_g: 'g',
    unit_mg: 'mg',
    unit_mcg: 'µg', // Using µ for micro
    unit_iu: 'IU',
    unit_ml: 'ml',
    unit_kcal: 'kcal',
    unit_percent: '%',
    dv_label: 'DV',
    caffeineLabel: 'Caffeine', // Added for caffeine
    alcoholLabel: 'Alcohol', // Added for alcohol
    error_fallback_title: 'An Error Occurred',
    error_fallback_text:
      'Could not display food analysis at this time. Please try again.',
  },
}

// Helper to get translated nutrient names for dynamic rendering in LineService
export const getTranslatedNutritionLabel = (
  key: string,
  lang: string,
): string => {
  const effectiveLang = lang in translations ? lang : 'en'
  const t = translations[effectiveLang]
  if (key in t) {
    return t[key as keyof TranslationSet] // Safer access
  }
  return key // Fallback to key if translation not found
}

const getUnitLabel = (
  unit: string | undefined,
  lang: string,
  t: TranslationSet,
): string => {
  if (!unit) return ''
  switch (unit.toLowerCase()) {
    case 'g':
      return t.unit_g
    case 'mg':
      return t.unit_mg
    case 'mcg':
    case 'µg':
      return t.unit_mcg
    case 'iu':
      return t.unit_iu
    case 'ml':
    case 'มล.':
      return t.unit_ml
    case 'kcal':
      return t.unit_kcal
    case '%':
      return t.unit_percent
    default:
      return unit // Return the original unit if no translation
  }
}

// Helper function to create a row for a nutrient with label and value
const createNutrientRow = (
  label: string,
  value: string | undefined | null,
  unitLabel: string, // Expecting translated unit or empty string
  t: TranslationSet,
  labelFlex = 4, // Flex for label part
  valueFlex = 3, // Flex for value part
): FlexComponent => {
  const valueText =
    value === undefined || value === null || value.trim() === '-'
      ? t.not_specified
      : `${value} ${unitLabel}`.trim()

  return {
    type: 'box',
    layout: 'horizontal',
    margin: 'sm',
    contents: [
      {
        type: 'text',
        text: label,
        size: 'sm',
        color: '#555555',
        flex: labelFlex,
        wrap: true,
      },
      {
        type: 'text',
        text: valueText,
        size: 'sm',
        color: '#111111',
        align: 'end',
        flex: valueFlex,
        wrap: true,
      },
    ],
  }
}

// Helper function to create a row for vitamin/mineral with %DV display
const _createVitaminMineralRow = (
  label: string,
  detail: VitaminMineralDetail | undefined,
  t: TranslationSet,
  language: string,
  labelFlex = 2, // Flex for label part
  valueFlex = 3, // Flex for value part
): FlexComponent | null => {
  if (!detail || detail.value === undefined || detail.value === null) {
    return null
  }

  let valueText = `${formatNumber(detail.value, 1)} ${getUnitLabel(detail.unit, language, t)}`

  // เพิ่ม %DV ถ้ามี
  if (detail.dv !== undefined && detail.dv !== null) {
    valueText += ` (${formatNumber(detail.dv, 0)}${t.unit_percent}${t.dv_label})`
  }

  return {
    type: 'box',
    layout: 'horizontal',
    margin: 'sm',
    contents: [
      {
        type: 'text',
        text: label,
        size: 'sm',
        color: '#555555',
        flex: labelFlex,
        wrap: true,
      },
      {
        type: 'text',
        text: valueText,
        size: 'sm',
        color: '#111111',
        align: 'end',
        flex: valueFlex,
        wrap: true,
      },
    ],
  }
}

export function createFoodAnalysisFlexMessage(
  foodData: FoodAnalysisData,
  language = 'th',
): Message {
  const t = translations[language] || translations.th

  logger.log(
    `Creating FoodAnalysisFlexMessage for: "${foodData.food_name}" (Length: ${foodData.food_name?.length || 0})`,
  )
  logger.debug(
    `Input health_benefits length: ${foodData.health_benefits?.length || 0}`,
  )
  logger.debug(
    `Input health_cautions length: ${foodData.health_cautions?.length || 0}`,
  )
  logger.debug(
    `Input recommendation length: ${foodData.recommendation?.length || 0}`,
  )
  logger.debug(`Input messageId: ${foodData.messageId}`)
  logger.debug(`Input imageUrl: ${foodData.imageUrl}`)
  logger.debug(`Input lineUserId: ${foodData.lineUserId}`)

  const truncatedFoodNameForDisplay = truncateText(
    foodData.food_name,
    MAX_TEXT_DISPLAY_LENGTH,
    language,
    t,
  )
  const truncatedFoodNameForAltText = truncateText(
    foodData.food_name,
    MAX_ALT_TEXT_LENGTH,
    language,
    t,
  )

  const altText = t.title + ': ' + truncatedFoodNameForAltText

  const bodyContents: FlexComponent[] = []

  // ✅ เพิ่มการแสดงภาพอาหาร (ถ้ามี)
  if (foodData.imageUrl) {
    logger.debug(
      `Adding food image to flex message: ${foodData.imageUrl.substring(0, 50)}...`,
    )
    bodyContents.push({
      type: 'image',
      url: foodData.imageUrl,
      size: 'full',
      aspectRatio: '3:2', // อัตราส่วนที่เหมาะสมสำหรับอาหาร
      aspectMode: 'cover', // ให้ภาพครอบคลุมพื้นที่ทั้งหมด
      margin: 'none',
      action: {
        type: 'uri',
        uri: foodData.imageUrl, // คลิกเพื่อดูภาพขนาดเต็ม
        label: language === 'th' ? 'ดูภาพขนาดเต็ม' : 'View full image', // เพิ่ม label ตาม LINE SDK requirement
      },
    })
    // เพิ่ม separator หลังภาพ
    bodyContents.push({ type: 'separator', margin: 'lg' })
  }

  // Common parameters for postback actions, ensuring messageId is prioritized
  const commonPostbackParams = new URLSearchParams()
  if (foodData.messageId) {
    commonPostbackParams.append('messageId', foodData.messageId)
    // If messageId is present, we can fetch foodName and other details from cache,
    // and userId is available from the webhook event.
    // So, no need to add foodData.food_name or foodData.lineUserId to commonPostbackParams here
    // to save space in postback data.
  } else {
    // Fallback if messageId is somehow not available (though it should be)
    // This might still lead to long postback data if foodName is long.
    commonPostbackParams.append('foodName', foodData.food_name)
    if (foodData.lineUserId) {
      commonPostbackParams.append('userId', foodData.lineUserId)
    }
    logger.warn(
      'messageId not found in foodData for commonPostbackParams. Postback data might be too long or incomplete.',
    )
  }

  // Section: Components (Main Ingredients)
  if (foodData.components && foodData.components.length > 0) {
    bodyContents.push({
      type: 'text',
      text: t.components,
      weight: 'bold',
      size: 'md',
      margin: 'md',
      color: '#1DB446', // Theme color
    })
    foodData.components.forEach((component) => {
      const componentName = truncateText(component.name, 50, language, t) // Truncate component name
      let componentAmountText = component.amount
        ? `${formatNumber(component.amount, 1)} ${getUnitLabel(component.unit, language, t)}`
        : t.not_specified
      if (component.percentage !== undefined && component.percentage !== null) {
        componentAmountText += ` (${formatNumber(component.percentage, 0)}${getUnitLabel('%', language, t)})`
      }
      bodyContents.push(
        createNutrientRow(componentName, componentAmountText, '', t, 3, 3), // unitLabel is part of componentAmountText
      )
    })
    bodyContents.push({ type: 'separator', margin: 'lg' })
  }

  // Section: Nutritional Information
  bodyContents.push({
    type: 'text',
    text: t.nutrition_section_title,
    weight: 'bold',
    size: 'lg',
    margin: 'lg',
    color: '#1DB446',
  })

  // Sub-section: Macronutrients
  bodyContents.push({
    type: 'text',
    text: t.macronutrients_group_title,
    weight: 'bold',
    size: 'md',
    margin: 'md',
    color: '#4A90E2', // Secondary theme color
  })

  bodyContents.push(
    createNutrientRow(
      t.calories,
      formatNumber(foodData.calories, 0),
      getUnitLabel(t.unit_kcal, language, t),
      t,
    ),
  )
  bodyContents.push(
    createNutrientRow(
      t.protein,
      formatNumber(foodData.protein, 1),
      getUnitLabel(t.unit_g, language, t),
      t,
    ),
  )
  bodyContents.push(
    createNutrientRow(
      t.carbs,
      formatNumber(foodData.carbs, 1),
      getUnitLabel(t.unit_g, language, t),
      t,
    ),
  )
  bodyContents.push(
    createNutrientRow(
      t.fat,
      formatNumber(foodData.fat, 1),
      getUnitLabel(t.unit_g, language, t),
      t,
    ),
  )

  // Sub-section: Fat Breakdown
  const fatBreakdownExists =
    foodData.saturated_fat !== undefined ||
    foodData.trans_fat !== undefined ||
    foodData.polyunsaturated_fat !== undefined ||
    foodData.monounsaturated_fat !== undefined ||
    foodData.omega3 !== undefined ||
    foodData.cholesterol !== undefined

  if (fatBreakdownExists) {
    bodyContents.push({ type: 'separator', margin: 'md' })
    bodyContents.push({
      type: 'text',
      text: t.fat_breakdown_group_title,
      weight: 'bold',
      size: 'sm',
      margin: 'sm',
      color: '#6B73FF', // Tertiary theme color
    })

    if (foodData.saturated_fat !== undefined)
      bodyContents.push(
        createNutrientRow(
          `  ${t.saturated_fat}`, // เพิ่ม indent
          formatNumber(foodData.saturated_fat, 1),
          getUnitLabel(t.unit_g, language, t),
          t,
        ),
      )
    if (foodData.trans_fat !== undefined)
      bodyContents.push(
        createNutrientRow(
          `  ${t.trans_fat}`, // เพิ่ม indent
          formatNumber(foodData.trans_fat, 1),
          getUnitLabel(t.unit_g, language, t),
          t,
        ),
      )
    if (foodData.polyunsaturated_fat !== undefined)
      bodyContents.push(
        createNutrientRow(
          `  ${t.polyunsaturated_fat}`, // เพิ่ม indent
          formatNumber(foodData.polyunsaturated_fat, 1),
          getUnitLabel(t.unit_g, language, t),
          t,
        ),
      )
    if (foodData.monounsaturated_fat !== undefined)
      bodyContents.push(
        createNutrientRow(
          `  ${t.monounsaturated_fat}`, // เพิ่ม indent
          formatNumber(foodData.monounsaturated_fat, 1),
          getUnitLabel(t.unit_g, language, t),
          t,
        ),
      )
    if (foodData.omega3 !== undefined)
      bodyContents.push(
        createNutrientRow(
          `  ${t.omega3}`, // เพิ่ม indent
          formatNumber(foodData.omega3, 1),
          getUnitLabel(t.unit_g, language, t),
          t,
        ),
      )
    if (foodData.cholesterol !== undefined)
      bodyContents.push(
        createNutrientRow(
          t.cholesterol,
          formatNumber(foodData.cholesterol, 0),
          getUnitLabel(t.unit_mg, language, t),
          t,
        ),
      )
  }

  // Sub-section: Carbohydrate Breakdown
  const carbsBreakdownExists =
    foodData.fiber !== undefined ||
    foodData.sugar !== undefined ||
    foodData.added_sugar !== undefined

  if (carbsBreakdownExists) {
    bodyContents.push({ type: 'separator', margin: 'md' })
    bodyContents.push({
      type: 'text',
      text: t.carbs_breakdown_group_title,
      weight: 'bold',
      size: 'sm',
      margin: 'sm',
      color: '#6B73FF', // Tertiary theme color
    })

    if (foodData.fiber !== undefined)
      bodyContents.push(
        createNutrientRow(
          `  ${t.fiber}`, // เพิ่ม indent
          formatNumber(foodData.fiber, 1),
          getUnitLabel(t.unit_g, language, t),
          t,
        ),
      )
    if (foodData.sugar !== undefined)
      bodyContents.push(
        createNutrientRow(
          `  ${t.sugar}`, // เพิ่ม indent
          formatNumber(foodData.sugar, 1),
          getUnitLabel(t.unit_g, language, t),
          t,
        ),
      )
  }

  // Sub-section: Additional Nutrients
  const additionalNutrientsExist =
    foodData.water !== undefined ||
    foodData.sodium !== undefined ||
    foodData.potassium_nutrient !== undefined ||
    foodData.caffeine !== undefined ||
    foodData.alcohol !== undefined

  if (additionalNutrientsExist) {
    bodyContents.push({ type: 'separator', margin: 'lg' })
    bodyContents.push({
      type: 'text',
      text: t.additional_nutrients_group_title,
      weight: 'bold',
      size: 'md',
      margin: 'md',
      color: '#4A90E2', // Secondary theme color
    })

    if (foodData.water !== undefined)
      bodyContents.push(
        createNutrientRow(
          t.water,
          formatNumber(foodData.water, 0),
          getUnitLabel(t.unit_ml, language, t),
          t,
        ),
      )
    if (foodData.sodium !== undefined)
      bodyContents.push(
        createNutrientRow(
          t.sodium,
          formatNumber(foodData.sodium, 0),
          getUnitLabel(t.unit_mg, language, t),
          t,
        ),
      )
    if (foodData.potassium_nutrient !== undefined)
      bodyContents.push(
        createNutrientRow(
          t.potassium_nutrient,
          formatNumber(foodData.potassium_nutrient, 0),
          getUnitLabel(t.unit_mg, language, t),
          t,
        ),
      )
    if (foodData.caffeine !== undefined)
      bodyContents.push(
        createNutrientRow(
          t.caffeineLabel,
          formatNumber(foodData.caffeine, 0),
          getUnitLabel(t.unit_mg, language, t),
          t,
        ),
      )
    if (foodData.alcohol !== undefined)
      bodyContents.push(
        createNutrientRow(
          t.alcoholLabel,
          formatNumber(foodData.alcohol, 1),
          getUnitLabel(t.unit_g, language, t),
          t,
        ),
      )
  }

  // Section: Health Advice
  if (
    foodData.health_benefits ||
    foodData.health_cautions ||
    foodData.recommendation
  ) {
    bodyContents.push({ type: 'separator', margin: 'lg' })
    bodyContents.push({
      type: 'text',
      text: t.health_advice_section_title,
      weight: 'bold',
      size: 'md',
      margin: 'md',
      color: '#1DB446', // Theme color
    })
    if (foodData.health_benefits) {
      bodyContents.push(
        {
          type: 'text',
          text: t.benefits_subtitle,
          weight: 'bold',
          size: 'sm',
          margin: 'sm',
          color: '#333333',
        },
        {
          type: 'text',
          text: truncateText(foodData.health_benefits, 300, language, t),
          size: 'sm',
          color: '#555555',
          wrap: true,
          margin: 'sm',
        },
      )
    }
    if (foodData.health_cautions) {
      bodyContents.push(
        {
          type: 'text',
          text: t.cautions_subtitle,
          weight: 'bold',
          size: 'sm',
          margin: 'sm',
          color: '#333333',
        },
        {
          type: 'text',
          text: truncateText(foodData.health_cautions, 300, language, t),
          size: 'sm',
          color: '#555555',
          wrap: true,
          margin: 'sm',
        },
      )
    }
    if (foodData.recommendation) {
      bodyContents.push(
        {
          type: 'text',
          text: t.recommendation_subtitle,
          weight: 'bold',
          size: 'sm',
          margin: 'sm',
          color: '#333333',
        },
        {
          type: 'text',
          text: truncateText(foodData.recommendation, 300, language, t),
          size: 'sm',
          color: '#555555',
          wrap: true,
          margin: 'sm',
        },
      )
    }
  }

  // Section: Vitamins & Minerals Summary (Placeholder Text and Button) - Text was removed from body.
  // The button in the footer for viewing vitamins/minerals is always present.
  // Thus, explicit checks for hasVitamins/hasMinerals are not currently used for conditional rendering here.
  /*
  const vitaminKeys = [
    'vitamin_a', 'vitamin_c', 'vitamin_d', 'vitamin_e', 'vitamin_k',
    'vitamin_b1', 'vitamin_b2', 'vitamin_b3', 'vitamin_b5', 'vitamin_b6',
    'vitamin_b9', 'vitamin_b12',
  ];
  const mineralKeys = [
    'calcium', 'iron', 'magnesium', 'potassium', 'zinc', 'phosphorus', 'selenium'
  ];

  const hasVitamins = vitaminKeys.some(key => 
    foodData[key as keyof FoodAnalysisData] && 
    typeof foodData[key as keyof FoodAnalysisData] === 'object' && 
    (foodData[key as keyof FoodAnalysisData] as VitaminMineralDetail)?.value !== undefined
  );

  const hasMinerals = mineralKeys.some(key => 
    foodData[key as keyof FoodAnalysisData] && 
    typeof foodData[key as keyof FoodAnalysisData] === 'object' && 
    (foodData[key as keyof FoodAnalysisData] as VitaminMineralDetail)?.value !== undefined
  );
  */

  const createActionButton = (
    label: string,
    actionType: string,
    buttonStyle: 'primary' | 'secondary' | 'link' = 'link',
    additionalParams?: Record<string, string>,
  ): FlexComponent | null => {
    const params = new URLSearchParams(commonPostbackParams.toString()) // Clone common params
    params.set('action', actionType)

    if (additionalParams) {
      for (const key in additionalParams) {
        params.append(key, additionalParams[key])
      }
    }

    // Special handling for analyze_again: it might need original text or image
    // If messageId is the primary key, specific content for re-analysis
    // like original text query or image URL should be retrieved via cache using messageId,
    // or if small enough, passed directly.
    // The current commonPostbackParams relies on messageId to fetch context if available.
    // If text or imageUrl are small and essential AND messageId isn't enough, they could be added.
    // Example: if 'analyze_again' needed the original image URL not derivable from messageId alone:
    // if (actionType === 'analyze_again') { // analyze_again is not part of the main 3 buttons for now
    //   if (foodData.imageUrl && !params.has('imageUrl')) {
    //     // params.append('imageUrl', foodData.imageUrl);
    //   }
    // }

    const postbackData = params.toString()

    if (postbackData.length > MAX_POSTBACK_DATA_LENGTH) {
      logger.warn(
        `${label} postback data is too long: ${postbackData.length} chars. Data: ${postbackData}`,
      )
      // return null; // Option to not render the button
    }

    return {
      type: 'button',
      action: {
        type: 'postback',
        label: truncateText(label, MAX_BUTTON_LABEL_LENGTH, language, t),
        data: postbackData,
      },
      style: buttonStyle,
      height: 'sm',
      // margin: 'sm', // Removed, rely on footer spacing
    }
  }

  const buttons: FlexComponent[] = []

  // New order and styles for buttons:
  // 1. View Vitamins & Minerals (Secondary)
  const viewVitaminsAction = createActionButton(
    t.view_vitamins_minerals_button,
    'view_vitamins_minerals',
    'secondary',
  )
  if (viewVitaminsAction) buttons.push(viewVitaminsAction)

  // 2. Edit Food (Secondary) - Uncommented
  const editFoodAction = createActionButton(
    t.edit_food_button,
    'reanalyze_food',
    'secondary',
  )
  if (editFoodAction) buttons.push(editFoodAction)

  // 3. Save Food (Primary) - Uncommented
  const saveFoodAction = createActionButton(
    t.save_food_button, // Label now "บันทึกมื้ออาหาร"
    'save_food_analysis',
    'primary',
    {
      mealType: 'breakfast', // ค่าเริ่มต้นเป็นมื้อเช้า
    },
  )

  if (saveFoodAction) buttons.push(saveFoodAction)

  // --- Analyze Again Button --- REMOVED from main button set for footer
  // const analyzeAgainAction = createActionButton(
  //   language === 'th' ? 'วิเคราะห์อีกครั้ง' : 'Analyze Again',
  //   'analyze_again',
  //   'link', // Kept as link if it were to be used elsewhere
  //   analyzeAgainParams,
  // )
  // if (analyzeAgainAction) buttons.push(analyzeAgainAction) // Not adding to the primary 'buttons' array

  // REMOVE the block that adds buttons to bodyContents
  // if (buttons.length > 0) {
  //   bodyContents.push({
  //     type: 'separator',
  //     margin: 'lg',
  //   })
  //   bodyContents.push({
  //     type: 'box',
  //     layout: 'horizontal',
  //     margin: 'sm',
  //     contents: buttons,
  //   })
  // }

  const flexMessage: FlexMessage = {
    type: 'flex',
    altText: altText, // Required
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '20px',
        backgroundColor: '#1DB446',
        contents: [
          {
            type: 'text',
            text: truncatedFoodNameForDisplay,
            color: '#FFFFFF',
            size: 'xl',
            weight: 'bold',
            wrap: true,
          },
          {
            type: 'text',
            text: foodData.portion
              ? `${t.portion}: ${truncateText(foodData.portion, 40, language, t)}`
              : '',
            color: '#FFFFFFCC',
            size: 'sm',
            margin: 'md',
            wrap: true,
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md', // Consistent spacing for body sections
        contents: bodyContents, // All dynamic content now in bodyContents
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm', // spacing for footer buttons
        contents: buttons, // Use the reordered and styled buttons
      },
    },
  }

  // Log final JSON payload size
  const jsonString = JSON.stringify(flexMessage)
  const jsonSize = Buffer.byteLength(jsonString, 'utf8')
  logger.log(
    `Flex Message for "${foodData.food_name}" created. JSON size: ${jsonSize} bytes.`,
  )
  if (jsonSize > MAX_FLEX_MESSAGE_SIZE_BYTES) {
    logger.error(
      `CRITICAL: Flex Message for "${foodData.food_name}" is TOO LARGE: ${jsonSize} bytes. Max allowed: ${MAX_FLEX_MESSAGE_SIZE_BYTES} bytes. Message might be rejected by LINE.`,
    )
    // Fallback or error handling might be needed here in a real app
    // For now, just log an error. The message will still be returned.
  }

  return flexMessage as Message // Cast to Message type expected by SDK
}

// Fallback message if FoodAnalysisData is incomplete or processing fails
export function createErrorFlexMessage(language = 'th'): Message {
  const t = translations[language] || translations.th
  const flexMessage: FlexMessage = {
    type: 'flex',
    altText: t.error_fallback_title,
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          {
            type: 'text',
            text: t.error_fallback_title,
            weight: 'bold',
            size: 'xl',
            color: '#FF0000', // Red for error
            align: 'center',
          },
          {
            type: 'text',
            text: t.error_fallback_text,
            wrap: true,
            size: 'md',
            align: 'center',
            margin: 'md',
          },
        ],
      },
    },
  }
  // Log the generated JSON for debugging purposes
  console.log(
    'Generated Error Flex Message JSON:',
    JSON.stringify(flexMessage, null, 2),
  )
  return flexMessage as Message
}

// New function to create a Flex Message for Vitamin and Mineral Details
export function createVitaminMineralDetailsFlexMessage(
  foodName: string,
  vitamins: Record<string, VitaminMineralDetail>,
  minerals: Record<string, VitaminMineralDetail>,
  language = 'th',
  // Add these if they are needed for postback actions from this message
  // originalMessageId?: string,
  // originalImageUrl?: string,
  // lineUserId?: string
): Message {
  const t = translations[language] || translations.th
  logger.log(`Creating VitaminMineralDetailsFlexMessage for: "${foodName}"`)

  const truncatedFoodNameForDisplay = truncateText(
    foodName,
    MAX_TEXT_DISPLAY_LENGTH,
    language,
    t,
  )
  const altText =
    t.vitamins_group_title +
    ' & ' +
    t.minerals_group_title +
    ': ' +
    truncateText(foodName, MAX_ALT_TEXT_LENGTH - 50, language, t)

  const bodyContents: FlexComponent[] = []

  const nutrientDetailRow = (
    nutrientKey: string, // e.g., 'vitamin_a', 'calcium'
    detail: VitaminMineralDetail | undefined,
  ): FlexComponent[] => {
    if (!detail || detail.value === undefined || detail.value === null) {
      return []
    }
    const label = getTranslatedNutritionLabel(nutrientKey, language)
    let valueText = `${formatNumber(detail.value, 1)} ${getUnitLabel(detail.unit, language, t)}`
    if (detail.dv !== undefined && detail.dv !== null) {
      valueText += ` (${formatNumber(detail.dv, 0)}${t.unit_percent}${t.dv_label})`
    }
    return [
      {
        type: 'box',
        layout: 'horizontal',
        margin: 'sm',
        contents: [
          {
            type: 'text',
            text: label,
            size: 'sm',
            color: '#555555',
            flex: 2,
            wrap: true,
          },
          {
            type: 'text',
            text: valueText,
            size: 'sm',
            color: '#111111',
            align: 'end',
            flex: 3,
            wrap: true,
          },
        ],
      },
    ]
  }

  // Vitamins Section
  const vitaminKeys = Object.keys(vitamins)
  const activeVitaminKeys = vitaminKeys.filter(
    (key) =>
      vitamins[key] &&
      vitamins[key].value !== undefined &&
      vitamins[key].value !== null,
  )

  if (activeVitaminKeys.length > 0) {
    bodyContents.push({
      type: 'text',
      text: t.vitamins_group_title,
      weight: 'bold',
      size: 'md',
      margin: 'md',
      color: '#1DB446',
    })
    activeVitaminKeys.forEach((key) => {
      bodyContents.push(...nutrientDetailRow(key, vitamins[key]))
    })
  }

  // Minerals Section
  const mineralKeys = Object.keys(minerals)
  const activeMineralKeys = mineralKeys.filter(
    (key) =>
      minerals[key] &&
      minerals[key].value !== undefined &&
      minerals[key].value !== null,
  )

  if (activeMineralKeys.length > 0) {
    if (activeVitaminKeys.length > 0) {
      // Add separator if vitamins were shown
      bodyContents.push({ type: 'separator', margin: 'lg' })
    }
    bodyContents.push({
      type: 'text',
      text: t.minerals_group_title,
      weight: 'bold',
      size: 'md',
      margin: 'md',
      color: '#1DB446',
    })
    activeMineralKeys.forEach((key) => {
      bodyContents.push(...nutrientDetailRow(key, minerals[key]))
    })
  }

  if (bodyContents.length === 0) {
    // Fallback if no vitamin or mineral data is actually present to display
    bodyContents.push({
      type: 'text',
      text:
        language === 'th'
          ? 'ไม่มีข้อมูลวิตามินและแร่ธาตุ'
          : 'No vitamin and mineral data available.',
      size: 'sm',
      color: '#555555',
      wrap: true,
      align: 'center',
      margin: 'md',
    })
  }

  const bubble: FlexBubble = {
    type: 'bubble',
    header: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '20px',
      backgroundColor: '#4A90E2', // Using a different color for distinction
      contents: [
        {
          type: 'text',
          text: truncatedFoodNameForDisplay,
          color: '#FFFFFF',
          size: 'xl',
          weight: 'bold',
          wrap: true,
        },
        {
          type: 'text',
          text:
            language === 'th'
              ? 'รายละเอียดวิตามินและแร่ธาตุ'
              : 'Vitamins & Minerals Details',
          color: '#FFFFFFCC',
          size: 'sm',
          margin: 'md',
          wrap: true,
        },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      contents: bodyContents,
    },
    // No footer as per requirement
  }

  const flexMessage: FlexMessage = {
    type: 'flex',
    altText: altText,
    contents: bubble,
  }

  console.log(
    'Generated Vitamin/Mineral Details Flex Message JSON:',
    JSON.stringify(flexMessage, null, 2),
  )

  // Log final JSON payload size for this message type too
  const jsonString = JSON.stringify(flexMessage)
  const jsonSize = Buffer.byteLength(jsonString, 'utf8')
  logger.log(
    `VitaminMineralDetails Flex Message for "${foodName}" created. JSON size: ${jsonSize} bytes.`,
  )
  if (jsonSize > MAX_FLEX_MESSAGE_SIZE_BYTES) {
    logger.error(
      `CRITICAL: VitaminMineralDetails Flex Message for "${foodName}" is TOO LARGE: ${jsonSize} bytes. Max allowed: ${MAX_FLEX_MESSAGE_SIZE_BYTES} bytes. Message might be rejected by LINE.`,
    )
  }
  return flexMessage as Message
}

// Ensure all exported functions and interfaces are correctly defined.
// Review if any other functions creating messages need similar treatment for size logging and truncation.
