export interface UserProfileDto {
  lineUserId: string
  displayName?: string
  pictureUrl?: string
  language: string // 'th' | 'en'
  goal?: string // e.g., 'weight_loss', 'muscle_gain', 'maintenance'
  gender?: 'male' | 'female' | 'other' | 'not_specified'
  age?: number
  weightKg?: number
  heightCm?: number
  activityLevel?: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
  dietType?:
    | 'normal'
    | 'keto'
    | 'vegetarian'
    | 'vegan'
    | 'low_carb'
    | 'high_protein'
  healthConditions?: string[]
  foodAllergies?: string[]
  foodRestrictions?: string[]
  isActive: boolean
  lastActiveAt: Date
  createdAt: Date
  updatedAt: Date
}

export interface CreateUserProfileDto {
  lineUserId: string
  displayName?: string
  pictureUrl?: string
  language?: string
}

export interface UpdateUserProfileDto {
  displayName?: string
  pictureUrl?: string
  language?: string
  goal?: string
  gender?: 'male' | 'female' | 'other' | 'not_specified'
  age?: number
  weightKg?: number
  heightCm?: number
  activityLevel?: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
  dietType?:
    | 'normal'
    | 'keto'
    | 'vegetarian'
    | 'vegan'
    | 'low_carb'
    | 'high_protein'
  healthConditions?: string[]
  foodAllergies?: string[]
  foodRestrictions?: string[]
  isActive?: boolean
  lastActiveAt?: Date
}
