// Barcos: balsa, canoa, bote de vela, lancha de vapor y barco pirata.
// - Modelos detallados (casco de tablones, velas, timón, cañones, camarote, mascarón, bandera)
// - Física: viento, remos, motor de carbón, olas, encallar, remolinos
// - Se camina por la cubierta mientras el barco se mueve (posición del jugador en coordenadas del barco)
// - Timón manual o piloto automático, cañones, red de pesca, caja de repuestos y reparación
// - Astillero: el plano muestra el barco como holograma y cada pieza se coloca donde brilla
(function () {
  'use strict';
  const G = window.G, U = G.U, M = G.Mdl;
  const V3 = THREE.Vector3;
  const S = (G.Ships = { list: [], proj: [], fx: [], nextId: 1, ghost: null, ghostType: null, rot: 0 });

  // ------------------------------------------------------------------ tipos
  const DEF = (S.DEF = {
    balsa: { name: 'Balsa', icon: '⛵', L: 4.4, W: 3.1, hp: 70, speed: 5, turn: 0.55, accel: 0.5, sail: true, small: true, deckY: 0.42, draft: 0.25, rail: 0, crate: 4, rep: 'rep_balsa', rect: true },
    canoa: { name: 'Canoa', icon: '🛶', L: 5.8, W: 1.35, hp: 80, speed: 7.5, turn: 0.9, accel: 0.9, paddle: true, small: true, deckY: 0.26, draft: 0.2, rail: 0.34, crate: 4, rep: 'rep_canoa', seated: true, bowP: 2, sternP: 2 },
    velero: { name: 'Bote de vela', icon: '⛵', L: 9, W: 3.3, hp: 180, speed: 10.5, turn: 0.42, accel: 0.35, sail: true, deckY: 0.9, draft: 0.7, rail: 0.85, crate: 8, rep: 'rep_velero', net: true, bowP: 2.2, sternP: 5, sheer: 0.35 },
    lancha: { name: 'Lancha de vapor', icon: '🚤', L: 8.6, W: 3.1, hp: 230, speed: 12.5, turn: 0.5, accel: 0.45, engine: true, deckY: 0.85, draft: 0.7, rail: 0.8, crate: 8, rep: 'rep_lancha', net: true, bowP: 2.4, sternP: 6, sheer: 0.25 },
    barco: { name: 'Barco pirata', icon: '🏴‍☠️', L: 18, W: 5.6, hp: 520, speed: 11, turn: 0.28, accel: 0.22, sail: true, deckY: 1.6, draft: 1.4, rail: 1.0, crate: 16, rep: 'rep_barco', net: true, bowP: 2.0, sternP: 6, sheer: 0.9, beds: 2 },
  });
  // Piezas del astillero: clave → { nombre, objetos necesarios }
  const PIECES = (S.PIECES = {
    velero: [['casco', 'Casco', { pieza_casco: 1 }], ['cubierta', 'Cubierta', { tabla: 12, clavos: 6 }], ['mastil', 'Mástil', { pieza_mastil: 1 }], ['vela', 'Velas', { pieza_vela: 1 }], ['timon', 'Timón', { pieza_timon: 1 }], ['caja', 'Caja de repuestos', { tabla: 4, clavos: 2 }]],
    lancha: [['casco', 'Casco reforzado', { pieza_casco_hierro: 1 }], ['cubierta', 'Cubierta', { tabla: 10, clavos: 6 }], ['caldera', 'Caldera y chimenea', { pieza_caldera: 1 }], ['helice', 'Hélice', { pieza_helice: 1 }], ['timon', 'Timón y cabina', { pieza_timon: 1, tabla: 6 }], ['canon0', 'Cañón de proa', { canon: 1 }], ['caja', 'Caja de repuestos', { tabla: 4, clavos: 2 }]],
    barco: [['casco', 'Casco (quilla y costados)', { pieza_casco: 2 }], ['cubierta', 'Cubierta', { tabla: 30, clavos: 16 }], ['camarote', 'Camarote con literas', { pieza_camarote: 1 }], ['mastil', 'Palo mayor', { pieza_mastil: 1 }], ['mastil2', 'Palo trinquete', { pieza_mastil: 1 }],
      ['vela', 'Velas mayores', { pieza_vela: 2 }], ['vela2', 'Velas del trinquete', { pieza_vela: 1 }], ['timon', 'Timón', { pieza_timon: 1 }], ['canon0', 'Cañón (babor)', { canon: 1 }], ['canon1', 'Cañón (estribor)', { canon: 1 }],
      ['canon2', 'Cañón (babor)', { canon: 1 }], ['canon3', 'Cañón (estribor)', { canon: 1 }], ['mascaron', 'Mascarón de proa', { mascaron: 1 }], ['bandera', 'Bandera pirata', { bandera: 1 }], ['caja', 'Caja de repuestos', { tabla: 6, clavos: 4 }]],
  });
  S.FIGUREHEADS = ['oveja', 'leon', 'dragon', 'calavera'];
  S.FH_NAMES = { oveja: 'Oveja', leon: 'León', dragon: 'Dragón', calavera: 'Calavera' };
  const fhName = (k) => S.FH_NAMES[k] || (G.Shop && G.Shop.fhName[k]) || k;
  S.SAILS = [0xeee6d2, 0xc8322a, 0x2a2a2e, 0x2e5a9a, 0xe8b83c];
  const NAMES = { oveja: 'Oveja Alegre', leon: 'Sol de los Mil Mares', dragon: 'Dragón Errante', calavera: 'Calavera Negra' };
  const shipName = (fh) => NAMES[fh] || (G.Shop && G.Shop.shipName[fh]) || 'Oveja Alegre';

  // ------------------------------------------------------------------ utilidades de forma
  function halfW(d, z) {
    if (d.rect) return Math.abs(z) <= d.L / 2 ? d.W / 2 : 0;
    const h = d.L / 2, t = z / h;
    if (t >= 1 || t <= -1) return 0;
    return t > 0 ? d.W / 2 * Math.pow(Math.max(0, 1 - Math.pow(t, d.bowP || 2.2)), 0.5) : d.W / 2 * Math.pow(Math.max(0, 1 - Math.pow(-t, d.sternP || 5)), 0.5);
  }
  S.halfW = halfW;
  const gunwale = (d, z) => d.deckY + d.rail + (d.sheer || 0) * Math.pow(z / (d.L / 2), 2);

  // Casco de tablones: secciones en U desde la borda de babor hasta la de estribor
  function hullGeo(d, colors) {
    const n = 30, m = 16, p = d.hullP || 2.6, h = d.L / 2;
    const pos = [], col = [], idx = [];
    const cc = new THREE.Color();
    const pick = (x, y, z, top) => {
      if (y < 0.06) return colors.bottom;
      if (y > top - 0.12) return colors.wale;
      if (colors.gunports && y > d.deckY + 0.15 && y < d.deckY + 0.75) for (const gp of colors.gunports) if (Math.abs(z - gp) < 0.35) return 0x1a1410;
      if (colors.rivets && (Math.abs(Math.sin(z * 9)) > 0.97 || Math.abs(Math.sin(y * 10)) > 0.985)) return colors.rivets;
      return Math.floor((top - y) / 0.28) % 2 ? colors.a : colors.b;
    };
    for (let i = 0; i <= n; i++) {
      const z = -h + d.L * i / n, t = z / h;
      const hw = Math.max(0.02, halfW(d, z * 0.999));
      const top = gunwale(d, z), depth = d.draft * (1 - 0.55 * Math.pow(Math.abs(t), 3)) + 0.05;
      for (let j = 0; j <= m; j++) {
        const th = Math.PI * j / m, cx = -Math.cos(th), sy = Math.sin(th);
        const x = hw * Math.sign(cx) * Math.pow(Math.abs(cx), 2 / p), y = top - (top + depth) * Math.pow(sy, 2 / p);
        pos.push(x, y, z);
        cc.set(pick(x, y, z, top));
        col.push(cc.r, cc.g, cc.b);
      }
    }
    const R = m + 1;
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
      const a = i * R + j, b = a + 1, c = a + R, e = c + 1;
      idx.push(a, b, c, b, e, c);
    }
    // Espejo de popa (tapa plana)
    const ci = pos.length / 3, t0 = gunwale(d, -h);
    pos.push(0, (t0 - d.draft) / 2, -h);
    cc.set(colors.b); col.push(cc.r, cc.g, cc.b);
    for (let j = 0; j < m; j++) idx.push(ci, j + 1, j);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const out = g.toNonIndexed();
    g.dispose();
    return out;
  }
  // Contorno de la cubierta (para la forma de las tablas y las colisiones)
  function outline(d, inset) {
    const pts = [], h = d.L / 2, n = 24;
    for (let i = 0; i <= n; i++) { const z = -h + d.L * i / n; pts.push([Math.max(0.05, halfW(d, z * 0.999) - inset), z]); }
    return pts;
  }
  function deckGeo(d, c1 = 0xb88a54, c2 = 0xa47a48) {
    const o = outline(d, 0.06), shape = new THREE.Shape();
    shape.moveTo(o[0][0], -o[0][1]);
    for (const [x, z] of o) shape.lineTo(x, -z);
    for (let i = o.length - 1; i >= 0; i--) shape.lineTo(-o[i][0], -o[i][1]);
    const g = new THREE.ShapeGeometry(shape, 4);
    g.rotateX(-Math.PI / 2);
    g.translate(0, d.deckY, 0);
    return M.paint(g, (x) => (Math.floor((x + 5) / 0.2) % 2 ? c1 : c2), 0.03);
  }
  // Barandilla superior de la borda
  function railGeo(d, color) {
    const parts = [];
    for (const s of [-1, 1]) {
      const pts = [];
      for (let i = 0; i <= 16; i++) { const z = -d.L / 2 + d.L * i / 16; pts.push([s * Math.max(0.03, halfW(d, z * 0.999)), gunwale(d, z) + 0.03, z]); }
      parts.push(M.tube(pts, [0.06, 0.06], 5, color, 40));
    }
    return parts;
  }

  // ------------------------------------------------------------------ piezas del modelo
  const wood = 0x6a4428, darkWood = 0x3a2616;
  function mastGeo(x, y0, z, H, r = 0.14) {
    return [M.xf(M.paint(new THREE.CylinderGeometry(r * 0.65, r, H, 10), 0x8a5e34), x, y0 + H / 2, z)];
  }
  function yard(x, y, z, w, r = 0.07) { return M.xf(M.paint(new THREE.CylinderGeometry(r * 0.7, r, w, 8), 0x7a5230), x, y, z, 0, 0, Math.PI / 2); }
  // Vela cuadrada (arriba en y = 0) con abolsado; se enrolla escalando en Y
  function squareSail(w, h, color, emblem) {
    const fine = G.Shop && G.Shop.isSailDesign(color);
    const g = new THREE.PlaneGeometry(w, h, fine ? 40 : 10, fine ? 34 : 8);
    g.translate(0, -h / 2, 0);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const u = p.getX(i) / w + 0.5, v = -p.getY(i) / h; p.setZ(i, Math.sin(Math.PI * u) * Math.sin(Math.PI * Math.min(1, v * 1.05)) * 0.55); }
    g.computeVertexNormals();
    if (G.Shop && G.Shop.isSailDesign(color)) return M.paint(g, G.Shop.sailPaint(color, g, 'x'), 0.01);
    const c = new THREE.Color(color), e = new THREE.Color(0x1a1a1a);
    return M.paint(g, (x, y) => (emblem && Math.hypot(x, y + h * 0.5) < h * 0.22 && Math.hypot(x, y + h * 0.5) > h * 0.12 ? e : c), 0.01);
  }
  // Vela triangular entre tres puntos (en el plano YZ), abolsada hacia X
  function triSail(A, B, C, color, billow = 0.4) {
    const n = G.Shop && G.Shop.isSailDesign(color) ? 30 : 8, pos = [], idx = [], row = [];
    let k = 0;
    for (let i = 0; i <= n; i++) {
      row.push(k);
      for (let j = 0; j <= n - i; j++) {
        const u = i / n, v = j / n, w = 1 - u - v;
        const x = A[0] * w + B[0] * u + C[0] * v, y = A[1] * w + B[1] * u + C[1] * v, z = A[2] * w + B[2] * u + C[2] * v;
        pos.push(x + Math.sin(Math.PI * (u + v)) * Math.sin(Math.PI * Math.min(1, w + 0.2)) * billow * 0.7, y, z);
        k++;
      }
    }
    for (let i = 0; i < n; i++) for (let j = 0; j < n - i; j++) {
      const a = row[i] + j, b = row[i + 1] + j;
      idx.push(a, b, a + 1);
      if (j < n - i - 1) idx.push(a + 1, b, b + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return M.paint(g, G.Shop && G.Shop.isSailDesign(color) ? G.Shop.sailPaint(color, g, 'z') : color, 0.01);
  }
  function shrouds(mx, mz, top, d, zOff = 0) {
    const out = [];
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
      const z = mz + zOff + (k - 1) * 0.5;
      out.push(M.tube([[mx, top, mz], [s * (halfW(d, z) - 0.05), gunwale(d, z), z]], [0.015, 0.015], 4, 0x2a2016, 3));
    }
    return out;
  }
  function wheelGeo(x, y, z, r = 0.5) {
    const parts = [M.xf(M.paint(new THREE.TorusGeometry(r, 0.04, 6, 24), 0x7a5230), 0, 0, 0)];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      parts.push(M.xf(M.paint(new THREE.CylinderGeometry(0.02, 0.025, r * 2 + 0.3, 5), 0x7a5230), 0, 0, 0, 0, 0, a));
    }
    parts.push(M.xf(M.paint(new THREE.CylinderGeometry(0.08, 0.08, 0.12, 12), 0xc8a050), 0, 0, 0, Math.PI / 2));
    const wheel = U.merge(parts);
    wheel.translate(x, y, z);
    const post = M.xf(M.paint(new THREE.BoxGeometry(0.22, y - 0.05, 0.2), darkWood), x, (y - 0.05) / 2, z - 0.12);
    return [wheel, post];
  }
  function cannonGeo() {
    const barrel = M.lathe([[0.001, -0.75], [0.1, -0.75], [0.17, -0.7], [0.19, -0.55], [0.2, -0.5], [0.16, -0.45], [0.15, 0.1], [0.16, 0.12], [0.13, 0.15], [0.12, 0.7], [0.15, 0.72], [0.15, 0.8], [0.08, 0.8], [0.08, 0.6], [0.001, 0.6]], 14, 0x2a2a2c);
    barrel.rotateX(Math.PI / 2);
    barrel.translate(0, 0.45, 0.15);
    const parts = [barrel, M.ball(0.07, 0x2a2a2c, 0, 0.45, -0.66)];
    parts.push(M.xf(M.paint(new THREE.BoxGeometry(0.55, 0.26, 1.0), 0x6a4428), 0, 0.2, -0.1));
    for (const s of [-1, 1]) for (const z of [-0.45, 0.25]) parts.push(M.xf(M.paint(new THREE.CylinderGeometry(0.13, 0.13, 0.08, 12), 0x4a3020), s * 0.3, 0.13, z, 0, 0, Math.PI / 2));
    return U.merge(parts);
  }
  function crateGeo(x, y, z, big) {
    const w = big ? 1.1 : 0.8, h = big ? 0.7 : 0.55, dd = big ? 0.8 : 0.6, parts = [];
    parts.push(M.xf(M.paint(new THREE.BoxGeometry(w, h, dd), (px, py) => (Math.floor((py + 1) / 0.14) % 2 ? 0x8a6038 : 0x7a5230)), x, y + h / 2, z));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(M.xf(M.paint(new THREE.BoxGeometry(0.08, h + 0.02, 0.08), 0x3a3a3c), x + sx * w / 2, y + h / 2, z + sz * dd / 2));
    parts.push(M.xf(M.paint(new THREE.BoxGeometry(0.28, 0.28, 0.02), 0xf0f0e8), x, y + h * 0.55, z + dd / 2 + 0.01));
    parts.push(M.xf(M.paint(new THREE.BoxGeometry(0.2, 0.06, 0.03), 0xc02020), x, y + h * 0.55, z + dd / 2 + 0.02), M.xf(M.paint(new THREE.BoxGeometry(0.06, 0.2, 0.03), 0xc02020), x, y + h * 0.55, z + dd / 2 + 0.02));
    return parts;
  }
  function bedGeo(x, y, z, rot) {
    const g = U.merge([M.xf(M.paint(new THREE.BoxGeometry(0.9, 0.3, 2.0), 0x6a4428), 0, 0.15, 0), M.xf(M.paint(new THREE.BoxGeometry(0.82, 0.12, 1.9), 0xd8cfb8), 0, 0.36, 0),
      M.xf(M.paint(new THREE.BoxGeometry(0.84, 0.05, 1.1), 0x2a4a7a), 0, 0.44, 0.35), M.xf(M.paint(new THREE.BoxGeometry(0.6, 0.1, 0.3), 0xf0ece0), 0, 0.46, -0.72)]);
    g.rotateY(rot || 0); g.translate(x, y, z);
    return g;
  }
  function lantern(x, y, z) {
    return [M.xf(M.paint(new THREE.CylinderGeometry(0.1, 0.12, 0.3, 6), 0xffc860), x, y, z), M.xf(M.paint(new THREE.ConeGeometry(0.14, 0.14, 6), 0x2a2a2a), x, y + 0.22, z), M.xf(M.paint(new THREE.CylinderGeometry(0.13, 0.13, 0.04, 6), 0x2a2a2a), x, y - 0.17, z)];
  }
  function anchorGeo(x, y, z, s) {
    const parts = [M.xf(M.paint(new THREE.CylinderGeometry(0.04, 0.04, 1.0, 6), 0x2e2e30), 0, 0, 0), M.xf(M.paint(new THREE.TorusGeometry(0.1, 0.025, 5, 10), 0x2e2e30), 0, 0.55, 0),
      M.tube([[-0.35, -0.3, 0], [-0.2, -0.5, 0], [0, -0.52, 0], [0.2, -0.5, 0], [0.35, -0.3, 0]], [0.035, 0.035], 5, 0x2e2e30, 12),
      M.xf(M.paint(new THREE.ConeGeometry(0.06, 0.14, 4), 0x2e2e30), -0.37, -0.25, 0), M.xf(M.paint(new THREE.ConeGeometry(0.06, 0.14, 4), 0x2e2e30), 0.37, -0.25, 0),
      M.xf(M.paint(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 5), 0x2e2e30), 0, 0.35, 0, 0, 0, Math.PI / 2)];
    const g = U.merge(parts);
    g.rotateY(Math.PI / 2 * s); g.translate(x, y, z);
    return g;
  }
  // Mascarones de proa (Oveja, León, Dragón, Calavera)
  function figurehead(kind, x, y, z) {
    let p = [];
    const extra = G.Shop && G.Shop.figurehead(kind);
    if (extra) p = extra;
    else if (kind === 'oveja') {
      p.push(M.ball(0.42, 0xf6f2ea, 0, 0, 0, [1, 0.95, 1.15], 16, 12), M.ball(0.26, 0xf6f2ea, 0, -0.06, 0.38, [1, 0.9, 1]));
      for (const s of [-1, 1]) {
        const pts = [];
        for (let k = 0; k <= 12; k++) { const a = k * 0.55; pts.push([s * (0.3 + Math.cos(a) * 0.14 * (1 - k / 16)), 0.15 + Math.sin(a) * 0.14 * (1 - k / 16), -0.05 + k * 0.012]); }
        p.push(M.tube(pts, [0.07, 0.03], 7, 0xe8d8a8, 36));
        p.push(M.ball(0.045, 0x111111, s * 0.13, 0.08, 0.55), M.ear(0.07, 0.2, 0xf6f2ea, 0xe8c8b8, s * 0.36, 0.05, 0.05, 0, 0, s * -1.3));
      }
    } else if (kind === 'leon') {
      p.push(M.ball(0.38, 0xf0c040, 0, 0, 0.1, [1, 1, 0.9], 16, 12));
      for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; p.push(M.xf(M.paint(new THREE.ConeGeometry(0.16, 0.45, 5), i % 2 ? 0xe08a20 : 0xd86a18), Math.cos(a) * 0.42, Math.sin(a) * 0.42, 0, 0, 0, a - Math.PI / 2)); }
      for (const s of [-1, 1]) p.push(M.ball(0.05, 0x111111, s * 0.13, 0.1, 0.44));
      p.push(M.ball(0.08, 0x8a4a20, 0, -0.04, 0.47), M.ball(0.12, 0xf8e0a0, 0, -0.16, 0.38, [1.2, 0.7, 0.8]));
    } else if (kind === 'dragon') {
      p.push(M.loft({ z0: -0.2, z1: 0.7, n: 10, m: 12, prof: (t) => ({ rx: 0.26 * (1 - t * 0.55), ry: 0.24 * (1 - t * 0.6), y: -t * 0.05 }), color: (t, a, ca, sa) => (sa < -0.4 ? 0xd8c060 : 0x2a8a5a) }));
      for (const s of [-1, 1]) { p.push(M.tube([[s * 0.12, 0.2, -0.05], [s * 0.2, 0.45, -0.3], [s * 0.18, 0.55, -0.55]], [0.05, 0.01], 6, 0xe8e0c0)); p.push(M.ball(0.05, 0xffd040, s * 0.14, 0.12, 0.3)); }
      for (let i = 0; i < 5; i++) p.push(M.xf(M.paint(new THREE.ConeGeometry(0.03, 0.12, 4), 0xf4f0e0), (i - 2) * 0.05, -0.12, 0.62, Math.PI));
    } else {
      p.push(M.ball(0.36, 0xece6d6, 0, 0.05, 0, [1, 1.05, 1.05], 16, 12), M.xf(M.paint(new THREE.BoxGeometry(0.4, 0.16, 0.3), 0xece6d6), 0, -0.3, 0.12));
      for (const s of [-1, 1]) p.push(M.ball(0.1, 0x111111, s * 0.13, 0.06, 0.29, [1, 1.2, 0.6]));
      p.push(M.xf(M.paint(new THREE.ConeGeometry(0.05, 0.09, 3), 0x111111), 0, -0.08, 0.34, Math.PI));
      for (const s of [-1, 1]) p.push(M.tube([[s * 0.55, -0.55, -0.1], [s * 0.1, -0.5, 0.1], [-s * 0.55, -0.1, -0.1]], [0.06, 0.06], 6, 0xece6d6, 6));
    }
    const g = U.merge(p);
    g.translate(x, y, z);
    return g;
  }
  // Bandera pirata (calavera con tibias cruzadas y un toque del color del equipo)
  const flagTexCache = {};
  const strHash = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36); };
  function flagTexture(color, design) {
    // Bandera dibujada en la pizarra (imagen): se carga y se pinta sobre la tela
    if (G.Shop && G.Shop.isCustomFlag(design)) {
      const key = String(color) + ':img' + strHash(design);
      if (flagTexCache[key]) return flagTexCache[key];
      const t = U.canvasTex(192, 120, (c, w, h) => { c.fillStyle = '#111'; c.fillRect(0, 0, w, h); });
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      const im = new Image();
      im.onload = () => {
        const c = t.image.getContext('2d');
        c.drawImage(im, 0, 0, 192, 120);
        if (color) { c.fillStyle = color; c.fillRect(0, 0, 192, 6); c.fillRect(0, 114, 192, 6); }
        t.needsUpdate = true;
      };
      im.src = design;
      flagTexCache[key] = t;
      return t;
    }
    if (typeof design === 'string' && design.startsWith('data:')) design = null;
    const key = String(color) + ':' + (design || '');
    if (flagTexCache[key]) return flagTexCache[key];
    const t = U.canvasTex(128, 80, (c, w, h) => {
      c.fillStyle = '#111'; c.fillRect(0, 0, w, h);
      c.fillStyle = color || '#ffffff'; c.fillRect(0, 0, w, 6); c.fillRect(0, h - 6, w, 6);
      if (design && G.Shop && G.Shop.drawFlag(c, w, h, design)) return;
      c.strokeStyle = '#f2f2f2'; c.lineWidth = 7; c.lineCap = 'round';
      c.beginPath(); c.moveTo(40, 60); c.lineTo(88, 20); c.moveTo(40, 20); c.lineTo(88, 60); c.stroke();
      c.fillStyle = '#f2f2f2'; c.beginPath(); c.arc(64, 34, 17, 0, 7); c.fill(); c.fillRect(55, 44, 18, 12);
      c.fillStyle = '#111'; c.beginPath(); c.arc(57, 34, 5, 0, 7); c.arc(71, 34, 5, 0, 7); c.fill();
      c.fillRect(59, 50, 2, 6); c.fillRect(64, 50, 2, 6); c.fillRect(69, 50, 2, 6);
      if (color) { c.fillStyle = color; c.beginPath(); c.moveTo(48, 20); c.quadraticCurveTo(64, 5, 80, 20); c.lineTo(48, 20); c.fill(); }
    });
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    flagTexCache[key] = t;
    return t;
  }
  function makeFlag(color, w = 1.4, h = 0.9, design) {
    const g = new THREE.PlaneGeometry(w, h, 10, 4);
    g.translate(w / 2, -h / 2, 0);
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: flagTexture(color, design), side: THREE.DoubleSide, roughness: 0.9 }));
    m.userData.base = Float32Array.from(g.attributes.position.array);
    m.userData.w = w;
    return m;
  }
  function netGeo() {
    const g = M.lathe([[0.001, -3.6], [0.25, -3.2], [0.7, -2.2], [1.0, -1.0], [1.1, 0]], 12, (x, y, z) => (Math.abs(Math.sin(Math.atan2(z, x) * 6)) < 0.3 || Math.abs(Math.sin(y * 3)) < 0.25 ? 0x6a4a2a : 0x9a8a6a));
    g.rotateX(Math.PI / 2);
    return g;
  }

  // ------------------------------------------------------------------ modelo completo por tipo
  // Devuelve { root, parts (clave → [mallas]), stations, boxes, sails, flag, prop, smoke, cannons, netMesh, lights }
  function buildModel(type, o) {
    const d = DEF[type], root = new THREE.Group(), parts = {}, st = [], boxes = [], sails = [], cannons = [];
    const vc = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide });
    const canvasM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide });
    const add = (key, geos, mat = vc, shadow = true) => {
      const list = [].concat(geos).flat().filter(Boolean);
      if (!list.length) return null;
      const m = new THREE.Mesh(U.merge(list), mat);
      m.castShadow = shadow; m.receiveShadow = true;
      m.userData.piece = key;
      root.add(m);
      (parts[key] = parts[key] || []).push(m);
      return m;
    };
    const box = (x0, x1, z0, z1, y0, y1, walk) => boxes.push({ x0, x1, z0, z1, y0, y1, walk: !!walk });
    const res = { root, parts, stations: st, boxes, sails, cannons, flag: null, prop: null, smoke: null, netMesh: null, lanterns: [] };
    const sailC = o.sail ?? 0xeee6d2, flagC = o.flagColor || null, h = d.L / 2, dy = d.deckY;
    if (type === 'balsa') {
      const logs = [];
      for (let i = 0; i < 7; i++) {
        const x = -1.2 + i * 0.4;
        logs.push(M.xf(M.paint(new THREE.CylinderGeometry(0.2, 0.21, 4.4, 9), (px, py) => (Math.abs(py) > 2.15 ? 0xb89a70 : 0x6a4a2c)), x, 0.18, 0, Math.PI / 2));
      }
      for (const z of [-1.5, 0, 1.5]) logs.push(M.xf(M.paint(new THREE.BoxGeometry(3.0, 0.1, 0.18), 0x8a6a44), 0, 0.38, z));
      for (const z of [-1.5, 0, 1.5]) for (let i = 0; i < 7; i++) logs.push(M.xf(M.paint(new THREE.TorusGeometry(0.21, 0.02, 4, 10), 0xc8b070), -1.2 + i * 0.4, 0.18, z + 0.12, 0, Math.PI / 2));
      add('casco', logs);
      add('mastil', [...mastGeo(0, dy, 0.3, 3.6, 0.09), yard(0, dy + 3.3, 0.3, 2.1, 0.05)]);
      const sl = new THREE.Mesh(squareSail(1.9, 2.5, 0x9a7048), canvasM);
      sl.position.set(0, dy + 3.3, 0.36); root.add(sl); sails.push({ m: sl, h: 2.5 }); (parts.mastil = parts.mastil || []).push(sl);
      add('timon', [M.xf(M.paint(new THREE.CylinderGeometry(0.04, 0.05, 2.4, 6), 0x6a4a2c), 0, 0.6, -2.3, -1.1), M.xf(M.paint(new THREE.BoxGeometry(0.05, 0.6, 0.3), 0x6a4a2c), 0, 0.05, -3.2, -1.1)]);
      add('caja', crateGeo(1.0, dy, -1.4, false));
      st.push({ kind: 'helm', x: 0, z: -1.8, yaw: 0 }, { kind: 'crate', x: 1.0, z: -1.4 });
      box(0.6, 1.4, -1.7, -1.1, dy, dy + 0.55, true);
      box(-0.12, 0.12, 0.18, 0.42, dy, dy + 3.6);
    } else if (type === 'canoa') {
      add('casco', [hullGeo(d, { a: 0x9a6a40, b: 0x8e6038, wale: 0x4a3420, bottom: 0x6a4428 }), deckGeo(d, 0x4a3420, 0x44301c)]);
      add('caja', [M.xf(M.paint(new THREE.BoxGeometry(0.9, 0.06, 0.3), 0x8a6040), 0, dy + 0.25, 1.4), M.xf(M.paint(new THREE.BoxGeometry(0.9, 0.06, 0.3), 0x8a6040), 0, dy + 0.25, -1.3), ...crateGeo(0, dy, 0.05, false)]);
      for (const s of [-1, 1]) add('casco', [M.xf(U.merge([M.paint(new THREE.CylinderGeometry(0.025, 0.025, 1.7, 5), 0x6a4a2c), M.xf(M.paint(new THREE.BoxGeometry(0.2, 0.5, 0.03), 0x6a4a2c), 0, -1.0, 0)]), s * 0.5, dy + 0.35, s * 0.6, 1.35, 0, s * 0.3)]);
      st.push({ kind: 'helm', x: 0, z: 1.4, yaw: 0, seat: true }, { kind: 'seat', x: 0, z: -1.3, yaw: 0, seat: true }, { kind: 'crate', x: 0, z: 0.05 });
    } else if (type === 'velero') {
      add('casco', [hullGeo(d, { a: 0xa8743e, b: 0x986834, wale: darkWood, bottom: 0x8a3a2a }), anchorGeo(0.9, dy + 0.2, h - 1.2, 1)]);
      add('cubierta', [deckGeo(d), ...railGeo(d, darkWood)]);
      const mz = 1.0, MH = 8.5;
      add('mastil', [...mastGeo(0, dy, mz, MH, 0.13), M.xf(M.paint(new THREE.CylinderGeometry(0.06, 0.07, 3.4, 8), 0x7a5230), 0, dy + 1.4, mz - 1.8, Math.PI / 2), ...shrouds(0, mz, dy + MH - 0.4, d),
        M.tube([[0, dy + MH - 0.2, mz], [0, gunwale(d, h - 0.3) + 0.1, h - 0.2]], [0.015, 0.015], 4, 0x2a2016, 3)]);
      const main = new THREE.Mesh(triSail([0, dy + MH - 0.3, mz - 0.1], [0, dy + 1.55, mz - 0.1], [0, dy + 1.55, mz - 3.4], sailC, 0.5), canvasM);
      const jib = new THREE.Mesh(triSail([0, dy + MH - 0.6, mz + 0.1], [0, dy + 0.6, mz + 0.3], [0, gunwale(d, h - 0.4) + 0.15, h - 0.3], sailC, 0.35), canvasM);
      for (const sl of [main, jib]) { sl.castShadow = true; sl.userData.piece = 'vela'; root.add(sl); (parts.vela = parts.vela || []).push(sl); sails.push({ m: sl, tri: true }); }
      add('timon', wheelGeo(0, dy + 1.05, -h + 1.4, 0.45));
      add('caja', crateGeo(-1.0, dy, -h + 2.1, false));
      st.push({ kind: 'helm', x: 0, z: -h + 0.85, yaw: 0 }, { kind: 'crate', x: -1.0, z: -h + 2.1 }, { kind: 'net', x: 1.0, z: -h + 1.0 });
      box(-1.4, -0.6, -h + 1.8, -h + 2.4, dy, dy + 0.55, true);
      box(-0.15, 0.15, mz - 0.15, mz + 0.15, dy, dy + MH);
      box(-0.15, 0.15, -h + 1.35, -h + 1.6, dy, dy + 1.1);
    } else if (type === 'lancha') {
      add('casco', [hullGeo(d, { a: 0x8a8e94, b: 0x7e8288, wale: 0x3e4044, bottom: 0x8a3a2a, rivets: 0x5a5c60 }), anchorGeo(0.85, dy + 0.2, h - 1.1, 1)]);
      add('cubierta', [deckGeo(d, 0x9a7a54, 0x8a6a48), ...railGeo(d, 0x3a3c40)]);
      // Cabina del timonel con ventanas
      const cz0 = -1.2, cz1 = 0.8, cw = 1.0, ch = 1.9;
      const cab = [M.xf(M.paint(new THREE.BoxGeometry(cw * 2 + 0.1, 0.1, cz1 - cz0 + 0.4), 0x8a2a22), 0, dy + ch + 0.05, (cz0 + cz1) / 2)];
      for (const s of [-1, 1]) cab.push(M.xf(M.paint(new THREE.BoxGeometry(0.08, ch, cz1 - cz0), (x, y) => (y > ch * 0.1 && y < ch * 0.4 ? 0x1a2a34 : 0xd8d0b8)), s * cw, dy + ch / 2, (cz0 + cz1) / 2));
      cab.push(M.xf(M.paint(new THREE.BoxGeometry(cw * 2, ch, 0.08), (x, y) => (Math.abs(x) < cw * 0.7 && y > ch * 0.05 && y < ch * 0.4 ? 0x1a2a34 : 0xd8d0b8)), 0, dy + ch / 2, cz1));
      add('timon', [...cab, ...wheelGeo(0, dy + 1.05, cz1 - 0.45, 0.35)]);
      add('caldera', [M.xf(M.paint(new THREE.CylinderGeometry(0.28, 0.3, 2.6, 12), (x, y) => (y > 1.0 ? 0x111111 : y > 0.75 ? 0xb82a22 : 0x2e2e30)), 0, dy + ch + 1.3, cz0 + 0.3),
        M.xf(M.paint(new THREE.CylinderGeometry(0.5, 0.5, 0.9, 14), 0x3a3a3c), 0, dy + 0.45, cz0 + 0.3)]);
      const prop = new THREE.Mesh(U.merge([...[0, 1, 2].map((i) => M.xf(M.fin([[0, 0], [0.35, 0.08], [0.4, -0.05], [0.05, -0.08]], 0.02, 0xc8a050), 0, 0, 0, 0.35, 0, i * 2.09)), M.xf(M.paint(new THREE.CylinderGeometry(0.06, 0.06, 0.15, 8), 0xc8a050), 0, 0, 0, Math.PI / 2)]), vc);
      prop.position.set(0, -d.draft + 0.25, -h - 0.15); prop.userData.piece = 'helice'; root.add(prop); (parts.helice = parts.helice || []).push(prop);
      res.prop = prop;
      res.smoke = { x: 0, y: dy + ch + 2.7, z: cz0 + 0.3 };
      add('caja', crateGeo(0.8, dy, -h + 1.6, false));
      st.push({ kind: 'helm', x: 0, z: cz1 - 0.95, yaw: 0 }, { kind: 'crate', x: 0.8, z: -h + 1.6 }, { kind: 'net', x: -0.9, z: -h + 0.9 }, { kind: 'cannon', x: 0, z: h - 1.8, yaw: 0, idx: 0, piece: 'canon0' });
      cannons.push({ x: 0, z: h - 1.8, yaw: 0, piece: 'canon0' });
      box(-cw - 0.05, -cw + 0.05, cz0, cz1, dy, dy + ch); box(cw - 0.05, cw + 0.05, cz0, cz1, dy, dy + ch);
      box(-cw, -0.5, cz1 - 0.05, cz1 + 0.05, dy, dy + ch); box(0.5, cw, cz1 - 0.05, cz1 + 0.05, dy, dy + ch);
      box(-0.5, 0.5, cz0 + 0.3 - 0.5, cz0 + 0.3 + 0.5, dy, dy + 0.9);
      box(0.4, 1.2, -h + 1.3, -h + 1.9, dy, dy + 0.55, true);
    } else if (type === 'barco') {
      const gps = [-2.5, 2.5];
      add('casco', [hullGeo(d, { a: 0x9a6636, b: 0x8a5a2e, wale: 0x3a2414, bottom: 0x8a3a2a, gunports: gps }), anchorGeo(2.3, dy + 0.6, h - 2.4, 1), anchorGeo(-2.3, dy + 0.6, h - 2.4, -1),
        M.xf(M.paint(new THREE.CylinderGeometry(0.1, 0.16, 4.2, 8), 0x7a5230), 0, gunwale(d, h) + 0.2, h + 1.3, Math.PI / 2 - 0.25)]);
      add('cubierta', [deckGeo(d), ...railGeo(d, 0x3a2414)]);
      // Camarote en la popa con puerta, ventanas, farol y dos literas dentro
      const cz0 = -h + 0.9, cz1 = -h + 5.0, cw = 2.1, ch = 2.5, cab = [];
      for (const s of [-1, 1]) cab.push(M.xf(M.paint(new THREE.BoxGeometry(0.12, ch, cz1 - cz0), (x, y, z) => (y > ch * 0.1 && y < ch * 0.35 && Math.abs(Math.sin(z * 1.4)) > 0.5 ? 0x1a2a34 : 0x8a5a34)), s * cw, dy + ch / 2, (cz0 + cz1) / 2));
      cab.push(M.xf(M.paint(new THREE.BoxGeometry(cw * 2, ch, 0.12), 0x8a5a34), 0, dy + ch / 2, cz0));
      for (const s of [-1, 1]) cab.push(M.xf(M.paint(new THREE.BoxGeometry(cw - 0.6, ch, 0.12), 0x8a5a34), s * (cw + 0.6) / 2, dy + ch / 2, cz1));
      cab.push(M.xf(M.paint(new THREE.BoxGeometry(1.2, 0.5, 0.12), 0x8a5a34), 0, dy + ch - 0.25, cz1));
      cab.push(M.xf(M.paint(new THREE.BoxGeometry(cw * 2 + 0.4, 0.14, cz1 - cz0 + 0.4), 0x5a3418), 0, dy + ch + 0.07, (cz0 + cz1) / 2));
      cab.push(...lantern(0.9, dy + ch - 0.4, cz1 + 0.2), ...lantern(-0.9, dy + ch - 0.4, cz1 + 0.2));
      cab.push(bedGeo(-1.4, dy, (cz0 + cz1) / 2, 0), bedGeo(1.4, dy, (cz0 + cz1) / 2, 0));
      add('camarote', cab);
      res.lanterns.push({ x: 0.9, y: dy + ch - 0.4, z: cz1 + 0.2 });
      for (const s of [-1, 1]) {
        box(s * cw - 0.06, s * cw + 0.06, cz0, cz1, dy, dy + ch + 0.2); // paredes laterales
        box(s > 0 ? 0.6 : -cw, s > 0 ? cw : -0.6, cz1 - 0.06, cz1 + 0.06, dy, dy + ch + 0.2);
        box(s * 1.4 - 0.45, s * 1.4 + 0.45, (cz0 + cz1) / 2 - 1, (cz0 + cz1) / 2 + 1, dy, dy + 0.42, true); // literas
      }
      box(-cw, cw, cz0 - 0.06, cz0 + 0.06, dy, dy + ch + 0.2);
      st.push({ kind: 'bed', x: -1.4, z: (cz0 + cz1) / 2, piece: 'camarote' }, { kind: 'bed', x: 1.4, z: (cz0 + cz1) / 2, piece: 'camarote' });
      // Mástiles con velas cuadradas, cofa y obenques
      const m1 = 0.5, m2 = 5.2, H1 = 13, H2 = 10;
      add('mastil', [...mastGeo(0, dy, m1, H1, 0.2), yard(0, dy + H1 - 1.2, m1, 7.2, 0.1), yard(0, dy + H1 - 5.2, m1, 8.2, 0.12), ...shrouds(0, m1, dy + H1 - 1.6, d),
        M.xf(M.lathe([[0.001, 0], [0.6, 0], [0.7, 0.5], [0.72, 0.6], [0.001, 0.6]], 12, 0x6a4428), 0, dy + H1 - 3.0, m1)]);
      add('mastil2', [...mastGeo(0, dy, m2, H2, 0.16), yard(0, dy + H2 - 1, m2, 6, 0.09), yard(0, dy + H2 - 4.3, m2, 6.8, 0.1), ...shrouds(0, m2, dy + H2 - 1.3, d),
        M.tube([[0, dy + H2 - 0.5, m2], [0, gunwale(d, h) + 1.0, h + 2.8]], [0.02, 0.02], 4, 0x2a2016, 3)]);
      const mkSail = (key, x, y, z, w, hh, emblem) => { const sl = new THREE.Mesh(squareSail(w, hh, sailC, emblem), canvasM); sl.position.set(x, y, z + 0.18); sl.castShadow = true; sl.userData.piece = key; root.add(sl); (parts[key] = parts[key] || []).push(sl); sails.push({ m: sl, h: hh }); };
      mkSail('vela', 0, dy + H1 - 1.2, m1, 6.6, 3.6, false); mkSail('vela', 0, dy + H1 - 5.2, m1, 7.6, 4.4, true);
      mkSail('vela2', 0, dy + H2 - 1, m2, 5.4, 3.0, false); mkSail('vela2', 0, dy + H2 - 4.3, m2, 6.2, 3.6, false);
      const jib = new THREE.Mesh(triSail([0, dy + H2 - 0.6, m2 + 0.2], [0, dy + 1.2, m2 + 1.2], [0, gunwale(d, h) + 0.9, h + 2.6], sailC, 0.4), canvasM);
      jib.userData.piece = 'vela2'; root.add(jib); parts.vela2.push(jib); sails.push({ m: jib, tri: true });
      box(-0.22, 0.22, m1 - 0.22, m1 + 0.22, dy, dy + H1); box(-0.18, 0.18, m2 - 0.18, m2 + 0.18, dy, dy + H2);
      // Bandera en lo alto del palo mayor
      const flag = makeFlag(flagC, 1.8, 1.15, o.flag);
      flag.position.set(0, dy + H1 + 1.2, m1);
      flag.userData.piece = 'bandera'; root.add(flag); parts.bandera = [flag];
      add('bandera', [M.xf(M.paint(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 5), 0x7a5230), 0, dy + H1 + 0.6, m1)]);
      res.flag = flag;
      add('timon', wheelGeo(0, dy + 1.1, cz1 + 1.2, 0.55));
      st.push({ kind: 'helm', x: 0, z: cz1 + 0.65, yaw: 0 });
      box(-0.15, 0.15, cz1 + 1.05, cz1 + 1.35, dy, dy + 1.2);
      // Cuatro cañones en portas (dos por banda)
      const cgeo = cannonGeo();
      [[-1, gps[0]], [1, gps[0]], [-1, gps[1]], [1, gps[1]]].forEach(([s, z], i) => {
        const g = cgeo.clone();
        g.rotateY(s < 0 ? -Math.PI / 2 : Math.PI / 2);
        g.translate(s * (halfW(d, z) - 0.9), dy, z);
        add('canon' + i, [g]);
        const cx = s * (halfW(d, z) - 0.9);
        cannons.push({ x: cx, z, yaw: s < 0 ? -Math.PI / 2 : Math.PI / 2, piece: 'canon' + i, side: s });
        st.push({ kind: 'cannon', x: cx - s * 0.9, z, yaw: s < 0 ? -Math.PI / 2 : Math.PI / 2, idx: i, piece: 'canon' + i });
        box(Math.min(cx, cx + s * 0.8) - 0.3, Math.max(cx, cx + s * 0.8) + 0.3, z - 0.35, z + 0.35, dy, dy + 0.75);
      });
      add('mascaron', [figurehead(o.fh || 'oveja', 0, gunwale(d, h) + 0.2, h + 0.35)]);
      add('caja', crateGeo(-1.6, dy, 3.2, true));
      st.push({ kind: 'crate', x: -1.6, z: 3.2 }, { kind: 'net', x: 1.8, z: -h + 0.6 });
      box(-2.2, -1.0, 2.75, 3.65, dy, dy + 0.72, true);
    }
    // Soportes de la red de pesca (en la popa)
    if (d.net) {
      const ns = st.find((x) => x.kind === 'net');
      const nm = new THREE.Mesh(netGeo(), vc);
      nm.position.set(ns.x, 0.1, -h - 0.3); nm.visible = false; root.add(nm);
      res.netMesh = nm;
      add('caja', [M.xf(M.paint(new THREE.CylinderGeometry(0.05, 0.06, 1.6, 6), 0x5a3a20), ns.x, dy + 0.8, ns.z - 0.3), M.xf(M.paint(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 6), 0x5a3a20), ns.x, dy + 1.55, ns.z - 0.8, Math.PI / 2 - 0.4)]);
    }
    for (const c of cannons) { const s = st.find((x) => x.kind === 'cannon' && x.piece === c.piece); if (s) s.c = c; }
    return res;
  }

  // ------------------------------------------------------------------ crear / eliminar
  const ghostMat = new THREE.MeshBasicMaterial({ color: 0x5ae0ff, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
  const ghostNext = new THREE.MeshBasicMaterial({ color: 0x7affc8, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide });
  S.create = function (data) {
    const d = DEF[data.type];
    const o = { fh: data.fh || 'oveja', sail: data.sail ?? 0xeee6d2, flagColor: data.flagColor || null, flag: data.flag || null };
    const mdl = buildModel(data.type, o);
    const s = {
      id: data.id || (G.Net.myId || 0) + ':' + Date.now().toString(36) + ':' + S.nextId++,
      type: data.type, def: d, x: data.x, z: data.z, yaw: data.yaw || 0, y: 0, pitch: 0, roll: 0, speed: 0, vx: 0, vz: 0,
      hp: data.hp ?? d.hp, throttle: 0, rudder: 0, anchor: data.anchor ?? true, ap: false, apT: null, driver: data.driver ?? null,
      crate: (data.crate || new Array(d.crate).fill(null)).slice(0, d.crate), fuel: data.fuel || 0, net: !!data.net, netOn: false, netFish: data.netFish || 0, netT: 0,
      building: !!data.building, placed: new Set(data.placed || []), fh: o.fh, sailColor: o.sail, flagColor: o.flagColor, flag: o.flag,
      team: data.team ?? null, flagship: !!data.flagship, name: data.name || (data.type === 'barco' ? shipName(o.fh) : d.name),
      mdl, root: mdl.root, sinking: 0, reload: {}, prevYaw: data.yaw || 0, nx: data.x, nz: data.z, nyaw: data.yaw || 0, lastNet: 0, spark: 0,
    };
    while (s.crate.length < d.crate) s.crate.push(null);
    s.root.traverse((m) => { if (m.isMesh) m.userData.ship = s; });
    for (const k in mdl.parts) for (const m of mdl.parts[k]) m.userData.realMat = m.material;
    if (!s.building) for (const p of PIECES[s.type] || []) s.placed.add(p[0]);
    S.refreshPieces(s);
    G.scene.add(s.root);
    S.list.push(s);
    placeRoot(s, 0);
    return s;
  };
  S.byId = (id) => S.list.find((s) => s.id === id);
  S.remove = function (s) {
    const i = S.list.indexOf(s);
    if (i < 0) return;
    S.list.splice(i, 1);
    G.scene.remove(s.root);
    s.root.traverse((m) => { if (m.isMesh) m.geometry.dispose(); });
    const P = G.Player;
    if (P.ship === s) S.leave(true);
  };
  S.clear = function () { while (S.list.length) S.remove(S.list[0]); S.proj.length = 0; };
  S.has = (s, key) => !s.building || s.placed.has(key);
  S.complete = (s) => !s.building || (PIECES[s.type] || []).every((p) => s.placed.has(p[0]));
  // Muestra las piezas colocadas y el holograma de las que faltan
  S.refreshPieces = function (s) {
    const list = PIECES[s.type] || [];
    const next = list.find((p) => !s.placed.has(p[0]));
    for (const k in s.mdl.parts) for (const m of s.mdl.parts[k]) {
      const placed = !s.building || s.placed.has(k) || !list.some((p) => p[0] === k);
      m.material = placed ? m.userData.realMat : next && next[0] === k ? ghostNext : ghostMat;
      m.castShadow = placed;
    }
    if (s.building && S.complete(s)) {
      s.building = false;
      G.UI.banner('¡Barco terminado!', `${s.name} está listo para zarpar`);
      if (G.Ach) { G.Ach.add('ship:' + s.type); G.Ach.earn('ship'); }
      G.Audio.play('win');
      for (const k in s.mdl.parts) for (const m of s.mdl.parts[k]) m.material = m.userData.realMat;
      if (!s.crate.some(Boolean)) s.crate[0] = { id: s.def.rep, n: 2 };
    }
  };

  // ------------------------------------------------------------------ transformaciones
  const _v = new V3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ');
  function placeRoot(s) {
    s.root.position.set(s.x, s.y, s.z);
    s.root.rotation.set(s.pitch, s.yaw, s.roll, 'YXZ');
    s.root.updateMatrixWorld(true);
  }
  S.toWorld = (s, l, out) => out.set(l.x, l.y, l.z).applyMatrix4(s.root.matrixWorld);
  S.toLocal = function (s, x, y, z, out) {
    const dx = x - s.x, dz = z - s.z, c = Math.cos(s.yaw), sn = Math.sin(s.yaw);
    return out.set(dx * c - dz * sn, y - s.y, dx * sn + dz * c);
  };
  S.forward = (s) => _v.set(Math.sin(s.yaw), 0, Math.cos(s.yaw));
  // Distancia (aprox.) desde un punto al casco
  S.distTo = function (s, x, z) {
    const l = S.toLocal(s, x, 0, z, _l2), d = s.def;
    const hz = Math.max(0, Math.abs(l.z) - d.L / 2), hw = halfW(d, U.clamp(l.z, -d.L / 2 + 0.01, d.L / 2 - 0.01));
    const hx = Math.max(0, Math.abs(l.x) - hw);
    return Math.hypot(hx, hz);
  };
  const _l2 = new V3();
  S.near = function (x, z, rad, filter) {
    let best = null, bd = rad;
    for (const s of S.list) {
      if (s.sinking || (filter && !filter(s))) continue;
      if (Math.abs(s.x - x) > rad + s.def.L || Math.abs(s.z - z) > rad + s.def.L) continue;
      const d = S.distTo(s, x, z);
      if (d < bd) { bd = d; best = s; }
    }
    return best ? { s: best, d: bd } : null;
  };

  // ------------------------------------------------------------------ autoridad y red
  S.isAuth = (s) => (!G.Net.active ? true : s.driver ? s.driver === G.Net.myId || !G.Net.peers.has(s.driver) && G.Net.isHost : G.Net.isHost);
  S.data = (s) => ({ id: s.id, type: s.type, x: +s.x.toFixed(2), z: +s.z.toFixed(2), yaw: +s.yaw.toFixed(3), hp: Math.round(s.hp), anchor: s.anchor, crate: s.crate, fuel: s.fuel, net: s.net, netFish: s.netFish,
    building: s.building, placed: [...s.placed], fh: s.fh, sail: s.sailColor, flagColor: s.flagColor, flag: s.flag, team: s.team, flagship: s.flagship, name: s.name, driver: s.driver });
  S.getState = () => S.list.filter((s) => !s.sinking).map(S.data);
  S.setState = function (arr) { S.clear(); for (const d of arr || []) if (DEF[d.type]) S.create(d); };
  function netState(s) {
    return { t: 'sh', id: s.id, x: +s.x.toFixed(2), z: +s.z.toFixed(2), yaw: +s.yaw.toFixed(3), v: +s.speed.toFixed(2), th: s.throttle, rd: +s.rudder.toFixed(2), an: s.anchor ? 1 : 0, ap: s.ap ? 1 : 0, no: s.netOn ? 1 : 0, fu: Math.round(s.fuel), drv: s.driver };
  }
  S.onNet = function (m, from) {
    const s = m.id ? S.byId(m.id) : null;
    switch (m.t) {
      case 'shNew': if (!S.byId(m.d.id)) S.create(m.d); break;
      case 'sh':
        if (!s || S.isAuth(s) && s.driver === G.Net.myId) break;
        s.nx = m.x; s.nz = m.z; s.nyaw = m.yaw; s.speed = m.v; s.throttle = m.th; s.rudder = m.rd; s.anchor = !!m.an; s.ap = !!m.ap; s.netOn = !!m.no; s.fuel = m.fu; s.driver = m.drv; s.lastNet = performance.now();
        break;
      case 'shDrv': if (s) s.driver = m.drv; break;
      case 'shHurt': if (s && G.Net.isHost) S.hurt(s, m.dmg, m.cause, m.by); break;
      case 'shHp': if (s) { if (m.hp < s.hp) hitFx(s); s.hp = m.hp; } break;
      case 'shSink': if (s) startSink(s, m.by); break;
      case 'shCrate': if (s) { s.crate = m.items; if (G.UI.chest && G.UI.chest.ship === s) G.UI.refreshInv(); } break;
      case 'shPiece': if (s) { s.placed.add(m.piece); if (m.fh) s.fh = m.fh; if (m.sail !== undefined) s.sailColor = m.sail; if (m.flag !== undefined) s.flag = m.flag; S.rebuild(s); } break;
      case 'shLook': if (s) { s.fh = m.fh; s.sailColor = m.sail; s.flag = m.flag; S.rebuild(s); } break;
      case 'shNetInst': if (s) s.net = true; break;
      case 'shDel': if (s) S.remove(s); break;
      case 'cannon': spawnBall(m, false); break;
    }
  };
  const send = (m) => G.Net.send(m);
  // Vuelve a construir el modelo (al cambiar el mascarón o el color de las velas)
  S.rebuild = function (s) {
    const aboard = G.Player.ship === s;
    const o = { fh: s.fh, sail: s.sailColor, flagColor: s.flagColor, flag: s.flag };
    G.scene.remove(s.root);
    s.root.traverse((m) => { if (m.isMesh) m.geometry.dispose(); });
    s.mdl = buildModel(s.type, o); s.root = s.mdl.root;
    s.root.traverse((m) => { if (m.isMesh) m.userData.ship = s; });
    for (const k in s.mdl.parts) for (const m of s.mdl.parts[k]) m.userData.realMat = m.material;
    if (s.type === 'barco' && !s.name.startsWith('*')) s.name = shipName(s.fh);
    G.scene.add(s.root);
    S.refreshPieces(s);
    placeRoot(s);
    if (aboard) G.Player.station = null;
  };

  // ------------------------------------------------------------------ daño, reparación y hundimiento
  S.hurt = function (s, dmg, cause, by) {
    if (!s || s.sinking || s.building) return;
    if (dmg > 0 && G.Modes && !G.Modes.canHurtShip(s, by)) return;
    if (G.Net.active && !G.Net.isHost) { send({ t: 'shHurt', id: s.id, dmg, cause, by }); return; }
    s.hp = U.clamp(s.hp - dmg, 0, s.def.hp);
    send({ t: 'shHp', id: s.id, hp: Math.round(s.hp) });
    if (dmg <= 0) return;
    hitFx(s);
    if (G.Player.ship === s && cause) G.UI.msg('💥 ' + cause + ` (${Math.round(s.hp)}/${s.def.hp})`, 'bad', 'shiphit');
    if (s.hp <= 0) { send({ t: 'shSink', id: s.id, by }); startSink(s, by); }
  };
  function hitFx(s) {
    G.Audio.playAt('creak', s.x, s.z, 80);
    if (G.Player.ship === s) G.Player.shake = 0.3;
  }
  function startSink(s, by) {
    if (s.sinking) return;
    s.sinking = 0.001;
    G.Audio.playAt('creak', s.x, s.z, 120);
    if (G.Player.ship === s) { G.UI.banner('¡Nos hundimos!', 'Salta al agua y nada hacia la costa'); S.leave(true); }
    // La carga queda flotando en un barril
    if (G.Net.authority() && s.crate.some(Boolean)) G.Landmarks.dropBarrel(s.x, s.z, s.crate.filter(Boolean));
    if (G.Modes) G.Modes.onShipSunk(s, by);
    if (G.Modes && G.Modes.active && by === G.Net.myId && s.team !== G.Net.team) G.Ach.add('vs:sink');
  }
  S.repair = function (s) {
    const it = G.Inv.held();
    if (!it || G.ITEMS[it.id].rep !== s.type) return false;
    if (s.hp >= s.def.hp) { G.UI.msg('El casco está en perfecto estado.', 'info', 'rep'); return true; }
    G.Inv.consumeHeld();
    const add = s.def.hp * 0.35;
    if (G.Net.active && !G.Net.isHost) send({ t: 'shHurt', id: s.id, dmg: -add });
    else { s.hp = Math.min(s.def.hp, s.hp + add); send({ t: 'shHp', id: s.id, hp: Math.round(s.hp) }); }
    G.Audio.play('hammer');
    G.UI.msg(`🔨 Reparas el casco (+${Math.round(add)})`, 'good');
    return true;
  };

  // ------------------------------------------------------------------ física
  const W = () => G.World;
  function waterHeave(s) {
    const d = s.def, w = G.World.waveHeight, h = d.L / 2 * 0.8, k = Math.min(1, 6 / d.L);
    const bow = w(s.x + Math.sin(s.yaw) * h, s.z + Math.cos(s.yaw) * h), stern = w(s.x - Math.sin(s.yaw) * h, s.z - Math.cos(s.yaw) * h);
    const hw = d.W / 2, port = w(s.x - Math.cos(s.yaw) * hw, s.z + Math.sin(s.yaw) * hw), star = w(s.x + Math.cos(s.yaw) * hw, s.z - Math.sin(s.yaw) * hw);
    const mid = (bow + stern + port + star) / 4;
    const sinkLow = s.hp < d.hp * 0.35 ? -0.25 : 0;
    s.y = U.lerp(s.y, mid * 0.8 + sinkLow - (s.building ? 0 : 0), 0.2);
    s.pitch = U.lerp(s.pitch, Math.atan2(stern - bow, h * 2) * k, 0.15);
    s.roll = U.lerp(s.roll, Math.atan2(port - star, hw * 2) * k * 0.7 + s.rudder * Math.min(1, Math.abs(s.speed) / 8) * -0.04, 0.15);
  }
  function windFactor(s) {
    const Wx = G.Weather, a = Wx.windA || 0;
    const rel = Math.cos(U.angDiff(s.yaw, a)); // 1 = viento de popa, -1 = de proa
    return (0.35 + 0.65 * (0.5 + 0.5 * rel)) * (Wx.windS || 1);
  }
  S.windFactor = windFactor;
  function grounded(s, x, z, yaw) {
    const d = s.def, h = d.L / 2 - 0.3, lim = -d.draft + 0.05;
    const pts = [[0, h], [0, -h], [d.W * 0.45, 0], [-d.W * 0.45, 0], [d.W * 0.3, h * 0.6], [-d.W * 0.3, h * 0.6]];
    for (const [lx, lz] of pts) {
      const wx = x + lx * Math.cos(yaw) + lz * Math.sin(yaw), wz = z - lx * Math.sin(yaw) + lz * Math.cos(yaw);
      if (G.height(wx, wz) > lim) return true;
    }
    return false;
  }
  function simulate(s, dt) {
    const d = s.def;
    // Piloto automático: rumbo al destino marcado en el mapa (o mantener el rumbo)
    if (s.ap) autopilot(s, dt);
    let target = 0;
    if (!s.anchor) {
      if (d.sail) target = s.throttle * d.speed * windFactor(s);
      else if (d.engine) { target = s.throttle * d.speed; if (s.fuel <= 0 && s.throttle > 0) target = s.throttle > 0 ? 1.4 : -1; }
      else if (d.paddle) target = s.throttle * d.speed * (s.paddleOk === false ? 0.3 : 1);
      if (s.throttle < 0) target = s.throttle * d.speed * 0.25;
    }
    if (s.hp < d.hp * 0.35) target *= 0.6;
    const acc = s.anchor ? 2.5 : d.accel;
    s.speed += (target - s.speed) * Math.min(1, dt * acc);
    if (d.engine && s.throttle !== 0 && !s.anchor) {
      s.fuel = Math.max(0, s.fuel - dt * Math.abs(s.throttle));
      if (s.fuel <= 0) refuel(s);
    }
    const turn = s.rudder * d.turn * U.clamp(Math.abs(s.speed) / 3, 0.25, 1) * (s.speed < -0.1 ? -1 : 1);
    s.yaw += turn * dt;
    let nx = s.x + Math.sin(s.yaw) * s.speed * dt, nz = s.z + Math.cos(s.yaw) * s.speed * dt;
    // Remolinos: arrastran hacia el centro y dañan
    const wh = G.Landmarks.whirlAt(nx, nz);
    if (wh) {
      const f = (1 - wh.d / (wh.w.r * 2.2)) * 5 * dt, dx = wh.w.x - nx, dz = wh.w.z - nz, dl = Math.hypot(dx, dz) || 1;
      nx += dx / dl * f + dz / dl * f * 0.8; nz += dz / dl * f - dx / dl * f * 0.8;
      s.yaw += dt * 0.6 * (1 - wh.d / (wh.w.r * 2.2));
      if (wh.d < wh.w.r * 0.5 && G.Net.authority()) S.hurt(s, 10 * dt, 'El remolino destroza el casco');
    }
    // Límites del mundo
    const rr = Math.hypot(nx, nz);
    if (rr > G.Arch.BOUND) { nx *= G.Arch.BOUND / rr; nz *= G.Arch.BOUND / rr; if (G.Player.ship === s) G.UI.msg('🌊 Las corrientes te devuelven hacia el archipiélago.', 'warn', 'bounds'); }
    if (grounded(s, nx, nz, s.yaw)) {
      if (Math.abs(s.speed) > 3.2 && S.isAuth(s)) S.hurt(s, (Math.abs(s.speed) - 3) * d.hp * 0.035, 'El casco golpea contra las rocas');
      s.speed *= -0.25;
      if (s.ap) { s.ap = false; if (G.Player.ship === s) G.UI.msg('⚓ Piloto automático: costa a la vista. Toma el timón.', 'warn'); }
    } else { s.x = nx; s.z = nz; }
    // Choques entre barcos
    for (const o of S.list) {
      if (o === s || o.sinking) continue;
      const dd = Math.hypot(o.x - s.x, o.z - s.z), min = (Math.min(o.def.L, o.def.W * 2) + Math.min(s.def.L, s.def.W * 2)) * 0.35;
      if (dd < min && dd > 0.01) { const push = (min - dd) * 0.5; s.x -= (o.x - s.x) / dd * push; s.z -= (o.z - s.z) / dd * push; s.speed *= 0.9; }
    }
  }
  function refuel(s) {
    const i = s.crate.findIndex((c) => c && c.id === 'carbon');
    if (i < 0) { if (G.Player.ship === s && s.throttle !== 0) G.UI.msg('⚫ Sin carbón en la caja: la caldera se apaga.', 'warn', 'fuel'); return; }
    s.crate[i].n--;
    if (s.crate[i].n <= 0) s.crate[i] = null;
    s.fuel += 60;
    send({ t: 'shCrate', id: s.id, items: s.crate });
  }
  function autopilot(s, dt) {
    const wp = s.apT || { x: s.x + Math.sin(s.apYaw) * 1000, z: s.z + Math.cos(s.apYaw) * 1000 };
    const dx = wp.x - s.x, dz = wp.z - s.z, dist = Math.hypot(dx, dz);
    let want = Math.atan2(dx, dz);
    // Evita la costa: sondea delante y a los lados
    const probe = (a, r) => G.height(s.x + Math.sin(a) * r, s.z + Math.cos(a) * r) > -s.def.draft - 0.8;
    if (probe(s.yaw, 22) || probe(s.yaw, 12)) {
      if (!probe(s.yaw + 0.7, 22)) want = s.yaw + 0.7; else if (!probe(s.yaw - 0.7, 22)) want = s.yaw - 0.7; else want = s.yaw + 1.5;
    }
    s.rudder = U.clamp(U.angDiff(s.yaw, want) * 2, -1, 1);
    s.throttle = dist < 60 && s.apT ? 0.4 : 1;
    s.anchor = false;
    if (s.apT && dist < 25) {
      s.ap = false; s.throttle = 0; s.anchor = true;
      if (G.Player.ship === s) { G.UI.msg('⚓ Piloto automático: has llegado a tu destino.', 'good'); G.Audio.play('bell'); }
    }
  }

  // ------------------------------------------------------------------ jugador a bordo
  // P.ship = barco, P.local = posición en coordenadas del barco, P.station = { kind, st } (timón, cañón…)
  S.board = function (s, seatIdx) {
    const P = G.Player, d = s.def;
    if (s.building && !s.placed.has('cubierta') && !d.rect && s.type !== 'canoa') { G.UI.msg('El barco aún no tiene cubierta.', 'warn'); return; }
    G.Ach.add('board');
    if (!s.building && ['sail', 'flag', 'fh'].some((k) => G.Profile.equipped(k))) G.UI.msg('🎨 Pulsa <kbd>R</kbd> a bordo para ponerle a este barco tus diseños de la Tienda.', 'info', 'shiplook');
    const l = S.toLocal(s, P.pos.x, P.pos.y, P.pos.z, new V3());
    l.z = U.clamp(l.z, -d.L / 2 + 0.8, d.L / 2 - 1.2);
    const hw = halfW(d, l.z) - 0.5;
    l.x = U.clamp(l.x, -hw, hw);
    l.y = d.deckY + 0.02;
    P.ship = s; P.local = l; P.lvel = new V3(); P.swimming = false; P.station = null;
    P.shipYaw = s.yaw;
    if (d.seated) { const free = seatIdx ?? (seatTaken(s, 0) ? 1 : 0); sitAt(s, free); }
    G.Audio.play('step_wood');
    G.UI.msg(`⛵ A bordo: ${s.name}`, 'info', 'board');
  };
  function seatTaken(s, i) {
    const seat = s.mdl.stations.filter((x) => x.seat)[i];
    for (const p of G.Net.peers.values()) if (p.shipId === s.id && p.local && Math.hypot(p.local.x - seat.x, p.local.z - seat.z) < 0.5) return true;
    return false;
  }
  function sitAt(s, i) {
    const P = G.Player, seat = s.mdl.stations.filter((x) => x.seat)[i];
    P.local.set(seat.x, s.def.deckY - 0.05, seat.z);
    P.station = seat.kind === 'helm' ? { kind: 'helm', st: seat } : { kind: 'seat', st: seat };
    if (P.station.kind === 'helm') takeHelm(s);
  }
  S.leave = function (forced) {
    const P = G.Player, s = P.ship;
    if (!s) return;
    if (P.station && P.station.kind === 'helm') releaseHelm(s);
    const w = S.toWorld(s, P.local, new V3());
    P.ship = null; P.station = null;
    P.pos.copy(w);
    P.vel.set(Math.sin(s.yaw) * s.speed, forced ? 0 : 2, Math.cos(s.yaw) * s.speed);
    P.onGround = false;
  };
  function takeHelm(s) {
    s.driver = G.Net.myId;
    s.anchorWas = s.anchor;
    send({ t: 'shDrv', id: s.id, drv: s.driver });
    G.UI.msg(`☸️ Timón: <kbd>W</kbd>/<kbd>S</kbd> ${s.def.engine ? 'motor' : s.def.paddle ? 'remar' : 'velas'} · <kbd>A</kbd>/<kbd>D</kbd> girar · <kbd>Espacio</kbd> ancla · <kbd>Q</kbd> piloto automático · <kbd>E</kbd> soltar`, 'info', 'helm');
  }
  function releaseHelm(s) {
    if (s.def.paddle) { s.throttle = 0; s.rudder = 0; }
    if (!s.ap) s.rudder = 0;
  }
  S.deckFloor = function (s, lx, lz, ly) {
    const d = s.def;
    if (Math.abs(lz) > d.L / 2 - 0.1) return null;
    const hw = halfW(d, lz);
    if (Math.abs(lx) > hw - 0.05) return null;
    if (s.building && !s.placed.has('cubierta') && !d.rect && s.type !== 'canoa') return null;
    let f = d.deckY;
    for (const b of s.mdl.boxes) if (b.walk && lx > b.x0 && lx < b.x1 && lz > b.z0 && lz < b.z1 && ly >= b.y1 - 0.45) f = Math.max(f, b.y1);
    return f;
  };
  const _w = new V3();
  S.updatePlayer = function (dt, K) {
    const P = G.Player, s = P.ship, d = s.def, L = P.local;
    // Girar con el barco
    P.yaw += U.angDiff(P.shipYaw, s.yaw); P.shipYaw = s.yaw;
    P.swimming = false; P.wading = false; P.onStruct = true;
    if (P.station && (P.station.kind === 'helm' || P.station.kind === 'seat' || P.station.kind === 'cannon')) {
      const stn = P.station.st;
      if (P.station.kind !== 'cannon') L.set(stn.x, d.deckY + (stn.seat ? -0.05 : 0.02), stn.z);
      else L.set(stn.x, d.deckY + 0.02, stn.z);
      P.onGround = true; P.vel.set(0, 0, 0); P.hs = 0; P.moving = false;
      if (P.station.kind === 'helm') helmInput(s, dt, K);
      S.toWorld(s, L, P.pos);
      return;
    }
    const fwd = (K.KeyW || K.ArrowUp ? 1 : 0) - (K.KeyS || K.ArrowDown ? 1 : 0), str = (K.KeyD || K.ArrowRight ? 1 : 0) - (K.KeyA || K.ArrowLeft ? 1 : 0);
    const sy = Math.sin(P.yaw), cy = Math.cos(P.yaw);
    let wx = -sy * fwd + cy * str, wz = -cy * fwd - sy * str;
    const wl = Math.hypot(wx, wz);
    if (wl > 0) { wx /= wl; wz /= wl; }
    P.moving = wl > 0;
    P.sprinting = !!(K.ShiftLeft || K.ShiftRight) && P.moving && fwd > 0 && !P.exhausted;
    const speed = P.sprinting ? 6 : 3.6, c = Math.cos(s.yaw), sn = Math.sin(s.yaw);
    const lx = wx * c - wz * sn, lz = wx * sn + wz * c;
    const V = P.lvel;
    V.x += (lx * speed - V.x) * Math.min(1, 12 * dt); V.z += (lz * speed - V.z) * Math.min(1, 12 * dt);
    V.y -= 24 * dt;
    if (K.Space && P.onGround) { V.y = G.Story ? G.Story.jumpPower(7.2) : 7.2; P.onGround = false; }
    L.x += V.x * dt; L.z += V.z * dt; L.y += V.y * dt;
    // Obstáculos de la cubierta (mástiles, camarote, cañones…)
    for (const b of s.mdl.boxes) {
      if (b.walk && L.y >= b.y1 - 0.45) continue;
      if (L.y > b.y1 || L.y + 1.7 < b.y0) continue;
      const cx = U.clamp(L.x, b.x0, b.x1), cz = U.clamp(L.z, b.z0, b.z1), dx = L.x - cx, dz = L.z - cz, d2 = dx * dx + dz * dz, R = 0.32;
      if (d2 >= R * R) continue;
      if (d2 > 1e-6) { const dd = Math.sqrt(d2); L.x = cx + dx / dd * R; L.z = cz + dz / dd * R; }
      else { const l = L.x - b.x0, r = b.x1 - L.x, f = L.z - b.z0, k = b.z1 - L.z, m = Math.min(l, r, f, k); if (m === l) L.x = b.x0 - R; else if (m === r) L.x = b.x1 + R; else if (m === f) L.z = b.z0 - R; else L.z = b.z1 + R; }
    }
    // Borda: no te caes salvo que saltes por encima
    const railTop = d.deckY + d.rail + 0.1;
    if (d.rail > 0 && L.y < railTop) {
      L.z = U.clamp(L.z, -d.L / 2 + 0.5, d.L / 2 - 0.6);
      const hw = halfW(d, L.z) - 0.4;
      if (Math.abs(L.x) > hw) L.x = Math.sign(L.x) * hw;
    }
    const floor = S.deckFloor(s, L.x, L.z, L.y);
    if (floor === null) {
      if (L.y < d.deckY - 0.3 || d.rail === 0 || L.y > railTop) { S.leave(); return; }
    } else if (L.y <= floor) { L.y = floor; V.y = 0; P.onGround = true; }
    else if (P.onGround && V.y <= 0 && L.y - floor < 0.4) { L.y = floor; V.y = 0; }
    else P.onGround = false;
    P.hs = Math.hypot(V.x, V.z);
    if (P.onGround && P.hs > 0.5) { P.stepAcc += P.hs * dt; P.bob += P.hs * dt * 2.2; if (P.stepAcc > 2) { P.stepAcc = 0; G.Audio.play('step_wood'); } }
    S.toWorld(s, L, P.pos);
    P.vel.set(Math.sin(s.yaw) * s.speed, 0, Math.cos(s.yaw) * s.speed);
  };
  // Controles del timón
  let thrKey = 0;
  function helmInput(s, dt, K) {
    const d = s.def;
    if (d.paddle) {
      const f = (K.KeyW ? 1 : 0) - (K.KeyS ? 1 : 0);
      s.throttle = f; s.anchor = false;
      const P = G.Player;
      if (f !== 0) { P.stats.stamina = Math.max(0, P.stats.stamina - 7 * dt); s.paddleOk = P.stats.stamina > 5; if ((P.bob += dt * 3) > 1.2) { P.bob = 0; G.Audio.play('splash', 0.4); } }
    } else {
      thrKey -= dt;
      if (thrKey <= 0 && (K.KeyW || K.KeyS)) {
        thrKey = 0.3;
        const steps = d.engine ? [-0.3, 0, 0.35, 0.7, 1] : [0, 0.35, 0.7, 1];
        let i = steps.findIndex((v) => Math.abs(v - s.throttle) < 0.01);
        if (i < 0) i = 1;
        i = U.clamp(i + (K.KeyW ? 1 : -1), 0, steps.length - 1);
        s.throttle = steps[i];
        if (s.throttle !== 0) s.anchor = false;
        s.ap = false;
        G.Audio.play('sail');
      }
    }
    const r = (K.KeyA ? 1 : 0) - (K.KeyD ? 1 : 0);
    if (r) { s.rudder = U.clamp(s.rudder + r * dt * 1.8, -1, 1); s.ap = false; }
    else if (!s.ap) s.rudder *= Math.max(0, 1 - dt * 1.5);
    s.driver = G.Net.myId;
  }
  S.helmKey = function (code) {
    const P = G.Player, s = P.ship;
    if (!s || !P.station || P.station.kind !== 'helm') return false;
    if (code === 'Space') {
      s.anchor = !s.anchor; if (s.anchor) { s.throttle = 0; s.ap = false; }
      G.UI.msg(s.anchor ? '⚓ Ancla echada' : '⚓ Ancla levada', 'info', 'anchor'); G.Audio.play('chain');
      return true;
    }
    if (code === 'KeyQ') {
      s.ap = !s.ap;
      if (s.ap) {
        const wp = G.UI.waypoint;
        s.apT = wp ? { x: wp.x, z: wp.z } : null; s.apYaw = s.yaw; s.anchor = false;
        G.UI.msg(wp ? '🧭 Piloto automático: rumbo al destino marcado en el mapa. Ya puedes soltar el timón.' : '🧭 Piloto automático: mantiene el rumbo. (Marca un destino en el mapa con clic)', 'good');
      } else G.UI.msg('🧭 Piloto automático desactivado', 'info');
      G.Audio.play('bell');
      return true;
    }
    return false;
  };

  // ------------------------------------------------------------------ objetivo del rayo y acciones
  const _rc = new THREE.Raycaster(), _o = new V3(), _d = new V3(), _lp = new V3();
  S.findTarget = function (o, d, best) {
    const P = G.Player, cand = [];
    for (const s of S.list) if (!s.sinking && Math.hypot(s.x - P.pos.x, s.z - P.pos.z) < s.def.L + 8) cand.push(s.root);
    if (!cand.length) return best;
    // Estación cercana (a bordo)
    if (P.ship) {
      const s = P.ship;
      let bs = null, bd = 1.6;
      for (const st of s.mdl.stations) {
        if (st.piece && !S.has(s, st.piece)) continue;
        if ((st.kind === 'net' && !s.def.net) || (st.kind === 'crate' && !S.has(s, 'caja')) || (st.kind === 'helm' && !S.has(s, 'timon'))) continue;
        const dd = Math.hypot(P.local.x - st.x, P.local.z - st.z);
        if (dd < bd) {
          const w = S.toWorld(s, _lp.set(st.x, s.def.deckY + 0.8, st.z), new V3());
          const t = w.sub(o).dot(d);
          if (t > -0.3) { bd = dd; bs = st; }
        }
      }
      if (bs) return { kind: 'station', s, st: bs, t: bd };
    }
    _rc.set(o, d); _rc.far = best ? Math.min(best.t, 6) : 6; _rc.camera = G.camera;
    const hits = _rc.intersectObjects(cand, true).filter((h) => h.object.userData.ship);
    if (!hits.length) return best;
    const h = hits[0], s = h.object.userData.ship, piece = h.object.userData.piece;
    if (s.building && piece && !s.placed.has(piece)) return { kind: 'piece', s, piece, t: h.distance };
    if (P.ship === s) return best;
    return { kind: 'ship', s, t: h.distance };
  };
  const PIECE_OF = (s, key) => (PIECES[s.type] || []).find((p) => p[0] === key);
  S.promptFor = function (tg) {
    const s = tg.s, P = G.Player, hid = G.Inv.heldId();
    if (tg.kind === 'piece') {
      const p = PIECE_OF(s, tg.piece);
      const need = Object.entries(p[2]).map(([id, n]) => `${G.ITEMS[id].i}${Math.min(G.Inv.count(id), n)}/${n}`).join(' ');
      const can = canPlace(s, p);
      let extra = '';
      if (tg.piece === 'mascaron') extra = ` · <kbd>R</kbd> Diseño: ${fhName(s.fh)}`;
      if (tg.piece === 'bandera') extra = ` · <kbd>R</kbd> Diseño: ${G.Shop.flagLabel(s.flag)}`;
      if (tg.piece === 'vela' || tg.piece === 'vela2') extra = ' · <kbd>R</kbd> Color de las velas';
      return `🏗️ <b>${p[1]}</b> ${need} · ` + (can === true ? '<kbd>E</kbd> Colocar pieza' : `<span class="warn">${can}</span>`) + extra;
    }
    if (tg.kind === 'station') {
      const st = tg.st;
      if (st.kind === 'helm') return st.seat ? '<kbd>E</kbd> Tomar los remos' : '☸️ <kbd>E</kbd> Tomar el timón';
      if (st.kind === 'seat') return '<kbd>E</kbd> Sentarse';
      if (st.kind === 'crate') return `🧰 <b>Caja de repuestos</b> · <kbd>E</kbd> Abrir` + (s.def.engine ? ` · ⚫ carbón para la caldera` : '');
      if (st.kind === 'bed') return '🛏️ <kbd>E</kbd> Dormir en la litera';
      if (st.kind === 'net') return s.net ? (s.netOn ? `🕸️ <kbd>E</kbd> Recoger la red (${s.netFish} peces)` : '🕸️ <kbd>E</kbd> Echar la red') : (hid === 'red_pesca' ? '🕸️ <kbd>E</kbd> Instalar la red de pesca' : '<span class="warn">🕸️ Aquí va una red de pesca</span>');
      if (st.kind === 'cannon') return '💣 <kbd>E</kbd> Usar el cañón';
    }
    if (tg.kind === 'ship') {
      let t = `<b>${s.def.icon} ${s.name}</b> ${hpBar(s.hp, s.def.hp)}`;
      if (s.building) t += ` · 🏗️ ${[...s.placed].length}/${PIECES[s.type].length} piezas`;
      else t += ' · <kbd>E</kbd> Subir a bordo';
      if (G.ITEMS[hid] && G.ITEMS[hid].rep === s.type) t += ' · <kbd>Clic</kbd> Reparar';
      if (s.team !== null && s.team !== undefined && G.Modes && G.Modes.active) t += ` · Equipo ${G.Modes.teamName(s.team)}`;
      return t;
    }
    return '';
  };
  function hpBar(v, max) { return `<span class="hp"><i style="width:${U.clamp(v / max, 0, 1) * 100}%"></i></span>`; }
  function canPlace(s, p) {
    if (p[0] !== 'casco' && !s.placed.has('casco')) return 'Primero coloca el casco';
    if ((p[0] === 'vela' || p[0] === 'vela2') && !s.placed.has(p[0] === 'vela' ? 'mastil' : 'mastil2')) return 'Primero coloca el mástil';
    for (const [id, n] of Object.entries(p[2])) if (G.Inv.count(id) < n) return `Te falta: ${G.ITEMS[id].n}`;
    return true;
  }
  S.interact = function (tg) {
    const s = tg.s, P = G.Player;
    if (tg.kind === 'piece') {
      const p = PIECE_OF(s, tg.piece), ok = canPlace(s, p);
      if (ok !== true) { G.UI.msg(ok, 'warn', 'piece'); G.Audio.play('error'); return; }
      for (const [id, n] of Object.entries(p[2])) G.Inv.remove(id, n);
      s.placed.add(p[0]);
      send({ t: 'shPiece', id: s.id, piece: p[0], fh: s.fh, sail: s.sailColor, flag: s.flag });
      G.Audio.play('hammer');
      G.UI.msg(`🔨 Colocaste: ${p[1]}`, 'good');
      S.refreshPieces(s);
      return;
    }
    if (tg.kind === 'ship') {
      if (s.building && !s.placed.has('cubierta')) { G.UI.msg('Aún no se puede subir: falta la cubierta.', 'warn'); return; }
      if (G.Modes && !G.Modes.canBoard(s)) return;
      S.board(s);
      return;
    }
    if (tg.kind === 'station') {
      const st = tg.st;
      if (st.kind === 'helm') {
        if (st.seat) { sitAt(s, 0); return; }
        if (G.Net.active && s.driver && s.driver !== G.Net.myId && G.Net.peers.has(s.driver) && [...G.Net.peers.values()].some((p) => p.id === s.driver && p.station === 'helm' && p.shipId === s.id)) { G.UI.msg(`${G.Net.nameOf(s.driver)} ya está al timón.`, 'warn'); return; }
        P.station = { kind: 'helm', st }; takeHelm(s); P.cam = P.cam === 'fp' ? 'fp' : 'tp';
        return;
      }
      if (st.kind === 'seat') { sitAt(s, 1); return; }
      if (st.kind === 'crate') { G.UI.openChest({ items: s.crate, ship: s, title: '🧰 Caja de repuestos · ' + s.name }); return; }
      if (st.kind === 'bed') { G.Game.sleep({ x: s.x, z: s.z, id: s.id, ship: s }); return; }
      if (st.kind === 'cannon') { P.station = { kind: 'cannon', st, aimY: 0, aimP: 0.12 }; G.UI.msg('💣 Apunta con el ratón · <kbd>Clic</kbd> disparar (pólvora + bala) · <kbd>E</kbd> soltar', 'info', 'cannon'); return; }
      if (st.kind === 'net') {
        if (!s.net) {
          if (G.Inv.heldId() !== 'red_pesca') { G.UI.msg('Necesitas una red de pesca en la mano para instalarla.', 'warn'); return; }
          G.Inv.consumeHeld(); s.net = true; send({ t: 'shNetInst', id: s.id }); G.Audio.play('craft'); G.UI.msg('🕸️ Red instalada en la popa.', 'good'); return;
        }
        if (s.netOn) {
          s.netOn = false;
          if (s.netFish > 0) { const got = G.Game.give('pez_crudo', s.netFish); s.netFish -= got; }
          G.Audio.play('reel');
        } else { s.netOn = true; G.UI.msg('🕸️ Red echada: navega despacio para pescar (mejor donde vuelan gaviotas).', 'info'); G.Audio.play('splash'); }
        return;
      }
    }
  };
  // Tecla E con una estación ocupada = soltarla
  S.releaseStation = function () {
    const P = G.Player;
    if (!P.station) return false;
    if (P.station.kind === 'helm') releaseHelm(P.ship);
    const seated = P.station.st && P.station.st.seat;
    P.station = null;
    if (seated) S.leave();
    return true;
  };
  S.rotatePiece = function (tg) {
    const s = tg.s;
    const next = (list, cur) => list[(list.indexOf(cur) + 1) % list.length];
    if (tg.piece === 'mascaron') { s.fh = next(S.FIGUREHEADS.concat(G.Shop.ownedOf('fh')), s.fh); S.rebuild(s); G.UI.msg(`Mascarón: ${fhName(s.fh)}`, 'info', 'fh'); return true; }
    if (tg.piece === 'vela' || tg.piece === 'vela2') { s.sailColor = next(S.SAILS.concat(G.Shop.ownedOf('sail')), s.sailColor); S.rebuild(s); if (typeof s.sailColor === 'string') G.UI.msg(`Velas: ${G.Shop.sailName[s.sailColor]}`, 'info', 'sail'); return true; }
    if (tg.piece === 'bandera') { s.flag = next(['clasica'].concat(G.Shop.ownedOf('flag')), s.flag || 'clasica'); if (s.flag === 'clasica') s.flag = null; S.rebuild(s); G.UI.msg(`Bandera: ${G.Shop.flagLabel(s.flag)}`, 'info', 'flag'); return true; }
    return false;
  };
  // A bordo, R pone al barco los diseños que llevas equipados en la Tienda
  S.applyLook = function (s) {
    const sail = G.Profile.equipped('sail'), flag = G.Profile.equipped('flag'), fh = G.Profile.equipped('fh');
    if (!sail && !flag && !fh) { G.UI.msg('Compra y equipa velas, banderas o mascarones en la Tienda para decorar tus barcos.', 'info', 'shiplook'); return false; }
    if (sail) s.sailColor = sail.replace('sail_', '');
    if (flag) s.flag = G.Shop.flagDesign(flag) || s.flag;
    if (fh && s.type === 'barco') s.fh = fh.replace('fh_', '');
    S.rebuild(s);
    send({ t: 'shLook', id: s.id, fh: s.fh, sail: s.sailColor, flag: s.flag });
    G.UI.msg(`🎨 ${s.name} luce tus diseños.`, 'good', 'shiplook');
    return true;
  };

  // ------------------------------------------------------------------ cañones y proyectiles
  let ballGeo, ballMat;
  function cannonWorld(s, st, P) {
    const c = st.c, o = S.toWorld(s, _lp.set(c.x + Math.sin(c.yaw) * 0.95, s.def.deckY + 0.47, c.z + Math.cos(c.yaw) * 0.95), new V3());
    const yaw = s.yaw + c.yaw + (P ? P.station.aimY : 0), pitch = P ? P.station.aimP : 0.12;
    const dir = new V3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    return { o, dir };
  }
  S.aimInput = function (dx, dy) {
    const P = G.Player;
    if (!P.station || P.station.kind !== 'cannon') return false;
    P.station.aimY = U.clamp(P.station.aimY - dx * 0.002, -0.6, 0.6);
    P.station.aimP = U.clamp(P.station.aimP - dy * 0.002, -0.08, 0.45);
    return true;
  };
  S.fireCannon = function (s, st) {
    const now = performance.now() / 1000;
    if ((s.reload[st.idx] || 0) > now) { G.UI.msg('Recargando…', 'warn', 'reload'); return; }
    const useFrom = (id) => { if (G.Inv.count(id) > 0) { G.Inv.remove(id, 1); return true; } const i = s.crate.findIndex((c) => c && c.id === id); if (i >= 0) { s.crate[i].n--; if (s.crate[i].n <= 0) s.crate[i] = null; send({ t: 'shCrate', id: s.id, items: s.crate }); return true; } return false; };
    const hasP = G.Inv.count('polvora') > 0 || s.crate.some((c) => c && c.id === 'polvora'), hasB = G.Inv.count('bala_canon') > 0 || s.crate.some((c) => c && c.id === 'bala_canon');
    if (!hasP || !hasB) { G.UI.msg('Necesitas pólvora y balas de cañón (en tu inventario o en la caja del barco).', 'warn', 'ammo'); G.Audio.play('error'); return; }
    G.Ach.add('cannon');
    useFrom('polvora'); useFrom('bala_canon');
    s.reload[st.idx] = now + 3.5;
    const { o, dir } = cannonWorld(s, st, G.Player.station && G.Player.station.st === st ? G.Player : null);
    const v = dir.multiplyScalar(62).add(_v.set(Math.sin(s.yaw) * s.speed, 0, Math.cos(s.yaw) * s.speed));
    const m = { t: 'cannon', x: o.x, y: o.y, z: o.z, vx: v.x, vy: v.y, vz: v.z, from: G.Net.myId, ship: s.id, team: G.Net.team ?? null };
    send(m);
    spawnBall(m, true);
    G.Player.shake = 0.35;
  };
  function spawnBall(m, mine) {
    if (!ballGeo) { ballGeo = new THREE.SphereGeometry(0.14, 10, 8); ballMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1c, metalness: 0.6, roughness: 0.4 }); }
    const b = new THREE.Mesh(ballGeo, ballMat);
    b.position.set(m.x, m.y, m.z);
    G.scene.add(b);
    S.proj.push({ m: b, v: new V3(m.vx, m.vy, m.vz), mine, from: m.from, ship: m.ship, team: m.team, t: 0 });
    G.Audio.playAt('cannon', m.x, m.z, 250);
    puff(m.x, m.y, m.z, 0x9a9a9a, 2.5, 1.4, 6);
    flash(m.x, m.y, m.z);
  }
  function updateProjectiles(dt) {
    for (let i = S.proj.length - 1; i >= 0; i--) {
      const p = S.proj[i], pos = p.m.position;
      p.t += dt;
      p.v.y -= 9.8 * dt;
      pos.addScaledVector(p.v, dt);
      let hit = null;
      const ground = G.height(pos.x, pos.z);
      if (pos.y < ground) hit = 'ground';
      else if (pos.y < G.World.waveHeight(pos.x, pos.z) && ground < -0.3) hit = 'water';
      if (!hit) for (const s of S.list) {
        if (s.id === p.ship || s.sinking) continue;
        if (Math.abs(s.x - pos.x) > s.def.L || Math.abs(s.z - pos.z) > s.def.L) continue;
        const l = S.toLocal(s, pos.x, pos.y, pos.z, _l2);
        if (Math.abs(l.z) < s.def.L / 2 && Math.abs(l.x) < halfW(s.def, l.z) + 0.2 && l.y > -s.def.draft && l.y < s.def.deckY + s.def.rail + 2.5) { hit = 'ship'; if (p.mine) { S.hurt(s, 45, `¡Impacto de cañón en ${s.name}!`, p.from); G.Ach.add('cannonHit'); } break; }
      }
      if (!hit && p.mine) {
        for (const c of G.Creatures.list) if (!c.dead && Math.hypot(c.x - pos.x, c.z - pos.z) < c.d.hitR + 0.8 && Math.abs(pos.y - (c.y + c.d.bodyY)) < 2.5) { hit = 'creature'; G.Creatures.hurt(c, 70); G.Ach.add('cannonHit'); break; }
        if (!hit) for (const pr of G.Net.peers.values()) {
          if (pr.dead || Math.hypot(pr.x - pos.x, pr.z - pos.z) > 1.3 || Math.abs(pos.y - pr.y - 1) > 1.4) continue;
          if (G.Modes && !G.Modes.canHurtPlayer(pr.team)) continue;
          hit = 'player'; send({ t: 'dmgP', to: pr.id, amt: 45, cause: `Una bala de cañón de ${G.Net.name}`, sx: pos.x, sz: pos.z, by: G.Net.myId }); break;
        }
      }
      if (!hit && p.t > 12) hit = 'lost';
      if (hit) {
        if (hit === 'water') { puff(pos.x, 0.2, pos.z, 0xffffff, 3, 2.2, 5); G.Audio.playAt('splash', pos.x, pos.z, 120); }
        else if (hit !== 'lost') {
          puff(pos.x, pos.y, pos.z, 0x5a5048, 4, 3, 8); flash(pos.x, pos.y, pos.z); G.Audio.playAt('explode', pos.x, pos.z, 200);
          if (p.mine && (hit === 'ground' || hit === 'ship') && G.Build) G.Build.blast(pos.x, pos.y, pos.z, 3.5, 90, p.from);
        }
        G.scene.remove(p.m);
        S.proj.splice(i, 1);
      }
    }
  }
  // Humo, salpicaduras y fogonazos
  function puff(x, y, z, color, size, rise, n) {
    const tex = G.Build.smokeTex;
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, transparent: true, depthWrite: false, opacity: 0.8 }));
      s.position.set(x + (Math.random() - 0.5) * size * 0.4, y, z + (Math.random() - 0.5) * size * 0.4);
      s.raycast = () => {};
      G.scene.add(s);
      S.fx.push({ o: s, t: 0, life: 1.2 + Math.random(), size, rise: rise * (0.6 + Math.random() * 0.6), vx: (Math.random() - 0.5) * 2, vz: (Math.random() - 0.5) * 2 });
    }
  }
  S.puff = puff;
  function flash(x, y, z) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.Build.smokeTex, color: 0xffc060, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.position.set(x, y, z); s.raycast = () => {};
    G.scene.add(s);
    S.fx.push({ o: s, t: 0, life: 0.25, size: 3, rise: 0, flash: true });
  }
  function updateFx(dt) {
    for (let i = S.fx.length - 1; i >= 0; i--) {
      const f = S.fx[i];
      f.t += dt;
      const k = f.t / f.life;
      if (k >= 1) { G.scene.remove(f.o); f.o.material.dispose(); S.fx.splice(i, 1); continue; }
      f.o.position.y += f.rise * dt;
      if (f.vx) { f.o.position.x += f.vx * dt; f.o.position.z += f.vz * dt; }
      f.o.scale.setScalar(f.size * (f.flash ? 1 + k : 0.5 + k));
      f.o.material.opacity = (1 - k) * (f.flash ? 1 : 0.7);
    }
  }

  // ------------------------------------------------------------------ colocar barcos y planos (fantasma)
  S.itemType = (id) => { const it = id && G.ITEMS[id]; return it ? it.ship || it.plano || null : null; };
  S.plan = function (type) {
    const P = G.Player, d = DEF[type], fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
    const dist = d.L / 2 + (d.small ? 2 : 3.5);
    const x = P.pos.x + fx * dist, z = P.pos.z + fz * dist, yaw = Math.atan2(fx, fz) + S.rot;
    const res = { ok: true, type, x, z, yaw, reason: '' };
    const need = -(d.draft + (d.small ? 0.1 : 0.4));
    const h = d.L / 2, pts = [[0, 0], [0, h], [0, -h], [d.W / 2, 0], [-d.W / 2, 0], [d.W / 3, h * 0.6], [-d.W / 3, -h * 0.6]];
    for (const [lx, lz] of pts) {
      const wx = x + lx * Math.cos(yaw) + lz * Math.sin(yaw), wz = z - lx * Math.sin(yaw) + lz * Math.cos(yaw);
      if (G.World.lakeAt(wx, wz)) { res.ok = false; res.reason = 'Los barcos van en el mar, no en un lago.'; break; }
      const g = G.height(wx, wz);
      if (g > need) { res.ok = false; res.reason = d.small ? 'Apunta al agua de la orilla.' : 'Aquí hay poca profundidad: busca aguas más hondas.'; break; }
    }
    if (res.ok && S.near(x, z, 2)) { res.ok = false; res.reason = 'Hay otro barco demasiado cerca.'; }
    return res;
  };
  S.updateGhost = function (type) {
    if (type !== S.ghostType) {
      if (S.ghost) { G.scene.remove(S.ghost); S.ghost.traverse((m) => { if (m.isMesh) m.geometry.dispose(); }); S.ghost = null; }
      S.ghostType = type;
      if (type) {
        S.ghost = buildModel(type, {}).root;
        S.ghost.traverse((m) => { if (m.isMesh) { m.material = ghostMat; m.castShadow = false; } });
        G.scene.add(S.ghost);
      }
    }
    if (!S.ghost) return null;
    const pl = S.plan(type);
    S.ghost.position.set(pl.x, G.World.waveHeight(pl.x, pl.z) * 0.5, pl.z);
    S.ghost.rotation.set(0, pl.yaw, 0);
    const m = pl.ok ? ghostMat : ghostBad;
    S.ghost.traverse((o) => { if (o.isMesh) o.material = m; });
    return pl;
  };
  const ghostBad = new THREE.MeshBasicMaterial({ color: 0xff5555, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide });
  S.placeHeld = function () {
    const held = G.Inv.held(), it = held && G.ITEMS[held.id];
    if (!it) return;
    const type = it.ship || it.plano;
    const pl = S.plan(type);
    if (!pl.ok) { G.UI.msg(pl.reason, 'warn', 'place'); G.Audio.play('error'); return; }
    const d = DEF[type];
    const data = { type, x: pl.x, z: pl.z, yaw: pl.yaw, building: !!it.plano, anchor: true, team: G.Net.team ?? null, flagColor: G.Modes && G.Modes.active ? G.Modes.teamColor(G.Net.team) : null };
    const eqS = G.Profile.equipped('sail'), eqF = G.Profile.equipped('flag'), eqH = G.Profile.equipped('fh');
    if (eqS) data.sail = eqS.replace('sail_', '');
    if (eqF && G.Shop.flagDesign(eqF)) data.flag = G.Shop.flagDesign(eqF);
    if (eqH && type === 'barco') data.fh = eqH.replace('fh_', '');
    if (!it.plano) data.crate = [{ id: d.rep, n: 2 }];
    const s = S.create(data);
    send({ t: 'shNew', d: S.data(s) });
    G.Inv.consumeHeld();
    G.Audio.play('place');
    if (it.plano) G.UI.msg(`📜 ¡Diseño de ${d.name} desplegado! Mira las piezas que brillan y colócalas con <kbd>E</kbd>.`, 'good');
    else { G.UI.msg(`${d.icon} ${d.name} en el agua. Súbete con <kbd>E</kbd>.`, 'good'); G.state.flags.raft = true; }
    if (G.Story) G.Story.onShipPlaced(s);
  };

  // ------------------------------------------------------------------ actualización por fotograma
  let sendT = 0;
  S.update = function (dt) {
    const now = performance.now();
    for (let i = S.list.length - 1; i >= 0; i--) {
      const s = S.list[i];
      if (s.sinking) {
        s.sinking += dt;
        s.y -= dt * 0.6; s.pitch += dt * 0.05; s.roll += dt * 0.08;
        placeRoot(s);
        if (s.sinking > 9) S.remove(s);
        continue;
      }
      if (s.building) { waterHeave(s); placeRoot(s); continue; }
      if (S.isAuth(s)) simulate(s, dt);
      else {
        // Interpolación + predicción con la velocidad recibida
        const k = 1 - Math.exp(-dt * 6);
        s.nx += Math.sin(s.nyaw) * s.speed * dt; s.nz += Math.cos(s.nyaw) * s.speed * dt;
        s.x += (s.nx - s.x) * k; s.z += (s.nz - s.z) * k;
        s.yaw += U.angDiff(s.yaw, s.nyaw) * k;
        if (now - s.lastNet > 3000 && G.Net.isHost) s.driver = null;
      }
      waterHeave(s);
      placeRoot(s);
      animate(s, dt);
      if (G.Player.ship === s && Math.abs(s.speed) > 0.3) G.Ach.sailed(Math.abs(s.speed) * dt);
      // Red de pesca
      if (s.netOn && S.isAuth(s)) {
        const sp = Math.abs(s.speed);
        if (sp > 0.5 && sp < 9) {
          s.netT += dt * (G.Landmarks.inSchool(s.x, s.z) ? 3 : 1);
          if (s.netT > 14) {
            s.netT = 0;
            if (s.netFish < 6) s.netFish++;
            if (G.Player.ship === s) G.UI.msg(`🐟 ¡Algo cayó en la red! (${s.netFish})`, 'good', 'netfish');
          }
        }
      }
    }
    updateProjectiles(dt);
    updateFx(dt);
    sendT -= dt;
    if (sendT <= 0 && G.Net.active) {
      sendT = 0.1;
      for (const s of S.list) if (!s.sinking && !s.building && S.isAuth(s) && (Math.abs(s.speed) > 0.05 || Math.abs(s.rudder) > 0.01 || (s.lastSent || 0) < now - 1500)) { send(netState(s)); s.lastSent = now; }
    }
  };
  function animate(s, dt) {
    const d = s.def, open = s.anchor ? 0 : d.sail ? U.clamp(s.throttle, 0, 1) : 0;
    for (const sl of s.mdl.sails) {
      if (sl.tri) { sl.m.scale.x = 0.3 + 0.9 * (open > 0 ? windFactor(s) : 0.3); continue; }
      const f = d.sail ? 0.12 + 0.88 * open : 1;
      sl.m.scale.y = U.lerp(sl.m.scale.y, f, Math.min(1, dt * 2));
      sl.m.scale.z = 0.2 + open * windFactor(s);
    }
    if (s.mdl.prop) s.mdl.prop.rotation.z += dt * s.speed * 2.5;
    if (s.mdl.smoke && s.throttle !== 0 && s.fuel > 0 && !s.anchor) {
      s.spark -= dt;
      if (s.spark <= 0) { s.spark = 0.25; const w = S.toWorld(s, _lp.set(s.mdl.smoke.x, s.mdl.smoke.y, s.mdl.smoke.z), new V3()); puff(w.x, w.y, w.z, 0x3a3a3a, 1.2, 2.5, 1); }
    }
    if (s.mdl.netMesh) s.mdl.netMesh.visible = s.netOn;
    const f = s.mdl.flag;
    if (f) {
      const p = f.geometry.attributes.position, b = f.userData.base, t = performance.now() / 1000;
      for (let i = 0; i < p.count; i++) { const x = b[i * 3]; p.setZ(i, Math.sin(x * 3 - t * 5) * 0.12 * (x / f.userData.w)); }
      p.needsUpdate = true;
    }
  }

  // Cámara de persecución al timón (y detrás del cañón)
  S.cameraFor = function (camera) {
    const P = G.Player, s = P.ship;
    if (!s || !P.station) return false;
    if (P.station.kind === 'cannon') {
      const { o, dir } = cannonWorld(s, P.station.st, P);
      camera.position.copy(o).addScaledVector(dir, -2.2); camera.position.y += 0.9;
      camera.lookAt(o.x + dir.x * 30, o.y + dir.y * 30 + 0.5, o.z + dir.z * 30);
      return true;
    }
    if (P.station.kind === 'helm' && P.cam === 'tp') {
      const d = s.def, dist = d.L * 1.1 + 6, a = P.yaw, pt = P.pitch;
      const tx = s.x, ty = s.y + d.deckY + 2, tz = s.z;
      camera.position.set(tx + Math.sin(a) * Math.cos(pt) * dist, ty + 3 + Math.sin(-pt + 0.25) * dist * 0.6, tz + Math.cos(a) * Math.cos(pt) * dist);
      camera.position.y = Math.max(camera.position.y, 1.5);
      camera.lookAt(tx, ty, tz);
      return true;
    }
    return false;
  };
  // Información para la interfaz del barco
  S.hud = function () {
    const P = G.Player, s = P.ship;
    if (!s) return null;
    const d = s.def, Wx = G.Weather;
    return {
      name: s.name, icon: d.icon, hp: s.hp, max: d.hp, knots: Math.abs(s.speed) * 1.94, throttle: s.throttle, anchor: s.anchor, ap: s.ap,
      wind: d.sail ? U.angDiff(s.yaw, Wx.windA || 0) : null, windS: Wx.windS, fuel: d.engine ? s.fuel : null, net: s.net ? (s.netOn ? s.netFish : -1) : null,
      station: P.station ? P.station.kind : null, paddle: !!d.paddle, engine: !!d.engine, reload: P.station && P.station.kind === 'cannon' ? Math.max(0, (s.reload[P.station.st.idx] || 0) - performance.now() / 1000) : 0,
    };
  };
})();
