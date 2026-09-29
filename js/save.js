// Partidas guardadas (como los mundos de Minecraft): cada partida tiene nombre, dificultad, reglas y trucos.
//  - Worlds: índice de partidas (localStorage) y sus datos (IndexedDB, sin el límite de 5 MB de localStorage)
//  - Save:   guarda y carga la partida en curso
//      world:  partida individual o partida LAN del anfitrión (mundo + jugador)
//      client: en LAN, cada invitado guarda solo su jugador e inventario (por anfitrión)
//      versus: no se guarda (dura una sesión)
(function () {
  'use strict';
  const G = window.G;
  const IDX = 'isla_worlds_v1';
  const Worlds = (G.Worlds = {});
  const Save = (G.Save = { mode: 'world', world: null });

  // ------------------------------------------------------------------ IndexedDB (con localStorage de reserva)
  let dbP = null;
  function db() {
    if (dbP) return dbP;
    dbP = new Promise((ok) => {
      try {
        const r = indexedDB.open('isla-perdida', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('worlds');
        r.onsuccess = () => ok(r.result);
        r.onerror = () => ok(null);
      } catch (e) { ok(null); }
    });
    return dbP;
  }
  async function idbPut(id, data) {
    const d = await db();
    if (!d) { try { localStorage.setItem('isla_wd_' + id, JSON.stringify(data)); return true; } catch (e) { return false; } }
    return new Promise((ok) => { const tx = d.transaction('worlds', 'readwrite'); tx.objectStore('worlds').put(data, id); tx.oncomplete = () => ok(true); tx.onerror = () => ok(false); });
  }
  async function idbGet(id) {
    const d = await db();
    if (!d) { try { return JSON.parse(localStorage.getItem('isla_wd_' + id)); } catch (e) { return null; } }
    return new Promise((ok) => { const r = d.transaction('worlds').objectStore('worlds').get(id); r.onsuccess = () => ok(r.result || null); r.onerror = () => ok(null); });
  }
  async function idbDel(id) {
    const d = await db();
    try { localStorage.removeItem('isla_wd_' + id); } catch (e) { /* nada */ }
    if (!d) return;
    return new Promise((ok) => { const tx = d.transaction('worlds', 'readwrite'); tx.objectStore('worlds').delete(id); tx.oncomplete = ok; tx.onerror = ok; });
  }

  // ------------------------------------------------------------------ índice de partidas
  function readIdx() { try { const a = JSON.parse(localStorage.getItem(IDX)); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function writeIdx(a) { try { localStorage.setItem(IDX, JSON.stringify(a)); } catch (e) { /* sin almacenamiento */ } }
  // kind: 'sp' (un jugador) o 'mp' (multijugador, del anfitrión). Más recientes primero.
  Worlds.list = (kind) => readIdx().filter((w) => !kind || w.kind === kind).sort((a, b) => (b.played || 0) - (a.played || 0));
  Worlds.get = (id) => readIdx().find((w) => w.id === id) || null;
  Worlds.update = function (id, patch) {
    const a = readIdx(), w = a.find((x) => x.id === id);
    if (!w) return null;
    Object.assign(w, patch);
    writeIdx(a);
    return w;
  };
  Worlds.create = function (o) {
    const w = {
      id: 'w' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36), kind: o.kind || 'sp', name: String(o.name || '').trim().slice(0, 32) || 'Nueva isla',
      diff: o.diff ?? 1, death: o.death || 'half', cheats: !!o.cheats, seed: o.seed || null, created: Date.now(), played: Date.now(), day: 1, time: 0, ver: G.VERSION, fresh: true,
    };
    const a = readIdx(); a.push(w); writeIdx(a);
    return w;
  };
  Worlds.rename = (id, name) => Worlds.update(id, { name: String(name || '').trim().slice(0, 32) || 'Isla sin nombre' });
  Worlds.remove = function (id) { writeIdx(readIdx().filter((w) => w.id !== id)); return idbDel(id); };
  Worlds.load = (id) => idbGet(id);
  // Nombre libre ("Mi isla", "Mi isla 2"…)
  Worlds.freeName = function (base) {
    const names = new Set(readIdx().map((w) => w.name));
    if (!names.has(base)) return base;
    for (let i = 2; ; i++) if (!names.has(`${base} ${i}`)) return `${base} ${i}`;
  };

  // Partidas de la versión 2.0 (una sola ranura): se copian como partidas nuevas (sin borrar las antiguas,
  // para que las versiones anteriores del lanzador las sigan viendo)
  Worlds.migrate = async function () {
    try { if (localStorage.getItem('isla_worlds_migrated')) return; } catch (e) { return; }
    const old = [['isla_perdida_save_v1', 'sp', 'Mi primera isla'], ['isla_perdida_mp_v1', 'mp', 'Partida LAN guardada']];
    for (const [key, kind, name] of old) {
      let d = null;
      try { d = JSON.parse(localStorage.getItem(key)); } catch (e) { /* nada */ }
      if (!d || !d.st) continue;
      const w = Worlds.create({ kind, name, diff: d.st.diff ?? 1, death: (d.st.cfg && d.st.cfg.death) || 'half', seed: d.st.seed });
      Worlds.update(w.id, { day: d.st.day || 1, fresh: false, ver: '2.0' });
      await idbPut(w.id, d);
    }
    try { localStorage.setItem('isla_worlds_migrated', '1'); } catch (e) { /* nada */ }
  };

  // ------------------------------------------------------------------ partida en curso
  let clientKey = null, playStart = 0;
  // mode: 'world' (con la partida w), 'client' (invitado LAN; suffix = anfitrión + nombre) o 'versus'
  Save.setMode = function (mode, arg) {
    Save.mode = mode;
    if (mode === 'world') { Save.world = arg || null; playStart = Date.now(); }
    else Save.world = null;
    clientKey = mode === 'client' ? 'isla_perdida_mpc_v1_' + arg : null;
  };
  Save.setWorld = (w) => Save.setMode('world', w);
  Save.has = function () {
    if (Save.mode === 'client') { try { return !!localStorage.getItem(clientKey); } catch (e) { return false; } }
    return !!(Save.world && !Save.world.fresh);
  };
  // Datos del invitado (síncrono, son pocos)
  Save.load = function () {
    if (Save.mode !== 'client') return null;
    try { const d = JSON.parse(localStorage.getItem(clientKey)); return d && (d.v === 1 || d.v === 2) ? d : null; } catch (e) { return null; }
  };
  Save.loadWorld = async function (w) {
    const d = await idbGet(w.id);
    return d && (d.v === 1 || d.v === 2) ? d : null;
  };
  function snapshot() {
    const st = G.state, P = G.Player;
    const player = { x: P.pos.x, y: P.pos.y, z: P.pos.z, yaw: P.yaw, pitch: P.pitch, stats: Object.assign({}, P.stats), sick: P.sick, poison: P.poison, wet: P.wet, cam: P.cam, dead: P.dead,
      ship: P.ship ? P.ship.id : null, local: P.ship ? [P.local.x, P.local.y, P.local.z] : null };
    if (Save.mode === 'client') return { v: 2, client: true, seed: st.seed, p: player, inv: G.Inv.slots, eq: G.Inv.equip, sel: G.Inv.sel, flags: st.flags, stats: st.stats, obj: st.obj, spawn: st.spawn, fruit: st.fruit, styles: st.styles, train: st.train, bounty: st.bounty, quests: st.quests, fac: st.fac };
    return {
      v: 2,
      st: { day: st.day, t: st.t, diff: st.diff, spawn: st.spawn, flags: st.flags, stats: st.stats, obj: st.obj, world: st.world, weather: [G.Weather.type, Math.round(G.Weather.timer)],
        seed: st.seed, cfg: st.cfg, clocks: st.clocks, pt: st.pt, pday: st.pday, fruit: st.fruit, styles: st.styles, train: st.train, bounty: st.bounty, quests: st.quests, fac: st.fac },
      p: player, inv: G.Inv.slots, eq: G.Inv.equip, sel: G.Inv.sel, b: G.Build.getState(), r: G.Res.getState(), ships: G.Ships.getState(), drops: G.Landmarks.getDrops(), gd: G.Drops.getState(),
    };
  }
  Save.save = function () {
    const st = G.state;
    if (!['playing', 'inventory', 'map', 'paused', 'sleeping', 'dead', 'journal', 'cheats'].includes(st.mode)) return false;
    if (st.gm === 'versus' || Save.mode === 'versus') return false;
    let data;
    try { data = snapshot(); } catch (e) { return false; }
    if (Save.mode === 'client') {
      try { localStorage.setItem(clientKey, JSON.stringify(data)); return true; } catch (e) { return false; }
    }
    const w = Save.world;
    if (!w) return false;
    const now = Date.now();
    w.fresh = false;
    Worlds.update(w.id, { day: st.day, played: now, time: (w.time || 0) + Math.round((now - playStart) / 1000), ver: G.VERSION, fresh: false, seed: st.seed || w.seed || null });
    w.time = (w.time || 0) + Math.round((now - playStart) / 1000);
    playStart = now;
    // Copia profunda ahora (el mundo sigue cambiando) y escritura en segundo plano
    idbPut(w.id, JSON.parse(JSON.stringify(data)));
    return true;
  };
})();
