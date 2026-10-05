// Combate de duelo (al estilo de Dueling Grounds), con un arma cuerpo a cuerpo o las manos vacías:
//   Clic izq.  ataque ligero: combo de 4 golpes (derecha, revés, de arriba y una estocada final que empuja)
//   Clic der.  ataque pesado: se carga (brilla en rojo), rompe el bloqueo y empuja; se puede parar a tiempo
//   F          toque: parada · mantener: bloqueo (parry.js) · durante un pesado: finta (lo cancelas)
//   Q          esquivar hacia donde te mueves (hacia atrás si no te mueves), con un instante de invulnerabilidad
//   T / rueda  fijar la mirada en el enemigo más cercano delante de ti (otra vez para soltarlo)
//   Z / R      técnica y definitivo de tu estilo de combate (styles.js)
// Y los efectos que lo hacen vistoso: estelas del arma, números de daño, chispas, polvo al esquivar, correr y
// aterrizar, pausa de impacto (hitstop), sacudidas y cambios de campo de visión de la cámara.
(function () {
  'use strict';
  const G = window.G, U = G.U, V3 = THREE.Vector3;
  const Cb = (G.Combat = { lock: null, dodgeT: 0, dodgeCd: 0, iframes: 0, dodgeDir: new V3(), dodgeSide: 0, heavyT: 0, combo: 0, comboT: 0, stopT: 0, kick: 0, fx: [] });
  const DODGE = 0.3, HEAVY = 0.48;

  // ------------------------------------------------------------------ utilidades
  const P = () => G.Player;
  Cb.melee = () => G.Parry.canGuard();
  // Enemigo al que se puede fijar la mirada o golpear
  Cb.hostileC = (c) => !c.dead && c.d.dmg && !c.d.friendly && !c.d.dummy && !(c.d.npc && !(G.Story && G.Story.tribeHostile())) && !G.Faction.friendly(c);
  // Daño base del arma (o los puños) que llevas en la mano
  Cb.baseDmg = function () {
    const id = G.Inv.heldId(), it = id && G.ITEMS[id], k = G.Styles.styleOf(id), learned = k && G.Styles.learned(k);
    const base = !id ? (learned ? 12 : 5) : it && it.dmg ? it.dmg : 5;
    return base * (learned ? G.Styles.mul(k) : 1) * (G.Story ? G.Story.meleeMul() : 1);
  };

  // ------------------------------------------------------------------ combo de golpes ligeros
  // Devuelve el paso del combo (0: tajo de derecha a izquierda, 1: revés, 2: de arriba, 3: estocada final)
  Cb.comboStep = function () {
    const now = performance.now() / 1000;
    Cb.combo = now - Cb.comboT < 1.0 ? (Cb.combo + 1) % 4 : 0;
    Cb.comboT = now;
    const pl = P();
    pl.swingDir = Cb.combo;
    return { n: Cb.combo, fin: Cb.combo === 3, mul: Cb.combo === 3 ? 1.4 : 1 };
  };

  // ------------------------------------------------------------------ esquivar (Q)
  Cb.dodge = function () {
    const pl = P(), K = G.Input.keys;
    if (pl.dead || pl.ship || pl.station || pl.swimming || Cb.dodgeCd > 0 || G.Parry.stagger > 0 || G.state.mode !== 'playing') return;
    if (pl.stats.stamina < 14) { G.UI.msg('😮‍💨 Sin energía para esquivar.', 'warn', 'dodge'); return; }
    const fwd = (K.KeyW || K.ArrowUp ? 1 : 0) - (K.KeyS || K.ArrowDown ? 1 : 0), str = (K.KeyD || K.ArrowRight ? 1 : 0) - (K.KeyA || K.ArrowLeft ? 1 : 0);
    const f = fwd || str ? fwd : -1, s = str;
    const sy = Math.sin(pl.yaw), cy = Math.cos(pl.yaw);
    Cb.dodgeDir.set(-sy * f + cy * s, 0, -cy * f - sy * s).normalize();
    Cb.dodgeSide = s !== 0 ? s : f > 0 ? 2 : -2; // ±1 a un lado, 2 adelante, -2 atrás
    Cb.dodgeT = DODGE; Cb.dodgeCd = 0.8; Cb.iframes = 0.32;
    pl.stats.stamina -= 14;
    if (Cb.heavyT > 0) Cb.heavyT = 0; // esquivar también cancela el golpe pesado
    G.Parry.guard = false;
    if (pl.onGround) pl.vel.y = 2.4;
    Cb.kick += 7;
    G.Audio.play('whoosh');
    dust(pl.pos.x, pl.pos.y + 0.05, pl.pos.z, 5, 1.1);
    Cb.dodgeCount = (Cb.dodgeCount || 0) + 1;
  };
  // Velocidad del esquive (player.js la usa en lugar de la de andar mientras dura)
  Cb.dodgeVel = function (out) {
    const k = Cb.dodgeT / DODGE;
    return out.copy(Cb.dodgeDir).multiplyScalar(4 + 13 * Math.sqrt(k));
  };

  // ------------------------------------------------------------------ ataque pesado (clic derecho) y finta (F)
  // Devuelve true si el clic derecho era para esto (llevas algo con lo que golpear)
  Cb.heavy = function () {
    const pl = P();
    if (!Cb.melee()) return false;
    if (pl.cd > 0 || Cb.heavyT > 0 || G.Parry.stagger > 0 || G.Parry.guard || pl.dead) return true;
    if (pl.stats.stamina < 12) { G.UI.msg('😮‍💨 Sin energía para un golpe pesado.', 'warn', 'heavy'); return true; }
    pl.stats.stamina -= 12;
    Cb.heavyT = HEAVY;
    G.Audio.play('glintH');
    return true;
  };
  // F: si estás cargando un pesado, lo cancelas (finta); si no, parada/bloqueo
  Cb.fKey = function () {
    if (Cb.heavyT > 0) {
      Cb.heavyT = 0; P().stats.stamina = Math.max(0, P().stats.stamina - 6);
      G.UI.msg('🎭 ¡Finta!', 'info', 'feint');
      G.Audio.play('swing', 0.5);
      return true;
    }
    return G.Parry.down();
  };
  function heavyStrike() {
    const pl = P(), G2 = G.Game;
    pl.swing = 1; pl.swingCount++; pl.swingDir = 4; pl.cd = 0.6;
    Cb.kick += 4; pl.shake = Math.max(pl.shake, 0.18);
    G.Audio.play('heavySwing');
    Cb.trail(4);
    const tg = G2.findTarget();
    G2.target = tg;
    const dmg = Cb.baseDmg() * 1.9, k = G.Styles.styleOf(G.Inv.heldId());
    if (tg && tg.kind === 'creature' && (Cb.hostileC(tg.c) || tg.c.d.dummy)) {
      const c = tg.c, rip = G.Parry.riposteOn(c.id), z = Cb.zoneFor(tg), d = dmg * z.mul * (rip ? 2 : 1);
      const was = c.dead, hp0 = c.hp;
      G.Creatures.hurt(c, d, undefined, { melee: true, heavy: true, riposte: rip, zone: z.zone, side: z.side });
      knock(c, 2.2);
      const a = G.Creatures.aimPoint(c);
      if (c.d.dummy || !G.Net.authority() || c.hp < hp0 || c.dead) { impact(a.x, a.y, a.z, true); Cb.hitNum(a.x, a.y + 0.9, a.z, c.d.dummy || !G.Net.authority() ? d : hp0 - Math.max(0, c.hp), z.zone, rip ? 'crit' : 'heavy', c.d.dummy); }
      if (k && G.Styles.learned(k)) G.Styles.addXp(k, !was && c.dead ? 6 : 2);
      G.Inv.wear(1);
    } else if (tg && tg.kind === 'peer' && G.Modes.canHurtPeer(tg.p)) {
      const p = tg.p, rip = G.Parry.riposteOn('p' + p.id), z = Cb.zoneFor(tg), d = dmg * 0.8 * z.mul * (rip ? 2 : 1);
      G.Net.send({ t: 'dmgP', to: p.id, amt: d, cause: `El golpe pesado de ${G.Net.name}`, sx: pl.pos.x, sz: pl.pos.z, by: G.Net.myId, mel: 1, hv: 1, zn: z.zone, zs: z.side });
      if (p.model && p.model.react) p.model.react(z.zone, z.side, 1.3);
      impact(p.x, p.y + 1.1, p.z, true);
      Cb.hitNum(p.x, p.y + 1.9, p.z, d, z.zone, rip ? 'crit' : 'heavy');
    } else if (tg && (tg.kind === 'res' || tg.kind === 'struct')) { pl.cd = 0; G2.attack(); pl.cd = 0.6; pl.swingDir = 4; } // árboles, rocas…: golpe normal
  }
  // Empujón de un golpe fuerte (lo aplica quien simula las criaturas)
  function knock(c, dist) {
    if (!G.Net.authority() || c.dead || c.d.bigBoss || ['boss', 'whale', 'serpent', 'pirate_boss'].includes(c.type) || c.deck) return;
    const src = P().pos, dx = c.x - src.x, dz = c.z - src.z, d = Math.hypot(dx, dz) || 1;
    const nx = c.x + dx / d * dist, nz = c.z + dz / d * dist;
    if (G.Creatures.validPos(c.type, nx, nz)) { c.x = nx; c.z = nz; }
  }
  Cb.knock = knock;

  // ------------------------------------------------------------------ fijar la mirada (T / rueda)
  Cb.toggleLock = function () {
    if (Cb.lock) { unlock('🎯 Objetivo liberado.'); return; }
    const pl = P();
    let best = null, bs = 1e9;
    const consider = (kind, ref, x, z) => {
      const dx = x - pl.pos.x, dz = z - pl.pos.z, d = Math.hypot(dx, dz);
      if (d > 28) return;
      const a = Math.abs(U.angDiff(pl.yaw, Math.atan2(-dx, -dz)));
      if (a > 1.25) return;
      const s = a * 12 + d;
      if (s < bs) { bs = s; best = { kind, ref, id: ref.id }; }
    };
    G.Creatures.forEachAlive((c) => { if (Cb.hostileC(c)) consider('c', c, c.x, c.z); });
    for (const p of G.Net.peers.values()) if (!p.dead && G.Modes.canHurtPeer(p)) consider('p', p, p.x, p.z);
    if (!best) { G.UI.msg('🎯 No hay ningún enemigo delante al que fijar la mirada.', 'info', 'lock'); return; }
    Cb.lock = best;
    G.Audio.play('lockOn');
    G.UI.msg(`🎯 Fijado: <b>${G.Net.esc(best.kind === 'p' ? best.ref.name : best.ref.name || best.ref.d.name)}</b> · <kbd>T</kbd> para soltarlo`, 'info', 'lock');
  };
  function unlock(text) {
    Cb.lock = null;
    if (reticle) reticle.visible = false;
    if (text) G.UI.msg(text, 'info', 'lock');
  }
  // Punto al que mirar del objetivo fijado (o null si ya no vale)
  function lockPoint() {
    const L = Cb.lock;
    if (!L) return null;
    if (L.kind === 'c') {
      const c = G.Creatures.byId(L.id);
      if (!c || c.dead || !Cb.hostileC(c)) return null;
      const a = G.Creatures.aimPoint(c);
      return { x: a.x, y: a.y, z: a.z, top: a.y + (c.d.hitR || 0.6) + 0.35 };
    }
    const p = G.Net.peers.get(L.id);
    if (!p || p.dead || p.out || !G.Modes.canHurtPeer(p)) return null;
    return { x: p.x, y: p.y + (p.swim ? 0.3 : 1.15), z: p.z, top: p.y + 2.1 };
  }
  let reticle = null;
  function reticleMesh() {
    if (reticle) return reticle;
    const tex = U.canvasTex(128, 128, (c, w, h) => {
      c.strokeStyle = '#ff4a3a'; c.lineWidth = 7; c.lineCap = 'round';
      c.beginPath(); c.arc(w / 2, h / 2, 40, 0, Math.PI * 2); c.stroke();
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; c.beginPath(); c.moveTo(w / 2 + Math.cos(a) * 48, h / 2 + Math.sin(a) * 48); c.lineTo(w / 2 + Math.cos(a) * 60, h / 2 + Math.sin(a) * 60); c.stroke(); }
      c.fillStyle = '#ff4a3a'; c.beginPath(); c.arc(w / 2, h / 2, 6, 0, Math.PI * 2); c.fill();
    });
    reticle = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
    reticle.renderOrder = 20; reticle.raycast = () => {};
    G.scene.add(reticle);
    return reticle;
  }

  // ------------------------------------------------------------------ efectos
  const addMat = (color, opacity = 0.9) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  function addFx(o, life, upd) { G.scene.add(o); Cb.fx.push({ o, t: 0, life, upd }); }
  // Estela del arma: un arco de luz delante del cuerpo, orientado según el golpe del combo
  const ROLL = [-0.22, Math.PI + 0.22, -Math.PI / 2 + 0.15, 0, -Math.PI / 2];
  // Media luna del tajo: más brillante en el filo que avanza y en el borde exterior, y se desvanece hacia la cola
  const slashGeos = {};
  function slashGeo(big) {
    const key = big ? 'b' : 's';
    if (slashGeos[key]) return slashGeos[key];
    const g = new THREE.RingGeometry(big ? 0.72 : 0.6, big ? 1.12 : 0.9, 40, 3, Math.PI * 0.06, Math.PI * 0.88);
    const pos = g.attributes.position, col = new Float32Array(pos.count * 4), r0 = big ? 0.72 : 0.6, r1 = big ? 1.12 : 0.9;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), a = Math.atan2(y, x), r = Math.hypot(x, y);
      const along = U.clamp((a - Math.PI * 0.06) / (Math.PI * 0.88), 0, 1), rad = (r - r0) / (r1 - r0);
      const al = Math.pow(1 - along, 1.6) * (0.25 + 0.75 * rad) * (rad > 0.96 ? 0.6 : 1);
      col[i * 4] = 1; col[i * 4 + 1] = 1; col[i * 4 + 2] = 1; col[i * 4 + 3] = al;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 4));
    g.userData.shared = true;
    return (slashGeos[key] = g);
  }
  Cb.trailAt = function (x, y, z, yaw, dir, heavy, color) {
    const big = heavy || dir === 4, fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const mat = new THREE.MeshBasicMaterial({ color: color || (big ? 0xffd2a0 : 0xeaf6ff), vertexColors: true, transparent: true, opacity: 1, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    let m;
    if (dir === 3) { // estocada: una línea de luz recta hacia delante
      m = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 1.5), new THREE.MeshBasicMaterial({ color: color || 0xeaf6ff, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
      m.position.set(x + fx * 1.1, y, z + fz * 1.1);
      m.rotation.set(-Math.PI / 2, 0, -yaw);
    } else {
      m = new THREE.Mesh(slashGeo(big), mat);
      m.position.set(x + fx * 0.5, y, z + fz * 0.5);
      m.lookAt(x + fx * 3, y, z + fz * 3);
      m.rotateZ(ROLL[dir] || 0);
    }
    m.raycast = () => {}; m.renderOrder = 6;
    const life = big ? 0.3 : 0.22;
    addFx(m, life, (f, k) => { const e = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85; f.o.material.opacity = (big ? 1 : 0.9) * e; f.o.rotateZ(dir === 1 ? 0.05 : -0.05); f.o.scale.setScalar(1 + k * 0.2); });
  };
  Cb.trail = function (dir) {
    const pl = P();
    Cb.trailAt(pl.pos.x, pl.pos.y + (dir === 2 || dir === 4 ? 1.35 : 1.2), pl.pos.z, pl.yaw, dir, dir === 4, G.Parry.riposte > 0 ? 0xfff0a0 : null);
  };
  // Números de daño que suben y se desvanecen (blanco normal, naranja pesado, amarillo contraataque)
  const NUMC = { hit: '#ffffff', heavy: '#ffb060', crit: '#ffe04a', parry: '#bfe6ff', block: '#c8c8c8', dodge: '#8ff0ff', break: '#ff7060' };
  Cb.dmgNum = function (x, y, z, v, kind = 'hit', text) {
    const s = text || String(Math.max(1, Math.round(v)));
    const tex = U.canvasTex(256, 96, (c, w, h) => {
      c.font = `900 ${text ? 44 : 60}px Nunito, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = 9; c.strokeStyle = 'rgba(0,0,0,.75)'; c.strokeText(s, w / 2, h / 2);
      c.fillStyle = NUMC[kind] || '#fff'; c.fillText(s, w / 2, h / 2);
    });
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
    sp.renderOrder = 21; sp.raycast = () => {};
    const big = kind === 'crit' || kind === 'heavy' ? 1.25 : 1, dx = (Math.random() - 0.5) * 0.5;
    sp.position.set(x + dx, y, z);
    addFx(sp, 0.9, (f, k) => {
      f.o.position.y = y + k * 0.9;
      const pop = k < 0.15 ? 0.6 + k / 0.15 * 0.6 : 1.2 - (k - 0.15) * 0.3;
      f.o.scale.set(0.9 * big * pop, 0.34 * big * pop, 1);
      f.o.material.opacity = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    });
  };
  // Impacto: chispas, anillo, sacudida y una pausa cortísima (hitstop)
  function impact(x, y, z, heavy) {
    G.Styles.spark(x, y, z, heavy ? 0xffd0a0 : 0xffffff);
    const r = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.2, 24), addMat(heavy ? 0xffb070 : 0xffffff, 0.8));
    r.position.set(x, y, z); r.lookAt(G.camera.position); r.raycast = () => {};
    addFx(r, 0.2, (f, k) => { f.o.scale.setScalar(1 + k * (heavy ? 3.2 : 2)); f.o.material.opacity = 0.8 * (1 - k); });
    Cb.stopT = Math.max(Cb.stopT, heavy ? 0.085 : 0.045);
    P().shake = Math.max(P().shake, heavy ? 0.22 : 0.08);
    if (heavy) G.Audio.play('hitHeavy');
  }
  Cb.impact = impact;
  // Polvo a los pies (esquivar, aterrizar, correr), del color del suelo
  function dust(x, y, z, n, size) {
    const h = G.height(x, z), biome = G.Arch.biomeAt(x, z);
    const col = G.World.waterLevelAt(x, z) > h + 0.1 ? 0xffffff : biome === 'escarcha' ? 0xf2f6fa : h < 2.3 ? 0xd8c8a0 : biome === 'brasa' ? 0x6a5a52 : 0xa89878;
    G.Ships.puff(x, y, z, col, size, 0.5, n);
  }
  Cb.dust = dust;
  // Aterrizar: polvo, golpe sordo y la cámara se hunde un poco
  Cb.land = function (v) {
    const pl = P(), k = U.clamp((v - 6) / 10, 0, 1);
    if (k <= 0) return;
    pl.landK = Math.max(pl.landK || 0, k);
    dust(pl.pos.x, pl.pos.y + 0.05, pl.pos.z, 3 + Math.round(k * 5), 0.8 + k);
    G.Audio.play('land', 0.4 + k * 0.6);
  };
  // Campo de visión extra (esquivar, correr) y pausa de impacto
  Cb.fovExtra = function (dt) {
    const pl = P();
    Cb.kick = Math.max(0, Cb.kick - dt * 30);
    Cb.sprintK = U.lerp(Cb.sprintK || 0, pl.sprinting && pl.hs > 5 ? 1 : 0, Math.min(1, dt * 4));
    return Cb.kick + Cb.sprintK * 7;
  };
  Cb.timeScale = function (dt) {
    if (Cb.stopT <= 0) return 1;
    Cb.stopT -= dt;
    return 0.08;
  };

  // ------------------------------------------------------------------ zonas del cuerpo
  // El daño depende de dónde entra el golpe: cabeza ×1,6 (aturde un instante), torso ×1, brazos ×0,7
  // (pueden cortar el golpe que prepara) y piernas ×0,8 (frenan). En los animales, la cabeza ×1,4.
  Cb.ZONES = {
    cabeza: { mul: 1.6, name: 'CABEZA', kind: 'crit' }, torso: { mul: 1, name: 'TORSO', kind: 'hit' },
    brazo: { mul: 0.7, name: 'BRAZO', kind: 'limb' }, pierna: { mul: 0.8, name: 'PIERNA', kind: 'limb' }, cuerpo: { mul: 1, name: 'CUERPO', kind: 'hit' },
  };
  NUMC.limb = '#d8d0c0';
  const _a = new V3(), _b = new V3(), _q = new V3();
  // Distancia de un punto al rayo (solo por delante del origen)
  function rayDist(o, d, p) {
    const t = Math.max(0, (p.x - o.x) * d.x + (p.y - o.y) * d.y + (p.z - o.z) * d.z);
    return Math.hypot(o.x + d.x * t - p.x, o.y + d.y * t - p.y, o.z + d.z * t - p.z);
  }
  // Distancia de un segmento (a-b) al rayo, muestreando el segmento
  function segDist(o, d, a, b) {
    let best = 1e9;
    for (let i = 0; i <= 4; i++) { _q.copy(a).lerp(b, i / 4); best = Math.min(best, rayDist(o, d, _q)); }
    return best;
  }
  // Partes de una persona (huesos de character.js): [zona, lado, hueso inicial, hueso final, radio]
  const PARTS = [['torso', null, 'hips', 'neck', 0.2], ['cabeza', null, 'head', null, 0.15], ['brazo', 'L', 'uaL', 'hL', 0.075], ['brazo', 'R', 'uaR', 'hR', 0.075],
    ['pierna', 'L', 'thL', 'ftL', 0.09], ['pierna', 'R', 'thR', 'ftR', 0.09]];
  function modelZone(model, o, d) {
    const Bn = G.Character.B, bones = model.bones;
    let best = null, bd = 1e9;
    for (const [zone, side, from, to, r] of PARTS) {
      bones[Bn[from]].getWorldPosition(_a);
      let dist;
      if (!to) { _a.y += 0.11; dist = rayDist(o, d, _a); } else { bones[Bn[to]].getWorldPosition(_b); dist = segDist(o, d, _a, _b); }
      const s = dist - r;
      if (s < bd) { bd = s; best = { zone, side }; }
    }
    return bd < 0.18 ? best : { zone: 'torso', side: null };
  }
  // Zona del golpe contra el objetivo al que apuntas (tg de Game.findTarget)
  Cb.zoneFor = function (tg) {
    const pl = P(), o = pl.eyePos(new V3()), d = pl.lookDir(new V3());
    let z = { zone: 'torso', side: null };
    if (tg && tg.kind === 'peer' && tg.p.model) z = modelZone(tg.p.model, o, d);
    else if (tg && tg.kind === 'creature') {
      const c = tg.c;
      if (c.model && c.model.bones) z = modelZone(c.model, o, d);
      else if (c.d.dummy) z = dummyZone(c, o, d);
      else if (c.rig && c.rig.B && c.rig.B.head) {
        c.rig.B.head.getWorldPosition(_a);
        z = { zone: rayDist(o, d, _a) < (c.d.hitR || 0.6) * 0.5 ? 'cabeza' : 'cuerpo', side: null, beast: true };
      } else z = { zone: 'cuerpo', side: null };
    }
    z.mul = z.beast && z.zone === 'cabeza' ? 1.4 : Cb.ZONES[z.zone].mul;
    return z;
  };
  // Muñeco de paja: cabeza arriba, brazos a los lados del travesaño, el poste abajo
  function dummyZone(c, o, d) {
    const hx = d.x * d.x + d.z * d.z || 1e-6, s = ((c.x - o.x) * d.x + (c.z - o.z) * d.z) / hx;
    const y = o.y + d.y * s - c.y, px = o.x + d.x * s - c.x, pz = o.z + d.z * s - c.z;
    const lat = -px * Math.cos(c.yaw) + pz * Math.sin(c.yaw); // desde el frente del muñeco: + a su izquierda
    if (y > 1.5) return { zone: 'cabeza', side: null };
    if (y > 1.2 && y < 1.5 && Math.abs(lat) > 0.24) return { zone: 'brazo', side: lat > 0 ? 'L' : 'R' };
    if (y < 0.8) return { zone: 'pierna', side: null };
    return { zone: 'torso', side: null };
  }
  // Número de daño con la zona (en el muñeco siempre se ve la zona, para practicar)
  Cb.hitNum = function (x, y, z, dmg, zone, extraKind, dummy) {
    const Z = Cb.ZONES[zone] || Cb.ZONES.torso;
    const kind = extraKind || (zone === 'cabeza' ? 'crit' : Z.kind);
    Cb.dmgNum(x, y, z, dmg, kind, dummy || zone === 'cabeza' ? `${Math.max(1, Math.round(dmg))} · ${Z.name}` : null);
  };

  // ------------------------------------------------------------------ articulaciones del muñeco de paja
  // Cada pieza (cuerpo, cabeza y brazos) cuelga de un muelle: el golpe la empuja y vuelve balanceándose
  Cb.reactDummy = function (c, zone, side, power = 1) {
    const J = c.joints;
    if (!J) return;
    const kick = (j, v) => { if (j) j.vel += v * power; };
    if (zone === 'cabeza') { kick(J.head, -7); kick(J.torso, -1.5); }
    else if (zone === 'brazo') { kick(side === 'L' ? J.armL : J.armR, side === 'L' ? 9 : -9); kick(J.torsoZ, side === 'L' ? 1.5 : -1.5); }
    else if (zone === 'pierna') kick(J.torso, -1);
    else { kick(J.torso, -4); kick(J.head, 3); kick(J.armL, 3); kick(J.armR, -3); }
  };
  Cb.springs = function (c, dt) {
    const J = c.joints;
    if (!J) return;
    for (const k in J) {
      const j = J[k];
      j.vel += (-j.ang * j.k - j.vel * j.damp) * dt;
      j.ang = U.clamp(j.ang + j.vel * dt, -j.max, j.max);
      j.o.rotation[j.axis] = j.ang;
    }
  };

  // ------------------------------------------------------------------ fotograma
  const _lp = new V3();
  Cb.update = function (dt) {
    const pl = P();
    Cb.dodgeT = Math.max(0, Cb.dodgeT - dt);
    Cb.dodgeCd = Math.max(0, Cb.dodgeCd - dt);
    Cb.iframes = Math.max(0, Cb.iframes - dt);
    pl.landK = Math.max(0, (pl.landK || 0) - dt * 4);
    // Estela de polvo mientras esquivas
    if (Cb.dodgeT > 0 && pl.onGround && (Cb.dustT = (Cb.dustT || 0) - dt) <= 0) { Cb.dustT = 0.06; dust(pl.pos.x, pl.pos.y + 0.05, pl.pos.z, 1, 0.7); }
    // Golpe pesado: se carga y sale solo
    if (Cb.heavyT > 0) {
      if (G.Parry.stagger > 0 || pl.dead) Cb.heavyT = 0;
      else if ((Cb.heavyT -= dt) <= 0) { Cb.heavyT = 0; heavyStrike(); }
    }
    // Mirada fijada: el personaje (y la cámara) siguen al objetivo
    if (Cb.lock) {
      const t = lockPoint();
      if (!t || Math.hypot(t.x - pl.pos.x, t.z - pl.pos.z) > 36 || pl.dead) unlock(t ? '🎯 El objetivo está demasiado lejos.' : null);
      else {
        const dx = t.x - pl.pos.x, dz = t.z - pl.pos.z, d = Math.hypot(dx, dz);
        pl.yaw += U.angDiff(pl.yaw, Math.atan2(-dx, -dz)) * Math.min(1, dt * 10);
        const eye = pl.eyePos(_lp).y;
        pl.pitch = U.lerp(pl.pitch, U.clamp(Math.atan2(t.y - eye, Math.max(0.5, d)) - (pl.cam === 'tp' ? 0.06 : 0), -1.2, 1.2), Math.min(1, dt * 8));
        const r = reticleMesh();
        r.visible = true;
        r.position.set(t.x, t.top, t.z);
        r.scale.setScalar(0.45 + Math.sin(performance.now() / 150) * 0.03);
        r.material.rotation += dt * 1.5;
      }
    }
    for (let i = Cb.fx.length - 1; i >= 0; i--) {
      const f = Cb.fx[i];
      f.t += dt;
      const k = Math.min(1, f.t / f.life);
      f.upd(f, k, dt);
      if (k >= 1) { G.scene.remove(f.o); if (f.o.geometry && !f.o.geometry.userData.shared) f.o.geometry.dispose(); if (f.o.material.map) f.o.material.map.dispose(); f.o.material.dispose(); Cb.fx.splice(i, 1); }
    }
  };
  Cb.clear = function () {
    for (const f of Cb.fx) { G.scene.remove(f.o); if (f.o.material.map) f.o.material.map.dispose(); f.o.material.dispose(); }
    Cb.fx.length = 0;
    Cb.lock = null; if (reticle) reticle.visible = false;
    Cb.dodgeT = 0; Cb.heavyT = 0; Cb.iframes = 0; Cb.stopT = 0;
  };
})();
