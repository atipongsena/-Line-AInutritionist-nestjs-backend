// Nutrition Calculator Utilities
// Based on scientific formulas for BMR, TDEE, and macro distribution

export interface UserProfile {
  gender: 'male' | 'female' | 'other'
  age: number
  weightKg: number
  heightCm: number
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
  goal: 'lose_weight' | 'maintain_weight' | 'gain_weight' | 'build_muscle'
  dietType?: 'normal' | 'keto' | 'vegetarian' | 'vegan' | 'mediterranean'
}

export interface NutritionGoals {
  calories: number
  protein: number // grams
  carbs: number // grams
  fat: number // grams
  fiber: number // grams
  sugar: number // grams (max recommended)
  sodium: number // mg (max recommended)
  water: number // ml
  cholesterol: number // mg (max recommended)
  saturated_fat: number // grams (max recommended)
  omega3: number // grams (min recommended)
}

// Activity level multipliers for TDEE calculation
const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2, // Little to no exercise
  light: 1.375, // Light exercise 1-3 days/week
  moderate: 1.55, // Moderate exercise 3-5 days/week
  active: 1.725, // Heavy exercise 6-7 days/week
  very_active: 1.9, // Very heavy exercise, physical job
} as const

// Goal adjustments (calorie surplus/deficit)
const GOAL_ADJUSTMENTS = {
  lose_weight: -500, // 500 calorie deficit for ~1 lb/week loss
  maintain_weight: 0,
  gain_weight: 300, // 300 calorie surplus for slow, clean gain
  build_muscle: 200, // 200 calorie surplus for muscle building
} as const

/**
 * Calculate Basal Metabolic Rate (BMR) using Mifflin-St Jeor Equation
 */
export const calculateBMR = (profile: UserProfile): number => {
  const { gender, age, weightKg, heightCm } = profile

  if (gender === 'male' || gender === 'other') {
    // Male BMR = 10 × weight(kg) + 6.25 × height(cm) - 5 × age(years) + 5
    return 10 * weightKg + 6.25 * heightCm - 5 * age + 5
  } else {
    // Female BMR = 10 × weight(kg) + 6.25 × height(cm) - 5 × age(years) - 161
    return 10 * weightKg + 6.25 * heightCm - 5 * age - 161
  }
}

/**
 * Calculate Total Daily Energy Expenditure (TDEE)
 */
export const calculateTDEE = (profile: UserProfile): number => {
  const bmr = calculateBMR(profile)
  const multiplier = ACTIVITY_MULTIPLIERS[profile.activityLevel]
  return bmr * multiplier
}

/**
 * Calculate target calories based on goal
 */
export const calculateTargetCalories = (profile: UserProfile): number => {
  const tdee = calculateTDEE(profile)
  const adjustment = GOAL_ADJUSTMENTS[profile.goal]
  return Math.round(tdee + adjustment)
}

/**
 * Calculate macronutrient distribution based on diet type and goals
 */
export const calculateMacronutrients = (
  calories: number,
  profile: UserProfile,
): { protein: number; carbs: number; fat: number } => {
  const { goal, dietType = 'normal', weightKg } = profile

  let proteinRatio = 0.25 // 25% default
  let fatRatio = 0.3 // 30% default
  let carbRatio = 0.45 // 45% default

  // Adjust based on goal
  switch (goal) {
    case 'lose_weight':
      proteinRatio = 0.3 // Higher protein for muscle preservation
      fatRatio = 0.25
      carbRatio = 0.45
      break
    case 'build_muscle':
      proteinRatio = 0.3 // Higher protein for muscle building
      fatRatio = 0.25
      carbRatio = 0.45
      break
    case 'gain_weight':
      proteinRatio = 0.25
      fatRatio = 0.3
      carbRatio = 0.45
      break
    default: // maintain_weight
      proteinRatio = 0.25
      fatRatio = 0.3
      carbRatio = 0.45
  }

  // Adjust based on diet type
  switch (dietType) {
    case 'keto':
      proteinRatio = 0.25
      fatRatio = 0.7
      carbRatio = 0.05
      break
    case 'vegetarian':
    case 'vegan':
      proteinRatio = 0.2 // Lower due to plant protein sources
      fatRatio = 0.3
      carbRatio = 0.5
      break
    case 'mediterranean':
      proteinRatio = 0.2
      fatRatio = 0.35 // Higher healthy fats
      carbRatio = 0.45
      break
  }

  // Calculate grams (4 cal/g for protein and carbs, 9 cal/g for fat)
  const proteinGrams = Math.round((calories * proteinRatio) / 4)
  const fatGrams = Math.round((calories * fatRatio) / 9)
  const carbGrams = Math.round((calories * carbRatio) / 4)

  // Ensure minimum protein intake (0.8g per kg body weight minimum)
  const minProtein = Math.round(weightKg * 0.8)
  const finalProtein = Math.max(proteinGrams, minProtein)

  return {
    protein: finalProtein,
    carbs: carbGrams,
    fat: fatGrams,
  }
}

/**
 * Calculate complete nutrition goals
 */
export const calculateNutritionGoals = (
  profile: UserProfile,
): NutritionGoals => {
  const calories = calculateTargetCalories(profile)
  const macros = calculateMacronutrients(calories, profile)

  // Other nutrients based on general recommendations
  const fiber = Math.min(38, Math.max(25, Math.round(calories / 80))) // ~25-38g based on calories
  const sugar = Math.round((calories * 0.1) / 4) // Max 10% of calories from added sugars
  const sodium = 2300 // WHO recommendation: <2300mg/day
  const water = Math.round(profile.weightKg * 35) // 35ml per kg body weight
  const cholesterol = 300 // Max 300mg/day
  const saturated_fat = Math.round((calories * 0.1) / 9) // Max 10% of calories
  const omega3 = profile.gender === 'male' ? 1.6 : 1.1 // ALA recommendations

  return {
    calories,
    protein: macros.protein,
    carbs: macros.carbs,
    fat: macros.fat,
    fiber,
    sugar,
    sodium,
    water,
    cholesterol,
    saturated_fat,
    omega3,
  }
}

/**
 * Validate user profile for calculation
 */
export const validateUserProfileForCalculation = (
  profile: UserProfile,
): boolean => {
  return (
    profile.age > 0 &&
    profile.age < 120 &&
    profile.weightKg > 20 &&
    profile.weightKg < 300 &&
    profile.heightCm > 100 &&
    profile.heightCm < 250 &&
    ['male', 'female', 'other'].includes(profile.gender) &&
    ['sedentary', 'light', 'moderate', 'active', 'very_active'].includes(
      profile.activityLevel,
    ) &&
    ['lose_weight', 'maintain_weight', 'gain_weight', 'build_muscle'].includes(
      profile.goal,
    )
  )
}

/**
 * Get nutrition recommendations as text
 */
export const getNutritionRecommendations = (
  profile: UserProfile,
  currentLang: 'th' | 'en' = 'th',
): string[] => {
  const recommendations: string[] = []
  const { goal, dietType = 'normal' } = profile

  if (currentLang === 'th') {
    switch (goal) {
      case 'lose_weight':
        recommendations.push('ควรเน้นโปรตีนเพื่อรักษามวลกล้ามเนื้อ')
        recommendations.push('ลดคาร์โบไฮเดรตที่มีการแปรรูป')
        recommendations.push('เพิ่มผักใบเขียวและเส้นใยอาหาร')
        break
      case 'build_muscle':
        recommendations.push('บริโภคโปรตีนหลังออกกำลังกายภายใน 30 นาที')
        recommendations.push('กินคาร์โบไฮเดรตคุณภาพดีก่อนออกกำลังกาย')
        recommendations.push('แบ่งมื้ออาหารเป็น 5-6 มื้อเล็ก ๆ')
        break
      case 'gain_weight':
        recommendations.push('เพิ่มแคลอรี่จากแหล่งที่มีคุณภาพ')
        recommendations.push('ดื่มน้ำมากขึ้นและหลีกเลี่ยงการอดอาหาร')
        break
      default:
        recommendations.push('รักษาสมดุลของสารอาหารทั้ง 5 หมู่')
        recommendations.push('ดื่มน้ำเปล่าอย่างน้อย 8 แก้วต่อวัน')
    }

    if (dietType === 'vegetarian' || dietType === 'vegan') {
      recommendations.push('ใส่ใจการรับวิตามิน B12 และเหล็ก')
      recommendations.push('รวมโปรตีนจากถั่วต่าง ๆ เข้าด้วยกัน')
    }
  } else {
    switch (goal) {
      case 'lose_weight':
        recommendations.push('Focus on protein to preserve muscle mass')
        recommendations.push('Reduce processed carbohydrates')
        recommendations.push('Increase leafy greens and fiber')
        break
      case 'build_muscle':
        recommendations.push('Consume protein within 30 minutes post-workout')
        recommendations.push('Eat quality carbs before exercise')
        recommendations.push('Split into 5-6 smaller meals')
        break
      case 'gain_weight':
        recommendations.push('Increase calories from quality sources')
        recommendations.push('Drink more water and avoid skipping meals')
        break
      default:
        recommendations.push('Maintain balance of all 5 food groups')
        recommendations.push('Drink at least 8 glasses of water daily')
    }

    if (dietType === 'vegetarian' || dietType === 'vegan') {
      recommendations.push('Pay attention to B12 and iron intake')
      recommendations.push('Combine different legume proteins')
    }
  }

  return recommendations
}

/**
 * Calculate BMI and category
 */
export const calculateBMI = (
  weightKg: number,
  heightCm: number,
): { bmi: number; category: string } => {
  const heightM = heightCm / 100
  const bmi = weightKg / (heightM * heightM)

  let category = ''
  if (bmi < 18.5) category = 'น้ำหนักต่ำกว่าเกณฑ์'
  else if (bmi < 25) category = 'น้ำหนักปกติ'
  else if (bmi < 30) category = 'น้ำหนักเกิน'
  else category = 'อ้วน'

  return { bmi: Math.round(bmi * 10) / 10, category }
}
