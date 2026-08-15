import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { UsersService } from '@/users/users.service'
import { User, UserRole } from '@/users/entities/user.entity'
import { EventBusService } from '@/common/event-bus.service'
import * as bcrypt from 'bcrypt'
import { LoginUserDto, RegisterUserDto } from './dto'
import { Repository, DeepPartial } from 'typeorm'
import { InjectRepository } from '@nestjs/typeorm'
import { randomBytes, createHash } from 'crypto'
import { RefreshToken } from './entities/refresh-token.entity'
import { GoogleAuthService } from './google-auth.service'
import { GoogleSignInDto } from './dto/google-signin.dto'

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly eventBus: EventBusService,
    private readonly googleAuthService: GoogleAuthService,

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
      // TEMP: log the real token for local testing until the notification service is built
      console.log('ACTIVATION TOKEN:', activationToken)
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

      return {
        message:
          'Registration successful. Activation token has been sent to the provided contact method. Use it to activate your account.',
      }
    } catch (error) {
      console.error(error)
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
          throw new UnauthorizedException('Invalid credentials')
        }

        if (!user.isActive) {
          throw new ForbiddenException('Account not activated')
        }

        const { accessToken, refreshToken } = await this.generateTokens(user)
        const { password: _password, ...userResponse } = user
        void _password

        return {
          data: userResponse,
          meta: {
            accessToken,
            refreshToken,
          },
        }
      }

      throw new UnauthorizedException('Signup to create user')
    } catch (error) {
      console.error(error)
      if (error instanceof Error) {
        throw error
      }
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

    const user = await this.usersService.findUserByUsername(email)

    if (user) {
      if (!user.isActive) {
        throw new ForbiddenException('Account not activated')
      }
      const { accessToken, refreshToken } = await this.generateTokens(user)
      const { password: _password, ...userResponse } = user
      void _password
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

    return {
      message:
        'Google login succeeded. A pending activation event was emitted so the account can be activated before first use.',
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
        throw new UnauthorizedException('Invalid or expired refresh token')
      }

      const user = await this.usersRepository.findOne({
        where: { id: storedToken.userId },
      })

      if (!user || !user.isActive) {
        throw new UnauthorizedException('Invalid refresh token')
      }

      storedToken.revoked = true
      await this.refreshTokenRepository.save(storedToken)

      const tokens = await this.generateTokens(user)
      return tokens
    } catch (error) {
      console.error(error)
      if (
        error instanceof UnauthorizedException ||
        error instanceof BadRequestException
      ) {
        throw error
      }
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
        throw new UnauthorizedException('Invalid activation details')
      }

      if (user.isActive) {
        return { message: 'Account already activated' }
      }

      if (
        !user.activationTokenHash ||
        user.activationTokenHash !== this.hashValue(token)
      ) {
        throw new UnauthorizedException('Invalid or expired activation token')
      }

      if (
        user.activationExpiresAt &&
        new Date() > new Date(user.activationExpiresAt)
      ) {
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

      return { message: 'Account activated successfully' }
    } catch (error) {
      console.error(error)
      if (error instanceof Error) throw error
      throw new InternalServerErrorException('Failed to activate account')
    }
  }
}
