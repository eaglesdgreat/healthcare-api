import {
  Controller,
  Get,
  // Query,
  Post,
  // Body,
  // Put,
  // Param,
  // Delete,
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
}
