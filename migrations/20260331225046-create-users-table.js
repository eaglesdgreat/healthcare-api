'use strict';

var dbm;
var type;
var seed;

/**
 * We receive the dbmigrate dependency from dbmigrate initially.
 * This enables us to not have to rely on NODE_PATH.
 */
exports.setup = function (options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = function (db) {
  return db.createTable('users', {
    id: { type: 'char(36)', primaryKey: true, notNull: true }, // Using UUID for healthcare security
    email: { type: 'string', length: 255, notNull: true, unique: true },
    password: { type: 'string', length: 255, notNull: true },
    role: { type: 'string', length: 50, defaultValue: 'PATIENT' },
    is_active: { type: 'boolean', defaultValue: true },
    created_at: { type: 'datetime', defaultValue: 'CURRENT_TIMESTAMP' },
    updated_at: { type: 'datetime', defaultValue: 'CURRENT_TIMESTAMP' },
  });
};

exports.down = function (db) {
  return db.dropTable('users');
};

exports._meta = {
  version: 1,
};
