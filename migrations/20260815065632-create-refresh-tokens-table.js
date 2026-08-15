'use strict'

var dbm
var type
var seed

/**
 * Create the refresh_tokens table.
 *
 * The RefreshToken entity (src/auth/entities/refresh-token.entity.ts) was
 * added to the schema but no migration ever created the table. Because the
 * app runs with synchronize: false, login failed with
 * "Table 'refresh_tokens' doesn't exist" when generating refresh tokens.
 */
exports.setup = function (options, seedLink) {
  dbm = options.dbmigrate
  type = dbm.dataType
  seed = seedLink
}

exports.up = function (db) {
  return db.createTable('refresh_tokens', {
    id: { type: 'char(36)', primaryKey: true, notNull: true },
    user_id: { type: 'char(36)', notNull: true },
    refresh_token: { type: 'string', length: 256, notNull: true },
    revoked: { type: 'boolean', defaultValue: false },
    expires_at: { type: 'datetime', notNull: true },
    created_at: { type: 'datetime', defaultValue: 'CURRENT_TIMESTAMP' },
  })
}

exports.down = function (db) {
  return db.dropTable('refresh_tokens')
}

exports._meta = {
  version: 1,
}
