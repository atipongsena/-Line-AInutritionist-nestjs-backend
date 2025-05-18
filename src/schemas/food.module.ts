import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { Food, FoodSchema } from './food.schema'

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Food.name, schema: FoodSchema }]),
  ],
  exports: [MongooseModule], // Export MongooseModule เพื่อให้ FoodModel ถูก inject ได้
})
export class FoodModule {}
