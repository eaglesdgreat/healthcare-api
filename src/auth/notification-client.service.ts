import { createCipheriv, createHash, randomBytes } from 'crypto'
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

interface ActivationNotification {
  userId: string
  email: string
  activationToken: string
  expiresAt: string
  requestId?: string
}

@Injectable()
export class NotificationClientService implements OnModuleInit {
  private readonly logger = new Logger(NotificationClientService.name)

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    if (this.config.get<string>('NODE_ENV') === 'production') {
      this.getConfiguration()
    }
  }

  async sendActivation(
    notification: ActivationNotification,
  ): Promise<{ id: string; status: string }> {
    const { baseUrl, apiKey, encryptionKey } = this.getConfiguration()
    const base = baseUrl.replace(/\/+$/, '')
    const commonHeaders = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      ...(notification.requestId
        ? { 'x-request-id': notification.requestId }
        : {}),
    }

    try {
      const channelResponse = await fetch(
        `${base}/api/notifications/channels`,
        {
          method: 'POST',
          headers: commonHeaders,
          body: JSON.stringify({
            userId: notification.userId,
            channel: 'email',
            address: notification.email,
          }),
          signal: AbortSignal.timeout(5000),
        },
      )
      if (!channelResponse.ok) {
        throw new Error(
          `Notification channel registration returned HTTP ${channelResponse.status}`,
        )
      }

      const idempotencyKey = `auth-activation-${createHash('sha256')
        .update(notification.activationToken)
        .digest('hex')}`
      const response = await fetch(`${base}/api/notifications`, {
        method: 'POST',
        headers: {
          ...commonHeaders,
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          userId: notification.userId,
          channel: 'email',
          templateId: 'auth-account-activation',
          payload: this.encrypt(
            {
              userId: notification.userId,
              activationToken: notification.activationToken,
              expiresAt: notification.expiresAt,
            },
            encryptionKey,
          ),
          legalBasis: 'legal_obligation',
        }),
        signal: AbortSignal.timeout(5000),
      })
      if (!response.ok) {
        throw new Error(`Notification enqueue returned HTTP ${response.status}`)
      }

      const result: unknown = await response.json()
      if (
        !result ||
        typeof result !== 'object' ||
        !('id' in result) ||
        typeof result.id !== 'string' ||
        !('status' in result) ||
        typeof result.status !== 'string'
      ) {
        throw new Error('Notification service returned an invalid response')
      }
      return { id: result.id, status: result.status }
    } catch (error) {
      this.logger.error(
        {
          event: 'auth.notification.enqueue.failed',
          userId: notification.userId,
          requestId: notification.requestId,
          errorType: error instanceof Error ? error.name : 'unknown',
        },
        'Could not enqueue account activation notification',
      )
      throw new InternalServerErrorException(
        'Could not enqueue account activation notification',
      )
    }
  }

  private getConfiguration(): {
    baseUrl: string
    apiKey: string
    encryptionKey: Buffer
  } {
    const baseUrl = this.config.get<string>('NOTIFICATION_SERVICE_URL')
    const apiKey = this.config.get<string>('NOTIFICATION_SERVICE_API_KEY')
    const rawEncryptionKey = this.config.get<string>(
      'NOTIFICATION_PAYLOAD_ENCRYPTION_KEY',
    )
    if (!baseUrl || !apiKey || !rawEncryptionKey) {
      throw new InternalServerErrorException(
        'Notification service integration is not configured',
      )
    }

    let url: URL
    try {
      url = new URL(baseUrl)
    } catch {
      throw new InternalServerErrorException(
        'Notification service URL is invalid',
      )
    }
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (this.config.get<string>('NODE_ENV') === 'production' &&
        url.protocol !== 'https:')
    ) {
      throw new InternalServerErrorException(
        'Notification service URL must be a credential-free HTTPS URL in production',
      )
    }

    const encryptionKey = Buffer.from(rawEncryptionKey, 'base64')
    if (encryptionKey.length !== 32) {
      throw new InternalServerErrorException(
        'Notification payload encryption key must be 32 bytes encoded as base64',
      )
    }
    if (Buffer.byteLength(apiKey) < 32) {
      throw new InternalServerErrorException(
        'Notification service API key must be at least 32 bytes',
      )
    }

    return { baseUrl, apiKey, encryptionKey }
  }

  private encrypt(
    payload: {
      userId: string
      activationToken: string
      expiresAt: string
    },
    key: Buffer,
  ): Record<string, string | boolean> {
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', key, iv)
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(payload), 'utf8'),
      cipher.final(),
    ])
    return {
      encrypted: true,
      algorithm: 'aes-256-gcm',
      iv: iv.toString('base64'),
      authTag: cipher.getAuthTag().toString('base64'),
      ciphertext: encrypted.toString('base64'),
    }
  }
}
