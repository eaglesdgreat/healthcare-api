import { Injectable, UnauthorizedException } from '@nestjs/common'
import { OAuth2Client, TokenPayload } from 'google-auth-library'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class GoogleAuthService {
  private client?: OAuth2Client

  constructor(private readonly configService: ConfigService) {}

  async verifyIdToken(idToken: string): Promise<TokenPayload> {
    const clientId = this.configService.getOrThrow<string>('GOOGLE_CLIENT_ID')
    const client = (this.client ??= new OAuth2Client(clientId))
    try {
      const ticket = await client.verifyIdToken({
        idToken,
        audience: clientId,
      })
      const payload = ticket.getPayload()
      if (!payload) {
        throw new UnauthorizedException('Invalid Google identity token')
      }
      return payload
    } catch {
      throw new UnauthorizedException('Invalid Google identity token')
    }
  }
}
