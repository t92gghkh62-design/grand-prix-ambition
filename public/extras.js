// Grand Prix Ambition – Bauernhof (Berner Hof mit Tieren) und Zielarena (50 Fans)
(function () {
  'use strict';
  const Fo = window.Forest; if (!Fo) return;
  const { G, Node, merge } = window.Mini3D, PI = Math.PI, FIN = Fo.FINISH_T;
  const rng = seed => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
  const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const N = (geo, col, x = 0, y = 0, z = 0, opt) => new Node(geo, col, opt).at(x, y, z);
  const box = (w, h, d, c, x, y, z, opt) => N(G.box(w, h, d), c, x, y, z, opt);
  const cyl = (rt, rb, h, seg, c, x, y, z) => N(G.cyl(rt, rb, h, seg), c, x, y, z);
  const sph = (r, c, x, y, z) => N(G.sphere(r, 7, 5), c, x, y, z);
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const SNOW = '#f4f7fb';
  // Stab von a nach b (lokal)
  function rod(a, b, r, col) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.hypot(dx, dy, dz) || 1e-6;
    const tz = Math.acos(Math.max(-1, Math.min(1, dy / len))), ty = Math.sin(tz) > 1e-6 ? Math.atan2(dz / len, -dx / len) : 0;
    return N(G.cyl(r, r, len, 5), col, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2).rotate(0, ty, tz);
  }
  // Polygon als Dreiecksfächer; Normale zeigt von "inside" weg
  function face(B, pts, inside) {
    const c = [0, 0, 0]; pts.forEach(p => { c[0] += p[0] / pts.length; c[1] += p[1] / pts.length; c[2] += p[2] / pts.length; });
    for (let i = 1; i < pts.length - 1; i++) { const a = pts[0]; let b = pts[i], d = pts[i + 1];
      const u = sub(b, a), v = sub(d, a), n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], o = sub(c, inside);
      if (n[0] * o[0] + n[1] * o[1] + n[2] * o[2] < 0) [b, d] = [d, b]; B.tri(a, b, d); }
  }
  const two = (B, pts) => { const c = pts.reduce((s, p) => [s[0] + p[0], s[1] + p[1], s[2] + p[2]], [0, 0, 0]).map(v => v / pts.length);
    const u = sub(pts[1], pts[0]), v = sub(pts[2], pts[0]), n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    face(B, pts, [c[0] + n[0], c[1] + n[1], c[2] + n[2]]); face(B, pts, [c[0] - n[0], c[1] - n[1], c[2] - n[2]]); };
  // Satteldach mit First entlang Z; walm = Anteil Krüppelwalm an den Giebelseiten (0 = keiner)
  function roofGeo(a, b, y0, y1, walm, lift) {
    return G.custom(B => { const L = lift || 0, w = walm, yk = y0 + (y1 - y0) * (1 - w), dz = w ? b * .26 : 0, below = [0, y0 - 5, 0], above = [0, y1 + 9, 0];
      for (const sx of [-1, 1]) {
        const top = w ? [[sx * a, y0, -b], [sx * a, y0, b], [sx * a * w, yk, b], [0, y1, b - dz], [0, y1, -b + dz], [sx * a * w, yk, -b]] : [[sx * a, y0, -b], [sx * a, y0, b], [0, y1, b], [0, y1, -b]];
        face(B, top.map(p => [p[0], p[1] + L, p[2]]), below);
        if (!L) { face(B, top.map(p => [p[0], p[1] - .18, p[2]]), above);
          face(B, [[sx * a, y0, -b], [sx * a, y0, b], [sx * a, y0 - .18, b], [sx * a, y0 - .18, -b]], [0, y0, 0]); }
      }
      if (w) for (const sz of [-1, 1]) { const tri = [[-a * w, yk, sz * b], [a * w, yk, sz * b], [0, y1, sz * (b - dz)]];
        face(B, tri.map(p => [p[0], p[1] + L, p[2]]), below); if (!L) face(B, tri.map(p => [p[0], p[1] - .18, p[2]]), above); }
    });
  }
  const gableGeo = (hw, yw, ytop, z) => G.custom(B => two(B, [[-hw, yw, z], [hw, yw, z], [0, ytop, z]]));

  // ---------- Bauplatz suchen (vor dem Baumpflanzen) ----------
  Fo.prototype.planFarm = function (P) {
    const PD = this.pond, MS = this.massif, avoid = [[P.at(.36), 9], [P.at(.62), -7.5], [P.at(.48), 6.2]].map(([q, o]) => [q.p[0] + q.side[0] * o, q.p[2] + q.side[2] * o]);
    let best = null;
    for (let x = -50; x <= 50; x += 2) for (let z = -66; z <= 36; z += 2) { const d = P.dist(x, z); if (d < 25 || d > 34) continue;
      if (PD && Math.hypot(x - PD.x, z - PD.z) < PD.r + 22) continue;
      if (MS && Math.hypot(x - MS.x, z - MS.z) < MS.R + 19) continue;
      if (this.crowdSpots.some(c => Math.hypot(c.x - x, c.z - z) < 21)) continue;
      if (avoid.some(p => Math.hypot(p[0] - x, p[1] - z) < 18)) continue;
      // Ausrichtung: Front zum Pfad
      let bt = 0, bd = 1e9; for (let i = 0; i <= 300; i++) { const q = P.at(i / 300), dd = Math.hypot(q.p[0] - x, q.p[2] - z); if (dd < bd) { bd = dd; bt = i / 300; } }
      const q = P.at(bt), V = [(q.p[0] - x) / bd, (q.p[2] - z) / bd], U = [V[1], -V[0]];
      const corners = [[-13, -10], [13, -10], [13, 10], [-13, 10]].map(([u, v]) => [x + U[0] * u + V[0] * v, z + U[1] * u + V[1] * v]);
      if (corners.some(c => P.dist(c[0], c[1]) < 9)) continue;
      const sc = Math.hypot(x * .9, (z + 4) * .8); if (!best || sc < best.sc) best = { x, z, U, V, sc }; }
    if (!best) { this.farm = null; return; }
    const F = best; F.yaw = Math.atan2(F.V[0], F.V[1]);
    F.w = (u, v) => [F.x + F.U[0] * u + F.V[0] * v, F.z + F.U[1] * u + F.V[1] * v];
    F.l = (x, z) => { const dx = x - F.x, dz = z - F.z; return [dx * F.U[0] + dz * F.U[1], dx * F.V[0] + dz * F.V[1]]; };
    // Zufahrt: vom Hoftor zum Waldpfad
    const gate = F.w(-1.75, 9.4); let bt = 0, bd = 1e9; for (let i = 0; i <= 400; i++) { const q = P.at(i / 400), dd = Math.hypot(q.p[0] - gate[0], q.p[1] === undefined ? 0 : q.p[2] - gate[1]); if (dd < bd) { bd = dd; bt = i / 400; } }
    const q = P.at(bt), dx = gate[0] - q.p[0], dz = gate[1] - q.p[2], dl = Math.hypot(dx, dz) || 1;
    F.lane = [gate, [q.p[0] + dx / dl * 4.1, q.p[2] + dz / dl * 4.1]];
    this.farm = F;
  };
  Fo.prototype.inFarm = function (x, z, m) { const F = this.farm; if (!F) return false; const [u, v] = F.l(x, z); return Math.abs(u) < 12.5 + (m || 0) && Math.abs(v) < 9.5 + (m || 0); };
  Fo.prototype.farmReserved = function (x, z, r) { const F = this.farm; if (!F) return false;
    if (this.inFarm(x, z, r + 2.5)) return true;
    const [a, b] = F.lane, ux = b[0] - a[0], uz = b[1] - a[1], L2 = ux * ux + uz * uz || 1, t = Math.max(0, Math.min(1, ((x - a[0]) * ux + (z - a[1]) * uz) / L2));
    return Math.hypot(x - a[0] - ux * t, z - a[1] - uz * t) < r + 2.2; };
  Fo.prototype.farmHeight = function (x, z, h0) { const F = this.farm; if (!F || F.level === undefined) return h0;
    const r = Math.hypot(x - F.x, z - F.z); if (r > 21) return h0; return r < 15.5 ? F.level : F.level + (h0 - F.level) * smooth(15.5, 21, r); };
  Fo.prototype.farmGround = function (x, z, g) { const F = this.farm; if (!F) return g; const [u, v] = F.l(x, z);
    if (this.season === 'winter') return g;
    if (u > -7.4 && u < .6 && v > .8 && v < 8.8) return [0.72, 0.66, 0.53];          // Kiesplatz
    if (u > -11.6 && u < -7.4 && v > 3 && v < 8.6) return [0.45, 0.35, 0.24];       // Schweinesuhle
    if (u > -.6 && u < 2.6 && v > -8 && v < .8) return [0.62, 0.56, 0.44];
    return g; };

  // ---------- Bauernhof bauen ----------
  Fo.prototype.buildFarm = function (deco, height) {
    const F = this.farm; if (!F) return;
    const SEA = this.season, W = SEA === 'winter', AU = SEA === 'autumn', R = rng(321);
    const farm = new Node().at(F.x, F.level, F.z); farm.rot = [0, F.yaw, 0];
    const add = (...n) => farm.add(...n);
    // --- Berner Bauernhaus: weisser Sockel, Holz-Obergeschoss, mächtiges Walmdach mit Ründi ---
    { const h = new Node().at(-5.5, 0, -3.5);
      h.add(box(10, 2.6, 8, '#f3eee4', 0, 1.3, 0), box(10.1, .25, 8.1, '#c9c2b4', 0, .12, 0), box(10, 1.9, 8, '#9b5f2e', 0, 3.55, 0), box(10.06, .1, 8.06, '#7a4622', 0, 2.62, 0));
      h.add(N(roofGeo(6.6, 5.4, 3.3, 9, .32), '#8a4b32'), N(gableGeo(5, 4.5, 8.85, 4.0), '#a86a36'), N(gableGeo(5, 4.5, 8.85, -4.0), '#a86a36'));
      if (W) h.add(N(roofGeo(6.6, 5.4, 3.3, 9, .32, .16), SNOW));
      h.add(N(G.torus(3.3, .16, 22, 5, PI), '#d9c49a', 0, 4.5, 4.12), N(G.torus(3.0, .07, 22, 4, PI), '#7a4622', 0, 4.5, 4.1));     // Ründi
      for (let i = 0; i < 7; i++) h.add(box(.05, 1.6, .04, '#7a4622', -3 + i, 5.3, 4.03));
      const win = (x, y, z, big) => { const s = big ? 1 : .8;
        h.add(box(.95 * s, 1.05 * s, .05, '#ffffff', x, y, z + .02), box(.74 * s, .84 * s, .05, '#2a3d52', x, y, z + .045), box(.05, .84 * s, .055, '#ffffff', x, y, z + .05),
          box(.38 * s, 1.05 * s, .04, '#2f6b3a', x - .68 * s, y, z + .03), box(.38 * s, 1.05 * s, .04, '#2f6b3a', x + .68 * s, y, z + .03), box(1 * s, .2, .3, '#7a4a2a', x, y - .62 * s, z + .17));
        if (W) { h.add(box(1 * s, .08, .3, SNOW, x, y - .48 * s, z + .17)); for (let k = 0; k < 3; k++) h.add(sph(.09, '#2f6b3a', x - .3 + k * .3, y - .44 * s, z + .2), sph(.05, '#e63946', x - .25 + k * .3, y - .4 * s, z + .3)); }
        else for (let k = 0; k < 5; k++) h.add(sph(.12, '#3f8a3a', x - .38 * s + k * .19 * s, y - .44 * s, z + .2), sph(.08, AU ? '#d6452f' : '#e63946', x - .36 * s + k * .19 * s, y - .32 * s, z + .24)); };
      [-3.9, -2.4, 2.4, 3.9].forEach(x => win(x, 1.45, 4, true));
      [-4, -2.7, -1.35, 1.35, 2.7, 4].forEach(x => win(x, 3.55, 4, false));
      win(-1.1, 5.7, 4, false); win(1.1, 5.7, 4, false);
      for (const sx of [-1, 1]) for (const z of [-2.2, 0, 2.2]) h.add(box(.05, .95, .8, '#ffffff', sx * 5.02, 1.45, z), box(.05, .78, .62, '#2a3d52', sx * 5.04, 1.45, z));
      h.add(box(1.2, 2.1, .06, '#6b4426', 0, 1.05, 4.03), box(1.36, .12, .08, '#ffffff', 0, 2.16, 4.03), box(1.9, .2, .9, '#a8a8a8', 0, .1, 4.45), sph(.05, '#d9a520', .4, 1.05, 4.08));
      h.add(box(.7, 2, .7, '#d8d2c8', 2.4, 7.5, -1.5), box(.9, .12, .9, '#555555', 2.4, 8.55, -1.5));
      h.add(box(.9, 1.7, 5.6, '#9a7448', -5.55, .85, -1), box(1.1, .1, 5.9, '#6b4a2b', -5.6, 1.75, -1));     // Holzbeige
      for (let i = 0; i < 14; i++) h.add(N(G.cyl(.14, .14, .04, 7), '#c9a26b', -5.1, .25 + (i % 5) * .32, -3.4 + Math.floor(i / 5) * 1.9 + (i % 2) * .5).rotate(0, 0, PI / 2));
      add(h); }
    // --- Scheune mit grossem Tor und Heuboden ---
    { const b = new Node().at(6.5, 0, -4.5);
      b.add(box(8, 4.2, 9, '#7b4a2a', 0, 2.1, 0), box(8.06, .3, 9.06, '#a8a8a8', 0, .15, 0));
      for (let i = 0; i < 15; i++) b.add(box(.05, 4.1, .03, '#5f3820', -3.5 + i * .5, 2.1, 4.51));
      b.add(N(roofGeo(5, 5.4, 4, 7.6, 0), '#5b5f66'), N(gableGeo(4, 4.2, 7.5, 4.5), '#7b4a2a'), N(gableGeo(4, 4.2, 7.5, -4.5), '#7b4a2a'));
      if (W) b.add(N(roofGeo(5, 5.4, 4, 7.6, 0, .16), SNOW));
      b.add(box(3.2, 3.2, .06, '#5a3820', 0, 1.6, 4.54), N(G.box(4.3, .16, .04), '#f4f1ea', 0, 1.6, 4.58).rotate(0, 0, PI / 4), N(G.box(4.3, .16, .04), '#f4f1ea', 0, 1.6, 4.58).rotate(0, 0, -PI / 4),
        box(3.4, .16, .05, '#f4f1ea', 0, 3.2, 4.57), box(1.4, 1.1, .06, '#2b1d12', 0, 5, 4.54), box(1.3, .35, .7, '#e3c35a', 0, 4.62, 4.75));
      add(b); }
    // --- Kleinkram: Hühnerstall, Hundehütte, Brunnen, Bank, Fahne, Garten, Milchkannen, Traktor, Heuballen ---
    { const c = new Node().at(-6.4, 0, 7.2); c.rot = [0, PI / 2, 0];
      c.add(box(1.7, 1.1, 1.3, '#c0392b', 0, 1.05, 0), N(roofGeo(1.05, .85, 1.55, 2.05, 0), '#5b5f66'), N(gableGeo(.85, 1.6, 2.0, .66), '#c0392b'), N(gableGeo(.85, 1.6, 2.0, -.66), '#c0392b'));
      for (const [x, z] of [[-.75, -.55], [.75, -.55], [-.75, .55], [.75, .55]]) c.add(box(.1, .5, .1, '#6b4a2b', x, .25, z));
      c.add(N(G.box(.4, .05, 1.2), '#9a7448', 1.1, .3, 0).rotate(0, 0, .5), box(.3, .35, .05, '#2b1d12', .5, .9, .66));
      if (W) c.add(N(roofGeo(1.05, .85, 1.55, 2.05, 0, .1), SNOW));
      add(c); }
    { const d = new Node().at(-.6, 0, 2.2); d.rot = [0, -PI / 2, 0];
      d.add(box(1.1, .8, 1.3, '#b5452f', 0, .4, 0), N(roofGeo(.75, .8, .8, 1.25, 0), '#6b4a2b'), N(gableGeo(.55, .8, 1.2, .66), '#b5452f'), box(.45, .5, .04, '#1b1b1b', 0, .3, .66));
      if (W) d.add(N(roofGeo(.75, .8, .8, 1.25, 0, .08), SNOW)); add(d); }
    { const f = new Node().at(-4.4, 0, 3.6);
      f.add(box(2.3, .7, .95, '#8d9399', 0, .35, 0), box(2.05, .06, .7, W ? '#d9eef6' : '#4aa3c8', 0, .66, 0, { emis: .15 }), box(.28, 1.4, .28, '#7a5532', 1.3, .7, 0),
        N(G.cyl(.04, .04, .45, 6), '#8a8f96', 1.05, 1.15, 0).rotate(0, 0, PI / 2));
      if (!W) f.add(N(G.cyl(.035, .035, .45, 6), '#8fd3f0', .84, .92, 0, { alpha: .6, emis: .3 }));
      add(f); }
    { const b = new Node().at(-5.5, 0, 1.15);
      b.add(box(2, .08, .45, '#9a7448', 0, .48, 0), box(2, .45, .06, '#9a7448', 0, .78, -.2), box(.08, .48, .42, '#5a4030', -.85, .24, 0), box(.08, .48, .42, '#5a4030', .85, .24, 0)); add(b); }
    add(cyl(.06, .08, 7.5, 6, '#f4f4f0', .4, 3.75, 8.3), sph(.12, '#d9a520', .4, 7.55, 8.3));
    { const fl = new Node().at(1.05, 6.7, 8.3); fl.add(box(1.3, 1.3, .03, '#e30613', 0, 0, 0), box(.8, .26, .04, '#ffffff', 0, 0, 0), box(.26, .8, .04, '#ffffff', 0, 0, 0)); add(fl); }
    for (let i = 0; i < 3; i++) { const z = .9 + i * .75;
      add(box(3.4, .16, .55, '#5a3a22', -9.6, .08, z));
      for (let k = 0; k < 6; k++) { const x = -11 + k * .55;
        if (W) add(box(.5, .06, .5, SNOW, x, .19, z)); else if (AU && i === 1) add(N(G.sphere(.22, 8, 5), '#e8792b', x, .3, z).scale(1, .8, 1)); else add(sph(.14 + (k % 2) * .04, i === 2 ? '#7cc24a' : '#3f8a3a', x, .25, z)); } }
    { const m = new Node().at(-4.2, 0, 10.4); m.add(box(1.8, .08, .6, '#9a7448', 0, .55, 0), box(.08, .55, .55, '#5a4030', -.8, .27, 0), box(.08, .55, .55, '#5a4030', .8, .27, 0));
      for (const x of [-.5, 0, .5]) m.add(N(G.cyl(.17, .19, .55, 10), '#d8dde2', x, .87, 0), N(G.cyl(.08, .16, .14, 10), '#d8dde2', x, 1.21, 0), N(G.cyl(.09, .09, .06, 10), '#9aa3ab', x, 1.3, 0));
      add(m); }
    { const t = new Node().at(1, 0, -3.2); t.rot = [0, -PI / 2, 0];         // Traktor (vorwärts = +X)
      const wheel = (r, w, x, z, rim) => { const g = new Node().at(x, r, z).rotate(PI / 2, 0, 0); g.add(N(G.cyl(r, r, w, 14), '#1c1d20', 0, 0, 0), N(G.cyl(r * .55, r * .55, w * 1.08, 10), rim, 0, 0, 0)); return g; };
      t.add(box(2.4, .5, .7, '#c0392b', .1, .85, 0), box(1.2, .62, .74, '#c0392b', .75, 1.3, 0), box(1.22, .1, .76, '#e8e8e8', .75, 1.64, 0), box(.06, .5, .6, '#2b2d31', 1.37, 1.25, 0),
        box(.5, .1, .5, '#2b2d31', -.6, 1.45, 0), box(.1, .55, .5, '#2b2d31', -.85, 1.7, 0), N(G.cyl(.04, .04, .9, 6), '#2b2d31', .3, 2.0, .22), N(G.torus(.2, .03, 14, 4), '#1e2024', -.15, 1.9, 0).rotate(0, PI / 2, -.6),
        box(1.2, .06, .5, '#c0392b', -.85, 1.48, .55), box(1.2, .06, .5, '#c0392b', -.85, 1.48, -.55),
        wheel(.72, .45, -.85, .62, '#f2c230'), wheel(.72, .45, -.85, -.62, '#f2c230'), wheel(.42, .28, 1.0, .45, '#f2c230'), wheel(.42, .28, 1.0, -.45, '#f2c230'));
      add(t); }
    for (const [u, v] of [[10.4, 7.7], [8.9, 7.95]]) { add(N(G.cyl(.72, .72, 1.15, 14), W ? '#f0f0ec' : '#d9b45a', u, .72, v).rotate(PI / 2, 0, 0)); if (!W) add(N(G.cyl(.5, .5, 1.17, 12), '#c49a3e', u, .72, v).rotate(PI / 2, 0, 0)); }
    { const r = new Node().at(4.2, 0, 7.6); r.add(box(2.2, .06, .9, '#7a5532', 0, .6, 0), box(2.2, .8, .06, '#7a5532', 0, 1.0, .42), box(2.2, .8, .06, '#7a5532', 0, 1.0, -.42), box(2, .5, .7, '#d6b24c', 0, .9, 0)); add(r); }
    // Obstbaum hinter dem Hof und Linde am Tor
    const tree = (u, v, h, apples) => { add(cyl(.22, .3, h * .5, 6, '#7a5532', u, h * .25, v));
      if (W) { for (let i = 0; i < 6; i++) { const a = i * 1.05; add(rod([u, h * .45, v], [u + Math.cos(a) * h * .28, h * .7, v + Math.sin(a) * h * .28], .07, '#6b4a2b')); add(N(G.sphere(.2, 5, 4), SNOW, u + Math.cos(a) * h * .28, h * .72, v + Math.sin(a) * h * .28).scale(1.4, .5, 1.4)); } return; }
      const c = AU ? '#d9a33a' : SEA === 'spring' ? '#8cc84a' : '#4f9a3c';
      add(sph(h * .3, c, u, h * .62, v), sph(h * .22, c, u + h * .15, h * .76, v + h * .08), sph(h * .2, c, u - h * .14, h * .74, v - h * .1));
      if (apples && SEA !== 'spring') for (let i = 0; i < 18; i++) { const a = R() * 6.3, bb = .4 + R() * 1.2; add(sph(.15, R() < .8 ? '#d62828' : '#f2b134', u + Math.cos(a) * Math.sin(bb) * h * .31, h * .62 + Math.cos(bb) * h * .31, v + Math.sin(a) * Math.sin(bb) * h * .31)); } };
    tree(1, -7.6, 5.4, true); tree(-9.6, 11, 6.5, false);
    // Zäune: Aussenzaun mit Tor, Weide, Schweinegehege
    const fence = (u0, v0, u1, v1, col) => { const L = Math.hypot(u1 - u0, v1 - v0), n = Math.max(1, Math.round(L / 2)), th = Math.atan2(-(v1 - v0), u1 - u0);
      for (let i = 0; i <= n; i++) { const f = i / n; add(cyl(.07, .08, 1.15, 5, col, u0 + (u1 - u0) * f, .57, v0 + (v1 - v0) * f)); if (W) add(cyl(.09, .09, .06, 5, SNOW, u0 + (u1 - u0) * f, 1.18, v0 + (v1 - v0) * f)); }
      for (const y of [.45, .9]) add(N(G.box(L, .08, .05), col, (u0 + u1) / 2, y, (v0 + v1) / 2).rotate(0, th, 0)); };
    const FC = '#8a6a42';
    fence(-12, -9, 12, -9, FC); fence(12, -9, 12, 9, FC); fence(-12, 9, -12, -9, FC); fence(-12, 9, -3, 9, FC); fence(-.5, 9, 12, 9, FC);
    add(box(.14, 1.4, .14, '#5a4030', -3, .7, 9), box(.14, 1.4, .14, '#5a4030', -.5, .7, 9), box(2.3, .1, .06, '#a07a4a', -1.75, .5, 9), box(2.3, .1, .06, '#a07a4a', -1.75, 1.0, 9), N(G.box(2.6, .08, .05), '#a07a4a', -1.75, .75, 9).rotate(0, 0, .2));
    fence(1, .6, 1, 9, FC); fence(1, .6, 2.5, .6, FC); fence(10.5, .6, 12, .6, FC);          // Weide (Scheunentor offen zur Weide)
    fence(-7.5, 2.9, -7.5, 9, FC); fence(-12, 2.9, -7.5, 2.9, FC);                          // Schweine
    add(N(G.cyl(1.4, 1.4, .03, 14), '#5a4128', -9.8, .03, 6.5).scale(1.2, 1, .8));
    { const s = new Node().at(-10.6, 0, 3.8); s.add(box(1.6, .9, 1.1, '#9a7448', 0, .45, 0), N(roofGeo(.95, .7, .9, 1.35, 0), '#6b4a2b'), box(.5, .5, .04, '#2b1d12', 0, .3, .56)); add(s); }
    deco.add(farm);
    // Zufahrt (Feldweg)
    { const [a, b] = F.lane, dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), n = Math.max(2, Math.ceil(L / .8)), px = -dz / L * 1.3, pz = dx / L * 1.3;
      deco.add(new Node(G.custom(B => { for (let i = 0; i < n; i++) { const f0 = i / n, f1 = (i + 1) / n, p0 = [a[0] + dx * f0, a[1] + dz * f0], p1 = [a[0] + dx * f1, a[1] + dz * f1];
        const P = (p, s) => [p[0] + px * s, height(p[0] + px * s, p[1] + pz * s) + .035, p[1] + pz * s];
        face(B, [P(p0, -1), P(p0, 1), P(p1, 1), P(p1, -1)], [p0[0], -9, p0[1]]); } }), W ? '#e8edf2' : '#9a7748')); }
    // Hindernisse für Wildtiere (dichter Zaun) und Kamera (Gebäude, Bäume)
    const obsLine = (u0, v0, u1, v1) => { const L = Math.hypot(u1 - u0, v1 - v0), n = Math.ceil(L); for (let i = 0; i <= n; i++) { const p = F.w(u0 + (u1 - u0) * i / n, v0 + (v1 - v0) * i / n); this.addObs(p[0], p[1], .5); } };
    obsLine(-12, -9, 12, -9); obsLine(12, -9, 12, 9); obsLine(12, 9, -12, 9); obsLine(-12, 9, -12, -9);
    { const p = F.w(-9.6, 11); this.addObs(p[0], p[1], .8); const m = F.w(-4.2, 10.4); this.addObs(m[0], m[1], 1.1); }
    const cam = (u, v, r, top) => { const p = F.w(u, v), key = Math.floor(p[0] / 6) + ',' + Math.floor(p[1] / 6); let l = this.trees.get(key); if (!l) this.trees.set(key, l = []); l.push([p[0], p[1], r, F.level + top]); };
    cam(-5.5, -3.5, 6.9, 9.4); cam(6.5, -4.5, 6.4, 8); cam(1, -7.6, 2.6, 5.8); cam(-9.6, 11, 3, 7);
    // Zonen für die Hoftiere (lokale Koordinaten) und feste Hindernisse darin
    F.zones = { paddock: [2.3, 1.9, 10.5, 7.6], pigs: [-10.6, 4.0, -8.4, 7.9], yard: [-6.8, 1.8, 0, 8.1] };   // mit Abstand zum Zaun
    F.blocks = [[-4.4, 3.6, 1.5], [-6.4, 7.2, 1.2], [-.6, 2.2, .9], [.4, 8.3, .4], [-1.6, 6.3, .7], [-3.6, 7.4, .6], [10.4, 7.7, 1.1], [8.9, 7.95, 1.1], [4.2, 7.6, 1.5], [-10.6, 3.8, .9]];
  };

  // ---------- Hoftiere ----------
  Fo.prototype.spawnFarm = function () {
    const F = this.farm; this.farmLife = []; if (!F) return;
    const R = rng(55), Z = F.zones;
    const SC = { cow: 1.3, calf: 1.3, sheep: 1.3, goat: 1.3, pig: 1.35, pigletF: 1.35, hen: 1.5, rooster: 1.5, dog: 1.35, cat: 1.5 };
    const SP = { cow: .45, calf: .6, sheep: .55, goat: .7, pig: .45, pigletF: .8, hen: .7, rooster: .65, dog: 1.6, cat: .5 };
    const RAD = { cow: 1.25, calf: .75, sheep: .6, goat: .55, pig: .7, pigletF: .35, hen: .25, rooster: .28, dog: .6, cat: .3 };
    const add = (kind, zone, fixed) => { const n = Models.animal(kind), z = Z[zone]; n.scl = [SC[kind], SC[kind], SC[kind]]; n.cull = 3;
      let u = 0, v = 0; for (let i = 0; i < 40; i++) { u = z[0] + R() * (z[2] - z[0]); v = z[1] + R() * (z[3] - z[1]); if (!this.farmBlocked(u, v, RAD[kind], null)) break; }
      const a = { kind, node: n, zone, u, v, tu: u, tv: v, psi: R() * 6.28, wait: R() * 5, speed: SP[kind], rad: RAD[kind], graze: false, t0: R() * 10, fixed };
      this.farmLife.push(a); return a; };
    add('cow', 'paddock'); add('cow', 'paddock'); add('calf', 'paddock');
    for (let i = 0; i < 3; i++) add('sheep', 'paddock');
    add('goat', 'paddock'); add('goat', 'paddock');
    add('pig', 'pigs'); for (let i = 0; i < 3; i++) add('pigletF', 'pigs');
    for (let i = 0; i < 5; i++) add('hen', 'yard'); add('rooster', 'yard');
    add('dog', 'yard');
    { const c = add('cat', 'yard', true); c.u = -5.9; c.v = 1.15; c.y = .52; c.psi = -PI / 2; }
  };
  Fo.prototype.farmBlocked = function (u, v, r, self) {
    for (const b of this.farm.blocks) if ((b[0] - u) ** 2 + (b[1] - v) ** 2 < (b[2] + r) ** 2) return true;
    for (const o of this.farmLife || []) if (o !== self && o.zone === (self && self.zone) && (o.u - u) ** 2 + (o.v - v) ** 2 < (o.rad + r) * (o.rad + r) * .8) return true;
    return false; };
  Fo.prototype.updateFarm = function (t, dt) {
    const F = this.farm; if (!F || !this.farmLife) return;
    for (const a of this.farmLife) {
      let speed = 0;
      if (!a.fixed) {
        const z = F.zones[a.zone];
        if (a.wait > 0) { a.wait -= dt; }
        else { const du = a.tu - a.u, dv = a.tv - a.v, d = Math.hypot(du, dv);
          if (d < .2) { const peck = a.kind === 'hen' || a.kind === 'rooster';
            a.wait = peck ? .5 + Math.random() * 2 : 2 + Math.random() * (a.kind === 'cow' ? 9 : 5); a.graze = a.kind !== 'dog' && Math.random() < (peck ? .8 : .7);
            for (let i = 0; i < 12; i++) { const r = peck ? 2.2 : 4.5, nu = Math.max(z[0], Math.min(z[2], a.u + (Math.random() - .5) * r * 2)), nv = Math.max(z[1], Math.min(z[3], a.v + (Math.random() - .5) * r * 2));
              if (!this.farmBlocked(nu, nv, a.rad, a)) { a.tu = nu; a.tv = nv; break; } } }
          else { const step = Math.min(d, a.speed * dt), nu = a.u + du / d * step, nv = a.v + dv / d * step;
            if (this.farmBlocked(nu, nv, a.rad, a)) { a.tu = a.u; a.tv = a.v; a.wait = .3 + Math.random(); }
            else { a.u = nu; a.v = nv; speed = Math.min(1, a.speed / 2.5 + .15); a.graze = false;
              const want = Math.atan2(-dv, du); let dy = want - a.psi; while (dy > PI) dy -= 2 * PI; while (dy < -PI) dy += 2 * PI; a.psi += dy * Math.min(1, dt * 4); } } }
      }
      const p = F.w(a.u, a.v); a.node.pos = [p[0], (a.fixed ? F.level + a.y : this.height(p[0], p[1])), p[1]]; a.node.rot = [0, F.yaw + a.psi, 0];
      Models.animateAnimal(a.node, t + a.t0, speed, a.graze);
    }
  };
  Fo.FARM_NAMES = { cow: 'Kuh', calf: 'Kalb', sheep: 'Schaf', goat: 'Ziege', pig: 'Schwein', pigletF: 'Ferkel', hen: 'Huhn', rooster: 'Hahn', dog: 'Berner Sennenhund', cat: 'Hofkatze' };

  // ---------- Zielarena: Absperrgitter, Tribüne, Wimpel und 50 Fans ----------
  Fo.prototype.planArena = function (P) {
    const T = P.total, R = rng(808), st = 1.25 / T, slots = [];
    const rows = [[-1, 6.5, 0, .893, .99, 0], [1, 6.5, 0, .893, .953, 0], [-1, 7.6, 0, .893, .99, 1], [1, 7.6, 0, .893, .953, 1], [-1, 8.85, .5, .897, .99, 0], [-1, 9.95, 1.0, .897, .99, 1]];
    rows.forEach(([sd, off, lift, t0, t1, stag], ri) => {
      for (let t = t0 + (stag ? st / 2 : 0); t <= t1; t += st) { const q = P.at(t), x = q.p[0] + q.side[0] * sd * off, z = q.p[2] + q.side[2] * sd * off;
        const s = sd < 0 ? (t - .893) / (.99 - .893) : 1 + (.953 - t) / (.953 - .893);
        slots.push({ x, z, lift, ri, s, yaw: Math.atan2(sd * q.side[2], -sd * q.side[0]) + (R() - .5) * .35 }); } });
    const members = slots.slice(0, 50);
    const KINDS = ['flag', 'bell', 'sign', 'cheer', 'wave', 'sign', 'cheer', 'flag', 'bell', 'sign'], TEXTS = ['ZIEL!', 'HOPP!', 'BRAVO', 'SUPER', 'GO GO', 'WOW!', 'TOP!', 'JA!', '♥ ♥', 'ALLEZ'];
    members.forEach((m, i) => { m.kind = KINDS[Math.floor(R() * KINDS.length)]; m.text = TEXTS[Math.floor(R() * TEXTS.length)]; this.addObs(m.x, m.z, .5); });
    const q = P.at(.94); this.arena = { members };
    this.crowdSpots.push({ x: q.p[0], z: q.p[2], t: .94, sd: -1, members, arena: true });
    this.olaWait = 8; this.ola = null; this.partyT = 0;
  };
  Fo.prototype.arenaReserved = function (x, z, r) { return !!this.arena && this.arena.members.some(m => (m.x - x) ** 2 + (m.z - z) ** 2 < (r + 2.2) ** 2); };
  Fo.prototype.buildArena = function (deco, height) {
    const P = this.path, T = P.total, W = this.season === 'winter';
    const at = (t, sd, off) => { const q = P.at(t); return { x: q.p[0] + q.side[0] * sd * off, z: q.p[2] + q.side[2] * sd * off, th: Math.atan2(q.tan[0], q.tan[2]) }; };
    // Absperrgitter mit Bannern (rot/weiss)
    for (const [sd, t0, t1] of [[-1, .893, .99], [1, .893, .955]]) { let k = 0;
      for (let t = t0; t < t1; t += 2.05 / T, k++) { const p = at(t + 1 / T, sd, 5.75), g = new Node().at(p.x, height(p.x, p.z), p.z); g.rot = [0, p.th, 0];
        g.add(box(.05, 1.1, .05, '#b8bec5', 0, .55, -.98), box(.05, 1.1, .05, '#b8bec5', 0, .55, .98), box(.05, .05, 2, '#b8bec5', 0, 1.08, 0), box(.05, .05, 2, '#b8bec5', 0, .08, 0),
          box(.03, .62, 1.9, k % 2 ? '#ffffff' : '#e30613', 0, .62, 0), box(.5, .04, .1, '#8a9096', 0, .02, -.98), box(.5, .04, .1, '#8a9096', 0, .02, .98));
        if (k % 2) g.add(box(.035, .2, .2, '#e30613', 0, .62, 0), box(.035, .2, .06, '#e30613', 0, .62, 0)); else g.add(box(.035, .34, .1, '#ffffff', 0, .62, 0), box(.035, .1, .34, '#ffffff', 0, .62, 0));
        deco.add(g); } }
    // Holztribüne (zwei Stufen) links
    for (let t = .897; t < .99; t += 2.05 / T) { const a = at(t + 1 / T, -1, 8.85), b = at(t + 1 / T, -1, 9.95), c = at(t + 1 / T, -1, 10.6);
      deco.add(N(G.box(1.15, .5, 2.06), '#9a7448', a.x, height(a.x, a.z) + .25, a.z).rotate(0, a.th, 0), N(G.box(1.15, 1, 2.06), '#8a6a42', b.x, height(b.x, b.z) + .5, b.z).rotate(0, b.th, 0),
        N(G.box(.08, .9, 2.06), '#6b4a2b', c.x, height(c.x, c.z) + 1.45, c.z).rotate(0, c.th, 0));
      if (W) deco.add(N(G.box(1.15, .05, 2.06), SNOW, a.x, height(a.x, a.z) + .52, a.z).rotate(0, a.th, 0));
      for (const p of [a, b]) this.addObs(p.x, p.z, 1); this.addObs(c.x, c.z, .6); }
    // Wimpelketten über dem Zielbereich und Fahnenmasten
    const COLS = ['#e30613', '#ffffff', '#ffd23f', '#3a86ff', '#06d6a0', '#ff006e'];
    for (const sd of [-1, 1]) { const t0 = .893, t1 = sd < 0 ? .99 : .955, A = at(t0, sd, 6.1), Bp = at(t1, sd, 6.1);
      for (const p of [A, Bp]) { deco.add(cyl(.06, .07, 5.2, 6, '#e8e8e8', p.x, height(p.x, p.z) + 2.6, p.z)); this.addObs(p.x, p.z, .3);
        const f = new Node().at(p.x, height(p.x, p.z) + 4.7, p.z); f.rot = [0, p.th + PI / 2, 0]; f.add(box(.9, .9, .03, '#e30613', .5, 0, 0), box(.55, .18, .04, '#ffffff', .5, 0, 0), box(.18, .55, .04, '#ffffff', .5, 0, 0)); deco.add(f); }
      const n = Math.round((t1 - t0) * T / .6);
      for (let i = 1; i < n; i++) { const f = i / n, t = t0 + (t1 - t0) * f, p = at(t, sd, 6.1), y0 = height(p.x, p.z) + 4.9 - Math.sin(f * PI) * .9;
        deco.add(N(G.box(.32, .32, .02), COLS[i % COLS.length], p.x, y0 - .2, p.z).rotate(0, p.th + PI / 2, PI / 4).scale(1, 1, 1)); } }
  };
  // Stimmung im Zielgelände: Warten, Klatschen, La-Ola-Welle und Jubel bei jeder Ankunft
  Fo.prototype.arenaTick = function (dt) {
    if (!this.arena) return;
    let a = 0; for (const r of this.racers.values()) if (r.cur < FIN) a = Math.max(a, smooth(FIN - .16, FIN - .005, r.cur));
    this.arenaApproach = a;
    if (this.partyT > 0) this.partyT -= dt;
    if (this.ola) { this.ola.f += dt / 2.6; if (this.ola.f > 2.4) { this.ola = null; this.olaWait = 16 + Math.random() * 16; } }
    else if ((this.olaWait -= dt) <= 0 && this.partyT <= 0) this.ola = { f: -.35 };
    if (this.confetti) for (const c of [...this.confetti.children]) { c.life -= dt; c.vel[1] -= 6 * dt; c.vel = c.vel.map((v, i) => i === 1 ? Math.max(v, -1.6) : v * (1 - dt * .8));
      c.pos = [c.pos[0] + c.vel[0] * dt, c.pos[1] + c.vel[1] * dt, c.pos[2] + c.vel[2] * dt]; c.rot = [c.rot[0] + dt * c.spin, c.rot[1] + dt * 3, c.rot[2] + dt * c.spin * .7];
      if (c.life <= 0 || c.pos[1] < -1) this.confetti.children.splice(this.confetti.children.indexOf(c), 1); }
  };
  Fo.prototype.arenaWant = function (c, dt) {
    const a = this.arenaApproach || 0;
    if (c.burst > 0) c.burst -= dt; else if (Math.random() < dt * (.04 + a * .7)) c.burst = .7 + Math.random() * 1.6;
    let w = c.burst > 0 ? .45 + a * .55 : a * .12;
    if (this.ola) { const d = (c.s - this.ola.f) * 3.2; w = Math.max(w, Math.exp(-d * d)); }
    if (this.partyT > 0) w = Math.max(w, .7 + .3 * Math.sin(c.s * 9 + this.partyT * 3) ** 2);
    return w;
  };
  Fo.prototype.finishParty = function (r) {
    this.partyT = 7; this.ola = null; this.olaWait = 12;
    if (!this.confetti) this.confetti = new Node();
    const q = this.path.at(FIN), COLS = ['#e30613', '#ffffff', '#ffd23f', '#3a86ff', '#06d6a0', '#ff006e', '#8338ec'];
    for (const sd of [-1, 1]) { const x = q.p[0] + q.side[0] * sd * 5.2, z = q.p[2] + q.side[2] * sd * 5.2;
      for (let i = 0; i < 70; i++) { if (this.confetti.children.length > 260) break;
        const c = new Node(G.box(.16, .02, .11), COLS[i % COLS.length], { emis: .25 }).at(x, 5.2, z), sp = 2 + Math.random() * 3.5, a = Math.random() * PI * 2;
        c.vel = [Math.cos(a) * sp * .6 - q.side[0] * sd * 2, 5 + Math.random() * 4, Math.sin(a) * sp * .6 - q.side[2] * sd * 2]; c.life = 3.5 + Math.random() * 2; c.spin = 4 + Math.random() * 6; c.rot = [Math.random() * 3, 0, Math.random() * 3];
        this.confetti.add(c); } }
  };
})();

// ---------- Bach mit Wassermühle · Spielwiese mit Dart und Pingpong ----------
(function () {
  'use strict';
  const Fo = window.Forest; if (!Fo) return;
  const { G, Node, merge } = window.Mini3D, PI = Math.PI;
  const N = (geo, col, x = 0, y = 0, z = 0, opt) => new Node(geo, col, opt).at(x, y, z);
  const box = (w, h, d, c, x, y, z, opt) => N(G.box(w, h, d), c, x, y, z, opt);
  const cyl = (rt, rb, h, seg, c, x, y, z) => N(G.cyl(rt, rb, h, seg), c, x, y, z);
  const sph = (r, c, x, y, z) => N(G.sphere(r, 7, 5), c, x, y, z);
  const rng = seed => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
  const yawTo = (dx, dz) => Math.atan2(-dz, dx);          // Figuren schauen entlang +X
  const LOOKS = ['#e63946', '#3a86ff', '#2a9d8f', '#f4a261', '#8338ec', '#ffd23f', '#06d6a0', '#ff006e'];
  const HAIRS = ['short', 'long', 'curly', 'bob', 'ponytail', 'spiky'], HC = ['#3b2a1e', '#6b4423', '#d9b45a', '#1d1a17', '#8a3b1f'], SK = ['#f6d3b3', '#e8b48f', '#c98e62', '#9a6440'];
  const look = R => ({ suit: LOOKS[Math.floor(R() * 8)], suit2: '#ffffff', pattern: ['solid', 'racing', 'checker'][Math.floor(R() * 3)], hat: R() < .7 ? 'none' : 'cap', glasses: 'none',
    hair: HAIRS[Math.floor(R() * 6)], hairColor: HC[Math.floor(R() * 5)], skin: SK[Math.floor(R() * 4)], pants: R() < .5 ? '#2d3a55' : '#3b3b3b' });

  // ---- Planung: freie Plätze suchen (vor dem Baumpflanzen) ----
  Fo.prototype.planScenes = function (P) {
    const PD = this.pond, MS = this.massif, F = this.farm, CS = this.crowdSpots, A = this.arena;
    const free = (x, z, r, np) => !(!np && PD && Math.hypot(x - PD.x, z - PD.z) < PD.r + r + 2) && !(MS && Math.hypot(x - MS.x, z - MS.z) < MS.R + r + 2)
      && !(F && Math.hypot(x - F.x, z - F.z) < 17 + r) && !CS.some(c => Math.hypot(c.x - x, c.z - z) < r + 6) && !(A && A.members.some(m => Math.hypot(m.x - x, m.z - z) < r + 4));
    // Bach: läuft als Überlauf AUS dem Teich und fliesst nur bergab (Wasserspiegel sinkt stetig)
    this.stream = null;
    const H = this.height;
    if (PD && H) { let best = null;
      for (let a = 0; a < PI * 2; a += PI / 48) for (const L of [22, 26, 30, 34]) {
        const sx = PD.x + Math.cos(a) * (PD.r - .4), sz = PD.z + Math.sin(a) * (PD.r - .4), ex = PD.x + Math.cos(a) * (PD.r + L), ez = PD.z + Math.sin(a) * (PD.r + L);
        const pts = [], wl = [], n = Math.ceil(L / .9), px = -Math.sin(a), pz = Math.cos(a); let ok = true, rise = 0, w = 0;
        for (let i = 0; i <= n; i++) { const f = i / n, mw = Math.sin(f * PI * 2.3) * 1.6 * Math.sin(f * PI), x = sx + (ex - sx) * f + px * mw, z = sz + (ez - sz) * f + pz * mw, h = H(x, z);
          const d = P.dist(x, z); if (d < 7.5 || !free(x, z, 1.2, true)) { ok = false; break; }
          pts.push([x, h, z]); }
        if (!ok) continue;
        // Überlauf auf der Uferkante (erste 15 %), danach sinkt der Wasserspiegel nur noch
        // Wasserspiegel: am Ufer auf Teichhöhe, danach nur noch sinkend; wo das Gelände höher ist, gräbt der Bach sein Bett
        const k0 = Math.max(1, Math.round(n * .12)), wTop = PD.y - .02, wEnd = Math.min(pts[n][1] + .08, wTop - 1.1);
        let carve = 0, carveMax = 0;
        for (let i = 0; i <= n; i++) { const f = i <= k0 ? 0 : (i - k0) / (n - k0), lin = wTop + (wEnd - wTop) * f;
          w = i ? Math.min(w, lin, pts[i][1] + .08) : wTop; wl.push(w);   // nie höher als vorher, folgt Senken, sinkt mindestens linear
          const c = Math.max(0, pts[i][1] + .08 - w); carve += c; carveMax = Math.max(carveMax, c); }
        rise = carveMax; if (carveMax > 2.4) continue;
        const drop = wl[0] - wl[wl.length - 1], mi = Math.round(n * .5), mid = pts[mi], mp = P.dist(mid[0], mid[2]);
        if (drop < .8 || mp < 11 || !free(mid[0], mid[2], 5)) continue;
        const sc = Math.abs(mp - 14) - drop * .6 + Math.abs(L - 28) * .1 + carve * .08 + carveMax * 1.5; if (!best || sc < best.sc) best = { pts, wl, sc, mi }; }
      if (best) { const i = best.mi, a0 = best.pts[i], a1 = best.pts[i + 1], dx = a1[0] - a0[0], dz = a1[2] - a0[2], l = Math.hypot(dx, dz) || 1;
        best.millAt = [a0[0] - dz / l * 3.4, a0[2] + dx / l * 3.4]; }
      this.stream = best; }
    // Spielwiese: Dart-Ecke und Pingpong-Tisch auf einer Lichtung
    this.games = null; { let best = null;
      for (let x = -56; x <= 56; x += 2) for (let z = -70; z <= 40; z += 2) { const d = P.dist(x, z); if (d < 13 || d > 19 || !free(x, z, 8)) continue;
        if (this.stream && this.stream.pts.some(p => Math.hypot(p[0] - x, p[2] - z) < 11)) continue;
        const sc = Math.hypot(x * .8, z + 10); if (!best || sc < best.sc) best = { x, z, sc }; }
      if (best) { let bt = 0, bd = 1e9; for (let i = 0; i <= 300; i++) { const q = P.at(i / 300), dd = Math.hypot(q.p[0] - best.x, q.p[2] - best.z); if (dd < bd) { bd = dd; bt = i / 300; } }
        const q = P.at(bt), V = [(q.p[0] - best.x) / bd, (q.p[2] - best.z) / bd], U = [V[1], -V[0]];
        this.games = { x: best.x, z: best.z, U, V, w: (u, v) => [best.x + U[0] * u + V[0] * v, best.z + U[1] * u + V[1] * v] }; } }
  };
  // Bachbett: senkt das Gelände entlang des Bachs bis unter den Wasserspiegel (nur nach unten, weicher Übergang)
  Fo.prototype.streamCarve = function (x, z, h) {
    const S = this.stream; if (!S) return h;
    if (!S.bb) { let a = [1e9, 1e9, -1e9, -1e9]; for (const p of S.pts) a = [Math.min(a[0], p[0]), Math.min(a[1], p[2]), Math.max(a[2], p[0]), Math.max(a[3], p[2])]; S.bb = [a[0] - 8, a[1] - 8, a[2] + 8, a[3] + 8]; }
    if (x < S.bb[0] || z < S.bb[1] || x > S.bb[2] || z > S.bb[3]) return h;
    let bd = 1e9, bw = 0; const P = S.pts;
    for (let i = 0; i < P.length - 1; i++) { const a = P[i], b = P[i + 1], ux = b[0] - a[0], uz = b[2] - a[2], L2 = ux * ux + uz * uz || 1, t = Math.max(0, Math.min(1, ((x - a[0]) * ux + (z - a[2]) * uz) / L2));
      const d = Math.hypot(x - a[0] - ux * t, z - a[2] - uz * t); if (d < bd) { bd = d; bw = S.wl[i] + (S.wl[i + 1] - S.wl[i]) * t; } }
    if (bd > 7) return h;
    const bed = bw - .14, k = bd < 2 ? 0 : (bd - 2) / 5, s = k * k * (3 - 2 * k);
    return Math.min(h, bed + (h - bed) * s + (bd < 2 ? 0 : 0));
  };
  Fo.prototype.sceneReserved = function (x, z, r) {
    if (this.stream && this.stream.pts.some(p => Math.hypot(p[0] - x, p[2] - z) < r + 2.6)) return true;
    if (this.stream) { const m = this.stream.millAt; if (m && Math.hypot(m[0] - x, m[1] - z) < r + 9) return true; }
    return !!this.games && Math.hypot(this.games.x - x, this.games.z - z) < r + 8.5;
  };

  // ---- Bauen ----
  Fo.prototype.buildScenes = function (deco, height) {
    const W = this.season === 'winter', R = rng(4242); this.sceneDyn = []; this.sceneActors = [];
    const S = this.stream;
    if (S) {
      const pts = S.pts, WL = S.wl, water = W ? '#cfe6f2' : '#3f93b8';
      // Wasserband dem Gelände entlang, Ufer mit Kies und Steinen
      deco.add(new Node(G.custom(B => { for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], dx = b[0] - a[0], dz = b[2] - a[2], l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l;
        const w0 = .55 + i / pts.length * .45, w1 = .55 + (i + 1) / pts.length * .45, P2 = (p, w, e) => [p[0] + nx * w, (p === a ? WL[i] : WL[i + 1]) - .1 + e * 0, p[2] + nz * w];
        B.tri(P2(a, -w0 - .5, .03), P2(b, -w1 - .5, .03), P2(b, w1 + .5, .03)); B.tri(P2(a, -w0 - .5, .03), P2(b, w1 + .5, .03), P2(a, w0 + .5, .03)); } }), W ? '#e4ebef' : '#8f8466'));
      const wn = new Node(G.custom(B => { for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], dx = b[0] - a[0], dz = b[2] - a[2], l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l;
        const w0 = .55 + i / pts.length * .45, w1 = .55 + (i + 1) / pts.length * .45, P2 = (p, w, y) => [p[0] + nx * w, y, p[2] + nz * w];
        B.tri(P2(a, -w0, WL[i]), P2(b, -w1, WL[i + 1]), P2(b, w1, WL[i + 1])); B.tri(P2(a, -w0, WL[i]), P2(b, w1, WL[i + 1]), P2(a, w0, WL[i])); } }), water, { emis: W ? .05 : .18 });
      deco.add(wn);
      for (let i = 0; i < pts.length; i += 1) { if (R() < .35) continue; const a = pts[i], b = pts[Math.min(i + 1, pts.length - 1)], dx = b[0] - a[0], dz = b[2] - a[2], l = Math.hypot(dx, dz) || 1, sd = R() < .5 ? -1 : 1, w = .62 + i / pts.length * .45 + R() * .25;
        const x = a[0] - dz / l * w * sd, z = a[2] + dx / l * w * sd, r = .12 + R() * .2, gy = Math.max(height(x, z), WL[i] - .05); deco.add(N(G.sphere(r, 6, 4), W ? '#eef2f5' : ['#8d8a84', '#a5a29b', '#77736c'][i % 3], x, gy + r * .4, z).scale(1.3, .7, 1));
        if (!W && R() < .25) for (let k = 0; k < 4; k++) deco.add(N(G.cyl(.012, .02, .7 + R() * .4, 4), '#6e8a3a', x + (R() - .5) * .3, gy + .35, z + (R() - .5) * .3));
        this.addObs(a[0], a[2], .9); }
      // Überlauf am Teich: zwei Steinreihen fassen den Abfluss, am Ende versickert der Bach im Schilf
      { const a = pts[2], b = pts[3], dx = b[0] - a[0], dz = b[2] - a[2], l = Math.hypot(dx, dz) || 1;
        for (const sd of [-1, 1]) for (let k = 0; k < 3; k++) { const r = .32 + R() * .15, o = 1.05 + k * .05; { const sx2 = a[0] - dz / l * o * sd + dx / l * (k - 1) * .7, sz2 = a[2] + dx / l * o * sd + dz / l * (k - 1) * .7; deco.add(N(G.sphere(r, 7, 5), W ? '#e8eef2' : '#8a8780', sx2, Math.max(height(sx2, sz2), WL[2] - .1) + r * .5, sz2).scale(1.2, .8, 1)); } }
        deco.add(N(G.box(2.4, .16, .3), W ? '#e8eef2' : '#7d7a73', a[0], WL[2] - .04, a[2]).rotate(0, Math.atan2(-dz, dx) + PI / 2, 0)); }
      { const e = pts[pts.length - 1].slice(); e[1] = WL[WL.length - 1]; deco.add(N(G.cyl(1.6, 1.6, .02, 14), water, e[0], WL[WL.length - 1] + .01, e[2], { emis: W ? .05 : .18 }));
        if (!W) for (let k = 0; k < 16; k++) { const ang = R() * PI * 2, rr = 1.3 + R() * .6; deco.add(N(G.cyl(.012, .02, .8 + R() * .5, 4), '#6e8a3a', e[0] + Math.cos(ang) * rr, e[1] + .4, e[2] + Math.sin(ang) * rr)); }
        for (let k = 0; k < 6; k++) { const ang = k * 1.05, r = .25 + R() * .2; deco.add(N(G.sphere(r, 6, 4), W ? '#eef2f5' : '#8d8a84', e[0] + Math.cos(ang) * 1.7, e[1] + r * .4, e[2] + Math.sin(ang) * 1.7).scale(1.3, .7, 1)); } }
      // Wassermühle am Bach
      const mi = S.mi, m0 = pts[mi], m1 = pts[mi + 1], dx = m1[0] - m0[0], dz = m1[2] - m0[2], l = Math.hypot(dx, dz) || 1, tx = dx / l, tz = dz / l, nx = -tz, nz = tx;
      const hx = m0[0] + nx * 3.4, hz = m0[2] + nz * 3.4, hy = Math.max(WL[mi] + .25, Math.min(height(hx, hz), WL[mi] + .9)), house = new Node().at(hx, hy, hz); house.rot = [0, Math.atan2(-tz, tx), 0];
      S.mill = [hx, hz];
      house.add(box(4.4, 2.5, 3.6, '#9a958c', 0, -.75, 0), box(4.2, 2.6, 3.4, '#efe7d6', 0, 1.75, 0), box(4.24, .12, 3.44, '#7a4622', 0, 3.0, 0));
      for (const xx of [-2.05, 2.05]) for (const zz of [-1.65, 1.65]) house.add(box(.16, 2.6, .16, '#6b4426', xx, 1.75, zz));
      house.add(box(4.2, .14, .06, '#6b4426', 0, 1.9, 1.71), box(4.2, .14, .06, '#6b4426', 0, 1.9, -1.71));
      const roof = G.custom(B => { const a = 2.7, b = 2.4, y0 = 3.0, y1 = 4.9; for (const sx of [-1, 1]) { const q = [[sx * 0 + 0, y1, -a], [0, y1, a], [0, y0, a], [0, y0, -a]];
        const p = [[0, y1, -a], [0, y1, a], [sx * b, y0, a], [sx * b, y0, -a]]; const c = [0, y0 - 3, 0];
        const fc = (pp, inside) => { const u = [pp[1][0] - pp[0][0], pp[1][1] - pp[0][1], pp[1][2] - pp[0][2]], v = [pp[2][0] - pp[0][0], pp[2][1] - pp[0][1], pp[2][2] - pp[0][2]], n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], m = [(pp[0][0] + pp[2][0]) / 2 - inside[0], (pp[0][1] + pp[2][1]) / 2 - inside[1], (pp[0][2] + pp[2][2]) / 2 - inside[2]];
          const fl = n[0] * m[0] + n[1] * m[1] + n[2] * m[2] < 0; for (let i = 1; i < pp.length - 1; i++) fl ? B.tri(pp[0], pp[i + 1], pp[i]) : B.tri(pp[0], pp[i], pp[i + 1]); };
        fc(p, c); fc(p.map(v => [v[0], v[1] - .12, v[2]]), [0, y1 + 9, 0]); } });
      house.add(N(roof, W ? '#f4f7fb' : '#8a4b32').rotate(0, PI / 2, 0));
      for (const xx of [-2.1, 2.1]) house.add(N(G.custom(B => { const t = [[xx, 3.0, -1.7], [xx, 3.0, 1.7], [xx, 4.55, 0]]; B.tri(...t); B.tri(t[0], t[2], t[1]); }), '#efe7d6'),
        box(.06, .5, .5, '#2a3d52', xx * 1.003, 3.55, 0));
      house.add(box(.9, 1.7, .06, '#6b4426', -.9, 1.35, 1.72), box(.7, .7, .06, '#2a3d52', 1.0, 2.0, 1.72), box(.7, .7, .06, '#2a3d52', 1.0, 2.0, -1.72), box(.5, 1.6, .5, '#bdb6aa', 1.3, 5.1, -.4));
      house.add(box(.26, .26, 1.0, '#7a5532', 0, WL[mi] + .85 - hy, -2.2));   // Achse zum Rad
      deco.add(house); this.addObs(hx, hz, 2.9);
      { const key = Math.floor(hx / 6) + ',' + Math.floor(hz / 6); let l2 = this.trees.get(key); if (!l2) this.trees.set(key, l2 = []); l2.push([hx, hz, 3.1, hy + 5.2]); }
      // Wasserrad (dreht sich) und Holzkanal
      const wx = m0[0] + nx * .75, wz = m0[2] + nz * .75, wheel = new Node().at(wx, WL[mi] + .85, wz), spin = new Node(null, null, { name: 'spin' }); wheel.rot = [0, Math.atan2(-tz, tx), 0];
      const rim = '#6b4426';
      spin.add(N(G.torus(1.25, .07, 22, 5), rim, 0, 0, .32), N(G.torus(1.25, .07, 22, 5), rim, 0, 0, -.32), N(G.cyl(.16, .16, .8, 8), '#4a3020').rotate(PI / 2, 0, 0));
      for (let k = 0; k < 12; k++) { const a = k / 12 * PI * 2; spin.add(N(G.box(.42, .06, .7), '#8a6a42', Math.cos(a) * 1.2, Math.sin(a) * 1.2, 0).rotate(0, 0, a), N(G.box(1.2, .05, .05), rim, Math.cos(a) * .6, Math.sin(a) * .6, .3).rotate(0, 0, a), N(G.box(1.2, .05, .05), rim, Math.cos(a) * .6, Math.sin(a) * .6, -.3).rotate(0, 0, a)); }
      const sp = merge(spin); sp.name = 'spin'; const spinWrap = new Node(); spinWrap.add(sp); wheel.add(spinWrap); wheel.spin = spinWrap;
      wheel.add(box(.12, 1.4, .12, '#5a3a22', 0, -.7, .48), box(.12, 1.4, .12, '#5a3a22', 0, -.7, -.48));
      this.sceneDyn.push(wheel); this.millWheel = wheel;
      // Strömung: kleine Schaumflocken treiben bachabwärts
      const foam = new Node(); foam.items = [];
      for (let k = 0; k < 34; k++) { const f = N(G.box(.18, .02, .1), '#ffffff', 0, 0, 0, { emis: .4 }); f.fs = R() * (pts.length - 1); f.fo = (R() - .5) * .8; foam.add(f); foam.items.push(f); }
      foam.pts = pts.map((p, i) => [p[0], WL[i] - .08, p[2]]); this.sceneDyn.push(foam); this.foam = foam;
    }
    const Gm = this.games;
    if (Gm) {
      const base = height(Gm.x, Gm.z), at = (u, v, y = 0) => { const p = Gm.w(u, v); return [p[0], height(p[0], p[1]) + y, p[1]]; };
      const frame = (u, v, ang) => { const n = new Node(), p = at(u, v); n.pos = p; n.rot = [0, Math.atan2(Gm.V[0], Gm.V[1]) + (ang || 0), 0]; return n; };
      // Pingpong-Tisch (Länge entlang u)
      const tb = frame(-4, 0); tb.add(box(2.74, .05, 1.525, '#1f5f8b', 0, .76, 0), box(2.74, .052, .02, '#ffffff', 0, .76, 0), box(.02, .052, 1.525, '#ffffff', 0, .76, 0),
        box(.02, .16, 1.7, '#e8e8e8', 0, .86, 0), box(.02, .15, 1.65, '#2b2b2b', 0, .86, 0, { alpha: .5 }));
      for (const [xx, zz] of [[-1.2, -.6], [1.2, -.6], [-1.2, .6], [1.2, .6]]) tb.add(box(.05, .74, .05, '#3a3a3a', xx, .37, zz));
      deco.add(tb); { const p = at(-4, 0); this.addObs(p[0], p[2], 1.6); }
      // Dartscheibe auf Ständer, Bank und Kreidetafel
      const db = frame(4.5, -3.2); db.add(box(.12, 2.4, .12, '#5a3a22', 0, 1.2, -.12), box(.95, .95, .06, '#3b2a1e', 0, 1.73, -.06), box(1.05, .06, .1, '#5a3a22', 0, 2.22, -.04), box(1.05, .06, .1, '#5a3a22', 0, 1.24, -.04));
      const rings = [['#1b1b1b', .23], ['#e9dfc6', .2], ['#c1121f', .155], ['#e9dfc6', .145], ['#1b1b1b', .1], ['#1f7a3a', .09], ['#c1121f', .025]];
      rings.forEach(([c, r], i) => db.add(N(G.cyl(r * 1.6, r * 1.6, .03 + i * .006, 28), c, 0, 1.73, .01 + i * .006).rotate(PI / 2, 0, 0)));
      for (let k = 0; k < 10; k++) db.add(N(G.box(.004, .62, .004), '#6e6e6e', 0, 1.73, .06).rotate(0, 0, k / 10 * PI));
      deco.add(db); { const p = at(4.5, -3.2); this.addObs(p[0], p[2], .7); }
      const bench = frame(1.2, -1.6, PI / 2); bench.add(box(1.8, .08, .42, '#9a7448', 0, .46, 0), box(.08, .46, .4, '#5a4030', -.8, .23, 0), box(.08, .46, .4, '#5a4030', .8, .23, 0)); deco.add(bench);
      const chalk = frame(6.3, -2.6, -.5); chalk.add(box(.06, 1.4, .06, '#5a3a22', 0, .7, -.35), box(.06, 1.4, .06, '#5a3a22', 0, .7, .35), box(.04, .7, .8, '#22302a', 0, 1.15, 0), box(.045, .05, .6, '#f4f4f4', 0, 1.3, .05), box(.045, .05, .4, '#f4f4f4', 0, 1.15, -.05), box(.045, .05, .5, '#f4f4f4', 0, 1.0, 0)); deco.add(chalk);
      const RR = rng(77);
      // Pingpong-Spieler an beiden Tischenden
      const pp = [-1, 1].map(sd => { const pos = at(-4 + sd * 2.1, sd * .1), tgt = at(-4, 0), n = Models.person(look(RR), 'paddle'); n.scl = [1.25, 1.25, 1.25];
        n.pos = pos; n.rot = [0, yawTo(tgt[0] - pos[0], tgt[2] - pos[2]), 0]; n.cull = 2.5; this.sceneActors.push({ node: n, name: 'Pingpong-Spieler·in', kind: 'pp', sd }); return n; });
      const ball = N(G.sphere(.05, 8, 6), '#fff8e8', 0, 0, 0, { emis: .5 }); this.sceneDyn.push(ball);
      this.pingpong = { a: at(-4 - 1.55, 0, 1.0), b: at(-4 + 1.55, 0, 1.0), table: at(-4, 0)[1], ball, players: pp, t: 0, dir: 1, rally: 0, pause: 0 };
      // Dartspieler·innen am Abwurf (2,37 m vor der Scheibe), eine Person schaut zu
      const board = at(4.5, -3.2 + .06, 1.73 * 1);
      const darters = [-.45, .45].map((du, i) => { const pos = at(4.5 + du, -3.2 + 2.37 + .3), n = Models.person(look(RR), 'dart'); n.scl = [1.22, 1.22, 1.22];
        n.pos = pos; n.rot = [0, yawTo(board[0] - pos[0], board[2] - pos[2]), 0]; n.cull = 2.5; this.sceneActors.push({ node: n, name: 'Dartspieler·in', kind: 'dart' }); return n; });
      { const pos = at(1.95, -1.6, 0), n = Models.person(look(RR), 'cheer');   /* steht vor der Bank */ n.scl = [1.2, 1.2, 1.2]; n.pos = [pos[0], pos[1], pos[2]]; n.rot = [0, yawTo(board[0] - pos[0], board[2] - pos[2]), 0]; n.cull = 2.5;
        this.sceneActors.push({ node: n, name: 'Zuschauer·in', kind: 'fan' }); }
      const darts = new Node(); this.sceneDyn.push(darts);
      this.dart = { board, players: darters, darts, turn: 0, n: 0, t: 0, phase: 'aim', fly: null, cols: ['#ffd23f', '#3a86ff'] };
      // Spieler·innen, Bank und Tafel als Hindernisse (Tiere laufen nicht hindurch)
      for (const a of this.sceneActors) this.addObs(a.node.pos[0], a.node.pos[2], .5);
      for (const v of [-2.4, -1.6, -.8]) { const b = at(1.2, v); this.addObs(b[0], b[2], .45); }
      { const c = at(6.3, -2.6); this.addObs(c[0], c[2], .55); }
    }
  };

  // ---- Bewegung ----
  Fo.prototype.updateScenes = function (t, dt) {
    if (this.millWheel) this.millWheel.spin.rot = [0, 0, t * .9];   // unterschlächtig: unten dreht das Rad mit dem Wasser
    if (this.foam) { const P = this.foam.pts, L = P.length - 1;
      for (const f of this.foam.items) { f.fs = (((f.fs + (dt > 0 ? dt : 0) * 1.6) % L) + L) % L; if (!(f.fs >= 0)) f.fs = 0; const i = Math.floor(f.fs), k = f.fs - i, a = P[i], b = P[Math.min(i + 1, L)], dx = b[0] - a[0], dz = b[2] - a[2], l = Math.hypot(dx, dz) || 1;
        f.pos = [a[0] + dx * k - dz / l * f.fo, a[1] + (b[1] - a[1]) * k + .1, a[2] + dz * k + dx / l * f.fo]; f.rot = [0, Math.atan2(-dz, dx), 0]; } }
    for (const a of this.sceneActors || []) { const A = a.node.anim; Models.animatePerson(a.node, t, 0, a.kind === 'fan' ? (this.dart && this.dart.cheer > 0 ? 1 : 0) : 0, 0); }
    const pp = this.pingpong;
    if (pp) {
      if (pp.pause > 0) { pp.pause -= dt; pp.ball.visible = pp.pause < 1.2; }
      else { pp.t += dt / .85; pp.ball.visible = true;
        if (pp.t >= 1) { pp.t = 0; pp.dir *= -1; pp.rally++; if (pp.rally > 6 + Math.floor(Math.random() * 10)) { pp.rally = 0; pp.pause = 2; } } }
      const from = pp.dir > 0 ? pp.a : pp.b, to = pp.dir > 0 ? pp.b : pp.a, k = pp.t;
      // Flugbahn: Aufsetzer auf der Gegenseite bei 70 %
      const tbl = pp.table + .835,   // Tischplatte (0,785 m) + Ballradius
      y = k < .7 ? from[1] + (tbl - from[1]) * (k / .7) + Math.sin(k / .7 * PI) * .32 : tbl + Math.sin((k - .7) / .3 * PI) * .3 + (to[1] - tbl) * ((k - .7) / .3);
      pp.ball.pos = [from[0] + (to[0] - from[0]) * k, y, from[2] + (to[2] - from[2]) * k];
      pp.players.forEach((n, i) => { const hitter = (i === 0) === (pp.dir < 0), near = hitter ? Math.max(0, 1 - pp.t / .2) : Math.max(0, (pp.t - .75) / .25);
        n.anim.thr.rot = [0, (hitter ? -1 : 1) * near * .9, -near * .3]; });
    }
    const D = this.dart;
    if (D) { D.t += dt; D.cheer = Math.max(0, (D.cheer || 0) - dt);
      const pl = D.players[D.turn], thr = pl.anim.thr;
      if (D.phase === 'aim') { thr.rot = [0, 0, Math.min(1, D.t / .6) * .55]; if (D.t > .9) { D.phase = 'throw'; D.t = 0; } }
      else if (D.phase === 'throw') { thr.rot = [0, 0, .55 - Math.min(1, D.t / .12) * 1.3];
        if (!D.fly && D.t > .08) { const s = pl.pos, f = [s[0], s[1] + 1.95, s[2]], ang = Math.random() * PI * 2, r = Math.random() ** 1.4 * .2;
          const b = D.board, q = this.games, end = [b[0] + q.U[0] * Math.cos(ang) * r, b[1] + Math.sin(ang) * r, b[2] + q.U[1] * Math.cos(ang) * r];
          const n = new Node(G.box(.16, .016, .016), D.cols[D.turn]); D.darts.add(n); D.fly = { n, f, end, k: 0, bull: r < .045 }; }
        if (D.t > .5) { D.phase = 'rest'; D.t = 0; } }
      else if (D.phase === 'rest') { thr.rot = [0, 0, -.75 + Math.min(1, D.t / .5) * .75]; if (D.t > 1.1) { D.n++; D.phase = 'aim'; D.t = 0; if (D.n % 3 === 0) { D.turn = 1 - D.turn; if (D.n % 6 === 0) { D.phase = 'collect'; } } } }
      else if (D.phase === 'collect') { if (D.t > 1.6) { D.darts.children.length = 0; D.phase = 'aim'; D.t = 0; } }
      if (D.fly) { const F = D.fly; F.k = Math.min(1, F.k + dt / .38); const k = F.k;
        F.n.pos = [F.f[0] + (F.end[0] - F.f[0]) * k, F.f[1] + (F.end[1] - F.f[1]) * k + Math.sin(k * PI) * .25, F.f[2] + (F.end[2] - F.f[2]) * k];
        F.n.rot = [0, Math.atan2(-(F.end[2] - F.f[2]), F.end[0] - F.f[0]), (.5 - k) * .5];
        if (k >= 1) { if (F.bull) D.cheer = 1.5; D.fly = null; } }
    }
  };
})();
