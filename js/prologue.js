// Prólogo de la Isla Perdida: el gancho del principio.
//  - Silvano, el viejo ermitaño (y brujo), te encuentra en la playa y te habla de la Fruta del Abismo de Rogan.
//  - Tu tripulación sobrevivió al naufragio: la capitana Mara y tres maestros (espadachín, tirador y luchador).
//  - Los piratas de la capitana Hiena acampan en la costa oeste: también buscan la fruta.
//  - Tres pistas de Rogan llevan al cofre escondido con una Fruta del Abismo.
// La Isla Perdida es siempre igual, así que los lugares son fijos.
(function () {
  'use strict';
  const G = window.G, U = G.U;
  const Pr = (G.Prologue = {});
  const M = () => G.Mdl;

  Pr.CREW = { x: 116, z: -50, name: 'Campamento de tu tripulación' };
  Pr.HUT = { x: 31, z: 16, name: 'Choza de Silvano' };
  Pr.PIRATES = { x: -110, z: 30, name: 'Campamento pirata' };
  Pr.TREASURE = { x: 47, z: -105, name: 'Cofre de Rogan' };
  Pr.CLUE1 = null; Pr.CLUE2 = null; // se calculan al construir (ancla del naufragio y piedra del lago)

  // Náufragos (tipo 'npc'): extra = índice
  Pr.NPCS = [
    { key: 'silvano', name: 'Silvano, el ermitaño', role: 'hermit', style: 'magic', shirt: '#4a3a6a', skin: '#c68d67', pants: '#3a2e4a', cos: ['npc_capucha', 'npc_barba', 'npc_tunica'], hold: 'baston' },
    { key: 'mara', name: 'Capitana Mara', role: 'captain', shirt: '#a01e1e', skin: '#e6b48e', pants: '#2a2a2e', cos: ['cos_tricornio', 'cos_capa'] },
    { key: 'kaito', name: 'Kaito, el espadachín', role: 'trainer', style: 'sword', shirt: '#e6dfcc', skin: '#c68d67', pants: '#2e4a3a', cos: ['cos_bandana'], hold: 'katana' },
    { key: 'crane', name: 'Crane, el artillero', role: 'trainer', style: 'gun', shirt: '#5a4632', skin: '#a8704a', pants: '#3b5270', cos: ['cos_ala_ancha', 'cos_parche'], hold: 'mosquete' },
    { key: 'bastian', name: 'Bastián, el cocinero', role: 'trainer', style: 'fist', shirt: '#f4f4f0', skin: '#f3d2b4', pants: '#2a2a2e', cos: ['cos_gorro_chef', 'cos_bigote'] },
  ];
  const HOME = [() => Pr.HUT, () => Pr.CREW, () => Pr.CREW, () => Pr.CREW, () => Pr.CREW];
  const HOME_OFF = [[3.5, 2], [-2.5, 2.5], [5.5, -2], [-5, -3.5], [1, 5.5]];
  // Muñecos de entrenamiento (tipo 'dummy'): muñeco (espada), diana (disparo), saco (puños) y tótem de runas (magia)
  Pr.DUMMIES = [
    { name: 'Muñeco de paja', style: 'sword', at: () => Pr.CREW, off: [8, -1] },
    { name: 'Diana', style: 'gun', at: () => Pr.CREW, off: [-9, -8] },
    { name: 'Saco de boxeo', style: 'fist', at: () => Pr.CREW, off: [3, 8.5] },
    { name: 'Tótem de runas', style: 'magic', at: () => Pr.HUT, off: [7, 1] },
  ];
  const TRAIN = { sword: 10, gun: 5, fist: 12, magic: 5 };

  const W = () => (G.Story && G.state.world ? G.Story.getState() : { flags: {} });
  const F = () => { const w = W(); w.flags = w.flags || {}; return w.flags; };
  const sync = () => G.Net.send({ t: 'story', w: W() });
  Pr.active = () => G.state.gm !== 'versus' && !(G.Modes && G.Modes.active);
  Pr.clues = () => ['clue1', 'clue2', 'clue3'].filter((k) => F()[k]).length;

  // ------------------------------------------------------------------ aspecto de náufragos y piratas
  const hx = (c) => new THREE.Color(c).getHex();
  function pirateLook(type, extra) {
    const r = U.rng(extra * 7919 + 13);
    const pick = (a) => a[Math.floor(r() * a.length)];
    if (type === 'pirate_boss') return { name: 'Capitana Hiena', role: 'boss', shirt: '#2a2a2e', skin: '#e6b48e', pants: '#5a1a1a', cos: ['cos_tricornio', 'cos_capa', 'cos_parche'], hold: 'sable' };
    return {
      name: type === 'pirate_gun' ? 'Pirata tirador' : 'Pirata de la Hiena', role: 'pirate',
      shirt: pick(['#7a2a2a', '#2a2a2e', '#5a4632', '#3a4a6a', '#6a5a3a', '#e6dfcc']), skin: pick(['#e6b48e', '#c68d67', '#a8704a', '#7e4d30']), pants: pick(['#2a2a2e', '#4a3a2a', '#3a2a1a', '#3b5270']),
      cos: type === 'pirate_gun' ? pick([['cos_ala_ancha'], ['cos_bandana', 'cos_parche'], ['cos_tricornio']]) : pick([['cos_bandana'], ['cos_bandana', 'cos_parche'], ['cos_tricornio'], ['cos_bandana', 'cos_bigote'], ['cos_parche']]),
      hold: type === 'pirate_gun' ? 'mosquete' : 'sable',
    };
  }
  Pr.human = function (type, extra) {
    const d = type === 'npc' ? Pr.NPCS[(extra || 0) % Pr.NPCS.length] : pirateLook(type, extra || 0);
    const model = G.Character.create(hx(d.shirt), { skin: hx(d.skin), pants: hx(d.pants) });
    G.Equip.apply(model, d.cos || []);
    if (d.hold) { const t = G.makeItemMesh(d.hold); if (t) { t.rotation.set(Math.PI / 2, 2.12, 0); model.hand.add(t); } }
    return { g: model.root, legs: [], head: null, model, vinfo: { name: d.name, role: d.role }, feathers: { dispose() {} }, hold: !!d.hold };
  };
  // Muñecos de entrenamiento
  Pr.dummy = function (extra) {
    const Md = M(), D = Pr.DUMMIES[extra % Pr.DUMMIES.length], p = [];
    if (extra === 0) {
      p.push(Md.xf(Md.paint(new THREE.CylinderGeometry(0.07, 0.09, 1.9, 7), 0x5a4028), 0, 0.95, 0), Md.xf(Md.paint(new THREE.CylinderGeometry(0.05, 0.05, 1.3, 6), 0x5a4028), 0, 1.35, 0, 0, 0, Math.PI / 2));
      p.push(Md.xf(Md.paint(new THREE.CylinderGeometry(0.22, 0.2, 0.7, 10), (x, y) => (Math.abs(Math.sin(y * 25)) > 0.93 ? 0x7a5a2a : 0xd8bc6a)), 0, 1.15, 0));
      p.push(Md.ball(0.17, 0xc8b080, 0, 1.68, 0), Md.ball(0.03, 0x2a2a2a, 0.06, 1.72, 0.15), Md.ball(0.03, 0x2a2a2a, -0.06, 1.72, 0.15));
      for (const s of [-1, 1]) p.push(Md.xf(Md.paint(new THREE.CylinderGeometry(0.08, 0.07, 0.5, 8), 0xd8bc6a), s * 0.5, 1.35, 0, 0, 0, Math.PI / 2));
    } else if (extra === 1) {
      for (const [x, z, rz] of [[-0.4, -0.2, 0.2], [0.4, -0.2, -0.2], [0, 0.35, 0]]) p.push(Md.xf(Md.paint(new THREE.CylinderGeometry(0.04, 0.05, 1.7, 5), 0x5a4028), x * 0.8, 0.8, z, z > 0 ? -0.3 : 0.1, 0, rz));
      p.push(Md.xf(Md.paint(new THREE.CylinderGeometry(0.55, 0.55, 0.08, 28), (x, y, z) => { const r = Math.hypot(x, z); return y < 0 ? 0xb8a070 : r < 0.1 ? 0xd02020 : r < 0.2 ? 0xf2ece0 : r < 0.3 ? 0xd02020 : r < 0.42 ? 0xf2ece0 : 0x2a2a2a; }), 0, 1.35, -0.1, Math.PI / 2 + 0.15, Math.PI, 0));
    } else if (extra === 2) {
      for (const s of [-1, 1]) p.push(Md.xf(Md.paint(new THREE.CylinderGeometry(0.07, 0.08, 2.4, 6), 0x5a4028), s * 0.8, 1.2, 0));
      p.push(Md.xf(Md.paint(new THREE.CylinderGeometry(0.06, 0.06, 1.8, 6), 0x5a4028), 0, 2.35, 0, 0, 0, Math.PI / 2), Md.xf(Md.paint(new THREE.CylinderGeometry(0.01, 0.01, 0.4, 4), 0x2a2a2a), 0, 2.15, 0));
      p.push(Md.xf(Md.paint(new THREE.CapsuleGeometry(0.24, 0.6, 4, 12), (x, y) => (Math.abs(y) > 0.36 ? 0x3a2416 : 0x7a4a2a)), 0, 1.45, 0));
    } else {
      p.push(Md.xf(Md.paint(new THREE.CylinderGeometry(0.28, 0.36, 2.2, 7), (x, y, z) => (Math.abs(Math.sin(y * 9 + Math.atan2(z, x) * 3)) < 0.12 ? 0x7fe0ff : 0x6a665e), 0.05), 0, 1.1, 0));
      p.push(Md.xf(Md.paint(new THREE.ConeGeometry(0.34, 0.5, 7), 0x5a564e), 0, 2.45, 0), Md.xf(Md.paint(new THREE.OctahedronGeometry(0.16), 0x9fe8ff), 0, 2.85, 0, 0, 0, 0, [1, 1.6, 1]));
    }
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
    const m = new THREE.Mesh(U.merge(p), mat);
    m.castShadow = true;
    const g = new THREE.Group(); g.add(m);
    if (extra === 3 && G.Build.smokeTex) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.Build.smokeTex, color: 0x7fd8ff, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending })); s.position.set(0, 2.85, 0); s.scale.setScalar(0.9); g.add(s); }
    return { g, legs: [], head: null, mat, vinfo: { name: D.name, role: 'dummy' } };
  };

  // Cosméticos solo para Silvano: capucha de brujo, barba larga y túnica
  function registerNpcCosmetics() {
    const Md = M();
    G.Equip.register('npc_capucha', () => [{ bone: 'head', geos: [
      Md.xf(Md.paint(new THREE.CylinderGeometry(0.2, 0.2, 0.012, 24), 0x3a2a5a), 0, 0.155, 0),
      Md.tube([[0, 0.15, 0], [0, 0.3, -0.01], [0.02, 0.42, -0.05], [0.08, 0.5, -0.12]], (t) => U.lerp(0.13, 0.012, t), 12, (t) => (Math.sin(t * 40) > 0.95 ? 0xe8d070 : 0x3a2a5a), 20),
      Md.ball(0.018, 0xe8d070, 0.08, 0.5, -0.12),
    ] }]);
    G.Equip.register('npc_barba', () => [{ bone: 'head', geos: [
      Md.xf(Md.paint(new THREE.ConeGeometry(0.085, 0.3, 10), (x, y, z) => (Math.sin(x * 120) > 0.3 ? 0xd8d4cc : 0xf0ece4)), 0, -0.03, 0.09, Math.PI - 0.25, 0, 0, [1, 1, 0.55]),
      ...[-1, 1].map((s) => Md.tube([[s * 0.005, 0.1, 0.125], [s * 0.04, 0.09, 0.12], [s * 0.06, 0.06, 0.1]], [0.012, 0.006], 6, 0xf0ece4, 8)),
    ] }]);
    G.Equip.register('npc_tunica', () => [{ bone: 'hips', geos: [
      Md.lathe([[0.2, 0.08], [0.23, -0.2], [0.29, -0.55], [0.32, -0.8], [0.3, -0.82]], 18, (x, y) => (y < -0.72 ? 0xd8b050 : 0x4a3a6a)),
    ] }]);
  }

  // ------------------------------------------------------------------ escenario (se reconstruye con cada archipiélago)
  const H = (x, z) => G.height(x, z);
  function place(obj, x, z, rot = 0) { obj.position.set(x, H(x, z), z); obj.rotation.y = rot; return obj; }
  function vmesh(geos, extraMat) { const m = new THREE.Mesh(U.merge(geos), extraMat || G.Landmarks.kit().mats().vc); m.castShadow = true; m.receiveShadow = true; return m; }
  function flagCloth(design, color) {
    const tex = U.canvasTex(128, 80, (c, w, h) => {
      c.fillStyle = design ? '#111' : '#f2ece0'; c.fillRect(0, 0, w, h);
      if (design) G.Shop.drawFlag(c, w, h, design);
      else { c.fillStyle = color; c.fillRect(0, 30, w, 20); c.fillStyle = '#2a4a8a'; c.beginPath(); c.moveTo(40, 40); c.quadraticCurveTo(64, 14, 88, 40); c.quadraticCurveTo(64, 30, 40, 40); c.fill(); }
    });
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    const g = new THREE.PlaneGeometry(1.6, 1.0, 8, 3); g.translate(0.8, -0.5, 0);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 3) * 0.08);
    g.computeVertexNormals();
    return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.9 }));
  }
  function flagPole(x, z, design, color, K) {
    const Md = M(), g = new THREE.Group();
    g.add(vmesh([Md.xf(Md.paint(new THREE.CylinderGeometry(0.06, 0.08, 5, 7), 0x5a4028), 0, 2.5, 0)]));
    const f = flagCloth(design, color); f.position.set(0.05, 4.9, 0); g.add(f);
    K.track(place(g, x, z, 0.6)); K.circle(x, z, 0.3);
  }
  function crates(x, z, rot, K, n = 3) {
    const Md = M(), r = U.rng(Math.round(x * 13 + z * 7)), p = [];
    for (let i = 0; i < n; i++) {
      const bx = (r() - 0.5) * 1.6, bz = (r() - 0.5) * 1.6;
      if (r() < 0.5) p.push(Md.xf(Md.paint(new THREE.BoxGeometry(0.7, 0.6, 0.7), (px, py) => (Math.abs(py) > 0.25 ? 0x5a4028 : 0x8a6a44)), bx, 0.3, bz, 0, r() * 3, 0));
      else p.push(Md.xf(Md.lathe([[0.001, 0], [0.3, 0], [0.36, 0.4], [0.3, 0.8], [0.001, 0.8]], 12, (px, py) => (Math.abs(py - 0.2) < 0.03 || Math.abs(py - 0.6) < 0.03 ? 0x3a3a3a : 0x7a5634)), bx, 0, bz));
    }
    K.track(place(vmesh(p), x, z, rot)); K.circle(x, z, 1.1);
  }
  function tent(x, z, rot, color, K) {
    const Md = M(), g = new THREE.Group();
    const cloth = new THREE.Mesh(Md.xf(Md.paint(new THREE.ConeGeometry(2, 2.3, 4, 1, true), (px, py, pz) => (Math.abs(Math.sin(Math.atan2(pz, px) * 8)) > 0.97 ? 0x5a4a3a : color)), 0, 1.15, 0, 0, Math.PI / 4, 0), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }));
    cloth.castShadow = true; g.add(cloth);
    g.add(vmesh([Md.xf(Md.paint(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 5), 0x5a4028), 0, 1.3, 0), Md.xf(Md.paint(new THREE.BoxGeometry(1.6, 0.05, 1.0), 0x8a3a2a), 0, 0.03, 0.2)]));
    K.track(place(g, x, z, rot)); K.circle(x, z, 1.6);
  }
  function loot(id, x, z, g, name, prompt) {
    const L = G.Landmarks, y = H(x, z);
    if (g) G.Landmarks.kit().track(place(g, x, z, 0));
    L.loot.push({ id, kind: 'clue', x, y, z, g, opened: false, extra: true, hitR: 0.9, name, prompt });
  }

  Pr.build = function () {
    const K = G.Landmarks.kit(), Md = M(), Wd = G.World, Wr = Wd.WRECK, r = U.rng(4242);
    // Campamento de la tripulación: fogata, tiendas, cajas del barco y la bandera de la Gaviota Errante
    const C = Pr.CREW;
    K.firePit(C.x, C.z, true);
    tent(C.x - 6, C.z + 5, 0.4, 0xd8ccb0, K); tent(C.x + 4, C.z - 6.5, -0.6, 0xc8bca0, K);
    crates(C.x - 2, C.z - 7, 0.3, K); crates(C.x + 7.5, C.z + 4, 1.2, K, 2);
    flagPole(C.x + 1, C.z + 9.5, null, '#c8322a', K);
    K.track(place(vmesh([Md.xf(Md.paint(new THREE.BoxGeometry(1.6, 0.05, 0.8), 0x9a8a6a), 0, 0.03, 0), Md.xf(Md.paint(new THREE.BoxGeometry(1.6, 0.05, 0.8), 0x8a7a5a), 0, 0.03, 1.1)]), C.x - 3, C.z - 2.5, 0.8));
    // Choza de Silvano junto al lago: cabaña, tendedero de hierbas y antorchas
    const Hh = Pr.HUT;
    K.hut(Hh.x, Hh.z, Math.atan2(G.World.LAKE.x - Hh.x, G.World.LAKE.z - Hh.z), 2.3, 2.3, r, false);
    K.dryingRack(Hh.x + 3.5, Hh.z - 3, 0.9);
    K.tikiTorch(Hh.x + 3, Hh.z + 3.5); K.tikiTorch(Hh.x - 3.2, Hh.z + 3);
    // Campamento pirata: empalizada, tiendas rojas y negras, fogata, bandera y botín
    const P = Pr.PIRATES;
    K.firePit(P.x, P.z, true);
    tent(P.x - 6, P.z - 4, 0.8, 0x8a2020, K); tent(P.x + 5, P.z - 6, -0.4, 0x2a2a2e, K); tent(P.x - 4, P.z + 6.5, 2.2, 0x8a2020, K);
    crates(P.x + 6, P.z + 4, 0.5, K); crates(P.x - 8.5, P.z + 1, 0.2, K, 2);
    flagPole(P.x + 2, P.z - 10, 'espadas', null, K);
    K.tikiTorch(P.x + 9, P.z - 2); K.tikiTorch(P.x - 2, P.z + 10);
    const posts = [];
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      if (Math.abs(U.angDiff(a, Math.atan2(Pr.CREW.x - P.x, Pr.CREW.z - P.z))) < 0.5) continue; // entrada mirando al interior de la isla
      const x = P.x + Math.sin(a) * 14, z = P.z + Math.cos(a) * 14, hh = 2 + r() * 0.6;
      posts.push(Md.xf(Md.paint(new THREE.CylinderGeometry(0.14, 0.17, hh, 6), 0x5a4028), x - P.x, H(x, z) - H(P.x, P.z) + hh / 2, z - P.z), Md.xf(Md.paint(new THREE.ConeGeometry(0.15, 0.4, 6), 0x4a3020), x - P.x, H(x, z) - H(P.x, P.z) + hh + 0.2, z - P.z));
      K.circle(x, z, 0.35);
    }
    K.track(place(vmesh(posts), P.x, P.z));
    // Pista 1: ancla oxidada clavada junto al viejo naufragio (con una cajita de hojalata)
    const ax = Wr.x + Math.cos(Wr.rot) * -7 + Math.sin(Wr.rot) * 3, az = Wr.z - Math.sin(Wr.rot) * -7 + Math.cos(Wr.rot) * 3;
    Pr.CLUE1 = { x: ax, z: az };
    const anchor = new THREE.Group();
    anchor.add(vmesh([Md.xf(Md.paint(new THREE.CylinderGeometry(0.07, 0.07, 1.7, 6), 0x4a3e36), 0, 0.7, 0, 0, 0, 0.25), Md.xf(Md.paint(new THREE.TorusGeometry(0.16, 0.05, 6, 12), 0x4a3e36), -0.22, 1.55, 0, 0, 0, 0.25),
      Md.tube([[-0.6, 0.15, 0], [-0.3, -0.05, 0], [0.2, -0.05, 0], [0.55, 0.2, 0]], [0.06, 0.05], 6, 0x4a3e36, 12), Md.xf(Md.paint(new THREE.BoxGeometry(0.3, 0.14, 0.2), 0x9aa0a6), 0.45, 0.07, 0.35)]));
    loot('p:clue1', ax, az, anchor, 'Ancla oxidada', () => (F().clue1 ? '⚓ <b>Ancla oxidada</b> · ya la revisaste' : '⚓ <b>Ancla oxidada</b> · <kbd>E</kbd> Revisar'));
    // Pista 2: piedra con una calavera tallada en la orilla del lago
    const L0 = G.World.LAKE;
    let lx = L0.x + L0.r + 3, lz = L0.z;
    for (let a = 0; a < 6.28; a += 0.2) { const x = L0.x + Math.cos(a) * (L0.r + 3.5), z = L0.z + Math.sin(a) * (L0.r + 3.5); if (!G.World.inLakeWater(x, z) && H(x, z) > L0.level && Math.hypot(x - Pr.HUT.x, z - Pr.HUT.z) > 18) { lx = x; lz = z; break; } }
    Pr.CLUE2 = { x: lx, z: lz };
    const stone = new THREE.Group();
    stone.add(vmesh([Md.xf(Md.paint(new THREE.DodecahedronGeometry(0.9), 0x7a766c, 0.08), 0, 0.55, 0, 0, 0, 0, [1.2, 0.9, 1]), Md.ball(0.26, 0xe8e2d0, 0, 0.75, 0.82, [1, 1.1, 0.5]), Md.ball(0.06, 0x1a1a1a, 0.09, 0.8, 0.94), Md.ball(0.06, 0x1a1a1a, -0.09, 0.8, 0.94), Md.xf(Md.paint(new THREE.BoxGeometry(0.16, 0.08, 0.05), 0xe8e2d0), 0, 0.55, 0.92)], G.Landmarks.kit().mats().vcFlat));
    stone.rotation.y = Math.atan2(L0.x - lx, L0.z - lz) + Math.PI;
    loot('p:clue2', lx, lz, stone, 'Piedra de la calavera', () => (F().clue2 ? '💀 <b>Piedra de la calavera</b> · ya la revisaste' : '💀 <b>Piedra de la calavera</b> · <kbd>E</kbd> Revisar'));
    G.Landmarks.kit().circle(lx, lz, 1.0);
    // Tesoro de Rogan: palmera torcida, roca de la gaviota y una ✖ que aparece al tener las 3 pistas
    const T = Pr.TREASURE, tg = new THREE.Group();
    tg.add(vmesh([Md.tube([[0, 0, 0], [0.4, 1.8, 0.1], [1.4, 3.4, 0.3], [2.8, 4.2, 0.5]], [0.2, 0.12], 7, (t) => (Math.sin(t * 60) > 0.6 ? 0x6a4a2c : 0x8a6a44), 20),
      ...[0, 1, 2, 3, 4, 5].map((i) => Md.xf(Md.fin([[0, 0], [0.9, 0.25], [1.9, 0.05], [0.9, -0.12]], 0.02, 0x3a7a2a), 2.8, 4.2, 0.5, 0.2, (i / 6) * Math.PI * 2, -0.5)),
      Md.xf(Md.paint(new THREE.DodecahedronGeometry(0.8), 0x8a857c, 0.08), -2.5, 0.4, 1.5, 0, 0, 0, [1.3, 0.8, 1]), Md.ball(0.18, 0xf2ece0, -2.5, 1.1, 1.5, [1.4, 0.8, 0.8]), Md.xf(Md.paint(new THREE.ConeGeometry(0.05, 0.14, 5), 0xe8b030), -2.3, 1.12, 1.5, 0, 0, -Math.PI / 2)], G.Landmarks.kit().mats().vc));
    const xm = vmesh([Md.xf(Md.paint(new THREE.BoxGeometry(1.5, 0.06, 0.18), 0x3a2416), 0, 0.04, 0, 0, 0.78, 0), Md.xf(Md.paint(new THREE.BoxGeometry(1.5, 0.06, 0.18), 0x3a2416), 0, 0.05, 0, 0, -0.78, 0)]);
    xm.visible = false; tg.add(xm); Pr.xMark = xm;
    const chest = vmesh([Md.xf(Md.paint(new THREE.BoxGeometry(0.9, 0.5, 0.6), (x, y) => (Math.abs(y) > 0.2 ? 0xc8a040 : 0x6a4428)), 0, 0.25, 0), Md.xf(Md.paint(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 12, 1, false, 0, Math.PI), 0x7a5230), 0, 0.5, 0, 0, 0, Math.PI / 2)]);
    chest.visible = false; tg.add(chest); Pr.chestMesh = chest;
    loot('p:treasure', T.x, T.z, tg, 'Cofre de Rogan', () => (F().treasure ? '🗝️ Aquí estaba el <b>cofre de Rogan</b>' : Pr.clues() >= 3 ? '✖ <b>Aquí marca el mapa de Rogan</b> · <kbd>E</kbd> Cavar' : ''));
    G.Landmarks.kit().circle(T.x + 0, T.z, 0.2);
  };
  // Solo se puede interactuar con la ✖ al tener las tres pistas
  Pr.visible = (c) => c.id !== 'p:treasure' || Pr.clues() >= 3 || F().treasure;

  // ------------------------------------------------------------------ apariciones (desde creatures.js)
  Pr.manage = function (tg, spawn) {
    if (!Pr.active()) return;
    const f = F(), list = G.Creatures.list;
    const nearAny = (x, z, d) => tg.some((t) => !t.dead && Math.hypot(t.x - x, t.z - z) < d);
    Pr.NPCS.forEach((n, k) => {
      if (list.some((c) => c.type === 'npc' && c.extra === k)) return;
      let home = HOME[k](), hx0 = home.x + HOME_OFF[k][0], hz0 = home.z + HOME_OFF[k][1];
      // Silvano espera junto al náufrago en la playa hasta que hablas con él
      if (k === 0 && !f.metHermit) { const S = G.World.spawn; hx0 = S.x + Math.sin(S.yaw) * 3 + 1.5; hz0 = S.z + Math.cos(S.yaw) * 3; }
      if (!nearAny(hx0, hz0, 160)) return;
      const c = spawn('npc', hx0, hz0, undefined, k);
      c.hx = hx0; c.hz = hz0; c.homeR = k === 0 ? 3 : 2.5;
    });
    Pr.DUMMIES.forEach((d, k) => {
      if (list.some((c) => c.type === 'dummy' && c.extra === k)) return;
      const a = d.at(), x = a.x + d.off[0], z = a.z + d.off[1];
      if (!nearAny(x, z, 150)) return;
      const c = spawn('dummy', x, z, undefined, k);
      c.yaw = Math.atan2(a.x - x, a.z - z);
    });
    // Piratas: 3 con sable, 2 tiradores y la capitana (hasta que la derrotes). Después vuelven de a poco.
    const P = Pr.PIRATES;
    if (!nearAny(P.x, P.z, 170)) return;
    const alive = (t) => list.filter((c) => c.type === t && !c.dead).length;
    const far = !nearAny(P.x, P.z, 45);
    if (!f.pirateBoss && !list.some((c) => c.type === 'pirate_boss') && (far || !Pr.bossOnce)) { Pr.bossOnce = true; const c = spawn('pirate_boss', P.x + 1, P.z + 2, undefined, 99); c.hx = P.x; c.hz = P.z; c.homeR = 5; }
    const want = f.pirateBoss ? [2, 1] : [3, 2];
    setTimeout(() => (Pr.crewOnce = true), 0);
    for (const [t, n] of [['pirate', want[0]], ['pirate_gun', want[1]]]) {
      // Con el jugador lejos del campamento (para que no aparezcan delante de él), o la primera vez
      if (alive(t) >= n || (!far && Pr.crewOnce)) continue;
      const a = Math.random() * Math.PI * 2, x = P.x + Math.cos(a) * 7, z = P.z + Math.sin(a) * 7;
      const c = spawn(t, x, z, undefined, Math.floor(Math.random() * 1000));
      c.hx = P.x; c.hz = P.z; c.homeR = 10;
    }
  };

  // ------------------------------------------------------------------ diálogos
  const show = (who, text, options) => G.Story.show({ who, text, options });
  // Cadena de diálogos: [[quién, texto, botón], ...] y al final fn
  function chain(lines, fn) {
    const step = (i) => {
      const [who, text, btn] = lines[i];
      if (i === lines.length - 1) { show(who, text, [[btn || 'Continuar', fn || null]]); return; }
      show(who, text, [[btn || 'Continuar', () => step(i + 1)]]);
    };
    step(0);
  }
  Pr.talk = function (c) {
    const n = Pr.NPCS[c.extra % Pr.NPCS.length], f = F();
    G.Audio.play('talk');
    if (n.role === 'hermit') return hermit(c, f);
    if (n.role === 'captain') return captain(c, f);
    return trainer(c, n, f);
  };
  function hermit(c, f) {
    const who = 'Silvano, el ermitaño', S = G.LINES.silvano;
    if (!f.metHermit) {
      chain([
        [who, S.meet[0], '«¿Dónde estoy?»'],
        [who, S.meet[1], '«Tengo que encontrarlos.»'],
        [who, S.meet[2], '«¿Una Fruta del Abismo?»'],
        [who, S.meet[3], '«¿Por dónde empiezo?»'],
        [who, S.meet[4], 'Gracias, viejo'],
      ], () => {
        f.metHermit = 1; sync();
        G.UI.banner('La Fruta de Rogan', 'Sobrevive, encuentra a tu tripulación y sigue las pistas');
        const c0 = G.Creatures.list.find((x) => x.type === 'npc' && x.extra === 0);
        if (c0) { c0.hx = Pr.HUT.x + HOME_OFF[0][0]; c0.hz = Pr.HUT.z + HOME_OFF[0][1]; }
      });
      return;
    }
    if (!G.Styles.learned('magic')) {
      show(who, S.teach, [['«Enséñame.»', () => {
        G.Styles.learn('magic'); giveOnce('baston');
        startTrain('magic');
        show(who, S.how);
      }], ['«Ahora no.»', null]]);
      return;
    }
    if (trainPending('magic')) { show(who, `${S.train} (Te faltan ${trainLeft('magic')} chispas.)`); return; }
    const clues = Pr.clues();
    const lines = [clues < 3 ? S.clues[clues] : f.treasure ? S.fruit : S.dig].concat(S.tips);
    show(who, lines[Math.floor(Math.random() * lines.length)]);
  }
  function captain(c, f) {
    const who = 'Capitana Mara', M = G.LINES.mara;
    if (!f.metCrew) {
      chain([
        [who, M.meet[0], '«¿Qué pasó con el barco?»'],
        [who, M.meet[1], '«¿Cómo la encontramos?»'],
        [who, M.meet[2], '«¿La Hiena?»'],
        [who, M.meet[3], 'A la orden, capitana'],
      ], () => { f.metCrew = 1; sync(); G.UI.banner('Las pistas de Rogan', 'Aprende a pelear y encuentra las 3 pistas'); });
      return;
    }
    const clues = Pr.clues();
    if (f.treasure) { show(who, M.treasure); return; }
    if (clues >= 3) { show(who, M.clues3); return; }
    if (!f.clue1) { show(who, M.clue1); return; }
    if (!f.clue2) { show(who, M.clue2); return; }
    show(who, M.clue3[G.Styles.any() ? 1 : 0]);
  }
  function trainer(c, n, f) {
    const k = n.style, D = G.Styles.DEF[k], who = n.name.split(',')[0], T = G.LINES[n.key];
    if (!G.Styles.learned(k)) {
      show(who, T.intro, [[`«Enséñame.» (${D.icon} ${D.name})`, () => {
        G.Styles.learn(k);
        if (k === 'sword') giveOnce('katana');
        if (k === 'gun') { giveOnce('pistola'); G.Game.give('bala', 15); }
        startTrain(k);
        show(who, T.how);
      }], ['«Ahora no.»', null]]);
      return;
    }
    if (trainPending(k)) { show(who, `${T.train} (Te faltan ${trainLeft(k)}.)`); return; }
    const pool = T.tips;
    show(who, pool[Math.floor(Math.random() * pool.length)]);
  }
  // Entrega un arma solo si no la tienes ya
  function giveOnce(id) { if (G.Inv.count(id) <= 0 && !G.Inv.SLOTS.some((s) => G.Inv.equip[s] && G.Inv.equip[s].id === id)) G.Game.give(id, 1); }

  // ------------------------------------------------------------------ entrenamiento con los muñecos
  const trainState = () => (G.state.train = G.state.train || {});
  function startTrain(k) { const t = trainState(); if (!t[k]) t[k] = { n: 0, done: false }; }
  const trainPending = (k) => { const t = trainState()[k]; return t && !t.done; };
  const trainLeft = (k) => { const t = trainState()[k]; return t ? Math.max(0, TRAIN[k] - t.n) : TRAIN[k]; };
  // Golpe con un estilo a un muñeco (desde styles.js)
  Pr.onTrain = function (c, k) {
    const D = Pr.DUMMIES[c.extra % Pr.DUMMIES.length];
    if (D.style !== k) return;
    const t = trainState()[k];
    if (!t || t.done) return;
    t.n++;
    if (t.n < TRAIN[k]) { if (t.n % 2 === 0 || TRAIN[k] - t.n <= 2) G.UI.msg(`🎯 Entrenamiento: ${t.n}/${TRAIN[k]}`, 'info', 'train'); return; }
    t.done = true;
    G.Styles.addXp(k, 45);
    const gift = { sword: ['venda', 2], gun: ['bala', 15], fist: ['brocheta', 3], magic: ['infusion', 2] }[k];
    G.Game.give(gift[0], gift[1]);
    const master = Pr.NPCS.find((n) => n.style === k);
    const done = master ? G.LINES[master.key].done : '«Buen trabajo. Ya estás listo.»';
    G.UI.banner('¡Entrenamiento completado!', `${master ? master.name.split(',')[0] + ': ' : ''}${done}`);
    if (master) G.Voice.say(master.key, done);
    G.Audio.play('win');
  };

  // ------------------------------------------------------------------ pistas y tesoro
  Pr.interact = function (c) {
    const f = F();
    if (c.id === 'p:clue1' || c.id === 'p:clue2') {
      const k = c.id === 'p:clue1' ? 'clue1' : 'clue2', item = c.id === 'p:clue1' ? 'pista_1' : 'pista_2';
      if (G.Inv.count(item) > 0) { G.UI.msg('Ya tienes esta pista (clic derecho sobre ella para leerla).', 'info', 'clue'); return; }
      G.Story.show({ who: c.id === 'p:clue1' ? '⚓ Ancla oxidada' : '💀 Piedra de la calavera',
        text: c.id === 'p:clue1' ? G.LINES.narrador.ancla : G.LINES.narrador.calavera,
        options: [['Coger el pergamino', () => {
          G.Game.give(item, 1);
          if (!f[k]) { f[k] = 1; sync(); }
          G.Audio.play('mono');
          Pr.readClue(item);
        }]] });
      return;
    }
    if (c.id === 'p:treasure') {
      if (f.treasure) { G.UI.msg('Aquí ya no queda nada.', 'info', 'clue'); return; }
      if (Pr.clues() < 3) return;
      if (G.Net.active && !G.Net.isHost) { G.Net.send({ t: 'prDig' }); G.UI.msg('⛏️ Cavando…', 'info'); return; }
      dig(G.Net.myId);
    }
  };
  function dig(who) {
    const f = F();
    if (f.treasure) return;
    f.treasure = 1;
    G.Audio.play('chop');
    const w = W();
    let k = Object.keys(G.Story.FRUITS).find((q) => w.fruits[q] && w.fruits[q].at === 'rogan');
    if (!k) k = Object.keys(G.Story.FRUITS).find((q) => w.fruits[q] && w.fruits[q].at && !G.state.world.loot[w.fruits[q].at]);
    if (k) w.fruits[k] = { found: 1 };
    sync();
    const items = [['doblon', 6], ['perla', 2]].concat(k ? [[G.Story.FRUITS[k].item, 1]] : []);
    const give = () => {
      if (Pr.chestMesh) Pr.chestMesh.visible = true;
      if (!G.Net.active || who === G.Net.myId) {
        for (const [id, n] of items) G.Game.give(id, n);
        G.Ach.add('rogan');
        G.UI.banner('¡El tesoro de Rogan!', k ? `Una Fruta del Abismo: ${G.Story.FRUITS[k].icon} ${G.Story.FRUITS[k].name}` : 'Oro y perlas del Rey de las Mareas');
        G.Audio.play('win');
      } else G.Net.send({ t: 'give', to: who, items, loot: true });
      G.Net.send({ t: 'prTreasure' });
    };
    if (!G.Net.active || who === G.Net.myId) G.UI.fade(give); else give();
  }
  Pr.readClue = function (item) {
    G.Story.show({ who: '📜 Pista de Rogan', text: G.LINES.rogan[item] });
    if (Pr.clues() >= 3 && !F().treasure) setTimeout(() => G.UI.banner('✖ El cofre de Rogan', 'Está marcado en tu mapa (M): costa sur, junto a la palmera torcida'), 1500);
  };
  // Objetos que dan pistas (la tercera la suelta la capitana Hiena)
  Pr.onItem = function (id) {
    if (id !== 'pista_3') return;
    const f = F();
    if (!f.clue3) { f.clue3 = 1; sync(); }
    setTimeout(() => Pr.readClue('pista_3'), 900);
  };
  Pr.onBossKilled = function () { const f = F(); f.pirateBoss = 1; sync(); };
  Pr.onNet = function (m, from) {
    if (m.t === 'prDig' && G.Net.isHost) dig(from);
    if (m.t === 'prTreasure' && Pr.chestMesh) Pr.chestMesh.visible = true;
  };

  // ------------------------------------------------------------------ objetivos, brújula y mapa
  // Destino del objetivo actual del prólogo (se muestra aunque no tengas el Log de Mareas)
  Pr.target = function (id) {
    const f = F();
    const npcPos = (k) => { const c = G.Creatures.list.find((x) => x.type === 'npc' && x.extra === k); return c ? { x: c.x, z: c.z } : null; };
    if (id === 'hermit') { const p = npcPos(0) || G.World.spawn; return { x: p.x, z: p.z, name: 'Silvano', free: true }; }
    if (id === 'crew') return { x: Pr.CREW.x, z: Pr.CREW.z, name: 'Tu tripulación', free: true };
    if (id === 'style') { const p = npcPos(2) || Pr.CREW; return { x: p.x, z: p.z, name: 'Maestros de combate', free: true }; }
    if (id === 'clues') {
      if (!f.clue1) return { x: Pr.CLUE1.x, z: Pr.CLUE1.z, name: 'Ancla oxidada', free: true };
      if (!f.clue2) return { x: Pr.CLUE2.x, z: Pr.CLUE2.z, name: 'Piedra de la calavera', free: true };
      return { x: Pr.PIRATES.x, z: Pr.PIRATES.z, name: 'Campamento pirata', free: true };
    }
    if (id === 'dig') return { x: Pr.TREASURE.x, z: Pr.TREASURE.z, name: '✖ Cofre de Rogan', free: true };
    return null;
  };
  Pr.drawMap = function (ctx, toPx, full) {
    if (!Pr.active() || !G.state.world) return;
    const f = F(), w = W();
    const mark = (p, icon) => { const [x, y] = toPx(p.x, p.z); ctx.font = `${full ? 16 : 12}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText(icon, x, y + 5); };
    if (f.metCrew || f.metHermit) mark(Pr.CREW, '⛺');
    if (f.metHermit) mark(Pr.HUT, '🛖');
    if (f.metCrew) { mark(Pr.PIRATES, '☠️'); if (!f.clue1) mark(Pr.CLUE1, '⚓'); if (!f.clue2) mark(Pr.CLUE2, '💀'); }
    if (Pr.clues() >= 3 && !f.treasure) { const [x, y] = toPx(Pr.TREASURE.x, Pr.TREASURE.z); ctx.strokeStyle = '#d02020'; ctx.lineWidth = full ? 4 : 3; const s = full ? 8 : 6; ctx.beginPath(); ctx.moveTo(x - s, y - s); ctx.lineTo(x + s, y + s); ctx.moveTo(x + s, y - s); ctx.lineTo(x - s, y + s); ctx.stroke(); }
    void w;
  };
  Pr.update = function () {
    if (Pr.xMark) Pr.xMark.visible = Pr.clues() >= 3 && !F().treasure;
    if (Pr.chestMesh && F().treasure) Pr.chestMesh.visible = true;
  };

  registerNpcCosmetics();
})();
