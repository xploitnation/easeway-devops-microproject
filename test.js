// Automated checks that map to the report's test cases (TC-01 .. TC-10).
// Run with:  npm test   (starts its own server on a temporary database; your real data is untouched)
const { spawn } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');

const PORT = 3999, BASE = `http://localhost:${PORT}`;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'easeway-'));
const DB = path.join(tmp, 't.db');
const server = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT, DB_PATH: DB }, cwd: __dirname });
let logs = '';
server.stdout.on('data', d => logs += d); server.stderr.on('data', d => logs += d);

function client() {
  let cookie = '';
  return async (method, p, body, extra = {}) => {
    const res = await fetch(BASE + '/api' + p, {
      method, redirect: 'manual',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'easeway', ...(cookie && { cookie }), ...extra },
      body: body ? JSON.stringify(body) : undefined
    });
    const sc = res.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    let data = {}; try { data = await res.json(); } catch {}
    return { status: res.status, data, headers: res.headers };
  };
}

const results = [];
const check = (id, name, ok, detail = '') => { results.push({ id, name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}  ${name}${detail && !ok ? '  -> ' + detail : ''}`); };
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  for (let i = 0; i < 50; i++) { try { await fetch(BASE + '/api/me'); break; } catch { await wait(200); } }
  const SECRET_NOTE = 'unique-note-text-9f3a7c';
  const SECRET_PW = 'Sup3rSecretPw!';

  // TC-01 register with handle + password only; no real name / email stored
  const a = client();
  let r = await a('POST', '/register', { handle: 'tester_one', password: SECRET_PW, consent: true });
  const Database = require('better-sqlite3');
  const cols = new Database(DB, { readonly: true }).prepare('PRAGMA table_info(users)').all().map(c => c.name);
  check('TC-01', 'Register with handle + password; schema has no name/email/roll columns',
    r.status === 201 && !cols.some(c => /mail|real|roll|phone/i.test(c)), JSON.stringify({ status: r.status, cols }));
  r = await client()('POST', '/register', { handle: 'x@y.com', password: SECRET_PW, consent: true });
  check('TC-01b', 'Email-style handle rejected', r.status === 400);
  r = await client()('POST', '/register', { handle: 'no_consent', password: SECRET_PW, consent: false });
  check('TC-01c', 'Registration refused without consent', r.status === 400);

  // TC-02 submit a mood with a note; visible only to that student
  r = await a('POST', '/mood', { score: 4, note: SECRET_NOTE });
  const mine = await a('GET', '/mood');
  const b = client(); await b('POST', '/register', { handle: 'tester_two', password: SECRET_PW, consent: true });
  const theirs = await b('GET', '/mood');
  check('TC-02', 'Mood saved; owner can read note; another student sees none of it',
    r.status === 201 && mine.data.entries.length === 1 && mine.data.entries[0].note === SECRET_NOTE && theirs.data.entries.length === 0);
  const raw = new Database(DB, { readonly: true }).prepare('SELECT note_enc FROM mood').all();
  check('TC-02b', 'Note is encrypted at rest (plaintext not in database)', raw.length === 1 && !String(raw[0].note_enc).includes(SECRET_NOTE));

  // TC-03 invalid input
  const bad1 = await a('POST', '/mood', { score: 9 });
  const bad2 = await a('POST', '/mood', { score: 'four' });
  const bad3 = await a('POST', '/mood', { score: 3, note: 'x'.repeat(501) });
  check('TC-03', 'Out-of-range, wrong-type and over-long input rejected', bad1.status === 400 && bad2.status === 400 && bad3.status === 400);

  // TC-04 role-based access
  const c1 = client(); await c1('POST', '/login', { handle: 'counsellor1', password: 'Counsel@123' });
  const s1 = await a('GET', '/counsellor/trends');
  const s2 = await a('GET', '/counsellor/appointments');
  const anon = await client()('GET', '/counsellor/trends');
  const c2 = await c1('POST', '/mood', { score: 3 });
  check('TC-04', 'Student blocked from counsellor APIs (403); anonymous blocked (401); counsellor cannot post moods (403)',
    s1.status === 403 && s2.status === 403 && anon.status === 401 && c2.status === 403);

  // TC-05 injection attempts
  const inj = "'); DROP TABLE users;--";
  r = await a('POST', '/mood', { score: 3, note: inj });
  const inj2 = await client()('POST', '/login', { handle: "' OR '1'='1", password: "' OR '1'='1" });
  const still = new Database(DB, { readonly: true }).prepare('SELECT COUNT(*) n FROM users').get().n;
  const back = await a('GET', '/mood');
  check('TC-05', 'SQL-injection strings stored as plain text / rejected; tables intact',
    r.status === 201 && inj2.status === 401 && still >= 4 && back.data.entries.some(e => e.note === inj));
  const csrf = await fetch(BASE + '/api/mood', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"score":3}' });
  check('TC-05b', 'State-changing request without the custom header is blocked', csrf.status === 403);

  // TC-06 support prompt
  const low = await a('POST', '/mood', { score: 1 });
  const kw = await a('POST', '/mood', { score: 4, note: 'I feel like I want to die' });
  const fine = await a('POST', '/mood', { score: 4, note: 'good day' });
  check('TC-06', 'Helpline info shown for low score or crisis keywords; not for a normal check-in',
    low.data.support.show === true && low.data.support.helplines.length > 0 && kw.data.support.show === true && fine.data.support.show === false);

  // TC-08 aggregation threshold (k = 5)
  let t = await c1('GET', '/counsellor/trends');
  const before = t.data.days.every(d => d.suppressed && d.avg === undefined);
  for (let i = 0; i < 4; i++) { const x = client(); await x('POST', '/register', { handle: 'agg_user_' + i, password: SECRET_PW, consent: true }); await x('POST', '/mood', { score: 3 }); }
  t = await c1('GET', '/counsellor/trends');
  const stillHidden = t.data.days.every(d => d.suppressed);       // tester_one + 4 = 5 distinct students today -> should now show
  const now = t.data.days.find(d => !d.suppressed);
  check('TC-08', 'Daily average hidden below 5 students and revealed at 5',
    before && !stillHidden && now && now.n >= 5);

  // booking + counsellor sees handle only
  const slots = await a('GET', '/slots');
  const book = await a('POST', `/slots/${slots.data.slots[0].id}/book`);
  const dbl = await b('POST', `/slots/${slots.data.slots[0].id}/book`);
  const ca = await c1('GET', '/counsellor/appointments');
  const c2a = client(); await c2a('POST', '/login', { handle: 'counsellor2', password: 'Counsel@123' });
  check('TC-06b', 'Booking works, double-booking refused (409), counsellor sees pseudonymous handle only',
    book.status === 201 && dbl.status === 409 && JSON.stringify(ca.data).includes('tester_one') === (slots.data.slots[0].counsellor === 'Dr. Meera Rao') && !JSON.stringify(ca.data).includes(SECRET_NOTE));

  // consent withdrawal blocks writes
  await b('POST', '/consent', { granted: false });
  const blocked = await b('POST', '/mood', { score: 3 });
  await b('POST', '/consent', { granted: true });
  check('TC-02c', 'Withdrawing consent blocks new check-ins', blocked.status === 403);

  // TC-07 delete account
  const wrong = await a('DELETE', '/account', { password: 'wrongpass' });
  const del = await a('DELETE', '/account', { password: SECRET_PW });
  const dbh = new Database(DB, { readonly: true });
  const left = dbh.prepare("SELECT COUNT(*) n FROM users WHERE handle='tester_one'").get().n;
  const moodsLeft = dbh.prepare('SELECT COUNT(*) n FROM mood WHERE note_enc IS NOT NULL AND user_id NOT IN (SELECT id FROM users)').get().n;
  const slotLeft = dbh.prepare('SELECT COUNT(*) n FROM slots WHERE student_id NOT IN (SELECT id FROM users)').get().n;
  const after = await a('GET', '/me');
  check('TC-07', 'Delete needs correct password; removes user, mood entries and bookings; session ended',
    wrong.status === 401 && del.status === 200 && left === 0 && moodsLeft === 0 && slotLeft === 0 && after.data.user === null);
  const gone = await client()('POST', '/login', { handle: 'tester_one', password: SECRET_PW });
  check('TC-07b', 'Deleted account can no longer sign in', gone.status === 401);

  // TC-09 accessibility (static portion; keyboard run-through is manual - see README)
  const html = await (await fetch(BASE + '/')).text();
  const js = await (await fetch(BASE + '/app.js')).text();
  check('TC-09', 'Page has lang, viewport, skip link, live region; app uses labelled fields and a fieldset/legend',
    /<html lang="en"/.test(html) && /viewport/.test(html) && /class="skip"/.test(html) && /aria-live="polite"/.test(html) && /legend/.test(js) && /'for'|for:/.test(js));

  // TC-10 logs hold no personal data
  await wait(300);
  const leaked = [SECRET_NOTE, SECRET_PW, 'tester_one', 'want to die'].filter(s => logs.includes(s));
  check('TC-10', 'Server log contains no notes, passwords, handles or request bodies', leaked.length === 0, leaked.join(','));

  // headers
  const hh = (await fetch(BASE + '/')).headers;
  check('SEC-1', 'Security headers present (CSP, nosniff, no X-Powered-By)', !!hh.get('content-security-policy') && hh.get('x-content-type-options') === 'nosniff' && !hh.get('x-powered-by'));

  // brute force throttle
  let code = 0; for (let i = 0; i < 7; i++) code = (await client()('POST', '/login', { handle: 'counsellor2', password: 'nope' + i })).status;
  check('SEC-2', 'Repeated failed sign-ins are throttled (429)', code === 429);

  const passed = results.filter(x => x.ok).length;
  console.log(`\n${passed}/${results.length} checks passed`);
  server.kill();
  await wait(300);
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
  process.exit(passed === results.length ? 0 : 1);
})().catch(e => {
  console.error(e);
  try { server.kill(); } catch (_) {}
  process.exit(1);
});
