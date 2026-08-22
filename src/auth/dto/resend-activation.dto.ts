import { IsString, Matches } from 'class-validator'
import { Transform } from 'class-transformer'
import { ApiProperty } from '@nestjs/swagger'

export class ResendActivationDto {
  @ApiProperty({
    description:
      'The email address or phone number associated with the account whose activation code should be resent.',
    example: 'john.doe@example.com',
    type: String,
  })
  @IsString()
  @Transform(({ value }: { value: string }) => {
    if (typeof value !== 'string') return value

    const trimmed = value.trim()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    if (emailRegex.test(trimmed)) return trimmed.toLowerCase()
    // Pass through phone numbers (and any other identifiers) trimmed.
    return trimmed
  })
  @Matches(/^(\+?[0-9]{10,15}|[^\s@]+@[^\s@]+\.[^\s@]+)$/, {
    message: 'identifier must be a valid email or phone number',
  })
  identifier: string
}
