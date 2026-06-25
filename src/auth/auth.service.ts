import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { UsersService } from '@/users/users.service'
import { User } from '@/users/entities/user.entity'
import * as bcrypt from 'bcrypt'
import { LoginUserDto } from './dto/login-user.dto'
import { RegisterUserDto } from './dto/register-user.dto'
import { Repository } from 'typeorm'
import { InjectRepository } from '@nestjs/typeorm'
@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private jwtService: JwtService,

    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async signup(registerDto: RegisterUserDto): Promise<{ message: string }> {
    const { email, phoneNumber, password, firstName, lastName, role } =
      registerDto

    // 1. Verify uniqueness using the OR logic path
    const existingUser = await this.usersRepository.findOne({
      where: [{ email }, { phoneNumber }],
    })

    if (existingUser) {
      if (existingUser.email === email) {
        throw new ConflictException(
          'A user with this email address already exists',
        )
      }
      if (existingUser.phoneNumber === phoneNumber) {
        throw new ConflictException('This phone number is already registered')
      }
    }

    try {
      // 2. Hash Password securely
      const salt = await bcrypt.genSalt(12)
      const passwordHash = await bcrypt.hash(password, salt)

      // 3. Generate tracking and validation metadata
      const healthId = this.usersService.generateHealthId(role)
      // const activationToken = Math.random().toString(36).substring(2, 15) // or crypto.randomBytes
      const activationExpiresAt = new Date()
      activationExpiresAt.setHours(activationExpiresAt.getHours() + 24) // 24-hour expiration window

      // 4. Instantiate the user entity inside database context boundaries
      const newUser = this.usersRepository.create({
        firstName,
        lastName,
        email,
        phoneNumber,
        password: passwordHash,
        role,
        healthId,
        isActive: false, // Remains false until notification confirmation loop handles it
      })

      // Ideally update schema definition later to allow NULL values on gender/DOB fields
      // if you don't want to enforce these placeholders.

      await this.usersRepository.save(newUser)

      // 5. TODO: Emit 'user.pending_activation' event for ms-notification-service
      // this.eventEmitter.emit('user.pending_activation', { email, activationToken, healthId })

      return {
        message:
          'Registration successful. Please check your contact method to activate your health profile.',
      }
    } catch (error) {
      console.error(error)
      if (error instanceof Error) {
        throw error
      }
      throw new InternalServerErrorException(
        'An error occurred during account provisioning',
      )
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
