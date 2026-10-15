// Seeding: counsellor accounts + upcoming slots (auto on server start), synthetic demo students (npm run seed)
const bcrypt = require('bcryptjs');
const { db, encrypt } = require('./db');
const cfg = require('./config');

const COUNSELLORS = [
  { handle: 'counsellor1', name: 'Dr. Meera Rao' },
  { handle: 'counsellor2', name: 'Mr. Arjun Nair' }
];
const HOURS = [10, 11, 14, 16];

function ensureBase() {
  const hash = bcrypt.hashSync(cfg.DEMO_COUNSELLOR_PASSWORD, 10);
  for (const c of COUNSELLORS) {
    if (!db.prepare('SELECT 1 FROM users WHERE handle = ?').get(c.handle))
      db.prepare("INSERT INTO users (handle, display_name, pw_hash, role, consent_at) VALUES (?,?,?,?,datetime('now'))")
        .run(c.handle, c.name, hash, 'counsellor');
  }
  const future = db.prepare("SELECT COUNT(*) n FROM slots WHERE start_at > datetime('now')").get().n;
  if (future < 8) {
    const ins = db.prepare('INSERT INTO slots (counsellor_id, start_at) VALUES (?,?)');
    const ids = db.prepare("SELECT id FROM users WHERE role='counsellor'").all();
    for (let d = 1; d <= 7; d++) for (const c of ids) for (const h of HOURS) {
      const t = new Date(); t.setDate(t.getDate() + d); t.setHours(h, 0, 0, 0);
      ins.run(c.id, t.toISOString());
    }
  }
}

// small deterministic PRNG so demo data is repeatable
function rng(seed) { return () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296; }

function seedDemoStudents() {
  ensureBase();
  const r = rng(42);
  const hash = bcrypt.hashSync('Student@123', 10);
  const insU = db.prepare("INSERT OR IGNORE INTO users (handle, pw_hash, role, consent_at) VALUES (?,?,?,datetime('now'))");
  const insM = db.prepare('INSERT INTO mood (user_id, score, note_enc, day, created_at) VALUES (?,?,?,?,?)');
  const has = db.prepare('SELECT COUNT(*) n FROM mood WHERE user_id = ?');
  for (let i = 1; i <= 12; i++) {
    const handle = 'demo_student_' + String(i).padStart(2, '0');
    insU.run(handle, hash, 'student');
    const u = db.prepare('SELECT id FROM users WHERE handle = ?').get(handle);
    if (has.get(u.id).n) continue;
    let base = 2.6 + r() * 1.6;
    for (let d = 13; d >= 0; d--) {
      if (r() < 0.2) continue;
      const t = new Date(); t.setDate(t.getDate() - d);
      const day = t.toISOString().slice(0, 10);
      // gentle dip mid-fortnight to resemble exam stress
      const dip = d >= 5 && d <= 8 ? -0.7 : 0;
      const score = Math.max(1, Math.min(5, Math.round(base + dip + (r() - 0.5) * 1.6)));
      insM.run(u.id, score, encrypt(null), day, t.toISOString().replace('T', ' ').slice(0, 19));
    }
  }
  console.log('Seeded 12 synthetic demo students (demo_student_01..12, password Student@123) with 14 days of synthetic check-ins.');
}

module.exports = { ensureBase, seedDemoStudents };
if (require.main === module) { seedDemoStudents(); }
