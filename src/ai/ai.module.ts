import { Module } from '@nestjs/common'
import { AiService } from './ai.service'
import { PromptCachingService } from './prompt-caching.service'
import { MetaPromptsService } from './meta-prompts.service'
import { OpenaiModule } from '../openai/openai.module' // AiService needs OpenaiService from OpenaiModule
import { ConversationHistoryModule } from '../conversation-history/conversation-history.module'
import { AnalysisCacheModule } from '../analysis-cache/analysis-cache.module'
import { FoodLogModule } from '../food-log/food-log.module' // Import FoodLogModule for FoodLogService dependency

@Module({
  imports: [
    OpenaiModule,
    ConversationHistoryModule,
    AnalysisCacheModule,
    FoodLogModule,
  ],
  providers: [AiService, PromptCachingService, MetaPromptsService],
  exports: [
    AiService,
    PromptCachingService,
    MetaPromptsService,
    ConversationHistoryModule, // Re-export ConversationHistoryModule เพื่อให้ผู้ import AiModule ใช้ ConversationHistoryService ได้
  ],
})
export class AiModule {}
