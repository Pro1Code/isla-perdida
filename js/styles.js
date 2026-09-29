// Estilos de combate que se aprenden con los maestros de la Isla Perdida:
//   ⚔️ Espadachín (katana, sable) · 🔫 Tirador (pistola, mosquete + balas) · 👊 Luchador (manos vacías) · 🔮 Brujo (bastón + maná)
// Cada estilo sube de nivel (1-10) usándolo y tiene dos técnicas: Z (nivel 1) y el definitivo R (nivel 3).
// El progreso es personal y se guarda con la partida (G.state.styles).
(function () {
  'use strict';
  const G = window.G, U = G.U, V3 = THREE.Vector3;
  const S = (G.Styles = { mana: 100, proj: [], fx: [], cd: { sword: [0, 0], gun: [0, 0], fist: [0, 0], magic: [0, 0] }, combo: 0 });
  const $ = (id) => document.getElementById(id);

  S.DEF = {
    sword: { name: 'Espadachín', icon: '⚔️', color: '#9fd3ff', master: 'Kaito', techs: [
      { name: 'Corte volador', lv: 1, cd: 4, desc: 'Lanza una onda cortante hacia delante.' },
      { name: 'Torbellino', lv: 3, cd: 8, desc: 'Giras con la espada y golpeas a todo lo que te rodea.' }] },
    gun: { name: 'Tirador', icon: '🔫', color: '#f0c070', master: 'Crane', techs: [
      { name: 'Disparo certero', lv: 1, cd: 6, desc: 'Un disparo apuntado que hace mucho más daño.' },
      { name: 'Ráfaga', lv: 3, cd: 9, desc: 'Tres disparos rápidos en abanico (gasta 3 balas).' }] },
    fist: { name: 'Luchador', icon: '👊', color: '#ff9a6a', master: 'Bastián', techs: [
      { name: 'Patada huracán', lv: 1, cd: 5, desc: 'Una patada que golpea y empuja todo lo que tienes delante.' },
      { name: 'Salto del tigre', lv: 3, cd: 8, desc: 'Saltas hacia delante y caes golpeando.' }] },
    magic: { name: 'Brujo', icon: '🔮', color: '#c9a0ff', master: 'Silvano', techs: [
      { name: 'Rayo', lv: 1, cd: 5, mana: 25, desc: 'Un rayo cae del cielo sobre el enemigo que miras.' },
      { name: 'Marea curativa', lv: 3, cd: 15, mana: 40, desc: 'Curas tus heridas y las de tu tripulación cercana.' }] },
  };
  const MAX = 10;
  const need = (lv) => 20 + lv * 25; // experiencia para pasar del nivel lv al siguiente
  const st = () => (G.state.styles = G.state.styles || {});
  S.learned = (k) => !!st()[k];
  S.level = (k) => (st()[k] ? st()[k].lv : 0);
  S.mul = (k) => 1 + (Math.max(1, S.level(k)) - 1) * 0.1;
  S.any = () => Object.keys(st()).length > 0;

  // Aprender un estilo (lo enseña su maestro) y recibir su arma inicial
  S.learn = function (k) {
    if (S.learned(k)) return false;
    st()[k] = { lv: 1, xp: 0 };
    const D = S.DEF[k];
    G.UI.banner(`${D.icon} ${D.name}`, `Nuevo estilo de combate · <kbd>Z</kbd> ${D.techs[0].name}`);
    G.Audio.play('win');
    if (G.Ach) G.Ach.add('style:' + k);
    return true;
  };
  S.addXp = function (k, n) {
    const s = st()[k];
    if (!s || s.lv >= MAX) return;
    s.xp += n;
    while (s.lv < MAX && s.xp >= need(s.lv)) {
      s.xp -= need(s.lv); s.lv++;
      const D = S.DEF[k], t = D.techs.find((x) => x.lv === s.lv);
      G.UI.banner(`${D.icon} ${D.name} nivel ${s.lv}`, t ? `Nueva técnica: <kbd>${D.techs.indexOf(t) ? 'R' : 'Z'}</kbd> ${t.name}` : 'Tus golpes son más fuertes');
      G.Audio.play('day');
      if (G.Ach) { const prev = G.Profile.cnt('stylelv:' + k); if (s.lv > prev) G.Ach.add('stylelv:' + k, s.lv - prev); }
    }
  };

  // Estilo del arma que llevas en la mano (o Luchador con las manos vacías)
  S.styleOf = function (id) {
    const it = id && G.ITEMS[id];
    if (!id) return 'fist';
    return it && it.style ? it.style : null;
  };
  S.active = function () { const k = S.styleOf(G.Inv.heldId()); return k && S.learned(k) ? k : null; };

  // ------------------------------------------------------------------ objetivos (rayo desde la mirada)
  function raySphere(o, d, cx, cy, cz, r) {
    const ox = cx - o.x, oy = cy - o.y, oz = cz - o.z, t = ox * d.x + oy * d.y + oz * d.z, c2 = ox * ox + oy * oy + oz * oz;
    if (c2 < r * r) return 0;
    if (t < 0) return -1;
    const d2 = c2 - t * t;
    return d2 > r * r ? -1 : t - Math.sqrt(r * r - d2);
  }
  const hostile = (c) => !c.dead && !(c.d.friendly) && !(c.d.npc && !(G.Story && G.Story.tribeHostile())) && !G.Faction.friendly(c);
  // Primer objetivo en la línea de tiro: criaturas y (en versus) jugadores rivales
  function rayHit(o, d, range, pad = 0.3) {
    let best = null, bt = range;
    G.Creatures.forEachAlive((c) => { if (!hostile(c)) return; const t = G.Creatures.rayHit(c, o, d, pad); if (t >= 0 && t < bt) { bt = t; best = { c, t }; } });
    for (const p of G.Net.peers.values()) {
      if (p.dead || !G.Modes.canHurtPeer(p)) continue;
      const t = raySphere(o, d, p.x, p.y + 1, p.z, 0.6 + pad);
      if (t >= 0 && t < bt) { bt = t; best = { p, t }; }
    }
    // El terreno corta el disparo
    for (let t = 1; t < bt; t += 1) if (o.y + d.y * t < G.height(o.x + d.x * t, o.z + d.z * t)) return { ground: true, t };
    return best ? best : { t: range };
  }
  function near(x, z, r, fn) { G.Creatures.forEachAlive((c) => { if (hostile(c) && Math.hypot(c.x - x, c.z - z) < r + c.d.hitR) fn(c); }); }
  function nearPeers(x, z, r, fn) { for (const p of G.Net.peers.values()) if (!p.dead && G.Modes.canHurtPeer(p) && Math.hypot(p.x - x, p.z - z) < r) fn(p); }
  // Daño con experiencia para el estilo (y un extra al acabar con algo)
  function hitC(c, dmg, k, extra) {
    const was = c.dead;
    G.Creatures.hurt(c, dmg, undefined, extra);
    if (c.d.dummy) { if (G.Prologue) G.Prologue.onTrain(c, k); if (G.Styles.learned(k)) S.addXp(k, 1); return; }
    S.addXp(k, 1);
    if (!was && c.dead) S.addXp(k, 4);
  }
  function hitP(p, dmg, cause, melee, z) {
    G.Net.send({ t: 'dmgP', to: p.id, amt: dmg, cause, sx: G.Player.pos.x, sz: G.Player.pos.z, by: G.Net.myId, mel: melee ? 1 : 0, zn: z ? z.zone : undefined, zs: z ? z.side : undefined });
    G.Audio.play('hit');
    if (z && p.model && p.model.react) p.model.react(z.zone, z.side, 1);
    G.Combat.hitNum(p.x, p.y + 2, p.z, dmg, z ? z.zone : 'torso');
  }
  // Golpe cuerpo a cuerpo: el daño depende de la zona del cuerpo (combat.js); se puede parar (parry.js) salvo
  // si es un contraataque, que hace el doble. Muestra el daño que hace de verdad (si lo para, no hay número).
  function melee(c, dmg, k) {
    const z = G.Combat.zoneFor({ kind: 'creature', c }), rip = G.Parry.riposteOn(c.id), d = dmg * z.mul * (rip ? 2 : 1);
    const hp0 = c.hp;
    hitC(c, d, k, { melee: true, riposte: rip, zone: z.zone, side: z.side });
    const a = G.Creatures.aimPoint(c);
    if (c.d.dummy || !G.Net.authority() || c.hp < hp0 || c.dead) { G.Combat.hitNum(a.x, a.y + 0.9, a.z, c.d.dummy || !G.Net.authority() ? d : hp0 - Math.max(0, c.hp), z.zone, rip ? 'crit' : null, c.d.dummy); G.Combat.impact(a.x, a.y, a.z, false); }
    return rip;
  }
  const meleeP = (p, dmg, cause) => { const z = G.Combat.zoneFor({ kind: 'peer', p }); hitP(p, dmg * z.mul * (G.Parry.riposteOn('p' + p.id) ? 2 : 1), cause, true, z); G.Combat.impact(p.x, p.y + 1.1, p.z, false); };

  // ------------------------------------------------------------------ ataque normal (clic)
  // it: objeto en la mano (o null), tg: objetivo del rayo. Devuelve true si lo gestionó el estilo.
  S.attack = function (it, tg) {
    const P = G.Player, id = G.Inv.heldId(), k = S.styleOf(id);
    if (!k) return false;
    const learned = S.learned(k);
    if (k === 'gun') {
      if (!learned) { G.UI.msg('No sabes disparar esta arma. Pídele a <b>Crane</b>, el artillero de tu tripulación, que te enseñe.', 'warn', 'nogun'); P.cd = 0.5; return true; }
      shoot(it, 1, 0);
      return true;
    }
    if (k === 'magic') {
      if (!learned) return false; // sin saber magia, el bastón es un palo
      if (S.mana < 6) { G.UI.msg('🔮 Sin maná. Espera a que se recupere.', 'warn', 'mana'); P.cd = 0.3; return true; }
      S.mana -= 6; P.cd = 0.45; P.swing = 1; P.swingCount++;
      orb();
      return true;
    }
    if (!learned) return false;
    const mul = S.mul(k) * (G.Story ? G.Story.meleeMul() : 1);
    if (k === 'sword') {
      // Combo de 4: tajo, revés, de arriba y una estocada final más fuerte que empuja
      const cm = G.Combat.comboStep();
      P.cd = cm.fin ? 0.55 : 0.3; P.swing = 1; P.swingCount++;
      G.Audio.play('swing');
      G.Combat.trail(cm.n);
      const base = ((it && it.dmg) || 14) * cm.mul;
      if (tg && tg.kind === 'creature' && hostile(tg.c)) { melee(tg.c, base * mul, 'sword'); if (cm.fin) G.Combat.knock(tg.c, 1.4); G.Inv.wear(1); }
      else if (tg && tg.kind === 'peer' && G.Modes.canHurtPeer(tg.p)) { meleeP(tg.p, base * mul * 0.8, `${G.Net.name} te derrotó con su espada`); S.addXp('sword', 1); }
      else if (tg && tg.kind === 'res' && tg.r.k.tree) G.Res.hit(tg.r, { id: 'hacha', n: 1 }); // corta árboles (como un hacha de piedra)
      return true;
    }
    if (k === 'fist') {
      if (tg && !['creature', 'peer'].includes(tg.kind)) return false; // sin enemigo delante: golpe normal (recoger, romper…)
      S.combo = (S.combo + 1) % 3;
      P.cd = S.combo === 0 ? 0.5 : 0.28; P.swing = 1; P.swingCount++;
      P.swingDir = S.combo === 0 ? 3 : S.combo === 1 ? 0 : 1;
      G.Combat.trailAt(P.pos.x, P.pos.y + 1.25, P.pos.z, P.yaw, P.swingDir, false, 0xffc090);
      G.Audio.play('swing');
      const dmg = (S.combo === 0 ? 13 : 7) * mul;
      if (tg && tg.kind === 'creature' && hostile(tg.c)) {
        melee(tg.c, dmg, 'fist');
        if (S.combo === 0) knock(tg.c, 1.4);
      } else if (tg && tg.kind === 'peer' && G.Modes.canHurtPeer(tg.p)) { meleeP(tg.p, dmg * 0.8, `${G.Net.name} te noqueó`); S.addXp('fist', 1); }
      return true;
    }
    return false;
  };

  // ------------------------------------------------------------------ técnicas (Q y Z)
  S.tech = function (i) {
    const k = S.active();
    const P = G.Player;
    if (G.Parry.stagger > 0) return; // aturdido: te pararon el golpe
    if (!k) {
      const k2 = S.styleOf(G.Inv.heldId());
      if (k2 && !S.learned(k2)) G.UI.msg(`Aún no conoces el estilo ${S.DEF[k2].name}. Busca a ${S.DEF[k2].master} en la Isla Perdida.`, 'info', 'tech');
      else if (!S.any()) G.UI.msg('Aún no conoces ningún estilo de combate. Tu tripulación y el ermitaño de la isla pueden enseñarte.', 'info', 'tech');
      else G.UI.msg('Equípate el arma de tu estilo (o deja las manos vacías para el Luchador) para usar sus técnicas.', 'info', 'tech');
      return;
    }
    const D = S.DEF[k], T = D.techs[i];
    if (S.level(k) < T.lv) { G.UI.msg(`${T.name} se aprende en el nivel ${T.lv} de ${D.name}.`, 'info', 'tech'); return; }
    if (S.cd[k][i] > 0) { G.UI.msg(`${T.name}: ${Math.ceil(S.cd[k][i])} s`, 'warn', 'tech'); return; }
    if (T.mana && S.mana < T.mana) { G.UI.msg('🔮 No tienes suficiente maná.', 'warn', 'mana'); return; }
    if (P.dead || G.state.mode !== 'playing') return;
    const mul = S.mul(k);
    const o = P.eyePos(new V3()), d = P.lookDir(new V3());
    let ok = true;
    if (k === 'sword' && i === 0) slashWave(o, d, 26 * mul);
    else if (k === 'sword' && i === 1) {
      P.swing = 1; P.swingCount++;
      ring(P.pos.x, P.pos.y + 0.9, P.pos.z, 0xdff4ff, 3.8, 0.35, false);
      near(P.pos.x, P.pos.z, 3.6, (c) => { hitC(c, 30 * mul, 'sword'); knock(c, 1.5); });
      nearPeers(P.pos.x, P.pos.z, 3.6, (p) => hitP(p, 22 * mul, `El torbellino de ${G.Net.name}`));
      G.Audio.play('swing'); setTimeout(() => G.Audio.play('swing'), 120);
    } else if (k === 'gun' && i === 0) ok = shoot(G.ITEMS[G.Inv.heldId()], 2.6, 0);
    else if (k === 'gun' && i === 1) {
      if (G.Inv.count('bala') < 3) { G.UI.msg('La ráfaga necesita 3 balas.', 'warn', 'ammo'); return; }
      ok = shoot(G.ITEMS[G.Inv.heldId()], 1, -0.07);
      if (ok) { setTimeout(() => shoot(G.ITEMS[G.Inv.heldId()] || {}, 1, 0, true), 110); setTimeout(() => shoot(G.ITEMS[G.Inv.heldId()] || {}, 1, 0.07, true), 220); }
    } else if (k === 'fist' && i === 0) {
      P.swing = 1; P.swingCount++;
      const f = new V3(d.x, 0, d.z).normalize();
      const cx = P.pos.x + f.x * 2, cz = P.pos.z + f.z * 2;
      ring(cx, P.pos.y + 0.4, cz, 0xffc090, 2.8, 0.3, true);
      G.Ships.puff(cx, P.pos.y + 0.2, cz, 0xd8c8a8, 3, 0.4, 5);
      near(cx, cz, 2.4, (c) => { hitC(c, 22 * mul, 'fist'); knock(c, 3.5, P.pos); });
      nearPeers(cx, cz, 2.4, (p) => hitP(p, 16 * mul, `La patada huracán de ${G.Net.name}`));
      G.Audio.play('swing');
    } else if (k === 'fist' && i === 1) {
      const f = new V3(d.x, 0, d.z).normalize();
      P.vel.set(f.x * 15, 6, f.z * 15); P.onGround = false;
      G.Audio.play('swing');
      setTimeout(() => {
        const x = P.pos.x, z = P.pos.z;
        ring(x, P.pos.y + 0.2, z, 0xffc090, 3.2, 0.35, true);
        G.Ships.puff(x, P.pos.y, z, 0xd8c8a8, 4, 0.5, 7);
        near(x, z, 2.8, (c) => { hitC(c, 32 * mul, 'fist'); knock(c, 2, P.pos); });
        nearPeers(x, z, 2.8, (p) => hitP(p, 24 * mul, `El salto del tigre de ${G.Net.name}`));
        G.Audio.play('rockbreak'); P.shake = 0.3;
      }, 380);
    } else if (k === 'magic' && i === 0) {
      const h = rayHit(o, d, 28, 1.2);
      const ap = h.c ? G.Creatures.aimPoint(h.c) : null;
      const x = ap ? ap.x : h.p ? h.p.x : o.x + d.x * h.t, z = ap ? ap.z : h.p ? h.p.z : o.z + d.z * h.t;
      const y = ap ? ap.y : h.p ? h.p.y + 1 : G.height(x, z);
      bolt(x, y, z);
      if (h.c) { hitC(h.c, 38 * mul, 'magic'); h.c.frozen = Math.max(h.c.frozen || 0, 0.8); }
      if (h.p) hitP(h.p, 28 * mul, `Un rayo de ${G.Net.name}`);
      near(x, z, 2, (c) => { if (c !== h.c) hitC(c, 14 * mul, 'magic'); });
    } else if (k === 'magic' && i === 1) {
      const heal = 32 + S.level('magic') * 3;
      P.stats.health = Math.min(100, P.stats.health + heal); P.poison = 0; P.sick = 0;
      for (const p of G.Net.peers.values()) if (!p.dead && Math.hypot(p.x - P.pos.x, p.z - P.pos.z) < 7 && (!G.Modes.active || p.team === G.Net.team)) G.Net.send({ t: 'heal', to: p.id, amt: heal, from: G.Net.name });
      ring(P.pos.x, P.pos.y + 0.1, P.pos.z, 0x6fe0c0, 7, 0.9, true);
      G.Ships.puff(P.pos.x, P.pos.y + 1, P.pos.z, 0x7fffd0, 3, 1.2, 8);
      G.UI.msg(`🌊 Marea curativa: ❤️+${heal}`, 'good');
      G.Audio.play('mono');
      S.addXp('magic', 3);
    }
    if (!ok) return;
    S.cd[k][i] = T.cd;
    if (T.mana) S.mana -= T.mana;
    if (G.Ach) G.Ach.add('tech');
  };

  // ------------------------------------------------------------------ disparos y proyectiles
  function shoot(it, mulDmg, spread, free) {
    const P = G.Player, g = it && it.gun;
    if (!g) return false;
    if (!free) {
      if (P.reload > 0) { G.UI.msg('Recargando…', 'warn', 'reload'); return false; }
      if (G.Inv.count('bala') <= 0) { G.UI.msg('No tienes balas. Fabrícalas en el horno con hierro y pólvora.', 'warn', 'ammo'); G.Audio.play('error'); return false; }
    }
    G.Inv.remove('bala', 1);
    if (!free) { P.reload = g.reload; P.cd = 0.25; }
    P.swing = 0.4; P.shake = Math.max(P.shake, 0.12);
    const o = P.eyePos(new V3()), d = P.lookDir(new V3());
    if (spread) d.applyAxisAngle(new V3(0, 1, 0), spread);
    const h = rayHit(o, d, g.range, 0.15);
    const end = o.clone().addScaledVector(d, h.t);
    const muzzle = o.clone().addScaledVector(d, 0.8).add(new V3(Math.cos(P.yaw) * 0.25, -0.2, -Math.sin(P.yaw) * 0.25));
    tracer(muzzle, end);
    G.Ships.puff(muzzle.x, muzzle.y, muzzle.z, 0xd8d0c0, 0.6, 0.4, 2);
    G.Audio.play('cannon', 0.35);
    const mul = S.mul('gun') * mulDmg;
    if (h.c) {
      const z = G.Combat.zoneFor({ kind: 'creature', c: h.c }), d = g.dmg * mul * z.mul;
      hitC(h.c, d, 'gun', { zone: z.zone, side: z.side }); spark(end.x, end.y, end.z, 0xffd080);
      G.Combat.hitNum(end.x, end.y + 0.5, end.z, d, z.zone, null, h.c.d.dummy);
    } else if (h.p) { const z = G.Combat.zoneFor({ kind: 'peer', p: h.p }); hitP(h.p, g.dmg * mul * 0.8 * z.mul, `Un disparo de ${G.Net.name}`, false, z); }
    else G.Ships.puff(end.x, end.y, end.z, 0xc8b898, 0.8, 0.3, 2);
    G.Inv.wear(1);
    return true;
  }
  const addMat = (color, opacity = 0.9) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  function fx(o, life, upd) { G.scene.add(o); S.fx.push({ o, t: 0, life, upd }); }
  function tracer(a, b) {
    const len = a.distanceTo(b);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, len, 4), addMat(0xffe0a0, 0.9));
    m.position.copy(a).lerp(b, 0.5);
    m.quaternion.setFromUnitVectors(new V3(0, 1, 0), b.clone().sub(a).normalize());
    fx(m, 0.09, (f, k) => { f.o.material.opacity = 0.9 * (1 - k); });
  }
  function spark(x, y, z, color) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.Build.smokeTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.position.set(x, y, z); s.raycast = () => {};
    fx(s, 0.22, (f, k) => { f.o.scale.setScalar(0.5 + k * 1.4); f.o.material.opacity = 1 - k; });
  }
  // Anillo de energía (plano en el suelo o de pie mirando hacia delante)
  function ring(x, y, z, color, size, life, flat) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.75, 1, 40), addMat(color, 0.8));
    m.position.set(x, y, z);
    m.rotation.x = -Math.PI / 2;
    fx(m, life, (f, k) => { f.o.scale.setScalar(0.3 + k * size); f.o.material.opacity = 0.85 * (1 - k); });
  }
  // Onda cortante del espadachín: media luna que vuela hacia delante y corta lo que atraviesa
  function slashWave(o, d, dmg) {
    const P = G.Player;
    P.swing = 1; P.swingCount++;
    const m = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.25, 28, 1, Math.PI * 0.15, Math.PI * 0.7), addMat(0xe6f6ff, 0.9));
    const pos = o.clone().addScaledVector(d, 1.2); pos.y -= 0.25;
    m.position.copy(pos);
    m.lookAt(pos.clone().add(d));
    m.rotateZ(-0.35);
    const hit = new Set();
    G.scene.add(m);
    S.proj.push({ o: m, pos, vel: d.clone().multiplyScalar(22), life: 0.75, t: 0, upd(p, dt) {
      p.o.material.opacity = 0.9 * (1 - p.t / p.life);
      p.o.scale.setScalar(1 + p.t * 1.2);
      G.Creatures.forEachAlive((c) => {
        if (!hostile(c) || hit.has(c)) return;
        if (G.Creatures.near(c, p.pos.x, p.pos.y, p.pos.z, 1.3, 2.2)) { hit.add(c); hitC(c, dmg, 'sword'); spark(p.pos.x, p.pos.y, p.pos.z, 0xdff4ff); }
      });
      for (const pr of G.Net.peers.values()) if (!hit.has(pr) && !pr.dead && G.Modes.canHurtPeer(pr) && Math.hypot(pr.x - p.pos.x, pr.z - p.pos.z) < 1.4) { hit.add(pr); hitP(pr, dmg * 0.8, `El corte volador de ${G.Net.name}`); }
      if (p.pos.y < G.height(p.pos.x, p.pos.z) - 0.3) p.t = p.life;
    } });
    G.Audio.play('swing');
    setTimeout(() => G.Audio.play('sail', 0.6), 60);
  }
  // Chispa arcana del brujo: esfera de luz violeta
  function orb() {
    const P = G.Player, o = P.eyePos(new V3()), d = P.lookDir(new V3());
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.Build.smokeTex, color: 0xb88aff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.scale.setScalar(0.7);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), addMat(0xf0e0ff, 1));
    s.add(core);
    const pos = o.clone().addScaledVector(d, 0.9).add(new V3(Math.cos(P.yaw) * 0.2, -0.15, -Math.sin(P.yaw) * 0.2));
    s.position.copy(pos);
    G.scene.add(s);
    const dmg = 13 * S.mul('magic');
    S.proj.push({ o: s, pos, vel: d.clone().multiplyScalar(28), life: 1.2, t: 0, upd(p) {
      p.o.material.rotation += 0.3;
      let hitAny = null;
      G.Creatures.forEachAlive((c) => { if (!hitAny && hostile(c) && G.Creatures.near(c, p.pos.x, p.pos.y, p.pos.z, 0.4, c.d.hitR + 0.8)) hitAny = c; });
      if (hitAny) { hitC(hitAny, dmg, 'magic'); spark(p.pos.x, p.pos.y, p.pos.z, 0xb88aff); p.t = p.life; return; }
      for (const pr of G.Net.peers.values()) if (!pr.dead && G.Modes.canHurtPeer(pr) && Math.hypot(pr.x - p.pos.x, pr.z - p.pos.z) < 0.8 && Math.abs(pr.y + 1 - p.pos.y) < 1.2) { hitP(pr, dmg * 0.8, `La magia de ${G.Net.name}`); p.t = p.life; return; }
      if (p.pos.y < G.height(p.pos.x, p.pos.z)) { spark(p.pos.x, p.pos.y + 0.2, p.pos.z, 0xb88aff); p.t = p.life; }
    } });
    G.Audio.play('plop');
  }
  // Rayo del brujo: línea quebrada del cielo al objetivo y un destello
  function bolt(x, y, z) {
    const pts = [], top = y + 22;
    for (let i = 0; i <= 10; i++) { const k = i / 10; pts.push(new V3(x + (i && i < 10 ? (Math.random() - 0.5) * 1.6 : 0), U.lerp(top, y, k), z + (i && i < 10 ? (Math.random() - 0.5) * 1.6 : 0))); }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const l = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xe8f0ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    fx(l, 0.35, (f, k) => { f.o.material.opacity = k < 0.5 ? 1 : 2 * (1 - k); });
    const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 22, 6, 1, true), addMat(0x9fb8ff, 0.35));
    glow.position.set(x, y + 11, z);
    fx(glow, 0.3, (f, k) => { f.o.material.opacity = 0.35 * (1 - k); });
    spark(x, y, z, 0xcfe0ff);
    G.Ships.puff(x, y, z, 0xb8c8ff, 2, 0.8, 5);
    G.Audio.play('thunder');
    G.Player.shake = Math.max(G.Player.shake, 0.15);
  }
  function knock(c, dist, from) {
    if (!G.Net.authority() || c.type === 'boss' || c.type === 'whale' || c.type === 'serpent' || c.type === 'pirate_boss') return;
    const src = from || G.Player.pos, dx = c.x - src.x, dz = c.z - src.z, dd = Math.hypot(dx, dz) || 1;
    const nx = c.x + dx / dd * dist, nz = c.z + dz / dd * dist;
    if (G.height(nx, nz) > 0.3) { c.x = nx; c.z = nz; }
  }

  // ------------------------------------------------------------------ bucle: enfriamientos, maná, proyectiles, efectos y HUD
  let hudT = 0;
  S.update = function (dt) {
    const P = G.Player;
    for (const k in S.cd) for (let i = 0; i < 2; i++) S.cd[k][i] = Math.max(0, S.cd[k][i] - dt);
    P.reload = Math.max(0, (P.reload || 0) - dt);
    if (S.learned('magic')) S.mana = Math.min(100, S.mana + dt * (5 + S.level('magic') * 0.5));
    for (let i = S.proj.length - 1; i >= 0; i--) {
      const p = S.proj[i];
      p.t += dt;
      p.pos.addScaledVector(p.vel, dt);
      p.o.position.copy(p.pos);
      p.upd(p, dt);
      if (p.t >= p.life) { G.scene.remove(p.o); p.o.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); S.proj.splice(i, 1); }
    }
    updateFx(dt);
    hudT -= dt;
    if (hudT <= 0) { hudT = 0.1; hud(); }
  };
  function updateFx(dt) {
    for (let i = S.fx.length - 1; i >= 0; i--) {
      const f = S.fx[i];
      f.t += dt;
      const k = Math.min(1, f.t / f.life);
      if (f.upd) f.upd(f, k);
      if (k >= 1) { G.scene.remove(f.o); if (f.o.geometry) f.o.geometry.dispose(); if (f.o.material) f.o.material.dispose(); S.fx.splice(i, 1); }
    }
  }
  S.clear = function () {
    for (const p of S.proj) G.scene.remove(p.o);
    for (const f of S.fx) G.scene.remove(f.o);
    S.proj.length = 0; S.fx.length = 0; S.mana = 100;
    for (const k in S.cd) S.cd[k] = [0, 0];
  };
  S.tracer = tracer;
  S.spark = spark;
  S.onNet = function (m) {
    if (m.t === 'heal' && m.to === G.Net.myId && !G.Player.dead) {
      G.Player.stats.health = Math.min(100, G.Player.stats.health + m.amt);
      G.UI.msg(`🌊 ${G.Net.esc(m.from)} te cura: ❤️+${Math.round(m.amt)}`, 'good');
    }
  };

  function hud() {
    const el = $('styleHud');
    if (!el) return;
    const k = S.active(), inGame = ['playing', 'inventory', 'map'].includes(G.state.mode);
    el.classList.toggle('hidden', !k || !inGame);
    if (!k) return;
    const D = S.DEF[k], s = st()[k];
    const techs = D.techs.map((t, i) => {
      const lock = s.lv < t.lv, cd = S.cd[k][i];
      return `<span class="st-tech${lock ? ' lock' : cd > 0 ? ' cd' : ''}"><kbd>${i ? 'R' : 'Z'}</kbd>${t.name}${lock ? ` <small>nv ${t.lv}</small>` : cd > 0 ? ` <small>${Math.ceil(cd)}s</small>` : ''}</span>`;
    }).join('');
    const xp = s.lv >= MAX ? 1 : s.xp / need(s.lv);
    const ammo = k === 'gun' ? ` · <span title="Balas">⚫ ${G.Inv.count('bala')}</span>${G.Player.reload > 0 ? ' <small>recargando…</small>' : ''}` : '';
    el.style.setProperty('--sc', D.color);
    el.innerHTML = `<div class="st-top">${D.icon} <b>${D.name}</b> <span>Nv ${s.lv}</span>${ammo}</div><div class="st-xp"><i style="width:${xp * 100}%"></i></div>` +
      (k === 'magic' ? `<div class="st-mana"><i style="width:${S.mana}%"></i></div>` : '') + `<div class="st-techs">${techs}</div>`;
  }
})();
