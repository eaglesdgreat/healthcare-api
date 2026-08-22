// src/users/entities/user.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm'
import {
  ApiProperty,
  ApiPropertyOptional,
  ApiHideProperty,
} from '@nestjs/swagger'

export enum UserRole {
  PATIENT = 'PATIENT',
  DOCTOR = 'DOCTOR',
  HOSPITAL = 'HOSPITAL',
  ADMIN = 'ADMIN',
}

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
}

@Entity('users')
export class User {
  @ApiProperty({
    description: 'Unique UUID of the user record',
    example: 'd0f1c1c1-0000-4000-8000-000000000000',
    format: 'uuid',
  })
  @PrimaryGeneratedColumn('uuid')
  id: string

  @ApiProperty({
    description: "User's legal first name",
    example: 'John',
    maxLength: 100,
  })
  @Column({ name: 'first_name', length: 100 })
  firstName: string

  @ApiProperty({
    description: "User's legal last name",
    example: 'Doe',
    maxLength: 100,
  })
  @Column({ name: 'last_name', length: 100 })
  lastName: string

  @ApiProperty({
    description: "User's phone number",
    example: '+2348012345678',
    maxLength: 20,
  })
  @Column({ name: 'phone_number', length: 20 })
  phoneNumber: string

  // Made nullable for the onboarding profile page step
  @ApiPropertyOptional({
    description: "User's date of birth (YYYY-MM-DD)",
    example: '1990-01-01',
    format: 'date',
    nullable: true,
  })
  @Column({ name: 'date_of_birth', type: 'date', nullable: true })
  dateOfBirth: Date | null

  // Removed default default value and made nullable
  @ApiPropertyOptional({
    description: 'Gender recorded at birth',
    enum: Gender,
    enumName: 'Gender',
    example: 'MALE',
    nullable: true,
  })
  @Column({ type: 'enum', enum: Gender, nullable: true })
  gender: string | null

  @ApiPropertyOptional({
    description: 'Email address used as a login identifier',
    example: 'john.doe@example.com',
    format: 'email',
    nullable: true,
  })
  @Column({ unique: true, nullable: true })
  email: string

  @ApiHideProperty()
  @Column({ type: 'varchar', select: false, nullable: true })
  password: string | null

  @ApiProperty({
    description: 'System-generated Health ID (e.g. PAT-XXXXXXXX)',
    example: 'PAT-AB12CD34',
    maxLength: 50,
  })
  @Column({ name: 'health_id', length: 50 })
  healthId: string

  @ApiProperty({
    description: 'Role assigned to the user',
    enum: UserRole,
    enumName: 'UserRole',
    example: 'PATIENT',
  })
  @Column({ type: 'enum', enum: UserRole, default: UserRole.PATIENT })
  role: string

  @ApiProperty({
    description: 'Whether the account has been activated',
    example: false,
  })
  @Column({ name: 'is_active', default: false })
  isActive: boolean

  @ApiHideProperty()
  @Column('varchar', {
    name: 'activation_token',
    length: 128,
    nullable: true,
    select: false,
  })
  activationTokenHash: string | null

  @ApiHideProperty()
  @Column('timestamp', {
    name: 'activation_expires_at',
    nullable: true,
    select: false,
  })
  activationExpiresAt: Date | null

  @ApiHideProperty()
  @Column('timestamp', {
    name: 'last_activation_sent_at',
    nullable: true,
    select: false,
  })
  lastActivationSentAt: Date | null

  @ApiProperty({
    description: 'Timestamp when the user was created',
    example: '2025-01-01T00:00:00.000Z',
    format: 'date-time',
  })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @ApiProperty({
    description: 'Timestamp when the user was last updated',
    example: '2025-01-01T00:00:00.000Z',
    format: 'date-time',
  })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date

  @ApiPropertyOptional({
    description: 'Timestamp when the user was soft-deleted (null while active)',
    example: '2025-01-01T00:00:00.000Z',
    format: 'date-time',
    nullable: true,
  })
  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date
}
