import { Test, TestingModule } from '@nestjs/testing'
import { AuthService } from './auth.service'
import { UsersService } from '@/users/users.service'
import { EventBusService } from '@/common/event-bus.service'
import { JwtService } from '@nestjs/jwt'
import { getRepositoryToken } from '@nestjs/typeorm'
import { User, UserRole } from '@/users/entities/user.entity'
import { RefreshToken } from './entities/refresh-token.entity'
import { GoogleAuthService } from './google-auth.service'
import { MetricsService } from '@/common/metrics/metrics.service'
import { NotificationClientService } from './notification-client.service'
import { Logger } from '@nestjs/common'
import { createHash } from 'crypto'
import * as bcrypt from 'bcrypt'
import {
  MOCK,
  mockRegisterUserDto,
  mockLoginUserDto,
  mockGoogleSignInDto,
  mockResendActivationDto,
} from '@/common/test/mock-data'

type UserRepoMock = {
  findOne: jest.Mock
  create: jest.Mock
  save: jest.Mock
  update: jest.Mock
}

type RefreshRepoMock = {
  findOne: jest.Mock
  create: jest.Mock
  save: jest.Mock
  update: jest.Mock
}

describe('AuthService', () => {
  let service: AuthService
  let mockUserRepo: UserRepoMock
  let mockRefreshRepo: RefreshRepoMock
  let activityLogSpy: jest.SpiedFunction<typeof Logger.prototype.log>

  const hashValue = (value: string): string =>
    createHash('sha256').update(value).digest('hex')

  const mockUsersService = {
    generateHealthId: jest.fn(),
    findUserByUsername: jest.fn(),
  }

  const mockEventBus = {
    emit: jest.fn(),
    emitAsync: jest.fn().mockResolvedValue(undefined),
  }

  const mockNotificationClient = {
    sendActivation: jest
      .fn()
      .mockResolvedValue({ id: 'notification-id', status: 'queued' }),
  }

  const mockGoogleAuthService = {
    verifyIdToken: jest.fn(),
  }

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('signed-token'),
    verifyAsync: jest.fn().mockResolvedValue({ sub: 'uuid' }),
  }

  const mockUserRepository = (): UserRepoMock => ({
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  })

  const mockRefreshTokenRepository = (): RefreshRepoMock => ({
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  })

  beforeEach(async () => {
    activityLogSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined)
    mockUserRepo = mockUserRepository()
    mockRefreshRepo = mockRefreshTokenRepository()
    mockUserRepo.create.mockReturnValue({} as User)
    mockUserRepo.save.mockResolvedValue({} as User)
    mockUserRepo.update.mockResolvedValue({ affected: 1 })
    mockRefreshRepo.create.mockReturnValue({} as RefreshToken)
    mockRefreshRepo.save.mockResolvedValue({} as RefreshToken)
    mockRefreshRepo.update.mockResolvedValue({ affected: 1 })
    mockJwtService.sign.mockReturnValue('signed-token')
    mockJwtService.verifyAsync.mockResolvedValue({
      sub: 'uuid',
      tokenType: 'refresh',
    })
    mockNotificationClient.sendActivation.mockResolvedValue({
      id: 'notification-id',
      status: 'queued',
    })
    mockGoogleAuthService.verifyIdToken.mockResolvedValue({
      email: MOCK.googleUser.email,
      email_verified: MOCK.googleUser.emailVerified,
    })

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        MetricsService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: EventBusService, useValue: mockEventBus },
        {
          provide: NotificationClientService,
          useValue: mockNotificationClient,
        },
        { provide: JwtService, useValue: mockJwtService },
        { provide: GoogleAuthService, useValue: mockGoogleAuthService },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: mockRefreshRepo,
        },
      ],
    }).compile()

    service = module.get<AuthService>(AuthService)
  })

  afterEach(() => jest.resetAllMocks())

  it('should throw ConflictException if email already exists on signup', async () => {
    mockUserRepo.findOne.mockResolvedValue({ email: MOCK.user.email })

    await expect(service.signup(mockRegisterUserDto)).rejects.toThrow()
  })

  it('should signup and return message on success', async () => {
    mockUserRepo.findOne.mockResolvedValue(null)
    mockUsersService.generateHealthId.mockResolvedValue(MOCK.healthId.patient)
    mockUserRepo.create.mockImplementation(
      (data: Partial<User>): User => data as User,
    )
    mockUserRepo.save.mockResolvedValue({ id: 'uuid', firstName: 'Mock' })

    const res = await service.signup(mockRegisterUserDto)

    expect(res).toHaveProperty('message')
    expect(mockUserRepo.save).toHaveBeenCalled()
    expect(mockNotificationClient.sendActivation).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'uuid',
        email: MOCK.user.email,
        requestId: undefined,
      }),
    )
  })

  it('should throw Unauthorized when login with wrong credentials', async () => {
    mockUsersService.findUserByUsername.mockResolvedValue(null)
    await expect(service.login(mockLoginUserDto)).rejects.toThrow()
  })

  it('should login successfully and return tokens', async () => {
    const password = MOCK.user.password
    const hashed = await bcrypt.hash(password, 10)
    mockUsersService.findUserByUsername.mockResolvedValue({
      id: 'uuid',
      email: MOCK.user.email,
      phoneNumber: MOCK.user.phoneNumber,
      password: hashed,
      isActive: true,
      role: UserRole.PATIENT,
      healthId: MOCK.healthId.patient,
    })

    const res = await service.login(mockLoginUserDto)

    expect(res).toHaveProperty('data')
    expect(res.meta).toHaveProperty('accessToken')
    expect(res.meta).toHaveProperty('refreshToken')
    expect(res.data).not.toHaveProperty('password')
    expect(mockRefreshRepo.create).toHaveBeenCalled()
    expect(mockRefreshRepo.save).toHaveBeenCalled()
    expect(activityLogSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'auth.activity',
        action: 'login',
        outcome: 'success',
      }),
      'Authentication activity',
    )
  })

  it('should sign in with Google when active user exists', async () => {
    const payload = {
      email: MOCK.googleUser.email,
      email_verified: MOCK.googleUser.emailVerified,
      given_name: MOCK.googleUser.givenName,
      family_name: MOCK.googleUser.familyName,
    }
    mockGoogleAuthService.verifyIdToken.mockResolvedValue(payload)
    mockUsersService.findUserByUsername.mockResolvedValue({
      id: 'uuid',
      email: MOCK.googleUser.email,
      phoneNumber: MOCK.googleUser.phoneNumber,
      password: null,
      isActive: true,
      role: UserRole.PATIENT,
      healthId: MOCK.healthId.patient,
    })

    const result = await service.googleSignIn(mockGoogleSignInDto)

    expect(result).toHaveProperty('data')
    expect(result.meta).toHaveProperty('accessToken')
    expect(result.meta).toHaveProperty('refreshToken')
  })

  it('should provision Google users without a phone number as nullable', async () => {
    mockGoogleAuthService.verifyIdToken.mockResolvedValue({
      email: 'google.new@example.com',
      email_verified: true,
      given_name: 'Google',
      family_name: 'User',
    })
    mockUsersService.findUserByUsername.mockResolvedValue(null)
    mockUsersService.generateHealthId.mockResolvedValue(MOCK.healthId.patient)
    mockUserRepo.save.mockResolvedValue({ id: 'uuid' } as User)
    mockUserRepo.create.mockImplementation(
      (data: Partial<User>): User => data as User,
    )

    await service.googleSignIn(mockGoogleSignInDto)

    expect(mockUserRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ phoneNumber: null }),
    )
    expect(mockNotificationClient.sendActivation).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'uuid',
        email: 'google.new@example.com',
      }),
    )
  })

  it('should refresh a valid refresh token', async () => {
    const user = {
      id: 'uuid',
      email: MOCK.user.email,
      phoneNumber: MOCK.user.phoneNumber,
      healthId: MOCK.healthId.patient,
      role: UserRole.PATIENT,
      isActive: true,
    }
    const refreshToken = MOCK.refreshToken
    mockRefreshRepo.findOne.mockResolvedValue({
      id: 'token-id',
      userId: 'uuid',
      token: hashValue(refreshToken),
      revoked: false,
      expiresAt: new Date(Date.now() + 1000 * 60 * 10),
    })
    mockUserRepo.findOne.mockResolvedValue(user)
    mockJwtService.verifyAsync.mockResolvedValue({
      sub: 'uuid',
      tokenType: 'refresh',
    })

    const result = await service.refresh(refreshToken)

    expect(result).toHaveProperty('accessToken')
    expect(result).toHaveProperty('refreshToken')
    expect(mockRefreshRepo.save).toHaveBeenCalled()
    expect(mockRefreshRepo.update).toHaveBeenCalledWith(
      { id: 'token-id', revoked: false },
      { revoked: true },
    )
  })

  it('should reject an access token presented for refresh', async () => {
    mockJwtService.verifyAsync.mockResolvedValue({
      sub: 'uuid',
      tokenType: 'access',
    })

    await expect(service.refresh(MOCK.refreshToken)).rejects.toThrow(
      'Invalid or expired refresh token',
    )
    expect(mockRefreshRepo.findOne).not.toHaveBeenCalled()
    expect(mockRefreshRepo.update).not.toHaveBeenCalled()
  })

  it('should rotate a legacy refresh token only when it is persisted', async () => {
    mockJwtService.verifyAsync.mockResolvedValue({ sub: 'uuid' })
    mockRefreshRepo.findOne.mockResolvedValue({
      id: 'legacy-token-id',
      userId: 'uuid',
      token: hashValue(MOCK.refreshToken),
      revoked: false,
      expiresAt: new Date(Date.now() + 1000 * 60 * 10),
    })
    mockUserRepo.findOne.mockResolvedValue({
      id: 'uuid',
      isActive: true,
      role: UserRole.PATIENT,
      healthId: MOCK.healthId.patient,
    })

    await expect(service.refresh(MOCK.refreshToken)).resolves.toHaveProperty(
      'accessToken',
    )
    expect(mockRefreshRepo.update).toHaveBeenCalledWith(
      { id: 'legacy-token-id', revoked: false },
      { revoked: true },
    )
  })

  it('should return unauthorized for an unverifiable refresh token', async () => {
    mockJwtService.verifyAsync.mockRejectedValue(
      new Error('Signature verification failed'),
    )

    await expect(service.refresh(MOCK.refreshToken)).rejects.toThrow(
      'Invalid or expired refresh token',
    )
    expect(mockRefreshRepo.findOne).not.toHaveBeenCalled()
  })

  it('should reject login when the user is inactive', async () => {
    const password = MOCK.user.password
    const hashed = await bcrypt.hash(password, 10)
    mockUsersService.findUserByUsername.mockResolvedValue({
      id: 'uuid',
      email: MOCK.user.email,
      phoneNumber: MOCK.user.phoneNumber,
      password: hashed,
      isActive: false,
      role: UserRole.PATIENT,
      healthId: MOCK.healthId.patient,
    })

    await expect(service.login(mockLoginUserDto)).rejects.toThrow()
  })

  it('should activate account with valid token', async () => {
    mockUserRepo.findOne.mockResolvedValue({
      id: 'uuid',
      healthId: MOCK.healthId.patient,
      email: MOCK.user.email,
      role: UserRole.PATIENT,
      activationTokenHash: hashValue(MOCK.activationToken),
      activationExpiresAt: new Date(Date.now() + 1000 * 60 * 60),
      isActive: false,
    })

    await expect(
      service.activate(MOCK.healthId.patient, MOCK.activationToken),
    ).resolves.toEqual({
      message: 'Account activated successfully',
    })
    expect(mockUserRepo.update).toHaveBeenCalled()
  })

  it('should reject account activation with an expired token', async () => {
    mockUserRepo.findOne.mockResolvedValue({
      id: 'uuid',
      healthId: MOCK.healthId.patient,
      email: MOCK.user.email,
      role: UserRole.PATIENT,
      activationTokenHash: hashValue(MOCK.activationToken),
      activationExpiresAt: new Date(Date.now() - 1000 * 60 * 60),
      isActive: false,
    })

    await expect(
      service.activate(MOCK.healthId.patient, MOCK.activationToken),
    ).rejects.toThrow()
    expect(mockUserRepo.update).not.toHaveBeenCalled()
  })

  it('should resend activation code for an inactive user', async () => {
    mockUserRepo.findOne.mockResolvedValue({
      id: 'uuid',
      email: MOCK.user.email,
      phoneNumber: MOCK.user.phoneNumber,
      healthId: MOCK.healthId.patient,
      role: UserRole.PATIENT,
      isActive: false,
      activationTokenHash: 'old-hash',
      lastActivationSentAt: null,
    })

    const res = await service.resendActivation(mockResendActivationDto)

    expect(res).toHaveProperty('message')
    expect(mockUserRepo.update).toHaveBeenCalledTimes(1)
    const updateCall = mockUserRepo.update.mock.calls[0] as [
      string,
      {
        activationTokenHash: string
        activationExpiresAt: Date
        lastActivationSentAt: Date
      },
    ]
    expect(updateCall[0]).toBe('uuid')
    const updateArg = updateCall[1]
    expect(typeof updateArg.activationTokenHash).toBe('string')
    expect(updateArg.activationExpiresAt).toBeInstanceOf(Date)
    expect(updateArg.lastActivationSentAt).toBeInstanceOf(Date)

    expect(mockNotificationClient.sendActivation).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'uuid',
        email: MOCK.user.email,
      }),
    )
  })

  it('should not reveal whether an account exists when resending', async () => {
    mockUserRepo.findOne.mockResolvedValue(null)

    await expect(
      service.resendActivation(mockResendActivationDto),
    ).rejects.toThrow('Unable to resend activation code at this time')
    expect(mockUserRepo.update).not.toHaveBeenCalled()
    expect(mockNotificationClient.sendActivation).not.toHaveBeenCalled()
  })

  it('should return message when account is already activated on resend', async () => {
    mockUserRepo.findOne.mockResolvedValue({
      id: 'uuid',
      email: MOCK.user.email,
      phoneNumber: MOCK.user.phoneNumber,
      healthId: MOCK.healthId.patient,
      role: UserRole.PATIENT,
      isActive: true,
      lastActivationSentAt: null,
    })

    const res = await service.resendActivation(mockResendActivationDto)

    expect(res.message).toBe('Account is already activated')
    expect(mockEventBus.emitAsync).not.toHaveBeenCalled()
    expect(mockUserRepo.update).not.toHaveBeenCalled()
  })

  it('should enforce a resend cooldown within 60 seconds', async () => {
    mockUserRepo.findOne.mockResolvedValue({
      id: 'uuid',
      email: MOCK.user.email,
      phoneNumber: MOCK.user.phoneNumber,
      healthId: MOCK.healthId.patient,
      role: UserRole.PATIENT,
      isActive: false,
      lastActivationSentAt: new Date(),
    })

    await expect(
      service.resendActivation(mockResendActivationDto),
    ).rejects.toThrow(/Please wait/)
    expect(mockUserRepo.update).not.toHaveBeenCalled()
    expect(mockEventBus.emitAsync).not.toHaveBeenCalled()
  })
})
