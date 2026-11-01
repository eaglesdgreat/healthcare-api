import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common'
import type { Request } from 'express'
import {
  ApiTags,
  ApiOperation,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiConflictResponse,
  ApiInternalServerErrorResponse,
  ApiExtraModels,
  getSchemaPath,
} from '@nestjs/swagger'
import { AuthService } from './auth.service'
import {
  LoginUserDto,
  RegisterUserDto,
  ResendActivationDto,
  ActivateUserDto,
  RefreshTokenDto,
} from './dto'
import { GoogleSignInDto } from './dto/google-signin.dto'
import { Public } from './auth.decorator'
import { MessageResponseDto } from '@/common/dto'
import { LoginResponseDto, TokenPairDto } from './dto/token-response.dto'

@Public()
@ApiTags('auths')
@ApiExtraModels(LoginResponseDto, MessageResponseDto)
@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @ApiOperation({
    summary: 'Register a new account',
    description:
      'Creates a pending account and queues an activation email through the internal notification service.',
  })
  @ApiCreatedResponse({
    description:
      'Account created successfully. An activation email has been queued.',
    type: MessageResponseDto,
  })
  @ApiConflictResponse({
    description:
      'A user with this email address or phone number already exists.',
  })
  @ApiBadRequestResponse({ description: 'Invalid or malformed request body.' })
  @ApiInternalServerErrorResponse({
    description: 'Failed to provision the account.',
  })
  async signup(
    @Body() registerDto: RegisterUserDto,
    @Req() request?: Request & { id?: string },
  ) {
    return await this.authService.signup(registerDto, request?.id)
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Log in with email, phone number, or Health ID',
    description:
      'Authenticates a user using one of: a valid email address, an international phone number, or a Health ID, together with a password. Returns the user profile and a JWT token pair.',
  })
  @ApiOkResponse({
    description: 'Login successful.',
    type: LoginResponseDto,
  })
  @ApiUnauthorizedResponse({
    description:
      'Invalid credentials, or no account exists for the identifier.',
  })
  @ApiForbiddenResponse({ description: 'Account has not been activated.' })
  @ApiBadRequestResponse({ description: 'Invalid or malformed request body.' })
  @ApiInternalServerErrorResponse({ description: 'Failed to log the user in.' })
  async login(
    @Body() loginUserDto: LoginUserDto,
    @Req() request?: Request & { id?: string },
  ) {
    return await this.authService.login(loginUserDto, request?.id)
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotate the refresh token',
    description:
      'Exchanges a valid refresh token for a new access token and refresh token pair. The supplied refresh token is revoked after rotation.',
  })
  @ApiOkResponse({
    description: 'New token pair issued.',
    type: TokenPairDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid or expired refresh token.',
  })
  @ApiBadRequestResponse({ description: 'Refresh token was not provided.' })
  @ApiInternalServerErrorResponse({
    description: 'Failed to refresh authentication tokens.',
  })
  async refresh(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Req() request?: Request & { id?: string },
  ) {
    return await this.authService.refresh(
      refreshTokenDto.refreshToken,
      request?.id,
    )
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Revoke a refresh token',
    description:
      'Marks the supplied refresh token as revoked so it can no longer be used to obtain new tokens.',
  })
  @ApiOkResponse({
    description: 'Refresh token revoked.',
    type: MessageResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Refresh token was not provided.' })
  async logout(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Req() request?: Request & { id?: string },
  ) {
    return await this.authService.logout(
      refreshTokenDto.refreshToken,
      request?.id,
    )
  }

  @Post('google')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sign in or sign up with Google',
    description:
      'Verifies a Google ID token. If the account already exists it returns a token pair; otherwise it provisions a new pending account and queues an activation email.',
  })
  @ApiOkResponse({
    description:
      'Returns the token pair and user when the Google account already exists and is activated, or a pending-activation message when a new account was provisioned.',
    schema: {
      oneOf: [
        { $ref: getSchemaPath(LoginResponseDto) },
        { $ref: getSchemaPath(MessageResponseDto) },
      ],
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Google email has not been verified.',
  })
  @ApiForbiddenResponse({ description: 'Existing account is not activated.' })
  @ApiBadRequestResponse({
    description: 'Google token did not include a verified email.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Failed to verify the Google token.',
  })
  async googleSignIn(
    @Body() googleSignInDto: GoogleSignInDto,
    @Req() request?: Request & { id?: string },
  ) {
    return await this.authService.googleSignIn(googleSignInDto, request?.id)
  }

  @Post('resend-activation')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resend the activation token',
    description:
      'Issues and sends a new activation token for an account that has not yet been activated. A 60-second cooldown is enforced to prevent abuse.',
  })
  @ApiOkResponse({
    description: 'A new activation email has been queued.',
    type: MessageResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Unable to resend the activation code at this time.',
  })
  @ApiBadRequestResponse({
    description: 'Cooldown active, or the identifier is invalid.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Failed to resend the activation code.',
  })
  async resendActivation(
    @Body() resendActivationDto: ResendActivationDto,
    @Req() request?: Request & { id?: string },
  ) {
    return await this.authService.resendActivation(
      resendActivationDto,
      request?.id,
    )
  }

  @Post('activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Activate a pending account',
    description:
      'Activates an account using its Health ID and the activation token received during signup or resend-activation.',
  })
  @ApiOkResponse({
    description: 'Account activated successfully.',
    type: MessageResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid or expired activation token.',
  })
  @ApiBadRequestResponse({ description: 'Invalid or malformed request body.' })
  @ApiInternalServerErrorResponse({
    description: 'Failed to activate the account.',
  })
  async activate(
    @Body() activateUserDto: ActivateUserDto,
    @Req() request?: Request & { id?: string },
  ) {
    return await this.authService.activate(
      activateUserDto.healthId,
      activateUserDto.token,
      request?.id,
    )
  }
}
