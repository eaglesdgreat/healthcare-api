import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { JwtService } from '@nestjs/jwt'
import { AppModule } from './../src/app.module'
import { User, UserRole } from '@/users/entities/user.entity'
import { RefreshToken } from '@/auth/entities/refresh-token.entity'

describe('Users E2E (mysql)', () => {
  let app: INestApplication
  let moduleFixture: TestingModule
  let dataSource: DataSource
  let accessToken: string

  beforeAll(async () => {
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
    await app.init()

    dataSource = moduleFixture.get<DataSource>(DataSource)
    const jwtService = moduleFixture.get<JwtService>(JwtService)
    accessToken = jwtService.sign({
      sub: 'users-e2e',
      email: 'users.e2e@example.com',
      healthId: 'PAT-E2E0001',
      roles: 'PATIENT',
    })
  })

  afterAll(async () => {
    await app.close()
  })

  const httpServer = () => app.getHttpServer() as Parameters<typeof request>[0]

  const createUser = async (overrides: Partial<User> = {}): Promise<User> => {
    const suffix = Math.random().toString(36).slice(2, 10).toUpperCase()
    const repo = dataSource.getRepository(User)
    const user = repo.create({
      firstName: 'E2E',
      lastName: 'User',
      phoneNumber: `+1555${suffix}`,
      email: `e2e-${suffix.toLowerCase()}@example.com`,
      healthId: `PAT-${suffix}`,
      role: UserRole.PATIENT,
      isActive: true,
      ...overrides,
    })
    return repo.save(user)
  }

  it('GET /users returns a paginated list', async () => {
    await createUser()

    const res = await request(httpServer())
      .get('/users')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)

    const body = res.body as { data: unknown[]; meta: { total?: number } }
    expect(body.data).toBeInstanceOf(Array)
    expect(body.meta).toHaveProperty('total')
  })

  it('GET /users/:id returns a single user', async () => {
    const user = await createUser()

    const res = await request(httpServer())
      .get(`/users/${user.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)

    const body = res.body as { id: string }
    expect(body.id).toBe(user.id)
  })

  it('POST /users/restore/:id restores a soft-deleted user', async () => {
    const user = await createUser()

    await request(httpServer())
      .delete(`/users/soft/${user.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)

    const res = await request(httpServer())
      .post(`/users/restore/${user.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)

    const body = res.body as { message: string }
    expect(body.message).toContain('restored')
  })

  it('POST /users/bulk-soft-delete soft deletes many users', async () => {
    const u1 = await createUser()
    const u2 = await createUser()

    const res = await request(httpServer())
      .post('/users/bulk-soft-delete')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ ids: [u1.id, u2.id] })
      .expect(200)

    const body = res.body as { deletedCount: number }
    expect(body.deletedCount).toBe(2)
  })

  it('POST /users/bulk-restore restores many users', async () => {
    const u1 = await createUser()
    const u2 = await createUser()

    await request(httpServer())
      .post('/users/bulk-soft-delete')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ ids: [u1.id, u2.id] })
      .expect(200)

    const res = await request(httpServer())
      .post('/users/bulk-restore')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ ids: [u1.id, u2.id] })
      .expect(200)

    const body = res.body as { restoredCount: number }
    expect(body.restoredCount).toBe(2)
  })

  it('PUT /users/:id returns the placeholder message', async () => {
    const user = await createUser()

    const res = await request(httpServer())
      .put(`/users/${user.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)

    expect(res.text).toBe('Feature coming soon...')
  })

  it('DELETE /users/soft/:id soft deletes a user', async () => {
    const user = await createUser()

    const res = await request(httpServer())
      .delete(`/users/soft/${user.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)

    const body = res.body as { message: string }
    expect(body.message).toContain('soft deleted')
  })

  it('DELETE /users/permanent/:id permanently deletes a user', async () => {
    const user = await createUser()

    const res = await request(httpServer())
      .delete(`/users/permanent/${user.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)

    const body = res.body as { message: string }
    expect(body.message).toContain('permanently deleted')
  })

  it('GET /users without a token returns 401', async () => {
    await request(httpServer()).get('/users').expect(401)
  })
})
