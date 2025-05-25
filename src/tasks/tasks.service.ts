import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { FoodLog, FoodLogDocument } from '../schemas/food-log.schema'
import {
  TemporaryImageLog,
  TemporaryImageLogDocument,
} from '../schemas/temporary-image-log.schema'
import { ImageService } from '../image/image.service'

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name)

  constructor(
    @InjectModel(FoodLog.name) private foodLogModel: Model<FoodLogDocument>,
    @InjectModel(TemporaryImageLog.name)
    private temporaryImageLogModel: Model<TemporaryImageLogDocument>,
    private readonly imageService: ImageService,
  ) {}

  @Cron('0 3 * * *') // Run daily at 3 AM (0 minutes, 3 hours, any day of month, any month, any day of week)
  // @Cron(CronExpression.EVERY_DAY_AT_3AM) // Common alternative enum
  // @Cron('*/30 * * * * *') // For testing: Run every 30 seconds
  async handleCronDeleteOldFoodLogImages() {
    this.logger.log('Running cron job: DeleteOldFoodLogImages')

    // Using image.uploadDate and image.retentionDays for deletion logic
    // This requires that these fields are properly set when FoodLog is created/updated.

    try {
      const foodLogsToDeleteImages = await this.foodLogModel
        .find({
          'image.blobName': { $exists: true, $ne: '' },
          'image.isPermanent': true, // Only target permanent images linked to meals
          'image.uploadDate': { $exists: true },
          // We will filter by retentionDays in the loop as it's dynamic
        })
        .exec()

      if (foodLogsToDeleteImages.length === 0) {
        this.logger.log(
          'No food log images to check for deletion based on retention policy.',
        )
        return
      }

      this.logger.log(
        `Found ${foodLogsToDeleteImages.length} food logs with permanent images to check.`,
      )

      let deletedCount = 0
      for (const foodLog of foodLogsToDeleteImages) {
        if (
          foodLog.image &&
          foodLog.image.blobName &&
          foodLog.image.uploadDate &&
          typeof foodLog.image.retentionDays === 'number'
        ) {
          const uploadDate = new Date(foodLog.image.uploadDate)
          const retentionDays = foodLog.image.retentionDays
          const expiryDate = new Date(uploadDate)
          expiryDate.setDate(uploadDate.getDate() + retentionDays)

          if (expiryDate <= new Date()) {
            // Image has expired
            try {
              const blobNameToDelete = String(foodLog.image.blobName)
              const foodLogId = String(foodLog._id)
              this.logger.log(
                `Attempting to delete expired image: ${blobNameToDelete} for foodLog ID: ${foodLogId} (retention: ${retentionDays} days, expired on: ${expiryDate.toISOString()})`,
              )
              await this.imageService.deleteImage(blobNameToDelete)
              this.logger.log(`Successfully deleted image: ${blobNameToDelete}`)
              deletedCount++

              // Clear image info from foodLog document
              foodLog.image.url = undefined // or ''
              foodLog.image.blobName = undefined // or ''
              // foodLog.image.uploadDate = undefined; // Keep for history or clear
              // foodLog.image.retentionDays = undefined; // Keep for history or clear
              await foodLog.save()
              this.logger.log(`Cleared image info for foodLog ID: ${foodLogId}`)
            } catch (error: unknown) {
              const errorMessage =
                error instanceof Error ? error.message : String(error)
              this.logger.error(
                `Failed to delete image ${String(foodLog.image.blobName)} for foodLog ID: ${String(foodLog._id)}. Error: ${errorMessage}`,
              )
            }
          }
        }
      }
      this.logger.log(
        `Finished cron job: DeleteOldFoodLogImages. Deleted ${deletedCount} images.`,
      )
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      this.logger.error(
        `Error during DeleteOldFoodLogImages cron job: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      )
    }
  }

  // New cron job for deleting expired temporary images
  @Cron('0 4 * * *') // Run daily at 4 AM
  async handleCronDeleteExpiredTemporaryImages() {
    this.logger.log('Running cron job: DeleteExpiredTemporaryImages')
    try {
      const now = new Date()
      const expiredLogs = await this.temporaryImageLogModel
        .find({
          expiresAt: { $lte: now },
        })
        .exec()

      if (expiredLogs.length === 0) {
        this.logger.log('No expired temporary images to delete.')
        return
      }

      this.logger.log(
        `Found ${expiredLogs.length} expired temporary images to delete.`,
      )
      let deletedCount = 0
      for (const tempLog of expiredLogs) {
        if (tempLog.blobName) {
          try {
            this.logger.log(
              `Attempting to delete temporary image: ${tempLog.blobName} (expiredAt: ${tempLog.expiresAt.toISOString()})`,
            )
            await this.imageService.deleteImage(tempLog.blobName)
            this.logger.log(
              `Successfully deleted temporary image from storage: ${tempLog.blobName}`,
            )
            await this.temporaryImageLogModel.deleteOne({ _id: tempLog._id })
            this.logger.log(
              `Successfully deleted temporary image log from DB: ${tempLog.blobName}`,
            )
            deletedCount++
          } catch (error: unknown) {
            const errorMessage =
              error instanceof Error ? error.message : String(error)
            this.logger.error(
              `Failed to delete temporary image ${tempLog.blobName} or its log. Error: ${errorMessage}`,
            )
          }
        }
      }
      this.logger.log(
        `Finished cron job: DeleteExpiredTemporaryImages. Deleted ${deletedCount} images/logs.`,
      )
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      this.logger.error(
        `Error during DeleteExpiredTemporaryImages cron job: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      )
    }
  }
}
