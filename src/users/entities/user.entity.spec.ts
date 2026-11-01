import { getMetadataArgsStorage } from 'typeorm'
import { User } from './user.entity'

describe('User entity', () => {
  it('defines a concrete MySQL-compatible type for nullable phone numbers', () => {
    const phoneNumberColumn = getMetadataArgsStorage().columns.find(
      (column) =>
        column.target === User && column.propertyName === 'phoneNumber',
    )

    expect(phoneNumberColumn?.options).toMatchObject({
      type: 'varchar',
      length: 20,
      nullable: true,
    })
  })
})
