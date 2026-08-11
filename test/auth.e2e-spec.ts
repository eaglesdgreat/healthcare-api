import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { AppModule } from './../src/app.module'
import { User } from '@/users/entities/user.entity'
import { RefreshToken } from '@/auth/entities/refresh-token.entity'
import { EventBusService, EventPayload } from '@/common/event-bus.service'
import { MOCK } from '@/common/test/mock-data'

describe('Auth E2E (mysql)', () => {
  let app: INestApplication
  let moduleFixture: TestingModule

  let eventBus: EventBusService
  const readActivationToken = (payload?: EventPayload): string => {
    const token = payload?.activationToken
    if (typeof token !== 'string') {
      throw new Error('Activation token missing from event payload')
    }
    return token
  }

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
        resolve(readActivationToken(payload))
      })
    })

    const httpServer = app.getHttpServer() as Parameters<typeof request>[0]
    const signup = await request(httpServer).post('/signup').send({
      firstName: MOCK.user.firstName,
      lastName: MOCK.user.lastName,
      email: MOCK.user.email,
      phoneNumber: MOCK.user.phoneNumber,
      role: 'PATIENT',
      password: MOCK.user.password,
    })

    expect(signup.status).toBe(201)

    const activationToken = await activationTokenPromise

    const user = await moduleFixture
      .get<DataSource>(DataSource)
      .getRepository(User)
      .findOne({
        where: { email: MOCK.user.email },
        select: ['healthId'],
      })
    expect(user).toBeDefined()

    const activate = await request(httpServer).post('/activate').send({
      healthId: user?.healthId,
      token: activationToken,
    })
    expect(activate.status).toBe(201)

    const login = await request(httpServer)
      .post('/login')
      .send({ username: MOCK.user.email, password: MOCK.user.password })
    const loginBody = login.body as {
      meta?: {
        accessToken?: string
        refreshToken?: string
      }
    }
    expect(login.status).toBe(201)
    expect(loginBody.meta?.accessToken).toBeDefined()
    expect(loginBody.meta?.refreshToken).toBeDefined()
  })
})
