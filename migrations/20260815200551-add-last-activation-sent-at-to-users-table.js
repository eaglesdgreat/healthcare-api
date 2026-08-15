'use strict'

var dbm
var type
var seed

/**
 * Add last_activation_sent_at to the users table.
 *
 * Used to enforce a resend cooldown for activation tokens so users cannot
 * request a new activation code more often than the allowed interval.
 */
exports.setup = function (options, seedLink) {
  dbm = options.dbmigrate
  type = dbm.dataType
  seed = seedLink
}

exports.up = function (db) {
  return db.addColumn('users', 'last_activation_sent_at', {
    type: 'datetime',
    null: true,
  })
}

exports.down = function (db) {
  return db.removeColumn('users', 'last_activation_sent_at')
}

exports._meta = {
  version: 1,
}
