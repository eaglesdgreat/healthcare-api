import { Test, TestingModule } from '@nestjs/testing'
import { AuthService } from './auth.service'
import { UsersService } from '@/users/users.service'
import { JwtService } from '@nestjs/jwt'
import { getRepositoryToken } from '@nestjs/typeorm'
import { User, UserRole } from '@/users/entities/user.entity'
import * as bcrypt from 'bcrypt'

describe('AuthService', () => {
  let service: AuthService

  const mockUsersService = {
    generateHealthId: jest.fn(),
    findUserByUsername: jest.fn(),
  }

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('signed-token'),
  }

  const mockRepository = () => ({
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  })

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: getRepositoryToken(User), useFactory: mockRepository },
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
    ;(mockUsersService.generateHealthId as jest.Mock).mockResolvedValue('PAT-ABCDEFGH')
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
  })

  it('should throw Unauthorized when login with wrong credentials', async () => {
    ;(mockUsersService.findUserByUsername as jest.Mock).mockResolvedValue(null)
    await expect(
      service.login({ username: 'notfound', password: 'Pass123!' }),
    ).rejects.toThrow()
  })

  it('should login successfully and return tokens', async () => {
    const password = 'Password1!'
    const hashed = await bcrypt.hash(password, 10)
    ;(mockUsersService.findUserByUsername as jest.Mock).mockResolvedValue({
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
  })

  it('should reject login when the user is inactive', async () => {
    const password = 'Password1!'
    const hashed = await bcrypt.hash(password, 10)
    ;(mockUsersService.findUserByUsername as jest.Mock).mockResolvedValue({
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
      activationToken: 'token123',
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
      activationToken: 'token123',
      activationExpiresAt: new Date(Date.now() - 1000 * 60 * 60),
      isActive: false,
    })

    await expect(service.activate('PAT-ABC', 'token123')).rejects.toThrow()
    expect(repo.update).not.toHaveBeenCalled()
  })
})
