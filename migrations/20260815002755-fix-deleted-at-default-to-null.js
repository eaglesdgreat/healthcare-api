'use strict'

var dbm
var type
var seed

/**
 * Fix the `deleted_at` column default.
 *
 * The original create-users-table migration set `deleted_at` to
 * `DEFAULT CURRENT_TIMESTAMP`. Because TypeORM's @DeleteDateColumn treats
 * `deleted_at` as a soft-delete marker and filters rows with
 * `WHERE deleted_at IS NULL`, every newly created user was immediately
 * "soft-deleted" (deleted_at was populated at insert time). As a result,
 * findOne/find queries (e.g. findUserByUsername during login) returned no
 * rows even though the user existed.
 *
 * This migration removes the CURRENT_TIMESTAMP default and backfills any
 * existing rows so deleted_at is NULL (i.e. not deleted).
 */
exports.setup = function (options, seedLink) {
  dbm = options.dbmigrate
  type = dbm.dataType
  seed = seedLink
}

exports.up = async function (db) {
  // Backfill existing rows so they are no longer treated as soft-deleted.
  await db.runSql(
    'UPDATE users SET deleted_at = NULL WHERE deleted_at IS NOT NULL;',
  )
  // Remove the CURRENT_TIMESTAMP default and make the column nullable.
  await db.changeColumn('users', 'deleted_at', {
    type: 'datetime',
    null: true,
  })
}

exports.down = async function (db) {
  await db.changeColumn('users', 'deleted_at', {
    type: 'datetime',
    null: true,
    defaultValue: 'CURRENT_TIMESTAMP',
  })
}

exports._meta = {
  version: 1,
}
