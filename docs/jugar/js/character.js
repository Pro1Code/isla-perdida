// Personaje humano con esqueleto (SkinnedMesh, 17 huesos, ~8.000 vértices) y animación procedural:
// caminar, correr, reposo con respiración, salto, nado y golpe, con transiciones suaves entre estados.
(function () {
  'use strict';
  const G = window.G, U = G.U;
  const Char = (G.Character = {});
  const Col = THREE.Color;

  // ------------------------------------------------------------------ esqueleto (posiciones de reposo, mirando a +Z)
  const BONES = [
    ['hips', -1, [0, 0.95, 0]], ['spine', 0, [0, 1.07, 0]], ['chest', 1, [0, 1.27, 0]], ['neck', 2, [0, 1.5, 0]], ['head', 3, [0, 1.61, 0]],
    ['uaL', 2, [0.2, 1.45, 0]], ['faL', 5, [0.2, 1.17, 0]], ['hL', 6, [0.2, 0.925, 0]],
    ['uaR', 2, [-0.2, 1.45, 0]], ['faR', 8, [-0.2, 1.17, 0]], ['hR', 9, [-0.2, 0.925, 0]],
    ['thL', 0, [0.095, 0.93, 0]], ['shL', 11, [0.095, 0.51, 0]], ['ftL', 12, [0.095, 0.085, 0]],
    ['thR', 0, [-0.095, 0.93, 0]], ['shR', 14, [-0.095, 0.51, 0]], ['ftR', 15, [-0.095, 0.085, 0]],
  ];
  const B = {};
  BONES.forEach(([n], i) => (B[n] = i));

  // ------------------------------------------------------------------ constructor de malla con pesos de piel
  class Builder {
    constructor() { this.pos = []; this.col = []; this.si = []; this.sw = []; this.idx = []; }
    get count() { return this.pos.length / 3; }
    vert(x, y, z, c, w) {
      this.pos.push(x, y, z);
      this.col.push(c.r, c.g, c.b);
      const a = w[0], b = w[1] || [0, 0], s = a[1] + b[1] || 1;
      this.si.push(a[0], b[0], 0, 0);
      this.sw.push(a[1] / s, b[1] / s, 0, 0);
    }
    // Tubo vertical de arriba (y0) a abajo (y1) con sección elíptica/superelíptica variable y extremos cerrados
    tube({ x = 0, z = 0, y0, y1, R, N, prof, color, weight, exp = 2 }) {
      const start = this.count, e = 2 / exp;
      for (let i = 0; i <= R; i++) {
        const t = i / R, y = y0 + (y1 - y0) * t, p = prof(t, y);
        for (let j = 0; j < N; j++) {
          const a = (j / N) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
          const lx = Math.sign(ca) * Math.pow(Math.abs(ca), e) * p.rx + (p.dx || 0);
          const lz = Math.sign(sa) * Math.pow(Math.abs(sa), e) * p.rz + (p.dz || 0);
          this.vert(x + lx, y, z + lz, color(t, y, lx, lz), weight(t, y, x + lx, z + lz));
        }
      }
      for (let i = 0; i < R; i++) for (let j = 0; j < N; j++) {
        const a = start + i * N + j, b = start + i * N + ((j + 1) % N), c = a + N, d = b + N;
        this.idx.push(a, b, c, b, d, c);
      }
      const p0 = prof(0, y0), p1 = prof(1, y1);
      const top = this.count;
      this.vert(x + (p0.dx || 0), y0, z + (p0.dz || 0), color(0, y0, 0, 0), weight(0, y0, x, z));
      const bot = this.count;
      this.vert(x + (p1.dx || 0), y1, z + (p1.dz || 0), color(1, y1, 0, 0), weight(1, y1, x, z));
      for (let j = 0; j < N; j++) {
        this.idx.push(top, start + ((j + 1) % N), start + j);
        const o = start + R * N;
        this.idx.push(bot, o + j, o + ((j + 1) % N));
      }
    }
    // Añade una geometría de three.js ya colocada, asociada a un solo hueso
    geo(g, color, bone, deform) {
      const start = this.count, p = g.attributes.position, v = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        if (deform) deform(v);
        this.vert(v.x, v.y, v.z, typeof color === 'function' ? color(v) : color, [[bone, 1]]);
      }
      if (g.index) for (let i = 0; i < g.index.count; i++) this.idx.push(start + g.index.getX(i));
      else for (let i = 0; i < p.count; i++) this.idx.push(start + i);
      g.dispose();
    }
    build(skinned) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
      if (skinned) {
        g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4));
        g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4));
      }
      g.setIndex(this.idx);
      g.computeVertexNormals();
      return g;
    }
  }

  // ------------------------------------------------------------------ utilidades de forma
  const sm = U.smooth;
  const bump = (t, c, w) => Math.exp(-(((t - c) / w) ** 2));
  // Redondea los extremos de un tubo (0 → radio completo)
  const ends = (t, a = 0.12, b = 0.12) => {
    let k = 1;
    if (t < a) k *= Math.sqrt(Math.max(0, 1 - ((a - t) / a) ** 2));
    if (t > 1 - b) k *= Math.sqrt(Math.max(0, 1 - ((t - (1 - b)) / b) ** 2));
    return Math.max(k, 0.12);
  };
  // Interpolación suave de una tabla [[y, valor], ...]
  function table(tab, y) {
    if (y >= tab[0][0]) return tab[0][1];
    for (let i = 1; i < tab.length; i++) {
      if (y >= tab[i][0]) {
        const [y0, v0] = tab[i - 1], [y1, v1] = tab[i];
        const t = (y - y0) / (y1 - y0), s = t * t * (3 - 2 * t);
        return v0 + (v1 - v0) * s;
      }
    }
    return tab[tab.length - 1][1];
  }
  const blend = (b1, b2, w) => (w <= 0.001 ? [[b1, 1]] : w >= 0.999 ? [[b2, 1]] : [[b1, 1 - w], [b2, w]]);

  // ------------------------------------------------------------------ paleta
  function palette(shirt, o = {}) {
    const skin = o.skin ?? 0xc68d67, pants = o.pants ?? 0x3b5270;
    return {
      skin: new Col(skin), skinDark: new Col(skin).multiplyScalar(0.85), shirt: new Col(shirt), shirtDark: new Col(shirt).multiplyScalar(0.72),
      pants: new Col(pants), pantsDark: new Col(pants).multiplyScalar(0.75), belt: new Col(0x3b2a1a), buckle: new Col(0xb8963c),
      boot: new Col(0x3a2a1c), bootSole: new Col(0x1e1610), hair: new Col(0x2a1b12), stubble: new Col(0x4a3526),
      lips: new Col(0x9a5548), eyeW: new Col(0xf2efe8), iris: new Col(0x3b2c20), brow: new Col(0x24170f),
    };
  }

  // ------------------------------------------------------------------ geometría del cuerpo
  const geoCache = new Map();
  function bodyGeometry(shirt, o = {}) {
    const key = shirt + ':' + (o.skin ?? '') + ':' + (o.pants ?? '');
    if (geoCache.has(key)) return geoCache.get(key);
    const C = palette(shirt, o), b = new Builder(), tmp = new Col();

    // Torso (caderas → hombros) con sección superelíptica
    const RX = [[1.58, 0.05], [1.555, 0.1], [1.52, 0.165], [1.48, 0.198], [1.42, 0.196], [1.36, 0.184], [1.26, 0.168], [1.13, 0.148], [1.02, 0.16], [0.94, 0.168], [0.88, 0.14], [0.84, 0.07]];
    const RZ = [[1.58, 0.048], [1.555, 0.075], [1.52, 0.098], [1.48, 0.112], [1.42, 0.12], [1.36, 0.128], [1.26, 0.124], [1.13, 0.106], [1.02, 0.112], [0.94, 0.115], [0.88, 0.1], [0.84, 0.06]];
    const DZ = [[1.58, -0.012], [1.44, 0.0], [1.3, 0.018], [1.13, 0.008], [0.98, -0.012], [0.84, 0]];
    b.tube({
      y0: 1.58, y1: 0.84, R: 32, N: 32, exp: 2.5,
      prof: (t, y) => ({ rx: table(RX, y), rz: table(RZ, y), dz: table(DZ, y) }),
      color: (t, y, x, z) => {
        if (y > 1.555) return C.skin;
        if (y > 1.525) return C.shirtDark; // cuello de la camisa
        if (y < 0.985) return C.pants;
        if (y < 1.03) return Math.abs(x) < 0.025 && z > 0.05 ? C.buckle : C.belt;
        if (y < 1.07) return tmp.copy(C.shirt).lerp(C.shirtDark, 0.35); // faldón
        return C.shirt;
      },
      weight: (t, y, x) => {
        let w;
        if (y < 0.98) w = [[B.hips, 1]];
        else if (y < 1.12) w = blend(B.hips, B.spine, sm(0.98, 1.12, y));
        else if (y < 1.3) w = blend(B.spine, B.chest, sm(1.12, 1.3, y));
        else if (y < 1.47) w = [[B.chest, 1]];
        else w = blend(B.chest, B.neck, sm(1.49, 1.58, y) * 0.8);
        const ax = Math.abs(x);
        if (y > 1.34 && ax > 0.13) { // los hombros acompañan al brazo
          const aw = sm(0.13, 0.2, ax) * sm(1.34, 1.47, y) * 0.55;
          w = [[w[0][0], 1 - aw], [x > 0 ? B.uaL : B.uaR, aw]];
        }
        return w;
      },
    });

    // Cuello
    b.tube({
      y0: 1.66, y1: 1.5, R: 6, N: 18,
      prof: (t) => ({ rx: 0.052 + t * 0.01, rz: 0.05 + t * 0.008, dz: 0.004 }),
      color: () => C.skin,
      weight: (t, y) => blend(B.neck, B.head, sm(1.6, 1.67, y) * 0.9),
    });

    // Cabeza deformada (mandíbula, pómulos, nuca) con barba incipiente y labios
    b.geo(new THREE.SphereGeometry(1, 40, 30), (v) => v.userData, B.head, (v) => {
      const ux = v.x, uy = v.y, uz = v.z;
      let X = ux * 0.092, Y = uy * 0.118, Z = uz * 0.106;
      if (uy < -0.05) { const k = (-uy - 0.05) / 0.95; X *= 1 - 0.2 * k * k - 0.08 * k; Z *= 1 - 0.06 * k; if (uz > 0) Z += 0.01 * k * uz; }
      if (uz < 0 && uy > -0.2) Z *= 1.07;
      X *= 1 + 0.05 * bump(uy, 0.02, 0.25) * Math.max(0, uz);
      if (uz > 0.55 && Math.abs(ux) > 0.18 && Math.abs(ux) < 0.55 && uy > 0.08 && uy < 0.34) Z -= 0.005;
      let c = C.skin;
      if (uy < -0.28 && uz > -0.1) c = tmp.copy(C.skin).lerp(C.stubble, 0.45 * sm(-0.28, -0.5, uy));
      if (Math.abs(ux) < 0.24 && uy < -0.36 && uy > -0.47 && uz > 0.8) c = C.lips;
      v.userData = c.clone();
      v.set(X, Y + 1.725, Z + 0.012);
    });
    // Nariz, orejas, ojos, cejas
    const S = (r, w = 10, h = 8) => new THREE.SphereGeometry(r, w, h);
    const place = (g, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) => {
      g.scale(sx, sy, sz); g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); g.translate(x, y, z); return g;
    };
    b.geo(place(S(0.012), 0, 1.713, 0.111, 0.8, 1.7, 1.2, -0.3), C.skinDark, B.head);
    b.geo(place(S(0.014), 0, 1.697, 0.112, 1.25, 0.6, 0.8), C.skin, B.head);
    for (const s of [-1, 1]) {
      b.geo(place(S(0.02, 10, 8), s * 0.094, 1.722, 0.0, 0.55, 1.5, 1.0, 0, s * 0.3), C.skinDark, B.head);
      b.geo(place(S(0.0155), s * 0.034, 1.738, 0.094, 1.1, 0.8, 1), C.eyeW, B.head);
      b.geo(place(S(0.0085, 8, 6), s * 0.034, 1.738, 0.108), C.iris, B.head);
      b.geo(place(new THREE.CapsuleGeometry(0.0045, 0.03, 3, 6), s * 0.035, 1.76, 0.104, 1, 1, 1, 0, 0, Math.PI / 2 + s * 0.12), C.brow, B.head);
    }
    // Pelo (casquete desordenado que cubre más la nuca)
    const nh = U.makeNoise(31);
    const hair = new THREE.SphereGeometry(1, 36, 18, 0, Math.PI * 2, 0, Math.PI * 0.55);
    hair.rotateX(-0.62);
    b.geo(hair, (v) => tmp.copy(C.hair).multiplyScalar(0.85 + 0.3 * (nh(v.x * 40, v.z * 40) * 0.5 + 0.5)).clone(), B.head, (v) => {
      const k = 1 + 0.07 * (nh(v.x * 4 + 2, v.y * 4 + v.z * 3) * 0.5 + 0.5);
      v.set(v.x * 0.1 * k, v.y * 0.124 * k + 1.73, v.z * 0.114 * k + 0.002);
    });

    // Brazos y manos
    for (const s of [1, -1]) {
      const x = s * 0.2, ua = s > 0 ? B.uaL : B.uaR, fa = s > 0 ? B.faL : B.faR, hd = s > 0 ? B.hL : B.hR;
      b.tube({
        x, y0: 1.49, y1: 1.13, R: 16, N: 18,
        prof: (t) => {
          const r = (U.lerp(0.056, 0.043, t) + 0.006 * bump(t, 0.2, 0.15) + 0.006 * bump(t, 0.52, 0.2)) * ends(t, 0.2, 0.1);
          return { rx: r * 0.95, rz: r, dx: -s * 0.006 * bump(t, 0.15, 0.15) };
        },
        color: (t, y) => (y > 1.29 ? C.shirt : y > 1.26 ? C.shirtDark : C.skin),
        weight: (t, y) => (y > 1.42 ? blend(ua, B.chest, sm(1.42, 1.49, y) * 0.5) : y < 1.22 ? blend(ua, fa, sm(1.22, 1.13, y) * 0.5) : [[ua, 1]]),
      });
      b.tube({
        x, y0: 1.21, y1: 0.895, R: 13, N: 18,
        prof: (t) => {
          const r = (U.lerp(0.045, 0.029, t) + 0.007 * bump(t, 0.22, 0.2)) * ends(t, 0.1, 0.1);
          return { rx: r * 0.85, rz: r * 1.05 };
        },
        color: () => C.skin,
        weight: (t, y) => (y > 1.12 ? blend(fa, ua, sm(1.12, 1.21, y) * 0.5) : y < 0.95 ? blend(fa, hd, sm(0.95, 0.895, y) * 0.5) : [[fa, 1]]),
      });
      // Mano: palma, dedos y pulgar
      b.geo(place(S(1, 16, 12), x, 0.868, 0.004, 0.021, 0.048, 0.04), C.skin, hd);
      for (let k = 0; k < 4; k++) {
        const len = [0.036, 0.042, 0.04, 0.032][k];
        b.geo(place(new THREE.CapsuleGeometry(0.0085, len, 3, 8), x - s * 0.002, 0.815 - len * 0.3, -0.026 + k * 0.0175, 1, 1, 1, 0.08 * (k - 1.5), 0, s * 0.12), C.skin, hd);
      }
      b.geo(place(new THREE.CapsuleGeometry(0.0095, 0.03, 3, 8), x + s * 0.004, 0.86, 0.04, 1, 1, 1, -0.6, 0, s * 0.25), C.skin, hd);
    }

    // Piernas y botas
    for (const s of [1, -1]) {
      const x = s * 0.095, th = s > 0 ? B.thL : B.thR, sh = s > 0 ? B.shL : B.shR, ft = s > 0 ? B.ftL : B.ftR;
      b.tube({
        x, y0: 0.99, y1: 0.47, R: 18, N: 20,
        prof: (t) => {
          const r = (U.lerp(0.09, 0.057, t) + 0.006 * bump(t, 0.35, 0.25)) * ends(t, 0.08, 0.1);
          return { rx: r * 0.94, rz: r * 1.03, dz: -0.006 * bump(t, 0.4, 0.3), dx: s * 0.004 * t };
        },
        color: () => C.pants,
        weight: (t, y) => (y > 0.86 ? blend(th, B.hips, sm(0.86, 0.99, y) * 0.6) : y < 0.56 ? blend(th, sh, sm(0.56, 0.47, y) * 0.5) : [[th, 1]]),
      });
      b.tube({
        x, y0: 0.55, y1: 0.03, R: 22, N: 20,
        prof: (t, y) => {
          const calf = 0.017 * bump(t, 0.3, 0.17);
          let r = U.lerp(0.054, 0.035, t);
          if (y < 0.16) r = Math.max(r, 0.047 - (0.16 - y) * 0.05); // caña de la bota
          if (y > 0.4) r = Math.max(r, 0.058); // pantalón remangado
          r *= ends(t, 0.08, 0.06);
          return { rx: r * 0.92, rz: (r + calf) * 1.0, dz: -calf * 0.7 };
        },
        color: (t, y) => (y > 0.43 ? C.pants : y > 0.4 ? C.pantsDark : y > 0.16 ? C.skin : C.boot),
        weight: (t, y) => (y > 0.46 ? blend(sh, th, sm(0.46, 0.55, y) * 0.5) : y < 0.12 ? blend(sh, ft, sm(0.12, 0.05, y) * 0.5) : [[sh, 1]]),
      });
      // Pie de la bota con suela
      b.geo(place(S(1, 22, 14), x, 0.05, 0.045, 0.05, 0.05, 0.125), (v) => (v.y < 0.02 ? C.bootSole : C.boot), ft, (v) => { if (v.y < 0.006) v.y = 0.006; });
    }
    const geo = b.build(true);
    geoCache.set(key, geo);
    return geo;
  }

  // ------------------------------------------------------------------ creación
  // opts = { skin, pants } (colores opcionales, p. ej. para los aldeanos)
  Char.create = function (shirt = 0xe6dfcc, opts) {
    const geo = bodyGeometry(new Col(shirt).getHex(), opts);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0 });
    const mesh = new THREE.SkinnedMesh(geo, mat);
    const bones = BONES.map(([name]) => { const bo = new THREE.Bone(); bo.name = name; return bo; });
    BONES.forEach(([, parent, p], i) => {
      const pp = parent >= 0 ? BONES[parent][2] : [0, 0, 0];
      bones[i].position.set(p[0] - pp[0], p[1] - pp[1], p[2] - pp[2]);
      if (parent >= 0) bones[parent].add(bones[i]);
    });
    mesh.add(bones[0]);
    mesh.updateMatrixWorld(true);
    mesh.bind(new THREE.Skeleton(bones));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    const root = new THREE.Group();
    root.add(mesh);
    const hand = new THREE.Group();
    hand.position.set(0, -0.06, 0.005);
    bones[B.hR].add(hand);
    const o = {
      root, mesh, bones, hand, mat,
      phase: 0, t: Math.random() * 10, walkW: 0, runW: 0, airW: 0, swimW: 0,
      rot: bones.map(() => new THREE.Vector3()), tgt: bones.map(() => new THREE.Vector3()),
    };
    o.update = (dt, s) => animate(o, dt, s);
    o.dispose = () => { mat.dispose(); };
    return o;
  };

  // ------------------------------------------------------------------ animación procedural
  // s = { pos, yaw, pitch, speed, onGround, swimming, swing (1→0), holding }
  function animate(o, dt, s) {
    dt = Math.min(dt, 0.1);
    o.t += dt;
    const sp = s.speed || 0;
    const k = (r) => 1 - Math.exp(-dt * r);
    o.walkW += (U.clamp(sp / 2.2, 0, 1) - o.walkW) * k(8);
    o.runW += (U.clamp((sp - 4.8) / 2.0, 0, 1) - o.runW) * k(6);
    o.airW += ((s.onGround === false && !s.swimming ? 1 : 0) - o.airW) * k(9);
    o.swimW += ((s.swimming ? 1 : 0) - o.swimW) * k(5);
    const freq = sp > 0.15 ? 0.95 + sp * 0.2 : 0;
    o.phase += dt * freq * Math.PI * 2;

    const T = o.tgt;
    for (const v of T) v.set(0, 0, 0);
    const ph = o.phase, sn = Math.sin(ph), cs = Math.cos(ph);
    const land = (1 - o.swimW) * (1 - o.airW * 0.7);
    const W = o.walkW * land, Rn = o.runW * land;
    const legA = 0.42 + 0.33 * Rn, armA = 0.32 + 0.4 * Rn;

    // Reposo: respiración y cambio de peso
    const br = Math.sin(o.t * 1.7), idle = 1 - o.walkW;
    T[B.chest].x += br * 0.014;
    T[B.head].x += br * 0.008;
    T[B.uaL].z += 0.045 + br * 0.01; T[B.uaR].z -= 0.045 + br * 0.01;
    T[B.faL].x -= 0.14; T[B.faR].x -= 0.14;
    const shift = Math.sin(o.t * 0.45) * idle;
    T[B.hips].z += shift * 0.025; T[B.spine].z -= shift * 0.02; T[B.neck].z -= shift * 0.01;
    T[B.head].y += Math.sin(o.t * 0.31) * 0.12 * idle;

    // Caminar / correr
    for (const [sd, off] of [[1, 0], [-1, Math.PI]]) {
      const sL = Math.sin(ph + off), cL = Math.cos(ph + off);
      const th = sd > 0 ? B.thL : B.thR, sh = sd > 0 ? B.shL : B.shR, ft = sd > 0 ? B.ftL : B.ftR;
      const ua = sd > 0 ? B.uaL : B.uaR, fa = sd > 0 ? B.faL : B.faR;
      const thigh = -sL * legA;
      const knee = 0.06 + (0.55 + 0.7 * Rn) * Math.pow(Math.max(0, cL), 1.4) + 0.15 * Rn * Math.max(0, -cL);
      T[th].x += thigh * W;
      T[th].z += sd * 0.03 * W;
      T[sh].x += knee * W;
      T[ft].x += (-(thigh + knee) * 0.75 + Math.max(0, -sL) * 0.2 * Math.max(0, -cL)) * W;
      T[ua].x += sL * armA * W;
      T[fa].x -= ((0.2 + 1.05 * Rn) + Math.max(0, -sL) * 0.3) * W;
      T[ua].z += sd * 0.04 * Rn;
    }
    T[B.hips].y -= sn * 0.1 * W;
    T[B.chest].y += sn * 0.13 * W;
    T[B.hips].z += cs * 0.035 * W;
    T[B.spine].x += 0.04 * W + 0.2 * Rn;
    T[B.neck].x -= 0.02 * W + 0.1 * Rn;
    T[B.head].x -= 0.02 * W + 0.08 * Rn;
    let hipY = -Math.abs(sn) * (0.028 * W) - 0.03 * Rn + 0.035 * Rn * Math.abs(cs);
    let hipX = cs * 0.018 * W * (1 - Rn * 0.6);

    // Salto / caída
    const air = o.airW * (1 - o.swimW);
    T[B.thL].x -= 0.55 * air; T[B.thR].x -= 0.25 * air;
    T[B.shL].x += 0.9 * air; T[B.shR].x += 0.5 * air;
    T[B.uaL].x -= 0.5 * air; T[B.uaR].x -= 0.3 * air;
    T[B.uaL].z += 0.35 * air; T[B.uaR].z -= 0.35 * air;
    T[B.faL].x -= 0.5 * air; T[B.faR].x -= 0.5 * air;

    // Nado (braza + patada)
    const sw = o.swimW;
    if (sw > 0.01) {
      const a = o.t * 3.2, kick = o.t * 7;
      for (const sd of [1, -1]) {
        const th = sd > 0 ? B.thL : B.thR, sh = sd > 0 ? B.shL : B.shR, ua = sd > 0 ? B.uaL : B.uaR, fa = sd > 0 ? B.faL : B.faR;
        T[th].x += Math.sin(kick + (sd > 0 ? 0 : Math.PI)) * 0.3 * sw;
        T[sh].x += (0.2 + Math.max(0, Math.sin(kick + (sd > 0 ? 0.6 : 0.6 + Math.PI))) * 0.3) * sw;
        T[ua].x += (-2.3 + 0.7 * Math.sin(a)) * sw;
        T[ua].z += sd * (0.5 + 0.6 * Math.sin(a + 1.2)) * sw;
        T[fa].x += (-0.3 - 0.6 * Math.max(0, Math.cos(a))) * sw;
      }
      T[B.head].x -= 0.9 * sw;
      T[B.neck].x -= 0.3 * sw;
    }

    // Mirar arriba/abajo
    const pitch = s.pitch || 0;
    T[B.neck].x -= pitch * 0.35 * (1 - sw);
    T[B.head].x -= pitch * 0.35 * (1 - sw);
    if (s.holding) T[B.faR].x -= 0.3;

    // Golpe con el brazo derecho (anticipación → impacto → recuperación)
    let swingActive = false;
    if (s.swing > 0) {
      swingActive = true;
      const p = 1 - s.swing;
      let a, e, tw;
      if (p < 0.38) { const q = sm(0, 1, p / 0.38); a = -2.6 * q; e = -1.35 * q; tw = 0.3 * q; }
      else { const q = 1 - Math.pow(1 - (p - 0.38) / 0.62, 3); a = -2.6 + 2.35 * q; e = -1.35 + 1.15 * q; tw = 0.3 - 0.55 * q; }
      T[B.uaR].x = a; T[B.uaR].z = -0.28; T[B.faR].x = e;
      T[B.chest].y += tw; T[B.spine].x += 0.12 * Math.sin(p * Math.PI);
    }

    // Aplicar con suavizado (el golpe es más rápido para que se sienta con impacto)
    const kp = k(14), ks = k(45);
    for (let i = 0; i < T.length; i++) {
      const f = swingActive && (i === B.uaR || i === B.faR) ? ks : kp;
      const r = o.rot[i];
      r.x += (T[i].x - r.x) * f; r.y += (T[i].y - r.y) * f; r.z += (T[i].z - r.z) * f;
      o.bones[i].rotation.set(r.x, r.y, r.z);
    }
    o.hipY = U.lerp(o.hipY || 0, hipY, k(12));
    o.hipX = U.lerp(o.hipX || 0, hipX, k(12));
    o.bones[B.hips].position.set(o.hipX, 0.95 + o.hipY, 0);

    o.root.position.copy(s.pos);
    o.root.position.y += sw * 0.35;
    o.root.rotation.set(sw * 1.25, (s.yaw || 0) + Math.PI, 0, 'YXZ');
  }

  // ------------------------------------------------------------------ brazo en primera persona (sin esqueleto)
  Char.fpArm = function (shirt = 0xe6dfcc, opts) {
    const C = palette(new Col(shirt).getHex(), opts), b = new Builder(), none = () => [[0, 1]];
    b.tube({
      y0: 0.44, y1: 0.03, R: 14, N: 18,
      prof: (t) => { const r = (U.lerp(0.047, 0.029, t) + 0.007 * bump(t, 0.3, 0.2)) * ends(t, 0.05, 0.1); return { rx: r * 0.85, rz: r * 1.05 }; },
      color: (t, y) => (y > 0.36 ? C.shirt : y > 0.33 ? C.shirtDark : C.skin), weight: none,
    });
    const S = (r, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h);
    const g1 = S(1, 16, 12); g1.scale(0.026, 0.045, 0.04); g1.translate(0, 0.0, 0);
    b.geo(g1, C.skin, 0);
    for (let k = 0; k < 4; k++) {
      const f = new THREE.CapsuleGeometry(0.0095, 0.028, 3, 8);
      f.rotateZ(Math.PI / 2); f.translate(-0.012, -0.03, -0.028 + k * 0.018);
      b.geo(f, C.skin, 0);
    }
    const th = new THREE.CapsuleGeometry(0.01, 0.03, 3, 8);
    th.rotateX(-0.9); th.translate(0.02, -0.005, 0.04);
    b.geo(th, C.skin, 0);
    const geo = b.build(false);
    geo.rotateX(Math.PI / 2);
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }));
    return m;
  };
})();
