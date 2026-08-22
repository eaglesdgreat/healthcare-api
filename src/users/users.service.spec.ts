import { Test, TestingModule } from '@nestjs/testing'
import { ConflictException, NotFoundException } from '@nestjs/common'
import { UsersService } from './users.service'
import { getRepositoryToken } from '@nestjs/typeorm'
import { User, UserRole, Gender } from './entities/user.entity'
import { CreateUserDto, PaginateUsersDto, SingleUserDTO } from './dto'

type UserRepoMock = {
  findOne: jest.Mock
  create: jest.Mock
  save: jest.Mock
  softDelete: jest.Mock
  restore: jest.Mock
  delete: jest.Mock
  findAndCount: jest.Mock
}

describe('UsersService', () => {
  let service: UsersService
  let userRepo: UserRepoMock

  const mockRepository = (): UserRepoMock => ({
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    softDelete: jest.fn(),
    restore: jest.fn(),
    delete: jest.fn(),
    findAndCount: jest.fn(),
  })

  const buildCreateUserDto = (
    email: string,
    phoneNumber: string,
  ): CreateUserDto => ({
    identity: {
      firstName: 'Mock',
      lastName: 'User',
      dateOfBirth: '1990-01-01',
      role: UserRole.PATIENT,
      gender: Gender.MALE,
    },
    contact: { email, phoneNumber, password: 'MockPass123!' },
    medical: {
      bloodGroup: 'O+',
      genotype: 'AA',
      emergencyContactPhone: '+15550009999',
      emergencyContactName: 'Emergency',
    },
  })

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useFactory: mockRepository },
      ],
    }).compile()

    service = module.get<UsersService>(UsersService)
    userRepo = module.get(getRepositoryToken(User))
  })

  afterEach(() => jest.resetAllMocks())

  it('generateHealthId returns a prefixed id for PATIENT', async () => {
    userRepo.findOne.mockResolvedValue(null)
    const id = await service.generateHealthId(UserRole.PATIENT)
    expect(id.startsWith('PAT-')).toBeTruthy()
  })

  it('generateHealthId returns a prefixed id for DOCTOR', async () => {
    userRepo.findOne.mockResolvedValue(null)
    const id = await service.generateHealthId(UserRole.DOCTOR)
    expect(id.startsWith('DOC-')).toBeTruthy()
  })

  it('create persists a user with a generated health id', async () => {
    userRepo.findOne.mockResolvedValue(null)
    const created = { id: 'uuid', firstName: 'Mock' } as User
    userRepo.create.mockReturnValue(created)
    userRepo.save.mockResolvedValue(created)

    const result = await service.create(
      buildCreateUserDto('mock.user@example.com', '+15550000001'),
    )

    expect(result).toEqual(created)
    expect(userRepo.create).toHaveBeenCalledTimes(1)
    expect(userRepo.save).toHaveBeenCalledWith(created)
    const createCall = userRepo.create.mock.calls[0] as [
      { healthId: string; firstName: string; email: string },
    ]
    expect(createCall[0].healthId).toMatch(/^PAT-/)
    expect(createCall[0].firstName).toBe('Mock')
    expect(createCall[0].email).toBe('mock.user@example.com')
  })

  it('softDelete soft deletes an existing user and returns it', async () => {
    const id = 'uuid'
    const deletedUser = { id, deletedAt: new Date() } as User
    userRepo.findOne
      .mockResolvedValueOnce({ id, deletedAt: null })
      .mockResolvedValueOnce(deletedUser)
    userRepo.softDelete.mockResolvedValue({ affected: 1 })

    const result = await service.softDelete(id)

    expect(result.message).toContain('soft deleted')
    expect(result.user).toEqual(deletedUser)
    expect(userRepo.softDelete).toHaveBeenCalledWith(id)
  })

  it('softDelete throws NotFoundException when user is missing', async () => {
    userRepo.findOne.mockResolvedValue(null)
    await expect(service.softDelete('uuid')).rejects.toThrow(NotFoundException)
    expect(userRepo.softDelete).not.toHaveBeenCalled()
  })

  it('softDelete throws ConflictException when already deleted', async () => {
    userRepo.findOne.mockResolvedValue({ id: 'uuid', deletedAt: new Date() })
    await expect(service.softDelete('uuid')).rejects.toThrow(ConflictException)
    expect(userRepo.softDelete).not.toHaveBeenCalled()
  })

  it('restore restores a soft-deleted user', async () => {
    const id = 'uuid'
    const restoredUser = { id } as User
    userRepo.findOne
      .mockResolvedValueOnce({ id, deletedAt: new Date() })
      .mockResolvedValueOnce(restoredUser)
    userRepo.restore.mockResolvedValue({ affected: 1 })

    const result = await service.restore(id)

    expect(result.message).toContain('restored')
    expect(result.user).toEqual(restoredUser)
    expect(userRepo.restore).toHaveBeenCalledWith(id)
  })

  it('restore throws NotFoundException when user is missing', async () => {
    userRepo.findOne.mockResolvedValue(null)
    await expect(service.restore('uuid')).rejects.toThrow(NotFoundException)
  })

  it('restore throws ConflictException when not deleted', async () => {
    userRepo.findOne.mockResolvedValue({ id: 'uuid', deletedAt: null })
    await expect(service.restore('uuid')).rejects.toThrow(ConflictException)
    expect(userRepo.restore).not.toHaveBeenCalled()
  })

  it('permanentDelete hard deletes a user', async () => {
    userRepo.findOne.mockResolvedValue({ id: 'uuid' })
    userRepo.delete.mockResolvedValue({ affected: 1 })

    const result = await service.permanentDelete('uuid')

    expect(result.message).toContain('permanently deleted')
    expect(userRepo.delete).toHaveBeenCalledWith('uuid')
  })

  it('permanentDelete throws NotFoundException when user is missing', async () => {
    userRepo.findOne.mockResolvedValue(null)
    await expect(service.permanentDelete('uuid')).rejects.toThrow(
      NotFoundException,
    )
  })

  it('findAll returns paginated users with metadata', async () => {
    const users = [{ id: 'uuid-1' }, { id: 'uuid-2' }] as User[]
    userRepo.findAndCount.mockResolvedValue([users, 2])

    const paginateDto: PaginateUsersDto = { page: 1, limit: 20 }
    const result = await service.findAll(paginateDto)

    expect(result.data).toHaveLength(2)
    expect(result.meta.total).toBe(2)
    expect(result.meta.page).toBe(1)
    expect(userRepo.findAndCount).toHaveBeenCalledTimes(1)
  })

  it('findOne returns the user', async () => {
    const user = { id: 'uuid' } as User
    userRepo.findOne.mockResolvedValue(user)
    const filterDto: SingleUserDTO = {}
    await expect(service.findOne('uuid', filterDto)).resolves.toEqual(user)
  })

  it('findOne throws NotFoundException when user is missing', async () => {
    userRepo.findOne.mockResolvedValue(null)
    await expect(service.findOne('uuid', {})).rejects.toThrow(NotFoundException)
  })

  it('findUserByUsername returns the user by identifier', async () => {
    const user = { id: 'uuid', email: 'mock.user@example.com' } as User
    userRepo.findOne.mockResolvedValue(user)
    await expect(
      service.findUserByUsername('mock.user@example.com'),
    ).resolves.toEqual(user)
  })

  it('bulkSoftDelete soft deletes many users', async () => {
    userRepo.softDelete.mockResolvedValue({ affected: 2 })
    const result = await service.bulkSoftDelete(['uuid-1', 'uuid-2'])
    expect(result.deletedCount).toBe(2)
    expect(userRepo.softDelete).toHaveBeenCalledWith(['uuid-1', 'uuid-2'])
  })

  it('bulkRestore restores many users', async () => {
    userRepo.restore.mockResolvedValue({ affected: 2 })
    const result = await service.bulkRestore(['uuid-1', 'uuid-2'])
    expect(result.restoredCount).toBe(2)
    expect(userRepo.restore).toHaveBeenCalledWith(['uuid-1', 'uuid-2'])
  })
})
