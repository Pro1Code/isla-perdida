// Recursos naturales: árboles, rocas, arbustos, minerales y objetos recogibles de todas las islas.
// Optimización: instancias agrupadas por zonas (chunks) con recorte por distancia,
// y versiones de bajo detalle (LOD) para los árboles y rocas lejanos.
(function () {
  'use strict';
  const G = window.G, U = G.U;
  const R = (G.Res = { list: [], grid: new Map(), CELL: 8, CHUNK: 64, chunks: [], shaking: [], falling: [], lodDist: { value: 95 }, baseCount: 0, extraMeshes: [] });
  const V3 = THREE.Vector3, Col = THREE.Color;
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new V3(), _s = new V3();

  // ------------------------------------------------------------------ geometrías (detalle completo)
  function bendTrunk(g, H, lean) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i), k = y / H, ring = 1 + Math.max(0, Math.sin(y * 6.5)) * 0.08;
      p.setXYZ(i, p.getX(i) * ring + k * k * lean, y, p.getZ(i) * ring);
    }
    g.computeVertexNormals();
  }
  function frond(tx, ty, a, L, droop, rise, ws, ls) {
    const g = new THREE.PlaneGeometry(2, 1, ws, ls);
    const q = g.attributes.position, ca = Math.cos(a), sa = Math.sin(a);
    for (let i = 0; i < q.count; i++) {
      const side = q.getX(i) * 0.5, k = q.getY(i) + 0.5;
      const along = k * L;
      const sx = side * 2 * 0.55 * Math.sin(Math.PI * Math.min(1, 0.08 + k * 0.95));
      const yy = rise * k - droop * k * k + Math.abs(sx) * 0.35;
      q.setXYZ(i, tx + along * ca - sx * sa, ty + yy, along * sa + sx * ca);
    }
    g.computeVertexNormals();
    return g;
  }
  // Blanquea las caras que miran hacia arriba (nieve acumulada)
  function snowCap(geo, amt = 0.55) {
    const n = geo.attributes.normal, c = geo.attributes.color, w = new Col(0xf4f8fc), t = new Col();
    for (let i = 0; i < n.count; i += 3) {
      const ny = (n.getY(i) + n.getY(i + 1) + n.getY(i + 2)) / 3;
      if (ny < amt) continue;
      for (let k = 0; k < 3; k++) { t.setRGB(c.getX(i + k), c.getY(i + k), c.getZ(i + k)).lerp(w, U.smooth(amt, amt + 0.25, ny)); c.setXYZ(i + k, t.r, t.g, t.b); }
    }
    return geo;
  }
  function palm(rnd) {
    const parts = [];
    const H = 6.5 + rnd() * 2.5, lean = 0.6 + rnd() * 1.4;
    const tg = new THREE.CylinderGeometry(0.16, 0.27, H, 8, 14, false);
    tg.translate(0, H / 2, 0);
    bendTrunk(tg, H, lean);
    parts.push(U.colored(tg, 0x86694a, 0.12, rnd));
    const n = 8 + Math.floor(rnd() * 3);
    for (let f = 0; f < n; f++) {
      const g = frond(lean, H, (f / n) * Math.PI * 2 + rnd() * 0.4, 3.4 + rnd() * 1.2, 1.3 + rnd() * 1.2, 0.6 + rnd() * 0.5, 4, 10);
      parts.push(U.colored(g, new Col(0x3f7d2c).offsetHSL((rnd() - 0.5) * 0.04, 0, (rnd() - 0.5) * 0.08), 0.1, rnd));
    }
    for (let c = 0; c < 3; c++) {
      const cg = new THREE.SphereGeometry(0.19, 7, 5);
      cg.translate(lean + Math.cos(c * 2.1) * 0.25, H - 0.25, Math.sin(c * 2.1) * 0.25);
      parts.push(U.colored(cg, 0x5b4225, 0.1, rnd));
    }
    return U.merge(parts);
  }
  function oak(rnd, leaf = 0x3e6b24, bark = 0x5e4630, big = 1) {
    const parts = [];
    const H = (3.6 + rnd() * 1.4) * big;
    const t = new THREE.CylinderGeometry(0.2 * big, 0.36 * big, H, 7, 4);
    t.translate(0, H / 2, 0);
    parts.push(U.colored(t, bark, 0.12, rnd));
    for (let b = 0; b < 3; b++) {
      const bl = (1.4 + rnd()) * big;
      const bg = new THREE.CylinderGeometry(0.07 * big, 0.13 * big, bl, 5);
      bg.translate(0, bl / 2, 0);
      bg.rotateZ(0.6 + rnd() * 0.4);
      bg.rotateY(b * 2.1 + rnd());
      bg.translate(0, H * 0.7, 0);
      parts.push(U.colored(bg, bark, 0.1, rnd));
    }
    const nb = 6 + Math.floor(rnd() * 3);
    for (let i = 0; i < nb; i++) {
      const r = (1.2 + rnd() * 0.8) * big;
      const g = U.blob(r, 1, 0.35, rnd() * 10);
      const a = rnd() * Math.PI * 2, d = i === 0 ? 0 : (0.9 + rnd() * 0.9) * big;
      g.scale(1, 0.8, 1);
      g.translate(Math.cos(a) * d, H + 0.6 * big + rnd() * 1.4 * big - d * 0.3, Math.sin(a) * d);
      parts.push(U.colored(g, new Col(leaf).offsetHSL((rnd() - 0.5) * 0.05, 0, (rnd() - 0.5) * 0.1), 0.12, rnd));
    }
    return U.merge(parts);
  }
  // Ceiba de la selva: tronco con contrafuertes, copa ancha y lianas
  function ceiba(rnd) {
    const parts = [];
    const H = 7 + rnd() * 2;
    const t = new THREE.CylinderGeometry(0.35, 0.6, H, 9, 5);
    t.translate(0, H / 2, 0);
    parts.push(U.colored(t, 0x6b5a44, 0.1, rnd));
    for (let i = 0; i < 4; i++) {
      const b = new THREE.BoxGeometry(0.16, 1.6, 1.3);
      b.translate(0, 0.8, 0.6); b.rotateY(i * Math.PI / 2 + rnd() * 0.3);
      parts.push(U.colored(b, 0x5e4e3a, 0.1, rnd));
    }
    for (let i = 0; i < 9; i++) {
      const r = 1.8 + rnd() * 0.9, g = U.blob(r, 1, 0.3, rnd() * 10);
      const a = rnd() * Math.PI * 2, d = i === 0 ? 0 : 1.6 + rnd() * 1.8;
      g.scale(1, 0.6, 1);
      g.translate(Math.cos(a) * d, H + 0.3 + rnd() * 1.2, Math.sin(a) * d);
      parts.push(U.colored(g, new Col(0x2f6a22).offsetHSL((rnd() - 0.5) * 0.05, 0, (rnd() - 0.5) * 0.08), 0.12, rnd));
    }
    for (let i = 0; i < 5; i++) {
      const L = 2 + rnd() * 3, v = new THREE.CylinderGeometry(0.025, 0.025, L, 4);
      const a = rnd() * Math.PI * 2, d = 1.2 + rnd() * 2;
      v.translate(Math.cos(a) * d, H - L / 2, Math.sin(a) * d);
      parts.push(U.colored(v, 0x3d5a22, 0.1, rnd));
    }
    return U.merge(parts);
  }
  function bamboo(rnd) {
    const parts = [];
    const n = 6 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) {
      const H = 6 + rnd() * 3, r = 0.07 + rnd() * 0.03, a = rnd() * Math.PI * 2, d = rnd() * 0.6;
      const lx = (rnd() - 0.5) * 0.7, lz = (rnd() - 0.5) * 0.7;
      const st = new THREE.CylinderGeometry(r * 0.8, r, H, 6, 1);
      st.translate(0, H / 2, 0);
      const bend = (g) => { const p = g.attributes.position; for (let k = 0; k < p.count; k++) { const y = p.getY(k) / H; p.setX(k, p.getX(k) + lx * y * y); p.setZ(k, p.getZ(k) + lz * y * y); } };
      bend(st);
      st.translate(Math.cos(a) * d, 0, Math.sin(a) * d);
      parts.push(U.colored(st, new Col(0x8aa83a).offsetHSL(0, 0, (rnd() - 0.5) * 0.08), 0.06, rnd));
      for (let y = 0.9; y < H; y += 0.9 + rnd() * 0.3) {
        const k = new THREE.CylinderGeometry(r * 1.15, r * 1.15, 0.05, 6);
        const t = y / H;
        k.translate(Math.cos(a) * d + lx * t * t, y, Math.sin(a) * d + lz * t * t);
        parts.push(U.colored(k, 0x5e7424, 0.05, rnd));
      }
      for (let l = 0; l < 4; l++) {
        const leaf = new THREE.ConeGeometry(0.12, 0.9, 3);
        leaf.rotateZ(Math.PI / 2 + (rnd() - 0.5)); leaf.rotateY(rnd() * 6.28);
        leaf.translate(Math.cos(a) * d + lx, H - rnd() * 1.6, Math.sin(a) * d + lz);
        parts.push(U.colored(leaf, 0x4f8a2a, 0.1, rnd));
      }
    }
    return U.merge(parts);
  }
  function pine(rnd, snowy) {
    const parts = [];
    const H = 7 + rnd() * 3;
    const t = new THREE.CylinderGeometry(0.16, 0.3, H, 6);
    t.translate(0, H / 2, 0);
    parts.push(U.colored(t, 0x4f3a28, 0.1, rnd));
    for (let l = 0; l < 5; l++) {
      const k = l / 5, r = 2.3 * (1 - k * 0.75), h = 2.4 - k * 0.6;
      const cg = new THREE.ConeGeometry(r, h, 9, 2);
      const p = cg.attributes.position;
      for (let i = 0; i < p.count; i++) {
        if (p.getY(i) < h / 2 - 0.01) {
          const f = 1 + Math.sin(i * 12.9898 + l) * 0.5 * 0.25;
          p.setX(i, p.getX(i) * f); p.setZ(i, p.getZ(i) * f);
        }
      }
      cg.computeVertexNormals();
      cg.translate(0, 2.2 + l * 1.35 + h / 2, 0);
      const cc = U.colored(cg, new Col(snowy ? 0x2a4a38 : 0x2d5530).offsetHSL(0, 0, (rnd() - 0.5) * 0.06), 0.12, rnd);
      parts.push(snowy ? snowCap(cc, 0.35) : cc);
    }
    return U.merge(parts);
  }
  function deadTree(rnd) {
    const parts = [];
    const H = 4 + rnd() * 2.5;
    const t = new THREE.CylinderGeometry(0.14, 0.3, H, 6, 3);
    t.translate(0, H / 2, 0);
    parts.push(U.colored(t, 0x3a2e26, 0.15, rnd));
    for (let b = 0; b < 5; b++) {
      const bl = 1 + rnd() * 1.4, bg = new THREE.CylinderGeometry(0.03, 0.09, bl, 4);
      bg.translate(0, bl / 2, 0); bg.rotateZ(0.5 + rnd() * 0.7); bg.rotateY(b * 1.3 + rnd());
      bg.translate(0, H * (0.45 + rnd() * 0.5), 0);
      parts.push(U.colored(bg, b % 2 ? 0x2a211c : 0x3a2e26, 0.15, rnd));
    }
    return U.merge(parts);
  }
  function rockColor(g, rnd, baseC = 0x8a847a, topC = 0x56722e, topAmt = 0.75) {
    g = g.toNonIndexed();
    g.computeVertexNormals();
    const n = g.attributes.normal, cnt = g.attributes.position.count, col = new Float32Array(cnt * 3);
    const base = new Col(baseC), moss = new Col(topC), c = new Col();
    for (let i = 0; i < cnt; i += 3) {
      const ny = (n.getY(i) + n.getY(i + 1) + n.getY(i + 2)) / 3;
      c.copy(base).multiplyScalar(0.8 + rnd() * 0.3);
      c.lerp(moss, U.smooth(0.6, 0.92, ny) * topAmt);
      for (let k = 0; k < 3; k++) { col[(i + k) * 3] = c.r; col[(i + k) * 3 + 1] = c.g; col[(i + k) * 3 + 2] = c.b; }
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  }
  function rockShape(rnd) { const g = U.blob(1.3, 1, 0.55, rnd() * 10); g.scale(1.25, 0.75, 1.0); g.translate(0, 0.35, 0); return g; }
  const rock = (rnd) => rockColor(rockShape(rnd), rnd);
  const snowRock = (rnd) => rockColor(rockShape(rnd), rnd, 0x7e8894, 0xf2f6fa, 0.95);
  const basalt = (rnd) => rockColor(rockShape(rnd), rnd, 0x34302e, 0x4e463e, 0.5);
  function bush(rnd, color = 0x2f5a22, snowy) {
    const parts = [];
    for (let i = 0; i < 4; i++) {
      const g = U.blob(0.55 + rnd() * 0.25, 1, 0.3, rnd() * 9);
      g.translate((rnd() - 0.5) * 0.7, 0.5 + rnd() * 0.3, (rnd() - 0.5) * 0.7);
      const cg = U.colored(g, new Col(color).offsetHSL(0, 0, (rnd() - 0.5) * 0.06), 0.12, rnd);
      parts.push(snowy ? snowCap(cg, 0.4) : cg);
    }
    return U.merge(parts);
  }
  function berries(rnd, color = 0xc0182a) {
    const parts = [];
    for (let i = 0; i < 18; i++) {
      const a = rnd() * Math.PI * 2, u = rnd() * 0.9;
      const g = new THREE.SphereGeometry(0.075, 5, 4);
      g.translate(Math.cos(a) * Math.sqrt(1 - u * u) * 0.85, 0.55 + u * 0.55, Math.sin(a) * Math.sqrt(1 - u * u) * 0.85);
      parts.push(U.colored(g, color, 0.1, rnd));
    }
    return U.merge(parts);
  }
  // Árbol de cacao: arbolito con mazorcas amarillas y naranjas
  function cacaoTree(rnd) {
    const parts = [];
    const t = new THREE.CylinderGeometry(0.1, 0.16, 1.8, 6);
    t.translate(0, 0.9, 0);
    parts.push(U.colored(t, 0x5a4632, 0.1, rnd));
    for (let i = 0; i < 4; i++) {
      const g = U.blob(0.8 + rnd() * 0.3, 1, 0.3, rnd() * 9);
      g.scale(1, 0.7, 1);
      g.translate((rnd() - 0.5) * 1.1, 2.1 + rnd() * 0.4, (rnd() - 0.5) * 1.1);
      parts.push(U.colored(g, new Col(0x2e6a26).offsetHSL(0, 0, (rnd() - 0.5) * 0.06), 0.12, rnd));
    }
    return U.merge(parts);
  }
  function cacaoPods(rnd) {
    const parts = [];
    for (let i = 0; i < 7; i++) {
      const a = rnd() * Math.PI * 2, g = new THREE.SphereGeometry(0.1, 7, 5);
      g.scale(0.8, 1.5, 0.8);
      g.translate(Math.cos(a) * 0.14, 0.6 + rnd() * 1.1, Math.sin(a) * 0.14);
      parts.push(U.colored(g, rnd() < 0.5 ? 0xe0a020 : 0xd0601a, 0.1, rnd));
    }
    return U.merge(parts);
  }
  function fiber(rnd, color = 0xa3b04e) {
    const parts = [];
    for (let i = 0; i < 11; i++) {
      const h = 0.8 + rnd() * 0.7;
      const g = new THREE.ConeGeometry(0.05, h, 3);
      g.translate(0, h / 2, 0);
      g.rotateZ((rnd() - 0.5) * 0.7);
      g.rotateX((rnd() - 0.5) * 0.7);
      g.translate((rnd() - 0.5) * 0.35, 0, (rnd() - 0.5) * 0.35);
      parts.push(U.colored(g, new Col(color).offsetHSL(0, 0, (rnd() - 0.5) * 0.1), 0.1, rnd));
    }
    return U.merge(parts);
  }
  function stick(rnd) {
    const a = new THREE.CylinderGeometry(0.035, 0.05, 1.1, 5);
    a.rotateZ(Math.PI / 2); a.translate(0, 0.05, 0);
    const b = new THREE.CylinderGeometry(0.018, 0.025, 0.35, 4);
    b.rotateZ(Math.PI / 2 - 0.7); b.translate(0.15, 0.1, 0.05);
    return U.merge([U.colored(a, 0x6a4a2c, 0.1, rnd), U.colored(b, 0x6a4a2c, 0.1, rnd)]);
  }
  function driftwood(rnd) {
    const a = new THREE.CylinderGeometry(0.12, 0.16, 2.2, 7);
    a.rotateZ(Math.PI / 2); a.translate(0, 0.1, 0);
    const b = new THREE.CylinderGeometry(0.04, 0.07, 0.7, 5);
    b.rotateZ(Math.PI / 2 - 0.8); b.translate(0.5, 0.25, 0.05);
    return U.merge([U.colored(a, 0xa89a84, 0.12, rnd), U.colored(b, 0x9a8c76, 0.12, rnd)]);
  }
  function stone(rnd) { const g = U.blob(0.2, 0, 0.3, rnd() * 5); g.scale(1.2, 0.7, 1); return U.colored(g, 0x8d8980, 0.15, rnd); }
  function flint(rnd) { const g = new THREE.OctahedronGeometry(0.15); g.scale(1.3, 0.55, 1); return U.colored(g, 0x3a4658, 0.2, rnd); }
  function coconut(rnd) { return U.colored(new THREE.SphereGeometry(0.2, 7, 5), 0x5b3f22, 0.1, rnd); }
  function clam(rnd) {
    const parts = [];
    for (let i = 0; i < 3; i++) {
      const s = new THREE.SphereGeometry(0.07, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2);
      s.scale(1.2, 0.45, 1); s.rotateY(rnd() * 6); s.translate((rnd() - 0.5) * 0.3, 0.01, (rnd() - 0.5) * 0.3);
      parts.push(U.colored(s, new Col(0xe0cfc0).offsetHSL(0, 0, (rnd() - 0.5) * 0.15), 0.1, rnd));
    }
    return U.merge(parts);
  }
  function oyster(rnd) {
    const parts = [];
    for (let i = 0; i < 3; i++) {
      const s = new THREE.SphereGeometry(0.16, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2);
      s.scale(1.3, 0.35, 1); s.rotateY(rnd() * 6); s.translate((rnd() - 0.5) * 0.4, 0.02, (rnd() - 0.5) * 0.4);
      parts.push(U.colored(s, 0x5a5048, 0.15, rnd));
    }
    const p = new THREE.SphereGeometry(0.06, 8, 6); p.translate(0, 0.07, 0);
    parts.push(U.colored(p, 0xf4f0ea, 0.02, rnd));
    return U.merge(parts);
  }
  function herb(rnd, leaf = 0x3f7f35, flower = 0xf2f0e6) {
    const parts = [];
    for (let i = 0; i < 9; i++) {
      const l = new THREE.SphereGeometry(0.09, 6, 4); l.scale(0.45, 0.12, 1.3);
      l.translate(0, 0.02, 0.1); l.rotateX(-0.5 - rnd() * 0.4); l.rotateY((i / 9) * Math.PI * 2);
      l.translate(0, 0.08 + rnd() * 0.12, 0);
      parts.push(U.colored(l, leaf, 0.15, rnd));
    }
    for (let i = 0; i < 5; i++) {
      const f = new THREE.SphereGeometry(0.035, 6, 4);
      f.translate((rnd() - 0.5) * 0.2, 0.28 + rnd() * 0.08, (rnd() - 0.5) * 0.2);
      parts.push(U.colored(f, flower, 0.05, rnd));
    }
    return U.merge(parts);
  }
  function ore(rnd, base, spot, count) {
    let g = U.blob(0.75, 1, 0.5, rnd() * 9);
    g.scale(1.1, 0.8, 1); g.translate(0, 0.25, 0);
    g = g.toNonIndexed(); g.computeVertexNormals();
    const cnt = g.attributes.position.count, col = new Float32Array(cnt * 3), c = new Col();
    for (let i = 0; i < cnt; i += 3) {
      c.set(rnd() < count ? spot : base).multiplyScalar(0.8 + rnd() * 0.35);
      for (let k = 0; k < 3; k++) { col[(i + k) * 3] = c.r; col[(i + k) * 3 + 1] = c.g; col[(i + k) * 3 + 2] = c.b; }
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  }
  const ironOre = (rnd) => ore(rnd, 0x5e5650, 0xb5652e, 0.3);
  const silverOre = (rnd) => ore(rnd, 0x646a72, 0xe8eef4, 0.3);
  const sulfurOre = (rnd) => ore(rnd, 0x6a6048, 0xe8d23a, 0.45);
  const coalOre = (rnd) => ore(rnd, 0x3e3a38, 0x0e0c0c, 0.5);
  function crystals(rnd, colors, n = 6) {
    const parts = [];
    for (let i = 0; i < n; i++) {
      const o = new THREE.OctahedronGeometry(0.25 + rnd() * 0.2);
      o.scale(0.7, 1.8 + rnd(), 0.7); o.rotateZ((rnd() - 0.5) * 0.8); o.rotateX((rnd() - 0.5) * 0.8);
      o.translate((rnd() - 0.5) * 0.7, 0.3, (rnd() - 0.5) * 0.7);
      parts.push(U.colored(o, new Col(colors[i % colors.length]).offsetHSL(0, 0, rnd() * 0.05), 0.3, rnd));
    }
    return U.merge(parts);
  }
  const obsidian = (rnd) => crystals(rnd, [0x1a1622]);
  const ice = (rnd) => crystals(rnd, [0xa8e0f8, 0x7cc8f0, 0xd8f2ff], 7);

  // ------------------------------------------------------------------ geometrías de bajo detalle (LOD)
  function palmLod(rnd) {
    const H = 7.6, lean = 1.2;
    const tg = new THREE.CylinderGeometry(0.16, 0.27, H, 5, 3);
    tg.translate(0, H / 2, 0);
    bendTrunk(tg, H, lean);
    const parts = [U.colored(tg, 0x86694a, 0.05, rnd)];
    for (let f = 0; f < 7; f++) parts.push(U.colored(frond(lean, H, (f / 7) * Math.PI * 2, 3.9, 1.8, 0.8, 1, 3), 0x3f7d2c, 0.05, rnd));
    return U.merge(parts);
  }
  function oakLod(rnd, leaf = 0x3e6b24, big = 1, H = 4.3) {
    const t = new THREE.CylinderGeometry(0.2 * big, 0.36 * big, H * big, 5);
    t.translate(0, H * big / 2, 0);
    const parts = [U.colored(t, 0x5e4630, 0.05, rnd)];
    for (let i = 0; i < 3; i++) {
      const g = U.blob(1.75 * big, 0, 0.3, i * 3 + 1);
      g.scale(1, 0.8, 1);
      g.translate(Math.cos(i * 2.1) * 0.9 * big, (H + 0.9) * big + (i === 0 ? 0.6 : 0), Math.sin(i * 2.1) * 0.9 * big);
      parts.push(U.colored(g, leaf, 0.1, rnd));
    }
    return U.merge(parts);
  }
  const ceibaLod = (rnd) => oakLod(rnd, 0x2f6a22, 1.5, 5.2);
  function pineLod(rnd, snowy) {
    const t = new THREE.CylinderGeometry(0.16, 0.3, 8.5, 5);
    t.translate(0, 4.25, 0);
    const parts = [U.colored(t, 0x4f3a28, 0.05, rnd)];
    [[2.3, 3.4, 2.2], [1.7, 2.8, 4.4], [1.0, 2.4, 6.4]].forEach(([r, h, y]) => {
      const c = new THREE.ConeGeometry(r, h, 7);
      c.translate(0, y + h / 2, 0);
      const cc = U.colored(c, snowy ? 0x2a4a38 : 0x2d5530, 0.08, rnd);
      parts.push(snowy ? snowCap(cc, 0.35) : cc);
    });
    return U.merge(parts);
  }
  function bambooLod(rnd) {
    const parts = [];
    for (let i = 0; i < 3; i++) {
      const c = new THREE.CylinderGeometry(0.08, 0.1, 7.5, 4);
      c.translate(Math.cos(i * 2.1) * 0.3, 3.75, Math.sin(i * 2.1) * 0.3);
      parts.push(U.colored(c, 0x8aa83a, 0.05, rnd));
    }
    const l = U.blob(1.0, 0, 0.3, 4); l.scale(1, 1.6, 1); l.translate(0, 6.6, 0);
    parts.push(U.colored(l, 0x4f8a2a, 0.08, rnd));
    return U.merge(parts);
  }
  function deadLod(rnd) {
    const t = new THREE.CylinderGeometry(0.14, 0.3, 5, 4);
    t.translate(0, 2.5, 0);
    const b = new THREE.CylinderGeometry(0.04, 0.08, 1.8, 3);
    b.translate(0, 0.9, 0); b.rotateZ(0.8); b.translate(0, 3.2, 0);
    return U.merge([U.colored(t, 0x3a2e26, 0.05, rnd), U.colored(b, 0x3a2e26, 0.05, rnd)]);
  }
  function rockLodShape() { const g = U.blob(1.3, 0, 0.5, 3); g.scale(1.25, 0.75, 1); g.translate(0, 0.35, 0); return g; }
  const rockLod = (rnd) => rockColor(rockLodShape(), rnd);
  const snowRockLod = (rnd) => rockColor(rockLodShape(), rnd, 0x7e8894, 0xf2f6fa, 0.95);
  const basaltLod = (rnd) => rockColor(rockLodShape(), rnd, 0x34302e, 0x4e463e, 0.5);
  function bushLod(rnd, color = 0x2f5a22) { const g = U.blob(0.85, 0, 0.3, 2); g.translate(0, 0.62, 0); return U.colored(g, color, 0.1, rnd); }

  // ------------------------------------------------------------------ tipos
  const KINDS = (R.KINDS = {
    palm: { name: 'Palmera', build: palm, lod: palmLod, variants: 2, r: 0.35, hp: 7, tool: 'hacha', hit: [['madera', 1]], fin: [['madera', 2], ['coco', 2]], focusY: 1.4, hitR: 0.9, respawn: 3, tree: true, sink: 0.25, scale: [0.85, 1.15], solid: true },
    oak: { name: 'Árbol', build: (r) => oak(r), lod: (r) => oakLod(r), variants: 3, r: 0.45, hp: 9, tool: 'hacha', hit: [['madera', 1]], fin: [['madera', 3], ['palo', 2]], focusY: 1.4, hitR: 1.0, respawn: 3, tree: true, sink: 0.25, scale: [0.85, 1.25], solid: true },
    ceiba: { name: 'Ceiba', build: ceiba, lod: ceibaLod, variants: 2, r: 0.65, hp: 13, tool: 'hacha', hit: [['madera', 1]], fin: [['madera', 5], ['palo', 2]], focusY: 1.5, hitR: 1.1, respawn: 4, tree: true, sink: 0.3, scale: [0.85, 1.2], solid: true },
    bamboo: { name: 'Bambú', build: bamboo, lod: bambooLod, variants: 2, r: 0.55, hp: 5, tool: 'hacha', hit: [['bambu', 1]], fin: [['bambu', 3], ['fibra', 1]], focusY: 1.4, hitR: 1.0, respawn: 2, tree: true, sink: 0.1, scale: [0.85, 1.15], solid: true },
    pine: { name: 'Pino', build: (r) => pine(r), lod: (r) => pineLod(r), variants: 2, r: 0.4, hp: 10, tool: 'hacha', hit: [['madera', 1]], fin: [['madera', 4]], focusY: 1.4, hitR: 1.0, respawn: 3, tree: true, sink: 0.25, scale: [0.8, 1.2], solid: true },
    snowpine: { name: 'Pino nevado', build: (r) => pine(r, true), lod: (r) => pineLod(r, true), variants: 2, r: 0.4, hp: 10, tool: 'hacha', hit: [['madera', 1]], fin: [['madera', 4], ['palo', 1]], focusY: 1.4, hitR: 1.0, respawn: 3, tree: true, sink: 0.25, scale: [0.8, 1.25], solid: true },
    deadtree: { name: 'Árbol calcinado', build: deadTree, lod: deadLod, variants: 2, r: 0.35, hp: 6, tool: 'hacha', hit: [['madera', 1]], fin: [['madera', 2], ['carbon', 1]], focusY: 1.4, hitR: 0.9, respawn: 3, tree: true, sink: 0.2, scale: [0.85, 1.2], solid: true },
    rock: { name: 'Roca', build: rock, lod: rockLod, variants: 3, r: 1.25, hp: 10, tool: 'pico', hit: [['piedra', 1]], flint: 0.25, fin: [['piedra', 3], ['silex', 1]], focusY: 0.6, hitR: 1.5, respawn: 4, sink: 0.35, scale: [0.7, 1.5], solid: true, mat: 'rock' },
    snowrock: { name: 'Roca helada', build: snowRock, lod: snowRockLod, variants: 3, r: 1.25, hp: 10, tool: 'pico', hit: [['piedra', 1]], flint: 0.2, fin: [['piedra', 3], ['silex', 1]], focusY: 0.6, hitR: 1.5, respawn: 4, sink: 0.35, scale: [0.7, 1.5], solid: true, mat: 'rock' },
    basalt: { name: 'Roca volcánica', build: basalt, lod: basaltLod, variants: 3, r: 1.25, hp: 11, tool: 'pico', hit: [['piedra', 1]], bonus: ['obsidiana', 0.12], fin: [['piedra', 3], ['silex', 1]], focusY: 0.6, hitR: 1.5, respawn: 4, sink: 0.35, scale: [0.7, 1.6], solid: true, mat: 'rock' },
    bush: { name: 'Arbusto de bayas', build: (r) => bush(r), lod: (r) => bushLod(r), fruit: (r) => berries(r), variants: 2, r: 0.5, gives: [['baya', 3]], focusY: 0.7, hitR: 0.9, respawn: 1, sink: 0.1, scale: [0.8, 1.2], solid: true, bush: true },
    snowbush: { name: 'Arbusto de bayas de escarcha', build: (r) => bush(r, 0x46624e, true), lod: (r) => bushLod(r, 0x8aa09a), fruit: (r) => berries(r, 0x5a7ae0), variants: 2, r: 0.5, gives: [['baya', 3]], focusY: 0.7, hitR: 0.9, respawn: 1, sink: 0.1, scale: [0.8, 1.2], solid: true, bush: true },
    cacao: { name: 'Árbol de cacao', build: cacaoTree, lod: (r) => bushLod(r, 0x2e6a26), fruit: cacaoPods, variants: 2, r: 0.4, gives: [['cacao', 2]], focusY: 1.1, hitR: 1.0, respawn: 2, sink: 0.1, scale: [0.9, 1.2], solid: true, bush: true },
    fiber: { name: 'Hierba alta', build: (r) => fiber(r), variants: 1, pick: [['fibra', 2]], focusY: 0.4, hitR: 0.7, respawn: 1, sink: 0.05, scale: [0.8, 1.3] },
    dryfiber: { name: 'Hierba seca', build: (r) => fiber(r, 0xb8a878), variants: 1, pick: [['fibra', 2]], focusY: 0.4, hitR: 0.7, respawn: 1, sink: 0.05, scale: [0.8, 1.2] },
    stick: { name: 'Palo', build: stick, variants: 1, pick: [['palo', 1]], focusY: 0.05, hitR: 0.6, respawn: 1, sink: -0.02, scale: [0.9, 1.2] },
    driftwood: { name: 'Madera a la deriva', build: driftwood, variants: 1, pick: [['madera', 2]], focusY: 0.15, hitR: 0.8, respawn: 2, sink: 0.02, scale: [0.9, 1.2] },
    stone: { name: 'Piedra', build: stone, variants: 1, pick: [['piedra', 1]], focusY: 0.1, hitR: 0.5, respawn: 1, sink: 0.02, scale: [0.8, 1.3], mat: 'rock' },
    flint: { name: 'Sílex', build: flint, variants: 1, pick: [['silex', 1]], focusY: 0.08, hitR: 0.5, respawn: 2, sink: -0.02, scale: [0.9, 1.2], mat: 'rock' },
    coconut: { name: 'Coco', build: coconut, variants: 1, pick: [['coco', 1]], focusY: 0.15, hitR: 0.5, respawn: 2, sink: -0.12, scale: [0.9, 1.1] },
    clam: { name: 'Almejas', build: clam, variants: 1, pick: [['almeja', 2]], focusY: 0.05, hitR: 0.45, respawn: 1, sink: 0.0, scale: [0.9, 1.2] },
    oyster: { name: 'Ostra perlera', build: oyster, variants: 1, pick: [['perla', 1], ['almeja', 1]], focusY: 0.1, hitR: 0.6, respawn: 3, sink: 0.0, scale: [0.9, 1.3] },
    herb: { name: 'Hierba medicinal', build: (r) => herb(r), variants: 1, pick: [['hierba', 2]], focusY: 0.2, hitR: 0.5, respawn: 2, sink: 0.0, scale: [0.9, 1.3] },
    lichen: { name: 'Liquen medicinal', build: (r) => herb(r, 0x7a9a8a, 0xd8e8f0), variants: 1, pick: [['hierba', 2]], focusY: 0.2, hitR: 0.5, respawn: 2, sink: 0.0, scale: [0.9, 1.3] },
    iron: { name: 'Veta de hierro', build: ironOre, variants: 2, r: 0.7, hp: 6, tool: 'pico', hit: [['mineral_hierro', 1]], fin: [['mineral_hierro', 2]], focusY: 0.3, hitR: 0.9, respawn: 3, sink: 0.15, scale: [0.9, 1.3], solid: true, mat: 'rock' },
    silver: { name: 'Veta de plata', build: silverOre, variants: 2, r: 0.7, hp: 7, tool: 'pico', hit: [['mineral_plata', 1]], fin: [['mineral_plata', 2]], focusY: 0.3, hitR: 0.9, respawn: 4, sink: 0.15, scale: [0.9, 1.3], solid: true, mat: 'rock' },
    sulfur: { name: 'Veta de azufre', build: sulfurOre, variants: 2, r: 0.7, hp: 5, tool: 'pico', hit: [['azufre', 1]], fin: [['azufre', 2]], focusY: 0.3, hitR: 0.9, respawn: 3, sink: 0.15, scale: [0.9, 1.3], solid: true, mat: 'rock' },
    coal: { name: 'Veta de carbón', build: coalOre, variants: 2, r: 0.7, hp: 5, tool: 'pico', hit: [['carbon', 1]], fin: [['carbon', 2]], focusY: 0.3, hitR: 0.9, respawn: 3, sink: 0.15, scale: [0.9, 1.3], solid: true, mat: 'rock' },
    obsidian: { name: 'Obsidiana', build: obsidian, variants: 1, r: 0.6, hp: 6, tool: 'pico', minPower: 2, hit: [['obsidiana', 1]], fin: [['obsidiana', 1]], focusY: 0.4, hitR: 0.9, respawn: 4, sink: 0.1, scale: [0.9, 1.2], solid: true, mat: 'rock' },
    ice: { name: 'Cristales de hielo', build: ice, variants: 2, r: 0.6, hp: 5, tool: 'pico', hit: [['cristal_hielo', 1]], fin: [['cristal_hielo', 2]], focusY: 0.4, hitR: 0.9, respawn: 3, sink: 0.1, scale: [0.9, 1.3], solid: true, mat: 'rock' },
  });

  // ------------------------------------------------------------------ rejilla espacial (colisiones / consultas)
  const ck = (cx, cz) => (cx + 1024) * 4096 + (cz + 1024);
  R.gridAdd = (r) => {
    const key = ck(Math.floor(r.x / R.CELL), Math.floor(r.z / R.CELL));
    let a = R.grid.get(key);
    if (!a) R.grid.set(key, (a = []));
    a.push(r);
  };
  R.query = (x, z, rad, cb) => {
    const c0 = Math.floor((x - rad) / R.CELL), c1 = Math.floor((x + rad) / R.CELL);
    const d0 = Math.floor((z - rad) / R.CELL), d1 = Math.floor((z + rad) / R.CELL);
    for (let cx = c0; cx <= c1; cx++) for (let cz = d0; cz <= d1; cz++) {
      const a = R.grid.get(ck(cx, cz));
      if (a) for (let i = 0; i < a.length; i++) cb(a[i]);
    }
  };

  // ------------------------------------------------------------------ generación
  function add(kind, x, z, rnd, isl = 0) {
    const k = KINDS[kind], s = U.lerp(k.scale[0], k.scale[1], rnd());
    const r = {
      id: R.list.length, kind, k, v: Math.floor(rnd() * k.variants), x, z, y: G.height(x, z) - k.sink * s, isl,
      rot: rnd() * Math.PI * 2, s, tilt: k.tree ? (rnd() - 0.5) * 0.08 : kind === 'rock' ? (rnd() - 0.5) * 0.3 : 0,
      hp: k.hp || 1, alive: true, respawnDay: 0, berries: true, mesh: null, bmesh: null, lmesh: null, idx: 0, lidx: 0,
    };
    R.list.push(r);
    R.gridAdd(r);
    return r;
  }
  function freeAt(x, z, d) {
    let f = true;
    R.query(x, z, d + 2, (r) => { if (f && r.k.solid && Math.hypot(r.x - x, r.z - z) < d + (r.k.r || 0) * r.s) f = false; });
    return f;
  }
  // Herramientas de reparto comunes a todas las islas
  function spreader(rnd, cx, cz, range, ok, isl) {
    const scatter = (kind, count, test, spacing, minH = 0.3) => {
      let n = 0, tries = 0;
      while (n < count && tries < count * 80) {
        tries++;
        const x = cx + (rnd() * 2 - 1) * range, z = cz + (rnd() * 2 - 1) * range;
        const h = G.height(x, z);
        if (h < minH || !ok(x, z)) continue;
        if (!test(x, z, h, G.World.slope(x, z))) continue;
        if (spacing && !freeAt(x, z, spacing)) continue;
        add(kind, x, z, rnd, isl); n++;
      }
    };
    const around = (kind, count, anchors, rmin, rmax, minH = 0.3, maxH = 99) => {
      let n = 0, tries = 0;
      while (n < count && tries < count * 40 && anchors.length) {
        tries++;
        const a = anchors[Math.floor(rnd() * anchors.length)];
        const ang = rnd() * Math.PI * 2, d = U.lerp(rmin, rmax, rnd());
        const x = a.x + Math.cos(ang) * d, z = a.z + Math.sin(ang) * d;
        const h = G.height(x, z);
        if (h < minH || h > maxH || !ok(x, z)) continue;
        add(kind, x, z, rnd, isl); n++;
      }
    };
    return { scatter, around };
  }

  R.generate = function (scene) {
    const rnd = U.rng(1337);
    const W = G.World, sp = W.spawn;
    const nF = U.makeNoise(55);
    const ok = (x, z) => Math.hypot(x - sp.x, z - sp.z) > 7 && Math.hypot(x - W.LAKE.x, z - W.LAKE.z) > W.LAKE.r * 0.85 && !W.blockedArea(x, z);
    const { scatter, around } = spreader(rnd, 0, 0, 230, ok, 0);
    scatter('palm', 130, (x, z, h, s) => h > 1.4 && h < 5.5 && s > 0.8, 3.2);
    scatter('oak', 200, (x, z, h, s) => h > 3.6 && h < 18 && s > 0.82 && nF(x * 0.02, z * 0.02) > -0.25, 3.6);
    scatter('pine', 120, (x, z, h, s) => h > 11 && h < 32 && s > 0.72, 3.4);
    scatter('rock', 110, (x, z, h) => h > 1.2 && (h > 9 || rnd() < 0.5), 4);
    scatter('bush', 85, (x, z, h, s) => h > 3 && h < 15 && s > 0.85, 2.5);
    scatter('fiber', 180, (x, z, h, s) => h > 2.4 && h < 20 && s > 0.8, 0.8);
    const trees = R.list.filter((r) => r.kind === 'oak' || r.kind === 'palm');
    around('stick', 190, trees, 1.5, 4.5);
    scatter('stone', 150, (x, z, h) => h > 0.6 && h < 25, 0);
    around('flint', 45, R.list.filter((r) => r.kind === 'rock'), 1.8, 3.5);
    scatter('flint', 20, (x, z, h) => h > 0.5 && h < 2.2, 0);
    around('coconut', 90, R.list.filter((r) => r.kind === 'palm'), 0.8, 2.2);
    scatter('clam', 70, (x, z, h) => h > 0.25 && h < 1.3, 0, 0.25);
    around('herb', 75, R.list.filter((r) => r.kind === 'oak'), 1.5, 4, 3.5);
    scatter('iron', 6, (x, z, h, s) => h > 14 && s > 0.7, 3);
    scatter('obsidian', 4, (x, z, h) => h > 24, 3);
    // Vetas dentro de la cueva (junto a la pared del fondo)
    const Cv = W.CAVE;
    for (let i = 0; i < 9; i++) {
      const a = Cv.ent + Math.PI + (i - 4) * 0.42 + (rnd() - 0.5) * 0.15, d = Cv.r * (0.55 + rnd() * 0.1);
      add(i % 3 === 2 ? 'obsidian' : 'iron', Cv.x + Math.sin(a) * d, Cv.z + Math.cos(a) * d, rnd);
    }
    // Kit inicial junto al punto de aparición
    for (const [kind, n] of [['stick', 5], ['stone', 5], ['fiber', 4], ['coconut', 2]]) {
      let placed = 0, tries = 0;
      while (placed < n && tries < 200) {
        tries++;
        const a = rnd() * Math.PI * 2, d = 3 + rnd() * 7;
        const x = sp.x + Math.cos(a) * d, z = sp.z + Math.sin(a) * d;
        if (G.height(x, z) < 0.6) continue;
        add(kind, x, z, rnd); placed++;
      }
    }
    const veg = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide });
    const rk = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true });
    R.matVeg = lodMaterial(veg, 'near'); R.matVegFar = lodMaterial(veg, 'far');
    R.matRock = lodMaterial(rk, 'near'); R.matRockFar = lodMaterial(rk, 'far');
    R.baseCount = R.list.length;
    buildMeshes(scene, 0, R.list.length, null);
  };

  // Recursos de una isla del archipiélago según su bioma
  R.addIsland = function (isl) {
    const rnd = U.rng(isl.seed * 13 + 7), F = isl.feat, W = G.World;
    const k = (isl.r / 200) ** 2, n = (v) => Math.max(1, Math.round(v * k));
    const avoid = [];
    if (F.village) avoid.push([F.village.wx, F.village.wz, F.village.r + 5]);
    if (F.temple) avoid.push([F.temple.wx, F.temple.wz, F.temple.r + 5]);
    if (F.cave) avoid.push([F.cave.wx, F.cave.wz, F.cave.r + 3]);
    if (F.ice) avoid.push([F.ice.wx, F.ice.wz, F.ice.r + 1]);
    if (F.plaza) avoid.push([F.plaza.wx, F.plaza.wz, F.plaza.r + 2]);
    if (F.crater) avoid.push([F.crater.wx, F.crater.wz, F.crater.rc * 1.7]);
    if (F.lava) for (const L of F.lava) avoid.push([L.wx, L.wz, L.r * 2]);
    if (isl.spawn) avoid.push([isl.spawn.x, isl.spawn.z, 6]);
    const ok = (x, z) => !W.lakeAt(x, z) && avoid.every(([ax, az, ar]) => Math.hypot(x - ax, z - az) > ar);
    const { scatter, around } = spreader(rnd, isl.x, isl.z, isl.r * 1.2, ok, isl.id);
    const of = (...kinds) => R.list.filter((r) => r.isl === isl.id && kinds.includes(r.kind));
    const inCave = (kind, count) => {
      const Cv = F.cave;
      for (let i = 0; i < count; i++) {
        const a = Cv.ent + Math.PI + (i - count / 2) * 0.42 + (rnd() - 0.5) * 0.15, d = Cv.r * (0.55 + rnd() * 0.1);
        add(typeof kind === 'function' ? kind(i) : kind, Cv.wx + Math.sin(a) * d, Cv.wz + Math.cos(a) * d, rnd, isl.id);
      }
    };
    switch (isl.type) {
      case 'tahuri':
        scatter('palm', n(130), (x, z, h, s) => h > 1.4 && h < 5.5 && s > 0.8, 3.2);
        scatter('ceiba', n(170), (x, z, h, s) => h > 3.6 && h < 19 && s > 0.8, 4.5);
        for (let i = 0; i < n(45); i++) scatter('bamboo', 1, (x, z, h, s) => h > 3 && h < 15 && s > 0.8, 3);
        around('bamboo', n(60), of('bamboo'), 3, 7, 3, 16);
        scatter('bush', n(50), (x, z, h, s) => h > 3 && h < 15 && s > 0.85, 2.5);
        around('cacao', n(55), of('ceiba'), 3, 7, 3, 16);
        scatter('fiber', n(200), (x, z, h, s) => h > 2.4 && h < 20 && s > 0.8, 0.8);
        around('stick', n(190), of('ceiba', 'palm'), 1.5, 5);
        scatter('rock', n(70), (x, z, h) => h > 1.2 && (h > 9 || rnd() < 0.5), 4);
        scatter('stone', n(130), (x, z, h) => h > 0.6 && h < 25, 0);
        around('flint', n(40), of('rock'), 1.8, 3.5);
        scatter('flint', n(20), (x, z, h) => h > 0.5 && h < 2.2, 0);
        around('coconut', n(90), of('palm'), 0.8, 2.2);
        scatter('clam', n(70), (x, z, h) => h > 0.25 && h < 1.3, 0, 0.25);
        around('herb', n(90), of('ceiba'), 2, 5, 3.5);
        scatter('iron', 6, (x, z, h, s) => h > 11 && s > 0.65, 3);
        break;
      case 'escarcha':
        scatter('snowpine', n(300), (x, z, h, s) => h > 2.5 && h < 26 && s > 0.72, 3.2);
        scatter('snowrock', n(130), (x, z, h) => h > 1.2 && (h > 8 || rnd() < 0.5), 4);
        scatter('snowbush', n(55), (x, z, h, s) => h > 2.5 && h < 14 && s > 0.85, 2.5);
        scatter('dryfiber', n(90), (x, z, h, s) => h > 1.4 && h < 9 && s > 0.8, 0.8);
        around('stick', n(170), of('snowpine'), 1.5, 4.5);
        scatter('stone', n(140), (x, z, h) => h > 0.6 && h < 28, 0);
        around('flint', n(45), of('snowrock'), 1.8, 3.5);
        scatter('clam', n(45), (x, z, h) => h > 0.25 && h < 1.3, 0, 0.25);
        scatter('lichen', n(60), (x, z, h, s) => h > 3 && h < 20 && s > 0.8, 0);
        scatter('ice', n(40), (x, z, h, s) => h > 12 && s > 0.6, 3);
        scatter('iron', 5, (x, z, h, s) => h > 12 && s > 0.65, 3);
        scatter('silver', 4, (x, z, h, s) => h > 16 && s > 0.6, 3);
        if (F.cave) inCave((i) => ['iron', 'silver', 'ice'][i % 3], 9);
        break;
      case 'brasa':
        scatter('deadtree', n(120), (x, z, h, s) => h > 2.5 && h < 22 && s > 0.75, 3.2);
        scatter('palm', n(45), (x, z, h, s) => h > 1.4 && h < 5 && s > 0.8, 3.2);
        scatter('basalt', n(170), (x, z, h) => h > 1.2, 4);
        scatter('fiber', n(60), (x, z, h, s) => h > 2 && h < 9 && s > 0.8, 0.8);
        around('stick', n(100), of('deadtree', 'palm'), 1.5, 4.5);
        scatter('stone', n(150), (x, z, h) => h > 0.6 && h < 30, 0);
        around('flint', n(50), of('basalt'), 1.8, 3.5);
        around('coconut', n(40), of('palm'), 0.8, 2.2);
        scatter('clam', n(45), (x, z, h) => h > 0.25 && h < 1.3, 0, 0.25);
        scatter('bush', n(20), (x, z, h, s) => h > 2.5 && h < 9 && s > 0.85, 2.5);
        scatter('herb', n(25), (x, z, h, s) => h > 2.5 && h < 12 && s > 0.8, 0);
        scatter('obsidian', 10, (x, z, h) => h > 14, 3);
        scatter('sulfur', 12, (x, z, h) => h > 10, 3);
        scatter('coal', 12, (x, z, h) => h > 5, 3);
        scatter('iron', 6, (x, z, h, s) => h > 10 && s > 0.6, 3);
        break;
      case 'ruinas':
        scatter('oak', n(150), (x, z, h, s) => h > 3.6 && h < 18 && s > 0.82, 3.6);
        scatter('palm', n(60), (x, z, h, s) => h > 1.4 && h < 5.5 && s > 0.8, 3.2);
        scatter('rock', n(110), (x, z, h) => h > 1.2, 4);
        scatter('bush', n(50), (x, z, h, s) => h > 3 && h < 15 && s > 0.85, 2.5);
        around('cacao', n(20), of('oak'), 3, 6, 3, 16);
        scatter('fiber', n(160), (x, z, h, s) => h > 2.4 && h < 20 && s > 0.8, 0.8);
        around('stick', n(150), of('oak', 'palm'), 1.5, 4.5);
        scatter('stone', n(120), (x, z, h) => h > 0.6, 0);
        around('flint', n(40), of('rock'), 1.8, 3.5);
        around('coconut', n(60), of('palm'), 0.8, 2.2);
        scatter('clam', n(30), (x, z, h) => h > 0.25 && h < 1.3, 0, 0.25);
        around('herb', n(60), of('oak'), 1.5, 4, 3.5);
        scatter('iron', 8, (x, z, h) => h > 6, 3);
        scatter('sulfur', 6, (x, z, h) => h > 6, 3);
        scatter('silver', 4, (x, z, h) => h > 6, 3);
        scatter('coal', 6, (x, z, h) => h > 4, 3);
        break;
      case 'islote':
        scatter('palm', 3 + Math.floor(rnd() * 3), (x, z, h) => h > 1.1 && h < 3, 3);
        around('coconut', 6, of('palm'), 0.8, 2.2, 0.6);
        scatter('clam', 8, (x, z, h) => h > 0.2 && h < 1.3, 0, 0.2);
        scatter('driftwood', 3, (x, z, h) => h > 0.5, 1.5);
        scatter('stick', 3, (x, z, h) => h > 0.6, 0);
        scatter('stone', 3, (x, z, h) => h > 0.6, 0);
        scatter('flint', 2, (x, z, h) => h > 0.4, 0);
        break;
      case 'arrecife':
        scatter('oyster', 30, (x, z, h) => h < -1.4 && h > -8, 1, -9);
        break;
    }
  };

  // Construye las mallas de todos los recursos añadidos desde la última limpieza
  R.finishExtra = function () {
    if (R.list.length > R.baseCount) buildMeshes(G.scene, R.baseCount, R.list.length, R.extraMeshes);
  };
  R.clearExtra = function () {
    for (const m of R.extraMeshes) { G.scene.remove(m); m.dispose(); }
    R.extraMeshes = [];
    R.chunks = R.chunks.filter((c) => !c.extra);
    R.list.length = R.baseCount;
    R.grid.clear();
    for (const r of R.list) R.gridAdd(r);
  };

  // Material que oculta cada instancia según su distancia a la cámara (cerca/lejos)
  function lodMaterial(base, mode) {
    const m = base.clone();
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uLodDist = R.lodDist;
      sh.vertexShader = 'uniform float uLodDist;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec4 lodP = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          if (distance(lodP.xz, cameraPosition.xz) ${mode === 'near' ? '>' : '<'} uLodDist) transformed *= 0.0;
        #endif`);
    };
    m.customProgramCacheKey = () => 'lod-' + mode;
    return m;
  }

  const geoCache = {}, fruitCache = {};
  const geoFor = (kind, v) => geoCache[kind + v] || (geoCache[kind + v] = KINDS[kind].build(U.rng(kind.length * 131 + v * 17 + kind.charCodeAt(0))));
  function buildMeshes(scene, from, to, track) {
    const extra = !!track;
    const chunkMap = new Map();
    const addMesh = (m) => { scene.add(m); if (track) track.push(m); };
    for (let i = from; i < to; i++) {
      const r = R.list[i];
      const cx = Math.floor(r.x / R.CHUNK), cz = Math.floor(r.z / R.CHUNK), key = cx + ',' + cz;
      let ch = chunkMap.get(key);
      if (!ch) chunkMap.set(key, (ch = { x: (cx + 0.5) * R.CHUNK, z: (cz + 0.5) * R.CHUNK, groups: {}, meshes: [], vis: true, extra }));
      (ch.groups[r.kind + '|' + r.v] = ch.groups[r.kind + '|' + r.v] || []).push(r);
    }
    for (const ch of chunkMap.values()) {
      for (const gk in ch.groups) {
        const arr = ch.groups[gk], r0 = arr[0], k = r0.k;
        const mesh = new THREE.InstancedMesh(geoFor(r0.kind, r0.v), k.mat === 'rock' ? R.matRock : R.matVeg, arr.length);
        mesh.castShadow = true; mesh.receiveShadow = true;
        arr.forEach((r, i) => { r.mesh = mesh; r.idx = i; });
        addMesh(mesh); ch.meshes.push(mesh);
        if (k.bush) {
          const fk = r0.kind + r0.v;
          const bg = fruitCache[fk] || (fruitCache[fk] = k.fruit(U.rng(r0.v * 13 + 5)));
          const bm = new THREE.InstancedMesh(bg, R.matVeg, arr.length);
          arr.forEach((r) => (r.bmesh = bm));
          addMesh(bm); ch.meshes.push(bm);
        }
      }
      delete ch.groups;
      R.chunks.push(ch);
    }
    // Versiones lejanas: una malla por tipo y por isla
    const lodGroups = {};
    for (let i = from; i < to; i++) { const r = R.list[i]; if (r.k.lod) (lodGroups[r.isl + '|' + r.kind] = lodGroups[r.isl + '|' + r.kind] || []).push(r); }
    for (const gk in lodGroups) {
      const arr = lodGroups[gk], k = arr[0].k;
      const lm = new THREE.InstancedMesh(k.lod(U.rng(9)), k.mat === 'rock' ? R.matRockFar : R.matVegFar, arr.length);
      lm.frustumCulled = !!extra;
      arr.forEach((r, i) => { r.lmesh = lm; r.lidx = i; });
      addMesh(lm);
    }
    for (let i = from; i < to; i++) R.setMatrix(R.list[i]);
    for (const ch of R.chunks) for (const m of ch.meshes) m.computeBoundingSphere();
    if (extra) for (const m of track) if (!m.boundingSphere) m.computeBoundingSphere();
  }

  // Muestra solo las zonas cercanas en detalle completo
  R.updateVisibility = function (cam) {
    const L = R.lodDist.value + R.CHUNK * 0.75;
    for (const ch of R.chunks) {
      const vis = Math.hypot(ch.x - cam.x, ch.z - cam.z) < L;
      if (vis !== ch.vis) { ch.vis = vis; for (const m of ch.meshes) m.visible = vis; }
    }
  };

  R.setMatrix = function (r, ex = 0, ez = 0) {
    _e.set(r.tilt + ex, r.rot, r.tilt * 0.6 + ez);
    _q.setFromEuler(_e);
    const sc = r.alive ? r.s : 0;
    _p.set(r.x, r.y, r.z);
    _m.compose(_p, _q, _s.set(sc, sc, sc));
    r.mesh.setMatrixAt(r.idx, _m);
    r.mesh.instanceMatrix.needsUpdate = true;
    if (r.lmesh) { r.lmesh.setMatrixAt(r.lidx, _m); r.lmesh.instanceMatrix.needsUpdate = true; }
    if (r.bmesh) {
      const bs = r.alive && r.berries ? r.s : 0;
      _m.compose(_p, _q, _s.set(bs, bs, bs));
      r.bmesh.setMatrixAt(r.idx, _m);
      r.bmesh.instanceMatrix.needsUpdate = true;
    }
  };

  // Día de la isla a la que pertenece el recurso (cada isla tiene su propio calendario)
  R.dayOf = (r) => (G.Clock ? G.Clock.dayOf(r.isl) : G.state.day);

  // ------------------------------------------------------------------ interacción
  R.shake = (r) => {
    if (!r.k.solid) return;
    const e = R.shaking.find((s) => s.r === r);
    if (e) e.t = 0.35; else R.shaking.push({ r, t: 0.35 });
  };

  R.hit = function (r, held) {
    const k = r.k;
    if (!k.tool) return false;
    const it = held ? G.ITEMS[held.id] : null;
    const power = it && it.toolType === k.tool ? it.power || 1 : 0;
    const has = power >= (k.minPower || 1);
    R.shake(r);
    G.Audio.play(k.tree ? 'chop' : 'stone');
    if (!has) {
      const msg = power > 0 ? 'Necesitas un pico de hierro para extraer obsidiana.' : k.tool === 'hacha' ? 'Necesitas un hacha para talar esto.' : 'Necesitas un pico para romper la roca.';
      G.UI.msg(msg, 'warn', 'need' + k.tool + power);
      if (k.tree && Math.random() < 0.3) G.Game.give('palo', 1);
      if (!k.tree && Math.random() < 0.2) G.Game.give('piedra', 1);
      G.Net.resChanged(r, k.tree ? 'chop' : 'stone');
      return true;
    }
    r.hp -= power;
    G.Inv.wear(1);
    for (const [id, n] of k.hit) G.Game.give(id, n * power);
    if (k.flint && Math.random() < k.flint) G.Game.give('silex', 1);
    if (k.bonus && Math.random() < k.bonus[1]) G.Game.give(k.bonus[0], 1);
    let fx = k.tree ? 'chop' : 'stone';
    if (r.hp <= 0) {
      r.alive = false;
      r.respawnDay = R.dayOf(r) + k.respawn;
      for (const [id, n] of k.fin) G.Game.give(id, n);
      if (k.tree) { fell(r, G.Player.pos.x, G.Player.pos.z); fx = 'fell'; } else { G.Audio.play('rockbreak'); fx = 'rockbreak'; }
      R.setMatrix(r);
    }
    G.Net.resChanged(r, fx);
    return true;
  };

  R.interact = function (r) {
    const k = r.k;
    if (k.bush) {
      if (!r.berries) return;
      for (const [id, n] of k.gives) G.Game.give(id, n);
      r.berries = false;
      r.respawnDay = R.dayOf(r) + k.respawn;
    } else if (k.pick) {
      for (const [id, n] of k.pick) G.Game.give(id, n);
      r.alive = false;
      r.respawnDay = R.dayOf(r) + k.respawn;
    } else return;
    R.setMatrix(r);
    G.Audio.play('pickup');
    G.Net.resChanged(r, 'pick');
  };

  // Cambio recibido por red desde otro jugador
  R.applyNet = function (m) {
    const r = R.list[m.id];
    if (!r) return;
    const wasAlive = r.alive;
    r.alive = !!m.a; r.hp = m.hp; r.berries = !!m.b; r.respawnDay = m.rd;
    R.setMatrix(r);
    if (m.fx === 'fell' && wasAlive && !r.alive) fell(r, m.px, m.pz, true);
    else if (m.fx === 'chop' || m.fx === 'stone') { R.shake(r); G.Audio.playAt(m.fx, r.x, r.z); }
    else if (m.fx === 'rockbreak') G.Audio.playAt('rockbreak', r.x, r.z);
  };

  function fell(r, fromX, fromZ, remote) {
    const pivot = new THREE.Group();
    pivot.position.set(r.x, r.y, r.z);
    const m = new THREE.Mesh(r.mesh.geometry, r.mesh.material);
    m.rotation.set(r.tilt, r.rot, r.tilt * 0.6);
    m.scale.setScalar(r.s);
    m.castShadow = true;
    pivot.add(m);
    let dx = r.x - (fromX ?? r.x + 1), dz = r.z - (fromZ ?? r.z);
    const d = Math.hypot(dx, dz) || 1;
    dx /= d; dz /= d;
    G.scene.add(pivot);
    R.falling.push({ pivot, axis: new V3(dz, 0, -dx), t: 0 });
    if (remote) G.Audio.playAt('treefall', r.x, r.z, 60); else G.Audio.play('treefall');
  }

  // Reaparición de recursos de una isla (solo lo decide el anfitrión o la partida individual)
  R.newDay = function (isl, day, players) {
    const changed = [];
    for (const r of R.list) {
      if (r.isl !== isl) continue;
      const dead = !r.alive || (r.k.bush && !r.berries);
      if (!dead || day < r.respawnDay) continue;
      if (players.some((p) => Math.hypot(r.x - p.x, r.z - p.z) < 8)) continue;
      if (r.k.solid && G.Build.occupied(r.x, r.z, (r.k.r || 0.5) * r.s * 0.8)) continue; // hay una casa encima
      r.alive = true; r.berries = true; r.hp = r.k.hp || 1;
      R.setMatrix(r);
      changed.push(r);
    }
    return changed;
  };

  R.update = function (dt) {
    for (let i = R.shaking.length - 1; i >= 0; i--) {
      const s = R.shaking[i];
      s.t -= dt;
      if (s.t <= 0) { R.setMatrix(s.r); R.shaking.splice(i, 1); continue; }
      const a = Math.sin(s.t * 60) * 0.035 * (s.t / 0.35);
      R.setMatrix(s.r, a, a * 0.5);
    }
    for (let i = R.falling.length - 1; i >= 0; i--) {
      const f = R.falling[i];
      f.t += dt;
      const a = Math.min(1, (f.t / 1.4) ** 2) * (Math.PI / 2 - 0.08);
      f.pivot.quaternion.setFromAxisAngle(f.axis, a);
      if (f.t > 2.8) f.pivot.position.y -= dt * 1.2;
      if (f.t > 5) { G.scene.remove(f.pivot); R.falling.splice(i, 1); }
    }
  };

  R.reset = function () {
    for (const r of R.list) { r.alive = true; r.berries = true; r.hp = r.k.hp || 1; r.respawnDay = 0; R.setMatrix(r); }
  };
  R.getState = () => R.list.map((r) => [r.alive ? 1 : 0, r.hp, r.respawnDay, r.berries ? 1 : 0]);
  R.setState = (arr) => {
    if (!arr) return;
    // Partidas antiguas solo guardaban la Isla Perdida: se aplica lo que coincida
    const n = arr.length === R.list.length || arr.length === R.baseCount ? arr.length : 0;
    for (let i = 0; i < n; i++) { const r = R.list[i], a = arr[i]; r.alive = !!a[0]; r.hp = a[1]; r.respawnDay = a[2]; r.berries = !!a[3]; R.setMatrix(r); }
  };
})();
