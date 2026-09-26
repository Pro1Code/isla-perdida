// Trucos: solo en las partidas creadas con "Activar trucos" (nunca en versus).
// Se abren con la tecla K o desde la pausa. En esas partidas no se consiguen logros ni doblones.
(function () {
  'use strict';
  const G = window.G;
  const Ch = (G.Cheats = { on: { god: false, needs: false, fly: false, free: false, fast: false } });
  const $ = (id) => document.getElementById(id);

  Ch.enabled = () => !!(G.state && G.state.cfg && G.state.cfg.cheats && G.state.gm !== 'versus' && G.state.mode !== 'menu');
  Ch.flag = (k) => Ch.enabled() && !!Ch.on[k];
  Ch.reset = () => { for (const k in Ch.on) Ch.on[k] = false; };

  const TOGGLES = [
    ['god', '🛡️ Invencible', 'No recibes daño.'],
    ['needs', '🍖 Sin hambre ni sed', 'Hambre, sed, energía y temperatura siempre llenas.'],
    ['fly', '🕊️ Volar', 'Espacio sube, C o Ctrl baja.'],
    ['free', '🛠️ Fabricar gratis', 'Fabrica sin materiales, sin estación y sin aprender la receta.'],
    ['fast', '💨 Súper velocidad', 'Te mueves el doble de rápido.'],
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
    $('chToggles').innerHTML = TOGGLES.map(([k, n, d]) => `<label class="ch-toggle${Ch.on[k] ? ' on' : ''}" title="${d}"><input type="checkbox" data-k="${k}"${Ch.on[k] ? ' checked' : ''}/> ${n}<small>${d}</small></label>`).join('');
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
    $('chToggles').onchange = (e) => {
      const k = e.target.dataset.k;
      if (!k) return;
      Ch.on[k] = e.target.checked;
      if (k === 'fly' && !Ch.on.fly) G.Player.vel.y = 0;
      render();
    };
    $('chHeal').onclick = () => {
      const P = G.Player, S = P.stats;
      Object.assign(S, { health: 100, hunger: 100, thirst: 100, stamina: 100, temp: 55 });
      P.sick = 0; P.poison = 0; P.oxy = 100;
      G.UI.msg('❤️ Estás como nuevo.', 'good');
    };
    $('chLearn').onclick = () => {
      const w = G.state.world;
      if (!w || !w.story) return;
      w.story.learned = w.story.learned || {};
      for (const r of G.RECIPES) if (r.learn) w.story.learned[r.learn] = 1;
      G.UI.msg('📜 Aprendiste todas las recetas.', 'good');
    };
    $('chMap').onclick = () => {
      const w = G.state.world;
      if (!w || !w.story) return;
      w.story.disc = w.story.disc || {};
      for (const s of G.Arch.islands) w.story.disc[s.id] = 1;
      G.UI.msg('🗺️ El mapa del archipiélago está completo.', 'good');
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

  // Efectos que se aplican cada fotograma (los demás se consultan en player.js y game.js)
  Ch.update = function (dt) {
    if (!Ch.enabled()) return;
    const P = G.Player, S = P.stats;
    if (Ch.on.needs) { S.hunger = 100; S.thirst = 100; S.stamina = 100; S.temp = 55; P.oxy = 100; }
    if (Ch.on.god) { S.health = Math.max(S.health, 100); P.sick = 0; P.poison = 0; P.oxy = Math.max(P.oxy, 50); }
  };

  document.addEventListener('DOMContentLoaded', bind);
  if (document.readyState !== 'loading') bind();
})();
