import {
  Controller,
  Get,
  // Query,
  Post,
  // Body,
  Put,
  // Param,
  Delete,
} from '@nestjs/common';

@Controller('users')
export class UserController {
  @Post()
  create() {
    return 'This action adds a new user';
  }

  @Get()
  findAll() {
    return 'This action returns all users';
  }

  @Put(':id')
  update() {
    return 'This action updates a user';
  }

  @Delete(':id')
  delete() {
    return 'This action deletes a user';
  }
}
