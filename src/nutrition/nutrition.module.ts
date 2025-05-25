import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { NutritionService } from './nutrition.service'
import { AiModule } from '../ai/ai.module'
// Import Mongoose schema modules if they will be directly used by NutritionService or if NutritionService needs to inject their models.
// For now, we assume UserModule, FoodLogModule, and NutritionGoalModule are needed as they contain the models NutritionService will likely interact with.
import { UserModule } from '../schemas/user.module'
import { FoodLogModule } from '../schemas/food-log.module'
import { NutritionGoalModule } from '../schemas/nutrition-goal.module'
import { NutritionController } from './nutrition.controller'
import { MongooseModule } from '@nestjs/mongoose'
import { FoodLog, FoodLogSchema } from '../schemas/food-log.schema'
import { User, UserSchema } from '../schemas/user.schema'
import {
  AiAnalysisLog,
  AiAnalysisLogSchema,
} from '../schemas/ai-analysis-log.schema'
import { Food, FoodSchema } from '../schemas/food.schema'
import { HttpModule } from '@nestjs/axios'

@Module({
  imports: [
    ConfigModule,
    AiModule,
    UserModule, // To inject UserModel
    FoodLogModule, // To inject FoodLogModel
    NutritionGoalModule, // To inject NutritionGoalModel
    HttpModule,
    MongooseModule.forFeature([
      { name: FoodLog.name, schema: FoodLogSchema },
      { name: User.name, schema: UserSchema },
      { name: AiAnalysisLog.name, schema: AiAnalysisLogSchema },
      { name: Food.name, schema: FoodSchema },
    ]),
  ],
  providers: [NutritionService],
  exports: [NutritionService],
  controllers: [NutritionController],
})
export class NutritionModule {}
