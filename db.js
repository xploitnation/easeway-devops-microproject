const Database = require('better-sqlite3');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const cfg = require('./config');

fs.mkdirSync(path.dirname(cfg.DB_PATH), { recursive: true });
const db = new Database(cfg.DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  handle TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT,
  pw_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student','counsellor')),
  consent_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS mood (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
  note_enc TEXT,
  day TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_mood_user ON mood(user_id, day);
CREATE TABLE IF NOT EXISTS slots (
  id INTEGER PRIMARY KEY,
  counsellor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_at TEXT NOT NULL,
  student_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  booked_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_slots_start ON slots(start_at);
`);

// ---- encryption at rest for free-text notes (AES-256-GCM) ----
const keyFile = path.join(path.dirname(cfg.DB_PATH), path.basename(cfg.DB_PATH) + '.key');
let key;
if (fs.existsSync(keyFile)) key = Buffer.from(fs.readFileSync(keyFile, 'utf8').trim(), 'hex');
else { key = crypto.randomBytes(32); fs.writeFileSync(keyFile, key.toString('hex'), { mode: 0o600 }); }

function encrypt(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([c.update(text, 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64');
}
function decrypt(b64) {
  if (!b64) return '';
  try {
    const b = Buffer.from(b64, 'base64');
    const d = crypto.createDecipheriv('aes-256-gcm', key, b.subarray(0, 12));
    d.setAuthTag(b.subarray(12, 28));
    return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8');
  } catch { return ''; }
}
const sessionSecret = crypto.createHash('sha256').update(key).update('session').digest('hex');

module.exports = { db, encrypt, decrypt, sessionSecret };
