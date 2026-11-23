// Grand Prix Ambition – Termin-Rennen fürs Team (Node ≥ 18, keine Pflicht-Abhängigkeit)
// Speicher: Upstash Redis (empfohlen), Postgres (DATABASE_URL) oder Datei data.json
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

const PORT = process.env.PORT || 3000;
const ADMIN_USER = process.env.ADMIN_USER || 'XY';             // Login Rennleitung – auf dem Server ändern!
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'XY';
const ENV_ACCESS_CODE = process.env.ACCESS_CODE || '';          // optional: Team-Code (kann auch im Backend gesetzt werden)
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data.json');
const PUBLIC = path.join(__dirname, 'public');

const defaultState = () => ({
  settings: { title: 'Grand Prix Ambition 2026', startDate: '2026-10-15', endDate: '2026-12-24', accessCode: '', lockGoals: true, quietFrom: '19:00', quietTo: '08:00', quietWeekend: true },
  people: [],   // {id, name, goal, look, createdAt}
  entries: []   // {id, personId, ts, delta, by}
});

// ---------- Speicher ----------
// Reihenfolge: Upstash Redis (UPSTASH_REDIS_REST_URL + _TOKEN) → Postgres (DATABASE_URL) → Datei data.json
let state = defaultState();
let pool = null;
const UP_URL = (process.env.UPSTASH_REDIS_REST_URL || '').replace(/\/+$/, '');
const UP_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';
const UP_KEY = process.env.UPSTASH_KEY || 'grand-prix-ambition:state';   // eigener Schlüssel → DB kann mit anderen Apps geteilt werden
const useUpstash = !!(UP_URL && UP_TOKEN);
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function upstash(cmd, tries = 3) {
  let err;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(UP_URL, { method: 'POST', headers: { Authorization: 'Bearer ' + UP_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd), signal: AbortSignal.timeout(10000) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.error) throw new Error('Upstash ' + r.status + ': ' + (j.error || r.statusText));
      return j.result;
    } catch (e) { err = e; if (/WRONGPASS|401|403/.test(e.message)) break; await sleep(700 * (i + 1)); }
  }
  throw err;
}
let storeLabel = 'Datei';
async function load() {
  if (useUpstash) {
    // Wichtig: Schlägt das Laden fehl, startet der Server NICHT mit leerem Stand (sonst würde er die Daten überschreiben)
    const raw = await upstash(['GET', UP_KEY], 6);
    if (raw) state = { ...defaultState(), ...JSON.parse(raw) };
    storeLabel = 'Upstash Redis';
  } else if (process.env.DATABASE_URL) {
    const { Pool } = require('pg');
    pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSL === 'off' ? false : { rejectUnauthorized: false } });
    await pool.query('CREATE TABLE IF NOT EXISTS app_state (id int PRIMARY KEY, data jsonb NOT NULL)');
    const r = await pool.query('SELECT data FROM app_state WHERE id = 1');
    if (r.rows[0]) state = { ...defaultState(), ...r.rows[0].data };
    storeLabel = 'Postgres';
  } else {
    try { state = { ...defaultState(), ...JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) }; } catch (e) { /* neu */ }
    console.log('⚠️  Speicher: Datei ' + DATA_FILE + ' – auf Render Free NICHT dauerhaft! UPSTASH_REDIS_REST_URL/_TOKEN setzen.');
  }
  console.log('Speicher: ' + storeLabel + (useUpstash ? ' (Schlüssel ' + UP_KEY + ')' : '') + ' · ' + state.people.length + ' Personen, ' + state.entries.length + ' Einträge');
  state.settings = { ...defaultState().settings, ...state.settings };
}
let saveTimer = null, saving = null, dirty = false, lastBackupDay = '';
async function writeNow() {
  if (!dirty) return; dirty = false;
  const json = JSON.stringify(state);
  try {
    if (useUpstash) {
      await upstash(['SET', UP_KEY, json]);
      const day = new Date().toISOString().slice(0, 10);   // eine Sicherungskopie pro Tag, 45 Tage aufbewahrt
      if (day !== lastBackupDay) { await upstash(['SET', UP_KEY + ':backup:' + day, json, 'EX', String(45 * 86400)]); lastBackupDay = day; }
    } else if (pool) await pool.query('INSERT INTO app_state (id, data) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET data = $1', [state]);
    else fs.writeFileSync(DATA_FILE, json);
  } catch (e) { dirty = true; console.error('Speichern fehlgeschlagen – neuer Versuch in 5 s:', e.message); clearTimeout(saveTimer); saveTimer = setTimeout(flush, 5000); }
}
function flush() { saving = (saving || Promise.resolve()).then(writeNow); return saving; }
function save() { state.rev = Math.max(Date.now(), (state.rev || 0) + 1); dirty = true; clearTimeout(saveTimer); saveTimer = setTimeout(flush, 300); }
// Render stoppt den Dienst (Schlafmodus/Deploy) mit SIGTERM: vorher noch speichern
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, async () => { clearTimeout(saveTimer); try { await flush(); } finally { process.exit(0); } });

// Öffentliche Sicht: ohne Zugangscode
const publicState = () => ({ ...state, settings: { ...state.settings, accessCode: undefined } });
const accessCode = () => state.settings.accessCode || ENV_ACCESS_CODE;

// ---------- Live-Updates (Server-Sent Events) ----------
const clients = new Set();
function broadcast(event) {
  const pub = `data: ${JSON.stringify({ state: publicState(), event })}\n\n`;
  const adm = `data: ${JSON.stringify({ state, event })}\n\n`;
  for (const c of clients) c.res.write(c.admin ? adm : pub);
}
setInterval(() => { for (const c of clients) c.res.write(': ping\n\n'); }, 15000);

// ---------- Rennleitung: Login & Sitzungen ----------
const sessions = new Map();               // token → Ablaufzeit
const attempts = new Map();               // IP → [Zeitstempel]
const SESSION_MS = 12 * 3600e3;
const safeEq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
function tokenOf(req) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7);
  return new URL(req.url, 'http://x').searchParams.get('token') || '';
}
function isAdmin(req) {
  const t = tokenOf(req), exp = t && sessions.get(t);
  if (!exp) return false;
  if (exp < Date.now()) { sessions.delete(t); return false; }
  return true;
}
const ipOf = req => (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

// ---------- Wetter Bern ----------
// 1. MeteoSwiss Open Data, Station Bern-Zollikofen (BER): echte 10-Minuten-Messwerte, frei nutzbar mit Quellenangabe
// 2. Ersatz: Open-Meteo (Modellwerte, ohne Schlüssel)  ·  alle 10 Minuten zwischengespeichert
const WX_STATION = (process.env.WEATHER_STATION || 'ber').toLowerCase();
let wx = { ts: 0, data: { live: false } }, smnUrl = null;
const tmo = ms => AbortSignal.timeout(ms);
function parseCsv(txt) {
  const lines = txt.replace(/\r/g, '').split('\n').filter(Boolean); if (lines.length < 2) return [];
  const sep = lines[0].includes(';') ? ';' : ',', head = lines[0].split(sep).map(h => h.trim().toLowerCase());
  return lines.slice(1).map(l => { const v = l.split(sep); const o = {}; head.forEach((h, i) => o[h] = (v[i] || '').trim()); return o; });
}
const num = v => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };
function smnTime(s) { const m = String(s).match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})/); if (m) return new Date(Date.UTC(+m[3], m[2] - 1, +m[1], +m[4], +m[5])).toISOString();
  const d = new Date(s); return isNaN(d) ? null : d.toISOString(); }
async function fromMeteoSwiss() {
  if (!smnUrl) {   // Datei-Adresse über den STAC-Katalog ermitteln (robust gegen Namensänderungen)
    const r = await fetch(`https://data.geo.admin.ch/api/stac/v1/collections/ch.meteoschweiz.ogd-smn/items/${WX_STATION}`, { signal: tmo(6000) });
    const assets = (await r.json()).assets || {};
    const hit = Object.entries(assets).find(([k, v]) => /_t_now\.csv$/i.test(k) || /_t_now\.csv$/i.test((v && v.href) || ''));
    smnUrl = hit ? hit[1].href : `https://data.geo.admin.ch/ch.meteoschweiz.ogd-smn/${WX_STATION}/ogd-smn_${WX_STATION}_t_now.csv`;
  }
  const rows = parseCsv(await (await fetch(smnUrl, { signal: tmo(8000) })).text()).filter(r => num(r.tre200s0) !== null);
  if (!rows.length) throw new Error('keine Messwerte');
  const last = rows[rows.length - 1], hour = rows.slice(-6);   // letzte Stunde
  const temp = num(last.tre200s0), wind = num(last.fu3010z0), rain = num(last.rre150z0) || 0, sun = num(last.sre000z0), rad = num(last.gre000z0);
  const rainHour = hour.reduce((s, r) => s + (num(r.rre150z0) || 0), 0), sunHour = hour.reduce((s, r) => s + (num(r.sre000z0) || 0), 0);
  // Wetterlage aus Messwerten ableiten (WMO-Codes, damit die 3D-Welt sie versteht)
  const day = rad !== null ? rad > 20 : null;
  let code = 1, cloud = null;
  if (rain > 0.05 || rainHour > 0.3) code = temp !== null && temp < 1 ? 71 : rainHour > 2 ? 63 : 61;
  else if (day) { cloud = Math.max(0, Math.min(100, Math.round(100 - sunHour / 60 * 100))); code = cloud < 20 ? 0 : cloud < 50 ? 1 : cloud < 85 ? 2 : 3; }
  return { live: true, source: 'MeteoSwiss', station: 'Bern-Zollikofen', temp, wind, rain: Math.round(rainHour * 10) / 10, sun: sunHour, cloud, code, time: smnTime(last.reference_timestamp || last.time) };
}
async function fromOpenMeteo() {
  const r = await fetch('https://api.open-meteo.com/v1/forecast?latitude=46.948&longitude=7.447&current=temperature_2m,weather_code,wind_speed_10m,cloud_cover,precipitation,is_day&timezone=Europe%2FZurich', { signal: tmo(6000) });
  const c = (await r.json()).current; if (typeof c.temperature_2m !== 'number') throw new Error('keine Daten');
  return { live: true, source: 'Open-Meteo', station: 'Bern', temp: c.temperature_2m, code: c.weather_code, wind: c.wind_speed_10m, cloud: c.cloud_cover, rain: c.precipitation, time: c.time };
}
async function weather() {
  if (Date.now() - wx.ts < 10 * 60e3) return wx.data;
  for (const src of [fromMeteoSwiss, fromOpenMeteo]) {
    try { const d = await src(); wx = { ts: Date.now(), data: d }; return d; }
    catch (e) { if (src === fromMeteoSwiss) smnUrl = null; console.warn('Wetter', src.name, e.message); }
  }
  wx = { ts: Date.now() - 8 * 60e3, data: wx.data && wx.data.live ? wx.data : { live: false } };
  return wx.data;
}

// ---------- Helfer ----------
const id = () => crypto.randomBytes(6).toString('hex');
const clean = (s, n) => String(s || '').replace(/[<>]/g, '').trim().slice(0, n);
function send(res, code, obj) {
  const q = res._req;   // abgelehnte Anfragen protokollieren (hilft bei Firmennetz-Problemen)
  if (q && code >= 400 && !(code === 401 && q.method === 'GET')) { const ua = String(q.headers['user-agent'] || ''), dev = /Mobile|Android|iPhone/.test(ua) ? 'Handy' : 'PC', br = (ua.match(/(Edg|Chrome|Firefox|Safari)\/[\d]+/) || [''])[0];
    console.log(`⚠️ ${code} ${q._orig || q.method}→${q.method} ${res._path} · ${dev} ${br} · ${obj && obj.error || ''}`); }
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); }
function body(req) {
  if (req._body) return Promise.resolve(req._body);
  return new Promise((resolve) => {
    let b = ''; req.on('data', c => { b += c; if (b.length > 5e6) req.destroy(); });
    req.on('end', () => { try { resolve(b ? JSON.parse(b) : {}); } catch { resolve({}); } });
  });
}
function hasAccess(req) {
  const code = accessCode();
  if (!code || isAdmin(req)) return true;
  return req.headers['x-access-code'] === code || new URL(req.url, 'http://x').searchParams.get('code') === code;
}
const count = pid => state.entries.filter(e => e.personId === pid).reduce((s, e) => s + e.delta, 0);
const validDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d || '');

// Aussehen der Figur prüfen (nur erlaubte Werte)
const LOOK = {
  vehicle: ['rocket', 'snail', 'turtle', 'cow', 'tub', 'cheese', 'mower', 'banana', 'cart', 'unicorn'],
  hat: ['none', 'helmet', 'cap', 'crown', 'tophat', 'party', 'viking', 'santa', 'antlers'],
  glasses: ['none', 'sun', 'ski'],
  skin: ['#f6d3b3', '#e8b48f', '#c98e62', '#9a6440', '#6b4126'],
  hair: ['short', 'bob', 'long', 'curly', 'ponytail', 'bun', 'afro', 'spiky', 'bald'],
  pattern: ['solid', 'racing', 'rings', 'checker', 'number', 'flames', 'gold']
};
const HAIR_COLORS = ['#1d1a17', '#3b2a1e', '#6b4423', '#8a3b1f', '#c0461b', '#d9b45a', '#ece0b8', '#9a9a9a', '#ff6fae', '#4ea8de'];
const isColor = c => /^#[0-9a-f]{6}$/i.test(c || '');
const makeInitials = name => String(name || '').split(/\s+/).map(w => w[0] || '').join('').slice(0, 3).toUpperCase();
const cleanInitials = s => String(s || '').toUpperCase().replace(/[^A-ZÄÖÜ0-9]/g, '').slice(0, 3);
function cleanLook(b, old) {
  const l = { ...(old || {}) };
  b = b || {};
  for (const k of ['vehicle', 'hat', 'glasses', 'hair', 'pattern']) if (LOOK[k].includes(b[k])) l[k] = b[k];
  if (LOOK.skin.includes(b.skin)) l.skin = b.skin;
  for (const k of ['color', 'suit', 'suit2', 'hairColor']) if (isColor(b[k])) l[k] = b[k].toLowerCase();
  for (const k of ['flag', 'goldPaint']) if (typeof b[k] === 'boolean') l[k] = b[k];
  if (typeof b.initials === 'string') { const i = cleanInitials(b.initials); if (i) l.initials = i; }
  if (!LOOK.vehicle.includes(l.vehicle)) l.vehicle = 'rocket';
  if (!LOOK.glasses.includes(l.glasses)) l.glasses = 'none';
  delete l.scarf; delete l.number;
  return l;
}
const PALETTE = ['#e63946', '#f4a261', '#ffd23f', '#2a9d8f', '#3a86ff', '#8338ec', '#ff006e', '#06d6a0', '#1d3557', '#f1f1f1'];
const pick = a => a[Math.floor(Math.random() * a.length)];
const randomLook = () => ({ vehicle: pick(LOOK.vehicle), color: pick(PALETTE), suit: pick(PALETTE), skin: pick(LOOK.skin),
  hat: pick(['helmet', 'cap', 'crown', 'tophat', 'party', 'viking', 'santa', 'none', 'none']), glasses: pick(LOOK.glasses),
  hair: pick(LOOK.hair), hairColor: pick(HAIR_COLORS), suit2: pick(PALETTE), pattern: pick(LOOK.pattern) });

function addPerson(b) {
  const name = clean(b.name, 30);
  const g = parseInt(b.goal, 10);
  if (!name || !(g >= 1)) return { error: 'Bitte Name und Ambitionsniveau (mind. 1 Termin) angeben' };
  const goal = Math.min(9999, g);
  if (state.people.some(x => x.name.toLowerCase() === name.toLowerCase())) return { error: 'Name existiert schon', code: 409 };
  if (state.people.length >= 60) return { error: 'Maximal 60 Personen' };
  const person = { id: id(), name, goal, look: guardRewards({ id: '', goal, look: {} }, cleanLook(b.look, { ...randomLook(), initials: makeInitials(name) })), createdAt: new Date().toISOString() };
  state.people.push(person); save(); broadcast({ type: 'join', personId: person.id });
  return { person };
}
// Belohnungen: werden bei 25/50/75/100 % des Ambitionsniveaus freigeschaltet (auch der Server prüft das)
const REWARDS = [{ at: .25, has: l => l.hat === 'antlers' }, { at: .5, has: l => l.pattern === 'gold' }, { at: .75, has: l => !!l.flag }, { at: 1, has: l => !!l.goldPaint }];
function guardRewards(person, next) {
  const p = count(person.id) / (person.goal || 1), old = person.look || {};
  if (p < .25 && next.hat === 'antlers' && old.hat !== 'antlers') next.hat = old.hat || 'helmet';
  if (p < .5 && next.pattern === 'gold' && old.pattern !== 'gold') next.pattern = old.pattern || 'racing';
  if (p < .75 && next.flag && !old.flag) next.flag = false;
  if (p < 1 && next.goldPaint && !old.goldPaint) next.goldPaint = false;
  return next;
}
function editPerson(person, b, admin) {
  if (b.goal !== undefined && (admin || !state.settings.lockGoals)) person.goal = Math.max(1, Math.min(9999, parseInt(b.goal, 10) || person.goal));
  if (b.name !== undefined) {
    const nn = clean(b.name, 30);
    if (nn && !state.people.some(x => x.id !== person.id && x.name.toLowerCase() === nn.toLowerCase())) person.name = nn;
  }
  if (b.look) person.look = admin ? cleanLook(b.look, person.look) : guardRewards(person, cleanLook(b.look, person.look));
  save(); broadcast({ type: 'edit', personId: person.id });
}

const gzCache = new Map();
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };

// ---------- Server ----------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  let p = url.pathname;
  res._req = req; res._path = p; req._orig = req.method;
  // Firmennetze: manche Proxys lassen nur GET/POST durch. Ersatzwege:
  //  · POST mit X-HTTP-Method-Override (PATCH/DELETE)
  //  · GET /api/do?m=POST&p=/api/...&b={json} (wenn sogar POST blockiert wird)
  const ov = String(req.headers['x-http-method-override'] || url.searchParams.get('_method') || '').toUpperCase();
  if (req.method === 'POST' && (ov === 'PATCH' || ov === 'DELETE')) req.method = ov;
  if (p === '/api/do' && req.method === 'GET') {
    const m = String(url.searchParams.get('m') || '').toUpperCase(), p2 = String(url.searchParams.get('p') || '');
    if (!['POST', 'PATCH', 'DELETE'].includes(m) || !/^\/api\/(people|admin)\//.test(p2 + '/') || !hasAccess(req) && !isAdmin(req)) return send(res, 400, { error: 'Ungültig' });
    try { req._body = JSON.parse(url.searchParams.get('b') || '{}'); } catch { req._body = {}; }
    req.method = m; p = p2; res._path = '/api/do→' + p2;
  }

  if (!p.startsWith('/api/')) {
    const rel = p === '/' ? 'index.html' : (p === '/admin' || p === '/admin/') ? 'admin.html' : path.normalize(p).replace(/^(\.\.[/\\])+/, '');
    const file = path.join(PUBLIC, rel);
    if (!file.startsWith(PUBLIC)) return send(res, 403, {});
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end('Nicht gefunden'); }
      const head = { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'X-Frame-Options': 'SAMEORIGIN', 'Cache-Control': 'no-cache', Vary: 'Accept-Encoding' };
      if (/\bgzip\b/.test(req.headers['accept-encoding'] || '') && data.length > 1024) {   // komprimiert spart Datenvolumen
        const key = file + ':' + data.length; let gz = gzCache.get(key); if (!gz) { gz = zlib.gzipSync(data, { level: 9 }); gzCache.set(key, gz); }
        res.writeHead(200, { ...head, 'Content-Encoding': 'gzip' }); return res.end(gz); }
      res.writeHead(200, head); res.end(data);
    });
    return;
  }

  if (p === '/api/health') return send(res, 200, { ok: true, store: storeLabel });
  if (p === '/api/weather') return send(res, 200, await weather());

  // --- Login Rennleitung ---
  if (p === '/api/admin/login' && req.method === 'POST') {
    const ip = ipOf(req), now = Date.now();
    const list = (attempts.get(ip) || []).filter(t => now - t < 10 * 60e3);
    if (list.length >= 8) return send(res, 429, { error: 'Zu viele Versuche – bitte 10 Minuten warten' });
    const b = await body(req);
    if (safeEq(b.user || '', ADMIN_USER) && safeEq(b.password || '', ADMIN_PASSWORD)) {
      attempts.delete(ip);
      const token = crypto.randomBytes(24).toString('hex');
      sessions.set(token, now + SESSION_MS);
      return send(res, 200, { token, defaultLogin: ADMIN_USER === 'XY' && ADMIN_PASSWORD === 'XY' });
    }
    list.push(now); attempts.set(ip, list);
    return send(res, 401, { error: 'Benutzername oder Passwort falsch' });
  }
  if (p === '/api/admin/logout' && req.method === 'POST') { sessions.delete(tokenOf(req)); return send(res, 200, { ok: true }); }

  if (p === '/api/access') { const b = await body(req); const c = accessCode(); return send(res, 200, { ok: !c || b.code === c, required: !!c }); }
  if (!hasAccess(req)) return send(res, 401, { error: 'Zugangscode nötig' });

  if (p === '/api/state' && req.method === 'GET') return send(res, 200, publicState());
  if (p === '/api/rev') return send(res, 200, { rev: state.rev || 0 });   // winzige Abfrage: gibt es Neues?
  if (p === '/api/stream') {
    const admin = isAdmin(req);
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write(': ' + ' '.repeat(2048) + '\n\n');   // Polster: manche Firmen-Proxys geben Live-Daten erst nach 2 KB weiter
    res.write(`data: ${JSON.stringify({ state: admin ? state : publicState() })}\n\n`);
    const c = { res, admin }; clients.add(c); req.on('close', () => clients.delete(c));
    return;
  }

  // --- Teilnehmende (App) ---
  if (p === '/api/people' && req.method === 'POST') {
    const r = addPerson(await body(req));
    return r.error ? send(res, r.code || 400, { error: r.error }) : send(res, 201, r.person);
  }
  let m = p.match(/^\/api\/people\/([a-f0-9]+)(\/termin)?$/);
  if (m) {
    const person = state.people.find(x => x.id === m[1]);
    if (!person) return send(res, 404, { error: 'Person nicht gefunden' });
    if (m[2] && req.method === 'POST') {              // Termin +1 / -1
      const b = await body(req);
      const delta = b.delta === -1 ? -1 : 1;
      const before = count(person.id);
      if (delta === -1 && before <= 0) return send(res, 400, { error: 'Schon bei 0' });
      state.entries.push({ id: id(), personId: person.id, ts: new Date().toISOString(), delta, by: 'self' });
      save(); broadcast({ type: delta > 0 ? 'hit' : 'undo', personId: person.id, before, after: before + delta });
      return send(res, 200, { count: before + delta });
    }
    if (!m[2] && (req.method === 'PATCH' || req.method === 'POST')) { editPerson(person, await body(req), false); return send(res, 200, person); }
  }

  // --- Ab hier nur Rennleitung ---
  if (!p.startsWith('/api/admin/')) return send(res, 404, { error: 'Unbekannt' });
  if (!isAdmin(req)) return send(res, 403, { error: 'Bitte als Rennleitung anmelden' });

  if (p === '/api/admin/state') return send(res, 200, state);
  if (p === '/api/admin/people' && req.method === 'POST') {
    const r = addPerson(await body(req));
    return r.error ? send(res, r.code || 400, { error: r.error }) : send(res, 201, r.person);
  }
  m = p.match(/^\/api\/admin\/people\/([a-f0-9]+)(\/adjust)?$/);
  if (m) {
    const person = state.people.find(x => x.id === m[1]);
    if (!person) return send(res, 404, { error: 'Person nicht gefunden' });
    if (m[2] && req.method === 'POST') {             // Termine korrigieren (+/- n oder auf Wert setzen)
      const b = await body(req), before = count(person.id);
      let delta = parseInt(b.delta, 10);
      if (b.set !== undefined) delta = Math.max(0, parseInt(b.set, 10) || 0) - before;
      if (!delta) return send(res, 200, { count: before });
      if (before + delta < 0) delta = -before;
      state.entries.push({ id: id(), personId: person.id, ts: new Date().toISOString(), delta, by: 'admin' });
      save(); broadcast({ type: delta > 0 ? 'hit' : 'undo', personId: person.id, before, after: before + delta, admin: true });
      return send(res, 200, { count: before + delta });
    }
    if (!m[2] && (req.method === 'PATCH' || req.method === 'POST')) { editPerson(person, await body(req), true); return send(res, 200, person); }
    if (!m[2] && req.method === 'DELETE') {
      state.people = state.people.filter(x => x.id !== person.id);
      state.entries = state.entries.filter(e => e.personId !== person.id);
      save(); broadcast({ type: 'remove' });
      return send(res, 200, { ok: true });
    }
  }
  m = p.match(/^\/api\/admin\/entries\/([a-f0-9]+)$/);
  if (m && req.method === 'DELETE') {
    const before = state.entries.length;
    state.entries = state.entries.filter(e => e.id !== m[1]);
    if (state.entries.length === before) return send(res, 404, { error: 'Eintrag nicht gefunden' });
    save(); broadcast({ type: 'entry-removed' });
    return send(res, 200, { ok: true });
  }
  if (p === '/api/admin/settings' && req.method === 'POST') {
    const b = await body(req), s = state.settings;
    if (b.title) s.title = clean(b.title, 50);
    if (validDate(b.startDate)) s.startDate = b.startDate;
    if (validDate(b.endDate)) s.endDate = b.endDate;
    if (typeof b.lockGoals === 'boolean') s.lockGoals = b.lockGoals;
    if (typeof b.quietWeekend === 'boolean') s.quietWeekend = b.quietWeekend;
    for (const k of ['quietFrom', 'quietTo']) if (typeof b[k] === 'string' && (/^([01]\d|2[0-3]):[0-5]\d$/.test(b[k]) || b[k] === '')) s[k] = b[k];
    if (typeof b.accessCode === 'string') s.accessCode = clean(b.accessCode, 40);
    save(); broadcast({ type: 'settings' });
    return send(res, 200, s);
  }
  if (p === '/api/admin/import' && req.method === 'POST') {
    const b = await body(req);
    if (!Array.isArray(b.people) || !Array.isArray(b.entries)) return send(res, 400, { error: 'Ungültige Sicherung' });
    state = { ...defaultState(), ...b, settings: { ...defaultState().settings, ...(b.settings || {}) } };
    for (const x of state.people) x.look = cleanLook({}, { ...randomLook(), initials: makeInitials(x.name), ...(x.look || {}) });
    save(); broadcast({ type: 'import' });
    return send(res, 200, { ok: true });
  }
  if (p === '/api/admin/reset' && req.method === 'POST') {
    state.entries = []; save(); broadcast({ type: 'reset' });
    return send(res, 200, { ok: true });
  }
  send(res, 404, { error: 'Unbekannt' });
});

load().then(() => {
  for (const x of state.people) x.look = cleanLook({}, { ...randomLook(), initials: makeInitials(x.name), ...(x.look || {}) });
  if (ADMIN_USER === 'XY' && ADMIN_PASSWORD === 'XY') console.warn('⚠️  Rennleitung nutzt den Standard-Login XY/XY – ADMIN_USER und ADMIN_PASSWORD setzen!');
  server.listen(PORT, () => console.log('Grand Prix Ambition läuft auf Port ' + PORT));
}).catch(e => { console.error('❌ Start abgebrochen – Speicher nicht erreichbar oder Zugangsdaten falsch (UPSTASH_REDIS_REST_URL / _TOKEN prüfen). Es wurde nichts überschrieben.\n', e.message); process.exit(1); });
