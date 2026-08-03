import { IsString, Matches } from 'class-validator'
import { Transform } from 'class-transformer'

export class ActivateUserDto {
  @IsString()
  @Transform(({ value }: { value: string }) => value?.toUpperCase()?.trim())
  @Matches(/^(PAT|HOS|DOC)-[A-Z0-9]{8,16}$/, {
    message: 'healthId must be a valid prefixed Health ID',
  })
  healthId: string

  @IsString()
  @Transform(({ value }: { value: string }) => value?.trim())
  token: string
}
