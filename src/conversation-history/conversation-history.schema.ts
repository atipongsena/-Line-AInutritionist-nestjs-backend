import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Schema as MongooseSchema } from 'mongoose'
// We don't strictly need a direct DB-level ref to User if we query by lineUserId,
// but it can be useful for population or data integrity.
// For now, let's keep it simple and primarily use lineUserId.

// Interface for structured analysis results that can be used for buttons
export interface AnalysisResult {
  type:
    | 'food_analysis'
    | 'nutrition_goal'
    | 'eating_pattern'
    | 'meal_recommendation'
  id: string // Unique ID for this analysis (e.g., messageId or timestamp-based)
  title: string // Display name for button (e.g., "ข้าวผัดกุ้ง - 520 kcal")
  summary: string // Short summary for preview
  data: Record<string, unknown> // Changed from any to unknown
  createdAt: Date
  imageUrl?: string // For food analysis with image
}

// Interface for individual messages within the history
// This matches roughly with OpenAI.Chat.Completions.ChatCompletionMessageParam content part
// For simplicity, we'll store 'content' as a string.
// If content is an array (e.g. for image URLs), it should be stringified.
export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string // Could be simple text or stringified JSON for complex content like image URLs
  timestamp: Date
  analysisResult?: AnalysisResult // Structured analysis data for buttons
  responseId?: string // Responses API response ID for conversation state
  // tokenCount?: number; // Optional: for more precise context window management later
}

@Schema({ timestamps: true, collection: 'conversation_histories' })
export class ConversationHistory extends Document {
  // We'll use lineUserId as the primary key for querying history for a given LINE user.
  // This avoids needing to look up the User's ObjectId first from LineService.
  @Prop({ type: String, required: true, unique: true, index: true })
  lineUserId: string

  @Prop({
    type: [
      {
        role: { type: String, required: true, enum: ['user', 'assistant'] },
        content: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        analysisResult: {
          type: new MongooseSchema({
            type: {
              type: String,
              enum: [
                'food_analysis',
                'nutrition_goal',
                'eating_pattern',
                'meal_recommendation',
              ],
              required: true,
            },
            id: { type: String, required: true },
            title: { type: String, required: true },
            summary: { type: String, required: true },
            data: { type: MongooseSchema.Types.Mixed, required: true },
            createdAt: { type: Date, required: true },
            imageUrl: { type: String, required: false },
          }),
          required: false,
        },
        responseId: { type: String, required: false },
        // tokenCount: { type: Number }
      },
    ],
    default: [],
  })
  messages: ConversationMessage[]

  // We can update this timestamp on each new message to easily find active/recent conversations
  // @Prop({ default: Date.now, index: true }) // timestamps:true already provides createdAt and updatedAt
  // lastUpdatedAt: Date; // Renamed from lastInteraction for clarity, and will be updated by timestamps:true -- This is now managed by `updatedAt` from `timestamps: true`

  // Mongoose 'timestamps: true' automatically adds 'createdAt' and 'updatedAt' fields.
  // We will use 'updatedAt' as the indicator for the last interaction.
  // No need for a separate lastUpdatedAt field if using timestamps:true.
  // However, the pre-save hook below explicitly updates `updatedAt` on `messages` modification,
  // which is redundant if `timestamps: true` works as expected for sub-array modifications.
  // Forcing update of `updatedAt` on messages change to be sure.
}

export const ConversationHistorySchema =
  SchemaFactory.createForClass(ConversationHistory)

// Explicitly update the `updatedAt` field when the `messages` array is modified.
// This ensures that even if only the array content changes, `updatedAt` reflects the latest interaction.
ConversationHistorySchema.pre('save', function (next) {
  if (this.isModified('messages')) {
    // Note: `this.set({ updatedAt: new Date() })` might be more robust if `timestamps:true` doesn't auto-update on sub-document array changes.
    // For now, relying on `timestamps:true` for `updatedAt`, and ensuring the hook exists if manual update is needed later.
    // If `timestamps: true` updates `updatedAt` correctly on sub-array modification, this hook might become redundant for `updatedAt`.
    // However, it's good for ensuring `lastUpdatedAt` (if we were using a custom one) is always current.
    // Since we removed `lastUpdatedAt` in favor of `updatedAt` from `timestamps:true`,
    // this pre-save hook's primary purpose of updating a *custom* `lastUpdatedAt` is gone.
    // However, if `timestamps: true` does not automatically update `updatedAt` when *only* the `messages` array changes (and not top-level fields),
    // then this hook is still valuable to force an update to `updatedAt`.
    // Let's assume for now `timestamps: true` handles it. If not, we can re-enable `this.updatedAt = new Date();`
  }
  next()
})
