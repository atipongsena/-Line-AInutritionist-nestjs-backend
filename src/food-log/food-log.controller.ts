import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Headers,
  // UseGuards, // Commented out for now
  // Req, // Commented out for now
  ValidationPipe,
  NotFoundException,
  ForbiddenException, // Keep for potential direct use
  Logger,
} from '@nestjs/common'
import { FoodLogService } from './food-log.service'
import { UpdateFoodLogDto } from './dto/update-food-log.dto'
import { FoodLogResponseDto } from './dto/food-log-response.dto'
import { Types } from 'mongoose' // For ObjectId validation

// Placeholder for LiffAuthGuard - will be implemented later
/*
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const LiffAuthGuard = (): MethodDecorator & ClassDecorator => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return (
    _target: any,
    _key?: string | symbol,
    _descriptor?: TypedPropertyDescriptor<any>,
  ) => {}
}
*/

@Controller('food-log')
// @UseGuards(LiffAuthGuard) // To be enabled later
export class FoodLogController {
  private readonly logger = new Logger(FoodLogController.name)

  constructor(private readonly foodLogService: FoodLogService) {}

  @Get(':id/:lineUserId') // Added lineUserId as a param for now
  async getFoodLogById(
    @Param('id') id: string,
    @Param('lineUserId') lineUserId: string, // Temporary: Get lineUserId from param
    // @Req() req: any, // To be used with LiffAuthGuard later
  ): Promise<FoodLogResponseDto> {
    // const lineUserId = req.user?.lineUserId; // To be enabled with LiffAuthGuard
    if (!lineUserId) {
      // Basic check, real auth guard will handle this better
      this.logger.warn('getFoodLogById called without lineUserId in params')
      throw new ForbiddenException(
        'Line User ID is required as a parameter for now.',
      )
    }
    if (!Types.ObjectId.isValid(id)) {
      this.logger.warn(`Invalid FoodLog ID format received: ${id}`)
      throw new NotFoundException(`Invalid food log ID format.`)
    }
    this.logger.log(`GET /food-log/${id} for user ${lineUserId}`)
    return this.foodLogService.findById(id, lineUserId)
  }

  @Put(':id/:lineUserId') // Added lineUserId as a param for now
  async updateFoodLog(
    @Param('id') id: string,
    @Param('lineUserId') lineUserId: string, // Temporary: Get lineUserId from param
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    updateFoodLogDto: UpdateFoodLogDto,
    // @Req() req: any, // To be used with LiffAuthGuard later
  ): Promise<FoodLogResponseDto> {
    // const lineUserId = req.user?.lineUserId; // To be enabled with LiffAuthGuard
    if (!lineUserId) {
      // Basic check
      this.logger.warn('updateFoodLog called without lineUserId in params')
      throw new ForbiddenException(
        'Line User ID is required as a parameter for now.',
      )
    }
    if (!Types.ObjectId.isValid(id)) {
      this.logger.warn(`Invalid FoodLog ID format received for update: ${id}`)
      throw new NotFoundException(`Invalid food log ID format.`)
    }
    this.logger.log(`PUT /food-log/${id} for user ${lineUserId}`)
    return this.foodLogService.update(id, lineUserId, updateFoodLogDto)
  }

  @Delete(':id/:lineUserId') // Added lineUserId as a param for now
  async deleteFoodLog(
    @Param('id') id: string,
    @Param('lineUserId') lineUserId: string, // Temporary: Get lineUserId from param
    // @Req() req: any, // To be used with LiffAuthGuard later
  ): Promise<{ message: string }> {
    // const lineUserId = req.user?.lineUserId; // To be enabled with LiffAuthGuard
    if (!lineUserId) {
      // Basic check
      this.logger.warn('deleteFoodLog called without lineUserId in params')
      throw new ForbiddenException(
        'Line User ID is required as a parameter for now.',
      )
    }
    if (!Types.ObjectId.isValid(id)) {
      this.logger.warn(`Invalid FoodLog ID format received for delete: ${id}`)
      throw new NotFoundException(`Invalid food log ID format.`)
    }
    this.logger.log(`DELETE /food-log/${id} for user ${lineUserId}`)
    await this.foodLogService.remove(id, lineUserId)
    return { message: 'Food log deleted successfully' }
  }

  @Get('recent')
  async getRecentFoodLogs(
    @Headers('X-Line-User-ID') lineUserId: string,
    @Query('days') days?: string,
    @Query('limit') limit?: string,
  ): Promise<FoodLogResponseDto[]> {
    if (!lineUserId) {
      this.logger.warn('getRecentFoodLogs called without X-Line-User-ID header')
      throw new ForbiddenException('X-Line-User-ID header is required.')
    }

    const daysNumber = days ? parseInt(days, 10) : 30
    const limitNumber = limit ? parseInt(limit, 10) : 100

    this.logger.log(
      `GET /food-log/recent for user ${lineUserId}, days: ${daysNumber}, limit: ${limitNumber}`,
    )

    return this.foodLogService.getRecentFoodLogs(
      lineUserId,
      daysNumber,
      limitNumber,
    )
  }

  // Add other endpoints as needed, e.g., to get a list of food logs for a date range for history view
  // @Get('/history/:year/:month')
  // async getFoodLogHistory(...) { ... }
}
