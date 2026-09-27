// Lugares especiales: cuevas, naufragios, cofres, la aldea Shandara, templos, ruinas, Monoglifos
// y los lugares del mar (naufragios hundidos, submarino, barriles, botellas, remolino y bancos de peces).
(function () {
  'use strict';
  const G = window.G, U = G.U, M = G.Mdl;
  const L = (G.Landmarks = { loot: [], caves: [], circles: [], extra: [], anims: [], lights: [], lightPool: [], whirls: [], schools: [], surfaces: [], roofs: [] });
  const V3 = THREE.Vector3;

  // Botín fijo de los cofres del naufragio de la Isla Perdida (ids 0, 1 y 2) y tablas del resto (con semilla)
  L.LOOT = {
    0: [['lingote', 2], ['cuero', 2], ['agua_limpia', 2], ['cuenco', 1]],
    1: [['carne_cocida', 3], ['antorcha', 1], ['cana', 1], ['venda', 2]],
    2: [['hacha_hierro', 1], ['mineral_hierro', 3], ['cuero', 1], ['hierba', 3]],
  };
  const POOLS = {
    supplies: [['carne_cocida', 2, 4], ['agua_limpia', 1, 3], ['venda', 1, 3], ['antorcha', 1, 2], ['mechero', 1, 1], ['cuerda', 2, 5], ['tabla', 3, 8], ['cuero', 1, 3], ['cataplasma', 1, 2], ['casco_cuero', 1, 1], ['chaqueta_cuero', 1, 1], ['botas_cuero', 1, 1], ['pantalon_cuero', 1, 1]],
    treasure: [['perla', 1, 3], ['doblon', 3, 12], ['lingote', 1, 3], ['clavos', 4, 10], ['polvora', 2, 5], ['bala_canon', 2, 6], ['tela_vela', 1, 2], ['catalejo', 1, 1], ['bicornio', 1, 1], ['coraza_hierro', 1, 1], ['botas_hierro', 1, 1], ['casco_hierro', 1, 1]],
    sunken: [['doblon', 5, 15], ['perla', 1, 2], ['lingote', 2, 4], ['clavos', 4, 8], ['polvora', 2, 6], ['bala_canon', 3, 8], ['cuerda', 2, 4], ['casaca_capitan', 1, 1], ['bicornio', 1, 1], ['casco_buceo', 1, 1], ['aletas', 1, 1]],
    barrel: [['agua_limpia', 1, 3], ['carne_cocida', 1, 2], ['tabla', 2, 5], ['cuerda', 1, 3], ['polvora', 1, 3], ['doblon', 1, 4], ['pez_asado', 1, 3], ['sandalias', 1, 1], ['sombrero_paja', 1, 1], ['pantalon_fibra', 1, 1]],
  };
  L.POOLS = POOLS; // el recetario dice qué hay en cada tipo de cofre
  function rollLoot(rnd, pool, n) {
    const P = POOLS[pool].slice(), out = [];
    for (let i = 0; i < n && P.length; i++) {
      const k = Math.floor(rnd() * P.length), [id, a, b] = P.splice(k, 1)[0];
      out.push([id, a + Math.floor(rnd() * (b - a + 1))]);
    }
    return out;
  }
  // Objetos del cofre en este momento (incluye frutas y fragmentos que la historia o el modo versus colocan ahí)
  L.lootItems = function (id) {
    const base = (L.LOOT[id] || []).slice();
    if (G.Story) base.push(...G.Story.lootExtra(id));
    if (G.Modes) base.push(...G.Modes.lootExtra(id));
    if (G.Treasure) base.push(...G.Treasure.lootExtra(id));
    return base;
  };

  // ------------------------------------------------------------------ materiales compartidos
  let mats;
  function getMats() {
    if (mats) return mats;
    const MSM = (o) => new THREE.MeshStandardMaterial(o);
    const woven = U.canvasTex(128, 128, (c, w, h) => {
      c.fillStyle = '#7a5a34'; c.fillRect(0, 0, w, h);
      for (let i = -h; i < w; i += 10) {
        c.strokeStyle = 'rgba(160,120,70,0.9)'; c.lineWidth = 5; c.beginPath(); c.moveTo(i, 0); c.lineTo(i + h, h); c.stroke();
        c.strokeStyle = 'rgba(60,40,20,0.6)'; c.lineWidth = 2; c.beginPath(); c.moveTo(i + h, 0); c.lineTo(i, h); c.stroke();
      }
    });
    woven.repeat.set(6, 2);
    mats = {
      vc: MSM({ vertexColors: true, roughness: 0.9 }),
      vcFlat: MSM({ vertexColors: true, roughness: 1, flatShading: true }),
      woven: MSM({ map: woven, roughness: 1, side: THREE.DoubleSide }),
      metal: MSM({ vertexColors: true, roughness: 0.55, metalness: 0.5 }),
      glass: new THREE.MeshStandardMaterial({ color: 0x5aa06a, roughness: 0.1, transparent: true, opacity: 0.55 }),
      flame: new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.88, blending: THREE.AdditiveBlending, depthWrite: false }),
      glow: new THREE.MeshBasicMaterial({ color: 0xffb060 }),
    };
    return mats;
  }

  // ------------------------------------------------------------------ luces (reserva fija para no recompilar sombreadores)
  L.addLight = function (x, y, z, color, intensity, dist, extra) {
    L.lights.push({ x, y, z, color, intensity, dist, extra: !!extra, flicker: false });
    return L.lights[L.lights.length - 1];
  };
  function lightPool() {
    for (let i = 0; i < 3; i++) { const l = new THREE.PointLight(0xffffff, 0, 20, 1.5); G.scene.add(l); L.lightPool.push(l); }
  }

  // ------------------------------------------------------------------ construcción base (Isla Perdida)
  L.build = function (scene) {
    lightPool();
    const W = G.World;
    L.caves.push(Object.assign({ base: true, plateau: W.CAVE.plateau, isl: 0, wx: W.CAVE.x, wz: W.CAVE.z }, W.CAVE));
    buildCave(scene, L.caves[0], { rock: 0x6e665c, dark: 0x4a443d, top: 0x4f6a2c, crystals: [0x6fe0ff, 0xb58cff], light: 0x7fc8ff });
    buildWreck(scene);
    // Monoglifo al fondo de la cueva de la Isla Perdida
    const C = L.caves[0], a = C.ent + Math.PI;
    monoglyph('m:perdida', C.wx + Math.sin(a) * C.r * 0.35, C.wz + Math.cos(a) * C.r * 0.35, C.ent, false);
  };

  // surfaces: lo que hay en el escenario (paredes de chozas, cuevas, ruinas…) donde se puede clavar una antorcha
  function track(o) { G.scene.add(o); L.extra.push(o); L.surfaces.push(o); return o; }
  // Piezas de escenario reutilizables (campamentos del prólogo en la Isla Perdida)
  L.kit = () => ({ firePit, tikiTorch, hut, totem, dryingRack, camp, track, mats: getMats, circle: (x, z, r) => circle(x, z, r, true) });
  function add(o, extra) { if (extra) track(o); else { G.scene.add(o); L.surfaces.push(o); } return o; }
  function mesh(geo, mat, extra, shadow = true) { const m = new THREE.Mesh(geo, mat); m.castShadow = shadow; m.receiveShadow = true; return add(m, extra); }
  const circle = (x, z, r, extra, y0 = -99, y1 = 99) => L.circles.push({ x, z, r, extra: !!extra, y0, y1 });

  // ------------------------------------------------------------------ cuevas
  function buildCave(scene, C, pal, extra) {
    const R = C.r, H = C.h;
    const nz = U.makeNoise(77 + (C.isl || 0));
    const src = new THREE.SphereGeometry(1, 60, 22, 0, Math.PI * 2, 0, Math.PI / 2).toNonIndexed();
    const p = src.attributes.position, v = new V3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const k = 1 + nz(v.x * 2.5 + v.y, v.z * 2.5 - v.y) * 0.12 + nz(v.x * 7, v.z * 7 + v.y * 3) * 0.04;
      p.setXYZ(i, v.x * R * k, v.y * H * k - 0.5, v.z * R * k);
    }
    // Recorta un arco de entrada orientado hacia fuera de la montaña
    const pos = [], col = [], c = new THREE.Color(), rock = new THREE.Color(pal.rock), dark = new THREE.Color(pal.dark), moss = new THREE.Color(pal.top);
    for (let t = 0; t < p.count; t += 3) {
      const cx = (p.getX(t) + p.getX(t + 1) + p.getX(t + 2)) / 3, cy = (p.getY(t) + p.getY(t + 1) + p.getY(t + 2)) / 3, cz = (p.getZ(t) + p.getZ(t + 1) + p.getZ(t + 2)) / 3;
      const da = Math.abs(U.angDiff(Math.atan2(cx, cz), C.ent)), w = 0.42;
      if (da < w && cy < H * 0.6 * Math.sqrt(1 - (da / w) ** 2)) continue;
      c.lerpColors(dark, rock, 0.5 + nz(cx * 0.4, cz * 0.4) * 0.5).lerp(moss, U.smooth(0.55, 0.95, cy / H) * 0.6);
      for (let k = 0; k < 3; k++) { pos.push(p.getX(t + k), p.getY(t + k), p.getZ(t + k)); col.push(c.r, c.g, c.b); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    const dome = mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true, side: THREE.DoubleSide }), extra);
    dome.position.set(C.wx, C.plateau, C.wz);

    // Estalactitas, estalagmitas y cristales luminosos
    const rnd = U.rng(404 + (C.isl || 0)), parts = [], crystals = [];
    for (let i = 0; i < 22; i++) {
      const a = rnd() * Math.PI * 2, d = rnd() * R * 0.7;
      const x = Math.sin(a) * d, z = Math.cos(a) * d;
      const ceil = H * Math.sqrt(Math.max(0.05, 1 - (d / R) ** 2)) * 0.9 - 0.5;
      const h = 0.6 + rnd() * 1.8;
      const cone = new THREE.ConeGeometry(0.12 + rnd() * 0.25, h, 6);
      cone.rotateZ(Math.PI); cone.translate(x, ceil - h / 2 + 0.2, z);
      parts.push(U.colored(cone, pal.rock, 0.15, rnd));
      if (i % 3 === 0 && d < R * 0.6) {
        const s = new THREE.ConeGeometry(0.2 + rnd() * 0.2, 0.5 + rnd(), 6);
        s.translate(x + 0.5, 0.25, z + 0.3);
        parts.push(U.colored(s, pal.dark, 0.15, rnd));
      }
    }
    for (let i = 0; i < 8; i++) {
      const a = C.ent + Math.PI + (rnd() - 0.5) * 3.6, d = R * (0.62 + rnd() * 0.12);
      const x = Math.sin(a) * d, z = Math.cos(a) * d;
      for (let k = 0; k < 4; k++) {
        const o = new THREE.OctahedronGeometry(0.12 + rnd() * 0.15);
        o.scale(0.6, 2.2, 0.6); o.rotateZ((rnd() - 0.5) * 0.9); o.rotateX((rnd() - 0.5) * 0.9);
        o.translate(x + (rnd() - 0.5) * 0.5, 0.2 + rnd() * 0.3, z + (rnd() - 0.5) * 0.5);
        crystals.push(U.colored(o, pal.crystals[i % pal.crystals.length], 0.1, rnd));
      }
    }
    const deco = mesh(U.merge(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }), extra);
    deco.position.copy(dome.position);
    const cm = mesh(U.merge(crystals), new THREE.MeshStandardMaterial({ vertexColors: true, emissive: pal.crystals[0], emissiveIntensity: 0.9, roughness: 0.2 }), extra, false);
    cm.position.copy(dome.position);
    L.addLight(C.wx - Math.sin(C.ent) * R * 0.4, C.plateau + 1.5, C.wz - Math.cos(C.ent) * R * 0.4, pal.light, 7, 15, extra);
  }
  // Colisión con la pared de la cueva (anillo con hueco en la entrada)
  function caveWall(C, x, z) {
    const dx = x - C.wx, dz = z - C.wz, d = Math.hypot(dx, dz);
    return { d, dx, dz, door: Math.abs(U.angDiff(Math.atan2(dx, dz), C.ent)) < 0.3, Ri: C.r * 0.84, Ro: C.r * 1.1 };
  }
  L.caveAt = (x, z) => L.caves.find((C) => Math.abs(x - C.wx) < C.r && Math.abs(z - C.wz) < C.r && Math.hypot(x - C.wx, z - C.wz) < C.r * 0.82) || null;
  L.inCave = (x, z) => !!L.caveAt(x, z);
  // Bajo el tejado de una choza (no te mojas y las antorchas no se apagan con la lluvia)
  L.underRoof = (x, z) => L.roofs.some((r) => Math.hypot(x - r.x, z - r.z) < r.r);
  L.nearestCave = (x, z) => { let b = L.caves[0], bd = 1e9; for (const C of L.caves) { const d = Math.hypot(x - C.wx, z - C.wz); if (d < bd) { bd = d; b = C; } } return b; };
  L.blocks = (x, z) => {
    for (const C of L.caves) {
      if (Math.abs(x - C.wx) > C.r * 1.5 || Math.abs(z - C.wz) > C.r * 1.5) continue;
      const w = caveWall(C, x, z);
      if (!w.door && w.d > w.Ri - 0.3 && w.d < w.Ro + 0.3) return true;
    }
    return L.circles.some((c) => c.y1 > 0 && Math.abs(x - c.x) < c.r && Math.hypot(x - c.x, z - c.z) < c.r);
  };
  L.collide = function (pos, rad) {
    for (const C of L.caves) {
      if (Math.abs(pos.x - C.wx) > C.r * 1.5 || Math.abs(pos.z - C.wz) > C.r * 1.5) continue;
      const w = caveWall(C, pos.x, pos.z);
      if (!w.door && w.d > 0.01 && w.d > w.Ri - rad && w.d < w.Ro + rad) {
        const target = w.d < (w.Ri + w.Ro) / 2 ? w.Ri - rad : w.Ro + rad;
        pos.x = C.wx + (w.dx / w.d) * target; pos.z = C.wz + (w.dz / w.d) * target;
      }
    }
    for (const c of L.circles) {
      if (pos.y < c.y0 || pos.y > c.y1) continue;
      const dx = pos.x - c.x, dz = pos.z - c.z;
      if (Math.abs(dx) > c.r + rad || Math.abs(dz) > c.r + rad) continue;
      const d = Math.hypot(dx, dz), rr = c.r + rad;
      if (d < rr && d > 1e-4) { pos.x = c.x + (dx / d) * rr; pos.z = c.z + (dz / d) * rr; }
    }
  };

  // ------------------------------------------------------------------ casco de barco naufragado (en la playa o hundido)
  function wreckHull(rnd, sunk) {
    const wood = G.Build.mats.wood.clone();
    wood.color = new THREE.Color(sunk ? 0x5a6a58 : 0x9a8270);
    wood.side = THREE.DoubleSide;
    const dark = new THREE.MeshStandardMaterial({ color: sunk ? 0x2e3a2e : 0x4a3626, roughness: 0.95 });
    const grp = new THREE.Group();
    const hull = new THREE.SphereGeometry(1, 30, 14, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).toNonIndexed();
    hull.scale(2.4, 1.9, 7.5);
    const hp = hull.attributes.position, uv = hull.attributes.uv, keepP = [], keepU = [];
    for (let t = 0; t < hp.count; t += 3) {
      const cx = (hp.getX(t) + hp.getX(t + 1) + hp.getX(t + 2)) / 3, cz = (hp.getZ(t) + hp.getZ(t + 1) + hp.getZ(t + 2)) / 3, cy = (hp.getY(t) + hp.getY(t + 1) + hp.getY(t + 2)) / 3;
      if (cx > 0.8 && cz > -2.5 && cz < 1.5 && cy > -1.3) continue; // boquete lateral
      if (cz > 5.2 && rnd() < 0.5) continue; // proa destrozada
      for (let k = 0; k < 3; k++) { keepP.push(hp.getX(t + k), hp.getY(t + k), hp.getZ(t + k)); keepU.push(uv.getX(t + k) * 6, uv.getY(t + k) * 3); }
    }
    const hg = new THREE.BufferGeometry();
    hg.setAttribute('position', new THREE.Float32BufferAttribute(keepP, 3));
    hg.setAttribute('uv', new THREE.Float32BufferAttribute(keepU, 2));
    hg.computeVertexNormals();
    const addM = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
      const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
      m.castShadow = true; m.receiveShadow = true; grp.add(m); return m;
    };
    addM(hg, wood, 0, 0, 0);
    addM(new THREE.BoxGeometry(0.3, 0.35, 14.5), dark, 0, -1.85, 0);
    for (let i = 0; i < 7; i++) {
      const rib = new THREE.TorusGeometry(1, 0.07, 6, 18, Math.PI);
      rib.rotateZ(Math.PI); rib.scale(2.35, 1.85, 1);
      addM(rib, dark, 0, 0, -5.4 + i * 1.8);
    }
    for (let i = 0; i < 5; i++) addM(new THREE.BoxGeometry(4.2 - Math.abs(i - 2) * 0.6, 0.08, 0.35), wood, (rnd() - 0.5) * 0.3, -0.05, -3 + i * 1.4 + rnd() * 0.5, 0, (rnd() - 0.5) * 0.3, 0);
    if (sunk) {
      // Mástil roto que apunta hacia la superficie y algas
      addM(new THREE.CylinderGeometry(0.16, 0.2, 7, 8), dark, 0, 2.5, 1.5, 0.35, 0, 0.1);
      const weeds = [];
      for (let i = 0; i < 26; i++) {
        const x = (rnd() - 0.5) * 6, z = (rnd() - 0.5) * 16, h = 1 + rnd() * 2.2;
        weeds.push(M.tube([[x, -1.9, z], [x + 0.2, -1.9 + h * 0.5, z + 0.1], [x - 0.1, -1.9 + h, z]], [0.05, 0.015], 4, 0x3a6a2a, 6));
      }
      addM(U.merge(weeds), getMats().vc, 0, 0, 0);
    }
    return grp;
  }

  function buildWreck(scene) {
    const Wr = G.World.WRECK, y0 = G.height(Wr.x, Wr.z);
    const rnd = U.rng(88);
    const grp = wreckHull(rnd, false);
    grp.position.set(Wr.x, y0 + 1.25, Wr.z);
    grp.rotation.set(0, Wr.rot, 0.3);
    scene.add(grp);
    const dark = new THREE.MeshStandardMaterial({ color: 0x4a3626, roughness: 0.95 });
    // Mástil caído y vela rota sobre la arena
    const mx = Wr.x + Math.cos(Wr.rot) * 4.5, mz = Wr.z - Math.sin(Wr.rot) * 4.5;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 11, 8), dark);
    mast.position.set(mx, G.height(mx, mz) + 0.15, mz);
    mast.rotation.set(Math.PI / 2, 0, 0); mast.rotation.y = Wr.rot + 0.5;
    mast.castShadow = true;
    scene.add(mast);
    const sail = new THREE.PlaneGeometry(4, 3, 8, 6), sp = sail.attributes.position;
    for (let i = 0; i < sp.count; i++) sp.setZ(i, Math.sin(sp.getX(i) * 1.3) * 0.25 + Math.cos(sp.getY(i) * 2) * 0.15);
    sail.computeVertexNormals();
    const sm = new THREE.Mesh(sail, new THREE.MeshStandardMaterial({ color: 0xd8cfb8, roughness: 1, side: THREE.DoubleSide }));
    sm.position.set(mx + 1.5, G.height(mx + 1.5, mz) + 0.12, mz + 1);
    sm.rotation.set(-Math.PI / 2 + 0.05, 0, Wr.rot);
    sm.receiveShadow = true;
    scene.add(sm);
    // Colisión aproximada del casco
    const ax = Math.sin(Wr.rot), az = Math.cos(Wr.rot);
    [-4.8, -1.6, 1.6, 4.8].forEach((o) => circle(Wr.x + ax * o, Wr.z + az * o, 2.2));
    L.wreckCircles = L.circles.slice();
    // Cofres del botín alrededor del casco
    const px = Math.cos(Wr.rot), pz = -Math.sin(Wr.rot);
    [[3.6, -3], [-3.8, 1.5], [3.4, 4.2]].forEach(([side, along], id) => {
      const x = Wr.x + px * side + ax * along, z = Wr.z + pz * side + az * along;
      L.loot.push(makeChest(id, x, G.height(x, z), z, Wr.rot + (side > 0 ? -Math.PI / 2 : Math.PI / 2), false));
    });
  }

  function makeChest(id, x, y, z, rot, extra, gold) {
    const g = new THREE.Group();
    g.position.set(x, y - 0.05, z); g.rotation.set(0.05, rot, 0.08);
    const wood = new THREE.MeshStandardMaterial({ color: 0x6a4527, roughness: 0.9 });
    const metal = new THREE.MeshStandardMaterial({ color: gold ? 0xc8a040 : 0x8a7a4a, metalness: 0.6, roughness: 0.45 });
    const box = (w, h, d, m, px, py, pz, parent = g) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(px, py, pz); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o; };
    box(0.9, 0.5, 0.6, wood, 0, 0.25, 0);
    box(0.94, 0.06, 0.64, metal, 0, 0.1, 0);
    box(0.94, 0.06, 0.64, metal, 0, 0.42, 0);
    const lid = new THREE.Group(); lid.position.set(0, 0.5, -0.3); g.add(lid);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 12, 1, false, 0, Math.PI), wood);
    top.rotation.z = Math.PI / 2; top.position.set(0, 0, 0.3); top.castShadow = true; lid.add(top);
    box(0.1, 0.12, 0.05, metal, 0, 0.02, 0.62, lid);
    add(g, extra);
    return { id, kind: 'chest', x, y, z, g, lid, opened: false, extra: !!extra, hitR: 0.65, name: 'Cofre' };
  }
  L.setOpened = function (id, opened) {
    const c = L.loot.find((o) => o.id === id);
    if (!c) return;
    c.opened = opened;
    if (c.lid) c.lid.rotation.x = opened ? -1.9 : 0;
    if (c.kind === 'barrel' || c.kind === 'bottle') c.g.visible = !opened;
  };
  L.resetLoot = function (state) {
    for (const c of L.loot) L.setOpened(c.id, !!(state && state[c.id]));
  };
  L.byId = (id) => L.loot.find((o) => o.id === id);

  // ------------------------------------------------------------------ Monoglifo (bloque de piedra con escritura antigua)
  let glyphTex;
  function glyphTexture() {
    if (glyphTex) return glyphTex;
    const rnd = U.rng(1802);
    glyphTex = U.canvasTex(256, 256, (c, w, h) => {
      c.fillStyle = '#3a1e1c'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 1600; i++) { c.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '120,70,60'},0.12)`; c.fillRect(rnd() * w, rnd() * h, 2, 2); }
      c.strokeStyle = '#b8765e'; c.lineWidth = 3; c.lineCap = 'round';
      for (let row = 0; row < 8; row++) for (let col = 0; col < 7; col++) {
        const x = 22 + col * 32, y = 20 + row * 29;
        c.beginPath();
        const k = Math.floor(rnd() * 6);
        if (k === 0) { c.arc(x, y, 8, 0, Math.PI * (1 + rnd())); }
        else if (k === 1) { c.moveTo(x - 8, y - 8); c.lineTo(x + 8, y + 8); c.moveTo(x + 8, y - 8); c.lineTo(x, y); }
        else if (k === 2) { c.moveTo(x, y - 10); c.lineTo(x, y + 10); c.moveTo(x - 7, y); c.lineTo(x + 7, y - 5); }
        else if (k === 3) { c.rect(x - 7, y - 7, 14, 14); c.moveTo(x, y - 7); c.lineTo(x, y + 7); }
        else if (k === 4) { c.moveTo(x - 9, y + 8); c.lineTo(x, y - 9); c.lineTo(x + 9, y + 8); c.arc(x, y + 2, 3, 0, 7); }
        else { c.arc(x - 3, y - 3, 5, 0, 7); c.moveTo(x + 2, y + 2); c.lineTo(x + 9, y + 9); }
        c.stroke();
      }
    });
    glyphTex.wrapS = glyphTex.wrapT = THREE.ClampToEdgeWrapping;
    return glyphTex;
  }
  function monoglyph(id, x, z, rot, extra, name) {
    const y = G.height(x, z);
    const g = new THREE.Group();
    g.position.set(x, y, z); g.rotation.y = rot;
    const stone = new THREE.MeshStandardMaterial({ map: glyphTexture(), roughness: 0.75, metalness: 0.05, emissive: 0x3a1008, emissiveIntensity: 0.25 });
    const block = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.2, 1.0), stone);
    block.position.y = 1.35; block.castShadow = true; block.receiveShadow = true;
    g.add(block);
    const base = new THREE.Mesh(M.xf(M.paint(new THREE.BoxGeometry(2.2, 0.3, 1.6), 0x5a524a), 0, 0.15, 0), getMats().vcFlat);
    base.receiveShadow = true;
    g.add(base);
    add(g, extra);
    circle(x, z, 1.1, extra);
    const o = { id, kind: 'mono', x, y: y + 1, z, g, opened: false, extra: !!extra, hitR: 1.2, name: name || 'Monoglifo' };
    L.loot.push(o);
    return o;
  }

  // ------------------------------------------------------------------ aldea Shandara (Isla Tahuri)
  function hut(x, z, face, R, H, rnd, chief) {
    const m = getMats(), g = new THREE.Group();
    g.position.set(x, G.height(x, z), z); g.rotation.y = face;
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H, 20, 1, true, 0.45, Math.PI * 2 - 0.9), m.woven);
    wall.position.y = H / 2; wall.castShadow = true; wall.receiveShadow = true; g.add(wall);
    const roofGeo = new THREE.ConeGeometry(R * 1.3, H * 1.25, 20, 1, true);
    const roof = new THREE.Mesh(roofGeo, G.Build.mats.thatch);
    roof.position.y = H + H * 0.6; roof.castShadow = true; g.add(roof);
    // Cara de dentro del tejado (el cono solo se veía desde fuera: dentro parecía que no había techo)
    // (algo de luz propia: por dentro solo le llega la luz rebotada del suelo)
    if (!m.thatchIn) m.thatchIn = new THREE.MeshStandardMaterial({ map: G.Build.mats.thatch.map, emissiveMap: G.Build.mats.thatch.map, emissive: 0x6a5438, emissiveIntensity: 0.35, roughness: 1, side: THREE.BackSide });
    const inner = new THREE.Mesh(roofGeo, m.thatchIn);
    inner.position.y = roof.position.y; inner.receiveShadow = true; g.add(inner);
    L.roofs.push({ x, z, r: R * 1.05 });
    const parts = [];
    // Postes del marco de la puerta, franja de flecos y remate
    for (const s of [-1, 1]) parts.push(M.xf(M.paint(new THREE.CylinderGeometry(0.08, 0.1, H + 0.3, 6), 0x5a4028), Math.sin(s * 0.45) * R, H / 2, Math.cos(s * 0.45) * R));
    for (let i = 0; i < 30; i++) { const a = (i / 30) * Math.PI * 2; parts.push(M.xf(M.paint(new THREE.ConeGeometry(0.08, 0.5, 3), 0xb8964c), Math.sin(a) * R * 1.28, H + 0.15, Math.cos(a) * R * 1.28, Math.PI)); }
    parts.push(M.xf(M.paint(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 6), 0x5a4028), 0, H * 2.1, 0));
    if (chief) {
      for (let i = 0; i < 7; i++) parts.push(M.xf(M.paint(new THREE.ConeGeometry(0.06, 0.7, 4), i % 2 ? 0xc0302a : 0xf0e0b0), Math.sin(i * 0.9) * 0.15, H * 2.6 + 0.2, Math.cos(i * 0.9) * 0.15, (i - 3) * 0.2));
      for (let i = 0; i < 3; i++) parts.push(M.ball(0.14, 0xe8e0c8, Math.sin(i * 0.3 - 0.3) * R * 1.02, H * 0.8, Math.cos(i * 0.3 - 0.3) * R * 1.02, [1, 1.2, 1]));
    }
    // Esterilla y vasijas dentro
    parts.push(M.xf(M.paint(new THREE.CylinderGeometry(R * 0.6, R * 0.6, 0.03, 16), 0xa0303a), 0, 0.03, -R * 0.2));
    parts.push(M.lathe([[0, 0], [0.18, 0.02], [0.24, 0.2], [0.14, 0.4], [0.12, 0.46]], 12, 0xa0582e));
    parts[parts.length - 1].translate(R * 0.5, 0, -R * 0.4);
    const dm = new THREE.Mesh(U.merge(parts), m.vc); dm.castShadow = true; g.add(dm);
    track(g);
    // Colisión: pared circular con hueco de puerta (varios círculos pequeños)
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      if (Math.abs(U.angDiff(a, 0)) < 0.55) continue;
      circle(x + Math.sin(a + face) * R, z + Math.cos(a + face) * R, 0.45, true, -99, 99);
    }
  }
  function totem(x, z, rot) {
    const tex = U.canvasTex(128, 512, (c, w, h) => {
      const cols = ['#a0302a', '#2a7a6a', '#d8a030', '#3a4a8a'];
      for (let s = 0; s < 4; s++) {
        const y0 = s * h / 4;
        c.fillStyle = '#6a4a2c'; c.fillRect(0, y0, w, h / 4);
        c.fillStyle = cols[s]; c.fillRect(0, y0 + 6, w, 14); c.fillRect(0, y0 + h / 4 - 20, w, 14);
        c.fillStyle = '#f2ead8'; c.beginPath(); c.ellipse(w * 0.3, y0 + 45, 14, 10, 0, 0, 7); c.ellipse(w * 0.7, y0 + 45, 14, 10, 0, 0, 7); c.fill();
        c.fillStyle = '#111'; c.beginPath(); c.arc(w * 0.3, y0 + 46, 6, 0, 7); c.arc(w * 0.7, y0 + 46, 6, 0, 7); c.fill();
        c.fillStyle = cols[(s + 1) % 4]; c.fillRect(w * 0.44, y0 + 50, w * 0.12, 30);
        c.fillStyle = '#1a0e08'; c.fillRect(w * 0.25, y0 + 92, w * 0.5, 16);
        c.fillStyle = '#f2ead8'; for (let k = 0; k < 5; k++) c.fillRect(w * 0.27 + k * w * 0.1, y0 + 92, w * 0.05, 7);
      }
    });
    tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(2, 1);
    const g = new THREE.Group();
    g.position.set(x, G.height(x, z), z); g.rotation.y = rot;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 5.2, 12), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
    pole.position.y = 2.6; pole.castShadow = true; g.add(pole);
    const wings = [M.xf(M.fin([[0, 0], [1.6, 0.4], [1.8, -0.2], [0.2, -0.5]], 0.12, 0x2a7a6a), 0.3, 4.9, 0.1), M.xf(M.fin([[0, 0], [-0.2, -0.5], [-1.8, -0.2], [-1.6, 0.4]], 0.12, 0x2a7a6a), -0.3, 4.9, 0.1),
      M.xf(M.paint(new THREE.ConeGeometry(0.2, 0.5, 4), 0xd8a030), 0, 4.95, 0.55, Math.PI / 2)];
    const w = new THREE.Mesh(U.merge(wings), getMats().vc); w.castShadow = true; g.add(w);
    track(g);
    circle(x, z, 0.6, true);
  }
  function firePit(x, z, withLight) {
    const g = new THREE.Group(), y = G.height(x, z);
    g.position.set(x, y, z);
    const parts = [];
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; parts.push(M.xf(M.paint(new THREE.DodecahedronGeometry(0.22), 0x6d685f), Math.cos(a) * 0.9, 0.1, Math.sin(a) * 0.9, i, i * 2, 0)); }
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; parts.push(M.xf(M.paint(new THREE.CylinderGeometry(0.07, 0.09, 1.1, 6), 0x4a3020), Math.sin(a) * 0.15, 0.3, Math.cos(a) * 0.15, 1.0, a, 0)); }
    const base = new THREE.Mesh(U.merge(parts), getMats().vcFlat); base.castShadow = true; g.add(base);
    const fl = new THREE.Mesh(U.merge([0, 1, 2].map((i) => { const c = new THREE.ConeGeometry(0.36 - i * 0.09, 1.1 - i * 0.2, 7, 1, true); c.rotateY(i); c.translate(0, 0.6 - i * 0.05, 0); return U.colored(c, i ? 0xffd060 : 0xff8a2a, 0); })), getMats().flame);
    g.add(fl);
    track(g);
    L.anims.push({ kind: 'fire', o: fl, t: Math.random() * 10 });
    if (withLight) { const l = L.addLight(x, y + 1.2, z, 0xff8a3a, 22, 24, true); l.flicker = true; }
    circle(x, z, 1.0, true);
  }
  function tikiTorch(x, z) {
    const g = new THREE.Group(), y = G.height(x, z);
    g.position.set(x, y, z);
    const pole = new THREE.Mesh(U.merge([M.xf(M.paint(new THREE.CylinderGeometry(0.05, 0.07, 2.2, 6), 0x5a4028), 0, 1.1, 0), M.xf(M.lathe([[0.04, 0], [0.14, 0.12], [0.16, 0.35], [0.1, 0.4]], 8, 0x7a5a34), 0, 2.15, 0)]), getMats().vc);
    pole.castShadow = true; g.add(pole);
    const fl = new THREE.Mesh(U.merge([U.colored(new THREE.ConeGeometry(0.12, 0.45, 6, 1, true).translate(0, 0.22, 0), 0xff9a30, 0)]), getMats().flame);
    fl.position.y = 2.55; g.add(fl);
    track(g);
    L.anims.push({ kind: 'fire', o: fl, t: Math.random() * 10, small: true });
  }
  function dugoutCanoe(x, z, rot) {
    const g = M.loft({ z0: -2.2, z1: 2.2, n: 18, m: 12, prof: (t) => ({ rx: 0.42 * Math.sin(Math.PI * U.clamp(t * 1.05, 0.03, 0.97)) ** 0.5, ry: 0.32 * Math.sin(Math.PI * U.clamp(t, 0.05, 0.95)) ** 0.4, y: 0.28 + Math.abs(t - 0.5) * 0.3 }), color: (t, a, ca, sa) => (sa > 0.2 ? 0x3a2a1a : 0x7a5434) });
    const inner = M.xf(M.paint(new THREE.BoxGeometry(0.55, 0.05, 3.4), 0x3a2a1a), 0, 0.52, 0);
    const paddle = M.xf(U.merge([M.paint(new THREE.CylinderGeometry(0.025, 0.025, 1.6, 5), 0x6a4a2c), M.xf(M.paint(new THREE.BoxGeometry(0.18, 0.4, 0.03), 0x6a4a2c), 0, -0.9, 0)]), 0.1, 0.65, 0.5, 0.2, 0, 1.3);
    const m = new THREE.Mesh(U.merge([g, inner, paddle]), getMats().vc);
    m.position.set(x, G.height(x, z), z); m.rotation.y = rot; m.castShadow = true;
    track(m);
  }
  function dryingRack(x, z, rot) {
    const parts = [];
    for (const s of [-1, 1]) parts.push(M.xf(M.paint(new THREE.CylinderGeometry(0.05, 0.06, 1.9, 5), 0x5a4028), s * 1.1, 0.95, 0));
    parts.push(M.xf(M.paint(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 5), 0x5a4028), 0, 1.8, 0, 0, 0, Math.PI / 2));
    for (let i = 0; i < 5; i++) {
      const fx = -0.8 + i * 0.4;
      parts.push(M.xf(M.loft({ z0: -0.22, z1: 0.22, n: 8, m: 8, prof: (t) => ({ rx: 0.05 * Math.sin(Math.PI * t) + 0.01, ry: 0.1 * Math.sin(Math.PI * t) + 0.01, y: 0 }), color: () => 0x9a7a4a }), fx, 1.45, 0, Math.PI / 2, 0, 0));
      parts.push(M.xf(M.fin([[0, 0], [0.12, 0.1], [0.12, -0.1]], 0.02, 0x9a7a4a), fx, 1.18, 0, 0, Math.PI / 2, Math.PI / 2));
    }
    const m = new THREE.Mesh(U.merge(parts), getMats().vc);
    m.position.set(x, G.height(x, z), z); m.rotation.y = rot; m.castShadow = true;
    track(m);
  }
  function buildVillage(isl, rnd) {
    const V = isl.feat.village, cx = V.wx, cz = V.wz;
    const toSea = Math.atan2(cx - isl.x, cz - isl.z);
    firePit(cx, cz, true);
    const n = 6;
    for (let i = 0; i < n; i++) {
      const a = toSea + Math.PI * 0.35 + (i / (n - 1)) * Math.PI * 1.3, d = V.r * 0.66;
      const x = cx + Math.sin(a) * d, z = cz + Math.cos(a) * d;
      hut(x, z, Math.atan2(cx - x, cz - z), 2.3, 2.0, rnd, false);
    }
    // Cofre de la aldea con ropa shandara (dentro de la primera choza)
    { const a = toSea + Math.PI * 0.35, d = V.r * 0.66, hx = cx + Math.sin(a) * d, hz = cz + Math.cos(a) * d, ix = hx + (cx - hx) * 0.2, iz = hz + (cz - hz) * 0.2;
      const vc = makeChest('c:tahuri:aldea', hx + (ix - hx) * 0.1 - (cz - hz) * 0.08, hz + (iz - hz) * 0.1 + (cx - hx) * 0.08, 0, true);
      L.loot.push(vc); L.LOOT[vc.id] = [['tocado_shandara', 1], ['pantalon_cuero', 1], ['sandalias', 1], ['cacao', 3]]; }
    const ca = toSea + Math.PI, chx = cx + Math.sin(ca) * V.r * 0.35, chz = cz + Math.cos(ca) * V.r * 0.35;
    hut(chx, chz, Math.atan2(cx - chx, cz - chz), 3.4, 2.6, rnd, true);
    V.chief = { x: chx + Math.sin(Math.atan2(cx - chx, cz - chz)) * 4.2, z: chz + Math.cos(Math.atan2(cx - chx, cz - chz)) * 4.2 };
    totem(cx + Math.sin(ca + 0.9) * 7, cz + Math.cos(ca + 0.9) * 7, Math.atan2(-Math.sin(ca + 0.9), -Math.cos(ca + 0.9)));
    for (let i = 0; i < 4; i++) { const a = toSea + (i - 1.5) * 0.5; tikiTorch(cx + Math.sin(a) * V.r * 0.9, cz + Math.cos(a) * V.r * 0.9); }
    dryingRack(cx + Math.sin(toSea + 0.6) * 9, cz + Math.cos(toSea + 0.6) * 9, toSea);
    // Canoas en la playa, frente a la aldea
    for (let d = V.r; d < V.r + 60; d += 0.5) {
      const x = cx + Math.sin(toSea) * d, z = cz + Math.cos(toSea) * d;
      if (G.height(x, z) < 1.2) {
        for (const s of [-1, 1]) dugoutCanoe(x + Math.cos(toSea) * s * 3 - Math.sin(toSea) * 2, z - Math.sin(toSea) * s * 3 - Math.cos(toSea) * 2, toSea + s * 0.2);
        break;
      }
    }
    // Empalizada con huecos
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      if (Math.abs(U.angDiff(a, toSea)) < 0.35 || Math.abs(U.angDiff(a, toSea + Math.PI)) < 0.2 || i % 9 === 0) continue;
      const x = cx + Math.sin(a) * (V.r + 3), z = cz + Math.cos(a) * (V.r + 3);
      const st = new THREE.Mesh(M.xf(M.paint(new THREE.CylinderGeometry(0.1, 0.13, 2.4, 6), 0x6a4a2c), 0, 1.2, 0), getMats().vc);
      const tip = new THREE.Mesh(M.xf(M.paint(new THREE.ConeGeometry(0.1, 0.35, 6), 0x7a5a34), 0, 2.55, 0), getMats().vc);
      const gg = new THREE.Group(); gg.add(st, tip); gg.position.set(x, G.height(x, z) - 0.2, z); gg.rotation.z = (rnd() - 0.5) * 0.1;
      st.castShadow = true; track(gg);
    }
  }
  function buildTemple(isl, rnd) {
    const T = isl.feat.temple, cx = T.wx, cz = T.wz;
    const stone = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2, x = Math.sin(a) * 5.2, z = Math.cos(a) * 5.2;
      const broken = rnd() < 0.35, h = broken ? 1.2 + rnd() * 1.2 : 3.4;
      stone.push(M.xf(M.paint(new THREE.CylinderGeometry(0.35, 0.42, h, 10), (px, py) => (py > h * 0.2 && Math.sin(px * 20 + py * 5) > 0.6 ? 0x4a6a2a : 0x8a8474)), x, h / 2, z));
      if (!broken) stone.push(M.xf(M.paint(new THREE.BoxGeometry(1.0, 0.3, 1.0), 0x7a7466), x, h + 0.15, z));
      circle(cx + x, cz + z, 0.5, true);
    }
    // Arco de entrada con lianas
    stone.push(M.xf(M.paint(new THREE.BoxGeometry(5, 0.6, 0.9), 0x7a7466), 0, 3.7, 5.2));
    for (let i = 0; i < 6; i++) stone.push(M.tube([[-2 + i * 0.8, 3.4, 5.6], [-1.9 + i * 0.8, 2.6, 5.7], [-2.05 + i * 0.8, 1.6 + rnd(), 5.65]], [0.04, 0.02], 4, 0x3a6a22, 6));
    stone.push(M.xf(M.paint(new THREE.CylinderGeometry(6.2, 6.4, 0.3, 24), 0x8a8474), 0, 0.05, 0));
    const m = new THREE.Mesh(U.merge(stone), getMats().vcFlat);
    m.position.set(cx, T.plateau, cz); m.castShadow = true; m.receiveShadow = true;
    track(m);
    monoglyph('m:tahuri', cx, cz - 1.2, 0, true);
    const ch = makeChest('c:tahuri:temple', cx + 2.2, G.height(cx + 2.2, cz + 1.5), cz + 1.5, 0.4, true, true);
    L.loot.push(ch);
    L.LOOT[ch.id] = rollLoot(rnd, 'treasure', 3);
  }
  let puffTex;
  function steam(x, y, z, n, color = 0xffffff, rise = 3, size = 2.5) {
    const tex = puffTex || (puffTex = U.canvasTex(64, 64, (c) => { const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); }));
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, transparent: true, depthWrite: false, opacity: 0 }));
      s.raycast = () => {};
      track(s);
      L.anims.push({ kind: 'puff', o: s, t: 0, ph: i / n, x, y, z, rise, size, spread: size * 0.4 });
    }
  }
  function camp(x, z, rot, rnd) {
    // Campamento abandonado de exploradores: tienda de lona, cajas y un cofre
    const g = new THREE.Group();
    g.position.set(x, G.height(x, z), z); g.rotation.y = rot;
    const tent = new THREE.Mesh(M.xf(M.paint(new THREE.ConeGeometry(1.8, 2.2, 4, 1, true), 0xb8a888), 0, 1.1, 0, 0, Math.PI / 4, 0), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }));
    tent.castShadow = true; g.add(tent);
    const bits = [M.xf(M.paint(new THREE.BoxGeometry(0.8, 0.6, 0.6), 0x7a5a34), 2.2, 0.3, 0.5), M.xf(M.paint(new THREE.BoxGeometry(0.6, 0.5, 0.5), 0x6a4a2c), 2.4, 0.85, 0.4, 0, 0.3, 0),
      M.xf(M.paint(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 5), 0x5a4028), 0, 1.3, 0)];
    const bm = new THREE.Mesh(U.merge(bits), getMats().vc); bm.castShadow = true; g.add(bm);
    track(g);
    circle(x, z, 1.6, true);
  }
  function brokenColumn(x, z, h, fallen, rnd) {
    const parts = [];
    const col = (px, py) => (Math.sin(px * 30) * Math.sin(py * 7) > 0.7 ? 0x4a6a2a : 0xb0a894);
    if (fallen) {
      parts.push(M.xf(M.paint(new THREE.CylinderGeometry(0.45, 0.45, h, 14), col), 0, 0.45, 0, 0, 0, Math.PI / 2));
      parts.push(M.xf(M.paint(new THREE.CylinderGeometry(0.5, 0.55, 0.5, 14), 0xa8a08a), 0, 0.25, 0));
    } else {
      parts.push(M.xf(M.paint(new THREE.CylinderGeometry(0.42, 0.48, h, 14, 1), col), 0, h / 2 + 0.3, 0));
      parts.push(M.xf(M.paint(new THREE.BoxGeometry(1.2, 0.3, 1.2), 0x9a927e), 0, 0.15, 0));
      if (h > 4) parts.push(M.xf(M.paint(new THREE.BoxGeometry(1.1, 0.35, 1.1), 0x9a927e), 0, h + 0.45, 0));
    }
    const m = new THREE.Mesh(U.merge(parts), getMats().vcFlat);
    m.position.set(x, G.height(x, z) - 0.05, z); m.rotation.y = rnd() * Math.PI; m.castShadow = true; m.receiveShadow = true;
    track(m);
    if (!fallen) circle(x, z, 0.55, true);
  }
  function buildRuins(isl, rnd) {
    const P = isl.feat.plaza, cx = P.wx, cz = P.wz;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2, x = cx + Math.sin(a) * 17, z = cz + Math.cos(a) * 17;
      const r = rnd();
      brokenColumn(x, z, r < 0.3 ? 1.5 + rnd() * 2 : 5.5, r > 0.85, rnd);
    }
    // Arco monumental, muros derruidos y la cabeza de una estatua gigante
    const arch = [];
    for (const s of [-1, 1]) arch.push(M.xf(M.paint(new THREE.BoxGeometry(1.4, 6, 1.4), 0xa8a08a), s * 3.2, 3, 0));
    arch.push(M.xf(M.paint(new THREE.TorusGeometry(3.2, 0.7, 8, 16, Math.PI), 0xa8a08a), 0, 6, 0, 0, 0, 0, [1, 0.6, 1]));
    const am = new THREE.Mesh(U.merge(arch), getMats().vcFlat);
    const aa = rnd() * Math.PI * 2;
    am.position.set(cx + Math.sin(aa) * 25, G.height(cx + Math.sin(aa) * 25, cz + Math.cos(aa) * 25), cz + Math.cos(aa) * 25);
    am.rotation.y = aa; am.castShadow = true;
    track(am);
    for (const s of [-1, 1]) circle(am.position.x + Math.cos(aa) * s * 3.2, am.position.z - Math.sin(aa) * s * 3.2, 1.0, true);
    const hx = cx + Math.sin(aa + 2.2) * 22, hz = cz + Math.cos(aa + 2.2) * 22;
    const head = [M.xf(M.loft({ z0: -1.6, z1: 1.6, n: 16, m: 16, prof: (t) => ({ rx: 1.4 * Math.sin(Math.PI * U.clamp(t, 0.05, 0.95)) ** 0.5, ry: 1.7 * Math.sin(Math.PI * U.clamp(t, 0.05, 0.95)) ** 0.6, y: 0 }), color: (t, a, ca, sa) => (sa > 0.6 ? 0x5a7a3a : 0xa8a08a) }), 0, 1.5, 0, -Math.PI / 2 + 0.3, 0, 0.4)];
    head.push(M.ball(0.3, 0x3a3630, 0.5, 2.3, 1.05), M.ball(0.3, 0x3a3630, -0.5, 2.3, 1.05), M.xf(M.paint(new THREE.ConeGeometry(0.28, 0.8, 4), 0x9a927e), 0, 1.8, 1.4, Math.PI / 2 + 0.3));
    const hm = new THREE.Mesh(U.merge(head), getMats().vcFlat);
    hm.position.set(hx, G.height(hx, hz) - 0.4, hz); hm.rotation.y = rnd() * Math.PI * 2; hm.castShadow = true;
    track(hm);
    circle(hx, hz, 1.8, true);
    // Suelo de losas del altar
    const tiles = [];
    for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) if (rnd() > 0.2) tiles.push(M.xf(M.paint(new THREE.BoxGeometry(1.9, 0.12, 1.9), rnd() < 0.2 ? 0x8a8474 : 0xb4ac98), i * 2, 0.02, j * 2, 0, (rnd() - 0.5) * 0.08, 0));
    const tm = new THREE.Mesh(U.merge(tiles), getMats().vcFlat);
    tm.position.set(cx, P.plateau, cz); tm.receiveShadow = true;
    track(tm);
    monoglyph('m:ruinas', cx, cz, rnd() * Math.PI * 2, true, 'Gran Monoglifo');
    const ch = makeChest('c:ruinas:altar', cx + 2.5, G.height(cx + 2.5, cz), cz, Math.PI / 2, true, true);
    L.loot.push(ch);
    L.LOOT[ch.id] = rollLoot(rnd, 'treasure', 3);
  }
  function buildCoral(isl, rnd) {
    const parts = [];
    const colors = [0xe06a8a, 0xf0a050, 0x9a6ad8, 0x40c0b0, 0xf0d060];
    for (let i = 0; i < 90; i++) {
      const a = rnd() * Math.PI * 2, d = rnd() * isl.r * 0.9;
      const x = isl.x + Math.cos(a) * d, z = isl.z + Math.sin(a) * d, y = G.height(x, z);
      if (y > -1.2) continue;
      const c = colors[Math.floor(rnd() * colors.length)], k = rnd();
      if (k < 0.4) { // coral ramificado
        for (let b = 0; b < 5; b++) { const h = 0.5 + rnd() * 0.9, ba = rnd() * 6.28; parts.push(M.tube([[x, y, z], [x + Math.cos(ba) * 0.2, y + h * 0.6, z + Math.sin(ba) * 0.2], [x + Math.cos(ba) * 0.35, y + h, z + Math.sin(ba) * 0.35]], [0.06, 0.03], 5, c, 6)); }
      } else if (k < 0.7) { // abanico
        parts.push(M.xf(M.fin([[0, 0], [-0.6, 0.9], [-0.2, 1.2], [0.3, 1.2], [0.7, 0.8]], 0.03, c), x, y, z, 0, rnd() * 6.28, 0));
      } else parts.push(M.ball(0.3 + rnd() * 0.4, c, x, y + 0.1, z, [1, 0.6, 1], 10, 6)); // coral cerebro
    }
    if (parts.length) track(new THREE.Mesh(U.merge(parts), getMats().vc));
  }

  // ------------------------------------------------------------------ islas del archipiélago
  L.buildIsland = function (isl) {
    const rnd = U.rng(isl.seed * 7 + 11), F = isl.feat;
    const chest = (id, x, z, pool, n, gold) => {
      const ch = makeChest(id, x, G.height(x, z), z, rnd() * 6.28, true, gold);
      L.loot.push(ch);
      L.LOOT[id] = rollLoot(rnd, pool, n);
      return ch;
    };
    switch (isl.type) {
      case 'tahuri':
        if (F.village) buildVillage(isl, rnd);
        if (F.temple) buildTemple(isl, rnd);
        break;
      case 'escarcha': {
        const C = Object.assign({ isl: isl.id }, F.cave);
        L.caves.push(C);
        buildCave(G.scene, C, { rock: 0x9fb4c8, dark: 0x6a7e92, top: 0xf4f8fc, crystals: [0x8ae8ff, 0xd8f4ff], light: 0x9ae0ff }, true);
        chest('c:escarcha:cave', C.wx + Math.sin(C.ent + Math.PI) * C.r * 0.5, C.wz + Math.cos(C.ent + Math.PI) * C.r * 0.5, 'treasure', 2, true);
        if (F.ice) monoglyph('m:escarcha', F.ice.wx + F.ice.r * 1.25, F.ice.wz, -Math.PI / 2, true);
        if (F.spring) steam(F.spring.wx, F.spring.level, F.spring.wz, 6, 0xffffff, 3, 2.8);
        const ca = rnd() * Math.PI * 2, cx = C.wx + Math.sin(C.ent) * 18, cz = C.wz + Math.cos(C.ent) * 18;
        if (G.height(cx, cz) > 1) { camp(cx, cz, ca, rnd); chest('c:escarcha:camp', cx + 2, cz - 1.5, 'supplies', 2); L.LOOT['c:escarcha:camp'].push(['gorro_piel', 1], ['botas_nieve', 1]); }
        break;
      }
      case 'brasa': {
        const c = F.crater;
        steam(c.wx, c.lava, c.wz, 10, 0x6a605a, 26, 12);
        steam(c.wx, c.lava, c.wz, 4, 0xff8a40, 6, 4);
        const ra = rnd() * Math.PI * 2, rr = c.rc * 1.45;
        monoglyph('m:brasa', c.wx + Math.sin(ra) * rr, c.wz + Math.cos(ra) * rr, ra + Math.PI, true);
        chest('c:brasa:rim', c.wx + Math.sin(ra + 0.4) * rr, c.wz + Math.cos(ra + 0.4) * rr, 'treasure', 2, true);
        L.LOOT['c:brasa:rim'].push(['botas_lava', 1]);
        for (const lp of F.lava || []) steam(lp.wx, lp.level, lp.wz, 2, 0x8a7a70, 5, 2);
        break;
      }
      case 'ruinas':
        buildRuins(isl, rnd);
        break;
      case 'islote':
        if (rnd() < 0.6) chest('c:islet:' + isl.id, isl.x + (rnd() - 0.5) * isl.r * 0.5, isl.z + (rnd() - 0.5) * isl.r * 0.5, 'treasure', 2);
        break;
      case 'arrecife':
        buildCoral(isl, rnd);
        chest('c:reef', isl.x, isl.z, 'sunken', 3, true);
        break;
    }
  };

  // ------------------------------------------------------------------ lugares del mar
  function submarine(rnd) {
    const g = new THREE.Group();
    const rust = (x, y, z) => (Math.sin(x * 3 + z * 1.7) * Math.sin(y * 4 + z) > 0.45 ? 0x8a4a2a : 0x5a5650);
    const hull = M.lathe([[0, -4.2], [0.55, -3.8], [1.0, -3.0], [1.25, -1.5], [1.25, 2], [1.05, 3.2], [0.55, 3.9], [0, 4.2]], 18, rust);
    hull.rotateX(Math.PI / 2);
    const parts = [hull];
    parts.push(M.xf(M.loft({ z0: -1.1, z1: 1.3, n: 8, m: 12, prof: (t) => ({ rx: 0.5, ry: 0.9, y: 0, pw: 3 }), color: (t, a, ca, sa) => rust(ca, sa, t) }), 0, 1.7, 0.4));
    parts.push(M.xf(M.paint(new THREE.CylinderGeometry(0.07, 0.07, 1.6, 8), 0x3a3834), 0, 3.2, 0.8), M.xf(M.paint(new THREE.BoxGeometry(0.12, 0.12, 0.35), 0x3a3834), 0, 4.0, 0.95));
    for (const s of [-1, 1]) {
      parts.push(M.xf(M.fin([[0, 0], [1.2, 0.2], [1.3, -0.3], [0, -0.5]], 0.06, 0x4a4640), s * 1.1, 0, 2.6, Math.PI / 2, 0, s > 0 ? 0 : Math.PI));
      for (let i = 0; i < 4; i++) {
        parts.push(M.xf(M.paint(new THREE.TorusGeometry(0.18, 0.05, 6, 12), 0x9a8a60), s * 1.2, 0.35, -2 + i * 1.2, 0, Math.PI / 2, 0));
        parts.push(M.xf(M.paint(new THREE.CircleGeometry(0.16, 12), 0x1a3a44), s * 1.23, 0.35, -2 + i * 1.2, 0, s * Math.PI / 2, 0));
      }
    }
    for (let i = 0; i < 3; i++) parts.push(M.xf(M.fin([[0, 0], [0.7, 0.25], [0.75, -0.1], [0, -0.15]], 0.05, 0x6a5a3a), 0, 0, -4.35, 0, 0, i * (Math.PI * 2 / 3)));
    parts.push(M.xf(M.fin([[0, 0], [0.9, 0], [0.8, 1.1], [0.1, 0.9]], 0.06, 0x4a4640), 0, 0.2, -3.6, 0, Math.PI / 2, 0));
    const m = new THREE.Mesh(U.merge(parts), getMats().metal);
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
    return g;
  }
  function barrelGeo() {
    return U.merge([
      M.lathe([[0, 0], [0.26, 0], [0.31, 0.2], [0.33, 0.45], [0.31, 0.7], [0.26, 0.9], [0, 0.9]], 16, (x, y) => (Math.abs(y - 0.12) < 0.04 || Math.abs(y - 0.78) < 0.04 || Math.abs(y - 0.45) < 0.03 ? 0x3a3a3a : Math.sin(Math.atan2(x, 1) * 40) > 0.8 ? 0x5a3a1c : 0x7a5230)),
    ]);
  }
  function bottle(g) {
    const glass = new THREE.Mesh(new THREE.LatheGeometry([[0.001, 0], [0.07, 0], [0.075, 0.02], [0.075, 0.18], [0.05, 0.24], [0.025, 0.28], [0.025, 0.34], [0.001, 0.34]].map(([r, y]) => new THREE.Vector2(r, y)), 14), getMats().glass);
    const inner = new THREE.Mesh(U.merge([M.xf(M.paint(new THREE.CylinderGeometry(0.03, 0.03, 0.14, 8), 0xe8dcb8), 0, 0.1, 0), M.xf(M.paint(new THREE.CylinderGeometry(0.027, 0.022, 0.05, 8), 0x8a6a40), 0, 0.35, 0)]), getMats().vc);
    g.add(glass, inner);
  }
  function seagullTex() {
    return U.canvasTex(64, 32, (c) => {
      c.strokeStyle = '#f4f4f4'; c.lineWidth = 3; c.lineCap = 'round';
      c.beginPath(); c.moveTo(4, 18); c.quadraticCurveTo(16, 6, 32, 16); c.quadraticCurveTo(48, 6, 60, 18); c.stroke();
      c.fillStyle = '#e8e8e8'; c.beginPath(); c.ellipse(32, 17, 4, 3, 0, 0, 7); c.fill();
    });
  }
  let gullTex;
  L.buildSea = function (pois) {
    const rnd = U.rng(G.Arch.seed + 5);
    for (const p of pois) {
      const floor = G.height(p.x, p.z);
      if (p.kind === 'wreck') {
        const grp = wreckHull(rnd, true);
        grp.position.set(p.x, floor + 1.4, p.z); grp.rotation.set(0.12, p.rot, 0.45);
        track(grp);
        const ax = Math.sin(p.rot), az = Math.cos(p.rot);
        [-4.5, 0, 4.5].forEach((o) => circle(p.x + ax * o, p.z + az * o, 2.3, true, -99, floor + 3.5));
        const cx = p.x + Math.cos(p.rot) * 3.5, cz = p.z - Math.sin(p.rot) * 3.5;
        const ch = makeChest(p.id, cx, G.height(cx, cz), cz, p.rot, true, true);
        L.loot.push(ch);
        L.LOOT[p.id] = rollLoot(rnd, 'sunken', 4);
      } else if (p.kind === 'sub') {
        const s = submarine(rnd);
        s.position.set(p.x, floor + 0.7, p.z); s.rotation.set(0.14, p.rot, 0.2);
        track(s);
        const ax = Math.sin(p.rot), az = Math.cos(p.rot);
        [-2.6, 0, 2.6].forEach((o) => circle(p.x + ax * o, p.z + az * o, 1.5, true, -99, floor + 3.5));
        const cx = p.x + Math.cos(p.rot) * 2.4, cz = p.z - Math.sin(p.rot) * 2.4;
        const ch = makeChest(p.id, cx, G.height(cx, cz), cz, p.rot, true, true);
        L.loot.push(ch);
        L.LOOT[p.id] = rollLoot(rnd, 'sunken', 4);
      } else if (p.kind === 'barrel') {
        const g = new THREE.Group();
        const b = new THREE.Mesh(barrelGeo(), getMats().vc);
        b.rotation.z = Math.PI / 2; b.position.set(0.45, 0, 0); b.castShadow = true;
        g.add(b);
        track(g);
        L.loot.push({ id: p.id, kind: 'barrel', x: p.x, y: 0, z: p.z, g, opened: false, extra: true, hitR: 0.9, float: true, bx: p.x, bz: p.z, ph: rnd() * 10, name: 'Barril a la deriva' });
        L.LOOT[p.id] = rollLoot(rnd, 'barrel', 2);
      } else if (p.kind === 'bottle') {
        const g = new THREE.Group();
        bottle(g);
        g.rotation.z = Math.PI / 2 - 0.2;
        track(g);
        L.loot.push({ id: p.id, kind: 'bottle', n: p.n, x: p.x, y: 0, z: p.z, g, opened: false, extra: true, hitR: 0.7, float: true, bx: p.x, bz: p.z, ph: rnd() * 10, name: 'Botella con mensaje' });
      } else if (p.kind === 'whirl') {
        const tex = U.canvasTex(256, 256, (c, w, h) => {
          c.translate(w / 2, h / 2);
          for (let k = 0; k < 5; k++) {
            c.strokeStyle = `rgba(255,255,255,${0.55 - k * 0.08})`; c.lineWidth = 7 - k;
            c.beginPath();
            for (let a = 0; a < Math.PI * 6; a += 0.1) { const r = 6 + a * 6.4; c.lineTo(Math.cos(a + k * 1.25) * r, Math.sin(a + k * 1.25) * r); }
            c.stroke();
          }
        }, true);
        const disc = new THREE.Mesh(new THREE.CircleGeometry(p.r, 48), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, color: 0xdff4ff }));
        disc.rotation.x = -Math.PI / 2; disc.position.set(p.x, 0.12, p.z);
        const hole = new THREE.Mesh(new THREE.CircleGeometry(p.r * 0.25, 24), new THREE.MeshBasicMaterial({ color: 0x06202e, transparent: true, opacity: 0.8, depthWrite: false }));
        hole.rotation.x = -Math.PI / 2; hole.position.set(p.x, 0.1, p.z);
        track(disc); track(hole);
        L.whirls.push({ x: p.x, z: p.z, r: p.r, disc });
      } else if (p.kind === 'school') {
        gullTex = gullTex || seagullTex();
        const gulls = [];
        for (let i = 0; i < 5; i++) {
          const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: gullTex, transparent: true, depthWrite: false }));
          s.scale.set(1.6, 0.8, 1); s.raycast = () => {};
          track(s); gulls.push(s);
        }
        L.schools.push({ x: p.x, z: p.z, r: p.r, gulls, ph: rnd() * 10 });
      }
    }
  };
  // Objetos soltados durante la partida: barril con la carga de un barco hundido o bolsa de quien murió.
  // Los crea quien tiene la autoridad (o el jugador que muere) y se envían a los demás y se guardan.
  L.drops = [];
  L.addDrop = function (d) {
    if (L.byId(d.id)) return;
    const g = new THREE.Group();
    if (d.kind === 'barrel') {
      const b = new THREE.Mesh(barrelGeo(), getMats().vc);
      b.rotation.z = Math.PI / 2; b.position.set(0.45, 0, 0); b.castShadow = true;
      g.add(b);
    } else {
      const sack = new THREE.Mesh(U.merge([M.lathe([[0.001, 0], [0.22, 0.02], [0.3, 0.2], [0.26, 0.42], [0.1, 0.52], [0.13, 0.62], [0.001, 0.64]], 12, (x, y) => (y > 0.5 && y < 0.56 ? 0xc8b070 : 0x8a6a40))]), getMats().vc);
      sack.castShadow = true; g.add(sack);
      g.position.set(d.x, G.height(d.x, d.z), d.z);
    }
    track(g);
    const y = d.kind === 'bag' ? G.height(d.x, d.z) : 0;
    L.loot.push({ id: d.id, kind: d.kind, x: d.x, y, z: d.z, g, opened: false, extra: true, hitR: 0.9, float: d.kind === 'barrel', bx: d.x, bz: d.z, ph: Math.random() * 10, name: d.kind === 'barrel' ? 'Carga de un barco hundido' : 'Bolsa caída' });
    L.LOOT[d.id] = d.items;
    L.drops.push(d);
  };
  function drop(kind, x, z, items) {
    const d = { id: 'drop:' + Date.now().toString(36) + Math.floor(Math.random() * 1000), kind, x, z, items };
    L.addDrop(d);
    G.Net.send({ t: 'drop', d });
  }
  L.dropBarrel = (x, z, items) => drop('barrel', x, z, items.map((it) => [it.id, it.n]));
  L.dropBag = (x, z, items) => drop('bag', x, z, items);
  L.getDrops = () => L.drops.filter((d) => !(G.state.world && G.state.world.loot[d.id]));
  // ¿Hay lava bajo este punto? (cráter y charcos de lava de Isla Brasa)
  L.lavaAt = function (x, z, y) {
    const s = G.Arch.landOf(x, z);
    if (!s || s.type !== 'brasa') return false;
    const F = s.feat, c = F.crater;
    if (c && Math.hypot(x - c.wx, z - c.wz) < c.rc * 0.75 && y < c.lava + 0.4) return true;
    for (const L2 of F.lava || []) if (Math.hypot(x - L2.wx, z - L2.wz) < L2.r && y < L2.level + 0.4) return true;
    return false;
  };
  L.inSchool = (x, z) => L.schools.some((s) => Math.hypot(x - s.x, z - s.z) < s.r);
  L.whirlAt = (x, z) => { for (const w of L.whirls) { const d = Math.hypot(x - w.x, z - w.z); if (d < w.r * 2.2) return { w, d }; } return null; };

  // ------------------------------------------------------------------ limpiar lo generado
  L.clearExtra = function () {
    for (const o of L.extra) {
      G.scene.remove(o);
      o.traverse((m) => { if (m.isMesh || m.isSprite) { if (m.geometry) m.geometry.dispose(); } });
    }
    L.extra = [];
    L.loot = L.loot.filter((c) => !c.extra);
    for (const k of Object.keys(L.LOOT)) if (!['0', '1', '2'].includes(k)) delete L.LOOT[k];
    L.caves = L.caves.filter((c) => c.base);
    L.circles = L.circles.filter((c) => !c.extra);
    L.lights = L.lights.filter((l) => !l.extra);
    L.anims = [];
    L.whirls = [];
    L.schools = [];
    L.drops = [];
    L.roofs = [];
    L.surfaces = L.surfaces.filter((o) => o.parent);
  };

  // ------------------------------------------------------------------ animación por fotograma
  L.update = function (dt, cam) {
    const now = performance.now() / 1000;
    for (const a of L.anims) {
      a.t += dt;
      if (a.kind === 'fire') {
        const k = a.small ? 1 : 1;
        a.o.scale.set(k * (1 + Math.sin(a.t * 13) * 0.08), k * (1 + Math.sin(a.t * 17) * 0.15), k);
        a.o.rotation.y += dt * 0.8;
      } else if (a.kind === 'puff') {
        const u = (a.t * (0.25 / Math.max(1, a.rise / 5)) + a.ph) % 1;
        a.o.position.set(a.x + Math.sin(u * 6 + a.x) * a.spread * u, a.y + u * a.rise, a.z + Math.cos(u * 5) * a.spread * u);
        a.o.scale.setScalar(a.size * (0.4 + u * 1.6));
        a.o.material.opacity = (1 - u) * 0.4 * Math.min(1, u * 6);
      }
    }
    // Barriles y botellas flotando a la deriva
    for (const c of L.loot) {
      if (!c.float || c.opened) continue;
      c.x = c.bx + Math.sin(now * 0.05 + c.ph) * 6; c.z = c.bz + Math.cos(now * 0.04 + c.ph) * 6;
      c.y = G.World.waveHeight(c.x, c.z) - 0.05;
      c.g.position.set(c.x, c.y, c.z);
      c.g.rotation.y = c.ph + now * 0.1;
      c.g.rotation.x = Math.sin(now * 1.3 + c.ph) * 0.12;
    }
    for (const w of L.whirls) w.disc.rotation.z -= dt * 1.4;
    for (const s of L.schools) s.gulls.forEach((g, i) => {
      const a = now * 0.5 + i * 1.25 + s.ph;
      g.position.set(s.x + Math.cos(a) * (8 + i * 2), 9 + Math.sin(now * 2 + i) * 1.5 + i * 0.6, s.z + Math.sin(a) * (8 + i * 2));
    });
    // Luces: se encienden las fuentes más cercanas a la cámara
    if (!cam || !L.lightPool.length) return;
    const near = L.lights.map((l) => ({ l, d: Math.hypot(l.x - cam.x, l.z - cam.z) })).filter((o) => o.d < o.l.dist + 40).sort((a, b) => a.d - b.d);
    L.lightPool.forEach((pl, i) => {
      const o = near[i];
      if (!o) { pl.intensity = 0; return; }
      pl.position.set(o.l.x, o.l.y, o.l.z);
      pl.color.set(o.l.color); pl.distance = o.l.dist;
      pl.intensity = o.l.intensity * (o.l.flicker ? 0.85 + Math.sin(now * 11 + i) * 0.1 + Math.random() * 0.08 : 1);
    });
  };
})();
