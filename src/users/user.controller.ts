import {
  Controller,
  Get,
  Query,
  Post,
  Body,
  Put,
  Param,
  Delete,
  ValidationPipe,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common'
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiUnauthorizedResponse,
  ApiInternalServerErrorResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger'
import { UsersService } from './users.service'
import { PaginateUsersDto, SingleUserDTO, BulkIdsDto } from './dto'
import { User } from './entities/user.entity'
import {
  MessageResponseDto,
  PaginatedUsersResponseDto,
  DeleteUserResponseDto,
  BulkDeleteResponseDto,
  BulkRestoreResponseDto,
} from '@/common/dto'

@ApiTags('users')
@ApiBearerAuth('access-token')
@Controller('users')
export class UserController {
  constructor(private readonly usersService: UsersService) {}

  // GET
  @Get()
  @ApiOperation({
    summary: 'List users',
    description:
      'Returns a paginated list of users. Supports pagination, free-text search, and filtering by role, activation status, and soft-deleted state.',
  })
  @ApiOkResponse({
    description: 'Paginated list of users.',
    type: PaginatedUsersResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid bearer token.',
  })
  @ApiBadRequestResponse({ description: 'Invalid query parameters.' })
  @ApiInternalServerErrorResponse({ description: 'Failed to fetch users.' })
  findAll(@Query(ValidationPipe) paginateDto: PaginateUsersDto) {
    return this.usersService.findAll(paginateDto)
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a single user',
    description:
      'Returns a user by UUID. Optionally filters by activation status or includes soft-deleted records via query parameters.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID of the user to retrieve',
    example: 'd0f1c1c1-0000-4000-8000-000000000000',
    format: 'uuid',
  })
  @ApiOkResponse({
    description: 'User found.',
    type: User,
  })
  @ApiNotFoundResponse({ description: 'User not found.' })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid bearer token.',
  })
  @ApiBadRequestResponse({
    description: 'Invalid id or invalid query parameters.',
  })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query(ValidationPipe) filterDto: SingleUserDTO,
  ) {
    return this.usersService.findOne(id, filterDto)
  }

  // POST
  @Post('restore/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Restore a soft-deleted user',
    description:
      'Restores a previously soft-deleted user, clearing its deletion timestamp.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID of the user to restore',
    example: 'd0f1c1c1-0000-4000-8000-000000000000',
    format: 'uuid',
  })
  @ApiOkResponse({
    description: 'User restored.',
    type: DeleteUserResponseDto,
  })
  @ApiNotFoundResponse({ description: 'User not found.' })
  @ApiConflictResponse({ description: 'User is not currently deleted.' })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid bearer token.',
  })
  @ApiInternalServerErrorResponse({ description: 'Failed to restore user.' })
  restore(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string; user: User }> {
    return this.usersService.restore(id)
  }

  @Post('bulk-soft-delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Soft delete multiple users',
    description:
      'Soft deletes the users whose UUIDs are provided in the request body.',
  })
  @ApiBody({ type: BulkIdsDto })
  @ApiOkResponse({
    description: 'Bulk soft delete result.',
    type: BulkDeleteResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid bearer token.',
  })
  @ApiBadRequestResponse({ description: 'Invalid ids request body.' })
  @ApiInternalServerErrorResponse({
    description: 'Failed to bulk soft delete users.',
  })
  async bulkSoftDelete(
    @Body('ids') ids: string[],
  ): Promise<{ message: string; deletedCount: number }> {
    return await this.usersService.bulkSoftDelete(ids)
  }

  @Post('bulk-restore')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Restore multiple soft-deleted users',
    description:
      'Restores the soft-deleted users whose UUIDs are provided in the request body.',
  })
  @ApiBody({ type: BulkIdsDto })
  @ApiOkResponse({
    description: 'Bulk restore result.',
    type: BulkRestoreResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid bearer token.',
  })
  @ApiBadRequestResponse({ description: 'Invalid ids request body.' })
  @ApiInternalServerErrorResponse({
    description: 'Failed to bulk restore users.',
  })
  async bulkRestore(
    @Body('ids') ids: string[],
  ): Promise<{ message: string; restoredCount: number }> {
    return await this.usersService.bulkRestore(ids)
  }

  // PUT
  @Put(':id')
  @ApiOperation({
    summary: 'Update a user',
    description:
      'Placeholder endpoint for user updates. Not yet implemented and always returns a static message.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID of the user to update',
    example: 'd0f1c1c1-0000-4000-8000-000000000000',
    format: 'uuid',
  })
  @ApiOkResponse({
    description: 'Placeholder response.',
    schema: { type: 'string', example: 'Feature coming soon...' },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid bearer token.',
  })
  update() {
    return 'Feature coming soon...'
  }

  // DELETE
  @Delete('soft/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Soft delete a user',
    description:
      'Soft deletes a user by UUID, setting its deletion timestamp without removing the record.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID of the user to soft delete',
    example: 'd0f1c1c1-0000-4000-8000-000000000000',
    format: 'uuid',
  })
  @ApiOkResponse({
    description: 'User soft deleted.',
    type: DeleteUserResponseDto,
  })
  @ApiNotFoundResponse({ description: 'User not found.' })
  @ApiConflictResponse({ description: 'User is already deleted.' })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid bearer token.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Failed to soft delete user.',
  })
  softDelete(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string; user: User }> {
    return this.usersService.softDelete(id)
  }

  @Delete('permanent/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Permanently delete a user',
    description:
      'Permanently removes a user record from the database, including previously soft-deleted records.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID of the user to permanently delete',
    example: 'd0f1c1c1-0000-4000-8000-000000000000',
    format: 'uuid',
  })
  @ApiOkResponse({
    description: 'User permanently deleted.',
    type: MessageResponseDto,
  })
  @ApiNotFoundResponse({ description: 'User not found.' })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid bearer token.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Failed to permanently delete user.',
  })
  permanentDelete(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    return this.usersService.permanentDelete(id)
  }
}
