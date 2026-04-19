import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { UsersService } from '@/users/users.service'
import { User } from '@/users/entities/user.entity'
import * as bcrypt from 'bcrypt'
import { CreateUserDto } from '@/users/dto/create-user.dto'
import { LoginUserDto } from './dto/login-user.dto'

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async signup(createUserDto: CreateUserDto) {
    try {
      const hashedPassword = this.hashPassword(createUserDto.contact.password)
      const newUser: CreateUserDto = {
        ...createUserDto,
      }
      newUser.contact.password = hashedPassword

      return await this.usersService.create(newUser)
    } catch (error) {
      console.error(error)
      if (error instanceof Error) {
        throw error
      }
      throw new InternalServerErrorException('Failed to signup user')
    }
  }

  async login(loginUser: LoginUserDto) {
    const { username, password } = loginUser

    try {
      const user = await this.usersService.findUserByUsername(username)

      if (user) {
        if (!(await this.verifyPassword(user, password, user?.password))) {
          throw new UnauthorizedException('Invalid credentials')
        }

        if (!user.isActive) {
          throw new ForbiddenException('Account not activated')
        }

        // Generate JWT Token
        const { accessToken, refreshToken } = this.generateJWTToken(user)
        const { password: _password, ...userResponse } = user
        void _password

        return {
          data: userResponse,
          meta: {
            accessToken,
            refreshToken,
          },
        }
      }

      throw new UnauthorizedException('Signup to create user')
    } catch (error) {
      console.error(error)
      if (error instanceof Error) {
        throw error
      }
      throw new InternalServerErrorException('Failed to login user')
    }
  }

  private hashPassword(password: string) {
    return bcrypt.hashSync(password, 10)
  }

  private async verifyPassword(
    user: User,
    password: string,
    hashedPassword: string,
  ) {
    return user && (await bcrypt.compare(password, hashedPassword))
  }

  private generateJWTToken(user: User) {
    const payload = {
      sub: user?.id,
      email: user?.email,
      phoneNumber: user?.phoneNumber,
      healthId: user?.healthId,
      roles: user?.role,
    }

    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' })
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' })

    return { accessToken, refreshToken }
  }
}
