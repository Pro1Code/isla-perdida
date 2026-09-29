// Animales de todas las islas y del mar, más los aldeanos de la tribu Shandara.
// Cada isla tiene su fauna; solo se simulan las islas (y el mar) donde hay jugadores cerca.
// En multijugador el anfitrión simula la IA y los demás solo interpolan lo que reciben.
(function () {
  'use strict';
  const G = window.G, U = G.U;
  const C = (G.Creatures = { list: [], timer: 0, nextId: 0 });
  const TYPES = ['crab', 'boar', 'wolf', 'snake', 'jaguar', 'shark', 'boss', 'bear', 'snowwolf', 'seal', 'monkey', 'caiman', 'frog', 'salamander', 'lavacrab', 'whale', 'dolphin', 'jelly', 'serpent', 'villager', 'npc', 'dummy', 'pirate', 'pirate_gun', 'pirate_boss', 'marine', 'marine_gun', 'marine_boss', 'ghost_pirate', 'ghost_gun', 'ghost_captain', 'yeti', 'lavadragon', 'aldeano', 'bigcaiman', 'corsair', 'corsair_gun', 'corsair_captain'];
  const BOSS_MAX = 6.6; // velocidad máxima de cualquier jefe (el jugador esprinta a 7,2)
  const DEF = (C.DEF = {
    crab: { name: 'Cangrejo', hp: 12, speed: 0.8, run: 2.6, bodyY: 0.2, hitR: 0.5, drops: [['carne_cruda', 1]] },
    boar: { name: 'Jabalí', hp: 45, speed: 1.1, run: 4.8, bodyY: 0.7, hitR: 0.8, dmg: 10, drops: [['carne_cruda', 3], ['cuero', 1]] },
    wolf: { name: 'Lobo', hp: 38, speed: 1.5, run: 5.8, bodyY: 0.85, hitR: 0.75, dmg: 12, drops: [['carne_cruda', 2], ['cuero', 1]] },
    snake: { name: 'Serpiente', hp: 14, speed: 0.5, run: 1.8, bodyY: 0.1, hitR: 0.55, dmg: 6, poison: 22, drops: [['carne_cruda', 1]] },
    jaguar: { name: 'Jaguar', hp: 60, speed: 1.4, run: 6.3, bodyY: 0.7, hitR: 0.8, dmg: 16, drops: [['cuero', 2], ['carne_cruda', 3]] },
    shark: { name: 'Tiburón', hp: 55, speed: 2.4, run: 5.4, bodyY: -0.1, hitR: 1.0, dmg: 20, sea: true, drops: [['pez_crudo', 4]] },
    boss: { name: 'Jabalí gigante', hp: 260, speed: 1.0, run: 5.6, bodyY: 1.3, hitR: 1.5, dmg: 26, boss: true, drops: [['cuero', 5], ['carne_cruda', 8], ['colmillo', 1]] },
    bear: { name: 'Oso blanco', hp: 130, speed: 0.9, run: 3.8, bodyY: 1.0, hitR: 1.1, dmg: 22, drops: [['piel_gruesa', 2], ['carne_cruda', 5]] },
    snowwolf: { name: 'Lobo de las nieves', hp: 42, speed: 1.5, run: 6.0, bodyY: 0.85, hitR: 0.75, dmg: 13, drops: [['piel_gruesa', 1], ['carne_cruda', 2]] },
    seal: { name: 'Foca', hp: 30, speed: 0.4, run: 1.6, bodyY: 0.35, hitR: 0.8, drops: [['grasa', 2], ['carne_cruda', 2]] },
    monkey: { name: 'Mono', hp: 18, speed: 1.5, run: 5.6, bodyY: 0.5, hitR: 0.55, drops: [['carne_cruda', 1]] },
    caiman: { name: 'Caimán', hp: 75, speed: 0.6, run: 3.4, bodyY: 0.3, hitR: 1.0, dmg: 18, drops: [['cuero', 2], ['carne_cruda', 3]] },
    frog: { name: 'Rana venenosa', hp: 6, speed: 0.6, run: 2.4, bodyY: 0.1, hitR: 0.4, drops: [['veneno', 1]] },
    salamander: { name: 'Salamandra de fuego', hp: 20, speed: 0.9, run: 3.4, bodyY: 0.15, hitR: 0.55, dmg: 7, drops: [['carne_cruda', 1], ['azufre', 1]] },
    lavacrab: { name: 'Cangrejo de lava', hp: 55, speed: 0.7, run: 2.6, bodyY: 0.35, hitR: 0.9, dmg: 12, drops: [['carne_cruda', 2], ['obsidiana', 1]] },
    whale: { name: 'Ballena', hp: 600, speed: 1.6, run: 3.0, bodyY: -0.6, hitR: 3.6, sea: true, drops: [['grasa', 8], ['carne_cruda', 10]] },
    dolphin: { name: 'Delfín', hp: 40, speed: 4.0, run: 7.5, bodyY: -0.1, hitR: 0.9, sea: true, drops: [['pez_crudo', 2]] },
    jelly: { name: 'Medusa', hp: 8, speed: 0.3, run: 0.5, bodyY: -0.3, hitR: 0.6, dmg: 8, poison: 10, sea: true, drops: [] },
    serpent: { name: 'Serpiente marina', hp: 200, speed: 3.0, run: 6.4, bodyY: 0.6, hitR: 1.8, dmg: 30, shipDmg: 26, sea: true, drops: [['cuero', 4], ['pez_crudo', 6]] },
    villager: { name: 'Aldeano shandara', hp: 70, speed: 1.1, run: 4.4, bodyY: 1.0, hitR: 0.55, dmg: 11, npc: true, drops: [] },
    // Aldeanos de los Kyrr (Escarcha) y de Ceniza (Brasa): gente de paz
    aldeano: { name: 'Aldeano', hp: 70, speed: 1.0, run: 3.0, bodyY: 1.0, hitR: 0.55, npc: true, friendly: true, drops: [] },
    // Prólogo de la Isla Perdida (prologue.js): tripulación, muñecos de entrenamiento y piratas
    npc: { name: 'Náufrago', hp: 1000, speed: 1.0, run: 2.4, bodyY: 1.0, hitR: 0.55, npc: true, friendly: true, drops: [] },
    dummy: { name: 'Muñeco de entrenamiento', hp: 9999, speed: 0, run: 0, bodyY: 1.1, hitR: 0.55, dummy: true, drops: [] },
    pirate: { name: 'Pirata de la Hiena', hp: 60, speed: 1.1, run: 4.3, bodyY: 1.0, hitR: 0.55, dmg: 9, human: true, drops: [['doblon', 1], ['cuero', 1]] },
    pirate_gun: { name: 'Pirata tirador', hp: 45, speed: 1.0, run: 3.8, bodyY: 1.0, hitR: 0.55, dmg: 11, human: true, drops: [['polvora', 1], ['bala', 4]] },
    marine: { name: 'Marine de la Marina Blanca', hp: 70, speed: 1.1, run: 4.3, bodyY: 1.0, hitR: 0.55, dmg: 11, human: true, drops: [['doblon', 1], ['bala', 3]] },
    marine_gun: { name: 'Tirador de la Marina', hp: 55, speed: 1.0, run: 3.8, bodyY: 1.0, hitR: 0.55, dmg: 12, human: true, drops: [['polvora', 1], ['bala', 5]] },
    // Jefes de isla (bosses.js): el yeti de la cueva de hielo y el dragón del volcán
    yeti: { name: 'Rey de la Escarcha', hp: 650, speed: 1.2, run: 4.6, bodyY: 1.9, hitR: 1.2, dmg: 26, bigBoss: true, drops: [['piel_gruesa', 6], ['cristal_hielo', 8], ['mineral_plata', 6], ['doblon', 20], ['mapa_tesoro', 1]] },
    lavadragon: { name: 'Dragón de Brasa', hp: 850, speed: 1.3, run: 5.0, bodyY: 1.7, hitR: 1.4, dmg: 28, bigBoss: true, drops: [['obsidiana', 8], ['azufre', 8], ['carbon', 10], ['doblon', 30], ['mapa_tesoro', 1]] },
    bigcaiman: { name: 'Gran Caimán del río', hp: 720, speed: 1.2, run: 4.2, bodyY: 0.7, hitR: 1.2, dmg: 26, bigBoss: true, drops: [['cuero', 8], ['carne_cruda', 10], ['colmillo', 2], ['doblon', 25], ['mapa_tesoro', 1]] },
    ghost_pirate: { name: 'Pirata fantasma', hp: 60, speed: 1.1, run: 4.4, bodyY: 1.0, hitR: 0.55, dmg: 12, human: true, drops: [['doblon', 2]] },
    ghost_gun: { name: 'Tirador fantasma', hp: 50, speed: 1.0, run: 3.8, bodyY: 1.0, hitR: 0.55, dmg: 13, human: true, drops: [['doblon', 2], ['polvora', 1]] },
    ghost_captain: { name: 'Capitán Van Bruma', hp: 380, speed: 1.1, run: 4.5, bodyY: 1.0, hitR: 0.6, dmg: 18, human: true, drops: [['doblon', 20], ['perla', 3], ['mapa_tesoro', 1]] },
    marine_boss: { name: 'Comodoro de la Marina Blanca', hp: 320, speed: 1.1, run: 4.4, bodyY: 1.0, hitR: 0.6, dmg: 16, human: true, drops: [['doblon', 10], ['katana', 1], ['mapa_tesoro', 1]] },
    pirate_boss: { name: 'Capitana Hiena', hp: 300, speed: 1.2, run: 4.6, bodyY: 1.0, hitR: 0.6, dmg: 15, human: true, drops: [['pista_3', 1], ['sable', 1], ['doblon', 6]] },
    // Piratas de las hermandades del mar (faction.js): van en la cubierta de sus barcos (navy.js)
    corsair: { name: 'Pirata', hp: 65, speed: 1.1, run: 4.3, bodyY: 1.0, hitR: 0.55, dmg: 11, human: true, drops: [['doblon', 2], ['bala', 3]] },
    corsair_gun: { name: 'Pirata tirador', hp: 50, speed: 1.0, run: 3.8, bodyY: 1.0, hitR: 0.55, dmg: 12, human: true, drops: [['polvora', 1], ['bala', 5]] },
    corsair_captain: { name: 'Capitán pirata', hp: 300, speed: 1.1, run: 4.4, bodyY: 1.0, hitR: 0.6, dmg: 16, human: true, drops: [['doblon', 12], ['sable', 1], ['mapa_tesoro', 1]] },
  });

  // Fauna de cada isla: [tipo, máximo, zona, probabilidad de aparición por intento]
  const FAUNA = {
    perdida: [['crab', 10, 'beach'], ['boar', 7, 'grass'], ['snake', 6, 'grass'], ['jaguar', 2, 'forest', 0.1]],
    tahuri: [['crab', 6, 'beach'], ['monkey', 6, 'forest'], ['caiman', 3, 'shore', 0.4], ['frog', 6, 'forest'], ['snake', 4, 'grass'], ['boar', 3, 'grass'], ['jaguar', 2, 'forest', 0.1]],
    escarcha: [['seal', 5, 'beach'], ['crab', 3, 'beach'], ['snowwolf', 3, 'land', 0.4], ['bear', 2, 'land', 0.15]],
    brasa: [['lavacrab', 5, 'land'], ['salamander', 6, 'land'], ['crab', 4, 'beach'], ['snake', 3, 'grass', 0.5]],
    ruinas: [['crab', 5, 'beach'], ['boar', 4, 'grass'], ['snake', 5, 'grass'], ['monkey', 4, 'forest'], ['jaguar', 1, 'forest', 0.1]],
    islote: [['crab', 3, 'beach']],
    arrecife: [],
  };
  C.FAUNA = FAUNA; // el recetario dice en qué islas vive cada animal
  C.VILLAGERS = [
    { name: 'Anciano Kalgor', role: 'chief', shirt: 0xb08a4a, pants: 0x6a4a2a },
    { name: 'Wypar', role: 'guard', shirt: 0x8a2a2a, pants: 0x3a2a1a },
    { name: 'Aisha', role: 'villager', shirt: 0x2a7a6a, pants: 0x5a4028, female: true },
    { name: 'Kamakiro', role: 'guard', shirt: 0x5a3a7a, pants: 0x3a2a1a },
    { name: 'Genbu', role: 'trader', shirt: 0xc8962a, pants: 0x4a3620 },
    { name: 'Laka', role: 'villager', shirt: 0x3a6aa0, pants: 0x5a4028, female: true },
    { name: 'Brahan', role: 'villager', shirt: 0x6a8a2a, pants: 0x3a2a1a },
  ];

  // Aldeanos de las otras aldeas (extra = posición en esta lista)
  C.ALDEANOS = [
    { tribe: 'escarcha', name: 'Anciana Hild', role: 'elder', shirt: 0x6a7a8a, pants: 0x4a4a52, skin: 0xe6c2a0, female: true, hair: 0xd8d4cc },
    { tribe: 'escarcha', name: 'Sigrun', role: 'villager', shirt: 0x8a3a3a, pants: 0x4a4038, skin: 0xf0d0b0, female: true, hair: 0xc89a4a },
    { tribe: 'escarcha', name: 'Toke', role: 'villager', shirt: 0x3a5a7a, pants: 0x3a3430, skin: 0xe8c4a0 },
    { tribe: 'escarcha', name: 'Bram', role: 'villager', shirt: 0x5a6a3a, pants: 0x3a3430, skin: 0xdcb48e },
    { tribe: 'brasa', name: 'Maestro Hollín', role: 'elder', shirt: 0x3a3230, pants: 0x2a2220, skin: 0xa8704a },
    { tribe: 'brasa', name: 'Tizón', role: 'villager', shirt: 0x8a2a1a, pants: 0x2a2220, skin: 0xb07a50 },
    { tribe: 'brasa', name: 'Ascua', role: 'villager', shirt: 0xc86a2a, pants: 0x3a2a20, skin: 0x9a6440 },
    { tribe: 'brasa', name: 'Chispa', role: 'villager', shirt: 0xd8a030, pants: 0x3a2a20, skin: 0xb88660, female: true },
  ];

  // ------------------------------------------------------------------ modelos (ver animals.js)
  // P(geometría, color, x, y, z, [rx, ry, rz], [sx, sy, sz]) → geometría coloreada y colocada
  function P(geo, color, x, y, z, rot, scl) {
    if (scl) geo.scale(scl[0], scl[1], scl[2]);
    if (rot) { geo.rotateX(rot[0]); geo.rotateY(rot[1]); geo.rotateZ(rot[2]); }
    geo.translate(x, y, z);
    return U.colored(geo, color, 0.04);
  }
  // Aldeano: personaje humano con tocado de plumas
  function villager(extra) {
    const v = C.VILLAGERS[extra % C.VILLAGERS.length] || C.VILLAGERS[0];
    const model = G.Character.create(v.shirt, { skin: 0x9a6440, pants: v.pants, female: !!v.female, hair: 0x1a1210 });
    const fm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
    const parts = [P(new THREE.TorusGeometry(0.1, 0.018, 6, 16), 0xc0302a, 0, 0.1, 0, [Math.PI / 2, 0, 0])];
    const n = v.role === 'chief' ? 9 : 4;
    for (let i = 0; i < n; i++) {
      const a = (i / (n - 1) - 0.5) * (v.role === 'chief' ? 2.4 : 1.2);
      parts.push(P(new THREE.ConeGeometry(0.025, 0.28, 4), i % 2 ? 0xf0e0b0 : 0x2a8a6a, Math.sin(a) * 0.1, 0.24, -Math.cos(a) * 0.1, [-0.3, a, 0], [1, 1, 0.3]));
    }
    const hd = new THREE.Mesh(U.merge(parts), fm);
    hd.castShadow = true;
    model.bones[4].add(hd);
    if (v.role === 'guard') {
      const sp = new THREE.Group();
      sp.add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, 1.7, 6), new THREE.MeshStandardMaterial({ color: 0x6a4a2c })));
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 4), new THREE.MeshStandardMaterial({ color: 0x1a1622, roughness: 0.2 }));
      tip.position.y = 0.95; sp.add(tip);
      sp.rotation.x = Math.PI / 2; sp.position.y = 0.2;
      model.hand.add(sp);
    }
    return { g: model.root, legs: [], head: null, model, vinfo: v, feathers: fm };
  }
  // Aldeano Kyrr (gorro de piel) o de Ceniza (pañuelo rojo tiznado); los ancianos llevan bastón
  function aldeano(extra) {
    const v = C.ALDEANOS[extra % C.ALDEANOS.length] || C.ALDEANOS[0];
    const model = G.Character.create(v.shirt, { skin: v.skin, pants: v.pants, female: !!v.female, hair: v.hair });
    const fm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
    const parts = v.tribe === 'escarcha'
      ? [P(new THREE.SphereGeometry(0.135, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), 0xd8d0c0, 0, 0.1, 0), P(new THREE.TorusGeometry(0.13, 0.035, 6, 14), 0xf0ece4, 0, 0.1, 0, [Math.PI / 2, 0, 0])]
      : [P(new THREE.TorusGeometry(0.115, 0.022, 6, 16), 0xa82a1a, 0, 0.12, 0, [Math.PI / 2, 0, 0]), P(new THREE.ConeGeometry(0.035, 0.18, 4), 0xa82a1a, 0, 0.08, 0.13, [0.9, 0, 0])];
    const hd = new THREE.Mesh(U.merge(parts), fm);
    hd.castShadow = true;
    model.bones[4].add(hd);
    if (v.role === 'elder') {
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 1.5, 6), new THREE.MeshStandardMaterial({ color: 0x5a4028 }));
      st.rotation.x = Math.PI / 2; st.position.y = 0.2;
      model.hand.add(st);
    }
    return { g: model.root, legs: [], head: null, model, vinfo: v, feathers: fm };
  }

  // ------------------------------------------------------------------ aparición
  const isl = (x, z) => G.Arch.landOf(x, z);
  // Serpiente marina: la cabeza va delante del centro del cuerpo; trozos del cuerpo [distancia, altura, radio]
  const SERP_HEAD = 7.4, SERP_BODY = [[SERP_HEAD, 0.8, 1.3], [4.2, 0.45, 1.0], [1.2, 0.45, 1.0], [-1.8, 0.4, 0.95], [-4.6, 0.35, 0.9]];
  // Punto de aguas más profundas cerca (para que un animal marino atascado se aleje de la costa)
  function deeper(c) {
    let best = null, bh = Infinity;
    for (const R of [16, 28]) for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2, x = c.x + Math.cos(a) * R, z = c.z + Math.sin(a) * R, h = G.height(x, z);
      if (h < bh && validPos(c.type, x, z)) { bh = h; best = { x, z }; }
    }
    return best || { x: c.x - Math.sin(c.yaw) * 20, z: c.z - Math.cos(c.yaw) * 20 };
  }
  function validPos(type, x, z) {
    const h = G.height(x, z);
    const d = DEF[type];
    if (d.sea) return h < (type === 'whale' ? -7 : type === 'serpent' ? -5 : type === 'jelly' ? -1.5 : -2.2);
    if (G.World.inLakeWater(x, z) || G.Landmarks.blocks(x, z)) return (type === 'caiman' || type === 'bigcaiman') && G.World.inLakeWater(x, z) && !G.Landmarks.blocks(x, z);
    if (type === 'crab' || type === 'seal') return h > -0.3 && h < 3.2;
    if (type === 'caiman') return h > -0.6;
    return h > 0.6;
  }
  function randomPoint(test, px, pz, minD, maxD, area) {
    for (let i = 0; i < 250; i++) {
      let x, z;
      if (maxD) { const a = Math.random() * Math.PI * 2, d = U.lerp(minD, maxD, Math.random()); x = px + Math.cos(a) * d; z = pz + Math.sin(a) * d; }
      else {
        const s = area || G.Arch.islands[0];
        x = s.x + (Math.random() * 2 - 1) * s.r * 1.12; z = s.z + (Math.random() * 2 - 1) * s.r * 1.12;
        if (Math.hypot(x - px, z - pz) < minD) continue;
      }
      if (test(G.height(x, z), x, z)) return { x, z };
    }
    return null;
  }
  const dry = (x, z) => !G.World.inLakeWater(x, z) && !G.Landmarks.blocks(x, z);
  const TESTS = {
    beach: (h, x, z) => h > 0.3 && h < 2.2 && dry(x, z),
    grass: (h, x, z) => h > 3.5 && h < 16 && dry(x, z),
    forest: (h, x, z) => h > 5 && h < 19 && dry(x, z),
    land: (h, x, z) => h > 1.5 && dry(x, z),
    shore: (h, x, z) => { const L = G.World.lakeAt(x, z); return (L && h < L.level + 0.4 && h > L.level - 1) || (h > 0.3 && h < 1.8 && dry(x, z)); },
  };
  const deepTest = (h) => h < -3.5;

  C.spawn = function (type, x, z, id, extra) {
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: type === 'shark' || type === 'dolphin' || type === 'whale' ? 0.5 : 0.9 });
    const A = G.Animals;
    // Animales: fauna.js (esqueleto y piel); aquí solo la medusa, las personas y los muñecos
    const build = {
      jelly: () => A.jelly(), villager: () => villager(extra || 0), aldeano: () => aldeano(extra || 0),
      npc: () => G.Prologue.human('npc', extra || 0), pirate: () => G.Prologue.human('pirate', extra || 0), pirate_gun: () => G.Prologue.human('pirate_gun', extra || 0),
      pirate_boss: () => G.Prologue.human('pirate_boss', extra || 0), marine: () => G.Prologue.human('marine', extra || 0), marine_gun: () => G.Prologue.human('marine_gun', extra || 0), marine_boss: () => G.Prologue.human('marine_boss', extra || 0), ghost_pirate: () => G.Prologue.human('ghost_pirate', extra || 0), ghost_gun: () => G.Prologue.human('ghost_gun', extra || 0), ghost_captain: () => G.Prologue.human('ghost_captain', extra || 0), dummy: () => G.Prologue.dummy(extra || 0),
      corsair: () => G.Prologue.human('corsair', extra || 0), corsair_gun: () => G.Prologue.human('corsair_gun', extra || 0), corsair_captain: () => G.Prologue.human('corsair_captain', extra || 0),
    };
    // Especies ya rehechas con esqueleto y piel realista (fauna.js); el resto, con los modelos de siempre
    const m = G.Fauna && G.Fauna.has(type) ? G.Fauna.build(type) : build[type]();
    const d = DEF[type];
    const s = G.Arch.landOf(x, z);
    const c = Object.assign(m, {
      id: id ?? ++C.nextId, type, d, mat: m.mat || mat, x, z, y: G.height(x, z), yaw: Math.random() * 6.28, hp: d.hp, tx: x, tz: z, t: 0, cd: 0,
      aggro: 0, aggroId: null, phase: 0, speedNow: 0, dead: false, deadT: 0, flash: 0, lunge: 0, fear: false, nx: x, nz: z, nyaw: 0,
      pounce: 0, rest: 0, circle: Math.random() * 6.28, lonely: 0, isl: s ? s.id : -1, extra: extra || 0, hx: x, hz: z, hopT: 0,
    });
    if (m.vinfo) { c.name = m.vinfo.name; c.role = m.vinfo.role; }
    if (m.ghostMats) c.ghostMats = m.ghostMats;
    if (m.joints) c.joints = m.joints;
    if (id !== undefined) C.nextId = Math.max(C.nextId, id);
    m.g.position.set(x, c.y, z);
    G.scene.add(m.g);
    C.list.push(c);
    if (type === 'boss' && G.state.mode !== 'menu') {
      G.UI.banner('¡Jabalí gigante!', 'Una bestia enorme ronda las praderas. Prepárate bien antes de enfrentarla.');
      G.Audio.play('roar');
    }
    if (type === 'pirate_boss' && G.state.mode !== 'menu') G.UI.msg('☠️ Se oyen risas en el campamento pirata… la capitana Hiena está ahí.', 'warn', 'hiena');
    if (type === 'serpent' && G.state.mode !== 'menu') {
      G.UI.banner('¡Serpiente marina!', 'Algo enorme se mueve bajo el barco…');
      G.Audio.play('roar');
    }
    return c;
  };
  function removeAt(i) {
    const c = C.list[i];
    G.scene.remove(c.g);
    if (c.model) { c.model.dispose(); c.feathers.dispose(); }
    else c.g.traverse((o) => { if (o.isMesh) { if (!o.geometry.userData.shared) o.geometry.dispose(); o.material.dispose(); if (o.skeleton) o.skeleton.dispose(); } });
    C.list.splice(i, 1);
  }
  C.byId = (id) => C.list.find((c) => c.id === id);
  C.clear = function () { while (C.list.length) removeAt(0); };
  C.removeWolves = function (islId) { for (let i = C.list.length - 1; i >= 0; i--) if (C.list[i].type === 'wolf' && (islId === undefined || C.list[i].isl === islId)) removeAt(i); };

  C.populate = function () {
    const P0 = G.Player.pos, A = G.Arch.islands[0];
    for (let i = 0; i < 10; i++) { const p = randomPoint(TESTS.beach, P0.x, P0.z, 20, 0, A); if (p) C.spawn('crab', p.x, p.z); }
    for (let i = 0; i < 7; i++) { const p = randomPoint(TESTS.grass, P0.x, P0.z, 40, 0, A); if (p) C.spawn('boar', p.x, p.z); }
    for (let i = 0; i < 6; i++) { const p = randomPoint(TESTS.grass, P0.x, P0.z, 45, 0, A); if (p) C.spawn('snake', p.x, p.z); }
    for (let i = 0; i < 2; i++) { const p = randomPoint(TESTS.forest, P0.x, P0.z, 70, 0, A); if (p) C.spawn('jaguar', p.x, p.z); }
  };

  // Jugadores que la IA puede perseguir (el local y los remotos)
  function targets() {
    const P0 = G.Player;
    // Quien comió la Fruta Humo-Humo es invisible para los animales de noche
    const hideMe = G.Story && G.Story.hiddenFromBeasts(), dark = G.World.night > 0.5;
    const out = [{ id: G.Net.myId, local: true, x: P0.pos.x, y: P0.pos.y, z: P0.pos.z, dead: P0.dead || hideMe || G.state.spectate, swim: P0.swimming, ship: P0.ship, team: G.Net.team }];
    for (const p of G.Net.peers.values()) out.push({ id: p.id, local: false, x: p.x, y: p.y, z: p.z, dead: p.dead || p.out || (p.fr === 'humo' && dark), swim: p.swim, ship: p.shipId ? G.Ships && G.Ships.byId(p.shipId) : null, team: p.team });
    return out;
  }
  function nearest(c, tg, filter) {
    let best = null, bd = 1e9;
    for (const t of tg) {
      if (t.dead || (filter && !filter(t))) continue;
      const d = Math.hypot(t.x - c.x, t.z - c.z);
      if (d < bd) { bd = d; best = t; }
    }
    return best ? { t: best, d: bd } : null;
  }
  const nightOf = (islId) => (G.Clock ? G.Clock.nightAt(islId) : G.Game.isNight());
  const dayOf = (islId) => (G.Clock ? G.Clock.dayOf(islId) : G.state.day);

  // Gestión de apariciones: por isla habitada y en el mar alrededor de los jugadores
  function manage(tg) {
    const D = G.Game.diff();
    const byIsl = new Map(), sea = [];
    for (const t of tg) {
      if (t.dead) continue;
      const s = G.Arch.landOf(t.x, t.z);
      if (s) { if (!byIsl.has(s.id)) byIsl.set(s.id, []); byIsl.get(s.id).push(t); } else sea.push(t);
    }
    // Retira criaturas lejos de todos los jugadores (islas vacías)
    for (let i = C.list.length - 1; i >= 0; i--) {
      const c = C.list[i];
      if (c.type === 'boss' || c.dead || c.type === 'pirate_boss') continue;
      if (tg.every((t) => Math.hypot(t.x - c.x, t.z - c.z) > (c.d.sea ? 240 : 280))) removeAt(i);
    }
    const count = (islId, type) => C.list.reduce((a, c) => a + (!c.dead && c.type === type && c.isl === islId ? 1 : 0), 0);
    const farFromAll = (p, d) => p && tg.every((t) => Math.hypot(t.x - p.x, t.z - p.z) > d);
    for (const [id, list] of byIsl) {
      const I = G.Arch.byId(id), fauna = FAUNA[I.type] || [];
      const who = list[Math.floor(Math.random() * list.length)];
      const night = nightOf(id);
      for (const [type, max, zone, prob] of fauna) {
        let want = max;
        if (type === 'snowwolf' && night) want += 2;
        if (count(id, type) >= want || (prob && Math.random() > prob)) continue;
        const p = randomPoint(TESTS[zone], who.x, who.z, 35, 0, I);
        if (farFromAll(p, 28)) C.spawn(type, p.x, p.z);
      }
      // Jefes de isla: el Rey de la Escarcha y el Dragón de Brasa (bosses.js)
      G.Bosses.manage(I, list, farFromAll, dayOf(id), BH());
      if (I.type === 'perdida' && G.Prologue) G.Prologue.manage(tg, C.spawn);
      if (I.type === 'perdida') {
        // El jabalí gigante aparece a partir del día 5 (y vuelve a los 30 minutos de derrotarlo)
        const wd = G.state.world;
        if (wd && G.Bosses.canSpawn('boss') && dayOf(0) >= 5 && !C.list.some((c) => c.type === 'boss' && !c.dead)) {
          const p = randomPoint(TESTS.grass, who.x, who.z, 60, 0, I);
          if (farFromAll(p, 50)) C.spawn('boss', p.x, p.z);
        }
        const want = night ? Math.min(10, D.wolves + Math.floor(dayOf(0) / 3) + (list.length - 1)) : 0;
        if (count(0, 'wolf') < want && Math.random() < 0.35) {
          const p = randomPoint(TESTS.land, who.x, who.z, 45, 70);
          if (farFromAll(p, 35) && G.Arch.landOf(p.x, p.z) === I) {
            C.spawn('wolf', p.x, p.z);
            G.Audio.playAt('howl', p.x, p.z, 120);
          }
        }
      }
      // Aldeanos de la tribu Shandara
      if (I.type === 'tahuri' && I.feat.village) {
        const V = I.feat.village;
        const have = new Set(C.list.filter((c) => c.type === 'villager').map((c) => c.extra));
        C.VILLAGERS.forEach((v, k) => {
          if (have.has(k)) return;
          const a = (k / C.VILLAGERS.length) * Math.PI * 2, d = V.r * 0.4;
          const px = k === 0 && V.chief ? V.chief.x : V.wx + Math.cos(a) * d, pz = k === 0 && V.chief ? V.chief.z : V.wz + Math.sin(a) * d;
          const c = C.spawn('villager', px, pz, undefined, k);
          c.hx = V.wx; c.hz = V.wz;
        });
      }
      // Aldeanos de los Kyrr (Escarcha) y de Ceniza (Brasa)
      if ((I.type === 'escarcha' || I.type === 'brasa') && I.feat.village) {
        const V = I.feat.village, have = new Set(C.list.filter((c) => c.type === 'aldeano').map((c) => c.extra));
        C.ALDEANOS.forEach((v, k) => {
          if (v.tribe !== I.type || have.has(k)) return;
          const a = (k % 4) * 1.6 + 0.5, d = V.r * 0.35;
          const c = C.spawn('aldeano', V.wx + Math.cos(a) * d, V.wz + Math.sin(a) * d, undefined, k);
          c.hx = V.wx; c.hz = V.wz; c.homeR = V.r * 0.55;
        });
      }
    }
    // Mar: tiburones con los nadadores, delfines y ballenas junto a los barcos, medusas y la serpiente marina
    const seaCount = (type) => C.list.reduce((a, c) => a + (!c.dead && c.type === type ? 1 : 0), 0);
    const deep = tg.find((t) => t.swim && !t.dead && G.height(t.x, t.z) < -3);
    if (deep && seaCount('shark') < 2 && Math.random() < 0.3) { const p = randomPoint(deepTest, deep.x, deep.z, 22, 35); if (p) C.spawn('shark', p.x, p.z); }
    if (sea.length) {
      const who = sea[Math.floor(Math.random() * sea.length)];
      const farLand = !G.Arch.nearest(who.x, who.z) || G.Arch.nearest(who.x, who.z).d > 60;
      if (farLand && seaCount('dolphin') < 3 && Math.random() < 0.06) {
        const p = randomPoint((h) => h < -4, who.x, who.z, 40, 70);
        if (p) for (let k = 0; k < 3; k++) C.spawn('dolphin', p.x + k * 3, p.z + k * 2);
      }
      if (farLand && seaCount('whale') < 1 && Math.random() < 0.03) { const p = randomPoint((h) => h < -8, who.x, who.z, 80, 140); if (p) C.spawn('whale', p.x, p.z); }
      if (seaCount('jelly') < 5 && Math.random() < 0.2) { const p = randomPoint((h) => h < -2, who.x, who.z, 25, 60); if (p) C.spawn('jelly', p.x, p.z); }
      const onShip = sea.find((t) => t.ship && Math.abs(t.ship.speed) > 2);
      const far = onShip && G.Arch.nearest(onShip.x, onShip.z).d > 170;
      if (far && seaCount('serpent') < 1 && Math.random() < 0.012 * (0.6 + D.dmg * 0.5)) {
        const p = randomPoint((h) => h < -7, onShip.x, onShip.z, 60, 90);
        if (p) C.spawn('serpent', p.x, p.z);
      }
    }
  }

  function newWander(c, rad) {
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2, d = 2 + Math.random() * rad;
      let x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d;
      if (c.type === 'villager' || c.type === 'aldeano' || c.homeR) { x = c.hx + Math.cos(a) * d * 0.9; z = c.hz + Math.sin(a) * d * 0.9; }
      if (validPos(c.type, x, z)) { c.tx = x; c.tz = z; c.t = 4 + Math.random() * 8; return; }
    }
    c.tx = c.x; c.tz = c.z; c.t = 2;
  }

  const CAUSE = {
    wolf: 'Te devoraron los lobos', boar: 'Un jabalí te embistió', snake: 'Te mordió una serpiente', jaguar: 'Un jaguar te atacó por sorpresa', shark: 'Un tiburón te arrastró al fondo',
    boss: 'El jabalí gigante te aplastó', bear: 'Un oso blanco te despedazó', snowwolf: 'La manada de las nieves te cazó', caiman: 'Un caimán te arrastró al agua',
    salamander: 'Una salamandra de fuego te quemó', lavacrab: 'Un cangrejo de lava te atrapó', jelly: 'Las medusas te picaron', serpent: 'La serpiente marina te devoró', villager: 'Los guerreros shandara te derrotaron',
    pirate: 'Los piratas de la Hiena te derrotaron', pirate_gun: 'Un pirata te disparó', pirate_boss: 'La capitana Hiena te derrotó',
    yeti: 'El Rey de la Escarcha te aplastó', lavadragon: 'El Dragón de Brasa te calcinó', bigcaiman: 'El Gran Caimán del río te hizo pedazos',
    marine: 'Un marine de la Marina Blanca te derrotó', marine_gun: 'Un tirador de la Marina te disparó', marine_boss: 'El comodoro de la Marina Blanca te derrotó',
    ghost_pirate: 'Un pirata fantasma te derrotó', ghost_gun: 'Un tirador fantasma te disparó', ghost_captain: 'El capitán Van Bruma te derrotó',
    corsair: 'Un pirata te derrotó al abordaje', corsair_gun: 'Un pirata te disparó', corsair_captain: 'Un capitán pirata te derrotó',
  };
  const SOUND = { pirate: 'hit', pirate_boss: 'hit', wolf: 'bite', snowwolf: 'bite', boar: 'grunt', snake: 'hiss', jaguar: 'roar', shark: 'bite', boss: 'roar', bear: 'roar', caiman: 'bite', salamander: 'hiss', lavacrab: 'bite', jelly: 'hiss', serpent: 'roar', villager: 'hit', yeti: 'roar', lavadragon: 'roar', bigcaiman: 'bite' };
  const CD = { pirate: 1.3, pirate_boss: 1.05, wolf: 1.2, snowwolf: 1.2, snake: 2.2, jaguar: 1.4, shark: 1.8, boss: 1.6, bear: 1.8, caiman: 2.0, salamander: 1.4, lavacrab: 1.6, jelly: 1.5, serpent: 2.5, villager: 1.3, yeti: 1.7, lavadragon: 1.9 };
  function attack(c, t, reach = 1.9) {
    c.yaw = Math.atan2(t.x - c.x, t.z - c.z);
    if (c.cd > 0 || Math.hypot(t.x - c.x, t.z - c.z) > reach) return false;
    if (!c.d.sea && Math.abs(t.y - c.y) > (c.d.bigBoss ? 3 : 1.6)) return false;
    if (G.Parry.fights(c)) return G.Parry.windup(c, t, reach);
    c.cd = CD[c.type] || 1.6;
    c.lunge = 0.3;
    const amt = c.d.dmg * G.Game.diff().dmg, cause = CAUSE[c.type], beast = !c.d.sea;
    if (t.local) { const got = G.Player.damage(amt, c, cause, beast ? { melee: true, cid: c.id, beast: true } : null); if (c.d.poison && got > 0) poisonLocal(c.d.poison); }
    else G.Net.send({ t: 'dmgP', to: t.id, amt, cause, sx: c.x, sz: c.z, poison: c.d.poison || 0, mel: beast ? 1 : 0, cid: c.id, bs: 1 });
    G.Audio.playAt(SOUND[c.type] || 'grunt', c.x, c.z);
    return true;
  }
  // Los tiradores apuntan un momento (brilla el arma) antes de disparar: da tiempo a esquivar o desviar la bala
  function aimShot(c, t) {
    if (c.windup > 0 || c.stun > 0) return;
    c.wShot = true; c.heavy = false; c.wT = t.id;
    c.windup = 0.65 * ([1.25, 1, 0.85][G.state.diff] ?? 1);
    c.cd = c.windup + 0.2;
    c.yaw = Math.atan2(t.x - c.x, t.z - c.z);
    G.Parry.glint(c, false);
  }
  function shootAt(c, t) {
    c.cd = 2.6; c.lunge = 0.3;
    c.yaw = Math.atan2(t.x - c.x, t.z - c.z);
    const V = THREE.Vector3, from = new V(c.x + Math.sin(c.yaw) * 0.7, c.y + 1.35, c.z + Math.cos(c.yaw) * 0.7);
    const hit = Math.random() < 0.6;
    const to = new V(t.x + (hit ? 0 : (Math.random() - 0.5) * 4), (t.y || 0) + 1.1, t.z + (hit ? 0 : (Math.random() - 0.5) * 4));
    if (G.Styles.tracer) G.Styles.tracer(from, to);
    G.Ships.puff(from.x, from.y, from.z, 0xd8d0c0, 0.5, 0.4, 2);
    G.Audio.playAt('cannon', c.x, c.z, 60);
    if (!hit) return;
    const amt = c.d.dmg * G.Game.diff().dmg;
    if (t.local) G.Player.damage(amt, c, CAUSE[c.type], { shot: true, cid: c.id });
    else G.Net.send({ t: 'dmgP', to: t.id, amt, cause: CAUSE[c.type], sx: c.x, sz: c.z, shot: 1, cid: c.id });
  }
  // Un jefe bloqueado prueba a avanzar en diagonal (bordea el obstáculo)
  function sidestep(c, step, speed) {
    for (const da of [0.6, -0.6, 1.2, -1.2, 1.8, -1.8]) {
      const ya = c.yaw + da, ax = c.x + Math.sin(ya) * step, az = c.z + Math.cos(ya) * step;
      if (validPos(c.type, ax, az) && !G.Build.blocked(ax, az, 1.3) && !intoRock(c, ax, az)) { c.x = ax; c.z = az; c.speedNow = speed; return true; }
    }
    return false;
  }
  // ¿Un jefe se metería en una roca o un árbol? (si ya está rozando uno, puede salir de él)
  function rockAt(x, z, rad) {
    let hit = false;
    G.Res.query(x, z, rad + 4, (r) => { if (!hit && r.alive && r.k.solid && Math.hypot(x - r.x, z - r.z) < (r.k.r || 0.5) * r.s + rad) hit = true; });
    return hit;
  }
  const intoRock = (c, x, z) => rockAt(x, z, 0.9) && !rockAt(c.x, c.z, 0.9);
  // Lo que necesitan los jefes de bosses.js
  let _bh = null;
  const BH = () => _bh || (_bh = { attack, spawn: C.spawn, valid: validPos });
  function poisonLocal(secs) {
    const P = G.Player;
    if (P.poison <= 0) G.UI.msg('☠️ ¡Estás envenenado! Usa una infusión o una cataplasma de hierbas.', 'bad');
    P.poison = Math.max(P.poison, secs);
  }
  C.poisonLocal = poisonLocal;

  // ------------------------------------------------------------------ daño
  C.hurt = function (c, dmg, attackerId, extra) {
    if (c.dead || c.d.friendly) return;
    c.flash = 0.15;
    G.Audio.playAt('hit', c.x, c.z);
    // La parte golpeada reacciona (cabeza, torso, brazo o pierna); el muñeco de paja se balancea en sus articulaciones
    const react = (k = 1) => {
      const z = extra && extra.zone;
      if (c.model && c.model.react) c.model.react(z || 'torso', extra && extra.side, z ? k : 0.6 * k);
      if (c.joints) G.Combat.reactDummy(c, z || 'torso', extra && extra.side, extra && extra.heavy ? 1.6 : 1);
    };
    if (!G.Net.authority()) { react(); G.Net.send({ t: 'hurtC', id: c.id, dmg, poison: extra && extra.poison, mel: extra && extra.melee ? 1 : 0, rip: extra && extra.riposte ? 1 : 0, hv: extra && extra.heavy ? 1 : 0, zn: extra && extra.zone, zs: extra && extra.side }); return; }
    const fromPeer = attackerId !== undefined && attackerId !== G.Net.myId;
    const src = fromPeer ? G.Net.peers.get(attackerId) : G.Player.pos;
    // Piratas, marines y guerreros se cubren o paran los golpes cuerpo a cuerpo (parry.js)
    const def = G.Parry.npcDefend(c, attackerId, extra);
    if (def <= 0) { c.flash = 0; c.aggroId = fromPeer ? attackerId : G.Net.myId; c.aggro = Math.max(c.aggro, 25); return; }
    dmg *= def;
    react();
    // Efectos de la zona en las personas y animales: cabeza aturde un instante, un brazo puede cortar el golpe
    // que preparaba, una pierna le frena
    const zn = extra && extra.zone, tough = c.d.bigBoss || /_boss$|_captain$/.test(c.type) || c.type === 'boss';
    if (zn === 'cabeza' && !tough && !c.d.dummy) { c.stun = Math.max(c.stun || 0, 0.3); c.windup = 0; }
    else if (zn === 'brazo' && c.windup > 0 && Math.random() < 0.35) { c.windup = 0; c.cd = 0.8; }
    else if (zn === 'pierna') c.slowT = 1.6;
    // Tripulación de un barco aliado atacada a propósito: ese barco te trata ya como enemigo
    if (c.deck && extra && extra.melee && G.Navy.provoked) { const s = G.Ships.byId(c.deck.ship); if (s) G.Navy.provoked(s, fromPeer ? attackerId : G.Net.myId); }
    c.hp -= dmg;
    if (c.d.dummy) { c.hp = c.d.hp; if (!c.joints) c.wobble = 0.5; return; }
    if (extra && extra.poison) c.poisoned = Math.max(c.poisoned || 0, extra.poison);
    if (src && c.type !== 'boss' && c.type !== 'whale' && c.type !== 'serpent' && c.type !== 'pirate_boss' && !c.d.bigBoss) {
      const dx = c.x - src.x, dz = c.z - src.z, d = Math.hypot(dx, dz) || 1;
      const nx = c.x + dx / d * 0.5, nz = c.z + dz / d * 0.5;
      if (validPos(c.type, nx, nz)) { c.x = nx; c.z = nz; }
    }
    c.aggroId = fromPeer ? attackerId : G.Net.myId;
    if (c.d.human) { c.aggro = 25; G.Audio.playAt('grunt', c.x, c.z); }
    if (['boar', 'boss', 'bear', 'caiman', 'lavacrab', 'salamander', 'villager'].includes(c.type)) { c.aggro = 20; G.Audio.playAt(c.type === 'boss' || c.type === 'bear' ? 'roar' : 'grunt', c.x, c.z); }
    if (['wolf', 'snowwolf', 'jaguar', 'snake', 'shark', 'serpent'].includes(c.type) || c.d.bigBoss) c.aggro = 20;
    if (c.type === 'villager') G.Story && G.Story.tribeHurt(c, fromPeer ? attackerId : G.Net.myId);
    if (c.hp <= 0) killCreature(c, fromPeer ? attackerId : null);
  };
  function killCreature(c, peerId) {
    c.dead = true;
    G.Audio.playAt('death', c.x, c.z);
    if (c.type === 'boss') {
      G.state.world.bossKilled = true;
      G.Bosses.markKilled('boss');
      G.UI.banner('¡Victoria!', 'El jabalí gigante ha caído');
    }
    if (c.type === 'villager') G.Story && G.Story.tribeKilled(c);
    if (c.d.bigBoss) G.Bosses.onKilled(c);
    let drops = c.d.drops;
    if (c.type === 'pirate_boss') {
      const again = G.Bosses.killedAt('pirate_boss') !== null;
      if (again) drops = drops.filter((d) => d[0] !== 'pista_3');
      G.UI.banner('¡Capitana Hiena derrotada!', again ? 'Los piratas vuelven a huir… por ahora' : 'Los piratas huyen… y dejan caer un pergamino');
      G.Bosses.markKilled('pirate_boss');
      if (G.Prologue) G.Prologue.onBossKilled();
    }
    if (!drops.length) return;
    if (peerId !== null && peerId !== undefined) G.Net.send({ t: 'give', to: peerId, items: drops, kill: c.d.name.toLowerCase(), kt: c.type, boss: c.type === 'boss' });
    else {
      for (const [id, n] of drops) G.Game.give(id, G.Faction.bonusLoot(id, n));
      G.state.stats.kills++;
      G.Ach.onKill(c.type);
      G.Bounty.onKill(c.type);
      G.Treasure.onKill(c.type);
      G.Quests.onKill(c.type);
      G.UI.msg(`Has cazado: ${c.d.name.toLowerCase()}`, 'good');
    }
  }

  // ------------------------------------------------------------------ animación de los animales con esqueleto (fauna.js / rig.js)
  function animateRig(c, dt, night) {
    const T = c.type, rig = c.rig, s = c.g.scale.x;
    const cam = G.camera.position, far = c.type === 'boss' || c.d.sea || c.d.bigBoss ? 260 : 140;
    const dc = Math.hypot(cam.x - c.x, cam.z - c.z);
    c.g.visible = Math.abs(cam.x - c.x) < far && Math.abs(cam.z - c.z) < far;
    G.Rig.lod(rig, dc / s);
    c.lunge = Math.max(0, c.lunge - dt);
    // Giro (rad/s): la columna se dobla hacia donde gira
    const dy = c.lastYaw === undefined ? 0 : U.angDiff(c.lastYaw, c.yaw);
    c.lastYaw = c.yaw;
    c.turnRate = U.lerp(c.turnRate || 0, dt > 0 ? U.clamp(dy / dt, -4, 4) : 0, Math.min(1, dt * 6));
    let y = c.y, pOver = null;
    const now = performance.now();
    if (c.d.bigBoss) y += G.Bosses.animate(c, dt, now);
    else if (T === 'shark') y = G.World.waveHeight(c.x, c.z) - 0.45;
    else if (T === 'serpent') y = G.World.waveHeight(c.x, c.z) - 1.1 + (c.aggro > 0 ? 0.6 : 0);
    else if (T === 'whale' || T === 'dolphin') {
      // Salen a respirar: arcos (delfines) o subidas lentas (ballena)
      const per = T === 'dolphin' ? 1.6 : 12, ph = ((now / 1000 + c.id * 0.7) % per) / per;
      const arc = T === 'dolphin' ? Math.max(0, Math.sin(ph * Math.PI * 2)) * 1.4 - 0.6 : Math.sin(ph * Math.PI * 2) * 1.2 - 1.6;
      y = G.World.waveHeight(c.x, c.z) + arc;
      pOver = T === 'dolphin' ? -Math.cos(ph * Math.PI * 2) * 0.5 : 0;
    } else if (T === 'snake' && c.lunge > 0) y += Math.sin((c.lunge / 0.3) * Math.PI) * 0.2;
    c.vy = y;
    // En cuesta: el cuerpo se inclina y cada pie busca el suelo (solo cerca de la cámara)
    const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), half = (rig.tpl.o.half || 0.45) * s;
    const near = c.g.visible && dc < 45 && !c.d.sea;
    let pitch = pOver ?? 0;
    if (near) {
      const hF = G.height(c.x + fx * half, c.z + fz * half), hB = G.height(c.x - fx * half, c.z - fz * half);
      pitch = U.clamp(-Math.atan2(hF - hB, half * 2), -0.45, 0.45);
    }
    if (c.pitchOver !== null && c.pitchOver !== undefined) pOver = c.pitchOver;
    c.pitch = pOver !== null ? pOver : U.lerp(c.pitch || 0, pitch, Math.min(1, dt * 5));
    c.g.position.set(c.x, y, c.z);
    c.g.rotation.order = 'YXZ';
    c.g.rotation.set(c.pitch, c.yaw + (T === 'crab' || T === 'lavacrab' ? Math.PI / 2 : 0), 0);
    if (c.wobble > 0) { c.wobble = Math.max(0, c.wobble - dt); c.g.rotation.z = Math.sin(c.wobble * 30) * c.wobble * 0.25; }
    const cp = Math.cos(c.pitch), sp = Math.sin(c.pitch), lim = (rig.tpl.o.footReach || 0.25);
    const ground = near ? (lx, lz) => {
      const wx = c.x + (lx * fz + lz * fx) * s, wz = c.z + (-lx * fx + lz * fz) * s;
      return U.clamp((G.height(wx, wz) - y + lz * s * sp) / (s * cp), -lim, lim);
    } : null;
    if (c.g.visible) {
      const lunge = c.lunge > 0 ? Math.sin((c.lunge / 0.3) * Math.PI) : 0;
      const crouch = T === 'jaguar' && c.pounce <= 0 && c.aggro > 0 && c.speedNow < 4 ? 1 : 0;
      c.crouchK = U.lerp(c.crouchK || 0, crouch, Math.min(1, dt * 5));
      // Animación por niveles de distancia: cerca, cada fotograma; lejos, cada 2 o 3 fotogramas con el tiempo
      // acumulado (a esa distancia se ve igual de fluido y el juego va más suelto)
      c.animAcc = (c.animAcc || 0) + dt;
      // Velocidad para la animación, suavizada: al pararse o arrancar las patas no saltan de golpe
      c.animSpeed = U.lerp(c.animSpeed || 0, c.speedNow, Math.min(1, dt * 7));
      const every = dc < 28 ? 1 : dc < 70 ? 2 : 3;
      if (every === 1 || (c.animN = (c.animN || 0) + 1) % every === 0) {
        G.Rig.animate(rig, c.animAcc, { speed: c.animSpeed / s, turn: c.turnRate, lunge, jaw: c.jawK !== undefined ? c.jawK : Math.max(lunge, c.special ? 1 : 0), crouch: c.crouchK, fear: c.fear, ground, noLegs: c.fly > 0.4, c });
        c.animAcc = 0;
      }
      rig.mat.userData.u.uTime.value += dt;
    }
    if (c.flash > 0) c.flash -= dt;
    if (c.mat.emissive) {
      if (c.flash > 0) c.mat.emissive.setRGB(0.6, 0, 0);
      else if (T === 'lavacrab') c.mat.emissive.setRGB(0.25, 0.06, 0);
      else if (T === 'salamander') c.mat.emissive.setRGB(0.23, 0.05, 0);
      else c.mat.emissive.setRGB(0, 0, 0);
    }
    if (c.eyeMat) c.eyeMat.emissive.setRGB(night ? 1.6 : 0, night ? 1.1 : 0, 0);
  }

  // ------------------------------------------------------------------ animación común
  function animate(c, dt, night) {
    if (c.rig) { animateRig(c, dt, night); return; }
    const T = c.type;
    c.phase += c.speedNow * dt * (T === 'crab' || T === 'lavacrab' ? 9 : T === 'jaguar' ? 2.6 : T === 'monkey' || T === 'salamander' ? 5 : T === 'yeti' ? 1.8 : T === 'lavadragon' ? 1.5 : T === 'bigcaiman' ? 2.4 : 3.2);
    const amp = Math.min(1, c.speedNow / 2) * 0.6;
    if (T === 'crab' || T === 'lavacrab' || T === 'seal') c.legs.forEach((l, k) => (l.rotation.x = Math.sin(c.phase + k * Math.PI) * amp));
    else { const off = [0, Math.PI, Math.PI, 0]; c.legs.forEach((l, k) => (l.rotation.x = Math.sin(c.phase + off[k]) * amp * (T === 'jaguar' ? 1.3 : 1))); }
    c.lunge = Math.max(0, c.lunge - dt);
    if (c.head) c.head.position.z = c.headZ + Math.sin((c.lunge / 0.3) * Math.PI) * (T === 'serpent' ? 1.2 : 0.2);
    const now = performance.now();
    if (c.tail && !c.d.sea && T !== 'jelly') {
      if (c.tailYaw) c.tail.rotation.y = Math.sin(now / 200 + c.id) * (0.2 + Math.min(1, c.speedNow / 2) * 0.4);
      else c.tail.rotation.z = Math.sin(now / (T === 'jaguar' ? 300 : 125)) * (c.fear ? 0.05 : 0.25);
    }
    let y = c.y;
    if (T === 'snake' || T === 'serpent') {
      c.snakeU.uTime.value += dt * (0.3 + c.speedNow * (T === 'serpent' ? 0.3 : 1));
      c.snakeU.uAmp.value = U.lerp(c.snakeU.uAmp.value, T === 'serpent' ? 0.5 : c.speedNow > 0.1 ? 0.14 : 0.04, Math.min(1, dt * 4));
      if (T === 'snake' && c.lunge > 0) y += Math.sin((c.lunge / 0.3) * Math.PI) * 0.2;
      if (T === 'serpent') y = G.World.waveHeight(c.x, c.z) - 1.1 + (c.aggro > 0 ? 0.6 : 0);
    } else if (T === 'shark') {
      y = G.World.waveHeight(c.x, c.z) - 0.45;
      c.tail.rotation.y = Math.sin(now / 180) * 0.4;
    } else if (T === 'whale' || T === 'dolphin') {
      // Salen a respirar: arcos (delfines) o subidas lentas (ballena)
      const per = T === 'dolphin' ? 1.6 : 12, ph = ((now / 1000 + c.id * 0.7) % per) / per;
      const arc = T === 'dolphin' ? Math.max(0, Math.sin(ph * Math.PI * 2)) * 1.4 - 0.6 : Math.sin(ph * Math.PI * 2) * 1.2 - 1.6;
      y = G.World.waveHeight(c.x, c.z) + arc;
      c.g.rotation.x = T === 'dolphin' ? -Math.cos(ph * Math.PI * 2) * 0.5 : 0;
      c.tail.rotation.x = Math.sin(now / (T === 'dolphin' ? 150 : 700)) * 0.3;
    } else if (T === 'jelly') {
      y = G.World.waveHeight(c.x, c.z) - 0.6 + Math.sin(now / 600 + c.id) * 0.2;
      c.tail.scale.y = 1 + Math.sin(now / 300 + c.id) * 0.15;
    } else if (c.d.bigBoss) {
      y += G.Bosses.animate(c, dt, now);
    } else if (c.hop) {
      c.hopT = (c.hopT + dt * (c.speedNow > 0.1 ? 3 : 0)) % 1;
      y += Math.sin(c.hopT * Math.PI) * 0.25;
    } else if (T === 'jaguar' && c.body) {
      const crouch = c.pounce <= 0 && c.aggro > 0 && c.speedNow < 4 ? 1 : 0;
      c.g.children[0].position.y = U.lerp(c.g.children[0].position.y, -0.15 * crouch, Math.min(1, dt * 5));
    }
    c.vy = y;
    if (c.model) {
      c.swing = Math.max(0, (c.swing || 0) - dt / 0.32);
      if (c.lunge > 0.29) {
        if (c.swing < 0.9 && c.hold && !/_gun$/.test(c.type)) G.Combat.trailAt(c.x, y + 1.25, c.z, c.yaw + Math.PI, c.sd ?? 2, c.sd === 4);
        c.swing = 1;
      }
      c.guardNet = Math.max(0, (c.guardNet || 0) - dt);
      c.dodgeT = Math.max(0, (c.dodgeT || 0) - dt);
      const auth = G.Net.authority(), wind = auth ? c.windup > 0 : c.windNet, stg = auth ? c.stun > 0 : c.stunNet, hv = wind && (auth ? c.heavy : c.heavyNet);
      const grd = (c.guardT || 0) > 0 || c.guardNet > 0;
      c.wK = U.lerp(c.wK || 0, wind && !hv ? 1 : 0, Math.min(1, dt * 12)); c.hK = U.lerp(c.hK || 0, hv ? 1 : 0, Math.min(1, dt * 12));
      const ma = c.speedNow > 0.3 && c.mvYaw !== undefined ? U.angDiff(c.yaw, c.mvYaw) : 0;
      c.model.update(dt, { pos: _vp.set(c.x, y, c.z), yaw: c.yaw + Math.PI, pitch: 0, speed: c.speedNow, onGround: true, swimming: false, swing: c.swing, holding: c.role === 'guard' || !!c.hold, windup: c.wK, heavyWind: c.hK, guard: grd ? 1 : 0, stagger: stg ? 1 : 0,
        swingDir: c.sd ?? 2, dodge: c.dodgeT > 0 ? 1 : 0, dodgeSide: -2, moveAng: ma });
    } else {
      c.g.position.set(c.x, y, c.z);
      c.g.rotation.y = c.yaw + (T === 'crab' || T === 'lavacrab' ? Math.PI / 2 : 0);
      if (c.wobble > 0) { c.wobble = Math.max(0, c.wobble - dt); c.g.rotation.z = Math.sin(c.wobble * 30) * c.wobble * 0.25; }
      if (c.joints) G.Combat.springs(c, dt);
      if (c.flash > 0) c.flash -= dt;
      if (c.mat.emissive) {
        if (c.flash > 0) c.mat.emissive.setRGB(0.6, 0, 0);
        else if (T === 'lavacrab') c.mat.emissive.setRGB(0.25, 0.06, 0);
        else if (T === 'salamander') c.mat.emissive.setRGB(0.23, 0.05, 0);
        else if (T === 'lavadragon') c.mat.emissive.setRGB(0.05, 0.012, 0);
        else if (T === 'yeti') c.mat.emissive.setRGB(0.03, 0.06, 0.1);
        else if (T !== 'jelly') c.mat.emissive.setRGB(0, 0, 0);
      }
    }
    if (c.eyeMat) c.eyeMat.emissive.setRGB(night ? 1.6 : 0, night ? 1.1 : 0, 0);
    const cam = G.camera.position, far = c.type === 'boss' || c.d.sea || c.d.bigBoss ? 260 : 140;
    c.g.visible = Math.abs(cam.x - c.x) < far && Math.abs(cam.z - c.z) < far;
  }
  const _vp = new THREE.Vector3(), _deck = new THREE.Vector3(), _deckW = new THREE.Vector3();
  function animateDeath(c, dt) {
    c.deadT += dt;
    if (c.rig && !c.deadPose) { c.deadPose = true; G.Rig.animate(c.rig, 0, { dead: true }); }
    if (c.d.bigBoss) G.Bosses.death(c, dt);
    if (c.model) { c.g.rotation.x = -Math.min(Math.PI / 2, c.deadT * 3); if (c.deadT > 4) c.g.position.y -= dt * 0.8; return; }
    if (c.d.sea) { c.g.position.y -= dt * 0.8; c.g.rotation.z = Math.min(Math.PI, c.deadT * 2); return; }
    if (c.deadT < 0.5) c.g.rotation.z = (c.deadT / 0.5) * Math.PI / 2;
    else if (c.deadT > 4) c.g.position.y -= dt * 0.8;
  }

  // ------------------------------------------------------------------ simulación (anfitrión / individual)
  C.update = function (dt) {
    if (!G.Net.authority()) return updateRemote(dt);
    const tg = targets();
    C.timer -= dt;
    if (C.timer <= 0) { C.timer = 2; manage(tg); }
    const Sh = G.Ships;
    for (let i = C.list.length - 1; i >= 0; i--) {
      const c = C.list[i];
      if (c.dead) { animateDeath(c, dt); if (c.deadT > 6) removeAt(i); continue; }
      const night = nightOf(c.isl);
      c.cd -= dt; c.aggro -= dt; c.t -= dt; c.pounce -= dt; c.rest -= dt; c.calm = (c.calm || 0) - dt;
      // Congelado por el poder de la Fruta Hielo-Hielo
      if (c.frozen > 0) {
        c.frozen -= dt * (c.d.bigBoss ? 3 : 1); c.speedNow = 0; // a los jefes se les pasa antes
        // El destello rojo del golpe se apaga igual y queda un tono helado mientras dura
        if (c.flash > 0) c.flash = Math.max(0, c.flash - dt);
        animate(c, 0, night);
        if (!c.model && c.mat && c.mat.emissive && !(c.flash > 0)) c.mat.emissive.setRGB(0.1, 0.26, 0.4);
        continue;
      }
      if (c.poisoned > 0) { c.poisoned -= dt; c.hp -= 3 * dt; if (c.hp <= 0) { killCreature(c, c.aggroId !== G.Net.myId ? c.aggroId : null); continue; } }
      // Combate cuerpo a cuerpo de las personas (parry.js): aturdidas por una parada, o preparando un golpe
      if (c.stun > 0 || c.windup > 0) {
        if (c.deck && !G.Navy.placeOnDeck(c)) { removeAt(i); continue; }
        c.speedNow = 0; c.guardT = 0;
        if (c.stun > 0) { c.stun -= dt; c.windup = 0; }
        else {
          const wt = tg.find((t) => t.id === c.wT && !t.dead);
          if (wt) c.yaw += U.angDiff(c.yaw, Math.atan2(wt.x - c.x, wt.z - c.z)) * Math.min(1, dt * 7);
          if ((c.windup -= dt) <= 0) {
            if (c.wShot) { c.wShot = false; c.windup = 0; if (wt) shootAt(c, wt); }
            else G.Parry.strike(c, wt, CD[c.type], CAUSE[c.type]);
          }
        }
        if (!c.deck) c.y = U.lerp(c.y, G.height(c.x, c.z), Math.min(1, dt * 10));
        animate(c, dt, night); continue;
      }
      if (c.guardT > 0) c.guardT -= dt;
      let tx = c.tx, tz = c.tz, speed = c.d.speed, moving = true;
      const nr = nearest(c, tg);
      const tgt = nr ? nr.t : null, dist = nr ? nr.d : 1e9;
      const wander = (rad) => {
        if (c.t <= 0 || Math.hypot(c.tx - c.x, c.tz - c.z) < 0.6) newWander(c, rad ?? (c.type === 'crab' || c.type === 'snake' || c.type === 'frog' ? 6 : 14));
        tx = c.tx; tz = c.tz;
        if (c.t > 0 && Math.hypot(c.tx - c.x, c.tz - c.z) < 0.6) moving = false;
      };
      // Conversación entre personajes (voice.js): se acercan al corro y miran a quien habla
      const chatting = () => {
        if (!c.chat) return false;
        const d = Math.hypot(c.chat.x - c.x, c.chat.z - c.z);
        if (d > 0.6) { tx = c.chat.x; tz = c.chat.z; speed = c.d.speed; } else { moving = false; if (c.chatFace) faceT = c.chatFace; }
        return true;
      };
      const fleeFrom = (t, d, s) => { tx = c.x - (t.x - c.x) / d * 8; tz = c.z - (t.z - c.z) / d * 8; speed = s; };
      const fireFear = () => { const f = G.Build.nearestLitFire(c.x, c.z); return f && f.d < 9 ? f : null; };
      const chase = (range, keep, reach = 1.9) => {
        // Tras quedarse atascado persiguiendo (agua, paredes…), se olvida un rato de la presa
        if (c.calm > 0) return false;
        let at = c.aggro > 0 ? tg.find((t) => t.id === c.aggroId && !t.dead) : null;
        if (!at && tgt && dist < range && !tgt.ship) { at = tgt; c.aggro = 6; c.aggroId = tgt.id; }
        if (!at) return false;
        const d = Math.hypot(at.x - c.x, at.z - c.z);
        tx = at.x; tz = at.z; speed = c.d.run; faceT = at;
        if (G.Parry.fights(c) && c.cd > 0.35 && d < 4.2 && !c.deck) {
          c.orbit = c.orbit || (Math.random() < 0.5 ? 1 : -1);
          if (Math.random() < dt * 0.35) c.orbit = -c.orbit;
          const a = Math.atan2(c.x - at.x, c.z - at.z) + c.orbit * 0.75;
          tx = at.x + Math.sin(a) * 2.7; tz = at.z + Math.cos(a) * 2.7; speed = c.d.speed * 1.7; strafe = true;
        } else if (d < reach) { moving = false; attack(c, at, reach + 0.1); }
        if (d > keep) c.aggro = 0;
        return true;
      };
      let faceT = null, strafe = false;
      // Marines en la cubierta de un barco de la Marina Blanca (navy.js): en su puesto, pelean desde allí
      if (c.deck) {
        if (!G.Navy.placeOnDeck(c)) { removeAt(i); continue; }
        const ship = G.Ships.byId(c.deck.ship), foe = nearest(c, tg, (t) => G.Faction.shipHostile(ship, t));
        if (foe && foe.d < 60) {
          const t = foe.t;
          c.yaw = Math.atan2(t.x - c.x, t.z - c.z);
          c.aggro = Math.max(c.aggro, 2); c.aggroId = t.id;
          if (/_gun$/.test(c.type)) { if (foe.d < 32 && c.cd <= 0) aimShot(c, t); }
          else if (foe.d < 2.6) attack(c, t, 2.7);
        }
        c.speedNow = 0; animate(c, dt, night); continue;
      }
      // Animal marino atascado contra la costa: vuelve un rato a aguas profundas (antes se quedaba quieto para siempre)
      if (c.d.sea && c.retreat > 0) { c.retreat -= dt; c.aggro = Math.min(c.aggro, 0); tx = c.rx; tz = c.rz; speed = c.d.run * 0.85; }
      else switch (c.type) {
        case 'crab': case 'monkey': case 'seal': case 'frog':
          if (tgt && dist < (c.type === 'monkey' ? 9 : 5)) fleeFrom(tgt, dist, c.d.run); else wander();
          break;
        case 'boar': case 'boss': {
          let at = c.aggro > 0 ? tg.find((t) => t.id === c.aggroId && !t.dead) : null;
          if (!at && c.type === 'boss' && tgt && dist < 14) { at = tgt; c.aggro = 10; c.aggroId = tgt.id; }
          if (at) {
            const d = Math.hypot(at.x - c.x, at.z - c.z);
            tx = at.x; tz = at.z; speed = c.d.run; faceT = at;
            if (d < (c.type === 'boss' ? 3.2 : 1.9)) { moving = false; attack(c, at, c.type === 'boss' ? 3.4 : 1.9); }
            if (d > 35) c.aggro = 0;
          } else wander();
          break;
        }
        case 'bear':
          if (!chase(13, 35, 2.4)) wander();
          break;
        case 'lavacrab':
          if (!chase(7, 18, 1.8)) wander(8);
          break;
        case 'salamander':
          if (!chase(6, 14, 1.2)) wander(8);
          break;
        case 'caiman':
          // Emboscada: quieto junto al agua hasta que alguien se acerca
          if (!chase(6.5, 14, 2.1)) { if (Math.random() < 0.002) wander(6); else if (c.t > 0) wander(6); else moving = false; }
          break;
        case 'villager': {
          const hostile = G.Story && G.Story.tribeHostile();
          if (hostile && c.role !== 'chief' ? chase(16, 30, 2.0) : false) break;
          if (chatting()) break;
          if (c.role === 'chief') { moving = false; if (tgt && dist < 8) faceT = tgt; break; }
          if (tgt && dist < 3.5 && !hostile) { moving = false; faceT = tgt; break; }
          wander(G.Arch.byId(c.isl)?.feat.village?.r * 0.7 || 10);
          break;
        }
        case 'aldeano': {
          // Pasean por su aldea y se giran para hablar contigo
          if (chatting()) break;
          if (tgt && dist < 3.5) { moving = false; faceT = tgt; break; }
          wander(c.homeR || 9); speed = c.d.speed * 0.7;
          break;
        }
        case 'npc': {
          // Tu tripulación, si te sigue (crew.js): en tierra va contigo y pelea; en el barco va en cubierta
          const cp = c.follow && G.Crew ? G.Crew.plan(c, dt) : null;
          if (cp) {
            if (cp.aboard) { moving = false; break; }
            tx = cp.tx; tz = cp.tz; speed = cp.speed; if (cp.still) moving = false; if (cp.face) faceT = cp.face;
            break;
          }
          // Tripulación y ermitaño: vuelven a su sitio, se giran para hablar contigo y pasean un poco
          const hd = Math.hypot(c.hx - c.x, c.hz - c.z);
          if (hd > 7) { tx = c.hx; tz = c.hz; speed = c.d.speed * 1.5; break; }
          if (chatting()) break;
          if (tgt && dist < 4.5) { moving = false; faceT = tgt; break; }
          wander(c.homeR || 3); speed = c.d.speed * 0.6;
          if (Math.random() < dt * 0.3) { c.t = 3 + Math.random() * 4; c.tx = c.x; c.tz = c.z; }
          break;
        }
        case 'dummy':
          moving = false; c.hp = c.d.hp;
          break;
        case 'pirate': case 'pirate_boss': {
          const boss = c.type === 'pirate_boss';
          if (!(c.aggro > 0) && !(tgt && dist < (boss ? 17 : 14)) && chatting()) break;
          if (!chase(boss ? 17 : 14, boss ? 30 : 32, boss ? 2.3 : 2.0)) { wander(c.homeR || 10); speed = c.d.speed; }
          // La capitana, herida, se enfurece: corre más
          if (boss && c.hp < c.d.hp * 0.5) speed *= 1.15;
          break;
        }
        case 'pirate_gun': {
          if (!(c.aggro > 0) && !(tgt && dist < 22) && chatting()) break;
          let at = c.aggro > 0 ? tg.find((t) => t.id === c.aggroId && !t.dead) : null;
          if (!at && tgt && dist < 22 && !tgt.ship) { at = tgt; c.aggro = 8; c.aggroId = tgt.id; }
          if (at) {
            const d = Math.hypot(at.x - c.x, at.z - c.z);
            faceT = at;
            if (d < 6) fleeFrom(at, d, c.d.run * 0.8);
            else if (d > 17) { tx = at.x; tz = at.z; speed = c.d.run; }
            else { moving = false; if (c.cd <= 0) aimShot(c, at); }
            if (d > 36) c.aggro = 0;
          } else wander(c.homeR || 10);
          break;
        }
        case 'snake':
          if (tgt && dist < 2.3) { moving = false; faceT = tgt; if (attack(c, tgt, 2.3)) c.rest = 2; }
          else if (tgt && dist < 6 && c.rest <= 0) {
            faceT = tgt; moving = false;
            if (Math.random() < dt * 0.8) G.Audio.playAt('hiss', c.x, c.z, 12);
            if (c.aggro > 0) { tx = tgt.x; tz = tgt.z; speed = c.d.run; moving = true; }
          } else if (tgt && dist < 4 && c.rest > 0) fleeFrom(tgt, dist, c.d.run);
          else wander();
          break;
        case 'wolf': case 'snowwolf': {
          const hunts = c.type === 'snowwolf' || night;
          if (!hunts) {
            if (tgt) fleeFrom(tgt, dist, c.d.run);
            if (dist > 50) { removeAt(i); continue; }
          } else if (tgt && c.calm <= 0 && (dist < (night ? 38 : 22) || c.aggro > 0) && !tgt.ship) {
            const fire = fireFear();
            c.fear = !!fire;
            faceT = tgt;
            if (fire) {
              tx = c.x + (c.x - fire.s.x) / fire.d * 5; tz = c.z + (c.z - fire.s.z) / fire.d * 5; speed = c.d.run * 0.5;
              if (fire.d > 8.3) moving = false;
            } else {
              tx = tgt.x; tz = tgt.z; speed = c.d.run;
              if (dist < 1.9) { moving = false; attack(c, tgt); }
            }
          } else wander();
          break;
        }
        case 'jaguar': {
          const range = night ? 30 : 16;
          const fire = fireFear();
          c.fear = !!fire;
          if (fire) { tx = c.x + (c.x - fire.s.x) / fire.d * 6; tz = c.z + (c.z - fire.s.z) / fire.d * 6; speed = c.d.run * 0.4; c.pounce = 0; }
          else if (tgt && c.calm <= 0 && (dist < range || c.aggro > 0) && c.rest <= 0 && !tgt.ship) {
            faceT = tgt; c.aggro = Math.max(c.aggro, 2);
            if (c.pounce > 0) { tx = tgt.x; tz = tgt.z; speed = c.d.run; if (dist < 2.1 && attack(c, tgt, 2.2)) { c.pounce = 0; c.rest = 3; } }
            else if (dist < 9) { c.pounce = 1.4; G.Audio.playAt('roar', c.x, c.z, 40); }
            else { tx = tgt.x; tz = tgt.z; speed = 1.6; } // acecha agazapado
          } else if (tgt && c.rest > 0) {
            // Se aleja y vuelve a rodear a su presa
            c.circle += dt * 0.8;
            tx = tgt.x + Math.cos(c.circle) * 12; tz = tgt.z + Math.sin(c.circle) * 12; speed = 3;
          } else wander();
          break;
        }
        case 'shark': {
          const sw = nearest(c, tg, (t) => t.swim && G.height(t.x, t.z) < -1.5);
          const small = Sh && Sh.near(c.x, c.z, 40, (s) => s.def.small);
          if (sw && sw.d < 45) {
            c.lonely = 0;
            const t = sw.t;
            faceT = t;
            c.circle += dt * 0.6;
            if (c.cd <= 0 && sw.d < 10) { tx = t.x; tz = t.z; speed = c.d.run; if (sw.d < 2.2) attack(c, t, 2.4); }
            else { tx = t.x + Math.cos(c.circle) * 8; tz = t.z + Math.sin(c.circle) * 8; speed = c.d.speed * 1.5; }
          } else if (small) {
            // Embiste botes pequeños (balsa, canoa)
            c.lonely = 0;
            tx = small.s.x; tz = small.s.z; speed = c.d.run * 0.8;
            if (small.d < 2 && c.cd <= 0) { c.cd = 5; c.lunge = 0.3; Sh.hurt(small.s, 6, 'Un tiburón embiste el casco'); G.Audio.playAt('bite', c.x, c.z); }
          } else {
            c.lonely += dt;
            wander();
            if (c.lonely > 25 && (!tgt || dist > 60)) { removeAt(i); continue; }
          }
          break;
        }
        case 'dolphin': {
          const sh = Sh && Sh.near(c.x, c.z, 90);
          if (sh) { const s = sh.s; c.circle += dt * 0.3; tx = s.x + Math.sin(s.yaw) * 6 + Math.cos(c.circle + c.id) * 5; tz = s.z + Math.cos(s.yaw) * 6 + Math.sin(c.circle + c.id) * 5; speed = Math.max(4, Math.abs(s.speed) + 1.5); }
          else { wander(30); speed = c.d.speed; if ((c.lonely += dt) > 40) { removeAt(i); continue; } }
          break;
        }
        case 'whale':
          wander(60);
          break;
        case 'jelly': {
          wander(8);
          const sw = nearest(c, tg, (t) => t.swim);
          if (sw && sw.d < 1.5) attack(c, sw.t, 1.6);
          break;
        }
        case 'yeti': case 'lavadragon': case 'bigcaiman': {
          const o = G.Bosses.think(c, tg, dt, BH());
          tx = o.tx; tz = o.tz; speed = o.speed; moving = o.moving; faceT = o.face;
          break;
        }
        case 'serpent': {
          // Su cabeza va 7 m por delante del centro del cuerpo: alcance y mordiscos se miden desde la cabeza
          const hx = c.x + Math.sin(c.yaw) * SERP_HEAD, hz = c.z + Math.cos(c.yaw) * SERP_HEAD;
          const headD = (t) => Math.hypot(t.x - hx, t.z - hz);
          c.shipIgnore = Math.max(0, (c.shipIgnore || 0) - dt);
          if (c.hp < c.d.hp * 0.3) { if (tgt) fleeFrom(tgt, dist, c.d.run); if (dist > 150) { removeAt(i); continue; } break; }
          // Muerde a quien esté al alcance de la cabeza: nadando, en la orilla o golpeándola desde tierra
          let bite = null;
          for (const t of tg) if (!t.dead && !t.ship && headD(t) < 3.4 && Math.abs((t.y || 0) - (c.vy ?? 0)) < 4) bite = t;
          if (bite) { c.lonely = 0; c.aggro = 3; faceT = bite; moving = false; if (c.cd <= 0) attack(c, bite, SERP_HEAD + 4); break; }
          const sw = nearest(c, tg, (t) => t.swim);
          // Solo persigue barcos con alguien a bordo (una balsa vacía varada en la playa no le interesa)
          const sh = c.shipIgnore > 0 ? null : Sh && Sh.near(c.x, c.z, 140, (s) => tg.some((t) => !t.dead && t.ship === s));
          if (sw && sw.d < 30) { c.lonely = 0; c.aggro = 3; faceT = sw.t; tx = sw.t.x; tz = sw.t.z; speed = c.d.run; if (headD(sw.t) < 2.5) moving = false; }
          else if (sh) {
            c.lonely = 0; c.aggro = 3;
            const s = sh.s, hd = Math.hypot(s.x - hx, s.z - hz);
            c.orbit = c.orbit || (Math.random() < 0.5 ? 1 : -1);
            if (c.cd <= 0 && sh.d < 25 + SERP_HEAD) {
              // Embestida: la cabeza va hacia el casco, lo golpea y vuelve a apartarse (no lo atraviesa)
              tx = s.x; tz = s.z; speed = c.d.run;
              if (hd < Math.max(2.6, s.def.L * 0.4)) { c.cd = 4.5; c.lunge = 0.3; c.fails = 0; Sh.hurt(s, c.d.shipDmg * G.Game.diff().dmg, 'La serpiente marina golpea el casco'); G.Audio.playAt('roar', c.x, c.z, 80); }
            } else {
              // Mientras tanto, da vueltas alrededor del barco
              const a = Math.atan2(c.z - s.z, c.x - s.x) + c.orbit * 0.55, R = s.def.L / 2 + 5;
              tx = s.x + Math.cos(a) * R; tz = s.z + Math.sin(a) * R; speed = sh.d > 20 ? c.d.run : c.d.speed;
            }
            // Si el barco está en aguas donde no puede llegar (varado en la orilla), se cansa y lo deja
            if ((c.fails || 0) >= 3) { c.fails = 0; c.shipIgnore = 45; c.orbit = -c.orbit; }
          } else { c.aggro = 0; wander(40); if ((c.lonely += dt) > 30) { removeAt(i); continue; } }
          break;
        }
      }
      // En cubierta de tu barco: crew.js ya lo ha colocado
      if (c.aboard && c.follow) { c.speedNow = 0; animate(c, dt, night); continue; }
      const mx = tx - c.x, mz = tz - c.z, md = Math.hypot(mx, mz);
      if (moving && md > 0.3) {
        const hd = Math.atan2(mx, mz);
        if (strafe && faceT) { c.mvYaw = hd; c.yaw += U.angDiff(c.yaw, Math.atan2(faceT.x - c.x, faceT.z - c.z)) * Math.min(1, dt * 8); }
        else { c.yaw += U.angDiff(c.yaw, hd) * Math.min(1, dt * (c.d.sea ? 2.5 : 6)); c.mvYaw = c.yaw; }
        if (c.slowT > 0) { c.slowT -= dt; speed *= 0.6; } // le dieron en una pierna
        // Ningún jefe corre más que tú (7,2 m/s esprintando): siempre puedes escapar
        if (c.d.bigBoss || c.d.boss || c.type === 'serpent' || /_boss$|_captain$/.test(c.type)) speed = Math.min(speed, BOSS_MAX);
        const step = speed * dt;
        const nx = c.x + Math.sin(c.mvYaw) * step, nz = c.z + Math.cos(c.mvYaw) * step;
        const flying = c.fly > 0.3; // el dragón en vuelo pasa por encima de todo
        if ((flying || validPos(c.type, nx, nz)) && (c.d.sea || flying || (!G.Build.blocked(nx, nz, c.type === 'boss' || c.type === 'bear' ? 0.9 : c.d.bigBoss ? 1.3 : 0.4) && !(c.d.bigBoss && intoRock(c, nx, nz))))) { c.x = nx; c.z = nz; c.speedNow = speed; c.stuck = 0; }
        else if (c.d.bigBoss && sidestep(c, step, speed)) { /* los jefes rodean rocas y paredes en vez de quedarse parados */ }
        else {
          c.speedNow = 0; c.t = 0;
          if (!['wolf', 'snowwolf'].includes(c.type) || !night) newWander(c, 10);
          if (c.d.sea && (c.stuck = (c.stuck || 0) + dt) > 1.2) {
            const p = deeper(c);
            c.stuck = 0; c.retreat = 5 + Math.random() * 3; c.rx = p.x; c.rz = p.z; c.fails = (c.fails || 0) + 1;
          } else if (!c.d.sea && !c.d.npc && faceT && tg.includes(faceT) && (c.stuck = (c.stuck || 0) + dt) > 2.5) {
            // Animal de tierra que no puede llegar (te metiste al agua o en casa): deja de perseguirte y se va
            c.stuck = 0; c.aggro = 0; c.calm = 6 + Math.random() * 4; newWander(c, 14);
          }
        }
      } else {
        c.speedNow = 0;
        if (faceT && Math.hypot(faceT.x - c.x, faceT.z - c.z) < 12) c.yaw += U.angDiff(c.yaw, Math.atan2(faceT.x - c.x, faceT.z - c.z)) * Math.min(1, dt * 6);
      }
      c.y = U.lerp(c.y, G.height(c.x, c.z), Math.min(1, dt * 10));
      animate(c, dt, night);
    }
  };

  // ------------------------------------------------------------------ red
  C.snapshot = () => C.list.map((c) => {
    const a = [c.id, TYPES.indexOf(c.type), Math.round(c.x * 10) / 10, Math.round(c.z * 10) / 10,
      Math.round(c.yaw * 100) / 100, Math.ceil(c.hp), (c.dead ? 1 : 0) | (c.lunge > 0.25 ? 2 : 0) | (c.fear ? 4 : 0) | (c.aggro > 0 ? 8 : 0) | (c.pounce > 0 ? 16 : 0) | (c.fly > 0.5 || (c.type === 'bigcaiman' && c.flyTarget) ? 32 : 0) | (c.special ? 64 : 0)
        | (c.windup > 0 ? 128 : 0) | (c.heavy ? 256 : 0) | (c.stun > 0 ? 512 : 0) | ((c.guardT || 0) > 0 ? 1024 : 0)];
    if (c.type === 'villager' || c.type === 'npc' || c.type === 'dummy' || c.d.human) a.push(c.extra);
    return a;
  });

  C.applySnapshot = function (l) {
    const seen = new Set();
    for (const [id, ti, x, z, yaw, hp, fl, extra] of l) {
      seen.add(id);
      let c = C.byId(id);
      if (!c) { c = C.spawn(TYPES[ti], x, z, id, extra); c.yaw = yaw; }
      c.nx = x; c.nz = z; c.nyaw = yaw; c.hp = hp;
      if (fl & 1 && !c.dead) { c.dead = true; c.deadT = 0; }
      if (fl & 2 && c.lunge <= 0) c.lunge = 0.3;
      c.fear = !!(fl & 4);
      c.aggro = fl & 8 ? 1 : 0;
      c.pounce = fl & 16 ? 1 : 0;
      c.flyNet = !!(fl & 32); c.special = !!(fl & 64);
      const w = !!(fl & 128);
      if (w && !c.windNet) G.Parry.glint(c, !!(fl & 256));
      c.heavyNet = !!(fl & 256);
      c.windNet = w; c.stunNet = !!(fl & 512);
      if (fl & 1024) c.guardNet = Math.max(c.guardNet || 0, 0.15);
    }
    for (let i = C.list.length - 1; i >= 0; i--) if (!seen.has(C.list[i].id)) removeAt(i);
  };

  function updateRemote(dt) {
    const k = 1 - Math.exp(-dt * 10);
    for (const c of C.list) {
      if (c.dead) { animateDeath(c, dt); continue; }
      const ox = c.x, oz = c.z;
      c.x += (c.nx - c.x) * k; c.z += (c.nz - c.z) * k;
      c.yaw += U.angDiff(c.yaw, c.nyaw) * k;
      c.speedNow = U.lerp(c.speedNow, Math.hypot(c.x - ox, c.z - oz) / Math.max(dt, 1e-3), 0.3);
      if (Math.hypot(c.x - ox, c.z - oz) > 1e-3) c.mvYaw = Math.atan2(c.x - ox, c.z - oz);
      let gy = G.height(c.x, c.z);
      if (c.model && gy < -0.3) for (const s of G.Ships.list) if (!s.sinking && Math.hypot(s.x - c.x, s.z - c.z) < (s.def.L || 5) / 2 + 1) { gy = G.Ships.toWorld(s, _deck.set(0, s.def.deckY + 0.02, 0), _deckW).y; break; }
      c.y = U.lerp(c.y, gy, Math.min(1, dt * 10));
      animate(c, dt, nightOf(c.isl));
    }
  }

  C.forEachAlive = (cb) => { for (const c of C.list) if (!c.dead) cb(c); };
  C.targets = targets;
  C.validPos = validPos;
  // Daño a un jugador (local o remoto) desde una criatura o un efecto de área (bosses.js)
  C.hitTarget = function (c, t, amt, cause) {
    amt *= G.Game.diff().dmg;
    if (t.local) G.Player.damage(amt, c, cause);
    else G.Net.send({ t: 'dmgP', to: t.id, amt, cause, sx: c.x, sz: c.z });
  };

  // ------------------------------------------------------------------ zonas de impacto
  // Esferas donde se puede golpear a cada criatura: los animales marinos, a la altura del agua donde se ven
  // (no en el fondo del mar); la serpiente marina, a lo largo de su cuerpo de 14 m, con la cabeza delante
  C.spheres = function (c) {
    const vy = c.vy !== undefined ? c.vy : c.y;
    if (c.d.bigBoss) return G.Bosses.spheres(c);
    if (c.type === 'serpent') {
      const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
      return SERP_BODY.map(([k, dy, r]) => ({ x: c.x + fx * k, y: vy + dy, z: c.z + fz * k, r }));
    }
    // Personas y muñecos de paja: además del cuerpo, la cabeza y las piernas (para acertar en cada zona)
    if (c.model || (c.joints && c.d.dummy)) return [{ x: c.x, y: c.y + c.d.bodyY, z: c.z, r: c.d.hitR }, { x: c.x, y: c.y + 1.68, z: c.z, r: 0.2 }, { x: c.x, y: c.y + 0.38, z: c.z, r: 0.28 }];
    return [{ x: c.x, y: c.d.sea ? vy + (c.type === 'whale' ? 0.9 : 0.1) : c.y + c.d.bodyY, z: c.z, r: c.d.hitR }];
  };
  // Distancia del rayo (o -1) a la criatura
  C.rayHit = function (c, o, d, pad = 0) {
    let best = -1;
    for (const s of C.spheres(c)) {
      const r = s.r + pad, ox = s.x - o.x, oy = s.y - o.y, oz = s.z - o.z, t = ox * d.x + oy * d.y + oz * d.z, c2 = ox * ox + oy * oy + oz * oz;
      let h = -1;
      if (c2 < r * r) h = 0;
      else if (t >= 0) { const d2 = c2 - t * t; if (d2 <= r * r) h = t - Math.sqrt(r * r - d2); }
      if (h >= 0 && (best < 0 || h < best)) best = h;
    }
    return best;
  };
  // Punto al que apuntar (chispas, rayos…): la cabeza en la serpiente
  C.aimPoint = (c) => C.spheres(c)[0];
  // ¿Algún trozo de la criatura está cerca de este punto?
  C.near = (c, x, y, z, extra, dy) => C.spheres(c).some((s) => Math.hypot(s.x - x, s.z - z) < s.r + extra && Math.abs(s.y - y) < dy);
  // Distancia horizontal al trozo más cercano (para los poderes de área)
  C.distTo = (c, x, z) => Math.min(...C.spheres(c).map((s) => Math.hypot(s.x - x, s.z - z)));
  // Jefe cercano para la barra de vida
  C.nearBoss = function () {
    const P0 = G.Player.pos;
    return C.list.find((c) => (c.type === 'boss' || c.type === 'serpent' || /_boss$|_captain$/.test(c.type) || c.d.bigBoss) && !c.dead && Math.hypot(c.x - P0.x, c.z - P0.z) < (c.d.bigBoss ? 70 : 40));
  };
})();
