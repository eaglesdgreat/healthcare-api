import { Test, TestingModule } from '@nestjs/testing'
import { AuthService } from './auth.service'
import { UsersService } from '@/users/users.service'
import { EventBusService } from '@/common/event-bus.service'
import { JwtService } from '@nestjs/jwt'
import { getRepositoryToken } from '@nestjs/typeorm'
import { User, UserRole } from '@/users/entities/user.entity'
import { RefreshToken } from './entities/refresh-token.entity'
import { GoogleAuthService } from './google-auth.service'
import { createHash } from 'crypto'
import * as bcrypt from 'bcrypt'
import {
  MOCK,
  mockRegisterUserDto,
  mockLoginUserDto,
  mockGoogleSignInDto,
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
}

describe('AuthService', () => {
  let service: AuthService
  let mockUserRepo: UserRepoMock
  let mockRefreshRepo: RefreshRepoMock

  const hashValue = (value: string): string =>
    createHash('sha256').update(value).digest('hex')

  const mockUsersService = {
    generateHealthId: jest.fn(),
    findUserByUsername: jest.fn(),
  }

  const mockEventBus = {
    emit: jest.fn(),
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
  })

  beforeEach(async () => {
    mockUserRepo = mockUserRepository()
    mockRefreshRepo = mockRefreshTokenRepository()
    mockUserRepo.create.mockReturnValue({} as User)
    mockUserRepo.save.mockResolvedValue({} as User)
    mockRefreshRepo.create.mockReturnValue({} as RefreshToken)
    mockRefreshRepo.save.mockResolvedValue({} as RefreshToken)
    mockJwtService.sign.mockReturnValue('signed-token')
    mockJwtService.verifyAsync.mockResolvedValue({ sub: 'uuid' })
    mockGoogleAuthService.verifyIdToken.mockResolvedValue({
      email: MOCK.googleUser.email,
      email_verified: MOCK.googleUser.emailVerified,
    })

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: EventBusService, useValue: mockEventBus },
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
    expect(mockEventBus.emit).toHaveBeenCalledWith(
      'user.pending_activation',
      expect.objectContaining({
        email: MOCK.user.email,
        phoneNumber: MOCK.user.phoneNumber,
        healthId: MOCK.healthId.patient,
        role: UserRole.PATIENT,
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
    expect(mockRefreshRepo.create).toHaveBeenCalled()
    expect(mockRefreshRepo.save).toHaveBeenCalled()
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
      userId: 'uuid',
      token: hashValue(refreshToken),
      revoked: false,
      expiresAt: new Date(Date.now() + 1000 * 60 * 10),
    })
    mockUserRepo.findOne.mockResolvedValue(user)
    mockJwtService.verifyAsync.mockResolvedValue({ sub: 'uuid' })

    const result = await service.refresh(refreshToken)

    expect(result).toHaveProperty('accessToken')
    expect(result).toHaveProperty('refreshToken')
    expect(mockRefreshRepo.save).toHaveBeenCalled()
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
})
