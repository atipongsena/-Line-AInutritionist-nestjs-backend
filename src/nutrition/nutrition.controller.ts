import {
  Controller,
  Get,
  Query,
  UseGuards,
  Req,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import { NutritionService } from './nutrition.service'
import {
  LiffAuthGuard,
  AuthenticatedLiffRequest,
} from '../user/user.controller'
import {
  DailyReportResponseDto,
  WeeklyReportResponseDto,
  MonthlyReportResponseDto,
} from './dto/report-data.dto'

@Controller('nutrition')
export class NutritionController {
  private readonly logger = new Logger(NutritionController.name)

  constructor(private readonly nutritionService: NutritionService) {}

  private handleControllerError(
    error: unknown,
    defaultMessage: string,
    context: string,
  ) {
    this.logger.error(
      `[${context}] Error: ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? error.stack : undefined,
    )

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR
    let message = defaultMessage

    if (error instanceof HttpException) {
      statusCode = error.getStatus()
      const response = error.getResponse()
      if (typeof response === 'string') {
        message = response
      } else if (
        typeof response === 'object' &&
        response !== null &&
        'message' in response &&
        typeof (response as { message: unknown }).message === 'string'
      ) {
        message = (response as { message: string }).message
      }
    } else if (error instanceof Error && error.message === 'User not found') {
      statusCode = HttpStatus.NOT_FOUND
      message = error.message
    }
    throw new HttpException(message, statusCode)
  }

  @UseGuards(LiffAuthGuard)
  @Get('daily-report')
  async getDailyReport(
    @Query('date') date: string,
    @Query('lineUserId') lineUserIdFromQuery: string,
    @Req() req: AuthenticatedLiffRequest,
  ): Promise<DailyReportResponseDto> {
    const lineUserId = req.lineUserId
    this.logger.log(
      `[getDailyReport] Request for date: ${date}, query lineUserId: ${lineUserIdFromQuery}, token lineUserId: ${lineUserId}`,
    )
    if (!date || !lineUserIdFromQuery) {
      throw new HttpException(
        'Missing date or lineUserId query parameter',
        HttpStatus.BAD_REQUEST,
      )
    }
    if (req.lineUserId !== lineUserIdFromQuery) {
      this.logger.warn(
        `[getDailyReport] Mismatch lineUserId: query was '${lineUserIdFromQuery}', token is '${lineUserId}'. Using token ID.`,
      )
    }

    try {
      return await this.nutritionService.getDailyReportData(lineUserId, date)
    } catch (error) {
      this.handleControllerError(
        error,
        'Failed to fetch daily report.',
        `getDailyReport - ${lineUserId} - ${date}`,
      )
      throw error
    }
  }

  @UseGuards(LiffAuthGuard)
  @Get('weekly-report')
  async getWeeklyReport(
    @Query('weekStartDate') weekStartDate: string,
    @Query('lineUserId') lineUserIdFromQuery: string,
    @Req() req: AuthenticatedLiffRequest,
  ): Promise<WeeklyReportResponseDto> {
    const lineUserId = req.lineUserId
    this.logger.log(
      `[getWeeklyReport] Request for week: ${weekStartDate}, query lineUserId: ${lineUserIdFromQuery}, token lineUserId: ${lineUserId}`,
    )
    if (!weekStartDate || !lineUserIdFromQuery) {
      throw new HttpException(
        'Missing weekStartDate or lineUserId query parameter',
        HttpStatus.BAD_REQUEST,
      )
    }
    if (req.lineUserId !== lineUserIdFromQuery) {
      this.logger.warn(
        `[getWeeklyReport] Mismatch lineUserId: query was '${lineUserIdFromQuery}', token is '${lineUserId}'. Using token ID.`,
      )
    }

    try {
      return await this.nutritionService.getWeeklyReportData(
        lineUserId,
        weekStartDate,
      )
    } catch (error) {
      this.handleControllerError(
        error,
        'Failed to fetch weekly report.',
        `getWeeklyReport - ${lineUserId} - ${weekStartDate}`,
      )
      throw error
    }
  }

  @UseGuards(LiffAuthGuard)
  @Get('monthly-report')
  async getMonthlyReport(
    @Query('month') month: string,
    @Query('lineUserId') lineUserIdFromQuery: string,
    @Req() req: AuthenticatedLiffRequest,
  ): Promise<MonthlyReportResponseDto> {
    const lineUserId = req.lineUserId
    this.logger.log(
      `[getMonthlyReport] Request for month: ${month}, query lineUserId: ${lineUserIdFromQuery}, token lineUserId: ${lineUserId}`,
    )
    if (!month || !lineUserIdFromQuery) {
      throw new HttpException(
        'Missing month or lineUserId query parameter',
        HttpStatus.BAD_REQUEST,
      )
    }
    if (req.lineUserId !== lineUserIdFromQuery) {
      this.logger.warn(
        `[getMonthlyReport] Mismatch lineUserId: query was '${lineUserIdFromQuery}', token is '${lineUserId}'. Using token ID.`,
      )
    }

    try {
      return await this.nutritionService.getMonthlyReportData(lineUserId, month)
    } catch (error) {
      this.handleControllerError(
        error,
        'Failed to fetch monthly report.',
        `getMonthlyReport - ${lineUserId} - ${month}`,
      )
      throw error
    }
  }
}
