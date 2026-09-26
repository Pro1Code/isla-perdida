// Utilidades generales: matemáticas, ruido, generador aleatorio y ayudas de geometría
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const U = (G.U = {});

  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.smooth = (e0, e1, x) => {
    const t = U.clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  };
  U.angDiff = (a, b) => {
    let d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  };
  U.fmtClock = (t) => {
    const m = Math.floor(t * 24 * 60) % 1440;
    return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  };
  U.fmtSecs = (s) => {
    s = Math.max(0, Math.round(s));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  };

  // Generador pseudoaleatorio con semilla (mulberry32)
  U.rng = function (seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  // Ruido simplex 2D
  U.makeNoise = function (seed) {
    const r = U.rng(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      const t = p[i]; p[i] = p[j]; p[j] = t;
    }
    const perm = new Uint8Array(512), pm12 = new Uint8Array(512);
    for (let i = 0; i < 512; i++) { perm[i] = p[i & 255]; pm12[i] = perm[i] % 12; }
    const g = [1, 1, -1, 1, 1, -1, -1, -1, 1, 0, -1, 0, 1, 0, -1, 0, 0, 1, 0, -1, 0, 1, 0, -1];
    const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
    return function (xin, yin) {
      const s = (xin + yin) * F2;
      const i = Math.floor(xin + s), j = Math.floor(yin + s);
      const t = (i + j) * G2;
      const x0 = xin - (i - t), y0 = yin - (j - t);
      let i1, j1;
      if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
      const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
      const ii = i & 255, jj = j & 255;
      const g0 = pm12[ii + perm[jj]] * 2, g1 = pm12[ii + i1 + perm[jj + j1]] * 2, g2 = pm12[ii + 1 + perm[jj + 1]] * 2;
      let n0 = 0, n1 = 0, n2 = 0;
      let t0 = 0.5 - x0 * x0 - y0 * y0;
      if (t0 > 0) { t0 *= t0; n0 = t0 * t0 * (g[g0] * x0 + g[g0 + 1] * y0); }
      let t1 = 0.5 - x1 * x1 - y1 * y1;
      if (t1 > 0) { t1 *= t1; n1 = t1 * t1 * (g[g1] * x1 + g[g1 + 1] * y1); }
      let t2 = 0.5 - x2 * x2 - y2 * y2;
      if (t2 > 0) { t2 *= t2; n2 = t2 * t2 * (g[g2] * x2 + g[g2 + 1] * y2); }
      return 70 * (n0 + n1 + n2);
    };
  };
  U.fbm = (noise, x, y, oct) => {
    let a = 0.5, f = 1, s = 0, n = 0;
    for (let i = 0; i < oct; i++) { s += a * noise(x * f, y * f); n += a; a *= 0.5; f *= 2; }
    return s / n;
  };

  // Textura generada en un canvas
  U.canvasTex = (w, h, draw, srgb = true) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    return t;
  };

  // Pinta una geometría con color por vértice (con leve variación por triángulo)
  U.colored = (geo, color, jitter = 0.06, rnd = Math.random) => {
    if (geo.index) geo = geo.toNonIndexed();
    if (geo.attributes.uv) geo.deleteAttribute('uv');
    if (!geo.attributes.normal) geo.computeVertexNormals();
    const c = new THREE.Color(color);
    const n = geo.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i += 3) {
      const j = 1 + (rnd() - 0.5) * jitter * 2;
      for (let k = 0; k < 3 && i + k < n; k++) {
        arr[(i + k) * 3] = c.r * j;
        arr[(i + k) * 3 + 1] = c.g * j;
        arr[(i + k) * 3 + 2] = c.b * j;
      }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return geo;
  };

  // Esfera deformada orgánica (follaje, rocas)
  U.blob = (r, detail, amt, seed) => {
    let g = new THREE.IcosahedronGeometry(r, detail);
    g.deleteAttribute('normal');
    g.deleteAttribute('uv');
    g = window.mergeVertices(g);
    const p = g.attributes.position, v = new THREE.Vector3();
    const a = seed * 1.7;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const n = Math.sin(v.x * 2.3 / r + a) * Math.cos(v.y * 2.9 / r + a * 0.7) + Math.sin(v.z * 3.1 / r + v.x * 1.3 / r + a * 1.3) * 0.6;
      const k = 1 + n * amt * 0.5;
      p.setXYZ(i, v.x * k, v.y * k, v.z * k);
    }
    g.computeVertexNormals();
    return g;
  };

  U.merge = (geos) => {
    const m = window.mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    return m;
  };
})();
