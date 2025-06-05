import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { Food, FoodDocument } from '../schemas/food.schema'

@Injectable()
export class FoodItemService {
  constructor(@InjectModel(Food.name) private foodModel: Model<FoodDocument>) {}

  async findById(id: string): Promise<FoodDocument | null> {
    if (!Types.ObjectId.isValid(id)) {
      // Consider throwing a BadRequestException or similar if the ID format is invalid
      // For now, returning null or letting Mongoose handle it might be acceptable depending on desired behavior.
      // However, for consistency with other services, checking validity is good practice.
      console.warn(`[FoodItemService] Invalid ID format provided: ${id}`)
      return null // Or throw new BadRequestException('Invalid ID format');
    }
    return this.foodModel.findById(id).exec()
  }

  async findByIdOrFail(id: string): Promise<FoodDocument> {
    const foodItem = await this.findById(id)
    if (!foodItem) {
      throw new NotFoundException(`FoodItem with ID ${id} not found`)
    }
    return foodItem
  }

  // Add other necessary methods for FoodItemService, for example:
  // - create(createFoodItemDto: any): Promise<FoodDocument>
  // - update(id: string, updateFoodItemDto: any): Promise<FoodDocument>
  // - remove(id: string): Promise<void>

  // Example of a method that might be used by FoodLogService to validate/fetch food details
  async getFoodDetailsForLog(foodId?: string): Promise<FoodDocument | null> {
    if (!foodId) {
      return null
    }
    return this.findById(foodId)
  }
}
