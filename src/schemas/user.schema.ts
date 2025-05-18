import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

export type UserDocument = User & Document

@Schema({ timestamps: true })
export class User {
  @Prop({
    required: [true, 'LINE User ID ต้องระบุ'],
    unique: true,
    index: true,
  })
  lineUserId: string

  @Prop({ default: '' })
  displayName?: string

  @Prop({ default: '' })
  pictureUrl?: string

  @Prop({ default: 'th' })
  language: string

  @Prop()
  goal?: string

  @Prop({
    enum: ['male', 'female', 'other', 'not_specified'],
    default: 'not_specified',
  })
  gender: string

  @Prop()
  age?: number

  @Prop()
  weightKg?: number

  @Prop()
  heightCm?: number

  @Prop({ default: 0 })
  bmi: number

  @Prop({
    enum: ['sedentary', 'light', 'moderate', 'active', 'very_active'],
    default: 'moderate',
  })
  activityLevel: string

  @Prop({
    enum: ['normal', 'keto', 'vegetarian', 'vegan', 'low_carb', 'high_protein'],
    default: 'normal',
  })
  dietType: string

  @Prop({ type: [String], default: [] })
  healthConditions: string[]

  @Prop({ type: [String], default: [] })
  foodAllergies: string[]

  @Prop({ type: [String], default: [] })
  foodRestrictions: string[]

  @Prop({ default: true })
  isActive: boolean

  @Prop({ default: Date.now })
  lastActiveAt: Date

  // Timestamps - Mongoose will add these, but we define them for type safety
  createdAt?: Date
  updatedAt?: Date
}

export const UserSchema = SchemaFactory.createForClass(User)

// Calculate BMI before saving
UserSchema.pre<UserDocument>('save', function (next) {
  if (this.isModified('weightKg') || this.isModified('heightCm')) {
    if (this.weightKg && this.heightCm && this.heightCm > 0) {
      const heightInMeters = this.heightCm / 100
      this.bmi = parseFloat(
        (this.weightKg / (heightInMeters * heightInMeters)).toFixed(2),
      )
    } else {
      this.bmi = 0 // Reset or set to null if preferred
    }
  }
  next()
})

// Control what is returned when .toJSON() is called (e.g., when sending response to client)
UserSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) {
    delete ret._id // Optionally remove _id from the transformed object
    // delete ret.lineUserId // Might want to keep lineUserId for some scenarios
    // Remove other fields if they are not needed in UserProfileDto for example
  },
})
