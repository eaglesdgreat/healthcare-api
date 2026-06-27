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
  // 1. Alter date_of_birth to remove NOT NULL constraints
  await db.changeColumn('users', 'date_of_birth', {
    type: 'date',
    notNull: false,
  })

  // 2. Alter gender column to remove NOT NULL and drop the old default constraint safely
  await db.changeColumn('users', 'gender', {
    type: "enum('MALE', 'FEMALE', 'OTHER')",
    notNull: false,
    defaultValue: null,
  })
}

exports.down = async function (db) {
  // Revert back to restrictive state if rolled back
  await db.changeColumn('users', 'date_of_birth', {
    type: 'date',
    notNull: true,
  })

  await db.changeColumn('users', 'gender', {
    type: "enum('MALE', 'FEMALE', 'OTHER')",
    notNull: true,
    defaultValue: 'MALE',
  })
}

exports._meta = {
  version: 1,
}
