// Jefes de isla:
//  - El Rey de la Escarcha: un yeti de tres metros y medio que guarda la cueva de hielo de Isla Escarcha.
//    Puñetazos, un salto que hace temblar el suelo (onda de hielo) y bloques de hielo que lanza desde lejos.
//    Con media vida ruge y llama a los lobos de las nieves.
//  - El Dragón de Brasa: vive junto a las coladas de lava del volcán. Mordisco, aliento de fuego en cono y,
//    malherido, alza el vuelo: da vueltas y escupe bolas de fuego (arriba solo lo alcanzan armas de fuego y poderes).
//  - El Gran Caimán del río: acecha en el lago de la selva de Tahuri con solo los ojos fuera del agua. Embestida
//    con las fauces abiertas, coletazo girando sobre sí mismo y, malherido, se sumerge, se cura y sale de golpe.
//    Con media vida llama a otros caimanes.
// Aparecen desde el día 3 mientras nadie los haya derrotado. El anfitrión decide la IA y el daño; los demás
// reciben los efectos (bossFx) y el estado (vuelo, ataque especial) en la instantánea de criaturas.
(function () {
  'use strict';
  const G = window.G, U = G.U, V3 = THREE.Vector3, Col = THREE.Color;
  const B = (G.Bosses = { proj: [], parts: [], rings: [], breaths: [] });
  const FLY = 9; // altura de vuelo del dragón
  const KINDS = ['yeti', 'lavadragon', 'bigcaiman'];
  B.is = (type) => KINDS.includes(type);
  B.NAMES = { yeti: 'Rey de la Escarcha', lavadragon: 'Dragón de Brasa', bigcaiman: 'Gran Caimán del río' };

  // Los modelos (esqueleto, piel y animación) están en fauna.js y rig.js

  // ------------------------------------------------------------------ zonas de impacto (lo usa creatures.js)
  B.spheres = function (c) {
    const vy = c.vy !== undefined ? c.vy : c.y, fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
    const at = (k, dy, r) => ({ x: c.x + fx * k, y: vy + dy, z: c.z + fz * k, r });
    if (c.type === 'yeti') return [at(0.1, 2.0, 1.0), at(0.45, 3.0, 0.55), at(0, 0.8, 0.7)];
    if (c.type === 'bigcaiman') return [at(3.0, 0.7, 0.6), at(1.8, 0.7, 0.75), at(0.4, 0.6, 1.0), at(-1.4, 0.6, 1.0), at(-3.6, 0.45, 0.6), at(-5.4, 0.3, 0.4)];
    return [at(0.2, 1.75, 1.3), at(2.9, 4.1, 0.65), at(2.2, 3.1, 0.6), at(1.4, 1.9, 1.0), at(-1.3, 1.6, 1.05), at(-3.2, 0.9, 0.6)];
  };

  // ------------------------------------------------------------------ animación extra (lo llama animate() de creatures.js)
  // Devuelve cuánto sube o baja el jefe; los brazos, las alas y la mandíbula los mueve su esqueleto (fauna.js)
  // con c.armUp (brazos en alto), c.fly (vuelo) y c.jawK (mandíbula de 0 a 1)
  B.animate = function (c, dt, now) {
    let off = 0;
    c.pitchOver = null;
    if (c.type === 'yeti') {
      if (c.jumpT !== undefined && c.jumpT < 0.6) { c.jumpT += dt; off += Math.sin(Math.PI * Math.min(1, c.jumpT / 0.6)) * 2.4; }
      // Brazos en alto al preparar el salto o el lanzamiento
      c.armUp = U.lerp(c.armUp || 0, c.special ? 1 : 0, Math.min(1, dt * 8));
      c.jawK = U.lerp(c.jawK || 0, c.special ? 1 : c.lunge > 0 ? Math.sin((c.lunge / 0.3) * Math.PI) : 0, Math.min(1, dt * 10));
    } else if (c.type === 'bigcaiman') {
      // En el lago asoman solo los ojos y el lomo; al esconderse se sumerge del todo
      const wl = G.World.inLakeWater(c.x, c.z) ? G.World.waterLevelAt(c.x, c.z) : null;
      const dive = G.Net.authority() ? !!c.flyTarget : !!c.flyNet;
      c.swimOff = U.lerp(c.swimOff || 0, wl === null ? 0 : Math.max(0, wl - (dive ? 2.6 : 0.78) - c.y), Math.min(1, dt * 3));
      off += c.swimOff;
      const open = c.special ? 1 : c.lunge > 0 ? 0.9 * Math.sin((c.lunge / 0.3) * Math.PI) : 0.05 + Math.max(0, Math.sin(now / 2200 + c.id)) * 0.08;
      c.jawK = U.lerp(c.jawK || 0, open, Math.min(1, dt * 10));
    } else {
      const want = G.Net.authority() ? (c.flyTarget || 0) : (c.flyNet ? 1 : 0);
      c.fly = U.lerp(c.fly || 0, want, Math.min(1, dt * 0.9));
      const fl = U.smooth(0.05, 0.6, c.fly);
      off += c.fly * FLY + Math.sin(now / 420) * 0.4 * fl;
      const open = c.special ? 1 : c.lunge > 0 ? 0.85 * Math.sin((c.lunge / 0.3) * Math.PI) : 0.06;
      c.jawK = U.lerp(c.jawK || 0, open, Math.min(1, dt * 10));
      if (fl > 0.02) c.pitchOver = -0.1 * fl;
    }
    return off;
  };
  // Muerto en el aire: cae al suelo
  B.death = function (c, dt) {
    if (!(c.fly > 0.01)) return;
    c.fly = Math.max(0, c.fly - dt * 0.9);
    c.g.position.y = c.y + c.fly * FLY;
  };

  // ------------------------------------------------------------------ efectos
  let glowTex = null, iceGeo = null, iceMat = null, fireGeo = null, fireMat = null, spikeGeo = null;
  const tex = () => glowTex || (glowTex = U.canvasTex(64, 64, (c) => {
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  }));
  const _c1 = new Col();
  function particle(x, y, z, vx, vy, vz, life, s0, s1, c0, c1) {
    let p = null;
    for (const q of B.parts) if (!q.alive) { p = q; break; }
    if (!p) {
      if (B.parts.length >= 180) return;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      sp.raycast = () => {};
      G.scene.add(sp);
      p = { sp, v: new V3() };
      B.parts.push(p);
    }
    p.alive = true; p.t = 0; p.life = life; p.s0 = s0; p.s1 = s1; p.c0 = c0; p.c1 = c1;
    p.sp.position.set(x, y, z); p.v.set(vx, vy, vz); p.sp.visible = true;
  }
  // Onda de hielo al caer del salto
  function slamFx(x, z) {
    if (!spikeGeo) { spikeGeo = new THREE.ConeGeometry(0.28, 1.6, 5); spikeGeo.translate(0, 0.8, 0); }
    const mat = new THREE.MeshStandardMaterial({ color: 0xbfeaff, emissive: 0x2a6a8a, roughness: 0.15, transparent: true, opacity: 0.9, flatShading: true });
    const grp = new THREE.Group();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2, m = new THREE.Mesh(spikeGeo, mat);
      m.userData.a = a; m.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
      grp.add(m);
    }
    grp.position.set(x, G.height(x, z), z);
    G.scene.add(grp);
    B.rings.push({ grp, mat, t: 0 });
    G.Ships.puff(x, G.height(x, z) + 0.5, z, 0xeaf4ff, 3.5, 1.4, 12);
    G.Audio.playAt('rockbreak', x, z, 120);
    const P = G.Player.pos;
    if (Math.hypot(P.x - x, P.z - z) < 25) G.Player.shake = 0.7;
  }
  // Bloque de hielo o bola de fuego
  function spawnProj(kind, o, v, auth, from) {
    let m;
    if (kind === 'ice') {
      if (!iceGeo) { iceGeo = new THREE.IcosahedronGeometry(0.6, 0); iceMat = new THREE.MeshStandardMaterial({ color: 0xc8eeff, emissive: 0x1a4a6a, roughness: 0.15, flatShading: true }); }
      m = new THREE.Mesh(iceGeo, iceMat);
    } else {
      if (!fireGeo) { fireGeo = new THREE.SphereGeometry(0.45, 12, 10); fireMat = new THREE.MeshBasicMaterial({ color: 0xffb040 }); }
      m = new THREE.Mesh(fireGeo, fireMat);
      const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(), color: 0xff7a20, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      gl.scale.setScalar(2.6); m.add(gl);
    }
    m.position.set(o[0], o[1], o[2]);
    G.scene.add(m);
    B.proj.push({ m, v: new V3(v[0], v[1], v[2]), kind, auth, from, t: 0 });
    G.Audio.playAt(kind === 'ice' ? 'chop' : 'ignite', o[0], o[2], 120);
  }
  function explode(p) {
    const pos = p.m.position, fire = p.kind === 'fire';
    if (fire) { G.Ships.puff(pos.x, pos.y + 0.4, pos.z, 0xff8a30, 3, 0.8, 10); G.Ships.puff(pos.x, pos.y + 1, pos.z, 0x3a3230, 3.5, 2.2, 8); G.Audio.playAt('cannon', pos.x, pos.z, 150); }
    else { G.Ships.puff(pos.x, pos.y + 0.3, pos.z, 0xdff4ff, 2.5, 1.0, 12); G.Audio.playAt('rockbreak', pos.x, pos.z, 120); }
    const P = G.Player.pos;
    if (Math.hypot(P.x - pos.x, P.z - pos.z) < 12) G.Player.shake = Math.max(G.Player.shake || 0, 0.35);
    if (!p.auth) return;
    // Daño en área (lo decide el anfitrión)
    const c = G.Creatures.byId(p.from) || { x: pos.x, z: pos.z, d: { dmg: 0 } };
    const R = fire ? 3.4 : 3.0, dmg = fire ? 22 : 24;
    for (const t of G.Creatures.targets()) {
      if (t.dead || t.ship) continue;
      const d = Math.hypot(t.x - pos.x, t.z - pos.z);
      if (d < R && Math.abs((t.y || 0) - pos.y) < 3.5) G.Creatures.hitTarget({ x: pos.x, z: pos.z, d: c.d }, t, dmg * (1 - d / (R * 2)), fire ? 'Una bola de fuego del Dragón de Brasa te alcanzó' : 'Un bloque de hielo del Rey de la Escarcha te aplastó');
    }
  }
  function send(m) { if (G.Net.active) G.Net.send(Object.assign({ t: 'bossFx' }, m)); }
  function roar(c, big) {
    G.Audio.playAt('roar', c.x, c.z, big ? 220 : 150);
    send({ k: 'roar', id: c.id, big: big ? 1 : 0 });
  }
  // Boca del dragón (en el mundo) y hacia dónde mira
  const _m = new V3();
  function mouth(c) {
    c.head.getWorldPosition(_m);
    const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
    return { x: _m.x + fx * 1.05, y: _m.y - 0.12, z: _m.z + fz * 1.05, fx, fz };
  }
  function lob(kind, o, tx, ty, tz, speed, grav) {
    const d = Math.hypot(tx - o.x, tz - o.z), tf = 0.5 + d / speed;
    return [(tx - o.x) / tf, (ty - o.y) / tf + 0.5 * grav * tf, (tz - o.z) / tf];
  }
  function throwIce(c, t) {
    const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
    const o = { x: c.x + fx * 0.6, y: c.y + 4.3, z: c.z + fz * 0.6 };
    const miss = Math.random() < 0.3 ? 3 : 0.8;
    const v = lob('ice', o, t.x + (Math.random() - 0.5) * miss, (t.y || G.height(t.x, t.z)) + 0.8, t.z + (Math.random() - 0.5) * miss, 26, 9.8);
    spawnProj('ice', [o.x, o.y, o.z], v, true, c.id);
    send({ k: 'proj', kind: 'ice', o: [o.x, o.y, o.z], v, from: c.id });
  }
  function fireball(c, t) {
    const mo = mouth(c);
    const v = lob('fire', mo, t.x + (Math.random() - 0.5) * 2, (t.y || G.height(t.x, t.z)) + 0.5, t.z + (Math.random() - 0.5) * 2, 22, 6);
    spawnProj('fire', [mo.x, mo.y, mo.z], v, true, c.id);
    send({ k: 'proj', kind: 'fire', o: [mo.x, mo.y, mo.z], v, from: c.id });
  }
  function startBreath(c, dur, pitch) {
    B.breaths.push({ c, t: 0, dur, acc: 0, pitch: pitch || 0 });
    G.Audio.playAt('ignite', c.x, c.z, 120);
  }

  // ------------------------------------------------------------------ IA (anfitrión). H: { attack, spawn, valid }
  const tgtById = (tg, id) => tg.find((t) => t.id === id && !t.dead && !t.ship);
  function faceTo(c, t, dt, k = 5) { c.yaw += U.angDiff(c.yaw, Math.atan2(t.x - c.x, t.z - c.z)) * Math.min(1, dt * k); }
  function nearMsg(c, text, kind = 'warn', key = 'boss') {
    const P = G.Player.pos;
    if (Math.hypot(P.x - c.x, P.z - c.z) < 70) G.UI.msg(text, kind, key);
  }
  B.think = function (c, tg, dt, H) {
    const S = c.bs || (c.bs = { st: 'idle', t: 0, a: 2, b: 4, cc: 10 });
    S.t += dt; S.a -= dt; S.b -= dt; S.cc -= dt;
    const out = { tx: c.x, tz: c.z, speed: c.d.speed, moving: false, face: null };
    const home = { x: c.hx ?? c.x, z: c.hz ?? c.z }, R = c.homeR || 24;
    // Objetivo: quien le haya atacado o quien entre en su territorio (no persigue barcos)
    let at = c.aggro > 0 ? tgtById(tg, c.aggroId) : null;
    if (!at) {
      let bd = c.type === 'yeti' ? 20 : c.type === 'bigcaiman' ? 18 : 24;
      for (const t of tg) {
        if (t.dead || t.ship) continue;
        const d = Math.hypot(t.x - c.x, t.z - c.z);
        if (d < bd && Math.hypot(t.x - home.x, t.z - home.z) < R + 12) { bd = d; at = t; }
      }
      if (at) { c.aggroId = at.id; if (!S.seen) { S.seen = true; roar(c); } }
    }
    // Si la presa se aleja demasiado de su guarida, la deja y vuelve
    if (at && Math.hypot(at.x - home.x, at.z - home.z) > R + 24) at = null;
    if (at) c.aggro = 5; else c.aggro = Math.min(c.aggro, 0);
    const o = c.type === 'yeti' ? yeti(c, S, at, home, R, tg, dt, H, out) : c.type === 'bigcaiman' ? caiman(c, S, at, home, R, tg, dt, H, out) : dragon(c, S, at, home, R, tg, dt, H, out);
    if (!c.special) route(c, o, dt, H); // rodea rocas, árboles, agua y paredes por el camino más corto
    return o;
  };

  // ------------------------------------------------------------------ camino más corto (A* en una rejilla alrededor del jefe y su destino)
  const CELL = 1.6, BODY = 1.2;
  // Casillas por las que no cabe: agua, mar, cuevas, chozas, construcciones, rocas y árboles
  function walkGrid(c, cx, cz, half, H) {
    const n = Math.ceil((half * 2) / CELL), x0 = cx - half, z0 = cz - half, blk = new Uint8Array(n * n), hgt = new Float32Array(n * n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = x0 + (i + 0.5) * CELL, z = z0 + (j + 0.5) * CELL, k = j * n + i;
      hgt[k] = G.height(x, z);
      if (!H.valid(c.type, x, z) || G.Build.blocked(x, z, BODY)) blk[k] = 1;
    }
    G.Res.query(cx, cz, half * 1.45, (r) => {
      if (!r.alive || !r.k.solid) return;
      const rr = (r.k.r || 0.5) * r.s + BODY;
      const i0 = Math.max(0, Math.floor((r.x - rr - x0) / CELL)), i1 = Math.min(n - 1, Math.floor((r.x + rr - x0) / CELL));
      const j0 = Math.max(0, Math.floor((r.z - rr - z0) / CELL)), j1 = Math.min(n - 1, Math.floor((r.z + rr - z0) / CELL));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (Math.hypot(x0 + (i + 0.5) * CELL - r.x, z0 + (j + 0.5) * CELL - r.z) < rr) blk[j * n + i] = 1;
    });
    return { n, x0, z0, blk, hgt };
  }
  const cellOf = (g, x, z) => { const i = Math.floor((x - g.x0) / CELL), j = Math.floor((z - g.z0) / CELL); return i < 0 || j < 0 || i >= g.n || j >= g.n ? -1 : j * g.n + i; };
  // ¿Se puede ir en línea recta? (lo que queda fuera de la rejilla cuenta como libre)
  function lineClear(g, ax, az, bx, bz) {
    const d = Math.hypot(bx - ax, bz - az), steps = Math.ceil(d / (CELL * 0.5));
    for (let s = 1; s <= steps; s++) { const k = cellOf(g, ax + ((bx - ax) * s) / steps, az + ((bz - az) * s) / steps); if (k >= 0 && g.blk[k]) return false; }
    return true;
  }
  const NB8 = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
  function astar(g, sx, sz, tx, tz) {
    const { n, blk, hgt } = g, N = n * n, s = cellOf(g, sx, sz);
    if (s < 0) return null;
    blk[s] = 0; // donde está ahora siempre vale (aunque roce una roca)
    const ti = U.clamp(Math.floor((tx - g.x0) / CELL), 0, n - 1), tj = U.clamp(Math.floor((tz - g.z0) / CELL), 0, n - 1), t = tj * n + ti;
    const hf = (k) => { const dx = Math.abs((k % n) - ti), dz = Math.abs(((k / n) | 0) - tj); return dx + dz + (Math.SQRT2 - 2) * Math.min(dx, dz); };
    const gS = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    // Montículo binario de [coste estimado, casilla]
    const hk = [], hv = [];
    const push = (k, f) => { let i = hk.length; hk.push(k); hv.push(f); while (i > 0) { const p = (i - 1) >> 1; if (hv[p] <= hv[i]) break; [hk[p], hk[i]] = [hk[i], hk[p]]; [hv[p], hv[i]] = [hv[i], hv[p]]; i = p; } };
    const pop = () => { const k = hk[0], lk = hk.pop(), lv = hv.pop(); if (hk.length) { hk[0] = lk; hv[0] = lv; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < hk.length && hv[l] < hv[m]) m = l; if (r < hk.length && hv[r] < hv[m]) m = r; if (m === i) break; [hk[m], hk[i]] = [hk[i], hk[m]]; [hv[m], hv[i]] = [hv[i], hv[m]]; i = m; } } return k; };
    gS[s] = 0; push(s, hf(s));
    let best = s, bh = hf(s), it = 0;
    while (hk.length && it++ < 6000) {
      const k = pop();
      if (closed[k]) continue;
      closed[k] = 1;
      if (k === t) { best = k; break; }
      const h = hf(k);
      if (h < bh) { bh = h; best = k; }
      const i = k % n, j = (k / n) | 0;
      for (const [di, dj, cost] of NB8) {
        const ii = i + di, jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= n || jj >= n) continue;
        const kk = jj * n + ii;
        if (blk[kk] || closed[kk] || (di && dj && (blk[j * n + ii] || blk[jj * n + i]))) continue; // sin cortar esquinas
        if (Math.abs(hgt[kk] - hgt[k]) > 1.25 * cost) continue; // demasiado empinado para él
        const ng = gS[k] + cost;
        if (ng < gS[kk]) { gS[kk] = ng; from[kk] = k; push(kk, ng + hf(kk)); }
      }
    }
    // Hasta el destino o, si no se puede llegar, hasta la casilla más cercana a él
    const pts = [];
    for (let k = best; k !== -1 && k !== s; k = from[k]) pts.push({ x: g.x0 + ((k % n) + 0.5) * CELL, z: g.z0 + (((k / n) | 0) + 0.5) * CELL });
    return pts.reverse();
  }
  // Cambia el destino de este fotograma por el siguiente punto del camino (se recalcula cada poco o si su presa se mueve)
  function route(c, out, dt, H) {
    const P = c.path || (c.path = { t: 0, pts: null, tx: 1e9, tz: 1e9, g: null });
    if (!out.moving || c.fly > 0.3) { P.pts = null; return; }
    const d = Math.hypot(out.tx - c.x, out.tz - c.z);
    if (d < 2) return;
    P.t -= dt;
    if (P.t <= 0 || Math.hypot(out.tx - P.tx, out.tz - P.tz) > 3) {
      P.t = 0.7; P.tx = out.tx; P.tz = out.tz;
      const half = U.clamp(d / 2 + 10, 16, 46);
      P.g = walkGrid(c, (c.x + out.tx) / 2, (c.z + out.tz) / 2, half, H);
      P.pts = lineClear(P.g, c.x, c.z, out.tx, out.tz) ? null : astar(P.g, c.x, c.z, out.tx, out.tz);
    }
    const pts = P.pts;
    if (!pts || !pts.length) return; // en línea recta
    while (pts.length > 1 && Math.hypot(pts[0].x - c.x, pts[0].z - c.z) < 1.3) pts.shift();
    // Atajo: el punto más lejano del camino que ya se ve en línea recta
    for (let q = Math.min(pts.length - 1, 10); q > 0; q--) if (lineClear(P.g, c.x, c.z, pts[q].x, pts[q].z)) { pts.splice(0, q); break; }
    out.tx = pts[0].x; out.tz = pts[0].z;
  }
  function goHome(c, S, home, R, dt, out) {
    c.special = false; c.flyTarget = 0;
    const d = Math.hypot(c.x - home.x, c.z - home.z);
    if (d > R * 0.5) { out.tx = home.x; out.tz = home.z; out.speed = c.d.speed * 1.8; out.moving = true; }
    else {
      // Ronda tranquila por su guarida y se recupera de las heridas
      if (!S.wx || S.t > S.wt) { const a = Math.random() * Math.PI * 2, r = Math.random() * R * 0.45; S.wx = home.x + Math.cos(a) * r; S.wz = home.z + Math.sin(a) * r; S.wt = S.t + 6 + Math.random() * 6; }
      out.tx = S.wx; out.tz = S.wz; out.speed = c.d.speed; out.moving = Math.hypot(S.wx - c.x, S.wz - c.z) > 1;
    }
    if (c.hp < c.d.hp) c.hp = Math.min(c.d.hp, c.hp + c.d.hp * 0.025 * dt);
    S.seen = false; S.enr = S.enr && c.hp < c.d.hp * 0.5;
    return out;
  }
  function yeti(c, S, at, home, R, tg, dt, H, out) {
    const enr = c.hp < c.d.hp * 0.5;
    if (enr && !S.enr && at) {
      S.enr = true; roar(c, true);
      nearMsg(c, '❄️ ¡El Rey de la Escarcha ruge y llama a la manada de las nieves!', 'bad');
      let called = 0;
      for (let k = 0; k < 24 && called < 2; k++) {
        const a = Math.random() * Math.PI * 2, r = 6 + Math.random() * 8, x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
        if (!H.valid('snowwolf', x, z)) continue;
        const w = H.spawn('snowwolf', x, z); w.aggro = 20; w.aggroId = at.id; called++;
        G.Audio.playAt('howl', x, z, 120);
      }
    }
    // Carga: corre hacia ti (rodeando lo que haya en medio) y, al llegar, da el pisotón
    if (S.st === 'charge') {
      const t = tgtById(tg, S.tid);
      const dc = t ? Math.hypot(t.x - c.x, t.z - c.z) : 99;
      if (t && dc < 6.5 && dc > 1.5) { startSlam(c, S, t); return out; }
      if (!t || S.t > 6 || dc > 32) { S.st = 'chase'; S.t = 0; S.b = 3; }
      else { out.face = t; out.tx = t.x; out.tz = t.z; out.speed = c.d.run * (enr ? 1.3 : 1.15); out.moving = true; return out; }
    }
    // Golpe de tierra: se agacha, salta hacia ti y al caer levanta una onda de hielo
    if (S.st === 'slam') {
      c.special = true;
      const t = tgtById(tg, S.tid);
      if (S.t < 0.55) { if (t) faceTo(c, t, dt, 8); return out; }
      if (!S.jumped) { S.jumped = true; c.jumpT = 0; send({ k: 'jump', id: c.id }); }
      if (S.t < 1.15) { out.tx = S.lx; out.tz = S.lz; out.speed = Math.max(4, S.jd / 0.6); out.moving = true; return out; }
      slamFx(c.x, c.z); send({ k: 'slam', x: c.x, z: c.z });
      for (const p of tg) {
        if (p.dead || p.ship) continue;
        const d = Math.hypot(p.x - c.x, p.z - c.z);
        if (d < 6.5 && Math.abs((p.y || 0) - c.y) < 2.5) G.Creatures.hitTarget(c, p, 28 * (1 - d / 13), 'El Rey de la Escarcha hizo estallar el hielo bajo tus pies');
      }
      S.st = 'chase'; S.t = 0; c.special = false; S.b = enr ? 6 : 9;
      return out;
    }
    // Lanzamiento de un bloque de hielo
    if (S.st === 'throw') {
      c.special = true;
      const t = tgtById(tg, S.tid);
      if (t) faceTo(c, t, dt, 6);
      if (S.t < 0.85) return out;
      if (t) throwIce(c, t);
      S.st = 'chase'; S.t = 0; c.special = false; S.cc = enr ? 5 : 7.5;
      return out;
    }
    if (!at) return goHome(c, S, home, R, dt, out);
    const d = Math.hypot(at.x - c.x, at.z - c.z);
    out.face = at;
    if (d < 6.5 && d > 1.5 && S.b <= 0) { startSlam(c, S, at); return out; }
    // Listo para el pisotón pero lejos: ruge y corre hacia ti
    if (S.b <= 0 && d < 24) {
      S.st = 'charge'; S.t = 0; S.tid = at.id; roar(c);
      nearMsg(c, '❄️ ¡El Rey de la Escarcha carga hacia ti para aplastarte!', 'bad', 'yeticharge');
      return out;
    }
    if (d > 9 && d < 34 && S.cc <= 0) { S.st = 'throw'; S.t = 0; S.tid = at.id; return out; }
    // El resto del tiempo camina despacio hacia ti (es enorme y pesado)
    out.tx = at.x; out.tz = at.z; out.speed = enr ? 2.6 : 2.1; out.moving = true;
    if (d < 3.4) { out.moving = false; faceTo(c, at, dt, 8); H.attack(c, at, 3.6); }
    return out;
  }
  // El Gran Caimán del río: rápido en el agua, lento en tierra; embestida, coletazo y emboscada desde el lago
  function lakeSpot(c, x, z, k = 0.7) {
    const dx = x - c.hx, dz = z - c.hz, d = Math.hypot(dx, dz), r = (c.lakeR || 12) * k;
    return d <= r ? { x, z } : { x: c.hx + (dx / d) * r, z: c.hz + (dz / d) * r };
  }
  function caiman(c, S, at, home, R, tg, dt, H, out) {
    const enr = c.hp < c.d.hp * 0.5, inWater = G.World.inLakeWater(c.x, c.z);
    c.flyTarget = S.st === 'dive' && S.under > 0 ? 1 : 0; // (se envía en la instantánea: los demás lo ven sumergido)
    S.dv = (S.dv ?? 15) - dt;
    if (enr && !S.enr && at) {
      S.enr = true; roar(c, true);
      nearMsg(c, '🐊 ¡El Gran Caimán del río ruge y llama a los suyos!', 'bad');
      let called = 0;
      for (let k = 0; k < 30 && called < 2; k++) {
        const a = Math.random() * Math.PI * 2, r = 5 + Math.random() * 8, x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
        if (!H.valid('caiman', x, z)) continue;
        const w = H.spawn('caiman', x, z); w.aggro = 20; w.aggroId = at.id; called++;
      }
    }
    // Embestida: abre las fauces, se lanza en línea recta y muerde lo que pille
    if (S.st === 'lunge') {
      const t = tgtById(tg, S.tid);
      if (S.t < 0.5) { c.special = true; if (t) faceTo(c, t, dt, 6); return out; }
      const hx = c.x + Math.sin(c.yaw) * 3.3, hz = c.z + Math.cos(c.yaw) * 3.3;
      if (!S.bit && t && Math.hypot(t.x - hx, t.z - hz) < 2.6 && Math.abs((t.y || 0) - (c.vy ?? c.y)) < 3) {
        S.bit = true; c.lunge = 0.3;
        G.Creatures.hitTarget(c, t, 34, 'El Gran Caimán del río te arrastró bajo el agua');
        G.Audio.playAt('bite', c.x, c.z, 100);
      }
      if (S.t < 2.0 && !S.bit) { c.special = true; out.tx = c.x + Math.sin(c.yaw) * 6; out.tz = c.z + Math.cos(c.yaw) * 6; out.speed = 6.6; out.moving = true; return out; }
      S.st = 'chase'; S.t = 0; S.b = enr ? 4.5 : 6.5; c.special = false;
      return out;
    }
    // Coletazo: gira sobre sí mismo y barre todo lo que tiene alrededor
    if (S.st === 'tail') {
      c.special = true;
      if (S.t < 0.35) return out;
      if (S.t < 0.95) {
        c.yaw += dt * ((Math.PI * 2) / 0.6) * S.dir;
        if (!S.hit && S.t > 0.62) {
          S.hit = true;
          for (const p of tg) {
            if (p.dead || p.ship) continue;
            const d = Math.hypot(p.x - c.x, p.z - c.z);
            if (d < 7.5 && Math.abs((p.y || 0) - (c.vy ?? c.y)) < 2.5) G.Creatures.hitTarget(c, p, 20, 'Un coletazo del Gran Caimán del río te lanzó por los aires');
          }
          G.Audio.playAt('rockbreak', c.x, c.z, 90);
          G.Ships.puff(c.x, (c.vy ?? c.y) + 0.4, c.z, inWater ? 0xdff4ff : 0x8a7a5a, 5, 1.2, 10);
          const P = G.Player.pos; if (Math.hypot(P.x - c.x, P.z - c.z) < 14) G.Player.shake = 0.4;
        }
        return out;
      }
      S.st = 'chase'; S.t = 0; S.cc = enr ? 4 : 6; c.special = false;
      return out;
    }
    // Malherido: vuelve al lago, se sumerge, se cura y sale de golpe a por quien se acerque a la orilla
    if (S.st === 'dive') {
      c.special = false;
      // Primero nada hasta lo hondo (el centro del lago) y allí se hunde del todo
      if (!S.under && (!inWater || Math.hypot(c.x - home.x, c.z - home.z) > (c.lakeR || 12) * 0.35)) {
        out.tx = home.x; out.tz = home.z; out.speed = 4.2; out.moving = true;
        if (S.t > 14) { S.st = 'chase'; S.t = 0; S.dv = 20; }
        return out;
      }
      S.under = (S.under || 0) + dt;
      c.hp = Math.min(c.d.hp, c.hp + c.d.hp * 0.02 * dt);
      if (at && S.under > 2.5 && (Math.hypot(at.x - c.x, at.z - c.z) < 14 || S.under > 9)) {
        S.st = 'lunge'; S.t = 0; S.tid = at.id; S.bit = false; S.under = 0; S.dv = 28; roar(c);
        nearMsg(c, '🐊 ¡El Gran Caimán sale del agua de golpe!', 'bad', 'caimanout');
        return out;
      }
      if (S.under > 12) { S.st = 'chase'; S.t = 0; S.under = 0; S.dv = 20; }
      if (at) { const p = lakeSpot(c, at.x, at.z); out.tx = p.x; out.tz = p.z; out.speed = 2.5; out.moving = Math.hypot(p.x - c.x, p.z - c.z) > 1.5; }
      return out;
    }
    // Tranquilo: nada despacio por el lago
    if (!at) {
      c.special = false;
      if (!S.wx || S.t > S.wt || Math.hypot(S.wx - c.x, S.wz - c.z) < 1.5) { const a = Math.random() * Math.PI * 2, p = lakeSpot(c, c.hx + Math.cos(a) * 20, c.hz + Math.sin(a) * 20, Math.random() * 0.6); S.wx = p.x; S.wz = p.z; S.wt = S.t + 8 + Math.random() * 8; }
      out.tx = S.wx; out.tz = S.wz; out.speed = inWater ? 1.6 : 2.4; out.moving = true;
      if (c.hp < c.d.hp) c.hp = Math.min(c.d.hp, c.hp + c.d.hp * 0.025 * dt);
      S.seen = false; S.enr = S.enr && c.hp < c.d.hp * 0.5;
      return out;
    }
    const d = Math.hypot(at.x - c.x, at.z - c.z), ang = U.angDiff(c.yaw, Math.atan2(at.x - c.x, at.z - c.z));
    out.face = at;
    if (c.hp < c.d.hp * 0.45 && S.dv <= 0) {
      S.st = 'dive'; S.t = 0; S.under = 0;
      nearMsg(c, '🐊 El Gran Caimán se esconde en el lago… ¡cuidado con la orilla!', 'warn', 'caimandive');
      return out;
    }
    if (d < 6.5 && Math.abs(ang) > 1.3 && S.cc <= 0) { S.st = 'tail'; S.t = 0; S.hit = false; S.dir = ang > 0 ? -1 : 1; return out; }
    if (d > 5 && d < 13 && S.b <= 0 && Math.abs(ang) < 0.6) { S.st = 'lunge'; S.t = 0; S.tid = at.id; S.bit = false; G.Audio.playAt('hiss', c.x, c.z, 90); return out; }
    // Se acerca: rápido nadando, despacio en tierra
    out.tx = at.x; out.tz = at.z; out.speed = inWater ? 5.0 : enr ? 2.4 : 1.9; out.moving = true;
    const hx = c.x + Math.sin(c.yaw) * 3.3, hz = c.z + Math.cos(c.yaw) * 3.3;
    if (Math.hypot(at.x - hx, at.z - hz) < 2.3 || d < 2.8) {
      out.moving = false; faceTo(c, at, dt, 5);
      if (c.cd <= 0 && Math.abs((at.y || 0) - (c.vy ?? c.y)) < 3) {
        c.cd = 1.9; c.lunge = 0.3;
        G.Creatures.hitTarget(c, at, c.d.dmg, 'El Gran Caimán del río te hizo pedazos');
        G.Audio.playAt('bite', c.x, c.z, 90);
      }
    }
    return out;
  }
  function startSlam(c, S, at) {
    const d = Math.hypot(at.x - c.x, at.z - c.z) || 1;
    S.st = 'slam'; S.t = 0; S.tid = at.id; S.jumped = false;
    const k = Math.max(0, d - 1.6) / d;
    S.lx = c.x + (at.x - c.x) * k; S.lz = c.z + (at.z - c.z) * k; S.jd = Math.hypot(S.lx - c.x, S.lz - c.z);
  }
  function dragon(c, S, at, home, R, tg, dt, H, out) {
    const enr = c.hp < c.d.hp * 0.35;
    if (enr && !S.enr && at) { S.enr = true; roar(c, true); nearMsg(c, '🔥 ¡El Dragón de Brasa enfurece! Sus llamas arden más que nunca.', 'bad'); }
    // En vuelo: despega, da vueltas escupiendo bolas de fuego y vuelve a tierra
    if (S.st === 'fly') {
      const t = tgtById(tg, S.tid) || at;
      const cx = t ? t.x : home.x, cz = t ? t.z : home.z;
      c.special = false;
      if (S.t < 1.6) { c.flyTarget = 1; out.tx = c.x + Math.sin(c.yaw) * 4; out.tz = c.z + Math.cos(c.yaw) * 4; out.speed = 2; out.moving = true; return out; }
      if (S.t < 11.5) {
        S.orb = (S.orb ?? Math.atan2(c.z - cz, c.x - cx)) + dt * 0.42;
        out.tx = cx + Math.cos(S.orb) * 14; out.tz = cz + Math.sin(S.orb) * 14; out.speed = 6.2; out.moving = true;
        for (const k of [3.5, 6.2, 9]) if (S.t >= k && (S.shot || 0) < k) { S.shot = k; if (t) { faceTo(c, t, 1, 1); fireball(c, t); } }
        return out;
      }
      // Aterriza cerca de su presa (dentro de su territorio)
      c.flyTarget = 0;
      if (S.t < 13.2) { out.tx = cx; out.tz = cz; out.speed = 4; out.moving = Math.hypot(cx - c.x, cz - c.z) > 6; return out; }
      S.st = 'chase'; S.t = 0; S.cc = enr ? 15 : 22; S.orb = null; S.shot = 0;
      return out;
    }
    // Aliento de fuego en cono
    if (S.st === 'breath') {
      c.special = true;
      const t = tgtById(tg, S.tid);
      if (t) faceTo(c, t, dt, 1.2);
      if ((S.tick = (S.tick || 0) - dt) <= 0) {
        S.tick = 0.2;
        const mo = mouth(c);
        for (const p of tg) {
          if (p.dead || p.ship) continue;
          const dx = p.x - mo.x, dz = p.z - mo.z, d = Math.hypot(dx, dz);
          const ey = mo.y + Math.tan(S.pitch || 0) * d; // altura del chorro a esa distancia
          if (d < 15 && d > 0.1 && (dx * mo.fx + dz * mo.fz) / d > Math.cos(0.4) && Math.abs((p.y || 0) + 1 - ey) < 2 + d * 0.2) G.Creatures.hitTarget(c, p, 7, 'El aliento del Dragón de Brasa te calcinó');
        }
      }
      if (S.t < 1.8) return out;
      S.st = 'chase'; S.t = 0; c.special = false; S.b = enr ? 5.5 : 8;
      return out;
    }
    if (!at) return goHome(c, S, home, R, dt, out);
    const d = Math.hypot(at.x - c.x, at.z - c.z);
    out.face = at;
    c.flyTarget = 0;
    if (c.hp < c.d.hp * 0.7 && S.cc <= 0) {
      S.st = 'fly'; S.t = 0; S.tid = at.id; S.shot = 0; roar(c);
      if (!S.flyTold) { S.flyTold = true; nearMsg(c, '🐲 ¡El Dragón de Brasa alza el vuelo! Arriba solo lo alcanzan las armas de fuego y los poderes.', 'warn'); }
      return out;
    }
    const facing = Math.abs(U.angDiff(c.yaw, Math.atan2(at.x - c.x, at.z - c.z))) < 0.6;
    if (d > 5 && d < 15 && S.b <= 0 && facing) {
      S.st = 'breath'; S.t = 0; S.tid = at.id; S.tick = 0.35;
      const mo = mouth(c), hd = Math.hypot(at.x - mo.x, at.z - mo.z) || 1;
      S.pitch = U.clamp(Math.atan2((at.y || G.height(at.x, at.z)) + 1 - mo.y, hd), -0.7, 0.35);
      startBreath(c, 1.8, S.pitch); send({ k: 'breath', id: c.id, dur: 1.8, p: +S.pitch.toFixed(3) });
      return out;
    }
    // Pesado en tierra: camina despacio (sus armas son el aliento y el vuelo)
    out.tx = at.x; out.tz = at.z; out.speed = enr ? 4.0 : 3.4; out.moving = true;
    if (d < 5.6) { out.moving = false; faceTo(c, at, dt, 6); H.attack(c, at, 6.0); }
    else if (d < 15 && S.b <= 0) faceTo(c, at, dt, 3);
    return out;
  }

  // ------------------------------------------------------------------ reaparición: un jefe derrotado vuelve a los 30 minutos de juego
  // (reloj de juego de la partida; en las partidas antiguas cuenta desde que se cargan)
  const RESPAWN = 30 * 60;
  B.clock = () => (G.state.world && G.state.world.bossClock) || 0;
  B.killedAt = function (type) {
    const w = G.state.world || {}, at = w.bossAt && w.bossAt[type];
    if (at !== undefined) return at;
    const legacy = type === 'boss' ? w.bossKilled : type === 'pirate_boss' ? w.story && w.story.flags && w.story.flags.pirateBoss : w.bossesKilled && w.bossesKilled[type];
    return legacy ? 0 : null;
  };
  B.canSpawn = (type) => { const k = B.killedAt(type); return k === null || B.clock() - k >= RESPAWN; };
  B.markKilled = function (type) {
    const w = G.state.world;
    if (!w) return;
    (w.bossAt = w.bossAt || {})[type] = B.clock();
    (w.bossKills = w.bossKills || {})[type] = (w.bossKills[type] || 0) + 1;
  };
  B.kills = (type) => ((G.state.world && G.state.world.bossKills) || {})[type] || 0;

  // ------------------------------------------------------------------ guaridas y aparición (lo llama manage() de creatures.js)
  B.lair = function (I, type) {
    const F = I.feat || {};
    if (type === 'yeti' && F.cave && F.cave.wx !== undefined) {
      if (F.yetiLair) return F.yetiLair;
      const Cv = F.cave, bad = (x, z) => G.Landmarks.blocks(x, z) || G.height(x, z) < 0.8;
      for (let D = Cv.r + 8; D < Cv.r + 44; D += 2) {
        const x = Cv.wx + Math.sin(Cv.ent) * D, z = Cv.wz + Math.cos(Cv.ent) * D;
        let free = !bad(x, z);
        for (let k = 0; k < 10 && free; k++) { const a = (k / 10) * Math.PI * 2; if (bad(x + Math.cos(a) * 6, z + Math.sin(a) * 6)) free = false; }
        if (free) return (F.yetiLair = { x, z, r: 20 });
      }
      return (F.yetiLair = { x: Cv.wx + Math.sin(Cv.ent) * (Cv.r + 14), z: Cv.wz + Math.cos(Cv.ent) * (Cv.r + 14), r: 20 });
    }
    if (type === 'bigcaiman' && F.lake && F.lake.wx !== undefined) return { x: F.lake.wx, z: F.lake.wz, r: F.lake.r + 18, lakeR: F.lake.r };
    if (type === 'lavadragon' && F.crater && F.crater.wx !== undefined) {
      const c = F.crater;
      let best = null, bd = -1;
      for (const lp of F.lava || []) { const d = Math.hypot(lp.wx - c.wx, lp.wz - c.wz); if (d > bd) { bd = d; best = lp; } }
      if (best) { const dx = c.wx - best.wx, dz = c.wz - best.wz, dl = Math.hypot(dx, dz) || 1; return { x: best.wx + dx / dl * (best.r + 7), z: best.wz + dz / dl * (best.r + 7), r: 28 }; }
      const a = (I.seed || 1) * 1.7;
      return { x: c.wx + Math.cos(a) * 55, z: c.wz + Math.sin(a) * 55, r: 28 };
    }
    return null;
  };
  B.manage = function (I, players, farFromAll, day, H) {
    const type = I.type === 'escarcha' ? 'yeti' : I.type === 'brasa' ? 'lavadragon' : I.type === 'tahuri' ? 'bigcaiman' : null;
    const w = G.state.world;
    if (!type || !w || day < 3 || !B.canSpawn(type)) return;
    if (G.Creatures.list.some((c) => c.type === type && !c.dead)) return;
    const L = B.lair(I, type);
    if (!L) return;
    // Un punto válido cerca de la guarida
    let p = null;
    for (let i = 0; i < 40 && !p; i++) {
      const a = Math.random() * Math.PI * 2, r = i === 0 ? 0 : Math.random() * L.r * 0.5;
      const x = L.x + Math.cos(a) * r, z = L.z + Math.sin(a) * r;
      if (H.valid(type, x, z)) p = { x, z };
    }
    if (!p || !farFromAll(p, 40)) return;
    const c = H.spawn(type, p.x, p.z);
    c.hx = L.x; c.hz = L.z; c.homeR = L.r; if (L.lakeR) c.lakeR = L.lakeR;
    w.bossSeen = w.bossSeen || {};
    const P = G.Player.pos, here = G.Arch.landOf(P.x, P.z) === I;
    if (!w.bossSeen[type] && here) {
      w.bossSeen[type] = 1;
      if (type === 'yeti') G.UI.banner('❄️ El Rey de la Escarcha', 'Un rugido helado baja de la montaña… algo enorme vive en la cueva de hielo');
      else if (type === 'bigcaiman') G.UI.banner('🐊 El Gran Caimán del río', 'Algo enorme se mueve bajo el agua del lago… los Shandara no se acercan a la orilla');
      else G.UI.banner('🐲 El Dragón de Brasa', 'El volcán retumba y un rugido de fuego sale de las coladas de lava');
      G.Audio.play('roar');
    } else if (here) G.UI.msg(type === 'yeti' ? '❄️ Se oye al Rey de la Escarcha rugir junto a la cueva de hielo…' : type === 'bigcaiman' ? '🐊 Unos ojos amarillos vigilan desde el lago de la selva…' : '🐲 El Dragón de Brasa ha vuelto a las coladas de lava…', 'warn', 'bossback');
  };
  B.onKilled = function (c) {
    const w = G.state.world;
    if (w) { w.bossesKilled = w.bossesKilled || {}; w.bossesKilled[c.type] = true; }
    B.markKilled(c.type);
    if (c.type === 'yeti') G.UI.banner('¡El Rey de la Escarcha ha caído!', 'La montaña queda en silencio… y su cueva de hielo es tuya');
    else if (c.type === 'bigcaiman') G.UI.banner('¡El Gran Caimán del río ha caído!', 'El lago de Tahuri vuelve a ser seguro para los Shandara');
    else G.UI.banner('¡El Dragón de Brasa ha caído!', 'El volcán se calma por fin. Nadie volverá a temer sus llamas');
    G.Audio.play('win');
    B.breaths = B.breaths.filter((b) => b.c !== c);
  };

  // ------------------------------------------------------------------ red
  B.onNet = function (m) {
    const c = m.id !== undefined ? G.Creatures.byId(m.id) : null;
    if (m.k === 'jump' && c) c.jumpT = 0;
    else if (m.k === 'slam') slamFx(m.x, m.z);
    else if (m.k === 'proj') spawnProj(m.kind, m.o, m.v, false, m.from);
    else if (m.k === 'breath' && c) startBreath(c, m.dur, m.p);
    else if (m.k === 'roar' && c) G.Audio.playAt('roar', c.x, c.z, m.big ? 220 : 150);
  };

  // ------------------------------------------------------------------ fotograma
  let lastWorld = null;
  B.update = function (dt) {
    if (G.state.world) G.state.world.bossClock = B.clock() + dt;
    if (G.state.world !== lastWorld) {
      lastWorld = G.state.world;
      for (const p of B.proj) G.scene.remove(p.m);
      for (const r of B.rings) { G.scene.remove(r.grp); r.mat.dispose(); }
      B.proj.length = 0; B.rings.length = 0; B.breaths.length = 0;
      for (const p of B.parts) { p.alive = false; p.sp.visible = false; }
    }
    // Proyectiles
    for (let i = B.proj.length - 1; i >= 0; i--) {
      const p = B.proj[i], pos = p.m.position;
      p.t += dt;
      p.v.y -= (p.kind === 'fire' ? 6 : 9.8) * dt;
      pos.addScaledVector(p.v, dt);
      p.m.rotation.x += dt * 5; p.m.rotation.z += dt * 3;
      if (p.kind === 'fire' && Math.random() < 0.6) particle(pos.x, pos.y, pos.z, (Math.random() - 0.5), 0.5, (Math.random() - 0.5), 0.45, 0.8, 1.8, 0xffc060, 0xff3a08);
      const gy = Math.max(G.height(pos.x, pos.z), G.World.waveHeight(pos.x, pos.z) - 0.2);
      if (pos.y < gy + 0.3 || p.t > 7) { explode(p); G.scene.remove(p.m); B.proj.splice(i, 1); }
    }
    // Aliento de fuego
    for (let i = B.breaths.length - 1; i >= 0; i--) {
      const b = B.breaths[i], c = b.c;
      b.t += dt;
      if (b.t > b.dur || c.dead || !G.Creatures.list.includes(c)) { B.breaths.splice(i, 1); continue; }
      const mo = mouth(c);
      b.acc += dt * 70;
      for (; b.acc >= 1; b.acc--) {
        const sp = 16 + Math.random() * 4, spr = (Math.random() - 0.5) * 0.5, pit = b.pitch + (Math.random() - 0.5) * 0.25;
        const vx = Math.sin(c.yaw + spr) * sp * Math.cos(pit), vz = Math.cos(c.yaw + spr) * sp * Math.cos(pit);
        particle(mo.x, mo.y, mo.z, vx, Math.sin(pit) * sp, vz, 0.55 + Math.random() * 0.2, 0.5, 3.4, 0xffb040, 0xff2800);
      }
      if (Math.random() < dt * 8) G.Ships.puff(mo.x + mo.fx * 8, mo.y, mo.z + mo.fz * 8, 0x3a3230, 2.5, 1.6, 2);
    }
    // Partículas
    for (const p of B.parts) {
      if (!p.alive) continue;
      p.t += dt;
      const k = p.t / p.life;
      if (k >= 1) { p.alive = false; p.sp.visible = false; continue; }
      p.v.multiplyScalar(1 - Math.min(1, dt * 1.6)); p.v.y += dt * 2;
      p.sp.position.addScaledVector(p.v, dt);
      p.sp.scale.setScalar(U.lerp(p.s0, p.s1, k));
      p.sp.material.color.setHex(p.c0).lerp(_c1.setHex(p.c1), k);
      p.sp.material.opacity = (1 - k) * 0.75;
    }
    // Ondas de hielo
    for (let i = B.rings.length - 1; i >= 0; i--) {
      const r = B.rings[i];
      r.t += dt;
      const grow = Math.min(1, r.t / 0.35), rad = 1 + grow * 5.5;
      r.grp.children.forEach((m, k) => { const a = m.userData.a; m.position.set(Math.cos(a) * rad, 0, Math.sin(a) * rad); m.scale.set(1, grow * (0.7 + (k % 3) * 0.25), 1); });
      r.mat.opacity = r.t < 0.9 ? 0.9 : Math.max(0, 0.9 - (r.t - 0.9) * 1.5);
      if (r.t > 1.6) { G.scene.remove(r.grp); r.mat.dispose(); B.rings.splice(i, 1); }
    }
  };

  // Para pruebas desde la consola: hace aparecer un jefe cerca de ti
  B.debugSpawn = function (type) {
    const P = G.Player.pos, a = G.Player.yaw;
    const c = G.Creatures.spawn(type, P.x - Math.sin(a) * 18, P.z - Math.cos(a) * 18);
    c.hx = c.x; c.hz = c.z; c.homeR = 24;
    if (type === 'bigcaiman') { const L = B.lair(G.Arch.landOf(P.x, P.z) || {}, type); if (L) { c.hx = L.x; c.hz = L.z; c.homeR = L.r; c.lakeR = L.lakeR; } }
    return c;
  };
})();
