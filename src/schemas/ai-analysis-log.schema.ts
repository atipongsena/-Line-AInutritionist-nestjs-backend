import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Schema as MongooseSchema } from 'mongoose'

export type AiAnalysisLogDocument = AiAnalysisLog & Document

@Schema({ timestamps: true }) // timestamps: true จะสร้าง createdAt และ updatedAt ให้อัตโนมัติ (ตรงกับ timestamp เดิม)
export class AiAnalysisLog {
  @Prop({ required: true, index: true })
  lineUserId: string

  // createdAt and updatedAt will be automatically managed by Mongoose via timestamps: true

  @Prop({ required: true, enum: ['text', 'image'] })
  inputType: string

  @Prop({ required: true }) // Stores the text query or image messageId
  inputData: string

  @Prop() // e.g., 'gpt-3.5-turbo', 'gpt-4'
  modelUsed?: string

  @Prop({ default: 'initial' }) // e.g., 'initial', 'log_time'
  analysisContext?: string

  @Prop({ type: MongooseSchema.Types.Mixed, required: true }) // To store the potentially complex JSON result
  analysisResult: any // หรือจะสร้าง Interface/Class สำหรับโครงสร้างนี้โดยเฉพาะถ้ามีโครงสร้างที่แน่นอน

  @Prop() // Store the raw text response if available
  rawResponse?: string

  @Prop({ type: { tokens: Number, latency: Number } })
  usage?: {
    tokens?: number
    latency?: number // in milliseconds
  }

  // Optional: Add fields for user feedback on the analysis later
  // @Prop()
  // feedbackRating?: number;
  // @Prop()
  // feedbackComment?: string;
}

export const AiAnalysisLogSchema = SchemaFactory.createForClass(AiAnalysisLog)

// Indexes for common queries (เดิม)
// aiAnalysisLogSchema.index({ timestamp: -1 }); // Mongoose timestamps: true จัดการ createdAt/updatedAt ซึ่งสามารถ index ได้
AiAnalysisLogSchema.index({ inputType: 1, createdAt: -1 }) // เปลี่ยน timestamp เป็น createdAt
// หากต้องการ index lineUserId และ createdAt (สำหรับการ query ประวัติล่าสุดของ user)
AiAnalysisLogSchema.index({ lineUserId: 1, createdAt: -1 })
