import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { NutritionService } from './nutrition.service'
import { AiModule } from '../ai/ai.module'
// Import Mongoose schema modules if they will be directly used by NutritionService or if NutritionService needs to inject their models.
// For now, we assume UserModule, FoodLogModule, and NutritionGoalModule are needed as they contain the models NutritionService will likely interact with.
import { UserModule } from '../schemas/user.module'
import { FoodLogModule } from '../schemas/food-log.module'
import { NutritionGoalModule } from '../schemas/nutrition-goal.module'

@Module({
  imports: [
    ConfigModule,
    AiModule,
    UserModule, // To inject UserModel
    FoodLogModule, // To inject FoodLogModel
    NutritionGoalModule, // To inject NutritionGoalModel
  ],
  providers: [NutritionService],
  exports: [NutritionService],
})
export class NutritionModule {}
