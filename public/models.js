// Grand Prix Ambition – 3D-Fahrzeuge und Fahrer (Low-Poly, eigene Modelle)
// Lokales System: vorwärts = +X, oben = +Y, Boden y = 0, Länge ≈ 2.4
(function () {
  'use strict';
  const { G, Node, merge } = window.Mini3D;

  const VEHICLES = [
    { key: 'rocket', name: 'Raketenauto', emoji: '🚀' },
    { key: 'snail', name: 'Turboschnecke', emoji: '🐌' },
    { key: 'turtle', name: 'Düsenschildkröte', emoji: '🐢' },
    { key: 'cow', name: 'Rennkuh', emoji: '🐄' },
    { key: 'tub', name: 'Badewannen-Flitzer', emoji: '🛁' },
    { key: 'cheese', name: 'Käse-Mobil', emoji: '🧀' },
    { key: 'mower', name: 'Rasenmäher-Rakete', emoji: '🌱' },
    { key: 'banana', name: 'Bananen-Kart', emoji: '🍌' },
    { key: 'cart', name: 'Einkaufswagen-Jet', emoji: '🛒' },
    { key: 'unicorn', name: 'Turbo-Einhorn', emoji: '🦄' }
  ];
  const HATS = [
    { key: 'none', name: 'Frisur' }, { key: 'helmet', name: 'Helm' }, { key: 'cap', name: 'Cap' }, { key: 'crown', name: 'Krone' },
    { key: 'tophat', name: 'Zylinder' }, { key: 'party', name: 'Partyhut' }, { key: 'viking', name: 'Wikinger' }, { key: 'santa', name: 'Samichlaus' },
    { key: 'antlers', name: 'Rentiergeweih', reward: .25 }
  ];
  const GLASSES = [{ key: 'none', name: 'Ohne' }, { key: 'sun', name: 'Sonnenbrille' }, { key: 'ski', name: 'Skibrille' }];
  const PALETTE = ['#e63946', '#f4a261', '#ffd23f', '#2a9d8f', '#3a86ff', '#8338ec', '#ff006e', '#06d6a0', '#1d3557', '#f1f1f1'];
  const SKINS = ['#f6d3b3', '#e8b48f', '#c98e62', '#9a6440', '#6b4126'];
  const HAIRS = [{ key: 'short', name: 'Kurz' }, { key: 'bob', name: 'Bob' }, { key: 'long', name: 'Lang' }, { key: 'curly', name: 'Lange Locken' }, { key: 'ponytail', name: 'Pferdeschwanz' },
    { key: 'bun', name: 'Dutt' }, { key: 'afro', name: 'Afro' }, { key: 'spiky', name: 'Stachelig' }, { key: 'bald', name: 'Glatze' }];
  const HAIR_COLORS = ['#1d1a17', '#3b2a1e', '#6b4423', '#8a3b1f', '#c0461b', '#d9b45a', '#ece0b8', '#9a9a9a', '#ff6fae', '#4ea8de'];
  const PATTERNS = [{ key: 'solid', name: 'Uni' }, { key: 'racing', name: 'Rennstreifen' }, { key: 'rings', name: 'Ringel' }, { key: 'checker', name: 'Zielflagge' }, { key: 'number', name: 'Brustnummer' }, { key: 'flames', name: 'Flammen' }, { key: 'gold', name: 'Goldanzug', reward: .5 }];
  // Belohnungen bei 25 / 50 / 75 / 100 % des Ambitionsniveaus
  const REWARDS = [
    { at: .25, key: 'antlers', name: 'Rentiergeweih', emoji: '🦌', where: 'Kopfbedeckung', has: l => l.hat === 'antlers', apply: l => ({ ...l, hat: 'antlers' }) },
    { at: .5, key: 'gold', name: 'Goldanzug', emoji: '✨', where: 'Rennanzug', has: l => l.pattern === 'gold', apply: l => ({ ...l, pattern: 'gold' }) },
    { at: .75, key: 'flag', name: 'Siegerwimpel', emoji: '🎏', where: 'Fahrzeug', has: l => !!l.flag, apply: l => ({ ...l, flag: true }) },
    { at: 1, key: 'goldPaint', name: 'Goldlack mit Glitzer', emoji: '🏆', where: 'Lackieren', has: l => !!l.goldPaint, apply: l => ({ ...l, goldPaint: true }) }
  ];
  const GOLD = '#e0ac1c';
  const DEFAULT = { vehicle: 'rocket', color: '#e63946', suit: '#3a86ff', suit2: '#ffffff', pattern: 'racing', skin: '#f6d3b3', hat: 'helmet', glasses: 'none', hair: 'short', hairColor: '#3b2a1e', initials: '' };

  const shade = (hex, f) => { const n = parseInt(hex.slice(1), 16); const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.max(0, Math.min(255, Math.round(v * f))));
    return '#' + c.map(v => v.toString(16).padStart(2, '0')).join(''); };
  const PI = Math.PI;
  const DARK = '#24262b', CHROME = '#c3cad2', TIRE = '#1c1d20';

  // kleine Helfer: Teil erzeugen und platzieren
  const part = (geo, col, x, y, z, opt) => new Node(geo, col, opt).at(x, y, z);
  const B = (w, h, d, c, x, y, z) => part(G.box(w, h, d), c, x, y, z);
  const S = (r, c, x, y, z) => part(G.sphere(r, 10, 7), c, x, y, z);

  // Zylinder von Punkt a nach Punkt b
  function rod(a, b, r, col) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.hypot(dx, dy, dz) || 1e-6;
    const tz = Math.acos(Math.max(-1, Math.min(1, dy / len))), sz = Math.sin(tz);
    const ty = sz > 1e-6 ? Math.atan2(dz / len, -dx / len) : 0;
    return part(G.cyl(r, r, len, 6), col, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2).rotate(0, ty, tz);
  }
  function wheel(r, w, rim, x, y, z) {
    const outer = new Node().at(x, y, z).rotate(PI / 2, 0, 0);
    const spin = new Node(null, null, { name: 'spin' });
    spin.add(merge(new Node().add(part(G.cyl(r, r, w, 14), TIRE, 0, 0, 0), part(G.cyl(r * .62, r * .62, w * 1.06, 10), rim, 0, 0, 0),
      part(G.box(r * 1.15, w * 1.12, r * .2), CHROME, 0, 0, 0), part(G.box(r * .2, w * 1.12, r * 1.15), CHROME, 0, 0, 0))));
    outer.add(spin); return outer;
  }
  // Flamme zeigt nach -X, Ursprung an der Düse
  function flame(x, y, z, size) {
    const f = new Node(null, null, { name: 'flame' }).at(x, y, z);
    f.add(part(G.cyl(0, .17 * size, .7 * size, 8), '#ff6b1a', -.35 * size, 0, 0, { emis: 1 }).rotate(0, 0, PI / 2),
      part(G.cyl(0, .1 * size, .45 * size, 8), '#ffe066', -.22 * size, 0, 0, { emis: 1 }).rotate(0, 0, PI / 2));
    return f;
  }
  function rocketTube(x, y, z, len, r, col) { // Rakete entlang X, Düse hinten
    const g = new Node();
    g.add(part(G.cyl(r, r, len, 12), col, x, y, z).rotate(0, 0, PI / 2), part(G.cyl(0, r, r * 2, 12), '#e63946', x + len / 2 + r, y, z).rotate(0, 0, -PI / 2),
      part(G.cyl(r * .8, r * 1.1, r * .8, 12), DARK, x - len / 2 - r * .3, y, z).rotate(0, 0, PI / 2));
    return g;
  }
  function leg(x, y, z, len, r, col, hoof, phase) {
    const L = new Node(null, null, { name: 'leg' }).at(x, y, z); L.phase = phase;
    const t = new Node().add(part(G.cyl(r, r * .85, len, 8), col, 0, -len / 2, 0));
    if (hoof) t.add(part(G.cyl(r * 1.05, r * 1.15, .1, 8), hoof, 0, -len + .03, 0));
    L.add(merge(t));
    return L;
  }

  // Hand mit Handfläche, vier Fingern und Daumen (side: +1 = linke Hand / -1 = rechte Hand)
  function hand(sk, x, y, z, side) {
    const h = new Node().at(x, y, z).rotate(0, 0, -.35).scale(1.35);
    h.add(part(G.box(.1, .045, .1), sk, 0, 0, 0));
    [-.036, -.012, .012, .036].forEach((fz, i) => {
      const len = i === 0 || i === 3 ? .06 : .07;
      h.add(part(G.cyl(.0145, .013, len, 5), sk, .05 + len / 2, -.004, fz).rotate(0, 0, -PI / 2),
        part(G.cyl(.013, .012, .04, 5), sk, .05 + len + .006, -.024, fz).rotate(0, 0, -.25));
    });
    h.add(part(G.cyl(.016, .014, .06, 5), sk, .03, .005, -side * .062).rotate(0, side * .8, -PI / 2));
    return h;
  }

  // Pixel-Schrift 5×7 für die Initialen-Schilder
  const FONT = {
    A:[' ### ','#   #','#   #','#####','#   #','#   #','#   #'], B:['#### ','#   #','#   #','#### ','#   #','#   #','#### '],
    C:[' ### ','#   #','#    ','#    ','#    ','#   #',' ### '], D:['#### ','#   #','#   #','#   #','#   #','#   #','#### '],
    E:['#####','#    ','#    ','#### ','#    ','#    ','#####'], F:['#####','#    ','#    ','#### ','#    ','#    ','#    '],
    G:[' ### ','#   #','#    ','# ###','#   #','#   #',' ####'], H:['#   #','#   #','#   #','#####','#   #','#   #','#   #'],
    I:[' ### ','  #  ','  #  ','  #  ','  #  ','  #  ',' ### '], J:['  ###','   # ','   # ','   # ','   # ','#  # ',' ##  '],
    K:['#   #','#  # ','# #  ','##   ','# #  ','#  # ','#   #'], L:['#    ','#    ','#    ','#    ','#    ','#    ','#####'],
    M:['#   #','## ##','# # #','# # #','#   #','#   #','#   #'], N:['#   #','##  #','# # #','#  ##','#   #','#   #','#   #'],
    O:[' ### ','#   #','#   #','#   #','#   #','#   #',' ### '], P:['#### ','#   #','#   #','#### ','#    ','#    ','#    '],
    Q:[' ### ','#   #','#   #','#   #','# # #','#  # ',' ## #'], R:['#### ','#   #','#   #','#### ','# #  ','#  # ','#   #'],
    S:[' ####','#    ','#    ',' ### ','    #','    #','#### '], T:['#####','  #  ','  #  ','  #  ','  #  ','  #  ','  #  '],
    U:['#   #','#   #','#   #','#   #','#   #','#   #',' ### '], V:['#   #','#   #','#   #','#   #','#   #',' # # ','  #  '],
    W:['#   #','#   #','#   #','# # #','# # #','# # #',' # # '], X:['#   #','#   #',' # # ','  #  ',' # # ','#   #','#   #'],
    Y:['#   #','#   #',' # # ','  #  ','  #  ','  #  ','  #  '], Z:['#####','    #','   # ','  #  ',' #   ','#    ','#####'],
    0:[' ### ','#   #','#  ##','# # #','##  #','#   #',' ### '], 1:['  #  ',' ##  ','  #  ','  #  ','  #  ','  #  ',' ### '],
    2:[' ### ','#   #','    #','   # ','  #  ',' #   ','#####'], 3:['#####','   # ','  #  ','   # ','    #','#   #',' ### '],
    4:['   # ','  ## ',' # # ','#  # ','#####','   # ','   # '], 5:['#####','#    ','#### ','    #','    #','#   #',' ### '],
    6:['  ## ',' #   ','#    ','#### ','#   #','#   #',' ### '], 7:['#####','    #','   # ','  #  ',' #   ',' #   ',' #   '],
    8:[' ### ','#   #','#   #',' ### ','#   #','#   #',' ### '], '!':['  #  ','  #  ','  #  ','  #  ','  #  ','     ','  #  '],
    '+':['     ','  #  ','  #  ','#####','  #  ','  #  ','     '], '%':['##   ','##  #','   # ','  #  ',' #   ','#  ##','   ##'], '♥':['     ',' # # ','#####','#####',' ### ','  #  ','     '], 9:[' ### ','#   #','#   #',' ####','    #','   # ',' ##  ']
  };
  // Schild in der XY-Ebene, Vorderseite zeigt nach +Z; px = Pixelgrösse
  function plate(text, px, frame, max) {
    const chars = [...(text || '?')].slice(0, max || 3), w = chars.length * 6 - 1, g = new Node();
    const W = (w + 2.4) * px, H = 9.4 * px;
    g.add(part(G.box(W + px * .6, H + px * .6, .02), frame, 0, 0, -.004), part(G.box(W, H, .03), '#fbfbf5', 0, 0, 0));
    chars.forEach((ch, ci) => {
      const base = { 'Ä': 'A', 'Ö': 'O', 'Ü': 'U' }[ch] || ch, glyph = FONT[base]; if (!glyph) return;
      const ox = -w / 2 * px + ci * 6 * px;
      glyph.forEach((row, ry) => [...row].forEach((c, rx) => { if (c === '#') g.add(part(G.box(px * .96, px * .96, .02), '#16181d', ox + (rx + .5) * px, (3 - ry) * px - px * .3, .022)); }));
      if (base !== ch) { g.add(part(G.box(px * .9, px * .9, .02), '#16181d', ox + 1.5 * px, 4.2 * px, .022), part(G.box(px * .9, px * .9, .02), '#16181d', ox + 3.5 * px, 4.2 * px, .022)); }
    });
    return g;
  }
  // Schilder links und rechts am Fahrzeug
  function plates(s, L, x, y, zh, px, tilt) {
    const t = L.initials || '?', f = L.suit;
    s.add(plate(t, px, f).at(x, y, zh + .012).rotate(-(tilt || 0), 0, 0), plate(t, px, f).at(x, y, -zh - .012).rotate(-(tilt || 0), PI, 0));
  }

  // ---------- Fahrer ----------
  // Rumpf im Rennanzug mit Muster (Höhe 0 … 0.5)
  function torsoNode(L) {
    const t = new Node(), s = L.suit, s2 = L.suit2 || '#ffffff', pat = L.pattern || 'racing';
    const R = y => .24 - .1 * y;
    t.add(part(G.cyl(.19, .24, .5, 12), s, 0, .25, 0));
    const ring = (y, h, col) => t.add(part(G.cyl(R(y + h / 2) + .007, R(y - h / 2) + .007, h, 12), col, 0, y, 0));
    if (pat !== 'solid') ring(.47, .05, s2);
    if (pat === 'racing') {
      for (const sd of [-1, 1]) t.add(part(G.box(.05, .5, .03), s2, 0, .25, sd * .2175).rotate(-sd * .1, 0, 0));
      t.add(part(G.box(.03, .5, .06), s2, .2175, .25, 0).rotate(0, 0, .1)); ring(.05, .05, '#1b1b1f');
    }
    if (pat === 'rings') [.36, .23, .1].forEach(y => ring(y, .06, s2));
    if (pat === 'checker') for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const y = .17 + i * .065, z = -.0975 + j * .065, r = R(y);
      t.add(part(G.box(.02, .065, .065), (i + j) % 2 ? '#111111' : '#ffffff', Math.sqrt(r * r - z * z) + .004, y, z).rotate(0, -Math.asin(z / r), 0));
    }
    if (pat === 'number') t.add(plate(L.initials || '?', .011, s2).at(R(.3) + .016, .3, 0).rotate(0, PI / 2, 0));
    if (pat === 'gold') { ring(.47, .05, '#fff3c4'); ring(.05, .05, '#9c6f00');
      for (let i = 0; i < 16; i++) { const a = i * 2.4, y = .1 + (i * .37 % 1) * .32, r = R(y) + .006; t.add(part(G.box(.035, .035, .035), i % 3 ? '#fff6d0' : '#ffffff', Math.cos(a) * r, y, Math.sin(a) * r).rotate(.6, a, .6)); } }
    if (pat === 'flames') for (let i = 0; i < 14; i++) { const a = i / 14 * PI * 2, h = i % 2 ? .22 : .15;
      t.add(part(G.cyl(0, .05, h, 4), i % 2 ? s2 : '#ff6b1a', Math.cos(a) * (R(h / 2) + .004), h / 2, Math.sin(a) * (R(h / 2) + .004))); }
    return t;
  }
  // Frisur; mode: full (ohne Hut) | hat (Hut sitzt oben) | covered (Mütze deckt Kopf) | helmet
  function hairParts(h, L, hy, mode) {
    const c = L.hairColor || '#3b2a1e', st = L.hair || 'short', top = mode === 'full';
    if (st === 'bald') return;
    const cap = () => h.add(part(G.dome(.215, 10, 4), c, -.025, hy + .02, 0).scale(1, .92, 1.03));
    const back = () => h.add(part(G.sphere(.215, 10, 7), c, -.06, hy - .01, 0).scale(.82, 1.02, 1.06));
    if (mode === 'full' || mode === 'hat') {
      if (st === 'afro' && top) h.add(part(G.sphere(.3, 10, 7), c, -.1, hy + .07, 0).scale(.82, 1, 1.12));
      else cap();
      if (st === 'spiky' && top) for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2;
        h.add(part(G.cyl(0, .05, .17, 4), c, -.03 + Math.cos(a) * .1, hy + .2, Math.sin(a) * .11).rotate(Math.sin(a) * .5, 0, -Math.cos(a) * .5)); }
      if (st === 'bun' && top) h.add(S(.105, c, -.1, hy + .2, 0));
    }
    if (st === 'afro' && !top) back();
    if (st === 'bob') { back(); h.add(part(G.box(.15, .16, .45), c, -.09, hy - .08, 0)); }
    if (st === 'long') { back(); h.add(part(G.box(.1, .44, .4), c, -.15, hy - .2, 0), part(G.box(.08, .34, .05), c, -.02, hy - .17, .2), part(G.box(.08, .34, .05), c, -.02, hy - .17, -.2)); }
    if (st === 'curly') { back();
      for (let j = 0; j < 6; j++) for (let i = 0; i < 9; i++) { const a = PI * .55 + i / 8 * PI * .9, r = .2 + j * .012;
        h.add(S(.072 - j * .003, shade(c, .9 + ((i + j) % 3) * .08), Math.cos(a) * r, hy + .06 - j * .085, Math.sin(a) * r * 1.1)); } }
    if (st === 'ponytail') { h.add(S(.035, L.suit2 || '#ff006e', -.2, hy + .06, 0));
      [[-.23, .03, .08], [-.28, -.06, .075], [-.3, -.16, .07], [-.3, -.26, .06], [-.28, -.34, .05]].forEach(p => h.add(S(p[2], c, p[0], hy + p[1], 0))); }
  }
  function headNode(L) {
    const h = new Node(), s = L.suit, sk = L.skin, hy = .68, hc = L.hairColor || '#3b2a1e';
    h.add(part(G.cyl(.075, .085, .12, 8), sk, 0, .52, 0));
    h.add(S(.2, sk, 0, hy, 0), S(.035, '#1b1b1b', .17, hy + .05, .08), S(.035, '#1b1b1b', .17, hy + .05, -.08), S(.045, sk, .2, hy - .01, 0),
      part(G.box(.02, .03, .1), '#7a2e2e', .19, hy - .08, 0), S(.045, sk, -.01, hy, .195), S(.045, sk, -.01, hy, -.195));
    if (L.hat !== 'helmet' && L.hair !== 'bald') h.add(part(G.box(.02, .022, .08), hc, .16, hy + .115, .08).rotate(.15, 0, 0), part(G.box(.02, .022, .08), hc, .16, hy + .115, -.08).rotate(-.15, 0, 0));
    hairParts(h, L, hy, L.hat === 'none' || L.hat === 'antlers' ? 'full' : L.hat === 'helmet' ? 'helmet' : ['cap', 'viking', 'santa'].includes(L.hat) ? 'covered' : 'hat');
    switch (L.hat) {
      case 'helmet':
        h.add(S(.245, s, 0, hy + .01, 0), part(G.box(.1, .13, .32), '#16202b', .18, hy + .02, 0), B(.5, .035, .06, L.suit2 || '#ffffff', -.01, hy + .245, 0)); break;
      case 'cap':
        h.add(part(G.dome(.218, 10, 4), s, 0, hy + .05, 0), B(.24, .03, .3, shade(s, .8), .2, hy + .07, 0), S(.035, L.suit2 || s, 0, hy + .27, 0)); break;
      case 'crown':
        h.add(part(G.cyl(.16, .16, .12, 8), '#ffc61a', 0, hy + .23, 0));
        for (let i = 0; i < 5; i++) { const a = i / 5 * PI * 2; h.add(part(G.cyl(0, .045, .12, 5), '#ffc61a', Math.cos(a) * .14, hy + .34, Math.sin(a) * .14)); }
        h.add(S(.035, '#e63946', .16, hy + .23, 0), S(.03, '#3a86ff', .08, hy + .23, .14), S(.03, '#06d6a0', .08, hy + .23, -.14)); break;
      case 'tophat':
        h.add(part(G.cyl(.3, .3, .03, 16), '#151518', 0, hy + .17, 0), part(G.cyl(.17, .17, .34, 16), '#151518', 0, hy + .35, 0), part(G.cyl(.175, .175, .07, 16), s, 0, hy + .22, 0)); break;
      case 'party':
        h.add(part(G.cyl(0, .14, .38, 10), s, 0, hy + .36, 0), part(G.cyl(.105, .12, .05, 10), '#ffffff', 0, hy + .27, 0), S(.06, '#ffd23f', 0, hy + .56, 0)); break;
      case 'viking':
        h.add(part(G.dome(.235, 10, 4), '#9aa4ad', 0, hy + .02, 0), part(G.cyl(.24, .24, .06, 12), '#6c757d', 0, hy + .03, 0),
          part(G.cyl(0, .06, .3, 6), '#f3e6c8', 0, hy + .22, .28).rotate(.95, 0, 0), part(G.cyl(0, .06, .3, 6), '#f3e6c8', 0, hy + .22, -.28).rotate(-.95, 0, 0)); break;
      case 'antlers': {
        const br = '#8a5a32';
        h.add(S(.062, '#e3122d', .215, hy - .01, 0));          // rote Rudolph-Nase
        for (const sd of [-1, 1]) {
          const b0 = [-.02, hy + .17, sd * .11], b1 = [-.06, hy + .38, sd * .2], b2 = [-.13, hy + .52, sd * .19];
          h.add(rod(b0, b1, .025, br), rod(b1, b2, .02, br), rod(b1, [.06, hy + .47, sd * .26], .017, br), rod([-.04, hy + .28, sd * .16], [-.15, hy + .36, sd * .25], .016, br),
            S(.024, br, b1[0], b1[1], b1[2]), part(G.box(.05, .1, .1), '#6b4426', -.01, hy + .14, sd * .2).rotate(sd * .5, 0, 0));
        } break; }
      case 'santa':
        h.add(part(G.cyl(.02, .2, .36, 10), '#d62828', -.07, hy + .3, 0).rotate(0, 0, .55), part(G.cyl(.218, .218, .07, 12), '#ffffff', 0, hy + .12, 0), S(.06, '#ffffff', -.24, hy + .42, 0)); break;
    }
    if (L.hat !== 'helmet') {
      if (L.glasses === 'sun') h.add(B(.06, .07, .3, '#111111', .18, hy + .05, 0), B(.04, .02, .42, '#111111', .05, hy + .07, 0));
      if (L.glasses === 'ski') h.add(part(G.cyl(.208, .208, .07, 12), '#222222', 0, hy + .05, 0), B(.07, .1, .32, '#ff9f1c', .18, hy + .05, 0));
    }
    return h;
  }
  function driver(L, grip, noHands) {
    grip = grip || [.37, .29, .19];
    const d = new Node(), s = L.suit, sk = L.skin, cuff = L.pattern && L.pattern !== 'solid' ? (L.suit2 || s) : s;
    d.add(torsoNode(L));
    // Arme mit Schulter, Ellbogen und Unterarm (natürliche, leicht angewinkelte Haltung)
    for (const sd of [-1, 1]) {
      const sh = [-.01, .41, sd * .215], hp = [grip[0], grip[1], sd * grip[2]];
      const dx = hp[0] - sh[0], dz = hp[2] - sh[2];
      const el = [sh[0] + dx * .38, Math.min(sh[1], hp[1]) - .1, sh[2] + dz * .25 + sd * .08];
      d.add(S(.068, s, sh[0], sh[1], sh[2]), rod(sh, el, .056, s), S(.054, s, el[0], el[1], el[2]), rod(el, hp, .048, s),
        part(G.cyl(.056, .056, .045, 8), cuff, el[0] + (hp[0] - el[0]) * .88, el[1] + (hp[1] - el[1]) * .88, el[2] + (hp[2] - el[2]) * .88).rotate(0, Math.atan2(-(hp[2] - el[2]), hp[0] - el[0]), -PI / 2 + Math.atan2(hp[1] - el[1], Math.hypot(hp[0] - el[0], hp[2] - el[2]))),
        noHands ? part(G.sphere(.05, 6, 4), sk, hp[0], hp[1], hp[2]) : hand(sk, hp[0], hp[1], hp[2], sd));
    }
    const h = new Node().at(0, -.5, 0); h.add(headNode(L));
    return { body: d, head: h };
  }
  // ---------- Menschen zu Fuss: Zuschauer (sign/cheer/wave), Wanderer (hiker), Stehend (stand) ----------
  function person(look, kind, text, signCol) {
    const L = { ...DEFAULT, ...(look || {}) }, root = new Node(), bob = new Node(null, null, { name: 'bob' });
    if (L.pattern === 'gold') { L.suit = '#d9a514'; L.suit2 = '#fff3c4'; }
    const LEG = .62, base = new Node(), pants = L.pants || '#2d3a55', shoe = '#2a2522', s = L.suit, sk = L.skin;
    const legs = [leg(0, LEG, .1, LEG, .075, pants, shoe, 0), leg(0, LEG, -.1, LEG, .075, pants, shoe, PI)];
    base.add(torsoNode(L).at(0, LEG - .02, 0));
    if (kind === 'hiker') base.add(part(G.box(.22, .38, .32), L.pack || '#3f6b45', -.27, LEG + .28, 0), part(G.cyl(.065, .065, .36, 8), '#c0392b', -.27, LEG + .52, 0).rotate(PI / 2, 0, 0),
      part(G.box(.04, .04, .36), '#2b2b2b', -.17, LEG + .35, 0));
    const upper = new Node(null, null, { name: 'upper' }).at(0, LEG + .39, 0), arms = new Node();
    const arm = (node, sd, hp) => { const a = [-.01, 0, sd * .215], el = [(a[0] + hp[0]) / 2 + .05, (a[1] + hp[1]) / 2 - .04, (a[2] + hp[2]) / 2 + sd * .07];
      node.add(S(.068, s, ...a), rod(a, el, .056, s), S(.054, s, ...el), rod(el, hp, .048, s), S(.06, sk, ...hp)); };
    let wave = null, flag = null, thr = null;
    if (kind === 'sign') {
      for (const sd of [-1, 1]) { arm(arms, sd, [.12, .62, sd * .2]); arms.add(rod([.12, .6, sd * .2], [.12, .95, sd * .2], .02, '#7a5532')); }
      arms.add(plate(text || 'HOPP', .032, signCol || '#e63946', 6).at(.15, 1.08, 0).rotate(0, PI / 2, 0));
    } else if (kind === 'cheer') { for (const sd of [-1, 1]) arm(arms, sd, [.06, .6, sd * .38]); }
    else if (kind === 'wave') { arm(arms, 1, [.08, -.36, .26]); wave = new Node(null, null, { name: 'wave' }).at(-.01, 0, -.215); arm(wave, 0, [.05, .58, -.18]); }
    else if (kind === 'flag') {                // Schweizer Fahne an der Stange
      arm(arms, 1, [.14, .38, .04]); arm(arms, -1, [.14, .62, -.04]); arms.add(rod([.14, .05, 0], [.14, 1.75, 0], .02, '#c9c9c9'));
      flag = new Node(null, null, { name: 'flag' }).at(.14, 1.42, 0);
      flag.add(merge(new Node().add(part(G.box(.02, .56, .56), '#e30613', 0, 0, -.3), part(G.box(.03, .34, .11), '#ffffff', 0, 0, -.3), part(G.box(.03, .11, .34), '#ffffff', 0, 0, -.3))));
    } else if (kind === 'bell') {              // Treichel mit Lederriemen
      for (const sd of [-1, 1]) arm(arms, sd, [.3, -.02, sd * .12]);
      arms.add(B(.05, .1, .3, '#3b2a1e', .32, .02, 0), part(G.cyl(.12, .2, .3, 10), '#c9a227', .34, -.2, 0), part(G.cyl(.2, .2, .03, 10), '#a8861c', .34, -.36, 0), B(.02, .06, .26, '#e63946', .325, .03, 0));
    } else if (kind === 'fork') {              // Bäuerin/Bauer mit Heugabel
      arm(arms, 1, [.08, -.36, .26]); arm(arms, -1, [.2, .05, -.26]); arms.add(rod([.2, -.75, -.26], [.2, .75, -.26], .02, '#8a6a4a'), B(.03, .03, .2, '#888', .2, .75, -.26));
      for (const fz of [-.08, 0, .08]) arms.add(rod([.2, .75, -.26 + fz], [.2, .98, -.26 + fz], .01, '#888'));
    }
    else if (kind === 'dart') {               // Dartspieler: Wurfarm mit Pfeil, Gelenk an der Schulter
      arm(arms, -1, [.04, -.36, -.27]);
      thr = new Node(null, null, { name: 'thr' }).at(-.01, 0, .215);
      arm(thr, 0, [.16, .3, .02]); thr.add(rod([.12, .32, .02], [.3, .34, .02], .008, '#d9dde2'), B(.03, .05, .005, '#e63946', .12, .32, .02));
    } else if (kind === 'paddle') {           // Pingpong: Schläger in der rechten Hand
      arm(arms, -1, [.14, -.2, -.26]);
      thr = new Node(null, null, { name: 'thr' }).at(-.01, 0, .215);
      arm(thr, 0, [.3, -.12, .12]); thr.add(rod([.3, -.12, .12], [.34, -.04, .16], .014, '#8a5a32'), part(G.cyl(.085, .085, .016, 12), '#c1121f', .39, .06, .2).rotate(PI / 2, 0, -.5));
    }
    else if (kind === 'hiker') { arm(arms, 1, [.1, -.36, .26]); arm(arms, -1, [.22, -.25, -.25]); arms.add(rod([.22, -.25, -.25], [.38, -(LEG + .39), -.27], .02, '#8a6a4a')); }
    else for (const sd of [-1, 1]) arm(arms, sd, [.06, -.38, sd * .26]);
    upper.add(merge(arms)); if (wave) upper.add(wave); if (flag) upper.add(flag); if (thr) upper.add(thr);
    const head = new Node(null, null, { name: 'head' }).at(0, LEG - .02 + .5, 0);
    head.add(merge(new Node().add(headNode(L))).at(0, -.5, 0));
    bob.add(merge(base), upper, head, ...legs);
    root.add(part(G.cyl(1, 1, .01, 12), '#000000', 0, .02, 0, { alpha: .25 }).scale(.32, 1, .26), bob);
    root.anim = { legs, head, upper, wave, flag, thr, bob, kind, ph: Math.random() * 10 };
    return root;
  }
  // walk 0/1, cheer 0..1, headYaw (lokal)
  function animatePerson(p, t, walk, cheer, headYaw) {
    const A = p.anim, ph = A.ph;
    for (const l of A.legs) l.rot[2] = walk ? Math.sin(t * 6 + l.phase) * .45 : 0;
    A.bob.pos[1] = walk ? Math.abs(Math.sin(t * 6)) * .03 : cheer > .05 ? Math.abs(Math.sin(t * 8 + ph)) * .32 * cheer : Math.abs(Math.sin(t * 1.5 + ph)) * .015;
    A.upper.rot = [Math.sin(t * (cheer > .05 ? 7 : 1.6) + ph) * (cheer > .05 ? .16 : A.kind === 'sign' ? .06 : .02), 0, walk ? Math.sin(t * 6) * .04 : 0];
    if (A.wave) A.wave.rot = [Math.sin(t * 9 + ph) * .45 - .1, 0, 0];
    if (A.flag) A.flag.rot = [Math.sin(t * (cheer > .05 ? 6 : 2) + ph) * (cheer > .05 ? .5 : .15), Math.sin(t * 3.1 + ph) * .5, 0];
    if (A.kind === 'bell' && cheer > .05) A.upper.rot[0] = Math.sin(t * 14 + ph) * .22 * cheer;
    A.head.rot[1] += ((headYaw || 0) - A.head.rot[1]) * .08;
    A.head.rot[2] = cheer > .05 ? .15 : Math.sin(t * .7 + ph) * .05;
  }
  // Faust, die eine Stange umgreift: Stange entlang lokaler Y-Achse, Handfläche auf der -X-Seite
  function fist(sk) {
    const f = new Node();
    f.add(part(G.box(.05, .12, .1), sk, -.055, 0, 0));
    [-.042, -.014, .014, .042].forEach(y => f.add(part(G.torus(.044, .016, 10, 5, PI * 1.45), sk, 0, y, 0).rotate(PI / 2, PI * .725, 0)));
    f.add(part(G.cyl(.017, .015, .07, 5), sk, -.01, .065, -.035).rotate(0, 0, -.25));
    return f;
  }

  // ---------- Fahrzeuge ----------
  // Jedes Modell liefert: s = statische Teile, a = animierte Teile, seat = Sitzposition
  const V = {};
  V.rocket = L => { const c = L.color, s = new Node(), a = [];
    s.add(B(2.0, .32, .82, c, 0, .4, 0), B(.55, .22, .62, c, 1.15, .34, 0), part(G.cyl(0, .17, .45, 10), c, 1.6, .34, 0).rotate(0, 0, -PI / 2),
      B(2.02, .05, .22, '#ffffff', 0, .57, 0), B(.7, .16, .66, DARK, -.05, .62, 0),
      part(G.box(.05, .22, .55), '#a9d6ff', .38, .7, 0, { alpha: .55 }),
      B(.08, .42, .06, DARK, -.9, .72, .28), B(.08, .42, .06, DARK, -.9, .72, -.28), B(.38, .06, 1.05, '#ffffff', -.92, .94, 0), B(.38, .03, 1.06, c, -.92, .975, 0),
      B(.3, .05, 1.05, DARK, 1.55, .17, 0));
    s.add(rocketTube(-1.12, .42, 0, .55, .15, CHROME));
    a.push(wheel(.27, .22, c, .72, .27, .47), wheel(.27, .22, c, .72, .27, -.47), wheel(.32, .26, c, -.62, .32, .47), wheel(.32, .26, c, -.62, .32, -.47), flame(-1.5, .42, 0, 1.1));
    plates(s, L, .14, .42, .41, .03);
    return { s, a, seat: [-.08, .5, 0], steer: true }; };
  V.snail = L => { const c = L.color, b = '#dcc79c', s = new Node(), a = [];
    s.add(part(G.sphere(1, 14, 7), b, .1, .17, 0).scale(1.3, .22, .45), part(G.cyl(.17, .23, .45, 10), b, 1.05, .32, 0).rotate(0, 0, -.6), S(.26, b, 1.22, .5, 0),
      part(G.cyl(.03, .035, .4, 6), b, 1.27, .82, .1).rotate(.25, 0, -.15), part(G.cyl(.03, .035, .4, 6), b, 1.27, .82, -.1).rotate(-.25, 0, -.15),
      S(.09, '#ffffff', 1.31, 1.03, .16), S(.09, '#ffffff', 1.31, 1.03, -.16), S(.045, '#111', 1.39, 1.04, .17), S(.045, '#111', 1.39, 1.04, -.17),
      B(.03, .03, .16, '#5a3b1e', 1.46, .45, 0),
      part(G.sphere(.6, 14, 9), c, -.05, .76, 0).scale(1, 1, .78),
      part(G.torus(.34, .06, 16, 5), shade(c, .7), -.05, .76, .45),       part(G.torus(.34, .06, 16, 5), shade(c, .7), -.05, .76, -.45));
    s.add(rocketTube(-.55, .95, 0, .5, .13, CHROME));
    a.push(flame(-.9, .95, 0, 1));
    plates(s, L, -.05, .76, .468, .03);
    return { s, a, seat: [-.08, 1.28, 0], reins: [1.42, .5] }; };
  V.turtle = L => { const c = L.color, g = '#73b553', s = new Node(), a = [];
    s.add(part(G.dome(.75, 14, 5), c, 0, .32, 0).scale(1.12, .82, .86), part(G.cyl(.78, .78, .1, 16), '#e9d8a6', 0, .33, 0).scale(1.12, 1, .86),
      ...[[0, .93, 0], [.42, .77, .3], [-.42, .77, .3], [.42, .77, -.3], [-.42, .77, -.3]].map(p => part(G.dome(.2, 8, 3), shade(c, .72), p[0], p[1] - .04, p[2]).scale(1, .45, 1)),
      part(G.cyl(.15, .18, .4, 8), g, .9, .42, 0).rotate(0, 0, -1.1), S(.27, g, 1.12, .55, 0),
      S(.07, '#ffffff', 1.3, .64, .12), S(.07, '#ffffff', 1.3, .64, -.12), S(.035, '#111', 1.36, .65, .12), S(.035, '#111', 1.36, .65, -.12),
      part(G.cyl(0, .07, .2, 6), g, -.95, .32, 0).rotate(0, 0, PI / 2));
    s.add(rocketTube(-.55, .98, 0, .55, .17, CHROME));
    a.push(leg(.5, .36, .45, .3, .11, g, null, 0), leg(.5, .36, -.45, .3, .11, g, null, PI), leg(-.5, .36, .45, .3, .11, g, null, PI), leg(-.5, .36, -.45, .3, .11, g, null, 0), flame(-.95, .98, 0, 1.1));
    plates(s, L, 0, .52, .62, .028, .35);
    return { s, a, seat: [0, .88, 0], reins: [1.34, .5] }; };
  V.cow = L => { const c = L.color, w = '#fafaf6', s = new Node(), a = [];
    s.add(B(1.5, .7, .76, w, 0, .98, 0),
      B(.42, .32, .02, '#222', -.3, 1.05, .385), B(.3, .25, .02, '#222', .35, .88, .385), B(.36, .3, .02, '#222', .1, 1.0, -.385), B(.3, .2, .02, '#222', -.45, .82, -.385),
      B(.7, .06, .82, c, 0, 1.36, 0), B(.72, .025, .84, '#ffffff', 0, 1.33, 0),
      B(.45, .42, .46, w, .93, 1.2, 0), B(.2, .25, .4, '#f6a7b8', 1.2, 1.1, 0), S(.03, '#7a3b4a', 1.31, 1.12, .08), S(.03, '#7a3b4a', 1.31, 1.12, -.08),
      S(.05, '#111', 1.16, 1.31, .16), S(.05, '#111', 1.16, 1.31, -.16), B(.2, .12, .02, '#222', .92, 1.28, .235),
      part(G.cyl(0, .055, .24, 6), '#f3e6c8', .93, 1.5, .18).rotate(.35, 0, 0), part(G.cyl(0, .055, .24, 6), '#f3e6c8', .93, 1.5, -.18).rotate(-.35, 0, 0),
      B(.08, .08, .22, w, .85, 1.32, .32), B(.08, .08, .22, w, .85, 1.32, -.32),
      B(.1, .05, .5, c, .78, .95, 0), part(G.cyl(.06, .11, .15, 8), '#f2c230', .86, .82, 0),
      part(G.cyl(.02, .02, .55, 5), w, -.8, .85, 0).rotate(0, 0, -.35), S(.07, '#222', -.9, .6, 0));
    a.push(leg(.55, .66, .26, .58, .09, w, '#222', 0), leg(.55, .66, -.26, .58, .09, w, '#222', PI), leg(-.55, .66, .26, .58, .09, w, '#222', PI), leg(-.55, .66, -.26, .58, .09, w, '#222', 0));
    plates(s, L, .12, .97, .38, .03);
    return { s, a, seat: [-.05, 1.38, 0], reins: [1.3, 1.12] }; };
  V.tub = L => { const c = L.color, wt = '#f7f7f7', s = new Node(), a = [];
    s.add(B(1.8, .55, .9, wt, 0, .6, 0), B(1.82, .14, .92, c, 0, .52, 0),
      B(.1, .12, 1.0, wt, .9, .92, 0), B(.1, .12, 1.0, wt, -.9, .92, 0), B(1.9, .12, .1, wt, 0, .92, .45), B(1.9, .12, .1, wt, 0, .92, -.45),
      B(1.72, .03, .82, '#7cc8f2', 0, .895, 0),
      ...[[.5, .3], [-.4, -.25], [.2, -.3], [-.6, .28], [.65, -.2]].map(p => S(.08, '#ffffff', p[0], .92, p[1])),
      S(.15, '#ffd23f', .7, 1.02, .3), S(.1, '#ffd23f', .78, 1.18, .3), B(.1, .04, .07, '#ff8c1a', .89, 1.16, .3), S(.02, '#111', .85, 1.22, .36),
      part(G.cyl(.03, .03, 1.0, 6), CHROME, -.9, 1.4, -.35), part(G.cyl(.03, .03, .3, 6), CHROME, -.78, 1.9, -.35).rotate(0, 0, -PI / 2), part(G.cyl(.05, .13, .1, 10), CHROME, -.62, 1.84, -.35));
    s.add(rocketTube(-1.1, .55, 0, .45, .14, CHROME));
    a.push(wheel(.22, .18, '#d9a520', .62, .22, .46), wheel(.22, .18, '#d9a520', .62, .22, -.46), wheel(.22, .18, '#d9a520', -.62, .22, .46), wheel(.22, .18, '#d9a520', -.62, .22, -.46), flame(-1.42, .55, 0, 1));
    plates(s, L, .05, .72, .45, .03);
    return { s, a, seat: [-.1, .62, 0], steer: true }; };
  V.cheese = L => { const c = L.color, y = '#ffcf3f', h = '#d9a520', s = new Node(), a = [];
    s.add(part(G.prism([[-1, 0], [1.1, 0], [-1, .9]], .9, 'cheese'), y, 0, .3, 0),
      ...[[-.6, .55, .2], [.1, .45, .15], [-.4, .9, .1], [.45, .38, .1], [-.75, .95, .12]].flatMap(p => [part(G.cyl(p[2], p[2], .02, 10), h, p[0], p[1], .451).rotate(PI / 2, 0, 0), part(G.cyl(p[2] * .8, p[2] * .8, .02, 10), h, p[0] + .1, p[1] - .05, -.451).rotate(PI / 2, 0, 0)]),
      B(2.3, .02, .22, c, .05, .76, 0).rotate(0, 0, -.405),
      part(G.cyl(.02, .02, .9, 5), DARK, -.9, 1.65, .3), B(.42, .3, .02, '#e30613', -.68, 1.95, .3), B(.2, .06, .025, '#ffffff', -.68, 1.95, .3), B(.06, .2, .025, '#ffffff', -.68, 1.95, .3));
    a.push(wheel(.26, .2, c, .7, .26, .5), wheel(.26, .2, c, .7, .26, -.5), wheel(.26, .2, c, -.7, .26, .5), wheel(.26, .2, c, -.7, .26, -.5));
    plates(s, L, -.25, .55, .45, .03);
    return { s, a, seat: [-.5, .98, 0], steer: true }; };
  V.mower = L => { const c = L.color, s = new Node(), a = [];
    s.add(B(1.3, .25, .8, c, 0, .45, 0), B(.6, .32, .72, c, .45, .72, 0), B(.04, .22, .5, DARK, .76, .7, 0), B(1.05, .1, 1.0, '#7d8790', .1, .24, 0),
      B(.42, .08, .52, '#1b1b1b', -.25, .62, 0), B(.08, .42, .52, '#1b1b1b', -.46, .85, 0),
      B(.38, .42, .62, '#3f7d32', -.78, .5, 0), S(.06, '#ffd23f', .77, .78, .25), S(.06, '#ffd23f', .77, .78, -.25));
    s.add(rocketTube(-.82, .9, 0, .45, .14, CHROME));
    a.push(wheel(.33, .22, '#ffd23f', -.4, .33, .5), wheel(.33, .22, '#ffd23f', -.4, .33, -.5), wheel(.18, .14, '#ffd23f', .52, .18, .4), wheel(.18, .14, '#ffd23f', .52, .18, -.4), flame(-1.12, .9, 0, 1));
    plates(s, L, .42, .7, .36, .026);
    return { s, a, seat: [-.25, .66, 0], steer: true }; };
  V.banana = L => { const c = L.color, s = new Node(), a = [];
    s.add(B(1.8, .12, .9, c, 0, .32, 0), B(.25, .1, .95, DARK, .95, .3, 0));
    for (let i = 0; i <= 10; i++) { const x = -1.05 + i * .21, r = .3 - Math.abs(x) * .17, yy = .62 + .32 * x * x;
      s.add(part(G.sphere(Math.max(.07, r), 9, 6), '#ffe135', x, yy, 0)); }
    s.add(part(G.cyl(.04, .06, .14, 6), '#5a3b1e', -1.17, 1.02, 0).rotate(0, 0, .9), part(G.cyl(.06, .04, .1, 6), '#5a3b1e', 1.15, 1.0, 0).rotate(0, 0, -.9),
      B(.5, .015, .15, '#d7c11c', 0, .925, 0));
    a.push(wheel(.24, .2, c, .7, .24, .5), wheel(.24, .2, c, .7, .24, -.5), wheel(.24, .2, c, -.7, .24, .5), wheel(.24, .2, c, -.7, .24, -.5));
    plates(s, L, 0, .46, .45, .028);
    return { s, a, seat: [-.05, .88, 0], steer: true }; };
  V.cart = L => { const c = L.color, s = new Node(), a = [], ch = CHROME;
    s.add(B(1.4, .04, .8, ch, 0, .55, 0));
    for (const y of [.55, .85, 1.15]) s.add(B(1.4, .03, .03, ch, 0, y, .4), B(1.4, .03, .03, ch, 0, y, -.4), B(.03, .03, .8, ch, .7, y, 0), B(.03, .03, .8, ch, -.7, y, 0));
    for (let x = -.7; x <= .71; x += .2) s.add(B(.025, .6, .025, ch, x, .85, .4), B(.025, .6, .025, ch, x, .85, -.4));
    for (let z = -.4; z <= .41; z += .2) s.add(B(.025, .6, .025, ch, .7, .85, z), B(.025, .6, .025, ch, -.7, .85, z));
    s.add(B(.03, .3, .03, ch, -.8, 1.25, .38), B(.03, .3, .03, ch, -.8, 1.25, -.38), part(G.cyl(.05, .05, .86, 8), c, -.85, 1.38, 0).rotate(PI / 2, 0, 0),
      B(1.3, .04, .04, ch, 0, .2, .3), B(1.3, .04, .04, ch, 0, .2, -.3), B(.04, .35, .04, ch, .6, .37, .3), B(.04, .35, .04, ch, .6, .37, -.3), B(.04, .35, .04, ch, -.6, .37, .3), B(.04, .35, .04, ch, -.6, .37, -.3));
    s.add(rocketTube(0, .4, 0, 1.0, .15, c), part(G.box(.25, .2, .02), '#e63946', -.45, .52, 0), part(G.box(.25, .02, .2), '#e63946', -.45, .4, 0));
    a.push(wheel(.1, .07, DARK, .6, .1, .3), wheel(.1, .07, DARK, .6, .1, -.3), wheel(.1, .07, DARK, -.6, .1, .3), wheel(.1, .07, DARK, -.6, .1, -.3), flame(-.6, .4, 0, 1));
    plates(s, L, 0, .86, .41, .03);
    return { s, a, seat: [-.05, .58, 0], steer: true }; };
  V.unicorn = L => { const c = L.color, s = new Node(), a = [], rain = ['#ff4d6d', '#ffa62b', '#ffe066', '#3ddc97', '#4ea8de', '#9b5de5'];
    s.add(part(G.sphere(.55, 12, 8), c, 0, 1.02, 0).scale(1.45, .75, .72), part(G.cyl(.17, .24, .62, 10), c, .72, 1.38, 0).rotate(0, 0, -.6),
      part(G.box(.52, .28, .3), c, .98, 1.64, 0).rotate(0, 0, -.35), part(G.cyl(0, .055, .42, 8), '#ffd23f', 1.02, 1.97, 0).rotate(0, 0, -.35),
      S(.04, '#111', 1.05, 1.7, .15), S(.04, '#111', 1.05, 1.7, -.15), B(.08, .12, .05, c, .86, 1.82, .1), B(.08, .12, .05, c, .86, 1.82, -.1),
      ...rain.map((r, i) => part(G.cyl(0, .085, .24, 5), r, .52 + i * .07, 1.55 + i * .05, 0).rotate(0, 0, .9)),
      ...rain.slice(0, 5).map((r, i) => part(G.cyl(0, .09, .5, 5), r, -.85 - i * .02, 1.0 - i * .07, (i - 2) * .05).rotate(0, 0, -2.0 - i * .1)),
      B(.62, .06, .8, '#ffffff', 0, 1.39, 0), B(.64, .025, .82, '#ffd23f', 0, 1.36, 0));
    a.push(leg(.45, .82, .2, .72, .075, c, '#ffd23f', 0), leg(.45, .82, -.2, .72, .075, c, '#ffd23f', PI), leg(-.45, .82, .2, .72, .075, c, '#ffd23f', PI), leg(-.45, .82, -.2, .72, .075, c, '#ffd23f', 0));
    plates(s, L, .05, .98, .4, .03);
    return { s, a, seat: [-.05, 1.42, 0], reins: [1.2, 1.58] }; };


  // Augen sitzen sichtbar auf der Kopfoberfläche (Ellipsoid c/r, Blickrichtung d, Seite gespiegelt), mit Iris, Pupille und Lichtreflex
  function eyes(g, c, r, d, er, iris) {
    for (const sd of [-1, 1]) {
      const v = [d[0], d[1], d[2] * sd], t = 1 / Math.hypot(v[0] / r[0], v[1] / r[1], v[2] / r[2]), p = v.map((x, i) => c[i] + x * t);
      const n0 = v.map((x, i) => x / (r[i] * r[i])), nl = Math.hypot(...n0), n = n0.map(x => x / nl), at = k => p.map((x, i) => x + n[i] * er * k);
      if (iris) g.add(S(er, iris, ...at(-.25)), S(er * .58, '#0d0b0a', ...at(.28))); else g.add(S(er, '#151110', ...at(-.25)));
      const gl = at(iris ? .78 : .66); gl[1] += er * .32; g.add(S(er * .28, '#ffffff', ...gl));
    }
  }

  // ---------- Waldtiere ----------
  // Rückgabe: Knoten mit anim.legs (Beine) und anim.head (Kopf-Drehpunkt); vorwärts = +X
  function animal(kind) {
    const s = new Node(), a = [], root = new Node(), body = new Node(null, null, { name: 'bob' });
    let head = new Node(null, null, { name: 'head' }), hs = new Node();
    const legs = (pts, len, r, col, hoof) => pts.forEach((p, i) => a.push(leg(p[0], len, p[1], len, r, col, hoof, i % 3 === 0 ? 0 : PI)));
    if (kind === 'bear') {
      const c = '#6b4423', l = '#a0784f';
      s.add(part(G.sphere(.62, 12, 8), c, 0, .82, 0).scale(1.35, .85, .85), part(G.sphere(.4, 10, 7), c, .55, .95, 0), S(.12, '#3a2414', -.75, .95, 0));
      legs([[.5, .3], [.5, -.3], [-.5, .3], [-.5, -.3]], .55, .15, c, '#2b1a0e');
      head.at(.85, 1.0, 0); hs.add(S(.32, c, .1, 0, 0), part(G.sphere(.16, 8, 6), l, .38, -.06, 0).scale(1.2, .85, 1), S(.05, '#111', .55, -.03, 0),
        S(.09, c, 0, .26, .2), S(.09, c, 0, .26, -.2));
    } else if (kind === 'deer' || kind === 'stag') {
      const big = kind === 'stag', c = big ? '#7a4a2a' : '#b5763f', k = big ? 1.3 : 1;
      s.add(part(G.sphere(.36 * k, 10, 7), c, 0, .9 * k, 0).scale(1.55, .78, .68), S(.08 * k, '#f4ead8', -.55 * k, .95 * k, 0),
        part(G.cyl(.09 * k, .13 * k, .5 * k, 7), c, .42 * k, 1.12 * k, 0).rotate(0, 0, -.55));
      legs([[.36 * k, .14 * k], [.36 * k, -.14 * k], [-.36 * k, .14 * k], [-.36 * k, -.14 * k]], .66 * k, .045 * k, c, '#2a1d14');
      head.at(.58 * k, 1.36 * k, 0);
      hs.add(part(G.sphere(.15 * k, 8, 6), c, .06 * k, 0, 0).scale(1.35, 1, .95), S(.04 * k, '#111', .26 * k, -.04 * k, 0),
        part(G.cyl(0, .05 * k, .16 * k, 5), c, -.02, .14 * k, .1 * k).rotate(.5, 0, 0), part(G.cyl(0, .05 * k, .16 * k, 5), c, -.02, .14 * k, -.1 * k).rotate(-.5, 0, 0));
      if (big) for (const sd of [-1, 1]) {           // Geweih mit Verzweigungen
        const b0 = [-.02, .12, sd * .07], b1 = [-.08, .42, sd * .22], b2 = [-.18, .7, sd * .3];
        hs.add(rod(b0, b1, .025, '#d9c9a3'), rod(b1, b2, .022, '#d9c9a3'), rod(b1, [.08, .6, sd * .2], .018, '#d9c9a3'), rod([-.12, .58, sd * .27], [.02, .82, sd * .34], .016, '#d9c9a3'), rod(b2, [-.3, .86, sd * .3], .016, '#d9c9a3'));
      }
    } else if (kind === 'wolf') {
      const c = '#8a8f96', l = '#d7d9dc';
      s.add(part(G.sphere(.33, 10, 7), c, 0, .66, 0).scale(1.6, .75, .66), part(G.sphere(.2, 8, 6), l, .25, .55, 0).scale(1.4, .7, .8),
        rod([-.5, .7, 0], [-.95, .42, 0], .07, c), S(.07, l, -.97, .4, 0));
      legs([[.33, .12], [.33, -.12], [-.33, .12], [-.33, -.12]], .48, .05, c, '#4a4d52');
      head.at(.55, .86, 0);
      hs.add(S(.18, c, 0, 0, 0), part(G.cyl(0, .09, .28, 7), l, .25, -.04, 0).rotate(0, 0, -PI / 2), S(.035, '#111', .39, -.04, 0), part(G.cyl(0, .06, .16, 4), c, -.04, .2, .09), part(G.cyl(0, .06, .16, 4), c, -.04, .2, -.09));
    } else if (kind === 'fox') {
      const c = '#d9692a', w = '#f6efe6';
      s.add(part(G.sphere(.28, 10, 7), c, 0, .55, 0).scale(1.6, .72, .62), part(G.sphere(.16, 8, 6), w, .22, .46, 0).scale(1.5, .7, .8),
        rod([-.42, .58, 0], [-.85, .42, 0], .1, c), part(G.cyl(0, .1, .22, 7), w, -.98, .38, 0).rotate(0, 0, PI / 2 + .35));
      legs([[.28, .1], [.28, -.1], [-.28, .1], [-.28, -.1]], .4, .04, '#2a1d17', null);
      head.at(.46, .72, 0);
      hs.add(S(.15, c, 0, 0, 0), part(G.cyl(0, .08, .24, 7), w, .2, -.04, 0).rotate(0, 0, -PI / 2), S(.03, '#111', .33, -.04, 0), part(G.cyl(0, .06, .17, 4), c, -.03, .19, .08), part(G.cyl(0, .06, .17, 4), c, -.03, .19, -.08));
    } else if (kind === 'hare') {
      const c = '#9b7b5b';
      s.add(part(G.sphere(.22, 9, 7), c, 0, .3, 0).scale(1.35, .95, .85), S(.08, '#f4f0ea', -.3, .32, 0));
      legs([[.15, .08], [.15, -.08]], .14, .03, c, null);
      a.push(part(G.sphere(.12, 7, 5), c, -.16, .12, .12).scale(1.6, .7, .7), part(G.sphere(.12, 7, 5), c, -.16, .12, -.12).scale(1.6, .7, .7));
      head.at(.26, .44, 0);
      hs.add(S(.12, c, .04, 0, 0), S(.02, '#e8a0a8', .16, -.02, 0),
        part(G.box(.06, .3, .045), c, -.04, .22, .05).rotate(.15, 0, .25), part(G.box(.06, .3, .045), c, -.04, .22, -.05).rotate(-.15, 0, .25));
    } else if (kind === 'squirrel') {
      const c = '#b0522a';
      s.add(part(G.sphere(.13, 8, 6), c, 0, .2, 0).scale(1.3, 1.05, .85), S(.06, '#f2e6d3', .07, .17, 0));
      [[-.16, .22], [-.24, .36], [-.22, .52], [-.12, .6]].forEach((p, i) => s.add(S(.085 - i * .004, c, p[0], p[1], 0)));
      legs([[.07, .06], [.07, -.06], [-.06, .06], [-.06, -.06]], .1, .025, '#7a3a1c', null);
      head.at(.15, .3, 0);
      hs.add(S(.085, c, .03, 0, 0), part(G.cyl(0, .03, .07, 4), c, 0, .09, .04), part(G.cyl(0, .03, .07, 4), c, 0, .09, -.04));
    } else if (kind === 'boar' || kind === 'piglet') {
      const young = kind === 'piglet', k = young ? .45 : 1, c = young ? '#c9a77a' : '#4f4339';
      s.add(part(G.sphere(.42 * k, 10, 7), c, 0, .58 * k, 0).scale(1.5, .9, .8));
      if (young) for (let i = -2; i <= 2; i++) s.add(B(.5 * k * 1.4, .03, .02, '#7a5a3a', 0, .6 * k + i * .07 * k, .34 * k).rotate(0, 0, 0), B(.5 * k * 1.4, .03, .02, '#7a5a3a', 0, .6 * k + i * .07 * k, -.34 * k));
      else s.add(B(.75, .1, .07, '#2e2620', .05, .91, 0).rotate(0, 0, -.06));
      s.add(rod([-.6 * k, .65 * k, 0], [-.72 * k, .45 * k, 0], .025 * k, c));
      legs([[.32 * k, .16 * k], [.32 * k, -.16 * k], [-.32 * k, .16 * k], [-.32 * k, -.16 * k]], .32 * k, .07 * k, '#2e2620', '#1b1714');
      head.at(.6 * k, .62 * k, 0);
      hs.add(part(G.sphere(.24 * k, 9, 6), c, .05 * k, 0, 0).scale(1.2, 1, .9), part(G.cyl(.09 * k, .1 * k, .2 * k, 8), '#8a6e62', .32 * k, -.05 * k, 0).rotate(0, 0, -PI / 2), part(G.cyl(0, .06 * k, .14 * k, 4), c, 0, .22 * k, .12 * k).rotate(.4, 0, 0), part(G.cyl(0, .06 * k, .14 * k, 4), c, 0, .22 * k, -.12 * k).rotate(-.4, 0, 0));
      if (!young) hs.add(part(G.cyl(0, .025, .12, 5), '#f4efe2', .34, .04, .08).rotate(0, 0, -.3), part(G.cyl(0, .025, .12, 5), '#f4efe2', .34, .04, -.08).rotate(0, 0, -.3));
    } else if (kind === 'hedgehog') {
      const c = '#5a4430';
      s.add(part(G.dome(.26, 10, 4), c, 0, .06, 0).scale(1.35, .85, 1));
      for (let i = 0; i < 40; i++) { const th = i * 2.4, ph = .15 + (i % 7) * .19, n = [Math.cos(th) * Math.sin(ph), Math.cos(ph), Math.sin(th) * Math.sin(ph)], b = [n[0] * .3, .06 + n[1] * .2, n[2] * .24];
        if (n[0] > .75) continue; s.add(rod(b, [b[0] + n[0] * .17 - .05, b[1] + n[1] * .17, b[2] + n[2] * .17], .014, i % 3 ? '#3b2c1f' : '#d8c8b0')); }
      legs([[.12, .1], [.12, -.1], [-.12, .1], [-.12, -.1]], .08, .03, '#8a6a4a', null);
      head.at(.3, .14, 0);
      hs.add(part(G.cyl(0, .1, .22, 7), '#c9a982', .06, 0, 0).rotate(0, 0, -PI / 2), S(.025, '#111', .17, 0, 0));
    } else if (kind === 'owl') {
      const c = '#8a6a4a';
      s.add(part(G.sphere(.22, 9, 7), c, 0, .28, 0).scale(.95, 1.2, .95), part(G.sphere(.14, 8, 6), '#e6d4b4', .12, .25, 0).scale(.6, 1.2, 1),
        part(G.sphere(.12, 7, 5), shade(c, .8), -.02, .28, .19).scale(.8, 1.4, .4), part(G.sphere(.12, 7, 5), shade(c, .8), -.02, .28, -.19).scale(.8, 1.4, .4));
      head.at(0, .55, 0);
      hs.add(S(.17, c, 0, 0, 0), part(G.cyl(.07, .07, .03, 10), '#f2e6c9', .15, .01, .065).rotate(0, 0, PI / 2), part(G.cyl(.07, .07, .03, 10), '#f2e6c9', .15, .01, -.065).rotate(0, 0, PI / 2),
        S(.035, '#ffb703', .17, .01, .065), S(.035, '#ffb703', .17, .01, -.065), S(.018, '#111', .2, .01, .065), S(.018, '#111', .2, .01, -.065),
        part(G.cyl(0, .025, .07, 4), '#e0a02a', .18, -.05, 0).rotate(0, 0, -PI / 2 - .5), part(G.cyl(0, .05, .1, 4), c, 0, .17, .1), part(G.cyl(0, .05, .1, 4), c, 0, .17, -.1));
    } else if (kind === 'ibex' || kind === 'ibexF' || kind === 'kid') {
      // Steinbock (Bock mit grossen Hörnern), Geiss und Kitz
      const k = kind === 'kid' ? .55 : kind === 'ibexF' ? .85 : 1, c = kind === 'kid' ? '#a08a6a' : kind === 'ibexF' ? '#9a8566' : '#7d6c55', d = '#4a3f33';
      s.add(part(G.sphere(.34 * k, 10, 7), c, 0, .72 * k, 0).scale(1.5, .9, .82), part(G.sphere(.26 * k, 8, 6), shade(c, .85), .2 * k, .7 * k, 0).scale(1.2, 1, .9),
        part(G.cyl(.12 * k, .17 * k, .36 * k, 7), c, .4 * k, .9 * k, 0).rotate(0, 0, -.7), S(.07 * k, d, -.5 * k, .82 * k, 0));
      legs([[.3 * k, .13 * k], [.3 * k, -.13 * k], [-.3 * k, .13 * k], [-.3 * k, -.13 * k]], .5 * k, .055 * k, d, '#2a2420');
      head.at(.55 * k, 1.05 * k, 0);
      hs.add(part(G.sphere(.15 * k, 8, 6), c, .05 * k, 0, 0).scale(1.3, .95, .9), part(G.sphere(.08 * k, 7, 5), shade(c, .75), .22 * k, -.05 * k, 0),
        part(G.cyl(0, .04 * k, .12 * k, 4), c, -.02 * k, .1 * k, .11 * k).rotate(.9, 0, 0), part(G.cyl(0, .04 * k, .12 * k, 4), c, -.02 * k, .1 * k, -.11 * k).rotate(-.9, 0, 0));
      if (kind === 'ibex') hs.add(part(G.cyl(.03, 0, .14, 5), d, .16, -.16, 0));               // Bart
      if (kind !== 'kid') { const R = kind === 'ibex' ? .34 : .17, arc = kind === 'ibex' ? 2.5 : 1.7, n = 9;   // gebogene Hörner mit Wülsten
        for (const sd of [-1, 1]) { let prev = null;
          for (let i = 0; i <= n; i++) { const a = i / n * arc, p = [.02 - R + R * Math.cos(a), .1 + R * Math.sin(a), sd * (.06 + .07 * a / arc)].map((v, j) => j < 2 ? v * k : v);
            if (prev) hs.add(rod(prev, p, (.055 - .035 * i / n) * k * (kind === 'ibex' ? 1 : .6), '#6b5a44'));
            if (kind === 'ibex' && i % 2 === 0 && i < n) hs.add(S(.05 * k * (1 - i / n * .6), '#7d6a52', p[0], p[1], p[2]));
            prev = p; } } }
    } else if (kind === 'chamois') {
      // Gämse: schlank, Gesicht hell mit dunklem Streifen, kurze Hakenhörner
      const c = '#6b4a30', d = '#2e241c';
      s.add(part(G.sphere(.3, 10, 7), c, 0, .78, 0).scale(1.55, .82, .72), part(G.cyl(.09, .13, .36, 7), c, .38, .98, 0).rotate(0, 0, -.6), S(.06, d, -.47, .84, 0),
        part(G.box(.8, .05, .05), d, -.02, 1.02, 0));
      legs([[.28, .11], [.28, -.11], [-.28, .11], [-.28, -.11]], .6, .04, d, '#1a1512');
      head.at(.55, 1.16, 0);
      hs.add(part(G.sphere(.12, 8, 6), '#e9dfcc', .05, 0, 0).scale(1.4, .95, .85), part(G.box(.26, .05, .03), d, .08, .02, .07), part(G.box(.26, .05, .03), d, .08, .02, -.07),
        S(.025, '#111', .24, -.02, 0),
        part(G.cyl(0, .035, .1, 4), c, -.03, .09, .09).rotate(.8, 0, 0), part(G.cyl(0, .035, .1, 4), c, -.03, .09, -.09).rotate(-.8, 0, 0));
      for (const sd of [-1, 1]) hs.add(rod([0, .1, sd * .04], [-.01, .26, sd * .05], .018, '#111'), rod([-.01, .26, sd * .05], [-.07, .3, sd * .05], .014, '#111'));
    } else if (kind === 'cow' || kind === 'calf') {
      // Braunvieh mit Treichel (Kuhglocke)
      const k = kind === 'calf' ? .55 : 1, c = kind === 'calf' ? '#a3825f' : '#8b6b52', l = '#e3d3bd', d = '#3a2c22';
      s.add(part(G.box(1.1 * k, .6 * k, .62 * k), c, 0, .95 * k, 0), part(G.sphere(.33 * k, 9, 7), c, .5 * k, .97 * k, 0).scale(1, .95, .98), part(G.sphere(.33 * k, 9, 7), c, -.52 * k, .97 * k, 0).scale(1, .95, .98),
        part(G.box(.9 * k, .12 * k, .5 * k), shade(c, 1.12), 0, 1.26 * k, 0), rod([-.8 * k, 1.14 * k, 0], [-.92 * k, .55 * k, 0], .025 * k, c), S(.06 * k, d, -.93 * k, .5 * k, 0),
        part(G.cyl(.15 * k, .2 * k, .3 * k, 8), c, .7 * k, 1.05 * k, 0).rotate(0, 0, -.9));
      if (kind === 'cow') s.add(part(G.sphere(.17, 7, 5), '#f2b8b8', -.3, .63, 0).scale(1.3, .7, 1), B(.06, .2, .5, '#5a3a22', .84, .85, 0),
        part(G.cyl(.09, .15, .22, 10), '#d9a520', .9, .67, 0), S(.035, '#6b5a2a', .9, .55, 0));
      legs([[.42 * k, .2 * k], [.42 * k, -.2 * k], [-.45 * k, .2 * k], [-.45 * k, -.2 * k]], .66 * k, .075 * k, c, '#2a2420');
      head.at(.9 * k, 1.16 * k, 0);
      hs.add(part(G.box(.34 * k, .3 * k, .3 * k), c, .1 * k, 0, 0), part(G.box(.18 * k, .22 * k, .3 * k), l, .32 * k, -.06 * k, 0), S(.025 * k, '#2a1d17', .42 * k, -.06 * k, .07 * k), S(.025 * k, '#2a1d17', .42 * k, -.06 * k, -.07 * k),
        part(G.box(.08 * k, .06 * k, .22 * k), c, .02 * k, .08 * k, .24 * k).rotate(.3, 0, 0), part(G.box(.08 * k, .06 * k, .22 * k), c, .02 * k, .08 * k, -.24 * k).rotate(-.3, 0, 0), part(G.box(.08 * k, .02 * k, .2 * k), '#f0c8b8', .03 * k, .085 * k, .24 * k).rotate(.3, 0, 0), part(G.box(.08 * k, .02 * k, .2 * k), '#f0c8b8', .03 * k, .085 * k, -.24 * k).rotate(-.3, 0, 0));
      if (kind === 'cow') hs.add(rod([.02, .15, .12], [.06, .3, .26], .03, '#efe4cc'), rod([.06, .3, .26], [.12, .38, .22], .022, '#3a3530'), rod([.02, .15, -.12], [.06, .3, -.26], .03, '#efe4cc'), rod([.06, .3, -.26], [.12, .38, -.22], .022, '#3a3530'));
    } else if (kind === 'sheep') {
      const w = '#f4f1e8', f = '#2f2f2f';
      s.add(part(G.sphere(.3, 9, 7), w, 0, .66, 0).scale(1.45, .95, 1));
      [[.2, .86, .1], [-.05, .9, -.08], [-.25, .82, .1], [.08, .8, .2], [-.15, .78, -.2], [.25, .7, -.18], [-.3, .64, .18], [0, .6, -.24]].forEach(p => s.add(S(.16, w, ...p)));
      legs([[.22, .12], [.22, -.12], [-.22, .12], [-.22, -.12]], .42, .035, f, '#1b1b1b');
      head.at(.46, .8, 0);
      hs.add(part(G.sphere(.13, 8, 6), f, .08, -.02, 0).scale(1.35, 1, .85), S(.11, w, -.03, .08, 0),
        part(G.box(.06, .04, .16), f, 0, .02, .14).rotate(.4, 0, 0), part(G.box(.06, .04, .16), f, 0, .02, -.14).rotate(-.4, 0, 0));
    } else if (kind === 'goat') {
      const c = '#efe8dc', d = '#7a5a3a';
      s.add(part(G.sphere(.28, 9, 7), c, 0, .7, 0).scale(1.5, .85, .78), part(G.cyl(.08, .11, .3, 7), c, .34, .86, 0).rotate(0, 0, -.6), rod([-.4, .78, 0], [-.48, .92, 0], .03, c));
      legs([[.25, .11], [.25, -.11], [-.25, .11], [-.25, -.11]], .48, .035, c, '#3a3530');
      head.at(.5, 1.0, 0);
      hs.add(part(G.sphere(.12, 8, 6), c, .07, 0, 0).scale(1.45, .9, .8), part(G.cyl(.03, 0, .14, 5), d, .17, -.15, 0),
        part(G.box(.05, .03, .16), c, -.01, .02, .14).rotate(.6, 0, 0), part(G.box(.05, .03, .16), c, -.01, .02, -.14).rotate(-.6, 0, 0),
        rod([-.02, .08, .05], [-.12, .24, .07], .022, '#8a7a62'), rod([-.12, .24, .07], [-.2, .26, .07], .016, '#8a7a62'), rod([-.02, .08, -.05], [-.12, .24, -.07], .022, '#8a7a62'), rod([-.12, .24, -.07], [-.2, .26, -.07], .016, '#8a7a62'));
    } else if (kind === 'pig' || kind === 'pigletF') {
      const k = kind === 'pigletF' ? .5 : 1, c = '#f2a7b0', d = '#d9838f';
      s.add(part(G.sphere(.4 * k, 10, 7), c, 0, .55 * k, 0).scale(1.45, .9, .85), part(G.torus(.06 * k, .015 * k, 8, 4, PI * 1.6), d, -.6 * k, .66 * k, 0).rotate(0, PI / 2, 0));
      legs([[.3 * k, .16 * k], [.3 * k, -.16 * k], [-.3 * k, .16 * k], [-.3 * k, -.16 * k]], .3 * k, .065 * k, c, '#b0707a');
      head.at(.58 * k, .6 * k, 0);
      hs.add(part(G.sphere(.23 * k, 9, 6), c, .05 * k, 0, 0).scale(1.1, 1, .95), part(G.cyl(.1 * k, .11 * k, .14 * k, 10), d, .28 * k, -.05 * k, 0).rotate(0, 0, -PI / 2),
        S(.022 * k, '#7a3b4a', .35 * k, -.03 * k, .04 * k), S(.022 * k, '#7a3b4a', .35 * k, -.03 * k, -.04 * k),
        part(G.cyl(0, .08 * k, .15 * k, 4), c, .06 * k, .2 * k, .12 * k).rotate(.5, 0, -.6), part(G.cyl(0, .08 * k, .15 * k, 4), c, .06 * k, .2 * k, -.12 * k).rotate(-.5, 0, -.6));
    } else if (kind === 'hen' || kind === 'rooster') {
      const roo = kind === 'rooster', c = roo ? '#b5541f' : (Math.random() < .5 ? '#f6f3ec' : '#a8643a'), comb = '#d62828';
      s.add(part(G.sphere(.15, 8, 6), c, 0, .3, 0).scale(1.35, 1, .9), part(G.sphere(.09, 7, 5), shade(c, .9), .02, .3, .12).scale(1.6, .8, .4), part(G.sphere(.09, 7, 5), shade(c, .9), .02, .3, -.12).scale(1.6, .8, .4));
      if (roo) [['#1f5f3a', .5], ['#14213d', .9], ['#1f5f3a', 1.3], ['#e09a2b', .2]].forEach(([tc, a], i) => s.add(part(G.box(.04, .3, .1), tc, -.2 - i * .02, .44, (i - 1.5) * .025).rotate(0, 0, a)));
      else s.add(part(G.box(.1, .16, .1), c, -.18, .4, 0).rotate(0, 0, .5));
      legs([[.02, .05], [.02, -.05]], .17, .012, '#e0a02a', null);
      head.at(.15, .45, 0);
      hs.add(S(.075, c, 0, 0, 0), part(G.cyl(0, .025, .07, 4), '#e0a02a', .09, -.01, 0).rotate(0, 0, -PI / 2),
        part(G.box(.1, roo ? .09 : .05, .02), comb, -.005, .085, 0), part(G.box(.03, .06, .02), comb, .055, -.06, 0));
    } else if (kind === 'dog') {
      // Berner Sennenhund: schwarz, weisse Brust und Blesse, rostbraune Abzeichen
      const b = '#1d1b1b', w = '#f4f1ea', r = '#b5652b';
      s.add(part(G.sphere(.3, 10, 7), b, 0, .6, 0).scale(1.55, .82, .72), part(G.sphere(.17, 8, 6), w, .34, .58, 0).scale(1, 1.1, .9), rod([-.42, .66, 0], [-.6, .4, 0], .07, b), S(.07, w, -.62, .37, 0));
      a.push(leg(.3, .46, .13, .46, .055, r, w, 0), leg(.3, .46, -.13, .46, .055, r, w, PI), leg(-.3, .46, .13, .46, .055, b, w, PI), leg(-.3, .46, -.13, .46, .055, b, w, 0));
      head.at(.5, .84, 0);
      hs.add(S(.16, b, 0, 0, 0), part(G.cyl(.07, .09, .18, 8), w, .17, -.05, 0).rotate(0, 0, -PI / 2), S(.035, '#111', .27, -.03, 0), part(G.box(.08, .16, .03), w, .1, .07, 0),
        S(.045, r, .09, -.06, .1), S(.045, r, .09, -.06, -.1), S(.02, r, .1, .08, .06), S(.02, r, .1, .08, -.06),
        part(G.box(.1, .18, .04), b, -.02, -.02, .16).rotate(.2, 0, 0), part(G.box(.1, .18, .04), b, -.02, -.02, -.16).rotate(-.2, 0, 0), part(G.cyl(.02, .02, .12, 5), '#e63946', .15, -.15, 0).rotate(0, 0, PI / 2));
    } else if (kind === 'cat') {
      const c = '#e08a3a', d = '#a85a1f';
      s.add(part(G.sphere(.15, 8, 6), c, 0, .28, 0).scale(1.6, .8, .7), rod([-.22, .3, 0], [-.3, .5, 0], .025, c), rod([-.3, .5, 0], [-.24, .62, 0], .022, d));
      for (let i = 0; i < 3; i++) s.add(part(G.box(.03, .2, .22), d, -.1 + i * .1, .32, 0));
      legs([[.13, .06], [.13, -.06], [-.13, .06], [-.13, -.06]], .22, .025, c, null);
      head.at(.25, .4, 0);
      hs.add(S(.1, c, 0, 0, 0), S(.045, '#f6efe6', .08, -.03, 0), S(.012, '#e8a0a8', .1, -.01, 0),
        part(G.cyl(0, .045, .09, 4), c, -.01, .1, .05), part(G.cyl(0, .045, .09, 4), c, -.01, .1, -.05));
    } else { // Dachs
      const c = '#6e6e70';
      s.add(part(G.sphere(.3, 10, 7), c, 0, .33, 0).scale(1.55, .62, .95), part(G.sphere(.28, 10, 7), '#2b2b2d', 0, .24, 0).scale(1.5, .45, .9), S(.08, c, -.45, .34, 0));
      legs([[.25, .18], [.25, -.18], [-.25, .18], [-.25, -.18]], .2, .055, '#222', null);
      head.at(.42, .34, 0);
      hs.add(part(G.cyl(.02, .15, .3, 8), '#f4f4f0', .12, 0, 0).rotate(0, 0, -PI / 2), part(G.box(.26, .05, .05), '#1b1b1b', .13, .06, .06).rotate(0, 0, -.12), part(G.box(.26, .05, .05), '#1b1b1b', .13, .06, -.06).rotate(0, 0, -.12),
        S(.03, '#111', .28, 0, 0), S(.04, '#f4f4f0', -.02, .1, .1), S(.04, '#f4f4f0', -.02, .1, -.1));
    }
    // Gesicht: Augen, Maul-/Mundlinie, Nase bzw. Nüstern (artgerecht, auf der Oberfläche statt im Kopf versteckt)
    { const K = { calf: .55, piglet: .45, pigletF: .5, kid: .55, ibexF: .85, stag: 1.3 }[kind] || 1, sc = a => a.map(v => v * K), D = '#2a1a14';
      const m = (p, q, w) => hs.add(rod(sc(p), sc(q), (w || .01) * K, D));
      const V = (tip, back, zw, w) => { m(tip, [back[0], back[1], zw], w); m(tip, [back[0], back[1], -zw], w); };   // Maullinie zu beiden Mundwinkeln
      const E = (c, r, d, er, iris) => eyes(hs, sc(c), sc(r), d, er * K, iris), dot = (x, y, z, r, col) => hs.add(S(r * K, col || D, x * K, y * K, z * K));
      switch (kind) {
        case 'bear': E([.1, 0, 0], [.32, .32, .32], [.62, .42, .62], .04, '#3a2414'); m([.55, -.07, 0], [.545, -.13, 0], .012); V([.545, -.13, 0], [.42, -.175], .09, .012); break;
        case 'deer': case 'stag': E([.06, 0, 0], [.2025, .15, .1425], [.35, .4, .85], .034); V([.25, -.07, 0], [.15, -.12], .07, .009); break;
        case 'wolf': E([0, 0, 0], [.18, .18, .18], [.72, .4, .56], .028, '#e8b923'); V([.36, -.055, 0], [.18, -.1], .05, .011); break;
        case 'fox': E([0, 0, 0], [.15, .15, .15], [.72, .42, .55], .024, '#e09a1a'); V([.3, -.05, 0], [.15, -.09], .045, .01); break;
        case 'hare': E([.04, 0, 0], [.12, .12, .12], [.32, .38, .87], .026, '#5a3a1a'); m([.155, -.04, 0], [.15, -.06, 0], .007); V([.15, -.06, 0], [.13, -.07], .025, .007); break;
        case 'squirrel': E([.03, 0, 0], [.085, .085, .085], [.4, .42, .82], .019); dot(.114, -.01, 0, .012); m([.113, -.022, 0], [.1, -.045, 0], .005); break;
        case 'boar': case 'piglet': E([.05, 0, 0], [.288, .24, .216], [.45, .5, .74], .026, '#3a2414'); dot(.42, -.04, .035, .024); dot(.42, -.04, -.035, .024); V([.4, -.15, 0], [.2, -.17], .1, .014); break;
        case 'hedgehog': E([.06, 0, 0], [.11, .05, .05], [.2, .6, .75], .02); V([.15, -.016, 0], [.08, -.045], .022, .006); break;
        case 'ibex': case 'ibexF': case 'kid': E([.05, 0, 0], [.195, .1425, .135], [.3, .45, .84], .026, '#b8862a'); dot(.295, -.035, .025, .013); dot(.295, -.035, -.025, .013); V([.29, -.085, 0], [.2, -.115], .05, .009); break;
        case 'chamois': E([.05, 0, 0], [.168, .114, .102], [.3, .45, .84], .022, '#5a3a1a'); V([.235, -.055, 0], [.15, -.075], .045, .008); break;
        case 'cow': case 'calf': eyes(hs, sc([.18, .07, 0]), [1, 1, .155 * K], [0, 0, 1], .036 * K, '#3a2414'); m([.413, -.13, -.1], [.413, -.13, .1], .012); m([.413, -.13, .1], [.34, -.14, .152], .012); m([.413, -.13, -.1], [.34, -.14, -.152], .012); break;
        case 'sheep': E([.08, -.02, 0], [.1755, .13, .1105], [.32, .42, .85], .022, '#c9a227'); dot(.25, -.03, .022, .012); dot(.25, -.03, -.022, .012); m([.255, -.045, 0], [.25, -.07, 0], .007); V([.25, -.07, 0], [.2, -.1], .04, .007); break;
        case 'goat': E([.07, 0, 0], [.174, .108, .096], [.3, .45, .84], .021, '#c9a227'); dot(.24, -.015, .02, .011); dot(.24, -.015, -.02, .011); m([.243, -.035, 0], [.24, -.055, 0], .007); V([.24, -.055, 0], [.17, -.075], .035, .007); break;
        case 'pig': case 'pigletF': E([.05, 0, 0], [.253, .23, .2185], [.5, .45, .74], .024, '#3a2414'); V([.3, -.16, 0], [.15, -.185], .1, .013); break;
        case 'hen': case 'rooster': E([0, 0, 0], [.075, .075, .075], [.35, .35, .87], .016, '#e0a020'); break;
        case 'dog': E([0, 0, 0], [.16, .16, .16], [.64, .45, .62], .026, '#5a3a1a'); m([.27, -.06, 0], [.265, -.105, 0], .009); V([.265, -.105, 0], [.12, -.13], .065, .01); break;
        case 'cat': E([0, 0, 0], [.1, .1, .1], [.66, .42, .62], .021, '#5aa83a'); dot(.125, -.008, 0, .014, '#e8a0a8'); m([.124, -.025, 0], [.12, -.045, 0], .005); V([.12, -.045, 0], [.105, -.06], .022, .005); break;
        case 'owl': break;
        default: E([.12, 0, 0], [.2, .088, .088], [0, .45, .89], .018); V([.27, -.03, 0], [.16, -.065], .03, .007);   // Dachs
      } }
    head.add(merge(hs)); head.phase = Math.random() * 10;
    body.add(merge(s), head, ...a);
    const sz = { bear: 1.1, stag: .9, deer: .75, wolf: .8, badger: .55, fox: .6, hare: .35, squirrel: .2, boar: .9, piglet: .4, hedgehog: .35, owl: .25, ibex: .7, ibexF: .6, kid: .4, chamois: .6, cow: 1.1, calf: .6, sheep: .55, goat: .55, pig: .7, pigletF: .35, hen: .2, rooster: .22, dog: .6, cat: .3 }[kind] || .8;
    root.add(part(G.cyl(1, 1, .01, 14), '#000000', 0, .02, 0, { alpha: .22 }).scale(sz, 1, sz * .55), body);
    root.anim = { legs: root.find('leg'), head, bob: body, kind };
    return root;
  }
  // Vogel mit schlagenden Flügeln: kind 'bird' (klein) oder 'hawk' (Bussard)
  function bird(kind) {
    const big = kind === 'hawk', k = big ? 1.6 : .5, c = big ? '#6b4a2e' : ['#2b2b30', '#7a5a3a', '#3a3f4a'][Math.floor(Math.random() * 3)];
    const root = new Node(), s = new Node();
    s.add(part(G.sphere(.18 * k, 8, 6), c, 0, 0, 0).scale(1.9, .8, .8), S(.12 * k, c, .3 * k, .05 * k, 0), part(G.cyl(0, .04 * k, .12 * k, 4), '#e0a02a', .44 * k, .04 * k, 0).rotate(0, 0, -PI / 2),
      part(G.box(.26 * k, .03 * k, .22 * k), c, -.38 * k, 0, 0));
    if (big) s.add(part(G.sphere(.1, 6, 4), '#e8dcc6', .05, -.08, 0).scale(2.2, .6, 1.2));
    eyes(s, [.3 * k, .05 * k, 0], [.12 * k, .12 * k, .12 * k], [.35, .3, .88], .024 * k, big ? '#e0a020' : null);
    root.add(merge(s));
    const wings = [];
    for (const sd of [-1, 1]) { const w = new Node(null, null, { name: 'wing' }).at(0, .03 * k, sd * .08 * k); w.side = sd;
      w.add(merge(new Node().add(part(G.box(.32 * k, .025 * k, .62 * k), shade(c, 1.1), -.02 * k, 0, sd * .31 * k), part(G.box(.22 * k, .02 * k, .32 * k), shade(c, .8), -.06 * k, 0, sd * .76 * k))));
      root.add(w); wings.push(w); }
    root.anim = { wings, big };
    return root;
  }
  function animateBird(b, t, phase) {
    const A = b.anim, glide = A.big && Math.sin(t * .5 + phase) > -.2;
    const a = glide ? .12 + Math.sin(t * 1.5 + phase) * .05 : Math.sin(t * (A.big ? 6 : 18) + phase) * .75;
    for (const w of A.wings) w.rot = [w.side * a, 0, 0];
  }

  // ---------- Teichbewohner ----------
  function pondCreature(kind, variant) {
    const root = new Node(), s = new Node(); root.anim = { kind };
    if (kind === 'fish') { const c = variant || '#ff7b29';
      s.add(part(G.sphere(.25, 10, 7), c, 0, 0, 0).scale(1.8, .7, .45), part(G.sphere(.12, 7, 5), shade(c, 1.15), .24, .02, 0).scale(1.2, .9, .9),
        S(.03, '#111', .38, .05, .075), S(.03, '#111', .38, .05, -.075), part(G.prism([[0, 0], [.2, .08], [.05, .22]], .02, 'fin'), shade(c, .8), -.06, .1, 0),
        part(G.box(.14, .02, .12), shade(c, .8), .05, -.12, .06).rotate(.4, 0, 0), part(G.box(.14, .02, .12), shade(c, .8), .05, -.12, -.06).rotate(-.4, 0, 0));
      s.add(part(G.sphere(.032, 6, 4), '#3a0f08', .382, -.035, 0).scale(.6, .6, 1.4));   // Fischmaul
      if (variant === '#f4f1ea') for (let i = 0; i < 4; i++) s.add(S(.07, '#e63946', -.15 + i * .12, .07 - (i % 2) * .05, .05 * (i % 2 ? 1 : -1)).scale(1.4, 1, .6)); // Koi-Flecken
      const tail = new Node(null, null, { name: 'tail' }).at(-.42, 0, 0);
      tail.add(merge(new Node().add(part(G.prism([[0, 0], [-.3, .22], [-.22, 0], [-.3, -.22]], .03, 'tailfin'), shade(c, .85), 0, 0, 0))));
      root.add(merge(s), tail); root.anim.tail = tail;
    } else if (kind === 'duck' || kind === 'duckling') { const baby = kind === 'duckling', k = baby ? .42 : 1, male = variant === 'male';
      const body = baby ? '#f2d14a' : male ? '#cfc8ba' : '#8a6a4a', head = baby ? '#f2d14a' : male ? '#1f6b3a' : '#7a5a3a';
      s.add(part(G.sphere(.32 * k, 10, 7), body, 0, .14 * k, 0).scale(1.45, .78, .95), part(G.cyl(0, .1 * k, .24 * k, 6), shade(body, .75), -.44 * k, .24 * k, 0).rotate(0, 0, PI / 2 + .55),
        part(G.cyl(.08 * k, .1 * k, .2 * k, 7), head, .3 * k, .32 * k, 0).rotate(0, 0, -.3), part(G.sphere(.15 * k, 8, 6), head, .36 * k, .45 * k, 0),
        part(G.box(.15 * k, .04 * k, .1 * k), '#f29e1c', .53 * k, .42 * k, 0));
      eyes(s, [.36 * k, .45 * k, 0], [.15 * k, .15 * k, .15 * k], [.35, .4, .85], .026 * k);
      if (male) s.add(part(G.cyl(.105, .11, .03, 10), '#ffffff', .31, .34, 0).rotate(0, 0, -.3), part(G.sphere(.24, 8, 5), '#6b4a3a', .18, .2, 0).scale(.8, .8, .9));
      if (!baby) s.add(part(G.sphere(.2, 8, 5), shade(body, .82), -.04, .22, .2).scale(1.4, .55, .5), part(G.sphere(.2, 8, 5), shade(body, .82), -.04, .22, -.2).scale(1.4, .55, .5),
        B(.08, .03, .1, '#3a5fcd', -.14, .24, .27), B(.08, .03, .1, '#3a5fcd', -.14, .24, -.27));
      root.add(merge(s));
    } else if (kind === 'frog') { const c = '#4f9a3a';
      s.add(part(G.sphere(.16, 9, 6), c, 0, .1, 0).scale(1.25, .7, 1.1), part(G.sphere(.12, 7, 5), '#c9d97a', .06, .06, 0).scale(1.2, .5, 1),
        S(.06, c, .12, .2, .08), S(.06, c, .12, .2, -.08), S(.04, '#f4f4e0', .15, .23, .09), S(.04, '#f4f4e0', .15, .23, -.09), S(.022, '#111', .18, .24, .09), S(.022, '#111', .18, .24, -.09),
        part(G.box(.24, .045, .08), shade(c, .82), -.1, .04, .15).rotate(0, .45, 0), part(G.box(.24, .045, .08), shade(c, .82), -.1, .04, -.15).rotate(0, -.45, 0),
        part(G.box(.12, .03, .05), shade(c, .82), .12, .03, .13), part(G.box(.12, .03, .05), shade(c, .82), .12, .03, -.13), B(.02, .012, .12, '#2b4a1e', .19, .11, 0));
      for (let i = 0; i < 5; i++) s.add(S(.025, '#2f6a2a', -.05 + (i % 3) * .07, .16, (i - 2) * .05));
      root.add(merge(s));
    } else if (kind === 'dragonfly') { const c = variant || '#3a86ff';
      s.add(part(G.cyl(.02, .012, .42, 5), c, -.14, 0, 0).rotate(0, 0, PI / 2), S(.045, c, .09, 0, 0), S(.032, '#1b1b1b', .13, .01, .028), S(.032, '#1b1b1b', .13, .01, -.028));
      root.add(merge(s)); const wings = [];
      for (const fz of [-1, 1]) for (const fx of [.05, -.04]) { const w = new Node(null, null, { name: 'wing' }).at(fx, .025, fz * .012); w.side = fz;
        w.add(part(G.box(.07, .006, .3), '#e6f6ff', 0, 0, fz * .15, { alpha: .55 })); root.add(w); wings.push(w); }
      root.anim.wings = wings;
    } else if (kind === 'heron') { const g = '#9aa3ab';
      s.add(part(G.sphere(.32, 9, 7), g, 0, 1.25, 0).scale(1.5, .8, .8), part(G.cyl(0, .13, .45, 6), shade(g, .72), -.52, 1.2, 0).rotate(0, 0, PI / 2 - .25),
        part(G.sphere(.26, 8, 5), shade(g, .8), -.05, 1.32, .18).scale(1.5, .5, .4), part(G.sphere(.26, 8, 5), shade(g, .8), -.05, 1.32, -.18).scale(1.5, .5, .4),
        rod([.3, 1.32, 0], [.44, 1.78, 0], .065, '#eef1f3'), S(.11, '#eef1f3', .48, 1.86, 0), part(G.cyl(0, .035, .34, 5), '#e0b13a', .7, 1.84, 0).rotate(0, 0, -PI / 2),
        rod([.42, 1.93, 0], [.18, 1.9, 0], .02, '#222'), S(.022, '#111', .55, 1.89, .07), S(.022, '#111', .55, 1.89, -.07),
        rod([0, 1.05, .08], [0, 0, .08], .025, '#c7a04a'), rod([0, 1.05, -.08], [.14, 0, -.08], .025, '#c7a04a'));
      root.add(merge(s));
    }
    return root;
  }

  // Tier-Animation: speed 0 (steht/äst) .. 1 (rennt); graze = Kopf zum Boden
  function animateAnimal(v, t, speed, graze) {
    const A = v.anim, hop = A.kind === 'hare' || A.kind === 'squirrel', f = hop ? 9 : 3 + speed * 9;
    for (const l of A.legs) l.rot[2] = hop ? (speed > .02 ? -Math.abs(Math.sin(t * f)) * .8 : 0) : Math.sin(t * f + l.phase) * (speed > .02 ? .2 + speed * .35 : 0);
    A.bob.pos[1] = speed > .02 ? Math.abs(Math.sin(t * f)) * (hop ? .22 : .02 + speed * .05) : 0;
    if (hop) A.bob.rot = [0, 0, speed > .02 ? Math.sin(t * f) * .15 : 0];
    if (A.kind === 'owl') { A.head.rot[1] = Math.sin(t * .35 + A.head.phase) * 1.4 * (Math.sin(t * .13) > 0 ? 1 : .2); return; }
    const want = graze ? -.9 : Math.sin(t * .6 + A.head.phase) * .08;
    A.head.rot[2] += (want - A.head.rot[2]) * .06;
    A.head.rot[1] = graze ? 0 : Math.sin(t * .4 + A.head.phase) * .35;
  }

  // Komplettes Fahrzeug inkl. Fahrer und Schatten
  function build(look) {
    const L = { ...DEFAULT, ...(look || {}) };
    if (L.goldPaint) L.color = GOLD;
    if (L.pattern === 'gold') { L.suit = '#d9a514'; L.suit2 = '#fff3c4'; }
    const m = (V[L.vehicle] || V.rocket)(L), E = !!L.empty;   // empty: Fahrer ist ausgestiegen (Siegerpodest)
    const root = new Node(), bob = new Node(null, null, { name: 'bob' });
    const se = m.seat; let dr;
    const tilt = .55;
    if (m.steer) {                          // Lenkrad vor dem Fahrer, Fäuste umgreifen den Kranz
      const c = [se[0] + .42, se[1] + .34, 0];
      const sw = new Node().at(c[0], c[1], 0).rotate(0, 0, tilt), inner = new Node().rotate(0, PI / 2, 0);
      inner.add(part(G.torus(.16, .028, 18, 6), '#1e2024', 0, 0, 0), part(G.box(.3, .035, .03), '#555a60', 0, 0, 0), part(G.cyl(.05, .05, .05, 10), L.color, 0, 0, 0).rotate(PI / 2, 0, 0));
      sw.add(inner);
      if (!E) for (const sd of [-1, 1]) sw.add(fist(L.skin).at(0, .02, sd * .16));
      m.s.add(sw, rod(c, [c[0] + .3, c[1] - .32, 0], .03, '#2b2d31'));
      // Griffpunkt (Handfläche) in Fahrzeugkoordinaten
      const px = -.055 * Math.cos(tilt) - .02 * Math.sin(tilt), py = -.055 * Math.sin(tilt) + .02 * Math.cos(tilt);
      dr = driver(L, [c[0] + px - se[0], c[1] + py - se[1], .16], true);
    } else if (m.reins) {                   // Zügel / Leine: Fäuste umschliessen die Zügel
      const g = [.36, .3, .12]; dr = driver(L, g, true);
      for (const sd of [-1, 1]) {
        const hp = [se[0] + g[0] + .04, se[1] + g[1], sd * g[2]], bit = [m.reins[0], m.reins[1], sd * .09];
        if (!E) m.s.add(rod(hp, bit, .014, '#5a3b1e'), fist(L.skin).at(hp[0], hp[1], hp[2]).rotate(0, 0, -PI / 2 + Math.atan2(bit[1] - hp[1], bit[0] - hp[0])));
      }
      m.s.add(rod([m.reins[0], m.reins[1], -.1], [m.reins[0], m.reins[1], .1], .02, '#c0c7cf'));
    } else dr = driver(L);
    dr.body.pos = se.slice(); if (!E) m.s.add(dr.body);
    const headPivot = new Node(null, null, { name: 'head' }).at(se[0], se[1] + .5, se[2]);
    headPivot.add(merge(new Node().add(dr.head)));
    headPivot.phase = Math.random() * 10;
    if (!E) m.a.push(headPivot);
    if (L.flag) {                           // Siegerwimpel mit eigenen Initialen, flattert im Fahrtwind
      const bx = se[0] - .42, by = se[1] + .05, top = by + 1.45;
      m.s.add(rod([bx, by, -.16], [bx, top, -.16], .022, '#d9dde2'), S(.045, '#ffc61a', bx, top + .03, -.16));
      const pen = new Node(null, null, { name: 'pennant' }).at(bx, top - .08, -.16), cloth = new Node();
      const c2 = L.suit2 && L.suit2 !== L.color ? L.suit2 : '#ffffff';
      cloth.add(B(.62, .36, .025, L.color, -.32, -.16, 0), B(.62, .06, .03, c2, -.32, -.02, 0), B(.62, .06, .03, c2, -.32, -.3, 0),
        plate(L.initials || '?', .022, L.color).at(-.32, -.16, .016), plate(L.initials || '?', .022, L.color).at(-.32, -.16, -.016).rotate(0, PI, 0));
      pen.add(merge(cloth)); pen.phase = Math.random() * 6; m.a.push(pen);
    }
    bob.add(merge(m.s), ...m.a);
    if (L.goldPaint) {                      // Glitzer: kleine leuchtende Sterne kreisen ums Fahrzeug
      const sp = new Node(null, null, { name: 'sparkle' }).at(0, 1.1, 0);
      for (let i = 0; i < 9; i++) { const a = i / 9 * PI * 2, r = 1.1 + (i % 3) * .18;
        sp.add(part(G.box(.07, .07, .07), i % 2 ? '#fff4b8' : '#ffffff', Math.cos(a) * r, (i % 3 - 1) * .3, Math.sin(a) * r * .7, { emis: 1 }).rotate(.7, .7, 0)); }
      bob.add(sp);
    }
    root.add(part(G.cyl(1, 1, .01, 18), '#000000', 0, .02, 0, { alpha: .28 }).scale(1.35, 1, .7), bob);
    root.anim = { spin: root.find('spin'), legs: root.find('leg'), flames: root.find('flame'), heads: root.find('head'), pennants: root.find('pennant'), sparkles: root.find('sparkle'), bob };
    return root;
  }
  // Animation: speed 0..1 (Leerlauf..Turbo)
  function animate(v, t, speed) {
    const A = v.anim; if (!A) return;
    for (const w of A.spin) w.rot[1] -= (.04 + speed * .5);
    for (const l of A.legs) l.rot[2] = Math.sin(t * (4 + speed * 14) + l.phase) * (.25 + speed * .35);
    for (const f of A.flames) { const k = .55 + speed * .9 + Math.sin(t * 40 + f.id) * .12; f.scl = [k, .8 + speed * .4, .8 + speed * .4]; }
    for (const h of A.heads) {             // natürliche Kopfbewegung: Umschauen, Nicken, Neigen in Kurven
      const p = h.phase, look = Math.sin(t * .45 + p) * .28 + Math.sin(t * 1.3 + p * 2) * .06 + (Math.sin(t * .17 + p) > .8 ? .35 : 0) * (speed < .5 ? 1 : .3);
      h.rot = [Math.sin(t * .8 + p) * .06, look * (1 - speed * .6), -.04 + Math.sin(t * (2 + speed * 8) + p) * (.03 + speed * .05) + speed * .12];
    }
    for (const p of A.pennants || []) p.rot = [Math.sin(t * (3 + speed * 9) + p.phase) * (.12 + speed * .2), Math.sin(t * 1.7 + p.phase) * .35 - speed * .4, 0];
    for (const s of A.sparkles || []) { s.rot = [0, t * .9, 0]; s.children.forEach((c, i) => { const k = .6 + .4 * Math.abs(Math.sin(t * 3 + i)); c.scl = [k, k, k]; }); }
    A.bob.pos[1] = Math.abs(Math.sin(t * (4 + speed * 10))) * (.025 + speed * .05);
  }

  window.Models = { REWARDS, GOLD, VEHICLES, HATS, GLASSES, PALETTE, SKINS, HAIRS, HAIR_COLORS, PATTERNS, DEFAULT, build, animate, shade, animal, animateAnimal, bird, animateBird, person, animatePerson, pondCreature, plate };
})();
