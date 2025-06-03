import { Module } from '@nestjs/common'
import { FoodLogController } from './food-log.controller'
import { FoodLogService } from './food-log.service'
import { MongooseModule } from '@nestjs/mongoose'
import { FoodLog, FoodLogSchema } from '../schemas/food-log.schema'
import { UserModule } from '../user/user.module' // For UserService dependency
import { CommonModule } from '../common/common.module'
// Import other necessary modules like ImageService if it's a separate module and used directly

@Module({
  imports: [
    MongooseModule.forFeature([{ name: FoodLog.name, schema: FoodLogSchema }]),
    UserModule, // To make UserService available for injection in FoodLogService
    CommonModule, // To make TimezoneService available
    // Add other modules if FoodLogService depends on them
  ],
  controllers: [FoodLogController],
  providers: [FoodLogService],
  exports: [FoodLogService], // Export FoodLogService if other modules need to use it
})
export class FoodLogModule {}
