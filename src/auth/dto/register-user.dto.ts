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
import { ApiProperty } from '@nestjs/swagger'

export class RegisterUserDto {
  @ApiProperty({
    description: "The user's legal first name",
    example: 'John',
    minLength: 1,
    maxLength: 100,
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }: { value: string }) => value?.trim())
  firstName: string

  @ApiProperty({
    description: "The user's legal last name",
    example: 'Doe',
    minLength: 1,
    maxLength: 100,
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }: { value: string }) => value?.trim())
  lastName: string

  @ApiProperty({
    description: 'A valid email address used as the login identifier',
    example: 'john.doe@example.com',
    format: 'email',
    type: String,
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @Transform(({ value }: { value: string }) => value?.toLowerCase()?.trim())
  email: string

  @ApiProperty({
    description:
      'A valid international phone number (10-15 digits, optional leading +)',
    example: '+2348012345678',
    pattern: '^\\+?[0-9]{10,15}$',
    minLength: 10,
    maxLength: 16,
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?[0-9]{10,15}$/, {
    message: 'Please provide a valid phone number',
  })
  @Transform(({ value }: { value: string }) => value?.trim())
  phoneNumber: string

  @ApiProperty({
    description: 'The role to be assigned to the new account',
    enum: UserRole,
    enumName: 'UserRole',
    example: 'PATIENT',
    type: String,
  })
  @IsEnum(UserRole, { message: 'Role must be PATIENT, DOCTOR, or HOSPITAL' })
  role: UserRole

  @ApiProperty({
    description:
      'Password with at least 8 characters containing an uppercase letter, a lowercase letter, a number, and a special character',
    example: 'MyStrongPass123!',
    minLength: 8,
    format: 'password',
    writeOnly: true,
    type: String,
  })
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
