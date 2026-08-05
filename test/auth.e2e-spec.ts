import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AppModule } from './../src/app.module'
import { User } from '@/users/entities/user.entity'

describe('Auth E2E (sqlite)', () => {
  let app: INestApplication
  let moduleFixture: TestingModule

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          dropSchema: true,
          entities: [User],
          synchronize: true,
        }),
        AppModule,
      ],
    }).compile()

    app = moduleFixture.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('/signup -> /activate -> /login flow', async () => {
    const signup = await request(app.getHttpServer()).post('/signup').send({
      firstName: 'E2E',
      lastName: 'Tester',
      email: 'e2e@example.com',
      phoneNumber: '+1234567890',
      role: 'PATIENT',
      password: 'Abcd1234!',
    })

    expect(signup.status).toBe(201)

    // fetch activation token from DB
    const repo = moduleFixture.get('UserRepository') as any
    // Fallback: query directly using TypeORM connection
    const users = await moduleFixture.createNestApplication().then(a => a.getHttpServer()).catch(()=>null)

    // Instead, request the DB via a simple GET on users? Not available. Query via TypeORM directly:
    const connection = moduleFixture.get('DataSource')
    const user = await connection.getRepository(User).findOne({ where: { email: 'e2e@example.com' }, select: ['id','healthId','activationToken'] })
    expect(user).toBeDefined()

    const activate = await request(app.getHttpServer()).post('/activate').send({ healthId: user?.healthId, token: (user as any).activationToken })
    expect(activate.status).toBe(201)

    const login = await request(app.getHttpServer()).post('/login').send({ username: 'e2e@example.com', password: 'Abcd1234!' })
    expect(login.status).toBe(201)
    expect(login.body.meta).toHaveProperty('accessToken')
  })
})