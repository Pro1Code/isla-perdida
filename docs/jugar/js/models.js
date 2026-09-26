// Herramientas de modelado orgánico: cuerpos "loft" (secciones elípticas a lo largo de un eje),
// tubos curvos con grosor variable (patas, colas, ramas, tentáculos), tornos (barriles, botellas)
// y utilidades de color por vértice. Todo sale sin UV y con color, listo para fusionarse con U.merge.
(function () {
  'use strict';
  const G = window.G, U = G.U;
  const M = (G.Mdl = {});
  const V3 = THREE.Vector3, Col = THREE.Color;

  // Interpolación suave en una tabla [[x, v], ...] ordenada por x
  M.table = function (tab, x) {
    if (x <= tab[0][0]) return tab[0][1];
    for (let i = 1; i < tab.length; i++) {
      if (x <= tab[i][0]) {
        const [x0, v0] = tab[i - 1], [x1, v1] = tab[i];
        const t = (x - x0) / (x1 - x0), s = t * t * (3 - 2 * t);
        return v0 + (v1 - v0) * s;
      }
    }
    return tab[tab.length - 1][1];
  };
  const _c = new Col();
  const toCol = (c) => (c && c.isColor ? c : _c.set(c));

  // Convierte una malla indexada en triángulos sueltos con normales y color
  function finish(pos, idx, colors) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const out = g.toNonIndexed();
    g.dispose();
    return out;
  }

  // Cuerpo a lo largo del eje Z (t = 0 en z0, t = 1 en z1). prof(t) → { rx, ry, x, y, pw } (pw: forma superelíptica)
  // color(t, ang) → color; ang = 0 a un lado, π/2 arriba, -π/2 abajo
  M.loft = function (o) {
    const n = o.n || 24, m = o.m || 14, pos = [], cols = [], idx = [];
    const z0 = o.z0, z1 = o.z1;
    for (let i = 0; i <= n; i++) {
      const t = i / n, z = U.lerp(z0, z1, t), p = o.prof(t);
      const pw = p.pw || 2;
      for (let j = 0; j < m; j++) {
        const a = (j / m) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
        const k = pw === 2 ? 1 : Math.pow(Math.pow(Math.abs(ca), pw) + Math.pow(Math.abs(sa), pw), -1 / pw);
        pos.push((p.x || 0) + ca * p.rx * k, (p.y || 0) + sa * p.ry * k, z + (p.z || 0));
        const c = toCol(o.color ? o.color(t, a, ca, sa) : 0xffffff);
        cols.push(c.r, c.g, c.b);
      }
    }
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
      const a = i * m + j, b = i * m + (j + 1) % m, c = a + m, d = b + m;
      idx.push(a, c, b, b, c, d);
    }
    // Tapas en los extremos
    const cap = (i, flip) => {
      const p = o.prof(i / n), ci = pos.length / 3;
      pos.push(p.x || 0, p.y || 0, U.lerp(z0, z1, i / n) + (p.z || 0) + (flip ? 0.001 : -0.001));
      const c = toCol(o.color ? o.color(i / n, 0, 1, 0) : 0xffffff);
      cols.push(c.r, c.g, c.b);
      for (let j = 0; j < m; j++) {
        const a = i * m + j, b = i * m + (j + 1) % m;
        if (flip) idx.push(ci, a, b); else idx.push(ci, b, a);
      }
    };
    if (o.caps !== false) { cap(0, false); cap(n, true); }
    return finish(pos, idx, cols);
  };

  // Tubo por una curva con radio variable: pts = [[x,y,z],...], r(t) o [r0, r1]
  M.tube = function (pts, r, m = 7, color = 0xffffff, segs) {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new V3(p[0], p[1], p[2])));
    const n = segs || Math.max(6, pts.length * 4);
    const frames = curve.computeFrenetFrames(n, false);
    const rf = typeof r === 'function' ? r : (t) => U.lerp(r[0], r[1], t);
    const pos = [], cols = [], idx = [], P = new V3();
    for (let i = 0; i <= n; i++) {
      const t = i / n, R = rf(t);
      curve.getPointAt(t, P);
      const N = frames.normals[i], B = frames.binormals[i];
      for (let j = 0; j < m; j++) {
        const a = (j / m) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
        pos.push(P.x + (N.x * ca + B.x * sa) * R, P.y + (N.y * ca + B.y * sa) * R, P.z + (N.z * ca + B.z * sa) * R);
        const c = toCol(typeof color === 'function' ? color(t, a) : color);
        cols.push(c.r, c.g, c.b);
      }
    }
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
      const a = i * m + j, b = i * m + (j + 1) % m, c = a + m, d = b + m;
      idx.push(a, b, c, b, d, c);
    }
    const endCap = (i, flip) => {
      const ci = pos.length / 3, P2 = curve.getPointAt(i / n);
      pos.push(P2.x, P2.y, P2.z);
      const c = toCol(typeof color === 'function' ? color(i / n, 0) : color);
      cols.push(c.r, c.g, c.b);
      for (let j = 0; j < m; j++) { const a = i * m + j, b = i * m + (j + 1) % m; if (flip) idx.push(ci, a, b); else idx.push(ci, b, a); }
    };
    endCap(0, true); endCap(n, false);
    return finish(pos, idx, cols);
  };

  // Torno: perfil [[radio, y], ...] girado alrededor del eje Y
  M.lathe = function (profile, seg, color) {
    const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg || 16);
    return M.paint(g, color);
  };

  // Aplica color por vértice: color fijo o fn(x, y, z, nx, ny, nz) → color
  M.paint = function (geo, color, jitter = 0.03, rnd = Math.random) {
    if (geo.index) geo = geo.toNonIndexed();
    if (geo.attributes.uv) geo.deleteAttribute('uv');
    if (!geo.attributes.normal) geo.computeVertexNormals();
    const p = geo.attributes.position, n = geo.attributes.normal, cnt = p.count, arr = new Float32Array(cnt * 3);
    for (let i = 0; i < cnt; i += 3) {
      const j = 1 + (rnd() - 0.5) * jitter * 2;
      for (let k = 0; k < 3 && i + k < cnt; k++) {
        const v = i + k;
        const c = toCol(typeof color === 'function' ? color(p.getX(v), p.getY(v), p.getZ(v), n.getX(v), n.getY(v), n.getZ(v)) : color);
        arr[v * 3] = c.r * j; arr[v * 3 + 1] = c.g * j; arr[v * 3 + 2] = c.b * j;
      }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return geo;
  };
  // Recolorea una geometría ya pintada según una función (devuelve null para dejarla igual)
  M.recolor = function (geo, fn) {
    const p = geo.attributes.position, n = geo.attributes.normal, c = geo.attributes.color;
    for (let v = 0; v < p.count; v++) {
      const r = fn(p.getX(v), p.getY(v), p.getZ(v), n.getX(v), n.getY(v), n.getZ(v), c.getX(v), c.getY(v), c.getZ(v));
      if (r !== null && r !== undefined) { const cc = toCol(r); c.setXYZ(v, cc.r, cc.g, cc.b); }
    }
    return geo;
  };
  // Mueve / gira / escala una geometría
  M.xf = function (geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1) {
    if (Array.isArray(s)) geo.scale(s[0], s[1], s[2]); else if (s !== 1) geo.scale(s, s, s);
    if (rx) geo.rotateX(rx); if (ry) geo.rotateY(ry); if (rz) geo.rotateZ(rz);
    geo.translate(x, y, z);
    return geo;
  };
  // Esfera pintada (ojos, narices, bayas…)
  M.ball = (r, color, x, y, z, s, w = 10, h = 8) => M.xf(M.paint(new THREE.SphereGeometry(r, w, h), color, 0.02), x, y, z, 0, 0, 0, s || 1);
  // Ojo con brillo: blanco + pupila
  M.eye = function (r, x, y, z, iris = 0x1a1208, white = 0xf2efe6, dir = 1) {
    return [M.ball(r, white, x, y, z), M.ball(r * 0.62, iris, x + dir * r * 0.28, y + r * 0.05, z + r * 0.55)];
  };
  // Oreja / aleta: cono aplanado con color interior
  M.ear = function (w, h, color, inner, x, y, z, rx, ry, rz) {
    const g0 = new THREE.ConeGeometry(w, h, 8, 1);
    g0.scale(1, 1, 0.35);
    const g = M.paint(g0, (px, py, pz) => (inner && pz > 0.005 && py < h * 0.3 ? inner : color), 0.02);
    return M.xf(g, x, y, z, rx, ry, rz);
  };
  // Pata articulada: cadera → rodilla → tobillo → pie (tubo curvo con pezuña/pata al final)
  M.leg = function (top, knee, ankle, foot, r0, r1, color, footColor) {
    const parts = [M.tube([top, knee, ankle, foot], (t) => U.lerp(r0, r1, Math.pow(t, 0.8)) * (1 + 0.15 * Math.sin(t * Math.PI)), 8, color, 14)];
    if (footColor !== undefined) parts.push(M.ball(r1 * 1.25, footColor, foot[0], foot[1], foot[2] + r1 * 0.3, [1, 0.6, 1.4], 8, 6));
    return parts;
  };
  // Aleta / lámina con grosor: contorno 2D [[x,y],...] extruido (en el plano XY, grosor en Z)
  M.fin = function (pts, th, color) {
    const s = new THREE.Shape(pts.map((p) => new THREE.Vector2(p[0], p[1])));
    const g = new THREE.ExtrudeGeometry(s, { depth: th, bevelEnabled: true, bevelThickness: th * 0.4, bevelSize: th * 0.4, bevelSegments: 1, curveSegments: 6 });
    g.translate(0, 0, -th / 2);
    return M.paint(g, color, 0.02);
  };
  // Textura de lienzo (reutiliza U.canvasTex)
  M.canvas = (w, h, draw) => U.canvasTex(w, h, draw);
})();
