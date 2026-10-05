// Batallas navales contra la Marina Blanca:
//  - Sus barcos patrullan el mar abierto (tras el prólogo) y persiguen al que navega; más cuanto más alta es tu recompensa.
//  - Se colocan de costado y disparan andanadas. Tu tripulación (Crane) dispara tus cañones si tienes munición.
//  - En cubierta llevan marines: los tiradores disparan desde allí; si abordas su barco (E en el casco),
//    pelea con ellos: si caen todos, el barco se rinde y es tuyo.
//  - Hundido deja una carga de botín flotando y sube tu recompensa.
//  - El Holandés de las Mareas: barco fantasma que surge de la niebla de noche en alta mar. Cada pocos segundos
//    se vuelve niebla (las balas lo atraviesan); si acabas con su tripulación, la maldición se rompe y se hunde.
//    Al amanecer se desvanece.
//  - Barcos piratas de las hermandades de cada zona (faction.js): atacan a los marines y a los piratas de
//    hermandades enemigas; con los aliados navegan cerca sin atacar. La Marina y los piratas se cañonean entre sí.
//    Atacar a un barco aliado lo vuelve enemigo tuyo.
// El anfitrión (o la partida individual) mueve los barcos y sus cañones; los demás reciben su posición.
(function () {
  'use strict';
  const G = window.G, U = G.U, V3 = THREE.Vector3;
  const N = (G.Navy = { list: [] });
  const TYPES = { velero: { crew: 3, speed: 8.5, turn: 0.45, guns: 2 }, barco: { crew: 5, speed: 7.5, turn: 0.32, guns: 3 },
    holandes: { crew: 5, speed: 9.2, turn: 0.4, guns: 4, ship: 'barco', ghost: true },
    pirata: { crew: 3, speed: 8.8, turn: 0.5, guns: 2, ship: 'velero', pirate: true }, pirata_g: { crew: 5, speed: 7.8, turn: 0.34, guns: 3, ship: 'barco', pirate: true } };
  // Aspecto de cada bando
  const LOOK = { navy: { sail: 0xf6f6f2, flag: 'marina', fh: 'aguila', flagColor: '#f4f4f0' }, ghost: { sail: 0x5f6e66, flag: 'fantasma', fh: 'calavera', flagColor: '#7dffb0' } };
  const lookOf = (kind, crew) => {
    const T = TYPES[kind];
    if (T && T.pirate) { const C = G.Faction.crew(crew); return { sail: C.sail, flag: C.flag, fh: 'calavera', flagColor: C.flagColor }; }
    return LOOK[T && T.ghost ? 'ghost' : 'navy'];
  };
  const shipOf = (kind) => (TYPES[kind] && TYPES[kind].ship) || kind;
  const NAMES = ['Integridad', 'Vigilancia', 'Orden Eterno', 'Mano Justa', 'Faro Blanco', 'Centinela'];
  const PNAMES = ['Colmillo Negro', 'Viuda Roja', 'Tiburón Loco', 'Sirena Negra', 'Perla Maldita', 'Garra del Mar', 'Buitre Salado', 'Diente de Sable'];
  const ME = () => ({ local: true, id: G.Net.myId });
  const shortName = (s) => s.name.replace(/ \(.*\)$/, '');
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
  function spawn(near, kind, crew) {
    kind = kind || (G.Bounty.value() > 40000 || Math.random() < 0.35 ? 'barco' : 'velero');
    const T = TYPES[kind], ghost = !!T.ghost, R = ghost ? 110 : 170;
    const a = Math.random() * Math.PI * 2;
    let x = near.x + Math.cos(a) * R, z = near.z + Math.sin(a) * R;
    for (let k = 0; k < 12 && !deep(x, z); k++) { const b = a + k * 0.5; x = near.x + Math.cos(b) * R; z = near.z + Math.sin(b) * R; }
    if (!deep(x, z)) return null;
    if (T.pirate) crew = crew || G.Faction.zoneAt(x, z).key;
    const name = ghost ? 'Holandés de las Mareas' : T.pirate ? `${PNAMES[Math.floor(Math.random() * PNAMES.length)]} (${G.Faction.crew(crew).name})` : NAMES[Math.floor(Math.random() * NAMES.length)] + ' (Marina Blanca)';
    const s = G.Ships.create(Object.assign({ type: shipOf(kind), x, z, yaw: Math.atan2(near.x - x, near.z - z), anchor: false, name }, lookOf(kind, crew)));
    setup(s, kind, crew);
    // Tripulación en cubierta: marines, piratas de la hermandad o piratas fantasma, con su capitán
    const boss = ghost || ((kind === 'barco' || kind === 'pirata_g') && Math.random() < 0.5);
    for (let k = 0; k < T.crew; k++) {
      const lead = boss && k === 0;
      const type = ghost ? (k === 0 ? 'ghost_captain' : k % 2 ? 'ghost_gun' : 'ghost_pirate') : T.pirate ? (lead ? 'corsair_captain' : k % 2 ? 'corsair_gun' : 'corsair') : lead ? 'marine_boss' : k % 2 ? 'marine_gun' : 'marine';
      const extra = (T.pirate ? G.Faction.crewIdx(crew) * 1000 : 0) + Math.floor(Math.random() * 1000);
      const c = G.Creatures.spawn(type, x, z, undefined, extra);
      c.deck = { ship: s.id, slot: k };
    }
    G.Net.send({ t: 'navyNew', d: { id: s.id, kind, type: shipOf(kind), x, z, yaw: s.yaw, name, crew } });
    if (ghost) { G.SeaWx.fogOn(160); announceGhost(); }
    else announce(s);
    return s;
  }
  // Aviso de velas a la vista: enemigas o aliadas según tu bando
  function announce(s) {
    const P = G.Player, nv = s.navy;
    if (!P.ship && !G.SeaWx.atSea(P.pos.x, P.pos.z)) return;
    const foe = G.Faction.shipHostile(s, ME()), n = shortName(s);
    if (nv.pirate) {
      const C = G.Faction.crew(nv.crew);
      if (foe) G.UI.msg(`☠️ ¡Velas negras! El «${n}», de ${C.the}, viene a por ti.`, 'bad', 'navy');
      else G.UI.msg(`🏴‍☠️ Velas de ${C.the} a la vista: el «${n}» es aliado y pelea contra la Marina.`, 'good', 'navy');
    } else if (foe) G.UI.msg(`⚓ ¡Velas blancas en el horizonte! Un barco de la Marina Blanca, el «${n}», viene a por ti.`, 'bad', 'navy');
    else G.UI.msg(`⚓ El «${n}» de la Marina Blanca patrulla cerca: son tus aliados y pelean contra los piratas.`, 'good', 'navy');
  }
  // Atacar a un barco aliado lo vuelve enemigo (lo llama ships.js en el anfitrión)
  N.provoked = function (s, by) {
    const nv = s && s.navy;
    if (!nv || nv.ghost || by === undefined || by === null || by === 'navy') return;
    const t = { id: by, local: by === G.Net.myId };
    if (G.Faction.shipHostile(s, t)) return;
    nv.angry[by] = 1;
    if (t.local) G.UI.msg(nv.pirate ? `☠️ ¡Has atacado a ${G.Faction.crew(nv.crew).the}! Ese barco ya es tu enemigo.` : '⚓ ¡Has atacado a la Marina Blanca! Ese barco ya es tu enemigo.', 'bad', 'provoke');
  };
  function announceGhost() {
    if (!G.Player.ship && !G.SeaWx.atSea(G.Player.pos.x, G.Player.pos.z)) return;
    G.UI.banner('👻 El Holandés de las Mareas', 'Una campana suena entre la niebla… y un barco que no debería existir surge del mar');
    G.Audio.play('bell');
    setTimeout(() => G.Audio.play('bell'), 1400);
  }
  function setup(s, kind, crew) {
    const T = TYPES[kind] || TYPES.velero;
    s.navy = { kind, T, ghost: !!T.ghost, pirate: !!T.pirate, crew: crew || null, angry: {}, cd: { 1: 3, [-1]: 3 }, target: null, lostT: 0, faded: false, phT: 8, fade: 1 };
    s.hp = s.def.hp * (T.ghost ? 1 : 0.85);
    if (T.ghost) ghostShip(s);
    s.nx = s.x; s.nz = s.z; s.nyaw = s.yaw; s.lastNet = performance.now();
    N.list.push(s);
  }

  // ------------------------------------------------------------------ el Holandés: casco translúcido y farolillos verdes
  let glowTex = null;
  function ghostShip(s) {
    const tint = new THREE.Color(0x86b8a4), nv = s.navy;
    nv.mats = [];
    s.root.traverse((m) => {
      if (!m.isMesh) return;
      const mat = m.material.clone();
      mat.transparent = true; mat.opacity = 0.8;
      if (mat.color) mat.color.lerp(tint, 0.6);
      if (mat.emissive) { mat.emissive.setHex(0x1c5a42); mat.emissiveIntensity = 0.55; }
      m.material = mat; m.userData.realMat = mat;
      nv.mats.push(mat);
    });
    if (!glowTex) glowTex = U.canvasTex(64, 64, (c) => {
      const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(210,255,230,1)'); g.addColorStop(0.3, 'rgba(120,255,180,0.55)'); g.addColorStop(1, 'rgba(60,255,150,0)');
      c.fillStyle = g; c.fillRect(0, 0, 64, 64);
    });
    const d = s.def, L = d.L || 8;
    nv.lamps = [];
    for (const [x, y, z] of [[0, d.deckY + 1.6, L * 0.46], [0.9, d.deckY + 2.2, -L * 0.44], [-0.9, d.deckY + 2.2, -L * 0.44], [0, d.deckY + 5.5, 0]]) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x9dffc8, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      sp.position.set(x, y, z); sp.scale.setScalar(1.8); sp.raycast = () => {};
      s.root.add(sp); nv.lamps.push(sp);
    }
  }
  // Se vuelve niebla y vuelve a ser sólido (lo decide el anfitrión; los demás lo reciben en navyPos)
  function ghostFx(s, dt) {
    const nv = s.navy, want = nv.leaving ? 0 : nv.faded ? 0.16 : 1;
    nv.fade += (want - nv.fade) * Math.min(1, dt * (nv.leaving ? 0.5 : 2.5));
    const flick = 0.92 + Math.sin(performance.now() / 180) * 0.08;
    for (const m of nv.mats) m.opacity = 0.8 * nv.fade;
    for (const sp of nv.lamps) { sp.material.opacity = Math.max(0.15, nv.fade) * flick; }
    for (const c of G.Creatures.list) if (c.deck && c.deck.ship === s.id && c.ghostMats) for (const m of c.ghostMats) m.opacity = 0.62 * Math.max(0.25, nv.fade);
  }
  N.isGhostly = (s) => !!(s && s.navy && s.navy.ghost && (s.navy.faded || s.navy.leaving));

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
    // Presa más cercana: jugadores enemigos de este barco y barcos del otro bando (la Marina contra los piratas)
    let prey = null, pd = 1e9, near = null, nd = 1e9;
    for (const p of preys()) {
      const d = Math.hypot(p.x - s.x, p.z - s.z);
      if (d < nd) { nd = d; near = p; }
      if (d < pd && G.Faction.shipHostile(s, p)) { pd = d; prey = p; }
    }
    for (const o of N.list) {
      if (o === s || o.sinking || !G.Faction.shipsEnemies(s, o)) continue;
      const d = Math.hypot(o.x - s.x, o.z - s.z);
      if (d < 220 && d < pd) { pd = d; prey = { id: 'ship:' + o.id, x: o.x, z: o.z, ship: o }; }
    }
    let want = s.yaw, speed = T.speed;
    if (!near || nd > 450) { nv.lostT += dt; if (nv.lostT > 20) { N.remove(s); return; } }
    else nv.lostT = 0;
    nv.life = (nv.life || 0) + dt;
    if (!prey && nv.life > 200 && nd > 160) { N.remove(s); return; }
    if (!prey && near && nd < 450) {
      // Aliado: navega cerca de ti (a unos 100 m) sin atacarte
      const toP = Math.atan2(near.x - s.x, near.z - s.z);
      nv.side = nv.side || 1;
      want = nd > 120 ? toP : toP - nv.side * Math.PI / 2;
      speed = T.speed * (nd > 120 ? 0.8 : 0.55);
    } else if (prey && pd <= 450) {
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
    // Cañones de la andanada en curso
    if (nv.salvo) for (let i = nv.salvo.length - 1; i >= 0; i--) if ((nv.salvo[i].t -= dt) <= 0) { const g = nv.salvo[i]; nv.salvo.splice(i, 1); fireGun(s, g); }
    // Andanadas: cuando la presa está de costado y a tiro
    if (prey && pd < 75 && !nv.faded && !nv.leaving) {
      const rel = U.angDiff(s.yaw, Math.atan2(prey.x - s.x, prey.z - s.z)), side = rel > 0 ? 1 : -1;
      nv.cd[1] -= dt; nv.cd[-1] -= dt;
      if (Math.abs(Math.abs(rel) - Math.PI / 2) < 0.55 && nv.cd[side] <= 0) { nv.cd[side] = 7 + Math.random() * 3; broadside(s, side, prey, pd); }
    }
  };
  // Andanada: un cañón tras otro, con el reloj del juego (la pausa también las detiene)
  function broadside(s, side, prey, dist) {
    const nv = s.navy;
    nv.salvo = nv.salvo || [];
    for (let k = 0; k < nv.T.guns; k++) nv.salvo.push({ t: k * 0.18, k, side, prey, dist });
  }
  function fireGun(s, g) {
    const T = s.navy.T, L = s.def.L || 8, rx = Math.cos(s.yaw) * g.side, rz = -Math.sin(s.yaw) * g.side, prey = g.prey;
    const tgt = prey.ship || prey, vx = prey.ship ? Math.sin(prey.ship.yaw) * prey.ship.speed : 0, vz = prey.ship ? Math.cos(prey.ship.yaw) * prey.ship.speed : 0;
    const along = (g.k - (T.guns - 1) / 2) * L * 0.22;
    const o = new V3(s.x + rx * 1.6 + Math.sin(s.yaw) * along, s.def.deckY + G.World.waveHeight(s.x, s.z) + 1.1, s.z + rz * 1.6 + Math.cos(s.yaw) * along);
    const dist = Math.hypot(tgt.x - o.x, tgt.z - o.z) || g.dist, tf = dist / 55, spread = 2 + dist * 0.05;
    const px = tgt.x + vx * tf + (Math.random() - 0.5) * spread * 2, pz = tgt.z + vz * tf + (Math.random() - 0.5) * spread * 2, py = 1.2;
    const v = new V3((px - o.x) / tf, (py - o.y) / tf + 0.5 * 9.8 * tf, (pz - o.z) / tf);
    const m = { t: 'cannon', x: o.x, y: o.y, z: o.z, vx: v.x, vy: v.y, vz: v.z, from: 'navy', ship: s.id, team: null, ghost: s.navy.ghost ? 1 : 0 };
    G.Net.send(m);
    G.Ships.spawnBall(m, true);
    G.Ships.puff(o.x, o.y, o.z, 0xd0ccc4, 2.5, 1.2, 5);
  }
  // Crane dispara tus cañones cuando un barco de la Marina está de costado (si tienes pólvora y balas)
  function crewCannons(my, dt) {
    if (!G.Crew || G.Crew.aboardCount(my) === 0) return;
    const crane = G.Creatures.list.find((c) => c.type === 'npc' && c.extra === 3 && !c.dead);
    if (!crane || Math.hypot(crane.x - my.x, crane.z - my.z) > (my.def.L || 5)) return;
    const enemy = N.list.find((s) => !s.sinking && Math.hypot(s.x - my.x, s.z - my.z) < 60 && G.Faction.shipHostile(s, ME()));
    if (!enemy || !my.mdl || !my.mdl.stations) return;
    const hasAmmo = () => (G.Inv.count('polvora') > 0 || my.crate.some((c) => c && c.id === 'polvora')) && (G.Inv.count('bala_canon') > 0 || my.crate.some((c) => c && c.id === 'bala_canon'));
    const rel = U.angDiff(my.yaw, Math.atan2(enemy.x - my.x, enemy.z - my.z));
    if (Math.abs(Math.abs(rel) - Math.PI / 2) > 0.6 || !hasAmmo()) return;
    const now = performance.now() / 1000;
    for (const st of my.mdl.stations) {
      if (st.kind !== 'cannon' || (my.reload[st.idx] || 0) > now) continue;
      if (st.x && Math.sign(st.x) !== Math.sign(rel)) continue; // solo los del costado donde está el enemigo
      // Apunta: giro hacia el enemigo y elevación según la distancia (tiro parabólico a 62 m/s)
      const d = Math.hypot(enemy.x - my.x, enemy.z - my.z), yawTo = Math.atan2(enemy.x - my.x, enemy.z - my.z);
      const aimY = U.clamp(U.angDiff(my.yaw + (st.yaw || 0), yawTo), -0.6, 0.6) + (Math.random() - 0.5) * 0.06;
      const aimP = U.clamp(0.5 * Math.asin(Math.min(1, 9.8 * d / (62 * 62))) + (Math.random() - 0.5) * 0.03, -0.08, 0.45);
      G.Ships.fireCannon(my, st, { aimY, aimP });
      G.Voice.say('crane', G.LINES.crane.fight, { ch: 'bark', at: crane });
      break;
    }
  }

  // ------------------------------------------------------------------ hundido o rendido
  function sunk(s) {
    const P = G.Player.pos, near = Math.hypot(s.x - P.x, s.z - P.z) < 180;
    if (s.navy.ghost) {
      if (s.navy.leaving) return; // se desvaneció al amanecer: sin botín
      if (near) { G.UI.banner('⚓ ¡Hundiste el Holandés de las Mareas!', 'Su maldición se va con él al fondo del mar… y deja su tesoro flotando'); G.Bounty.add(G.Bounty.REWARD.ghost_ship, G.Bounty.WHY.ghost_ship); G.Ach.add('ghostSunk'); G.Audio.play('win'); }
      if (G.Net.authority()) G.Landmarks.dropBarrel(s.x, s.z, [{ id: 'doblon', n: 45 + Math.floor(Math.random() * 30) }, { id: 'perla', n: 4 }, { id: 'mapa_tesoro', n: 2 }, { id: 'polvora', n: 6 }, { id: 'bala_canon', n: 8 }]);
      return;
    }
    const foe = G.Faction.shipHostile(s, ME());
    if (s.navy.pirate) {
      const C = G.Faction.crew(s.navy.crew);
      if (near && foe) G.Bounty.add(G.Faction.isMarine() ? G.Bounty.REWARD.pirate_ship : 4000, `Hundiste un barco de ${C.the}`);
      else if (near) G.UI.msg(`🏴‍☠️ Un barco aliado de ${C.the} se ha hundido…`, 'warn', 'navy');
    } else if (near && foe) { G.Bounty.add(G.Bounty.REWARD.navy_ship, G.Bounty.WHY.navy_ship); G.Ach.add('navySunk'); }
    else if (near) G.UI.msg('⚓ Un barco aliado de la Marina Blanca se ha hundido…', 'warn', 'navy');
    if (G.Net.authority()) G.Landmarks.dropBarrel(s.x, s.z, [{ id: 'doblon', n: 8 + Math.floor(Math.random() * 10) }, { id: 'polvora', n: 4 }, { id: 'bala_canon', n: 6 }, { id: 'bala', n: 10 }].concat(Math.random() < 0.5 ? [{ id: 'mapa_tesoro', n: 1 }] : []));
  }
  function surrender(s) {
    const P = G.Player.pos, pirate = s.navy.pirate, C = pirate ? G.Faction.crew(s.navy.crew) : null, foe = G.Faction.shipHostile(s, ME());
    if (!pirate) G.Voice.say('marino', G.LINES.marino.rinde, { ch: 'bark', at: s });
    s.navy = null;
    N.list.splice(N.list.indexOf(s), 1);
    s.name = pirate ? 'Presa pirata' : 'Presa de la Marina';
    s.anchor = true; s.speed = 0;
    G.Net.send({ t: 'navyGone', id: s.id, keep: 1, nm: s.name });
    if (Math.hypot(s.x - P.x, s.z - P.z) >= 200) return;
    if (!foe) G.UI.msg(`${pirate ? '🏴‍☠️ El barco aliado de ' + C.the : '⚓ El barco de la Marina Blanca'} se ha quedado sin tripulación y va a la deriva.`, 'warn', 'navy');
    else if (pirate) {
      G.UI.banner('⚓ ¡Barco pirata apresado!', `La tripulación de ${C.the} se rinde: el barco es tuyo`);
      G.Bounty.add(G.Faction.isMarine() ? 8000 : 5000, 'Apresaste un barco pirata');
      G.Audio.play('win');
    } else {
      G.UI.banner('🏴‍☠️ ¡Barco capturado!', 'La tripulación de la Marina se rinde: el barco es tuyo');
      G.Bounty.add(8000, 'Capturaste un barco de la Marina Blanca');
      G.Audio.play('win');
      G.Ach.add('navyCaptured');
    }
  }
  function breakCurse(s) {
    const P = G.Player.pos;
    s.navy.faded = false;
    if (Math.hypot(s.x - P.x, s.z - P.z) < 200) G.UI.msg('💀 ¡La tripulación fantasma ha caído! La maldición se rompe y el Holandés empieza a hundirse…', 'good', 'ghost');
    G.Ships.hurt(s, s.hp + 50, '¡La maldición se rompe!', G.Net.myId);
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
      const kind = m.d.kind || m.d.type;
      const s = G.Ships.create(Object.assign({ id: m.d.id, type: shipOf(kind), x: m.d.x, z: m.d.z, yaw: m.d.yaw, anchor: false, name: m.d.name }, lookOf(kind, m.d.crew)));
      setup(s, kind, m.d.crew);
      if (s.navy.ghost) announceGhost(); else announce(s);
    } else if (m.t === 'navyPos') {
      for (const [id, kind, x, z, yaw, hp, sp, ph, ci] of m.l) {
        let s = G.Ships.byId(id);
        const crew = ci >= 0 && G.Faction.CREWS[ci] ? G.Faction.CREWS[ci].key : null, T = TYPES[kind] || {};
        if (!s) { s = G.Ships.create(Object.assign({ id, type: shipOf(kind), x, z, yaw, anchor: false, name: T.ghost ? 'Holandés de las Mareas' : T.pirate ? 'Barco pirata (' + G.Faction.crew(crew).name + ')' : 'Marina Blanca' }, lookOf(kind, crew))); setup(s, kind, crew); }
        s.nx = x; s.nz = z; s.nyaw = yaw; s.hp = hp; s.speed = sp; s.lastNet = performance.now();
        if (s.navy) { s.navy.faded = ph === 1; s.navy.leaving = ph === 2; }
      }
    } else if (m.t === 'navyGone') {
      const s = G.Ships.byId(m.id);
      if (!s) return;
      const i = N.list.indexOf(s);
      if (i >= 0) N.list.splice(i, 1);
      if (m.keep) { s.navy = null; s.name = m.nm || 'Presa de la Marina'; } else G.Ships.remove(s);
    }
  };

  // ------------------------------------------------------------------ fotograma
  let spawnT = 30, sendT = 0, ghostT = 20, lastWorld = null, fadeTold = false;
  N.update = function (dt) {
    if (G.state.world !== lastWorld) { lastWorld = G.state.world; N.list.length = 0; spawnT = 30; ghostT = 20; }
    if (!G.state.world) return;
    for (const s of N.list) if (s.navy.ghost) ghostFx(s, dt);
    for (const s of N.list) {
      const nv = s.navy;
      if (nv.greeted || nv.ghost || s.sinking || Math.hypot(s.x - G.Player.pos.x, s.z - G.Player.pos.z) > 110 || G.Faction.shipHostile(s, ME())) continue;
      nv.greeted = true;
      G.Audio.play('bell');
      G.UI.msg(nv.pirate ? `🏴‍☠️ El «${shortName(s)}» de ${G.Faction.crew(nv.crew).the} te saluda: «¡Buen viento, hermano! ¡Muerte a la Marina!»`
        : `⚓ El «${shortName(s)}» te saluda con la bandera: «¡Buen viento, ${G.Bounty.title().toLowerCase()}!»`, 'good', 'greet');
    }
    // Hundidos: botín y recompensa (en cada equipo, para su jugador)
    for (let i = N.list.length - 1; i >= 0; i--) {
      const s = N.list[i];
      if (s.sinking && !s.navy.dead) { s.navy.dead = true; sunk(s); N.list.splice(i, 1); }
    }
    const my = G.Player.ship;
    if (my && !my.navy && !my.sinking) crewCannons(my, dt);
    if (!G.Net.authority()) return;
    // Rendición: todos los marines de su cubierta han caído (en el Holandés, se rompe la maldición)
    for (const s of N.list.slice()) {
      if (s.sinking) continue;
      const alive = G.Creatures.list.some((c) => c.deck && c.deck.ship === s.id && !c.dead);
      if (!alive && (s.navy.bornT = (s.navy.bornT || 0) + dt) > 3) { if (s.navy.ghost) breakCurse(s); else surrender(s); }
    }
    // El Holandés: se vuelve niebla a ratos y se desvanece al amanecer
    const hour = G.Game.hour(), night = hour >= 20.5 || hour < 5;
    for (const s of N.list.slice()) {
      const nv = s.navy;
      if (!nv.ghost || s.sinking) continue;
      if (nv.leaving) { if (nv.fade < 0.03) N.remove(s); continue; }
      if (!night) {
        nv.leaving = true; nv.faded = false;
        if (Math.hypot(s.x - G.Player.pos.x, s.z - G.Player.pos.z) < 300) G.UI.msg('☀️ Con el primer rayo de sol, el Holandés de las Mareas se deshace en la niebla…', 'info', 'ghost');
        continue;
      }
      if ((nv.phT -= dt) <= 0) {
        nv.faded = !nv.faded;
        nv.phT = nv.faded ? 3.2 : 7 + Math.random() * 4;
        if (nv.faded && !fadeTold && Math.hypot(s.x - G.Player.pos.x, s.z - G.Player.pos.z) < 150) { fadeTold = true; G.UI.msg('👻 ¡El Holandés se vuelve niebla! Tus balas lo atraviesan: dispara cuando vuelva a verse sólido… o abórdalo y acaba con su tripulación.', 'warn', 'ghostfade'); }
      }
    }
    // Patrullas: mientras navegas en mar abierto, tras el prólogo
    if ((spawnT -= dt) <= 0) {
      spawnT = 12;
      const f = flags(), fame = G.Bounty.value(), max = fame > 60000 ? 2 : 1;
      const sailing = preys().filter((p) => p.ship && !p.ship.navy && G.SeaWx.atSea(p.x, p.z));
      if (sailing.length && (f.treasure || !G.Prologue.active()) && G.state.day >= 2) {
        const who = sailing[Math.floor(Math.random() * sailing.length)], marine = G.Faction.sideOf(who) === 'marina';
        const navyN = N.list.filter((s) => !s.navy.ghost && !s.navy.pirate).length, pirN = N.list.filter((s) => s.navy.pirate).length;
        // A un marine lo buscan los piratas (y la Marina patrulla menos); a un pirata, la Marina y las hermandades
        const pNavy = marine ? 0.05 : 0.1 + Math.min(0.15, fame / 400000), pPir = !G.Faction.active() ? 0 : marine ? 0.1 + Math.min(0.14, fame / 400000) : 0.08;
        if (navyN < max && Math.random() < pNavy) spawn(who);
        else if (pirN < max && Math.random() < pPir) spawn(who, fame > 40000 || Math.random() < 0.35 ? 'pirata_g' : 'pirata');
      }
    }
    // El Holandés de las Mareas: de noche, navegando en alta mar, como mucho una vez por noche (más fácil con niebla)
    if ((ghostT -= dt) <= 0) {
      ghostT = 15;
      const f = flags(), w = G.state.world, nightId = hour >= 20.5 ? G.state.day : G.state.day - 1;
      const sailing = preys().filter((p) => p.ship && !p.ship.navy && G.SeaWx.atSea(p.x, p.z));
      if (night && sailing.length && !N.list.some((s) => s.navy.ghost) && G.state.day >= 3 && (f.treasure || !G.Prologue.active()) && w.ghostNight !== nightId
        && Math.random() < (G.SeaWx.fog > 0.3 ? 0.22 : 0.05)) {
        if (spawn(sailing[Math.floor(Math.random() * sailing.length)], 'holandes')) w.ghostNight = nightId;
      }
    }
    // Posición a los demás jugadores
    if (G.Net.active && N.list.length && (sendT -= dt) <= 0) {
      sendT = 0.2;
      G.Net.send({ t: 'navyPos', l: N.list.map((s) => [s.id, s.navy.kind, +s.x.toFixed(2), +s.z.toFixed(2), +s.yaw.toFixed(3), Math.round(s.hp), +s.speed.toFixed(2), s.navy.leaving ? 2 : s.navy.faded ? 1 : 0, s.navy.crew ? G.Faction.crewIdx(s.navy.crew) : -1]) });
    }
  };
  // Pista para el caracolófono
  N.nearestHint = function (x, z) {
    const g = N.list.find((q) => !q.sinking && q.navy.ghost && Math.hypot(q.x - x, q.z - z) < 500);
    if (g) return `Dicen que esta noche suena una campana en el mar, al <b>${G.Pets.dirName(g.x - x, g.z - z)}</b>… Es el <b>Holandés de las Mareas</b>. Si lo ves volverse niebla, no gastes balas.`;
    const s = N.list.find((q) => !q.sinking && !q.navy.ghost && Math.hypot(q.x - x, q.z - z) < 400);
    if (!s) return null;
    const who = s.navy.pirate ? `un barco de ${G.Faction.crew(s.navy.crew).the}` : 'un barco de la Marina Blanca', ally = !G.Faction.shipHostile(s, ME());
    return `Un pescador ha visto ${who} al <b>${G.Pets.dirName(s.x - x, s.z - z)}</b>, a unos ${Math.round(Math.hypot(s.x - x, s.z - z) / 10) * 10} m. ${ally ? 'Son de los tuyos.' : '¡Cuidado!'}`;
  };
  // Para pruebas desde la consola: hace aparecer un barco de la Marina junto a ti
  N.debugSpawn = () => spawn({ x: G.Player.pos.x, z: G.Player.pos.z });
  N.debugGhost = () => spawn({ x: G.Player.pos.x, z: G.Player.pos.z }, 'holandes');
  N.debugPirate = (big, crew) => spawn({ x: G.Player.pos.x, z: G.Player.pos.z }, big ? 'pirata_g' : 'pirata', crew);
})();
