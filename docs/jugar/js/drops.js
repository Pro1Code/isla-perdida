// Objetos soltados en el suelo (tecla B o botón "Soltar" del inventario):
// se ven flotando y girando, se recogen al pasar por encima y desaparecen a los 5 minutos
// (parpadean los últimos segundos). En el agua flotan. Se comparten en LAN y se guardan con la partida.
(function () {
  'use strict';
  const G = window.G, U = G.U, V3 = THREE.Vector3;
  const D = (G.Drops = { list: [] });
  const LIFE = 300, PICK_DELAY = 1.5, PICK_R = 1.35;

  // Icono del objeto (emoji) con la cantidad, para los objetos sin modelo 3D
  const texCache = {};
  function iconTex(id, n) {
    const key = id + ':' + (n > 1 ? n : 1);
    if (texCache[key]) return texCache[key];
    const count = (c, w, h) => {
      if (n <= 1) return;
      c.shadowBlur = 0; c.font = 'bold 26px sans-serif'; c.textAlign = 'right'; c.lineWidth = 5; c.strokeStyle = '#000'; c.fillStyle = '#fff';
      c.strokeText('×' + n, w - 2, h - 10); c.fillText('×' + n, w - 2, h - 10);
    };
    const t = U.canvasTex(96, 96, (c, w, h) => { c.clearRect(0, 0, w, h); count(c, w, h); });
    const im = new Image();
    im.onload = () => { const c = t.image.getContext('2d'); c.clearRect(0, 0, 96, 96); c.drawImage(im, 0, 0, 96, 96); count(c, 96, 96); t.needsUpdate = true; };
    im.src = G.iconSrc(id);
    texCache[key] = t;
    return t;
  }
  const shadowGeo = new THREE.CircleGeometry(0.24, 16).rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false });

  // Superficie donde se queda: el suelo (o el piso construido) o el agua (mar o lago)
  function surface(x, z) {
    const g = G.Build.groundAt(x, z), wl = G.World.waterLevelAt(x, z);
    if (G.height(x, z) < wl && g < wl + 0.05) return { y: wl + G.World.waveHeight(x, z), water: true };
    return { y: g, water: false };
  }

  function build(d) {
    const g = new THREE.Group();
    const m = G.makeItemMesh(d.item);
    if (m) {
      // Herramientas y armas: el modelo real, tumbado y girando
      m.scale.setScalar(0.85);
      m.rotation.z = Math.PI / 2 - 0.3;
      const pivot = new THREE.Group(); pivot.add(m); m.position.set(0.2, 0, 0);
      d.spin = pivot; g.add(pivot);
      if (d.n > 1) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconTex(d.item, d.n), depthWrite: false })); s.scale.set(0.32, 0.32, 1); s.position.set(0.25, 0.3, 0); g.add(s); }
    } else {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconTex(d.item, d.n), depthWrite: false }));
      s.scale.set(0.5, 0.5, 1); d.spin = null; g.add(s);
    }
    d.shadow = new THREE.Mesh(shadowGeo, shadowMat);
    G.scene.add(d.shadow);
    d.g = g;
    G.scene.add(g);
  }
  function dispose(d) {
    if (d.g) { G.scene.remove(d.g); d.g.traverse((o) => { if (o.isSprite) o.material.dispose(); }); d.g = null; }
    if (d.shadow) { G.scene.remove(d.shadow); d.shadow = null; }
  }
  // d = { id, item, n, dur, x, y, z, vx, vy, vz, age }
  D.add = function (d) {
    if (!G.ITEMS[d.item] || D.list.some((o) => o.id === d.id)) return;
    d.age = d.age || 0; d.vx = d.vx || 0; d.vy = d.vy || 0; d.vz = d.vz || 0; d.ph = Math.random() * 6;
    build(d);
    D.list.push(d);
  };
  function remove(id) {
    const i = D.list.findIndex((o) => o.id === id);
    if (i < 0) return null;
    const d = D.list[i];
    dispose(d);
    D.list.splice(i, 1);
    return d;
  }
  D.clear = function () { for (const d of D.list) dispose(d); D.list.length = 0; };
  D.getState = () => D.list.map((d) => ({ id: d.id, item: d.item, n: d.n, dur: d.dur, x: +d.x.toFixed(2), y: +d.y.toFixed(2), z: +d.z.toFixed(2), age: Math.round(d.age) }));
  D.setState = function (arr) { D.clear(); for (const d of arr || []) D.add(Object.assign({}, d)); };

  // ------------------------------------------------------------------ soltar
  const _e = new V3(), _f = new V3();
  // Suelta n objetos de la casilla i del inventario (sin n: toda la pila)
  D.dropSlot = function (i, n) {
    const S = G.Inv.slots, s = S[i];
    if (!s || G.Player.dead) return false;
    const k = Math.min(s.n, n || s.n);
    G.Player.eyePos(_e); G.Player.lookDir(_f);
    _f.y = Math.max(-0.3, _f.y); _f.normalize();
    const d = {
      id: 'gd:' + (G.Net.myId || 0) + ':' + Date.now().toString(36) + Math.floor(Math.random() * 1e4),
      item: s.id, n: k, dur: s.d,
      x: _e.x + _f.x * 0.6, y: _e.y - 0.35, z: _e.z + _f.z * 0.6,
      vx: _f.x * 3.2 + G.Player.vel.x * 0.5, vy: 2.2 + _f.y * 2.5, vz: _f.z * 3.2 + G.Player.vel.z * 0.5, age: 0,
    };
    s.n -= k;
    if (s.n <= 0) S[i] = null;
    G.Inv.changed();
    G.Net.send({ t: 'gdrop', d: Object.assign({}, d) });
    D.add(d);
    G.Audio.play('swing');
    return true;
  };
  // Tecla B: suelta 1 del objeto en la mano (Mayús + B: toda la pila)
  D.dropHeld = function (all) {
    const i = G.Inv.sel, s = G.Inv.slots[i];
    if (!s) { G.UI.msg('No tienes nada en la mano para soltar.', 'info', 'drop'); return; }
    D.dropSlot(i, all ? s.n : 1);
  };

  // ------------------------------------------------------------------ recoger
  // ¿Cabe todo en el inventario?
  function fits(id, n) {
    const max = G.Inv.maxStack(id);
    let room = 0;
    for (const s of G.Inv.slots) {
      if (!s) room += max;
      else if (s.id === id && !G.ITEMS[id].tool) room += max - s.n;
      if (room >= n) return true;
    }
    return false;
  }
  function give(d) {
    if (G.ITEMS[d.item].tool && d.dur !== undefined) {
      // Las herramientas conservan su desgaste
      const e = G.Inv.slots.findIndex((x) => !x);
      if (e >= 0) { G.Inv.slots[e] = { id: d.item, n: 1, d: d.dur }; G.Inv.changed(); G.UI.msg(`+1 ${G.icon(d.item, 'xs')} ${G.ITEMS[d.item].n}`, 'item'); }
    } else G.Game.give(d.item, d.n);
    G.Audio.play('pickup');
  }
  function tryPick(d) {
    if (d.pending || d.age < PICK_DELAY) return;
    if (!fits(d.item, d.n)) { if (!d.full) { d.full = true; G.UI.msg('¡Inventario lleno! No puedes recoger eso.', 'warn', 'full'); } return; }
    if (G.Net.active && !G.Net.isHost) { d.pending = 2; G.Net.send({ t: 'gtakeReq', id: d.id }); return; }
    remove(d.id);
    give(d);
    G.Net.send({ t: 'gtake', id: d.id, who: G.Net.myId });
  }
  D.onNet = function (m, from) {
    if (m.t === 'gdrop') D.add(m.d);
    else if (m.t === 'gtakeReq' && G.Net.isHost) {
      // El anfitrión decide quién se lo lleva (así nadie lo recibe dos veces)
      if (!D.list.some((o) => o.id === m.id)) return;
      remove(m.id);
      G.Net.send({ t: 'gtake', id: m.id, who: from });
    } else if (m.t === 'gtake') {
      // "who" (y no "to"): el servidor LAN entrega los mensajes con "to" solo a ese jugador
      const d = remove(m.id);
      if (d && m.who === G.Net.myId) give(d);
    }
  };

  // ------------------------------------------------------------------ fotograma
  D.update = function (dt) {
    if (!D.list.length) return;
    const P = G.Player.pos, t = performance.now() / 1000;
    for (let i = D.list.length - 1; i >= 0; i--) {
      const d = D.list[i];
      d.age += dt;
      if (d.age > LIFE) { dispose(d); D.list.splice(i, 1); continue; }
      if (d.pending && (d.pending -= dt) <= 0) d.pending = 0;
      // Cae hasta el suelo o el agua
      const sf = surface(d.x, d.z);
      if (d.vx || d.vz || d.vy || d.y > sf.y + 0.02) {
        d.vy -= 18 * dt;
        d.x += d.vx * dt; d.z += d.vz * dt; d.y += d.vy * dt;
        const s2 = surface(d.x, d.z);
        if (d.y <= s2.y) { d.y = s2.y; d.vy = 0; d.vx *= 0.3; d.vz *= 0.3; if (Math.abs(d.vx) + Math.abs(d.vz) < 0.2) d.vx = d.vz = 0; }
      } else d.y = sf.y;
      const bob = 0.28 + Math.sin(t * 2 + d.ph) * 0.06;
      d.g.position.set(d.x, d.y + bob, d.z);
      if (d.spin) d.spin.rotation.y = t * 1.4 + d.ph;
      d.shadow.position.set(d.x, d.y + 0.03, d.z);
      d.shadow.visible = !sf.water;
      // Parpadea los últimos 15 segundos
      d.g.visible = LIFE - d.age > 15 || Math.sin(d.age * 14) > -0.2;
      if (!G.Player.dead && Math.hypot(d.x - P.x, d.z - P.z) < PICK_R && Math.abs(d.y - P.y) < 2.2) tryPick(d);
    }
  };
})();
