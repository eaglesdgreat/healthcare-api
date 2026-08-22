import { IsString, Matches } from 'class-validator'
import { Transform } from 'class-transformer'
import { ApiProperty } from '@nestjs/swagger'

export class ActivateUserDto {
  @ApiProperty({
    description:
      'The prefixed Health ID of the account to activate. Format: PAT/HOS/DOC followed by 8-16 uppercase alphanumeric characters.',
    example: 'PAT-ABCD1234',
    pattern: '^(PAT|HOS|DOC)-[A-Z0-9]{8,16}$',
    type: String,
  })
  @IsString()
  @Transform(({ value }: { value: string }) => value?.toUpperCase()?.trim())
  @Matches(/^(PAT|HOS|DOC)-[A-Z0-9]{8,16}$/, {
    message: 'healthId must be a valid prefixed Health ID',
  })
  healthId: string

  @ApiProperty({
    description:
      'The activation token sent to the registered email/phone during signup or resend-activation.',
    example: 'a1b2c3d4e5f6a7b8',
    type: String,
  })
  @IsString()
  @Transform(({ value }: { value: string }) => value?.trim())
  token: string
}
