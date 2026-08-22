import { ApiProperty } from '@nestjs/swagger'
import { User } from '@/users/entities/user.entity'

/**
 * A pair of JWTs issued on login and token rotation.
 */
export class TokenPairDto {
  @ApiProperty({
    description: 'Short-lived JWT access token (valid for 15 minutes)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string

  @ApiProperty({
    description: 'Long-lived JWT refresh token (valid for 7 days)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  refreshToken: string
}

/**
 * Response returned by the login and (existing-user) Google sign-in endpoints.
 */
export class LoginResponseDto {
  @ApiProperty({
    description: 'Authenticated user profile (password omitted)',
    type: () => User,
  })
  data: User

  @ApiProperty({
    description: 'Issued token pair',
    type: () => TokenPairDto,
  })
  meta: TokenPairDto
}
