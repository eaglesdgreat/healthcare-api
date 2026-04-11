import { PickType } from '@nestjs/mapped-types'
import { PaginateUsersDto } from './paginate-user.dto'

export class SingleUserDTO extends PickType(PaginateUsersDto, [
  'isActive',
  'withDeleted',
] as const) {}
