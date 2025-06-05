import {
  Controller,
  Post,
  Req,
  Res,
  HttpStatus,
  Logger,
  Headers,
  // Body, // WebhookRequestBody is no longer used here, so Body decorator might not be needed directly
  Get,
  Body,
} from '@nestjs/common'
import { LineService } from './line.service'
import { ConfigService } from '@nestjs/config'
import { Request, Response } from 'express'
import {
  /* WebhookRequestBody, */ SignatureValidationFailed,
  HTTPError as LineHTTPError,
} from '@line/bot-sdk' // Comment out WebhookRequestBody
import { IntentDetectionMetricsService } from './intent-detection-metrics.service'
import {
  IntentDetectionService,
  IntentDetectionResult,
} from './intent-detection.service'
import { UserProfileDto } from '../user/user.interface'

interface RequestWithRawBody extends Request {
  rawBody?: Buffer
}

@Controller('line')
export class LineController {
  private readonly logger = new Logger(LineController.name)
  private lineChannelSecret: string

  constructor(
    private readonly lineService: LineService,
    private readonly configService: ConfigService,
    private readonly intentDetectionMetricsService: IntentDetectionMetricsService,
    private readonly intentDetectionService: IntentDetectionService,
  ) {
    const secret = this.configService.get<string>('LINE_CHANNEL_SECRET')
    if (!secret) {
      this.logger.error('LINE_CHANNEL_SECRET is not configured.')
      throw new Error('LINE_CHANNEL_SECRET is not configured.')
    }
    this.lineChannelSecret = secret
  }

  @Post('webhook')
  handleWebhook(
    @Headers('x-line-signature') signature: string,
    @Req() req: RequestWithRawBody,
    @Res() res: Response,
  ): void {
    this.logger.log(
      `Webhook called. Signature: ${signature ? signature.substring(0, 10) + '...' : 'MISSING'}`,
    )

    if (!signature) {
      this.logger.warn('No signature provided')
      res
        .status(HttpStatus.BAD_REQUEST)
        .json({ status: 'error', message: 'No signature provided' })
      return
    }

    if (!req.rawBody) {
      this.logger.error(
        'Raw body is not available on the request. Ensure NestJS is configured with rawBody: true.',
      )
      res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ status: 'error', message: 'Raw body not available' })
      return
    }

    res.status(HttpStatus.OK).json({
      status: 'success',
      message: 'Webhook received and processing initiated',
    })

    this.lineService
      .processWebhook(req.rawBody.toString(), signature)
      .then(() => {
        this.logger.log(
          'Asynchronous webhook processing completed successfully by LineService.',
        )
      })
      .catch((error: unknown) => {
        let errorMessage = 'Error during asynchronous webhook processing'
        let errorName = 'UnknownAsyncError'

        if (error instanceof LineHTTPError) {
          errorMessage = `LINE Service Error (async): ${error.message} (Status: ${error.statusCode})`
          errorName = error.name || 'LineHTTPErrorAsync'
          this.logger.error(
            errorMessage,
            error.originalError
              ? JSON.stringify(error.originalError)
              : error.stack,
          )
        } else if (error instanceof SignatureValidationFailed) {
          errorMessage =
            'LINE Signature Validation Failed (async): ' + error.message
          errorName = error.name
          this.logger.warn(errorMessage, error.stack)
        } else if (error instanceof Error) {
          errorMessage = `Webhook Async Processing Error: ${error.message}`
          errorName = error.name
          this.logger.error(errorMessage, error.stack)
        } else {
          errorMessage =
            'An unexpected error occurred of unknown type during async processing.'
          this.logger.error(
            `Unknown async error type in webhook: ${String(error)}`,
          )
        }
        this.logger.error(
          `Async processing error: ${errorName} - ${errorMessage}`,
        )
      })
  }

  @Get('intent-metrics')
  getIntentMetrics() {
    return this.intentDetectionMetricsService.getMetrics()
  }

  @Get('intent-detections/recent')
  getRecentDetections() {
    return this.intentDetectionMetricsService.getRecentDetections(20)
  }

  @Post('test-intent')
  testIntentDetection(@Body() body: { message: string; language?: string }): {
    message: string
    result?: IntentDetectionResult
    error?: string
    timestamp: string
  } {
    try {
      // Mock user profile for testing
      const mockUserProfile = {
        lineUserId: 'test-user',
        displayName: 'Test User',
        language: body.language || 'th',
        goal: 'general',
      } as const

      const result = this.intentDetectionService.detectIntent(
        body.message,
        mockUserProfile,
        body.language || 'th',
      )

      return {
        message: body.message,
        result,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      return {
        message: body.message,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      }
    }
  }

  @Post('test-autonomous-eating-analysis')
  async testAutonomousEatingAnalysis(
    @Body()
    body: {
      lineUserId: string
      userProfile?: {
        lineUserId: string
        displayName?: string
        language?: string
        goal?: string
        dietType?: string
        age?: number
        gender?: string
      }
      language?: string
      timeConstraint?: 'fast' | 'normal' | 'accurate'
    },
  ): Promise<{
    status: string
    result?: unknown
    error?: string
    timestamp: string
  }> {
    try {
      this.logger.log(
        `Testing autonomous eating analysis for user: ${body.lineUserId}`,
      )

      // Use provided userProfile or create a mock one
      const userProfile = body.userProfile || {
        lineUserId: body.lineUserId,
        displayName: 'Test User',
        language: body.language || 'th',
        goal: 'maintain_weight',
        dietType: 'normal',
      }

      const result = await this.lineService.testAutonomousEatingAnalysis(
        body.lineUserId,
        userProfile as UserProfileDto,
        body.language || 'th',
        body.timeConstraint || 'normal',
      )

      return {
        status: 'success',
        result,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      this.logger.error(`Test autonomous eating analysis error: ${error}`)
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      }
    }
  }

  @Post('test-get-food-history')
  async testGetFoodHistory(
    @Body()
    body: {
      lineUserId: string
      userProfile?: {
        lineUserId: string
        displayName?: string
        language?: string
      }
      days?: number
      limit?: number
      language?: string
    },
  ): Promise<{
    status: string
    result?: unknown
    error?: string
    timestamp: string
  }> {
    try {
      this.logger.log(
        `Testing food history retrieval for user: ${body.lineUserId}`,
      )

      // Use provided userProfile or create a mock one
      const userProfile = body.userProfile || {
        lineUserId: body.lineUserId,
        displayName: 'Test User',
        language: body.language || 'th',
      }

      const result = await this.lineService.testGetFoodHistory(
        body.lineUserId,
        userProfile as UserProfileDto,
        body.days || 30,
        body.limit || 100,
        body.language || 'th',
      )

      return {
        status: 'success',
        result,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      this.logger.error(`Test food history retrieval error: ${error}`)
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      }
    }
  }
}
