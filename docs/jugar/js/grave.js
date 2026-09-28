// Cofre de la muerte: al morir, todo lo que llevas (mochila y equipo) se queda en un cofre.
//  - En tierra firme: enterrado bajo una ✖ roja. Mantén el clic sobre la ✖ para cavar (5 s a mano, 2 s con pala):
//    se abre un hoyo, sale el cofre y recuperas tus cosas en sus casillas (con su durabilidad y tu equipo puesto).
//  - En el agua: el cofre flota con una bandera roja para verlo de lejos (E para recuperarlo nadando o desde el barco).
//  - Tienes 5 minutos: la ✖ se va hundiendo en la tierra (arena, nieve…) y el cofre del agua se va hundiendo poco a poco.
//  - En tu mapa, un círculo de unos 20 m marca la zona donde está (el cofre no tiene por qué estar en el centro).
// Solo con la regla «cofre» al morir (la normal). En LAN, el anfitrión decide quién se lleva el contenido.
(function () {
  'use strict';
  const G = window.G, U = G.U, M = G.Mdl, V3 = THREE.Vector3;
  const Gr = (G.Grave = {});
  const LIFE = 300, R_MAP = 20, DIG_HAND = 5, DIG_SHOVEL = 2;
  const list = () => (G.state.world ? (G.state.world.graves = G.state.world.graves || []) : []);
  const myId = () => (G.Net.active ? G.Net.myId : null);
  const isMine = (g) => !G.Net.active || g.owner === G.Net.myId;
  const mmss = (s) => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const send = (m) => G.Net.send(Object.assign({ t: 'grave' }, m));
  const vis = new Map();

  // ------------------------------------------------------------------ al morir
  function waterAt(x, z) {
    if (G.World.inLakeWater(x, z)) return 'lake';
    return G.height(x, z) < 0.15 ? 'sea' : null;
  }
  // Si mueres en la lava, el cofre queda en la tierra firme más cercana
  function safeSpot(x, z) {
    const bad = (a, b) => G.Landmarks.lavaAt(a, b, G.height(a, b)) || G.Landmarks.blocks(a, b);
    if (!bad(x, z)) return { x, z };
    for (let r = 2; r <= 24; r += 2) for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      if (!bad(px, pz) && G.height(px, pz) > 0.3) return { x: px, z: pz };
    }
    return { x, z };
  }
  Gr.onDeath = function () {
    if (G.Modes.deathRule() !== 'half') return null;
    const items = [];
    G.Inv.slots.forEach((s, i) => { if (s) { items.push(Object.assign({ i }, s)); G.Inv.slots[i] = null; } });
    for (const k of G.Inv.SLOTS) { const e = G.Inv.equip[k]; if (e) { items.push(Object.assign({ eq: k }, e)); G.Inv.equip[k] = null; } }
    if (!items.length) return null;
    G.Inv.changed();
    const P = G.Player.pos;
    let x = P.x, z = P.z;
    const water = waterAt(x, z);
    if (!water) ({ x, z } = safeSpot(x, z));
    const a = Math.random() * Math.PI * 2, off = Math.random() * R_MAP * 0.6;
    const g = {
      id: 'gr' + Date.now().toString(36) + Math.floor(Math.random() * 1000), owner: myId(), who: G.Net.name || '',
      x: +x.toFixed(2), z: +z.toFixed(2), water, cx: +(x + Math.cos(a) * off).toFixed(1), cz: +(z + Math.sin(a) * off).toFixed(1),
      left: LIFE, p: 0, st: water ? 'float' : 'buried', items,
    };
    list().push(g);
    send({ k: 'new', g });
    return g;
  };

  // ------------------------------------------------------------------ modelos
  let holeTex = null, chestMat = null;
  function chestModel() {
    chestMat = chestMat || new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
    const wood = 0x7a4e28, dark = 0x55361c, band = 0x3a3a40, gold = 0xd8b040;
    const body = [M.paint(new THREE.BoxGeometry(0.9, 0.46, 0.58), (x, y) => (Math.abs(Math.sin(y * 22)) > 0.93 ? dark : wood))];
    for (const bx of [-0.33, 0.33]) body.push(M.xf(M.paint(new THREE.BoxGeometry(0.07, 0.48, 0.6), band), bx, 0, 0));
    body.push(M.xf(M.paint(new THREE.BoxGeometry(0.12, 0.14, 0.04), gold), 0, 0.12, 0.3));
    const g = new THREE.Group();
    const b = new THREE.Mesh(U.merge(body), chestMat); b.position.y = 0.23; b.castShadow = true; g.add(b);
    const lidG = [M.xf(M.paint(new THREE.CylinderGeometry(0.29, 0.29, 0.9, 12, 1, false, 0, Math.PI), wood), 0, 0, 0, 0, 0, Math.PI / 2)];
    for (const bx of [-0.33, 0.33]) lidG.push(M.xf(M.paint(new THREE.CylinderGeometry(0.3, 0.3, 0.07, 12, 1, false, 0, Math.PI), band), bx, 0, 0, 0, 0, Math.PI / 2));
    const lidMesh = new THREE.Mesh(U.merge(lidG), chestMat);
    lidMesh.position.set(0, 0, 0.29); lidMesh.castShadow = true;
    const lid = new THREE.Group(); lid.position.set(0, 0.46, -0.29); lid.add(lidMesh); g.add(lid);
    g.userData.lid = lid;
    return g;
  }
  // Color del suelo donde está la ✖ (arena, hierba, nieve, ceniza…) y de la tierra removida
  function groundColors(x, z) {
    const s = G.Arch.landOf(x, z), P = G.Arch.PAL[s ? s.type : 'perdida'] || G.Arch.PAL.perdida, h = G.height(x, z);
    const surf = (h < 1 ? P.wet : h < 2.2 ? P.sand : P.grassA).clone();
    const dirt = (h < 2.2 ? P.wet : s && s.type === 'escarcha' ? P.grassB.clone().lerp(P.dirt, 0.35) : P.dirt).clone().multiplyScalar(0.85);
    return { surf, dirt };
  }
  function build(g) {
    const grp = new THREE.Group(), v = { grp, t: Math.random() * 10 };
    if (g.water) {
      const ch = chestModel(); grp.add(ch); v.chest = ch;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 2.8, 6), new THREE.MeshStandardMaterial({ color: 0x5a4632 }));
      pole.position.set(0.3, 1.8, 0); grp.add(pole);
      const fg = new THREE.PlaneGeometry(1.15, 0.72, 10, 2); fg.translate(0.575, 0, 0);
      const flag = new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ color: 0xe01818, emissive: 0x400000, side: THREE.DoubleSide, roughness: 0.7 }));
      flag.position.set(0.32, 2.8, 0); grp.add(flag);
      v.flag = flag; v.base = Float32Array.from(fg.attributes.position.array);
    } else {
      const y = G.Build.groundAt(g.x, g.z), { surf, dirt } = groundColors(g.x, g.z);
      g.y = y; v.gc = surf; v.dirt = dirt.clone();
      grp.position.set(g.x, y, g.z);
      // Montículo de tierra removida
      v.moundMat = new THREE.MeshStandardMaterial({ color: dirt, roughness: 1 });
      v.mound = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2), v.moundMat);
      v.mound.scale.set(1, 0.2, 1); grp.add(v.mound);
      // La ✖ roja pintada encima
      v.xMat = new THREE.MeshStandardMaterial({ color: 0xd01c1c, roughness: 0.8, transparent: true });
      v.x = new THREE.Group();
      for (const r of [0.785, -0.785]) { const b = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.04, 0.17), v.xMat); b.rotation.y = r; v.x.add(b); }
      v.x.position.y = 0.17; grp.add(v.x);
      // Hoyo (disco oscuro con degradado) y montones de tierra que crecen al cavar
      holeTex = holeTex || U.canvasTex(64, 64, (c) => { const gr = c.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, 'rgba(12,8,4,1)'); gr.addColorStop(0.7, 'rgba(40,26,14,0.95)'); gr.addColorStop(1, 'rgba(60,40,20,0)'); c.fillStyle = gr; c.fillRect(0, 0, 64, 64); });
      v.hole = new THREE.Mesh(new THREE.CircleGeometry(0.85, 24), new THREE.MeshBasicMaterial({ map: holeTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
      v.hole.rotation.x = -Math.PI / 2; v.hole.position.y = 0.12; v.hole.renderOrder = 2; v.hole.scale.setScalar(0.001); grp.add(v.hole);
      v.piles = [-1, 1].map((s) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), v.moundMat); m.position.set(s * 1.05, 0, s * 0.25); m.scale.setScalar(0.001); grp.add(m); return m; });
      const ch = chestModel(); ch.visible = false; ch.position.y = -0.8; grp.add(ch); v.chest = ch;
      v.em = g.st === 'open' ? 1 : 0;
    }
    G.scene.add(grp);
    vis.set(g.id, v);
  }
  function dispose(id) {
    const v = vis.get(id);
    if (!v) return;
    G.scene.remove(v.grp);
    v.grp.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); if (o.material !== chestMat) o.material.dispose(); } });
    vis.delete(id);
  }
  function remove(id) {
    const L = list(), i = L.findIndex((g) => g.id === id);
    if (i >= 0) L.splice(i, 1);
    dispose(id);
  }

  // ------------------------------------------------------------------ cavar (mantener clic sobre la ✖)
  const _e = new V3(), _f = new V3();
  function aimed() {
    const P = G.Player;
    if (G.state.mode !== 'playing' || P.dead || P.ship) return null;
    P.eyePos(_e); P.lookDir(_f);
    if (_f.y > -0.05) return null;
    for (const g of list()) {
      if (g.st !== 'buried' || g.y === undefined) continue;
      if (Math.hypot(g.x - _e.x, g.z - _e.z) > 5) continue;
      const t = (g.y - _e.y) / _f.y;
      if (t < 0 || t > 6) continue;
      if (Math.hypot(_e.x + _f.x * t - g.x, _e.z + _f.z * t - g.z) < 1.3) return g;
    }
    return null;
  }
  Gr.aimed = () => !!aimed();
  let swingT = 0, sendT = 0;
  Gr.dig = function (dt) {
    const g = aimed();
    if (!g) return false;
    const P = G.Player, shovel = G.Inv.heldId() === 'pala';
    g.p = Math.min(1, (g.p || 0) + dt / (shovel ? DIG_SHOVEL : DIG_HAND));
    if ((swingT -= dt) <= 0) {
      swingT = shovel ? 0.34 : 0.5;
      P.swing = 1; P.swingCount = (P.swingCount || 0) + 1;
      G.Audio.play('chop');
      const v = vis.get(g.id);
      G.Ships.puff(g.x + (Math.random() - 0.5), g.y + 0.3, g.z + (Math.random() - 0.5), v ? v.moundMat.color.getHex() : 0x6a4a2a, 0.7, 0.8, 3);
    }
    if (G.Net.active && (sendT -= dt) <= 0) { sendT = 0.3; send({ k: 'dig', id: g.id, p: +g.p.toFixed(2) }); }
    if (g.p >= 1) {
      g.st = 'open';
      if (shovel) G.Inv.wear(1);
      send({ k: 'dig', id: g.id, p: 1 });
      G.Audio.play('loot');
      setTimeout(() => requestTake(g), 900); // cuando el cofre ya ha salido del hoyo
    }
    return true;
  };

  // ------------------------------------------------------------------ recuperar las cosas
  function restore(items) {
    const S = G.Inv.slots, left = [];
    const rest = [];
    for (const it of items) {
      const o = { id: it.id, n: it.n };
      if (it.d !== undefined) o.d = it.d;
      if (it.eq && !G.Inv.equip[it.eq]) G.Inv.equip[it.eq] = { id: it.id, n: 1 };
      else if (it.i !== undefined && !S[it.i]) S[it.i] = o;
      else rest.push(o);
    }
    for (const o of rest) {
      if (!G.ITEMS[o.id].tool) for (const s of S) if (s && s.id === o.id && s.n < G.Inv.maxStack(o.id)) { const k = Math.min(o.n, G.Inv.maxStack(o.id) - s.n); s.n += k; o.n -= k; if (!o.n) break; }
      if (!o.n) continue;
      const f = S.findIndex((s) => !s);
      if (f >= 0) S[f] = o; else left.push(o);
    }
    G.Inv.changed();
    if (left.length) G.UI.msg('🎒 Tu mochila está llena: lo que no cabe sigue en el cofre (<kbd>E</kbd> para sacarlo).', 'warn', 'gravefull');
    else G.UI.banner('⚰️ ¡Recuperaste tus cosas!', 'Todo vuelve a su sitio en tu mochila');
    G.Audio.play('loot');
    return left;
  }
  function requestTake(g) {
    if (!g.items || !g.items.length) return;
    if (!G.Net.active || G.Net.isHost) take(g, myId());
    else send({ k: 'take', id: g.id });
  }
  // Lo decide el anfitrión (o la partida individual): así nadie recibe las cosas dos veces
  function take(g, who) {
    if (!g.items || !g.items.length) return;
    const items = g.items;
    g.items = [];
    if (!G.Net.active || who === G.Net.myId) g.items = restore(items);
    else send({ k: 'give', id: g.id, who, items });
    if (G.Net.active) send({ k: 'sync', g });
  }
  Gr.near = function () {
    const P = G.Player;
    for (const g of list()) {
      if (!g.items || !g.items.length) continue;
      const d = Math.hypot(g.x - P.pos.x, g.z - P.pos.z);
      if (g.water && d < (P.ship ? 7 : 4)) return g;
      if (!g.water && g.st === 'open' && d < 3.2) return g;
    }
    return null;
  };
  Gr.interact = function () {
    const g = Gr.near();
    if (!g) return false;
    requestTake(g);
    return true;
  };
  Gr.prompt = function () {
    const a = aimed();
    if (a) {
      const shovel = G.Inv.heldId() === 'pala';
      return `✖ <b>${isMine(a) ? 'Tu cofre enterrado' : 'Cofre enterrado de ' + (a.who || 'otro jugador')}</b> · mantén <kbd>Clic</kbd> para cavar (${shovel ? 'con pala: 2 s' : 'a mano: 5 s · con pala: 2 s'}) · ${Math.round((a.p || 0) * 100)}% · ⏳ ${mmss(a.left)}`;
    }
    const n = Gr.near();
    if (n) return `🚩 <b>${isMine(n) ? 'Tu cofre' : 'Cofre de ' + (n.who || 'otro jugador')}</b> · <kbd>E</kbd> Recuperar las cosas · ⏳ ${mmss(n.left)}`;
    const P = G.Player.pos;
    const x = list().find((g) => g.st === 'buried' && Math.hypot(g.x - P.x, g.z - P.z) < 4);
    return x ? '✖ Mira la ✖ roja y mantén <kbd>Clic</kbd> para desenterrar el cofre' : '';
  };

  // ------------------------------------------------------------------ mapa y marcador en pantalla
  Gr.drawMap = function (ctx, toPx, full, scale) {
    for (const g of list()) {
      if (!isMine(g) || !g.items || !g.items.length) continue;
      const [x, y] = toPx(g.cx, g.cz), r = Math.max(full ? 9 : 6, R_MAP * scale);
      ctx.save();
      ctx.setLineDash([6, 4]); ctx.lineWidth = full ? 2.5 : 1.8;
      ctx.strokeStyle = 'rgba(235,40,40,.95)'; ctx.fillStyle = 'rgba(235,40,40,.16)';
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = `bold ${full ? 13 : 10}px sans-serif`; ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd0d0'; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 3;
      const txt = `${g.water ? '🚩' : '✖'} ${mmss(g.left)}`;
      ctx.strokeText(txt, x, y - r - 4); ctx.fillText(txt, x, y - r - 4);
      ctx.restore();
    }
  };
  function hud() {
    let el = document.getElementById('graveHud');
    const g = list().filter((q) => isMine(q) && q.items && q.items.length).sort((a, b) => a.left - b.left)[0];
    if (!el) { if (!g) return; el = document.createElement('div'); el.id = 'graveHud'; const o = document.getElementById('objective'); if (!o) return; o.appendChild(el); }
    const txt = g ? `${g.water ? '🚩' : '✖'} <b>Tu cofre</b>: ⏳ ${mmss(g.left)} · búscalo en el mapa (<kbd>M</kbd>)` : '';
    if (el.innerHTML !== txt) el.innerHTML = txt;
    el.classList.toggle('hidden', !g);
    el.classList.toggle('urgent', !!g && g.left < 60);
  }
  Gr.mineActive = () => list().some((g) => isMine(g) && g.items && g.items.length);

  // ------------------------------------------------------------------ red
  Gr.onNet = function (m, from) {
    const L = list(), id = m.id || (m.g && m.g.id), g = L.find((q) => q.id === id);
    if (m.k === 'new') { if (!g) L.push(m.g); }
    else if (m.k === 'dig') { if (g && m.p > (g.p || 0)) { g.p = m.p; if (m.p >= 1) g.st = 'open'; } }
    else if (m.k === 'take') { if (G.Net.isHost && g) take(g, from); }
    else if (m.k === 'give') {
      if (!g) return;
      g.items = [];
      if (m.who === G.Net.myId) { const back = restore(m.items); if (back.length) send({ k: 'back', id: g.id, items: back }); }
    } else if (m.k === 'back') { if (G.Net.isHost && g) { g.items = (g.items || []).concat(m.items); send({ k: 'sync', g }); } }
    else if (m.k === 'sync') { if (g) Object.assign(g, m.g); else L.push(m.g); }
    else if (m.k === 'gone') remove(m.id);
  };

  // ------------------------------------------------------------------ fotograma
  let lastWorld = null;
  const _c = new THREE.Color(), RED = new THREE.Color(0xd01c1c);
  Gr.update = function (dt) {
    if (G.state.world !== lastWorld) { lastWorld = G.state.world; for (const id of [...vis.keys()]) dispose(id); }
    if (!G.state.world) return;
    const auth = !G.Net.active || G.Net.isHost, now = performance.now() / 1000;
    for (const g of list().slice()) {
      if (!vis.has(g.id)) build(g);
      const v = vis.get(g.id);
      const full = g.items && g.items.length;
      if (full) g.left = Math.max(0, g.left - dt);
      // Se acabó el tiempo o ya está vacío: desaparece
      if (auth) {
        if (full && g.left <= 0) {
          if (isMine(g)) G.UI.msg(g.water ? '🌊 Tu cofre se hundió en el fondo del mar… Lo perdiste todo.' : '✖ La ✖ se borró del todo: tu cofre queda enterrado para siempre.', 'bad');
          remove(g.id); send({ k: 'gone', id: g.id }); continue;
        }
        if (!full && (g.doneT = (g.doneT || 0) + dt) > (g.water ? 3 : 8)) { remove(g.id); send({ k: 'gone', id: g.id }); continue; }
      }
      const k = 1 - g.left / LIFE; // 0 recién muerto → 1 al acabarse el tiempo
      v.t += dt;
      if (g.water) {
        // Flota con las olas y se va hundiendo poco a poco (más deprisa si ya está vacío)
        const sy = g.water === 'lake' ? G.World.waterLevelAt(g.x, g.z) : G.World.waveHeight(g.x, g.z);
        v.sink = full ? k * 1.35 : Math.min(3, (v.sink || k * 1.35) + dt * 0.8);
        v.grp.position.set(g.x, sy - 0.05 - v.sink + Math.sin(v.t * 1.6) * 0.06, g.z);
        v.grp.rotation.set(Math.sin(v.t * 1.1) * 0.08 + k * 0.3, v.t * 0.05, Math.cos(v.t * 1.3) * 0.08 + k * 0.18);
        const p = v.flag.geometry.attributes.position, b = v.base;
        for (let i = 0; i < p.count; i++) { const x = b[i * 3]; p.setZ(i, Math.sin(x * 4 - now * 6) * 0.1 * x); }
        p.needsUpdate = true;
        v.chest.userData.lid.rotation.x = full ? 0 : -1.2;
      } else {
        // La ✖ se hunde y se tiñe del color del suelo; el montículo se aplana
        const p = g.p || 0;
        // Todo va poco a poco durante los 5 minutos: la ✖ sigue sobre la tierra pero se apaga y toma el color del suelo
        const sy = 0.2 * (1 - k * 0.85) * (1 - p), top = 0.8 * sy;
        v.mound.scale.set(1 - p * 0.3, Math.max(0.005, sy), 1 - p * 0.3);
        v.moundMat.color.copy(v.dirt).lerp(v.gc, k * 0.7);
        v.xMat.color.copy(RED).lerp(v.gc, k * 0.85);
        v.xMat.opacity = Math.max(0, (1 - k * 0.95) * (1 - U.smooth(0.2, 0.6, p)));
        v.x.position.y = top + 0.02 - k * 0.03;
        v.x.visible = v.xMat.opacity > 0.01;
        v.hole.scale.setScalar(Math.max(0.001, U.smooth(0, 0.8, p)));
        for (const m of v.piles) m.scale.set(Math.max(0.001, p) * 1.1, Math.max(0.001, p) * 0.55, Math.max(0.001, p));
        // El cofre sale del hoyo y se abre
        if (g.st === 'open') {
          v.em = Math.min(1, (v.em || 0) + dt / 0.9);
          const e = 1 - Math.pow(1 - v.em, 3);
          v.chest.visible = true;
          v.chest.position.y = -0.8 + e * 0.7;
          v.chest.userData.lid.rotation.x = -U.smooth(0.6, 1, v.em) * (full ? 0.5 : 1.3);
        }
        if (k > 0.92 && full) v.grp.position.y = g.y - (k - 0.92) * 0.6;
      }
    }
    hud();
  };
})();
