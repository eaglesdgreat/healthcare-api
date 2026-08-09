import { Test, TestingModule } from '@nestjs/testing'
import { AuthService } from './auth.service'
import { UsersService } from '@/users/users.service'
import { EventBusService } from '@/common/event-bus.service'
import { JwtService } from '@nestjs/jwt'
import { getRepositoryToken } from '@nestjs/typeorm'
import { User, UserRole } from '@/users/entities/user.entity'
import { RefreshToken } from './entities/refresh-token.entity'
import { GoogleAuthService } from './google-auth.service'
import { GoogleSignInDto } from './dto/google-signin.dto'
import { LoginUserDto, RegisterUserDto } from './dto'
import { createHash } from 'crypto'
import * as bcrypt from 'bcrypt'

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
      email: 'google@example.com',
      email_verified: true,
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
    mockUserRepo.findOne.mockResolvedValue({ email: 'test@example.com' })

    const registerDto: RegisterUserDto = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'test@example.com',
      phoneNumber: '+2348012345678',
      role: UserRole.PATIENT,
      password: 'Abcd1234!',
    }

    await expect(service.signup(registerDto)).rejects.toThrow()
  })

  it('should signup and return message on success', async () => {
    mockUserRepo.findOne.mockResolvedValue(null)
    mockUsersService.generateHealthId.mockResolvedValue('PAT-ABCDEFGH')
    mockUserRepo.create.mockImplementation(
      (data: Partial<User>): User => data as User,
    )
    mockUserRepo.save.mockResolvedValue({ id: 'uuid', firstName: 'John' })

    const registerDto: RegisterUserDto = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'new@example.com',
      phoneNumber: '+2348012345678',
      role: UserRole.PATIENT,
      password: 'Abcd1234!',
    }

    const res = await service.signup(registerDto)

    expect(res).toHaveProperty('message')
    expect(mockUserRepo.save).toHaveBeenCalled()
    expect(mockEventBus.emit).toHaveBeenCalledWith(
      'user.pending_activation',
      expect.objectContaining({
        email: 'new@example.com',
        phoneNumber: '+2348012345678',
        healthId: 'PAT-ABCDEFGH',
        role: UserRole.PATIENT,
      }),
    )
  })

  it('should throw Unauthorized when login with wrong credentials', async () => {
    mockUsersService.findUserByUsername.mockResolvedValue(null)
    await expect(
      service.login({ username: 'notfound', password: 'Pass123!' }),
    ).rejects.toThrow()
  })

  it('should login successfully and return tokens', async () => {
    const password = 'Password1!'
    const hashed = await bcrypt.hash(password, 10)
    mockUsersService.findUserByUsername.mockResolvedValue({
      id: 'uuid',
      email: 'u@example.com',
      phoneNumber: '+1234567890',
      password: hashed,
      isActive: true,
      role: UserRole.PATIENT,
      healthId: 'PAT-ABCDEFGH',
    })

    const loginDto: LoginUserDto = { username: 'u@example.com', password }
    const res = await service.login(loginDto)

    expect(res).toHaveProperty('data')
    expect(res.meta).toHaveProperty('accessToken')
    expect(res.meta).toHaveProperty('refreshToken')
    expect(mockRefreshRepo.create).toHaveBeenCalled()
    expect(mockRefreshRepo.save).toHaveBeenCalled()
  })

  it('should sign in with Google when active user exists', async () => {
    const payload = {
      email: 'google@example.com',
      email_verified: true,
      given_name: 'Google',
      family_name: 'User',
    }
    mockGoogleAuthService.verifyIdToken.mockResolvedValue(payload)
    mockUsersService.findUserByUsername.mockResolvedValue({
      id: 'uuid',
      email: 'google@example.com',
      phoneNumber: '+1234567890',
      password: null,
      isActive: true,
      role: UserRole.PATIENT,
      healthId: 'PAT-ABCDEFGH',
    })

    const dto: GoogleSignInDto = { idToken: 'token' }
    const result = await service.googleSignIn(dto)

    expect(result).toHaveProperty('data')
    expect(result.meta).toHaveProperty('accessToken')
    expect(result.meta).toHaveProperty('refreshToken')
  })

  it('should refresh a valid refresh token', async () => {
    const user = {
      id: 'uuid',
      email: 'u@example.com',
      phoneNumber: '+1234567890',
      healthId: 'PAT-ABCDEFGH',
      role: UserRole.PATIENT,
      isActive: true,
    }
    const refreshToken = 'valid-refresh-token'
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
    const password = 'Password1!'
    const hashed = await bcrypt.hash(password, 10)
    mockUsersService.findUserByUsername.mockResolvedValue({
      id: 'uuid',
      email: 'u@example.com',
      phoneNumber: '+1234567890',
      password: hashed,
      isActive: false,
      role: UserRole.PATIENT,
      healthId: 'PAT-ABCDEFGH',
    })

    await expect(
      service.login({ username: 'u@example.com', password }),
    ).rejects.toThrow()
  })

  it('should activate account with valid token', async () => {
    mockUserRepo.findOne.mockResolvedValue({
      id: 'uuid',
      healthId: 'PAT-ABC',
      email: 'u@example.com',
      role: UserRole.PATIENT,
      activationTokenHash: hashValue('token123'),
      activationExpiresAt: new Date(Date.now() + 1000 * 60 * 60),
      isActive: false,
    })

    await expect(service.activate('PAT-ABC', 'token123')).resolves.toEqual({
      message: 'Account activated successfully',
    })
    expect(mockUserRepo.update).toHaveBeenCalled()
  })

  it('should reject account activation with an expired token', async () => {
    mockUserRepo.findOne.mockResolvedValue({
      id: 'uuid',
      healthId: 'PAT-ABC',
      email: 'u@example.com',
      role: UserRole.PATIENT,
      activationTokenHash: hashValue('token123'),
      activationExpiresAt: new Date(Date.now() - 1000 * 60 * 60),
      isActive: false,
    })

    await expect(service.activate('PAT-ABC', 'token123')).rejects.toThrow()
    expect(mockUserRepo.update).not.toHaveBeenCalled()
  })
})
