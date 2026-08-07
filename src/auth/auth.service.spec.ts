import { Test, TestingModule } from '@nestjs/testing'
import { AuthService } from './auth.service'
import { UsersService } from '@/users/users.service'
import { EventBusService } from '@/common/event-bus.service'
import { JwtService } from '@nestjs/jwt'
import { getRepositoryToken } from '@nestjs/typeorm'
import { User, UserRole } from '@/users/entities/user.entity'
import { RefreshToken } from './entities/refresh-token.entity'
import { GoogleAuthService } from './google-auth.service'
import * as bcrypt from 'bcrypt'

describe('AuthService', () => {
  let service: AuthService
  let mockUserRepo: ReturnType<typeof mockUserRepository>
  let mockRefreshRepo: ReturnType<typeof mockRefreshTokenRepository>

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

  const mockUserRepository = () => ({
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  })

  const mockRefreshTokenRepository = () => ({
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  })

  beforeEach(async () => {
    mockUserRepo = mockUserRepository()
    mockRefreshRepo = mockRefreshTokenRepository()
    mockUserRepo.create.mockImplementation((data) => data)
    mockUserRepo.save.mockImplementation(async (data) => data)
    mockRefreshRepo.create.mockImplementation((data) => data)
    mockRefreshRepo.save.mockImplementation(async (data) => data)
    mockJwtService.sign.mockReturnValue('signed-token')
    mockJwtService.verifyAsync.mockResolvedValue({
      sub: 'uuid',
    })
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
    const repo = (service as any).usersRepository
    repo.findOne.mockResolvedValue({ email: 'test@example.com' })

    await expect(
      service.signup({
        firstName: 'John',
        lastName: 'Doe',
        email: 'test@example.com',
        phoneNumber: '+2348012345678',
        role: UserRole.PATIENT,
        password: 'Abcd1234!',
      }),
    ).rejects.toThrow()
  })

  it('should signup and return message on success', async () => {
    const repo = (service as any).usersRepository
    repo.findOne.mockResolvedValue(null)
    mockUsersService.generateHealthId.mockResolvedValue('PAT-ABCDEFGH')
    repo.create.mockImplementation((data) => data)
    repo.save.mockResolvedValue({ id: 'uuid', firstName: 'John' })

    const res = await service.signup({
      firstName: 'John',
      lastName: 'Doe',
      email: 'new@example.com',
      phoneNumber: '+2348012345678',
      role: UserRole.PATIENT,
      password: 'Abcd1234!',
    })

    expect(res).toHaveProperty('message')
    expect(repo.save).toHaveBeenCalled()
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
      password: hashed,
      isActive: true,
      role: UserRole.PATIENT,
      healthId: 'PAT-ABCDEFGH',
    })

    const res = await service.login({ username: 'u@example.com', password })

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
      password: null,
      isActive: true,
      role: UserRole.PATIENT,
      healthId: 'PAT-ABCDEFGH',
    })

    const result = await service.googleSignIn({ idToken: 'token' } as any)

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
      token: service['hashValue'](refreshToken),
      revoked: false,
      expiresAt: new Date(Date.now() + 1000 * 60 * 10),
    })
    mockUserRepo.findOne.mockResolvedValue(user)
    mockJwtService.verifyAsync.mockResolvedValue({
      sub: 'uuid',
    })

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
    const repo = (service as any).usersRepository
    repo.findOne.mockResolvedValue({
      id: 'uuid',
      healthId: 'PAT-ABC',
      activationTokenHash: service['hashValue']('token123'),
      activationExpiresAt: new Date(Date.now() + 1000 * 60 * 60),
      isActive: false,
    })

    await expect(service.activate('PAT-ABC', 'token123')).resolves.toEqual({
      message: 'Account activated successfully',
    })
    expect(repo.update).toHaveBeenCalled()
  })

  it('should reject account activation with an expired token', async () => {
    const repo = (service as any).usersRepository
    repo.findOne.mockResolvedValue({
      id: 'uuid',
      healthId: 'PAT-ABC',
      activationTokenHash: service['hashValue']('token123'),
      activationExpiresAt: new Date(Date.now() - 1000 * 60 * 60),
      isActive: false,
    })

    await expect(service.activate('PAT-ABC', 'token123')).rejects.toThrow()
    expect(repo.update).not.toHaveBeenCalled()
  })
})
