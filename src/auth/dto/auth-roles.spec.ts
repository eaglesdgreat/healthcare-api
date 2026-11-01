import { validate } from 'class-validator'
import { UserRole } from '@/users/entities/user.entity'
import { GoogleSignInDto } from './google-signin.dto'
import { RegisterUserDto } from './register-user.dto'

describe('self-service role validation', () => {
  it('rejects ADMIN during password registration', async () => {
    const dto = Object.assign(new RegisterUserDto(), {
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      phoneNumber: '+15551234567',
      role: UserRole.ADMIN,
      password: 'StrongPass123!',
    })

    const errors = await validate(dto)

    expect(
      errors.find((error) => error.property === 'role')?.constraints,
    ).toHaveProperty('isIn')
  })

  it('rejects ADMIN during Google registration', async () => {
    const dto = Object.assign(new GoogleSignInDto(), {
      idToken: 'google-id-token',
      role: UserRole.ADMIN,
    })

    const errors = await validate(dto)

    expect(
      errors.find((error) => error.property === 'role')?.constraints,
    ).toHaveProperty('isIn')
  })
})
