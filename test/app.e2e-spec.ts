import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { App } from 'supertest/types'
import { AppModule } from './../src/app.module'

describe('AppController (e2e)', () => {
  let app: INestApplication<App>

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    await app.init()
  })

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!')
  })

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual(
          expect.objectContaining({
            status: 'ok',
            info: expect.objectContaining({
              database: expect.objectContaining({ status: 'up' }) as string,
              memory_heap: expect.objectContaining({ status: 'up' }) as string,
              memory_rss: expect.objectContaining({ status: 'up' }) as string,
            }) as Record<string, unknown>,
          }),
        )
      })
  })

  it('/metrics (GET)', () => {
    return request(app.getHttpServer())
      .get('/metrics')
      .expect('Content-Type', /text\/plain/)
      .expect(200)
      .expect((response) => {
        expect(response.text).toContain('http_requests_total')
        expect(response.text).toContain('process_cpu_user_seconds_total')
      })
  })
})
