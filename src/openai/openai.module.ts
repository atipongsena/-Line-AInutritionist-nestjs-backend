import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { OpenaiService } from './openai.service'

@Module({
  imports: [ConfigModule], // OpenaiService depends on ConfigService
  providers: [OpenaiService],
  exports: [OpenaiService], // Export OpenaiService to be used in other modules
})
export class OpenaiModule {}
