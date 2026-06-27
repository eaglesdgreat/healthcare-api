// src/users/entities/user.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm'

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
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'first_name', length: 100 })
  firstName: string

  @Column({ name: 'last_name', length: 100 })
  lastName: string

  @Column({ name: 'phone_number', length: 20 })
  phoneNumber: string

  // Made nullable for the onboarding profile page step
  @Column({ name: 'date_of_birth', type: 'date', nullable: true })
  dateOfBirth: Date | null

  // Removed default default value and made nullable
  @Column({ type: 'enum', enum: Gender, nullable: true })
  gender: string | null

  @Column({ unique: true, nullable: true })
  email: string

  @Column({ select: false })
  password: string

  @Column({ name: 'health_id', length: 50 })
  healthId: string

  @Column({ type: 'enum', enum: UserRole, default: UserRole.PATIENT })
  role: string

  @Column({ name: 'is_active', default: false })
  isActive: boolean

  @Column({ name: 'activation_token', nullable: true, select: false })
  activationToken: string | null

  @Column({
    name: 'activation_expires_at',
    type: 'timestamp',
    nullable: true,
    select: false,
  })
  activationExpiresAt: Date | null

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date
}
