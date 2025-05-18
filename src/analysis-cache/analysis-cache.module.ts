import { Module } from '@nestjs/common'
import { AnalysisCacheService } from './analysis-cache.service'

@Module({
  providers: [AnalysisCacheService],
  exports: [AnalysisCacheService],
})
export class AnalysisCacheModule {}
