import { IsNotEmpty, IsString } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

/**
 * Request body for the refresh and logout endpoints.
 */
export class RefreshTokenDto {
  @ApiProperty({
    description: 'A valid refresh token previously issued by the service',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  @IsNotEmpty()
  refreshToken: string
}
