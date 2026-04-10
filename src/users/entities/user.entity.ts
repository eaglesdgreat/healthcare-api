import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';

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
  id: string;

  @Column({ name: 'first_name', length: 100 })
  firstName: string;

  @Column({ name: 'last_name', length: 100 })
  lastName: string;

  @Column({ name: 'phone_number', length: 20 })
  phoneNumber: string;

  @Column({ name: 'date_of_birth', type: 'date' })
  dateOfBirth: Date;

  @Column({ type: 'enum', enum: Gender, default: Gender.MALE, length: 10 })
  gender: string;

  @Column({ unique: true, nullable: true })
  email: string;

  @Column({ select: false }) // Exclude password from queries by default for security
  password: string;

  @Column({ name: 'health_id', length: 50 })
  healthId: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.PATIENT })
  role: string;

  @Column({ default: false })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' }) // Add this for soft delete
  deletedAt: Date;
}
