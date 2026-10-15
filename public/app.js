'use strict';
/* Easeway front end. No innerHTML with data: everything is built with textContent so notes/handles cannot inject markup. */
const SVGNS = 'http://www.w3.org/2000/svg';
const $app = document.getElementById('app');
const $live = document.getElementById('live');
let me = null;          // { handle, name, role, consent }
let view = null;        // current tab id
let lastSupport = null; // support info shown after a low check-in

function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'aria-pressed') { el.setAttribute(k, String(!!v)); continue; }
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'text') el.textContent = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(kid));
  return el;
}
function s(tag, attrs, text) {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
  if (text != null) el.textContent = text;
  return el;
}
const put = (root, ...kids) => Element.prototype.append.apply(root, kids.filter(Boolean));
const say = msg => { $live.textContent = ''; setTimeout(() => $live.textContent = msg, 30); };

async function api(method, path, body) {
  const res = await fetch('/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'easeway' },
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin'
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Try again.');
  return data;
}

const fmtDay = d => new Date(d + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const fmtTime = iso => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const fmtDate = iso => new Date(iso).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
const MOODS = ['Very low', 'Low', 'Okay', 'Good', 'Very good'];

/* ---------- boot ---------- */
async function boot() {
  const r = await api('GET', '/me');
  me = r.user;
  if (me) view = me.role === 'counsellor' ? 'c-appts' : 'checkin';
  render();
}

function shell(tabs, content) {
  const nav = h('nav', { class: 'tabs', 'aria-label': 'Main' },
    h('ul', {}, tabs.map(([id, label]) => h('li', {},
      h('button', { type: 'button', 'aria-current': view === id ? 'page' : false, onclick: () => { view = id; lastSupport = null; render(true); } }, label)))));
  return h('div', {},
    h('header', { class: 'top' }, h('div', { class: 'top-in' },
      h('span', { class: 'brand' }, 'Easeway'),
      h('span', { class: 'who' }, me.role === 'counsellor' ? `Counsellor: ${me.name || me.handle}` : `Signed in as ${me.handle}`),
      h('button', { class: 'btn btn-quiet', type: 'button', onclick: async () => { await api('POST', '/logout'); me = null; render(); } }, 'Sign out'))),
    nav,
    h('main', { id: 'main', tabindex: '-1' }, content));
}

function render(focusHeading) {
  $app.replaceChildren();
  if (!me) { $app.append(authView()); return; }
  const student = me.role === 'student';
  const tabs = student
    ? [['checkin', 'Check in'], ['trend', 'My trend'], ['resources', 'Resources'], ['book', 'Counsellor'], ['privacy', 'Privacy']]
    : [['c-appts', 'Appointments'], ['c-trends', 'Campus trends']];
  const holder = h('div', { class: 'stack' });
  $app.append(shell(tabs, holder));
  const views = { checkin: checkinView, trend: trendView, resources: resourcesView, book: bookView, privacy: privacyView, 'c-appts': cAppts, 'c-trends': cTrends };
  views[view](holder).then(() => {
    if (focusHeading) { const h1 = holder.querySelector('h1'); if (h1) { h1.setAttribute('tabindex', '-1'); h1.focus(); } }
  });
}

function banner(kind, text) { return h('p', { class: kind, role: kind === 'error' ? 'alert' : 'status' }, text); }

/* ---------- auth ---------- */
function authView() {
  let mode = 'login';
  const box = h('div', { class: 'card' });
  function draw() {
    box.replaceChildren();
    const err = h('div', {});
    const handle = h('input', { id: 'handle', type: 'text', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false', required: true });
    const pw = h('input', { id: 'pw', type: 'password', autocomplete: mode === 'login' ? 'current-password' : 'new-password', required: true });
    const consent = h('input', { id: 'consent', type: 'checkbox' });
    const form = h('form', { novalidate: true, onsubmit: async e => {
      e.preventDefault(); err.replaceChildren();
      try {
        if (mode === 'login') await api('POST', '/login', { handle: handle.value.trim(), password: pw.value });
        else await api('POST', '/register', { handle: handle.value.trim(), password: pw.value, consent: consent.checked });
        await boot();
      } catch (ex) { err.append(banner('error', ex.message)); }
    } },
      h('div', { class: 'field' },
        h('label', { for: 'handle' }, mode === 'login' ? 'Your name on Easeway' : 'Choose a name'),
        handle,
        mode === 'register' && h('p', { class: 'hint' }, 'Pick anything you like except your real name or email. 3-20 letters, numbers or underscores.')),
      h('div', { class: 'field' },
        h('label', { for: 'pw' }, 'Password'), pw,
        mode === 'register' && h('p', { class: 'hint' }, 'At least 8 characters. There is no email, so Easeway cannot reset it. Keep it safe.')),
      mode === 'register' && h('div', { class: 'consent' },
        h('strong', {}, 'Before you start'),
        h('ul', {},
          h('li', {}, 'Easeway stores your chosen name, a scrambled password, your check-in scores and optional notes (notes are encrypted).'),
          h('li', {}, 'It does not ask for your real name, email, roll number or location.'),
          h('li', {}, 'Only you can see your scores and notes. Counsellors see your chosen name only on an appointment you book, and campus averages only when at least 5 students contributed.'),
          h('li', {}, 'You can turn consent off or delete everything at any time under Privacy.'),
          h('li', {}, 'Easeway is not a medical service. It cannot diagnose or treat anything.')),
        h('label', { for: 'consent' }, consent, 'I have read this and agree to Easeway storing my check-ins.')),
      err,
      h('button', { class: 'btn', type: 'submit' }, mode === 'login' ? 'Sign in' : 'Create account'));
    box.append(
      h('div', { class: 'seg', role: 'group', 'aria-label': 'Sign in or create account' },
        h('button', { type: 'button', 'aria-pressed': mode === 'login', onclick: () => { mode = 'login'; draw(); } }, 'Sign in'),
        h('button', { type: 'button', 'aria-pressed': mode === 'register', onclick: () => { mode = 'register'; draw(); } }, 'Create account')),
      form);
  }
  draw();
  return h('main', { id: 'main', class: 'auth', tabindex: '-1' },
    h('section', { class: 'auth-intro' },
      h('h1', {}, 'A quiet place to check in with yourself.'),
      h('p', {}, 'Log how you feel in ten seconds, read short practical guides, and book a confidential session with a campus counsellor when you want one.'),
      h('ul', { class: 'promises' },
        h('li', {}, h('strong', {}, 'No real name needed'), 'Use any name you like. Easeway never asks for your email or roll number.'),
        h('li', {}, h('strong', {}, 'Your notes stay yours'), 'Only you can read them. They are encrypted where they are stored.'),
        h('li', {}, h('strong', {}, 'Leave whenever you want'), 'Delete your account and everything attached to it in one step.'))),
    box);
}

/* ---------- student: check-in ---------- */
async function checkinView(root) {
  const score = { v: null };
  const result = h('div', { 'aria-live': 'polite' });
  const err = h('div', {});
  const fs = h('fieldset', { class: 'moods' }, h('legend', {}, 'How are you feeling right now?'),
    MOODS.map((label, i) => h('div', { class: 'mood-opt' },
      h('input', { type: 'radio', name: 'mood', id: 'm' + (i + 1), value: i + 1, onchange: () => { score.v = i + 1; } }),
      h('label', { for: 'm' + (i + 1) }, h('span', { class: 'dot', 'aria-hidden': 'true' }, String(i + 1)), label))));
  const note = h('textarea', { id: 'note', maxlength: '500' });
  const save = h('button', { class: 'btn', type: 'submit' }, 'Save check-in');
  const form = h('form', { novalidate: true, onsubmit: async e => {
    e.preventDefault(); err.replaceChildren(); result.replaceChildren();
    if (!score.v) { err.append(banner('error', 'Pick how you are feeling, from 1 to 5.')); return; }
    save.disabled = true;
    try {
      const r = await api('POST', '/mood', { score: score.v, note: note.value.trim() || null });
      say('Check-in saved.');
      result.append(banner('ok', 'Saved. Thank you for checking in.'));
      if (r.support.show) result.append(supportCard(r.support.helplines));
      form.reset(); score.v = null;
    } catch (ex) { err.append(banner('error', ex.message)); }
    save.disabled = false;
  } }, fs,
    h('div', { class: 'field' }, h('label', { for: 'note' }, 'Anything you want to remember about today? (optional)'), note,
      h('p', { class: 'hint' }, 'Only you can read this. Up to 500 characters.')),
    err, save);
  put(root, h('h1', {}, 'Check in'),
    !me.consent && banner('error', 'Consent is turned off, so check-ins cannot be saved. Turn it back on under Privacy.'),
    h('div', { class: 'card' }, form), result);
}

function supportCard(helplines) {
  return h('section', { class: 'support', 'aria-labelledby': 'sup-h' },
    h('h2', { id: 'sup-h' }, 'Support is available right now'),
    h('p', {}, 'That sounds like a hard day. If you are thinking about harming yourself, or you are in danger, please contact someone now. You do not have to handle this alone.'),
    h('ul', {}, helplines.map(l => h('li', {}, h('div', {}, l.name), /^[\d+ ]+$/.test(l.number) ? h('a', { href: 'tel:' + l.number.replace(/\s/g, '') }, l.number) : h('div', { class: 'fine' }, l.number)))),
    h('button', { class: 'btn', type: 'button', onclick: () => { view = 'book'; render(true); } }, 'Book a counsellor'),
    h('p', { class: 'fine' }, 'This message appears when a check-in is low. It is not a diagnosis, and nobody else was told.'));
}

/* ---------- student: trend ---------- */
function dailyAverages(entries) {
  const m = new Map();
  for (const e of entries) { const a = m.get(e.day) || []; a.push(e.score); m.set(e.day, a); }
  return [...m].map(([day, a]) => ({ day, avg: a.reduce((x, y) => x + y, 0) / a.length }));
}

function lineChart(points) {
  const W = 640, H = 260, L = 70, R = 16, T = 16, B = 34;
  const svg = s('svg', { class: 'chart', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `Line chart of your daily mood average over the last 30 days. Latest: ${points.at(-1).avg.toFixed(1)} out of 5.` });
  const y = v => T + (5 - v) / 4 * (H - T - B);
  for (let v = 1; v <= 5; v++) {
    svg.append(s('line', { class: 'grid', x1: L, x2: W - R, y1: y(v), y2: y(v) }));
    svg.append(s('text', { x: L - 10, y: y(v) + 4, 'text-anchor': 'end' }, MOODS[v - 1]));
  }
  const t0 = new Date(points[0].day).getTime(), t1 = new Date(points.at(-1).day).getTime();
  const x = d => points.length === 1 ? (L + W - R) / 2 : L + (new Date(d).getTime() - t0) / (t1 - t0) * (W - L - R);
  svg.append(s('path', { class: 'line', d: points.map((p, i) => `${i ? 'L' : 'M'}${x(p.day).toFixed(1)} ${y(p.avg).toFixed(1)}`).join(' ') }));
  points.forEach(p => svg.append(s('circle', { class: 'pt', cx: x(p.day), cy: y(p.avg), r: 5 })));
  const idx = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])];
  idx.forEach(i => svg.append(s('text', { x: x(points[i].day), y: H - 10, 'text-anchor': i === 0 && points.length > 1 ? 'start' : i === points.length - 1 && points.length > 1 ? 'end' : 'middle' }, fmtDay(points[i].day))));
  return svg;
}

async function trendView(root) {
  const { entries } = await api('GET', '/mood');
  put(root, h('h1', {}, 'My trend'));
  if (!entries.length) {
    put(root, h('div', { class: 'card' }, h('p', {}, 'Nothing here yet. Your chart appears after your first check-in.'),
      h('button', { class: 'btn', type: 'button', onclick: () => { view = 'checkin'; render(true); } }, 'Check in now')));
    return;
  }
  const pts = dailyAverages(entries);
  const avg = entries.reduce((a, e) => a + e.score, 0) / entries.length;
  put(root, 
    h('div', { class: 'card' },
      h('div', { class: 'stat' },
        h('div', {}, h('b', {}, avg.toFixed(1)), '30-day average'),
        h('div', {}, h('b', {}, String(entries.length)), entries.length === 1 ? 'check-in' : 'check-ins'),
        h('div', {}, h('b', {}, String(pts.length)), 'days logged')),
      lineChart(pts),
      h('p', { class: 'hint' }, 'If a day has more than one check-in, the chart shows the average. This is for your own awareness, not a diagnosis.'),
      h('details', {}, h('summary', {}, 'View as table'),
        h('table', { class: 'data' }, h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Day'), h('th', { scope: 'col' }, 'Mood'), h('th', { scope: 'col' }, 'Note'))),
          h('tbody', {}, [...entries].reverse().map(e => h('tr', {}, h('td', {}, fmtDay(e.day)), h('td', {}, `${e.score} – ${MOODS[e.score - 1]}`), h('td', {}, e.note || '')))))))
  );
}

/* ---------- student: resources ---------- */
async function resourcesView(root) {
  const { resources } = await api('GET', '/resources');
  const topics = ['All', ...new Set(resources.map(r => r.topic))];
  let active = 'All';
  const grid = h('div', { class: 'res' });
  const bar = h('div', { class: 'filters', role: 'group', 'aria-label': 'Filter by topic' });
  function draw() {
    bar.replaceChildren(...topics.map(t => h('button', { type: 'button', 'aria-pressed': t === active, onclick: () => { active = t; draw(); say(`Showing ${t} guides`); } }, t)));
    grid.replaceChildren(...resources.filter(r => active === 'All' || r.topic === active).map(r =>
      h('article', {}, h('span', { class: 'pill' }, r.topic), h('h3', {}, r.title), h('p', {}, r.body), h('p', { class: 'hint' }, `${r.minutes} min read`))));
  }
  draw();
  put(root, h('h1', {}, 'Resources'), h('p', {}, 'Short, practical guides you can use today.'), bar, grid);
}

/* ---------- student: counsellor booking ---------- */
async function bookView(root) {
  const msg = h('div', { 'aria-live': 'polite' });
  const [{ slots }, { appointments }] = await Promise.all([api('GET', '/slots'), api('GET', '/appointments')]);
  const mine = h('div', { class: 'card' }, h('h2', {}, 'Your appointments'),
    appointments.length
      ? h('ul', { class: 'list' }, appointments.map(a => h('li', {},
          h('span', {}, `${fmtDate(a.start_at)}, ${fmtTime(a.start_at)} with ${a.counsellor}`),
          h('button', { class: 'btn btn-quiet', type: 'button', onclick: async () => {
            try { await api('DELETE', '/appointments/' + a.id); say('Appointment cancelled.'); render(); } catch (ex) { msg.replaceChildren(banner('error', ex.message)); }
          } }, 'Cancel'))))
      : h('p', {}, 'No upcoming appointments.'));
  const byDay = new Map();
  for (const sl of slots) { const k = fmtDate(sl.start_at); (byDay.get(k) || byDay.set(k, []).get(k)).push(sl); }
  const free = h('div', { class: 'card' }, h('h2', {}, 'Available times'),
    h('p', {}, 'Sessions are confidential. The counsellor sees only the name you chose.'),
    slots.length ? [...byDay].map(([day, list]) => h('section', { class: 'day-group' }, h('h3', {}, day),
      h('ul', { class: 'list' }, list.map(sl => h('li', {}, h('span', {}, `${fmtTime(sl.start_at)} with ${sl.counsellor}`),
        h('button', { class: 'btn', type: 'button', onclick: async () => {
          try { await api('POST', `/slots/${sl.id}/book`); say('Appointment booked.'); render(); } catch (ex) { msg.replaceChildren(banner('error', ex.message)); }
        } }, 'Book')))))) : h('p', {}, 'No times are open right now. Check back soon.'));
  put(root, h('h1', {}, 'Counsellor'), !me.consent && banner('error', 'Consent is turned off, so booking is paused. Turn it back on under Privacy.'), msg, mine, free);
}

/* ---------- student: privacy ---------- */
async function privacyView(root) {
  const msg = h('div', { 'aria-live': 'polite' });
  const pw = h('input', { id: 'delpw', type: 'password', autocomplete: 'current-password' });
  const confirmBox = h('input', { id: 'delok', type: 'checkbox' });
  put(root, h('h1', {}, 'Privacy'),
    h('div', { class: 'card' }, h('h2', {}, 'What Easeway stores'),
      h('ul', {}, h('li', {}, 'Your chosen name and a scrambled password.'), h('li', {}, 'Your check-in scores, dates and optional notes. Notes are encrypted.'),
        h('li', {}, 'Appointments you book.')),
      h('p', {}, 'It does not store your real name, email, roll number, location or device details.')),
    h('div', { class: 'card' }, h('h2', {}, 'Consent'),
      h('p', {}, me.consent ? 'Consent is on. Easeway can save your check-ins and bookings.' : 'Consent is off. Easeway will not save new check-ins or bookings. Your existing data is kept until you delete it.'),
      msg,
      h('button', { class: 'btn btn-quiet', type: 'button', onclick: async () => {
        try { const r = await api('POST', '/consent', { granted: !me.consent }); me.consent = r.consent; say(r.consent ? 'Consent turned on.' : 'Consent turned off.'); render(true); } catch (ex) { msg.replaceChildren(banner('error', ex.message)); }
      } }, me.consent ? 'Turn consent off' : 'Turn consent on')),
    h('div', { class: 'card' }, h('h2', {}, 'Delete my account'),
      h('p', {}, 'This permanently removes your account, every check-in and note, and cancels your appointments. It cannot be undone.'),
      h('form', { novalidate: true, onsubmit: async e => {
        e.preventDefault();
        if (!confirmBox.checked) { msg.replaceChildren(banner('error', 'Tick the box to confirm you want to delete everything.')); return; }
        try { await api('DELETE', '/account', { password: pw.value }); me = null; render(); alert('Your account and all your data have been deleted.'); }
        catch (ex) { msg.replaceChildren(banner('error', ex.message)); }
      } },
        h('div', { class: 'field' }, h('label', { for: 'delpw' }, 'Enter your password to confirm'), pw),
        h('div', { class: 'field' }, h('label', { for: 'delok' }, confirmBox, ' I understand this deletes all my data.')),
        h('button', { class: 'btn btn-danger', type: 'submit' }, 'Delete everything'))));
}

/* ---------- counsellor ---------- */
async function cAppts(root) {
  const { appointments } = await api('GET', '/counsellor/appointments');
  const byDay = new Map();
  for (const a of appointments) { const k = fmtDate(a.start_at); (byDay.get(k) || byDay.set(k, []).get(k)).push(a); }
  put(root, h('h1', {}, 'Appointments'),
    h('p', {}, 'You see only the name each student chose. Check-in scores and notes are never shown here.'),
    h('div', { class: 'card' }, appointments.length
      ? [...byDay].map(([day, list]) => h('section', { class: 'day-group' }, h('h3', {}, day),
          h('ul', { class: 'list' }, list.map(a => h('li', {}, h('span', {}, fmtTime(a.start_at)), h('span', { class: 'pill' }, a.student))))))
      : h('p', {}, 'No booked appointments yet.')));
}

function barChart(days, k) {
  const W = 640, H = 260, L = 40, R = 10, T = 14, B = 34;
  const svg = s('svg', { class: 'chart', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Bar chart of campus daily average mood. Days with fewer than ' + k + ' students are hidden.' });
  const y = v => T + (5 - v) / 5 * (H - T - B);
  for (let v = 0; v <= 5; v++) { svg.append(s('line', { class: 'grid', x1: L, x2: W - R, y1: y(v), y2: y(v) })); svg.append(s('text', { x: L - 8, y: y(v) + 4, 'text-anchor': 'end' }, String(v))); }
  const slot = (W - L - R) / days.length, bw = Math.min(30, slot * 0.64);
  days.forEach((d, i) => {
    const cx = L + slot * i + slot / 2;
    if (d.suppressed) svg.append(s('rect', { class: 'hidden', x: cx - bw / 2, y: y(5), width: bw, height: y(0) - y(5) }));
    else svg.append(s('rect', { class: 'bar', x: cx - bw / 2, y: y(d.avg), width: bw, height: y(0) - y(d.avg), rx: 3 }));
    if (i % 2 === 0 || days.length < 8) svg.append(s('text', { x: cx, y: H - 10, 'text-anchor': 'middle' }, fmtDay(d.day)));
  });
  return svg;
}

async function cTrends(root) {
  const t = await api('GET', '/counsellor/trends');
  const shown = t.days.filter(d => !d.suppressed);
  put(root, h('h1', {}, 'Campus trends'),
    h('p', {}, `Averages appear only on days when at least ${t.k} different students checked in, so no individual can be picked out.`),
    h('div', { class: 'card' },
      h('div', { class: 'stat' },
        h('div', {}, h('b', {}, String(t.students)), 'registered students'),
        h('div', {}, h('b', {}, String(t.upcomingBookings)), 'upcoming bookings'),
        h('div', {}, h('b', {}, shown.length ? (shown.reduce((a, d) => a + d.avg, 0) / shown.length).toFixed(1) : '–'), 'mean of shown days')),
      t.days.length ? [barChart(t.days, t.k), h('div', { class: 'legend' }, h('span', {}, 'Daily average (out of 5)'), h('span', { class: 'h' }, `Hidden: fewer than ${t.k} students`))]
        : h('p', {}, 'No check-ins yet.'),
      t.days.length > 0 && h('details', {}, h('summary', {}, 'View as table'),
        h('table', { class: 'data' }, h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Day'), h('th', { scope: 'col' }, 'Average'), h('th', { scope: 'col' }, 'Students'))),
          h('tbody', {}, t.days.map(d => h('tr', {}, h('td', {}, fmtDay(d.day)), h('td', {}, d.suppressed ? 'Hidden' : d.avg.toFixed(2)), h('td', {}, d.suppressed ? `< ${t.k}` : String(d.n)))))))));
}

boot();
