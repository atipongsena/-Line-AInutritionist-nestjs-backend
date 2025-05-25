import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import {
  TemporaryImageLog,
  TemporaryImageLogSchema,
} from './temporary-image-log.schema'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TemporaryImageLog.name, schema: TemporaryImageLogSchema },
    ]),
  ],
  exports: [MongooseModule], // Export MongooseModule to make TemporaryImageLogModel injectable
})
export class TemporaryImageLogModule {}
