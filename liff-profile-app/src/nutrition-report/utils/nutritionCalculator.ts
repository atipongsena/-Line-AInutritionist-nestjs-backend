// Frontend Nutrition Calculator Utilities
// สำหรับการคำนวณที่ไม่ critical และต้องการ real-time response

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
  protein: number
  carbs: number
  fat: number
  fiber: number
  sugar: number
  sodium: number
  water: number
  cholesterol: number
  saturated_fat: number
  omega3: number
}

/**
 * คำนวณ BMI (Body Mass Index)
 * @param weightKg น้ำหนักในหน่วยกิโลกรัม
 * @param heightCm ส่วนสูงในหน่วยเซนติเมตร
 * @returns BMI หรือ null หากข้อมูลไม่ถูกต้อง
 */
export function calculateBMI(
  weightKg: number,
  heightCm: number,
): number | null {
  if (!weightKg || !heightCm || weightKg <= 0 || heightCm <= 0) {
    return null
  }

  const heightM = heightCm / 100
  const bmi = weightKg / (heightM * heightM)
  return Math.round(bmi * 10) / 10
}

/**
 * คำนวณ BMR (Basal Metabolic Rate) ด้วยสูตร Mifflin-St Jeor
 * @param gender เพศ
 * @param weightKg น้ำหนักในหน่วยกิโลกรัม
 * @param heightCm ส่วนสูงในหน่วยเซนติเมตร
 * @param age อายุ
 * @returns BMR หรือ null หากข้อมูลไม่ถูกต้อง
 */
export function calculateBMR(
  gender: string,
  weightKg: number,
  heightCm: number,
  age: number,
): number | null {
  if (
    !weightKg ||
    !heightCm ||
    !age ||
    weightKg <= 0 ||
    heightCm <= 0 ||
    age <= 0
  ) {
    return null
  }

  // สูตร Mifflin-St Jeor
  // ผู้ชาย: BMR = 10 × น้ำหนัก(kg) + 6.25 × ส่วนสูง(cm) - 5 × อายุ(ปี) + 5
  // ผู้หญิง: BMR = 10 × น้ำหนัก(kg) + 6.25 × ส่วนสูง(cm) - 5 × อายุ(ปี) - 161

  const baseBMR = 10 * weightKg + 6.25 * heightCm - 5 * age

  if (gender === 'male') {
    return Math.round(baseBMR + 5)
  } else if (gender === 'female') {
    return Math.round(baseBMR - 161)
  } else {
    // สำหรับเพศอื่นๆ ใช้ค่าเฉลี่ย
    return Math.round(baseBMR - 78)
  }
}

/**
 * คำนวณ TDEE (Total Daily Energy Expenditure)
 * @param bmr BMR ที่คำนวณได้
 * @param activityLevel ระดับการออกกำลังกาย
 * @returns TDEE หรือ null หากข้อมูลไม่ถูกต้อง
 */
export function calculateTDEE(
  bmr: number | null,
  activityLevel: string,
): number | null {
  if (!bmr || bmr <= 0) return null

  const activityMultipliers = {
    sedentary: 1.2, // นั่งทำงาน ไม่ออกกำลังกาย
    light: 1.375, // ออกกำลังกายเบาๆ 1-3 วัน/สัปดาห์
    moderate: 1.55, // ออกกำลังกายปานกลาง 3-5 วัน/สัปดาห์
    active: 1.725, // ออกกำลังกายหนัก 6-7 วัน/สัปดาห์
    very_active: 1.9, // ออกกำลังกายหนักมาก หรือมีงานหนัก
  }

  const multiplier =
    activityMultipliers[activityLevel as keyof typeof activityMultipliers] ||
    1.2
  return Math.round(bmr * multiplier)
}

/**
 * คำนวณแคลอรี่เป้าหมายตามวัตถุประสงค์
 * @param tdee TDEE ที่คำนวณได้
 * @param goal วัตถุประสงค์
 * @returns แคลอรี่เป้าหมาย หรือ null หากข้อมูลไม่ถูกต้อง
 */
export function calculateTargetCalories(
  tdee: number | null,
  goal: string,
): number | null {
  if (!tdee || tdee <= 0) return null

  switch (goal) {
    case 'lose_weight':
      return Math.round(tdee - 500) // ลดน้ำหนัก 0.5 kg/สัปดาห์
    case 'maintain_weight':
      return tdee
    case 'gain_weight':
      return Math.round(tdee + 300) // เพิ่มน้ำหนัก 0.3 kg/สัปดาห์
    case 'build_muscle':
      return Math.round(tdee + 500) // เพิ่มกล้ามเนื้อ
    default:
      return tdee
  }
}

/**
 * คำนวณการกระจายมาโครนิวเทรียนต์
 * @param targetCalories แคลอรี่เป้าหมาย
 * @param goal วัตถุประสงค์
 * @param dietType ประเภทการกิน
 * @returns การกระจายมาโครนิวเทรียนต์ (กรัม) หรือ null หากข้อมูลไม่ถูกต้อง
 */
export function calculateMacroDistribution(
  targetCalories: number | null,
  goal: string,
  dietType?: string,
): { protein: number; carbs: number; fat: number } | null {
  if (!targetCalories || targetCalories <= 0) return null

  let proteinPercent: number
  let carbPercent: number
  let fatPercent: number

  // กำหนดสัดส่วนตามประเภทการกิน
  if (dietType === 'keto') {
    proteinPercent = 0.25
    carbPercent = 0.05
    fatPercent = 0.7
  } else if (dietType === 'high_protein' || goal === 'build_muscle') {
    proteinPercent = 0.3
    carbPercent = 0.4
    fatPercent = 0.3
  } else if (dietType === 'low_carb') {
    proteinPercent = 0.25
    carbPercent = 0.25
    fatPercent = 0.5
  } else {
    // สัดส่วนมาตรฐาน
    proteinPercent = 0.2
    carbPercent = 0.5
    fatPercent = 0.3
  }

  return {
    protein: Math.round((targetCalories * proteinPercent) / 4), // โปรตีน 4 kcal/g
    carbs: Math.round((targetCalories * carbPercent) / 4), // คาร์โบไฮเดรต 4 kcal/g
    fat: Math.round((targetCalories * fatPercent) / 9), // ไขมัน 9 kcal/g
  }
}

/**
 * คำนวณความต้องการน้ำต่อวัน
 * @param weightKg น้ำหนักในหน่วยกิโลกรัม
 * @param activityLevel ระดับการออกกำลังกาย
 * @returns ความต้องการน้ำ (มิลลิลิตร) หรือ null หากข้อมูลไม่ถูกต้อง
 */
export function calculateWaterNeeds(
  weightKg: number,
  activityLevel?: string,
): number | null {
  if (!weightKg || weightKg <= 0) return null

  const baseWater = weightKg * 30 // 30ml per kg

  const activityMultipliers = {
    sedentary: 1.0,
    light: 1.1,
    moderate: 1.2,
    active: 1.3,
    very_active: 1.4,
  }

  const multiplier = activityLevel
    ? activityMultipliers[activityLevel as keyof typeof activityMultipliers] ||
      1.0
    : 1.0

  return Math.round(baseWater * multiplier)
}

/**
 * คำนวณเป้าหมายโภชนาการทั้งหมด
 * @param userProfile ข้อมูลผู้ใช้
 * @returns เป้าหมายโภชนาการ หรือ null หากข้อมูลไม่เพียงพอ
 */
export function calculateNutritionGoals(
  userProfile: UserProfile,
): NutritionGoals | null {
  const bmr = calculateBMR(
    userProfile.gender,
    userProfile.weightKg,
    userProfile.heightCm,
    userProfile.age,
  )
  const tdee = calculateTDEE(bmr, userProfile.activityLevel)
  const targetCalories = calculateTargetCalories(tdee, userProfile.goal)
  const macros = calculateMacroDistribution(
    targetCalories,
    userProfile.goal,
    userProfile.dietType,
  )
  const waterNeeds = calculateWaterNeeds(
    userProfile.weightKg,
    userProfile.activityLevel,
  )

  if (!targetCalories || !macros || !waterNeeds) return null

  return {
    calories: targetCalories,
    protein: macros.protein,
    carbs: macros.carbs,
    fat: macros.fat,
    fiber: 25, // แนะนำ 25g/วัน
    sugar: Math.round((targetCalories * 0.1) / 4), // ไม่เกิน 10% ของแคลอรี่ทั้งหมด
    sodium: 2300, // แนะนำไม่เกิน 2300mg/วัน
    water: waterNeeds,
    cholesterol: 300, // แนะนำไม่เกิน 300mg/วัน
    saturated_fat: Math.round((targetCalories * 0.1) / 9), // ไม่เกิน 10% ของแคลอรี่ทั้งหมด
    omega3: userProfile.gender === 'male' ? 1.6 : 1.1, // แนะนำสำหรับผู้ชาย/หญิง
  }
}

/**
 * คำนวณเปอร์เซ็นต์ความคืบหน้า
 * @param consumed ปริมาณที่บริโภค
 * @param goal เป้าหมาย
 * @returns เปอร์เซ็นต์ความคืบหน้า
 */
export function calculateProgress(consumed: number, goal: number): number {
  if (!goal || goal <= 0) return 0
  return Math.round((consumed / goal) * 100)
}

/**
 * แปลความหมายของค่า BMI
 * @param bmi ค่า BMI
 * @param language ภาษา
 * @returns สถานะ BMI
 */
export function getBMIStatus(
  bmi: number | null,
  language: 'th' | 'en' = 'th',
): string {
  if (!bmi || bmi <= 0) {
    return language === 'th' ? 'ไม่สามารถคำนวณได้' : 'Cannot calculate'
  }

  const statusTh = {
    underweight: 'น้ำหนักต่ำกว่าเกณฑ์',
    normal: 'น้ำหนักปกติ',
    overweight: 'น้ำหนักเกิน',
    obese: 'อ้วน',
  }

  const statusEn = {
    underweight: 'Underweight',
    normal: 'Normal weight',
    overweight: 'Overweight',
    obese: 'Obese',
  }

  const status = language === 'th' ? statusTh : statusEn

  if (bmi < 18.5) return status.underweight
  if (bmi < 25) return status.normal
  if (bmi < 30) return status.overweight
  return status.obese
}

/**
 * ตรวจสอบความถูกต้องของข้อมูลผู้ใช้สำหรับการคำนวณ
 * @param profile ข้อมูลผู้ใช้
 * @returns true หากข้อมูลเพียงพอสำหรับการคำนวณ
 */
export function validateUserProfileForCalculation(
  profile: Partial<UserProfile>,
): boolean {
  return !!(
    profile.gender &&
    profile.age &&
    profile.weightKg &&
    profile.heightCm &&
    profile.activityLevel &&
    profile.goal &&
    profile.age > 0 &&
    profile.weightKg > 0 &&
    profile.heightCm > 0
  )
}
