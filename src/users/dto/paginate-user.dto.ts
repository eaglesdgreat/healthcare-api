// src/users/dto/paginate-users.dto.ts
import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsBoolean,
  IsString,
  IsEnum,
} from 'class-validator'
import { Type, Transform } from 'class-transformer'
import { UserRole } from '../entities/user.entity'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class PaginateUsersDto {
  @ApiPropertyOptional({
    description: 'Page number to retrieve (1-indexed)',
    example: 1,
    default: 1,
    minimum: 1,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1

  @ApiPropertyOptional({
    description: 'Number of records per page',
    example: 10,
    default: 10,
    minimum: 1,
    maximum: 100,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10

  @ApiPropertyOptional({
    description:
      'Free-text search across first name, last name, phone number, and Health ID (partial match)',
    example: 'John',
    type: String,
  })
  @IsOptional()
  @IsString()
  search?: string

  @ApiPropertyOptional({
    description: 'Filter users by role',
    enum: UserRole,
    example: 'PATIENT',
    type: String,
  })
  @IsOptional()
  @IsEnum(UserRole, { message: 'Invalid role type passed' })
  role?: UserRole

  @ApiPropertyOptional({
    description: 'Include soft-deleted users in the results',
    example: false,
    default: false,
    type: Boolean,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  withDeleted?: boolean = false

  @ApiPropertyOptional({
    description: 'Filter users by active status',
    example: true,
    default: false,
    type: Boolean,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isActive?: boolean = false

  @ApiPropertyOptional({
    description: 'Field to sort by',
    example: 'createdAt',
    default: 'createdAt',
    type: String,
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt'

  @ApiPropertyOptional({
    description: 'Sort direction',
    example: 'DESC',
    default: 'DESC',
    enum: ['ASC', 'DESC'],
    type: String,
  })
  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC' = 'DESC'
}
