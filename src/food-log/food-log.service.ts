import { Injectable, NotFoundException, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import {
  FoodLog,
  FoodLogDocument,
  VitaminMineralDetailSchemaDocument,
} from '../schemas/food-log.schema'
import { UpdateFoodLogDto } from './dto/update-food-log.dto'
import { FoodLogResponseDto } from './dto/food-log-response.dto'
import { UserService } from '../user/user.service' // To fetch user ObjectId
import { TimezoneService } from '../common/timezone.service'
// Import ImageService if needed for image URL validation or other image-related tasks

@Injectable()
export class FoodLogService {
  private readonly logger = new Logger(FoodLogService.name)

  constructor(
    @InjectModel(FoodLog.name) private foodLogModel: Model<FoodLogDocument>,
    private readonly userService: UserService,
    private readonly timezoneService: TimezoneService,
    // @Inject(ImageService) private readonly imageService: ImageService, // Example if needed
  ) {}

  // This service will primarily be used by the LIFF app to get and update food logs.
  // Creation of food logs is currently handled by LineService after AI analysis.

  async findById(
    logId: string,
    lineUserId: string,
  ): Promise<FoodLogResponseDto> {
    this.logger.log(
      `Fetching food log with ID: ${logId} for user: ${lineUserId}`,
    )
    if (!Types.ObjectId.isValid(logId)) {
      throw new NotFoundException(`Invalid FoodLog ID format: ${logId}`)
    }

    const foodLog = await this.foodLogModel.findById(logId).exec()

    if (!foodLog) {
      throw new NotFoundException(`Food log with ID ${logId} not found.`)
    }

    // Important: Verify that the food log belongs to the requesting user
    if (foodLog.lineUserId !== lineUserId) {
      this.logger.warn(
        `User ${lineUserId} attempted to access food log ${logId} owned by ${foodLog.lineUserId}. Access denied.`,
      )
      throw new NotFoundException(
        `Food log with ID ${logId} not found for your account.`,
      )
    }

    return this.mapToResponseDto(foodLog)
  }

  async update(
    logId: string,
    lineUserId: string,
    updateFoodLogDto: UpdateFoodLogDto,
  ): Promise<FoodLogResponseDto> {
    this.logger.log(`Updating food log ID: ${logId} for user: ${lineUserId}`)
    if (!Types.ObjectId.isValid(logId)) {
      throw new NotFoundException(`Invalid FoodLog ID format: ${logId}`)
    }

    const existingFoodLog = await this.foodLogModel.findById(logId).exec()

    if (!existingFoodLog) {
      throw new NotFoundException(`Food log with ID ${logId} not found.`)
    }

    if (existingFoodLog.lineUserId !== lineUserId) {
      this.logger.warn(
        `User ${lineUserId} attempted to update food log ${logId} owned by ${existingFoodLog.lineUserId}. Access denied.`,
      )
      throw new NotFoundException(
        `Food log with ID ${logId} not found for your account.`,
      )
    }

    // จัดการ clientTimestamp หากมีการส่งมา
    if (updateFoodLogDto.clientTimestamp) {
      try {
        const userTimezone = await this.userService.getUserTimezone(lineUserId)
        const clientTime = new Date(updateFoodLogDto.clientTimestamp)
        const utcTime = this.timezoneService.convertToUtc(
          clientTime,
          userTimezone,
        )
        existingFoodLog.logDate = utcTime
        this.logger.log(
          `Updated logDate from client timestamp: ${updateFoodLogDto.clientTimestamp} (${userTimezone}) -> ${utcTime.toISOString()} (UTC)`,
        )
      } catch (error) {
        this.logger.warn(`Failed to process clientTimestamp: ${error.message}`)
        // ไม่ throw error เพื่อให้การอัปเดตอื่นๆ ดำเนินต่อไปได้
      }
    }

    // Apply updates from DTO to the Mongoose document
    // This is a basic merge; more complex logic might be needed for nested objects or specific fields

    // Update mealType if provided
    if (updateFoodLogDto.mealType) {
      existingFoodLog.mealType = updateFoodLogDto.mealType
    }

    // Update food details if provided
    if (updateFoodLogDto.food) {
      const foodUpdate = updateFoodLogDto.food
      if (foodUpdate.foodName) {
        if (foodUpdate.foodName.th)
          existingFoodLog.food.foodName.th = foodUpdate.foodName.th
        if (foodUpdate.foodName.en)
          existingFoodLog.food.foodName.en = foodUpdate.foodName.en
      }
      if (foodUpdate.amount !== undefined)
        existingFoodLog.food.amount = foodUpdate.amount
      if (foodUpdate.unit) existingFoodLog.food.unit = foodUpdate.unit
      if (foodUpdate.portion) existingFoodLog.food.portion = foodUpdate.portion

      if (foodUpdate.nutrition) {
        const nutritionUpdate = foodUpdate.nutrition
        if (nutritionUpdate.calories !== undefined)
          existingFoodLog.food.nutrition.calories = nutritionUpdate.calories
        if (nutritionUpdate.protein !== undefined)
          existingFoodLog.food.nutrition.protein = nutritionUpdate.protein
        if (nutritionUpdate.carbs !== undefined)
          existingFoodLog.food.nutrition.carbs = nutritionUpdate.carbs
        if (nutritionUpdate.fat !== undefined)
          existingFoodLog.food.nutrition.fat = nutritionUpdate.fat
        if (nutritionUpdate.fiber !== undefined)
          existingFoodLog.food.nutrition.fiber = nutritionUpdate.fiber
        if (nutritionUpdate.sugar !== undefined)
          existingFoodLog.food.nutrition.sugar = nutritionUpdate.sugar
        if (nutritionUpdate.sodium !== undefined)
          existingFoodLog.food.nutrition.sodium = nutritionUpdate.sodium
      }

      if (foodUpdate.micronutrients) {
        if (!existingFoodLog.food.micronutrients) {
          existingFoodLog.food.micronutrients = new Map<
            string,
            VitaminMineralDetailSchemaDocument
          >()
        }
        for (const key in foodUpdate.micronutrients) {
          if (
            Object.prototype.hasOwnProperty.call(foodUpdate.micronutrients, key)
          ) {
            const microDetail = foodUpdate.micronutrients[key]
            if (microDetail) {
              const currentMicro =
                existingFoodLog.food.micronutrients.get(key) ||
                ({} as VitaminMineralDetailSchemaDocument)
              existingFoodLog.food.micronutrients.set(key, {
                value:
                  microDetail.value !== undefined
                    ? microDetail.value
                    : currentMicro.value || 0,
                unit: microDetail.unit || currentMicro.unit || 'g',
                dv: currentMicro.dv,
              })
            }
          }
        }
      }
    }

    // Update image details if provided
    if (updateFoodLogDto.imageUrl !== undefined) {
      if (!existingFoodLog.image) existingFoodLog.image = {} // Initialize if not present
      existingFoodLog.image.url = updateFoodLogDto.imageUrl
    }
    if (updateFoodLogDto.imageAlt !== undefined) {
      if (!existingFoodLog.image) existingFoodLog.image = {}
      existingFoodLog.image.alt = updateFoodLogDto.imageAlt
    }

    existingFoodLog.edited = true // Mark as edited
    // Consider adding an entry to editHistory here if that schema is active and used

    const updatedFoodLog = await existingFoodLog.save()
    this.logger.log(
      `Food log ${logId} updated successfully for user ${lineUserId}.`,
    )
    return this.mapToResponseDto(updatedFoodLog)
  }

  // Helper function to map FoodLogDocument to FoodLogResponseDto
  private mapToResponseDto(foodLogDoc: FoodLogDocument): FoodLogResponseDto {
    // Ensure micronutrients is converted from Mongoose Map to a plain object for the DTO if necessary
    // or handle it directly if your DTO expects a Map-like structure (Record<string, ...>)
    const micronutrientsDto: Record<
      string,
      VitaminMineralDetailSchemaDocument
    > = {} // Or define a more specific type
    if (foodLogDoc.food.micronutrients) {
      foodLogDoc.food.micronutrients.forEach((value, key) => {
        micronutrientsDto[key] = {
          value: value.value,
          unit: value.unit,
          dv: value.dv,
        }
      })
    }

    return {
      id: String(foodLogDoc._id),
      lineUserId: foodLogDoc.lineUserId,
      logDate: foodLogDoc.logDate,
      mealType: foodLogDoc.mealType,
      food: {
        foodName: {
          th: foodLogDoc.food.foodName.th,
          en: foodLogDoc.food.foodName.en,
        },
        amount: foodLogDoc.food.amount,
        unit: foodLogDoc.food.unit,
        portion: foodLogDoc.food.portion,
        nutrition: {
          calories: foodLogDoc.food.nutrition.calories,
          protein: foodLogDoc.food.nutrition.protein,
          carbs: foodLogDoc.food.nutrition.carbs,
          fat: foodLogDoc.food.nutrition.fat,
          fiber: foodLogDoc.food.nutrition.fiber,
          sugar: foodLogDoc.food.nutrition.sugar,
          sodium: foodLogDoc.food.nutrition.sodium,
        },
        micronutrients: micronutrientsDto,
      },
      imageUrl: foodLogDoc.image?.url,
      imageAlt: foodLogDoc.image?.alt,
      aiAnalyzed: foodLogDoc.aiAnalyzed,
      confidenceScore: foodLogDoc.confidenceScore,
      tags: foodLogDoc.tags,
      // Add other fields from foodLogDoc to DTO as defined in FoodLogResponseDto
    }
  }

  /**
   * Get food logs for a user within a date range for AI analysis
   */
  async findByUserForDateRange(
    lineUserId: string,
    startDate: Date,
    endDate: Date,
    limit: number = 100,
  ): Promise<FoodLogResponseDto[]> {
    this.logger.log(
      `Fetching food logs for user: ${lineUserId} from ${startDate.toISOString()} to ${endDate.toISOString()}, limit: ${limit}`,
    )

    const foodLogs = await this.foodLogModel
      .find({
        lineUserId,
        logDate: {
          $gte: startDate,
          $lte: endDate,
        },
      })
      .sort({ logDate: -1 }) // Most recent first
      .limit(limit)
      .exec()

    this.logger.log(`Found ${foodLogs.length} food logs for user ${lineUserId}`)

    return foodLogs.map((doc) => this.mapToResponseDto(doc))
  }

  /**
   * Get recent food logs for a user (for AI eating pattern analysis)
   */
  async getRecentFoodLogs(
    lineUserId: string,
    days: number = 30,
    limit: number = 100,
  ): Promise<FoodLogResponseDto[]> {
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(endDate.getDate() - days)

    return this.findByUserForDateRange(lineUserId, startDate, endDate, limit)
  }

  /**
   * Convert FoodLogResponseDto to FoodLogEntryDto for AI analysis
   */
  convertToFoodLogEntry(foodLogResponse: FoodLogResponseDto): {
    timestamp: Date
    mealType: string
    foodName: string
    calories: number
    protein: number
    carbs: number
    fat: number
    fiber?: number
  } {
    return {
      timestamp: foodLogResponse.logDate,
      mealType: foodLogResponse.mealType,
      foodName:
        foodLogResponse.food.foodName.th ||
        foodLogResponse.food.foodName.en ||
        'Unknown Food',
      calories: foodLogResponse.food.nutrition.calories ?? 0,
      protein: foodLogResponse.food.nutrition.protein ?? 0,
      carbs: foodLogResponse.food.nutrition.carbs ?? 0,
      fat: foodLogResponse.food.nutrition.fat ?? 0,
      fiber: foodLogResponse.food.nutrition.fiber,
    }
  }

  /**
   * Get food logs formatted for AI analysis
   */
  async getFoodLogsForAIAnalysis(
    lineUserId: string,
    days: number = 30,
    limit: number = 100,
  ): Promise<
    {
      timestamp: Date
      mealType: string
      foodName: string
      calories: number
      protein: number
      carbs: number
      fat: number
      fiber?: number
    }[]
  > {
    const foodLogs = await this.getRecentFoodLogs(lineUserId, days, limit)
    return foodLogs.map((log) => this.convertToFoodLogEntry(log))
  }

  /**
   * Remove/delete a food log by ID and lineUserId
   */
  async remove(logId: string, lineUserId: string): Promise<void> {
    this.logger.log(
      `Attempting to delete food log ${logId} for user ${lineUserId}`,
    )

    const result = await this.foodLogModel
      .findOneAndDelete({
        _id: logId,
        lineUserId: lineUserId,
      })
      .exec()

    if (!result) {
      this.logger.warn(
        `Food log ${logId} not found or user ${lineUserId} not authorized to delete`,
      )
      throw new NotFoundException(
        'Food log not found or you are not authorized to delete this item',
      )
    }

    this.logger.log(
      `Food log ${logId} deleted successfully for user ${lineUserId}`,
    )
  }
}
