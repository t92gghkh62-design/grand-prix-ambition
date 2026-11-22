// Testläufe gegen die echte App (läuft in GitHub Actions). Ergebnis → results/phaseN.md
import fs from 'node:fs';
const BASE = process.env.APP_URL, PHASE = fs.readFileSync('tests/plan.txt', 'utf8').trim();
const ADMIN = { user: process.env.ADMIN_USER || 'XY', password: process.env.ADMIN_PASSWORD || 'XY' };
const out = [], t0 = Date.now(); let fails = 0;
const log = (ok, msg) => { out.push(`${ok ? '✅' : '❌'} ${msg}`); if (!ok) fails++; console.log(ok ? 'OK  ' : 'FAIL', msg); };
const info = msg => { out.push(`ℹ️ ${msg}`); console.log('INFO', msg); };
async function req(method, path, body, token) {
  const s = Date.now();
  const r = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const txt = await r.text(); let j = null; try { j = JSON.parse(txt); } catch {}
  return { status: r.status, j, txt, ms: Date.now() - s, headers: r.headers };
}
const state = async () => (await req('GET', '/api/state')).j;
const cnt = (st, pid) => st.entries.filter(e => e.personId === pid).reduce((s, e) => s + e.delta, 0);
const PFX = 'Testlauf ';
async function login() { const r = await req('POST', '/api/admin/login', ADMIN); return r.j && r.j.token; }

async function phase1() {
  out.push('## Testlauf 1 – Grundfunktionen\n');
  let w = Date.now(), h; for (;;) { h = await req('GET', '/api/health').catch(() => null); if ((h && h.status === 200) || Date.now() - w > 120e3) break; await new Promise(r => setTimeout(r, 3000)); }
  log(h && h.j && h.j.ok, `Server erreichbar (${h && h.ms} ms)`);
  log(h && h.j && h.j.store === 'Upstash Redis', `Speicher: ${h && h.j && h.j.store}`);
  const page = await req('GET', '/'); log(page.status === 200 && /GRAND PRIX/.test(page.txt), 'Startseite wird ausgeliefert');
  const adm = await req('GET', '/admin'); log(adm.status === 200 && /Rennleitung/i.test(adm.txt), 'Rennleitung-Seite wird ausgeliefert');
  for (const f of ['mini3d.js', 'models.js', 'forest.js', 'extras.js']) { const r = await req('GET', '/' + f); log(r.status === 200 && r.txt.length > 5000, `${f} lädt (${Math.round(r.txt.length / 1024)} KB)`); }
  const bad = await req('POST', '/api/admin/login', { user: ADMIN.user, password: 'falsch' }); log(bad.status === 401, 'Falsches Admin-Passwort wird abgelehnt');
  const tok = await login(); log(!!tok, 'Admin-Login funktioniert');
  const noAdmin = await req('GET', '/api/admin/state'); log(noAdmin.status === 403, 'Admin-Daten ohne Login gesperrt');
  const A = (await req('POST', '/api/people', { name: PFX + 'Anna', goal: 4, look: { initials: 'TA' } })).j;
  const B = (await req('POST', '/api/people', { name: PFX + 'Beat', goal: 8, look: { initials: 'TB' } })).j;
  const C = (await req('POST', '/api/people', { name: PFX + 'Chiara', goal: 20, look: { initials: 'TC', hat: 'antlers' } })).j;
  log(A && A.id && B && B.id && C && C.id, 'Drei Testpersonen eingestiegen');
  log(C && C.look.hat !== 'antlers', 'Belohnung beim Einsteigen nicht erschummelbar');
  const dup = await req('POST', '/api/people', { name: PFX + 'Anna', goal: 5 }); log(dup.status >= 400, `Doppelter Name abgelehnt (${dup.status})`);
  const nog = await req('POST', '/api/people', { name: PFX + 'Ohneziel' }); log(nog.status >= 400, `Einsteigen ohne Ziel abgelehnt (${nog.status})`);
  let r = await req('PATCH', `/api/people/${A.id}`, { look: { hat: 'antlers' } }); log(r.j.look.hat !== 'antlers', 'Rentiergeweih bei 0 % gesperrt');
  r = await req('PATCH', `/api/people/${A.id}`, { goal: 99 }); log(r.j.goal === 4, 'Ambitionsniveau gesperrt (bleibt 4)');
  r = await req('POST', `/api/people/${A.id}/termin`, {}); log(r.j.count === 1, `+1 Termin (${r.ms} ms)`);
  r = await req('PATCH', `/api/people/${A.id}`, { look: { hat: 'antlers', vehicle: 'snail', color: '#e63946' } }); log(r.j.look.hat === 'antlers' && r.j.look.vehicle === 'snail', 'Bei 25 %: Rentiergeweih freigeschaltet, Garage speichert');
  r = await req('POST', `/api/people/${A.id}/termin`, { delta: -1 }); log(r.j.count === 0, 'Rückgängig (−1)');
  r = await req('POST', `/api/people/${A.id}/termin`, { delta: -1 }); log(r.status === 400, 'Unter 0 nicht möglich');
  for (let i = 0; i < 4; i++) r = await req('POST', `/api/people/${A.id}/termin`, {});
  log(r.j.count === 4, 'Anna erreicht 100 %');
  r = await req('PATCH', `/api/people/${A.id}`, { look: { goldPaint: true, flag: true, pattern: 'gold' } }); log(r.j.look.goldPaint && r.j.look.flag && r.j.look.pattern === 'gold', 'Bei 100 %: alle Belohnungen anziehbar');
  r = await req('POST', `/api/admin/people/${B.id}/adjust`, { set: 6 }, tok); log(r.j && r.j.count === 6, 'Rennleitung setzt Beat auf 6');
  r = await req('PATCH', `/api/admin/people/${B.id}`, { goal: 10 }, tok); log(r.j && r.j.goal === 10, 'Rennleitung kann Ziel ändern (8 → 10)');
  let st = await state(); const e = st.entries.filter(x => x.personId === C.id);
  await req('POST', `/api/people/${C.id}/termin`, {}); await req('POST', `/api/people/${C.id}/termin`, {});
  st = await state(); const ce = st.entries.filter(x => x.personId === C.id);
  r = await req('DELETE', `/api/admin/entries/${ce[0].id}`, null, tok); st = await state(); log(r.status === 200 && cnt(st, C.id) === 1, 'Rennleitung löscht einen Eintrag');
  // Live-Verbindung (SSE)
  const ac = new AbortController(); let got = '';
  const sse = fetch(BASE + '/api/stream', { signal: ac.signal }).then(async res => { const rd = res.body.getReader(); const dec = new TextDecoder();
    for (;;) { const { value, done } = await rd.read(); if (done) break; got += dec.decode(value); if ((got.match(/data:/g) || []).length >= 2) break; } }).catch(() => {});
  await new Promise(r => setTimeout(r, 1500)); await req('POST', `/api/people/${C.id}/termin`, {});
  await Promise.race([sse, new Promise(r => setTimeout(r, 6000))]); ac.abort();
  log((got.match(/data:/g) || []).length >= 2 && /"type":"hit"/.test(got), 'Live-Update kommt bei anderen sofort an');
  await new Promise(r => setTimeout(r, 2000));
  st = await state();
  const expect = { A: [A.id, cnt(st, A.id)], B: [B.id, cnt(st, B.id)], C: [C.id, cnt(st, C.id)] };
  info(`Stand für Neustart-Test: Anna ${expect.A[1]}, Beat ${expect.B[1]}, Chiara ${expect.C[1]}`);
  fs.writeFileSync('results/expect.json', JSON.stringify(expect));
}

async function phase2() {
  out.push('## Testlauf 2 – Neustart (Daten bleiben erhalten?)\n');
  const exp = JSON.parse(fs.readFileSync('results/expect.json', 'utf8'));
  let w = Date.now(), h; for (;;) { h = await req('GET', '/api/health').catch(() => null); if ((h && h.status === 200) || Date.now() - w > 150e3) break; await new Promise(r => setTimeout(r, 3000)); }
  log(h && h.status === 200, `Server nach Neustart wieder da (Wartezeit ${Math.round((Date.now() - w) / 1000)} s)`);
  const st = await state();
  for (const [k, [pid, n]] of Object.entries(exp)) { const p = st.people.find(x => x.id === pid); log(p && cnt(st, pid) === n, `${p ? p.name : k}: ${p ? cnt(st, pid) : 'fehlt'} Termine (erwartet ${n})`); }
  const a = st.people.find(x => x.id === exp.A[0]); log(a && a.look.goldPaint && a.look.hat === 'antlers' && a.look.vehicle === 'snail', 'Garage (Fahrzeug, Belohnungen) nach Neustart erhalten');
}

async function phase3() {
  out.push('## Testlauf 3 – 20 Personen gleichzeitig\n');
  const tok = await login(); log(!!tok, 'Admin-Login');
  let st = await state(); const have = st.people.filter(p => p.name.startsWith(PFX));
  const made = await Promise.all(Array.from({ length: 20 - have.length }, (_, i) => req('POST', '/api/people', { name: PFX + 'Person ' + (i + 1), goal: 10 + i, look: { initials: 'P' + (i + 1) } })));
  log(made.every(r => r.status === 201), `${made.length} weitere Testpersonen gleichzeitig eingestiegen`);
  st = await state(); const ppl = st.people.filter(p => p.name.startsWith(PFX)); log(ppl.length === 20, `20 Testpersonen im Rennen`);
  const before = Object.fromEntries(ppl.map(p => [p.id, cnt(st, p.id)]));
  // 20 offene Live-Verbindungen wie 20 offene Browser
  const acs = [], streams = Array.from({ length: 20 }, () => { const ac = new AbortController(); acs.push(ac); let n = 0;
    const pr = fetch(BASE + '/api/stream', { signal: ac.signal }).then(async res => { const rd = res.body.getReader(), dec = new TextDecoder(); for (;;) { const { value, done } = await rd.read(); if (done) break; n += (dec.decode(value).match(/data:/g) || []).length; } }).catch(() => {});
    return { get n() { return n; }, pr }; });
  await new Promise(r => setTimeout(r, 2500));
  const jobs = []; for (const p of ppl) for (let k = 0; k < 5; k++) jobs.push(req('POST', `/api/people/${p.id}/termin`, {}));
  const t = Date.now(), res = await Promise.all(jobs), dur = Date.now() - t, ms = res.map(r => r.ms).sort((a, b) => a - b);
  log(res.every(r => r.status === 200), `100 Termine gleichzeitig eingetragen in ${(dur / 1000).toFixed(1)} s, alle erfolgreich`);
  info(`Antwortzeit: Median ${ms[50]} ms, 95 % unter ${ms[95]} ms, langsamste ${ms[99]} ms`);
  await new Promise(r => setTimeout(r, 3000));
  st = await state(); const lost = ppl.filter(p => cnt(st, p.id) !== before[p.id] + 5);
  log(lost.length === 0, lost.length ? `${lost.length} Personen mit falschem Stand` : 'Kein einziger Termin verloren (jede Person genau +5)');
  const recv = streams.map(s => s.n); acs.forEach(a => a.abort());
  log(Math.min(...recv) >= 100, `Alle 20 Browser bekamen die Live-Updates (mind. ${Math.min(...recv)} von 101 Meldungen)`);
  // Persistenz bei Upstash: nach dem Speichern liegt der Stand auch in der DB (Health + erneutes Laden)
  // Aufräumen
  const del = await Promise.all(ppl.map(p => req('DELETE', `/api/admin/people/${p.id}`, null, tok)));
  st = await state(); log(del.every(r => r.status === 200) && !st.people.some(p => p.name.startsWith(PFX)), `Aufgeräumt: alle Testpersonen gelöscht (${st.people.length} Personen übrig, ${st.entries.length} Einträge)`);
}

fs.mkdirSync('results', { recursive: true });
try { await ({ 1: phase1, 2: phase2, 3: phase3 })[PHASE](); } catch (e) { log(false, 'Abbruch: ' + e.message); }
const md = out.join('\n') + `\n\n**${fails ? fails + ' Fehler' : 'Alles bestanden'}** · Dauer ${((Date.now() - t0) / 1000).toFixed(0)} s · ${new Date().toISOString()}\n`;
fs.writeFileSync(`results/phase${PHASE}.md`, md); console.log(md);
