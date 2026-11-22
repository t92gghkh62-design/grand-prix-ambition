// mini3d – kleine, abhängigkeitsfreie WebGL-Engine (Low-Poly, flach schattiert)
(function () {
  'use strict';
  // ---------- Mathe (spaltenweise 4x4) ----------
  const M = {
    ident() { return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]); },
    mul(a, b) { const o = new Float32Array(16);
      for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
        o[c*4+r] = a[r]*b[c*4] + a[4+r]*b[c*4+1] + a[8+r]*b[c*4+2] + a[12+r]*b[c*4+3]; }
      return o; },
    persp(fovy, asp, n, f) { const t = 1 / Math.tan(fovy / 2), o = new Float32Array(16);
      o[0] = t / asp; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = 2 * f * n / (n - f); return o; },
    lookAt(e, c, u) {
      let zx = e[0]-c[0], zy = e[1]-c[1], zz = e[2]-c[2]; let l = Math.hypot(zx,zy,zz); zx/=l; zy/=l; zz/=l;
      let xx = u[1]*zz - u[2]*zy, xy = u[2]*zx - u[0]*zz, xz = u[0]*zy - u[1]*zx; l = Math.hypot(xx,xy,xz); xx/=l; xy/=l; xz/=l;
      const yx = zy*xz - zz*xy, yy = zz*xx - zx*xz, yz = zx*xy - zy*xx;
      return new Float32Array([xx,yx,zx,0, xy,yy,zy,0, xz,yz,zz,0,
        -(xx*e[0]+xy*e[1]+xz*e[2]), -(yx*e[0]+yy*e[1]+yz*e[2]), -(zx*e[0]+zy*e[1]+zz*e[2]), 1]); },
    // T * Ry * Rx * Rz * S
    trs(p, r, s) {
      const cx = Math.cos(r[0]), sx = Math.sin(r[0]), cy = Math.cos(r[1]), sy = Math.sin(r[1]), cz = Math.cos(r[2]), sz = Math.sin(r[2]);
      // R = Ry*Rx*Rz
      const m00 = cy*cz + sy*sx*sz, m01 = -cy*sz + sy*sx*cz, m02 = sy*cx;
      const m10 = cx*sz,           m11 = cx*cz,             m12 = -sx;
      const m20 = -sy*cz + cy*sx*sz, m21 = sy*sz + cy*sx*cz, m22 = cy*cx;
      return new Float32Array([m00*s[0], m10*s[0], m20*s[0], 0, m01*s[1], m11*s[1], m21*s[1], 0, m02*s[2], m12*s[2], m22*s[2], 0, p[0], p[1], p[2], 1]); },
    xform(m, v) { return [m[0]*v[0]+m[4]*v[1]+m[8]*v[2]+m[12], m[1]*v[0]+m[5]*v[1]+m[9]*v[2]+m[13], m[2]*v[0]+m[6]*v[1]+m[10]*v[2]+m[14]]; },
    normal3(m) { // inverse-transpose des 3x3-Teils
      const a = m[0], b = m[1], c = m[2], d = m[4], e = m[5], f = m[6], g = m[8], h = m[9], i = m[10];
      const A = e*i - f*h, B = -(d*i - f*g), C = d*h - e*g, det = a*A + b*B + c*C || 1e-9;
      return new Float32Array([A/det, B/det, C/det, -(b*i - c*h)/det, (a*i - c*g)/det, -(a*h - b*g)/det, (b*f - c*e)/det, -(a*f - c*d)/det, (a*e - b*d)/det]); }
  };

  // ---------- Geometrien (nicht indiziert, Flächennormalen) ----------
  function Builder() { this.p = []; this.n = []; this.c = null; }
  Builder.prototype.tri = function (a, b, c) {
    const ux = b[0]-a[0], uy = b[1]-a[1], uz = b[2]-a[2], vx = c[0]-a[0], vy = c[1]-a[1], vz = c[2]-a[2];
    let nx = uy*vz - uz*vy, ny = uz*vx - ux*vz, nz = ux*vy - uy*vx; const l = Math.hypot(nx, ny, nz) || 1; nx/=l; ny/=l; nz/=l;
    this.p.push(...a, ...b, ...c); this.n.push(nx,ny,nz, nx,ny,nz, nx,ny,nz);
  };
  Builder.prototype.quad = function (a, b, c, d) { this.tri(a, b, c); this.tri(a, c, d); };
  Builder.prototype.done = function () { return { pos: new Float32Array(this.p), nor: new Float32Array(this.n), col: this.c ? new Float32Array(this.c) : null, count: this.p.length / 3 }; };

  const cache = new Map();
  const cached = (key, fn) => { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); };
  const G = {
    box(w, h, d) { return cached(`box${w},${h},${d}`, () => { const B = new Builder(), x = w/2, y = h/2, z = d/2;
      const v = [[-x,-y,-z],[x,-y,-z],[x,y,-z],[-x,y,-z],[-x,-y,z],[x,-y,z],[x,y,z],[-x,y,z]];
      [[4,5,6,7],[1,0,3,2],[5,1,2,6],[0,4,7,3],[7,6,2,3],[0,1,5,4]].forEach(f => B.quad(v[f[0]], v[f[1]], v[f[2]], v[f[3]])); return B.done(); }); },
    // Zylinder/Kegel entlang Y, zentriert
    cyl(rt, rb, h, seg = 10) { return cached(`cyl${rt},${rb},${h},${seg}`, () => { const B = new Builder(), y = h/2;
      for (let i = 0; i < seg; i++) { const a0 = i/seg*Math.PI*2, a1 = (i+1)/seg*Math.PI*2;
        const t0 = [Math.cos(a0)*rt, y, Math.sin(a0)*rt], t1 = [Math.cos(a1)*rt, y, Math.sin(a1)*rt];
        const b0 = [Math.cos(a0)*rb, -y, Math.sin(a0)*rb], b1 = [Math.cos(a1)*rb, -y, Math.sin(a1)*rb];
        if (rt > 0) B.tri([0, y, 0], t1, t0);
        if (rb > 0) B.tri([0, -y, 0], b0, b1);
        if (rt > 0) B.quad(b0, b1, t1, t0); else B.tri(b0, b1, t0);
      } return B.done(); }); },
    sphere(r, ws = 10, hs = 7) { return cached(`sph${r},${ws},${hs}`, () => { const B = new Builder();
      const P = (i, j) => { const th = i/ws*Math.PI*2, ph = j/hs*Math.PI; return [Math.cos(th)*Math.sin(ph)*r, Math.cos(ph)*r, Math.sin(th)*Math.sin(ph)*r]; };
      for (let j = 0; j < hs; j++) for (let i = 0; i < ws; i++) {
        const a = P(i, j), b = P(i+1, j), c = P(i+1, j+1), d = P(i, j+1);
        if (j === 0) B.tri(a, c, d); else if (j === hs-1) B.tri(a, b, c); else B.quad(a, b, c, d);
      } return B.done(); }); },
    // Halbkugel (Kuppel, offen unten)
    dome(r, ws = 12, hs = 5) { return cached(`dome${r},${ws},${hs}`, () => { const B = new Builder();
      const P = (i, j) => { const th = i/ws*Math.PI*2, ph = j/hs*Math.PI/2; return [Math.cos(th)*Math.sin(ph)*r, Math.cos(ph)*r, Math.sin(th)*Math.sin(ph)*r]; };
      for (let j = 0; j < hs; j++) for (let i = 0; i < ws; i++) { const a = P(i, j), b = P(i+1, j), c = P(i+1, j+1), d = P(i, j+1); if (j === 0) B.tri(a, c, d); else B.quad(a, b, c, d); }
      for (let i = 0; i < ws; i++) B.tri([0, 0, 0], P(i+1, hs), P(i, hs));
      return B.done(); }); },
    // Torus in der XY-Ebene; arc in Radiant
    torus(R, r, seg = 16, ts = 6, arc = Math.PI * 2) { return cached(`tor${R},${r},${seg},${ts},${arc}`, () => { const B = new Builder();
      const P = (i, j) => { const u = i/seg*arc, v = j/ts*Math.PI*2, k = R + r*Math.cos(v); return [Math.cos(u)*k, Math.sin(u)*k, Math.sin(v)*r]; };
      for (let i = 0; i < seg; i++) for (let j = 0; j < ts; j++) B.quad(P(i, j), P(i+1, j), P(i+1, j+1), P(i, j+1));
      return B.done(); }); },
    // 2D-Polygon (XY, konvex oder sternförmig um Schwerpunkt) entlang Z extrudiert
    prism(pts, d, key) { return cached('pr' + key, () => { const B = new Builder(), z = d/2;
      let cx = 0, cy = 0; pts.forEach(p => { cx += p[0]; cy += p[1]; }); cx /= pts.length; cy /= pts.length;
      for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i+1) % pts.length];
        B.tri([cx, cy, z], [a[0], a[1], z], [b[0], b[1], z]); B.tri([cx, cy, -z], [b[0], b[1], -z], [a[0], a[1], -z]);
        B.quad([a[0], a[1], -z], [b[0], b[1], -z], [b[0], b[1], z], [a[0], a[1], z]); }
      return B.done(); }); },
    // Kugel-artiger Felsen mit Zufallsverformung
    rock(r, seed) { return cached(`rock${r},${seed}`, () => { const B = new Builder(); let s = seed;
      const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
      const ws = 7, hs = 5, jit = []; for (let k = 0; k < (ws+1)*(hs+1); k++) jit.push(.75 + rnd() * .5);
      const P = (i, j) => { const th = (i%ws)/ws*Math.PI*2, ph = j/hs*Math.PI, q = jit[(i%ws)+j*(ws+1)] * (j===0||j===hs ? 1 : 1);
        return [Math.cos(th)*Math.sin(ph)*r*q, Math.cos(ph)*r*.7*q, Math.sin(th)*Math.sin(ph)*r*q]; };
      for (let j = 0; j < hs; j++) for (let i = 0; i < ws; i++) { const a = P(i, j), b = P(i+1, j), c = P(i+1, j+1), d = P(i, j+1);
        if (j === 0) B.tri(a, c, d); else if (j === hs-1) B.tri(a, b, c); else B.quad(a, b, c, d); }
      return B.done(); }); },
    custom(builderFn) { const B = new Builder(); builderFn(B); return B.done(); },
    Builder
  };

  // ---------- Szenegraph ----------
  let nid = 0;
  class Node {
    constructor(geo, color, opt) {
      this.id = ++nid; this.geo = geo || null; this.color = color ? hex(color) : [1, 1, 1];
      this.pos = [0, 0, 0]; this.rot = [0, 0, 0]; this.scl = [1, 1, 1]; this.children = []; this.visible = true;
      this.emis = (opt && opt.emis) || 0; this.alpha = opt && opt.alpha != null ? opt.alpha : 1; this.name = opt && opt.name;
    }
    add(...c) { this.children.push(...c); return this; }
    at(x, y, z) { this.pos = [x, y, z]; return this; }
    rotate(x, y, z) { this.rot = [x, y, z]; return this; }
    scale(x, y, z) { this.scl = [x, y == null ? x : y, z == null ? x : z]; return this; }
    find(name, out = []) { if (this.name === name) out.push(this); this.children.forEach(c => c.find(name, out)); return out; }
    world(parent) { this.mw = parent ? M.mul(parent, M.trs(this.pos, this.rot, this.scl)) : M.trs(this.pos, this.rot, this.scl); this.children.forEach(c => c.world(this.mw)); }
  }
  function hex(c) { if (Array.isArray(c)) return c; const n = parseInt(c.slice(1), 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; }

  // Statische Teile zu einer Geometrie zusammenfassen (Farben in Vertices)
  function merge(root) {
    root.world(null); const P = [], N = [], C = [];
    (function walk(n) { if (!n.visible) return;
      if (n.geo) { const nm = M.normal3(n.mw), g = n.geo;
        for (let i = 0; i < g.count; i++) {
          const v = M.xform(n.mw, [g.pos[i*3], g.pos[i*3+1], g.pos[i*3+2]]); P.push(...v);
          const x = g.nor[i*3], y = g.nor[i*3+1], z = g.nor[i*3+2];
          let nx = nm[0]*x + nm[3]*y + nm[6]*z, ny = nm[1]*x + nm[4]*y + nm[7]*z, nz = nm[2]*x + nm[5]*y + nm[8]*z; const l = Math.hypot(nx, ny, nz) || 1;
          N.push(nx/l, ny/l, nz/l);
          if (g.col) C.push(g.col[i*3] * n.color[0], g.col[i*3+1] * n.color[1], g.col[i*3+2] * n.color[2]); else C.push(...n.color);
        } }
      n.children.forEach(walk); })(root);
    return new Node({ pos: new Float32Array(P), nor: new Float32Array(N), col: new Float32Array(C), count: P.length / 3 });
  }

  // ---------- Renderer ----------
  const VS = `attribute vec3 aP; attribute vec3 aN; attribute vec3 aC;
    uniform mat4 uM, uVP; uniform mat3 uNM; varying vec3 vN, vC, vW;
    void main(){ vec4 w = uM * vec4(aP, 1.0); vW = w.xyz; vN = uNM * aN; vC = aC; gl_Position = uVP * w; }`;
  const FS = `precision mediump float; varying vec3 vN, vC, vW;
    uniform vec3 uCol, uSun, uCam, uFog, uSky, uGround, uSunCol; uniform float uEmis, uAlpha, uFogN, uFogF, uAmb;
    void main(){
      vec3 N = normalize(vN); if (!gl_FrontFacing) N = -N;
      vec3 base = vC * uCol;
      float l = max(dot(N, uSun), 0.0);
      vec3 hemi = mix(uGround, uSky, N.y * 0.5 + 0.5);
      vec3 V = normalize(uCam - vW);
      float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0) * 0.18;
      vec3 c = base * (hemi * uAmb + uSunCol * l) + rim * uAmb;
      c = mix(c, base * 1.15, uEmis);
      float d = length(uCam - vW); float f = clamp((d - uFogN) / (uFogF - uFogN), 0.0, 1.0);
      gl_FragColor = vec4(mix(c, uFog, f * (1.0 - uEmis * 0.7)), uAlpha);
    }`;

  class Renderer {
    constructor(canvas) {
      this.canvas = canvas;
      const gl = canvas.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: false }) || canvas.getContext('experimental-webgl');
      if (!gl) throw new Error('WebGL nicht verfügbar');
      this.gl = gl;
      const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
      const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
      gl.bindAttribLocation(pr, 0, 'aP'); gl.bindAttribLocation(pr, 1, 'aN'); gl.bindAttribLocation(pr, 2, 'aC');
      gl.linkProgram(pr); gl.useProgram(pr); this.pr = pr;
      this.u = {}; ['uM','uVP','uNM','uCol','uSun','uCam','uFog','uSky','uGround','uEmis','uAlpha','uFogN','uFogF','uSunCol','uAmb'].forEach(n => this.u[n] = gl.getUniformLocation(pr, n));
      this.bufs = new WeakMap();
      gl.enable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      this.env = { sun: norm([0.45, 0.8, 0.35]), sky: [0.78, 0.88, 1.0], ground: [0.32, 0.36, 0.26], fog: [0.72, 0.84, 0.86], fogN: 40, fogF: 140, sunCol: [.78, .741, .663], amb: .62 };
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    }
    size() { const c = this.canvas, w = Math.round(c.clientWidth * this.dpr), h = Math.round(c.clientHeight * this.dpr);
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; } return [w, h]; }
    buf(g) { let b = this.bufs.get(g); if (b) return b; const gl = this.gl; b = {};
      for (const k of ['pos', 'nor', 'col']) if (g[k]) { b[k] = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b[k]); gl.bufferData(gl.ARRAY_BUFFER, g[k], gl.STATIC_DRAW); }
      this.bufs.set(g, b); return b; }
    render(roots, cam) {
      const gl = this.gl, [w, h] = this.size(); gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const P = M.persp(cam.fov, w / h, cam.near || .3, cam.far || 400), V = M.lookAt(cam.pos, cam.target, [0, 1, 0]);
      this.vp = M.mul(P, V); this.w = w; this.h = h;
      const u = this.u, e = this.env;
      gl.uniformMatrix4fv(u.uVP, false, this.vp); gl.uniform3fv(u.uSun, e.sun); gl.uniform3fv(u.uCam, cam.pos);
      gl.uniform3fv(u.uFog, e.fog); gl.uniform3fv(u.uSky, e.sky); gl.uniform3fv(u.uGround, e.ground); gl.uniform1f(u.uFogN, e.fogN); gl.uniform1f(u.uFogF, e.fogF); gl.uniform3fv(u.uSunCol, e.sunCol); gl.uniform1f(u.uAmb, e.amb);
      const trans = [], st = this.stats = { calls: 0, culled: 0, tris: 0 }, vp = this.vp;
      // Frustum-Ebenen (für Knoten mit n.cull = Radius in Weltmetern)
      const row = i => [vp[i], vp[4 + i], vp[8 + i], vp[12 + i]], r0 = row(0), r1 = row(1), r2 = row(2), r3 = row(3);
      const planes = [[1, r0], [-1, r0], [1, r1], [-1, r1], [1, r2], [-1, r2]].map(([s, r]) => { const p = r3.map((v, i) => v + s * r[i]), l = Math.hypot(p[0], p[1], p[2]) || 1; return p.map(v => v / l); });
      const visible = (m, rad) => { for (const p of planes) if (p[0] * m[12] + p[1] * m[13] + p[2] * m[14] + p[3] < -rad) return false; return true; };
      const draw = n => { st.calls++; st.tris += n.geo.count / 3;
        const g = n.geo, b = this.buf(g);
        gl.uniformMatrix4fv(u.uM, false, n.mw); gl.uniformMatrix3fv(u.uNM, false, M.normal3(n.mw));
        gl.uniform3fv(u.uCol, n.color); gl.uniform1f(u.uEmis, n.emis); gl.uniform1f(u.uAlpha, n.alpha);
        gl.bindBuffer(gl.ARRAY_BUFFER, b.pos); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, b.nor); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
        if (b.col) { gl.bindBuffer(gl.ARRAY_BUFFER, b.col); gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 0, 0); }
        else { gl.disableVertexAttribArray(2); gl.vertexAttrib3f(2, 1, 1, 1); }
        gl.drawArrays(gl.TRIANGLES, 0, g.count);
      };
      const walk = n => { if (!n.visible) return; if (n.cull && !visible(n.mw, n.cull)) { st.culled++; return; } if (n.geo) { if (n.alpha < 1) trans.push(n); else draw(n); } n.children.forEach(walk); };
      for (const r of roots) { r.world(null); walk(r); }
      gl.depthMask(false); gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-1, -1);
      trans.forEach(draw);
      gl.depthMask(true); gl.disable(gl.POLYGON_OFFSET_FILL);
    }
    // Weltpunkt → Bildschirm (CSS-Pixel); null wenn hinter der Kamera
    project(p) { const m = this.vp, x = m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12], y = m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13], wv = m[3]*p[0]+m[7]*p[1]+m[11]*p[2]+m[15];
      if (wv <= 0.01) return null; const c = this.canvas; return [(x / wv * .5 + .5) * c.clientWidth, (1 - (y / wv * .5 + .5)) * c.clientHeight, wv]; }
  }
  const norm = v => { const l = Math.hypot(...v); return v.map(x => x / l); };

  // ---------- Kurve (Catmull-Rom, gleichmässig nach Länge) ----------
  class Path {
    constructor(pts, samples = 600) {
      const cr = (p0, p1, p2, p3, t) => { const t2 = t*t, t3 = t2*t; return p1.map((_, k) => .5 * ((2*p1[k]) + (-p0[k]+p2[k])*t + (2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*t2 + (-p0[k]+3*p1[k]-3*p2[k]+p3[k])*t3)); };
      const raw = [];
      for (let i = 0; i < samples; i++) { const f = i / (samples - 1) * (pts.length - 1), s = Math.min(Math.floor(f), pts.length - 2), t = f - s;
        raw.push(cr(pts[Math.max(0, s-1)], pts[s], pts[s+1], pts[Math.min(pts.length-1, s+2)], t)); }
      this.pts = raw; this.len = [0];
      for (let i = 1; i < raw.length; i++) this.len.push(this.len[i-1] + Math.hypot(raw[i][0]-raw[i-1][0], raw[i][1]-raw[i-1][1], raw[i][2]-raw[i-1][2]));
      this.total = this.len[this.len.length - 1];
    }
    at(t) { t = Math.max(0, Math.min(1, t)); const d = t * this.total; let lo = 0, hi = this.len.length - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (this.len[m] < d) lo = m; else hi = m; }
      const f = (d - this.len[lo]) / ((this.len[hi] - this.len[lo]) || 1), a = this.pts[lo], b = this.pts[hi];
      const p = a.map((v, k) => v + (b[k] - v) * f); let tx = b[0]-a[0], tz = b[2]-a[2]; const l = Math.hypot(tx, tz) || 1;
      return { p, tan: [tx/l, 0, tz/l], side: [-tz/l, 0, tx/l] }; }
    dist(x, z) { let best = 1e9; for (let i = 0; i < this.pts.length; i += 3) { const q = this.pts[i], d = (q[0]-x)**2 + (q[2]-z)**2; if (d < best) best = d; } return Math.sqrt(best); }
  }

  window.Mini3D = { M, G, Node, merge, Renderer, Path, hex };
})();
