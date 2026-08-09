import { Test, TestingModule } from '@nestjs/testing'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthModule } from './auth.module'
import { UsersModule } from '@/users/user.module'
import { AuthService } from './auth.service'
import { User } from '@/users/entities/user.entity'
import { RefreshToken } from './entities/refresh-token.entity'
import { EventBusService } from '@/common/event-bus.service'
import { Repository } from 'typeorm'
import { getRepositoryToken } from '@nestjs/typeorm'
import { UserRole } from '@/users/entities/user.entity'

describe('Auth Integration (mysql)', () => {
  let module: TestingModule
  let authService: AuthService
  let usersRepo: Repository<User>
  let eventBus: EventBusService

  beforeAll(async () => {
    // Integration tests run against the project's MySQL instance.
    const dbConfig = {
      type: 'mysql' as const,
      host: process.env.MYSQL_HOST || '127.0.0.1',
      port: Number(process.env.MYSQL_PORT) || 3306,
      username: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || 'verysecretsomething',
      database: process.env.MYSQL_DATABASE || 'ms_auth_test',
      entities: [User, RefreshToken],
      synchronize: true,
      dropSchema: true,
    }

    module = await Test.createTestingModule({
      imports: [TypeOrmModule.forRoot(dbConfig), UsersModule, AuthModule],
    }).compile()

    authService = module.get<AuthService>(AuthService)
    usersRepo = module.get<Repository<User>>(getRepositoryToken(User))
    eventBus = module.get<EventBusService>(EventBusService)
  })

  afterAll(async () => {
    if (module) {
      await module.close()
    }
  })

  it('signup -> persisted user', async () => {
    const activationTokenPromise = new Promise<string>((resolve) => {
      eventBus.once('user.pending_activation', (payload) => {
        resolve((payload as any).activationToken)
      })
    })

    const res = await authService.signup({
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
      phoneNumber: '+1234567890',
      role: UserRole.PATIENT,
      password: 'Abcd1234!',
    } as any)

    const activationToken = await activationTokenPromise
    expect(res).toHaveProperty('message')
    expect(typeof activationToken).toBe('string')

    const user = await usersRepo.findOne({
      where: [{ email: 'jane@example.com' }],
    })
    expect(user).toBeDefined()
    expect(user?.email).toBe('jane@example.com')
    expect(user?.isActive).toBe(false)
  })

  it('activate -> activated', async () => {
    const activationTokenPromise = new Promise<string>((resolve) => {
      eventBus.once('user.pending_activation', (payload) => {
        resolve((payload as any).activationToken)
      })
    })

    await authService.signup({
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane+retest@example.com',
      phoneNumber: '+1234567898',
      role: UserRole.PATIENT,
      password: 'Abcd1234!',
    } as any)

    const activationToken = await activationTokenPromise
    const user = await usersRepo.findOne({
      where: [{ email: 'jane+retest@example.com' }],
    })
    expect(user).toBeDefined()

    const act = await authService.activate(user!.healthId, activationToken)
    expect(act).toHaveProperty('message')

    const reloaded = await usersRepo.findOne({
      where: [{ email: 'jane+retest@example.com' }],
    })
    expect(reloaded?.isActive).toBe(true)
  })

  it('login -> tokens', async () => {
    const res = await authService.login({
      username: 'jane@example.com',
      password: 'Abcd1234!',
    } as any)
    expect(res.meta).toHaveProperty('accessToken')
    expect(res.meta).toHaveProperty('refreshToken')
  })
})
