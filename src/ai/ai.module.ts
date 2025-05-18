import { Module } from '@nestjs/common'
import { AiService } from './ai.service'
import { OpenaiModule } from '../openai/openai.module' // AiService needs OpenaiService from OpenaiModule
import { ConversationHistoryModule } from '../conversation-history/conversation-history.module'
import { AnalysisCacheModule } from '../analysis-cache/analysis-cache.module'

@Module({
  imports: [OpenaiModule, ConversationHistoryModule, AnalysisCacheModule],
  providers: [AiService],
  exports: [AiService], // Export AiService if other modules need to use it directly
})
export class AiModule {}
