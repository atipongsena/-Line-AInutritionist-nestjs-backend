import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { HttpModule } from '@nestjs/axios'
import { LineService } from './line.service'
import { LineController } from './line.controller'
import { ImageModule } from '../image/image.module' // ImageService is used by LineService
import { AiModule } from '../ai/ai.module' // AiService is used by LineService
import { UserModule } from '../user/user.module' // Added UserModule import
import { AnalysisCacheModule } from '../analysis-cache/analysis-cache.module' // Added import

@Module({
  imports: [
    ConfigModule, // For LineService and LineController to access config
    HttpModule, // Added HttpModule here
    ImageModule, // To provide ImageService to LineService
    AiModule, // To provide AiService to LineService
    UserModule, // Added UserModule
    AnalysisCacheModule, // Added module
  ],
  controllers: [LineController],
  providers: [LineService],
  exports: [LineService], // Export if other modules need to directly call LineService methods
})
export class LineModule {}
