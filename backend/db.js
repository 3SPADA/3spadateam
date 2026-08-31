const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// DB_PATH bisa dioverride lewat env variable, misalnya kalau di Railway
// kalian pasang Volume dan mount ke /data supaya database tidak hilang tiap deploy ulang:
// DB_PATH=/data/3spada.db
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '3spada.db');
const db = new Database(DB_PATH);

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

module.exports = db;
