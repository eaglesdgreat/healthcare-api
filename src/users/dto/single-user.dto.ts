import { PickType } from '@nestjs/swagger'
import { PaginateUsersDto } from './paginate-user.dto'

export class SingleUserDTO extends PickType(PaginateUsersDto, [
  'isActive',
  'withDeleted',
] as const) {}
