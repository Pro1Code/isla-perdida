// Lógica de juego: objetivo del rayo, acciones, fabricación, sueño (por isla), muerte, objetivos y nueva partida
(function () {
  'use strict';
  const G = window.G, U = G.U;
  const V3 = THREE.Vector3;
  const Game = (G.Game = { target: null });
  G.DIFFS = [
    { name: 'Fácil', decay: 0.7, dmg: 0.6, wolves: 1 },
    { name: 'Normal', decay: 1.0, dmg: 1.0, wolves: 2 },
    { name: 'Difícil', decay: 1.35, dmg: 1.4, wolves: 4 },
  ];
  G.state = { mode: 'loading', day: 1, t: 0.3, diff: 1, dayLen: 600, spawn: null, flags: {}, stats: { kills: 0, crafted: 0, deaths: 0, k: {} }, obj: 0 };
  // Estadísticas de la partida (muertes y animales cazados por tipo, para algunos logros)
  const fixStats = (s) => Object.assign({ kills: 0, crafted: 0, deaths: 0 }, s || {}, { k: Object.assign({}, (s && s.k) || {}) });
  Game.fixStats = fixStats;
  Game.diff = () => G.DIFFS[G.state.diff] || G.DIFFS[1];
  Game.hour = () => G.state.t * 24;
  Game.isNight = () => { const h = Game.hour(); return h >= 20 || h < 5.5; };
  Game.nearFire = () => { const f = G.Build.nearestLitFire(G.Player.pos.x, G.Player.pos.z); return !!f && f.d < 4.5; };
  Game.nearStation = (st) => {
    if (!st || (G.Cheats && G.Cheats.flag('free'))) return true;
    if (st === 'fire') return Game.nearFire();
    const P = G.Player.pos;
    return G.Build.list.some((s) => s.type === st && Math.hypot(s.x - P.x, s.z - P.z) < 4);
  };
  Game.sheltered = () => G.Build.hasRoof(G.Player.pos.x, G.Player.pos.z) || G.Landmarks.inCave(G.Player.pos.x, G.Player.pos.z) || G.Landmarks.underRoof(G.Player.pos.x, G.Player.pos.z);
  Game.newWorldState = () => ({ loot: {}, bossKilled: false, story: null });

  Game.give = function (id, n) {
    const added = G.Inv.add(id, n);
    if (added > 0) G.UI.msg(`+${added} ${G.icon(id, 'xs')} ${G.ITEMS[id].n}`, 'item');
    if (added > 0 && G.Ach) G.Ach.add('get:' + id, added, true);
    if (added > 0 && id.startsWith('pista_') && G.Prologue) G.Prologue.onItem(id);
    if (added < n) {
      if (G.Drops && G.Drops.spill) { G.Drops.spill(id, n - added); G.UI.msg(`🎒 ¡Inventario lleno! ${n - added} ${G.icon(id, 'xs')} ${G.ITEMS[id].n} quedan en el suelo.`, 'warn', 'full'); }
      else G.UI.msg('¡Inventario lleno!', 'bad', 'full');
    }
    return added;
  };

  // ------------------------------------------------------------------ objetivo del rayo
  const _o = new V3(), _d = new V3(), _rc = new THREE.Raycaster();
  function raySphere(o, d, cx, cy, cz, r) {
    const ox = cx - o.x, oy = cy - o.y, oz = cz - o.z;
    const t = ox * d.x + oy * d.y + oz * d.z;
    const c2 = ox * ox + oy * oy + oz * oz;
    if (c2 < r * r) return 0;
    if (t < 0) return -1;
    const d2 = c2 - t * t;
    if (d2 > r * r) return -1;
    return t - Math.sqrt(r * r - d2);
  }
  Game.findTarget = function () {
    const P = G.Player;
    const o = P.eyePos(_o), d = P.lookDir(_d);
    const reach = 3.4;
    let best = null, bt = 99;
    G.Res.query(P.pos.x, P.pos.z, 6, (r) => {
      if (!r.alive) return;
      const k = r.k;
      if (k.bush && !r.berries) return;
      const t = raySphere(o, d, r.x, r.y + k.focusY * r.s, r.z, k.hitR * r.s);
      if (t >= 0 && t < bt && t < reach + (k.tool ? 0.6 : 0)) { bt = t; best = { kind: 'res', r, t }; }
    });
    const held = G.Inv.held();
    const wreach = held && G.ITEMS[held.id].reach ? G.ITEMS[held.id].reach : reach;
    G.Creatures.forEachAlive((c) => {
      const t = G.Creatures.rayHit(c, o, d);
      if (t >= 0 && t < bt && t < wreach + 0.4) { bt = t; best = { kind: 'creature', c, t }; }
    });
    // En 3ª persona (por detrás o frontal), si no apuntas a nada que pelee, el golpe va al enemigo que tienes
    // delante (±40°) y a tu alcance, si está peleando contigo
    if (P.cam !== 'fp' && !P.ship && !(best && best.kind === 'creature')) {
      let ab = null, ad = wreach + 0.5;
      G.Creatures.forEachAlive((c) => {
        if (!(c.aggro > 0) || !c.d.dmg || c.d.friendly || c.d.dummy || G.Faction.friendly(c) || (c.d.npc && !G.Story.tribeHostile())) return;
        const dx = c.x - P.pos.x, dz = c.z - P.pos.z, dd = Math.hypot(dx, dz) - c.d.hitR * 0.6;
        if (dd > ad || Math.abs(c.y - P.pos.y) > 2.2) return;
        if (Math.abs(U.angDiff(Math.atan2(-dx, -dz), P.yaw)) > 0.7) return;
        ad = dd; ab = c;
      });
      if (ab && (!best || best.kind === 'res' || best.kind === 'water' || best.t > ad)) { bt = Math.max(0, ad); best = { kind: 'creature', c: ab, t: bt }; }
    }
    for (const p of G.Net.peers.values()) {
      if (p.dead) continue;
      // Cuerpo y cabeza (para poder acertar a la cabeza)
      const tb = raySphere(o, d, p.x, p.y + (p.swim ? 0.3 : 1.0), p.z, 0.6), th = p.swim ? -1 : raySphere(o, d, p.x, p.y + 1.68, p.z, 0.22);
      const t = tb < 0 ? th : th < 0 ? tb : Math.min(tb, th);
      if (t >= 0 && t < bt && t < wreach + 0.4) { bt = t; best = { kind: 'peer', p, t }; }
    }
    for (const c of G.Landmarks.loot) {
      if (c.noTarget || (c.opened && (c.kind === 'barrel' || c.kind === 'bottle' || c.kind === 'bag'))) continue;
      if (c.kind === 'clue' && !G.Prologue.visible(c)) continue;
      const t = raySphere(o, d, c.x, c.y + 0.35, c.z, c.hitR || 0.65);
      if (t >= 0 && t < bt && t < reach + (c.kind === 'mono' ? 0.8 : 0)) { bt = t; best = { kind: 'loot', c, t }; }
    }
    // Hojas de encargos clavadas en los tablones de las aldeas
    const qp = G.Quests.findTarget(o, d);
    if (qp && qp.t < bt) { bt = qp.t; best = qp; }
    if (G.Build.list.length) {
      _rc.set(o, d); _rc.far = 4.2; _rc.camera = G.camera;
      const groups = [];
      for (const s of G.Build.list) if (Math.abs(s.x - P.pos.x) < 8 && Math.abs(s.z - P.pos.z) < 8) groups.push(s.group);
      const hits = _rc.intersectObjects(groups, true).filter((h) => !h.object.isSprite);
      if (hits.length && hits[0].distance < bt) { bt = hits[0].distance; best = { kind: 'struct', s: hits[0].object.userData.struct, t: bt }; }
    }
    if (G.Ships) {
      const sb = G.Ships.findTarget(o, d, best);
      if (sb && sb !== best && (!best || sb.kind === 'station' || sb.t < bt)) { best = sb; bt = sb.t; }
    }
    if (G.Modes.active) { const vt = G.Modes.findTarget(P.pos); if (vt && (!best || best.kind === 'water')) best = vt; }
    if (!best && !P.diving) {
      for (let t = 0.4; t <= 3.6; t += 0.2) {
        if (t > bt) break;
        const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
        const wl = G.World.waterLevelAt(x, z);
        if (G.height(x, z) < wl - 0.05 && y <= wl + 0.15) { best = { kind: 'water', lake: wl > 0.5, t }; break; }
      }
    }
    return best;
  };

  function hpBar(v, max) { return `<span class="hp"><i style="width:${U.clamp(v / max, 0, 1) * 100}%"></i></span>`; }
  Game.promptFor = function (tg) {
    if (!tg) return '';
    const hid = G.Inv.heldId();
    if (tg.kind === 'res') {
      const r = tg.r, k = r.k;
      if (k.tool) {
        const it = hid ? G.ITEMS[hid] : null, pw = it && it.toolType === k.tool ? it.power || 1 : 0;
        const ok = pw >= (k.minPower || 1);
        const need = k.minPower > 1 ? 'un pico de hierro' : k.tool === 'hacha' ? 'un hacha' : 'un pico';
        return `<b>${k.name}</b> · ` + (ok ? `<kbd>Clic</kbd> ${k.tree ? 'Talar' : 'Picar'}` : `<span class="warn">Necesitas ${need}</span>`) + (r.hp < k.hp ? hpBar(r.hp, k.hp) : '');
      }
      if (k.bush) return `<kbd>E</kbd> Recoger ${k.gives[0][0] === 'cacao' ? 'cacao' : 'bayas'}`;
      return `<kbd>E</kbd> Recoger ${k.name.toLowerCase()}`;
    }
    if (tg.kind === 'creature') {
      const c = tg.c;
      if (c.d.npc) return `<b>${c.name}</b>${c.role === 'chief' ? ' (jefe)' : c.role === 'trader' ? ' (comerciante)' : ''} · <kbd>E</kbd> Hablar`;
      if (c.d.dummy) { const D = G.Prologue.DUMMIES[c.extra % G.Prologue.DUMMIES.length], S = G.Styles.DEF[D.style]; return `<b>${c.name}</b> · <kbd>Clic</kbd> Entrenar <span class="muted">(${S.icon} ${S.name})</span>`; }
      return `<b>${c.d.name}</b> · <kbd>Clic</kbd> Atacar ${hpBar(c.hp, c.d.hp)}`;
    }
    if (tg.kind === 'peer') {
      const p = tg.p;
      let t = `<b style="color:${G.Net.esc(p.color)}">${G.Net.esc(p.name)}</b>`;
      if (p.sinking) t += ' · 🛟 <kbd>E</kbd> ¡Rescatar!';
      else if (G.Duel.available()) t += ' · ' + G.Duel.promptFor(p);
      if (G.Modes.active && p.team !== G.Net.team) t += ` · equipo ${G.Modes.teamName(p.team)}` + (G.Modes.canHurtPeer(p) ? ' · <kbd>Clic</kbd> Atacar' : '');
      return t;
    }
    if (tg.kind === 'struct') {
      const s = tg.s;
      let t = `<b>${G.ITEMS[s.type] ? G.ITEMS[s.type].n : s.type}</b>`;
      // Encender con el mechero (fogata apagada sin leña: además, 1 madera)
      const light = (wood) => G.Inv.count('mechero') ? `<kbd>E</kbd> Encender <span class="muted">(mechero${wood ? ' + 1 madera' : ''})</span>` : `<span class="warn">necesitas un 🔥 mechero${wood ? ' y 1 madera' : ''} para encenderla</span>`;
      if (s.type === 'fogata') {
        if (s.fuel > 0 && G.COOK[hid]) t += ` · <kbd>E</kbd> Cocinar ${G.ITEMS[hid].n.toLowerCase()}`;
        else t += s.fuel > 0 ? ` · 🔥 ${U.fmtSecs(s.fuel)} · <kbd>E</kbd> Añadir madera` : ' · apagada · ' + light(s.fuel === 0);
      }
      if (s.type === 'antorcha') {
        t += s.fuel > 0 ? (s.wet ? ` · 🌧️ se apaga en ${U.fmtSecs(s.fuel)}` : ' · 🔥') : ' · apagada · ' + light(false);
        if (!(G.Modes.active && s.team !== null && s.team !== G.Net.team)) return t + ' · <kbd>X</kbd> Recoger';
      }
      if (s.type === 'cama') t += ' · <kbd>E</kbd> Dormir';
      if (s.type === 'cofre') t += ' · <kbd>E</kbd> Abrir';
      if (s.type === 'horno') t += ' · Funde, forja y hace carbón (<kbd>Tab</kbd>)';
      if (s.type === 'banco') t += ' · Tablas, piezas y planos (<kbd>Tab</kbd>)';
      if (G.Modes.active && s.team !== null && s.team !== G.Net.team) return t + ` · equipo ${G.Modes.teamName(s.team)}` + (G.Modes.canHurtStruct(s, G.Net.myId) ? ` · <kbd>Clic</kbd> Destruir ${hpBar(s.hp, G.Build.MAXHP[s.type] || 100)}` : '');
      return t + ' · <kbd>X</kbd> Desmontar';
    }
    if (tg.kind === 'loot') {
      const c = tg.c;
      if (c.kind === 'clue') return c.prompt ? c.prompt() : '';
      if (c.kind === 'mono') return `🗿 <b>${c.name}</b> · <kbd>E</kbd> Examinar`;
      if (c.kind === 'bottle') return '🍾 <b>Botella con mensaje</b> · <kbd>E</kbd> Leer';
      if (c.kind === 'barrel') return `🛢️ <b>${c.name}</b> · <kbd>E</kbd> Abrir`;
      if (c.kind === 'bag') return '🎒 <b>Bolsa caída</b> · <kbd>E</kbd> Recoger';
      if (c.kind === 'chest') return `<b>${c.name}</b> · <kbd>E</kbd> Abrir${c.opened ? ' <span class="muted">(puedes guardar objetos)</span>' : ''}`;
      return c.opened ? `<b>${c.name}</b> · vacío` : `<b>${c.name}</b> · <kbd>E</kbd> Abrir`;
    }
    if (tg.kind === 'qpaper') return G.Quests.prompt(tg);
    if (['station', 'piece', 'ship'].includes(tg.kind)) return G.Ships.promptFor(tg);
    if (tg.kind.startsWith('vs')) return G.Modes.promptFor(tg);
    if (tg.kind === 'water') {
      if (tg.lake) return hid === 'cuenco' ? '<kbd>E</kbd> Llenar cuenco' : '<kbd>E</kbd> Beber agua dulce';
      return '<kbd>E</kbd> Beber agua de mar';
    }
    return '';
  };

  // ------------------------------------------------------------------ acciones
  Game.interact = function () {
    const P = G.Player, S = P.stats, hid = G.Inv.heldId();
    if (G.Story.dialog) { G.Story.choose(-1); return; }
    // Soltar el timón, el cañón o levantarse del asiento
    if (P.station) { G.Ships.releaseStation(); return; }
    // Encima de la ✖ de un mapa del tesoro: cavar
    if (G.Treasure.dig()) return;
    // Tu cofre flotando o ya desenterrado: recuperar las cosas
    if (G.Grave.interact()) return;
    const tg = Game.target;
    if (!tg) {
      // Recoger agua de lluvia con el cuenco
      if (hid === 'cuenco' && G.Weather.intensity > 0.3 && !Game.sheltered() && G.Weather.fallKind === 'rain') {
        G.Inv.consumeHeld(); Game.give('agua_limpia', 1); G.Audio.play('fill');
        G.UI.msg('🌧️ Recoges agua de lluvia: ¡es potable!', 'good');
        G.Ach.add('rain');
      }
      return;
    }
    if (tg.kind === 'qpaper') { G.Quests.click(tg); return; }
    if (tg.kind === 'loot') { Game.openLoot(tg.c); return; }
    if (tg.kind === 'res') { if (!tg.r.k.tool) G.Res.interact(tg.r); return; }
    if (tg.kind === 'creature') { if (tg.c.d.npc) G.Story.talk(tg.c); return; }
    if (tg.kind === 'peer') { if (tg.p.sinking) G.Story.rescue(tg.p); else if (G.Duel.available()) G.Duel.interact(tg.p); return; }
    if (['station', 'piece', 'ship'].includes(tg.kind)) { G.Ships.interact(tg); return; }
    if (tg.kind.startsWith('vs')) { G.Modes.interact(tg); return; }
    if (tg.kind === 'water') {
      if (tg.lake) {
        if (hid === 'cuenco') {
          G.Inv.consumeHeld();
          G.Inv.add('agua_sucia', 1);
          G.Audio.play('fill');
          G.UI.msg('Cuenco lleno de agua dulce. Hiérvela en una fogata.', 'info');
          return;
        }
        S.thirst = Math.min(100, S.thirst + 14);
        G.state.flags.lake = true;
        G.Audio.play('drink');
        if (Math.random() < 0.15) { P.sick = Math.max(P.sick, 20); G.UI.msg('El agua sin hervir te sentó mal… 🤢', 'bad'); }
        else G.UI.msg('💧 Bebes agua dulce.', 'info', 'drink');
      } else {
        S.thirst = Math.max(0, S.thirst - 8);
        P.damage(2, null, 'Beber agua de mar no fue buena idea');
        G.UI.msg('¡El agua salada te da más sed!', 'bad', 'salt');
      }
      return;
    }
    if (tg.kind === 'struct') {
      const s = tg.s;
      if (G.Modes.active && s.team !== null && s.team !== G.Net.team && s.type !== 'fogata') { G.UI.msg('Esto pertenece al equipo ' + G.Modes.teamName(s.team) + '.', 'warn', 'enemy'); if (s.type !== 'cofre') return; }
      if (s.type === 'fogata') {
        if (s.fuel > 0 && G.COOK[hid]) {
          const out = G.COOK[hid];
          if (hid === 'almeja' && G.Inv.count('almeja') < 2) { G.UI.msg('Necesitas 2 almejas.', 'warn'); return; }
          if (hid === 'almeja') G.Inv.remove('almeja', 1);
          G.Inv.consumeHeld();
          Game.give(out, 1);
          G.Ach.add('cook:' + out);
          G.Audio.play('ignite');
          if (out === 'agua_limpia') G.state.flags.boiled = true;
        } else if (s.fuel <= 0) Game.lightFire(s);
        else if (G.Inv.count('madera') > 0) {
          G.Inv.remove('madera', 1);
          s.fuel = Math.min(600, s.fuel + 120);
          G.Net.fuel(s);
          G.Audio.play('ignite');
          G.UI.msg(`Avivas el fuego (🔥 ${U.fmtSecs(s.fuel)})`, 'good', 'fuel');
        } else G.UI.msg('Necesitas madera para alimentar el fuego.', 'warn', 'nowood');
      } else if (s.type === 'antorcha') {
        if (s.fuel <= 0) Game.lightFire(s);
        else G.UI.msg('La antorcha ya está encendida (<kbd>X</kbd> para recogerla).', 'info', 'torch');
      } else if (s.type === 'cama') Game.sleep(s);
      else if (s.type === 'cofre') G.UI.openChest(s);
    }
  };

  Game.attack = function () {
    const P = G.Player;
    if (P.cd > 0 || P.dead || G.Parry.guard || G.Parry.stagger > 0 || G.Combat.heavyT > 0) return;
    if (G.Story.dialog) return;
    if (G.Grave.aimed()) return; // mirando a la ✖ de un cofre: el clic mantenido cava (grave.js)
    // Clic en una hoja del tablón de encargos: aceptar o entregar
    if (Game.target && Game.target.kind === 'qpaper') { P.cd = 0.4; G.Quests.click(Game.target); return; }
    // Cañones: desde el puesto del cañón o el cañón de proa desde el timón de la lancha
    if (P.station && P.station.kind === 'cannon') { P.cd = 0.4; G.Ships.fireCannon(P.ship, P.station.st); return; }
    if (P.station && P.station.kind === 'helm' && P.ship && P.ship.type === 'lancha' && G.Ships.has(P.ship, 'canon0')) {
      P.cd = 0.4;
      const st = P.ship.mdl.stations.find((x) => x.kind === 'cannon');
      if (st) G.Ships.fireCannon(P.ship, st);
      return;
    }
    const held = G.Inv.held();
    const it = held ? G.ITEMS[held.id] : null;
    const tg = Game.target;
    if (it && it.rep) {
      const s = (tg && (tg.kind === 'ship' || tg.kind === 'station') && tg.s) || P.ship;
      if (s) { P.cd = 0.8; P.swing = 1; P.swingCount++; if (!G.Ships.repair(s)) G.UI.msg(`Este repuesto es para: ${G.Ships.DEF[it.rep].name}`, 'warn', 'rep'); }
      return;
    }
    if (it && (it.place || it.ship || it.plano)) { Game.placeHeld(); P.cd = 0.3; return; }
    if (it && it.fishing) { P.cd = 0.35; G.Fishing.click(); return; }
    if (it && it.blowgun) { P.cd = 0.9; shootDart(); return; }
    if (it && it.spyglass) return;
    if (tg && tg.kind === 'creature' && G.Faction.friendly(tg.c)) { P.cd = 0.4; G.UI.msg(G.Faction.isMarine() ? '⚓ Son tus compañeros de la Marina Blanca.' : '🤝 Es la tripulación de un barco aliado.', 'warn', 'npcatk'); return; }
    if (G.Styles.attack(it, tg)) return;
    P.cd = 0.5;
    P.swing = 1;
    P.swingCount++;
    P.swingDir = 2; // talar, picar…: de arriba abajo
    G.Audio.play('swing');
    const mul = G.Story.meleeMul();
    if (tg && tg.kind === 'creature' && tg.c.d.friendly) { G.UI.msg(tg.c.type === 'aldeano' ? 'Los aldeanos son gente de paz: no les hagas daño.' : 'No vas a atacar a tu propia gente.', 'warn', 'npcatk'); return; }
    if (tg && tg.kind === 'creature') {
      if (tg.c.d.npc && !G.Story.tribeHostile() && !G.Input.keys.ShiftLeft) { G.UI.msg('Mantén <kbd>Shift</kbd> para atacar a un aldeano (¡la tribu se enfadará!).', 'warn', 'npcatk'); return; }
      const c = tg.c, cm = G.Combat.comboStep(), z = G.Combat.zoneFor(tg), rip = G.Parry.riposteOn(c.id);
      P.cd = cm.fin ? 0.6 : 0.42;
      G.Combat.trail(cm.n);
      const dmg = (it && it.dmg ? it.dmg : 5) * mul * z.mul * cm.mul * (rip ? 2 : 1), hp0 = c.hp;
      G.Creatures.hurt(c, dmg, undefined, { melee: true, riposte: rip, zone: z.zone, side: z.side });
      const a = G.Creatures.aimPoint(c);
      if (c.d.dummy || !G.Net.authority() || c.hp < hp0 || c.dead) { G.Combat.hitNum(a.x, a.y + 0.9, a.z, c.d.dummy || !G.Net.authority() ? dmg : hp0 - Math.max(0, c.hp), z.zone, rip ? 'crit' : null, c.d.dummy); G.Combat.impact(a.x, a.y, a.z, false); }
      if (cm.fin) G.Combat.knock(c, 1.3);
      if (it && it.tool && !it.torch) G.Inv.wear(1);
    } else if (tg && tg.kind === 'peer') {
      const p = tg.p;
      if (G.Modes.canHurtPeer(p)) {
        const cm = G.Combat.comboStep(), z = G.Combat.zoneFor(tg);
        P.cd = cm.fin ? 0.6 : 0.42;
        G.Combat.trail(cm.n);
        const dmg = (it && it.dmg ? it.dmg : 5) * mul * 0.8 * z.mul * cm.mul * (G.Parry.riposteOn('p' + p.id) ? 2 : 1);
        G.Net.send({ t: 'dmgP', to: p.id, amt: dmg, cause: `${G.Net.name} te derrotó`, sx: P.pos.x, sz: P.pos.z, by: G.Net.myId, mel: 1, zn: z.zone, zs: z.side });
        G.Audio.play('hit');
        if (p.model && p.model.react) p.model.react(z.zone, z.side, 1);
        G.Combat.hitNum(p.x, p.y + 2, p.z, dmg, z.zone); G.Combat.impact(p.x, p.y + 1.1, p.z, false);
        if (it && it.tool && !it.torch) G.Inv.wear(1);
      }
    } else if (tg && tg.kind === 'res' && tg.r.k.tool) G.Res.hit(tg.r, held);
    else if (tg && tg.kind === 'struct' && G.Modes.active && G.Modes.canHurtStruct(tg.s, G.Net.myId)) { G.Build.hurt(tg.s, (it && it.dmg ? it.dmg : 5) * 1.5 * mul, G.Net.myId); if (it && it.tool) G.Inv.wear(1); }
  };
  // Cerbatana: dardo envenenado en línea recta
  function shootDart() {
    if (G.Inv.count('dardo') <= 0) { G.UI.msg('No tienes dardos venenosos.', 'warn', 'dart'); return; }
    G.Inv.remove('dardo', 1);
    const P = G.Player, o = P.eyePos(new V3()), d = P.lookDir(new V3());
    G.Audio.play('swing');
    let best = null, bt = 30;
    G.Creatures.forEachAlive((c) => { const t = G.Creatures.rayHit(c, o, d, 0.2); if (t >= 0 && t < bt) { bt = t; best = c; } });
    if (best) { G.Creatures.hurt(best, 8, undefined, { poison: 12 }); G.UI.msg(`🎯 Dardo en el blanco: ${best.d.name} envenenado`, 'good', 'dart'); G.Ach.add('dart'); }
    for (const p of G.Net.peers.values()) {
      if (p.dead || !G.Modes.canHurtPeer(p)) continue;
      const t = raySphere(o, d, p.x, p.y + 1, p.z, 0.6);
      if (t >= 0 && t < bt) G.Net.send({ t: 'dmgP', to: p.id, amt: 6, cause: 'Un dardo venenoso', sx: P.pos.x, sz: P.pos.z, poison: 10, by: G.Net.myId });
    }
  }

  Game.useHeld = function () {
    const held = G.Inv.held();
    if (!held) return;
    const it = G.ITEMS[held.id];
    if (held.id === 'antorcha') { Game.placeTorch(); return; }
    if (it.eq) { G.Inv.equipFrom(G.Inv.sel); G.Audio.play('select'); G.UI.msg(`Te pones: ${G.icon(held.id, 'xs')} ${it.n}`, 'info'); return; }
    if (it.fruit) { G.Story.eatFruit(held.id); return; }
    if (it.read) { G.Story.readItem(it.read); return; }
    if (it.use) Game.consume(G.Inv.sel);
    else if (it.place || it.ship || it.plano) Game.placeHeld();
  };

  Game.consume = function (idx) {
    const s = G.Inv.slots[idx];
    if (!s) return;
    const it = G.ITEMS[s.id], u = it.use;
    if (it.eq) { G.Inv.equipFrom(idx); G.Audio.play('select'); return; }
    if (it.fruit) { G.Story.eatFruit(s.id); return; }
    if (it.read) { G.Story.readItem(it.read); return; }
    if (!u) return;
    const P = G.Player, S = P.stats;
    const parts = [];
    if (u.hunger) { S.hunger = U.clamp(S.hunger + u.hunger, 0, 100); parts.push(`🍖+${u.hunger}`); }
    if (u.thirst) { S.thirst = U.clamp(S.thirst + u.thirst, 0, 100); parts.push(`💧+${u.thirst}`); }
    if (u.health) { S.health = Math.min(100, S.health + u.health); parts.push(`❤️${u.health > 0 ? '+' : ''}${u.health}`); }
    if (u.warm) { S.temp = Math.min(100, S.temp + u.warm); parts.push(`🌡️+${u.warm}`); }
    if (u.stamina) { S.stamina = Math.min(100, S.stamina + u.stamina); parts.push(`⚡+${u.stamina}`); }
    if (u.cure) { if (P.sick > 0 || P.poison > 0) G.UI.msg('Te sientes mucho mejor. 🌿', 'good'); P.sick = 0; P.poison = 0; }
    s.n--;
    if (s.n <= 0) G.Inv.slots[idx] = null;
    if (u.ret) G.Inv.add(u.ret, 1);
    G.Ach.add('eat:' + s.id, 1, true);
    G.Inv.changed();
    G.Audio.play(u.thirst && !u.hunger ? 'drink' : 'eat');
    G.UI.msg(`${it.i} ${it.n}: ${parts.join(' ')}`, 'info');
    if (u.sick && Math.random() < u.sick) { P.sick = Math.max(P.sick, 25); G.UI.msg('Te sientes enfermo… 🤢 (cocina la carne y hierve el agua)', 'bad'); }
    if (S.health <= 0) Game.die('Comiste algo en mal estado');
  };

  Game.placeHeld = function () {
    const held = G.Inv.held();
    if (!held) return;
    const it = G.ITEMS[held.id];
    if (it.ship || it.plano) { G.Ships.placeHeld(); return; }
    const type = it.place;
    const pl = G.Build.plan(type);
    if (!pl.ok) { G.UI.msg(pl.reason, 'warn', 'place'); G.Audio.play('error'); return; }
    const lighter = type === 'fogata' && G.Inv.count('mechero') > 0;
    if (type === 'fogata') pl.fuel = lighter ? 150 : -150;
    const placed = G.Build.place(pl);
    G.Net.placed(placed);
    G.Inv.consumeHeld();
    G.Ach.add('place:' + type, 1, true);
    const f = G.state.flags;
    if (type === 'fogata') {
      if (lighter) { Game.useLighter(); f.fire = true; G.UI.msg('🔥 Enciendes la fogata con el mechero.', 'good', 'fuel'); }
      else G.UI.msg('Fogata colocada pero <b>apagada</b>: necesitas un 🔥 <b>mechero</b> (1 sílex + 1 fibra) para encenderla con <kbd>E</kbd>.', 'warn', 'lighter');
    }
    if (type === 'techo') f.roof = true;
    if (type === 'cama') { f.bed = true; G.state.spawn = { x: pl.x, z: pl.z }; G.UI.msg('🛏️ Punto de reaparición establecido.', 'good'); }
  };

  Game.demolish = function () {
    const tg = Game.target;
    if (!tg || tg.kind !== 'struct') return;
    const s = tg.s;
    if (G.Modes.active && s.team !== null && s.team !== G.Net.team) { G.UI.msg('No puedes desmontar construcciones enemigas: ¡destrúyelas!', 'warn', 'demo'); return; }
    if (s.type === 'piso' || s.type === 'pared' || s.type === 'puerta') {
      if (s.type === 'piso') {
        for (const o of G.Build.list) if (o !== s && Math.abs(o.x - s.x) <= 1.6 && Math.abs(o.z - s.z) <= 1.6 && o.y >= s.y - 0.01 && o.type !== 'techo') {
          G.UI.msg('Primero quita lo que hay encima del piso.', 'warn', 'demo'); return;
        }
      }
    }
    if (s.type === 'cofre' && s.items) for (const it of s.items) if (it) { if (G.Inv.add(it.id, it.n) < it.n) G.UI.msg('Algunos objetos del cofre se perdieron: inventario lleno.', 'warn'); }
    G.Build.remove(s, true);
    G.Net.removed(s);
    if (s.type === 'cama' && G.state.spawn && Math.hypot(G.state.spawn.x - s.x, G.state.spawn.z - s.z) < 0.5) G.state.spawn = null;
    if (s.type !== 'antorcha') G.UI.msg(`Desmontaste: ${G.ITEMS[s.type].n}`, 'info');
  };

  // ------------------------------------------------------------------ fuego: mechero y antorchas clavadas
  // Devuelve una herramienta con su desgaste (si la mochila está llena, se queda en el suelo)
  Game.giveTool = function (id, d, x, y, z) {
    const it = G.ITEMS[id], S = G.Inv.slots, i = S.findIndex((s) => !s);
    if (i >= 0) {
      S[i] = { id, n: 1, d: d > 0 ? Math.min(d, it.dur) : it.dur };
      G.Inv.changed();
      G.UI.msg(`+1 ${G.icon(id, 'xs')} ${it.n}`, 'item');
      return;
    }
    const drop = { id: 'gd:' + (G.Net.myId || 0) + ':' + Date.now().toString(36) + Math.floor(Math.random() * 1e4), item: id, n: 1, dur: d, x, y: y + 0.3, z, age: 0 };
    G.Net.send({ t: 'gdrop', d: Object.assign({}, drop) });
    G.Drops.add(drop);
    G.UI.msg(`Mochila llena: ${it.n.toLowerCase()} se queda en el suelo.`, 'warn', 'full');
  };
  // Gasta una chispa del mechero (primero el de la mano; si no, cualquiera de la mochila)
  Game.useLighter = function () {
    const S = G.Inv.slots, i = S[G.Inv.sel] && S[G.Inv.sel].id === 'mechero' ? G.Inv.sel : S.findIndex((s) => s && s.id === 'mechero');
    if (i < 0) return false;
    const s = S[i];
    s.d = (s.d ?? G.ITEMS.mechero.dur) - 1;
    if (s.d <= 0) { S[i] = null; G.Audio.play('break'); G.UI.msg('Tu mechero se ha gastado: fabrica otro (1 sílex + 1 fibra).', 'warn', 'lighter'); }
    G.Inv.changed();
    const P = G.Player; P.swing = 1; P.swingCount++;
    return true;
  };
  // Encender una fogata o una antorcha apagada
  Game.lightFire = function (s) {
    if (!G.Inv.count('mechero')) { G.UI.msg('Necesitas un 🔥 <b>mechero</b> para encenderla: fabrícalo con 1 sílex + 1 fibra (pestaña 🪓 Herramientas).', 'warn', 'lighter'); G.Audio.play('error'); return false; }
    if (s.type === 'fogata') {
      if (s.fuel < 0) s.fuel = -s.fuel;
      else if (G.Inv.count('madera') > 0) { G.Inv.remove('madera', 1); s.fuel = 120; }
      else { G.UI.msg('La fogata no tiene leña: necesitas 1 madera para encenderla.', 'warn', 'nowood'); return false; }
      G.state.flags.fire = true;
    } else s.fuel = G.Build.TORCH_RAIN;
    Game.useLighter();
    G.Net.fuel(s);
    G.Audio.play('ignite');
    G.UI.msg(s.type === 'fogata' ? '🔥 ¡Fuego encendido!' : '🔥 Antorcha encendida', 'good', 'fuel');
    return true;
  };
  // Clic derecho con la antorcha en la mano: clavarla en el suelo o en la pared que miras
  Game.placeTorch = function () {
    const P = G.Player, held = G.Inv.held(), tg = Game.target;
    if (!held || held.id !== 'antorcha' || P.ship || P.dead) return;
    if (tg && tg.kind !== 'water' && (tg.kind !== 'struct' || tg.s.type === 'antorcha')) return;
    const pl = G.Build.planTorch();
    if (!pl.ok) { G.UI.msg(pl.reason || 'Apunta al suelo o a una pared cercana.', 'warn', 'place'); G.Audio.play('error'); return; }
    pl.d = held.d; pl.fuel = G.Build.TORCH_RAIN;
    const s = G.Build.place(pl);
    G.Net.placed(s);
    G.Inv.consumeHeld();
    G.Ach.add('place:antorcha', 1, true);
    P.swing = 1; P.swingCount++;
    const f = G.state.flags;
    if (!f.torchTip) { f.torchTip = true; G.UI.msg('🔥 Antorcha clavada: aquí no se gasta, pero con lluvia y sin techo se apaga en 3 minutos. Vuelve a encenderla con un mechero (<kbd>E</kbd>) o recógela (<kbd>X</kbd>).', 'info'); }
  };

  Game.learned = (rec) => !rec.learn || (G.Cheats && G.Cheats.flag('free')) || (rec.learn.startsWith('style_') ? G.Styles.learned(rec.learn.slice(6)) : false) || (G.state.world && G.state.world.story && G.state.world.story.learned && G.state.world.story.learned[rec.learn]);
  Game.craft = function (rec) {
    if (!rec || !G.Inv.canCraft(rec)) return;
    if (!Game.learned(rec)) { G.UI.msg('Aún no conoces esta receta. Quizá la tribu Shandara pueda enseñártela.', 'warn'); return; }
    if (!Game.nearStation(rec.station)) { G.UI.msg(rec.station === 'horno' ? 'Necesitas estar junto a un horno de piedra.' : rec.station === 'banco' ? 'Necesitas estar junto a un banco de carpintero.' : 'Necesitas estar junto a una fogata encendida.', 'warn'); G.Audio.play('error'); return; }
    const free = G.Cheats && G.Cheats.flag('free');
    if (!free) for (const [id, n] of Object.entries(rec.req)) G.Inv.remove(id, n);
    const n = rec.n || 1;
    const added = G.Inv.add(rec.id, n);
    if (added < 1) {
      if (!free) for (const [id, k] of Object.entries(rec.req)) G.Inv.add(id, k);
      G.UI.msg('¡Inventario lleno!', 'bad');
      return;
    }
    G.Audio.play(rec.station === 'horno' ? 'smelt' : rec.station === 'banco' ? 'hammer' : 'craft');
    G.UI.msg(`Fabricaste: ${G.icon(rec.id, 'xs')} ${G.ITEMS[rec.id].n}${n > 1 ? ' ×' + n : ''}`, 'good');
    G.state.stats.crafted++;
    G.Ach.add('craft:' + rec.id, added, true);
    if (rec.cat === 'ropa') G.Ach.add('craftRopa');
    if (rec.station === 'fire') G.Ach.add('cook:' + rec.id, added);
    if (G.Ships.DEF[rec.id]) G.Ach.add('ship:' + rec.id);
    if (rec.id === 'hacha') G.state.flags.axe = true;
    if (rec.id === 'agua_limpia') G.state.flags.boiled = true;
  };

  // ------------------------------------------------------------------ cofres, barriles, botellas y Monoglifos
  Game.openLoot = function (c) {
    if (c.kind === 'clue') { G.Prologue.interact(c); return; }
    if (c.kind === 'mono') { G.Story.readMono(c); return; }
    if (c.kind === 'bottle') {
      if (c.opened) return;
      G.Story.readBottle(c);
      if (!G.Net.authority()) { G.Net.send({ t: 'loot', id: c.id }); return; }
      Game.grantLoot(c.id, G.Net.myId);
      return;
    }
    if (c.kind === 'chest') { Game.openStore(c); return; }
    if (c.opened) { G.UI.msg('Está vacío.', 'info', 'loot'); return; }
    if (!G.Net.authority()) { G.Net.send({ t: 'loot', id: c.id }); return; }
    Game.grantLoot(c.id, G.Net.myId);
  };
  // Cofres de las islas: al abrirlos enseñan su botín y después sirven para guardar objetos,
  // como un cofre construido (16 casillas). Su contenido está en world.store y se guarda con la partida.
  const pad16 = (items) => {
    const out = [];
    for (const [id, n] of items) {
      if (!G.ITEMS[id]) continue;
      for (let left = n; left > 0 && out.length < 16;) { const k = Math.min(left, G.Inv.maxStack(id)); out.push({ id, n: k, d: G.ITEMS[id].tool ? G.ITEMS[id].dur : undefined }); left -= k; }
    }
    while (out.length < 16) out.push(null);
    return out;
  };
  const storeOf = (id) => { const w = G.state.world; w.store = w.store || {}; if (!w.store[id]) w.store[id] = new Array(16).fill(null); return w.store[id]; };
  const showStore = (c) => G.UI.openChest({ id: c.id, loot: true, title: '📦 ' + c.name, items: storeOf(c.id) });
  const lootAch = () => { G.Ach.add('loot:chest', 1, true); G.Ach.earn('loot'); G.Audio.play('loot'); };
  let pendingStore = null;
  Game.openStore = function (c) {
    const w = G.state.world;
    if (w.loot[c.id]) { showStore(c); return; }
    if (!G.Net.authority()) { pendingStore = c.id; G.Net.send({ t: 'lootOpen', id: c.id }); return; }
    fillStore(c.id, G.Net.myId);
    showStore(c);
  };
  // Solo el anfitrión (o la partida individual) llena el cofre con su botín la primera vez
  function fillStore(id, who) {
    const w = G.state.world;
    if (w.loot[id]) return;
    w.store = w.store || {};
    w.store[id] = pad16(G.Landmarks.lootItems(id));
    w.loot[id] = 1;
    G.Landmarks.setOpened(id, true);
    G.Story.onLootOpened(id);
    G.Net.send({ t: 'lootOpened', id });
    G.Net.send({ t: 'lstore', id, items: w.store[id], opener: who });
    if (!G.Net.active || who === G.Net.myId) lootAch();
  }
  Game.lootOpenReq = function (id, from) {
    const w = G.state.world;
    if (!w) return;
    if (!w.loot[id]) fillStore(id, from);
    else G.Net.send({ t: 'lstore', id, items: storeOf(id), opener: from, again: 1 });
  };
  // Cofres enterrados (el de Rogan y los de los mapas del tesoro): el botín se queda dentro del cofre y quien
  // lo desentierra lo ve abierto; saca lo que quiera y lo demás sigue ahí (con la mochila llena no se pierde nada)
  Game.buryStore = function (id, items, who) {
    const w = G.state.world;
    w.store = w.store || {};
    if (!w.store[id]) w.store[id] = pad16(items);
    w.loot[id] = 1;
    G.Net.send({ t: 'lstore', id, items: w.store[id], opener: who });
    if (!G.Net.active || who === G.Net.myId) { const c = G.Landmarks.byId(id); showStore(c || { id, name: 'Cofre' }); }
  };
  // Quien pide cavar desde otro equipo abrirá el cofre al recibir su contenido
  Game.expectStore = (id) => { pendingStore = id; };
  // Contenido de un cofre de isla recibido por la red (lo llenó el anfitrión o alguien lo cambió)
  Game.onStore = function (m) {
    const w = G.state.world;
    if (!w) return;
    w.store = w.store || {};
    w.store[m.id] = m.items;
    if (G.UI.chest && G.UI.chest.loot && G.UI.chest.id === m.id) { G.UI.chest.items = m.items; G.UI.refreshInv(); }
    if (m.opener === G.Net.myId && pendingStore === m.id) {
      pendingStore = null;
      const c = G.Landmarks.byId(m.id);
      if (!m.again) lootAch();
      if (c) showStore(c);
    }
  };
  // Solo el anfitrión (o la partida individual) reparte el botín, para que nadie lo reciba dos veces
  Game.grantLoot = function (id, who) {
    const w = G.state.world;
    if (!w || w.loot[id]) return;
    const items = G.Landmarks.lootItems(id);
    w.loot[id] = 1;
    G.Landmarks.setOpened(id, true);
    G.Story.onLootOpened(id);
    G.Net.send({ t: 'lootOpened', id });
    const lc = G.Landmarks.loot.find((l) => l.id === id), kind = (lc && lc.kind) || 'chest';
    if (!G.Net.active || who === G.Net.myId) {
      G.Ach.add('loot:' + kind, 1, true); G.Ach.earn('loot');
      for (const [it, n] of items) Game.give(it, n);
      if (items.length) G.Audio.play('loot');
      if (items.length) G.UI.msg('📦 ¡Encontraste un botín!', 'good');
    } else G.Net.send({ t: 'give', to: who, items, loot: true, lk: kind });
  };

  // ------------------------------------------------------------------ dormir (cada isla tiene su propia noche)
  Game.sleep = function (bed) {
    const h = Game.hour();
    if (!(h >= 19 || h < 5)) { G.UI.msg('Solo puedes dormir de noche (desde las 19:00).', 'warn', 'sleep'); return; }
    const P = G.Player;
    const threat = G.Creatures.list.some((c) => !c.dead && (c.aggro > 0 || ['wolf', 'snowwolf'].includes(c.type)) && !c.d.npc && !c.d.sea && Math.hypot(c.x - P.pos.x, c.z - P.pos.z) < 20);
    if (threat) { G.UI.msg('¡No puedes dormir con enemigos cerca!', 'bad', 'sleep'); return; }
    const isl = bed.ship ? -1 : G.Clock.islandOf(bed.x, bed.z);
    if (G.Net.active) {
      // En LAN la noche de una isla pasa cuando todos los jugadores de esa isla están acostados
      G.state.sleepBed = bed;
      G.Net.sleepReady(true, isl, bed.ship ? bed.ship.id : null);
      G.UI.msg(bed.ship ? '💤 Te acuestas en la litera… la noche pasará cuando toda la tripulación a bordo duerma.' : '💤 Te acuestas… la noche pasará cuando todos los que están en esta isla se acuesten.', 'info', 'sleepwait');
      return;
    }
    doSleep(bed, () => {
      const newDay = isl >= 0 ? G.Clock.skipNight(isl) : G.Clock.skipPersonal();
      if (isl >= 0) { G.state.pt = G.Clock.of(isl).t; G.state.pday = G.Clock.of(isl).day; }
      if (newDay && isl >= 0) Game.onNewDay(isl);
    });
  };

  function doSleep(bed, applyTime) {
    const P = G.Player;
    const sheltered = bed.ship ? true : G.Build.hasRoof(bed.x, bed.z);
    G.state.mode = 'sleeping';
    G.Main.releasePointer();
    G.Audio.play('sleep');
    G.Ach.add('sleep');
    G.UI.fade(() => {
      const S = P.stats, D = Game.diff();
      applyTime();
      S.hunger = Math.max(5, S.hunger - 22 * D.decay);
      S.thirst = Math.max(5, S.thirst - 28 * D.decay);
      S.stamina = 100;
      if (sheltered) { S.health = Math.min(100, S.health + 35); G.UI.msg('Dormiste bajo techo. ¡Te sientes descansado! ❤️+35', 'good'); }
      else { S.health = Math.max(5, S.health - 10); G.UI.msg('Dormiste a la intemperie: frío y mosquitos. ❤️-10 (construye un techo)', 'warn'); }
      if (!bed.ship) G.state.spawn = { x: bed.x, z: bed.z };
      if (G.Net.authority() && !bed.ship) G.Creatures.removeWolves(G.Clock.islandOf(bed.x, bed.z));
      G.state.mode = 'playing';
      G.Main.lockPointer();
      if (G.Save.save()) G.UI.msg('💾 Partida guardada', 'info');
    });
  }

  // Multijugador: el anfitrión avisa de que una isla (o un barco) pasó la noche
  Game.wake = function (m) {
    const bed = G.state.sleepBed;
    const mine = bed && (m.ship ? bed.ship && bed.ship.id === m.ship : !bed.ship && G.Clock.islandOf(bed.x, bed.z) === m.isl);
    const apply = () => {
      if (m.isl !== undefined && m.isl >= 0) {
        const c = G.Clock.of(m.isl);
        if (c) { c.t = m.tt; c.day = m.day; }
        if (G.Clock.zone === m.isl) { G.state.pt = m.tt; G.state.pday = m.day; }
      } else if (mine) { const nd = G.Clock.skipPersonal(); void nd; }
    };
    if (mine) { G.state.sleepBed = null; if (!G.Player.dead) doSleep(bed, apply); else apply(); }
    else apply();
  };

  Game.dayBanner = function () {
    const d = G.state.day;
    G.Audio.play('day');
    const z = G.Clock.zone >= 0 ? G.Arch.byId(G.Clock.zone) : null;
    G.UI.banner(`Día ${d}`, z ? z.name : 'En alta mar');
    // Doblones solo por días nuevos de verdad (no al llegar a una isla con otra hora)
    const stt = G.state.stats || {};
    if (G.state.gm !== 'versus' && d > (stt.maxDay || 1)) { stt.maxDay = d; G.Ach.earn('day'); }
    const tips = {
      2: '🧭 Pista: los restos de un barco naufragado yacen en la costa este de la Isla Perdida (mira el mapa, M). ¡Tienen cofres!',
      3: '⛰️ Pista: al pie de la montaña hay una cueva con vetas de hierro… y una piedra negra con símbolos.',
      4: '🎣 Pista: fabrica una caña de pescar (palo + fibra) y pesca en el mar o en el lago.',
      5: '🐗 Cuidado: dicen que un jabalí gigante ronda las praderas de la Isla Perdida…',
    };
    if (z && z.id === 0 && tips[d] && G.Story.coop()) setTimeout(() => G.UI.msg(tips[d], 'info'), 3500);
    G.Story.news();
  };
  // Día nuevo en una isla (lo decide quien tiene la autoridad): reaparecen sus recursos
  Game.onNewDay = function (isl) {
    const players = [G.Player.pos, ...[...G.Net.peers.values()].map((p) => ({ x: p.x, z: p.z }))];
    G.Net.newDay(G.Res.newDay(isl, G.Clock.dayOf(isl), players));
    const w = G.state.world;
    if (w && w.story && w.story.rep < 0) w.story.rep = Math.min(0, w.story.rep + 15);
  };

  // ------------------------------------------------------------------ muerte
  Game.die = function (cause) {
    const P = G.Player;
    if (P.dead) return;
    if (G.Cheats.flag('god')) { P.stats.health = Math.max(P.stats.health, 1); return; }
    G.state.stats = fixStats(G.state.stats);
    G.state.stats.deaths++;
    G.Ach.add('death');
    if (P.ship) G.Ships.leave(true);
    P.dead = true;
    P.stats.health = 0;
    G.state.mode = 'dead';
    G.Audio.play('death');
    G.Story.onDeath();
    G.Modes.onDeath();
    const rule = G.Modes.deathRule();
    const grave = G.Grave.onDeath(); // regla «cofre»: todo lo que llevas se queda en un cofre (grave.js)
    document.getElementById('deadCause').textContent = cause || 'No sobreviviste';
    document.getElementById('deadRule').textContent = rule === 'out' ? 'Estás eliminado: podrás mirar a tu equipo hasta que acabe la partida.' :
      rule === 'half' ? (grave ? `Reaparecerás en tu cama (o en tu playa). Tus cosas quedaron en un cofre ${grave.water ? 'flotando con una bandera roja 🚩' : 'enterrado bajo una ✖ roja'}: tienes 5 minutos para recuperarlas. En el mapa (M) verás la zona.` : 'Reaparecerás en tu cama (o en tu playa).') :
      `Reaparecerás en tu cama (o en tu playa) y ${rule === 'keep' ? 'conservarás todo' : 'perderás todos tus objetos'}.`;
    document.getElementById('btnRespawn').textContent = rule === 'out' ? 'Mirar a mi equipo' : 'Reaparecer';
    G.Main.showScreen('dead');
  };
  Game.respawn = function () {
    const P = G.Player, rule = G.Modes.deathRule();
    if (rule === 'out') { G.state.spectate = true; G.Modes.onPlayerOut(); return; }
    for (let i = 0; i < G.Inv.slots.length; i++) {
      const s = G.Inv.slots[i];
      if (!s || rule !== 'all') continue; // con «cofre» ya está todo en el cofre; con «conservar», se queda
      G.Inv.slots[i] = null;
    }
    if (rule === 'all') for (const k of G.Inv.SLOTS) G.Inv.equip[k] = null;
    G.Inv.changed();
    const sp = G.state.spawn || Game.homeSpawn();
    P.reset(sp.x, sp.z, P.yaw);
    const S = P.stats;
    S.health = 60; S.hunger = Math.max(S.hunger, 50); S.thirst = Math.max(S.thirst, 50); S.stamina = 100;
    if (!G.Net.active) G.Creatures.removeWolves();
    G.UI.msg(rule === 'all' ? 'Despiertas aturdido… Lo perdiste todo.' : rule === 'half' && G.Grave.mineActive() ? 'Despiertas aturdido… ¡Corre a por tu cofre! Tienes 5 minutos (mira la zona en el mapa, <kbd>M</kbd>).' : 'Despiertas aturdido…', 'warn');
  };
  Game.homeSpawn = () => (G.Modes.active ? G.Modes.spawnFor(G.Net.team) : G.World.spawn);

  // ------------------------------------------------------------------ objetivos
  Game.updateObjective = function (force) {
    const o = G.Modes.active ? { text: G.Modes.objective(), changed: false } : G.Story.objective();
    G.UI.objective(o.text, o.changed && !force);
    if (o.changed && !force) G.Audio.play('craft');
  };

  // ------------------------------------------------------------------ bucle de juego
  let objT = 0, saveT = 0;
  Game.update = function (dt) {
    const st = G.state, P = G.Player;
    const inputOn = st.mode === 'playing' && G.Input.locked && !G.chatOpen && !G.Story.dialog;
    G.Clock.tick(dt);
    G.Clock.updateLocal(dt);
    G.Cheats.update(dt);
    G.Ach.tick(dt);
    G.Styles.update(dt);
    G.Prologue.update(dt);
    G.Voice.update(dt);
    G.Drops.update(dt);
    G.Pets.update(dt);
    G.Bounty.update();
    G.Treasure.update(dt);
    G.Quests.update(dt);
    G.SeaWx.update(dt);
    G.Crew.update(dt);
    G.Navy.update(dt);
    G.Faction.update(dt);
    G.Parry.update(dt);
    G.Combat.update(dt);
    G.Duel.update(dt);
    G.Bosses.update(dt);
    G.Grave.update(dt);
    P.cd = Math.max(0, P.cd - dt);
    if (!st.spectate) { P.update(dt, inputOn); P.updateStats(dt); }
    G.Net.update(dt);
    G.Ships.update(dt);
    G.Story.update(dt);
    G.Modes.update(dt);
    // Cancelar el sueño en LAN si te alejas de la cama
    if (st.sleepBed && (P.dead || (!st.sleepBed.ship && Math.hypot(P.pos.x - st.sleepBed.x, P.pos.z - st.sleepBed.z) > 3) || (st.sleepBed.ship && P.ship !== st.sleepBed.ship) || (!st.sleepBed.ship && !G.Build.byId(st.sleepBed.id)))) {
      st.sleepBed = null;
      G.Net.sleepReady(false);
      G.UI.msg('Te levantaste de la cama.', 'info', 'sleepwait');
    }
    const interactive = st.mode === 'playing' || st.mode === 'inventory' || st.mode === 'map';
    if (!interactive) {
      // En LAN el mundo sigue vivo aunque estés en pausa o muerto
      if (G.Net.active) { G.Creatures.update(dt); G.Build.update(dt); G.Res.update(dt); }
      return;
    }
    Game.target = st.mode === 'playing' && !st.spectate ? Game.findTarget() : null;
    const held = G.Inv.held();
    const hit = held && G.ITEMS[held.id];
    const placeType = hit && hit.place;
    const shipType = hit && (hit.ship || hit.plano);
    const pl = G.Build.updateGhost(st.mode === 'playing' && !P.ship ? placeType || null : null);
    const spl = G.Ships.updateGhost(st.mode === 'playing' && !P.ship ? shipType || null : null);
    const tgt = Game.target, tpl = G.Build.updateTorchGhost(st.mode === 'playing' && !P.ship && !!held && held.id === 'antorcha' && (!tgt || tgt.kind === 'water' || (tgt.kind === 'struct' && tgt.s.type !== 'antorcha')));
    G.Fishing.update(dt);
    let prompt = Game.promptFor(Game.target);
    if (!prompt && G.Treasure.near()) prompt = '✖ <b>Tesoro enterrado</b> · <kbd>E</kbd> Cavar aquí';
    if (held && hit.fishing && (!Game.target || Game.target.kind === 'water' || G.Fishing.state !== 'idle')) prompt = G.Fishing.prompt();
    if (!Game.target && held && held.id === 'cuenco' && G.Weather.intensity > 0.3 && !Game.sheltered() && G.Weather.fallKind === 'rain') prompt = '🌧️ <kbd>E</kbd> Recoger agua de lluvia';
    if (st.sleepBed && G.Net.sleepCount) prompt = `💤 Esperando a que todos se acuesten (${G.Net.sleepCount.n}/${G.Net.sleepCount.total})`;
    if (pl) prompt = `<b>${hit.n}</b> · ` + (pl.ok ? '<kbd>Clic</kbd> Colocar' : `<span class="warn">${pl.reason}</span>`) + (placeType === 'cama' || placeType === 'fogata' || placeType === 'banco' ? ' · <kbd>R</kbd> Girar' : '');
    if (spl) prompt = `<b>${hit.n}</b> · ` + (spl.ok ? '<kbd>Clic</kbd> Colocar en el agua' : `<span class="warn">${spl.reason}</span>`) + ' · <kbd>R</kbd> Girar';
    if (tpl && tpl.hit) prompt = '<b>Antorcha</b> · ' + (tpl.ok ? `<kbd>Clic derecho</kbd> Clavar ${tpl.mount === 'wall' ? 'en la pared' : 'en el suelo'}` : `<span class="warn">${tpl.reason}</span>`);
    const gp = G.Grave.prompt();
    if (gp && (G.Grave.aimed() || G.Grave.near() || !prompt)) prompt = gp;
    if (P.station && P.station.kind === 'cannon') prompt = '💣 <kbd>Clic</kbd> Disparar · ratón: apuntar · <kbd>E</kbd> Soltar';
    else if (P.station && P.station.kind === 'helm') prompt = P.ship.def.paddle ? '🛶 <kbd>W</kbd>/<kbd>S</kbd> remar · <kbd>A</kbd>/<kbd>D</kbd> girar · <kbd>E</kbd> levantarse' : `☸️ Al timón · <kbd>V</kbd> cámara${P.ship.type === 'lancha' ? ' · <kbd>Clic</kbd> cañón de proa' : ''} · <kbd>E</kbd> soltar`;
    else if (P.station && P.station.kind === 'seat') prompt = '🪑 Sentado · <kbd>E</kbd> levantarse';
    if (P.sinking) prompt = '🌀 ¡Te hundes! Un compañero puede rescatarte con <kbd>E</kbd>';
    if (st.spectate) prompt = '👁️ Estás eliminado: observando la partida';
    G.UI.setPrompt(st.mode === 'playing' && !G.Story.dialog ? prompt : '');
    G.UI.el.crosshair.classList.toggle('active', !!Game.target);
    G.UI.el.crosshair.classList.toggle('hidden', G.Player.cam === 'front' && !G.Player.station);
    if (inputOn && G.Input.mouseL && !G.Grave.dig(dt)) Game.attack();
    G.Creatures.update(dt);
    G.Build.update(dt);
    G.Res.update(dt);
    objT -= dt;
    if (objT <= 0) { objT = 0.5; Game.updateObjective(); }
    saveT += dt;
    if (saveT > 60) { saveT = 0; G.Save.save(); }
  };
  Game.resetTimers = () => { objT = 0; saveT = 0; };

  // ------------------------------------------------------------------ inventario / mapa / bitácora
  Game.openInventory = function () {
    if (G.state.mode !== 'playing') return;
    G.state.mode = 'inventory';
    G.UI.picked = null;
    G.Main.releasePointer();
    G.UI.el.inventory.classList.remove('hidden');
    G.UI.refreshInv();
  };
  Game.closeInventory = function () {
    if (G.state.mode !== 'inventory') return;
    G.UI.chest = null;
    G.UI.el.inventory.classList.add('hidden');
    G.state.mode = 'playing';
    G.Main.lockPointer();
  };
  Game.openMap = function () {
    if (G.state.mode !== 'playing') return;
    G.state.mode = 'map';
    G.Main.releasePointer();
    G.UI.openMap();
  };
  Game.closeMap = function () {
    if (G.state.mode !== 'map') return;
    G.UI.el.bigmap.classList.add('hidden');
    G.state.mode = 'playing';
    G.Main.lockPointer();
  };
  Game.openJournal = function () {
    if (G.state.mode !== 'playing') return;
    G.state.mode = 'journal';
    G.Main.releasePointer();
    G.UI.openJournal();
  };
  Game.closeJournal = function () {
    if (G.state.mode !== 'journal') return;
    G.UI.closeJournal();
    G.state.mode = 'playing';
    G.Main.lockPointer();
  };

  // ------------------------------------------------------------------ nueva partida / cargar
  Game.resetWorld = function () {
    G.Drops.clear();
    if (G.Player.ship) { G.Player.ship = null; G.Player.station = null; }
    G.Ships.clear();
    G.Build.clear();
    G.Res.reset();
    G.Creatures.clear();
    G.Inv.clear();
    G.Build.rotIdx = 0;
    G.Build.updateGhost(null);
    G.Ships.updateGhost(null);
    G.Fishing.stop();
    G.Modes.stop();
    G.Story.close();
    G.Styles.clear();
    G.Parry.clear();
    G.Combat.clear();
    G.Duel.clear();
    G.UI.waypoint = null;
  };
  // Genera el archipiélago (con pantalla de carga porque tarda un momento)
  async function buildWorld(seed, mode, teams) {
    const needs = G.Arch.seed !== seed || G.Arch.mode !== mode || G.Arch.teams !== (teams || 0) || G.Arch.islands.length < 2;
    if (!needs) { G.Landmarks.resetLoot(null); return; }
    await G.Main.loading('Formando el archipiélago…');
    G.Arch.generate(seed, { mode, teams });
    await G.Main.loading('Compilando sombreadores…');
    G.renderer.compile(G.scene, G.camera);
    G.Main.loading(null);
  }
  function applyPlayer(p) {
    const P = G.Player;
    if (p.dead || !p.stats || p.stats.health <= 0) {
      const sp = G.state.spawn || Game.homeSpawn();
      P.reset(sp.x, sp.z, p.yaw);
      Object.assign(P.stats, p.stats || {}, { health: 60, stamina: 100 });
      P.stats.hunger = Math.max(P.stats.hunger, 50); P.stats.thirst = Math.max(P.stats.thirst, 50);
    } else {
      P.reset(p.x, p.z, p.yaw);
      P.pos.y = Math.max(P.pos.y, p.y);
      Object.assign(P.stats, p.stats);
    }
    P.pitch = p.pitch || 0;
    P.sick = p.sick || 0;
    P.poison = p.poison || 0;
    P.wet = p.wet || 0;
    if (P.stats.temp === undefined) P.stats.temp = 55;
    P.cam = p.cam || 'fp';
    if (p.ship) { const s = G.Ships.byId(p.ship); if (s) { G.Ships.board(s); if (p.local) G.Player.local.set(p.local[0], p.local[1], p.local[2]); } }
  }
  function applyInventory(inv, sel, eq) {
    G.Inv.slots = (inv || []).map((s) => (s && G.ITEMS[s.id] ? s : null));
    while (G.Inv.slots.length < 32) G.Inv.slots.push(null);
    for (const k of G.Inv.SLOTS) { const e = eq && eq[k]; G.Inv.equip[k] = e && G.ITEMS[e.id] && G.ITEMS[e.id].eq ? e : null; }
    // Partidas antiguas: los abrigos que había en la mochila se ponen solos
    for (let i = 0; i < G.Inv.slots.length; i++) { const s = G.Inv.slots[i], q = s && G.ITEMS[s.id].eq; if (q && !G.Inv.equip[q.slot] && (s.id === 'abrigo' || s.id === 'abrigo_grueso' || s.id === 'casco_buceo')) G.Inv.equipFrom(i); }
    G.Inv.sel = sel || 0;
    G.Inv.changed();
  }
  // opts = { mode: 'coop' | 'versus', cfg, assign, seed }
  Game.newGame = async function (diff, opts = {}) {
    Game.resetWorld();
    const mode = opts.mode || 'coop', seed = opts.seed || (Math.random() * 1e9) >>> 0;
    const teams = mode === 'versus' ? G.Modes.FORMATS[opts.cfg.format].length : 0;
    await buildWorld(seed, mode, teams);
    const W = G.World;
    G.state = { mode: 'playing', day: 1, t: 7 / 24, diff, dayLen: 600, spawn: null, flags: {}, stats: fixStats(), obj: 0, world: Game.newWorldState(), seed, gm: mode, cfg: opts.cfg || G.Modes.DEFAULT_COOP, fruit: null, bounty: 0, quests: null };
    G.Cheats.reset();
    G.Clock.init(seed, 7 / 24);
    G.Weather.set('clear', 200);
    G.Landmarks.resetLoot(null);
    G.Story.init();
    const P = G.Player;
    if (mode === 'versus') {
      G.Modes.start(opts.cfg, opts.assign, true);
      G.Modes.setupTeams();
      const sp = G.Modes.spawnFor(G.Net.team), a = Math.random() * 6.28;
      P.reset(sp.x + Math.cos(a) * 2, sp.z + Math.sin(a) * 2, sp.yaw);
    } else P.reset(W.spawn.x, W.spawn.z, W.spawn.yaw);
    Object.assign(P.stats, { health: 100, hunger: 90, thirst: 80, stamina: 100, temp: 55 });
    P.cam = 'fp';
    if (mode !== 'versus') G.Creatures.populate();
    Game.resetTimers();
    Game.updateObjective(true);
    if (mode === 'versus') G.UI.banner(`Equipo ${G.Modes.teamName(G.Net.team)}`, G.Modes.TEAMS[G.Net.team].crew + ' · ¡Prepárate durante la tregua!');
    else {
      G.UI.banner('Día 1', 'Despiertas en la orilla tras el naufragio…');
      setTimeout(() => G.UI.msg('Pulsa <kbd>E</kbd> para recoger objetos del suelo.', 'info'), 2500);
      setTimeout(() => G.UI.msg('Pulsa <kbd>Tab</kbd> para abrir el inventario y fabricar.', 'info'), 6000);
    }
    G.Save.save();
  };
  // Invitado LAN: recibe el mundo del anfitrión y recupera su propio jugador si lo tenía guardado
  Game.joinWorld = async function (snap, pdata) {
    Game.resetWorld();
    const st = snap.st;
    const teams = st.gm === 'versus' ? G.Modes.FORMATS[st.cfg.format].length : 0;
    await buildWorld(st.seed, st.gm || 'coop', teams);
    G.state = {
      mode: 'playing', day: st.day, t: st.t, diff: st.diff, dayLen: 600, spawn: (pdata && pdata.spawn) || null,
      flags: (pdata && pdata.flags) || {}, stats: fixStats(pdata && pdata.stats), obj: (pdata && pdata.obj) || 0,
      world: st.world || Game.newWorldState(), seed: st.seed, gm: st.gm || 'coop', cfg: st.cfg, fruit: (pdata && pdata.fruit) || null, bounty: (pdata && pdata.seed === st.seed && pdata.bounty) || 0, quests: (pdata && pdata.seed === st.seed && pdata.quests) || null,
      styles: (pdata && pdata.seed === st.seed && pdata.styles) || {}, train: (pdata && pdata.seed === st.seed && pdata.train) || {},
      fac: (pdata && pdata.seed === st.seed && pdata.fac) || null, creative: pdata && pdata.seed === st.seed ? pdata.creative : undefined,
    };
    if (Array.isArray(G.state.world.loot)) G.state.world.loot = Object.assign({}, G.state.world.loot);
    G.Clock.init(st.seed, st.t);
    G.Clock.apply(st.clocks);
    G.Landmarks.resetLoot(G.state.world.loot);
    G.Story.init();
    if (st.weather) G.Weather.set(st.weather[0], st.weather[1]);
    for (const b of snap.b || []) G.Build.place(b, true);
    G.Res.setState(snap.r);
    G.Ships.setState(snap.ships);
    G.Creatures.applySnapshot(snap.c || []);
    for (const bl of snap.drops || []) G.Landmarks.addDrop(bl);
    G.Drops.setState(snap.gd);
    if (st.gm === 'versus') { G.Modes.st = st.vs; G.Modes.start(st.cfg, st.vs.assign, false); }
    if (G.state.spawn && !G.Build.list.some((s) => s.type === 'cama' && Math.hypot(s.x - G.state.spawn.x, s.z - G.state.spawn.z) < 0.5)) G.state.spawn = null;
    const P = G.Player;
    if (pdata && pdata.p && pdata.seed === st.seed) {
      applyPlayer(pdata.p);
      applyInventory(pdata.inv, pdata.sel, pdata.eq);
    } else {
      const sp = Game.homeSpawn(), a = Math.random() * Math.PI * 2;
      P.reset(sp.x + Math.cos(a) * 3, sp.z + Math.sin(a) * 3, sp.yaw);
      Object.assign(P.stats, { health: 100, hunger: 90, thirst: 80, stamina: 100, temp: 55 });
      P.cam = 'fp';
      G.Inv.clear();
      G.state.fruit = null;
    }
    Game.resetTimers();
    Game.updateObjective(true);
    G.UI.banner(G.state.gm === 'versus' ? `Equipo ${G.Modes.teamName(G.Net.team)}` : `Día ${G.state.day}`, G.state.gm === 'versus' ? G.Modes.TEAMS[G.Net.team].crew : 'Te uniste a la partida de tus amigos');
  };
  // opts.cfg: reglas de la partida guardadas en el índice (trucos, al morir…)
  Game.loadGame = async function (data, opts) {
    Game.resetWorld();
    const st = data.st;
    const seed = st.seed || 20240101;
    await buildWorld(seed, 'coop', 0);
    G.state = {
      mode: 'playing', day: st.day, t: st.t, diff: st.diff, dayLen: 600, spawn: st.spawn, flags: st.flags || {}, stats: fixStats(st.stats), obj: st.obj || 0,
      world: st.world || Game.newWorldState(), seed, gm: 'coop', cfg: Object.assign({}, G.Modes.DEFAULT_COOP, st.cfg, opts && opts.cfg), fruit: st.fruit || null, styles: st.styles || {}, train: st.train || {}, bounty: st.bounty || 0, quests: st.quests || null, fac: st.fac || null,
    };
    // Partidas antiguas: el botín era una lista y la balsa era una construcción
    if (Array.isArray(G.state.world.loot)) { const o = {}; G.state.world.loot.forEach((v, i) => { if (v) o[i] = 1; }); G.state.world.loot = o; }
    G.state.clocks = st.clocks; G.state.pt = st.pt; G.state.pday = st.pday;
    if (!st.clocks) G.Clock.init(seed, st.t);
    G.Clock.ensure();
    G.Landmarks.resetLoot(G.state.world.loot);
    G.Story.init();
    if (st.weather) G.Weather.set(st.weather[0], st.weather[1]); else G.Weather.set('clear', 150);
    for (const b of data.b || []) {
      if (b.type === 'balsa') { G.Ships.create({ type: 'balsa', x: b.x, z: b.z, yaw: b.rot, crate: [{ id: 'rep_balsa', n: 2 }] }); G.state.flags.raft = true; continue; }
      G.Build.place(b, true);
    }
    G.Build.unclip();
    G.Res.setState(data.r);
    for (const s of data.ships || []) G.Ships.create(s);
    for (const bl of data.drops || []) G.Landmarks.addDrop(bl);
    G.Drops.setState(data.gd);
    applyPlayer(data.p);
    applyInventory(data.inv, data.sel, data.eq);
    G.Creatures.populate();
    Game.resetTimers();
    Game.updateObjective(true);
    G.UI.banner(`Día ${G.state.day}`, 'Partida cargada');
  };
})();
