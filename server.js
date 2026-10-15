const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const cfg = require('./config');
const { db, encrypt, decrypt, sessionSecret } = require('./db');
const { ensureBase } = require('./seed');
const resources = require('./resources.json');

ensureBase();
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '10kb' }));

// ---- privacy-conscious logging: method, path, status only. Never bodies, queries or notes. ----
app.use((req, res, next) => {
  res.on('finish', () => console.log(`${req.method} ${req.path.split('?')[0]} ${res.statusCode}`));
  next();
});

// ---- security headers ----
app.use((req, res, next) => {
  res.set({
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': req.path.startsWith('/api') ? 'no-store' : 'no-cache'
  });
  next();
});

app.use(session({
  name: 'easeway.sid',
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'strict', maxAge: 1000 * 60 * 60 * 2 }
}));

// CSRF defence in depth (on top of SameSite=Strict): state-changing calls must carry a custom header
app.use('/api', (req, res, next) => {
  if (req.method !== 'GET' && req.get('X-Requested-With') !== 'easeway') return res.status(403).json({ error: 'Blocked request.' });
  next();
});

const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });
const today = () => new Date().toISOString().slice(0, 10);

function me(req) {
  if (!req.session.uid) return null;
  return db.prepare('SELECT id, handle, display_name, role, consent_at FROM users WHERE id = ?').get(req.session.uid) || null;
}
const auth = role => (req, res, next) => {
  const u = me(req);
  if (!u) return bad(res, 'Please sign in.', 401);
  if (role && u.role !== role) return bad(res, 'You do not have access to this.', 403);
  req.user = u; next();
};
const needConsent = (req, res, next) =>
  req.user.consent_at ? next() : bad(res, 'Consent is needed before Easeway can store this. Turn it on in Privacy.', 403);

// ---- simple login throttling ----
const fails = new Map();
function throttled(key) {
  const f = fails.get(key);
  return f && f.n >= 5 && Date.now() - f.t < 10 * 60 * 1000;
}
function noteFail(key) { const f = fails.get(key) || { n: 0, t: 0 }; fails.set(key, { n: f.n + 1, t: Date.now() }); }

// ---- account ----
app.post('/api/register', (req, res) => {
  const { handle, password, consent } = req.body || {};
  if (typeof handle !== 'string' || !/^[A-Za-z0-9_]{3,20}$/.test(handle))
    return bad(res, 'Choose a name of 3-20 letters, numbers or underscores. Do not use your real name or email.');
  if (typeof password !== 'string' || password.length < 8 || password.length > 72)
    return bad(res, 'Use a password of 8-72 characters.');
  if (consent !== true) return bad(res, 'Please read and accept the consent notice to create an account.');
  if (db.prepare('SELECT 1 FROM users WHERE handle = ?').get(handle)) return bad(res, 'That name is taken. Try another.', 409);
  const info = db.prepare("INSERT INTO users (handle, pw_hash, role, consent_at) VALUES (?,?,?,datetime('now'))")
    .run(handle, bcrypt.hashSync(password, 10), 'student');
  req.session.uid = info.lastInsertRowid;
  res.status(201).json({ ok: true });
});

app.post('/api/login', (req, res) => {
  const { handle, password } = req.body || {};
  const key = `${req.ip}|${String(handle).toLowerCase()}`;
  if (throttled(key)) return bad(res, 'Too many attempts. Wait 10 minutes and try again.', 429);
  const u = typeof handle === 'string' && typeof password === 'string'
    ? db.prepare('SELECT id, pw_hash FROM users WHERE handle = ?').get(handle) : null;
  if (!u || !bcrypt.compareSync(password, u.pw_hash)) { noteFail(key); return bad(res, 'Name or password is incorrect.', 401); }
  fails.delete(key);
  req.session.regenerate(() => { req.session.uid = u.id; res.json({ ok: true }); });
});

app.post('/api/logout', (req, res) => req.session.destroy(() => res.json({ ok: true })));

app.get('/api/me', (req, res) => {
  const u = me(req);
  if (!u) return res.json({ user: null });
  res.json({ user: { handle: u.handle, name: u.display_name, role: u.role, consent: !!u.consent_at } });
});

app.post('/api/consent', auth('student'), (req, res) => {
  const granted = !!(req.body && req.body.granted);
  db.prepare('UPDATE users SET consent_at = ' + (granted ? "datetime('now')" : 'NULL') + ' WHERE id = ?').run(req.user.id);
  res.json({ consent: granted });
});

// delete account + all associated data in one operation
app.delete('/api/account', auth('student'), (req, res) => {
  const row = db.prepare('SELECT pw_hash FROM users WHERE id = ?').get(req.user.id);
  const pw = req.body && req.body.password;
  if (typeof pw !== 'string' || !bcrypt.compareSync(pw, row.pw_hash)) return bad(res, 'Password is incorrect. Nothing was deleted.', 401);
  db.transaction(() => {
    db.prepare('UPDATE slots SET student_id = NULL, booked_at = NULL WHERE student_id = ?').run(req.user.id);
    db.prepare('DELETE FROM users WHERE id = ?').run(req.user.id); // mood rows cascade
  })();
  req.session.destroy(() => res.json({ deleted: true }));
});

// ---- mood check-ins ----
function supportFor(score, note) {
  const flagged = score <= cfg.CRISIS_SCORE || (note && cfg.CRISIS_KEYWORDS.test(note));
  return flagged ? { show: true, helplines: cfg.HELPLINES } : { show: false };
}

app.post('/api/mood', auth('student'), needConsent, (req, res) => {
  const { score, note } = req.body || {};
  if (!Number.isInteger(score) || score < 1 || score > 5) return bad(res, 'Pick a mood from 1 to 5.');
  if (note !== undefined && note !== null && (typeof note !== 'string' || note.length > 500)) return bad(res, 'Keep the note under 500 characters.');
  const clean = note ? note.trim() : '';
  db.prepare('INSERT INTO mood (user_id, score, note_enc, day) VALUES (?,?,?,?)')
    .run(req.user.id, score, encrypt(clean || null), today());
  // Rule-based, non-diagnostic. Nothing is flagged or stored about the prompt; nobody is alerted.
  res.status(201).json({ saved: true, support: supportFor(score, clean) });
});

app.get('/api/mood', auth('student'), (req, res) => {
  const rows = db.prepare("SELECT id, score, note_enc, day, created_at FROM mood WHERE user_id = ? AND day >= date('now','-29 day') ORDER BY created_at")
    .all(req.user.id);
  res.json({
    entries: rows.map(r => ({ id: r.id, score: r.score, note: decrypt(r.note_enc), day: r.day, at: r.created_at }))
  });
});

app.get('/api/resources', auth(), (req, res) => res.json({ resources }));

// ---- appointments ----
app.get('/api/slots', auth('student'), (req, res) => {
  const rows = db.prepare(`SELECT s.id, s.start_at, u.display_name counsellor FROM slots s JOIN users u ON u.id = s.counsellor_id
    WHERE s.student_id IS NULL AND s.start_at > datetime('now') ORDER BY s.start_at LIMIT 60`).all();
  res.json({ slots: rows });
});

app.get('/api/appointments', auth('student'), (req, res) => {
  const rows = db.prepare(`SELECT s.id, s.start_at, u.display_name counsellor FROM slots s JOIN users u ON u.id = s.counsellor_id
    WHERE s.student_id = ? AND s.start_at > datetime('now','-1 day') ORDER BY s.start_at`).all(req.user.id);
  res.json({ appointments: rows });
});

app.post('/api/slots/:id/book', auth('student'), needConsent, (req, res) => {
  const upd = db.prepare("UPDATE slots SET student_id = ?, booked_at = datetime('now') WHERE id = ? AND student_id IS NULL AND start_at > datetime('now')")
    .run(req.user.id, Number(req.params.id));
  if (!upd.changes) return bad(res, 'That time is no longer available. Pick another.', 409);
  res.status(201).json({ booked: true });
});

app.delete('/api/appointments/:id', auth('student'), (req, res) => {
  const upd = db.prepare('UPDATE slots SET student_id = NULL, booked_at = NULL WHERE id = ? AND student_id = ?')
    .run(Number(req.params.id), req.user.id);
  if (!upd.changes) return bad(res, 'Appointment not found.', 404);
  res.json({ cancelled: true });
});

// ---- counsellor ----
app.get('/api/counsellor/appointments', auth('counsellor'), (req, res) => {
  // Only the student's pseudonymous handle is visible. Mood entries and notes are never exposed here.
  const rows = db.prepare(`SELECT s.id, s.start_at, st.handle student FROM slots s JOIN users st ON st.id = s.student_id
    WHERE s.counsellor_id = ? AND s.start_at > datetime('now','-1 day') ORDER BY s.start_at`).all(req.user.id);
  res.json({ appointments: rows });
});

app.get('/api/counsellor/trends', auth('counsellor'), (req, res) => {
  const k = cfg.K_THRESHOLD;
  const days = db.prepare(`SELECT day, ROUND(AVG(score),2) avg, COUNT(DISTINCT user_id) n FROM mood
    WHERE day >= date('now','-13 day') GROUP BY day ORDER BY day`).all();
  const shown = days.map(d => d.n >= k ? { day: d.day, avg: d.avg, n: d.n, suppressed: false } : { day: d.day, suppressed: true });
  const students = db.prepare("SELECT COUNT(*) n FROM users WHERE role='student'").get().n;
  const booked = db.prepare('SELECT COUNT(*) n FROM slots WHERE student_id IS NOT NULL AND start_at > datetime(\'now\')').get().n;
  res.json({ k, days: shown, students, upcomingBookings: booked });
});

app.use('/api', (req, res) => bad(res, 'Not found.', 404));
app.use(express.static(path.join(__dirname, 'public')));
app.use((err, req, res, next) => { console.log('ERROR ' + (err && err.type || 'internal')); bad(res, 'Something went wrong. Try again.', 500); });

if (require.main === module) {
  app.listen(cfg.PORT, () => console.log(`Easeway running at http://localhost:${cfg.PORT}`));
}
module.exports = app;
