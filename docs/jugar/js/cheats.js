// Modo creativo (trucos): se activa al crear la partida o en cualquier momento desde la pausa (botón
// «Activar/Desactivar modo creativo»), y se desactiva igual. Nunca en versus. En LAN cada jugador tiene el suyo.
// Su menú se abre con la tecla K o desde la pausa. Mientras está activado no se consiguen logros ni doblones.
// Siempre eres inmortal y no pasas hambre ni sed. Atajos: doble Espacio (volar), doble W (súper
// velocidad mientras mantengas W) y Ctrl + F (fabricar gratis).
(function () {
  'use strict';
  const G = window.G;
  const Ch = (G.Cheats = { on: { fly: false, free: false, fast: false } });
  const $ = (id) => document.getElementById(id);

  // G.state.creative (invitado de la LAN) manda sobre la configuración de la partida del anfitrión
  Ch.enabled = () => !!(G.state && G.state.gm !== 'versus' && G.state.mode !== 'menu' && (G.state.creative ?? (G.state.cfg && G.state.cfg.cheats)));
  Ch.available = () => !!(G.state && G.state.world && G.state.gm !== 'versus' && !(G.Modes && G.Modes.active));
  // Activar o desactivar el modo creativo en la partida en curso
  Ch.setCreative = function (on) {
    if (!Ch.available()) return;
    if (G.Net.active && !G.Net.isHost) G.state.creative = !!on;
    else {
      G.state.creative = undefined;
      G.state.cfg = Object.assign({}, G.state.cfg, { cheats: !!on });
      // La partida lo recuerda (y se ve la etiqueta 🪄 en la lista de partidas)
      if (G.Save.world) { G.Save.world.cheats = !!on; G.Worlds.update(G.Save.world.id, { cheats: !!on }); }
    }
    if (!on) { Ch.reset(); G.Player.vel.y = 0; if (G.state.mode === 'cheats') Ch.close(); }
    $('keyhintCheats').classList.toggle('hidden', !on);
    G.Audio.play(on ? 'win' : 'select');
    G.UI.banner(on ? '🪄 Modo creativo activado' : '🌿 Modo supervivencia',
      on ? 'Inmortal y sin hambre ni sed · <kbd>K</kbd> abre el menú creativo (volar, fabricar gratis, objetos, hora, clima y viajes) · No se consiguen logros ni doblones'
        : 'Modo creativo desactivado: vuelves a sobrevivir por tu cuenta');
  };
  Ch.toggleCreative = () => Ch.setCreative(!Ch.enabled());
  Ch.flag = (k) => Ch.enabled() && (k === 'god' || k === 'needs' || !!Ch.on[k]); // inmortal y sin hambre ni sed siempre
  Ch.reset = () => { for (const k in Ch.on) Ch.on[k] = false; };

  const TOGGLES = [
    ['fly', '🕊️ Volar', 'Doble Espacio', 'Espacio sube, C o Ctrl baja. Doble Espacio otra vez para aterrizar.'],
    ['fast', '💨 Súper velocidad', 'Doble W', 'Corres el doble de rápido mientras mantengas W.'],
    ['free', '🛠️ Fabricar gratis', 'Ctrl + F', 'Fabrica sin materiales, sin estación y sin aprender la receta.'],
  ];
  const TIMES = [['🌅 Amanecer', 6], ['☀️ Mediodía', 12], ['🌇 Atardecer', 18.5], ['🌙 Noche', 22.5]];
  const WEATHER = [['☀️ Despejado', 'clear'], ['🌧️ Lluvia', 'rain'], ['⛈️ Tormenta', 'storm']];

  Ch.open = function () {
    if (!Ch.enabled() || G.state.mode !== 'playing') return;
    G.state.mode = 'cheats';
    G.Main.releasePointer();
    $('cheats').classList.remove('hidden');
    render();
  };
  Ch.close = function () {
    if (G.state.mode !== 'cheats') return;
    $('cheats').classList.add('hidden');
    G.state.mode = 'playing';
    G.Main.lockPointer();
  };
  Ch.toggle = () => (G.state.mode === 'cheats' ? Ch.close() : Ch.open());

  function render() {
    const host = G.Net.authority();
    $('chToggles').innerHTML = TOGGLES.map(([k, n, key, d]) => `<label class="ch-toggle${Ch.on[k] ? ' on' : ''}" title="${d}"><input type="checkbox" data-k="${k}"${Ch.on[k] ? ' checked' : ''}/> ${n}<kbd class="ch-key">${key}</kbd><small>${d}</small></label>`).join('');
    $('chTime').innerHTML = TIMES.map(([n, h]) => `<button class="btn small" data-h="${h}"${host ? '' : ' disabled'}>${n}</button>`).join('');
    $('chWeather').innerHTML = WEATHER.map(([n, w]) => `<button class="btn small" data-w="${w}"${host ? '' : ' disabled'}>${n}</button>`).join('');
    $('chHostNote').classList.toggle('hidden', host);
    $('chTp').innerHTML = G.Arch.islands.filter((s) => s.main || s.type === 'arrecife' || s.type === 'islote').slice(0, 12)
      .map((s) => `<button class="btn small" data-i="${s.id}">${s.name}</button>`).join('');
    const sel = $('chItem');
    if (!sel.options.length) {
      sel.innerHTML = Object.entries(G.ITEMS).sort((a, b) => a[1].n.localeCompare(b[1].n, 'es')).map(([id, it]) => `<option value="${id}">${it.i} ${it.n}</option>`).join('');
      sel.value = 'madera';
    }
  }

  function bind() {
    $('cheatsClose').onclick = Ch.close;
    $('chOff').onclick = () => Ch.setCreative(false);
    $('chToggles').onchange = (e) => {
      const k = e.target.dataset.k;
      if (!k) return;
      Ch.on[k] = e.target.checked;
      if (k === 'fly' && !Ch.on.fly) G.Player.vel.y = 0;
      render();
    };
    $('chGive').onclick = () => {
      const id = $('chItem').value, n = Math.max(1, Math.min(999, +$('chQty').value || 1));
      if (G.ITEMS[id]) G.Game.give(id, n);
    };
    $('chTime').onclick = (e) => {
      const h = +e.target.dataset.h;
      if (!e.target.dataset.h || !G.Net.authority()) return;
      const t = h / 24, z = G.Clock.zone;
      if (z >= 0 && G.Clock.of(z)) G.Clock.of(z).t = t;
      G.state.pt = t;
      G.UI.msg(`🕒 Ahora son las ${String(Math.floor(h)).padStart(2, '0')}:${h % 1 ? '30' : '00'}.`, 'info');
    };
    $('chWeather').onclick = (e) => {
      const w = e.target.dataset.w;
      if (!w || !G.Net.authority()) return;
      G.Weather.set(w, w === 'clear' ? 300 : 120);
    };
    $('chTp').onclick = (e) => {
      const i = e.target.dataset.i;
      if (i === undefined) return;
      const s = G.Arch.byId(+i);
      if (!s) return;
      const P = G.Player;
      if (P.ship) G.Ships.leave(true);
      const sp = G.Arch.beachSpawn(s, Math.random() * Math.PI * 2);
      P.reset(sp.x, sp.z, sp.yaw);
      Ch.close();
      G.UI.banner(s.name, 'Teletransporte');
    };
  }

  // Atajos de teclado (en partida, con el ratón capturado). Devuelve true si la tecla era un atajo.
  let lastSpace = 0, lastW = 0;
  const say = (k) => G.UI.msg(k === 'fly' ? (Ch.on.fly ? '🕊️ <b>Volar</b> activado · <kbd>Espacio</kbd> sube, <kbd>C</kbd>/<kbd>Ctrl</kbd> baja · doble <kbd>Espacio</kbd> para aterrizar' : '🕊️ Volar desactivado')
    : k === 'free' ? `🛠️ <b>Fabricar gratis</b> ${Ch.on.free ? 'activado' : 'desactivado'}` : '💨 Súper velocidad', 'info', 'ch' + k + (Ch.on[k] ? 1 : 0));
  Ch.keyDown = function (e) {
    if (!Ch.enabled() || e.repeat) return false;
    const now = performance.now();
    if (e.code === 'KeyF' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault(); // que no se abra el buscador del navegador
      Ch.on.free = !Ch.on.free; say('free');
      return true;
    }
    if (e.code === 'Space') {
      if (now - lastSpace < 320) { Ch.on.fly = !Ch.on.fly; if (!Ch.on.fly) G.Player.vel.y = 0; lastSpace = 0; say('fly'); }
      else lastSpace = now;
    }
    if (e.code === 'KeyW') {
      if (now - lastW < 320 && !Ch.on.fast) { Ch.on.fast = true; say('fast'); }
      lastW = now;
    }
    return false;
  };
  // La súper velocidad dura mientras mantienes W
  Ch.keyUp = (e) => { if (e.code === 'KeyW') Ch.on.fast = false; };

  // Efectos que se aplican cada fotograma (los demás se consultan en player.js y game.js)
  Ch.update = function (dt) {
    if (!Ch.enabled()) return;
    const P = G.Player, S = P.stats;
    S.hunger = 100; S.thirst = 100; S.stamina = 100; S.temp = 55; P.oxy = 100;
    S.health = Math.max(S.health, 100); P.sick = 0; P.poison = 0;
  };

  document.addEventListener('DOMContentLoaded', bind);
  if (document.readyState !== 'loading') bind();
})();
