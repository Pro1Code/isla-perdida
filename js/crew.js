// Tu tripulación: tras encontrar la fruta de Rogan, la capitana Mara te confía a Kaito, Crane y Bastián.
//  - En tierra te siguen y pelean a tu lado (Kaito con la espada, Crane con el mosquete, Bastián a puñetazos).
//  - En tu barco suben contigo (si caben), disparan y golpean a lo que se acerque, reparan el casco
//    poco a poco y hacen que navegues más rápido.
//  - Hablando con ellos puedes decirles que te sigan o que esperen donde están.
// La IA corre donde se simulan las criaturas (partida individual o anfitrión).
(function () {
  'use strict';
  const G = window.G, U = G.U, V3 = THREE.Vector3;
  const Cr = (G.Crew = {});
  Cr.IDS = [2, 3, 4]; // Kaito, Crane y Bastián (índices de G.Prologue.NPCS)
  const KEY = { 2: 'kaito', 3: 'crane', 4: 'bastian' };
  const DMG = { 2: 14, 3: 12, 4: 10 }, REACH = { 2: 2.4, 3: 17, 4: 2.1 }, CD = { 2: 1.0, 3: 2.2, 4: 0.75 };
  const SIDE = { 2: [-1.6, -2.4], 3: [1.6, -2.6], 4: [0, -3.8] }; // [lado, atrás] respecto a ti
  const CAP = { balsa: 2, canoa: 1, velero: 3, lancha: 3, barco: 3 };
  const flags = () => (G.state.world && G.state.world.story && G.state.world.story.flags) || {};
  Cr.joined = () => !!flags().crewJoined;
  Cr.following = () => Cr.joined() && !flags().crewWait;
  Cr.isMate = (c) => c && c.type === 'npc' && Cr.IDS.includes(c.extra);

  // Jugadores (tú y los demás en LAN) con su barco
  function players() {
    const P = G.Player, out = [{ id: G.Net.myId, x: P.pos.x, y: P.pos.y, z: P.pos.z, yaw: P.yaw, dead: P.dead, ship: P.ship }];
    for (const p of G.Net.peers.values()) out.push({ id: p.id, x: p.x, y: p.y, z: p.z, yaw: p.yaw || 0, dead: p.dead || p.out, ship: p.shipId ? G.Ships.byId(p.shipId) : null });
    return out;
  }
  function leaderOf(c) {
    const ps = players().filter((p) => !p.dead), f = flags();
    return ps.find((p) => p.id === f.crewLeader) || ps.sort((a, b) => Math.hypot(a.x - c.x, a.z - c.z) - Math.hypot(b.x - c.x, b.z - c.z))[0] || null;
  }
  const hostile = (e) => !e.dead && e.d.dmg && !e.d.friendly && !e.d.dummy && (!e.d.npc || (e.type === 'villager' && G.Story.tribeHostile())) && !G.Faction.friendly(e);

  // ------------------------------------------------------------------ a bordo
  const _l = new V3(), _w = new V3();
  function deckSlot(ship, idx) {
    const d = ship.def, L = d.L || 4;
    const zs = [-L * 0.22, -L * 0.02, L * 0.2], xs = [-0.55, 0.55, 0];
    return _l.set(xs[idx % 3], d.deckY + 0.02, zs[idx % 3]);
  }
  // Compañeros que caben en ese barco (en orden: Kaito, Crane, Bastián)
  function aboardList(ship) { return Cr.IDS.slice(0, CAP[ship.type] ?? 3); }
  // Cuántos tripulantes van en un barco (para la velocidad; funciona en cualquier equipo de la LAN)
  Cr.aboardCount = function (ship) {
    if (!ship || !Cr.joined()) return 0;
    const r = (ship.def.L || 4) / 2 + 1;
    return G.Creatures.list.filter((c) => Cr.isMate(c) && !c.dead && Math.hypot(c.x - ship.x, c.z - ship.z) < r && c.y > G.height(c.x, c.z) + 0.2).length;
  };

  // ------------------------------------------------------------------ combate
  const lastBark = {};
  function bark(c, what) {
    const now = performance.now();
    if (lastBark[c.extra] && now - lastBark[c.extra] < 40000) return;
    lastBark[c.extra] = now;
    const line = G.LINES[KEY[c.extra]][what];
    if (line) G.Voice.say(KEY[c.extra], line, { ch: 'bark', at: c });
  }
  function strike(c, e, L) {
    if ((c.crewCd = (c.crewCd || 0)) > 0) return;
    c.crewCd = CD[c.extra];
    c.lunge = 0.3;
    if (c.extra === 3) {
      // Crane dispara: fogonazo y trazo de la bala
      const from = new V3(c.x + Math.sin(c.yaw) * 0.6, c.y + 1.4, c.z + Math.cos(c.yaw) * 0.6), a = G.Creatures.aimPoint(e);
      if (G.Styles.tracer) G.Styles.tracer(from, new V3(a.x, a.y, a.z));
      G.Ships.puff(from.x, from.y, from.z, 0xd8d0c0, 0.4, 0.3, 2);
      G.Audio.playAt('cannon', c.x, c.z, 45);
    } else G.Audio.playAt('hit', c.x, c.z, 30);
    G.Creatures.hurt(e, DMG[c.extra], L ? L.id : undefined);
    bark(c, 'fight');
  }
  // Enemigo más cercano a ti (o al compañero) que merezca la pena
  function enemyNear(c, L, rad) {
    let best = null, bd = 1e9;
    for (const e of G.Creatures.list) {
      if (!hostile(e)) continue;
      const dl = Math.hypot(e.x - L.x, e.z - L.z), dc = G.Creatures.distTo(e, c.x, c.z);
      if (dl > rad && dc > rad * 0.7) continue;
      if (dc < bd) { bd = dc; best = e; }
    }
    return best ? { e: best, d: bd } : null;
  }

  // ------------------------------------------------------------------ plan de cada fotograma (lo llama creatures.js)
  // Devuelve { aboard } si va en el barco (ya colocado) o { tx, tz, speed, still, face }
  Cr.plan = function (c, dt) {
    const L = leaderOf(c);
    if (!L) return null;
    c.crewCd = (c.crewCd || 0) - dt;
    // En tu barco
    const ship = L.ship;
    if (ship && !ship.sinking) {
      const list = aboardList(ship), idx = list.indexOf(c.extra);
      if (idx >= 0) {
        G.Ships.toWorld(ship, deckSlot(ship, idx), _w);
        c.x = _w.x; c.z = _w.z; c.y = _w.y;
        c.aboard = ship.id;
        const en = enemyNear(c, c, 24);
        if (en && en.d < REACH[c.extra] + (c.extra === 3 ? 6 : 1.2)) { c.yaw = Math.atan2(en.e.x - c.x, en.e.z - c.z); strike(c, en.e, L); }
        else c.yaw = ship.yaw;
        return { aboard: true };
      }
      // No cabe: espera donde está
      c.aboard = null;
      return { tx: c.x, tz: c.z, speed: 0, still: true };
    }
    // Acaba de bajar del barco: aparece a tu lado
    if (c.aboard) { c.aboard = null; teleport(c, L); }
    const dl = Math.hypot(L.x - c.x, L.z - c.z);
    if (dl > 45) { teleport(c, L); return { tx: c.x, tz: c.z, speed: 0, still: true }; }
    // Pelea a tu lado
    const en = enemyNear(c, L, 14);
    if (en) {
      const e = en.e;
      if (c.extra === 3) {
        // Crane: dispara a distancia y se aparta si se le acercan
        if (en.d < 5) return { tx: c.x - (e.x - c.x), tz: c.z - (e.z - c.z), speed: c.d.run, face: e };
        if (en.d <= REACH[3]) { c.yaw = Math.atan2(e.x - c.x, e.z - c.z); strike(c, e, L); return { tx: c.x, tz: c.z, speed: 0, still: true, face: e }; }
        return { tx: e.x, tz: e.z, speed: c.d.run, face: e };
      }
      if (en.d <= REACH[c.extra]) { strike(c, e, L); return { tx: c.x, tz: c.z, speed: 0, still: true, face: e }; }
      return { tx: e.x, tz: e.z, speed: c.d.run * 1.4, face: e };
    }
    // Te sigue unos pasos por detrás, cada uno a un lado
    const fx = -Math.sin(L.yaw), fz = -Math.cos(L.yaw), rx = Math.cos(L.yaw), rz = -Math.sin(L.yaw), o = SIDE[c.extra];
    const tx = L.x + rx * o[0] + fx * o[1], tz = L.z + rz * o[0] + fz * o[1], dt2 = Math.hypot(tx - c.x, tz - c.z);
    if (dt2 < 1.2) return { tx: c.x, tz: c.z, speed: 0, still: true, face: { x: L.x + fx * 10, z: L.z + fz * 10 } };
    return { tx, tz, speed: dl > 9 ? c.d.run * 1.6 : c.d.speed * 1.4 };
  };
  function teleport(c, L) {
    const o = SIDE[c.extra], fx = -Math.sin(L.yaw), fz = -Math.cos(L.yaw), rx = Math.cos(L.yaw), rz = -Math.sin(L.yaw);
    for (const k of [1, 0.5, 0]) {
      const x = L.x + (rx * o[0] + fx * o[1]) * k, z = L.z + (rz * o[0] + fz * o[1]) * k;
      if (G.height(x, z) > 0.4 && !G.World.inLakeWater(x, z)) { c.x = x; c.z = z; c.y = G.height(x, z); return; }
    }
  }

  // ------------------------------------------------------------------ cada segundo: seguir o esperar, reaparecer y reparar
  let t = 0;
  Cr.update = function (dt) {
    if (!G.state.world || !G.Net.authority() || (t -= dt) > 0) return;
    t = 1;
    const follow = Cr.following();
    for (const c of G.Creatures.list) if (Cr.isMate(c)) c.follow = follow;
    if (!follow) return;
    // Si no están cerca (p. ej. al cargar la partida lejos del campamento), aparecen a tu lado
    const L = players()[0];
    for (const k of Cr.IDS) {
      if (G.Creatures.list.some((c) => c.type === 'npc' && c.extra === k)) continue;
      const c = G.Creatures.spawn('npc', L.x, L.z, undefined, k);
      c.follow = true; teleport(c, L);
    }
    // Reparan el casco de tu barco cuando no hay peligro cerca
    for (const p of players()) {
      const s = p.ship;
      if (!s || s.sinking || s.hp >= s.def.hp) continue;
      const n = Cr.aboardCount(s);
      if (n && !G.Creatures.list.some((e) => hostile(e) && Math.hypot(e.x - s.x, e.z - s.z) < 30)) G.Ships.hurt(s, -0.5 * n);
    }
  };

  // ------------------------------------------------------------------ órdenes (desde el diálogo)
  Cr.join = function () {
    const w = G.state.world.story; w.flags = w.flags || {};
    w.flags.crewJoined = 1; w.flags.crewWait = 0; w.flags.crewLeader = G.Net.myId;
    G.Net.send({ t: 'story', w });
    G.UI.banner('⚓ ¡Tu tripulación se une a ti!', 'Kaito, Crane y Bastián te siguen: pelearán a tu lado y subirán a tu barco');
    G.Audio.play('win');
    G.Ach.add('crew');
  };
  Cr.setWait = function (wait, who) {
    const w = G.state.world.story; w.flags = w.flags || {};
    w.flags.crewWait = wait ? 1 : 0; w.flags.crewLeader = G.Net.myId;
    G.Net.send({ t: 'story', w });
    for (const c of G.Creatures.list) if (Cr.isMate(c)) { c.follow = !wait; if (wait) { c.hx = c.x; c.hz = c.z; c.homeR = 3; } }
    const k = who && KEY[who.extra];
    if (k) G.Voice.say(k, G.LINES[k][wait ? 'wait' : 'follow'], { ch: 'dialog' });
    G.UI.msg(wait ? '⚓ Tu tripulación te esperará aquí.' : '⚓ Tu tripulación te sigue.', 'info', 'crew');
  };
  // Opciones para el diálogo con Kaito, Crane o Bastián
  Cr.options = function (c) {
    if (!Cr.joined()) return null;
    return Cr.following() ? [['«Esperad aquí, tripulación.»', () => Cr.setWait(1, c)], ['Nada, seguimos.', null]] : [['«¡Tripulación, seguidme!»', () => Cr.setWait(0, c)], ['Nada, esperad.', null]];
  };
})();
