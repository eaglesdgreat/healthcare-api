export interface JWTPayload {
  sub: string; // Subject (user ID)
  at: number; // Issued at
  exp: number; // Expiration time
  aud: string[]; // Audience (services that can accept this token)
  scope: string[]; // Permissions/scopes
  role: UserRole;
  healthId?: string;
}

export enum UserRole {
  PATIENT = 'PATIENT',
  DOCTOR = 'DOCTOR',
  HOSPITAL = 'HOSPITAL',
  ADMIN = 'ADMIN',
}
