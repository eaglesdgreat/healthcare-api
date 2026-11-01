export interface AuthTokenPayload {
  sub: string
  healthId?: string
  roles: string
  tokenType: 'access' | 'refresh'
}
