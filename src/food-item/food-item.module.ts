import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { FoodItemService } from './food-item.service'
import { Food, FoodSchema } from '../schemas/food.schema' // Assuming food.schema.ts is in src/schemas/

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Food.name, schema: FoodSchema }]),
  ],
  providers: [FoodItemService],
  exports: [FoodItemService],
})
export class FoodItemModule {}
