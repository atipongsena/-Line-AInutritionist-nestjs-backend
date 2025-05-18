import {
  Controller,
  Post,
  Req,
  Res,
  HttpStatus,
  Logger,
  Headers,
  // Body, // WebhookRequestBody is no longer used here, so Body decorator might not be needed directly
} from '@nestjs/common'
import { LineService } from './line.service'
import { ConfigService } from '@nestjs/config'
import { Request, Response } from 'express'
import {
  /* WebhookRequestBody, */ SignatureValidationFailed,
  HTTPError as LineHTTPError,
} from '@line/bot-sdk' // Comment out WebhookRequestBody

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
}
