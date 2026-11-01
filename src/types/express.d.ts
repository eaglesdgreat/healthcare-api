import { AuthTokenPayload } from '@/auth/auth.types'

declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload
    }
  }
}

export {}
