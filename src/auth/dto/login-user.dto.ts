import {
  IsString,
  MinLength,
  Matches,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator'
import { Transform } from 'class-transformer'

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
  @IsString()
  @Transform(({ value }: { value: string }) => value?.toUpperCase()?.trim())
  @Validate(IsUsernameValidConstraint)
  username: string

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
