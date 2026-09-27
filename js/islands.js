// Archipiélago: la Isla Perdida (fija, en el centro) y las islas que se generan con una semilla distinta en cada partida.
// Cada isla tiene su propio terreno (rejilla de alturas), bioma, lagos, recursos, fauna y lugares especiales.
(function () {
  'use strict';
  const G = window.G, U = G.U;
  const A = (G.Arch = { islands: [], base: null, seed: 1, FLOOR: -12, BOUND: 1750, mode: 'coop', teams: 0, pois: [], treasure: null });

  // ------------------------------------------------------------------ tipos de isla
  A.TYPES = {
    perdida: { name: 'Isla Perdida', icon: '🏝️', desc: 'Donde naufragaste. Selva tropical, un lago y una cueva con hierro.', temp: 0, main: true },
    tahuri: { name: 'Isla Tahuri', icon: '🌴', desc: 'Selva de bambú y ríos. Hogar de la tribu Shandara.', temp: 4, main: true },
    escarcha: { name: 'Isla Escarcha', icon: '❄️', desc: 'Invierno eterno: osos blancos, plata y cristales de hielo.', temp: -34, main: true },
    brasa: { name: 'Isla Brasa', icon: '🌋', desc: 'Un volcán activo. Azufre, carbón y cangrejos de lava.', temp: 16, main: true },
    ruinas: { name: 'Isla de las Ruinas', icon: '🏛️', desc: 'Restos del Reino de Aurea, hundido hace 800 años.', temp: 2, main: true },
    islote: { name: 'Islote', icon: '🌴', desc: 'Un pedazo de arena con palmeras.', temp: 0 },
    arrecife: { name: 'Arrecife de las Perlas', icon: '🐚', desc: 'Coral poco profundo. Bucea para encontrar perlas.', temp: 0 },
  };
  const ISLET_NAMES = ['Cayo Gaviota', 'Islote del Náufrago', 'Banco de Arena', 'Cayo Coral', 'Islote de la Calavera', 'Cayo Palmera', 'Roca del Vigía', 'Cayo del Barril'];

  // Colores del terreno por bioma
  const C = (h) => new THREE.Color(h);
  const PAL = {
    perdida: { sand: C(0xe8d3a4), wet: C(0xb09a70), under: C(0xc9b489), grassA: C(0x55842a), grassB: C(0x7a9a3a), dirt: C(0x7a6240), rockA: C(0x8a857b), rockB: C(0x68635b), rockH: 20 },
    tahuri: { sand: C(0xe3cc92), wet: C(0xa38c62), under: C(0xbca67a), grassA: C(0x3a7420), grassB: C(0x5a8c28), dirt: C(0x6a5234), rockA: C(0x767868), rockB: C(0x55584a), rockH: 22 },
    escarcha: { sand: C(0xb4b9be), wet: C(0x8a9098), under: C(0x9aa4aa), grassA: C(0xf2f6fa), grassB: C(0xdde6f0), dirt: C(0xcdd6e0), rockA: C(0x98a0ac), rockB: C(0x78808c), rockH: 30 },
    brasa: { sand: C(0x5a544e), wet: C(0x3e3935), under: C(0x5e564c), grassA: C(0x7a746a), grassB: C(0x6e6a58), dirt: C(0x5e4e42), rockA: C(0x4e4844), rockB: C(0x3a3532), rockH: 14 },
    ruinas: { sand: C(0xe2cfa0), wet: C(0xa8966e), under: C(0xc4b088), grassA: C(0x587a36), grassB: C(0x7a8a48), dirt: C(0x8a7a5a), rockA: C(0xa39c8c), rockB: C(0x7e786a), rockH: 18 },
  };
  PAL.islote = PAL.perdida; PAL.arrecife = PAL.perdida;
  const MAPPAL = {
    perdida: { sand: [222, 202, 150], lo1: [88, 140, 56], lo2: [70, 110, 50], hi: 20, rock1: [125, 118, 108], rock2: [190, 185, 180] },
    tahuri: { sand: [226, 206, 150], lo1: [60, 120, 40], lo2: [45, 95, 35], hi: 22, rock1: [110, 112, 100], rock2: [160, 160, 150] },
    escarcha: { sand: [170, 176, 182], lo1: [228, 236, 244], lo2: [205, 216, 230], hi: 26, rock1: [120, 128, 140], rock2: [240, 245, 250] },
    brasa: { sand: [90, 84, 78], lo1: [118, 112, 102], lo2: [96, 88, 80], hi: 14, rock1: [78, 70, 66], rock2: [170, 70, 36] },
    ruinas: { sand: [226, 208, 160], lo1: [96, 128, 62], lo2: [120, 130, 80], hi: 18, rock1: [165, 158, 142], rock2: [200, 195, 185] },
  };
  MAPPAL.islote = MAPPAL.perdida; MAPPAL.arrecife = MAPPAL.perdida;
  A.mapPalette = (t) => MAPPAL[t] || MAPPAL.perdida;

  // ------------------------------------------------------------------ consulta de altura
  function sample(isl, x, z) {
    const fx = (x - isl.x0) / isl.step, fz = (z - isl.z0) / isl.step;
    if (fx < 0 || fz < 0 || fx >= isl.seg || fz >= isl.seg) return A.FLOOR;
    const N = isl.seg + 1, ix = fx | 0, iz = fz | 0, tx = fx - ix, tz = fz - iz, i = iz * N + ix, H = isl.H;
    return (H[i] * (1 - tx) + H[i + 1] * tx) * (1 - tz) + (H[i + N] * (1 - tx) + H[i + N + 1] * tx) * tz;
  }
  A.height = function (x, z) {
    const b = A.islands[0];
    if (b && x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) return sample(b, x, z);
    for (let i = 1; i < A.islands.length; i++) {
      const s = A.islands[i];
      if (x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1) return sample(s, x, z);
    }
    return A.FLOOR;
  };
  G.height = A.height;

  // Isla cuya tierra (o costa cercana) contiene el punto
  A.landOf = function (x, z) {
    for (const s of A.islands) if (Math.abs(x - s.x) < s.r * 1.35 && Math.abs(z - s.z) < s.r * 1.35 && Math.hypot(x - s.x, z - s.z) < s.r * 1.35) return s;
    return null;
  };
  // Zona de una isla principal (tiene su propio reloj de día y noche)
  A.zoneOf = function (x, z) {
    for (const s of A.islands) if (s.main && Math.hypot(x - s.x, z - s.z) < s.zoneR) return s;
    return null;
  };
  A.nearest = function (x, z, filter) {
    let best = null, bd = 1e9;
    for (const s of A.islands) {
      if (filter && !filter(s)) continue;
      const d = Math.hypot(x - s.x, z - s.z) - s.r;
      if (d < bd) { bd = d; best = s; }
    }
    return best ? { isl: best, d: bd } : null;
  };
  A.byId = (id) => A.islands[id] || null;
  // Tinte de la niebla cerca de islas con clima propio
  const TINT = { escarcha: { color: 0xdfe8f2, k: 0.4 }, brasa: { color: 0x8a6a5c, k: 0.32 } };
  const _tint = { color: 0, k: 0 };
  A.fogTint = function (x, z) {
    for (const s of A.islands) {
      const t = TINT[s.type];
      if (!t) continue;
      const d = Math.hypot(x - s.x, z - s.z);
      if (d < s.r * 1.9) { _tint.color = t.color; _tint.k = t.k * U.smooth(s.r * 1.9, s.r * 0.9, d); return _tint; }
    }
    return null;
  };
  // Modificador de temperatura del bioma (0 fuera de islas con clima especial)
  A.tempAt = function (x, z) {
    const s = A.landOf(x, z);
    if (!s) return 0;
    const T = A.TYPES[s.type].temp;
    if (!T) return 0;
    let k = U.smooth(s.r * 1.3, s.r * 0.85, Math.hypot(x - s.x, z - s.z)) * T;
    if (s.type === 'brasa' && s.feat.crater) {
      const c = s.feat.crater, d = Math.hypot(x - c.wx, z - c.wz);
      k += U.smooth(40, 10, d) * 30;
    }
    return k;
  };
  A.biomeAt = (x, z) => { const s = A.landOf(x, z); return s ? s.type : 'sea'; };

  // ------------------------------------------------------------------ isla base (Isla Perdida)
  A.setBase = function (H, seg, step, half) {
    A.islands[0] = {
      id: 0, type: 'perdida', name: 'Isla Perdida', x: 0, z: 0, r: 200, ext: half, seg, step, H,
      x0: -half, x1: half, z0: -half, z1: half, main: true, zoneR: 200 * 1.25 + 110, feat: {}, seed: 7,
    };
  };

  // ------------------------------------------------------------------ generación de terreno por bioma
  function tryPick(rnd, base, r, dmin, dmax, ok, tries = 80) {
    for (let i = 0; i < tries; i++) {
      const a = rnd() * Math.PI * 2, d = r * U.lerp(dmin, dmax, rnd());
      const x = Math.cos(a) * d, z = Math.sin(a) * d, h = base(x, z);
      if (ok(h, x, z)) return { x, z, a };
    }
    return null;
  }
  function makeTerrain(isl) {
    const T = isl.type, r = isl.r, F = (isl.feat = {}), rnd = U.rng(isl.seed * 31 + 5);
    const nA = U.makeNoise(isl.seed), nB = U.makeNoise(isl.seed + 11), nC = U.makeNoise(isl.seed + 23);
    const peak = (x, z, p) => { if (!p) return 0; let m = Math.max(0, 1 - Math.hypot(x - p.x, z - p.z) / p.rad); return m * m * (3 - 2 * m) * p.h; };
    const volcano = (x, z) => {
      const c = F.crater, dv = Math.hypot(x - c.x, z - c.z);
      let v = Math.pow(Math.max(0, 1 - dv / c.rad), 1.3) * c.h;
      if (dv < c.rc * 1.25) {
        const inner = c.rim - (1 - Math.min(1, dv / c.rc) ** 2) * 9;
        v = U.lerp(inner, v, U.smooth(c.rc * 0.95, c.rc * 1.25, dv));
      }
      return v;
    };
    const base = (x, z) => {
      const d = Math.hypot(x, z) / r;
      const coast = d + U.fbm(nA, x * 0.0065, z * 0.0065, 4) * 0.24;
      const island = 1 - U.smooth(0.55, 1.0, coast);
      const inland = U.smooth(0.62, 0.32, coast);
      const fine = U.fbm(nC, x * 0.07, z * 0.07, 2) * 0.35 * (0.3 + inland);
      if (T === 'islote') return -12 + island * 14.3 + fine * 0.4;
      if (T === 'arrecife') return -12 + island * 9.4 + fine * 1.6;
      const hills = U.fbm(nB, x * 0.013, z * 0.013, 4) * 0.5 + 0.5;
      let h = -12 + island * 14;
      if (T === 'tahuri') h += inland * (hills * 13 + peak(x, z, F.peak));
      else if (T === 'escarcha') h += inland * (hills * 8 + peak(x, z, F.peak) + peak(x, z, F.peak2));
      else if (T === 'brasa') h += inland * hills * 4 + island * volcano(x, z);
      else if (T === 'ruinas') h += inland * (hills * 3) + U.smooth(0.2, 0.95, inland) * 7;
      return h + fine;
    };
    // Rasgos que forman parte del relieve base
    if (T === 'tahuri') F.peak = { ...polar(rnd, r * 0.3), rad: r * 0.55, h: 15 };
    if (T === 'escarcha') {
      const a = rnd() * Math.PI * 2;
      F.peak = { x: Math.cos(a) * r * 0.2, z: Math.sin(a) * r * 0.2, rad: r * 0.62, h: 34 };
      F.peak2 = { x: Math.cos(a + 2.3) * r * 0.36, z: Math.sin(a + 2.3) * r * 0.36, rad: r * 0.4, h: 18 };
    }
    if (T === 'brasa') {
      const p = polar(rnd, r * 0.08);
      F.crater = { x: p.x, z: p.z, rad: r * 0.78, h: 46, rc: 13 };
      F.crater.rim = Math.pow(1 - F.crater.rc / F.crater.rad, 1.3) * F.crater.h;
      F.crater.lava = F.crater.rim - 7;
    }
    // Rasgos que aplanan o excavan el terreno (se colocan donde hay tierra firme)
    const land = (lo, hi) => (h) => h > lo && h < hi;
    const lake = (p, rad, depth, lo, hi) => p && Object.assign(p, { r: rad, depth, lo, hi });
    if (T === 'tahuri') {
      F.lake = lake(tryPick(rnd, base, r, 0.15, 0.4, land(4, 13)), 13, 4, 4.2, 9);
      F.village = tryPick(rnd, base, r, 0.5, 0.62, (h, x, z) => h > 2.6 && h < 8 && (!F.lake || Math.hypot(x - F.lake.x, z - F.lake.z) > 55));
      if (F.village) F.village.r = 24;
      F.temple = tryPick(rnd, base, r, 0.2, 0.38, (h, x, z) => h > 6 && h < 20 && (!F.lake || Math.hypot(x - F.lake.x, z - F.lake.z) > 30) && (!F.village || Math.hypot(x - F.village.x, z - F.village.z) > 50));
      if (F.temple) F.temple.r = 8;
    } else if (T === 'escarcha') {
      const p = F.peak, dx = -p.x, dz = -p.z, dl = Math.hypot(dx, dz) || 1;
      F.cave = { x: p.x + dx / dl * p.rad * 0.42, z: p.z + dz / dl * p.rad * 0.42, r: 11, h: 7.5 };
      F.cave.ent = Math.atan2(F.cave.x - p.x, F.cave.z - p.z);
      F.ice = tryPick(rnd, base, r, 0.4, 0.58, (h, x, z) => h > 3 && h < 9 && Math.hypot(x - F.cave.x, z - F.cave.z) > 45);
      if (F.ice) F.ice.r = 15;
      F.spring = lake(tryPick(rnd, base, r, 0.45, 0.62, (h, x, z) => h > 2.8 && h < 7 && Math.hypot(x - F.cave.x, z - F.cave.z) > 40 && (!F.ice || Math.hypot(x - F.ice.x, z - F.ice.z) > 30)), 6, 1.8, 2.8, 6);
    } else if (T === 'brasa') {
      F.spring = lake(tryPick(rnd, base, r, 0.55, 0.68, land(2.6, 7)), 6, 1.8, 2.8, 6);
      F.lava = [];
      for (let i = 0; i < 3; i++) {
        const p = tryPick(rnd, base, r, 0.3, 0.5, (h, x, z) => h > 8 && h < 26 && F.lava.every((o) => Math.hypot(o.x - x, o.z - z) > 30));
        if (p) F.lava.push(Object.assign(p, { r: 3.5 + rnd() * 1.5 }));
      }
    } else if (T === 'ruinas') {
      F.plaza = { x: 0, z: 0, r: 30 };
      F.pond = lake(tryPick(rnd, base, r, 0.45, 0.6, land(3, 12)), 8, 2.5, 3.5, 10);
    }
    const flatten = (h, x, z, f, inner, outer) => {
      if (f.plateau === undefined) f.plateau = U.clamp(base(f.x, f.z), f.lo ?? -99, f.hi ?? 99);
      return U.lerp(h, f.plateau, U.smooth(outer, inner, Math.hypot(x - f.x, z - f.z)));
    };
    const dig = (h, x, z, f) => h - U.smooth(f.r, 0, Math.hypot(x - f.x, z - f.z)) * f.depth;
    isl.heightLocal = (x, z) => {
      let h = base(x, z);
      for (const L of [F.lake, F.spring, F.pond]) if (L) { h = flatten(h, x, z, L, L.r * 1.15, L.r * 2.1); h = dig(h, x, z, L); }
      if (F.village) h = flatten(h, x, z, F.village, F.village.r * 0.9, F.village.r * 1.55);
      if (F.temple) h = flatten(h, x, z, F.temple, F.temple.r, F.temple.r * 2);
      if (F.ice) h = flatten(h, x, z, F.ice, F.ice.r * 1.05, F.ice.r * 1.7);
      if (F.plaza) h = flatten(h, x, z, F.plaza, F.plaza.r, F.plaza.r * 1.6);
      if (F.cave) { const Cv = F.cave, dc = Math.hypot(x - Cv.x, z - Cv.z); if (dc < Cv.r * 2.3) h = flatten(h, x, z, Cv, Cv.r * 1.3, Cv.r * 2.3); }
      if (F.lava) for (const L of F.lava) { if (L.plateau === undefined) L.plateau = base(L.x, L.z); const d = Math.hypot(x - L.x, z - L.z); if (d < L.r * 1.8) h = U.lerp(h, L.plateau, U.smooth(L.r * 1.8, L.r, d)) - U.smooth(L.r, 0, d) * 1.4; }
      return h;
    };
    // Rejilla de alturas
    isl.ext = Math.round(r * 1.3 + 10);
    isl.step = T === 'islote' || T === 'arrecife' ? 1.6 : 2.2;
    isl.seg = Math.ceil((isl.ext * 2) / isl.step);
    isl.step = (isl.ext * 2) / isl.seg;
    const N = isl.seg + 1, H = (isl.H = new Float32Array(N * N));
    for (let iz = 0; iz < N; iz++) for (let ix = 0; ix < N; ix++) H[iz * N + ix] = isl.heightLocal(-isl.ext + ix * isl.step, -isl.ext + iz * isl.step);
    isl.x0 = isl.x - isl.ext; isl.x1 = isl.x + isl.ext; isl.z0 = isl.z - isl.ext; isl.z1 = isl.z + isl.ext;
    // Rasgos en coordenadas del mundo
    for (const k in F) {
      const f = F[k];
      if (Array.isArray(f)) f.forEach((o) => { o.wx = o.x + isl.x; o.wz = o.z + isl.z; });
      else if (f && f.x !== undefined) { f.wx = f.x + isl.x; f.wz = f.z + isl.z; }
    }
  }
  function polar(rnd, d) { const a = rnd() * Math.PI * 2; return { x: Math.cos(a) * d, z: Math.sin(a) * d }; }

  // Malla del terreno con colores por vértice según el bioma
  function buildMesh(isl) {
    const geo = new THREE.PlaneGeometry(isl.ext * 2, isl.ext * 2, isl.seg, isl.seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, isl.H[i]);
    geo.computeVertexNormals();
    const nor = geo.attributes.normal, cols = new Float32Array(pos.count * 3);
    const P = PAL[isl.type], F = isl.feat;
    const n1f = U.makeNoise(isl.seed + 3), n2f = U.makeNoise(isl.seed + 4), n3f = U.makeNoise(isl.seed + 5);
    const c = new THREE.Color(), g = new THREE.Color(), r = new THREE.Color();
    const mud = C(0x55493a), ember = C(0x8a3a1a), iceC = C(0xcfe6f5), villageC = C(0x8a7250), plazaC = C(0xb8ae98), coral = [C(0xe07a8a), C(0xf0a860), C(0x9a70c8)];
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), h = pos.getY(i), ny = nor.getY(i);
      const n1 = n1f(x * 0.05, z * 0.05), n2 = n2f(x * 0.013, z * 0.013), n3 = n3f(x * 0.2, z * 0.2);
      if (h < -0.3) c.copy(P.under).lerp(P.wet, U.smooth(-4, -0.3, h));
      else c.lerpColors(P.wet, P.sand, U.smooth(-0.3, 0.9, h));
      if (isl.type === 'arrecife' && h < -1.5 && n3 > 0.1) c.lerp(coral[(Math.abs(n1 * 10) | 0) % 3], 0.75);
      g.lerpColors(P.grassA, P.grassB, n1 * 0.5 + 0.5);
      g.lerp(P.dirt, U.smooth(0.35, 0.75, n2) * 0.7);
      c.lerp(g, U.smooth(2.1, 3.3, h + n3 * 0.5));
      r.lerpColors(P.rockA, P.rockB, n3 * 0.5 + 0.5);
      const rockT = Math.max(U.smooth(0.86, 0.7, ny) * U.smooth(1.0, 3.0, h), U.smooth(P.rockH, P.rockH + 7, h + n1 * 3));
      c.lerp(r, rockT);
      if (isl.type === 'escarcha') c.lerp(P.grassA, Math.max(U.smooth(24, 30, h + n1 * 3), 0.75 * U.smooth(0.7, 0.9, ny) * U.smooth(1.5, 3, h)) * U.smooth(0.62, 0.8, ny)); // nieve en las laderas y cumbres
      for (const L of [F.lake, F.spring, F.pond]) if (L && Math.hypot(x - L.x, z - L.z) < L.r * 1.05) c.lerp(mud, U.smooth(L.plateau - L.depth * 0.2 + 0.6, L.plateau - L.depth * 0.2 - 0.4, h) * 0.8);
      if (F.village) c.lerp(villageC, U.smooth(F.village.r, F.village.r * 0.6, Math.hypot(x - F.village.x, z - F.village.z)) * (0.55 + n3 * 0.2));
      if (F.plaza) c.lerp(plazaC, U.smooth(F.plaza.r, F.plaza.r * 0.7, Math.hypot(x - F.plaza.x, z - F.plaza.z)) * 0.8);
      if (F.ice) c.lerp(iceC, U.smooth(F.ice.r * 1.05, F.ice.r * 0.9, Math.hypot(x - F.ice.x, z - F.ice.z)));
      if (F.cave) { const cd = Math.hypot(x - F.cave.x, z - F.cave.z); if (cd < F.cave.r * 1.6) c.lerp(r.copy(P.rockB).multiplyScalar(0.8), U.smooth(F.cave.r * 1.6, F.cave.r * 0.9, cd) * 0.9); }
      if (F.crater) c.lerp(ember, U.smooth(F.crater.rc * 2.2, F.crater.rc * 0.8, Math.hypot(x - F.crater.x, z - F.crater.z)) * 0.8);
      if (F.lava) for (const L of F.lava) c.lerp(ember, U.smooth(L.r * 1.9, L.r * 0.9, Math.hypot(x - L.x, z - L.z)) * 0.85);
      cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const mesh = new THREE.Mesh(geo, G.World.terrainMaterial(isl.ext * 2));
    mesh.position.set(isl.x, 0, isl.z);
    mesh.receiveShadow = true;
    G.scene.add(mesh);
    isl.mesh = mesh;
  }

  // Lagos, fuentes termales, hielo y lava
  function buildWaters(isl) {
    const F = isl.feat, W = G.World;
    isl.extra = [];
    const disc = (f, level, mat) => {
      const g = new THREE.CircleGeometry(f.r * 1.02, 48);
      g.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(g, mat);
      m.position.set(f.wx, level, f.wz);
      G.scene.add(m); isl.extra.push(m);
      return m;
    };
    for (const [L, kind] of [[F.lake, 'fresh'], [F.spring, 'hot'], [F.pond, 'fresh']]) {
      if (!L) continue;
      L.level = L.plateau - L.depth * 0.2 - 0.2;
      const hot = kind === 'hot';
      const mat = W.makeWater(L.level, 0.08, hot ? 0x8ad0d8 : 0x4f9a86, hot ? 0x2a6a78 : 0x123f3c, hot ? 0.5 : 0.35);
      const m = disc(L, L.level, mat);
      m.userData.waterMat = mat;
      W.lakes.push({ x: L.wx, z: L.wz, r: L.r, level: L.level, kind, isl: isl.id });
    }
    if (F.ice) {
      const mat = new THREE.MeshStandardMaterial({ color: 0xd8ecfa, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85 });
      disc(F.ice, F.ice.plateau + 0.04, mat).receiveShadow = true;
    }
    const lavaMat = () => new THREE.MeshBasicMaterial({ color: 0xff5a14 });
    if (F.crater) {
      const c = F.crater;
      disc({ wx: c.wx, wz: c.wz, r: c.rc * 0.75 }, c.lava, lavaMat());
      G.Landmarks.addLight(c.wx, c.lava + 6, c.wz, 0xff6a20, 60, 70, true);
    }
    if (F.lava) for (const L of F.lava) { L.level = L.plateau - 0.9; disc(L, L.level, lavaMat()); }
  }

  // ------------------------------------------------------------------ colocación de islas (con semilla)
  function place(rnd, opts) {
    const out = [A.islands[0]];
    const fits = (x, z, r, gap) => Math.abs(x) < 1420 && Math.abs(z) < 1420 && out.every((o) => Math.hypot(o.x - x, o.z - z) > o.r + r + gap);
    const push = (o) => { o.id = out.length; out.push(o); return o; };
    const mains = () => out.filter((o) => o.main);
    const tryMain = (type, near) => {
      for (let k = 0; k < 800; k++) {
        const r = 118 + rnd() * 34, a = near || mains()[Math.floor(rnd() * mains().length)];
        const ang = rnd() * Math.PI * 2, d = a.r + r + 350 + rnd() * 250;
        const x = a.x + Math.cos(ang) * d, z = a.z + Math.sin(ang) * d;
        if (fits(x, z, r, 330)) return push({ type, x, z, r, main: true });
      }
      return null;
    };
    const shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
    const biomes = shuffle(['tahuri', 'escarcha', 'brasa']);
    if (opts.mode === 'versus') {
      // Isla central neutral y las islas de cada equipo a la misma distancia de ella
      const n = opts.teams;
      out[0].team = 0;
      for (let tries = 0; tries < 400; tries++) {
        out.length = 1;
        const th = rnd() * Math.PI * 2, D = 720 + rnd() * 120;
        const ruins = { type: 'ruinas', x: Math.cos(th) * D, z: Math.sin(th) * D, r: 118, main: true };
        if (!fits(ruins.x, ruins.z, ruins.r, 300)) continue;
        push(ruins);
        const phi0 = Math.atan2(-ruins.z, -ruins.x);
        let ok = true;
        for (let t = 1; t < n; t++) {
          const phi = phi0 + (t / n) * Math.PI * 2, r = 125 + rnd() * 20;
          const x = ruins.x + Math.cos(phi) * D, z = ruins.z + Math.sin(phi) * D;
          if (!fits(x, z, r, 300)) { ok = false; break; }
          push({ type: biomes[t - 1], x, z, r, main: true, team: t });
        }
        if (ok) break;
      }
      for (const b of biomes.slice(n - 1)) tryMain(b);
    } else for (const b of biomes) tryMain(b);
    // Islotes y arrecife entre las islas grandes
    const nIslets = opts.mode === 'versus' ? 6 : 5;
    for (let i = 0; i < nIslets; i++) {
      for (let k = 0; k < 400; k++) {
        const a = mains()[Math.floor(rnd() * mains().length)], r = 20 + rnd() * 14;
        const ang = rnd() * Math.PI * 2, d = a.r + 140 + rnd() * 260;
        const x = a.x + Math.cos(ang) * d, z = a.z + Math.sin(ang) * d;
        if (fits(x, z, r, 110)) { push({ type: 'islote', x, z, r, name: ISLET_NAMES[i % ISLET_NAMES.length] }); break; }
      }
    }
    for (let k = 0; k < 400; k++) {
      const a = mains()[Math.floor(rnd() * mains().length)], r = 40 + rnd() * 12;
      const ang = rnd() * Math.PI * 2, d = a.r + 170 + rnd() * 200;
      const x = a.x + Math.cos(ang) * d, z = a.z + Math.sin(ang) * d;
      if (fits(x, z, r, 110)) { push({ type: 'arrecife', x, z, r }); break; }
    }
    return out;
  }

  // Lugares del mar: naufragios hundidos, submarino, barriles, botellas, remolino y bancos de peces
  function placePois(rnd) {
    const pois = [];
    const seaPoint = (gap) => {
      for (let k = 0; k < 600; k++) {
        const a = A.islands.filter((o) => o.main)[Math.floor(rnd() * A.islands.filter((o) => o.main).length)];
        const ang = rnd() * Math.PI * 2, d = a.r * 1.3 + gap + rnd() * 360;
        const x = a.x + Math.cos(ang) * d, z = a.z + Math.sin(ang) * d;
        if (Math.abs(x) > 1500 || Math.abs(z) > 1500) continue;
        if (A.islands.every((o) => Math.hypot(o.x - x, o.z - z) > o.r * 1.35 + gap) && pois.every((p) => Math.hypot(p.x - x, p.z - z) > 60)) return { x, z };
      }
      return null;
    };
    const add = (kind, id, gap, extra) => { const p = seaPoint(gap); if (p) pois.push(Object.assign({ kind, id, x: p.x, z: p.z, rot: rnd() * Math.PI * 2 }, extra)); };
    add('wreck', 'sw0', 40); add('wreck', 'sw1', 40);
    add('sub', 'sub', 60);
    for (let i = 0; i < 8; i++) add('barrel', 'b' + i, 30);
    for (let i = 0; i < 6; i++) add('bottle', 'bt' + i, 30, { n: i });
    add('whirl', 'wh', 120, { r: 24 });
    for (let i = 0; i < 4; i++) add('school', 'fs' + i, 40, { r: 26 });
    return pois;
  }

  // ------------------------------------------------------------------ generar / limpiar
  A.clear = function () {
    for (let i = A.islands.length - 1; i >= 1; i--) {
      const s = A.islands[i];
      if (s.mesh) { G.scene.remove(s.mesh); s.mesh.geometry.dispose(); s.mesh.material.map.dispose(); s.mesh.material.dispose(); }
      for (const o of s.extra || []) {
        G.scene.remove(o);
        if (o.geometry) o.geometry.dispose();
        if (o.userData.waterMat) G.World.dropWater(o.userData.waterMat); else if (o.material) o.material.dispose();
      }
    }
    A.islands.length = 1;
    A.islands[0].team = undefined;
    G.World.lakes = G.World.lakes.filter((l) => l.isl === 0);
    G.World.clearGrass(true);
    G.Res.clearExtra();
    G.Landmarks.clearExtra();
    A.pois = [];
    A.treasure = null;
  };

  // opts = { mode: 'coop' | 'versus', teams: 2..4 }
  A.generate = function (seed, opts = {}) {
    A.clear();
    A.seed = seed >>> 0;
    A.mode = opts.mode || 'coop';
    A.teams = opts.teams || 0;
    const rnd = U.rng(A.seed);
    const list = place(rnd, { mode: A.mode, teams: Math.max(2, A.teams) });
    let islet = 0;
    for (const o of list) {
      if (o.id === 0) continue;
      const isl = Object.assign(o, { seed: Math.floor(rnd() * 1e9) });
      isl.name = isl.name || (A.TYPES[isl.type].name);
      if (isl.type === 'islote' && !o.name) isl.name = ISLET_NAMES[islet++ % ISLET_NAMES.length];
      isl.zoneR = isl.r * 1.25 + 110;
      makeTerrain(isl);
      A.islands[isl.id] = isl;
      buildMesh(isl);
      buildWaters(isl);
      isl.spawn = beachSpawn(isl, rnd() * Math.PI * 2);
    }
    // Hierba, mapas, recursos y lugares especiales
    const grassRnd = U.rng(A.seed + 99);
    for (const isl of A.islands) {
      if (isl.id === 0) continue;
      const dens = { tahuri: 26000, ruinas: 14000, islote: 600 }[isl.type] || 0;
      const F = isl.feat;
      const clear = (x, z) => [F.village, F.plaza, F.temple].every((f) => !f || Math.hypot(x - f.wx, z - f.wz) > f.r * 0.85);
      if (dens) G.World.addGrass(isl, dens, grassRnd, (x, z, h) => h > 2.8 && h < 17 && clear(x, z));
      isl.map = G.World.renderIslandMap(isl, isl.main ? 200 : 72);
    }
    G.World.refreshDepth();
    A.pois = placePois(rnd);
    if (A.mode === 'versus') {
      const islets = A.islands.filter((s) => s.type === 'islote');
      const t = islets[Math.floor(rnd() * islets.length)];
      if (t) A.treasure = { x: t.x + (rnd() - 0.5) * t.r * 0.6, z: t.z + (rnd() - 0.5) * t.r * 0.6, isl: t.id };
    }
    for (const isl of A.islands) if (isl.id > 0) G.Res.addIsland(isl);
    G.Res.finishExtra();
    for (const isl of A.islands) if (isl.id > 0) G.Landmarks.buildIsland(isl);
    G.Landmarks.buildSea(A.pois);
    if (G.Prologue) G.Prologue.build();
    if (G.Bounty) G.Bounty.build();
    G.World.updateGrass(G.camera.position, true);
  };

  // Punto de playa mirando al mar en la dirección indicada
  function beachSpawn(isl, ang) {
    for (let k = 0; k < 16; k++) {
      const a = ang + k * 0.4, dx = Math.cos(a), dz = Math.sin(a);
      for (let d = isl.r * 0.3; d < isl.r * 1.3; d += 0.5) {
        const x = isl.x + dx * d, z = isl.z + dz * d;
        if (G.height(x, z) < 1.7) {
          const sx = isl.x + dx * (d - 5), sz = isl.z + dz * (d - 5);
          if (G.height(sx, sz) > 0.8) return { x: sx, z: sz, yaw: Math.atan2(dx, dz) };
          break;
        }
      }
    }
    return { x: isl.x, z: isl.z, yaw: 0 };
  }
  A.beachSpawn = beachSpawn;
})();
