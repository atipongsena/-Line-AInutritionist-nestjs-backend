import { Module } from '@nestjs/common'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { MongooseModule } from '@nestjs/mongoose'
import { ScheduleModule } from '@nestjs/schedule'
import { TasksModule } from './tasks/tasks.module'
import { AiAnalysisLogModule } from './schemas/ai-analysis-log.module'
import { FoodModule } from './schemas/food.module'
import { UserModule } from './user/user.module'
import { NutritionGoalModule } from './schemas/nutrition-goal.module'
import { FoodLogModule } from './food-log/food-log.module'
import { OpenaiModule } from './openai/openai.module'
import { AiModule } from './ai/ai.module'
import { ImageModule } from './image/image.module'
import { LineModule } from './line/line.module'
import { NutritionModule } from './nutrition/nutrition.module'
import { ConversationHistoryModule } from './conversation-history/conversation-history.module'
import { AnalysisCacheModule } from './analysis-cache/analysis-cache.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('DATABASE_URL'),
        retryWrites: false,
        retryReads: false,
      }),
      inject: [ConfigService],
    }),
    ScheduleModule.forRoot(),
    TasksModule,
    AiAnalysisLogModule,
    FoodModule,
    UserModule,
    NutritionGoalModule,
    FoodLogModule,
    OpenaiModule,
    AiModule,
    ImageModule,
    LineModule,
    NutritionModule,
    ConversationHistoryModule,
    AnalysisCacheModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
