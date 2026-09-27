// Mascotas con utilidad (Tienda → Mascotas), para quien la lleva puesta:
//  - Loro: grita cuando un enemigo se acerca por donde no miras.
//  - Mono: les roba cosas a los piratas (y a los marines) cuando te acercas a ellos.
//  - Gaviota: en alta mar señala la tierra más cercana y lo que flota cerca.
//  - Caracolófono: de vez en cuando recibe llamadas con pistas (cofres, peligros, rumores).
(function () {
  'use strict';
  const G = window.G;
  const Pe = (G.Pets = {});
  Pe.kind = () => { const id = G.Profile.equipped('pet'); return id ? id.replace('cos_', '') : null; };

  // Nombre de una dirección del mundo (norte = arriba en el mapa, −Z)
  const DIRS = ['norte', 'noreste', 'este', 'sureste', 'sur', 'suroeste', 'oeste', 'noroeste'];
  Pe.dirName = (dx, dz) => DIRS[Math.round(((Math.atan2(dx, -dz) / (Math.PI * 2)) * 8 + 8)) % 8];
  // Dirección respecto a donde miras
  function relName(dx, dz) {
    const yaw = G.Player.yaw, fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    const f = dx * fx + dz * fz, r = dx * rx + dz * rz;
    if (f < -Math.abs(r) * 0.6) return 'a tu espalda';
    if (Math.abs(r) > Math.abs(f)) return r > 0 ? 'a tu derecha' : 'a tu izquierda';
    return 'delante de ti';
  }
  const hostile = (c) => !c.dead && c.d.dmg && !c.d.friendly && !c.d.dummy && (!c.d.npc || (G.Story && G.Story.tribeHostile()));
  const HUMANS = ['pirate', 'pirate_gun', 'pirate_boss', 'marine', 'marine_gun', 'marine_boss'];

  let tick = 0, stealCd = 8, gullT = 20, callT = 200 + Math.random() * 160, lastWorld = null;
  const warned = new Map();

  // ------------------------------------------------------------------ loro
  function parrot(now) {
    const P = G.Player.pos;
    let best = null, bd = 1e9;
    for (const c of G.Creatures.list) {
      if (!hostile(c) || c.d.sea && !G.Player.swimming && !G.Player.ship) continue;
      const d = Math.hypot(c.x - P.x, c.z - P.z);
      if (d > 24 || (warned.get(c.id) || 0) > now - 25000) continue;
      const rel = relName(c.x - P.x, c.z - P.z);
      // Solo avisa si viene por donde no miras, o si ya está muy cerca y te persigue
      if (rel === 'delante de ti' && !(d < 7 && c.aggro > 0)) continue;
      if (d < bd) { bd = d; best = { c, rel }; }
    }
    if (!best) return;
    warned.set(best.c.id, now);
    const pool = G.LINES.loro.aviso, line = pool[Math.floor(Math.random() * pool.length)];
    G.Voice.say('loro', line, { ch: 'bark' });
    G.UI.msg(`🦜 ${G.stripMood(line)} <b>${best.c.name || best.c.d.name}</b> ${best.rel} (${Math.round(bd)} m)`, 'warn', 'loro');
  }

  // ------------------------------------------------------------------ mono
  const LOOT = [['doblon', 1, 'un doblón'], ['doblon', 2, 'dos doblones'], ['bala', 3, 'tres balas'], ['polvora', 1, 'pólvora'], ['pez_asado', 1, 'un pescado asado'], ['venda', 1, 'una venda'], ['perla', 1, 'una perla']];
  function monkey() {
    if (stealCd > 0) return;
    const P = G.Player.pos;
    const c = G.Creatures.list.find((k) => !k.dead && HUMANS.includes(k.type) && Math.hypot(k.x - P.x, k.z - P.z) < 5.5);
    if (!c || Math.random() > 0.35) { stealCd = 1.5; return; }
    const [id, n, what] = LOOT[Math.floor(Math.random() * LOOT.length)];
    if (!G.ITEMS[id]) return;
    stealCd = 25;
    G.Game.give(id, n);
    G.Audio.play('pickup');
    G.UI.msg(`🐒 ¡Tu mono le ha robado ${what} a ${c.type.startsWith('marine') ? 'un marine' : 'un pirata'}!`, 'good', 'mono');
    G.Ach.add('monkeySteal');
  }

  // ------------------------------------------------------------------ gaviota
  function gull() {
    const P = G.Player.pos, A = G.Arch;
    if (A.landOf(P.x, P.z)) return;
    // Tierra más cercana
    const n = A.nearest(P.x, P.z);
    let text = '';
    if (n && n.d > 25) text = `🕊️ Tu gaviota vuela hacia el <b>${Pe.dirName(n.isl.x - P.x, n.isl.z - P.z)}</b>: hay tierra a ${Math.round(n.d)} m (${n.isl.name}).`;
    // Algo flotando cerca (barriles, botellas, cargas de barcos hundidos)
    const f = G.Landmarks.loot.filter((l) => l.float && !l.opened).map((l) => ({ l, d: Math.hypot(l.x - P.x, l.z - P.z) })).filter((o) => o.d < 90).sort((a, b) => a.d - b.d)[0];
    if (f) text += `${text ? '<br>' : '🕊️ '}La gaviota revolotea sobre algo que flota al <b>${Pe.dirName(f.l.x - P.x, f.l.z - P.z)}</b> (${f.l.name.toLowerCase()}, ${Math.round(f.d)} m).`;
    if (text) G.UI.msg(text, 'info', 'gaviota');
  }

  // ------------------------------------------------------------------ caracolófono
  function snailCall() {
    const P = G.Player.pos, tips = [];
    // Un cofre sin abrir lejos de aquí
    const w = G.state.world;
    const chests = G.Landmarks.loot.filter((l) => l.kind === 'chest' && !l.opened && !(w.loot && w.loot[l.id])).map((l) => ({ l, d: Math.hypot(l.x - P.x, l.z - P.z) })).filter((o) => o.d > 30).sort((a, b) => a.d - b.d);
    if (chests.length) { const c = chests[0], isl = G.Arch.landOf(c.l.x, c.l.z); tips.push(`Un pescador jura que hay un cofre sin abrir al <b>${Pe.dirName(c.l.x - P.x, c.l.z - P.z)}</b>, a unos ${Math.round(c.d / 10) * 10} m${isl ? ` (${isl.name})` : ''}.`); }
    // Mapa del tesoro pendiente
    if (G.Treasure && G.Treasure.pendingHint) { const h = G.Treasure.pendingHint(); if (h) tips.push(h); }
    // Barcos de la Marina cerca
    if (G.Navy && G.Navy.nearestHint) { const h = G.Navy.nearestHint(P.x, P.z); if (h) tips.push(h); }
    tips.push('Dicen que el Holandés de las Mareas sale en las noches de niebla… y que nadie que lo haya abordado ha vuelto igual.');
    tips.push('Un vigía de la Marina Blanca ha visto velas negras cerca de Isla Brasa. Ten los cañones listos.');
    tips.push('En la aldea Shandara buscan ayuda: mira su tablón de encargos.');
    const tip = tips[Math.floor(Math.random() * Math.min(tips.length, 3))];
    G.Voice.say('caracol', G.LINES.caracol.llamada, { ch: 'bark' });
    G.UI.msg(`🐌 <b>Purupurupuru…</b> ¡Llamada del caracolófono! ${tip}`, 'info', 'caracol');
  }

  // Para pruebas desde la consola
  Pe.debugCall = snailCall;

  // ------------------------------------------------------------------ fotograma
  Pe.update = function (dt) {
    if (G.state.world !== lastWorld) { lastWorld = G.state.world; warned.clear(); }
    if (!G.state.world || G.Player.dead || G.state.mode === 'cinema') return;
    const k = Pe.kind();
    if (!k) return;
    stealCd -= dt; gullT -= dt; callT -= dt;
    if ((tick -= dt) > 0) return;
    tick = 0.5;
    const now = performance.now();
    if (k === 'loro') parrot(now);
    else if (k === 'mono') monkey();
    else if (k === 'gaviota' && gullT <= 0) { gullT = 40; gull(); }
    else if (k === 'caracol' && callT <= 0) { callT = 300 + Math.random() * 240; snailCall(); }
  };
})();
