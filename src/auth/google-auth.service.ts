import { Injectable, InternalServerErrorException } from '@nestjs/common'
import { OAuth2Client, TokenPayload } from 'google-auth-library'

@Injectable()
export class GoogleAuthService {
  private readonly client: OAuth2Client

  constructor() {
    const clientId = process.env.GOOGLE_CLIENT_ID
    this.client = new OAuth2Client(clientId)
  }

  async verifyIdToken(idToken: string): Promise<TokenPayload> {
    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      })
      const payload = ticket.getPayload()
      if (!payload) {
        throw new InternalServerErrorException(
          'Google token verification failed',
        )
      }
      return payload
    } catch {
      throw new InternalServerErrorException('Failed to verify Google token')
    }
  }
}
