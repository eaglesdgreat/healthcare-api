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
import { UsersService } from './users.service'
import { PaginateUsersDto, SingleUserDTO } from './dto'
import { User } from './entities/user.entity'

@Controller('users')
export class UserController {
  constructor(private readonly usersService: UsersService) {}

  // GET
  @Get()
  findAll(@Query(ValidationPipe) paginateDto: PaginateUsersDto) {
    return this.usersService.findAll(paginateDto)
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query(ValidationPipe) filterDto: SingleUserDTO,
  ) {
    return this.usersService.findOne(id, filterDto)
  }

  // POST
  @Post('restore/:id')
  @HttpCode(HttpStatus.OK)
  restore(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string; user: User }> {
    return this.usersService.restore(id)
  }

  @Post('bulk-soft-delete')
  @HttpCode(HttpStatus.OK)
  async bulkSoftDelete(
    @Body('ids') ids: string[],
  ): Promise<{ message: string; deletedCount: number }> {
    return await this.usersService.bulkSoftDelete(ids)
  }

  @Post('bulk-restore')
  @HttpCode(HttpStatus.OK)
  async bulkRestore(
    @Body('ids') ids: string[],
  ): Promise<{ message: string; restoredCount: number }> {
    return await this.usersService.bulkRestore(ids)
  }

  // PUT
  @Put(':id')
  update() {
    return 'Feature coming soon...'
  }

  // DELETE
  @Delete('soft/:id')
  @HttpCode(HttpStatus.OK)
  softDelete(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string; user: User }> {
    return this.usersService.softDelete(id)
  }

  @Delete('permanent/:id')
  @HttpCode(HttpStatus.OK)
  permanentDelete(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string; user: User }> {
    return this.permanentDelete(id)
  }
}
