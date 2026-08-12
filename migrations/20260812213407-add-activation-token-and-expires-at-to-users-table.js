'use strict'

var dbm
var type
var seed

/**
 * Add the activation-token columns to the users table.
 *
 * The User entity stores a hashed activation token and its expiry so that
 * newly created accounts can be activated before first login. Those columns
 * were added to the entity (see src/users/entities/user.entity.ts) but no
 * migration ever created them, so the production schema (synchronize: false)
 * was missing them. This caused POST /signup to fail with an unknown-column
 * error and return HTTP 500 in the container smoke test.
 *
 * The auth e2e test did not catch this because it boots TypeORM with
 * synchronize: true, which auto-creates the columns from the entity.
 */
exports.setup = function (options, seedLink) {
  dbm = options.dbmigrate
  type = dbm.dataType
  seed = seedLink
}

exports.up = async function (db) {
  await db.addColumn('users', 'activation_token', {
    type: 'string',
    length: 128,
    null: true,
  })
  await db.addColumn('users', 'activation_expires_at', {
    type: 'datetime',
    null: true,
  })
}

exports.down = async function (db) {
  await db.removeColumn('users', 'activation_token')
  await db.removeColumn('users', 'activation_expires_at')
}

exports._meta = {
  version: 1,
}
