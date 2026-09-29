// Parry: combate cuerpo a cuerpo con guardia, paradas perfectas y contraataques.
//  Jugador:
//   - Clic derecho mantenido (con un arma de cuerpo a cuerpo o sin nada en la mano): guardia. Reduce el daño
//     de los golpes que vienen de delante, pero gasta energía; sin energía (o ante un golpe fuerte) se rompe.
//   - Parada perfecta: pulsar justo antes del golpe. No recibes daño, el enemigo queda aturdido y tu siguiente
//     golpe a ese enemigo es un contraataque (doble de daño, y no lo puede parar).
//   - Con el estilo Espadachín a nivel 3, una parada perfecta desvía también las balas.
//  NPC (piratas, marines, fantasmas, capitanes y guerreros shandara):
//   - Avisan antes de golpear: levantan el arma y brilla (amarillo: se puede parar; rojo: golpe fuerte, que
//     rompe la guardia: apártate).
//   - Se cubren y paran tus golpes (más cuanto más repites el mismo ritmo). Si te paran, quedas aturdido
//     un momento y te contraatacan enseguida (ese golpe también se puede parar).
// El anfitrión decide lo de los NPC; cada jugador decide sus propias paradas.
(function () {
  'use strict';
  const G = window.G, U = G.U, V3 = THREE.Vector3;
  const Pa = (G.Parry = { guard: false, gT: 9, stagger: 0, riposte: 0, ripId: null, guardK: 0, staggerK: 0, fx: [] });

  // Ventana de la parada perfecta según la dificultad (fácil, normal, difícil)
  const win = () => [0.34, 0.26, 0.2][G.state.diff] ?? 0.26;
  // Habilidad de cada NPC para defenderse (probabilidad base de cubrirse de un golpe)
  const SKILL = { pirate: 0.16, pirate_gun: 0.07, pirate_boss: 0.34, marine: 0.24, marine_gun: 0.1, marine_boss: 0.42, ghost_pirate: 0.2, ghost_gun: 0.08, ghost_captain: 0.4,
    corsair: 0.18, corsair_gun: 0.08, corsair_captain: 0.36, villager: 0.18 };
  const LEADER = /_boss$|_captain$/;
  Pa.fights = (c) => !!(c && c.d && (c.d.human || c.type === 'villager'));

  // ------------------------------------------------------------------ jugador: guardia
  // ¿Lo que llevas en la mano sirve para cubrirte? (sin nada, armas y herramientas; no comida, planos, armas de fuego…)
  Pa.canGuard = function () {
    const P = G.Player;
    if (P.dead || P.swimming || P.ship || P.station || G.state.mode !== 'playing') return false;
    const id = G.Inv.heldId(), it = id && G.ITEMS[id];
    if (!it) return true;
    return !(it.use || it.eq || it.fruit || it.read || it.place || it.ship || it.plano || it.spyglass || it.gun || it.fishing || it.blowgun || it.rep || id === 'antorcha');
  };
  Pa.down = function () {
    if (Pa.stagger > 0 || !Pa.canGuard()) return false;
    if (G.Player.stats.stamina < 5) { G.UI.msg('😮‍💨 Sin energía para cubrirte.', 'warn', 'guard'); return true; }
    Pa.guard = true; Pa.gT = 0;
    return true;
  };
  Pa.up = function () { Pa.guard = false; };
  const facing = (x, z) => {
    const P = G.Player, fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), dx = x - P.pos.x, dz = z - P.pos.z, d = Math.hypot(dx, dz) || 1;
    return (fx * dx + fz * dz) / d > 0.3; // el golpe viene de delante (±72°)
  };
  // Golpe que te llega (player.js lo llama antes de restar la vida). Devuelve el daño que queda.
  // info: { melee, cid (criatura), by (jugador), heavy, beast, shot }
  Pa.onHit = function (amt, src, info) {
    const P = G.Player;
    if (!info || !Pa.guard || !src || P.dead || !facing(src.x, src.z)) return amt;
    const perfect = Pa.gT <= win();
    if (info.shot) {
      if (perfect && G.Styles.active() === 'sword' && G.Styles.level('sword') >= 3) { spark(handPos(), 0xfff2c0, 0.9); G.Audio.play('parry'); G.UI.msg('⚔️ ¡Bala desviada!', 'good', 'parry'); return 0; }
      return amt;
    }
    if (!info.melee) return amt;
    if (perfect && !info.heavy) {
      // Parada perfecta
      Pa.guard = false;
      Pa.riposte = 1.4; Pa.ripId = info.cid ?? (info.by !== undefined ? 'p' + info.by : null);
      P.stats.stamina = Math.min(100, P.stats.stamina + 8);
      P.shake = Math.max(P.shake, 0.12);
      spark(handPos(), 0xfff2c0, 1.1); flashScreen();
      G.Audio.play('parry');
      G.UI.msg(info.beast ? '🛡️ ¡Parada perfecta!' : '⚔️ ¡Parada perfecta! Contraataca ahora', 'good', 'parry');
      if (info.cid !== undefined && info.cid !== null) stun(info.cid, info.beast ? 0.8 : 1.3);
      if (info.by !== undefined && info.by !== null) G.Net.send({ t: 'parried', to: info.by });
      Pa.count = (Pa.count || 0) + 1;
      return 0;
    }
    // Bloqueo: menos daño a cambio de energía; un golpe fuerte (o quedarte sin energía) rompe la guardia
    const sword = G.Styles.active() === 'sword';
    const left = amt * (info.heavy ? 0.6 : info.beast ? 0.5 : sword ? 0.25 : 0.4);
    P.stats.stamina = Math.max(0, P.stats.stamina - amt * (info.heavy ? 3 : 1.4));
    spark(handPos(), 0xffd8a0, 0.6);
    G.Audio.play('block');
    if (info.heavy || P.stats.stamina <= 0) {
      Pa.guard = false; Pa.stagger = 0.9;
      G.UI.msg(info.heavy ? '💥 ¡Golpe fuerte! Te rompió la guardia (el brillo rojo no se para: apártate)' : '💥 ¡Guardia rota! Te quedaste sin energía', 'bad', 'guardbreak');
    }
    return left;
  };
  // ¿Tu siguiente golpe es un contraataque contra esta criatura (o jugador)? Lo gasta.
  Pa.riposteOn = function (key) {
    if (Pa.riposte <= 0 || Pa.ripId !== key) return false;
    Pa.riposte = 0; Pa.ripId = null;
    G.UI.msg('⚔️ ¡Contraataque!', 'good', 'parry');
    return true;
  };
  // Te pararon el golpe: aturdido un momento
  Pa.staggerMe = function (secs, text) {
    Pa.stagger = Math.max(Pa.stagger, secs); Pa.guard = false;
    const P = G.Player; P.shake = Math.max(P.shake, 0.2); P.cd = Math.max(P.cd, secs);
    G.Audio.play('parry');
    if (text) G.UI.msg(text, 'bad', 'parried');
  };

  // ------------------------------------------------------------------ NPC: preparar el golpe
  // attack() de creatures.js llama aquí en vez de golpear al instante. fast: contraataque (preparación corta).
  Pa.windup = function (c, t, reach, fast) {
    if (c.windup > 0 || c.stun > 0) return false;
    const lead = LEADER.test(c.type);
    const heavy = !fast && !c.lastHeavy && Math.random() < (lead ? 0.3 : c.type.startsWith('marine') ? 0.12 : 0.08);
    c.lastHeavy = heavy;
    const slow = [1.25, 1, 0.85][G.state.diff] ?? 1;
    c.windup = (fast ? 0.34 : heavy ? 0.85 : 0.55) * slow;
    c.heavy = heavy; c.wT = t.id; c.wReach = reach;
    c.cd = Math.max(c.cd, c.windup + 0.1);
    Pa.glint(c, heavy);
    // Primera vez que un enemigo te prepara un golpe: consejo
    if (t.local && !Pa.tipped && Math.hypot(t.x - c.x, t.z - c.z) < 5) {
      Pa.tipped = true;
      G.UI.msg('💡 ¡Va a golpearte! Pulsa <kbd>Clic derecho</kbd> justo antes del golpe para <b>pararlo</b> (o mantenlo para cubrirte). Si brilla en <b style="color:#ff6a5a">rojo</b>, apártate.', 'info', 'parryTip2');
    }
    return true;
  };
  // Termina la preparación: golpea si el objetivo sigue a su alcance
  Pa.strike = function (c, t, CD, cause) {
    c.windup = 0; c.lunge = 0.3; c.cd = (CD || 1.4) + Math.random() * 0.4;
    if (!t || t.dead || Math.hypot(t.x - c.x, t.z - c.z) > (c.wReach || 2) + 0.7 || Math.abs((t.y || 0) - c.y) > 1.8) { G.Audio.playAt('swing', c.x, c.z, 25); return; }
    const amt = c.d.dmg * G.Game.diff().dmg * (c.heavy ? 1.6 : 1), info = { melee: true, cid: c.id, heavy: c.heavy };
    if (t.local) G.Player.damage(amt, c, cause, info);
    else G.Net.send({ t: 'dmgP', to: t.id, amt, cause, sx: c.x, sz: c.z, mel: 1, cid: c.id, hv: c.heavy ? 1 : 0 });
    G.Audio.playAt('hit', c.x, c.z, 30);
  };
  // El anfitrión aturde a una criatura (tu parada perfecta)
  function stun(cid, secs) {
    if (!G.Net.authority()) { G.Net.send({ t: 'parryC', id: cid, s: secs }); return; }
    const c = G.Creatures.byId(cid);
    if (c && !c.dead) { c.stun = Math.max(c.stun || 0, secs); c.windup = 0; c.cd = Math.max(c.cd, secs); c.guardT = 0; }
  }

  // ------------------------------------------------------------------ NPC: cubrirse y parar tus golpes (anfitrión)
  // Devuelve el multiplicador del daño: 1 (no se defiende), 0,25 (se cubre) o 0 (parada: te aturde y contraataca)
  Pa.npcDefend = function (c, attackerId, extra) {
    if (!extra || !extra.melee || extra.riposte || !Pa.fights(c) || c.dead || c.stun > 0 || c.windup > 0 || c.frozen > 0) return 1;
    if (c.type === 'villager' && !(G.Story && G.Story.tribeHostile())) return 1;
    const mine = attackerId === undefined || attackerId === null || attackerId === G.Net.myId;
    const src = mine ? G.Player.pos : G.Net.peers.get(attackerId);
    if (!src) return 1;
    const toA = Math.atan2(src.x - c.x, src.z - c.z);
    if (Math.abs(U.angDiff(c.yaw, toA)) > 1.4) return 1; // por la espalda no se cubren
    // Te «leen»: golpear sin parar al mismo ritmo facilita que te paren
    const now = performance.now() / 1000;
    c.readN = now - (c.readT || 0) < 1.5 ? (c.readN || 0) + 1 : 0;
    c.readT = now;
    const k = [0.6, 1, 1.3][G.state.diff] ?? 1;
    const chance = Math.min(0.75, ((SKILL[c.type] ?? 0.15) + c.readN * 0.1) * k);
    if (Math.random() > chance) return 1;
    c.yaw = toA;
    const parry = Math.random() < (LEADER.test(c.type) ? 0.55 : 0.4);
    c.readN = 0;
    c.guardT = parry ? 0.25 : 0.45;
    npcFx(c, parry ? 'parry' : 'block');
    G.Net.send({ t: 'parryFx', id: c.id, k: parry ? 'parry' : 'block', to: mine ? G.Net.myId : attackerId });
    if (!parry) return 0.25;
    // Parada: el atacante queda aturdido y el NPC contraataca enseguida
    if (mine) Pa.staggerMe(0.75, `🛡️ ¡${c.name || c.d.name} te paró el golpe! Cúbrete: va a contraatacar`);
    c.cd = 0;
    const P = G.Player, t = mine ? { id: G.Net.myId, local: true, x: P.pos.x, y: P.pos.y, z: P.pos.z } : { id: attackerId, local: false, x: src.x, y: src.y, z: src.z };
    Pa.windup(c, t, 2.4, true);
    return 0;
  };
  // Chispas y sonido de un NPC que se cubre o para
  function npcFx(c, k) {
    const a = handOf(c);
    spark(a, k === 'parry' ? 0xfff2c0 : 0xffd8a0, k === 'parry' ? 1 : 0.6);
    G.Audio.playAt(k === 'parry' ? 'parry' : 'block', c.x, c.z, 35);
  }

  // ------------------------------------------------------------------ red
  Pa.onNet = function (m, from) {
    if (m.t === 'parryC' && G.Net.authority()) stun(m.id, m.s || 1.3);
    else if (m.t === 'parryFx') {
      const c = G.Creatures.byId(m.id);
      if (c) { c.guardNet = 0.4; npcFx(c, m.k); }
      if (m.k === 'parry' && m.to === G.Net.myId) Pa.staggerMe(0.75, `🛡️ ¡${c ? c.name || c.d.name : 'Tu enemigo'} te paró el golpe! Cúbrete: va a contraatacar`);
    } else if (m.t === 'parried' && m.to === G.Net.myId) Pa.staggerMe(0.75, `🛡️ ¡${G.Net.esc(G.Net.nameOf(from))} te paró el golpe!`);
  };

  // ------------------------------------------------------------------ efectos
  const _h = new V3();
  function handPos() { const P = G.Player, d = P.lookDir(new V3()); return P.eyePos(new V3()).addScaledVector(d, 0.7).add(new V3(0, -0.2, 0)); }
  function handOf(c) {
    if (c.model && c.model.hand) { c.model.hand.getWorldPosition(_h); return _h.clone(); }
    return new V3(c.x, c.y + 1.3, c.z);
  }
  function spark(p, color, size) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.Build.smokeTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.position.copy(p); s.raycast = () => {};
    G.scene.add(s);
    Pa.fx.push({ o: s, t: 0, life: 0.25, upd: (f, k) => { f.o.scale.setScalar(size * (0.3 + k * 1.2)); f.o.material.opacity = 1 - k; } });
    // Chispas que saltan
    for (let i = 0; i < 6; i++) {
      const q = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.Build.smokeTex, color: 0xffe6a0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      q.position.copy(p); q.raycast = () => {}; q.scale.setScalar(0.07);
      const v = new V3((Math.random() - 0.5) * 5, Math.random() * 3 + 1, (Math.random() - 0.5) * 5);
      G.scene.add(q);
      Pa.fx.push({ o: q, t: 0, life: 0.35, upd: (f, k, dt) => { v.y -= 12 * dt; f.o.position.addScaledVector(v, dt); f.o.material.opacity = 1 - k; } });
    }
  }
  // Brillo del arma al preparar el golpe (sigue a la mano)
  Pa.glint = function (c, heavy) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.Build.smokeTex, color: heavy ? 0xff3a28 : 0xfff0a0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.raycast = () => {}; s.renderOrder = 5;
    G.scene.add(s);
    Pa.fx.push({ o: s, t: 0, life: heavy ? 0.7 : 0.4, upd: (f, k) => { f.o.position.copy(handOf(c)); f.o.position.y += 0.15; f.o.scale.setScalar((heavy ? 0.9 : 0.6) * Math.sin(Math.min(1, k * 1.4) * Math.PI) + 0.05); f.o.material.opacity = 1 - k * 0.5; } });
    G.Audio.playAt(heavy ? 'glintH' : 'glint', c.x, c.z, 22);
  };
  let flashEl = null;
  function flashScreen() {
    if (!flashEl) { flashEl = document.createElement('div'); flashEl.id = 'parryFlash'; document.body.appendChild(flashEl); }
    flashEl.classList.remove('on'); void flashEl.offsetWidth; flashEl.classList.add('on');
  }

  // ------------------------------------------------------------------ fotograma
  Pa.update = function (dt) {
    const P = G.Player;
    Pa.gT += dt;
    Pa.stagger = Math.max(0, Pa.stagger - dt);
    Pa.riposte = Math.max(0, Pa.riposte - dt);
    if (Pa.guard) {
      if (!Pa.canGuard() || Pa.stagger > 0) Pa.guard = false;
      else {
        P.stats.stamina = Math.max(0, P.stats.stamina - 3 * dt);
        if (P.stats.stamina <= 0) { Pa.guard = false; Pa.stagger = 0.6; G.UI.msg('😮‍💨 Sin energía: bajas la guardia.', 'warn', 'guard'); }
      }
    }
    Pa.guardK += ((Pa.guard ? 1 : 0) - Pa.guardK) * Math.min(1, dt * 16);
    Pa.staggerK += ((Pa.stagger > 0 ? 1 : 0) - Pa.staggerK) * Math.min(1, dt * 12);
    for (let i = Pa.fx.length - 1; i >= 0; i--) {
      const f = Pa.fx[i];
      f.t += dt;
      const k = Math.min(1, f.t / f.life);
      f.upd(f, k, dt);
      if (k >= 1) { G.scene.remove(f.o); f.o.material.dispose(); Pa.fx.splice(i, 1); }
    }
  };
  Pa.clear = function () {
    for (const f of Pa.fx) { G.scene.remove(f.o); f.o.material.dispose(); }
    Pa.fx.length = 0; Pa.guard = false; Pa.stagger = 0; Pa.riposte = 0; Pa.ripId = null;
  };
})();
