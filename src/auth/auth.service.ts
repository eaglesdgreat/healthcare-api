import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  HttpException,
  Logger,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { UsersService } from '@/users/users.service'
import { User, UserRole } from '@/users/entities/user.entity'
import { EventBusService } from '@/common/event-bus.service'
import * as bcrypt from 'bcrypt'
import { LoginUserDto, RegisterUserDto, ResendActivationDto } from './dto'
import { Repository, DeepPartial } from 'typeorm'
import { InjectRepository } from '@nestjs/typeorm'
import { randomBytes, createHash, timingSafeEqual } from 'crypto'
import { RefreshToken } from './entities/refresh-token.entity'
import { GoogleAuthService } from './google-auth.service'
import { GoogleSignInDto } from './dto/google-signin.dto'
import { MetricsService } from '@/common/metrics/metrics.service'
import { NotificationClientService } from './notification-client.service'

@Injectable()
export class AuthService {
  // Instantiated directly (not constructor-injected) so this keeps working
  // in unit tests that build a minimal TestingModule without importing the
  // real LoggerModule. Once the app calls `app.useLogger(app.get(Logger))`
  // (see main.ts) at bootstrap, every `new Logger(...)` instance across the
  // app automatically routes through the structured pino logger.
  private readonly logger = new Logger(AuthService.name)

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly eventBus: EventBusService,
    private readonly notificationClient: NotificationClientService,
    private readonly googleAuthService: GoogleAuthService,
    private readonly metrics: MetricsService,

    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,

    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
  ) {}

  async signup(
    registerDto: RegisterUserDto,
    requestId?: string,
  ): Promise<{ message: string }> {
    const { email, phoneNumber, password, firstName, lastName, role } =
      registerDto
    if (Buffer.byteLength(password, 'utf8') > 72) {
      throw new BadRequestException('Password exceeds the supported length')
    }

    const existingUser = await this.usersRepository.findOne({
      where: [{ email }, { phoneNumber }],
    })

    if (existingUser) {
      this.metrics.authSignupTotal.inc({ result: 'conflict' })
      this.recordActivity('signup', 'conflict', undefined, requestId)
      if (existingUser.email === email) {
        throw new ConflictException(
          'A user with this email address already exists',
        )
      }
      if (existingUser.phoneNumber === phoneNumber) {
        throw new ConflictException('This phone number is already registered')
      }
    }

    try {
      const salt = await bcrypt.genSalt(12)
      const passwordHash = await bcrypt.hash(password, salt)

      const healthId = await this.usersService.generateHealthId(role)
      const activationToken = randomBytes(32).toString('hex')
      const activationTokenHash = this.hashValue(activationToken)
      const activationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

      const newUser = this.usersRepository.create({
        firstName,
        lastName,
        email,
        phoneNumber,
        password: passwordHash,
        role,
        healthId,
        isActive: false,
        activationTokenHash,
        activationExpiresAt,
      } as DeepPartial<User>)

      const savedUser = await this.usersRepository.save(newUser)
      await this.notificationClient.sendActivation({
        userId: savedUser.id,
        email,
        activationToken,
        expiresAt: activationExpiresAt.toISOString(),
        requestId,
      })

      this.logger.log(
        { action: 'signup', result: 'pending_activation', role },
        'User signed up and activation notification queued',
      )
      this.recordActivity('signup', 'pending_activation', savedUser, requestId)
      this.metrics.authSignupTotal.inc({ result: 'success' })

      return {
        message:
          'Registration successful. Activation token has been sent to the provided contact method. Use it to activate your account.',
      }
    } catch (error) {
      this.metrics.authSignupTotal.inc({ result: 'error' })
      this.logger.error(
        { errorType: error instanceof Error ? error.name : 'unknown' },
        'Failed to provision new user account',
      )
      this.recordActivity('signup', 'error', undefined, requestId)
      if (error instanceof Error) {
        throw error
      }
      throw new InternalServerErrorException(
        'An error occurred during account provisioning',
      )
    }
  }

  async login(loginUser: LoginUserDto, requestId?: string) {
    const { username, password } = loginUser
    if (Buffer.byteLength(password, 'utf8') > 72) {
      this.recordActivity('login', 'invalid_credentials', undefined, requestId)
      throw new UnauthorizedException('Invalid credentials')
    }

    try {
      const user = await this.usersService.findUserByUsername(username)

      if (user) {
        if (!user.password || !(await this.verifyPassword(user, password))) {
          this.metrics.authLoginTotal.inc({ result: 'invalid_credentials' })
          this.recordActivity(
            'login',
            'invalid_credentials',
            undefined,
            requestId,
          )
          throw new UnauthorizedException('Invalid credentials')
        }

        if (!user.isActive) {
          this.metrics.authLoginTotal.inc({ result: 'not_activated' })
          this.recordActivity('login', 'not_activated', user, requestId)
          throw new ForbiddenException('Account not activated')
        }

        const { accessToken, refreshToken } = await this.generateTokens(user)
        const { password: _password, ...userResponse } = user
        void _password

        this.metrics.authLoginTotal.inc({ result: 'success' })
        this.logger.log(
          { action: 'login', result: 'success' },
          'User logged in successfully',
        )
        this.recordActivity('login', 'success', user, requestId)

        return {
          data: userResponse,
          meta: {
            accessToken,
            refreshToken,
          },
        }
      }

      this.metrics.authLoginTotal.inc({ result: 'not_found' })
      this.recordActivity('login', 'invalid_credentials', undefined, requestId)
      throw new UnauthorizedException('Invalid credentials')
    } catch (error) {
      // Expected auth failures (wrong password, inactive account, unknown
      // user) were already recorded above and are logged globally by the
      // exception filter; only unexpected system errors need extra
      // handling here.
      if (error instanceof HttpException) {
        throw error
      }
      this.metrics.authLoginTotal.inc({ result: 'error' })
      this.logger.error(
        { errorType: error instanceof Error ? error.name : 'unknown' },
        'Unexpected error during login',
      )
      this.recordActivity('login', 'error', undefined, requestId)
      throw new InternalServerErrorException('Failed to login user')
    }
  }

  async googleSignIn(googleSignInDto: GoogleSignInDto, requestId?: string) {
    const { idToken, role } = googleSignInDto
    const payload = await this.googleAuthService
      .verifyIdToken(idToken)
      .catch((error: unknown) => {
        this.recordActivity(
          'google_signin',
          'invalid_token',
          undefined,
          requestId,
        )
        throw error
      })
    const email = payload.email

    if (!email) {
      this.recordActivity(
        'google_signin',
        'invalid_email',
        undefined,
        requestId,
      )
      throw new BadRequestException(
        'Google token did not include a verified email',
      )
    }
    if (payload.email_verified !== true) {
      this.recordActivity(
        'google_signin',
        'unverified_email',
        undefined,
        requestId,
      )
      throw new UnauthorizedException('Google email has not been verified')
    }

    try {
      const user = await this.usersService.findUserByUsername(email)

      if (user) {
        if (!user.isActive) {
          this.metrics.authLoginTotal.inc({ result: 'not_activated' })
          this.recordActivity('google_signin', 'not_activated', user, requestId)
          throw new ForbiddenException('Account not activated')
        }
        const { accessToken, refreshToken } = await this.generateTokens(user)
        const { password: _password, ...userResponse } = user
        void _password

        this.metrics.authLoginTotal.inc({ result: 'google_success' })
        this.logger.log(
          { action: 'google_signin', result: 'success' },
          'User signed in with Google',
        )
        this.recordActivity('google_signin', 'success', user, requestId)

        return {
          data: userResponse,
          meta: {
            accessToken,
            refreshToken,
          },
        }
      }

      const assignedRole = role || UserRole.PATIENT
      const healthId = await this.usersService.generateHealthId(assignedRole)
      const activationToken = randomBytes(32).toString('hex')
      const activationTokenHash = this.hashValue(activationToken)
      const activationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

      const newUser = this.usersRepository.create({
        firstName: payload.given_name || '',
        lastName: payload.family_name || '',
        email,
        phoneNumber: null,
        password: null,
        role: assignedRole,
        healthId,
        isActive: false,
        activationTokenHash,
        activationExpiresAt,
      } as DeepPartial<User>)

      const savedUser = await this.usersRepository.save(newUser)
      await this.notificationClient.sendActivation({
        userId: savedUser.id,
        email,
        activationToken,
        expiresAt: activationExpiresAt.toISOString(),
        requestId,
      })

      this.metrics.authSignupTotal.inc({ result: 'google_provisioned' })
      this.logger.log(
        {
          action: 'google_signup',
          result: 'pending_activation',
          role: assignedRole,
        },
        'New account provisioned via Google sign-in, pending activation',
      )
      this.recordActivity(
        'google_signup',
        'pending_activation',
        savedUser,
        requestId,
      )

      return {
        message:
          'Google login succeeded. An activation email has been queued; activate the account before first use.',
      }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error
      }
      this.metrics.authLoginTotal.inc({ result: 'error' })
      this.logger.error(
        { errorType: error instanceof Error ? error.name : 'unknown' },
        'Unexpected error during Google sign-in',
      )
      this.recordActivity('google_signin', 'error', undefined, requestId)
      throw new InternalServerErrorException('Failed to process Google sign-in')
    }
  }

  async refresh(refreshToken: string, requestId?: string) {
    if (!refreshToken) {
      this.recordActivity('refresh', 'invalid_request', undefined, requestId)
      throw new BadRequestException('Refresh token must be provided')
    }

    try {
      let payload: { sub: string; tokenType?: string }
      try {
        payload = await this.jwtService.verifyAsync<{
          sub: string
          tokenType?: string
        }>(refreshToken)
      } catch {
        this.metrics.authTokenRefreshTotal.inc({ result: 'invalid_token' })
        this.recordActivity('refresh', 'invalid_token', undefined, requestId)
        throw new UnauthorizedException('Invalid or expired refresh token')
      }
      if (payload.tokenType !== undefined && payload.tokenType !== 'refresh') {
        this.metrics.authTokenRefreshTotal.inc({ result: 'invalid_token' })
        this.recordActivity('refresh', 'invalid_token', undefined, requestId)
        throw new UnauthorizedException('Invalid or expired refresh token')
      }

      const tokenHash = this.hashValue(refreshToken)
      const storedToken = await this.refreshTokenRepository.findOne({
        where: { token: tokenHash, revoked: false },
      })

      if (!storedToken || storedToken.expiresAt < new Date()) {
        this.metrics.authTokenRefreshTotal.inc({ result: 'invalid_token' })
        this.recordActivity('refresh', 'invalid_token', undefined, requestId)
        throw new UnauthorizedException('Invalid or expired refresh token')
      }

      const user = await this.usersRepository.findOne({
        where: { id: storedToken.userId },
      })

      if (!user || !user.isActive) {
        this.metrics.authTokenRefreshTotal.inc({ result: 'invalid_token' })
        this.recordActivity(
          'refresh',
          'invalid_token',
          user ?? undefined,
          requestId,
        )
        throw new UnauthorizedException('Invalid refresh token')
      }

      if (payload.sub !== user.id) {
        this.metrics.authTokenRefreshTotal.inc({ result: 'invalid_token' })
        this.recordActivity('refresh', 'invalid_token', undefined, requestId)
        throw new UnauthorizedException('Invalid refresh token')
      }

      const revokeResult = await this.refreshTokenRepository.update(
        { id: storedToken.id, revoked: false },
        { revoked: true },
      )
      if (revokeResult.affected !== 1) {
        this.metrics.authTokenRefreshTotal.inc({ result: 'invalid_token' })
        this.recordActivity('refresh', 'invalid_token', user, requestId)
        throw new UnauthorizedException('Invalid or expired refresh token')
      }

      const tokens = await this.generateTokens(user)
      this.metrics.authTokenRefreshTotal.inc({ result: 'success' })
      this.logger.log(
        { action: 'refresh', result: 'success' },
        'Refresh token rotated successfully',
      )
      this.recordActivity('refresh', 'success', user, requestId)
      return tokens
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof BadRequestException
      ) {
        throw error
      }
      this.metrics.authTokenRefreshTotal.inc({ result: 'error' })
      this.logger.error(
        { errorType: error instanceof Error ? error.name : 'unknown' },
        'Unexpected error while refreshing authentication tokens',
      )
      this.recordActivity('refresh', 'error', undefined, requestId)
      throw new InternalServerErrorException(
        'Failed to refresh authentication tokens',
      )
    }
  }

  async logout(refreshToken: string, requestId?: string) {
    if (!refreshToken) {
      this.recordActivity('logout', 'invalid_request', undefined, requestId)
      throw new BadRequestException('Refresh token must be provided')
    }

    try {
      const tokenHash = this.hashValue(refreshToken)
      const storedToken = await this.refreshTokenRepository.findOne({
        where: { token: tokenHash, revoked: false },
      })

      if (storedToken) {
        storedToken.revoked = true
        await this.refreshTokenRepository.save(storedToken)
      }
      this.recordActivity('logout', 'success', undefined, requestId)

      return { message: 'Refresh token revoked' }
    } catch (error) {
      this.logger.error(
        { errorType: error instanceof Error ? error.name : 'unknown' },
        'Failed to revoke refresh token',
      )
      this.recordActivity('logout', 'error', undefined, requestId)
      throw new InternalServerErrorException('Failed to logout user')
    }
  }

  private async verifyPassword(user: User, password: string) {
    return (
      user && user.password && (await bcrypt.compare(password, user.password))
    )
  }

  private async generateTokens(user: User) {
    const payload = {
      sub: user?.id,
      healthId: user?.healthId,
      roles: user?.role,
    }

    const accessToken = this.jwtService.sign(
      { ...payload, tokenType: 'access' },
      { expiresIn: '15m' },
    )
    const refreshToken = this.jwtService.sign(
      { ...payload, tokenType: 'refresh' },
      { expiresIn: '7d' },
    )
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const refreshTokenHash = this.hashValue(refreshToken)

    const storedToken = this.refreshTokenRepository.create({
      userId: user.id,
      token: refreshTokenHash,
      revoked: false,
      expiresAt,
    })
    await this.refreshTokenRepository.save(storedToken)

    return { accessToken, refreshToken }
  }

  private hashValue(value: string) {
    return createHash('sha256').update(value).digest('hex')
  }

  private recordActivity(
    action: string,
    outcome: string,
    user?: User,
    requestId?: string,
  ): void {
    this.logger.log(
      {
        event: 'auth.activity',
        action,
        outcome,
        userId: user?.id,
        requestId,
        timestamp: new Date().toISOString(),
      },
      'Authentication activity',
    )
  }

  /**
   * Resend the activation token for an account that has not yet been activated,
   * for example when the previous token has expired. Enforces a cooldown to
   * prevent abuse.
   */
  async resendActivation(
    resendActivationDto: ResendActivationDto,
    requestId?: string,
  ): Promise<{ message: string }> {
    const { identifier }: ResendActivationDto = resendActivationDto
    const RESEND_COOLDOWN_MS = 60 * 1000 // 60 seconds

    try {
      const user = await this.usersRepository.findOne({
        where: [{ email: identifier }, { phoneNumber: identifier }],
      })

      if (!user) {
        // Do not reveal whether an account exists.
        this.recordActivity(
          'resend_activation',
          'unavailable',
          undefined,
          requestId,
        )
        throw new UnauthorizedException(
          'Unable to resend activation code at this time',
        )
      }

      if (user.isActive) {
        this.recordActivity(
          'resend_activation',
          'already_activated',
          user,
          requestId,
        )
        return { message: 'Account is already activated' }
      }

      // Cooldown to avoid spamming the activation channel.
      if (user.lastActivationSentAt) {
        const elapsed =
          Date.now() - new Date(user.lastActivationSentAt).getTime()
        if (elapsed < RESEND_COOLDOWN_MS) {
          this.recordActivity('resend_activation', 'cooldown', user, requestId)
          const waitSeconds = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000)
          throw new BadRequestException(
            `Please wait ${waitSeconds} seconds before requesting a new code`,
          )
        }
      }

      const activationToken = randomBytes(32).toString('hex')
      const activationTokenHash = this.hashValue(activationToken)
      const activationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

      await this.usersRepository.update(user.id, {
        activationTokenHash,
        activationExpiresAt,
        lastActivationSentAt: new Date(),
      } as DeepPartial<User>)

      if (!user.email) {
        throw new BadRequestException(
          'An email address is required to send an activation notification',
        )
      }
      await this.notificationClient.sendActivation({
        userId: user.id,
        email: user.email,
        activationToken,
        expiresAt: activationExpiresAt.toISOString(),
        requestId,
      })

      this.logger.log(
        { action: 'resend_activation', result: 'success' },
        'Activation token resent and notification queued',
      )
      this.recordActivity('resend_activation', 'success', user, requestId)

      return {
        message:
          'A new activation email has been queued. Use its token to activate your account before it expires.',
      }
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof BadRequestException
      ) {
        throw error
      }
      this.logger.error(
        { errorType: error instanceof Error ? error.name : 'unknown' },
        'Unexpected error while resending activation code',
      )
      this.recordActivity('resend_activation', 'error', undefined, requestId)
      throw new InternalServerErrorException('Failed to resend activation code')
    }
  }

  async activate(
    healthId: string,
    token: string,
    requestId?: string,
  ): Promise<{ message: string }> {
    try {
      const user = await this.usersRepository.findOne({
        where: { healthId },
        select: [
          'id',
          'healthId',
          'activationTokenHash',
          'activationExpiresAt',
          'isActive',
          'email',
          'phoneNumber',
          'role',
        ],
      })

      if (!user) {
        this.metrics.authActivationTotal.inc({ result: 'not_found' })
        this.recordActivity('activate', 'invalid_details', undefined, requestId)
        throw new UnauthorizedException('Invalid activation details')
      }

      if (user.isActive) {
        this.metrics.authActivationTotal.inc({ result: 'already_activated' })
        this.recordActivity('activate', 'already_activated', user, requestId)
        return { message: 'Account already activated' }
      }

      if (
        !user.activationTokenHash ||
        !this.hashesMatch(user.activationTokenHash, this.hashValue(token))
      ) {
        this.metrics.authActivationTotal.inc({ result: 'invalid_token' })
        this.recordActivity('activate', 'invalid_token', user, requestId)
        throw new UnauthorizedException('Invalid or expired activation token')
      }

      if (
        !user.activationExpiresAt ||
        new Date() >= new Date(user.activationExpiresAt)
      ) {
        this.metrics.authActivationTotal.inc({ result: 'expired_token' })
        this.recordActivity('activate', 'expired_token', user, requestId)
        throw new UnauthorizedException('Activation token has expired')
      }

      const activationResult = await this.usersRepository.update(
        {
          id: user.id,
          isActive: false,
          activationTokenHash: user.activationTokenHash,
          activationExpiresAt: user.activationExpiresAt,
        },
        {
          isActive: true,
          activationTokenHash: null,
          activationExpiresAt: null,
        } as DeepPartial<User>,
      )
      if (activationResult.affected !== 1) {
        this.metrics.authActivationTotal.inc({ result: 'invalid_token' })
        this.recordActivity('activate', 'invalid_token', user, requestId)
        throw new UnauthorizedException('Invalid or expired activation token')
      }

      await this.eventBus.emitAsync('user.registered', {
        id: user.id,
        healthId: user.healthId,
        email: user.email,
        role: user.role,
      })
      await this.eventBus.emitAsync('user.activated', {
        id: user.id,
        healthId: user.healthId,
        email: user.email,
        role: user.role,
      })

      this.metrics.authActivationTotal.inc({ result: 'success' })
      this.logger.log(
        { action: 'activate', result: 'success' },
        'Account activated',
      )
      this.recordActivity('activate', 'success', user, requestId)

      return { message: 'Account activated successfully' }
    } catch (error) {
      if (error instanceof HttpException) throw error
      this.metrics.authActivationTotal.inc({ result: 'error' })
      this.logger.error(
        { errorType: error instanceof Error ? error.name : 'unknown' },
        'Unexpected error while activating account',
      )
      this.recordActivity('activate', 'error', undefined, requestId)
      throw new InternalServerErrorException('Failed to activate account')
    }
  }

  private hashesMatch(storedHash: string, candidateHash: string): boolean {
    const stored = Buffer.from(storedHash, 'hex')
    const candidate = Buffer.from(candidateHash, 'hex')
    return (
      stored.length === candidate.length &&
      stored.length > 0 &&
      timingSafeEqual(stored, candidate)
    )
  }
}
