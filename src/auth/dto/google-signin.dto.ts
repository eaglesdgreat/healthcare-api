import { IsEnum, IsString, IsOptional } from 'class-validator'
import { UserRole } from '@/users/entities/user.entity'

export class GoogleSignInDto {
  @IsString()
  idToken: string

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole
}
