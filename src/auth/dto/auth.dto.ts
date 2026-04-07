import { IsString, IsNumber, IsNotEmpty } from 'class-validator';

export enum UserRole {
  PATIENT = 'PATIENT',
  DOCTOR = 'DOCTOR',
  HOSPITAL = 'HOSPITAL',
  ADMIN = 'ADMIN',
}

export class JWTPayloadDTO {
  @IsString()
  sub: string; // Subject (user ID)

  @IsNumber()
  at: number; // Issued at

  @IsNumber()
  exp: number; // Expiration time

  @IsString({ each: true })
  aud: string[]; // Audience (services that can accept this token)

  @IsString({ each: true })
  scope: string[]; // Permissions/scopes

  @IsNotEmpty()
  role: UserRole;

  @IsString()
  healthId?: string;
}
