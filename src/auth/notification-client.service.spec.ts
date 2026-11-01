import { ConfigService } from '@nestjs/config'
import { Logger } from '@nestjs/common'
import { createDecipheriv } from 'crypto'
import { NotificationClientService } from './notification-client.service'

describe('NotificationClientService', () => {
  const encryptionKey = Buffer.alloc(32, 7)
  const configValues: Record<string, string> = {
    NOTIFICATION_SERVICE_URL: 'https://notifications.example.test',
    NOTIFICATION_SERVICE_API_KEY: 'a'.repeat(40),
    NOTIFICATION_PAYLOAD_ENCRYPTION_KEY: encryptionKey.toString('base64'),
    NODE_ENV: 'test',
  }
  const config = {
    get: (name: string) => configValues[name],
  } as ConfigService
  const defaults = { ...configValues }
  const originalFetch = global.fetch
  let service: NotificationClientService
  let errorLogSpy: jest.SpiedFunction<typeof Logger.prototype.error>

  beforeEach(() => {
    Object.assign(configValues, defaults)
    errorLogSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined)
    service = new NotificationClientService(config)
  })

  afterEach(() => {
    global.fetch = originalFetch
    jest.restoreAllMocks()
  })

  it('registers email and queues an encrypted, idempotent activation notice', async () => {
    const fetchMock: jest.MockedFunction<typeof fetch> = jest.fn()
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        Response.json({ id: 'ntf_123', status: 'queued' }, { status: 202 }),
      )
    global.fetch = fetchMock

    const result = await service.sendActivation({
      userId: 'user-123',
      email: 'person@example.test',
      activationToken: 'b'.repeat(64),
      expiresAt: '2026-07-01T10:00:00.000Z',
      requestId: 'request-123',
    })

    expect(result).toEqual({ id: 'ntf_123', status: 'queued' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [channelUrl, channelRequest] = fetchMock.mock.calls[0]
    expect(channelUrl).toBe(
      'https://notifications.example.test/api/notifications/channels',
    )
    expect(channelRequest?.headers).toMatchObject({
      'x-api-key': 'a'.repeat(40),
      'x-request-id': 'request-123',
    })
    if (typeof channelRequest?.body !== 'string') {
      throw new Error('Expected channel request body to be JSON')
    }
    expect(JSON.parse(channelRequest.body)).toEqual({
      userId: 'user-123',
      channel: 'email',
      address: 'person@example.test',
    })

    const [notificationUrl, notificationRequest] = fetchMock.mock.calls[1]
    expect(notificationUrl).toBe(
      'https://notifications.example.test/api/notifications',
    )
    if (typeof notificationRequest?.body !== 'string') {
      throw new Error('Expected notification request body to be JSON')
    }
    const requestBody = JSON.parse(notificationRequest.body) as {
      payload: {
        encrypted: boolean
        algorithm: string
        iv: string
        authTag: string
        ciphertext: string
      }
    }
    expect(requestBody.payload.encrypted).toBe(true)
    expect(JSON.stringify(requestBody)).not.toContain('b'.repeat(64))
    const decipher = createDecipheriv(
      'aes-256-gcm',
      encryptionKey,
      Buffer.from(requestBody.payload.iv, 'base64'),
    )
    decipher.setAuthTag(Buffer.from(requestBody.payload.authTag, 'base64'))
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(requestBody.payload.ciphertext, 'base64')),
      decipher.final(),
    ]).toString('utf8')
    expect(JSON.parse(plaintext)).toEqual({
      userId: 'user-123',
      activationToken: 'b'.repeat(64),
      expiresAt: '2026-07-01T10:00:00.000Z',
    })
    expect(notificationRequest?.headers).toHaveProperty(
      'Idempotency-Key',
      expect.stringMatching(/^auth-activation-[a-f0-9]{64}$/),
    )
    expect(notificationRequest?.signal).toBeInstanceOf(AbortSignal)
  })

  it('fails with an explicit service error for failed enqueue responses', async () => {
    const fetchMock: jest.MockedFunction<typeof fetch> = jest.fn()
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
    global.fetch = fetchMock

    const token = 'b'.repeat(64)
    await expect(
      service.sendActivation({
        userId: 'user-123',
        email: 'person@example.test',
        activationToken: token,
        expiresAt: '2026-07-01T10:00:00.000Z',
      }),
    ).rejects.toThrow('Could not enqueue account activation notification')
    expect(errorLogSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'auth.notification.enqueue.failed',
        userId: 'user-123',
        errorType: 'Error',
      }),
      'Could not enqueue account activation notification',
    )
    expect(JSON.stringify(errorLogSpy.mock.calls)).not.toContain(token)
  })

  it('rejects insecure production endpoints and weak service keys', async () => {
    configValues.NODE_ENV = 'production'
    configValues.NOTIFICATION_SERVICE_URL = 'http://notifications.example.test'
    await expect(
      service.sendActivation({
        userId: 'user-123',
        email: 'person@example.test',
        activationToken: 'b'.repeat(64),
        expiresAt: '2026-07-01T10:00:00.000Z',
      }),
    ).rejects.toThrow(
      'Notification service URL must be a credential-free HTTPS URL in production',
    )

    configValues.NODE_ENV = 'test'
    configValues.NOTIFICATION_SERVICE_URL = 'https://notifications.example.test'
    configValues.NOTIFICATION_SERVICE_API_KEY = 'weak'
    await expect(
      service.sendActivation({
        userId: 'user-123',
        email: 'person@example.test',
        activationToken: 'b'.repeat(64),
        expiresAt: '2026-07-01T10:00:00.000Z',
      }),
    ).rejects.toThrow('Notification service API key must be at least 32 bytes')
  })
})
