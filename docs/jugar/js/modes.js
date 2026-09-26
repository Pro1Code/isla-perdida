// Modos de juego LAN:
//  - Amistoso: todos en la Isla Perdida, historia compartida, se puede guardar.
//  - Versus: cada equipo en su propia isla (distintas pero equilibradas), tregua inicial y 60-90 minutos.
//    Condiciones de victoria configurables: carrera por el tesoro (4 fragmentos), capturar la bandera y hundir el barco insignia.
// El anfitrión decide y reparte el estado; los demás envían peticiones.
(function () {
  'use strict';
  const G = window.G, U = G.U;
  const Md = (G.Modes = { active: false, cfg: null, st: null, stands: [], flagMeshes: [], digMesh: null });

  Md.TEAMS = [
    { name: 'Rojo', color: '#e05a4f', crew: 'Piratas de la Marea Roja' },
    { name: 'Azul', color: '#4f9de0', crew: 'Piratas del Abismo Azul' },
    { name: 'Verde', color: '#5fc46a', crew: 'Piratas de la Selva Verde' },
    { name: 'Dorado', color: '#e8b83c', crew: 'Piratas del Sol Dorado' },
  ];
  Md.FORMATS = { '1v1': [1, 1], '2v2': [2, 2], '3v3': [3, 3], '4v4': [4, 4], '1v1v1': [1, 1, 1], '1v1v1v1': [1, 1, 1, 1], '2v2v2': [2, 2, 2], '2v2v2v2': [2, 2, 2, 2] };
  Md.DEFAULT_VS = { format: '2v2', treasure: true, ctf: true, caps: 2, sink: true, minutes: 75, truce: 10, death: 'half', structs: true, ships: true, ff: false, diff: 1 };
  Md.DEFAULT_COOP = { diff: 1, death: 'half' };
  Md.DEATH = { keep: 'Reaparecer conservando todo', half: 'Reaparecer perdiendo la mitad', all: 'Reaparecer perdiendo todo', out: 'Eliminado (sin reaparecer)' };
  Md.teamName = (t) => (Md.TEAMS[t] ? Md.TEAMS[t].name : '?');
  Md.teamColor = (t) => (Md.TEAMS[t] ? Md.TEAMS[t].color : null);
  Md.nTeams = () => (Md.cfg ? Md.FORMATS[Md.cfg.format].length : 0);

  // ------------------------------------------------------------------ reglas consultadas por el resto del juego
  const truce = () => Md.active && Md.st && Md.st.elapsed < Md.cfg.truce * 60;
  Md.inTruce = truce;
  Md.canHurtPlayer = function (team) {
    if (!Md.active) return false;
    if (truce()) return false;
    if (team === G.Net.team && !Md.cfg.ff) return false;
    return true;
  };
  Md.canHurtShip = function (s, by) {
    if (!Md.active) return true; // en amistoso solo dañan los animales y las rocas
    if (by === undefined || by === null) return true;
    if (truce()) return false;
    if (!Md.cfg.ships && !(Md.cfg.sink && s.flagship)) return false;
    const byTeam = by === G.Net.myId ? G.Net.team : (G.Net.peers.get(by) || {}).team;
    if (byTeam === s.team && !Md.cfg.ff) return false;
    return true;
  };
  Md.canHurtStruct = function (s, by) {
    if (!Md.active || !Md.cfg.structs || truce()) return false;
    const byTeam = by === G.Net.myId ? G.Net.team : (G.Net.peers.get(by) || {}).team;
    return s.team !== byTeam;
  };
  Md.canBoard = function (s) {
    if (!Md.active || s.team === null || s.team === undefined || s.team === G.Net.team) return true;
    if (truce()) { G.UI.msg('Durante la tregua no puedes abordar barcos enemigos.', 'warn', 'board'); return false; }
    return true;
  };
  Md.deathRule = () => (Md.active ? Md.cfg.death : (G.state.cfg && G.state.cfg.death) || 'half');
  Md.lootExtra = function (id) {
    if (!Md.active || !Md.st) return [];
    return Md.st.fragAt && Md.st.fragAt[id] ? [['fragmento_mapa', 1]] : [];
  };
  Md.target = function () {
    if (!Md.active || !Md.st) return null;
    const T = Md.st.teams[G.Net.team];
    if (T && T.frags >= 4 && G.Arch.treasure) return { x: G.Arch.treasure.x, z: G.Arch.treasure.z, name: '✖ El tesoro' };
    if (G.Inv.count('fragmento_mapa') > 0 || Md.carrying()) { const s = Md.stands[G.Net.team]; return s ? { x: s.x, z: s.z, name: 'Tu bandera' } : null; }
    return G.UI.waypoint ? { x: G.UI.waypoint.x, z: G.UI.waypoint.z, name: 'Destino marcado' } : null;
  };
  Md.carrying = () => Md.st && Md.st.flags.some((f) => f.carrier === G.Net.myId);

  // ------------------------------------------------------------------ inicio de la partida
  // assign: { idJugador: equipo }
  Md.start = function (cfg, assign, fresh) {
    Md.active = true;
    Md.cfg = Object.assign({}, Md.DEFAULT_VS, cfg);
    const n = Md.nTeams();
    if (fresh) {
      const fragChests = ['c:ruinas:altar', 'sub', 'sw0', 'c:reef', 'sw1'].filter((id) => G.Landmarks.byId(id)).slice(0, 4);
      Md.st = {
        elapsed: 0, over: false, winner: null, assign,
        teams: Array.from({ length: n }, () => ({ caps: 0, frags: 0, sunk: false, out: false })),
        flags: Array.from({ length: n }, (_, t) => ({ team: t, carrier: null, drop: null, dropT: 0 })),
        fragAt: Object.fromEntries(fragChests.map((id) => [id, 1])),
      };
    }
    G.Net.team = Md.st.assign[G.Net.myId] ?? 0;
    buildStands();
  };
  Md.stop = function () {
    Md.active = false; Md.st = null;
    for (const m of Md.flagMeshes) G.scene.remove(m);
    Md.flagMeshes = []; Md.stands = [];
    if (Md.digMesh) { G.scene.remove(Md.digMesh); Md.digMesh = null; }
    G.Net.team = null;
  };
  // Isla y punto de aparición del equipo
  Md.teamIsland = (t) => G.Arch.islands.find((s) => s.team === t) || G.Arch.islands[0];
  Md.spawnFor = function (t) {
    const isl = Md.teamIsland(t);
    return isl.spawn || { x: isl.x, z: isl.z, yaw: 0 };
  };
  // El anfitrión crea el barco insignia y el cofre inicial de cada equipo
  Md.setupTeams = function () {
    for (let t = 0; t < Md.nTeams(); t++) {
      const sp = Md.spawnFor(t), isl = Md.teamIsland(t);
      // Barco insignia: bote de vela anclado frente a la playa
      const dx = sp.x - isl.x, dz = sp.z - isl.z, dl = Math.hypot(dx, dz) || 1;
      let x = sp.x, z = sp.z;
      for (let d = 0; d < 120; d += 2) { x = sp.x + dx / dl * d; z = sp.z + dz / dl * d; if (G.height(x, z) < -1.8 && G.height(x + dx / dl * 5, z + dz / dl * 5) < -1.8) break; }
      const s = G.Ships.create({ type: 'velero', x, z, yaw: Math.atan2(dx, dz), anchor: true, team: t, flagship: true, flagColor: Md.teamColor(t), sail: new THREE.Color(Md.teamColor(t)).lerp(new THREE.Color(0xffffff), 0.55).getHex(), name: 'Insignia ' + Md.teamName(t), crate: [{ id: 'rep_velero', n: 3 }, { id: 'polvora', n: 6 }, { id: 'bala_canon', n: 6 }] });
      G.Net.send({ t: 'shNew', d: G.Ships.data(s) });
      // Cofre con provisiones iguales para todos los equipos
      const cx = sp.x - dx / dl * 5, cz = sp.z - dz / dl * 5;
      const c = G.Build.place({ type: 'cofre', x: cx, y: G.height(cx, cz), z: cz, rot: 0, team: t, items: [{ id: 'hacha', n: 1, d: 120 }, { id: 'pico', n: 1, d: 120 }, { id: 'pala', n: 1, d: 200 }, { id: 'carne_cocida', n: 4 }, { id: 'agua_limpia', n: 3 }, { id: 'cuenco', n: 2 }, { id: 'polvora', n: 6 }, { id: 'bala_canon', n: 6 }, { id: 'cuerda', n: 4 }, { id: 'tabla', n: 8 }, { id: 'clavos', n: 8 }, { id: 'antorcha', n: 2 }, null, null, null, null] }, true);
      G.Net.placed(c);
    }
  };

  // ------------------------------------------------------------------ banderas (mástil de cada equipo)
  function flagMesh(color) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 5, 8), new THREE.MeshStandardMaterial({ color: 0x6a4a2c }));
    pole.position.y = 2.5; pole.castShadow = true; g.add(pole);
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0, 8, 4).translate(0.8, -0.5, 0), new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 0.9 }));
    cloth.position.y = 4.9; g.add(cloth);
    const skull = new THREE.Mesh(new THREE.CircleGeometry(0.22, 12), new THREE.MeshBasicMaterial({ color: 0xf4f4f4, side: THREE.DoubleSide }));
    skull.position.set(0.8, 4.4, 0.01); g.add(skull);
    g.userData.cloth = cloth;
    return g;
  }
  function buildStands() {
    for (const m of Md.flagMeshes) G.scene.remove(m);
    Md.flagMeshes = []; Md.stands = [];
    for (let t = 0; t < Md.nTeams(); t++) {
      const sp = Md.spawnFor(t), isl = Md.teamIsland(t);
      const dx = sp.x - isl.x, dz = sp.z - isl.z, dl = Math.hypot(dx, dz) || 1;
      const x = sp.x - dx / dl * 10, z = sp.z - dz / dl * 10;
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 0.3, 16), new THREE.MeshStandardMaterial({ color: Md.teamColor(t), roughness: 0.8 }));
      base.position.set(x, G.height(x, z) + 0.15, z);
      G.scene.add(base); Md.flagMeshes.push(base);
      const f = flagMesh(Md.teamColor(t));
      G.scene.add(f); Md.flagMeshes.push(f);
      Md.stands.push({ team: t, x, z, y: G.height(x, z), mesh: f });
    }
  }
  function placeFlags() {
    if (!Md.st) return;
    Md.stands.forEach((sd, t) => {
      const f = Md.st.flags[t], m = sd.mesh;
      if (f.carrier) {
        const who = f.carrier === G.Net.myId ? G.Player.pos : G.Net.peers.get(f.carrier);
        if (who) { m.position.set(who.x, who.y + 0.3, who.z); m.scale.setScalar(0.45); }
      } else if (f.drop) { m.position.set(f.drop.x, f.drop.y, f.drop.z); m.scale.setScalar(0.7); m.rotation.z = 0.5; }
      else { m.position.set(sd.x, sd.y + 0.3, sd.z); m.scale.setScalar(1); m.rotation.z = 0; }
      const c = m.userData.cloth;
      c.rotation.y = Math.sin(performance.now() / 500 + t) * 0.25;
    });
  }

  // ------------------------------------------------------------------ interacción (tecla E cerca de banderas y del tesoro)
  Md.findTarget = function (P) {
    if (!Md.active || !Md.st) return null;
    for (let t = 0; t < Md.stands.length; t++) {
      const sd = Md.stands[t], f = Md.st.flags[t];
      const fx = f.drop ? f.drop.x : sd.x, fz = f.drop ? f.drop.z : sd.z;
      if (!f.carrier && Math.hypot(P.x - fx, P.z - fz) < 2.6) return { kind: 'vsflag', team: t, drop: !!f.drop };
      if (t === G.Net.team && Math.hypot(P.x - sd.x, P.z - sd.z) < 3) return { kind: 'vsstand', team: t };
    }
    const T = Md.st.teams[G.Net.team];
    if (T && T.frags >= 4 && G.Arch.treasure && Math.hypot(P.x - G.Arch.treasure.x, P.z - G.Arch.treasure.z) < 3) return { kind: 'vsdig' };
    return null;
  };
  Md.promptFor = function (tg) {
    const mine = tg.team === G.Net.team;
    if (tg.kind === 'vsflag') {
      if (!Md.cfg.ctf) return mine ? `🏴 <b>Tu bandera</b>` + (G.Inv.count('fragmento_mapa') ? ' · <kbd>E</kbd> Entregar fragmentos' : '') : '';
      if (mine && tg.drop) return '🏴 <b>Tu bandera</b> · <kbd>E</kbd> Devolverla a su mástil';
      if (mine) return '🏴 <b>Tu bandera</b>' + (Md.carrying() ? ' · <kbd>E</kbd> ¡Capturar!' : '') + (G.Inv.count('fragmento_mapa') ? ' · <kbd>E</kbd> Entregar fragmentos' : '');
      return truce() ? `🏴 Bandera del equipo ${Md.teamName(tg.team)} · <span class="warn">tregua</span>` : `🏴 Bandera del equipo ${Md.teamName(tg.team)} · <kbd>E</kbd> ¡Robarla!`;
    }
    if (tg.kind === 'vsstand') return '🏴 <b>Mástil de tu equipo</b>' + (G.Inv.count('fragmento_mapa') ? ' · <kbd>E</kbd> Entregar fragmentos' : '') + (Md.carrying() ? ' · <kbd>E</kbd> ¡Capturar!' : '');
    if (tg.kind === 'vsdig') return G.Inv.heldId() === 'pala' ? '✖ <b>¡Aquí está el tesoro!</b> · <kbd>E</kbd> Cavar' : '<span class="warn">✖ Necesitas una pala en la mano para cavar</span>';
    return '';
  };
  Md.interact = function (tg) {
    if (tg.kind === 'vsdig') {
      if (G.Inv.heldId() !== 'pala') return;
      G.Audio.play('stone');
      req({ t: 'vsDig' });
      return;
    }
    const n = G.Inv.count('fragmento_mapa');
    if ((tg.kind === 'vsstand' || (tg.kind === 'vsflag' && tg.team === G.Net.team && !tg.drop)) && n > 0) {
      G.Inv.remove('fragmento_mapa', n);
      req({ t: 'vsFrags', n });
      return;
    }
    if (!Md.cfg.ctf) return;
    if (tg.kind === 'vsflag' && tg.team !== G.Net.team) { if (truce()) { G.UI.msg('Durante la tregua no puedes robar banderas.', 'warn'); return; } req({ t: 'vsTake', flag: tg.team }); return; }
    if (tg.kind === 'vsflag' && tg.drop) { req({ t: 'vsReturn', flag: tg.team }); return; }
    if (Md.carrying()) req({ t: 'vsCap' });
  };
  // Petición al anfitrión (o se procesa directamente si lo somos)
  // Logro para quien hizo la jugada (puede ser otro jugador: se le avisa por la red)
  const credit = (who, k) => (who === G.Net.myId || !G.Net.active ? G.Ach.add(k) : G.Net.send({ t: 'ach', to: who, k }));
  function req(m) { if (G.Net.isHost || !G.Net.active) hostHandle(m, G.Net.myId); else G.Net.send(m); }
  const teamOf = (id) => (Md.st ? Md.st.assign[id] : null);
  function hostHandle(m, from) {
    const st = Md.st;
    if (!st || st.over) return;
    const team = teamOf(from);
    switch (m.t) {
      case 'vsTake': { const f = st.flags[m.flag]; if (!f || f.carrier || m.flag === team) return; f.carrier = from; f.drop = null; announce(`🏴 ¡${G.Net.nameOf(from)} robó la bandera del equipo ${Md.teamName(m.flag)}!`); break; }
      case 'vsReturn': { const f = st.flags[m.flag]; if (!f || m.flag !== team) return; f.drop = null; announce(`🏴 La bandera del equipo ${Md.teamName(m.flag)} volvió a su mástil.`); break; }
      case 'vsCap': {
        const f = st.flags.find((x) => x.carrier === from);
        if (!f) return;
        if (st.flags[team].carrier || st.flags[team].drop) { G.Net.send({ t: 'vsMsg', to: from, text: 'Tu bandera no está en su mástil: recupérala para capturar.' }); if (from === G.Net.myId) G.UI.msg('Tu bandera no está en su mástil: recupérala para capturar.', 'warn'); return; }
        f.carrier = null; f.drop = null;
        st.teams[team].caps++;
        credit(from, 'vs:cap');
        announce(`🏆 ¡${G.Net.nameOf(from)} capturó la bandera del equipo ${Md.teamName(f.team)}! (${st.teams[team].caps}/${Md.cfg.caps})`);
        if (Md.cfg.ctf && st.teams[team].caps >= Md.cfg.caps) finish(team, 'capturó ' + Md.cfg.caps + ' banderas');
        break;
      }
      case 'vsFrags': {
        st.teams[team].frags = Math.min(4, st.teams[team].frags + m.n);
        announce(`🗺️ El equipo ${Md.teamName(team)} tiene ${st.teams[team].frags}/4 fragmentos del mapa.`);
        if (st.teams[team].frags >= 4) announce(`✖ ¡El equipo ${Md.teamName(team)} completó el mapa del tesoro! Van a por él…`);
        break;
      }
      case 'vsDig':
        if (Md.cfg.treasure && st.teams[team].frags >= 4) { credit(from, 'vs:dig'); finish(team, 'desenterró el tesoro de Rogan'); }
        break;
    }
    sync();
  }
  function announce(text) { G.UI.msg(text, 'info'); G.Net.send({ t: 'vsMsg', text }); }
  function sync() { if (G.Net.active) G.Net.send({ t: 'vsState', st: Md.st }); }
  function finish(team, why) {
    const st = Md.st;
    if (st.over) return;
    st.over = true; st.winner = team; st.why = why;
    sync();
    Md.showEnd();
  }
  Md.onNet = function (m, from) {
    if (m.t === 'vsState') { if (!G.Net.isHost) { const was = Md.st && Md.st.over; Md.st = m.st; if (!was && Md.st.over) Md.showEnd(); } return; }
    if (m.t === 'vsMsg') { if (!m.to || m.to === G.Net.myId) G.UI.msg(G.Net.esc(m.text), 'info'); return; }
    if (G.Net.isHost) hostHandle(m, from);
  };

  // Muerte en versus: suelta la bandera y los fragmentos, y puede quedar eliminado
  Md.onDeath = function () {
    if (!Md.active || !Md.st) return;
    const P = G.Player.pos;
    const n = G.Inv.count('fragmento_mapa');
    if (n) { G.Inv.remove('fragmento_mapa', n); G.Landmarks.dropBag(P.x, P.z, [['fragmento_mapa', n]]); }
    if (G.Net.isHost || !G.Net.active) dropCarried(G.Net.myId, P); else G.Net.send({ t: 'vsDrop', x: P.x, y: P.y, z: P.z });
  };
  function dropCarried(id, p) {
    const f = Md.st.flags.find((x) => x.carrier === id);
    if (f) { f.carrier = null; f.drop = { x: p.x, y: G.height(p.x, p.z), z: p.z }; f.dropT = 60; announce(`🏴 ¡La bandera del equipo ${Md.teamName(f.team)} cayó al suelo!`); sync(); }
  }
  Md.onPeerNet = function (m, from) { if (m.t === 'vsDrop' && G.Net.isHost) dropCarried(from, m); };
  Md.onShipSunk = function (s) {
    if (!Md.active || !Md.st || !s.flagship || !G.Net.isHost && G.Net.active) return;
    const T = Md.st.teams[s.team];
    if (!T || T.sunk) return;
    T.sunk = true;
    announce(`💥 ¡El barco insignia del equipo ${Md.teamName(s.team)} se hundió!`);
    if (Md.cfg.sink) {
      const alive = Md.st.teams.map((t, i) => (!t.sunk ? i : -1)).filter((i) => i >= 0);
      if (alive.length === 1) finish(alive[0], 'hundió el barco insignia enemigo');
    }
    sync();
  };
  Md.onPlayerOut = function () {
    if (!Md.st) return;
    // Si todos los jugadores de un equipo quedaron eliminados, el equipo sale
    const alive = new Set();
    if (!G.Player.dead || G.state.spectate !== true) alive.add(G.Net.team);
    for (const p of G.Net.peers.values()) if (!p.out) alive.add(p.team);
    const teams = [...alive].filter((t) => t !== null && t !== undefined);
    if (teams.length === 1 && G.Net.isHost) finish(teams[0], 'fue el último equipo en pie');
  };

  // ------------------------------------------------------------------ bucle
  Md.update = function (dt) {
    if (!Md.active || !Md.st) return;
    const st = Md.st, P = G.Player;
    if (!st.over) st.elapsed += dt;
    placeFlags();
    // Tregua: una tormenta rodea cada isla; nadie puede salir de la suya
    if (truce() && !P.dead) {
      const isl = Md.teamIsland(G.Net.team), d = Math.hypot(P.pos.x - isl.x, P.pos.z - isl.z), lim = isl.zoneR - 20;
      if (d > lim) {
        const k = lim / d;
        if (P.ship) { const s = P.ship; if (G.Ships.isAuth(s)) { s.x = isl.x + (s.x - isl.x) * 0.985; s.z = isl.z + (s.z - isl.z) * 0.985; s.speed *= 0.5; } }
        else { P.pos.x = isl.x + (P.pos.x - isl.x) * k; P.pos.z = isl.z + (P.pos.z - isl.z) * k; }
        G.UI.msg(`⛈️ Una tormenta rodea tu isla durante la tregua (${U.fmtSecs(Md.cfg.truce * 60 - st.elapsed)}).`, 'warn', 'truce');
      }
    }
    if (G.Net.isHost || !G.Net.active) {
      for (const f of st.flags) if (f.drop && (f.dropT -= dt) <= 0) { f.drop = null; announce(`🏴 La bandera del equipo ${Md.teamName(f.team)} volvió sola a su mástil.`); sync(); }
      if (!st.over && st.elapsed >= Md.cfg.minutes * 60) {
        const score = st.teams.map((t) => t.caps * 3 + t.frags + (t.sunk ? 0 : 2));
        const best = Math.max(...score), winners = score.map((s, i) => (s === best ? i : -1)).filter((i) => i >= 0);
        if (winners.length === 1) finish(winners[0], 'tenía más puntos al acabar el tiempo'); else { st.over = true; st.winner = -1; st.why = 'empate'; sync(); Md.showEnd(); }
      }
      if ((Md.syncT = (Md.syncT || 0) - dt) <= 0) { Md.syncT = 2; sync(); }
    }
  };
  // Texto del panel del HUD
  Md.hud = function () {
    if (!Md.active || !Md.st) return '';
    const st = Md.st, left = Math.max(0, Md.cfg.minutes * 60 - st.elapsed);
    let h = `⚔️ <b>${U.fmtSecs(left)}</b>`;
    if (truce()) h += ` · ⛈️ Tregua ${U.fmtSecs(Md.cfg.truce * 60 - st.elapsed)}`;
    h += '<div class="vs-teams">' + st.teams.map((t, i) => {
      const me = i === G.Net.team ? ' me' : '';
      const bits = [];
      if (Md.cfg.ctf) bits.push(`🏴${t.caps}/${Md.cfg.caps}`);
      if (Md.cfg.treasure) bits.push(`🗺️${t.frags}/4`);
      if (Md.cfg.sink) bits.push(t.sunk ? '💥' : '⛵');
      return `<span class="vs-team${me}" style="--tc:${Md.teamColor(i)}">${Md.teamName(i)} ${bits.join(' ')}</span>`;
    }).join('') + '</div>';
    if (Md.carrying()) h += '<div class="warn">🏴 ¡Llevas la bandera enemiga! Vuelve a tu mástil.</div>';
    return h;
  };
  Md.objective = function () {
    const c = Md.cfg, goals = [];
    if (c.treasure) goals.push('reúne los <b>4 fragmentos del mapa</b> (ruinas, naufragios, submarino y arrecife) y desentierra el tesoro');
    if (c.ctf) goals.push(`captura <b>${c.caps} bandera${c.caps > 1 ? 's' : ''}</b> enemiga${c.caps > 1 ? 's' : ''}`);
    if (c.sink) goals.push('hunde el <b>barco insignia</b> enemigo');
    return `Equipo <b style="color:${Md.teamColor(G.Net.team)}">${Md.teamName(G.Net.team)}</b>: ${goals.join(', o ')}.`;
  };
  Md.showEnd = function () {
    const st = Md.st, win = st.winner, mine = win === G.Net.team;
    G.state.mode = 'won';
    G.Main.releasePointer();
    document.querySelector('#win h2').textContent = win < 0 ? '¡Empate!' : mine ? '¡Victoria!' : 'Derrota';
    document.getElementById('winStats').innerHTML = win < 0 ? 'Nadie consiguió imponerse antes de que acabara el tiempo.' :
      `El equipo <b style="color:${Md.teamColor(win)}">${Md.teamName(win)}</b> (${Md.TEAMS[win].crew}) ${st.why}.<br>` +
      st.teams.map((t, i) => `${Md.teamName(i)}: 🏴 ${t.caps} · 🗺️ ${t.frags}/4 · ${t.sunk ? '💥 insignia hundida' : '⛵ insignia a flote'}`).join('<br>');
    G.Main.showScreen('win');
    G.Audio.play(mine ? 'win' : 'death');
    if (mine) { G.Ach.add('vs:win'); G.Ach.earn('vsWin'); }
  };
})();
