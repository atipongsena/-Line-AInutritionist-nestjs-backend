import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ImageService } from './image.service'

@Module({
  imports: [ConfigModule], // Import ConfigModule so ImageService can use ConfigService
  providers: [ImageService],
  exports: [ImageService], // Export ImageService if it needs to be used by other modules
})
export class ImageModule {}
