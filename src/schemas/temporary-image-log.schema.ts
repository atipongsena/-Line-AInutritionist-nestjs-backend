import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

export type TemporaryImageLogDocument = TemporaryImageLog & Document

@Schema({ timestamps: true, collection: 'temporaryimagelogs' })
export class TemporaryImageLog {
  @Prop({ required: true, index: true })
  blobName: string

  @Prop({ required: true })
  url: string

  @Prop({ required: true, index: true })
  lineUserId: string

  // expiresAt can be set to 7 days from createdAt upon creation
  @Prop({ required: true, index: true })
  expiresAt: Date

  // createdAt and updatedAt will be automatically managed by timestamps: true
}

export const TemporaryImageLogSchema =
  SchemaFactory.createForClass(TemporaryImageLog)

// Optional: TTL index for auto-deletion by MongoDB itself if not using expiresAt actively with cron.
// If using expiresAt with cron, this specific TTL index might be redundant or could be configured differently.
// For now, we rely on the cron job to check expiresAt.
// TemporaryImageLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
