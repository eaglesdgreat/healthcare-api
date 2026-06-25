// src/auth/dto/register-user.dto.ts
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  Matches,
  MinLength,
} from 'class-validator'
import { Transform } from 'class-transformer'
import { UserRole } from '@/users/entities/user.entity'

export class RegisterUserDto {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }: { value: string }) => value?.trim())
  firstName: string

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }: { value: string }) => value?.trim())
  lastName: string

  @IsEmail({}, { message: 'Please provide a valid email address' })
  @Transform(({ value }: { value: string }) => value?.toLowerCase()?.trim())
  email: string

  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?[0-9]{10,15}$/, {
    message: 'Please provide a valid phone number',
  })
  @Transform(({ value }: { value: string }) => value?.trim())
  phoneNumber: string

  @IsEnum(UserRole, { message: 'Role must be PATIENT, DOCTOR, or HOSPITAL' })
  role: UserRole

  @IsString()
  @MinLength(8, { message: 'Security requires at least 8 characters' })
  @Matches(/[A-Z]/, {
    message: 'Password must contain at least one uppercase letter',
  })
  @Matches(/[a-z]/, {
    message: 'Password must contain at least one lowercase letter',
  })
  @Matches(/[0-9]/, { message: 'Password must contain at least one number' })
  @Matches(/[^A-Za-z0-9]/, {
    message: 'Password must contain at least one special character',
  })
  password: string
}
