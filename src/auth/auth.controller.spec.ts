import { Test, TestingModule } from '@nestjs/testing'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import {
  MOCK,
  mockRegisterUserDto,
  mockLoginUserDto,
  mockResendActivationDto,
} from '@/common/test/mock-data'

describe('AuthController', () => {
  let controller: AuthController

  const mockAuthService = {
    signup: jest.fn(),
    login: jest.fn(),
    activate: jest.fn(),
    resendActivation: jest.fn(),
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
    const res = await controller.signup(mockRegisterUserDto)
    expect(mockAuthService.signup).toHaveBeenCalledWith(mockRegisterUserDto)
    expect(res).toEqual({ message: 'ok' })
  })

  it('should call login on authService', async () => {
    mockAuthService.login.mockResolvedValue({ data: {}, meta: {} })
    const res = await controller.login(mockLoginUserDto)
    expect(mockAuthService.login).toHaveBeenCalledWith(mockLoginUserDto)
    expect(res).toEqual({ data: {}, meta: {} })
  })

  it('should call activate on authService', async () => {
    mockAuthService.activate.mockResolvedValue({ message: 'activated' })
    const body: { healthId: string; token: string } = {
      healthId: MOCK.healthId.patient,
      token: MOCK.activationToken,
    }
    const res = await controller.activate(body)
    expect(mockAuthService.activate).toHaveBeenCalledWith(
      body.healthId,
      body.token,
    )
    expect(res).toEqual({ message: 'activated' })
  })

  it('should call resendActivation on authService', async () => {
    mockAuthService.resendActivation.mockResolvedValue({
      message: 'A new activation code has been sent',
    })
    const res = await controller.resendActivation(mockResendActivationDto)
    expect(mockAuthService.resendActivation).toHaveBeenCalledWith(
      mockResendActivationDto,
    )
    expect(res).toEqual({ message: 'A new activation code has been sent' })
  })
})
