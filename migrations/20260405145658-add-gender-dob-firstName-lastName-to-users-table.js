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
  await db.addColumn('users', 'first_name', { type: 'string', length: 100 })
  await db.addColumn('users', 'last_name', { type: 'string', length: 100 })
  await db.addColumn('users', 'phone_number', { type: 'string', length: 20 })
  await db.addColumn('users', 'date_of_birth', { type: 'date' })
  await db.addColumn('users', 'gender', { type: 'string' })
}

exports.down = async function (db) {
  await db.removeColumn('users', 'first_name')
  await db.removeColumn('users', 'last_name')
  await db.removeColumn('users', 'phone_number')
  await db.removeColumn('users', 'date_of_birth')
  await db.removeColumn('users', 'gender')
}

exports._meta = {
  version: 1,
}
