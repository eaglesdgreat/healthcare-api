'use strict'

var dbm
var type
var seed

/**
 * We receive the dbmigrate dependency from dbmigrate initially.
 * This enables us to not have to rely on NODE_PATH.
 */
exports.setup = function (options, seedLink) {
  dbm = options.dbmigrate
  type = dbm.dataType
  seed = seedLink
}

exports.up = async function (db) {
  // Google OAuth users have no password, so the column must accept NULL.
  await db.changeColumn('users', 'password', {
    type: 'string',
    length: 255,
    notNull: false,
  })
}

exports.down = async function (db) {
  // Revert to NOT NULL. Any existing NULL passwords must be backfilled
  // before rolling back, or this migration will fail.
  await db.changeColumn('users', 'password', {
    type: 'string',
    length: 255,
    notNull: true,
  })
}

exports._meta = {
  version: 1,
}
