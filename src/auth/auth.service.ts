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
import { randomBytes, createHash } from 'crypto'
import { RefreshToken } from './entities/refresh-token.entity'
import { GoogleAuthService } from './google-auth.service'
import { GoogleSignInDto } from './dto/google-signin.dto'
import { MetricsService } from '@/common/metrics/metrics.service'

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
    private readonly googleAuthService: GoogleAuthService,
    private readonly metrics: MetricsService,

    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,

    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
  ) {}

  async signup(registerDto: RegisterUserDto): Promise<{ message: string }> {
    const { email, phoneNumber, password, firstName, lastName, role } =
      registerDto

    const existingUser = await this.usersRepository.findOne({
      where: [{ email }, { phoneNumber }],
    })

    if (existingUser) {
      this.metrics.authSignupTotal.inc({ result: 'conflict' })
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
      const activationToken = randomBytes(8).toString('hex')
      const activationTokenHash = this.hashValue(activationToken)
      const activationExpiresAt = new Date()
      activationExpiresAt.setHours(activationExpiresAt.getHours() + 24)

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

      await this.usersRepository.save(newUser)

      this.eventBus.emit('user.pending_activation', {
        email,
        phoneNumber,
        healthId,
        activationToken,
        activationExpiresAt: activationExpiresAt.toISOString(),
        role,
      })

      this.logger.log(
        { healthId, role },
        'User signed up and pending-activation event emitted',
      )
      this.metrics.authSignupTotal.inc({ result: 'success' })

      return {
        message:
          'Registration successful. Activation token has been sent to the provided contact method. Use it to activate your account.',
      }
    } catch (error) {
      this.metrics.authSignupTotal.inc({ result: 'error' })
      this.logger.error({ err: error }, 'Failed to provision new user account')
      if (error instanceof Error) {
        throw error
      }
      throw new InternalServerErrorException(
        'An error occurred during account provisioning',
      )
    }
  }

  async login(loginUser: LoginUserDto) {
    const { username, password } = loginUser

    try {
      const user = await this.usersService.findUserByUsername(username)

      if (user) {
        if (!user.password || !(await this.verifyPassword(user, password))) {
          this.metrics.authLoginTotal.inc({ result: 'invalid_credentials' })
          throw new UnauthorizedException('Invalid credentials')
        }

        if (!user.isActive) {
          this.metrics.authLoginTotal.inc({ result: 'not_activated' })
          throw new ForbiddenException('Account not activated')
        }

        const { accessToken, refreshToken } = await this.generateTokens(user)
        const { password: _password, ...userResponse } = user
        void _password

        this.metrics.authLoginTotal.inc({ result: 'success' })
        this.logger.log(
          { healthId: user.healthId },
          'User logged in successfully',
        )

        return {
          data: userResponse,
          meta: {
            accessToken,
            refreshToken,
          },
        }
      }

      this.metrics.authLoginTotal.inc({ result: 'not_found' })
      throw new UnauthorizedException('Signup to create user')
    } catch (error) {
      // Expected auth failures (wrong password, inactive account, unknown
      // user) were already recorded above and are logged globally by the
      // exception filter; only unexpected system errors need extra
      // handling here.
      if (error instanceof HttpException) {
        throw error
      }
      this.metrics.authLoginTotal.inc({ result: 'error' })
      this.logger.error({ err: error }, 'Unexpected error during login')
      throw new InternalServerErrorException('Failed to login user')
    }
  }

  async googleSignIn(googleSignInDto: GoogleSignInDto) {
    const { idToken, role } = googleSignInDto
    const payload = (await this.googleAuthService.verifyIdToken(idToken)) as {
      email?: string
      email_verified?: boolean
      given_name?: string
      family_name?: string
      phone_number?: string
    }
    const email = payload.email

    if (!email) {
      throw new BadRequestException(
        'Google token did not include a verified email',
      )
    }
    if (payload.email_verified === false) {
      throw new UnauthorizedException('Google email has not been verified')
    }

    try {
      const user = await this.usersService.findUserByUsername(email)

      if (user) {
        if (!user.isActive) {
          this.metrics.authLoginTotal.inc({ result: 'not_activated' })
          throw new ForbiddenException('Account not activated')
        }
        const { accessToken, refreshToken } = await this.generateTokens(user)
        const { password: _password, ...userResponse } = user
        void _password

        this.metrics.authLoginTotal.inc({ result: 'google_success' })
        this.logger.log(
          { healthId: user.healthId },
          'User signed in with Google',
        )

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
      const activationToken = randomBytes(24).toString('hex')
      const activationTokenHash = this.hashValue(activationToken)
      const activationExpiresAt = new Date()
      activationExpiresAt.setHours(activationExpiresAt.getHours() + 24)

      const newUser = this.usersRepository.create({
        firstName: payload.given_name || '',
        lastName: payload.family_name || '',
        email,
        phoneNumber: payload.phone_number || '',
        password: null,
        role: assignedRole,
        healthId,
        isActive: false,
        activationTokenHash,
        activationExpiresAt,
      } as DeepPartial<User>)

      await this.usersRepository.save(newUser)
      this.eventBus.emit('user.pending_activation', {
        email,
        phoneNumber: payload.phone_number || null,
        healthId,
        activationToken,
        activationExpiresAt: activationExpiresAt.toISOString(),
        role: assignedRole,
        source: 'google',
      })

      this.metrics.authSignupTotal.inc({ result: 'google_provisioned' })
      this.logger.log(
        { healthId, role: assignedRole },
        'New account provisioned via Google sign-in, pending activation',
      )

      return {
        message:
          'Google login succeeded. A pending activation event was emitted so the account can be activated before first use.',
      }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error
      }
      this.metrics.authLoginTotal.inc({ result: 'error' })
      this.logger.error(
        { err: error },
        'Unexpected error during Google sign-in',
      )
      throw new InternalServerErrorException('Failed to process Google sign-in')
    }
  }

  async refresh(refreshToken: string) {
    if (!refreshToken) {
      throw new BadRequestException('Refresh token must be provided')
    }

    try {
      await this.jwtService.verifyAsync(refreshToken)

      const tokenHash = this.hashValue(refreshToken)
      const storedToken = await this.refreshTokenRepository.findOne({
        where: { token: tokenHash, revoked: false },
      })

      if (!storedToken || storedToken.expiresAt < new Date()) {
        this.metrics.authTokenRefreshTotal.inc({ result: 'invalid_token' })
        throw new UnauthorizedException('Invalid or expired refresh token')
      }

      const user = await this.usersRepository.findOne({
        where: { id: storedToken.userId },
      })

      if (!user || !user.isActive) {
        this.metrics.authTokenRefreshTotal.inc({ result: 'invalid_token' })
        throw new UnauthorizedException('Invalid refresh token')
      }

      storedToken.revoked = true
      await this.refreshTokenRepository.save(storedToken)

      const tokens = await this.generateTokens(user)
      this.metrics.authTokenRefreshTotal.inc({ result: 'success' })
      this.logger.log(
        { healthId: user.healthId },
        'Refresh token rotated successfully',
      )
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
        { err: error },
        'Unexpected error while refreshing authentication tokens',
      )
      throw new InternalServerErrorException(
        'Failed to refresh authentication tokens',
      )
    }
  }

  async logout(refreshToken: string) {
    if (!refreshToken) {
      throw new BadRequestException('Refresh token must be provided')
    }

    const tokenHash = this.hashValue(refreshToken)
    const storedToken = await this.refreshTokenRepository.findOne({
      where: { token: tokenHash, revoked: false },
    })

    if (storedToken) {
      storedToken.revoked = true
      await this.refreshTokenRepository.save(storedToken)
    }

    return { message: 'Refresh token revoked' }
  }

  private async verifyPassword(user: User, password: string) {
    return (
      user && user.password && (await bcrypt.compare(password, user.password))
    )
  }

  private async generateTokens(user: User) {
    const payload = {
      sub: user?.id,
      email: user?.email,
      phoneNumber: user?.phoneNumber,
      healthId: user?.healthId,
      roles: user?.role,
    }

    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' })
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' })
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

  /**
   * Resend the activation token for an account that has not yet been activated,
   * for example when the previous token has expired. Enforces a cooldown to
   * prevent abuse.
   */
  async resendActivation(
    resendActivationDto: ResendActivationDto,
  ): Promise<{ message: string }> {
    const { identifier }: ResendActivationDto = resendActivationDto
    const RESEND_COOLDOWN_MS = 60 * 1000 // 60 seconds

    try {
      const user = await this.usersRepository.findOne({
        where: [{ email: identifier }, { phoneNumber: identifier }],
      })

      if (!user) {
        // Do not reveal whether an account exists.
        throw new UnauthorizedException(
          'Unable to resend activation code at this time',
        )
      }

      if (user.isActive) {
        return { message: 'Account is already activated' }
      }

      // Cooldown to avoid spamming the activation channel.
      if (user.lastActivationSentAt) {
        const elapsed =
          Date.now() - new Date(user.lastActivationSentAt).getTime()
        if (elapsed < RESEND_COOLDOWN_MS) {
          const waitSeconds = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000)
          throw new BadRequestException(
            `Please wait ${waitSeconds} seconds before requesting a new code`,
          )
        }
      }

      const activationToken = randomBytes(8).toString('hex')
      const activationTokenHash = this.hashValue(activationToken)
      const activationExpiresAt = new Date()
      activationExpiresAt.setHours(activationExpiresAt.getHours() + 24)

      await this.usersRepository.update(user.id, {
        activationTokenHash,
        activationExpiresAt,
        lastActivationSentAt: new Date(),
      } as DeepPartial<User>)

      this.eventBus.emit('user.pending_activation', {
        email: user.email,
        phoneNumber: user.phoneNumber,
        healthId: user.healthId,
        activationToken,
        activationExpiresAt: activationExpiresAt.toISOString(),
        role: user.role,
        resend: true,
      })

      this.logger.log(
        { healthId: user.healthId },
        'Activation token resent and pending-activation event emitted',
      )

      return {
        message:
          'A new activation code has been sent. Use it to activate your account before it expires.',
      }
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof BadRequestException
      ) {
        throw error
      }
      this.logger.error(
        { err: error },
        'Unexpected error while resending activation code',
      )
      throw new InternalServerErrorException('Failed to resend activation code')
    }
  }

  async activate(
    healthId: string,
    token: string,
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
        ],
      })

      if (!user) {
        this.metrics.authActivationTotal.inc({ result: 'not_found' })
        throw new UnauthorizedException('Invalid activation details')
      }

      if (user.isActive) {
        this.metrics.authActivationTotal.inc({ result: 'already_activated' })
        return { message: 'Account already activated' }
      }

      if (
        !user.activationTokenHash ||
        user.activationTokenHash !== this.hashValue(token)
      ) {
        this.metrics.authActivationTotal.inc({ result: 'invalid_token' })
        throw new UnauthorizedException('Invalid or expired activation token')
      }

      if (
        user.activationExpiresAt &&
        new Date() > new Date(user.activationExpiresAt)
      ) {
        this.metrics.authActivationTotal.inc({ result: 'expired_token' })
        throw new UnauthorizedException('Activation token has expired')
      }

      await this.usersRepository.update(user.id, {
        isActive: true,
        activationTokenHash: null,
        activationExpiresAt: null,
      } as DeepPartial<User>)

      this.eventBus.emit('user.registered', {
        id: user.id,
        healthId: user.healthId,
        email: user.email,
        role: user.role,
      })

      this.metrics.authActivationTotal.inc({ result: 'success' })
      this.logger.log({ healthId: user.healthId }, 'Account activated')

      return { message: 'Account activated successfully' }
    } catch (error) {
      if (error instanceof HttpException) throw error
      this.metrics.authActivationTotal.inc({ result: 'error' })
      this.logger.error(
        { err: error },
        'Unexpected error while activating account',
      )
      throw new InternalServerErrorException('Failed to activate account')
    }
  }
}
