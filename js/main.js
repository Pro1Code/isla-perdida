// Arranque, bucle principal, entrada (teclado/ratón), pantallas, multijugador (menú y lobby) y calidad gráfica
(function () {
  'use strict';
  const G = window.G, U = G.U;
  const Main = (G.Main = {});
  const Input = (G.Input = { keys: {}, mouseL: false, locked: false });
  const $ = (id) => document.getElementById(id);
  let renderer, scene, camera, clock, canvas, menuAng = 0, suppressPause = false, lastFrame = 0;
  let fpsFrames = 0, fpsTime = 0, fpsLow = 0, fpsWarned = false;
  const focus = new THREE.Vector3();
  G.chatOpen = false;

  // ------------------------------------------------------------------ calidad
  const Q_ORDER = ['high', 'med', 'low'];
  function getQuality() {
    try { const q = localStorage.getItem('isla_quality2'); if (Q_ORDER.includes(q)) return q; } catch (e) { /* nada */ }
    return 'med';
  }
  function applyPixelRatio() {
    // Alta: resolución nativa (máx. 1.5x) · Media: 1x · Baja: 0.75x
    const dpr = window.devicePixelRatio || 1;
    const ratio = Main.quality === 'high' ? Math.min(dpr, 1.5) : Math.min(dpr, 1) * G.World.QUALITY[Main.quality].ratio;
    renderer.setPixelRatio(ratio);
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  function setQuality(q) {
    try { localStorage.setItem('isla_quality2', q); } catch (e) { /* sin almacenamiento */ }
    const prevSoft = Main.quality && G.World.QUALITY[Main.quality].soft;
    Main.quality = q;
    const Q = G.World.QUALITY[q];
    applyPixelRatio();
    G.World.setQuality(q);
    renderer.shadowMap.type = Q.soft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    if (prevSoft !== undefined && prevSoft !== Q.soft) scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => (m.needsUpdate = true)); });
    document.querySelectorAll('#setQuality button').forEach((b) => b.classList.toggle('on', b.dataset.q === q));
  }
  Main.setQuality = (q) => setQuality(q);

  // Cede el control para que se pinte el texto de carga (sin depender de requestAnimationFrame,
  // que se pausa si la pestaña está en segundo plano)
  const nextFrame = () => new Promise((r) => setTimeout(r, 40));
  const setLoad = (t) => ($('loadText').textContent = t);
  // Pantalla de carga durante la partida (generar el archipiélago tarda un momento)
  Main.loading = async function (text) {
    if (!text) { $('loading').classList.add('hidden'); return; }
    setLoad(text);
    $('loading').classList.remove('hidden');
    await nextFrame(); await nextFrame();
  };

  G.boot = async function () {
    window.__gameStarted = true;
    const q0 = getQuality();
    renderer = new THREE.WebGLRenderer({ antialias: q0 !== 'low', powerPreference: 'high-performance' });
    renderer.shadowMap.enabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.5;
    G.renderer = renderer;
    canvas = renderer.domElement;
    $('game').appendChild(canvas);
    scene = G.scene = new THREE.Scene();
    camera = G.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 5000);
    scene.add(camera);

    setLoad('Esculpiendo la Isla Perdida…'); await nextFrame();
    G.World.build(scene);
    setLoad('Plantando árboles…'); await nextFrame();
    G.Res.generate(scene);
    setLoad('Preparando el campamento…'); await nextFrame();
    G.Build.init(scene);
    G.Landmarks.build(scene);
    G.Weather.build(scene);
    G.Fishing.build(scene);
    G.Player.init(scene, camera);
    G.UI.init();
    G.Player.pos.set(G.World.spawn.x, G.height(G.World.spawn.x, G.World.spawn.z), G.World.spawn.z);
    setQuality(q0);
    bindInput();
    await G.Worlds.migrate();
    bindMenus();
    setLoad('Compilando sombreadores…'); await nextFrame();
    G.state.t = 0.3;
    G.World.update(0.016, G.state.t, camera, focus);
    renderer.compile(scene, camera);
    clock = new THREE.Clock();
    $('loading').classList.add('hidden');
    Main.showScreen('menu');
    requestAnimationFrame(loop);
    // Si la pestaña queda en segundo plano, el anfitrión sigue simulando el mundo
    setInterval(() => { if (performance.now() - lastFrame > 400 && G.Net.active && G.Net.inWorld) tick(0.25, false); }, 250);
    if (window.islaDesktop && window.islaDesktop.onReady) window.islaDesktop.onReady();
  };

  // ------------------------------------------------------------------ pantallas
  const SCREENS = ['menu', 'pause', 'dead', 'win'];
  Main.showScreen = function (name) {
    for (const s of SCREENS) $(s).classList.toggle('hidden', s !== name);
    $('hud').classList.toggle('hidden', !(name === null || name === 'pause' || name === 'dead'));
    if (name === 'menu') {
      G.Save.setMode('world', null);
      G.Menus.show('menuMain');
      G.state.mode = 'menu';
      G.World.mist = 0;
      G.Weather.set('clear', 150);
      G.Audio.setRain(0);
      G.Player.setHidden(true);
      G.Build.updateGhost(null);
      G.Ships.updateGhost(null);
      G.UI.el.inventory.classList.add('hidden');
      G.UI.el.bigmap.classList.add('hidden');
      $('cheats').classList.add('hidden');
      G.UI.closeJournal();
      G.Story.close();
      G.UI.closeChat();
      G.Player.zoom = 0;
    }
    if (G.Menus.inGame()) G.Menus.closeInGame(true);
    $('clickToPlay').classList.add('hidden');
    $('pauseNet').classList.toggle('hidden', !G.Net.active);
  };
  Main.lockPointer = function () {
    if (G.Story && G.Story.dialog) return;
    try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignorar */ }
  };
  Main.releasePointer = function () {
    if (document.pointerLockElement) { suppressPause = true; document.exitPointerLock(); }
  };
  function startPlaying() {
    G.Player.setLook(G.Profile.lookHex());
    G.Player.refreshCosmetics();
    Main.showScreen(null);
    G.state.mode = 'playing';
    G.Audio.init();
    G.Audio.resume();
    G.Audio.setVolumes();
    Main.lockPointer();
    fpsLow = 0; fpsWarned = false;
    const cheats = G.Cheats.enabled();
    $('keyhintCheats').classList.toggle('hidden', !cheats);
    if (cheats) setTimeout(() => G.UI.msg('🪄 Trucos activados: pulsa <kbd>K</kbd> para abrir el menú de trucos.', 'info'), 1500);
  }
  Main.startPlaying = startPlaying;
  Main.pause = function () {
    if (G.state.mode !== 'playing') return;
    G.state.mode = 'paused';
    Input.keys = {}; Input.mouseL = false;
    Main.showScreen('pause');
    if (G.Net.active) $('pauseNet').textContent = '🌐 Partida LAN: el mundo sigue en marcha mientras estás en pausa.';
    $('btnSave').classList.toggle('hidden', G.state.gm === 'versus');
    $('btnPauseCheats').classList.toggle('hidden', !G.Cheats.enabled());
  };
  function resume() {
    Main.showScreen(null);
    G.state.mode = 'playing';
    Main.lockPointer();
  }
  function quitToMenu() {
    G.Save.save();
    G.Net.disconnect();
    G.Modes.stop();
    Main.showScreen('menu');
  }

  // Empieza o continúa una partida guardada (un jugador o, como anfitrión, multijugador)
  async function playWorld(w) {
    const cfg = { diff: w.diff, death: w.death || 'half', cheats: !!w.cheats };
    G.Save.setWorld(w);
    if (w.fresh) { await G.Game.newGame(w.diff, { mode: 'coop', seed: w.seed || undefined, cfg }); return true; }
    const data = await G.Save.loadWorld(w);
    if (!data) { await G.Game.newGame(w.diff, { mode: 'coop', seed: w.seed || undefined, cfg }); return true; }
    await G.Game.loadGame(data, { cfg });
    G.Cheats.reset();
    return true;
  }
  Main.playSingle = async function (w) {
    const fresh = w.fresh;
    await playWorld(w);
    if (fresh && G.Cinema) G.Cinema.play(() => startPlaying());
    else startPlaying();
  };

  // ------------------------------------------------------------------ menús
  function bindMenus() {
    $('btnResume').onclick = resume;
    $('btnSave').onclick = () => { G.UI.msg(G.Save.save() ? '💾 Partida guardada' : 'No se pudo guardar', 'info'); resume(); };
    // Configuración y Logros: se abren en la misma ventana que en el menú principal
    $('btnPauseAch').onclick = () => G.Menus.openInGame('ach');
    $('btnPauseBounty').onclick = () => G.Bounty.open();
    $('btnPauseSettings').onclick = () => G.Menus.openInGame('settings');
    $('btnPauseCheats').onclick = () => { resume(); setTimeout(() => G.Cheats.open(), 60); };
    $('btnQuit').onclick = quitToMenu;
    $('btnRespawn').onclick = () => { G.Game.respawn(); resume(); };
    $('btnDeadMenu').onclick = () => { if (G.Modes.deathRule() !== 'out') G.Game.respawn(); quitToMenu(); };
    $('btnWinMenu').onclick = () => { G.Net.disconnect(); G.Modes.stop(); Main.showScreen('menu'); };
    $('clickToPlay').onclick = () => { $('clickToPlay').classList.add('hidden'); Main.lockPointer(); };
    G.Menus.init();
    bindMultiplayerMenu();
  }

  // ------------------------------------------------------------------ multijugador: partidas, unirse y lobby
  let hostWorld = null;
  function mpHome(status) {
    G.Menus.show('menuMP');
    const ok = G.Net.available();
    $('mpFile').classList.toggle('hidden', ok);
    $('mpHome').classList.toggle('hidden', !ok);
    $('mpLobby').classList.add('hidden');
    $('mpStatus').innerHTML = status || '';
    $('mpMe').textContent = G.Profile.name();
    G.Menus.renderWorlds($('mpList'), 'mp', (w) => hostGame(w, 'coop'));
  }
  Main.mpHome = mpHome;
  async function connect(addr) {
    const name = G.Profile.name(), color = G.Profile.look().shirt;
    $('mpStatus').textContent = 'Conectando…';
    document.querySelectorAll('#mpHome button').forEach((b) => (b.disabled = true));
    try {
      return await G.Net.connect(name, color, addr ? (addr.includes(':') ? addr : addr + ':8080') : null);
    } catch (e) {
      $('mpStatus').innerHTML = e && e.message === 'full' ? '❌ La partida está llena (máximo 8 jugadores).' :
        `❌ No hay ninguna partida en <b>${G.Net.esc(addr || location.host || 'localhost:8080')}</b>.<br>` +
        (addr ? 'Revisa la IP que ve el anfitrión en su pantalla y que estéis en la misma red.' : 'Para crear una partida abre el juego instalado (o <b>Iniciar servidor LAN.bat</b>).');
      return null;
    } finally {
      document.querySelectorAll('#mpHome button').forEach((b) => (b.disabled = false));
    }
  }
  function enterLobby(w) {
    G.Audio.init();
    $('mpHome').classList.add('hidden');
    $('mpLobby').classList.remove('hidden');
    $('mpStatus').textContent = '';
    if (w.host) Main.becameHostInLobby();
    else joinAsGuest();
    Main.refreshLobby();
  }
  function joinAsGuest() {
    G.Save.setMode('client', G.Net.hostAddr + '_' + G.Net.name);
    G.Net.waiting = true;
    G.Net.send({ t: 'reqWorld' });
    $('mpLobbyText').innerHTML = '✅ Conectado. Esperando a que el anfitrión 👑 empiece la partida…';
  }
  // world: partida multijugador guardada (amistoso) · mode: 'coop' o 'versus'
  async function hostGame(world, mode) {
    hostWorld = world;
    const w = await connect(null);
    if (!w) return;
    G.Net.lobbyCfg.mode = mode;
    G.Net.lobbyCfg.world = world ? { name: world.name, diff: world.diff, death: world.death, cheats: !!world.cheats, day: world.fresh ? 0 : world.day } : null;
    if (!w.host) G.UI.msg('Ya había un anfitrión en este servidor: entras como invitado.', 'warn');
    enterLobby(w);
  }
  Main.hostNewWorld = (w) => hostGame(w, 'coop');

  function bindMultiplayerMenu() {
    try { $('mpAddr').value = localStorage.getItem('isla_mp_addr') || ''; } catch (e) { /* nada */ }
    // Opciones del versus
    $('vsFormat').innerHTML = Object.keys(G.Modes.FORMATS).map((f) => `<option value="${f}">${f.replace(/v/g, ' vs ')}</option>`).join('');
    $('vsDeath').innerHTML = Object.entries(G.Modes.DEATH).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');

    $('btnMP').onclick = () => mpHome();
    $('mpNewWorld').onclick = () => G.Menus.openCreate('mp');
    $('mpVersus').onclick = () => hostGame(null, 'versus');
    $('mpJoin').onclick = async () => {
      const addr = $('mpAddr').value.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      try { localStorage.setItem('isla_mp_addr', addr); } catch (e) { /* nada */ }
      const w = await connect(addr);
      if (w) enterLobby(w);
    };
    $('mpAddr').onkeydown = (e) => { if (e.key === 'Enter') $('mpJoin').click(); };
    document.querySelectorAll('#mpVs select, #mpVs input').forEach((i) => (i.onchange = () => { readVsCfg(); G.Net.sendLobby(); Main.refreshLobby(); }));
    $('mpTeams').onclick = (e) => { const b = e.target.closest('button[data-t]'); if (b) G.Net.pickTeam(+b.dataset.t); };
    $('vsBalance').onclick = () => { if (!G.Net.isHost) return; balanceTeams(true); G.Net.sendLobby(); Main.refreshLobby(); };
    const hostStart = async (fn, versus) => {
      if (!versus) G.Save.setWorld(hostWorld); else G.Save.setMode('versus');
      await fn();
      G.Net.startWorld();
      startPlaying();
    };
    $('mpStart').onclick = () => {
      if (!G.Net.isHost) return;
      // Si el anfitrión anterior se fue, el nuevo anfitrión empieza una partida nueva
      if (!hostWorld) hostWorld = G.Worlds.create({ kind: 'mp', name: G.Worlds.freeName('Partida de ' + G.Profile.name()), diff: 1 });
      hostStart(() => playWorld(hostWorld), false);
    };
    $('vsStart').onclick = () => {
      readVsCfg();
      balanceTeams(false);
      const cfg = G.Net.lobbyCfg.cfg, assign = Object.assign({}, G.Net.lobbyCfg.assign);
      const used = new Set(Object.values(assign));
      if (used.size < 2) { $('vsWarn').textContent = '⚠ Hacen falta jugadores en al menos 2 equipos.'; return; }
      if (!cfg.treasure && !cfg.ctf && !cfg.sink) { $('vsWarn').textContent = '⚠ Elige al menos una condición de victoria.'; return; }
      $('vsWarn').textContent = '';
      G.Net.sendLobby();
      hostStart(() => G.Game.newGame(cfg.diff, { mode: 'versus', cfg, assign }), true);
    };
  }
  function readVsCfg() {
    const c = G.Net.lobbyCfg;
    c.cfg = {
      format: $('vsFormat').value, treasure: $('vsTreasure').checked, ctf: $('vsCtf').checked, caps: +$('vsCaps').value, sink: $('vsSink').checked,
      minutes: +$('vsMinutes').value, truce: +$('vsTruce').value, death: $('vsDeath').value, structs: $('vsStructs').checked, ships: $('vsShips').checked, ff: $('vsFF').checked, diff: +$('vsDiff').value,
    };
  }
  function writeVsCfg(c) {
    if (!c) return;
    $('vsFormat').value = c.format; $('vsTreasure').checked = c.treasure; $('vsCtf').checked = c.ctf; $('vsCaps').value = c.caps; $('vsSink').checked = c.sink;
    $('vsMinutes').value = c.minutes; $('vsTruce').value = c.truce; $('vsDeath').value = c.death; $('vsStructs').checked = c.structs; $('vsShips').checked = c.ships; $('vsFF').checked = c.ff; $('vsDiff').value = c.diff;
  }
  // Reparte en equipos a quien no eligió (o a todos si se pide equilibrar)
  function balanceTeams(all) {
    const c = G.Net.lobbyCfg, sizes = G.Modes.FORMATS[c.cfg.format], n = sizes.length;
    const ids = [G.Net.myId, ...G.Net.lobby.keys()];
    if (all) c.assign = {};
    for (const id of Object.keys(c.assign)) if (!ids.includes(+id) || c.assign[id] >= n) delete c.assign[id];
    for (const id of ids) {
      if (c.assign[id] !== undefined) continue;
      const count = Array.from({ length: n }, (_, t) => Object.values(c.assign).filter((v) => v === t).length);
      c.assign[id] = count.indexOf(Math.min(...count));
    }
  }
  Main.becameHostInLobby = function () {
    G.Net.waiting = false;
    if (!G.Net.lobbyCfg.cfg) G.Net.lobbyCfg.cfg = Object.assign({}, G.Modes.DEFAULT_VS);
    writeVsCfg(G.Net.lobbyCfg.cfg);
    $('mpLobbyText').innerHTML = G.Net.lobbyCfg.mode === 'versus' ? '👑 Eres el <b>anfitrión</b> del versus: elige las reglas y los equipos.' : '👑 Eres el <b>anfitrión</b>: tu equipo simula el mundo. Cuando estéis todos, empieza la partida.';
    G.Net.sendLobby();
    showLanIps();
  };
  // IP que deben usar los amigos para unirse (app de escritorio o servidor.py)
  async function showLanIps() {
    let info = null;
    try { info = window.islaDesktop ? await window.islaDesktop.info() : await (await fetch('/lan-info')).json(); } catch (e) { /* sin datos */ }
    const el = $('mpIps');
    if (!info || !info.ips || !info.ips.length) { el.classList.add('hidden'); return; }
    const addr = info.ips.map((ip) => `<b>${ip}${info.port && info.port !== 8080 ? ':' + info.port : ''}</b>`).join(' o ');
    el.innerHTML = `📡 Tus amigos se unen escribiendo ${addr} en «IP del anfitrión» (o abriendo <b>http://${info.ips[0]}:${info.port || 8080}</b> en su navegador).`;
    el.classList.remove('hidden');
  }
  const DIFF_NAMES = ['Fácil', 'Normal', 'Difícil'];
  Main.refreshLobby = function () {
    const el = $('mpPlayers');
    if (!el) return;
    const N = G.Net, M = G.Modes, c = N.lobbyCfg;
    const tm = (id) => (c.mode === 'versus' && c.assign[id] !== undefined ? ` <span class="team-dot" style="background:${M.teamColor(c.assign[id])}"></span>` : '');
    const rows = [`<li><i style="background:${N.esc(N.color)}"></i>${N.esc(N.name)} (tú)${N.isHost ? ' 👑' : ''}${tm(N.myId)}</li>`];
    const verOf = (id) => (id === N.myId ? G.VERSION : ((N.lobby.get(id) || {}).ver || '2.0.0'));
    const hostVer = verOf(N.hostId), odd = (id) => verOf(id) !== hostVer;
    const vtag = (id) => (odd(id) ? ` <span class="warn-text" title="El anfitrión usa la ${N.esc(hostVer)}">⚠ v${N.esc(verOf(id))}</span>` : '');
    rows[0] = rows[0].replace('</li>', vtag(N.myId) + '</li>');
    for (const [id, p] of N.lobby) rows.push(`<li><i style="background:${N.esc(p.color)}"></i>${N.esc(p.name)}${id === N.hostId ? ' 👑' : ''}${tm(id)}${vtag(id)}</li>`);
    if ([N.myId, ...N.lobby.keys()].some(odd)) rows.push(`<li class="warn-text">⚠ Hay jugadores con otra versión del juego. Para evitar fallos, todos deben jugar la ${N.esc(hostVer)} (la del anfitrión).</li>`);
    el.innerHTML = rows.join('');
    const vs = c.mode === 'versus', wi = c.world;
    const worldText = wi ? `🏝️ <b>${N.esc(wi.name)}</b> · ${DIFF_NAMES[wi.diff] || 'Normal'} · ${wi.day ? 'día ' + wi.day : 'mundo nuevo'}${wi.cheats ? ' · 🪄 con trucos (no se consiguen logros)' : ''}` : '🏝️ Partida amistosa nueva';
    $('mpCoop').classList.toggle('hidden', vs || !N.isHost);
    $('mpWorldInfo').innerHTML = worldText + '<br><small class="muted">Todos aparecen juntos en la Isla Perdida y siguen la historia. La partida se guarda en el equipo del anfitrión.</small>';
    $('mpCoopGuest').classList.toggle('hidden', vs || N.isHost);
    $('mpCoopGuest').innerHTML = `🤝 Modo amistoso · ${worldText}<br>Esperando a que el anfitrión empiece…`;
    $('mpVs').classList.toggle('hidden', !vs);
    if (vs && c.cfg) {
      if (!N.isHost) writeVsCfg(c.cfg);
      document.querySelectorAll('#mpVs select, #mpVs input').forEach((i) => (i.disabled = !N.isHost));
      $('vsStart').classList.toggle('hidden', !N.isHost);
      $('vsBalance').classList.toggle('hidden', !N.isHost);
      const n = M.FORMATS[c.cfg.format].length, sizes = M.FORMATS[c.cfg.format];
      $('mpTeams').innerHTML = Array.from({ length: n }, (_, t) => {
        const members = Object.entries(c.assign).filter(([, v]) => v === t).map(([id]) => N.esc(N.nameOf(+id)));
        return `<button data-t="${t}" class="team-btn${c.assign[N.myId] === t ? ' on' : ''}" style="--tc:${M.teamColor(t)}"><b>${M.teamName(t)}</b> <span class="muted">${members.length}/${sizes[t]}</span><br><small>${members.join(', ') || '—'}</small></button>`;
      }).join('');
      $('vsCapsRow').classList.toggle('hidden', !c.cfg.ctf);
    }
    G.UI.refreshPlayerList();
  };
  Main.joinWorld = async function (snap) {
    G.Net.inWorld = true;
    if (snap.st.gm === 'versus') G.Save.setMode('versus');
    await G.Game.joinWorld(snap, G.Save.load());
    G.Cheats.reset();
    startPlaying();
  };
  Main.onNetLost = function () {
    const inGame = !['menu', 'loading'].includes(G.state.mode);
    if (inGame && G.state.mode !== 'won') {
      G.Save.save();
      Main.releasePointer();
      Main.showScreen('menu');
    }
    G.Modes.stop();
    mpHome('⚠ Se perdió la conexión con la partida LAN.');
  };

  // ------------------------------------------------------------------ entrada
  function bindInput() {
    window.addEventListener('keydown', (e) => {
      // Escribiendo en el buscador del recetario: las teclas no son atajos del juego
      if (e.target && e.target.id === 'bookSearch') { if (e.code === 'Escape' || e.code === 'Tab') { e.preventDefault(); e.target.blur(); } return; }
      const mode = G.state.mode;
      if (mode === 'cinema') { if (['Space', 'Escape', 'Enter'].includes(e.code)) { e.preventDefault(); G.Cinema.skip(); } return; }
      if (G.chatOpen) {
        if (e.code === 'Enter') {
          e.preventDefault();
          const text = $('chatInput').value.trim();
          if (text) { G.Net.chat(text); G.UI.chatMsg(G.Net.name, G.Net.color, text); }
          G.UI.closeChat();
        }
        else if (e.code === 'Escape') G.UI.closeChat();
        return;
      }
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown'].includes(e.code) && mode !== 'menu') e.preventDefault();
      if (e.repeat && !['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) return;
      // Diálogo abierto: números para elegir, E / Esc para cerrar
      if (G.Story.dialog && mode === 'playing') {
        const n = /^Digit([1-9])$/.exec(e.code);
        if (n) G.Story.choose(+n[1] - 1);
        else if (e.code === 'Escape' || e.code === 'KeyE' || e.code === 'Enter') G.Story.choose(e.code === 'Enter' ? 0 : -1);
        return;
      }
      Input.keys[e.code] = true;
      if (mode === 'playing') {
        if (!Input.locked && e.code !== 'Escape') return;
        if (G.Ships.helmKey(e.code)) return;
        if (G.Cheats.keyDown(e)) return; // atajos de los trucos (doble Espacio, doble W, Ctrl + F)
        if (e.code === 'Tab' || e.code === 'KeyI') G.Game.openInventory();
        else if ((e.code === 'KeyT' || e.code === 'Enter') && G.Net.active) { e.preventDefault(); Input.keys = {}; G.UI.openChat(); }
        else if (e.code === 'KeyE') G.Game.interact();
        else if (e.code === 'KeyF' && !e.ctrlKey && !e.metaKey) G.Game.useHeld();
        else if (e.code === 'KeyG') G.Story.usePower();
        else if (e.code === 'KeyV') G.Player.toggleCam();
        else if (e.code === 'KeyM') G.Game.openMap();
        else if (e.code === 'KeyJ') G.Game.openJournal();
        else if (e.code === 'KeyX') G.Game.demolish();
        else if (e.code === 'KeyK') G.Cheats.open();
        else if (e.code === 'KeyQ') G.Styles.tech(0);
        else if (e.code === 'KeyB') G.Drops.dropHeld(e.shiftKey);
        else if (e.code === 'KeyZ') G.Styles.tech(1);
        else if (e.code === 'KeyR') {
          const tg = G.Game.target;
          if (tg && tg.kind === 'piece' && G.Ships.rotatePiece(tg)) G.Audio.play('select');
          else if (G.Player.ship && !G.Player.station && !G.Ships.itemType(G.Inv.heldId())) { if (G.Ships.applyLook(G.Player.ship)) G.Audio.play('select'); }
          else if (G.Ships.itemType(G.Inv.heldId())) { G.Ships.rot = (G.Ships.rot + Math.PI / 2) % (Math.PI * 2); G.Audio.play('select'); }
          else { G.Build.rotIdx = (G.Build.rotIdx + 1) % 4; G.Audio.play('select'); }
        }
        else if (/^Digit[1-8]$/.test(e.code)) { G.Inv.sel = +e.code.slice(5) - 1; G.Inv.changed(); G.Audio.play('select'); }
      } else if (mode === 'inventory') {
        if (e.code === 'Tab' || e.code === 'Escape' || e.code === 'KeyI') G.Game.closeInventory();
        else if (e.code === 'KeyB' && G.UI.hoverSlot !== null) { G.Drops.dropSlot(G.UI.hoverSlot, e.shiftKey ? 0 : 1); if (G.UI.infoSlot === G.UI.hoverSlot) G.UI.showInfo(G.UI.hoverSlot); }
      } else if (mode === 'map') {
        if (e.code === 'KeyM' || e.code === 'Escape') G.Game.closeMap();
      } else if (mode === 'journal') {
        if (e.code === 'KeyJ' || e.code === 'Escape') G.Game.closeJournal();
      } else if (mode === 'cheats') {
        if (e.code === 'KeyK' || e.code === 'Escape') G.Cheats.close();
      } else if (mode === 'paused') {
        if (e.code === 'Escape') { if (G.Menus.inGame()) G.Menus.closeInGame(); else resume(); }
      }
    });
    window.addEventListener('keyup', (e) => { Input.keys[e.code] = false; G.Cheats.keyUp(e); });
    window.addEventListener('blur', () => { Input.keys = {}; Input.mouseL = false; G.Player.zoom = 0; G.Cheats.on.fast = false; });
    canvas.addEventListener('mousedown', (e) => {
      if (G.state.mode !== 'playing') return;
      if (!Input.locked) { Main.lockPointer(); return; }
      if (G.chatOpen) return;
      if (e.button === 0) { Input.mouseL = true; G.Game.attack(); }
      else if (e.button === 2) {
        const h = G.Inv.heldId();
        if (h && G.ITEMS[h].spyglass) G.Player.zoom = 1; else G.Game.useHeld();
      }
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) Input.mouseL = false; if (e.button === 2) G.Player.zoom = 0; });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousemove', (e) => {
      if (!Input.locked || G.state.mode !== 'playing') return;
      if (G.Ships.aimInput(e.movementX, e.movementY)) return;
      const P = G.Player, k = (P.zoom ? 0.0006 : 0.0022) * G.Profile.set('sens'), inv = G.Profile.set('invY') ? -1 : 1;
      P.yaw -= e.movementX * k;
      P.pitch = U.clamp(P.pitch - e.movementY * k * inv, -1.45, 1.45);
    });
    window.addEventListener('wheel', (e) => {
      if (G.state.mode !== 'playing' || !Input.locked) return;
      G.Inv.sel = (G.Inv.sel + (e.deltaY > 0 ? 1 : -1) + 8) % 8;
      G.Inv.changed();
    }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      Input.locked = document.pointerLockElement === canvas;
      if (Input.locked) { $('clickToPlay').classList.add('hidden'); suppressPause = false; return; }
      Input.mouseL = false;
      if (G.chatOpen) G.UI.closeChat();
      if (suppressPause) { suppressPause = false; return; }
      if (G.state.mode === 'playing' && !G.Story.dialog) Main.pause();
    });
    window.addEventListener('resize', () => {
      // Al minimizar la ventana el tamaño puede ser 0: no se toca la cámara
      if (window.innerWidth < 2 || window.innerHeight < 2) return;
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
    window.addEventListener('beforeunload', () => G.Save.save());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { if (!G.Net.active) G.Audio.suspend(); }
      else if (G.state.mode !== 'menu') G.Audio.resume();
    });
  }

  // ------------------------------------------------------------------ bucle
  function tick(dt, render) {
    const st = G.state, P = G.Player;
    if (st.mode === 'cinema') {
      if (!render) return;
      G.Cinema.update(dt);
      G.Ships.update(dt);
      G.World.update(dt, st.t, camera, G.Cinema.focus);
      G.World.exposure *= G.Cinema.expMul || 1;
    } else if (st.mode === 'menu' || st.mode === 'loading') {
      if (!render) return;
      menuAng += dt * 0.025;
      st.t = 0.29;
      camera.position.set(Math.cos(menuAng) * 175, 42, Math.sin(menuAng) * 175);
      camera.lookAt(0, 4, 0);
      focus.set(Math.cos(menuAng) * 60, 0, Math.sin(menuAng) * 60);
      G.World.update(dt, st.t, camera, focus);
      G.Build.update(dt);
    } else {
      // En LAN el mundo nunca se detiene (pausa o muerte incluidas)
      const active = ['playing', 'inventory', 'map', 'sleeping', 'journal', 'cheats'].includes(st.mode) || (G.Net.active && ['paused', 'dead', 'won'].includes(st.mode));
      if (active) G.Game.update(dt);
      if (!render) return;
      if (st.spectate) spectateCam(dt); else P.updateVisuals(active ? dt : 0);
      focus.copy(st.spectate ? camera.position : P.pos);
      G.World.update(active ? dt : 0, st.t, camera, focus);
      G.UI.update(active ? dt : 0);
      if (active) {
        const h = G.height(P.pos.x, P.pos.z);
        const fire = G.Build.nearestLitFire(P.pos.x, P.pos.z);
        G.Audio.update(dt, { shore: U.clamp(1 - (h - 0.5) / 10, 0, 1), night: G.World.night, height: h, fireDist: fire ? fire.d : 99, sea: !G.Arch.landOf(P.pos.x, P.pos.z), gulls: G.Landmarks.inSchool(P.pos.x, P.pos.z) });
      }
      $('clickToPlay').classList.toggle('hidden', !(st.mode === 'playing' && !Input.locked && !G.Story.dialog));
    }
    G.Landmarks.update(dt, camera.position);
    const wxActive = !['menu', 'loading', 'won'].includes(st.mode) && (st.mode !== 'paused' || G.Net.active);
    G.Weather.update(dt, camera.position, wxActive);
    G.Res.updateVisibility(camera.position);
    G.World.updateGrass(camera.position);
  }
  // Eliminado en versus: la cámara sigue a un compañero de equipo
  let specAng = 0;
  function spectateCam(dt) {
    specAng += dt * 0.2;
    const mate = [...G.Net.peers.values()].find((p) => !p.dead && !p.out && p.team === G.Net.team) || [...G.Net.peers.values()].find((p) => !p.dead);
    const c = mate || G.Player.pos;
    camera.position.set(c.x + Math.cos(specAng) * 9, (c.y || 0) + 6, c.z + Math.sin(specAng) * 9);
    camera.lookAt(c.x, (c.y || 0) + 1.5, c.z);
    G.Player.setHidden(true);
  }
  // Avanza el juego a mano (pruebas automáticas con la ventana oculta)
  Main.debugStep = function (n = 1, dt = 1 / 30) {
    for (let i = 0; i < n; i++) tick(dt, true);
    renderer.toneMappingExposure = G.World.exposure;
    renderer.render(scene, camera);
  };
  function loop() {
    requestAnimationFrame(loop);
    lastFrame = performance.now();
    const dt = Math.min(0.05, clock.getDelta());
    tick(dt, true);
    renderer.toneMappingExposure = G.World.exposure;
    renderer.render(scene, camera);
    // FPS y aviso de rendimiento
    fpsFrames++; fpsTime += dt;
    if (fpsTime >= 1) {
      const fps = Math.round(fpsFrames / fpsTime);
      $('fps').textContent = G.Profile.set('fps') ? fps + ' FPS' : '';
      fpsFrames = 0; fpsTime = 0;
      if (G.state.mode === 'playing' && fps < 24) fpsLow++; else fpsLow = Math.max(0, fpsLow - 1);
      if (fpsLow >= 6 && !fpsWarned && Main.quality !== 'low') {
        fpsWarned = true;
        G.UI.msg('⚠ El juego va lento. Baja la calidad en Esc → Configuración → Gráficos.', 'warn');
      }
    }
  }
})();
