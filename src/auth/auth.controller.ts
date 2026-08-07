import { Controller, Post, Body } from '@nestjs/common'
import { AuthService } from './auth.service'
import { LoginUserDto, RegisterUserDto } from './dto'
import { GoogleSignInDto } from './dto/google-signin.dto'
import { Public } from './auth.decorator'

@Public()
@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  async signup(@Body() registerDto: RegisterUserDto) {
    return await this.authService.signup(registerDto)
  }

  @Post('login')
  async login(@Body() loginUserDto: LoginUserDto) {
    return await this.authService.login(loginUserDto)
  }

  @Post('refresh')
  async refresh(@Body('refreshToken') refreshToken: string) {
    return await this.authService.refresh(refreshToken)
  }

  @Post('logout')
  async logout(@Body('refreshToken') refreshToken: string) {
    return await this.authService.logout(refreshToken)
  }

  @Post('google')
  async googleSignIn(@Body() googleSignInDto: GoogleSignInDto) {
    return await this.authService.googleSignIn(googleSignInDto)
  }

  @Post('activate')
  async activate(@Body() body: { healthId: string; token: string }) {
    return await this.authService.activate(body.healthId, body.token)
  }
}
