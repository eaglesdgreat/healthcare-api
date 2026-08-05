import { Test, TestingModule } from '@nestjs/testing'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthModule } from './auth.module'
import { UsersModule } from '@/users/user.module'
import { AuthService } from './auth.service'
import { User } from '@/users/entities/user.entity'
import { Repository } from 'typeorm'
import { getRepositoryToken } from '@nestjs/typeorm'
import { UserRole } from '@/users/entities/user.entity'

describe('Auth Integration (sqlite)', () => {
  let module: TestingModule
  let authService: AuthService
  let usersRepo: Repository<User>

  beforeAll(async () => {
    // Support running against either sqlite in-memory (default) or the
    // docker-compose MySQL instance. CI can set USE_MYSQL=true and provide
    // MYSQL_* env vars to run integration tests against MySQL.
    const useMysql = process.env.USE_MYSQL === 'true'

    const dbConfig = useMysql
      ? {
          type: 'mysql' as const,
          host: process.env.MYSQL_HOST || '127.0.0.1',
          port: Number(process.env.MYSQL_PORT) || 3306,
          username: process.env.MYSQL_USER || 'root',
          password: process.env.MYSQL_PASSWORD || 'password',
          database: process.env.MYSQL_DATABASE || 'test',
          entities: [User],
          synchronize: true,
          dropSchema: true,
        }
      : {
          type: 'sqlite' as const,
          database: ':memory:',
          dropSchema: true,
          entities: [User],
          synchronize: true,
        }

    module = await Test.createTestingModule({
      imports: [TypeOrmModule.forRoot(dbConfig), UsersModule, AuthModule],
    }).compile()

    authService = module.get<AuthService>(AuthService)
    usersRepo = module.get<Repository<User>>(getRepositoryToken(User))
  })

  afterAll(async () => {
    await module.close()
  })

  it('signup -> persisted user', async () => {
    const res = await authService.signup({
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
      phoneNumber: '+1234567890',
      role: UserRole.PATIENT,
      password: 'Abcd1234!',
    } as any)

    expect(res).toHaveProperty('message')

    const user = await usersRepo.findOne({ where: [{ email: 'jane@example.com' }] })
    expect(user).toBeDefined()
    expect(user?.email).toBe('jane@example.com')
    expect(user?.isActive).toBe(false)
  })

  it('activate -> activated', async () => {
    const created = await usersRepo.findOne({ where: [{ email: 'jane@example.com' }] })
    expect(created).toBeDefined()

    const token = (created as any).activationToken
    const healthId = created?.healthId

    const act = await authService.activate(healthId!, token)
    expect(act).toHaveProperty('message')

    const reloaded = await usersRepo.findOne({ where: [{ email: 'jane@example.com' }] })
    expect(reloaded?.isActive).toBe(true)
  })

  it('login -> tokens', async () => {
    const res = await authService.login({ username: 'jane@example.com', password: 'Abcd1234!' } as any)
    expect(res.meta).toHaveProperty('accessToken')
    expect(res.meta).toHaveProperty('refreshToken')
  })
})