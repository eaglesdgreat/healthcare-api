'use strict'

exports.setup = function () {}

exports.up = async function (db) {
  await db.changeColumn('users', 'phone_number', {
    type: 'string',
    length: 20,
    notNull: false,
  })
}

exports.down = async function (db) {
  // Populate null phone numbers before rolling back this schema change.
  await db.changeColumn('users', 'phone_number', {
    type: 'string',
    length: 20,
    notNull: true,
  })
}

exports._meta = {
  version: 1,
}
