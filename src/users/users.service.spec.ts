import { Test, TestingModule } from '@nestjs/testing'
import { UsersService } from './users.service'
import { getRepositoryToken } from '@nestjs/typeorm'
import { UserRole } from './entities/user.entity'

describe('UsersService', () => {
  let service: UsersService

  const mockRepository = () => ({
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  })

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken('User'), useFactory: mockRepository },
      ],
    }).compile()

    service = module.get<UsersService>(UsersService)
  })

  afterEach(() => jest.resetAllMocks())

  it('generateHealthId returns a prefixed id for PATIENT', async () => {
    const repo = (service as any).usersRepository
    repo.findOne.mockResolvedValue(null)
    const id = await service.generateHealthId(UserRole.PATIENT)
    expect(id.startsWith('PAT-')).toBeTruthy()
  })

  it('generateHealthId returns a prefixed id for DOCTOR', async () => {
    const repo = (service as any).usersRepository
    repo.findOne.mockResolvedValue(null)
    const id = await service.generateHealthId(UserRole.DOCTOR)
    expect(id.startsWith('DOC-')).toBeTruthy()
  })
})
