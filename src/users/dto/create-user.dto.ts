import {
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  MinLength,
  Matches,
  IsNotEmpty,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { Gender, UserRole } from '../entities/user.entity';

// Enum for Blood Group
export enum BloodGroup {
  A_POSITIVE = 'A+',
  A_NEGATIVE = 'A-',
  B_POSITIVE = 'B+',
  B_NEGATIVE = 'B-',
  O_POSITIVE = 'O+',
  O_NEGATIVE = 'O-',
  AB_POSITIVE = 'AB+',
  AB_NEGATIVE = 'AB-',
}

// Enum for Genotype
export enum Genotype {
  AA = 'AA',
  AS = 'AS',
  SS = 'SS',
  AC = 'AC',
}

// Identity DTO
export class IdentityDto {
  @IsString({ message: 'First name must be a string' })
  @MinLength(2, { message: 'First name is required' })
  @Transform(({ value }: { value: string }): string => value?.trim())
  firstName: string;

  @IsString({ message: 'Last name must be a string' })
  @MinLength(2, { message: 'Last name is required' })
  @Transform(({ value }: { value: string }) => value?.trim())
  lastName: string;

  @IsString({ message: 'Date of birth must be a string' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Invalid date format (YYYY-MM-DD)',
  })
  dateOfBirth: string;

  @IsEnum(UserRole, { message: 'User role must be a string' })
  role: UserRole;

  @IsEnum(Gender, {
    message: 'Please select your gender at birth',
  })
  gender: Gender;
}

// Contact DTO
export class ContactDto {
  @IsOptional()
  @IsEmail({}, { message: 'Invalid medical email address' })
  @Transform(({ value }: { value: string | null }) =>
    value?.toLowerCase()?.trim(),
  )
  email?: string | null;

  @IsString({ message: 'Phone number must be a string' })
  @MinLength(10, { message: 'Enter a valid phone number' })
  @Matches(/^[0-9+\-\s()]+$/, { message: 'Enter a valid phone number' })
  phoneNumber: string;

  @IsString({ message: 'Password must be a string' })
  @MinLength(8, { message: 'Security requires at least 8 characters' })
  @Matches(/[A-Z]/, {
    message: 'Password must contain at least one uppercase letter',
  })
  @Matches(/[a-z]/, {
    message: 'Password must contain at least one lowercase letter',
  })
  @Matches(/[0-9]/, { message: 'Password must contain at least one number' })
  @Matches(/[^A-Za-z0-9]/, {
    message: 'Password must contain at least one special character',
  })
  password: string;
}

// Medical DTO
export class MedicalDto {
  @IsString({ message: 'Blood group must be a string' })
  @IsNotEmpty({ message: 'Blood group is required for your Health ID' })
  @IsEnum(BloodGroup, { message: 'Please select a valid blood group' })
  bloodGroup: string;

  @IsString({ message: 'Genotype must be a string' })
  @IsNotEmpty({ message: 'Genotype is required for your Health ID' })
  @IsEnum(Genotype, { message: 'Please select a valid genotype' })
  genotype: string;

  @IsOptional()
  @IsString({ message: 'Allergies must be a string' })
  allergies?: string;

  @IsString({ message: 'Emergency contact phone must be a string' })
  @MinLength(10, { message: 'Emergency contact phone is required' })
  emergencyContactPhone: string;

  @IsString({ message: 'Emergency contact name must be a string' })
  @MinLength(2, { message: 'Emergency contact name is required' })
  @Transform(({ value }: { value: string }) => value?.trim())
  emergencyContactName: string;
}

// Main Create User DTO
export class CreateUserDto {
  @Transform(({ value }: { value: IdentityDto }) => value)
  identity: IdentityDto;

  @Transform(({ value }: { value: ContactDto }) => value)
  contact: ContactDto;

  @Transform(({ value }: { value: MedicalDto }) => value)
  medical: MedicalDto;
}
