// Grand Prix Ambition – 3D-Waldpfad
(function () {
  'use strict';
  const { G, Node, merge, Renderer, Path } = window.Mini3D;
  const PI = Math.PI;
  const START_T = .03, FINISH_T = .93;          // Fortschritt 0..100 % → Pfadparameter
  const tFor = pct => START_T + Math.max(0, Math.min(1.06, pct)) * (FINISH_T - START_T);

  function rng(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
  const mix = (a, b, f) => a.map((v, i) => v + (b[i] - v) * f);
  function rodN(a, b, r, col) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.hypot(dx, dy, dz) || 1e-6;
    const tz = Math.acos(Math.max(-1, Math.min(1, dy / len))), ty = Math.sin(tz) > 1e-6 ? Math.atan2(dz / len, -dx / len) : 0;
    return new Node(G.cyl(r * .7, r, len, 5), col).at((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2).rotate(0, ty, tz);
  }
  const hx = Mini3D.hex;


  // ---------- Sonne, Kalender, Jahreszeit (Bern) ----------
  const BERN = { lat: 46.948, lon: 7.4474 }, TZ = 'Europe/Zurich';
  function sunPos(date) {
    const rad = PI / 180, d = date.getTime() / 864e5 - 10957.5;
    const g = ((357.529 + .98560028 * d) % 360) * rad, q = (280.459 + .98564736 * d) % 360;
    const L = (q + 1.915 * Math.sin(g) + .02 * Math.sin(2 * g)) * rad, e = (23.439 - .00000036 * d) * rad;
    const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)), dec = Math.asin(Math.sin(e) * Math.sin(L));
    const gmst = (((18.697374558 + 24.06570982441908 * d) % 24) + 24) % 24, H = (gmst * 15 + BERN.lon) * rad - ra, lat = BERN.lat * rad;
    const el = Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(H));
    const az = Math.atan2(-Math.sin(H), Math.tan(dec) * Math.cos(lat) - Math.sin(lat) * Math.cos(H));
    return { el: el / rad, az };
  }
  const fmtParts = d => Object.fromEntries(new Intl.DateTimeFormat('de-CH', { timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' }).formatToParts(d).map(p => [p.type, p.value]));
  function sunTimes(date) {
    const p = fmtParts(date), y = +p.year, m = +p.month, dd = +p.day, start = Date.UTC(y, m - 1, dd) - 3 * 3600e3;
    let rise = null, set = null, prev = sunPos(new Date(start)).el;
    for (let t = start + 120e3; t <= start + 28 * 3600e3; t += 120e3) {
      const e = sunPos(new Date(t)).el, lp = fmtParts(new Date(t));
      if (+lp.day === dd) { if (prev < -.833 && e >= -.833 && !rise) rise = new Date(t); if (prev >= -.833 && e < -.833 && rise && !set) set = new Date(t); }
      prev = e;
    }
    return { rise, set, key: y + '-' + m + '-' + dd };
  }
  function seasonOf(date) { const p = fmtParts(date), m = +p.month, d = +p.day, md = m * 100 + d;
    if (md >= 1201 || md < 321) return 'winter'; if (md < 621) return 'spring'; if (md < 923) return 'summer'; return 'autumn'; }
  // Klimanormwerte Bern-Zollikofen 1991–2020 (Monatsmittel °C) und halbe Tagesschwankung
  const NORM = [0.3, 1.5, 5.3, 9.0, 13.1, 16.6, 18.6, 18.0, 14.0, 9.6, 4.4, 1.1], AMP = [2.6, 3.4, 4.3, 4.8, 4.9, 5.1, 5.3, 5.2, 4.7, 3.8, 2.8, 2.4];
  const hashDay = k => { let h = 2166136261; for (const ch of k) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return ((h >>> 0) % 1000) / 1000 - .5; };
  function tempModel(date) {
    const p = fmtParts(date), m = +p.month - 1, d = +p.day, h = +p.hour + +p.minute / 60;
    const pos = m + (d - 15) / 30.4, i0 = ((Math.floor(pos) % 12) + 12) % 12, i1 = (i0 + 1) % 12, f = pos - Math.floor(pos);
    const mean = NORM[i0] + (NORM[i1] - NORM[i0]) * f, amp = AMP[i0] + (AMP[i1] - AMP[i0]) * f;
    const k0 = p.year + '-' + p.month + '-' + p.day, prev = new Date(date.getTime() - 864e5), pp = fmtParts(prev), k1 = pp.year + '-' + pp.month + '-' + pp.day;
    const dev = (hashDay(k0) * (h / 24) + hashDay(k1) * (1 - h / 24)) * 6;
    return mean + amp * Math.cos((h - 15) / 24 * 2 * PI) + dev;
  }
  const WX = c => c === 0 ? 'klar' : c === 1 ? 'meist sonnig' : c === 2 ? 'teils bewölkt' : c === 3 ? 'bedeckt' : c === 45 || c === 48 ? 'Nebel' : c >= 51 && c <= 57 ? 'Nieselregen'
    : c >= 61 && c <= 67 ? 'Regen' : c >= 71 && c <= 77 ? 'Schnee' : c >= 80 && c <= 82 ? 'Regenschauer' : c === 85 || c === 86 ? 'Schneeschauer' : c >= 95 ? 'Gewitter' : '';
  const precipOf = c => c == null ? null : (c >= 51 && c <= 67) || (c >= 80 && c <= 82) || c >= 95 ? 'rain' : (c >= 71 && c <= 77) || c === 85 || c === 86 ? 'snow' : null;
  const SEASON_DE = { winter: 'Winter', spring: 'Frühling', summer: 'Sommer', autumn: 'Herbst' };
  const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const css = c => `rgb(${c.map(v => Math.round(Math.max(0, Math.min(1, v)) * 255)).join(',')})`;

  // Figur zu einer Geometrie verschmelzen (ohne Schatten/Transparenz), lokale Koordinaten
  function lodOf(n) { const keep = [n.pos, n.rot, n.scl], hid = [];
    n.pos = [0, 0, 0]; n.rot = [0, 0, 0]; n.scl = [1, 1, 1]; const bob = n.anim && n.anim.bob, by = bob ? bob.pos[1] : 0; if (bob) bob.pos[1] = 0;
    (function walk(k) { if (k.alpha < 1 && k.visible) { k.visible = false; hid.push(k); } k.children.forEach(walk); })(n);
    const m = merge(n); if (bob) bob.pos[1] = by; hid.forEach(k => { k.visible = true; }); [n.pos, n.rot, n.scl] = keep; m.cull = n.cull; return m; }
  class Forest {
    constructor(canvas, labelLayer, opts = {}) {
      this.canvas = canvas; this.layer = labelLayer; this.opts = opts;
      this.r = new Renderer(canvas);
      Object.assign(this.r.env, { sun: [0.42, 0.82, 0.38].map(v => v / Math.hypot(.42, .82, .38)), sky: [0.75, 0.86, 1.0], ground: [0.28, 0.34, 0.22], fog: [0.80, 0.89, 0.90], fogN: 55, fogF: 170 });
      this.path = new Path([[0, 0, 40], [-8, 0, 30], [5, 0, 20], [12, 0, 9], [3, 0, 0], [-9, 0, -7], [-12, 0, -17], [-2, 0, -26], [9, 0, -33], [13, 0, -42]]);
      this.racers = new Map(); this.parts = []; this.t0 = performance.now(); this.running = false;
      this.cam = { yaw: 0, pitch: 1.35, dist: 140, target: [0, 0, -2], fov: .8 };   // Start hoch oben → Anflug
      this.want = null; this.mode = 'overview';
      this.uo = { yaw: 0, pitch: 0, dist: 1 }; this.lastInput = 0; this.side = 1;
      this.shotEl = document.createElement('div'); this.shotEl.className = 'shot'; this.layer.appendChild(this.shotEl);
      this.timeScale = 1; this.timeOffset = 0; this.season = seasonOf(this.now());
      this.buildWorld();
      this.spawnPeople();
      this.spawnPond();
      this.spawnRocks();
      this.spawnAnimals();
      this.farmLife = []; if (this.spawnFarm) this.spawnFarm();
      this.spawnFlyers();
      this.buildWeather();
      this.buildClouds();
      this.updateSky(true);
      setInterval(() => { const sea = seasonOf(this.now()); if (sea !== this.season) { this.season = sea; this.buildWorld(); this.buildWeather(); } }, 3600e3);
      this.overview();
      this.bindControls();
      addEventListener('resize', () => { if (this.mode === 'overview') this.overview(); });
    }

    // ---------- Welt ----------
    buildWorld() {
      const P = this.path, R = rng(42);
      this.obs = new Map(); this.trees = new Map();
      // Zuschauerplätze (fest, damit dort nichts wächst)
      const CR = rng(99); this.crowdSpots = [];
      [[.035, 1], [.19, -1], [.33, 1], [.47, -1], [.6, 1], [.74, -1], [.86, 1]].concat(this.planArena ? [] : [[.945, -1]]).forEach(([t, sd], gi) => {
        const q = P.at(t), cx = q.p[0] + q.side[0] * sd * 6.9, cz = q.p[2] + q.side[2] * sd * 6.9, n = gi === 0 || gi === 7 ? 6 : 3 + Math.floor(CR() * 2), members = [];
        for (let i = 0; i < n; i++) { const along = (i - (n - 1) / 2) * 1.35, back = (i % 2) * .9;
          const x = cx + q.tan[0] * along + q.side[0] * sd * back, z = cz + q.tan[2] * along + q.side[2] * sd * back;
          members.push({ x, z, yaw: Math.atan2(sd * q.side[2], -sd * q.side[0]) + (CR() - .5) * .4 }); this.addObs(x, z, .5); }
        this.crowdSpots.push({ x: cx, z: cz, t, sd, members });
      });
      this.arena = null; if (this.planArena) this.planArena(P);
      // Teich: freie, gut sichtbare Stelle neben dem Pfad
      this.pond = null; { let best = null;
        for (let x = -30; x <= 30; x += 2) for (let z = -40; z <= 30; z += 2) { const d = P.dist(x, z); if (d < 15 || d > 19) continue;
          if (this.crowdSpots.some(c => Math.hypot(c.x - x, c.z - z) < 13)) continue;
          const sc = Math.hypot(x, (z - 2) * .8); if (!best || sc < best[2]) best = [x, z, sc]; }
        if (best) this.pond = { x: best[0], z: best[1], r: 6.5, y: .35 }; }
      // Felsmassiv: abseits des Pfads, weit weg vom Teich, gut sichtbar
      this.massif = null; { let best = null;
        for (let x = -40; x <= 40; x += 2) for (let z = -50; z <= 36; z += 2) { const d = P.dist(x, z); if (d < 23 || d > 30) continue;
          if (this.pond && Math.hypot(x - this.pond.x, z - this.pond.z) < 30) continue;
          if (this.crowdSpots.some(c => Math.hypot(c.x - x, c.z - z) < 18)) continue;
          const sc = Math.abs(x) * .6 + Math.abs(z + 5) * .5; if (!best || sc < best[2]) best = [x, z, sc]; }
        if (best) this.massif = { x: best[0], z: best[1], R: 11 }; }
      this.farm = null; if (this.planFarm) this.planFarm(P);
      const PD = this.pond;
      if (PD) this.addObs(PD.x, PD.z, PD.r + .3);
      const MS = this.massif;
      const reserved = (x, z, r) => this.crowdSpots.some(c => Math.hypot(c.x - x, c.z - z) < r + 4.2) || (PD && Math.hypot(PD.x - x, PD.z - z) < PD.r + 3.2 + r) || (MS && Math.hypot(MS.x - x, MS.z - z) < MS.R + 1.5 + r) || (this.farm && this.farmReserved(x, z, r)) || (this.arena && this.arenaReserved(x, z, r)) || (this.sceneReserved && this.sceneReserved(x, z, r));
      const baseH = (x, z) => { const d = P.dist(x, z), k = Math.min(1, Math.max(0, (d - 7) / 12));
        return k * (Math.sin(x * .08) * 2.2 + Math.cos(z * .07 + 1) * 1.8 + Math.sin((x + z) * .15) * .7 + 1.2); };
      if (this.farm) this.farm.level = baseH(this.farm.x, this.farm.z);
      const height0 = (x, z) => { const h0 = this.farm ? this.farmHeight(x, z, baseH(x, z)) : baseH(x, z); if (!PD) return h0; const dp = Math.hypot(x - PD.x, z - PD.z); if (dp > PD.r + 7) return h0;
        if (dp < PD.r) return PD.y - .15 - 1.5 * (1 - (dp / PD.r) ** 2);
        const lvl = PD.y + .22; return lvl + (h0 - lvl) * smooth(PD.r, PD.r + 7, dp); };
      const height = (x, z) => { const h = height0(x, z); return this.streamCarve ? this.streamCarve(x, z, h) : h; };   // Bachbett
      this.height = height;
      this.stream = this.games = null; if (this.planScenes) this.planScenes(P);   // braucht das Gelände (Bach fliesst bergab)
      // Boden mit Farbverlauf
      const ground = G.custom(B => { const N = 64, S = 220, step = S / N, col = [];
        const c = (x, z) => { const d = P.dist(x, z), n = (Math.sin(x * .9) * Math.cos(z * .7) + Math.sin(x * .23 + z * .31)) * .5;
          const SEA = this.season, base = SEA === 'winter' ? [hx('#e6ecf2'), hx('#f7f9fc')] : SEA === 'autumn' ? [hx('#6f9a3f'), hx('#a39a45')] : SEA === 'spring' ? [hx('#6cb04a'), hx('#95c95a')] : [hx('#5e9c45'), hx('#7fb24f')];
          let g = mix(base[0], base[1], .5 + n * .5); if (SEA === 'winter' && n > .55) g = mix(g, hx('#7d9a6a'), .5);
          if (d < 7.5) g = mix(SEA === 'winter' ? hx('#cfd8de') : hx('#6f8a3f'), g, Math.max(0, (d - 5) / 2.5));
          if (PD) { const dp = Math.hypot(x - PD.x, z - PD.z); if (dp < PD.r) g = mix(hx('#3f4f33'), hx('#6a6a48'), dp / PD.r); else if (dp < PD.r + 1.6) g = mix(hx(SEA === 'winter' ? '#dfe6ea' : '#9c8a5e'), g, (dp - PD.r) / 1.6); }
          return this.farm ? this.farmGround(x, z, g) : g; };
        for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
          const x0 = -S / 2 + i * step, z0 = -S / 2 - 30 + j * step, x1 = x0 + step, z1 = z0 + step;
          const v = [[x0, height(x0, z0), z0], [x1, height(x1, z0), z0], [x1, height(x1, z1), z1], [x0, height(x0, z1), z1]];
          const cc = c((x0 + x1) / 2, (z0 + z1) / 2);
          B.tri(v[0], v[2], v[1]); B.tri(v[0], v[3], v[2]); for (let k = 0; k < 6; k++) col.push(...cc);
        } B.c = col; });
      const world = new Node();
      world.add(new Node(ground));
      // Pfad als Band
      const pathGeo = G.custom(B => { const col = [], W = 4.4, n = 260;
        const dirt = s => { const a = Math.abs(s); let c = hx('#9a7748'); if (Math.abs(a - .45) < .1) c = hx('#7f6038'); if (a > .85) c = mix(c, hx('#6f8a3f'), (a - .85) / .15); if (this.season === 'winter' && a > .6) c = mix(c, hx('#eef2f6'), Math.min(1, (a - .6) / .3)); return c; };
        const cols = [-1, -.85, -.55, -.35, 0, .35, .55, .85, 1];
        for (let i = 0; i < n; i++) { const A = P.at(i / n), Bq = P.at((i + 1) / n);
          for (let k = 0; k < cols.length - 1; k++) { const s0 = cols[k], s1 = cols[k + 1];
            const p = (q, s) => [q.p[0] + q.side[0] * s * W, .04, q.p[2] + q.side[2] * s * W];
            const a = p(A, s0), b = p(A, s1), c = p(Bq, s1), d = p(Bq, s0);
            B.tri(a, c, b); B.tri(a, d, c);
            const n1 = (R() - .5) * .08, cc = dirt((s0 + s1) / 2).map(v => v + n1); for (let m = 0; m < 6; m++) col.push(...cc); } }
        B.c = col; });
      world.add(new Node(pathGeo));
      // Bäume, Büsche, Pilze, Steine
      const deco = new Node(), SEA = this.season, W = SEA === 'winter', AU = SEA === 'autumn', SP = SEA === 'spring';
      const SNOW = '#f4f7fb';
      const AUT = ['#d9822b', '#e0b13a', '#b5432a', '#c96f2d', '#8cbf3f', '#e8c547'];
      const leafCol = () => AU ? hx(AUT[Math.floor(R() * AUT.length)]) : SP ? mix(hx('#7cc24a'), hx('#a8d65a'), R()) : mix(hx('#4f9a3c'), hx('#8cbf3f'), R());
      const pine = (x, z, h) => { const y = height(x, z), g = new Node().at(x, y, z), c1 = mix(hx('#2f6b3a'), hx('#3f8a46'), R()), c2 = mix(c1, [0, 0, 0], .15);
        g.add(new Node(G.cyl(.25 * h / 6, .35 * h / 6, h * .3, 6), '#6b4a2b').at(0, h * .15, 0));
        g.add(new Node(G.cyl(0, h * .28, h * .45, 7), c2).at(0, h * .45, 0), new Node(G.cyl(0, h * .22, h * .38, 7), c1).at(0, h * .65, 0), new Node(G.cyl(0, h * .15, h * .3, 7), c1).at(0, h * .85, 0));
        if (W) g.add(new Node(G.cyl(0, h * .19, h * .18, 7), SNOW).at(0, h * .93, 0), new Node(G.cyl(0, h * .25, h * .1, 7), SNOW).at(0, h * .76, 0), new Node(G.cyl(0, h * .3, h * .1, 7), SNOW).at(0, h * .58, 0));
        if (!W && R() < .25) for (let i = 0; i < 5; i++) { const a = R() * 6.3, r = h * (.14 + R() * .1); g.add(new Node(G.sphere(.16, 5, 4), '#7a5532').at(Math.cos(a) * r, h * (.55 + R() * .25), Math.sin(a) * r).scale(.8, 1.3, .8)); } // Tannenzapfen
        g.rot = [0, R() * PI, 0]; return g; };
      const bare = (g, h) => { for (let i = 0; i < 6; i++) { const a = i * 1.05 + R(), r = h * .28, y0 = h * (.42 + R() * .2);
          g.add(rodN([0, y0, 0], [Math.cos(a) * r, y0 + h * .25, Math.sin(a) * r], .07 + R() * .04, '#6b4a2b'));
          if (W) g.add(new Node(G.sphere(.2, 5, 4), SNOW).at(Math.cos(a) * r, y0 + h * .25 + .1, Math.sin(a) * r).scale(1.4, .5, 1.4)); } };
      // Laubbaum; fruit: 'apple' | 'pear' | null
      const leafy = (x, z, h, fruit) => { const y = height(x, z), g = new Node().at(x, y, z), c = leafCol();
        g.add(new Node(G.cyl(.2 * h / 5, .3 * h / 5, h * .5, 6), '#7a5532').at(0, h * .25, 0));
        if (W) { bare(g, h); return g; }
        g.add(new Node(G.sphere(h * .32, 8, 6), c).at(0, h * .62, 0), new Node(G.sphere(h * .22, 7, 5), mix(AU ? leafCol() : c, [1, 1, .6], .1)).at(h * .18, h * .78, h * .08), new Node(G.sphere(h * .2, 7, 5), mix(c, [0, 0, 0], .1)).at(-h * .15, h * .74, -h * .1));
        if (SP) for (let i = 0; i < 14; i++) { const a = R() * 6.3, b = R() * 1.3; g.add(new Node(G.sphere(.13, 5, 4), R() < .5 ? '#ffd1e3' : '#ffffff').at(Math.cos(a) * Math.sin(b) * h * .33, h * .62 + Math.cos(b) * h * .33, Math.sin(a) * Math.sin(b) * h * .33)); }
        if (fruit && !SP) for (let i = 0; i < 16; i++) { const a = R() * 6.3, b = .5 + R() * 1.2, rr = h * .33;
          const f = new Node(G.sphere(fruit === 'pear' ? .17 : .2, 7, 5), fruit === 'pear' ? (R() < .5 ? '#c8d94a' : '#e2c94a') : (R() < .75 ? '#d62828' : '#f2b134')).at(Math.cos(a) * Math.sin(b) * rr, h * .62 + Math.cos(b) * rr, Math.sin(a) * Math.sin(b) * rr);
          if (fruit === 'pear') f.scale(1, 1.35, 1); g.add(f); }
        if (fruit && AU) for (let i = 0; i < 4; i++) g.add(new Node(G.sphere(.19, 6, 4), fruit === 'pear' ? '#c8d94a' : '#c62828').at((R() - .5) * h * .6, .15, (R() - .5) * h * .6)); // Fallobst
        return g; };
      const birch = (x, z, h) => { const y = height(x, z), g = new Node().at(x, y, z);
        g.add(new Node(G.cyl(.12, .16, h * .7, 6), '#efeee6').at(0, h * .35, 0), new Node(G.box(.33, .06, .33), '#333').at(0, h * .3, 0), new Node(G.box(.33, .05, .33), '#333').at(0, h * .5, 0));
        if (W) { bare(g, h * .9); return g; }
        g.add(new Node(G.sphere(h * .25, 7, 5), AU ? hx(R() < .7 ? '#f2c230' : '#e09a2b') : mix(hx('#a7c94a'), hx('#e0c24a'), R() * .6)).at(0, h * .78, 0)); return g; };
      let placed = 0;
      for (let tries = 0; tries < 6000 && placed < 300; tries++) {
        const x = (R() - .5) * 180, z = -100 + R() * 170, d = P.dist(x, z);
        if (d < 7.2) continue;
        if (d > 22 && R() < .45) continue;               // dichter am Pfad
        const h = 5 + R() * 6 * (d < 12 ? .7 : 1), k = R();
        if (reserved(x, z, 1.5)) continue;
        this.addObs(x, z, k < .46 ? .85 : k < .82 ? .75 : .5);
        { const th = k < .46 ? h + 2 : h, cr = k < .46 ? th * .3 : k < .82 ? h * .42 : h * .3, key = Math.floor(x / 6) + ',' + Math.floor(z / 6); let l = this.trees.get(key); if (!l) this.trees.set(key, l = []); l.push([x, z, cr + .6, th + .5]); }
        deco.add(k < .46 ? pine(x, z, h + 2) : k < .66 ? leafy(x, z, h) : k < .76 ? leafy(x, z, h * .8, 'apple') : k < .82 ? leafy(x, z, h * .8, 'pear') : birch(x, z, h)); placed++;
      }
      // Bodenpflanzen, Pilze, Steine, Beeren
      const fern = (x, y, z) => { const g = new Node().at(x, y, z), c = AU ? '#a3732e' : W ? '#8a7a5a' : '#3f8a3a';
        for (let i = 0; i < 7; i++) { const a = i / 7 * PI * 2 + R() * .3; g.add(new Node(G.box(.9, .03, .16), c).at(Math.cos(a) * .42, .28, Math.sin(a) * .42).rotate(0, -a, .55)); } return g; };
      const grass = (x, y, z) => { const g = new Node().at(x, y, z), c = AU ? '#b9a14a' : W ? '#c9c2a2' : '#6aa83f';
        for (let i = 0; i < 6; i++) g.add(new Node(G.cyl(0, .05, .5 + R() * .4, 3), mix(hx(c), [1, 1, .7], R() * .2)).at((R() - .5) * .35, .3, (R() - .5) * .35).rotate((R() - .5) * .5, 0, (R() - .5) * .5)); return g; };
      const flower = (x, y, z) => { const g = new Node().at(x, y, z), fc = ['#ffd23f', '#ff6b9a', '#ffffff', '#b28dff', '#ff8c42', '#4ea8de'];
        for (let i = 0; i < 5; i++) { const px = (R() - .5) * 1.2, pz = (R() - .5) * 1.2, hh = .3 + R() * .25, c = fc[Math.floor(R() * fc.length)];
          g.add(new Node(G.cyl(.015, .015, hh, 4), '#4f8a2e').at(px, hh / 2, pz));
          for (let p = 0; p < 5; p++) { const a = p / 5 * PI * 2; g.add(new Node(G.sphere(.06, 5, 3), c).at(px + Math.cos(a) * .07, hh, pz + Math.sin(a) * .07)); }
          g.add(new Node(G.sphere(.045, 5, 3), '#ffcf3f').at(px, hh + .02, pz)); } return g; };
      const berries = (x, y, z) => { const g = new Node().at(x, y, z), bc = R() < .5 ? '#c1121f' : '#3a3f9a';
        g.add(new Node(G.sphere(.75, 7, 5), W ? '#7d8a6a' : AU ? '#7a6a2a' : '#3d7d35').at(0, .45, 0).scale(1.1, .75, 1));
        if (W) g.add(new Node(G.sphere(.7, 7, 5), SNOW).at(0, .62, 0).scale(1.05, .35, .95));
        for (let i = 0; i < 14; i++) { const a = R() * 6.3, b = .3 + R() * 1.1; g.add(new Node(G.sphere(.075, 5, 3), bc).at(Math.cos(a) * Math.sin(b) * .82, .45 + Math.cos(b) * .56, Math.sin(a) * Math.sin(b) * .76)); } return g; };
      const amanita = (g, x, z, k) => { g.add(new Node(G.cyl(.08 * k, .1 * k, .35 * k, 6), '#f3ead8').at(x, .17 * k, z), new Node(G.dome(.26 * k, 8, 3), '#d62828').at(x, .32 * k, z).scale(1, .7, 1),
          new Node(G.sphere(.04 * k, 5, 3), '#fff').at(x + .12 * k, .47 * k, z + .05 * k), new Node(G.sphere(.04 * k, 5, 3), '#fff').at(x - .06 * k, .5 * k, z - .1 * k), new Node(G.sphere(.035 * k, 5, 3), '#fff').at(x - .1 * k, .44 * k, z + .1 * k)); };
      const boletus = (g, x, z, k) => { g.add(new Node(G.cyl(.1 * k, .15 * k, .3 * k, 7), '#efe3c4').at(x, .15 * k, z), new Node(G.dome(.24 * k, 8, 3), '#7a4a22').at(x, .28 * k, z).scale(1, .75, 1)); };
      const chanterelle = (g, x, z) => { for (let i = 0; i < 5; i++) g.add(new Node(G.cyl(.11, .02, .18, 6), '#f2a93b').at(x + (R() - .5) * .4, .09, z + (R() - .5) * .4)); };
      const mossRock = (x, y, z, r) => { const g = new Node().at(x, y, z); g.add(new Node(G.rock(r, 1 + Math.floor(R() * 9)), mix(hx('#8d9399'), hx('#b4b8bc'), R())).at(0, r * .25, 0));
        g.add(new Node(G.dome(r * .75, 7, 3), W ? SNOW : '#5d8f3a').at(r * .1, r * .55, 0).scale(1, .35, 1)); return g; };
      const stump = (x, y, z) => { const g = new Node().at(x, y, z); g.add(new Node(G.cyl(.55, .7, .7, 9), '#7a5532').at(0, .35, 0), new Node(G.cyl(.5, .5, .02, 9), '#c9a26b').at(0, .71, 0));
        for (let i = 0; i < 3; i++) g.add(new Node(G.dome(.22, 7, 2), '#d9a85a').at(.55, .2 + i * .15, (i - 1) * .25).rotate(0, 0, -1.3).scale(1, .5, 1));
        if (W) g.add(new Node(G.cyl(.5, .5, .1, 9), SNOW).at(0, .76, 0)); return g; };
      for (let i = 0; i < 230; i++) { const t = R(), q = P.at(t), side = R() < .5 ? -1 : 1, off = 5.9 + R() * 9;
        const x = q.p[0] + q.side[0] * side * off, z = q.p[2] + q.side[2] * side * off, y = height(x, z), k = R(), rr = R();
        if (reserved(x, z, 1.2)) continue;
        if (k < .14) { const r = .35 + rr * .5; deco.add(new Node(G.rock(r, 1 + (i % 9)), mix(hx('#8d9399'), hx('#b4b8bc'), R())).at(x, y + .1, z)); this.addObs(x, z, r * 1.1); }
        else if (k < .22) { const r = .9 + rr * .9; deco.add(mossRock(x, y, z, r)); this.addObs(x, z, r * 1.15); }
        else if (k < .32) { deco.add(berries(x, y, z)); this.addObs(x, z, .95); }
        else if (k < .44) { const m = new Node().at(x, y, z), kind = R(); if (kind < .45) amanita(m, 0, 0, 1); else if (kind < .8) { boletus(m, 0, 0, 1); boletus(m, .35, .2, .7); } else chanterelle(m, 0, 0); deco.add(m); this.addObs(x, z, .45); }
        else if (k < .58) deco.add(fern(x, y, z));
        else if (k < .74) deco.add(grass(x, y, z));
        else if (k < .88) { if (!W) deco.add(flower(x, y, z)); else deco.add(grass(x, y, z)); }
        else if (k < .94) { const r = .7 + rr * .6; deco.add(new Node(G.sphere(r, 7, 5), AU ? hx(AUT[i % 4]) : mix(hx('#3d7d35'), hx('#5aa043'), R())).at(x, y + .3, z).scale(1, .7, 1)); this.addObs(x, z, r); }
        else { deco.add(stump(x, y, z)); this.addObs(x, z, .85); }
      }
      // Hexenring aus Pilzen und ein Steinmannli
      { const q = P.at(.36), x = q.p[0] + q.side[0] * 9, z = q.p[2] + q.side[2] * 9, y = height(x, z), m = new Node().at(x, y, z);
        for (let i = 0; i < 11; i++) { const a = i / 11 * PI * 2; amanita(m, Math.cos(a) * 1.6, Math.sin(a) * 1.6, .8 + R() * .3); this.addObs(x + Math.cos(a) * 1.6, z + Math.sin(a) * 1.6, .35); } deco.add(m); }
      { const q = P.at(.62), x = q.p[0] - q.side[0] * 7.5, z = q.p[2] - q.side[2] * 7.5, y = height(x, z), m = new Node().at(x, y, z);
        [.7, .55, .42, .3].forEach((r, i) => m.add(new Node(G.rock(r, 3 + i), '#9aa1a8').at((R() - .5) * .1, .3 + i * .5, 0).scale(1, .7, 1))); deco.add(m); this.addObs(x, z, .85); }
      // Eulen-Baumstumpf
      { const q = P.at(.48), x = q.p[0] + q.side[0] * 6.2, z = q.p[2] + q.side[2] * 6.2, y = height(x, z); deco.add(stump(x, y, z)); this.addObs(x, z, .9); this.owlSpot = [x, y + .72, z, Math.atan2(q.side[2], -q.side[0])]; }
      // Felsmassiv: Felstürme mit flachen Plateaus (Sprungwege für Steinböcke und Gämsen)
      this.rockNodes = []; this.groundNodes = [];
      if (MS) { const FR = rng(31), cols = ['#9aa1a8', '#8a9096', '#b0b5ba', '#a08f7f', '#7f868c'];
        const place = (x, z, r, h) => { const yb = height(x, z) - .4, sides = 6 + Math.floor(FR() * 3), col = cols[Math.floor(FR() * cols.length)], top = yb + h;
          const rock = new Node().at(x, 0, z); rock.rot = [0, FR() * PI, 0];
          rock.add(new Node(G.cyl(r * .82, r, h, sides), col).at(0, yb + h / 2, 0));
          rock.add(new Node(G.cyl(r * .6, r * .86, .5, sides), mix(hx(col), [1, 1, 1], .08)).at(.08, top + .02, -.05).scale(1, 1, 1));   // abgesetzte Kante
          for (let i = 0; i < 3; i++) { const a = FR() * PI * 2; rock.add(new Node(G.rock(r * (.35 + FR() * .25), 3 + i), mix(hx(col), [0, 0, 0], .08)).at(Math.cos(a) * r * .95, yb + FR() * h * .8, Math.sin(a) * r * .95)); }
          if (W) rock.add(new Node(G.cyl(r * .62, r * .62, .14, sides), SNOW).at(.08, top + .3, -.05));
          else { if (FR() < .7) rock.add(new Node(G.dome(r * .45, 7, 2), '#7e9a4a').at(FR() * .4, top + .26, FR() * .4).scale(1, .25, 1));
            if (FR() < .5) for (let i = 0; i < 4; i++) { const a = FR() * PI * 2, rr = FR() * r * .4; rock.add(new Node(G.sphere(.07, 5, 3), '#ffffff', { emis: .2 }).at(Math.cos(a) * rr, top + .3, Math.sin(a) * rr)); }  // Edelweiss
            if (FR() < .25 && h > 3) { const a = FR() * PI * 2; rock.add(new Node(G.cyl(0, .55, 1.6, 6), '#2f5f35').at(Math.cos(a) * r * .5, top + 1.05, Math.sin(a) * r * .5), new Node(G.cyl(.06, .08, .5, 5), '#5a3f2a').at(Math.cos(a) * r * .5, top + .45, Math.sin(a) * r * .5)); } }
          deco.add(rock); this.addObs(x, z, r + .25);
          { const key = Math.floor(x / 6) + ',' + Math.floor(z / 6); let l = this.trees.get(key); if (!l) this.trees.set(key, l = []); l.push([x, z, r + .5, top + .4]); (this.pillars || (this.pillars = [])).push([x, z, r + .4, top]); }   // Kamera stoppt vor Felsen
          this.rockNodes.push({ x, z, y: top + .27, r: r * .55, nb: [] }); };
        // Hauptgipfel und Ringe aus Felstürmen, nach aussen niedriger
        place(MS.x, MS.z, 2.6, 9.5);
        const rings = [[3.8, 5, 6.8, 2.2], [6.6, 7, 4.4, 2], [9.2, 9, 2.2, 1.7]];
        rings.forEach(([rad, n, hh, rr], ri) => { for (let i = 0; i < n; i++) { const a = i / n * PI * 2 + ri * .45 + (FR() - .5) * .3, d = rad + (FR() - .5) * .8;
          place(MS.x + Math.cos(a) * d, MS.z + Math.sin(a) * d, rr * (.85 + FR() * .3), hh * (.8 + FR() * .45)); } });
        // Geröll am Fuss
        for (let i = 0; i < 26; i++) { const a = FR() * PI * 2, d = MS.R - 1 + FR() * 3, x = MS.x + Math.cos(a) * d, z = MS.z + Math.sin(a) * d, rr = .3 + FR() * .6;
          deco.add(new Node(G.rock(rr, 1 + (i % 8)), cols[i % cols.length]).at(x, height(x, z) + .05, z)); this.addObs(x, z, rr); }
        // Nachbarschaften: Sprung möglich, wenn nah genug und Höhenunterschied klein
        const RN = this.rockNodes;
        for (let i = 0; i < RN.length; i++) for (let j = i + 1; j < RN.length; j++) { const A = RN[i], Bn = RN[j], d = Math.hypot(A.x - Bn.x, A.z - Bn.z);
          if (d < 4.6 && Math.abs(A.y - Bn.y) < 3.4) { A.nb.push(j); Bn.nb.push(i); } }
        // Kein Felsturm bleibt unerreichbar: mit den nächsten zwei Nachbarn verbinden
        RN.forEach((A, i) => { if (A.nb.length >= 2) return; RN.map((Bn, j) => [j, Math.hypot(A.x - Bn.x, A.z - Bn.z) + Math.abs(A.y - Bn.y) * .5]).filter(([j]) => j !== i && !A.nb.includes(j))
          .sort((p, q) => p[1] - q[1]).slice(0, 2 - A.nb.length).forEach(([j]) => { A.nb.push(j); RN[j].nb.push(i); }); });
        // Wiesenpunkte rund ums Massiv für die Gämsen (verbunden mit niedrigen Felsen)
        for (let i = 0; i < 10; i++) { const a = i / 10 * PI * 2, d = MS.R + 2.5, x = MS.x + Math.cos(a) * d, z = MS.z + Math.sin(a) * d;
          const gN = { x, z, y: height(x, z), r: 1.2, nb: [], ground: true }; this.groundNodes.push(gN); }
        this.groundNodes.forEach((g, gi) => { g.nb.push(...[(gi + 1) % 10, (gi + 9) % 10].map(k => 'g' + k));
          RN.forEach((n, ni) => { if (n.y - g.y < 3.2 && Math.hypot(n.x - g.x, n.z - g.z) < 5.2) { g.nb.push(ni); (n.gnb = n.gnb || []).push(gi); } }); });
      }
      // Teichufer: Steine, Schilf, Rohrkolben, Seerosen, Steg und Bank
      if (PD) { const PR = rng(17), cx = PD.x, cz = PD.z, r = PD.r; PD.pads = [];
        for (let i = 0; i < 26; i++) { const a = i / 26 * PI * 2 + PR() * .2, rr = r + .3 + PR() * .5; if (PR() < .3) continue; const x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr;
          deco.add(new Node(G.rock(.3 + PR() * .35, 2 + (i % 7)), mix(hx('#8d9399'), hx('#b4b8bc'), PR())).at(x, height(x, z) + .05, z)); }
        for (let c = 0; c < 9; c++) { const a = c / 9 * PI * 2 + 1.1 + PR() * .3, rr = r - .4 + PR() * .5;
          for (let i = 0; i < 9; i++) { const x = cx + Math.cos(a) * rr + (PR() - .5) * 1.1, z = cz + Math.sin(a) * rr + (PR() - .5) * 1.1, hgt = 1 + PR() * .9, y0 = Math.max(height(x, z), PD.y - .3);
            deco.add(new Node(G.cyl(.012, .03, hgt, 4), W ? '#b8a77a' : AU ? '#a99a4a' : '#5d9a3a').at(x, y0 + hgt / 2, z).rotate((PR() - .5) * .25, 0, (PR() - .5) * .25));
            if (i % 3 === 0) deco.add(new Node(G.cyl(.045, .045, .22, 6), '#6b4426').at(x, y0 + hgt + .05, z)); } }
        if (!W) for (let i = 0; i < 11; i++) { const a = PR() * PI * 2, rr = 1 + PR() * (r - 2.6), x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr, pr = .4 + PR() * .25;
          deco.add(new Node(G.cyl(pr, pr, .02, 10), PR() < .5 ? '#3f8a3a' : '#5aa043').at(x, PD.y + .02, z)); PD.pads.push([x, z, pr]);
          if (PR() < .35) { const fc = PR() < .5 ? '#ffb3d1' : '#ffffff'; for (let k = 0; k < 6; k++) { const b = k / 6 * PI * 2; deco.add(new Node(G.cyl(0, .06, .14, 4), fc).at(x + Math.cos(b) * .07, PD.y + .1, z + Math.sin(b) * .07).rotate(Math.sin(b) * .5, 0, -Math.cos(b) * .5)); }
            deco.add(new Node(G.sphere(.04, 5, 3), '#ffd23f').at(x, PD.y + .12, z)); } }
        // Steg zum Pfad hin
        const toPath = P.at(0), nearT = (() => { let bt = 0, bd = 1e9; for (let i = 0; i <= 200; i++) { const q = P.at(i / 200), d = Math.hypot(q.p[0] - cx, q.p[2] - cz); if (d < bd) { bd = d; bt = i / 200; } } return bt; })();
        const qn = P.at(nearT), ang = Math.atan2(qn.p[2] - cz, qn.p[0] - cx), ux = Math.cos(ang), uz = Math.sin(ang), yaw = Math.atan2(-uz, ux);
        for (let i = 0; i < 9; i++) { const d = r + 1.2 - i * .5, x = cx + ux * d, z = cz + uz * d;
          deco.add(new Node(G.box(.45, .07, 1.5), i % 2 ? '#9a7448' : '#8a6a42').at(x, PD.y + .45, z).rotate(0, yaw, 0)); if (W) deco.add(new Node(G.box(.45, .05, 1.5), SNOW).at(x, PD.y + .51, z).rotate(0, yaw, 0)); }
        for (const d of [r + 1.2, r - .8, r - 2.8]) for (const sd of [-1, 1]) { const x = cx + ux * d - uz * sd * .7, z = cz + uz * d + ux * sd * .7; deco.add(new Node(G.cyl(.07, .07, 1.4, 6), '#6b4a2b').at(x, PD.y - .1, z)); }
        PD.jetty = [cx + ux * (r - 2.9), cz + uz * (r - 2.9)];
        { const d = r + 3.2, x = cx + ux * d + uz * 1.6, z = cz + uz * d - ux * 1.6, y = height(x, z), b = new Node().at(x, y, z); b.rot = [0, yaw + PI / 2, 0];
          b.add(new Node(G.box(1.6, .08, .45), '#9a7448').at(0, .45, 0), new Node(G.box(1.6, .4, .06), '#9a7448').at(0, .75, -.2), new Node(G.box(.08, .45, .4), '#5a4030').at(-.7, .22, 0), new Node(G.box(.08, .45, .4), '#5a4030').at(.7, .22, 0));
          deco.add(b); this.addObs(x, z, .9); }
      }
      // Laternen entlang des Pfads (leuchten in der Dämmerung und nachts)
      this.lamps = new Node();
      for (let i = 0; i < 12; i++) { const t = .06 + i * .075, q = P.at(t), sd = i % 2 ? 1 : -1, x = q.p[0] + q.side[0] * sd * 5.2, z = q.p[2] + q.side[2] * sd * 5.2, y = height(x, z);
        deco.add(new Node(G.cyl(.08, .1, 3, 6), '#2b2d31').at(x, y + 1.5, z), new Node(G.box(.42, .08, .42), '#2b2d31').at(x, y + 3.22, z), new Node(G.cyl(0, .3, .25, 4), '#2b2d31').at(x, y + 3.4, z));
        this.addObs(x, z, .3);
        const bulb = new Node(G.box(.32, .38, .32), '#ffd88a', { emis: 1 }).at(x, y + 3, z); bulb.glow = new Node(G.sphere(.9, 8, 6), '#ffcf70', { emis: 1, alpha: .0 }).at(x, y + 3, z);
        this.lamps.add(bulb, bulb.glow); }
      // Baumstämme quer am Rand
      for (let i = 0; i < 6; i++) { const q = P.at(.08 + i * .15), s = i % 2 ? 1 : -1, x = q.p[0] + q.side[0] * s * 7.4, z = q.p[2] + q.side[2] * s * 7.4, ry = R() * PI;
        if (reserved(x, z, 1.6)) continue;
        deco.add(new Node(G.cyl(.32, .32, 2.6, 8), '#7a5532').at(x, height(x, z) + .3, z).rotate(PI / 2, ry, 0));
        for (const f of [-1, 0, 1]) this.addObs(x + Math.sin(ry) * f * 1.1, z + Math.cos(ry) * f * 1.1, .5); }
      // Start- und Zieltor
      const gate = (t, finish) => { const q = this.path.at(t), g = new Node().at(q.p[0], 0, q.p[2]); g.rot = [0, Math.atan2(q.tan[0], q.tan[2]), 0];
        const W = 5.2; g.add(new Node(G.cyl(.25, .3, 5, 8), '#7a5532').at(-W, 2.5, 0), new Node(G.cyl(.25, .3, 5, 8), '#7a5532').at(W, 2.5, 0));
        if (finish) { for (let i = 0; i < 14; i++) for (let j = 0; j < 2; j++) g.add(new Node(G.box(W * 2 / 14, .45, .2), (i + j) % 2 ? '#111111' : '#ffffff').at(-W + (i + .5) * W * 2 / 14, 4.35 + j * .45, 0)); }
        else g.add(new Node(G.box(W * 2 + .4, 1, .22), '#e63946').at(0, 4.55, 0), new Node(G.box(W * 2 + .45, .12, .25), '#ffffff').at(0, 4.0, 0));
        for (const x of [-W, W]) g.add(new Node(G.cyl(.02, .02, 1.4, 4), '#555').at(x, 5.7, 0), new Node(G.box(.02, .55, .8), finish ? '#ffd23f' : '#3a86ff').at(x, 6.1, .4));
        if (finish) { const bc = ['#e63946', '#ffd23f', '#3a86ff', '#06d6a0', '#ff006e', '#8338ec'];
          for (let i = 0; i < 6; i++) for (const s of [-1, 1]) g.add(new Node(G.sphere(.38, 8, 6), bc[(i + (s > 0 ? 3 : 0)) % 6]).at(s * (W + .4 + (i % 2) * .5), 5.3 + i * .38, (i % 3 - 1) * .4).scale(1, 1.15, 1)); }
        for (const sx of [-W, W]) { const th = g.rot[1]; this.addObs(q.p[0] + Math.cos(th) * sx, q.p[2] - Math.sin(th) * sx, .5); }
        return g; };
      deco.add(gate(START_T - .012, false), gate(FINISH_T, true));
      // Siegerpodest hinter dem Ziel
      const pq = this.path.at(.975), pod = new Node().at(pq.p[0] + pq.side[0] * 7, 0, pq.p[2] + pq.side[2] * 7);
      pod.rot = [0, Math.atan2(pq.tan[0], pq.tan[2]), 0];
      pod.add(new Node(G.box(1.6, 1.4, 1.6), '#ffd23f').at(0, .7, 0), new Node(G.box(1.6, 1.0, 1.6), '#c0c7cf').at(-1.6, .5, 0), new Node(G.box(1.6, .7, 1.6), '#cd7f32').at(1.6, .35, 0));
      deco.add(pod); { const th = pod.rot[1]; for (const lx of [-1.6, 0, 1.6]) this.addObs(pod.pos[0] + Math.cos(th) * lx, pod.pos[2] - Math.sin(th) * lx, 1.15); }
      // Zwischenziel-Tore bei 25 / 50 / 75 % (Bronze, Silber, Gold)
      this.signs = [];
      [[.25, '#cd7f32'], [.5, '#c0c7cf'], [.75, '#ffd23f']].forEach(([pc, col]) => {
        const q = this.path.at(tFor(pc)), g = new Node().at(q.p[0], 0, q.p[2]), th = Math.atan2(q.tan[0], q.tan[2]), Wd = 5.2, txt = Math.round(pc * 100) + ' %';
        g.rot = [0, th, 0];
        for (const sx of [-Wd, Wd]) { g.add(new Node(G.cyl(.22, .28, 4.4, 8), '#f4f1ea').at(sx, 2.2, 0), new Node(G.cyl(.3, .3, .25, 8), col).at(sx, 4.45, 0), new Node(G.sphere(.32, 8, 6), col).at(sx, 4.75, 0));
          for (let i = 0; i < 4; i++) g.add(new Node(G.box(.46, .12, .46), i % 2 ? col : '#f4f1ea').at(sx, .6 + i * .9, 0));
          g.add(new Node(G.cyl(.02, .02, 1.2, 4), '#555').at(sx, 5.5, 0), new Node(G.box(.02, .5, .75), col).at(sx, 5.8, .38));
          this.addObs(q.p[0] + Math.cos(th) * sx, q.p[2] - Math.sin(th) * sx, .5); }
        g.add(new Node(G.box(Wd * 2 + .6, 1.15, .24), col).at(0, 3.95, 0), new Node(G.box(Wd * 2 + .62, .1, .26), '#ffffff').at(0, 3.42, 0), new Node(G.box(Wd * 2 + .62, .1, .26), '#ffffff').at(0, 4.48, 0));
        const front = Models.plate(txt, .095, col, 5); front.pos = [0, 3.95, .14]; const back = Models.plate(txt, .095, col, 5); back.pos = [0, 3.95, -.14]; back.rot = [0, PI, 0];
        g.add(front, back);
        for (let i = 0; i < 9; i++) g.add(new Node(G.box(.5, .42, .03), ['#e63946', '#ffd23f', '#3a86ff', '#06d6a0'][i % 4]).at(-Wd + .6 + i * (Wd * 2 - 1.2) / 8, 3.15, 0).rotate(0, 0, PI / 4).scale(.7, .7, 1));
        deco.add(g); this.signs.push({ pos: [q.p[0], 6.6, q.p[2]], text: '🚩 ' + txt, cls: 'cp' });
      });
      if (this.buildFarm) this.buildFarm(deco, height);
      if (this.buildArena) this.buildArena(deco, height);
      this.sceneDyn = []; this.sceneActors = []; if (this.buildScenes) this.buildScenes(deco, height);
      this.static = [merge(world), merge(deco)];
      this.water = new Node();
      if (PD) { if (W) this.water.add(new Node(G.cyl(PD.r + .35, PD.r + .35, .06, 40), '#d9eef6', { emis: .25, alpha: .95 }).at(PD.x, PD.y, PD.z), new Node(G.cyl(PD.r * .6, PD.r * .6, .065, 30), '#c4e2ee', { emis: .3, alpha: .9 }).at(PD.x + 1, PD.y + .005, PD.z - .5));
        else this.water.add(new Node(G.cyl(PD.r + .35, PD.r + .35, .02, 40), '#3f8fb0', { emis: .12, alpha: .72 }).at(PD.x, PD.y, PD.z), new Node(G.cyl(PD.r * .55, PD.r * .55, .022, 30), '#2f7898', { emis: .1, alpha: .35 }).at(PD.x, PD.y + .004, PD.z)); }
      this.dust = new Node();
      // Schwebende Glühwürmchen / Pollen
      this.motes = new Node();
      for (let i = 0; i < 90; i++) { const q = P.at(R()); const m = new Node(G.sphere(.12, 4, 3), '#fff27a', { emis: 1 }).at(q.p[0] + (R() - .5) * 14, 1 + R() * 3, q.p[2] + (R() - .5) * 8); m.base = m.pos.slice(); m.ph = R() * 10; this.motes.add(m); }
    }


    // ---------- Hindernisse (Raster 3 m) ----------
    addObs(x, z, r) { const o = [x, z, r], ext = Math.max(0, r - 1.5);
      for (let i = Math.floor((x - ext) / 3); i <= Math.floor((x + ext) / 3); i++) for (let j = Math.floor((z - ext) / 3); j <= Math.floor((z + ext) / 3); j++) {
        const k = i + ',' + j; let l = this.obs.get(k); if (!l) this.obs.set(k, l = []); l.push(o); } }
    blocked(x, z, r, self) {
      const x0 = Math.floor((x - r - 1.5) / 3), x1 = Math.floor((x + r + 1.5) / 3), z0 = Math.floor((z - r - 1.5) / 3), z1 = Math.floor((z + r + 1.5) / 3);
      for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) { const l = this.obs.get(i + ',' + j); if (!l) continue;
        for (const o of l) { const dx = o[0] - x, dz = o[1] - z, rr = o[2] + r; if (dx * dx + dz * dz < rr * rr) return true; } }
      if (this.dyn) for (const o of this.dyn) { if (o[3] === self) continue; const dx = o[0] - x, dz = o[1] - z, rr = o[2] + r; if (dx * dx + dz * dz < rr * rr) return true; }
      return false;
    }

    // Liegt der Punkt in einer Baumkrone?
    inTree(x, y, z) {
      const kx = Math.floor(x / 6), kz = Math.floor(z / 6);
      for (let i = kx - 1; i <= kx + 1; i++) for (let j = kz - 1; j <= kz + 1; j++) { const l = this.trees.get(i + ',' + j); if (!l) continue;
        for (const t of l) if (y < t[3] && (t[0] - x) ** 2 + (t[1] - z) ** 2 < t[2] * t[2]) return true; }
      return false;
    }
    // Kamera vor Bäumen schützen: vom Ziel zur Kamera abtasten und vor dem ersten Baum anhalten
    sightFree(target, eye) {
      let outside = false;
      for (let i = 1; i <= 20; i++) { const f = i / 20, p = [target[0] + (eye[0] - target[0]) * f, target[1] + (eye[1] - target[1]) * f, target[2] + (eye[2] - target[2]) * f];
        const inside = this.inTree(p[0], p[1], p[2]) || p[1] < this.height(p[0], p[2]) + .3;
        if (!inside) outside = true; else if (outside || f > .3) return false; }
      return true;
    }
    // Kamera nie in Bäumen/Felsen: zuerst höher steigen (Abstand bleibt), erst dann näher heran – aber nie ins Objekt
    clearEye(target, eye) {
      if (this.sightFree(target, eye)) return eye;
      const d = [eye[0] - target[0], eye[1] - target[1], eye[2] - target[2]], L = Math.hypot(...d), hz = Math.hypot(d[0], d[2]) || 1;
      const pitch0 = Math.atan2(d[1], hz);
      for (let k = 1; k <= 8; k++) { const pt = Math.min(1.45, pitch0 + k * .14), h = Math.cos(pt) * L / hz;
        const e = [target[0] + d[0] * h, target[1] + Math.sin(pt) * L, target[2] + d[2] * h];
        if (this.sightFree(target, e)) return e; }
      for (const f of [.75, .55, .4]) { const e = [target[0] + d[0] * f, target[1] + d[1] * f + L * (1 - f) * .6, target[2] + d[2] * f];
        if (this.sightFree(target, e)) return e; }
      return [target[0] + d[0] * .12, target[1] + L * .95, target[2] + d[2] * .12];   // notfalls steil von oben
    }

    // ---------- Teich: Fische, Enten, Frösche, Libellen, Reiher ----------
    spawnPond() {
      const P = this.pond; this.pondLife = []; this.pondFx = new Node(); if (!P) return;
      const R = rng(23), mk = (kind, v) => { const n = Models.pondCreature(kind, v); this.pondLife.push(n); return n; };
      this.fish = ['#ff7b29', '#ff7b29', '#f4f1ea', '#a8b8c4', '#e8b33a', '#ff7b29', '#a8b8c4'].map((c, i) => ({ n: mk('fish', c), a: R() * 6.3, r: 1.2 + R() * (P.r - 2.8), v: (.5 + R() * .4) * (i % 2 ? 1 : -1), d: -.35 - R() * .4 }));
      this.fishJump = null; this.jumpIn = 3 + R() * 4;
      const fem = mk('duck', 'female'), male = mk('duck', 'male');
      this.ducks = [{ n: fem, a: 0, r: P.r - 2.4, v: .55, hist: [] }, { n: male, a: 3, r: P.r - 3.4, v: -.45, hist: [] }];
      this.ducklings = [0, 1, 2, 3].map(i => ({ n: mk('duckling'), i }));
      this.frogs = (P.pads || []).slice(0, 3).map((pd, i) => ({ n: mk('frog'), pad: i, hop: null, wait: 3 + R() * 6, yaw: R() * 6.3 }));
      this.flies = ['#3a86ff', '#06d6a0', '#e63946', '#8338ec'].map(c => ({ n: mk('dragonfly', c), b: [P.x, P.y + .9, P.z], g: [P.x, P.y + .9, P.z], wait: 0, ph: R() * 10 }));
      { const a = R() * 6.3, x = P.x + Math.cos(a) * (P.r - .7), z = P.z + Math.sin(a) * (P.r - .7), h = mk('heron'); h.scl = [1.25, 1.25, 1.25];
        h.pos = [x, P.y - .25, z]; h.rot = [0, Math.atan2(-(P.z - z), P.x - x) + .8, 0]; this.heron = h; }
      this.fishScale = 1.25;
    }
    splash(x, z, big) { const P = this.pond;
      const ring = new Node(G.torus(.5, .04, 20, 4), '#e8f6ff', { alpha: .7, emis: .6 }).at(x, P.y + .03, z).rotate(PI / 2, 0, 0); ring.life = 1.4; ring.kind = 'ring'; this.pondFx.add(ring);
      for (let i = 0; i < (big ? 12 : 4); i++) { const a = Math.random() * 6.3, sp = .6 + Math.random() * 1.4;
        const d = new Node(G.sphere(.05, 4, 3), '#e8f6ff', { alpha: .85, emis: .6 }).at(x, P.y + .05, z); d.v = [Math.cos(a) * sp, 2 + Math.random() * 2.5, Math.sin(a) * sp]; d.life = 1; d.kind = 'drop'; this.pondFx.add(d); } }
    updatePond(t, dt) {
      const P = this.pond; if (!P) return; const winter = this.season === 'winter', T = P.y;
      for (const n of this.pondLife) n.visible = !winter || n === this.heron ? true : false;
      if (this.heron) this.heron.visible = !winter;
      if (winter) return;
      // Fische
      for (const f of this.fish) { if (this.fishJump && this.fishJump.f === f) continue;
        f.a += f.v * dt / f.r; const x = P.x + Math.cos(f.a) * f.r, z = P.z + Math.sin(f.a) * f.r;
        f.n.pos = [x, T + f.d + Math.sin(t * 1.3 + f.a) * .05, z]; f.n.rot = [0, Math.atan2(-Math.cos(f.a) * Math.sign(f.v), -Math.sin(f.a) * Math.sign(f.v)), 0]; f.n.scl = [this.fishScale, this.fishScale, this.fishScale];
        f.n.anim.tail.rot = [0, Math.sin(t * 9 + f.a * 3) * .4, 0]; }
      this.jumpIn -= dt;
      if (!this.fishJump && this.jumpIn < 0) { const f = this.fish[Math.floor(Math.random() * this.fish.length)], p = f.n.pos.slice(), yaw = f.n.rot[1];
        const fx = Math.cos(yaw), fz = -Math.sin(yaw); this.fishJump = { f, t: 0, dur: 1.15, p, fx, fz, len: 2.2 + Math.random(), h: 1.4 + Math.random() * .8 }; this.splash(p[0], p[2], true); }
      if (this.fishJump) { const J = this.fishJump; J.t += dt; const u = Math.min(1, J.t / J.dur);
        const x = J.p[0] + J.fx * J.len * u, z = J.p[2] + J.fz * J.len * u, y = T - .35 + (4 * u * (1 - u)) * J.h;
        J.f.n.pos = [x, y, z]; J.f.n.rot = [0, J.f.n.rot[1], Math.atan(4 * (1 - 2 * u) * J.h / J.len) * .9]; J.f.n.anim.tail.rot = [0, Math.sin(t * 22) * .6, 0];
        if (u >= 1) { this.splash(x, z, true); const dx = x - P.x, dz = z - P.z; J.f.a = Math.atan2(dz, dx); J.f.r = Math.min(P.r - 1.6, Math.max(.8, Math.hypot(dx, dz))); J.f.n.rot[2] = 0;
          this.fishJump = null; this.jumpIn = 5 + Math.random() * 8; } }
      // Enten mit Küken
      for (const d of this.ducks) { d.a += d.v * dt / d.r; const x = P.x + Math.cos(d.a) * d.r, z = P.z + Math.sin(d.a) * d.r * .85;
        const dab = Math.sin(t * .23 + d.a) > .93;   // gründeln: Kopf unter Wasser, Schwanz hoch
        d.n.pos = [x, T - .06 + Math.sin(t * 2 + d.a) * .02, z]; d.n.rot = [0, Math.atan2(-Math.cos(d.a) * Math.sign(d.v) * .85, -Math.sin(d.a) * Math.sign(d.v)), dab ? -1.05 : Math.sin(t * 1.7) * .04];
        d.n.scl = [1.25, 1.25, 1.25]; d.hist.unshift([x, z, d.n.rot[1]]); if (d.hist.length > 400) d.hist.pop(); }
      const mom = this.ducks[0];
      for (const k of this.ducklings) { const h = mom.hist[Math.min(mom.hist.length - 1, 28 + k.i * 22)] || mom.hist[mom.hist.length - 1]; if (!h) continue;
        k.n.pos = [h[0], T - .02 + Math.sin(t * 3 + k.i) * .015, h[1]]; k.n.rot = [0, h[2], 0]; k.n.scl = [1.25, 1.25, 1.25]; }
      // Frösche hüpfen von Seerose zu Seerose
      const pads = P.pads || [];
      for (const fr of this.frogs) { const pd = pads[fr.pad]; if (!pd) continue; fr.n.scl = [1.4, 1.4, 1.4];
        if (fr.hop) { fr.hop.t += dt; const u = Math.min(1, fr.hop.t / .65), a = pads[fr.hop.from], b = pads[fr.hop.to];
          fr.n.pos = [a[0] + (b[0] - a[0]) * u, T + .03 + 4 * u * (1 - u) * .9, a[1] + (b[1] - a[1]) * u]; fr.n.rot = [0, fr.yaw, -(1 - 2 * u) * .5];
          if (u >= 1) { fr.pad = fr.hop.to; fr.hop = null; fr.wait = 4 + Math.random() * 8; this.splash(b[0], b[1], false); } continue; }
        fr.wait -= dt; fr.n.pos = [pd[0], T + .03, pd[1]]; fr.n.rot = [0, fr.yaw, 0]; fr.n.scl[1] = 1.4 * (1 + Math.max(0, Math.sin(t * 6 + fr.pad)) * .06);
        if (fr.wait < 0 && pads.length > 1) { let to = fr.pad; while (to === fr.pad || this.frogs.some(o => o !== fr && o.pad === to)) to = Math.floor(Math.random() * pads.length);
          fr.yaw = Math.atan2(-(pads[to][1] - pd[1]), pads[to][0] - pd[0]); fr.hop = { from: fr.pad, to, t: 0 }; } }
      // Libellen schwirren und schiessen plötzlich weiter
      for (const fl of this.flies) { fl.wait -= dt;
        if (fl.wait < 0) { const a = Math.random() * 6.3, r = Math.random() * (P.r + .5); fl.g = [P.x + Math.cos(a) * r, T + .5 + Math.random() * 1.2, P.z + Math.sin(a) * r]; fl.wait = 1.5 + Math.random() * 3; }
        const k = Math.min(1, dt * 3.5), prev = fl.b.slice(); fl.b = fl.b.map((v, i) => v + (fl.g[i] - v) * k);
        fl.n.pos = [fl.b[0] + Math.sin(t * 3 + fl.ph) * .12, fl.b[1] + Math.sin(t * 5 + fl.ph) * .06, fl.b[2] + Math.cos(t * 2.6 + fl.ph) * .12];
        const vx = fl.b[0] - prev[0], vz = fl.b[2] - prev[2]; if (Math.hypot(vx, vz) > .002) fl.n.rot = [0, Math.atan2(-vz, vx), 0]; fl.n.scl = [1.5, 1.5, 1.5];
        for (const w of fl.n.anim.wings) w.rot = [w.side * Math.sin(t * 60 + fl.ph) * .5, 0, 0]; }
      if (this.heron) this.heron.rot[2] = Math.sin(t * .4) * .03;
      // Spritzer und Wellenringe
      for (const e of [...this.pondFx.children]) { e.life -= dt;
        if (e.kind === 'ring') { const g = 1 + (1.4 - e.life) * 2.2; e.scl = [g, g, g]; e.alpha = Math.max(0, e.life * .5); }
        else { e.v[1] -= 9.8 * dt; e.pos = e.pos.map((v, i) => v + e.v[i] * dt); e.alpha = Math.max(0, e.life); if (e.pos[1] < T) e.life = 0; }
        if (e.life <= 0) this.pondFx.children.splice(this.pondFx.children.indexOf(e), 1); }
      for (const d of this.ducks) { d.wake = (d.wake || 0) - dt; if (d.wake < 0) { d.wake = .45;
          const yaw = d.n.rot[1], bx = d.n.pos[0] - Math.cos(yaw) * .45, bz = d.n.pos[2] + Math.sin(yaw) * .45;
          const w = new Node(G.torus(.28, .02, 14, 3, PI * .9), '#e8f6ff', { alpha: .45, emis: .5 }).at(bx, T + .03, bz).rotate(PI / 2, yaw + PI * .55, 0); w.life = 1.2; w.kind = 'ring'; this.pondFx.add(w); } }
      if (Math.random() < dt * .25 && this.ducks[0]) { const d = this.ducks[Math.floor(Math.random() * 2)]; const ring = new Node(G.torus(.5, .03, 18, 4), '#e8f6ff', { alpha: .4, emis: .5 }).at(d.n.pos[0], T + .03, d.n.pos[2]).rotate(PI / 2, 0, 0); ring.life = 1.4; ring.kind = 'ring'; this.pondFx.add(ring); }
    }

    // ---------- Felsbewohner: Steinbock-Kolonie (nur auf Felsen) und Gämsen ----------
    spawnRocks() {
      this.rockLife = []; const RN = this.rockNodes || []; if (!RN.length) return;
      const R = rng(41), take = new Set(), free = () => { for (let k = 0; k < 50; k++) { const i = Math.floor(R() * RN.length); if (!take.has(i)) { take.add(i); return i; } } return 0; };
      const mk = (kind, ground) => { const n = Models.animal(kind), sc = kind === 'kid' ? 1.6 : 1.55; n.scl = [sc, sc, sc];
        const at = ground ? null : free(), a = { kind, n, at: ground ? 'g' + Math.floor(R() * 10) : at, ox: 0, oz: 0, yaw: R() * 6.3, mode: 'idle', wait: 1 + R() * 5, t0: R() * 10, climber: kind === 'chamois' };
        this.rockLife.push(a); return a; };
      mk('ibex'); mk('ibex'); for (let i = 0; i < 4; i++) mk('ibexF'); for (let i = 0; i < 3; i++) mk('kid');
      mk('chamois', true); mk('chamois', true); mk('chamois');
      this.rockLife.forEach(a => { const p = this.nodePos(a.at); a.pos = [p.x, p.y, p.z]; });
    }
    nodeOf(id) { return typeof id === 'string' ? this.groundNodes[+id.slice(1)] : this.rockNodes[id]; }
    nodePos(id, ox, oz) { const n = this.nodeOf(id); return { x: n.x + (ox || 0), y: n.ground ? this.height(n.x + (ox || 0), n.z + (oz || 0)) : n.y, z: n.z + (oz || 0) }; }
    neighbours(a) { const n = this.nodeOf(a.at); let l = n.nb.slice();
      if (!n.ground && a.climber && n.gnb) l = l.concat(n.gnb.map(g => 'g' + g));
      if (!a.climber) l = l.filter(x => typeof x === 'number');                 // Steinböcke bleiben auf den Felsen
      return l.filter(x => this.rockLife.filter(o => o !== a && (o.at === x || o.to === x)).length < (typeof x === 'string' ? 2 : 2)); }
    updateRocks(t, dt) {
      for (const a of this.rockLife) {
        let speed = 0;
        if (a.mode === 'jump') { a.jt += dt; const u = Math.min(1, a.jt / a.dur), p0 = a.p0, p1 = a.p1;
          a.pos = [p0[0] + (p1[0] - p0[0]) * u, p0[1] + (p1[1] - p0[1]) * u + 4 * u * (1 - u) * a.hgt, p0[2] + (p1[2] - p0[2]) * u];
          if (u >= 1) { a.at = a.to; a.to = null; a.mode = 'idle'; a.wait = 1.5 + Math.random() * 5; a.ox = p1[0] - this.nodeOf(a.at).x; a.oz = p1[2] - this.nodeOf(a.at).z; } }
        else if (a.mode === 'walk') { const n = this.nodeOf(a.at), tx = n.x + a.tx, tz = n.z + a.tz, dx = tx - a.pos[0], dz = tz - a.pos[2], d = Math.hypot(dx, dz);
          if (d < .05) { a.mode = 'idle'; a.wait = 1 + Math.random() * 4; a.ox = a.tx; a.oz = a.tz; }
          else { const st = Math.min(d, dt * .7); a.pos[0] += dx / d * st; a.pos[2] += dz / d * st; a.pos[1] = n.ground ? this.height(a.pos[0], a.pos[2]) : n.y; speed = .3;
            a.yaw = Math.atan2(-dz, dx); } }
        else { a.wait -= dt;
          if (a.wait < 0) {
            const nbs = this.neighbours(a);
            if (nbs.length && Math.random() < .6) {           // Sprung auf einen Nachbarfelsen
              const to = nbs[Math.floor(Math.random() * nbs.length)], tn = this.nodeOf(to), ang = Math.random() * PI * 2, rr = Math.random() * tn.r * .7;
              const p1 = this.nodePos(to, Math.cos(ang) * rr, Math.sin(ang) * rr), d = Math.hypot(p1.x - a.pos[0], p1.z - a.pos[2]);
              a.to = to; a.mode = 'jump'; a.jt = 0; a.dur = .45 + d * .1; a.p0 = a.pos.slice(); a.p1 = [p1.x, p1.y, p1.z]; a.hgt = 1 + Math.max(0, p1.y - a.pos[1]) * .5 + d * .08;
              a.yaw = Math.atan2(-(p1.z - a.pos[2]), p1.x - a.pos[0]);
            } else { const n = this.nodeOf(a.at), ang = Math.random() * PI * 2, rr = Math.random() * n.r * .8; a.tx = Math.cos(ang) * rr; a.tz = Math.sin(ang) * rr; a.mode = 'walk'; } } }
        a.n.pos = a.pos.slice(); a.n.rot = [0, a.yaw, a.mode === 'jump' ? (a.p1[1] > a.p0[1] ? .35 : -.3) * (1 - 2 * Math.min(1, a.jt / a.dur)) : 0];
        Models.animateAnimal(a.n, t + a.t0, speed, a.mode === 'idle' && a.wait > 2 && a.kind !== 'ibex');
        if (a.mode === 'jump') for (const l of a.n.anim.legs) l.rot[2] = l.pos[0] > 0 ? .7 : -.7;   // Beine im Sprung gestreckt
      }
    }

    // ---------- Zuschauer & Wanderer ----------
    spawnPeople() {
      const R = rng(5), PAL = Models.PALETTE, sea = this.season;
      const TEXTS = ['HOPP!', 'GO GO', 'SUPER', 'TOP!', 'BRAVO', 'ALLEZ', 'WOW!', '+1', 'JA!', '♥ ♥', 'HOPP', 'GO!'];
      const SIGNC = ['#e63946', '#3a86ff', '#06d6a0', '#ffd23f', '#ff006e', '#8338ec'];
      const pick = a => a[Math.floor(R() * a.length)];
      const look = () => ({ suit: pick(PAL), suit2: pick(PAL), pattern: pick(['solid', 'solid', 'rings', 'racing', 'checker']), skin: pick(Models.SKINS),
        hair: pick(Models.HAIRS).key, hairColor: pick(Models.HAIR_COLORS), hat: sea === 'winter' && R() < .5 ? 'santa' : pick(['none', 'none', 'none', 'cap', 'party', 'tophat', 'crown']),
        glasses: pick(['none', 'none', 'sun']), pants: pick(['#2d3a55', '#3b3b3b', '#5a4a3a', '#1f4e79', '#6b2d2d']), initials: '' });
      this.crowd = [];
      this.crowdSpots.forEach(g => g.members.forEach((m, i) => {
        const kind = m.kind || (R() < .5 ? 'sign' : R() < .5 ? 'cheer' : R() < .6 ? 'wave' : 'stand');
        const n = Models.person(look(), kind, m.text || pick(TEXTS), pick(SIGNC)), sc = R() < .2 ? .85 : 1.22 + R() * .12;
        n.scl = [sc, sc, sc]; n.pos = [m.x, this.height(m.x, m.z) + (m.lift || 0), m.z]; n.rot = [0, m.yaw, 0]; n.cull = 2.5;
        this.crowd.push({ node: n, x: m.x, z: m.z, yaw: m.yaw, cheer: 0, excite: 0, group: g, s: m.s || 0, burst: 0 });
      }));
      // Bauersleute auf dem Hof
      if (this.farm) { const F = this.farm;
        for (const [u, v, kind, name, psi] of [[-1.6, 6.3, 'fork', 'Bauer', .2], [-3.6, 7.4, 'wave', 'Bäuerin', -.3]]) {
          const L = { ...look(), suit: kind === 'fork' ? '#1f4e79' : '#c0392b', suit2: '#ffffff', pattern: kind === 'fork' ? 'solid' : 'checker', hat: kind === 'fork' ? 'cap' : 'none', glasses: 'none', pants: kind === 'fork' ? '#1f3a5a' : '#3b3b3b' };
          const n = Models.person(L, kind), p = F.w(u, v), yaw = F.yaw + PI / 2 + psi; n.scl = [1.28, 1.28, 1.28]; n.pos = [p[0], this.height(p[0], p[1]), p[1]]; n.rot = [0, yaw, 0]; n.cull = 2.5;
          this.crowd.push({ node: n, x: p[0], z: p[1], yaw, cheer: 0, excite: 0, group: { farm: true }, name }); } }
      this.hikers = [];
      for (let i = 0; i < 4; i++) { const L = { ...look(), hat: pick(['cap', 'none', 'cap']), pack: pick(['#3f6b45', '#8a3b1f', '#1f4e79', '#c9a227']) };
        const n = Models.person(L, 'hiker'); n.scl = [1.25, 1.25, 1.25];
        this.hikers.push({ node: n, t: .1 + i * .22, dir: i % 2 ? 1 : -1, side: i % 2 ? 1 : -1, speed: .9 + R() * .4, pause: 0, nextPause: 8 + R() * 20, ph: R() * 10 }); }
    }
    movePeople(t, dt) {
      const T = this.path.total, racers = [...this.racers.values()];
      const nearest = (x, z, max) => { let best = null, bd = max * max; for (const r of racers) { const dx = r.node.pos[0] - x, dz = r.node.pos[2] - z, d = dx * dx + dz * dz; if (d < bd) { bd = d; best = r; } } return best ? [best, Math.sqrt(bd)] : null; };
      const lookYaw = (x, z, yaw, r) => { if (!r) return 0; let d = Math.atan2(-(r.node.pos[2] - z), r.node.pos[0] - x) - yaw; while (d > PI) d -= 2 * PI; while (d < -PI) d += 2 * PI; return Math.max(-1.3, Math.min(1.3, d)); };
      if (this.arenaTick) this.arenaTick(dt);
      for (const c of this.crowd) {
        const n = nearest(c.x, c.z, 32); c.excite = Math.max(0, c.excite - dt);
        let want = Math.max(n && n[1] < 10 ? 1 : 0, c.excite > 0 ? 1 : 0);
        if (c.group.arena) want = Math.max(this.arenaWant(c, dt), n && n[1] < 7 ? 1 : 0);
        c.cheer += (want - c.cheer) * Math.min(1, dt * 3);
        Models.animatePerson(c.node, t, false, c.cheer, n ? lookYaw(c.x, c.z, c.yaw, n[0]) : 0);
      }
      this.dyn = racers.map(r => [r.node.pos[0], r.node.pos[2], 1.5, null]);
      for (const h of this.hikers) {
        if (h.pause > 0) { h.pause -= dt; } else { h.t += h.dir * h.speed * dt / T; h.nextPause -= dt;
          if (h.t > .985) { h.t = .985; h.dir = -1; } if (h.t < .01) { h.t = .01; h.dir = 1; }
          if (h.nextPause < 0) { h.pause = 4 + Math.random() * 5; h.nextPause = 15 + Math.random() * 25; } }
        const q = this.path.at(h.t), x = q.p[0] + q.side[0] * h.side * 4.65, z = q.p[2] + q.side[2] * h.side * 4.65;
        const yaw = h.pause > 0 ? Math.atan2(h.side * q.side[2], -h.side * q.side[0]) : Math.atan2(-q.tan[2] * h.dir, q.tan[0] * h.dir);
        let dy = yaw - h.node.rot[1]; while (dy > PI) dy -= 2 * PI; while (dy < -PI) dy += 2 * PI;
        h.node.pos = [x, this.height(x, z), z]; h.node.rot = [0, h.node.rot[1] + dy * Math.min(1, dt * 4), 0];
        const n = nearest(x, z, 20);
        Models.animatePerson(h.node, t + h.ph, h.pause <= 0, 0, n ? lookYaw(x, z, h.node.rot[1], n[0]) : 0);
        this.dyn.push([x, z, .6, null]);
      }
    }
    cheerNear(id) { const r = this.racers.get(id); if (!r || !this.crowd) return;
      for (const c of this.crowd) if (Math.hypot(c.x - r.node.pos[0], c.z - r.node.pos[2]) < 45) c.excite = 2.5 + Math.random(); }

    // ---------- Zeit, Sonne, Himmel ----------
    now() { return new Date(Date.now() + this.timeOffset); }
    toggleTimelapse() { this.timeScale = this.timeScale > 1 ? 1 : 1440; if (this.timeScale === 1) this.timeOffset = 0; this.updateSky(true); return this.timeScale > 1; }
    updateSky(force) {
      const now = this.now(), sp = sunPos(now), e = sp.el, env = this.r.env;
      const dayF = smooth(-5, 7, e), gold = smooth(-6, 1, e) * (1 - smooth(4, 16, e));
      const sd = [Math.sin(sp.az) * Math.cos(e * PI / 180), Math.sin(e * PI / 180), -Math.cos(sp.az) * Math.cos(e * PI / 180)];
      const moon = [-sd[0] * .5, .8, -sd[2] * .5]; const ml = Math.hypot(...moon);
      const dir = sd[1] > .05 ? sd : mix(moon.map(v => v / ml), sd.map(v => Math.max(v, .05)), smooth(-4, 3, e)); const dl = Math.hypot(...dir);
      env.sun = dir.map(v => v / dl);
      env.sunCol = mix([.3, .36, .55], mix([.82, .78, .7], [1, .6, .36], gold), dayF);
      env.amb = .4 + .24 * dayF;
      env.sky = mix([.32, .38, .62], mix([.78, .88, 1], [1, .8, .7], gold * .7), dayF);
      env.ground = mix([.14, .16, .24], [.3, .35, .24], dayF);
      env.fog = mix([.1, .13, .24], mix([.8, .89, .9], [.98, .74, .58], gold), dayF);
      const wc = this.weather ? this.weather.code : null, cloud = wc == null ? 0 : wc >= 45 ? .55 : wc === 3 ? .45 : wc === 2 ? .2 : 0;
      const cover = this.weather ? (this.weather.cloud != null ? this.weather.cloud / 100 : wc >= 45 ? .95 : wc === 3 ? .9 : wc === 2 ? .55 : wc === 1 ? .25 : .05) : .3;
      if (this.clouds) for (const c of this.clouds) { c.visible = c.order < cover; c.color = mix([.55, .58, .64], [1, 1, 1], wc != null && wc >= 51 ? .2 : 1).map(v => v * (.25 + .75 * dayF)); c.emis = .15 + .25 * dayF; }
      if (cloud) { env.sunCol = env.sunCol.map(v => v * (1 - cloud * .7)); env.amb += cloud * .08; env.sky = mix(env.sky, [.62, .65, .7], cloud); env.fog = mix(env.fog, [.68, .7, .73].map(v => v * (.3 + .7 * dayF)), cloud); }
      env.fogN = wc === 45 || wc === 48 ? 12 : 55; env.fogF = wc === 45 || wc === 48 ? 70 : 170;
      let top = mix([.03, .06, .16], mix([.35, .62, .9], [.3, .38, .66], gold), dayF); const bot = env.fog; if (cloud) top = mix(top, [.55, .58, .64].map(v => v * (.3 + .7 * dayF)), cloud);
      const world = this.canvas.parentElement;
      if (world) { world.style.background = `linear-gradient(180deg, ${css(top)} 0%, ${css(mix(top, bot, .55))} 42%, ${css(bot)} 70%, ${css(bot)} 100%)`; world.classList.toggle('night', dayF < .25); world.style.setProperty('--moon', dayF < .3 ? '1' : '0'); }
      const lampOn = 1 - smooth(-2, 6, e);
      if (this.lamps) for (let i = 0; i < this.lamps.children.length; i += 2) { const b = this.lamps.children[i], g = this.lamps.children[i + 1];
        b.color = mix([.55, .5, .42], [1, .9, .55], lampOn); b.emis = .2 + .8 * lampOn; g.alpha = .38 * lampOn; g.scl = [1 + lampOn * .9, 1 + lampOn * .9, 1 + lampOn * .9]; }
      if (this.motes) this.motes.visible = dayF < .6 || this.season === 'summer';
      // Uhr
      if (!this.sunT || this.sunT.key !== fmtParts(now).year + '-' + +fmtParts(now).month + '-' + +fmtParts(now).day) this.sunT = sunTimes(now);
      const el = this.opts.clockEl; if (!el) return;
      const p = fmtParts(now), hm = d => d ? new Intl.DateTimeFormat('de-CH', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(d) : '–';
      const len = this.sunT.rise && this.sunT.set ? (this.sunT.set - this.sunT.rise) / 6e4 : 0;
      const phase = e > 6 ? '☀️' : e > -6 ? '🌅' : '🌙';
      const live = this.weather, temp = live ? live.temp : tempModel(now), tTxt = (Math.round(temp * 10) / 10).toFixed(Math.abs(temp) < 10 ? 1 : 0).replace('.', ',');
      const wtxt = live ? [WX(live.code), live.wind != null ? '💨 ' + Math.round(live.wind) + ' km/h' : '', live.rain ? '☔ ' + String(live.rain).replace('.', ',') + ' mm/h' : ''].filter(Boolean).join(' · ') : '';
      const html = `<b>${p.hour}:${p.minute} <em>🌡️ ${tTxt} °C</em></b><span>Bern · ${p.weekday} ${p.day}.${p.month}. · ${SEASON_DE[this.season]}</span>${wtxt ? `<span>${wtxt}</span>` : ''}
        <span>${phase} ${hm(this.sunT.rise)} – ${hm(this.sunT.set)} · ${Math.floor(len / 60)} h ${Math.round(len % 60)} min Tag</span>${live ? `<span class="est">Quelle: ${live.source}${live.station ? ', ' + live.station : ''}${live.time ? ' · ' + new Intl.DateTimeFormat('de-CH', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(live.time)) : ''}</span>` : '<span class="est">Temperatur: Schätzung nach Klimawerten</span>'}${this.timeScale > 1 ? '<i>⏩ Zeitraffer</i>' : ''}`;
      if (force || el.dataset.h !== html) { el.dataset.h = html; el.innerHTML = html; }
    }
    buildClouds() { const R = rng(77); this.clouds = [];
      for (let i = 0; i < 16; i++) { const c = new Node(), n = 4 + Math.floor(R() * 4);
        for (let k = 0; k < n; k++) c.add(new Node(G.sphere(2.2 + R() * 2.2, 8, 6), '#ffffff', { emis: .35 }).at((k - n / 2) * 2.6 + R(), R() * 1.4, (R() - .5) * 3).scale(1, .62, 1));
        const m = merge(c); m.base = [(R() - .5) * 170, 30 + R() * 8, -60 + R() * 120]; m.order = R(); this.clouds.push(m); } }
    setWeather(w) { this.weather = w && w.live ? w : null; const mode = this.fallMode(); if (mode !== this.fallKind) this.buildWeather(); this.updateSky(true); }
    fallMode() { const w = this.weather, pr = w ? precipOf(w.code) : null;
      if (pr === 'rain') return 'rain'; if (pr === 'snow') return 'winter';
      if (w && this.season === 'winter') return 'none'; return this.season === 'summer' ? 'none' : this.season; }
    // ---------- Fallende Blätter / Schnee / Blüten / Regen ----------
    buildWeather() {
      const R = Math.random, sea = this.fallMode(); this.fall = new Node(); this.fallKind = sea;
      const n = sea === 'winter' ? 140 : sea === 'autumn' ? 70 : sea === 'spring' ? 40 : sea === 'rain' ? 220 : 0;
      for (let i = 0; i < n; i++) {
        let f;
        if (sea === 'rain') f = new Node(G.box(.02, .5, .02), '#cfe3f5', { emis: .4, alpha: .55 });
        else if (sea === 'winter') f = new Node(G.sphere(.07, 4, 3), '#ffffff', { emis: .5 });
        else if (sea === 'autumn') f = new Node(G.box(.26, .02, .18), ['#d9822b', '#e0b13a', '#b5432a', '#c96f2d'][i % 4]);
        else f = new Node(G.box(.12, .015, .12), i % 2 ? '#ffd1e3' : '#ffffff');
        f.base = [(R() - .5) * 60, R() * 14, (R() - .5) * 80]; f.ph = R() * 10; f.v = sea === 'rain' ? 13 + R() * 4 : sea === 'winter' ? .9 + R() * .6 : .7 + R() * .5;
        this.fall.add(f);
      }
    }
    // ---------- Vögel ----------
    spawnFlyers() {
      const R = rng(11); this.flyers = [];
      for (let i = 0; i < 10; i++) { const b = Models.bird('bird'); b.scl = [1.6, 1.6, 1.6]; this.flyers.push({ node: b, kind: 'flock', a: i * .18, r: 18 + (i % 3) * 1.5, h: 13 + (i % 4) * .9, off: [(R() - .5) * 3, (R() - .5) * 3], sp: .32, ph: R() * 6 }); }
      for (let i = 0; i < 2; i++) { const b = Models.bird('hawk'); b.scl = [1.7, 1.7, 1.7]; this.flyers.push({ node: b, kind: 'hawk', a: i * PI, r: 14 + i * 8, h: 24 + i * 4, off: [i ? 10 : -8, i ? -18 : 12], sp: .14 + i * .03, ph: i * 2 }); }
    }
    moveFlyers(t) {
      for (const f of this.flyers) {
        const a = f.a + t * f.sp, cx = f.kind === 'flock' ? Math.sin(t * .05) * 20 : f.off[0], cz = f.kind === 'flock' ? Math.cos(t * .04) * 25 : f.off[1];
        const x = cx + Math.cos(a) * f.r + (f.kind === 'flock' ? f.off[0] : 0), z = cz + Math.sin(a) * f.r * .8 + (f.kind === 'flock' ? f.off[1] : 0);
        f.node.pos = [x, f.h + Math.sin(t * .7 + f.ph) * .8, z];
        const tx = -Math.sin(a), tz = Math.cos(a) * .8;
        f.node.rot = [f.kind === 'hawk' ? .25 : .1, Math.atan2(-tz, tx), 0];
        Models.animateBird(f.node, t, f.ph);
      }
    }

    // ---------- Waldtiere: Bären, Rehe, Hirsche, ein Wolfsrudel, Dachse ----------
    spawnAnimals() {
      const R = rng(7), P = this.path; this.animals = [];
      const spot = (minD = 9, maxD = 34) => { for (let i = 0; i < 400; i++) { const x = (R() - .5) * 110, z = -78 + R() * 125, d = P.dist(x, z); if (d > minD && d < maxD && !this.blocked(x, z, 1.2) && !(this.farm && this.inFarm(x, z, 2))) return [x, z]; } return [30, 0]; };
      const SPEED = { bear: 1.0, deer: 1.5, stag: 1.3, wolf: 2.1, badger: .8, fox: 1.9, hare: 2.6, squirrel: 1.8, boar: 1.1, piglet: 1.3, hedgehog: .35, owl: 0 }, SCALE = { bear: 1.9, deer: 1.7, stag: 1.7, wolf: 1.7, badger: 1.8, fox: 1.8, hare: 1.9, squirrel: 2.2, boar: 1.6, piglet: 1.6, hedgehog: 2, owl: 2.2 };
      const RAD = { bear: 1.0, deer: .6, stag: .7, wolf: .5, badger: .45, fox: .45, hare: .3, squirrel: .2, boar: .7, piglet: .3, hedgehog: .3, owl: .3 };
      const add = (kind, pos, leader, off) => { const n = Models.animal(kind); n.scl = [SCALE[kind], SCALE[kind], SCALE[kind]]; n.cull = 3;
        const a = { kind, node: n, rad: RAD[kind] || .5, x: pos[0], z: pos[1], yaw: R() * 6.28, tx: pos[0], tz: pos[1], wait: R() * 4, speed: SPEED[kind], leader, off, graze: false, t0: R() * 10 };
        this.animals.push(a); return a; };
      for (let i = 0; i < 2; i++) add('bear', spot(9, 20));
      for (const kind of ['deer', 'stag']) { const n = kind === 'deer' ? 4 : 2, c = spot(8, 18), L = add(kind, c);
        for (let i = 1; i < n; i++) add(kind, [c[0] + (R() - .5) * 4, c[1] + (R() - .5) * 4], L, [(R() - .5) * 5, (R() - .5) * 5]); }
      const wc = spot(9, 20), W = add('wolf', wc);
      for (let i = 1; i < 4; i++) add('wolf', [wc[0] - i * 1.5, wc[1] + (R() - .5) * 3], W, [-1.6 * i, (i % 2 ? 1 : -1) * 1.3 * i]);
      for (let i = 0; i < 3; i++) add('badger', spot(7, 16));
      for (let i = 0; i < 2; i++) add('fox', spot(8, 20));
      for (let i = 0; i < 2; i++) { const c = spot(7, 16), L = add('hare', c); add('hare', [c[0] + 1, c[1] + 1], L, [-1.2, .9]); }
      for (let i = 0; i < 4; i++) add('squirrel', spot(7, 14));
      { const c = spot(9, 20), L = add('boar', c); for (let i = 0; i < 4; i++) add('piglet', [c[0] - 1 - i * .6, c[1] + (R() - .5) * 2], L, [-1.4 - i * .7, (i % 2 ? 1 : -1) * (.5 + i * .25)]); }
      add('boar', spot(10, 22));
      for (let i = 0; i < 2; i++) add('hedgehog', spot(6, 12));
      if (this.owlSpot) { const o = add('owl', [this.owlSpot[0], this.owlSpot[2]]); o.fixed = true; o.y = this.owlSpot[1]; o.yaw = this.owlSpot[3]; }
      // Ziel mit freier Sichtlinie bevorzugen (vermeidet Sackgassen zwischen Bäumen)
      this.pickTarget = a => { let fallback = null;
        for (let i = 0; i < 60; i++) { const x = a.x + (R() - .5) * 26, z = a.z + (R() - .5) * 26, pd = P.dist(x, z);
          if (!(Math.abs(x) < 62 && z > -82 && z < 50 && pd > (R() < .12 ? 0 : 7) && pd < 24 && !this.blocked(x, z, a.rad + .4) && !this.inPond(x, z, a.rad + 1) && !(this.farm && this.inFarm(x, z, a.rad + 1.5)))) continue;
          if (this.lineFree(a.x, a.z, x, z, a.rad)) { a.tx = x; a.tz = z; return; } if (!fallback) fallback = [x, z]; }
        if (fallback) { a.tx = fallback[0]; a.tz = fallback[1]; } else { a.tx = a.x; a.tz = a.z; } };
    }
    lineFree(x0, z0, x1, z1, r) { const d = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(d / .8);
      for (let i = 1; i <= n; i++) { const f = i / n; if (this.blocked(x0 + (x1 - x0) * f, z0 + (z1 - z0) * f, r)) return false; } return true; }
    inPond(x, z, m) { const p = this.pond; return !!p && Math.hypot(x - p.x, z - p.z) < p.r + (m || 0); }
    moveAnimals(t, dt) {
      for (const a of this.animals) {
        let speed = 0;
        if (a.fixed) { a.node.pos = [a.x, a.y, a.z]; a.node.rot = [0, a.yaw, 0]; Models.animateAnimal(a.node, t + a.t0, 0, false); continue; }
        if (a.solo > 0) a.solo -= dt;
        const follower = a.leader && !(a.solo > 0);
        if (follower) { // Gruppe folgt dem Leittier mit Abstand; liegt der Platz in einem Hindernis, rückt es näher heran
          const L = a.leader, c = Math.cos(L.yaw), s = Math.sin(L.yaw);
          let ox = a.off[0] * c + a.off[1] * s, oz = -a.off[0] * s + a.off[1] * c;
          for (let k = 0; k < 4 && this.blocked(L.x + ox, L.z + oz, a.rad); k++) { ox *= .6; oz *= .6; }
          a.tx = L.x + ox; a.tz = L.z + oz; a.graze = L.graze && a.kind !== 'wolf';
        } else if (a.wait > 0) a.wait -= dt;
        const dx = a.tx - a.x, dz = a.tz - a.z, d = Math.hypot(dx, dz);
        if (d > .3 && (follower || a.wait <= 0)) {
          const v = a.speed * (follower ? Math.min(1.6, .4 + d / 3) : 1);
          const step = Math.min(d, v * dt), dir = this.steer(a, dx / d, dz / d, step);
          // Fortschritt prüfen: kommt das Tier dem Ziel 3 s lang nicht näher, plant es neu
          if (a.best === undefined || d < a.best - .4) { a.best = d; a.noProg = 0; } else a.noProg = (a.noProg || 0) + dt;
          if (!dir || a.noProg > 3) {
            a.noProg = 0; a.best = undefined;
            if (a.leader) { a.solo = 5 + Math.random() * 4; this.pickTarget(a); }   // Herdentier geht kurz eigene Wege
            else { a.wait = .3 + Math.random() * .7; this.pickTarget(a); }
          }
          if (dir) { speed = Math.min(1, v / 3.5 + .15); a.graze = false;
            const want = Math.atan2(-dir[1], dir[0]); let dy = want - a.yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI; a.yaw += dy * Math.min(1, dt * 4); }
        } else if (!follower && a.wait <= 0) {
          a.wait = 2 + Math.random() * 6; a.graze = (a.kind === 'deer' || a.kind === 'stag') && Math.random() < .7; a.best = undefined;
          if (!(a.solo > 0) || !a.leader) this.pickTarget(a);
        } else a.best = undefined;
        a.node.pos = [a.x, this.height(a.x, a.z), a.z]; a.node.rot = [0, a.yaw, 0];
        Models.animateAnimal(a.node, t + a.t0, speed, a.graze);
      }
      // Tiere halten Abstand zueinander
      const A = this.animals;
      for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) { const p = A[i], q = A[j]; if (p.fixed || q.fixed) continue;
        const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz), m = (p.rad + q.rad) * .9;
        if (d > 1e-4 && d < m) { const push = (m - d) / 2, ux = dx / d * push, uz = dz / d * push;
          if (!this.blocked(p.x - ux, p.z - uz, p.rad, p)) { p.x -= ux; p.z -= uz; } if (!this.blocked(q.x + ux, q.z + uz, q.rad, q)) { q.x += ux; q.z += uz; } } }
    }
    // Richtung suchen, die frei ist (geradeaus, sonst schrittweise seitlich ausweichen)
    steer(a, ux, uz, step) {
      const startBlocked = this.blocked(a.x, a.z, a.rad * .7, a);
      const sg = a.turn || 1;
      for (const ang of [0, .4 * sg, -.4 * sg, .8 * sg, -.8 * sg, 1.25 * sg, -1.25 * sg, 1.8 * sg, -1.8 * sg, 2.5 * sg, -2.5 * sg]) {
        const c = Math.cos(ang), s = Math.sin(ang), nx = ux * c - uz * s, nz = ux * s + uz * c, px = a.x + nx * step, pz = a.z + nz * step;
        if (startBlocked || (!this.blocked(px, pz, a.rad, a) && !this.blocked(a.x + nx * (a.rad + .6), a.z + nz * (a.rad + .6), a.rad * .6, a))) {
          if (ang) a.turn = Math.sign(ang); else if (Math.random() < .01) a.turn = -sg;
          a.x = px; a.z = pz; a.trapped = 0; return [nx, nz]; }
      }
      // Eingeklemmt: mit kleinerem Abstand einen Ausgang suchen, sonst kurz durchs Dickicht schlüpfen
      for (let i = 0; i < 16; i++) { const ang = i / 16 * PI * 2, nx = Math.cos(ang), nz = Math.sin(ang), px = a.x + nx * step, pz = a.z + nz * step;
        if (!this.blocked(px, pz, a.rad * .45, a)) { a.x = px; a.z = pz; return [nx, nz]; } }
      a.trapped = (a.trapped || 0) + step;
      if (a.trapped > .4) { a.x += ux * step * .6; a.z += uz * step * .6; return [ux, uz]; }
      return null;
    }

    // ---------- Fahrer ----------
    setRacers(list, meId) {
      const seen = new Set();
      list.forEach((x, i) => {
        seen.add(x.id);
        let r = this.racers.get(x.id);
        const sig = JSON.stringify(x.look);
        if (!r || r.sig !== sig) {
          const node = Models.build(x.look); node.scl = [1.3, 1.3, 1.3]; node.cull = 3.5;
          if (!r) {
            r = { id: x.id, cur: tFor(0), boost: 0, label: document.createElement('button') };
            r.label.className = 'lbl'; r.label.onclick = () => this.opts.onSelect && this.opts.onSelect(x.id);
            this.layer.appendChild(r.label);
          }
          r.node = node; r.sig = sig;
          this.racers.set(x.id, r);
        }
        const lanes = [0, -2, 2, -3.4, 3.4, -1, 1, -2.7, 2.7, -.5, .5, -1.5, 1.5, -3, 3, 0, -2.2, 2.2, -.9, .9];
        r.lane = lanes[i % lanes.length]; r.stagger = ((i * 37) % 7) * .0009;
        r.target = tFor(x.pct); r.data = x; r.me = x.id === meId;
        r.label.classList.toggle('me', r.me); r.label.classList.toggle('done', x.pct >= 1);
        r.label.innerHTML = `<b style="background:${x.look.suit || '#3a86ff'};color:${ink(x.look.suit || '#3a86ff')}">${esc(x.look.initials || initials(x.name))}</b><span>${Math.round(x.pct * 100)}%</span>`;
      });
      for (const [id, r] of this.racers) if (!seen.has(id)) { r.label.remove(); this.racers.delete(id); }
      this.meId = meId;
    }
    boost(id) { const r = this.racers.get(id); if (!r) return; r.boost = 1.6; this.cheerNear(id);
      const R = Math.random;
      for (let i = 0; i < 10; i++) { const q = r.node.pos; const d = new Node(G.sphere(.25, 6, 4), '#c9b38a', { alpha: .7 }).at(q[0] + (R() - .5), .3 + R() * .4, q[2] + (R() - .5)); d.life = 1 + R() * .6; d.vy = .6 + R(); this.dust.add(d); }
      if (r.pop) r.pop.el.remove(); const pop = document.createElement('div'); pop.className = 'pop'; pop.textContent = '+1'; pop.style.opacity = '0'; this.layer.appendChild(pop); r.pop = { el: pop, t: 0 };
    }

    // ---------- Kamera ----------
    overviewWant() { const a = this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight);
      if (a > 2.3) return { yaw: Math.PI / 2, pitch: .95, dist: Math.max(40, 120 / a + 8), target: [0, 0, 0] };
      return { yaw: 0, pitch: a < .8 ? 1.02 : .9, dist: a < .8 ? 48 + 24 / Math.max(a, .4) : 68, target: [0, 0, a < .8 ? 3 : 0] }; }
    overview() { this.mode = 'overview'; this.tour = null; this.trackObj = null; this.want = this.overviewWant(); this.uo = { yaw: 0, pitch: 0, dist: 1 }; this.caption(''); }
    follow(id) { this.mode = 'follow'; this.tour = null; this.trackObj = null; this.followId = id; this.uo = { yaw: 0, pitch: 0, dist: 1 }; this.caption(''); }
    startTour() { this.mode = 'tour'; this.trackObj = null; this.uo = { yaw: 0, pitch: 0, dist: 1 }; this.tour = { i: -1, t: 99 }; }
    caption(txt) { if (this.shotEl.textContent !== txt) { this.shotEl.textContent = txt; this.shotEl.classList.toggle('show', !!txt); } }
    camEye(c) { return [c.target[0] + Math.sin(c.yaw) * Math.cos(c.pitch) * c.dist, c.target[1] + Math.sin(c.pitch) * c.dist, c.target[2] + Math.cos(c.yaw) * Math.cos(c.pitch) * c.dist]; }
    // ---------- Freie Kamera ----------
    toFree() { if (this.mode === 'free') return; const c = this.cam; this.mode = 'free'; this.tour = null; this.trackObj = null; this.caption('');
      this.want = { yaw: c.yaw, pitch: c.pitch, dist: c.dist, target: c.target.slice() }; this.opts.onCam && this.opts.onCam('free'); }
    drag(dx, dy) {
      this.lastInput = performance.now();
      if (this.mode === 'follow' || this.mode === 'tour' || this.mode === 'track') { this.uo.yaw -= dx * .006; this.uo.pitch = Math.max(-.32, Math.min(1.1, this.uo.pitch + dy * .005)); return; }
      this.toFree(); this.want.yaw -= dx * .006; this.want.pitch = Math.max(.03, Math.min(1.5, this.want.pitch + dy * .005));
    }
    // Verschieben (Rechtsklick, Shift+Ziehen, zwei Finger): Bildebene folgt der Maus
    pan(dx, dy) {
      this.lastInput = performance.now(); this.toFree();
      const w = this.want, k = w.dist * .0016, sy = Math.sin(w.yaw), cy = Math.cos(w.yaw);
      w.target[0] += (-dx * cy - dy * sy) * k; w.target[2] += (dx * sy - dy * cy) * k;
      this.clampTarget(w.target);
    }
    // Fliegen per Tastatur: vor/zurück/seitlich relativ zur Blickrichtung
    fly(fwd, side, dt) { this.toFree(); const w = this.want, sp = Math.max(6, w.dist * .9) * dt, sy = Math.sin(w.yaw), cy = Math.cos(w.yaw);
      w.target[0] += (-sy * fwd + cy * side) * sp; w.target[2] += (-cy * fwd - sy * side) * sp; this.clampTarget(w.target); }
    clampTarget(t) { t[0] = Math.max(-95, Math.min(95, t[0])); t[2] = Math.max(-115, Math.min(85, t[2])); let y = Math.max(.5, this.height(t[0], t[2]) + .8);
      for (const p of this.pillars || []) if ((p[0] - t[0]) ** 2 + (p[1] - t[2]) ** 2 < p[2] * p[2]) y = Math.max(y, p[3] + .8);   // auf Felsen: Ziel oben drauf
      t[1] = y; }
    zoom(f) {
      this.lastInput = performance.now();
      if (this.mode === 'follow' || this.mode === 'tour' || this.mode === 'track') { this.uo.dist = Math.max(.25, Math.min(4, this.uo.dist * f)); return; }
      this.toFree(); this.want.dist = Math.max(2.5, Math.min(170, this.want.dist * f));
    }
    bindControls() {
      const c = this.canvas, pts = new Map(); let lastDist = 0, lastMid = null, moved = 0, tapStart = 0, lastTap = 0, button = 0;
      c.style.touchAction = 'none'; c.tabIndex = 0;
      c.addEventListener('contextmenu', e => e.preventDefault());
      c.addEventListener('pointerdown', e => { c.setPointerCapture(e.pointerId); c.focus({ preventScroll: true }); pts.set(e.pointerId, [e.clientX, e.clientY]); moved = 0; tapStart = performance.now(); button = e.button;
        if (pts.size === 2) { const [a, b] = [...pts.values()]; lastDist = Math.hypot(a[0] - b[0], a[1] - b[1]); lastMid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; } });
      c.addEventListener('pointermove', e => { if (!pts.has(e.pointerId)) return; const p = pts.get(e.pointerId), dx = e.clientX - p[0], dy = e.clientY - p[1];
        pts.set(e.pointerId, [e.clientX, e.clientY]); moved += Math.abs(dx) + Math.abs(dy);
        if (pts.size === 1) { if (button === 2 || e.shiftKey) this.pan(dx, dy); else this.drag(dx, dy); }
        else if (pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
          if (d > 0) this.zoom(lastDist / d); if (lastMid) this.pan(mid[0] - lastMid[0], mid[1] - lastMid[1]); lastDist = d; lastMid = mid; } });
      const up = e => { pts.delete(e.pointerId); if (pts.size < 2) lastMid = null;
        if (moved < 8 && performance.now() - tapStart < 400 && button !== 2) { const now = performance.now();
          if (now - lastTap < 350) { this.overview(); this.opts.onCam && this.opts.onCam('all'); lastTap = 0; } else { lastTap = now; this.tap(e); } } };
      c.addEventListener('pointerup', up); c.addEventListener('pointercancel', e => pts.delete(e.pointerId));
      c.addEventListener('wheel', e => { e.preventDefault(); this.zoom(1 + Math.max(-.5, Math.min(.5, e.deltaY * .0012))); }, { passive: false });
      // Tastatur: W/A/S/D oder Pfeile = fliegen, Q/E = drehen, R/F = neigen, +/- = zoomen
      this.keys = new Set();
      addEventListener('keydown', e => { if (!this.running || /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) return;
        const k = e.key.toLowerCase(); if (['w', 'a', 's', 'd', 'q', 'e', 'r', 'f', '+', '-', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { this.keys.add(k); e.preventDefault(); } });
      addEventListener('keyup', e => this.keys.delete(e.key.toLowerCase()));
      addEventListener('blur', () => this.keys.clear());
    }
    keyMove(dt) { const K = this.keys; if (!K || !K.size) return; this.lastInput = performance.now();
      const fwd = (K.has('w') || K.has('arrowup') ? 1 : 0) - (K.has('s') || K.has('arrowdown') ? 1 : 0), side = (K.has('d') || K.has('arrowright') ? 1 : 0) - (K.has('a') || K.has('arrowleft') ? 1 : 0);
      if (fwd || side) this.fly(fwd, side, dt);
      if (K.has('q') || K.has('e')) { this.toFree(); this.want.yaw += (K.has('q') ? 1 : -1) * dt * 1.4; }
      if (K.has('r') || K.has('f')) { this.toFree(); this.want.pitch = Math.max(.03, Math.min(1.5, this.want.pitch + (K.has('r') ? 1 : -1) * dt * .9)); }
      if (K.has('+') || K.has('-')) this.zoom(K.has('-') ? 1 + dt * 1.5 : 1 - dt * 1.5); }
    // Beliebiges Lebewesen anklicken und mit der Kamera verfolgen
    track(node, name) { this.mode = 'track'; this.tour = null; this.trackObj = node; this.uo = { yaw: 0, pitch: 0, dist: 1 }; this.caption('🎯 ' + name + ' · Doppelklick = Übersicht'); this.opts.onCam && this.opts.onCam('track'); }
    pickables() { const NAMES = { bear: 'Bär', deer: 'Reh', stag: 'Hirsch', wolf: 'Wolf', badger: 'Dachs', fox: 'Fuchs', hare: 'Feldhase', squirrel: 'Eichhörnchen', boar: 'Wildschwein', piglet: 'Frischling', hedgehog: 'Igel', owl: 'Eule',
        ibex: 'Steinbock', ibexF: 'Steingeiss', kid: 'Steinkitz', chamois: 'Gämse', fish: 'Fisch', duck: 'Stockente', duckling: 'Entenküken', frog: 'Frosch', dragonfly: 'Libelle', heron: 'Graureiher' };
      const out = [];
      for (const a of this.animals) out.push([a.node, NAMES[a.kind] || 'Tier', 1]);
      for (const a of this.rockLife || []) out.push([a.n, NAMES[a.kind], 1.2]);
      for (const n of this.pondLife || []) if (n.visible !== false) out.push([n, NAMES[n.anim.kind] || 'Teichbewohner', .3]);
      for (const c of this.crowd || []) out.push([c.node, c.name || (c.group.arena ? 'Fan im Zielgelände' : 'Fan am Wegrand'), 1.6]);
      for (const f of this.farmLife || []) out.push([f.node, Forest.FARM_NAMES[f.kind] || 'Hoftier', .8]);
      for (const h of this.hikers || []) out.push([h.node, 'Wanderer', 1.6]);
      for (const a of this.sceneActors || []) out.push([a.node, a.name, 1.6]);
      for (const f of this.flyers || []) out.push([f.node, f.kind === 'hawk' ? 'Bussard' : 'Vogel', 0]);
      return out; }
    tap(e) { const rect = this.canvas.getBoundingClientRect(), x = e.clientX - rect.left, y = e.clientY - rect.top; let best = null, bd = 50;
      for (const r of this.racers.values()) { const s = this.r.project([r.node.pos[0], r.node.pos[1] + 1.2, r.node.pos[2]]); if (!s) continue; const d = Math.hypot(s[0] - x, s[1] - y); if (d < bd) { bd = d; best = r; } }
      if (best && this.opts.onSelect) { this.opts.onSelect(best.id); return; }
      let pick = null; bd = 42;
      for (const [n, name, hy] of this.pickables()) { const s = this.r.project([n.pos[0], n.pos[1] + hy, n.pos[2]]); if (!s) continue; const d = Math.hypot(s[0] - x, s[1] - y); if (d < bd) { bd = d; pick = [n, name]; } }
      if (pick) this.track(pick[0], pick[1]); }
    // Zielposition der Kamera hinter einem Fahrer (entlang des Pfads, Blick nach vorn)
    chase(r, base) {
      const T = this.path.total, tt = r.cur + r.stagger, back = this.path.at(tt - 9 / T), ahead = this.path.at(tt + 7 / T);
      let tx = ahead.p[0] - back.p[0], tz = ahead.p[2] - back.p[2]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      const yaw0 = Math.atan2(-tx, -tz), dist = (base || 11) * this.uo.dist, pitch = .34 + this.uo.pitch;
      // seitlicher Versatz zur Pfadmitte hin, damit keine Bäume im Bild stehen (mit Hysterese)
      const tgt = [r.node.pos[0] + tx * 2.5, 1.6, r.node.pos[2] + tz * 2.5];
      const eyeAt = sd => { const y = yaw0 + sd * .42; return [tgt[0] + Math.sin(y) * Math.cos(pitch) * dist, tgt[2] + Math.cos(y) * Math.cos(pitch) * dist]; };
      const dA = this.path.dist(...eyeAt(this.side)), dB = this.path.dist(...eyeAt(-this.side)); if (dB + 1.5 < dA) this.side = -this.side;
      return { yaw: yaw0 + this.side * .42 + this.uo.yaw, pitch, dist, target: tgt };
    }
    tourShot(t, rdt) {
      const T = this.tour, racers = [...this.racers.values()];
      T.t += rdt;
      if (T.t > 8) { T.t = 0; this.uo = { yaw: 0, pitch: 0, dist: 1 };
        const kinds = ['overview', 'leader', 'pond', 'mill', 'farm', 'crowd', 'games', 'rocks', 'animal', 'finish', 'random', 'hiker']; T.i = (T.i + 1) % kinds.length;
        T.kind = kinds[T.i];
        if (T.kind === 'random' && racers.length) T.racer = racers[Math.floor(Math.random() * racers.length)];
        if (T.kind === 'animal') { const pool = this.animals.filter(a => !a.fixed || Math.random() < .3); T.animal = pool[Math.floor(Math.random() * pool.length)]; }
        if (T.kind === 'crowd') T.group = this.crowdSpots[Math.floor(Math.random() * this.crowdSpots.length)];
        T.ibex = null;
        if (T.kind === 'hiker') T.hiker = this.hikers[Math.floor(Math.random() * this.hikers.length)];
        T.yaw0 = Math.random() * PI * 2;
      }
      const sway = T.t * .07, NAMES = { bear: 'Bär', deer: 'Reh', stag: 'Hirsch', wolf: 'Wolf', badger: 'Dachs', fox: 'Fuchs', hare: 'Feldhase', squirrel: 'Eichhörnchen', boar: 'Wildschwein', piglet: 'Frischling', hedgehog: 'Igel', owl: 'Eule', ibex: 'Steinbock', ibexF: 'Steingeiss', kid: 'Steinkitz', chamois: 'Gämse' };
      switch (T.kind) {
        case 'leader': { const r = racers.sort((a, b) => b.target - a.target)[0]; if (r) { this.caption('🎬 Spitzenreiter·in: ' + (r.data ? r.data.name : '')); return this.chase(r); } break; }
        case 'random': if (T.racer) { this.caption('🎬 Unterwegs mit ' + (T.racer.data ? T.racer.data.name : '')); return this.chase(T.racer, 9); } break;
        case 'crowd': if (T.group) { const q = this.path.at(T.group.t), y = Math.atan2(-T.group.sd * q.side[0], -T.group.sd * q.side[2]);
          this.caption('🎬 Die Fans am Wegrand'); return { yaw: y + Math.sin(T.t * .3) * .5 + this.uo.yaw, pitch: .22 + this.uo.pitch, dist: 10 * this.uo.dist, target: [T.group.x, 2, T.group.z] }; } break;
        case 'animal': if (T.animal) { const p = T.animal.node.pos; this.caption('🎬 Waldbewohner: ' + (NAMES[T.animal.kind] || ''));
          return { yaw: T.yaw0 + sway + this.uo.yaw, pitch: .3 + this.uo.pitch, dist: (T.animal.kind === 'bear' || T.animal.kind === 'stag' ? 8.5 : 6) * this.uo.dist, target: [p[0], p[1] + 1.1, p[2]] }; } break;
        case 'finish': { const q = this.path.at(FINISH_T); this.caption('🎬 Das Zieltor');
          return { yaw: Math.atan2(-q.tan[0], -q.tan[2]) + .7 + sway + this.uo.yaw, pitch: .2 + this.uo.pitch, dist: 17 * this.uo.dist, target: [q.p[0], 3, q.p[2]] }; }
        case 'rocks': if (this.massif && this.rockLife.length) { const M = this.massif, a = this.rockLife.find(r => r.kind === 'ibex') || this.rockLife[0];
          if (!T.ibex) T.ibex = this.rockLife.filter(r => r.kind !== 'chamois')[Math.floor(Math.random() * 9)] || a;
          const ib = T.ibex, ox = ib.pos[0] - M.x, oz = ib.pos[2] - M.z, out = Math.atan2(ox, oz);
          this.caption('🎬 Die Steinbock-Kolonie'); const tg = [ib.pos[0], ib.pos[1] + 1, ib.pos[2]];
          return { yaw: out + Math.sin(T.t * .25) * .5 + this.uo.yaw, pitch: .32 + this.uo.pitch, dist: 11 * this.uo.dist, target: tg }; } break;
        case 'pond': if (this.pond) { const P = this.pond; this.caption(this.season === 'winter' ? '🎬 Der zugefrorene Teich' : '🎬 Am Waldteich');
          return { yaw: T.yaw0 + sway * 1.3 + this.uo.yaw, pitch: .42 + this.uo.pitch, dist: 15 * this.uo.dist, target: [P.x, P.y + .6, P.z] }; } break;
        case 'farm': if (this.farm) { const F = this.farm, c = F.w(-1, 1.5); this.caption('🎬 Auf dem Bauernhof');
          return { yaw: F.yaw + Math.sin(T.t * .2) * .6 + this.uo.yaw, pitch: .42 + this.uo.pitch, dist: 24 * this.uo.dist, target: [c[0], F.level + 1.5, c[1]] }; } break;
        case 'mill': if (this.millWheel) { const w = this.millWheel.pos; this.caption('🎬 An der alten Mühle');
          return { yaw: (this.millWheel.rot[1] || 0) + PI / 2 + Math.sin(T.t * .25) * .5 + this.uo.yaw, pitch: .3 + this.uo.pitch, dist: 13 * this.uo.dist, target: [w[0], w[1] + .5, w[2]] }; } break;
        case 'games': if (this.games) { const g = this.games, p = g.w(0, -1), y = this.height(p[0], p[1]); this.caption('🎬 Spielwiese: Dart und Pingpong');
          return { yaw: Math.atan2(g.V[0], g.V[1]) + Math.sin(T.t * .2) * .6 + this.uo.yaw, pitch: .38 + this.uo.pitch, dist: 15 * this.uo.dist, target: [p[0], y + 1.2, p[1]] }; } break;
        case 'hiker': if (T.hiker) { const p = T.hiker.node.pos; this.caption('🎬 Wanderer auf dem Waldweg');
          return { yaw: T.yaw0 + sway + this.uo.yaw, pitch: .25 + this.uo.pitch, dist: 7 * this.uo.dist, target: [p[0], 1.8, p[2]] }; } break;
      }
      this.caption('🎬 Der ganze Wald'); const o = this.overviewWant(); o.yaw += Math.sin(T.t * .15) * .6; o.pitch -= .12; o.dist *= .9; return o;
    }

    // ---------- Schleife ----------
    start() { if (this.running) return; this.running = true; this.last = performance.now(); const loop = now => { if (!this.running) return; this.frame(now); requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
    stop() { this.running = false; }
    frame(now) {
      const rdt = Math.min(.5, (now - this.last) / 1000), dt = Math.min(.05, rdt); this.last = now; const t = (now - this.t0) / 1000;
      // Fahrer bewegen
      for (const r of this.racers.values()) {
        const diff = r.target - r.cur; r.cur += diff * (1 - Math.exp(-rdt * 1.6));
        if (Math.abs(diff) < .00005) r.cur = r.target;
        if (r.prevCur !== undefined && r.prevCur < FINISH_T && r.cur >= FINISH_T - 1e-4 && this.finishParty) this.finishParty(r); r.prevCur = r.cur;
        r.boost = Math.max(0, r.boost - dt);
        const q = this.path.at(r.cur + r.stagger), lane = r.lane;
        r.node.pos = [q.p[0] + q.side[0] * lane, 0, q.p[2] + q.side[2] * lane];
        r.node.rot = [0, Math.atan2(-q.tan[2], q.tan[0]), 0];
        const speed = Math.min(1, Math.abs(diff) * 60 + (r.boost > 0 ? .8 : 0));
        Models.animate(r.node, t, speed);
      }
      // Staub
      for (const d of [...this.dust.children]) { d.life -= dt; d.pos[1] += d.vy * dt; d.scl = [1 + (1.6 - d.life), 1 + (1.6 - d.life), 1 + (1.6 - d.life)]; d.alpha = Math.max(0, d.life * .45);
        if (d.life <= 0) this.dust.children.splice(this.dust.children.indexOf(d), 1); }
      this.movePeople(t, dt);
      this.updatePond(t, dt);
      this.updateRocks(t, dt);
      this.moveAnimals(t, dt);
      if (this.updateFarm) this.updateFarm(t, dt);
      if (this.updateScenes) this.updateScenes(t, dt);
      if (this.timeScale > 1) this.timeOffset += rdt * 1000 * (this.timeScale - 1);
      this.skyT = (this.skyT || 0) + rdt; if (this.skyT > (this.timeScale > 1 ? .05 : 1)) { this.skyT = 0; this.updateSky(); }
      this.moveFlyers(t);
      if (this.clouds) { const wind = this.weather && this.weather.wind ? this.weather.wind : 8;
        for (const c of this.clouds) { const x = ((c.base[0] + t * wind * .08 + 100) % 200 + 200) % 200 - 100; c.pos = [x, c.base[1], c.base[2]]; } }
      if (this.fall) { const c = this.cam.target, w = this.fallKind === 'winter' || this.fallKind === 'rain';
        for (const f of this.fall.children) { const fy = ((f.base[1] - t * f.v) % 14 + 14) % 14;
          f.pos = [c[0] + f.base[0] + Math.sin(t * .8 + f.ph) * (w ? .4 : 1.2), fy + .1, c[2] + f.base[2] + Math.cos(t * .6 + f.ph) * (w ? .3 : .9)];
          if (!w) f.rot = [t * 1.7 + f.ph, t * .9 + f.ph, t * 1.3]; } }
      for (const m of this.motes.children) { m.pos = [m.base[0] + Math.sin(t * .5 + m.ph) * .8, m.base[1] + Math.sin(t * .9 + m.ph) * .4, m.base[2] + Math.cos(t * .4 + m.ph) * .8]; }
      // Kamera
      this.keyMove(rdt);
      if (this.mode === 'overview') { this.want = this.overviewWant(); this.want.yaw += Math.sin(t * .05) * .07; }
      if (this.mode === 'follow') { const r = this.racers.get(this.followId); if (r) this.want = this.chase(r); }
      if (this.mode === 'tour') this.want = this.tourShot(t, rdt);
      if (this.mode === 'track' && this.trackObj) { const p = this.trackObj.pos, small = p[1] < 1 && !this.trackObj.anim?.legs?.length ? .5 : 1;
        this.want = { yaw: (this.trackYaw = (this.trackYaw ?? this.cam.yaw)) + this.uo.yaw, pitch: .3 + this.uo.pitch, dist: Math.max(2.6, 7 * small * this.uo.dist), target: [p[0], p[1] + .9, p[2]] }; }
      else this.trackYaw = null;
      const w = this.want, c = this.cam, k = 1 - Math.exp(-rdt * (this.mode === 'tour' ? 1.5 : 2.6));
      if (w) { let dy = w.yaw - c.yaw; while (dy > PI) dy -= 2 * PI; while (dy < -PI) dy += 2 * PI;
        c.yaw += dy * k; c.pitch += (w.pitch - c.pitch) * k; c.dist += (w.dist - c.dist) * k; c.target = c.target.map((v, i) => v + (w.target[i] - v) * k); }
      let eye = this.camEye(c); const gh = this.height(eye[0], eye[2]) + 1.8; if (eye[1] < gh) eye[1] = gh;
      if (this.mode !== 'overview' && c.dist < 40) { const ce = this.clearEye(c.target, eye); this.eyeS = this.eyeS ? this.eyeS.map((v, i) => v + (ce[i] - v) * Math.min(1, rdt * 6)) : ce; eye = this.eyeS; } else this.eyeS = null;
      // Detailstufe: weit entfernte Figuren als ein einziges Objekt (spart Zeichenaufrufe)
      const far2 = 42 * 42, L = n => { const dx = n.pos[0] - eye[0], dy = n.pos[1] - eye[1], dz = n.pos[2] - eye[2]; if (dx * dx + dy * dy + dz * dz < far2) return n;
        const l = n.lod || (n.lod = lodOf(n)), b = n.anim && n.anim.bob ? n.anim.bob.pos[1] * n.scl[1] : 0; l.pos = [n.pos[0], n.pos[1] + b, n.pos[2]]; l.rot = n.rot; l.scl = n.scl; return l; };   // Hüpfen bleibt sichtbar
      const clouds = eye[1] > 24 ? [] : this.clouds;   // von oben (Übersicht) verdecken Wolken sonst die Strecke
      this.r.render([...this.static, ...clouds, this.lamps, ...this.pondLife, this.pondFx, this.water, this.fall, ...this.animals.map(a => L(a.node)), ...this.farmLife.map(f => L(f.node)), ...(this.sceneDyn || []), ...(this.sceneActors || []).map(a => L(a.node)), ...(this.confetti ? [this.confetti] : []), ...this.rockLife.map(a => L(a.n)), ...this.crowd.map(c => L(c.node)), ...this.hikers.map(h => L(h.node)), ...this.flyers.map(f => f.node), ...[...this.racers.values()].map(r => r.node), this.dust, this.motes], { pos: eye, target: c.target, fov: c.fov, near: .5, far: 400 });
      // Beschriftungen
      const W = this.canvas.clientWidth, H = this.canvas.clientHeight;
      for (const r of this.racers.values()) { const s = this.r.project([r.node.pos[0], r.node.pos[1] + 3.1, r.node.pos[2]]); const el = r.label;
        if (!s || s[0] < -40 || s[0] > W + 40 || s[1] < -20 || s[1] > H + 20) { el.style.display = 'none'; if (r.pop) { r.pop.el.remove(); r.pop = null; } continue; }
        el.style.display = ''; el.style.transform = `translate(${s[0]}px,${s[1]}px) translate(-50%,-100%)`; el.style.zIndex = String(1000 - Math.round(s[2]));
        if (r.pop) { r.pop.t += dt; const pe = r.pop.el; pe.style.transform = `translate(${s[0]}px,${s[1] - 26 - r.pop.t * 40}px) translate(-50%,-100%)`; pe.style.opacity = String(Math.max(0, 1 - r.pop.t / 1.3)); if (r.pop.t > 1.3) { pe.remove(); r.pop = null; } } }
      this.placeTag('signs', this.signs);
      const sq = this.path.at(START_T - .012), fq = this.path.at(FINISH_T);
      this.placeTag('gates', [{ pos: [sq.p[0], 6.2, sq.p[2]], text: 'START', cls: 'gate' }, { pos: [fq.p[0], 6.9, fq.p[2]], text: '🏁 ZIEL', cls: 'gate' }]);
    }
    placeTag(key, items) {
      this.tags = this.tags || {}; const arr = this.tags[key] = this.tags[key] || [];
      while (arr.length < items.length) { const d = document.createElement('div'); d.className = 'sign'; this.layer.appendChild(d); arr.push(d); }
      arr.forEach((d, i) => { const it = items[i]; if (!it) { d.style.display = 'none'; return; }
        const s = it.screen || this.r.project(it.pos); if (!s) { d.style.display = 'none'; return; }
        d.style.display = ''; d.className = 'sign ' + (it.cls || ''); if (d.textContent !== it.text) d.textContent = it.text;
        d.style.transform = `translate(${s[0]}px,${s[1]}px) translate(-50%,-50%)`; });
    }
  }
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const initials = n => n.split(/\s+/).map(w => w[0] || '').join('').slice(0, 3).toUpperCase();
  const ink = c => { const n = parseInt(c.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255; return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#111' : '#fff'; };

  // ---------- Garage-Vorschau (drehende Bühne) ----------
  class Stage {
    constructor(canvas) { this.canvas = canvas; this.r = new Renderer(canvas); Object.assign(this.r.env, { fogN: 200, fogF: 400 });
      this.floor = new Node(); this.floor.add(new Node(G.cyl(3.2, 3.4, .3, 32), '#2a3550').at(0, -.15, 0), new Node(G.cyl(3.0, 3.0, .32, 32), '#33415f').at(0, -.14, 0));
      this.v = null; this.running = false; this.a = 0; }
    set(look) { this.v = Models.build(look); }
    start() { if (this.running) return; this.running = true; const loop = now => { if (!this.running) return; this.a += .008; this.draw(now / 1000); requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
    stop() { this.running = false; }
    draw(t) { if (!this.v) return; this.v.rot = [0, this.a, 0]; Models.animate(this.v, t, .15); this.floor.rot = [0, this.a, 0];
      this.r.render([this.floor, this.v], { pos: [0, 2.6, 6.4], target: [0, .85, 0], fov: .6 }); }
  }
  // Einzelbild eines Fahrzeugs (für die Auswahl-Kacheln)
  let thumbR = null;
  function thumb(look) {
    if (!thumbR) { const c = document.createElement('canvas'); c.style.cssText = 'position:fixed;left:-9999px;width:150px;height:110px'; document.body.appendChild(c); thumbR = new Renderer(c); thumbR.dpr = 2; Object.assign(thumbR.env, { fogN: 200, fogF: 400 }); }
    const v = Models.build(look); v.rot = [0, -.55, 0];
    thumbR.render([v], { pos: [0, 2.0, 5.2], target: [0, .75, 0], fov: .6 });
    return thumbR.canvas.toDataURL('image/png');
  }

  let figR = null;
  function figureThumb(look, focus) {
    if (!figR) { const c = document.createElement('canvas'); c.style.cssText = 'position:fixed;left:-9999px;width:110px;height:110px'; document.body.appendChild(c); figR = new Renderer(c); figR.dpr = 2; Object.assign(figR.env, { fogN: 200, fogF: 400 }); }
    const p = Models.person(look, 'stand'); p.rot = [0, -.5, 0];
    figR.render([p], focus === 'head' ? { pos: [1.07, 1.43, -.27], target: [-.03, 1.25, 0], fov: .52 } : { pos: [1.7, 1.25, -.9], target: [0, .92, 0], fov: .55 });
    return figR.canvas.toDataURL('image/png');
  }
  window.figureThumb = figureThumb;
  Forest.FINISH_T = FINISH_T; window.Forest = Forest; window.Stage = Stage; window.vehicleThumb = thumb;
})();
