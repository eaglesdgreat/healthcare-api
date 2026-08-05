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
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          dropSchema: true,
          entities: [User],
          synchronize: true,
        }),
        UsersModule,
        AuthModule,
      ],
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