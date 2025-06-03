import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { HttpModule } from '@nestjs/axios'
import { LineService } from './line.service'
import { LineController } from './line.controller'
import { ImageModule } from '../image/image.module' // ImageService is used by LineService
import { AiModule } from '../ai/ai.module' // AiService is used by LineService
import { UserModule } from '../user/user.module' // Added UserModule import
import { AnalysisCacheModule } from '../analysis-cache/analysis-cache.module' // Added import
import { FoodLogModule } from '../schemas/food-log.module' // Added FoodLogModule import
import { TemporaryImageLogModule } from '../schemas/temporary-image-log.module'
import { CommonModule } from '../common/common.module'
import { IntentDetectionService } from './intent-detection.service'
import { IntentDetectionMetricsService } from './intent-detection-metrics.service'
import { MongooseModule } from '@nestjs/mongoose'
import { FoodLog, FoodLogSchema } from '../schemas/food-log.schema'
import {
  TemporaryImageLog,
  TemporaryImageLogSchema,
} from '../schemas/temporary-image-log.schema'
import { OpenaiModule } from '../openai/openai.module'

@Module({
  imports: [
    ConfigModule, // For LineService and LineController to access config
    HttpModule, // Added HttpModule here
    ImageModule, // To provide ImageService to LineService
    AiModule, // To provide AiService to LineService (and ConversationHistoryService via re-export)
    UserModule, // Added UserModule
    AnalysisCacheModule, // Added module
    FoodLogModule, // Added FoodLogModule to imports
    TemporaryImageLogModule, // Added TemporaryImageLogModule to imports
    CommonModule, // To provide TimezoneService
    MongooseModule.forFeature([
      { name: FoodLog.name, schema: FoodLogSchema },
      { name: TemporaryImageLog.name, schema: TemporaryImageLogSchema },
    ]),
    OpenaiModule,
  ],
  controllers: [LineController],
  providers: [
    LineService,
    IntentDetectionService,
    IntentDetectionMetricsService,
  ],
  exports: [LineService, IntentDetectionService], // Export if other modules need to directly call LineService methods
})
export class LineModule {}
