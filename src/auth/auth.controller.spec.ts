import { Test, TestingModule } from '@nestjs/testing'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { LoginUserDto, RegisterUserDto } from './dto'
import { UserRole } from '@/users/entities/user.entity'

describe('AuthController', () => {
  let controller: AuthController

  const mockAuthService = {
    signup: jest.fn(),
    login: jest.fn(),
    activate: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile()

    controller = module.get<AuthController>(AuthController)
  })

  afterEach(() => jest.resetAllMocks())

  it('should call signup on authService', async () => {
    mockAuthService.signup.mockResolvedValue({ message: 'ok' })
    const dto: RegisterUserDto = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'x@example.com',
      phoneNumber: '+12345678901',
      role: UserRole.PATIENT,
      password: 'Abcd1234!',
    }
    const res = await controller.signup(dto)
    expect(mockAuthService.signup).toHaveBeenCalledWith(dto)
    expect(res).toEqual({ message: 'ok' })
  })

  it('should call login on authService', async () => {
    mockAuthService.login.mockResolvedValue({ data: {}, meta: {} })
    const dto: LoginUserDto = {
      username: 'john@example.com',
      password: 'Abcd1234!',
    }
    const res = await controller.login(dto)
    expect(mockAuthService.login).toHaveBeenCalledWith(dto)
    expect(res).toEqual({ data: {}, meta: {} })
  })

  it('should call activate on authService', async () => {
    mockAuthService.activate.mockResolvedValue({ message: 'activated' })
    const body: { healthId: string; token: string } = {
      healthId: 'PAT-ABC',
      token: 'tok',
    }
    const res = await controller.activate(body)
    expect(mockAuthService.activate).toHaveBeenCalledWith(
      body.healthId,
      body.token,
    )
    expect(res).toEqual({ message: 'activated' })
  })
})
