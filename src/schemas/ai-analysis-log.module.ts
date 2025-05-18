import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { AiAnalysisLog, AiAnalysisLogSchema } from './ai-analysis-log.schema'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AiAnalysisLog.name, schema: AiAnalysisLogSchema },
    ]),
  ],
  // หากต้องการสร้าง Service สำหรับจัดการ AiAnalysisLog โดยเฉพาะ สามารถเพิ่ม providers และ exports ได้ที่นี่
  // providers: [AiAnalysisLogService],
  // exports: [AiAnalysisLogService, MongooseModule], // Export MongooseModule ถ้าต้องการให้ Model ถูก inject โดยตรงใน module อื่น
  exports: [MongooseModule], // หรือจะ export MongooseModule เพื่อให้ Module อื่น inject Model ได้โดยตรง
})
export class AiAnalysisLogModule {}
