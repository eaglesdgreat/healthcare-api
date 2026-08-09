import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { AppModule } from './../src/app.module'
import { User } from '@/users/entities/user.entity'
import { RefreshToken } from '@/auth/entities/refresh-token.entity'
import { EventBusService } from '@/common/event-bus.service'

describe('Auth E2E (mysql)', () => {
  let app: INestApplication
  let moduleFixture: TestingModule

  let eventBus: EventBusService

  beforeAll(async () => {
    // E2E tests run against the project's MySQL instance (CI provides a service).

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

    moduleFixture = await Test.createTestingModule({
      imports: [TypeOrmModule.forRoot(dbConfig), AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    eventBus = moduleFixture.get<EventBusService>(EventBusService)
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('/signup -> /activate -> /login flow', async () => {
    const activationTokenPromise = new Promise<string>((resolve) => {
      eventBus.once('user.pending_activation', (payload) => {
        resolve((payload as any).activationToken)
      })
    })

    const signup = await request(app.getHttpServer()).post('/signup').send({
      firstName: 'E2E',
      lastName: 'Tester',
      email: 'e2e@example.com',
      phoneNumber: '+1234567890',
      role: 'PATIENT',
      password: 'Abcd1234!',
    })

    expect(signup.status).toBe(201)

    const activationToken = await activationTokenPromise

    const user = await moduleFixture
      .get(DataSource)
      .getRepository(User)
      .findOne({
        where: { email: 'e2e@example.com' },
        select: ['healthId'],
      })
    expect(user).toBeDefined()

    const activate = await request(app.getHttpServer()).post('/activate').send({
      healthId: user?.healthId,
      token: activationToken,
    })
    expect(activate.status).toBe(201)

    const login = await request(app.getHttpServer())
      .post('/login')
      .send({ username: 'e2e@example.com', password: 'Abcd1234!' })
    expect(login.status).toBe(201)
    expect(login.body.meta).toHaveProperty('accessToken')
    expect(login.body.meta).toHaveProperty('refreshToken')
  })
})
