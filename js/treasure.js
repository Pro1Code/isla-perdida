// Mapas del tesoro: salen en algunos cofres de las islas, los sueltan la Hiena y algunos piratas,
// y Genbu los vende. Al leer uno (clic derecho) se marca una ✖ en el mapa (M) en algún lugar del
// archipiélago; allí se cava con E y aparece un cofre enterrado con oro, perlas y objetos raros.
// Los tesoros están en world.treasures (se guardan con la partida y se comparten en LAN).
(function () {
  'use strict';
  const G = window.G, U = G.U;
  const T = (G.Treasure = {});
  const W = () => G.state.world;
  const list = () => { const w = W(); return w ? (w.treasures = w.treasures || []) : []; };
  const DIG_R = 2.6;

  // ------------------------------------------------------------------ dónde está el tesoro
  function spot(rnd) {
    const A = G.Arch, P = G.Player.pos;
    const isls = A.islands.filter((s) => s.r > 25);
    for (let tries = 0; tries < 200; tries++) {
      const s = isls[Math.floor(rnd() * isls.length)];
      const a = rnd() * Math.PI * 2, d = s.r * (0.2 + rnd() * 0.6), x = s.x + Math.cos(a) * d, z = s.z + Math.sin(a) * d, h = G.height(x, z);
      if (h < 1.2 || h > 14 || G.World.inLakeWater(x, z) || G.Landmarks.blocks(x, z)) continue;
      const V = s.feat && s.feat.village;
      if (V && V.wx !== undefined && Math.hypot(x - V.wx, z - V.wz) < V.r * 1.2) continue;
      if (Math.hypot(x - P.x, z - P.z) < 40) continue;
      // Que no quede debajo de un arbusto, un árbol o una roca
      let busy = false;
      G.Res.query(x, z, 3, (r) => { if (r.alive) busy = true; });
      if (busy) continue;
      return { x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10, isl: s.id };
    }
    return null;
  }
  // Leer el mapa: marca un tesoro nuevo
  T.read = function () {
    if (G.Inv.count('mapa_tesoro') <= 0) return;
    const rnd = U.rng((Date.now() ^ (Math.random() * 1e9)) >>> 0);
    const s = spot(rnd);
    if (!s) { G.UI.msg('El mapa está demasiado borroso para entenderlo…', 'warn'); return; }
    G.Inv.remove('mapa_tesoro', 1);
    const tr = { id: 'tr' + Date.now().toString(36) + Math.floor(rnd() * 1000), x: s.x, z: s.z, isl: s.isl, seed: Math.floor(rnd() * 1e9), by: G.Net.name || '' };
    list().push(tr);
    G.Net.send({ t: 'trNew', tr });
    const isl = G.Arch.byId(s.isl), P = G.Player.pos;
    G.Story.show({ who: '🗺️ Mapa del tesoro', text: `Un mapa arrugado, manchado de ron. Una ✖ roja marca un punto de ${isl ? isl.name : 'una isla'}, al ${G.Pets.dirName(s.x - P.x, s.z - P.z)} de aquí.\n\nLa ✖ ya está en tu mapa (M). Cuando llegues, cava con E.` });
    G.Audio.play('select');
  };
  T.pendingHint = function () {
    const P = G.Player.pos, t = list().filter((q) => !q.dug).sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z))[0];
    if (!t) return null;
    const isl = G.Arch.byId(t.isl);
    return `Recuerda tu mapa del tesoro: la ✖ está al <b>${G.Pets.dirName(t.x - P.x, t.z - P.z)}</b>${isl ? `, en ${isl.name}` : ''}.`;
  };

  // ------------------------------------------------------------------ cavar
  T.near = function () {
    if (!G.state.world) return null;
    const P = G.Player.pos;
    return list().find((t) => !t.dug && Math.hypot(t.x - P.x, t.z - P.z) < DIG_R) || null;
  };
  // Botín del cofre enterrado (siempre el mismo para el mismo tesoro)
  function lootOf(t) {
    const r = U.rng(t.seed || 7), pick = (a) => a[Math.floor(r() * a.length)];
    const out = [['doblon', 6 + Math.floor(r() * 13)], ['perla', 1 + Math.floor(r() * 4)]];
    const extra = [['lingote', 2 + Math.floor(r() * 3)], ['obsidiana', 1 + Math.floor(r() * 2)], ['polvora', 3], ['bala', 12], ['infusion', 2], ['venda', 3], ['chocolate', 2], ['catalejo', 1]];
    for (let i = 0; i < 2; i++) out.push(pick(extra));
    if (r() < 0.12) out.push([pick(['sable', 'katana', 'mosquete']), 1]);
    if (r() < 0.2) out.push(['mapa_tesoro', 1]);
    return out.filter(([id]) => G.ITEMS[id]);
  }
  // El botín se queda en el cofre desenterrado (se abre al momento; con la mochila llena no se pierde nada)
  function reward(t, who) {
    const items = lootOf(t), coins = 30 + Math.floor(U.rng((t.seed || 7) + 1)() * 50);
    chestOf(t);
    if (!G.Net.active || who === G.Net.myId) {
      G.UI.fade(() => {
        G.Profile.addCoins(coins, 'Tesoro enterrado');
        G.UI.banner('💰 ¡Un tesoro enterrado!', items.map(([id, n]) => `${n} ${G.icon(id, 'xs')}`).join('  '));
        G.Audio.play('win');
        G.Ach.add('treasureMap');
        G.Quests.onEvent('treasure');
        G.Game.buryStore(t.id, items, who);
      });
    } else G.Game.buryStore(t.id, items, who);
  }
  // Cofre abierto donde estaba la ✖ (se puede volver a abrir y guardar cosas)
  const chests = new Set();
  function chestOf(t) {
    if (chests.has(t.id) || G.Landmarks.byId(t.id)) return;
    chests.add(t.id);
    const y = G.height(t.x, t.z), c = G.Landmarks.makeChest(t.id, t.x, y, t.z, (t.seed || 0) % 6, true, true);
    c.name = 'Cofre del tesoro';
    G.Landmarks.loot.push(c);
    G.Landmarks.setOpened(t.id, true);
  }
  T.dig = function () {
    const t = T.near();
    if (!t) return false;
    G.Audio.play('chop');
    G.Player.swing = 1;
    if (G.Net.active && !G.Net.isHost) { G.Game.expectStore(t.id); G.Net.send({ t: 'trDig', id: t.id }); G.UI.msg('⛏️ Cavando…', 'info', 'dig'); return true; }
    finish(t, G.Net.myId);
    return true;
  };
  // Solo el anfitrión (o la partida individual) decide quién se lo lleva
  function finish(t, who) {
    if (t.dug) return;
    t.dug = 1;
    removeMark(t);
    G.Net.send({ t: 'trDone', id: t.id });
    reward(t, who);
  }
  T.onNet = function (m, from) {
    if (m.t === 'trNew') { if (!list().some((t) => t.id === m.tr.id)) list().push(m.tr); }
    else if (m.t === 'trDig' && G.Net.isHost) { const t = list().find((q) => q.id === m.id); if (t) finish(t, from); }
    else if (m.t === 'trDone') { const t = list().find((q) => q.id === m.id); if (t) { t.dug = 1; removeMark(t); chestOf(t); } }
  };

  // ------------------------------------------------------------------ de dónde salen los mapas
  const hashId = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
  // Algunos cofres de las islas traen un mapa (siempre los mismos)
  T.lootExtra = function (id) {
    const c = G.Landmarks.byId(id);
    return c && c.kind === 'chest' && hashId(id + ':mapa') < 0.35 ? [['mapa_tesoro', 1]] : [];
  };
  // La Hiena siempre lleva uno; los piratas, a veces
  T.onKill = function (type) {
    const p = type === 'pirate_boss' || type === 'marine_boss' ? 1 : type === 'pirate' || type === 'pirate_gun' ? 0.12 : 0;
    if (p && Math.random() < p) { G.Game.give('mapa_tesoro', 1); G.UI.msg('🗺️ ¡Llevaba encima un mapa del tesoro! (clic derecho para leerlo)', 'good', 'mapa'); }
  };

  // ------------------------------------------------------------------ la ✖ en el mapa y en el suelo
  T.drawMap = function (ctx, toPx, full) {
    for (const t of list()) {
      if (t.dug) continue;
      const [x, y] = toPx(t.x, t.z), s = full ? 8 : 5;
      ctx.strokeStyle = '#d02020'; ctx.lineWidth = full ? 4 : 3;
      ctx.beginPath(); ctx.moveTo(x - s, y - s); ctx.lineTo(x + s, y + s); ctx.moveTo(x + s, y - s); ctx.lineTo(x - s, y + s); ctx.stroke();
    }
  };
  const marks = new Map();
  function makeMark(t) {
    const M = G.Mdl, K = G.Landmarks.kit(), y = G.height(t.x, t.z);
    const parts = [
      M.xf(M.paint(new THREE.BoxGeometry(1.3, 0.05, 0.16), 0xb0201a), 0, 0.04, 0, 0, 0.785, 0),
      M.xf(M.paint(new THREE.BoxGeometry(1.3, 0.05, 0.16), 0xb0201a), 0, 0.045, 0, 0, -0.785, 0),
      M.xf(M.paint(new THREE.SphereGeometry(0.7, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0x8a6a42), 0, -0.02, 0, 0, 0, 0, [1, 0.18, 1]),
      M.xf(M.paint(new THREE.CylinderGeometry(0.03, 0.035, 1.1, 5), 0x6a4a2a), 0.9, 0.5, 0.3, 0, 0, 0.12),
      M.xf(M.paint(new THREE.BoxGeometry(0.34, 0.24, 0.03), 0xe8d8b0), 0.93, 0.95, 0.3, 0, 0, 0.12),
    ];
    const m = new THREE.Mesh(U.merge(parts), K.mats().vc);
    m.position.set(t.x, y, t.z);
    K.track(m);
    marks.set(t.id, m);
  }
  function removeMark(t) {
    const m = marks.get(t.id);
    if (m) { m.visible = false; marks.delete(t.id); }
  }
  let checkT = 0, lastWorld = null;
  T.update = function (dt) {
    if (G.state.world !== lastWorld) { lastWorld = G.state.world; marks.clear(); chests.clear(); }
    if (!G.state.world || (checkT -= dt) > 0) return;
    checkT = 1;
    const P = G.Player.pos;
    for (const t of list()) {
      if (Math.hypot(t.x - P.x, t.z - P.z) > 120) continue;
      if (!t.dug && !marks.has(t.id)) makeMark(t);
      else if (t.dug && !chests.has(t.id)) chestOf(t);
    }
  };
})();
