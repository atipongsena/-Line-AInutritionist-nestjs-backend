import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { ConversationHistoryService } from './conversation-history.service'
import {
  ConversationHistory,
  ConversationHistorySchema,
} from './conversation-history.schema'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ConversationHistory.name, schema: ConversationHistorySchema },
    ]),
  ],
  providers: [ConversationHistoryService],
  exports: [ConversationHistoryService], // Export service if it needs to be used in other modules
})
export class ConversationHistoryModule {}
