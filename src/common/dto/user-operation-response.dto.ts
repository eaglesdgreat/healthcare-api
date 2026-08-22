import { ApiProperty } from '@nestjs/swagger'
import { User } from '@/users/entities/user.entity'

/**
 * Response returned when a single user is soft-deleted or restored.
 */
export class DeleteUserResponseDto {
  @ApiProperty({
    description: 'Summary of the delete/restore operation',
    example:
      'User with ID d0f1c1c1-0000-4000-8000-000000000000 has been soft deleted successfully',
  })
  message: string

  @ApiProperty({
    description: 'The affected user record',
    type: () => User,
  })
  user: User
}

/**
 * Response returned when multiple users are soft-deleted in bulk.
 */
export class BulkDeleteResponseDto {
  @ApiProperty({
    description: 'Summary of the bulk soft-delete operation',
    example: '5 users have been soft deleted successfully',
  })
  message: string

  @ApiProperty({
    description: 'Number of users affected',
    example: 5,
  })
  deletedCount: number
}

/**
 * Response returned when multiple users are restored in bulk.
 */
export class BulkRestoreResponseDto {
  @ApiProperty({
    description: 'Summary of the bulk restore operation',
    example: '5 users have been restored successfully',
  })
  message: string

  @ApiProperty({
    description: 'Number of users affected',
    example: 5,
  })
  restoredCount: number
}
