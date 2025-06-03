export type Gender =
  | 'male'
  | 'female'
  | 'lgbtq_lesbian' // Lesbian
  | 'lgbtq_gay' // Gay
  | 'lgbtq_bisexual' // Bisexual
  | 'lgbtq_transgender_m_to_f' // Transgender (Male to Female)
  | 'lgbtq_transgender_f_to_m' // Transgender (Female to Male)
  | 'lgbtq_queer' // Queer
  | 'lgbtq_non_binary' // Non-binary
  | 'lgbtq_other' // Other LGBTQ+
  | 'other' // General Other
  | 'not_specified' // Prefer not to say
export type ActivityLevel =
  | 'sedentary'
  | 'light'
  | 'moderate'
  | 'active'
  | 'very_active'
export type DietType =
  | 'normal'
  | 'keto'
  | 'vegetarian'
  | 'vegan'
  | 'low_carb'
  | 'high_protein'
  | 'if_16_8' // Intermittent Fasting 16/8
  | 'if_5_2' // Intermittent Fasting 5:2
  | 'paleo'
  | 'mediterranean'

export type PregnancyLactationStatus =
  | 'not_applicable'
  | 'pregnant'
  | 'lactating'

export interface SharedUserProfileDto {
  lineUserId: string
  displayName?: string
  pictureUrl?: string
  language: string // e.g., 'th' | 'en'
  timezone?: string // e.g., 'Asia/Bangkok', 'UTC', etc.
  goal?: string // e.g., 'weight_loss', 'muscle_gain', 'maintenance', 'general_health'
  gender?: Gender
  age?: number
  birthDate?: string
  weightKg?: number
  heightCm?: number
  activityLevel?: ActivityLevel
  dietType?: DietType
  healthConditions?: string[]
  foodAllergies?: string[] // Covers general food restrictions as well
  createdAt?: Date
  updatedAt?: Date
  isActive?: boolean
  lastActiveAt?: Date

  // New fields for Step 4
  ethicalFoodConsiderations?: string[]
  pregnancyLactationStatus?: PregnancyLactationStatus
  preferredCuisine?: string[] // e.g., 'thai', 'japanese', 'western', 'chinese', 'indian_arabic', 'other_cuisine'
  preferredFlavorProfiles?: string[] // e.g., 'spicy', 'mild', 'bland', 'low_sugar_salt', 'non_oily_fried'

  // Nutrition Calculation related fields
  targetWeightKg?: number | null
  calculatedBmr?: number | null
  calculatedTdee?: number | null

  // Daily nutrition goals - main macronutrients
  dailyCaloriesGoal?: number
  dailyProteinGoal?: number
  dailyCarbsGoal?: number
  dailyFatGoal?: number

  // Daily nutrition goals - micronutrients and others
  dailyFiberGoal?: number
  dailySugarGoal?: number
  dailySodiumGoal?: number
  dailyWaterGoal?: number
  dailyCholesterolGoal?: number
  dailySaturatedFatGoal?: number
  dailyOmega3Goal?: number
}

export interface SharedCreateUserProfileDto {
  lineUserId: string
  displayName?: string
  pictureUrl?: string
  language?: string
}

export interface SharedUpdateUserProfileDto {
  displayName?: string
  pictureUrl?: string
  language?: string
  timezone?: string
  goal?: string
  gender?: Gender
  age?: number
  birthDate?: string
  weightKg?: number
  heightCm?: number
  activityLevel?: ActivityLevel
  dietType?: DietType
  healthConditions?: string[]
  foodAllergies?: string[]
  isActive?: boolean
  lastActiveAt?: Date

  // New fields for update
  ethicalFoodConsiderations?: string[]
  pregnancyLactationStatus?: PregnancyLactationStatus
  preferredCuisine?: string[]
  preferredFlavorProfiles?: string[]

  // Nutrition calculation fields
  targetWeightKg?: number | null
  calculatedBmr?: number | null
  calculatedTdee?: number | null

  // Daily nutrition goals
  dailyCaloriesGoal?: number
  dailyProteinGoal?: number
  dailyCarbsGoal?: number
  dailyFatGoal?: number
  dailyFiberGoal?: number
  dailySugarGoal?: number
  dailySodiumGoal?: number
  dailyWaterGoal?: number
  dailyCholesterolGoal?: number
  dailySaturatedFatGoal?: number
  dailyOmega3Goal?: number
}
