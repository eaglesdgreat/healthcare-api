/**
 * Shared mock data for tests.
 *
 * All static properties (emails, usernames, phone numbers, health IDs, etc.)
 * used across unit, integration, and e2e tests should be sourced from here so
 * that test data is clearly identifiable as mock data and stays consistent.
 *
 * Each alias is explicitly typed to match the data type expected by the
 * consuming DTO / entity field so assignments never trigger unsafe-type errors.
 */

import { RegisterUserDto } from '@/auth/dto/register-user.dto'
import { LoginUserDto } from '@/auth/dto/login-user.dto'
import { GoogleSignInDto } from '@/auth/dto/google-signin.dto'
import { UserRole } from '@/users/entities/user.entity'

export const MOCK = {
  /** Mock user identities */
  user: {
    firstName: 'Mock',
    lastName: 'User',
    email: 'mock.user@example.com',
    phoneNumber: '+15550000001',
    password: 'MockPass123!',
    healthId: 'PAT-MOCK0001',
  },

  /** Mock secondary user (used when a test needs two distinct users) */
  secondaryUser: {
    firstName: 'Mock',
    lastName: 'Secondary',
    email: 'mock.secondary@example.com',
    phoneNumber: '+15550000002',
    password: 'MockPass123!',
    healthId: 'PAT-MOCK0002',
  },

  /** Mock Google identity */
  googleUser: {
    email: 'mock.google@example.com',
    emailVerified: true,
    givenName: 'Mock',
    familyName: 'Google',
    phoneNumber: '+15550000003',
  },

  /** Mock login credentials */
  login: {
    username: 'mock.user@example.com',
    password: 'MockPass123!',
  },

  /** Mock activation token */
  activationToken: 'mock-activation-token-1234567890abcdef',

  /** Mock refresh token */
  refreshToken: 'mock-refresh-token-1234567890abcdef',

  /** Mock health IDs by role */
  healthId: {
    patient: 'PAT-MOCK0001',
    doctor: 'DOC-MOCK0001',
    hospital: 'HOS-MOCK0001',
  },
}

/** Mock role matching the UserRole enum type. */
export const mockRole: UserRole = UserRole.PATIENT

/** RegisterUserDto fully typed to match its declared field types. */
export const mockRegisterUserDto: RegisterUserDto = {
  firstName: MOCK.user.firstName,
  lastName: MOCK.user.lastName,
  email: MOCK.user.email,
  phoneNumber: MOCK.user.phoneNumber,
  role: UserRole.PATIENT,
  password: MOCK.user.password,
}

/** RegisterUserDto for the secondary (activation) user, fully typed. */
export const mockSecondaryRegisterUserDto: RegisterUserDto = {
  firstName: MOCK.secondaryUser.firstName,
  lastName: MOCK.secondaryUser.lastName,
  email: MOCK.secondaryUser.email,
  phoneNumber: MOCK.secondaryUser.phoneNumber,
  role: UserRole.PATIENT,
  password: MOCK.secondaryUser.password,
}

/** LoginUserDto fully typed to match its declared field types. */
export const mockLoginUserDto: LoginUserDto = {
  username: MOCK.login.username,
  password: MOCK.login.password,
}

/** LoginUserDto for the secondary (activated) user, fully typed. */
export const mockSecondaryLoginUserDto: LoginUserDto = {
  username: MOCK.secondaryUser.email,
  password: MOCK.secondaryUser.password,
}

/** GoogleSignInDto fully typed to match its declared field types. */
export const mockGoogleSignInDto: GoogleSignInDto = {
  idToken: 'mock-google-id-token',
}
