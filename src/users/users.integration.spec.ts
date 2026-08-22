import { Test, TestingModule } from '@nestjs/testing'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { getRepositoryToken } from '@nestjs/typeorm'
import { UsersModule } from './user.module'
import { UsersService } from './users.service'
import { User, UserRole, Gender } from './entities/user.entity'
import { CreateUserDto } from './dto'

describe('Users Integration (mysql)', () => {
  let module: TestingModule
  let service: UsersService
  let repo: Repository<User>

  beforeAll(async () => {
    const dbConfig = {
      type: 'mysql' as const,
      host: process.env.MYSQL_HOST || '127.0.0.1',
      port: Number(process.env.MYSQL_PORT) || 3306,
      username: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || 'verysecretsomething',
      database: process.env.MYSQL_DATABASE || 'ms_auth_test',
      entities: [User],
      synchronize: true,
      dropSchema: true,
    }

    module = await Test.createTestingModule({
      imports: [TypeOrmModule.forRoot(dbConfig), UsersModule],
    }).compile()

    service = module.get<UsersService>(UsersService)
    repo = module.get<Repository<User>>(getRepositoryToken(User))
  })

  afterAll(async () => {
    if (module) {
      await module.close()
    }
  })

  const buildUserDto = (opts: {
    email: string
    phoneNumber: string
    firstName?: string
  }): CreateUserDto => ({
    identity: {
      firstName: opts.firstName ?? 'Integration',
      lastName: 'User',
      dateOfBirth: '1990-01-01',
      role: UserRole.PATIENT,
      gender: Gender.MALE,
    },
    contact: {
      email: opts.email,
      phoneNumber: opts.phoneNumber,
      password: 'MockPass123!',
    },
    medical: {
      bloodGroup: 'O+',
      genotype: 'AA',
      emergencyContactPhone: '+15550009999',
      emergencyContactName: 'Emergency Contact',
    },
  })

  it('create -> persisted user with generated health id', async () => {
    const created = await service.create(
      buildUserDto({
        email: 'integration.create@example.com',
        phoneNumber: '+15550001001',
      }),
    )

    expect(created.id).toBeDefined()
    expect(created.healthId).toMatch(/^PAT-/)

    const found = await repo.findOne({ where: { id: created.id } })
    expect(found).toBeDefined()
    expect(found?.email).toBe('integration.create@example.com')
  })

  it('softDelete sets deletedAt and restore clears it', async () => {
    const user = await service.create(
      buildUserDto({
        email: 'integration.soft@example.com',
        phoneNumber: '+15550001002',
      }),
    )

    const deleted = await service.softDelete(user.id)
    expect(deleted.message).toContain('soft deleted')
    expect(deleted.user.deletedAt).toBeDefined()

    const restored = await service.restore(user.id)
    expect(restored.message).toContain('restored')
    expect(restored.user.deletedAt).toBeNull()
  })

  it('permanentDelete removes the record', async () => {
    const user = await service.create(
      buildUserDto({
        email: 'integration.permanent@example.com',
        phoneNumber: '+15550001003',
      }),
    )

    const result = await service.permanentDelete(user.id)
    expect(result.message).toContain('permanently deleted')

    const found = await repo.findOne({
      where: { id: user.id },
      withDeleted: true,
    })
    expect(found).toBeNull()
  })

  it('findAll returns a paginated response', async () => {
    await service.create(
      buildUserDto({
        email: 'integration.list1@example.com',
        phoneNumber: '+15550001004',
      }),
    )
    await service.create(
      buildUserDto({
        email: 'integration.list2@example.com',
        phoneNumber: '+15550001005',
      }),
    )

    const result = await service.findAll({ page: 1, limit: 20 })

    expect(result.data.length).toBeGreaterThanOrEqual(2)
    expect(result.meta.total).toBeGreaterThanOrEqual(2)
    expect(result.meta.page).toBe(1)
  })

  it('findOne returns the user by id', async () => {
    const user = await service.create(
      buildUserDto({
        email: 'integration.findone@example.com',
        phoneNumber: '+15550001006',
      }),
    )

    const found = await service.findOne(user.id, {})
    expect(found.id).toBe(user.id)
  })

  it('findUserByUsername resolves by email', async () => {
    await service.create(
      buildUserDto({
        email: 'integration.username@example.com',
        phoneNumber: '+15550001007',
      }),
    )

    const found = await service.findUserByUsername(
      'integration.username@example.com',
    )
    expect(found).toBeDefined()
    expect(found?.email).toBe('integration.username@example.com')
  })

  it('bulkSoftDelete and bulkRestore affect the expected counts', async () => {
    const u1 = await service.create(
      buildUserDto({
        email: 'integration.bulk1@example.com',
        phoneNumber: '+15550001008',
      }),
    )
    const u2 = await service.create(
      buildUserDto({
        email: 'integration.bulk2@example.com',
        phoneNumber: '+15550001009',
      }),
    )

    const deleted = await service.bulkSoftDelete([u1.id, u2.id])
    expect(deleted.deletedCount).toBe(2)

    const restored = await service.bulkRestore([u1.id, u2.id])
    expect(restored.restoredCount).toBe(2)
  })
})
