import { ApiProperty } from '@nestjs/swagger'
import { User } from '@/users/entities/user.entity'

/**
 * Pagination metadata accompanying a paginated collection response.
 */
export class PaginationMetaDto {
  @ApiProperty({ description: 'Current page number (1-indexed)', example: 1 })
  page: number

  @ApiProperty({
    description: 'Number of records requested per page',
    example: 20,
  })
  limit: number

  @ApiProperty({
    description: 'Total number of records matching the applied filters',
    example: 100,
  })
  total: number

  @ApiProperty({ description: 'Total number of available pages', example: 5 })
  totalPages: number

  @ApiProperty({
    description: 'Whether there is a next page beyond the current one',
    example: true,
  })
  hasNextPage: boolean

  @ApiProperty({
    description: 'Whether there is a previous page before the current one',
    example: false,
  })
  hasPreviousPage: boolean
}

/**
 * Paginated response for the user list endpoint.
 */
export class PaginatedUsersResponseDto {
  @ApiProperty({
    description: 'Users for the current page',
    type: () => User,
    isArray: true,
  })
  data: User[]

  @ApiProperty({
    description: 'Pagination metadata',
    type: () => PaginationMetaDto,
  })
  meta: PaginationMetaDto
}
