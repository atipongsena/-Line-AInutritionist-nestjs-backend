import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { NutritionGoal, NutritionGoalSchema } from './nutrition-goal.schema'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: NutritionGoal.name, schema: NutritionGoalSchema },
    ]),
  ],
  exports: [MongooseModule], // Export MongooseModule เพื่อให้ NutritionGoalModel ถูก inject ได้
})
export class NutritionGoalModule {}
