import { ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { AuthGuard } from './auth.guards'
import { AuthTokenPayload } from './auth.types'

describe('AuthGuard', () => {
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) }
  const configService = { get: jest.fn().mockReturnValue('test-secret') }
  const jwtService = { verifyAsync: jest.fn() }
  let guard: AuthGuard

  const makeContext = (request: {
    headers: Record<string, string>
    user?: unknown
  }) =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({ getRequest: () => request }),
    }) as unknown as ExecutionContext

  beforeEach(() => {
    jest.clearAllMocks()
    guard = new AuthGuard(
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
      reflector as unknown as Reflector,
    )
  })

  it('rejects a refresh token at protected endpoints', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'user-id',
      roles: 'PATIENT',
      tokenType: 'refresh',
    })
    const request: {
      headers: Record<string, string>
      user?: AuthTokenPayload
    } = { headers: { authorization: 'Bearer signed-token' } }

    await expect(guard.canActivate(makeContext(request))).rejects.toThrow(
      'Unauthorized',
    )
    expect(request.user).toBeUndefined()
  })

  it('attaches a verified access-token payload', async () => {
    const payload = {
      sub: 'user-id',
      roles: 'PATIENT',
      tokenType: 'access' as const,
    }
    jwtService.verifyAsync.mockResolvedValue(payload)
    const request: {
      headers: Record<string, string>
      user?: AuthTokenPayload
    } = { headers: { authorization: 'Bearer signed-token' } }

    await expect(guard.canActivate(makeContext(request))).resolves.toBe(true)
    expect(request.user).toEqual(payload)
  })
})
