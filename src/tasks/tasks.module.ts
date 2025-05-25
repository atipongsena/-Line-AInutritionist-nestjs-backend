import { Module } from '@nestjs/common'
import { TasksService } from './tasks.service'
import { ImageModule } from '../image/image.module' // Import ImageModule to use ImageService
import { MongooseModule } from '@nestjs/mongoose'
import { FoodLog, FoodLogSchema } from '../schemas/food-log.schema'
import { TemporaryImageLogModule } from '../schemas/temporary-image-log.module' // Added import

@Module({
  imports: [
    ImageModule, // Make ImageService available
    MongooseModule.forFeature([{ name: FoodLog.name, schema: FoodLogSchema }]), // To interact with FoodLog data
    TemporaryImageLogModule, // Added TemporaryImageLogModule to imports
  ],
  providers: [TasksService],
  exports: [TasksService], // Export if other modules need to use it, optional for now
})
export class TasksModule {}
