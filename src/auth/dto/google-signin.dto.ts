import { IsEnum, IsString, IsOptional } from 'class-validator'
import { UserRole } from '@/users/entities/user.entity'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class GoogleSignInDto {
  @ApiProperty({
    description:
      'The Google ID token (JWT) obtained from the Google Sign-In flow in the client. The token must contain a verified email.',
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6Ij... (Google issued JWT idToken)',
    type: String,
  })
  @IsString()
  idToken: string

  @ApiPropertyOptional({
    description:
      'Optional role to assign if the Google account does not already exist. Defaults to PATIENT when omitted.',
    enum: UserRole,
    enumName: 'UserRole',
    example: 'PATIENT',
    type: String,
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole
}
