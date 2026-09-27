// Construcción: pisos, paredes, puertas, techos, cama, fogata y balsa
(function () {
  'use strict';
  const G = window.G, U = G.U;
  const B = (G.Build = { list: [], byKey: new Map(), ghost: null, ghostType: null, rotIdx: 0, lights: [], time: 0 });
  const GRID = 3;
  let mats, smokeTex;

  B.init = function (scene) {
    const wood = U.canvasTex(256, 256, (c, w, h) => {
      const planks = 6;
      for (let i = 0; i < planks; i++) {
        const y0 = i * h / planks;
        c.fillStyle = `hsl(28, ${38 + Math.random() * 14}%, ${33 + Math.random() * 10}%)`;
        c.fillRect(0, y0, w, h / planks);
        for (let k = 0; k < 40; k++) {
          c.strokeStyle = `rgba(40,25,10,${0.08 + Math.random() * 0.15})`;
          c.lineWidth = 1;
          c.beginPath();
          const yy = y0 + Math.random() * h / planks;
          c.moveTo(0, yy);
          c.bezierCurveTo(w * 0.3, yy + (Math.random() - 0.5) * 6, w * 0.7, yy + (Math.random() - 0.5) * 6, w, yy + (Math.random() - 0.5) * 3);
          c.stroke();
        }
        c.fillStyle = 'rgba(25,15,5,0.7)'; c.fillRect(0, y0, w, 2);
        c.fillStyle = 'rgba(30,30,30,.6)'; c.fillRect(8, y0 + 8, 3, 3); c.fillRect(w - 12, y0 + 8, 3, 3);
      }
    });
    const thatch = U.canvasTex(256, 256, (c, w, h) => {
      c.fillStyle = '#a88a4c'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 1400; i++) {
        const x = Math.random() * w, y = Math.random() * h, l = 10 + Math.random() * 25;
        c.strokeStyle = `hsla(${38 + Math.random() * 12},${40 + Math.random() * 20}%,${32 + Math.random() * 30}%,0.8)`;
        c.lineWidth = 1 + Math.random();
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + (Math.random() - 0.5) * 4, y + l); c.stroke();
      }
    });
    smokeTex = B.smokeTex = U.canvasTex(64, 64, (c) => {
      const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(200,200,200,0.55)'); g.addColorStop(1, 'rgba(200,200,200,0)');
      c.fillStyle = g; c.fillRect(0, 0, 64, 64);
    });
    const MSM = (o) => new THREE.MeshStandardMaterial(o);
    mats = B.mats = {
      wood: MSM({ map: wood, roughness: 0.85 }),
      thatch: MSM({ map: thatch, roughness: 1 }),
      stone: MSM({ color: 0x7d786f, roughness: 1, flatShading: true }),
      log: MSM({ color: 0x5c4028, roughness: 0.9 }),
      char: MSM({ color: 0x1c1612, roughness: 1 }),
      straw: MSM({ color: 0xc4ad64, roughness: 1 }),
      cloth: MSM({ color: 0xd9d0bc, roughness: 0.9 }),
      blanket: MSM({ color: 0x7a3a2a, roughness: 0.9 }),
      leather: MSM({ color: 0x9a7048, roughness: 0.9, side: THREE.DoubleSide }),
      fireBase: MSM({ vertexColors: true, roughness: 1, flatShading: true }),
      flame: new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.88, blending: THREE.AdditiveBlending, depthWrite: false }),
      ghostOk: new THREE.MeshBasicMaterial({ color: 0x55ff88, transparent: true, opacity: 0.35, depthWrite: false }),
      ghostBad: new THREE.MeshBasicMaterial({ color: 0xff5555, transparent: true, opacity: 0.35, depthWrite: false }),
    };
    // Reserva fija de luces para las fogatas (evita recompilar sombreadores)
    for (let i = 0; i < 3; i++) {
      const l = new THREE.PointLight(0xff8a3a, 0, 22, 1.7);
      scene.add(l);
      B.lights.push(l);
    }
  };

  function mesh(geo, mat, x = 0, y = 0, z = 0, shadow = true) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = shadow; m.receiveShadow = true;
    return m;
  }

  const BUILDERS = {
    piso() {
      const g = new THREE.Group();
      g.add(mesh(new THREE.BoxGeometry(3, 1, 3), mats.wood, 0, -0.5, 0));
      return g;
    },
    pared() {
      const g = new THREE.Group();
      g.add(mesh(new THREE.BoxGeometry(3, 4, 0.25), mats.wood, 0, 1, 0));
      g.add(mesh(new THREE.BoxGeometry(0.22, 4.05, 0.34), mats.log, -1.4, 1, 0));
      g.add(mesh(new THREE.BoxGeometry(0.22, 4.05, 0.34), mats.log, 1.4, 1, 0));
      return g;
    },
    puerta() {
      const g = new THREE.Group();
      g.add(mesh(new THREE.BoxGeometry(0.9, 4, 0.25), mats.wood, -1.05, 1, 0));
      g.add(mesh(new THREE.BoxGeometry(0.9, 4, 0.25), mats.wood, 1.05, 1, 0));
      g.add(mesh(new THREE.BoxGeometry(1.2, 0.8, 0.25), mats.wood, 0, 2.6, 0));
      g.add(mesh(new THREE.BoxGeometry(0.2, 3.2, 0.34), mats.log, -0.62, 1.1, 0));
      g.add(mesh(new THREE.BoxGeometry(0.2, 3.2, 0.34), mats.log, 0.62, 1.1, 0));
      g.add(mesh(new THREE.BoxGeometry(1.44, 0.2, 0.34), mats.log, 0, 2.2, 0));
      return g;
    },
    techo() {
      const g = new THREE.Group();
      g.add(mesh(new THREE.BoxGeometry(3.3, 0.25, 3.3), mats.thatch, 0, 0.125, 0));
      g.add(mesh(new THREE.BoxGeometry(3.3, 0.14, 0.16), mats.log, 0, -0.04, 0));
      g.add(mesh(new THREE.BoxGeometry(0.16, 0.14, 3.3), mats.log, 0, -0.04, 0));
      return g;
    },
    cama() {
      const g = new THREE.Group();
      g.add(mesh(new THREE.BoxGeometry(1.1, 0.3, 2.1), mats.wood, 0, 0.15, 0));
      g.add(mesh(new THREE.BoxGeometry(1.0, 0.14, 1.9), mats.straw, 0, 0.37, 0));
      g.add(mesh(new THREE.BoxGeometry(0.7, 0.1, 0.35), mats.cloth, 0, 0.49, -0.7));
      g.add(mesh(new THREE.BoxGeometry(1.03, 0.05, 1.15), mats.blanket, 0, 0.46, 0.35));
      return g;
    },
    fogata() {
      // Piedras, troncos y ceniza fusionados en una sola malla con colores por vértice
      const g = new THREE.Group(), parts = [];
      const e = new THREE.Euler(), q = new THREE.Quaternion(), mtx = new THREE.Matrix4(), one = new THREE.Vector3(1, 1, 1);
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const geo = new THREE.DodecahedronGeometry(0.17 + Math.random() * 0.05);
        geo.applyMatrix4(mtx.compose(new THREE.Vector3(Math.cos(a) * 0.55, 0.08, Math.sin(a) * 0.55), q.setFromEuler(e.set(Math.random(), Math.random(), Math.random())), one));
        parts.push(U.colored(geo, 0x7d786f, 0.12));
      }
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const geo = new THREE.CylinderGeometry(0.06, 0.08, 0.9, 6);
        geo.rotateX(1.05); geo.rotateY(a); geo.translate(Math.sin(a) * 0.12, 0.22, Math.cos(a) * 0.12);
        parts.push(U.colored(geo, 0x5c4028, 0.08));
      }
      const ash = new THREE.CylinderGeometry(0.42, 0.42, 0.03, 12); ash.translate(0, 0.02, 0);
      parts.push(U.colored(ash, 0x1c1612, 0.05));
      g.add(mesh(U.merge(parts), mats.fireBase));
      const fl = new THREE.Group();
      fl.position.y = 0.1;
      const flames = [0, 1, 2].map((i) => {
        const c = new THREE.ConeGeometry(0.24 - i * 0.06, 0.8 - i * 0.15, 7, 1, true);
        c.rotateY(i); c.translate(0, 0.38 - i * 0.05, 0);
        return U.colored(c, i ? 0xffd060 : 0xff8a2a, 0);
      });
      fl.add(mesh(U.merge(flames), mats.flame, 0, 0, 0, false));
      g.add(fl);
      g.userData.flames = fl;
      const puffs = [];
      for (let i = 0; i < 4; i++) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0 }));
        s.userData.t = i / 4;
        s.raycast = () => {};
        g.add(s);
        puffs.push(s);
      }
      g.userData.puffs = puffs;
      return g;
    },
    horno() {
      const g = new THREE.Group(), parts = [];
      const rnd = U.rng(Math.floor(Math.random() * 1000));
      for (let ring = 0; ring < 6; ring++) {
        const r = 0.75 - ring * 0.1, y = 0.12 + ring * 0.2;
        const n = Math.max(5, Math.round(12 - ring * 1.2));
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + ring * 0.3;
          if (ring < 3 && Math.abs(U.angDiff(a, 0)) < 0.45) continue; // boca del horno
          const s = new THREE.DodecahedronGeometry(0.16 + rnd() * 0.05);
          s.translate(Math.sin(a) * r, y, Math.cos(a) * r);
          parts.push(U.colored(s, 0x7d766c, 0.15, rnd));
        }
      }
      const chim = new THREE.CylinderGeometry(0.16, 0.2, 0.7, 8); chim.translate(0, 1.45, -0.05);
      parts.push(U.colored(chim, 0x6a635a, 0.1, rnd));
      const inner = new THREE.SphereGeometry(0.62, 12, 8); inner.scale(1, 1.1, 1); inner.translate(0, 0.45, 0);
      parts.push(U.colored(inner, 0x2a2420, 0.05, rnd));
      g.add(mesh(U.merge(parts), mats.fireBase));
      const glow = new THREE.Mesh(new THREE.CircleGeometry(0.28, 12), new THREE.MeshBasicMaterial({ color: 0xff6a20, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
      glow.position.set(0, 0.35, 0.7); g.add(glow);
      g.userData.glow = glow;
      return g;
    },
    banco() {
      const g = new THREE.Group();
      g.add(mesh(new THREE.BoxGeometry(1.8, 0.12, 0.8), mats.wood, 0, 0.9, 0));
      for (const [x, z] of [[-0.8, -0.32], [0.8, -0.32], [-0.8, 0.32], [0.8, 0.32]]) g.add(mesh(new THREE.BoxGeometry(0.1, 0.9, 0.1), mats.log, x, 0.45, z));
      g.add(mesh(new THREE.BoxGeometry(1.6, 0.06, 0.6), mats.wood, 0, 0.3, 0));
      // Sierra, martillo y tablas encima
      const saw = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.012, 0.12), new THREE.MeshStandardMaterial({ color: 0xaab0b6, metalness: 0.7, roughness: 0.3 }));
      saw.position.set(-0.4, 0.97, 0.1); saw.rotation.y = 0.3; g.add(saw);
      g.add(mesh(new THREE.BoxGeometry(0.12, 0.04, 0.12), mats.log, -0.12, 0.98, 0.14));
      g.add(mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 6), mats.log, 0.25, 0.98, -0.1).rotateZ(Math.PI / 2));
      g.add(mesh(new THREE.BoxGeometry(0.1, 0.06, 0.05), mats.stone, 0.42, 0.98, -0.1));
      for (let i = 0; i < 3; i++) g.add(mesh(new THREE.BoxGeometry(0.9, 0.04, 0.16), mats.wood, 0.35, 0.36 + i * 0.045, 0.05 - i * 0.02));
      g.add(mesh(new THREE.BoxGeometry(0.08, 0.28, 0.08), mats.log, 0.75, 1.1, 0.28));
      return g;
    },
    cofre() {
      const g = new THREE.Group();
      g.add(mesh(new THREE.BoxGeometry(0.9, 0.5, 0.6), mats.wood, 0, 0.25, 0));
      g.add(mesh(new THREE.BoxGeometry(0.94, 0.14, 0.64), mats.log, 0, 0.55, 0));
      g.add(mesh(new THREE.BoxGeometry(0.1, 0.12, 0.05), mats.fireBase, 0, 0.45, 0.32));
      return g;
    },
    balsa() {
      const g = new THREE.Group();
      for (let i = 0; i < 7; i++) {
        const l = mesh(new THREE.CylinderGeometry(0.2, 0.2, 4, 8), mats.log, -1.2 + i * 0.4, 0.1, 0);
        l.rotation.x = Math.PI / 2;
        g.add(l);
      }
      for (const z of [-1.4, 0, 1.4]) g.add(mesh(new THREE.BoxGeometry(3, 0.12, 0.2), mats.wood, 0, 0.33, z));
      g.add(mesh(new THREE.CylinderGeometry(0.07, 0.09, 3.6, 7), mats.log, 0, 2.1, 0.3));
      g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.0, 6), mats.log, 0, 3.4, 0.3).rotateZ(Math.PI / 2));
      const sailGeo = new THREE.PlaneGeometry(1.9, 2.4, 6, 6);
      const p = sailGeo.attributes.position;
      for (let i = 0; i < p.count; i++) p.setZ(i, Math.cos(p.getX(i) * 1.4) * 0.25);
      sailGeo.computeVertexNormals();
      g.add(mesh(sailGeo, mats.leather, 0, 2.2, 0.45));
      return g;
    },
  };
  B.BUILDERS = BUILDERS; // también los usa el generador de iconos

  // ------------------------------------------------------------------ utilidades de rejilla
  function cellTerrain(i, j) {
    let mx = -99, mn = 99;
    for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1], [0.5, 0.5]]) {
      const h = G.height((i + a) * GRID, (j + b) * GRID);
      mx = Math.max(mx, h); mn = Math.min(mn, h);
    }
    return [mx, mn];
  }
  function floorTop(i, j) { const f = B.byKey.get('f:' + i + ':' + j); return f ? f.y : null; }
  function cellBase(i, j) { const f = floorTop(i, j); return f !== null ? f : cellTerrain(i, j)[0] + 0.02; }
  function edgeKey(i, j, e) {
    if (e === 0) return 'h:' + i + ':' + j;
    if (e === 2) return 'h:' + i + ':' + (j + 1);
    if (e === 3) return 'v:' + i + ':' + j;
    return 'v:' + (i + 1) + ':' + j;
  }
  const NB = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  B.groundAt = function (x, z) {
    let h = G.height(x, z);
    const f = floorTop(Math.floor(x / GRID), Math.floor(z / GRID));
    if (f !== null) h = Math.max(h, f);
    return h;
  };
  B.hasRoof = (x, z) => B.byKey.has('r:' + Math.floor(x / GRID) + ':' + Math.floor(z / GRID));

  // ------------------------------------------------------------------ planificación
  B.plan = function (type) {
    const P = G.Player;
    const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
    const res = { ok: true, type, rot: 0, reason: '', x: 0, y: 0, z: 0 };
    const fail = (why) => { res.ok = false; res.reason = res.reason || why; };
    if (type === 'piso' || type === 'pared' || type === 'puerta' || type === 'techo') {
      const ax = P.pos.x + fx * 3.2, az = P.pos.z + fz * 3.2;
      const i = Math.floor(ax / GRID), j = Math.floor(az / GRID), cx = (i + 0.5) * GRID, cz = (j + 0.5) * GRID;
      res.i = i; res.j = j;
      const [tmax, tmin] = cellTerrain(i, j);
      if (type === 'piso') {
        res.key = 'f:' + i + ':' + j; res.x = cx; res.z = cz; res.y = tmax + 0.15;
        if (tmin < 0.3) fail('No se puede construir sobre el agua.');
        if (tmax - tmin > 2.2) fail('El terreno es demasiado inclinado.');
      } else if (type === 'techo') {
        res.key = 'r:' + i + ':' + j; res.x = cx; res.z = cz; res.y = cellBase(i, j) + 3;
        let sup = false;
        for (let e = 0; e < 4; e++) if (B.byKey.has(edgeKey(i, j, e))) sup = true;
        for (const [a, b] of NB) if (B.byKey.has('r:' + (i + a) + ':' + (j + b))) sup = true;
        if (!sup) fail('El techo necesita una pared o un techo al lado.');
      } else {
        const lx = ax - cx, lz = az - cz;
        let e;
        if (Math.abs(lx) > Math.abs(lz)) e = lx > 0 ? 1 : 3; else e = lz > 0 ? 2 : 0;
        res.key = edgeKey(i, j, e);
        if (e === 0) { res.x = cx; res.z = j * GRID; }
        else if (e === 2) { res.x = cx; res.z = (j + 1) * GRID; }
        else if (e === 1) { res.x = (i + 1) * GRID; res.z = cz; res.rot = Math.PI / 2; }
        else { res.x = i * GRID; res.z = cz; res.rot = Math.PI / 2; }
        const f1 = floorTop(i, j), f2 = floorTop(i + NB[e][0], j + NB[e][1]);
        if (f1 !== null || f2 !== null) res.y = Math.max(f1 ?? -99, f2 ?? -99);
        else {
          let mx = -99, mn = 99;
          for (let t = -1.5; t <= 1.5; t += 0.75) {
            const h = res.rot ? G.height(res.x, res.z + t) : G.height(res.x + t, res.z);
            mx = Math.max(mx, h); mn = Math.min(mn, h);
          }
          res.y = mx + 0.02;
          if (mn < 0.3) fail('No se puede construir sobre el agua.');
        }
      }
    } else if (type === 'fogata' || type === 'cama' || type === 'horno' || type === 'cofre' || type === 'banco') {
      const x = P.pos.x + fx * 2.3, z = P.pos.z + fz * 2.3;
      res.x = x; res.z = z; res.y = B.groundAt(x, z);
      res.rot = Math.round(P.yaw / (Math.PI / 2)) * (Math.PI / 2) + B.rotIdx * Math.PI / 2;
      if (res.y < 0.3 || G.World.inLakeWater(x, z)) fail('No se puede colocar en el agua.');
      for (const s of B.list) if (s.type === 'balsa' && Math.hypot(s.x - x, s.z - z) < 2.5) fail('Demasiado cerca de la balsa.');
      const o = clash(res, null);
      if (o) fail(o.type === 'pared' || o.type === 'puerta' ? 'Atravesaría ' + EL[o.type] + ': apártate un poco o gíralo con R.' : o.type === 'piso' ? 'El borde del piso está en medio.' : 'Chocaría con ' + EL[o.type] + '.');
      const r = resIn(res, false);
      if (r) fail(resWhy(r));
    } else if (type === 'balsa') {
      const x = P.pos.x + fx * 4.5, z = P.pos.z + fz * 4.5;
      const h = G.height(x, z);
      res.x = x; res.z = z; res.y = 0.05; res.rot = Math.atan2(x, z);
      if (G.World.waterLevelAt(x, z) > 0) fail('La balsa debe ir en el mar, no en el lago.');
      else if (h > 0.05 || h < -3) fail('Apunta a la orilla del mar: agua poco profunda.');
    }
    if (res.ok && res.key && B.byKey.has(res.key)) fail('Ya hay algo construido ahí.');
    if (res.ok && GRIDP.includes(type)) {
      const o = clash(res, FURN);
      if (o) fail('Quita primero ' + EL[o.type] + ': estorba ahí.');
      const r = resIn(res, type === 'techo');
      if (r) fail(resWhy(r));
    }
    return res;
  };

  // ------------------------------------------------------------------ colisiones
  function box(cx, cz, hx, hz, y0, y1, walk) { return { x0: cx - hx, x1: cx + hx, z0: cz - hz, z1: cz + hz, y0, y1, walk: !!walk }; }
  function computeBoxes(s) {
    const { x, y, z } = s;
    const swap = Math.abs(Math.sin(s.rot)) > 0.5;
    switch (s.type) {
      case 'piso': return [box(x, z, 1.5, 1.5, y - 1, y, true)];
      case 'techo': return [box(x, z, 1.65, 1.65, y, y + 0.25, true)];
      case 'pared': return [swap ? box(x, z, 0.15, 1.5, y - 1, y + 3) : box(x, z, 1.5, 0.15, y - 1, y + 3)];
      case 'puerta': {
        const out = [];
        for (const o of [-1.05, 1.05]) out.push(swap ? box(x, z + o, 0.15, 0.45, y - 1, y + 3) : box(x + o, z, 0.45, 0.15, y - 1, y + 3));
        out.push(swap ? box(x, z, 0.15, 0.6, y + 2.2, y + 3) : box(x, z, 0.6, 0.15, y + 2.2, y + 3));
        return out;
      }
      case 'cama': return [swap ? box(x, z, 1.05, 0.55, y, y + 0.45, true) : box(x, z, 0.55, 1.05, y, y + 0.45, true)];
      case 'fogata': return [box(x, z, 0.45, 0.45, y, y + 0.3)];
      case 'horno': return [box(x, z, 0.8, 0.8, y, y + 1.3)];
      case 'banco': return [swap ? box(x, z, 0.42, 0.92, y, y + 0.97, true) : box(x, z, 0.92, 0.42, y, y + 0.97, true)];
      case 'cofre': return [swap ? box(x, z, 0.32, 0.47, y, y + 0.62, true) : box(x, z, 0.47, 0.32, y, y + 0.62, true)];
      default: return [];
    }
  }
  // ------------------------------------------------------------------ que nada se atraviese
  const FURN = ['fogata', 'cama', 'horno', 'cofre', 'banco'], GRIDP = ['piso', 'pared', 'puerta', 'techo'];
  const EL = { cama: 'la cama', fogata: 'la fogata', horno: 'el horno', cofre: 'el cofre', banco: 'el banco de trabajo', pared: 'la pared', puerta: 'la puerta', piso: 'el piso', techo: 'el techo' };
  // Primera construcción cuyas cajas de choque se meten en las de la pieza 'pl' (solo los tipos de 'only', si se da)
  function clash(pl, only, skip) {
    const mine = computeBoxes(pl), pad = 0.04;
    for (const s of B.list) {
      if (s === skip || (only && !only.includes(s.type)) || Math.abs(s.x - pl.x) > 7 || Math.abs(s.z - pl.z) > 7) continue;
      const step = s.type === 'piso' ? 0.35 : 0.05; // pisar el borde de un piso apenas más alto no cuenta
      for (const a of mine) for (const b of s.boxes)
        if (a.x0 < b.x1 - pad && a.x1 > b.x0 + pad && a.z0 < b.z1 - pad && a.z1 > b.z0 + pad && a.y0 < b.y1 - step && a.y1 > b.y0 + 0.05) return s;
    }
    return null;
  }
  // Árbol, roca o arbusto (vivo) dentro de la pieza; para el techo solo cuentan los árboles
  function resIn(pl, treesOnly) {
    const bx = computeBoxes(pl);
    let hit = null;
    G.Res.query(pl.x, pl.z, 5, (r) => {
      if (hit || !r.alive || !r.k.solid || (treesOnly && !r.k.tree)) return;
      const rr = (r.k.r || 0.5) * r.s * 0.8;
      for (const b of bx) if (boxDist(b, r.x, r.z) < rr) { hit = r; return; }
    });
    return hit;
  }
  // Distancia de un punto a una caja vista desde arriba (0 si está dentro)
  const boxDist = (b, x, z) => Math.hypot(x - Math.max(b.x0, Math.min(x, b.x1)), z - Math.max(b.z0, Math.min(z, b.z1)));
  const resWhy = (r) => r.k.tree ? 'Hay un árbol en medio: tálalo primero.' : r.k.bush ? 'Hay un arbusto en medio: busca otro sitio.' : 'Hay una roca en medio: pícala primero.';
  // ¿Alguna construcción ocupa este círculo? (para que un árbol no vuelva a crecer dentro de una casa)
  B.occupied = function (x, z, rad) {
    let hit = false;
    B.forBoxesNear(x, z, rad, (b) => { if (!hit && boxDist(b, x, z) < rad) hit = true; });
    return hit;
  };
  // Partidas guardadas antes de este arreglo: saca los muebles que quedaron metidos en una pared
  B.unclip = function () {
    let moved = 0;
    for (const s of B.list) {
      if (!FURN.includes(s.type)) continue;
      const w = clash(s, ['pared', 'puerta'], s);
      if (!w) continue;
      const ox = s.x, oz = s.z, oy = s.y, thinX = Math.abs(Math.sin(w.rot)) > 0.5;
      const b = s.boxes[0], half = thinX ? (b.x1 - b.x0) / 2 : (b.z1 - b.z0) / 2;
      const d = thinX ? s.x - w.x : s.z - w.z, first = d >= 0 ? 1 : -1;
      let ok = false;
      for (const sg of [first, -first]) {
        if (thinX) s.x = w.x + sg * (half + 0.22); else s.z = w.z + sg * (half + 0.22);
        s.y = B.groundAt(s.x, s.z);
        s.boxes = computeBoxes(s);
        if (s.y > 0.3 && !clash(s, null, s)) { ok = true; break; }
      }
      if (!ok) { s.x = ox; s.z = oz; s.y = oy; s.boxes = computeBoxes(s); continue; }
      s.group.position.set(s.x, s.y, s.z);
      const sp = G.state.spawn;
      if (s.type === 'cama' && sp && Math.hypot(sp.x - ox, sp.z - oz) < 0.5) G.state.spawn = { x: s.x, z: s.z };
      moved++;
    }
    return moved;
  };
  B.forBoxesNear = function (x, z, rad, cb) {
    for (const s of B.list) {
      if (Math.abs(s.x - x) > rad + 3 || Math.abs(s.z - z) > rad + 3) continue;
      for (const b of s.boxes) cb(b, s);
    }
  };
  B.blocked = function (x, z, r) {
    let hit = false;
    B.forBoxesNear(x, z, r, (b) => {
      if (!hit && x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r && b.y1 - b.y0 > 0.8) hit = true;
    });
    return hit;
  };

  // ------------------------------------------------------------------ colocar / quitar
  B.place = function (pl, fromSave) {
    const g = BUILDERS[pl.type]();
    g.position.set(pl.x, pl.y, pl.z);
    g.rotation.y = pl.rot;
    G.scene.add(g);
    g.updateMatrixWorld(true);
    const id = pl.id || (G.Net.myId || 0) + '-' + Date.now().toString(36) + '-' + (++B.counter);
    const s = { id, type: pl.type, x: pl.x, y: pl.y, z: pl.z, rot: pl.rot, key: pl.key || null, group: g, boxes: [], fuel: pl.fuel ?? (pl.type === 'fogata' ? 150 : 0),
      hp: pl.hp ?? B.MAXHP[pl.type] ?? 100, team: pl.team ?? (G.Net.team ?? null) };
    if (pl.type === 'cofre') s.items = (pl.items || new Array(16).fill(null)).slice(0, 16);
    g.traverse((o) => (o.userData.struct = s));
    s.boxes = computeBoxes(s);
    B.list.push(s);
    if (s.key) B.byKey.set(s.key, s);
    if (!fromSave) G.Audio.play(pl.type === 'fogata' ? 'ignite' : 'place');
    return s;
  };
  B.counter = 0;
  B.byId = (id) => B.list.find((s) => s.id === id);
  B.data = (s) => ({ id: s.id, type: s.type, x: s.x, y: s.y, z: s.z, rot: s.rot, key: s.key, fuel: s.fuel, items: s.items, hp: s.hp, team: s.team });
  // Resistencia de cada construcción (modo versus: se pueden destruir si está activado)
  B.MAXHP = { piso: 220, pared: 260, puerta: 220, techo: 160, cama: 80, fogata: 60, horno: 300, cofre: 150, banco: 150 };
  // Construcciones recibidas por red
  B.applyPlace = function (d) {
    if (B.byId(d.id) || (d.key && B.byKey.has(d.key))) return;
    B.place(d, true);
    G.Audio.playAt(d.type === 'fogata' ? 'ignite' : 'place', d.x, d.z);
  };
  B.applyRemove = function (id) {
    const s = B.byId(id);
    if (s) { B.remove(s, false); G.Audio.playAt('place', s.x, s.z); }
  };

  B.remove = function (s, refund) {
    G.scene.remove(s.group);
    s.group.traverse((o) => { if (o.isMesh && o.geometry) o.geometry.dispose(); });
    B.list.splice(B.list.indexOf(s), 1);
    if (s.key) B.byKey.delete(s.key);
    if (refund) {
      const rec = G.RECIPES.find((r) => r.id === s.type);
      if (rec) for (const [id, n] of Object.entries(rec.req)) { const k = Math.floor(n / 2); if (k > 0) G.Game.give(id, k); }
      G.Audio.play('place');
    }
  };
  B.clear = function () { while (B.list.length) B.remove(B.list[0], false); };

  B.nearestLitFire = function (x, z) {
    let best = null, bd = 1e9;
    for (const s of B.list) {
      if (s.type !== 'fogata' || s.fuel <= 0) continue;
      const d = Math.hypot(s.x - x, s.z - z);
      if (d < bd) { bd = d; best = s; }
    }
    return best ? { s: best, d: bd } : null;
  };

  // ------------------------------------------------------------------ fantasma de colocación
  B.updateGhost = function (type) {
    if (type !== B.ghostType) {
      if (B.ghost) { G.scene.remove(B.ghost); B.ghost = null; }
      B.ghostType = type;
      if (type) {
        B.ghost = BUILDERS[type]();
        B.ghost.traverse((o) => {
          if (o.isMesh) { o.material = mats.ghostOk; o.castShadow = false; o.receiveShadow = false; }
          if (o.isSprite) o.visible = false;
        });
        G.scene.add(B.ghost);
      }
    }
    if (!B.ghost) return null;
    const pl = B.plan(type);
    B.ghost.position.set(pl.x, pl.y, pl.z);
    B.ghost.rotation.y = pl.rot;
    const m = pl.ok ? mats.ghostOk : mats.ghostBad;
    B.ghost.traverse((o) => { if (o.isMesh) o.material = m; });
    return pl;
  };

  // ------------------------------------------------------------------ actualización
  B.update = function (dt) {
    B.time += dt;
    const P = G.Player.pos;
    const lit = [];
    for (const s of B.list) {
      if (s.type === 'fogata') {
        const on = s.fuel > 0;
        // La lluvia consume el fuego al aire libre mucho más rápido
        const wet = G.Weather.intensity > 0.1 && !B.hasRoof(s.x, s.z) && !G.Landmarks.inCave(s.x, s.z) ? G.Weather.intensity * 5 : 0;
        if (on) s.fuel = Math.max(0, s.fuel - dt * (1 + wet));
        const fl = s.group.userData.flames;
        fl.visible = on;
        if (on) {
          const k = U.clamp(s.fuel / 60, 0.45, 1);
          fl.scale.set(k * (1 + Math.sin(B.time * 13 + s.x) * 0.08), k * (1 + Math.sin(B.time * 17 + s.z) * 0.15), k);
          fl.rotation.y += dt * 0.8;
          lit.push(s);
        }
        for (const p of s.group.userData.puffs) {
          p.userData.t = (p.userData.t + dt * 0.25) % 1;
          const t = p.userData.t;
          p.position.set(Math.sin(t * 6 + s.x) * 0.2 * t, 0.8 + t * 3.5, Math.cos(t * 5) * 0.2 * t);
          p.scale.setScalar(0.4 + t * 1.6);
          p.material.opacity = on ? (1 - t) * 0.35 * Math.min(1, t * 6) : 0;
        }
      } else if (s.type === 'horno') {
        s.group.userData.glow.material.opacity = 0.6 + Math.sin(B.time * 7 + s.x) * 0.15 + Math.random() * 0.1;
      } else if (s.type === 'balsa') {
        const wy = G.World.waveHeight(s.x, s.z);
        s.group.position.y = U.lerp(s.group.position.y, Math.max(s.y, wy + 0.18), Math.min(1, dt * 4));
        s.group.rotation.z = (G.World.waveHeight(s.x + 1.5, s.z) - G.World.waveHeight(s.x - 1.5, s.z)) * 0.15;
      }
    }
    lit.sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z));
    B.lights.forEach((l, i) => {
      const s = lit[i];
      if (!s) { l.intensity = 0; return; }
      l.position.set(s.x, s.y + 0.9, s.z);
      l.intensity = (22 + Math.sin(B.time * 11 + i) * 3 + Math.random() * 3) * U.clamp(s.fuel / 60, 0.5, 1);
    });
  };

  B.getState = () => B.list.map(B.data);

  // Daño a construcciones (modo versus con destrucción activada): lo decide el anfitrión
  B.hurt = function (s, dmg, by) {
    if (!s || !G.Modes || !G.Modes.canHurtStruct(s, by)) return;
    if (G.Net.active && !G.Net.isHost) { G.Net.send({ t: 'structHit', id: s.id, dmg, by }); return; }
    s.hp -= dmg;
    G.Audio.playAt('chop', s.x, s.z);
    if (s.hp <= 0) { B.remove(s, false); G.Net.removed(s); G.Audio.playAt('rockbreak', s.x, s.z, 80); }
  };
  B.blast = function (x, y, z, r, dmg, by) {
    for (const s of B.list.slice()) if (Math.hypot(s.x - x, s.z - z) < r + 1.5 && Math.abs(s.y - y) < r + 3) B.hurt(s, dmg, by);
  };
})();
