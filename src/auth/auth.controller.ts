import { Controller, Post, Body } from '@nestjs/common'
import { AuthService } from './auth.service'
import { CreateUserDto } from '@/users/dto/create-user.dto'
import { LoginUserDto } from './dto/login-user.dto'
import { Public } from './auth.decorator'

@Public()
@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  async signup(@Body() createUserDto: CreateUserDto) {
    return await this.authService.signup(createUserDto)
  }

  @Post('login')
  async login(@Body() loginUserDto: LoginUserDto) {
    return await this.authService.login(loginUserDto)
  }
}
