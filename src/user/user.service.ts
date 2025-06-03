import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { User, UserDocument } from '../schemas/user.schema'
import {
  UserProfileDto,
  CreateUserProfileDto,
  UpdateUserProfileDto,
} from './user.interface'
import {
  Gender,
  ActivityLevel,
  DietType,
  PregnancyLactationStatus,
} from '@ai-nutritionist/shared-types'

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
  maintenance: 0,
  gain_weight: 300, // 300 calorie surplus for slow, clean gain
  build_muscle: 200, // 200 calorie surplus for muscle building
  general_health: 0, // No adjustment for general health goal
} as const

interface NutritionCalculationProfile {
  gender: string
  age: number
  weightKg: number
  heightCm: number
  activityLevel: string
  goal?: string
  dietType?: string
}

/**
 * ⚡ Optimized UserService with parallel processing and advanced caching
 */
@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name)

  // 🚀 Enhanced caching system
  private timezoneCache = new Map<
    string,
    { timezone: string; timestamp: number }
  >()
  private userProfileCache = new Map<
    string,
    { profile: UserProfileDto; timestamp: number }
  >()
  private readonly TIMEZONE_CACHE_TTL = 15 * 60 * 1000 // 15 minutes (increased from 5)
  private readonly PROFILE_CACHE_TTL = 10 * 60 * 1000 // 10 minutes

  // 📊 Performance metrics
  private cacheHits = 0
  private cacheMisses = 0
  private pendingRequests = new Map<string, Promise<UserProfileDto>>() // Prevent duplicate requests

  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  /**
   * 🧮 Calculate BMR using Mifflin-St Jeor Equation
   */
  private calculateBMR(profile: NutritionCalculationProfile): number {
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
   * 🔥 Calculate TDEE
   */
  private calculateTDEE(profile: NutritionCalculationProfile): number {
    const bmr = this.calculateBMR(profile)
    const multiplier =
      ACTIVITY_MULTIPLIERS[
        profile.activityLevel as keyof typeof ACTIVITY_MULTIPLIERS
      ] || 1.55
    return bmr * multiplier
  }

  /**
   * 🎯 Calculate target calories based on goal
   */
  private calculateTargetCalories(
    profile: NutritionCalculationProfile,
  ): number {
    const tdee = this.calculateTDEE(profile)
    const adjustment =
      GOAL_ADJUSTMENTS[profile.goal as keyof typeof GOAL_ADJUSTMENTS] || 0
    return Math.round(tdee + adjustment)
  }

  /**
   * 🥗 Calculate nutrition goals
   */
  private calculateNutritionGoals(profile: NutritionCalculationProfile): {
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
  } {
    const calories = this.calculateTargetCalories(profile)
    const { goal = 'maintenance', dietType = 'normal', weightKg } = profile

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
      default: // maintenance, general_health
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

    // Other nutrients based on general recommendations
    const fiber = Math.min(38, Math.max(25, Math.round(calories / 80))) // ~25-38g based on calories
    const sugar = Math.round((calories * 0.1) / 4) // Max 10% of calories from added sugars
    const sodium = 2300 // WHO recommendation: <2300mg/day
    const water = Math.round(weightKg * 35) // 35ml per kg body weight
    const cholesterol = 300 // Max 300mg/day
    const saturated_fat = Math.round((calories * 0.1) / 9) // Max 10% of calories
    const omega3 = profile.gender === 'male' ? 1.6 : 1.1 // ALA recommendations

    return {
      calories,
      protein: finalProtein,
      carbs: carbGrams,
      fat: fatGrams,
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
   * ✅ Validate profile for nutrition calculation
   */
  private validateProfileForNutritionCalculation(
    profile: NutritionCalculationProfile,
  ): boolean {
    return (
      profile.age > 0 &&
      profile.age < 120 &&
      profile.weightKg > 20 &&
      profile.weightKg < 300 &&
      profile.heightCm > 100 &&
      profile.heightCm < 250 &&
      ['male', 'female', 'other'].includes(profile.gender.toLowerCase()) &&
      ['sedentary', 'light', 'moderate', 'active', 'very_active'].includes(
        profile.activityLevel,
      )
    )
  }

  private mapUserDocumentToDto(userDoc: UserDocument): UserProfileDto {
    if (!userDoc.createdAt || !userDoc.updatedAt) {
      this.logger.warn(
        `User document ${userDoc.lineUserId} is missing timestamps unexpectedly.`,
      )
    }
    return {
      lineUserId: userDoc.lineUserId,
      displayName: userDoc.displayName,
      pictureUrl: userDoc.pictureUrl,
      language: userDoc.language,
      timezone: userDoc.timezone,
      goal: userDoc.goal,
      gender: userDoc.gender as Gender,
      age: userDoc.age,
      birthDate: userDoc.birthDate,
      weightKg: userDoc.weightKg,
      heightCm: userDoc.heightCm,
      activityLevel: userDoc.activityLevel as ActivityLevel,
      dietType: userDoc.dietType as DietType,
      healthConditions: userDoc.healthConditions,
      foodAllergies: userDoc.foodAllergies,
      isActive: userDoc.isActive,
      lastActiveAt: userDoc.lastActiveAt,
      createdAt: userDoc.createdAt!,
      updatedAt: userDoc.updatedAt!,
      ethicalFoodConsiderations: userDoc.ethicalFoodConsiderations,
      pregnancyLactationStatus:
        userDoc.pregnancyLactationStatus as PregnancyLactationStatus,
      preferredCuisine: userDoc.preferredCuisine,
      preferredFlavorProfiles: userDoc.preferredFlavorProfiles,
      // Nutrition calculation fields
      targetWeightKg: userDoc.targetWeightKg,
      calculatedBmr: userDoc.calculatedBmr,
      calculatedTdee: userDoc.calculatedTdee,
      // Daily nutrition goals - main macronutrients
      dailyCaloriesGoal: userDoc.dailyCaloriesGoal,
      dailyProteinGoal: userDoc.dailyProteinGoal,
      dailyCarbsGoal: userDoc.dailyCarbsGoal,
      dailyFatGoal: userDoc.dailyFatGoal,
      // Daily nutrition goals - micronutrients and others
      dailyFiberGoal: userDoc.dailyFiberGoal,
      dailySugarGoal: userDoc.dailySugarGoal,
      dailySodiumGoal: userDoc.dailySodiumGoal,
      dailyWaterGoal: userDoc.dailyWaterGoal,
      dailyCholesterolGoal: userDoc.dailyCholesterolGoal,
      dailySaturatedFatGoal: userDoc.dailySaturatedFatGoal,
      dailyOmega3Goal: userDoc.dailyOmega3Goal,
    }
  }

  /**
   * 🔍 Get timezone with advanced caching and batch processing
   */
  async getUserTimezone(lineUserId: string): Promise<string> {
    const startTime = performance.now()

    // Check cache first
    const cached = this.timezoneCache.get(lineUserId)
    if (cached && Date.now() - cached.timestamp < this.TIMEZONE_CACHE_TTL) {
      this.cacheHits++
      this.logger.debug(
        `Timezone cache hit for ${lineUserId} (${(performance.now() - startTime).toFixed(2)}ms)`,
      )
      return cached.timezone
    }

    this.cacheMisses++

    try {
      // Only fetch timezone field to minimize database load
      const user = await this.userModel
        .findOne({ lineUserId })
        .select('timezone')
        .lean() // Use lean() for better performance
        .exec()

      const timezone = user?.timezone || 'Asia/Bangkok'

      // Cache the result
      this.timezoneCache.set(lineUserId, {
        timezone,
        timestamp: Date.now(),
      })

      this.logger.debug(
        `Timezone DB fetch for ${lineUserId}: ${timezone} (${(performance.now() - startTime).toFixed(2)}ms)`,
      )
      return timezone
    } catch (error) {
      this.logger.error(`Error fetching timezone for ${lineUserId}:`, error)
      return 'Asia/Bangkok' // Fallback
    }
  }

  /**
   * 🚀 Optimized profile retrieval with deduplication
   */
  async getOrCreateUserProfile(
    userParams: Partial<UserProfileDto>,
  ): Promise<UserProfileDto> {
    const { lineUserId } = userParams
    if (!lineUserId) {
      throw new Error('LineUserId is required')
    }

    // Check if there's already a pending request for this user
    const pendingRequest = this.pendingRequests.get(lineUserId)
    if (pendingRequest) {
      this.logger.debug(`Using pending request for ${lineUserId}`)
      return pendingRequest
    }

    // Check cache first
    const cached = this.userProfileCache.get(lineUserId)
    if (cached && Date.now() - cached.timestamp < this.PROFILE_CACHE_TTL) {
      this.cacheHits++
      this.logger.debug(`Profile cache hit for ${lineUserId}`)
      return cached.profile
    }

    this.cacheMisses++

    // Create a promise for this request to prevent duplicates
    const requestPromise = this.fetchOrCreateUserProfile(lineUserId, userParams)
    this.pendingRequests.set(lineUserId, requestPromise)

    try {
      const profile = await requestPromise

      // Cache the result
      this.userProfileCache.set(lineUserId, {
        profile,
        timestamp: Date.now(),
      })

      return profile
    } finally {
      // Clean up pending request
      this.pendingRequests.delete(lineUserId)
    }
  }

  /**
   * 📊 Internal method to fetch or create user profile
   */
  private async fetchOrCreateUserProfile(
    lineUserId: string,
    userParams: Partial<UserProfileDto>,
  ): Promise<UserProfileDto> {
    const startTime = performance.now()

    try {
      // Try to find existing user first
      let user = await this.userModel.findOne({ lineUserId }).exec()

      if (!user) {
        this.logger.log(`Creating new profile for ${lineUserId}`)

        // Create new user with defaults
        const newUser = new this.userModel({
          lineUserId,
          language: userParams.language || 'th',
          timezone: 'Asia/Bangkok', // Set default timezone
          ...userParams,
        })

        user = await newUser.save()
        this.logger.log(`Successfully created profile for ${lineUserId}`)
      } else {
        this.logger.log(`Getting existing profile for ${lineUserId}`)
      }

      const profile = this.mapUserDocumentToDto(user)

      this.logger.debug(
        `Profile operation completed for ${lineUserId} (${(performance.now() - startTime).toFixed(2)}ms)`,
      )
      return profile
    } catch (error) {
      this.logger.error(
        `Error in fetchOrCreateUserProfile for ${lineUserId}:`,
        error,
      )
      throw error
    }
  }

  /**
   * 🔄 Batch update multiple users for parallel processing
   */
  async batchUpdateProfiles(
    updates: Array<{
      lineUserId: string
      updates: Partial<UpdateUserProfileDto>
    }>,
  ): Promise<UserProfileDto[]> {
    const startTime = performance.now()

    try {
      // Process updates in parallel
      const updatePromises = updates.map(
        async ({ lineUserId, updates: userUpdates }) => {
          const user = await this.userModel
            .findOneAndUpdate(
              { lineUserId },
              { ...userUpdates, updatedAt: new Date() },
              { new: true, upsert: false },
            )
            .exec()

          if (!user) {
            throw new NotFoundException(
              `User with lineUserId ${lineUserId} not found`,
            )
          }

          // Update cache
          const profile = this.mapUserDocumentToDto(user)
          this.userProfileCache.set(lineUserId, {
            profile,
            timestamp: Date.now(),
          })

          return profile
        },
      )

      const results = await Promise.all(updatePromises)

      this.logger.log(
        `Batch updated ${updates.length} profiles (${(performance.now() - startTime).toFixed(2)}ms)`,
      )
      return results
    } catch (error) {
      this.logger.error('Error in batch profile update:', error)
      throw error
    }
  }

  /**
   * 📈 Get cache performance metrics
   */
  getCacheMetrics(): {
    hits: number
    misses: number
    hitRatio: number
    cacheSize: number
  } {
    const total = this.cacheHits + this.cacheMisses
    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRatio: total > 0 ? (this.cacheHits / total) * 100 : 0,
      cacheSize: this.userProfileCache.size + this.timezoneCache.size,
    }
  }

  /**
   * 🧹 Cache cleanup method
   */
  private cleanupExpiredCache(): void {
    const now = Date.now()

    // Cleanup timezone cache
    for (const [key, value] of this.timezoneCache.entries()) {
      if (now - value.timestamp > this.TIMEZONE_CACHE_TTL) {
        this.timezoneCache.delete(key)
      }
    }

    // Cleanup profile cache
    for (const [key, value] of this.userProfileCache.entries()) {
      if (now - value.timestamp > this.PROFILE_CACHE_TTL) {
        this.userProfileCache.delete(key)
      }
    }
  }

  async getUserDocumentByLineId(
    lineUserId: string,
  ): Promise<UserDocument | null> {
    this.logger.log(`Getting user document for ${lineUserId}`)
    const user = await this.userModel.findOne({ lineUserId }).exec()
    if (!user) {
      this.logger.warn(`User document for ${lineUserId} not found.`)
      return null
    }
    return user
  }

  async getUserProfile(lineUserId: string): Promise<UserProfileDto | null> {
    this.logger.log(`Getting profile for ${lineUserId}`)
    try {
      const user = await this.userModel
        .findOne({ lineUserId, isActive: true })
        .maxTimeMS(10000) // 10 second timeout
        .exec()
      if (!user) {
        this.logger.warn(`User ${lineUserId} not found or inactive.`)
        return null
      }
      this.logger.log(`Successfully retrieved profile for ${lineUserId}`)
      return this.mapUserDocumentToDto(user)
    } catch (error) {
      this.logger.error(`Error getting profile for ${lineUserId}:`, error)
      throw error
    }
  }

  async updateUserProfile(
    lineUserId: string,
    updateDto: UpdateUserProfileDto,
  ): Promise<UserProfileDto> {
    this.logger.log(`Updating profile for ${lineUserId}`)

    // 🧮 Calculate nutrition values if profile data is sufficient
    let nutritionCalculations: Partial<UpdateUserProfileDto> = {}

    try {
      // Get current user data first
      const currentUser = await this.userModel.findOne({ lineUserId }).exec()
      if (!currentUser) {
        throw new NotFoundException(`User with ID ${lineUserId} not found.`)
      }

      // Merge current data with updates to get complete profile for calculation
      const profileForCalculation: NutritionCalculationProfile = {
        gender: (
          updateDto.gender ||
          currentUser.gender ||
          'male'
        ).toLowerCase(),
        age: updateDto.age || currentUser.age || 25,
        weightKg: updateDto.weightKg || currentUser.weightKg || 70,
        heightCm: updateDto.heightCm || currentUser.heightCm || 170,
        activityLevel:
          updateDto.activityLevel || currentUser.activityLevel || 'moderate',
        goal: updateDto.goal || currentUser.goal || 'maintenance',
        dietType: updateDto.dietType || currentUser.dietType || 'normal',
      }

      // Only calculate if we have sufficient data
      if (this.validateProfileForNutritionCalculation(profileForCalculation)) {
        this.logger.log(
          `[Nutrition] Calculating nutrition values for ${lineUserId}`,
        )

        // Calculate BMR and TDEE
        const bmr = this.calculateBMR(profileForCalculation)
        const tdee = this.calculateTDEE(profileForCalculation)

        // Calculate nutrition goals
        const nutritionGoals = this.calculateNutritionGoals(
          profileForCalculation,
        )

        // Add calculated values to update payload
        nutritionCalculations = {
          calculatedBmr: Math.round(bmr),
          calculatedTdee: Math.round(tdee),
          dailyCaloriesGoal: nutritionGoals.calories,
          dailyProteinGoal: nutritionGoals.protein,
          dailyCarbsGoal: nutritionGoals.carbs,
          dailyFatGoal: nutritionGoals.fat,
          dailyFiberGoal: nutritionGoals.fiber,
          dailySugarGoal: nutritionGoals.sugar,
          dailySodiumGoal: nutritionGoals.sodium,
          dailyWaterGoal: nutritionGoals.water,
          dailyCholesterolGoal: nutritionGoals.cholesterol,
          dailySaturatedFatGoal: nutritionGoals.saturated_fat,
          dailyOmega3Goal: nutritionGoals.omega3,
        }

        this.logger.log(`[Nutrition] Calculated values for ${lineUserId}:`, {
          bmr: Math.round(bmr),
          tdee: Math.round(tdee),
          calories: nutritionGoals.calories,
          protein: nutritionGoals.protein,
          carbs: nutritionGoals.carbs,
          fat: nutritionGoals.fat,
        })
      } else {
        this.logger.warn(
          `[Nutrition] Insufficient data for calculation for ${lineUserId}`,
          {
            hasGender: !!profileForCalculation.gender,
            hasAge: !!profileForCalculation.age,
            hasWeight: !!profileForCalculation.weightKg,
            hasHeight: !!profileForCalculation.heightCm,
            hasActivityLevel: !!profileForCalculation.activityLevel,
          },
        )
      }
    } catch (calculationError) {
      this.logger.error(
        `[Nutrition] Error calculating nutrition values for ${lineUserId}:`,
        calculationError,
      )
      // Continue with update even if calculation fails
    }

    // Merge original update with nutrition calculations
    const finalUpdateDto: UpdateUserProfileDto = {
      ...updateDto,
      ...nutritionCalculations,
      lastActiveAt: new Date(),
    }

    const user = await this.userModel
      .findOneAndUpdate({ lineUserId }, finalUpdateDto, {
        new: true,
        runValidators: true,
      })
      .exec()

    if (!user) {
      this.logger.error(`User ${lineUserId} not found for update.`)
      throw new NotFoundException(`User with ID ${lineUserId} not found.`)
    }

    // Update timezone cache if timezone was changed
    if (updateDto.timezone) {
      this.timezoneCache.set(lineUserId, {
        timezone: updateDto.timezone,
        timestamp: Date.now(),
      })
    }

    // Clear profile cache to force refresh with new calculated values
    this.userProfileCache.delete(lineUserId)

    this.logger.log(`Profile updated for ${lineUserId}`)
    return this.mapUserDocumentToDto(user)
  }

  async setUserLanguage(
    lineUserId: string,
    language: 'en' | 'th',
  ): Promise<UserProfileDto> {
    this.logger.log(`Setting language to ${language} for user ${lineUserId}`)
    return this.updateUserProfile(lineUserId, { language })
  }

  async setUserInactive(lineUserId: string): Promise<UserProfileDto> {
    this.logger.log(`Setting user ${lineUserId} to inactive.`)
    const user = await this.userModel
      .findOneAndUpdate(
        { lineUserId },
        { isActive: false, lastActiveAt: new Date() },
        { new: true },
      )
      .exec()

    if (!user) {
      this.logger.warn(
        `User ${lineUserId} not found when trying to set inactive.`,
      )
      throw new NotFoundException(`User with ID ${lineUserId} not found.`)
    }

    // Remove from timezone cache when user becomes inactive
    this.timezoneCache.delete(lineUserId)

    this.logger.log(`User ${lineUserId} successfully set to inactive.`)
    return this.mapUserDocumentToDto(user)
  }

  /**
   * Clear timezone cache for a user (useful when timezone is updated)
   */
  clearTimezoneCache(lineUserId: string): void {
    this.timezoneCache.delete(lineUserId)
    this.logger.debug(`Cleared timezone cache for user ${lineUserId}`)
  }

  /**
   * Clear all timezone cache (useful for maintenance)
   */
  clearAllTimezoneCache(): void {
    this.timezoneCache.clear()
    this.logger.log('Cleared all timezone cache')
  }

  /**
   * Helper method to map UserDocument to UserProfileDto
   */
  private mapToUserProfile(user: UserDocument): UserProfileDto {
    return this.mapUserDocumentToDto(user)
  }
}
