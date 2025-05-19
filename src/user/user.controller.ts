import {
  Controller,
  Get,
  Put,
  Body,
  Req,
  UseGuards,
  Logger,
  HttpException,
  HttpStatus,
  Injectable,
  CanActivate,
  ExecutionContext,
} from '@nestjs/common'
import { UserService } from './user.service'
import { UpdateUserProfileDto, UserProfileDto } from './user.interface'
import { Request as ExpressRequest } from 'express'
import { HttpService } from '@nestjs/axios'
import { ConfigService } from '@nestjs/config'
import { firstValueFrom } from 'rxjs'
import axios from 'axios'

// Define a type for the request object after LiffAuthGuard has processed it
interface AuthenticatedLiffRequest extends ExpressRequest {
  lineUserId: string
  // Optional: if you want to pass more decoded info
  // lineProfileName?: string
  // lineProfilePicture?: string
}

@Injectable()
export class LiffAuthGuard implements CanActivate {
  private readonly logger = new Logger(LiffAuthGuard.name)
  private readonly LINE_VERIFY_URL = 'https://api.line.me/oauth2/v2.1/verify'

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  private async verifyLiffTokenOnline(
    idToken: string,
  ): Promise<{ userId: string; name?: string; picture?: string } | null> {
    // const liffChannelId = this.configService.get<string>('LIFF_CHANNEL_ID');
    const lineConsoleChannelId = this.configService.get<string>(
      'LINE_CONSOLE_CHANNEL_ID',
    ) // For API call's client_id
    const liffApplicationId = this.configService.get<string>(
      'LIFF_APPLICATION_ID',
    ) // For 'aud' claim check

    if (!lineConsoleChannelId || !liffApplicationId) {
      this.logger.error(
        'LINE_CONSOLE_CHANNEL_ID or LIFF_APPLICATION_ID is not set in environment variables for LiffAuthGuard.',
      )
      return null
    }

    const params = new URLSearchParams()
    params.append('id_token', idToken)
    // params.append('client_id', liffChannelId);
    params.append('client_id', lineConsoleChannelId) // Use the actual Channel ID for the API call

    try {
      this.logger.debug(
        // `Verifying ID token with LINE API. LIFF Channel ID (aud): ${liffChannelId}`,
        `Verifying ID token with LINE API. client_id for API call: ${lineConsoleChannelId}, Expected aud (LIFF ID): ${liffApplicationId}`,
      )
      const response = await firstValueFrom(
        this.httpService.post<{
          iss: string
          sub: string // User ID
          aud: string // Your LIFF Channel ID
          exp: number
          iat: number
          nonce?: string
          amr?: string[]
          name?: string // User's display name
          picture?: string // User's profile image URL
          email?: string
        }>(this.LINE_VERIFY_URL, params.toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }),
      )

      const verificationResult = response.data

      this.logger.debug(
        `LINE API verification response: ${JSON.stringify(verificationResult)}`,
      )

      // TEMPORARY WORKAROUND: Allow 'aud' to be either the full LIFF ID or just the Channel ID
      if (
        verificationResult.aud !== liffApplicationId &&
        verificationResult.aud !== lineConsoleChannelId // Check against Channel ID as well
      ) {
        this.logger.warn(
          `Token audience (aud) [${verificationResult.aud}] does not match configured LIFF Application ID [${liffApplicationId}] OR Channel ID [${lineConsoleChannelId}].`,
        )
        return null
      }
      // If aud matches lineConsoleChannelId but not liffApplicationId, log a specific warning for tracking
      if (
        verificationResult.aud === lineConsoleChannelId &&
        verificationResult.aud !== liffApplicationId
      ) {
        this.logger.warn(
          `Token audience (aud) [${verificationResult.aud}] matched Channel ID but NOT the full LIFF Application ID [${liffApplicationId}]. Proceeding with workaround.`,
        )
      }

      // Check 'iss' (issuer) claim
      if (verificationResult.iss !== 'https://access.line.me') {
        this.logger.warn('Token issuer is invalid.')
        return null
      }

      // 3. Check if token is expired (exp is in seconds, Date.now() is in ms)
      // Add a small buffer (e.g., 60 seconds) to account for clock skew if necessary, but usually not needed if servers are time-synced.
      if (verificationResult.exp * 1000 < Date.now()) {
        this.logger.warn(
          `ID Token verification failed: Token expired at ${new Date(verificationResult.exp * 1000).toISOString()}`,
        )
        return null
      }

      // All checks passed
      this.logger.log(
        `Successfully verified ID token for user: ${verificationResult.sub}`,
      )
      return {
        userId: verificationResult.sub,
        name: verificationResult.name,
        picture: verificationResult.picture,
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        this.logger.error(
          `Error response from LINE API during token verification: ${error.response.status} - ${JSON.stringify(error.response.data)}`,
        )
      } else if (error instanceof Error) {
        this.logger.error(
          `Unexpected error during ID token verification: ${error.message}`,
          error.stack,
        )
      } else {
        this.logger.error(
          'Unexpected error during ID token verification (unknown error type)',
          error,
        )
      }
      return null
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedLiffRequest>()
    const idToken = request.headers['x-line-id-token'] as string

    this.logger.debug(
      `LiffAuthGuard: Checking for X-LINE-ID-TOKEN. Token present: ${!!idToken}`,
    )

    if (!idToken) {
      throw new HttpException(
        'X-LINE-ID-TOKEN header is missing',
        HttpStatus.UNAUTHORIZED,
      )
    }

    const decodedToken = await this.verifyLiffTokenOnline(idToken)

    if (decodedToken && decodedToken.userId) {
      request.lineUserId = decodedToken.userId
      // You can also attach name and picture to the request if needed by the controller
      // (request as any).lineProfileName = decodedToken.name
      // (request as any).lineProfilePicture = decodedToken.picture
      this.logger.log(
        `LiffAuthGuard: Authorized LIFF request for user ${decodedToken.userId}`,
      )
      return true
    } else {
      this.logger.warn(
        'LiffAuthGuard: ID Token verification failed or token is invalid.',
      )
      throw new HttpException('Invalid LIFF ID Token', HttpStatus.FORBIDDEN)
    }
  }
}

@Controller('api/users')
export class UserController {
  private readonly logger = new Logger(UserController.name)

  constructor(private readonly userService: UserService) {}

  @UseGuards(LiffAuthGuard)
  @Get('me')
  async getMyProfile(
    @Req() req: AuthenticatedLiffRequest,
  ): Promise<UserProfileDto> {
    this.logger.log(`Fetching profile for LIFF user: ${req.lineUserId}`)
    let profile = await this.userService.getUserProfile(req.lineUserId)
    if (!profile) {
      this.logger.warn(
        `Profile not found for LIFF user: ${req.lineUserId}. Attempting to create/retrieve.`,
      )
      // The LiffAuthGuard provides lineUserId. Name and pictureUrl might be available
      // from decodedToken if verifyLiffTokenOnline returns them and they are attached to request.
      // For getOrCreate, we primarily need lineUserId.
      // If verifyLiffTokenOnline also returns name/picture, we could pass them here.
      // For now, UserService's getOrCreateUserProfile might only use lineUserId if others aren't provided.

      // Let's try to get name and picture from a potentially enhanced request object
      // const authReq = req as any
      // const displayNameFromToken = authReq.lineProfileName
      // const pictureUrlFromToken = authReq.lineProfilePicture

      profile = await this.userService.getOrCreateUserProfile({
        lineUserId: req.lineUserId,
        // displayName: displayNameFromToken, // Pass if available and desired
        // pictureUrl: pictureUrlFromToken,  // Pass if available and desired
      })
    }
    return profile
  }

  @UseGuards(LiffAuthGuard)
  @Put('me')
  async updateMyProfile(
    @Req() req: AuthenticatedLiffRequest,
    @Body() body: Record<string, any>,
  ): Promise<UserProfileDto> {
    this.logger.log(
      `Updating profile for LIFF user: ${req.lineUserId}, Data: ${JSON.stringify(body)}`,
    )

    const incomingLineUserId = body.lineUserId as string | undefined
    if (incomingLineUserId && incomingLineUserId !== req.lineUserId) {
      this.logger.warn(
        `Attempt to update profile for a different user (${incomingLineUserId}) by authenticated user (${req.lineUserId}). Action denied.`,
      )
      throw new HttpException(
        'Mismatch in user ID for update',
        HttpStatus.BAD_REQUEST,
      )
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { lineUserId, ...restOfBody } = body
    const dtoToUpdate: UpdateUserProfileDto = restOfBody as UpdateUserProfileDto

    return this.userService.updateUserProfile(req.lineUserId, dtoToUpdate)
  }
}
