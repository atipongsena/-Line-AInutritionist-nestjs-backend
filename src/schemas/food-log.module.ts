import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { FoodLog, FoodLogSchema } from './food-log.schema'

@Module({
  imports: [
    MongooseModule.forFeature([{ name: FoodLog.name, schema: FoodLogSchema }]),
  ],
  exports: [MongooseModule], // Export MongooseModule to make FoodLogModel injectable
})
export class FoodLogModule {}
