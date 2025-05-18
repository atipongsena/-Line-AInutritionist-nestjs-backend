import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

export type FoodDocument = Food & Document

// Sub-schema for multilingual names
@Schema({ _id: false })
class LocalizedName {
  @Prop({ required: true, trim: true })
  th: string

  @Prop({ trim: true })
  en?: string
}

// Sub-schema for multilingual descriptions
@Schema({ _id: false })
class LocalizedDescription {
  @Prop({ default: '' })
  th: string

  @Prop({ default: '' })
  en?: string
}

// Sub-schema for nutrition facts
@Schema({ _id: false })
class Nutrition {
  @Prop({ required: true })
  calories: number

  @Prop({ required: true })
  protein: number

  @Prop({ required: true })
  carbs: number

  @Prop({ required: true })
  fat: number

  @Prop({ default: 0 })
  fiber?: number

  @Prop({ default: 0 })
  sugar?: number

  @Prop({ default: 0 })
  sodium?: number
}

// Sub-schema for serving information
@Schema({ _id: false })
class Serving {
  @Prop({ default: 100 })
  size: number

  @Prop({
    default: 'g',
    enum: ['g', 'ml', 'piece', 'serving', 'cup', 'tbsp', 'tsp'],
  })
  unit: string

  @Prop({ default: 100 }) // น้ำหนักเป็นกรัม
  weight: number
}

// Sub-schema for food components (ingredients)
@Schema({ _id: false })
class FoodComponent {
  @Prop({ type: LocalizedName, required: true })
  name: LocalizedName

  @Prop({ default: 0 })
  amount?: number

  @Prop({ default: 'g' })
  unit?: string
}

// Sub-schema for image
@Schema({ _id: false })
class ImageInfo {
  @Prop({ default: '' })
  url?: string

  @Prop({ default: '' })
  alt?: string
}

@Schema({ timestamps: true })
export class Food {
  @Prop({ type: LocalizedName, required: true })
  name: LocalizedName

  @Prop({ type: LocalizedDescription, default: () => ({}) })
  description: LocalizedDescription

  @Prop({ type: Nutrition, required: true })
  nutrition: Nutrition

  @Prop({ type: Serving, default: () => ({}) })
  serving: Serving

  @Prop({
    required: true,
    enum: [
      'grain',
      'meat',
      'seafood',
      'vegetable',
      'fruit',
      'dairy',
      'beverage',
      'dessert',
      'snack',
      'fastfood',
      'condiment',
      'dish',
      'other',
    ],
  })
  category: string

  @Prop({ type: [FoodComponent], default: [] })
  components: FoodComponent[]

  @Prop({ type: [String], default: [] })
  tags: string[]

  @Prop({ type: ImageInfo, default: () => ({}) })
  image: ImageInfo

  @Prop({ default: false }) // ตรวจสอบโดยผู้เชี่ยวชาญแล้วหรือไม่
  isVerified: boolean

  @Prop({ default: '' }) // แหล่งที่มาของข้อมูล
  source?: string

  @Prop({ trim: true, index: true, sparse: true }) // sparse: true for optional unique/indexed fields
  barcode?: string

  @Prop({ trim: true })
  brand?: string

  @Prop({ default: false })
  isVegetarian: boolean

  @Prop({ default: false })
  isVegan: boolean

  @Prop({
    type: [String],
    default: [],
    enum: [
      'gluten',
      'dairy',
      'nuts',
      'peanuts',
      'soy',
      'egg',
      'fish',
      'shellfish',
      'sesame',
      'wheat',
    ],
  })
  commonAllergens: string[]

  @Prop({ default: 0 })
  usageCount: number

  // Methods - can be defined directly in the class
  async incrementUsage(this: FoodDocument): Promise<FoodDocument> {
    this.usageCount += 1
    return this.save()
  }

  calculateNutrition(
    this: Food,
    amount: number,
    unit: string = 'g',
  ): Partial<Nutrition> {
    let weightInGrams = amount
    const servingInfo = this.serving || { weight: 100, unit: 'g' } // Default if serving is undefined
    const nutritionInfo = this.nutrition

    if (unit === 'serving' && servingInfo.weight) {
      weightInGrams = amount * servingInfo.weight
    } else if (
      unit === 'piece' &&
      servingInfo.unit === 'piece' &&
      servingInfo.weight
    ) {
      weightInGrams = amount * servingInfo.weight
    }

    const ratio = weightInGrams / 100 // Nutrition facts are per 100g

    return {
      calories: Math.round((nutritionInfo.calories || 0) * ratio),
      protein: parseFloat(((nutritionInfo.protein || 0) * ratio).toFixed(1)),
      carbs: parseFloat(((nutritionInfo.carbs || 0) * ratio).toFixed(1)),
      fat: parseFloat(((nutritionInfo.fat || 0) * ratio).toFixed(1)),
      fiber: parseFloat(((nutritionInfo.fiber || 0) * ratio).toFixed(1)),
      sugar: parseFloat(((nutritionInfo.sugar || 0) * ratio).toFixed(1)),
      sodium: Math.round((nutritionInfo.sodium || 0) * ratio),
    }
  }

  hasAllergen(this: Food, allergen: string): boolean {
    return this.commonAllergens.includes(allergen)
  }
}

export const FoodSchema = SchemaFactory.createForClass(Food)

// Indexes
FoodSchema.index({
  'name.th': 'text',
  'name.en': 'text',
  'description.th': 'text',
  tags: 'text',
})
FoodSchema.index({ category: 1 })
FoodSchema.index({ isVegetarian: 1 })
FoodSchema.index({ isVegan: 1 })
FoodSchema.index({ 'nutrition.calories': 1 })
