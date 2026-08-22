import {
  IsString,
  MinLength,
  Matches,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator'
import { Transform } from 'class-transformer'
import { ApiProperty } from '@nestjs/swagger'

@ValidatorConstraint({ name: 'isUsernameValid', async: false })
export class IsUsernameValidConstraint implements ValidatorConstraintInterface {
  validate(value: string) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const phoneRegex = /^\+?[0-9]{10,15}$/ // Fits Nigerian and International formats
    const healthIdRegex = /^(PAT|HOS|DOC)-[A-Z0-9]{8,12}$/

    // Return true if it matches ANY of the patterns
    return (
      emailRegex.test(value) ||
      phoneRegex.test(value) ||
      healthIdRegex.test(value)
    )
  }

  defaultMessage() {
    return 'Username must be a valid Email, Phone Number, or Health ID'
  }
}

export class LoginUserDto {
  @ApiProperty({
    description:
      'The login identifier. Must be one of: a valid email address, an international phone number, or a Health ID (e.g. PAT-XXXXXXXX, HOS-XXXXXXXX, DOC-XXXXXXXX).',
    example: 'john.doe@example.com',
    type: String,
  })
  @IsString()
  @Transform(({ value }: { value: string }) => {
    if (typeof value !== 'string') return value

    const trimmed = value.trim()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const phoneRegex = /^\+?[0-9]{10,15}$/
    const healthIdRegex = /^(PAT|HOS|DOC)-[A-Z0-9]{8,12}$/i

    if (emailRegex.test(trimmed)) return trimmed.toLowerCase()
    if (phoneRegex.test(trimmed)) return trimmed
    if (healthIdRegex.test(trimmed)) return trimmed.toUpperCase()

    // default: return trimmed
    return trimmed
  })
  @Validate(IsUsernameValidConstraint)
  username: string

  @ApiProperty({
    description:
      'Password with at least 8 characters containing an uppercase letter, a lowercase letter, a number, and a special character',
    example: 'MyStrongPass123!',
    minLength: 8,
    format: 'password',
    writeOnly: true,
    type: String,
  })
  @IsString({ message: 'Password must be a string' })
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
