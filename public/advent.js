// Grand Prix Ambition – Adventszeit: Adventskranz (ab 1. Advent, jede Woche eine Kerze mehr) und Adventskalender (1.–24.12., Türchen um 08:00)
(function () {
  'use strict';
  const TZ = 'Europe/Zurich';
  // ---------- Kalenderdaten (auch für Ticker und Kalender-Fenster in index.html) ----------
  const DOORS = [
    ['✨', 'Lichterkette am Start', 'Die Startlinie funkelt mit einer bunten Lichterkette.'],
    ['⛄', 'Schneemann', 'Am Wegrand steht ein Schneemann mit Rüeblinase und Besen.'],
    ['🐦', 'Vogelhäuschen', 'Meisen und ein Rotkehlchen picken am Vogelhäuschen.'],
    ['🕯️', 'Kerzen im Bauernhaus', 'In allen Fenstern des Bauernhauses brennen Kerzen.'],
    ['🥖', 'Grittibänze', 'Auf dem Brunnenrand sitzen frisch gebackene Grittibänze.'],
    ['🛷', 'Schlitten mit Geschenken', 'Ein Holzschlitten voller Geschenke wartet am Waldrand.'],
    ['⛸️', 'Eisläufer auf dem Teich', 'Auf dem zugefrorenen Teich drehen Eisläufer ihre Runden.'],
    ['🎅', 'Samichlaus', 'Der Samichlaus zieht mit Schmutzli und Esel über die Strecke.'],
    ['🦌', 'Rentiere', 'Bei den Steinböcken grasen Rentiere.'],
    ['🏠', 'Lebkuchenhaus', 'Auf einer Lichtung steht ein Lebkuchenhaus mit Zuckerguss-Dach.'],
    ['🌉', 'Lichterbogen an der Mühle', 'Ein Lichterbogen spannt sich über den Mühlebach.'],
    ['🧊', 'Iglu', 'Kinder bauen auf der Wiese einen Iglu.'],
    ['🌰', 'Marroni-Stand', 'Beim Ziel duftet es nach heissen Marroni.'],
    ['⭐', 'Sternsinger', 'Sternsinger ziehen mit ihrem leuchtenden Stern vorbei.'],
    ['🍬', 'Zuckerstangen', 'Zuckerstangen säumen ein Stück der Strecke.'],
    ['🎄', 'Weihnachtsbaum im Hof', 'Im Bauernhof steht ein geschmückter Weihnachtsbaum.'],
    ['🔥', 'Fackeln am Teich', 'Fackeln erleuchten das Teichufer.'],
    ['🌟', 'Krippe beim Stall', 'Beim Stall steht eine Krippe mit Ochs und Esel.'],
    ['🍷', 'Glühwein-Stand', 'Im Zielgelände dampft der Glühwein.'],
    ['🐴', 'Pferdeschlitten', 'Ein Pferdeschlitten mit Glöckchen dreht seine Runden.'],
    ['🏮', 'Laternen-Umzug', 'Die Fans im Zielgelände halten Laternen hoch.'],
    ['🎁', 'Geschenkberg', 'Unter einer Tanne auf der Spielwiese türmen sich Geschenke.'],
    ['🌠', 'Sternschnuppen', 'Am Abendhimmel ziehen Sternschnuppen vorbei.'],
    ['🎄', 'Christbaum im Ziel', 'Im Ziel leuchtet der grosse Christbaum – frohe Weihnachten! 🎆']
  ].map(([emoji, title, text], i) => ({ d: i + 1, emoji, title, text }));
  const parts = date => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(date).map(x => [x.type, x.value]));
    return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour }; };
  // Zeitpunkt «Datum y-m-d, hh:00 Zürcher Zeit» als ISO (für den Ticker)
  const zurichISO = (y, m, d, h) => { const guess = Date.UTC(y, m - 1, d, h); const p = parts(new Date(guess)); const off = (Date.UTC(p.y, p.m - 1, p.d, p.h) - guess); return new Date(guess - off).toISOString(); };
  // Adventssonntage: 4. Advent = letzter Sonntag vor dem 25.12.
  const adventSundays = y => { const wd = new Date(Date.UTC(y, 11, 24)).getUTCDay(), a4 = 24 - wd; return [a4 - 21, a4 - 14, a4 - 7, a4].map(d => new Date(Date.UTC(y, 11, d))); };
  function state(date) {
    const p = parts(date), dayKey = Date.UTC(p.y, p.m - 1, p.d), suns = adventSundays(p.y), out = { doors: 0, candles: 0, chlausDay: false, christmas: false, wreath: false, year: p.y };
    if (p.m === 12) { out.doors = Math.min(24, p.d >= 25 ? 24 : (p.h >= 8 ? p.d : p.d - 1)); out.chlausDay = p.d === 8; out.christmas = p.d >= 24; }
    if (p.m === 11 || p.m === 12) { out.candles = suns.filter(s => s.getTime() <= dayKey).length; out.wreath = out.candles > 0; }
    out.sundays = suns.map(s => s.toISOString().slice(0, 10));
    return out;
  }
  // Tickermeldungen (Türchen und Kerzen), bis jetzt
  function tickerItems(date) {
    const st = state(date), out = [], y = st.year;
    for (let d = 1; d <= st.doors; d++) { const D = DOORS[d - 1]; out.push({ ts: zurichISO(y, 12, d, 8), html: `🚪 <b>Türchen ${d}</b>: ${D.emoji} ${D.text}` }); }
    const words = ['erste', 'zweite', 'dritte', 'vierte'];
    st.sundays.slice(0, st.candles).forEach((s, i) => { const [yy, mm, dd] = s.split('-').map(Number);
      out.push({ ts: zurichISO(yy, mm, dd, 8), html: `🕯️ <b>${i + 1}. Advent</b>: Am Adventskranz beim Pingpong-Tisch brennt die ${words[i]} Kerze${i === 3 ? ' – bald ist Weihnachten!' : ''}` }); });
    return out;
  }
  window.ADVENT = { DOORS, state, tickerItems };

  const Fo = window.Forest; if (!Fo) return;
  const { G, Node, merge } = window.Mini3D, PI = Math.PI, Mo = window.Models;
  const rng = seed => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
  const N = (geo, col, x = 0, y = 0, z = 0, opt) => new Node(geo, col, opt).at(x, y, z);
  const box = (w, h, d, c, x, y, z) => N(G.box(w, h, d), c, x, y, z);
  const cyl = (rt, rb, h, seg, c, x, y, z) => N(G.cyl(rt, rb, h, seg), c, x, y, z);
  const sph = (r, c, x, y, z) => N(G.sphere(r, 8, 6), c, x, y, z);
  const rod = (a, b, r, c) => Mo.rod(a, b, r, c);
  const LIGHTS = ['#ff4d4d', '#ffd23f', '#5cff7a', '#4dc3ff', '#ffffff', '#ff8fd8'];
  const SNOW = '#f4f7fb';

  // Gegenstand: «s» = feste Teile (werden zusammengefasst), «g» = leuchtende Teile (eigene Geometrie mit Leuchtkraft)
  const item = (x, y, z, yaw) => { const s = new Node().at(x, y, z), g = new Node().at(x, y, z); s.rot = [0, yaw || 0, 0]; g.rot = [0, yaw || 0, 0]; return { s, g, pos: [x, y, z] }; };
  // zusammengefasst in Weltkoordinaten; Sichtbarkeitsprüfung über einen Hilfsknoten am Ort des Gegenstands
  function bake(it, cull) { const wrap = (m, emis) => { m.emis = emis; const h = new Node().at(...it.s.pos); h.cull = cull || 6; m.pos = [-it.s.pos[0], -it.s.pos[1], -it.s.pos[2]]; h.add(m); return h; };
    const out = [wrap(merge(it.s), 0)]; if (it.g.children.length) out.push(wrap(merge(it.g), 1)); return out; }
  // Tannenbaum (Kegel-Etagen); Kugeln/Lichter optional
  function fir(it, x, y, z, h, o = {}) { const n = o.tiers || 4, r0 = h * .34;
    it.s.add(cyl(h * .045, h * .06, h * .16, 7, '#6b4426', x, y + h * .08, z));
    for (let i = 0; i < n; i++) { const f = i / n, r = r0 * (1 - f * .72), ty = y + h * (.14 + f * .7), th = h * .34;
      it.s.add(cyl(0, r, th, 9, i % 2 ? '#1f5f35' : '#24693b', x, ty + th / 2, z)); if (o.snow) it.s.add(cyl(0, r * .55, th * .4, 9, SNOW, x, ty + th * .82, z)); }
    const R = rng(o.seed || 7);
    if (o.balls) for (let i = 0; i < o.balls; i++) { const f = R() * .85, a = R() * PI * 2, r = r0 * (1 - f * .82) * .92, yy = y + h * (.16 + f * .8) - .02;
      it.s.add(sph(h * .028, ['#c1121f', '#ffd23f', '#3a86ff', '#e9ecef', '#8338ec'][i % 5], x + Math.cos(a) * r, yy, z + Math.sin(a) * r)); }
    if (o.lights) for (let i = 0; i < o.lights; i++) { const f = i / o.lights, a = f * PI * 2 * 5.5, r = r0 * (1 - f * .85) * .97, yy = y + h * (.18 + f * .75);
      it.g.add(sph(h * .016, o.warm ? '#ffe08a' : LIGHTS[i % LIGHTS.length], x + Math.cos(a) * r, yy, z + Math.sin(a) * r)); }
    if (o.star) { const st = new Node().at(x, y + h * 1.04, z); for (let k = 0; k < 5; k++) st.add(N(G.box(h * .02, h * .1, h * .02), '#ffd23f').rotate(0, 0, k * PI / 5 * 2)); it.g.add(st); }
  }
  // Geschenk mit Schleife
  function gift(it, x, y, z, w, col, rib, rot) { const g = new Node().at(x, y + w / 2, z); g.rot = [0, rot || 0, 0];
    g.add(box(w, w, w, col, 0, 0, 0), box(w * 1.02, w * 1.02, w * .16, rib, 0, 0, 0), box(w * .16, w * 1.02, w * 1.02, rib, 0, 0, 0), N(G.torus(w * .14, w * .04, 8, 4), rib, 0, w * .55, 0).rotate(0, 0, PI / 2), N(G.torus(w * .14, w * .04, 8, 4), rib, 0, w * .55, 0).rotate(PI / 2, 0, PI / 2)); it.s.add(g); }
  // einfacher Vierbeiner (Esel, Rentier, Pferd, Ochse) mit Augen, Maul und beweglichen Beinen
  function quad(kind) {
    const C = { donkey: ['#8d8a86', '#e8e4dc', '#4a4644'], reindeer: ['#8a6a4e', '#efe6d8', '#3a2c22'], horse: ['#7a4a2a', '#f3ede2', '#2a1a12'], ox: ['#9b6b46', '#efe4cc', '#3a2c22'] }[kind];
    const [c, l, d] = C, root = new Node(), bob = new Node(), s = new Node(), legs = [], k = kind === 'horse' ? 1.15 : kind === 'ox' ? 1.1 : kind === 'reindeer' ? .95 : .9;
    s.add(N(G.sphere(.34 * k, 10, 7), c, 0, .82 * k, 0).scale(1.55, .85, .78), N(G.sphere(.2 * k, 8, 6), l, .12 * k, .7 * k, 0).scale(1.6, .6, .8));
    const neck = [.42 * k, .98 * k, 0], hd = [.7 * k, 1.28 * k, 0];
    s.add(rod(neck, hd, .12 * k, c), N(G.sphere(.15 * k, 8, 6), c, hd[0], hd[1], 0).scale(1.2, 1, .9), N(G.sphere(.1 * k, 8, 6), kind === 'reindeer' ? '#2b2220' : l, hd[0] + .17 * k, hd[1] - .06 * k, 0).scale(1.2, .9, .9));
    Mo.eyes(s, [hd[0], hd[1], 0], [.18 * k, .15 * k, .135 * k], [.35, .4, .84], .024 * k, '#2a1a10');
    s.add(rod([hd[0] + .27 * k, hd[1] - .11 * k, .04 * k], [hd[0] + .17 * k, hd[1] - .13 * k, .05 * k], .008 * k, '#2a1a14'), rod([hd[0] + .27 * k, hd[1] - .11 * k, -.04 * k], [hd[0] + .17 * k, hd[1] - .13 * k, -.05 * k], .008 * k, '#2a1a14'));
    if (kind === 'reindeer') s.add(N(G.sphere(.045 * k, 7, 5), '#d62828', hd[0] + .28 * k, hd[1] - .05 * k, 0));
    else s.add(N(G.sphere(.02 * k, 6, 4), '#1b1b1b', hd[0] + .28 * k, hd[1] - .04 * k, .035 * k), N(G.sphere(.02 * k, 6, 4), '#1b1b1b', hd[0] + .28 * k, hd[1] - .04 * k, -.035 * k));
    for (const sd of [-1, 1]) {
      if (kind === 'donkey') s.add(N(G.cyl(.02 * k, .06 * k, .34 * k, 6), c, hd[0] - .04 * k, hd[1] + .27 * k, sd * .08 * k).rotate(sd * .35, 0, -.15), N(G.cyl(.01 * k, .035 * k, .26 * k, 6), '#3a3634', hd[0] - .035 * k, hd[1] + .27 * k, sd * .09 * k).rotate(sd * .35, 0, -.15));
      else s.add(N(G.cyl(0, .05 * k, .14 * k, 5), c, hd[0] - .06 * k, hd[1] + .16 * k, sd * .1 * k).rotate(sd * .6, 0, 0));
      if (kind === 'reindeer') { const b0 = [hd[0] - .06 * k, hd[1] + .14 * k, sd * .06 * k], b1 = [hd[0] - .12 * k, hd[1] + .45 * k, sd * .2 * k];
        s.add(rod(b0, b1, .022 * k, '#d9c9a3'), rod(b1, [hd[0] - .26 * k, hd[1] + .66 * k, sd * .28 * k], .018 * k, '#d9c9a3'), rod(b1, [hd[0] + .04 * k, hd[1] + .58 * k, sd * .2 * k], .016 * k, '#d9c9a3')); }
      if (kind === 'ox') s.add(rod([hd[0] - .04 * k, hd[1] + .12 * k, sd * .1 * k], [hd[0] + .02 * k, hd[1] + .22 * k, sd * .26 * k], .025 * k, '#efe4cc'));
    }
    if (kind === 'donkey' || kind === 'horse') s.add(N(G.box(.36 * k, .08 * k, .05 * k), d, (neck[0] + hd[0]) / 2 - .06 * k, (neck[1] + hd[1]) / 2 + .1 * k, 0).rotate(0, 0, .85));   // Mähne
    s.add(rod([-.5 * k, .9 * k, 0], [-.62 * k, .5 * k, 0], .03 * k, d));
    for (const [x, z, ph] of [[.32, .13, 0], [.32, -.13, PI], [-.32, .13, PI], [-.32, -.13, 0]]) { const lg = new Node().at(x * k, .66 * k, z * k); lg.phase = ph;
      lg.add(N(G.cyl(.045 * k, .04 * k, .62 * k, 6), c, 0, -.31 * k, 0), N(G.cyl(.05 * k, .05 * k, .07 * k, 6), d, 0, -.62 * k, 0)); legs.push(lg); }
    bob.add(merge(s), ...legs); root.add(N(G.cyl(1, 1, .01, 12), '#000000', 0, .02, 0, { alpha: .22 }).scale(.75 * k, 1, .35 * k), bob);
    root.anim = { legs, bob }; return root;
  }
  const animQuad = (n, t, walk) => { for (const l of n.anim.legs) l.rot = [0, 0, walk ? Math.sin(t * 7 + l.phase) * .45 : 0]; n.anim.bob.pos[1] = walk ? Math.abs(Math.sin(t * 7)) * .03 : 0; };
  const person = (look, kind, sc) => { const p = Mo.person({ pants: '#2d3a55', ...look }, kind || 'stand'); p.scl = [sc || 1, sc || 1, sc || 1]; p.cull = 2.5; return p; };
  // Bart am Kopf einer Figur
  const beard = (p, col) => { const h = p.anim.head; h.add(N(G.sphere(.12, 8, 6), col, .1, -.06, 0).scale(.6, 1.15, 1), N(G.sphere(.06, 6, 4), col, .13, .02, 0).scale(.5, .5, 1.6)); };

  // ---------- Muskelprotze (oben ohne) ----------
  // dynamisches Stabsegment von a nach b (gleiche Ausrichtung wie Models.rod)
  const seg = (r, col) => new Node(G.cyl(r, r * .92, 1, 8), col);
  const setSeg = (n, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.hypot(dx, dy, dz) || 1e-6, tz = Math.acos(Math.max(-1, Math.min(1, dy / len))), sz = Math.sin(tz);
    n.pos = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]; n.rot = [0, sz > 1e-6 ? Math.atan2(dz / len, -dx / len) : 0, tz]; n.scl = [1, len, 1]; };
  // Oberkörper-Muskeln auf eine Figur legen (Koordinaten wie Models.person: Schulterhöhe 1.01, Blick +X)
  function muscles(p, sk, arms) {
    const dk = shadeHex(sk, .86), b = new Node(), A = p.anim;
    b.add(N(G.cyl(.28, .2, .34, 12), sk, 0, .9, 0).scale(.95, 1, 1.12));                                   // breiter Rücken (V-Form)
    for (const sd of [-1, 1]) {
      b.add(N(G.sphere(.13, 10, 7), sk, .14, .96, sd * .1).scale(.62, .72, 1), N(G.sphere(.11, 8, 6), sk, -.02, 1.04, sd * .27),   // Brust, Schultern
        N(G.sphere(.1, 8, 6), sk, -.04, 1.09, sd * .13).scale(1, .7, 1.1), N(G.box(.012, .012, .09), dk, .215, .9, sd * .085).rotate(sd * .5, 0, 0));
      for (let r = 0; r < 3; r++) b.add(N(G.box(.04, .058, .062), r % 2 ? sk : dk, .208 - r * .006, .83 - r * .07, sd * .038).scale(1, 1, 1));   // Bauchmuskeln
    }
    b.add(N(G.box(.02, .2, .006), dk, .222, .76, 0), N(G.cyl(.245, .245, .06, 12), '#1b1b1f', 0, .61, 0));   // Linea alba, Gürtel
    A.bob.add(merge(b));
    if (arms) { const m = new Node(); for (const [sd, hp] of arms) { const a = [-.01, 0, sd * .215], el = [(a[0] + hp[0]) / 2 + .05, (a[1] + hp[1]) / 2 - .04, (a[2] + hp[2]) / 2 + sd * .07];
      m.add(rod(a, el, .088, sk), N(G.sphere(.095, 8, 6), sk, (a[0] + el[0]) / 2 + .03, (a[1] + el[1]) / 2, (a[2] + el[2]) / 2).scale(1.1, 1, 1), N(G.sphere(.07, 7, 5), sk, ...el), rod(el, hp, .07, sk)); }
      A.upper.add(merge(m)); }
  }
  function shadeHex(h, f) { const n = parseInt(h.slice(1), 16), c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => Math.round(v * f)); return '#' + c.map(v => v.toString(16).padStart(2, '0')).join(''); }

  // ---------- Bauplatz-Suche ----------
  Fo.prototype.advFree = function (x, z, r, o = {}) {
    const P = this.path, MS = this.massif, PP = this.podPlan, S = this.stream, gm = this.games;
    if (Math.abs(x) > 60 || z < -80 || z > 48) return false;
    if (P.dist(x, z) < (o.track || 7.8) + r) return false;
    if (this.obsBlocked(x, z, r + .25)) return false;
    if (this.inPond(x, z, r + 1.2)) return false;
    if (!o.farm && this.inFarm && this.inFarm(x, z, r + .8)) return false;
    if (!o.games && gm && Math.hypot(x - gm.x, z - gm.z) < 8.5 + r) return false;
    if (MS && Math.hypot(x - MS.x, z - MS.z) < MS.R + r + (o.rocks ? .2 : 1)) return false;
    if (PP && Math.hypot(x - PP.x, z - PP.z) < 6 + r) return false;
    if (S && S.pts.some(p => Math.hypot(p[0] - x, p[2] - z) < 2.6 + r)) return false;
    if (S && S.mill && Math.hypot(S.mill[0] - x, S.mill[1] - z) < 4 + r) return false;
    if (this.arenaReserved && this.arenaReserved(x, z, r - 1.6)) return false;
    return true;
  };
  Fo.prototype.advSpot = function (cx, cz, r, o = {}) {
    for (let k = 0; k < 400; k++) { const a = k * 2.399, dd = Math.sqrt(k) * (o.step || .8), x = cx + Math.cos(a) * dd, z = cz + Math.sin(a) * dd;
      if (this.advFree(x, z, r, o)) return [x, z]; }
    return null;
  };
  const sideAt = (P, t, sd, off) => { const q = P.at(t); return [q.p[0] + q.side[0] * sd * off, q.p[2] + q.side[2] * sd * off, Math.atan2(-q.side[2] * -sd, q.side[0] * -sd)]; };   // Blick zur Strecke

  // ---------- Aufbau (bei jedem neuen Türchen bzw. jeder neuen Kerze) ----------
  Fo.prototype.buildAdvent = function () {
    const st = state(this.now()), key = st.doors + '|' + st.candles + '|' + st.chlausDay + '|' + st.christmas;
    if (this.adventKey === key) return; this.adventKey = key;
    // Samichlaus-Wanderer und alte Teile entfernen
    if (this.hikers) this.hikers = this.hikers.filter(h => !h.chlaus);
    if (this.advObsList && this.advObsList.length) { const rm = new Set(this.advObsList); for (const [k, l] of this.obs) this.obs.set(k, l.filter(o => !rm.has(o))); }
    if (this.farm && this.farm.blocks) this.farm.blocks = this.farm.blocks.filter(b => !b.advent);
    this.advStatic = []; this.advDyn = []; this.advUpd = []; this.advFocus = {}; this.advObsList = [];
    const P = this.path, H = (x, z) => this.height(x, z), self = this, R = rng(1225);
    const obs = (id, x, z, r) => { this.addObs(x, z, r); for (const l of this.obs.values()) { const o = l[l.length - 1]; if (o && o[0] === x && o[1] === z && o[2] === r && !this.advObsList.includes(o)) this.advObsList.push(o); } };
    const CAM = { wut: [4.5, 1], bank: [4.5, .6], gabel: [6, 1.5], kranz: [3.2, .8], 1: [16, 3], 2: [6, 1.2], 3: [4, 1.5], 4: [16, 3], 5: [4.5, .6], 6: [5, .6], 7: [14, 1], 8: [9, 1], 9: [9, 1], 10: [8, 1.2], 11: [8, 1.5], 12: [8, .8], 13: [8, 1.3], 14: [7, 1], 15: [9, .6], 16: [9, 2], 17: [20, 1], 18: [8, 1.3], 19: [8, 1.3], 20: [16, 1], 21: [18, 1.5], 22: [9, 1.5], 23: [60, 0], 24: [26, 5] };
    // Kamera blickt von der Strecke her auf den Gegenstand (dort ist es frei)
    const camFor = (d, n) => { const c = CAM[d]; if (c && !n.anim) { n.camDist = c[0]; n.camH = c[1]; } else if (c) n.camDist = c[0];
      if (!n.anim && d !== 23) { let bd = 1e9, bp = null; for (let i = 0; i <= 200; i++) { const q = P.at(i / 200), dd = Math.hypot(q.p[0] - n.pos[0], q.p[2] - n.pos[2]); if (dd < bd) { bd = dd; bp = q.p; } }
        if (bp && bd > .5) n.camYaw = Math.atan2(bp[0] - n.pos[0], bp[2] - n.pos[2]); } return n; };
    const place = (d, it, name, cull) => { this.advStatic.push(...bake(it, cull)); const f = camFor(d, new Node().at(...it.pos)); this.advFocus[d] = { node: f, name }; };
    const focus = (d, node, name) => { this.advFocus[d] = { node: camFor(d, node), name }; };
    const dyn = (n, upd) => { this.advDyn.push(n); if (upd) this.advUpd.push(upd); return n; };
    const flame = (x, y, z, s) => new Node(G.sphere(.03 * s, 6, 4), '#ffb02e', { emis: 1 }).at(x, y, z);
    const flick = f => t => { const k = .85 + Math.sin(t * 13 + f.ph) * .12 + Math.sin(t * 29 + f.ph * 2) * .06; f.scl = [k, 1.1 + (k - .85) * 2.2, k]; };

    // ===== Wütende Frau mit Locken am Streckenrand (ganzjährig) =====
    { const pref = sideAt(P, .35, 1, 8.8), sp = this.advSpot(pref[0], pref[1], .5, { track: 7.9 });
      if (sp) { const [x, z] = sp, q = P.at(.35), yaw = Math.atan2(-(q.p[2] - z), q.p[0] - x);
        const w = dyn(person({ suit: '#7b2cbf', suit2: '#7b2cbf', pattern: 'solid', hat: 'none', hair: 'curly', hairColor: '#8a3b1f', skin: '#f2c9a8', pants: '#2d3a55' }, 'wave', 1.05));
        w.pos = [x, H(x, z), z]; w.rot = [0, yaw, 0]; obs('wut', x, z, .45);
        // Gesicht: steil nach innen abfallende Brauen, Zornesfalte, heruntergezogene Mundwinkel, rote Wangen
        const hd = w.anim.head, br = '#4a2412';
        for (const sd of [-1, 1]) hd.add(N(G.box(.025, .03, .11), br, .178, .3, sd * .075).rotate(-sd * .55, 0, 0), sph(.045, '#ff6b6b', .15, .15, sd * .13));
        hd.add(N(G.box(.01, .05, .012), '#c98e7a', .2, .27, 0), N(G.box(.03, .035, .12), '#f2c9a8', .197, .1, 0),
          N(G.box(.02, .022, .06), '#6b1f1f', .205, .1, .035).rotate(.5, 0, 0), N(G.box(.02, .022, .06), '#6b1f1f', .205, .1, -.035).rotate(-.5, 0, 0));
        // Dampfwölkchen aus den Ohren
        const puffs = []; for (let i = 0; i < 6; i++) { const p = dyn(new Node(G.sphere(.07, 6, 4), '#f1f3f5', { alpha: .7 })); p.ph = i / 6; p.sd = i % 2 ? 1 : -1; puffs.push(p); }
        // Sprechblase ab und zu
        if (!this.angryEl) { this.angryEl = document.createElement('div'); this.angryEl.className = 'say'; this.angryEl.style.opacity = '0'; this.layer.appendChild(this.angryEl); }
        const el = this.angryEl, SAY = ['Grrr! 😤', 'Wo bleiben die Termine?! 😠', 'Gas geben! 💢', 'So nicht! 😡', 'Hopp jetzt! 😤'];
        this.advUpd.push(t => { const A = w.anim, c = Math.cos(yaw), s = Math.sin(yaw);
          A.legs.forEach((l, i) => { l.rot[2] = Math.max(0, Math.sin(t * 7 + i * PI)) * .35; });                      // Stampfen
          A.bob.pos[1] = Math.abs(Math.sin(t * 7)) * .04; A.upper.rot = [Math.sin(t * 7) * .06, 0, -.08];
          if (A.wave) A.wave.rot = [Math.sin(t * 16) * .35 - .25, 0, 0];                                         // Faust schütteln
          A.head.rot = [Math.sin(t * 9) * .08, Math.sin(t * 2.3) * .35, -.05];                                    // Kopfschütteln
          const hy = w.pos[1] + 1.55;   // Ohrenhöhe (+0.3)
          puffs.forEach(p => { const f = (t * .8 + p.ph) % 1, ex = p.sd * .25 * 1.05; p.pos = [w.pos[0] + s * ex * (1 + f * .8), hy - .2 + f * .7, w.pos[2] + c * ex * (1 + f * .8)]; const k = .5 + f * 1.3; p.scl = [k, k, k]; p.alpha = .7 * (1 - f); });
          const cyc = t % 16, on = cyc < 4, sp2 = (() => { try { return this.r.project([w.pos[0], hy + .6, w.pos[2]]); } catch (e) { return null; } })(), Wd = this.canvas.clientWidth, Hd = this.canvas.clientHeight;
          const kk = Math.floor(t / 16); if (el.k !== kk) { el.k = kk; el.textContent = SAY[kk % SAY.length]; }
          if (!sp2 || sp2[0] < -40 || sp2[0] > Wd + 40 || sp2[1] < -20 || sp2[1] > Hd + 20 || Math.hypot(this.cam.target[0] - x, this.cam.target[2] - z) > 40) { el.style.opacity = '0'; return; }
          el.style.transform = `translate(${sp2[0]}px,${sp2[1]}px) translate(-50%,-100%)`; el.style.opacity = on ? String(Math.min(1, cyc * 3, (4 - cyc) * 3)) : '0'; });
        focus('wut', w, 'Wütende Frau'); this.angry = w; } }

    // ===== Muskelprotze beim Bauernhof (ganzjährig) =====
    if (this.farm) { const F = this.farm, SK = '#d9a07a', ts = this.path.at(.5);
      const faceTrack = (x, z) => { let bd = 1e9, bp = null; for (let i = 0; i <= 100; i++) { const q = P.at(i / 100), d = Math.hypot(q.p[0] - x, q.p[2] - z); if (d < bd) { bd = d; bp = q.p; } } return Math.atan2(-(bp[2] - z), bp[0] - x); };
      // 1) Bankdrücken neben dem Hof
      const pb = F.w(-15, 1.5), sp = this.advSpot(pb[0], pb[1], 1.4, { step: .6 });
      if (sp) { const [x, z] = sp, yaw = faceTrack(x, z) + PI / 2, y0 = H(x, z), it = item(x, y0, z, yaw);
        // Hantelbank (entlang lokaler X-Achse), Ablage, Scheiben, Kurzhanteln, Gummimatte
        it.s.add(box(2.0, .03, 1.5, '#2b2d31', 0, .015, 0), box(1.25, .1, .3, '#1b1b1f', -.05, .46, 0), box(1.15, .05, .26, '#c1121f', -.05, .52, 0));
        for (const bx of [-.55, .45]) it.s.add(box(.06, .42, .06, '#8d9399', bx, .21, 0), box(.06, .04, .4, '#8d9399', bx, .02, 0));
        for (const sd of [-1, 1]) { it.s.add(box(.06, 1.25, .06, '#8d9399', -.62, .62, sd * .5), box(.12, .04, .06, '#8d9399', -.56, 1.08, sd * .5), box(.3, .04, .06, '#8d9399', -.72, .02, sd * .5));
          for (let k = 0; k < 3; k++) it.s.add(N(G.cyl(.22 - k * .04, .22 - k * .04, .04, 14), '#1b1b1f', -.8 + k * .02, .22 - k * .04 + .02, sd * .78).rotate(PI / 2, 0, 0)); }
        for (const [dx2, dz2] of [[.75, .55], [.85, .4]]) { it.s.add(N(G.cyl(.018, .018, .32, 6), '#8d9399', dx2, .06, dz2).rotate(PI / 2, 0, 0)); for (const e of [-.13, .13]) it.s.add(N(G.cyl(.06, .06, .06, 8), '#1b1b1f', dx2, .06, dz2 + e).rotate(PI / 2, 0, 0)); }
        place('bank', it, 'Bankdrücker', 3); obs('bank', x, z, 1.1);
        // Athlet: auf dem Rücken liegend (Blick nach oben), Kopf zur Ablage
        const holder = dyn(new Node().at(x, y0, z)); holder.rot = [0, yaw, 0];
        const man = (person({ suit: SK, suit2: SK, skin: SK, pattern: 'solid', hat: 'none', hair: 'short', hairColor: '#1d1a17', pants: '#2d3a55' }, 'stand', 1.08));
        const A = man.anim; A.upper.children.length = 0; muscles(man, SK, null);
        A.head.add(N(G.box(.05, .045, .42), '#c1121f', .02, .27, 0));                                                    // Stirnband
        const c = Math.cos(yaw), s = Math.sin(yaw), W = (u, v) => [x + u * c + v * s, z - u * s + v * c], [mx, mz] = W(-.4, 0);
        man.pos = [.64, .8, 0]; man.rot = [0, 0, PI / 2]; man.children.shift(); holder.add(man);   // ohne Bodenschatten   // liegt auf dem Rücken, Kopf Richtung Ablage
        for (const l of A.legs) l.rot = [0, 0, -1.25];
        // Arme mit Gelenken (Oberarm, Unterarm), Hantelstange
        const armN = [-1, 1].map(sd => { const u = seg(.09, SK), f = seg(.07, SK), sh = N(G.sphere(.11, 8, 6), SK), el = N(G.sphere(.075, 7, 5), SK), hd2 = N(G.sphere(.065, 7, 5), SK), bi = N(G.sphere(.1, 8, 6), SK);
          A.upper.add(u, f, sh, el, hd2, bi); return { sd, u, f, sh, el, hd: hd2, bi }; });
        const bar = new Node(); bar.add(N(G.cyl(.022, .022, 1.9, 8), '#c0c7cf', 0, 0, 0).rotate(PI / 2, 0, 0));
        for (const sd of [-1, 1]) { bar.add(N(G.cyl(.04, .04, .05, 8), '#8d9399', 0, 0, sd * .6).rotate(PI / 2, 0, 0)); for (let k = 0; k < 3; k++) bar.add(N(G.cyl(.24 - k * .05, .24 - k * .05, .05, 16), k === 1 ? '#c1121f' : '#1b1b1f', 0, 0, sd * (.67 + k * .055)).rotate(PI / 2, 0, 0)); }
        A.upper.add(bar);
        this.advUpd.push(t => { const cyc = t % 30, rep = cyc < 24 ? (cyc % 3) / 3 : 1;                // 8 Wiederholungen, dann Pause
          const down = cyc < 24 ? (rep < .45 ? rep / .45 : rep < .8 ? 1 - (rep - .45) / .35 : 0) : 0, ease = .5 - .5 * Math.cos(down * PI);
          const hx = .66 - ease * .4, strain = cyc < 24 && rep >= .45 && rep < .8;
          A.upper.pos = [0, .62 + .39, 0]; A.upper.rot = [0, 0, 0]; A.bob.pos[1] = 0;
          A.head.rot = [0, 0, strain ? Math.sin(t * 30) * .02 : 0];
          for (const r of armN) { const S2 = [-.01, 0, r.sd * .215], Hh = [hx, -.02, r.sd * .42], d = Math.hypot(Hh[0] - S2[0], Hh[1] - S2[1], Hh[2] - S2[2]), L1 = .31, L2 = .3;
            const dd = Math.min(d, L1 + L2 - .001), dir = [(Hh[0] - S2[0]) / d, (Hh[1] - S2[1]) / d, (Hh[2] - S2[2]) / d], aa = (L1 * L1 - L2 * L2 + dd * dd) / (2 * dd), hh = Math.sqrt(Math.max(0, L1 * L1 - aa * aa));
            let pole = [-.7, -.25, r.sd * .9]; const pd = pole[0] * dir[0] + pole[1] * dir[1] + pole[2] * dir[2]; pole = pole.map((v, i) => v - pd * dir[i]); const pl = Math.hypot(...pole) || 1; pole = pole.map(v => v / pl);
            const E = [S2[0] + dir[0] * aa + pole[0] * hh, S2[1] + dir[1] * aa + pole[1] * hh, S2[2] + dir[2] * aa + pole[2] * hh];
            setSeg(r.u, S2, E); setSeg(r.f, E, Hh); r.sh.pos = S2; r.el.pos = E; r.hd.pos = Hh; r.bi.pos = [(S2[0] + E[0]) / 2 + .02, (S2[1] + E[1]) / 2 + .02, (S2[2] + E[2]) / 2]; r.bi.scl = strain ? [1.15, 1.15, 1.15] : [1, 1, 1]; }
          bar.pos = [hx, -.02, 0];
          for (const l of A.legs) l.rot = [0, 0, -1.25]; });
        focus('bank', holder, 'Bankdrücker'); this.bencher = holder; }
      // 2) Grosser Muskelprotz mit Mistgabel
      const pf = F.w(14.5, 3), sp2 = this.advSpot(pf[0], pf[1], .6, { step: .6 });
      if (sp2) { const [x, z] = sp2, yaw = faceTrack(x, z), g = dyn(person({ suit: SK, suit2: SK, skin: '#c98e62', pattern: 'solid', hat: 'none', hair: 'long', hairColor: '#3b2a1e', pants: '#4a5a3a' }, 'fork', 1.32));
        muscles(g, '#c98e62', [[1, [.08, -.36, .26]], [-1, [.2, .05, -.26]]]); beard(g, '#3b2a1e');
        g.pos = [x, H(x, z), z]; g.rot = [0, yaw, 0]; g.scl = [1.32, 1.32, 1.45]; obs('gabel', x, z, .6);
        this.advUpd.push(t => { const A = g.anim, w = t % 12, lift = w > 8 && w < 10.5 ? Math.sin((w - 8) / 2.5 * PI) : 0;   // ab und zu Heu stemmen
          Mo.animatePerson(g, t, false, 0, Math.sin(t * .3) * .4); A.upper.rot = [0, 0, -lift * .35]; A.bob.pos[1] = Math.sin(t * 1.2) * .01; });
        focus('gabel', g, 'Muskelprotz mit Mistgabel'); this.forkman = g; } }

    // ===== Adventskranz beim Pingpong-Tisch (ab 1. Advent) =====
    if (st.wreath && this.games) { const gm = this.games, pref = gm.w(-4, 3.3);
      const sp = this.advSpot(pref[0], pref[1], .7, { games: true, track: 6.8, step: .5 });
      if (sp) { const [x, z] = sp, y = H(x, z), it = item(x, y, z, Math.atan2(gm.V[0], gm.V[1]));
        // Holztisch
        it.s.add(box(1.0, .06, 1.0, '#8a6a42', 0, .74, 0)); for (const [a, b] of [[-.42, -.42], [.42, -.42], [-.42, .42], [.42, .42]]) it.s.add(box(.07, .72, .07, '#6b4a2b', a, .36, b));
        it.s.add(N(G.cyl(.47, .47, .015, 16), '#f4f1ea', 0, .775, 0));   // Tischtuch
        // Kranz: Tannengrün, Zapfen, rote Schleifen
        it.s.add(N(G.torus(.3, .085, 20, 6), '#1f5f35', 0, .83, 0).rotate(PI / 2, 0, 0));
        for (let i = 0; i < 28; i++) { const a = i / 28 * PI * 2, r = .3 + (i % 3 - 1) * .05; it.s.add(N(G.cyl(0, .035, .12, 4), i % 2 ? '#2d7a45' : '#1a5230', Math.cos(a) * r, .86, Math.sin(a) * r).rotate(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1)); }
        for (let i = 0; i < 4; i++) { const a = i / 4 * PI * 2 + PI / 4; it.s.add(N(G.sphere(.04, 7, 5), '#6b4426', Math.cos(a) * .38, .86, Math.sin(a) * .38).scale(1, 1.4, 1)); }
        for (let i = 0; i < 4; i++) { const a = i / 4 * PI * 2 + PI / 8; it.s.add(N(G.box(.1, .05, .03), '#c1121f', Math.cos(a) * .4, .87, Math.sin(a) * .4).rotate(0, -a, 0)); for (let k = 0; k < 6; k++) it.s.add(sph(.022, ['#c1121f', '#ffd23f'][k % 2], Math.cos(a + k * .4 + .2) * .3, .91, Math.sin(a + k * .4 + .2) * .3)); }
        // Kerzen (rot): Kerze 1 brennt seit dem 1. Advent und ist am kürzesten
        const lit = st.candles, ord = [0, 2, 1, 3];
        for (let i = 0; i < 4; i++) { const a = ord[i] / 4 * PI * 2, cxk = Math.cos(a) * .3, czk = Math.sin(a) * .3, burned = Math.max(0, lit - i) * .028, h = .26 - burned + (i < lit ? 0 : .01);
          it.s.add(N(G.cyl(.042, .046, h, 10), '#c1121f', cxk, .86 + h / 2, czk), N(G.cyl(.046, .046, .012, 10), '#a00e19', cxk, .86 + h - .004, czk), N(G.cyl(.003, .003, .03, 4), '#222', cxk, .86 + h + .015, czk));
          if (i < lit) { const wc = new Node().at(x, y, z); wc.rot = it.s.rot.slice(); const f = flame(cxk, .86 + h + .05, czk, 1); f.ph = Math.random() * 9; wc.add(f, new Node(G.sphere(.016, 5, 4), '#fff4c2', { emis: 1 }).at(cxk, .86 + h + .045, czk)); dyn(wc, flick(f)); } }
        obs('kranz', x, z, .75); place('kranz', it, lit === 4 ? 'Adventskranz (4. Advent)' : `Adventskranz (${lit}. Advent)`, 3);
        this.wreathFocus = this.advFocus.kranz; } }

    const D = st.doors;
    // 1 Lichterkette an der Startlinie
    if (D >= 1) { const ST = Fo.START_T - .012, q = P.at(ST), it = item(q.p[0], 0, q.p[2], Math.atan2(q.tan[0], q.tan[2])), W = 5.2 + Fo.TW;
      for (const zz of [-.18, .18]) for (let i = 0; i <= 40; i++) { const f = i / 40, xx = -W + f * 2 * W, yy = 3.95 - Math.sin(f * PI) * .55; it.g.add(sph(.07, LIGHTS[i % LIGHTS.length], xx, yy, zz)); if (i % 2) it.s.add(N(G.box(.08, .01, .01), '#2b3a2b', xx, yy + .06, zz)); }
      for (const sx of [-W, W]) for (let i = 0; i < 18; i++) { const a = i * .9, yy = .3 + i * .21; it.g.add(sph(.06, LIGHTS[(i + 2) % LIGHTS.length], sx + Math.cos(a) * .32, yy, Math.sin(a) * .32)); }
      place(1, it, 'Lichterkette am Start', 10); }
    // 2 Schneemann
    if (D >= 2) { const [px, pz] = sideAt(P, .13, 1, 10.5), sp = this.advSpot(px, pz, .8);
      if (sp) { const [x, z] = sp, it = item(x, H(x, z), z, Math.atan2(-(P.at(.13).p[2] - z), P.at(.13).p[0] - x));
        it.s.add(sph(.55, SNOW, 0, .5, 0), sph(.4, SNOW, 0, 1.25, 0), sph(.28, SNOW, 0, 1.8, 0));
        for (let i = 0; i < 3; i++) it.s.add(sph(.045, '#1b1b1b', .4 - i * .015, 1.1 + i * .17, 0));
        it.s.add(sph(.035, '#1b1b1b', .24, 1.88, .1), sph(.035, '#1b1b1b', .24, 1.88, -.1), N(G.cyl(0, .055, .3, 7), '#ff7f11', .38, 1.8, 0).rotate(0, 0, -PI / 2));
        for (let i = 0; i < 5; i++) it.s.add(sph(.022, '#1b1b1b', .25, 1.7 - Math.sin(i / 4 * PI) * .05, (i - 2) * .045));
        it.s.add(N(G.torus(.27, .055, 14, 6), '#c1121f', 0, 1.55, 0).rotate(PI / 2, 0, 0), N(G.box(.08, .35, .1), '#c1121f', .14, 1.38, .22).rotate(0, 0, .15));   // Schal
        it.s.add(N(G.cyl(.2, .2, .28, 10), '#1b1b1b', 0, 2.17, 0), N(G.cyl(.3, .3, .03, 12), '#1b1b1b', 0, 2.03, 0), N(G.cyl(.205, .205, .05, 10), '#c1121f', 0, 2.08, 0));
        it.s.add(rod([0, 1.35, .32], [.15, 1.75, .85], .025, '#6b4a2b'), rod([0, 1.35, -.32], [-.1, 1.65, -.85], .025, '#6b4a2b'), rod([.15, 1.75, .85], [.25, 1.85, .95], .015, '#6b4a2b'));
        it.s.add(rod([.15, .1, -.7], [.05, 1.9, -.55], .03, '#8a6a42'), N(G.cyl(.02, .16, .4, 8), '#c9a24a', .17, .2, -.72).rotate(0, 0, -.05));   // Besen
        obs(2, x, z, .7); place(2, it, 'Schneemann', 3); } }
    // 3 Vogelhäuschen
    if (D >= 3) { const [px, pz] = sideAt(P, .27, -1, 10.5), sp = this.advSpot(px, pz, .5);
      if (sp) { const [x, z] = sp, it = item(x, H(x, z), z, R() * 6);
        it.s.add(cyl(.05, .06, 1.6, 6, '#6b4a2b', 0, .8, 0), box(.7, .05, .55, '#8a6a42', 0, 1.62, 0), box(.5, .3, .35, '#a8794a', 0, 1.8, 0), N(G.box(.62, .04, .5), '#c1121f', 0, 2.03, .12).rotate(-.5, 0, 0), N(G.box(.62, .04, .5), '#c1121f', 0, 2.03, -.12).rotate(.5, 0, 0), N(G.box(.6, .05, .5), SNOW, 0, 2.1, 0).scale(1, 1, .9));
        for (let i = 0; i < 14; i++) it.s.add(sph(.015, '#d9b45a', (R() - .5) * .55, 1.66, (R() - .5) * .45));
        const bird = (bx, bz, ry, robin) => { const b = new Node().at(bx, 1.7, bz); b.rot = [0, ry, 0]; const c = robin ? '#7a5a3a' : '#3a86ff';
          b.add(N(G.sphere(.06, 7, 5), robin ? '#e8743b' : '#f2d14a', .015, 0, 0).scale(1.2, 1, .9), N(G.sphere(.055, 7, 5), c, -.025, .02, 0).scale(1.3, .9, .9), N(G.sphere(.04, 7, 5), robin ? '#e8743b' : '#1b1b1b', .06, .06, 0), N(G.cyl(0, .012, .03, 4), '#d9a520', .1, .06, 0).rotate(0, 0, -PI / 2), N(G.box(.07, .01, .04), c, -.09, .02, 0).rotate(0, 0, .3));
          if (!robin) b.add(N(G.sphere(.02, 5, 4), '#ffffff', .06, .06, .03), N(G.sphere(.02, 5, 4), '#ffffff', .06, .06, -.03));
          Mo.eyes(b, [.06, .06, 0], [.04, .04, .04], [.4, .3, .86], .009); it.s.add(b); };
        bird(.18, .1, .3, false); bird(-.15, -.12, 2.6, false); bird(.02, .18, -1.2, true);
        obs(3, x, z, .45); place(3, it, 'Vogelhäuschen', 2.5); } }
    // 4 Kerzen in den Fenstern des Bauernhauses
    if (D >= 4 && this.farm && this.farmWins && this.farmWins.length) { const F = this.farm, it = item(F.x, F.level, F.z, F.yaw);
      for (const [x, y, z, s] of this.farmWins) { if (z < 0) continue; const cy = y - .52 * s + .01;
        it.s.add(N(G.cyl(.035, .035, .16, 8), '#f4efe2', x, cy + .08, z + .17)); it.g.add(N(G.sphere(.03, 6, 4), '#ffb02e', x, cy + .2, z + .17).scale(1, 1.6, 1)); }
      const f = F.w(-5.5, 0); this.advStatic.push(...bake(it, 14)); focus(4, new Node().at(f[0], F.level + 2, f[1]), 'Kerzen im Bauernhaus'); }
    // 5 Grittibänze auf dem Brunnenrand
    if (D >= 5 && this.farm) { const F = this.farm, it = item(F.x, F.level, F.z, F.yaw);
      for (let i = 0; i < 3; i++) { const g = new Node().at(-5.15 + i * .7, .72, 4.02); g.rot = [0, PI / 2 - .2 + i * .2, 0]; const c = '#c98a4a', dk = '#8a5a2b';
        g.add(N(G.sphere(.1, 8, 6), c, 0, .15, 0).scale(.75, 1.2, .6), N(G.sphere(.075, 8, 6), c, 0, .33, 0).scale(.9, .95, .7), N(G.cyl(.035, .04, .16, 6), c, .07, .05, .05).rotate(.3, 0, .2), N(G.cyl(.035, .04, .16, 6), c, -.07, .05, .05).rotate(.3, 0, -.2),
          N(G.cyl(.03, .035, .15, 6), c, .11, .2, 0).rotate(0, 0, -1.1), N(G.cyl(.03, .035, .15, 6), c, -.11, .2, 0).rotate(0, 0, 1.1), sph(.012, '#3b1f0e', .025, .36, .05), sph(.012, '#3b1f0e', -.025, .36, .05), N(G.box(.05, .01, .01), '#3b1f0e', 0, .3, .052));
        for (let k = 0; k < 3; k++) g.add(sph(.013, k ? '#3b1f0e' : '#ffffff', 0, .22 - k * .06, .062)); g.add(N(G.box(.12, .02, .02), dk, 0, .1, .055)); it.s.add(g); }
      this.advStatic.push(...bake(it, 14)); const f = F.w(-4.4, 3.6); focus(5, new Node().at(f[0], F.level + .5, f[1]), 'Grittibänze am Brunnen'); }
    // 6 Schlitten mit Geschenken
    if (D >= 6) { const [px, pz] = sideAt(P, .4, 1, 10.5), sp = this.advSpot(px, pz, 1);
      if (sp) { const [x, z] = sp, it = item(x, H(x, z), z, R() * 6);
        for (const sz of [-.32, .32]) { it.s.add(box(1.5, .05, .06, '#b8862a', -.05, .06, sz), N(G.torus(.18, .03, 10, 4, PI * .55), '#b8862a', .7, .22, sz).rotate(0, 0, -.6)); for (const sx of [-.5, .1, .55]) it.s.add(box(.05, .22, .05, '#7a1c1c', sx, .18, sz)); }
        it.s.add(box(1.3, .06, .74, '#a3242b', 0, .3, 0), box(1.3, .25, .05, '#a3242b', 0, .44, .36), box(1.3, .25, .05, '#a3242b', 0, .44, -.36), box(.05, .5, .74, '#a3242b', -.65, .55, 0));
        gift(it, -.3, .33, .05, .32, '#2a9d8f', '#ffd23f', .3); gift(it, .2, .33, -.12, .28, '#c1121f', '#ffffff', -.2); gift(it, .05, .6, .05, .22, '#ffd23f', '#c1121f', .5); gift(it, .45, .33, .18, .2, '#3a86ff', '#ffffff', .1);
        obs(6, x, z, .95); place(6, it, 'Schlitten mit Geschenken', 2.5); } }
    // 7 Eisläufer auf dem Teich
    if (D >= 7 && this.pond) { const PD = this.pond, ry = PD.y + .02, rr = PD.r * .55;
      const sk = [{ suit: '#c1121f', hat: 'santa', hair: 'long', hairColor: '#6b4423', skin: '#f6d3b3' }, { suit: '#3a86ff', hat: 'cap', hair: 'short', hairColor: '#1d1a17', skin: '#c98e62' }, { suit: '#2a9d8f', hat: 'none', hair: 'ponytail', hairColor: '#d9b45a', skin: '#e8b48f' }];
      sk.forEach((lk, i) => { const p = dyn(person(lk, i === 1 ? 'cheer' : 'wave', .9)), off = i * 2.1, rad = rr * (1 - i * .12);
        p.anim.legs.forEach(l => l.add(N(G.box(.22, .02, .03), '#c0c7cf', .05, -.62, 0)));   // Schlittschuhe
        this.advUpd.push(t => { const a = t * .32 + off, x = PD.x + Math.cos(a) * rad, z = PD.z + Math.sin(a) * rad; p.pos = [x, ry, z]; p.rot = [Math.sin(t * 1.6 + i) * .05, Math.atan2(-Math.cos(a), -Math.sin(a)), Math.sin(t * 1.6 + i) * .12];
          Mo.animatePerson(p, t + i, false, i === 1 ? .3 : 0, 0); for (const l of p.anim.legs) l.rot[2] = Math.sin(t * 1.6 + i + l.phase) * .25; });
        if (i === 0) focus(7, p, 'Eisläufer auf dem Teich'); }); }
    // 8 Samichlaus mit Schmutzli und Esel (nur am 8.12.); danach bleibt ein Chlaussack beim Start
    if (D >= 8) {
      if (st.chlausDay) { const sam = person({ suit: '#b5121b', suit2: '#f4f1ea', pattern: 'solid', hat: 'santa', hair: 'bald', skin: '#f2c9a8', pack: '#8a6a42', pants: '#b5121b' }, 'hiker', 1.18); beard(sam, '#f7f7f2');
        const sch = dyn(person({ suit: '#3b2a1e', suit2: '#3b2a1e', pattern: 'solid', hat: 'none', hair: 'curly', hairColor: '#1d1a17', skin: '#c98e62', pants: '#2b2018' }, 'fork', 1.12)); beard(sch, '#2b2018');
        const esel = dyn(quad('donkey')); esel.scl = [1.2, 1.2, 1.2]; esel.add(N(G.sphere(.2, 8, 6), '#8a6a42', -.1, 1.15, .28).scale(1.2, .8, .7), N(G.sphere(.2, 8, 6), '#8a6a42', -.1, 1.15, -.28).scale(1.2, .8, .7));
        const h = { node: sam, t: .06, dir: 1, side: -1, speed: .55, pause: 0, nextPause: 6, ph: 0, chlaus: true, name: 'Samichlaus', trail: [] }; this.hikers.push(h);
        this.advUpd.push((t, dt) => { const p = sam.pos.slice(); const tr = h.trail; if (!tr.length || Math.hypot(p[0] - tr[0][0], p[2] - tr[0][2]) > .08) { tr.unshift(p); if (tr.length > 80) tr.pop(); }
          const at = dist => { let acc = 0; for (let i = 1; i < tr.length; i++) { const s = Math.hypot(tr[i][0] - tr[i - 1][0], tr[i][2] - tr[i - 1][2]); if (acc + s >= dist) { const f = (dist - acc) / (s || 1); return [tr[i - 1][0] + (tr[i][0] - tr[i - 1][0]) * f, tr[i - 1][2] + (tr[i][2] - tr[i - 1][2]) * f, i]; } acc += s; } return tr.length ? [tr[tr.length - 1][0], tr[tr.length - 1][2], tr.length - 1] : [p[0], p[2], 0]; };
          const walk = h.pause <= 0;
          [[sch, 1.4], [esel, 3.0]].forEach(([n, ds]) => { const [x, z, i] = at(ds), [x2, z2] = at(ds - .4); n.pos = [x, this.height(x, z), z]; if (Math.hypot(x2 - x, z2 - z) > .01) n.rot = [0, Math.atan2(-(z2 - z), x2 - x), 0];
            if (n === esel) animQuad(n, t, walk); else Mo.animatePerson(n, t + 1.3, walk, walk ? 0 : .35, 0); }); });
        focus(8, sam, 'Samichlaus mit Schmutzli und Esel'); }
      else { const ST = Fo.START_T, [px, pz] = sideAt(P, ST + .02, 1, 9.5), sp = this.advSpot(px, pz, .6);
        if (sp) { const [x, z] = sp, it = item(x, H(x, z), z, R() * 6);
          it.s.add(N(G.sphere(.35, 10, 7), '#a8865a', 0, .32, 0).scale(1, 1.15, 1), N(G.cyl(.12, .22, .2, 8), '#a8865a', 0, .7, 0), N(G.torus(.12, .025, 8, 4), '#c1121f', 0, .66, 0).rotate(PI / 2, 0, 0));
          for (let i = 0; i < 9; i++) { const a = i * .7, r = .45 + (i % 3) * .08; it.s.add(i % 3 === 2 ? N(G.sphere(.05, 7, 5), '#a8743a', Math.cos(a) * r, .05, Math.sin(a) * r).scale(1.2, .8, 1) : sph(.065, '#ff8c1a', Math.cos(a) * r, .065, Math.sin(a) * r)); }
          it.s.add(N(G.box(.18, .03, .12), '#8a4b20', .25, .02, -.5).rotate(0, .4, 0), N(G.box(.18, .03, .12), '#8a4b20', -.35, .02, .4).rotate(0, -.3, 0));
          obs(8, x, z, .6); place(8, it, 'Chlaussack mit Mandarinen und Nüssen', 2); } } }
    // 9 Rentiere bei den Steinböcken
    if (D >= 9 && this.massif) { const MS = this.massif;
      for (let i = 0; i < 3; i++) { const a = 1.1 + i * .5, sp = this.advSpot(MS.x + Math.cos(a) * (MS.R + 3), MS.z + Math.sin(a) * (MS.R + 3), .9, { rocks: true });
        if (!sp) continue; const [x, z] = sp, n = dyn(quad('reindeer')), yaw = R() * 6; n.pos = [x, H(x, z), z]; n.rot = [0, yaw, 0]; n.scl = [1.25, 1.25, 1.25]; obs(9, x, z, .8);
        const ph = R() * 9; this.advUpd.push(t => { const g = Math.sin(t * .25 + ph) > .3; n.anim.bob.rot = [0, 0, g ? -.25 : 0]; animQuad(n, t, false); });
        if (!this.advFocus[9]) focus(9, n, 'Rentiere'); } }
    // 10 Lebkuchenhaus
    if (D >= 10) { const [px, pz] = sideAt(P, .55, -1, 15), sp = this.advSpot(px, pz, 1.6);
      if (sp) { const [x, z] = sp, it = item(x, H(x, z), z, Math.atan2(-(P.at(.55).p[2] - z), P.at(.55).p[0] - x)), gb = '#a0602a', ic = '#fbf7ef';
        it.s.add(box(2.2, 1.5, 1.8, gb, 0, .75, 0), N(G.box(2.5, .1, 1.25), gb, 0, 1.85, .48).rotate(-.72, 0, 0), N(G.box(2.5, .1, 1.25), gb, 0, 1.85, -.48).rotate(.72, 0, 0));
        it.s.add(N(G.box(2.56, .08, 1.3), ic, 0, 1.93, .5).rotate(-.72, 0, 0).scale(1, 1, .18), N(G.box(2.56, .08, 1.3), ic, 0, 1.93, -.5).rotate(.72, 0, 0).scale(1, 1, .18));
        for (const zz of [.92, -.92]) for (let i = 0; i < 9; i++) it.s.add(sph(.05, ic, -1.25 + i * .31, 1.5 - Math.abs(zz) * .02, zz * 1.02));
        it.s.add(N(G.custom(B => { for (const sx of [-1.1, 1.1]) { const t = [[sx, 1.5, -.9], [sx, 1.5, .9], [sx, 2.25, 0]]; B.tri(...t); B.tri(t[0], t[2], t[1]); } }), gb));
        it.s.add(box(.05, .9, .6, '#6b3a17', 1.11, .45, 0), sph(.04, '#ffd23f', 1.14, .45, .2), box(.05, .4, .4, ic, 1.11, 1.05, .6), box(.06, .3, .3, '#3a86ff', 1.12, 1.05, .6), box(.05, .4, .4, ic, 1.11, 1.05, -.6), box(.06, .3, .3, '#3a86ff', 1.12, 1.05, -.6));
        const CAND = ['#c1121f', '#2a9d8f', '#ffd23f', '#ff006e', '#3a86ff', '#ffffff'];
        for (let i = 0; i < 26; i++) { const zz = (R() - .5) * 1.6, yy = .15 + R() * 1.2, sd = R() < .5 ? -1 : 1; it.s.add(sph(.05, CAND[i % CAND.length], (R() - .5) * 2, yy, sd * .91)); }
        for (let i = 0; i < 6; i++) { const a = i * 1.05; it.s.add(N(G.cyl(.035, .035, .5, 6), i % 2 ? '#c1121f' : '#ffffff', 1.45 + Math.cos(a) * .1, .25, -.9 + i * .36)); }
        it.s.add(N(G.box(.3, .5, .3), '#d8d2c8', -.6, 2.2, .4), N(G.box(.34, .06, .34), ic, -.6, 2.46, .4));
        obs(10, x, z, 1.6); place(10, it, 'Lebkuchenhaus', 4); } }
    // 11 Lichterbogen über dem Mühlebach
    if (D >= 11 && this.stream && this.stream.pts.length > 8) { const S = this.stream, pts = S.pts, i0 = Math.min(pts.length - 2, (S.mi || 4) + 4), a = pts[i0], b = pts[i0 + 1], dx = b[0] - a[0], dz = b[2] - a[2], l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l, wy = S.wl ? S.wl[i0] : a[1];
      const it = item(a[0], wy, a[2], Math.atan2(nx, nz)), span = 2.4;
      for (let i = 0; i <= 30; i++) { const f = i / 30, ang = f * PI, xx = 0, zz = -Math.cos(ang) * span, yy = Math.sin(ang) * 2.1 + .1; it.g.add(sph(.07, i % 2 ? '#ffe08a' : '#fff8e0', xx, yy, zz)); }
      it.s.add(N(G.torus(span, .025, 24, 4, PI), '#2b2d31', 0, .1, 0).rotate(0, PI / 2, 0).scale(1, 2.1 / span, 1));
      for (const zz of [-span, span]) it.s.add(cyl(.06, .08, .5, 6, '#5a3a22', 0, .1, zz));
      place(11, it, 'Lichterbogen an der Mühle', 3.5); }
    // 12 Iglu mit Kindern
    if (D >= 12) { const [px, pz] = sideAt(P, .72, 1, 12.5), sp = this.advSpot(px, pz, 1.8);
      if (sp) { const [x, z] = sp, it = item(x, H(x, z), z, R() * 6);
        it.s.add(N(G.dome(1.2, 14, 6), '#eef5fb', 0, 0, 0)); for (let r = 1; r < 5; r++) it.s.add(N(G.torus(1.2 * Math.cos(r * .3), .015, 20, 3), '#cfdde8', 0, 1.2 * Math.sin(r * .3), 0).rotate(PI / 2, 0, 0));
        it.s.add(N(G.cyl(.5, .5, .9, 10, 1), '#eef5fb', 1.2, .3, 0).rotate(0, 0, PI / 2).scale(1, 1, 1), N(G.cyl(.38, .38, .92, 10), '#2b3a4a', 1.21, .27, 0).rotate(0, 0, PI / 2));
        it.s.add(box(.35, .22, .25, '#eef5fb', -.6, .11, 1.4), box(.35, .22, .25, '#eef5fb', -.2, .11, 1.55));
        obs(12, x, z, 1.5); place(12, it, 'Iglu', 4);
        [[{ suit: '#ff006e', hat: 'party', hair: 'bob', hairColor: '#8a3b1f', skin: '#f6d3b3' }, 'cheer', -.9, 1.6], [{ suit: '#06d6a0', hat: 'cap', hair: 'short', hairColor: '#3b2a1e', skin: '#9a6440' }, 'wave', .4, 1.7]].forEach(([lk, kd, ox, oz], i) => {
          const c = Math.cos(it.s.rot[1]), s = Math.sin(it.s.rot[1]), wx = x + ox * c + oz * s, wz = z - ox * s + oz * c, k = dyn(person(lk, kd, .62)); k.pos = [wx, H(wx, wz), wz]; k.rot = [0, R() * 6, 0]; obs(12, wx, wz, .3);
          this.advUpd.push(t => Mo.animatePerson(k, t + i * 2, false, Math.sin(t * .8 + i) > .4 ? .6 : 0, 0)); }); } }
    // 13 Marroni-Stand und 19 Glühwein-Stand (Zielgelände, vor der Arena)
    const stall = (d, t, sd, title, roof, sign, steamCol) => { const [px, pz, yaw] = sideAt(P, t, sd, 13), sp = this.advSpot(px, pz, 1.5);
      if (!sp) return; const [x, z] = sp, q = P.at(t), it = item(x, H(x, z), z, Math.atan2(-(q.p[2] - z), q.p[0] - x));
      it.s.add(box(1.0, 1.0, 2.0, '#8a6a42', 0, .5, 0), box(1.1, .06, 2.1, '#6b4a2b', 0, 1.02, 0));
      for (const zz of [-.95, .95]) it.s.add(box(.08, 1.4, .08, '#6b4a2b', -.4, 1.7, zz), box(.08, 1.4, .08, '#6b4a2b', .45, 1.7, zz));
      for (let i = 0; i < 8; i++) it.s.add(N(G.box(1.25, .05, .27), i % 2 ? '#ffffff' : roof, .05, 2.42 + (i % 2) * .005, -.95 + i * .27).rotate(0, 0, -.25));
      const pl = Mo.plate ? Mo.plate(sign, .05, roof, 9) : null; if (pl) { pl.pos = [.56, .62, 0]; pl.rot = [0, PI / 2, 0]; it.s.add(pl); }
      for (let i = 0; i < 9; i++) it.g.add(sph(.05, LIGHTS[i % LIGHTS.length], .55, 2.2 - Math.sin(i / 8 * PI) * .15, -.95 + i * .24));
      const v = dyn(person({ suit: roof, hat: 'santa', hair: 'short', hairColor: '#3b2a1e', skin: '#e8b48f' }, 'stand', 1)), c = Math.cos(it.s.rot[1]), s = Math.sin(it.s.rot[1]);
      v.pos = [x - .8 * c, H(x, z), z + .8 * s]; v.rot = [0, it.s.rot[1], 0]; this.advUpd.push(t => Mo.animatePerson(v, t + d, false, 0, 0));
      // Ofen bzw. Topf mit Rauch/Dampf
      const ox = .1, oz = .55; if (d === 13) it.s.add(cyl(.28, .3, .5, 10, '#2b2b2b', ox, 1.3, oz), cyl(.06, .06, .9, 6, '#2b2b2b', ox, 1.9, oz), N(G.cyl(.25, .25, .02, 10), '#5a3a22', ox, 1.56, oz));
      else it.s.add(cyl(.26, .22, .35, 12, '#8d9399', ox, 1.22, oz), N(G.cyl(.24, .24, .02, 12), '#7a1c2b', ox, 1.38, oz)); for (let k = 0; k < 4; k++) it.s.add(N(G.cyl(.04, .035, .09, 8), '#f4f1ea', .3, 1.09, -.3 - k * .14));
      const wx = x + ox * c + oz * s, wz = z - ox * s + oz * c, top = H(x, z) + (d === 13 ? 2.35 : 1.45), puff = [];
      for (let k = 0; k < 7; k++) { const p = dyn(new Node(G.sphere(.12, 6, 4), steamCol, { alpha: .5 })); p.ph = k / 7; puff.push(p); }
      this.advUpd.push(t => puff.forEach(p => { const f = (t * .35 + p.ph) % 1; p.pos = [wx + Math.sin(f * 5 + p.ph * 9) * .15 + f * .3, top + f * 1.6, wz]; const s2 = .6 + f * 1.8; p.scl = [s2, s2, s2]; p.alpha = .45 * (1 - f); }));
      obs(d, x, z, 1.3); place(d, it, title, 3); };
    if (D >= 13) stall(13, .86, -1, 'Marroni-Stand', '#c1121f', 'MARRONI', '#b9b9b9');
    // 14 Sternsinger
    if (D >= 14) { const [px, pz] = sideAt(P, .6, 1, 10), sp = this.advSpot(px, pz, 1.2);
      if (sp) { const [x, z] = sp, q = P.at(.6), yaw = Math.atan2(-(q.p[2] - z), q.p[0] - x), c = Math.cos(yaw), s = Math.sin(yaw);
        const LK = [{ suit: '#8338ec', skin: '#f6d3b3', hair: 'long', hairColor: '#d9b45a' }, { suit: '#e63946', skin: '#6b4126', hair: 'curly', hairColor: '#1d1a17' }, { suit: '#2a9d8f', skin: '#c98e62', hair: 'short', hairColor: '#3b2a1e' }];
        LK.forEach((lk, i) => { const ox = 0, oz = (i - 1) * .7, wx = x + ox * c + oz * s, wz = z - ox * s + oz * c, k = dyn(person({ ...lk, hat: 'crown' }, i === 0 ? 'flag' : i === 1 ? 'sign' : 'cheer', .8)); k.pos = [wx, H(wx, wz), wz]; k.rot = [0, yaw, 0];
          if (i === 0) { const fl = k.anim.flag; if (fl) { fl.children.length = 0; const star = new Node(); for (let j = 0; j < 5; j++) star.add(N(G.box(.05, .34, .05), '#ffd23f', 0, .1, 0, { emis: 1 }).rotate(j * PI / 5 * 2, 0, 0)); fl.add(star); } }
          this.advUpd.push(t => Mo.animatePerson(k, t + i, false, i === 2 && Math.sin(t * .7) > .5 ? .5 : 0, 0)); obs(14, wx, wz, .35); if (i === 0) focus(14, k, 'Sternsinger'); }); } }
    // 15 Zuckerstangen entlang der Strecke
    if (D >= 15) { const it = item(0, 0, 0, 0), T = P.total; let n = 0;
      for (let t = .45; t < .58; t += 2.6 / T) for (const sd of [-1, 1]) { const [x, z] = sideAt(P, t, sd, 8.1); if (this.obsBlocked(x, z, .35) || this.arenaReserved && this.arenaReserved(x, z, -1.6)) continue; const y = H(x, z), q = P.at(t);
        for (let k = 0; k < 7; k++) it.s.add(cyl(.055, .055, .14, 8, k % 2 ? '#c1121f' : '#ffffff', x, y + .07 + k * .14, z));
        const yaw = Math.atan2(q.tan[0], q.tan[2]); it.s.add(N(G.torus(.13, .055, 10, 6, PI), '#c1121f', x + Math.sin(yaw) * .13 * sd, y + 1.0, z + Math.cos(yaw) * .13 * sd).rotate(0, yaw + PI / 2, 0)); obs(15, x, z, .15); n++; if (n === 4) focus(15, new Node().at(x, y + .6, z), 'Zuckerstangen'); }
      this.advStatic.push(...bake(it, 400)); }
    // 16 Weihnachtsbaum im Hof
    if (D >= 16 && this.farm) { const F = this.farm; let best = null;
      for (const [u, v] of [[-.8, 6.5], [1.2, 6.8], [-2.5, 7.4], [.5, 4.8], [-9.5, 6], [11, 8.5], [-11, 8]]) if (!this.farmBlocked(u, v, 1.1)) { best = [u, v]; break; }
      if (best) { const [u, v] = best, it = item(F.x, F.level, F.z, F.yaw); fir(it, u, 0, v, 3.2, { balls: 26, lights: 40, star: true, snow: true, seed: 16 }); gift(it, u + .7, 0, v + .3, .3, '#c1121f', '#ffd23f'); gift(it, u - .6, 0, v + .5, .25, '#2a9d8f', '#ffffff', .4);
        const bl = [u, v, 1.1]; bl.advent = true; F.blocks.push(bl); this.advStatic.push(...bake(it, 14)); const f = F.w(u, v); focus(16, new Node().at(f[0], F.level + 1.5, f[1]), 'Weihnachtsbaum im Hof'); } }
    // 17 Fackeln am Teichufer
    if (D >= 17 && this.pond) { const PD = this.pond, it = item(PD.x, 0, PD.z, 0), fl = [];
      for (let i = 0; i < 10; i++) { const a = i / 10 * PI * 2 + .2, x = PD.x + Math.cos(a) * (PD.r + 1.4), z = PD.z + Math.sin(a) * (PD.r + 1.4);
        if (this.obsBlocked(x, z, .4) || (PD.jetty && Math.hypot(PD.jetty[0] - x, PD.jetty[1] - z) < 3.2) || P.dist(x, z) < 7.6) continue; const y = H(x, z);
        it.s.add(N(G.cyl(.035, .045, 1.5, 6), '#5a3a22', x - PD.x, y + .75, z - PD.z), N(G.cyl(.08, .05, .2, 8), '#2b2b2b', x - PD.x, y + 1.55, z - PD.z));
        const f = dyn(new Node(G.sphere(.12, 7, 5), '#ff9a1f', { emis: 1 }).at(x, y + 1.72, z)); f.ph = R() * 9; const f2 = dyn(new Node(G.sphere(.07, 6, 4), '#fff0a8', { emis: 1 }).at(x, y + 1.68, z)); fl.push(f); obs(17, x, z, .25);
        this.advUpd.push(t => { const k = .85 + Math.sin(t * 11 + f.ph) * .15 + Math.sin(t * 23 + f.ph) * .08; f.scl = [k, 1.3 + (k - .85) * 3, k]; f2.scl = [k, k * 1.2, k]; }); }
      this.advStatic.push(...bake(it, 30)); focus(17, new Node().at(PD.x, PD.y + 1.2, PD.z), 'Fackeln am Teich'); }
    // 18 Krippe beim Stall
    if (D >= 18 && this.farm) { const F = this.farm, pref = F.w(14.5, -4.5), sp = this.advSpot(pref[0], pref[1], 1.8, { farm: true });
      if (sp) { const [x, z] = sp, it = item(x, H(x, z), z, F.yaw + PI / 2);
        for (const [a, b] of [[-1.3, -.9], [1.3, -.9], [-1.3, .9], [1.3, .9]]) it.s.add(box(.12, b < 0 ? 2.1 : 1.7, .12, '#6b4a2b', a, b < 0 ? 1.05 : .85, b));
        it.s.add(N(G.box(3.0, .08, 2.2), '#7a5532', 0, 1.95, 0).rotate(.18, 0, 0), N(G.box(3.0, .06, 2.2), SNOW, 0, 2.0, 0).rotate(.18, 0, 0), box(2.8, 1.5, .08, '#8a6a42', 0, .75, -.92));
        it.s.add(N(G.cyl(1.4, 1.4, .05, 12), '#d9b45a', 0, .03, 0).scale(1, 1, .7));
        it.s.add(box(.6, .1, .32, '#8a6a42', 0, .38, .15), rod([-.28, 0, .0], [-.22, .38, .15], .025, '#6b4a2b'), rod([.28, 0, .0], [.22, .38, .15], .025, '#6b4a2b'), rod([-.28, 0, .3], [-.22, .38, .15], .025, '#6b4a2b'), rod([.28, 0, .3], [.22, .38, .15], .025, '#6b4a2b'), N(G.box(.5, .06, .26), '#e3c35a', 0, .45, .15));
        it.s.add(N(G.sphere(.1, 8, 6), '#f4f1ea', 0, .52, .15).scale(1.6, .8, .9), sph(.06, '#e8b48f', .14, .55, .15));
        const st = new Node().at(0, 2.75, 0); for (let j = 0; j < 4; j++) st.add(N(G.box(.06, .45, .06), '#ffd23f').rotate(0, 0, j * PI / 4)); it.g.add(st); it.s.add(rod([0, 2.0, -.2], [0, 2.55, 0], .02, '#6b4a2b'));
        place(18, it, 'Krippe beim Stall', 4); obs(18, x, z, 1.8);
        const c = Math.cos(it.s.rot[1]), s = Math.sin(it.s.rot[1]), W = (u, v) => [x + u * c + v * s, z - u * s + v * c];
        [[{ suit: '#3a6fb0', hat: 'none', hair: 'long', hairColor: '#3b2a1e', skin: '#e8b48f' }, -.7, .35], [{ suit: '#7a5a3a', hat: 'none', hair: 'short', hairColor: '#4a3020', skin: '#c98e62' }, .75, .3]].forEach(([lk, u, v], i) => {
          const p = dyn(person(lk, i ? 'hiker' : 'stand', .95)), [wx, wz] = W(u, v); p.pos = [wx, H(wx, wz), wz]; p.rot = [0, it.s.rot[1] + (i ? PI : 0) + PI / 2 * (i ? 1 : -1) * .5, 0]; if (i) beard(p, '#4a3020');
          this.advUpd.push(t => Mo.animatePerson(p, t + i * 3, false, 0, 0)); });
        [['ox', -.6, -.45, .2], ['donkey', .7, -.45, PI - .2]].forEach(([kd, u, v, ry]) => { const n = dyn(quad(kd)), [wx, wz] = W(u, v); n.pos = [wx, H(wx, wz), wz]; n.rot = [0, it.s.rot[1] + ry, 0]; n.scl = [.85, .85, .85]; this.advUpd.push(t => animQuad(n, t, false)); }); } }
    if (D >= 19) stall(19, .82, 1, 'Glühwein-Stand', '#7a1c2b', 'GLÜHWEIN', '#e8e8e8');
    // 20 Pferdeschlitten (fährt Runden auf einer freien Wiese)
    if (D >= 20) { let ring = null; const RAD = 6.5;
      for (let k = 0; k < 300 && !ring; k++) { const a = k * 2.399, dd = 18 + Math.sqrt(k) * 1.6, cx = Math.cos(a) * dd * .9, cz = -8 + Math.sin(a) * dd;
        let ok = true; for (let i = 0; i < 16 && ok; i++) { const b = i / 16 * PI * 2; if (!this.advFree(cx + Math.cos(b) * RAD, cz + Math.sin(b) * RAD, 1.3)) ok = false; }
        if (ok) ring = [cx, cz]; }
      if (ring) { const [cx, cz] = ring, horse = dyn(quad('horse')), sl = new Node(), drv = person({ suit: '#1d3557', hat: 'tophat', hair: 'short', hairColor: '#3b2a1e', skin: '#e8b48f' }, 'stand', .95);
        for (const sz of [-.4, .4]) sl.add(box(1.8, .05, .06, '#d9a520', 0, .06, sz), N(G.torus(.2, .035, 10, 4, PI * .6), '#d9a520', .9, .24, sz).rotate(0, 0, -.7));
        sl.add(box(1.5, .5, .9, '#a3121b', 0, .45, 0), box(.5, .8, .9, '#a3121b', -.55, .75, 0), box(1.52, .06, .92, '#ffd23f', 0, .71, 0), N(G.box(.4, .3, .7), '#2b2b2b', .3, .82, 0));
        drv.pos = [.3, .55, 0]; drv.rot = [0, 0, 0]; sl.add(drv); for (const sz of [-.35, .35]) sl.add(rod([.75, .5, sz], [1.9, .75, sz * .5], .025, '#5a3a22'));
        for (let i = 0; i < 6; i++) horse.add(N(G.sphere(.045, 6, 4), '#ffd23f', .35 - i * .05, 1.05 - i * .02, i % 2 ? .12 : -.12));
        dyn(sl); for (let i = 0; i < 16; i++) { const b = i / 16 * PI * 2; obs(20, cx + Math.cos(b) * RAD, cz + Math.sin(b) * RAD, .9); }
        this.advUpd.push(t => { const w = t * .16, hx = cx + Math.cos(w) * RAD, hz = cz + Math.sin(w) * RAD, yawH = Math.atan2(-Math.cos(w), -Math.sin(w));
          horse.pos = [hx, H(hx, hz), hz]; horse.rot = [0, yawH, 0]; animQuad(horse, t * 1.2, true);
          const w2 = w - 2.3 / RAD, sx = cx + Math.cos(w2) * RAD, sz = cz + Math.sin(w2) * RAD; sl.pos = [sx, H(sx, sz), sz]; sl.rot = [0, Math.atan2(-Math.cos(w2 + .15), -Math.sin(w2 + .15)), 0];
          Mo.animatePerson(drv, t, false, 0, 0); });
        focus(20, horse, 'Pferdeschlitten'); } }
    // 21 Laternen-Umzug: Fans im Zielgelände mit Laternen
    if (D >= 21 && this.arena) { const it = item(0, 0, 0, 0); let n = 0;
      this.arena.members.forEach((m, i) => { if (i % 3) return; const y = H(m.x, m.z) + (m.lift || 0), dx = Math.cos(m.yaw) * .1, dz = -Math.sin(m.yaw) * .1, x = m.x + dx + .28, z = m.z + dz;
        it.s.add(rod([x, y + 1.15, z], [x, y + 2.15, z], .015, '#6b4a2b'), rod([x, y + 2.15, z], [x + .18, y + 2.15, z], .012, '#6b4a2b'));
        it.g.add(N(G.sphere(.13, 8, 6), ['#ff7b29', '#ffd23f', '#ff4d6d', '#5cc8ff'][n % 4], x + .18, y + 1.95, z).scale(1, 1.2, 1)); it.s.add(cyl(.05, .05, .03, 6, '#2b2b2b', x + .18, y + 2.1, z), cyl(.05, .05, .03, 6, '#2b2b2b', x + .18, y + 1.8, z)); n++; });
      this.advStatic.push(...bake(it, 400)); const q = P.at(.94); focus(21, new Node().at(q.p[0], 1.5, q.p[2]), 'Laternen-Umzug im Zielgelände'); }
    // 22 Geschenkberg unter einer Tanne auf der Spielwiese
    if (D >= 22 && this.games) { const gm = this.games, pref = gm.w(-7.5, -2), sp = this.advSpot(pref[0], pref[1], 1.6, { games: true, step: .6 });
      if (sp) { const [x, z] = sp, it = item(x, H(x, z), z, R() * 6); fir(it, 0, 0, 0, 3.6, { balls: 18, snow: true, seed: 22 });
        const GC = [['#c1121f', '#ffd23f'], ['#2a9d8f', '#ffffff'], ['#ffd23f', '#c1121f'], ['#3a86ff', '#ffd23f'], ['#8338ec', '#ffffff'], ['#ff006e', '#ffffff'], ['#06d6a0', '#c1121f']];
        for (let i = 0; i < 12; i++) { const a = i * 1.9, r = .9 + (i % 3) * .3, w = .22 + R() * .2; gift(it, Math.cos(a) * r, i > 8 ? .3 : 0, Math.sin(a) * r, w, ...GC[i % GC.length], R() * 3); }
        obs(22, x, z, 1.5); place(22, it, 'Geschenkberg', 4); } }
    // 23 Sternschnuppen (nur bei Dunkelheit)
    if (D >= 23) { const st2 = []; for (let i = 0; i < 3; i++) { const s = dyn(new Node(G.box(2.2, .06, .06), '#fff6d0', { emis: 1, alpha: 0 })); s.ph = i * 4.1; st2.push(s); }
      this.advUpd.push(t => st2.forEach((s, i) => { const T2 = 11, f = ((t + s.ph) % T2) / 1.4, k = Math.floor((t + s.ph) / T2), dark = (this.lampOnV || 0) > .5;
        if (!dark || f > 1) { s.alpha = 0; return; } const R2 = rng(97 + k * 7 + i), a = R2() * 6.3, x0 = (R2() - .5) * 90, z0 = -20 + (R2() - .5) * 80, y0 = 38 + R2() * 14;
        s.pos = [x0 + Math.cos(a) * f * 22, y0 - f * 8, z0 + Math.sin(a) * f * 22]; s.rot = [0, -a, -.35]; s.alpha = Math.sin(f * PI) * .95; }));
      focus(23, new Node().at(0, 30, -10), 'Sternschnuppen (am Abend)'); }
    // 24 Grosser Christbaum im Ziel (hinter dem Siegerpodest) und Feuerwerk am Heiligabend
    if (D >= 24 && this.podium) { const PO = this.podium, [x, z] = PO.W(0, 11.2), it = item(x, H(x, z), z, 0);
      fir(it, 0, 0, 0, 9, { tiers: 6, balls: 60, lights: 140, star: true, snow: true, seed: 24 }); obs(24, x, z, 3); place(24, it, 'Christbaum im Ziel', 10);
      // Feuerwerk am Heiligabend (sobald es dunkel ist): zwei Raketen abwechselnd, Funkenkugeln in einer Farbe
      if (st.christmas) { const BURST = [], NS = 60;
        for (let r = 0; r < 2; r++) { const sp = []; for (let i = 0; i < NS; i++) sp.push(dyn(new Node(G.sphere(.22, 5, 4), '#ffffff', { emis: 1, alpha: 0 }))); BURST.push(sp); }
        this.advUpd.push(t => { const dark = (this.lampOnV || 0) > .4;
          BURST.forEach((sp, r) => { const per = 3.2, tt = t + r * 1.6, k = Math.floor(tt / per), f = (tt % per) / per, R2 = rng(31 + k * 2 + r), col = new Node(null, LIGHTS[(k * 3 + r * 2) % 5]).color;
            const cx2 = x + (R2() - .5) * 22, cz2 = z + (R2() - .5) * 14, cy = H(x, z) + 17 + R2() * 7;
            sp.forEach((s, i) => { if (!dark) { s.alpha = 0; return; }
              if (f < .22) { const u = f / .22; s.pos = [cx2, cy - 15 * (1 - u), cz2]; s.alpha = i < 3 ? .9 : 0; s.color = [1, .85, .5]; return; }   // aufsteigende Rakete
              const g = (f - .22) / .78, th = Math.acos(1 - 2 * (i + .5) / NS), ph = i * 2.399, rad = 6.5 * Math.sqrt(g);
              s.pos = [cx2 + Math.sin(th) * Math.cos(ph) * rad, cy + Math.cos(th) * rad - g * g * 4, cz2 + Math.sin(th) * Math.sin(ph) * rad]; s.color = col; s.alpha = Math.max(0, 1 - g * 1.05); }); }); }); } }
  };
  Fo.prototype.updateAdvent = function (t, dt) { if (!this.advUpd) return; for (const u of this.advUpd) u(t, dt); for (const n of this.advDyn) n.visible = n.alpha > .01; };   // unsichtbare Funken nicht zeichnen
  // Kamera zu einem Türchen
  Fo.prototype.showAdvent = function (d) { const f = this.advFocus && (this.advFocus[d] || (d === 'kranz' && this.wreathFocus)); if (!f) return false; this.track(f.node, f.name); return true; };
})();
