// Batallas navales contra la Marina Blanca:
//  - Sus barcos patrullan el mar abierto (tras el prólogo) y persiguen al que navega; más cuanto más alta es tu recompensa.
//  - Se colocan de costado y disparan andanadas. Tu tripulación (Crane) dispara tus cañones si tienes munición.
//  - En cubierta llevan marines: los tiradores disparan desde allí; si abordas su barco (E en el casco),
//    pelea con ellos: si caen todos, el barco se rinde y es tuyo.
//  - Hundido deja una carga de botín flotando y sube tu recompensa.
// El anfitrión (o la partida individual) mueve los barcos y sus cañones; los demás reciben su posición.
(function () {
  'use strict';
  const G = window.G, U = G.U, V3 = THREE.Vector3;
  const N = (G.Navy = { list: [] });
  const TYPES = { velero: { crew: 3, speed: 8.5, turn: 0.45, guns: 2 }, barco: { crew: 5, speed: 7.5, turn: 0.32, guns: 3 } };
  const NAMES = ['Integridad', 'Vigilancia', 'Orden Eterno', 'Mano Justa', 'Faro Blanco', 'Centinela'];
  const flags = () => (G.state.world && G.state.world.story && G.state.world.story.flags) || {};

  // Barcos de los jugadores (o jugadores nadando) a los que perseguir
  function preys() {
    const out = [], P = G.Player;
    if (!P.dead) out.push({ id: G.Net.myId, x: P.pos.x, z: P.pos.z, ship: P.ship, local: true });
    for (const p of G.Net.peers.values()) if (!p.dead && !p.out) out.push({ id: p.id, x: p.x, z: p.z, ship: p.shipId ? G.Ships.byId(p.shipId) : null });
    return out;
  }
  const deep = (x, z) => G.height(x, z) < -3.5;

  // ------------------------------------------------------------------ aparecer
  function spawn(near) {
    const kind = G.Bounty.value() > 40000 || Math.random() < 0.35 ? 'barco' : 'velero';
    const a = Math.random() * Math.PI * 2;
    let x = near.x + Math.cos(a) * 170, z = near.z + Math.sin(a) * 170;
    for (let k = 0; k < 12 && !deep(x, z); k++) { const b = a + k * 0.5; x = near.x + Math.cos(b) * 170; z = near.z + Math.sin(b) * 170; }
    if (!deep(x, z)) return null;
    const name = '*' + NAMES[Math.floor(Math.random() * NAMES.length)] + ' (Marina Blanca)';
    const s = G.Ships.create({ type: kind, x, z, yaw: Math.atan2(near.x - x, near.z - z), anchor: false, sail: 'marea', flag: 'ancla', fh: 'aguila', name, flagColor: '#f4f4f0' });
    setup(s, kind);
    // Marines en cubierta
    const T = TYPES[kind], boss = kind === 'barco' && Math.random() < 0.5;
    for (let k = 0; k < T.crew; k++) {
      const type = boss && k === 0 ? 'marine_boss' : k % 2 ? 'marine_gun' : 'marine';
      const c = G.Creatures.spawn(type, x, z, undefined, Math.floor(Math.random() * 1000));
      c.deck = { ship: s.id, slot: k };
    }
    G.Net.send({ t: 'navyNew', d: { id: s.id, type: kind, x, z, yaw: s.yaw, name } });
    if (G.Player.ship || G.SeaWx.atSea(G.Player.pos.x, G.Player.pos.z)) G.UI.msg(`⚓ ¡Velas blancas en el horizonte! Un barco de la Marina Blanca (${name.slice(1)}) viene a por ti.`, 'bad', 'navy');
    return s;
  }
  function setup(s, kind) {
    s.navy = { kind, T: TYPES[kind], cd: { 1: 3, [-1]: 3 }, target: null, lostT: 0 };
    s.hp = s.def.hp * 0.85;
    s.nx = s.x; s.nz = s.z; s.nyaw = s.yaw; s.lastNet = performance.now();
    N.list.push(s);
  }

  // ------------------------------------------------------------------ marines en cubierta (lo llama creatures.js)
  const _l = new V3(), _w = new V3();
  N.placeOnDeck = function (c) {
    const s = G.Ships.byId(c.deck.ship);
    if (!s || s.sinking) return false;
    const d = s.def, L = d.L || 8, k = c.deck.slot;
    const zs = [-L * 0.3, -L * 0.1, L * 0.1, L * 0.28, 0], xs = [0.6, -0.6, 0.6, -0.6, 0];
    G.Ships.toWorld(s, _l.set(xs[k % 5], d.deckY + 0.02, zs[k % 5]), _w);
    c.x = _w.x; c.z = _w.z; c.y = _w.y;
    return true;
  };

  // ------------------------------------------------------------------ navegar y disparar (anfitrión)
  N.steer = function (s, dt) {
    const nv = s.navy, T = nv.T;
    // Presa más cercana
    let prey = null, pd = 1e9;
    for (const p of preys()) { const d = Math.hypot(p.x - s.x, p.z - s.z); if (d < pd) { pd = d; prey = p; } }
    let want = s.yaw, speed = T.speed;
    if (!prey || pd > 450) { nv.lostT += dt; if (nv.lostT > 20) { N.remove(s); return; } }
    else {
      nv.lostT = 0;
      const toP = Math.atan2(prey.x - s.x, prey.z - s.z);
      if (pd > 70) want = toP;
      else {
        // De costado: la presa a babor o estribor, rondando a unos 45 m
        nv.side = nv.side || (U.angDiff(s.yaw, toP) > 0 ? 1 : -1);
        want = toP - nv.side * (Math.PI / 2 - U.clamp((pd - 45) / 40, -0.5, 0.5));
        speed = T.speed * 0.8;
      }
    }
    // Evitar la costa: si por delante hay poco fondo, busca el rumbo más profundo
    const look = (a, d) => G.height(s.x + Math.sin(a) * d, s.z + Math.cos(a) * d);
    if (look(want, 30) > -3.5 || look(s.yaw, 20) > -3.5) {
      let best = want, bh = Infinity;
      for (const da of [0.4, -0.4, 0.8, -0.8, 1.3, -1.3, 2, -2, Math.PI]) { const h = look(s.yaw + da, 30); if (h < bh) { bh = h; best = s.yaw + da; } }
      want = best; speed *= 0.6;
    }
    s.yaw += U.clamp(U.angDiff(s.yaw, want), -T.turn * dt, T.turn * dt);
    s.speed += (speed - s.speed) * Math.min(1, dt * 0.5);
    const nx = s.x + Math.sin(s.yaw) * s.speed * dt, nz = s.z + Math.cos(s.yaw) * s.speed * dt;
    if (G.height(nx, nz) < -2.2) { s.x = nx; s.z = nz; } else s.speed *= 0.3;
    for (const o of G.Ships.list) {
      if (o === s || o.sinking) continue;
      const dd = Math.hypot(o.x - s.x, o.z - s.z), min = (Math.min(o.def.L, o.def.W * 2) + Math.min(s.def.L, s.def.W * 2)) * 0.35;
      if (dd < min && dd > 0.01) { const push = (min - dd) * 0.5; s.x -= (o.x - s.x) / dd * push; s.z -= (o.z - s.z) / dd * push; s.speed *= 0.9; }
    }
    s.nx = s.x; s.nz = s.z; s.nyaw = s.yaw;
    // Andanadas: cuando la presa está de costado y a tiro
    if (prey && pd < 75) {
      const rel = U.angDiff(s.yaw, Math.atan2(prey.x - s.x, prey.z - s.z)), side = rel > 0 ? 1 : -1;
      nv.cd[1] -= dt; nv.cd[-1] -= dt;
      if (Math.abs(Math.abs(rel) - Math.PI / 2) < 0.55 && nv.cd[side] <= 0) { nv.cd[side] = 7 + Math.random() * 3; broadside(s, side, prey, pd); }
    }
  };
  function broadside(s, side, prey, dist) {
    const T = s.navy.T, L = s.def.L || 8, rx = Math.cos(s.yaw) * side, rz = -Math.sin(s.yaw) * side;
    const tgt = prey.ship || prey, vx = prey.ship ? Math.sin(prey.ship.yaw) * prey.ship.speed : 0, vz = prey.ship ? Math.cos(prey.ship.yaw) * prey.ship.speed : 0;
    for (let k = 0; k < T.guns; k++) {
      setTimeout(() => {
        if (s.sinking || !G.Ships.list.includes(s)) return;
        const along = (k - (T.guns - 1) / 2) * L * 0.22;
        const o = new V3(s.x + rx * 1.6 + Math.sin(s.yaw) * along, s.def.deckY + G.World.waveHeight(s.x, s.z) + 1.1, s.z + rz * 1.6 + Math.cos(s.yaw) * along);
        const tf = dist / 55, spread = 2 + dist * 0.05;
        const px = tgt.x + vx * tf + (Math.random() - 0.5) * spread * 2, pz = tgt.z + vz * tf + (Math.random() - 0.5) * spread * 2, py = 1.2;
        const v = new V3((px - o.x) / tf, (py - o.y) / tf + 0.5 * 9.8 * tf, (pz - o.z) / tf);
        const m = { t: 'cannon', x: o.x, y: o.y, z: o.z, vx: v.x, vy: v.y, vz: v.z, from: 'navy', ship: s.id, team: null };
        G.Net.send(m);
        G.Ships.spawnBall(m, true);
        G.Ships.puff(o.x, o.y, o.z, 0xd0ccc4, 2.5, 1.2, 5);
      }, k * 180);
    }
  }
  // Crane dispara tus cañones cuando un barco de la Marina está de costado (si tienes pólvora y balas)
  function crewCannons(my, dt) {
    if (!G.Crew || G.Crew.aboardCount(my) === 0) return;
    const crane = G.Creatures.list.find((c) => c.type === 'npc' && c.extra === 3 && !c.dead);
    if (!crane || Math.hypot(crane.x - my.x, crane.z - my.z) > (my.def.L || 5)) return;
    const enemy = N.list.find((s) => !s.sinking && Math.hypot(s.x - my.x, s.z - my.z) < 60);
    if (!enemy || !my.mdl || !my.mdl.stations) return;
    const hasAmmo = () => (G.Inv.count('polvora') > 0 || my.crate.some((c) => c && c.id === 'polvora')) && (G.Inv.count('bala_canon') > 0 || my.crate.some((c) => c && c.id === 'bala_canon'));
    const rel = U.angDiff(my.yaw, Math.atan2(enemy.x - my.x, enemy.z - my.z));
    if (Math.abs(Math.abs(rel) - Math.PI / 2) > 0.6 || !hasAmmo()) return;
    const now = performance.now() / 1000;
    for (const st of my.mdl.stations) {
      if (st.kind !== 'cannon' || (my.reload[st.idx] || 0) > now) continue;
      if (st.x && Math.sign(st.x) !== Math.sign(rel)) continue; // solo los del costado donde está el enemigo
      G.Ships.fireCannon(my, st);
      G.Voice.say('crane', G.LINES.crane.fight, { ch: 'bark', at: crane });
      break;
    }
  }

  // ------------------------------------------------------------------ hundido o rendido
  function sunk(s) {
    const P = G.Player.pos, near = Math.hypot(s.x - P.x, s.z - P.z) < 180;
    if (near) { G.Bounty.add(G.Bounty.REWARD.navy_ship, G.Bounty.WHY.navy_ship); G.Ach.add('navySunk'); }
    if (G.Net.authority()) G.Landmarks.dropBarrel(s.x, s.z, [{ id: 'doblon', n: 8 + Math.floor(Math.random() * 10) }, { id: 'polvora', n: 4 }, { id: 'bala_canon', n: 6 }, { id: 'bala', n: 10 }].concat(Math.random() < 0.5 ? [{ id: 'mapa_tesoro', n: 1 }] : []));
  }
  function surrender(s) {
    const P = G.Player.pos;
    G.Voice.say('marino', G.LINES.marino.rinde, { ch: 'bark', at: s });
    s.navy = null;
    N.list.splice(N.list.indexOf(s), 1);
    s.name = 'Presa de la Marina';
    s.anchor = true; s.speed = 0;
    G.Net.send({ t: 'navyGone', id: s.id, keep: 1 });
    if (Math.hypot(s.x - P.x, s.z - P.z) < 200) {
      G.UI.banner('🏴‍☠️ ¡Barco capturado!', 'La tripulación de la Marina se rinde: el barco es tuyo');
      G.Bounty.add(8000, 'Capturaste un barco de la Marina Blanca');
      G.Audio.play('win');
      G.Ach.add('navyCaptured');
    }
  }
  N.remove = function (s) {
    const i = N.list.indexOf(s);
    if (i >= 0) N.list.splice(i, 1);
    for (const c of G.Creatures.list) if (c.deck && c.deck.ship === s.id) c.hp = 0;
    G.Ships.remove(s);
    G.Net.send({ t: 'navyGone', id: s.id });
  };

  // ------------------------------------------------------------------ red
  N.onNet = function (m) {
    if (m.t === 'navyNew' && !G.Ships.byId(m.d.id)) {
      const s = G.Ships.create({ id: m.d.id, type: m.d.type, x: m.d.x, z: m.d.z, yaw: m.d.yaw, anchor: false, sail: 'marea', flag: 'ancla', fh: 'aguila', name: m.d.name, flagColor: '#f4f4f0' });
      setup(s, m.d.type);
    } else if (m.t === 'navyPos') {
      for (const [id, type, x, z, yaw, hp, sp] of m.l) {
        let s = G.Ships.byId(id);
        if (!s) { s = G.Ships.create({ id, type, x, z, yaw, anchor: false, sail: 'marea', flag: 'ancla', fh: 'aguila', name: '*Marina Blanca', flagColor: '#f4f4f0' }); setup(s, type); }
        s.nx = x; s.nz = z; s.nyaw = yaw; s.hp = hp; s.speed = sp; s.lastNet = performance.now();
      }
    } else if (m.t === 'navyGone') {
      const s = G.Ships.byId(m.id);
      if (!s) return;
      const i = N.list.indexOf(s);
      if (i >= 0) N.list.splice(i, 1);
      if (m.keep) { s.navy = null; s.name = 'Presa de la Marina'; } else G.Ships.remove(s);
    }
  };

  // ------------------------------------------------------------------ fotograma
  let spawnT = 30, sendT = 0, lastWorld = null;
  N.update = function (dt) {
    if (G.state.world !== lastWorld) { lastWorld = G.state.world; N.list.length = 0; spawnT = 30; }
    if (!G.state.world) return;
    // Hundidos: botín y recompensa (en cada equipo, para su jugador)
    for (let i = N.list.length - 1; i >= 0; i--) {
      const s = N.list[i];
      if (s.sinking && !s.navy.dead) { s.navy.dead = true; sunk(s); N.list.splice(i, 1); }
    }
    const my = G.Player.ship;
    if (my && !my.navy && !my.sinking) crewCannons(my, dt);
    if (!G.Net.authority()) return;
    // Rendición: todos los marines de su cubierta han caído
    for (const s of N.list.slice()) {
      if (s.sinking) continue;
      const alive = G.Creatures.list.some((c) => c.deck && c.deck.ship === s.id && !c.dead);
      if (!alive && (s.navy.bornT = (s.navy.bornT || 0) + dt) > 3) surrender(s);
    }
    // Patrullas: mientras navegas en mar abierto, tras el prólogo
    if ((spawnT -= dt) <= 0) {
      spawnT = 12;
      const f = flags(), P = G.Player, max = G.Bounty.value() > 60000 ? 2 : 1;
      const sailing = preys().filter((p) => p.ship && !p.ship.navy && G.SeaWx.atSea(p.x, p.z));
      if (sailing.length && N.list.length < max && (f.treasure || !G.Prologue.active()) && G.state.day >= 2 && Math.random() < 0.1 + Math.min(0.15, G.Bounty.value() / 400000)) spawn(sailing[Math.floor(Math.random() * sailing.length)]);
      void P;
    }
    // Posición a los demás jugadores
    if (G.Net.active && N.list.length && (sendT -= dt) <= 0) {
      sendT = 0.2;
      G.Net.send({ t: 'navyPos', l: N.list.map((s) => [s.id, s.type, +s.x.toFixed(2), +s.z.toFixed(2), +s.yaw.toFixed(3), Math.round(s.hp), +s.speed.toFixed(2)]) });
    }
  };
  // Pista para el caracolófono
  N.nearestHint = function (x, z) {
    const s = N.list.find((q) => !q.sinking && Math.hypot(q.x - x, q.z - z) < 400);
    return s ? `Un pescador ha visto un barco de la Marina Blanca al <b>${G.Pets.dirName(s.x - x, s.z - z)}</b>, a unos ${Math.round(Math.hypot(s.x - x, s.z - z) / 10) * 10} m. ¡Cuidado!` : null;
  };
  // Para pruebas desde la consola: hace aparecer un barco de la Marina junto a ti
  N.debugSpawn = () => spawn({ x: G.Player.pos.x, z: G.Player.pos.z });
})();
