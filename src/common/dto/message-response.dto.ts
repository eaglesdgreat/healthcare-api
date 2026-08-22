import { ApiProperty } from '@nestjs/swagger'

/**
 * Generic success response returned by endpoints that only report an outcome.
 */
export class MessageResponseDto {
  @ApiProperty({
    description: 'Human-readable summary of the outcome of the operation',
    example: 'Operation completed successfully',
  })
  message: string
}
