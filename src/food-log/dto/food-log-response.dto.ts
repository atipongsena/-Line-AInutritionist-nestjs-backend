import { VitaminMineralDetailSchemaDocument } from '../../schemas/food-log.schema'

// It's often good practice to have specific DTOs for responses,
// even if they closely mirror the schema, to allow for future flexibility
// and to avoid exposing database schema details directly if not desired.

// Base Nutrition Details (can be a separate DTO if reused)
interface FoodNutritionResponseDto {
  calories: number
  protein?: number
  carbs?: number
  fat?: number
  fiber?: number
  sugar?: number
  sodium?: number
  // Add other relevant macronutrients if they exist in your FoodNutrition sub-schema
}

// Details for each food item within the log (if applicable, or directly in FoodLogResponseDto)
interface FoodDetailResponseDto {
  foodName: { th?: string; en?: string } // Assuming you might have localized names
  amount?: number
  unit?: string
  portion?: string // e.g., "1 bowl (approx 300g)"
  nutrition: FoodNutritionResponseDto
  micronutrients?: Record<string, VitaminMineralDetailSchemaDocument> // Using the existing schema type for now
  // If you need to transform VitaminMineralDetailSchemaDocument for the response, create a specific DTO for it too.
}

export class FoodLogResponseDto {
  id: string // Typically the document ID (_id)
  lineUserId: string
  logDate: Date
  mealType: string // breakfast, lunch, dinner, snack, other

  food: FoodDetailResponseDto // Embed the food details

  imageUrl?: string // URL of the primary image for this log
  imageAlt?: string

  aiAnalyzed?: boolean
  confidenceScore?: number
  tags?: string[]

  // You might want to include other fields from FoodLogSchema as needed by the LIFF app
  // For example, if the LIFF app needs to know if the image is permanent:
  // imageIsPermanent?: boolean;

  // Constructor or a static factory method can be useful for mapping from FoodLogDocument
  // static fromDocument(doc: FoodLogDocument): FoodLogResponseDto { ... }
}
