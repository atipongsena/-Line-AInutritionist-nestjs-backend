import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Schema as MongooseSchema, Types } from 'mongoose'

export type FoodLogDocument = FoodLog & Document

@Schema({ _id: false })
class LocalizedName {
  @Prop({ required: true })
  th: string

  @Prop()
  en?: string
}

@Schema({ _id: false })
class FoodNutrition {
  @Prop({ required: true })
  calories: number

  @Prop({ default: 0 })
  protein?: number

  @Prop({ default: 0 })
  carbs?: number

  @Prop({ default: 0 })
  fat?: number

  @Prop({ default: 0 })
  fiber?: number

  @Prop({ default: 0 })
  sugar?: number

  @Prop({ default: 0 })
  sodium?: number

  @Prop({ default: 0 })
  cholesterol?: number

  @Prop({ default: 0 })
  saturated_fat?: number

  @Prop({ default: 0 })
  water?: number

  @Prop({ default: 0 })
  omega3?: number
}

@Schema({ _id: false })
export class VitaminMineralDetailSchemaDocument {
  @Prop({ required: true })
  value: number

  @Prop({ required: true })
  unit: string

  @Prop()
  dv?: number
}

export const VitaminMineralDetailSchema = SchemaFactory.createForClass(
  VitaminMineralDetailSchemaDocument,
)

@Schema({ _id: false })
class FoodDetail {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Food' })
  foodId?: Types.ObjectId // Can be null if food is not from DB

  @Prop({ type: LocalizedName, required: true })
  foodName: LocalizedName

  @Prop({ required: true, min: 0 })
  amount: number

  @Prop({ required: true, default: 'g' })
  unit: string

  @Prop({ default: '' })
  portion?: string

  @Prop({ type: FoodNutrition, required: true })
  nutrition: FoodNutrition

  @Prop({ type: Map, of: VitaminMineralDetailSchema, default: {} })
  micronutrients?: Map<string, VitaminMineralDetailSchemaDocument>
}

@Schema({ _id: false })
export class ImageInfo {
  @Prop({ default: '' })
  url?: string

  @Prop({ default: '' })
  blobName?: string

  @Prop({ default: '' })
  alt?: string

  @Prop({ type: Date })
  uploadDate?: Date

  @Prop({ type: Boolean })
  isPermanent?: boolean

  @Prop({ type: Number })
  retentionDays?: number
}

@Schema({ _id: false })
class LocationInfo {
  @Prop()
  name?: string

  @Prop()
  latitude?: number

  @Prop()
  longitude?: number
}

@Schema({ _id: false })
class EditHistoryEntry {
  @Prop({ default: Date.now })
  timestamp: Date

  @Prop({ type: Object })
  previousData?: any
}

@Schema({ timestamps: true, collection: 'foodlogs' })
export class FoodLog {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId: Types.ObjectId // Reference to User schema

  @Prop({ required: true, index: true })
  lineUserId: string

  @Prop({ index: true }) // Added index for potential queries
  sourceMessageId?: string // To store the original LINE message ID that triggered the analysis

  @Prop({ type: FoodDetail, required: true })
  food: FoodDetail

  @Prop({ required: true, default: Date.now, index: true })
  logDate: Date

  @Prop({
    required: true,
    enum: ['breakfast', 'lunch', 'dinner', 'snack', 'other'],
    index: true,
  })
  mealType: string

  @Prop({ type: ImageInfo, default: () => ({}) })
  image?: ImageInfo

  @Prop({ trim: true })
  note?: string

  @Prop({ type: LocationInfo, default: () => ({}) })
  location?: LocationInfo

  @Prop({ type: [String], default: [] })
  tags?: string[]

  @Prop({ default: false })
  aiAnalyzed?: boolean

  @Prop({ min: 0, max: 1, default: 0 })
  confidenceScore?: number

  @Prop({ default: false })
  edited?: boolean

  @Prop({ type: [EditHistoryEntry], default: [] })
  editHistory?: EditHistoryEntry[]
}

export const FoodLogSchema = SchemaFactory.createForClass(FoodLog)

// Additional indexes from the original schema
FoodLogSchema.index({ userId: 1, logDate: -1 })
FoodLogSchema.index({ lineUserId: 1, logDate: -1 })
FoodLogSchema.index({ lineUserId: 1, mealType: 1 })
FoodLogSchema.index({ 'food.nutrition.calories': 1 })
FoodLogSchema.index({ tags: 1 })

// Static methods like getNutritionSummaryByDateRange will be moved to a service.
// Virtuals from the original schema (if any that were missed in the summary) would also be handled here or in services.
// Pre-save hooks from the original schema would be translated using @nestjs/mongoose hooks if needed.
