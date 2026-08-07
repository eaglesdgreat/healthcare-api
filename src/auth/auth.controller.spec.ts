import { Test, TestingModule } from '@nestjs/testing'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'

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
    const dto = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'x@example.com',
      phoneNumber: '+1234567890',
      role: 'PATIENT',
      password: 'Abcd1234!',
    }
    const res = await controller.signup(dto as any)
    expect(mockAuthService.signup).toHaveBeenCalledWith(dto)
    expect(res).toEqual({ message: 'ok' })
  })

  it('should call login on authService', async () => {
    mockAuthService.login.mockResolvedValue({ data: {}, meta: {} })
    const dto = { username: 'john', password: 'Abcd1234!' }
    const res = await controller.login(dto as any)
    expect(mockAuthService.login).toHaveBeenCalledWith(dto)
    expect(res).toEqual({ data: {}, meta: {} })
  })

  it('should call activate on authService', async () => {
    mockAuthService.activate.mockResolvedValue({ message: 'activated' })
    const body = { healthId: 'PAT-ABC', token: 'tok' }
    const res = await controller.activate(body as any)
    expect(mockAuthService.activate).toHaveBeenCalledWith(
      body.healthId,
      body.token,
    )
    expect(res).toEqual({ message: 'activated' })
  })
})
