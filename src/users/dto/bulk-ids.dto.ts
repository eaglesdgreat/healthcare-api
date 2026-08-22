import { ApiProperty } from '@nestjs/swagger'

/**
 * Request body for the bulk soft-delete and bulk restore endpoints.
 */
export class BulkIdsDto {
  @ApiProperty({
    description: 'Array of user UUIDs to process in bulk',
    example: [
      'd0f1c1c1-0000-4000-8000-000000000000',
      'a1b2c3d4-0000-4000-8000-000000000000',
    ],
    type: String,
    isArray: true,
  })
  ids: string[]
}
