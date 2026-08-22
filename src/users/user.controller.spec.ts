import { Test, TestingModule } from '@nestjs/testing'
import { UserController } from './user.controller'
import { UsersService } from './users.service'
import { PaginateUsersDto, SingleUserDTO } from './dto'
import { User } from './entities/user.entity'

describe('UserController', () => {
  let controller: UserController

  const mockUsersService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    restore: jest.fn(),
    bulkSoftDelete: jest.fn(),
    bulkRestore: jest.fn(),
    softDelete: jest.fn(),
    permanentDelete: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    }).compile()

    controller = module.get<UserController>(UserController)
  })

  afterEach(() => jest.resetAllMocks())

  it('should call findAll with the pagination DTO', async () => {
    const paginateDto: PaginateUsersDto = { page: 1, limit: 10 }
    const result = {
      data: [],
      meta: {
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    }
    mockUsersService.findAll.mockResolvedValue(result)

    await expect(controller.findAll(paginateDto)).resolves.toEqual(result)
    expect(mockUsersService.findAll).toHaveBeenCalledWith(paginateDto)
  })

  it('should call findOne with id and filter DTO', async () => {
    const id = 'uuid'
    const filterDto: SingleUserDTO = {}
    const user = { id } as User
    mockUsersService.findOne.mockResolvedValue(user)

    await expect(controller.findOne(id, filterDto)).resolves.toEqual(user)
    expect(mockUsersService.findOne).toHaveBeenCalledWith(id, filterDto)
  })

  it('should call restore with the user id', async () => {
    const id = 'uuid'
    const result = { message: 'restored', user: { id } as User }
    mockUsersService.restore.mockResolvedValue(result)

    await expect(controller.restore(id)).resolves.toEqual(result)
    expect(mockUsersService.restore).toHaveBeenCalledWith(id)
  })

  it('should call bulkSoftDelete with the ids', async () => {
    const ids = ['uuid-1', 'uuid-2']
    const result = { message: '2 users', deletedCount: 2 }
    mockUsersService.bulkSoftDelete.mockResolvedValue(result)

    await expect(controller.bulkSoftDelete(ids)).resolves.toEqual(result)
    expect(mockUsersService.bulkSoftDelete).toHaveBeenCalledWith(ids)
  })

  it('should call bulkRestore with the ids', async () => {
    const ids = ['uuid-1', 'uuid-2']
    const result = { message: '2 users', restoredCount: 2 }
    mockUsersService.bulkRestore.mockResolvedValue(result)

    await expect(controller.bulkRestore(ids)).resolves.toEqual(result)
    expect(mockUsersService.bulkRestore).toHaveBeenCalledWith(ids)
  })

  it('should return the placeholder message on update', () => {
    expect(controller.update()).toBe('Feature coming soon...')
  })

  it('should call softDelete with the user id', async () => {
    const id = 'uuid'
    const result = { message: 'soft deleted', user: { id } as User }
    mockUsersService.softDelete.mockResolvedValue(result)

    await expect(controller.softDelete(id)).resolves.toEqual(result)
    expect(mockUsersService.softDelete).toHaveBeenCalledWith(id)
  })

  it('should call permanentDelete with the user id', async () => {
    const id = 'uuid'
    const result = { message: 'permanently deleted' }
    mockUsersService.permanentDelete.mockResolvedValue(result)

    await expect(controller.permanentDelete(id)).resolves.toEqual(result)
    expect(mockUsersService.permanentDelete).toHaveBeenCalledWith(id)
  })
})
