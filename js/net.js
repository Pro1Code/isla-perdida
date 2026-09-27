// Multijugador LAN: conexión WebSocket con el servidor, jugadores remotos y sincronización.
// El primer jugador conectado es el anfitrión: simula animales, horas de cada isla y reaparición de recursos.
(function () {
  'use strict';
  const G = window.G, U = G.U;
  const Net = (G.Net = {
    active: false, isHost: false, myId: null, hostId: null, ws: null, name: '', color: '#e6dfcc', team: null,
    peers: new Map(), lobby: new Map(), ready: new Map(), inWorld: false, waiting: false, sleepCount: null,
    lobbyCfg: { mode: 'coop', cfg: null, assign: {} }, hostAddr: null,
  });
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  Net.esc = esc;
  Net.COLORS = ['#e6dfcc', '#e05a4f', '#4f9de0', '#5fc46a', '#e8b83c', '#b36ee0', '#f08a3c', '#3cc4b8'];
  Net.MAX = 8;
  // Aspecto del jugador local: "camisa,piel,pantalón"
  Net.lookStr = () => { const l = G.Profile.look(); return [l.shirt, l.skin, l.pants].join(','); };

  // Sin red (partida individual) el jugador local tiene toda la autoridad
  Net.authority = () => !Net.active || Net.isHost;
  // Se puede jugar en LAN si la página viene de un servidor (navegador) o desde la app de escritorio
  // (la versión web publicada en GitHub Pages no puede conectarse a una LAN: usa https)
  Net.available = () => !!window.islaDesktop || location.protocol === 'http:' || (location.protocol === 'https:' && !location.hostname.endsWith('github.io'));
  Net.send = (m) => { if (Net.ws && Net.ws.readyState === 1) Net.ws.send(JSON.stringify(m)); };

  // ------------------------------------------------------------------ conexión
  // addr: "IP:puerto" del anfitrión (opcional; por defecto, el servidor que sirvió la página)
  Net.connect = function (name, color, addr) {
    return new Promise((resolve, reject) => {
      let ws;
      const host = addr || (location.host && location.protocol.startsWith('http') ? location.host : 'localhost:8080');
      try { ws = new WebSocket((location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + host + '/ws'); }
      catch (e) { reject(e); return; }
      Net.ws = ws; Net.name = name; Net.color = color; Net.hostAddr = host;
      const timer = setTimeout(() => { reject(new Error('timeout')); try { ws.close(); } catch (e) { /* nada */ } }, 5000);
      ws.onmessage = (ev) => {
        let m;
        try { m = JSON.parse(ev.data); } catch (e) { return; }
        if (m.t === 'welcome') {
          clearTimeout(timer);
          if ((m.players || []).length >= Net.MAX) { reject(new Error('full')); try { ws.close(); } catch (e) { /* nada */ } return; }
          Net.active = true; Net.myId = m.id; Net.hostId = m.hostId; Net.isHost = m.host;
          Net.lobby.clear();
          for (const p of m.players || []) if (p.name) Net.lobby.set(p.id, { name: p.name, color: p.color, ver: p.ver });
          Net.send({ t: 'hello', name, color, ver: G.VERSION, lk: Net.lookStr() });
          resolve(m);
        } else Net.onMessage(m);
      };
      ws.onclose = () => {
        clearTimeout(timer);
        const was = Net.active;
        Net.reset();
        if (was) G.Main.onNetLost(); else reject(new Error('closed'));
      };
      ws.onerror = () => {};
    });
  };
  Net.reset = function () {
    Net.active = false; Net.isHost = false; Net.ws = null; Net.inWorld = false; Net.waiting = false; Net.myId = null; Net.team = null;
    for (const p of Net.peers.values()) removePeer(p);
    Net.peers.clear(); Net.lobby.clear(); Net.ready.clear(); Net.sleepCount = null;
    Net.lobbyCfg = { mode: 'coop', cfg: null, assign: {} };
  };
  Net.disconnect = function () {
    const ws = Net.ws;
    Net.reset();
    if (ws) { ws.onclose = null; try { ws.close(); } catch (e) { /* nada */ } }
  };
  Net.nameOf = (id) => (id === Net.myId ? Net.name : (Net.peers.get(id) || Net.lobby.get(id) || { name: 'Jugador ' + id }).name);
  Net.colorOf = (id) => (id === Net.myId ? Net.color : (Net.peers.get(id) || Net.lobby.get(id) || { color: '#ccc' }).color);

  // ------------------------------------------------------------------ mensajes recibidos
  Net.onMessage = function (m) {
    const from = m.from;
    if (m.t && m.t.startsWith('sh') || m.t === 'cannon') { if (Net.inWorld) G.Ships.onNet(m, from); return; }
    if (m.t && m.t.startsWith('vs')) { if (Net.inWorld) { if (m.t === 'vsDrop') G.Modes.onPeerNet(m, from); else G.Modes.onNet(m, from); } return; }
    switch (m.t) {
      case 'hello':
        Net.lobby.set(from, { name: m.name, color: m.color, ver: m.ver });
        if (Net.inWorld) G.UI.msg(`🟢 <b style="color:${esc(m.color)}">${esc(m.name)}</b> se ha conectado`, 'good');
        if (Net.isHost && !Net.inWorld) Net.sendLobby();
        G.Main.refreshLobby();
        break;
      case 'leave': {
        const info = Net.lobby.get(m.id) || Net.peers.get(m.id);
        Net.lobby.delete(m.id);
        const p = Net.peers.get(m.id);
        if (p) { removePeer(p); Net.peers.delete(m.id); }
        Net.ready.delete(m.id);
        delete Net.lobbyCfg.assign[m.id];
        if (Net.inWorld && info) G.UI.msg(`🔴 ${esc(info.name)} se ha desconectado`, 'warn');
        G.Main.refreshLobby();
        if (Net.isHost) { checkSleep(); if (!Net.inWorld) Net.sendLobby(); }
        break;
      }
      case 'hostChanged':
        Net.hostId = m.id;
        Net.isHost = m.id === Net.myId;
        if (Net.isHost) {
          Net.ready.clear();
          G.Save.setMode('host');
          if (Net.inWorld) G.UI.msg('👑 El anfitrión se fue: ahora tú simulas el mundo.', 'info');
          else if (Net.waiting) G.Main.becameHostInLobby();
        }
        G.Main.refreshLobby();
        break;
      case 'lobbyCfg': if (!Net.isHost) { Net.lobbyCfg = m.c; G.Main.refreshLobby(); } break;
      case 'teamPick':
        if (Net.isHost && !Net.inWorld) { Net.lobbyCfg.assign[from] = m.team; Net.sendLobby(); G.Main.refreshLobby(); }
        break;
      case 'reqWorld':
        if (Net.isHost && Net.inWorld) Net.send({ t: 'world', to: from, ...Net.snapshot() });
        break;
      case 'worldReady':
        if (!Net.isHost && Net.waiting) Net.send({ t: 'reqWorld' });
        break;
      case 'world':
        if (!Net.isHost && Net.waiting) { Net.waiting = false; G.Main.joinWorld(m); }
        break;
      case 'p': if (Net.inWorld) updatePeer(from, m); break;
      case 'c': if (!Net.isHost && Net.inWorld) G.Creatures.applySnapshot(m.l); break;
      case 'time': if (!Net.isHost && Net.inWorld) applyTime(m); break;
      case 'res': if (Net.inWorld) G.Res.applyNet(m); break;
      case 'resBatch': if (Net.inWorld) for (const s of m.l) G.Res.applyNet({ id: s[0], a: s[1], hp: s[2], rd: s[3], b: s[4] }); break;
      case 'place': if (Net.inWorld) G.Build.applyPlace(m.s); break;
      case 'remove': if (Net.inWorld) G.Build.applyRemove(m.id); break;
      case 'structHit': if (Net.isHost && Net.inWorld) G.Build.hurt(G.Build.byId(m.id), m.dmg, m.by); break;
      case 'fuel': { const s = G.Build.byId(m.id); if (s) s.fuel = m.fuel; break; }
      case 'hurtC':
        if (Net.isHost) { const c = G.Creatures.byId(m.id); if (c) G.Creatures.hurt(c, m.dmg, from, m.poison ? { poison: m.poison } : undefined); }
        break;
      case 'dmgP':
        if (Net.inWorld && m.to === Net.myId && !G.Player.dead) {
          if (m.by && G.Modes.active && !G.Modes.canHurtPlayer((Net.peers.get(m.by) || {}).team)) break;
          G.Player.damage(m.amt, { x: m.sx, z: m.sz }, m.cause);
          if (m.poison) G.Creatures.poisonLocal(m.poison);
        }
        break;
      case 'give':
        for (const [id, n] of m.items) G.Game.give(id, n);
        if (m.kill) { G.state.stats.kills++; G.UI.msg(`Has cazado: ${esc(m.kill)}`, 'good'); if (m.kt) { G.Ach.onKill(m.kt); G.Bounty.onKill(m.kt); G.Treasure.onKill(m.kt); G.Quests.onKill(m.kt); } }
        if (m.loot) { G.Ach.add('loot:' + (m.lk || 'chest'), 1, true); G.Ach.earn('loot'); }
        if (m.loot && m.items.length) { G.Audio.play('loot'); G.UI.msg('📦 ¡Encontraste un botín!', 'good'); }
        break;
      case 'heal': G.Styles.onNet(m); break;
      case 'prDig': case 'prTreasure': G.Prologue.onNet(m, from); break;
      case 'ach':
        if (m.to === Net.myId && typeof m.k === 'string') { G.Ach.add(m.k); if (m.k === 'vs:win') G.Ach.earn('vsWin'); }
        break;
      case 'loot':
        if (Net.isHost) G.Game.grantLoot(m.id, from);
        break;
      case 'lootOpen': if (Net.isHost) G.Game.lootOpenReq(m.id, from); break;
      case 'lstore': if (Net.inWorld) G.Game.onStore(m); break;
      case 'lootOpened':
        if (G.state.world) G.state.world.loot[m.id] = 1;
        G.Landmarks.setOpened(m.id, true);
        if (G.Story) G.Story.onLootOpened(m.id);
        break;
      case 'lootReset':
        if (G.state.world) delete G.state.world.loot[m.id];
        G.Landmarks.setOpened(m.id, false);
        break;
      case 'drop': if (Net.inWorld) G.Landmarks.addDrop(m.d); break;
      case 'gdrop': case 'gtakeReq': case 'gtake': if (Net.inWorld) G.Drops.onNet(m, from); break;
      case 'trNew': case 'trDig': case 'trDone': if (Net.inWorld) G.Treasure.onNet(m, from); break;
      case 'seaWx': if (Net.inWorld) G.SeaWx.onNet(m); break;
      case 'grave': if (Net.inWorld) G.Grave.onNet(m, from); break;
      case 'bossFx': if (Net.inWorld) G.Bosses.onNet(m); break;
      case 'navyNew': case 'navyPos': case 'navyGone': if (Net.inWorld) G.Navy.onNet(m); break;
      case 'chest': {
        const s = G.Build.byId(m.id);
        if (s) { s.items = m.items; if (G.UI.chest === s) G.UI.refreshInv(); }
        break;
      }
      case 'sleep':
        if (Net.isHost) { if (m.ready) Net.ready.set(from, { isl: m.isl, ship: m.ship }); else Net.ready.delete(from); checkSleep(); }
        break;
      case 'sleepCount': Net.sleepCount = m; break;
      case 'wake': if (Net.inWorld) G.Game.wake(m); break;
      case 'story': case 'fruit': case 'fruitLost': case 'rescue': if (Net.inWorld) G.Story.onNet(m, from); break;
      case 'chat': G.UI.chatMsg(Net.nameOf(from), Net.colorOf(from), m.text); break;
    }
  };

  // ------------------------------------------------------------------ eventos locales → red
  Net.resChanged = (r, fx) => {
    if (!Net.active) return;
    Net.send({ t: 'res', id: r.id, a: r.alive ? 1 : 0, hp: r.hp, b: r.berries ? 1 : 0, rd: r.respawnDay, fx, px: G.Player.pos.x, pz: G.Player.pos.z });
  };
  Net.placed = (s) => { if (Net.active) Net.send({ t: 'place', s: G.Build.data(s) }); };
  Net.removed = (s) => { if (Net.active) Net.send({ t: 'remove', id: s.id }); };
  Net.fuel = (s) => { if (Net.active) Net.send({ t: 'fuel', id: s.id, fuel: s.fuel }); };
  Net.chestChanged = (s) => {
    if (!Net.active) return;
    if (s.loot) Net.send({ t: 'lstore', id: s.id, items: s.items });
    else if (s.ship) Net.send({ t: 'shCrate', id: s.ship.id, items: s.items });
    else Net.send({ t: 'chest', id: s.id, items: s.items });
  };
  Net.chat = (text) => { if (Net.active && text) Net.send({ t: 'chat', text: text.slice(0, 140) }); };
  Net.newDay = (changed) => {
    if (Net.active && changed.length) Net.send({ t: 'resBatch', l: changed.map((r) => [r.id, r.alive ? 1 : 0, r.hp, r.respawnDay, r.berries ? 1 : 0]) });
  };
  Net.sleepReady = function (ready, isl, ship) {
    if (!Net.active) return;
    if (Net.isHost) { if (ready) Net.ready.set(Net.myId, { isl, ship }); else Net.ready.delete(Net.myId); checkSleep(); }
    else Net.send({ t: 'sleep', ready, isl, ship });
  };
  Net.snapshot = () => ({
    st: {
      day: G.state.day, t: G.state.t, diff: G.state.diff, world: G.state.world, weather: [G.Weather.type, Math.round(G.Weather.timer)],
      seed: G.state.seed, gm: G.state.gm, cfg: G.state.cfg, clocks: G.Clock.pack(), vs: G.Modes.st,
    },
    b: G.Build.getState(), r: G.Res.getState(), c: G.Creatures.snapshot(), ships: G.Ships.getState(), drops: G.Landmarks.getDrops(), gd: G.Drops.getState(),
  });
  Net.startWorld = function () { Net.inWorld = true; Net.send({ t: 'worldReady' }); };
  // Configuración del lobby (el anfitrión la reparte)
  Net.sendLobby = function () { if (Net.isHost) Net.send({ t: 'lobbyCfg', c: Net.lobbyCfg }); };
  Net.pickTeam = function (team) {
    if (Net.isHost) { Net.lobbyCfg.assign[Net.myId] = team; Net.sendLobby(); G.Main.refreshLobby(); }
    else Net.send({ t: 'teamPick', team });
  };

  // El anfitrión pasa la noche de una isla cuando todos los que están en ella duermen (o de un barco, si duerme toda la tripulación a bordo)
  function playerZones() {
    const out = [{ id: Net.myId, isl: G.Player.ship ? -1 : G.Clock.islandOf(G.Player.pos.x, G.Player.pos.z), ship: G.Player.ship ? G.Player.ship.id : null, dead: G.Player.dead }];
    for (const p of Net.peers.values()) out.push({ id: p.id, isl: p.shipId ? -1 : G.Clock.islandOf(p.x, p.z), ship: p.shipId || null, dead: p.dead });
    return out;
  }
  function checkSleep() {
    if (!Net.isHost || !Net.inWorld) return;
    for (const id of [...Net.ready.keys()]) if (id !== Net.myId && !Net.peers.has(id)) Net.ready.delete(id);
    const zones = playerZones();
    const groups = new Map();
    for (const [id, r] of Net.ready) { const key = r.ship ? 'ship:' + r.ship : 'isl:' + r.isl; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(id); }
    let shown = null;
    for (const [key, ids] of groups) {
      const isShip = key.startsWith('ship:'), val = key.slice(isShip ? 5 : 4);
      const present = zones.filter((z) => !z.dead && (isShip ? z.ship === val : z.ship === null && String(z.isl) === val));
      const n = ids.length, total = Math.max(present.length, n);
      if (!shown) shown = { n, total };
      if (n >= total) {
        for (const id of ids) Net.ready.delete(id);
        if (isShip) { const m = { t: 'wake', ship: val, tt: 6.5 / 24 }; Net.send(m); G.Game.wake(m); }
        else {
          const isl = +val, c = G.Clock.of(isl);
          const newDay = c && c.t * 24 >= 19;
          const day = c ? c.day + (newDay ? 1 : 0) : G.state.day;
          const m = { t: 'wake', isl, day, tt: 6.5 / 24 };
          Net.send(m); G.Game.wake(m);
          if (newDay) G.Game.onNewDay(isl);
        }
        shown = null;
      }
    }
    Net.sleepCount = shown;
    Net.send({ t: 'sleepCount', ...(shown || { n: 0, total: 0 }) });
  }

  function applyTime(m) {
    G.Clock.apply(m.clocks);
    if (m.fires) for (const [id, fuel] of m.fires) { const s = G.Build.byId(id); if (s) s.fuel = fuel; }
    if (m.wx) G.Weather.set(m.wx);
    if (m.wa !== undefined) { G.Weather.windTarget = m.wa; }
    if (G.state.world) G.state.world.bossKilled = !!m.bk;
  }

  // ------------------------------------------------------------------ jugadores remotos
  function nameSprite(name, color) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    const x = c.getContext('2d');
    x.font = '800 30px Nunito, sans-serif';
    const w = Math.min(248, x.measureText(name).width + 34);
    x.fillStyle = 'rgba(0,0,0,0.55)';
    x.beginPath(); x.roundRect(128 - w / 2, 10, w, 44, 14); x.fill();
    x.fillStyle = color; x.beginPath(); x.arc(128 - w / 2 + 16, 32, 6, 0, 7); x.fill();
    x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(name, 128 + 8, 33);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    s.scale.set(1.9, 0.475, 1);
    s.renderOrder = 10;
    s.raycast = () => {};
    return s;
  }
  function createPeer(id, m) {
    const lk = String(m.lk || '').split(',');
    const model = lk.length === 3 ? G.Character.create(new THREE.Color(lk[0]).getHex(), { skin: new THREE.Color(lk[1]).getHex(), pants: new THREE.Color(lk[2]).getHex() }) : G.Character.create(new THREE.Color(m.col || '#e6dfcc').getHex());
    const tag = nameSprite(m.n || 'Jugador', m.col || '#fff');
    G.scene.add(model.root); G.scene.add(tag);
    return { id, name: m.n, color: m.col, lk: m.lk, model, tag, x: m.x, y: m.y, z: m.z, yaw: m.yaw, pitch: 0, hs: 0, swing: 0, sg: m.sg, held: null, dead: false, swim: false, ground: true, hp: 100, shipId: null, local: null, team: m.tm ?? null };
  }
  function removePeer(p) {
    G.scene.remove(p.model.root); G.scene.remove(p.tag);
    p.model.dispose();
    p.tag.material.map.dispose(); p.tag.material.dispose();
  }
  function updatePeer(id, m) {
    let p = Net.peers.get(id);
    if (p && (p.name !== m.n || p.color !== m.col || (m.lk && p.lk !== m.lk))) { removePeer(p); p = null; }
    if (!p) {
      p = createPeer(id, m);
      Net.peers.set(id, p);
      if (Net.isHost) checkSleep();
    }
    p.tx = m.x; p.ty = m.y; p.tz = m.z; p.tyaw = m.yaw; p.tpitch = m.pi || 0; p.hs = m.hs; p.swim = !!m.sw; p.dead = !!m.d; p.hp = m.hp; p.ground = m.g !== 0;
    if (m.eq) G.Equip.apply(p.model, m.eq);
    p.team = m.tm ?? null; p.fr = m.fr || null; p.sinking = !!m.sk; p.out = !!m.out; p.station = m.st || null;
    if (m.sh) { if (p.shipId !== m.sh) { p.x = m.x; p.y = m.y; p.z = m.z; } p.shipId = m.sh; p.local = p.local || new THREE.Vector3(); p.tl = [m.lx, m.ly, m.lz]; }
    else { p.shipId = null; p.tl = null; }
    if (m.sg !== p.sg) { p.sg = m.sg; p.swing = 1; }
    if (m.h !== p.held) {
      p.held = m.h;
      const hand = p.model.hand;
      hand.clear();
      const t = G.makeItemMesh(m.h);
      if (t) { t.rotation.set(Math.PI / 2, 2.12, 0); hand.add(t); }
    }
  }
  const _pv = new THREE.Vector3();
  function animatePeers(dt) {
    const k = 1 - Math.exp(-dt * 12);
    for (const p of Net.peers.values()) {
      if (p.tx === undefined) continue;
      const s = p.shipId ? G.Ships.byId(p.shipId) : null;
      if (s && p.tl) {
        // A bordo: se interpola en coordenadas del barco (así no tiembla aunque el barco se mueva)
        p.local.x += (p.tl[0] - p.local.x) * k; p.local.y += (p.tl[1] - p.local.y) * k; p.local.z += (p.tl[2] - p.local.z) * k;
        G.Ships.toWorld(s, p.local, _pv);
        p.x = _pv.x; p.y = _pv.y; p.z = _pv.z;
      } else { p.x += (p.tx - p.x) * k; p.y += (p.ty - p.y) * k; p.z += (p.tz - p.z) * k; }
      p.yaw += U.angDiff(p.yaw, p.tyaw) * k;
      p.pitch += ((p.tpitch || 0) - p.pitch) * k;
      if (p.swing > 0) p.swing = Math.max(0, p.swing - dt / 0.32);
      const seated = p.station === 'seat' || (p.station === 'helm' && s && s.def.seated);
      _pv.set(p.x, p.y - (seated ? 0.45 : 0), p.z);
      p.model.update(dt, { pos: _pv, yaw: p.yaw, pitch: p.pitch, speed: p.station ? 0 : p.hs, onGround: p.ground || !!s, swimming: p.swim, swing: p.swing, holding: !!p.held });
      p.model.root.visible = !p.dead && !p.out;
      p.tag.visible = !p.dead && !p.out;
      p.tag.position.set(p.x, p.y + (p.swim ? 1.9 : 2.25), p.z);
    }
  }

  // ------------------------------------------------------------------ envío periódico
  let pT = 0, cT = 0, tT = 0;
  Net.update = function (dt) {
    if (!Net.active || !Net.inWorld) return;
    animatePeers(dt);
    const P = G.Player;
    pT -= dt;
    if (pT <= 0) {
      pT = 1 / 12;
      const m = {
        t: 'p', x: +P.pos.x.toFixed(2), y: +P.pos.y.toFixed(2), z: +P.pos.z.toFixed(2), yaw: +P.yaw.toFixed(3),
        pi: +P.pitch.toFixed(2), g: P.onGround || P.wading ? 1 : 0, hs: +P.hs.toFixed(2), sw: P.swimming ? 1 : 0, d: P.dead ? 1 : 0, h: G.Inv.heldId(), hp: Math.round(P.stats.health),
        sg: P.swingCount, n: Net.name, col: Net.color, lk: Net.lookStr(), tm: Net.team, eq: G.Player.visibleIds(), fr: G.state.fruit || undefined, sk: P.sinking ? 1 : 0, out: G.state.spectate ? 1 : 0, st: P.station ? P.station.kind : undefined,
      };
      if (P.ship) { m.sh = P.ship.id; m.lx = +P.local.x.toFixed(2); m.ly = +P.local.y.toFixed(2); m.lz = +P.local.z.toFixed(2); }
      Net.send(m);
    }
    if (!Net.isHost) return;
    cT -= dt;
    if (cT <= 0) { cT = 0.1; Net.send({ t: 'c', l: G.Creatures.snapshot() }); }
    tT -= dt;
    if (tT <= 0) {
      tT = 2;
      Net.send({
        t: 'time', clocks: G.Clock.pack(), wx: G.Weather.type, wa: +(G.Weather.windA || 0).toFixed(3), bk: G.state.world.bossKilled ? 1 : 0,
        fires: G.Build.list.filter((s) => s.type === 'fogata').map((s) => [s.id, Math.round(s.fuel)]),
      });
    }
  };
})();
