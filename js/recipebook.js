// Recetario: libro con todos los objetos del juego (nombre, imagen, dónde se consiguen y para qué sirven).
// Es una pestaña más de «Fabricación» en el inventario (como el libro de recetas de Minecraft).
// Las fuentes se calculan con los datos del propio juego (recetas, recursos de cada isla, animales, cofres,
// pesca y comercio), así que siempre están al día aunque se añadan objetos nuevos.
(function () {
  'use strict';
  const G = window.G;
  const Bk = (G.Book = { cat: 'all', q: '', focus: null });

  Bk.CATS = [['all', '📚 Todo'], ['mat', '🪵 Materiales'], ['food', '🍖 Comida y curas'], ['tool', '🪓 Herramientas y armas'], ['ropa', '🛡️ Ropa'],
    ['cons', '🏠 Construcción'], ['nav', '⚓ Barcos'], ['esp', '✨ Especiales']];
  const NAV = new Set(['canon', 'mascaron', 'bandera', 'red_pesca', 'balsa', 'canoa']);
  Bk.catOf = function (id) {
    const it = G.ITEMS[id];
    if (!it) return 'esp';
    if (it.fruit || it.read || it.compass || id === 'fragmento_mapa') return 'esp';
    if (it.eq) return 'ropa';
    if (it.place) return 'cons';
    if (it.ship || it.plano || it.rep || NAV.has(id) || id.startsWith('pieza_')) return 'nav';
    if (it.tool) return 'tool';
    if (it.use) return 'food';
    return 'mat';
  };
  const nm = (id) => (G.ITEMS[id] ? G.ITEMS[id].n : id);
  const link = (id) => `<a class="bk-link" data-book="${id}">${G.icon(id, 'xs')} ${nm(id)}</a>`;
  const islName = (type) => (G.Arch.TYPES[type] && G.Arch.TYPES[type].name) || type;
  const where = (txt) => (txt ? ` <span class="muted">— ${txt}</span>` : '');

  // ------------------------------------------------------------------ fuentes y usos
  let cache = null, cacheWorld = null;
  function learnText(k) {
    if (k.startsWith('style_')) { const D = G.Styles.DEF[k.slice(6)]; return `<span class="bk-lock">🔒 aprende el estilo ${D.name} con ${D.master}</span>`; }
    return '<span class="bk-lock">🔒 receta secreta: lleva al anciano Kalgor (aldea Shandara, Isla Tahuri) 4 pescados asados y 2 mazorcas de cacao</span>';
  }
  // Criaturas en lugares especiales (las demás salen de la fauna de cada isla)
  const PLACE = {
    boss: 'Isla Perdida, a partir del día 5', wolf: 'Isla Perdida, de noche', shark: 'mar abierto, si nadas en aguas hondas', dolphin: 'alta mar', whale: 'alta mar',
    serpent: 'alta mar, lejos de las islas', pirate: 'campamento pirata de la Isla Perdida', pirate_gun: 'campamento pirata de la Isla Perdida',
    pirate_boss: 'campamento pirata de la Isla Perdida', marine: 'barcos de la Marina Blanca, en alta mar', marine_gun: 'barcos de la Marina Blanca, en alta mar',
    marine_boss: 'barcos grandes de la Marina Blanca', ghost_pirate: 'el Holandés de las Mareas (de noche, en alta mar)', ghost_gun: 'el Holandés de las Mareas (de noche, en alta mar)',
    ghost_captain: 'el Holandés de las Mareas (de noche, en alta mar)', yeti: 'frente a la cueva de hielo de Isla Escarcha, desde el día 3', lavadragon: 'junto a las coladas de lava de Isla Brasa, desde el día 3',
  };
  const POOL = {
    supplies: 'cofres de suministros (campamentos abandonados)', treasure: 'cofres del tesoro (templo, cueva de hielo, cráter, altar de las ruinas e islotes)',
    sunken: 'cofres de naufragios y del fondo del arrecife (bucea)', barrel: 'barriles de botín que flotan en el mar',
  };
  const MANUAL = {
    agua_sucia: ['🥣 Llena un cuenco en un lago o manantial: con el cuenco en la mano, mira al agua y pulsa <kbd>E</kbd>'],
    pez_crudo: ['🎣 Pesca con la caña en el mar o en un lago, o instala una red de pesca en la popa de tu barco'],
    cuero: ['🎣 A veces sale enredado al pescar en el mar'],
    doblon: ['🗺️ Tesoros enterrados: lee un mapa del tesoro y desentiérralos con una pala', '📋 Encargos del tablón de la aldea Shandara (Isla Tahuri)'],
    mapa_tesoro: ['⚔️ A veces lo suelta un pirata al caer', '📦 A veces aparece en cofres'],
    pista_1: ['📜 Historia: en un cofre escondido de la Isla Perdida (sigue a tu tripulación)'],
    pista_2: ['📜 Historia: en otro cofre escondido de la Isla Perdida'],
    pista_3: ['📜 Historia: se la robó la capitana Hiena; derrótala en el campamento pirata'],
    log_mareas: ['📦 Historia: en el cofre del barco naufragado de la Isla Perdida'],
    diario: ['📦 Historia: en el cofre del barco naufragado de la Isla Perdida'],
    fragmento_mapa: ['🏴 Solo en el modo versus: búscalos por el archipiélago y llévalos a la bandera de tu equipo'],
    fruta_llama: ['🍇 Escondida en un cofre especial; al principio, el del borde del cráter de Isla Brasa'],
    fruta_hielo: ['🍇 Escondida en un cofre especial; al principio, el de la cueva de hielo de Isla Escarcha'],
    fruta_muelle: ['🍇 Escondida en un cofre especial; al principio, el del templo de Isla Tahuri'],
    fruta_humo: ['🍇 Escondida en un cofre especial; al principio, en un naufragio bajo el agua'],
    fruta_roca: ['🍇 Escondida en un cofre especial; al principio, en un barco naufragado'],
    gorro_piel: ['📦 Cofre del campamento junto a la cueva de hielo (Isla Escarcha)'],
    botas_nieve: ['📦 Cofre del campamento junto a la cueva de hielo (Isla Escarcha)'],
    botas_lava: ['📦 Cofre del borde del cráter (Isla Brasa)'],
  };
  const FRUIT_NOTE = '<span class="muted">Si alguien que comió una fruta muere, la fruta renace en otro cofre del archipiélago.</span>';

  function build() {
    const S = {}, add = (id, txt) => { if (G.ITEMS[id]) (S[id] = S[id] || []).push(txt); };
    // Recetas
    for (const r of G.RECIPES) {
      const req = Object.entries(r.req).map(([k, n]) => `${n} ${link(k)}`).join(' + ');
      add(r.id, `🛠️ Fabrícalo${r.n > 1 ? ` (salen ${r.n})` : ''}: ${req}${r.station ? ` <span class="muted">(${G.STATION_NAMES[r.station]})</span>` : ''}${r.learn ? ' ' + learnText(r.learn) : ''}`);
    }
    // Recursos del mundo: en qué islas está cada tipo
    const isl = {};
    for (const r of G.Res.list || []) {
      const I = G.Arch.byId(r.isl);
      if (I) (isl[r.kind] = isl[r.kind] || new Set()).add(islName(I.type));
    }
    for (const [key, k] of Object.entries(G.Res.KINDS || {})) {
      const places = isl[key] ? [...isl[key]].join(', ') : '';
      const verb = k.tool === 'hacha' ? `🪓 Tala: <b>${k.name}</b> (con hacha)` : k.tool === 'pico' ? `⛏️ Pica: <b>${k.name}</b> (con pico${k.minPower > 1 ? ' de hierro' : ''})` : k.gives ? `🌿 Recoge de: <b>${k.name}</b>` : `✋ Recoge del suelo: <b>${k.name}</b>`;
      const got = new Set([...(k.hit || []), ...(k.fin || []), ...(k.pick || []), ...(k.gives || [])].map((d) => d[0]));
      for (const id of got) add(id, verb + where(places));
      if (k.bonus) add(k.bonus[0], `⛏️ A veces al picar: <b>${k.name}</b>` + where(places));
      if (k.flint) add('silex', `⛏️ A veces al picar: <b>${k.name}</b>` + where(places));
    }
    // Animales y enemigos
    const C = G.Creatures, F = C.FAUNA || {};
    for (const [type, d] of Object.entries(C.DEF)) {
      if (!d.drops || !d.drops.length || d.friendly || d.dummy || d.npc) continue;
      const place = PLACE[type] || Object.keys(F).filter((t) => F[t].some((f) => f[0] === type)).map(islName).join(', ');
      const verb = d.human || d.bigBoss || d.boss || type === 'serpent' ? '⚔️ Derrota a' : '🏹 Caza';
      for (const [id] of d.drops) add(id, `${verb}: <b>${d.name}</b>` + where(place));
    }
    // Cofres y barriles
    for (const [pool, list] of Object.entries((G.Landmarks && G.Landmarks.POOLS) || {})) for (const [id] of list) add(id, `📦 En ${POOL[pool] || 'cofres'}`);
    // Comercio con Genbu
    for (const tr of (G.Story && G.Story.TRADES) || []) {
      add(tr.get[0], `🤝 Genbu te lo cambia <span class="muted">(aldea Shandara, Isla Tahuri)</span>: ${Object.entries(tr.give).map(([k, n]) => `${n} ${link(k)}`).join(' + ')} → ${tr.get[1]}`);
    }
    for (const [id, l] of Object.entries(MANUAL)) for (const t of l) add(id, t);
    for (const id in G.ITEMS) if (G.ITEMS[id].fruit) add(id, FRUIT_NOTE);
    // De lo más fácil a lo más difícil: fabricar, recoger, cazar, cofres y comercio, tesoros y, al final, los jefes
    const ORDER = [['🛠️'], ['🪓', '⛏️', '🌿', '✋', '🎣', '🥣', '🍇', '📜'], ['🏹'], ['📦', '🤝'], ['🗺️', '📋'], ['⚔️']];
    const pri = (s) => { const k = ORDER.findIndex((l) => l.some((e) => s.startsWith(e))); return k < 0 ? 9 : k; };
    for (const id in S) S[id].sort((a, b) => pri(a) - pri(b));
    // Usos: recetas que lo piden y comercio
    const uses = {};
    for (const r of G.RECIPES) for (const k in r.req) (uses[k] = uses[k] || new Set()).add(r.id);
    const trade = new Set();
    for (const tr of (G.Story && G.Story.TRADES) || []) for (const k in tr.give) trade.add(k);
    return { S, uses, trade };
  }
  function data() {
    if (!cache || cacheWorld !== G.state.world) { cache = build(); cacheWorld = G.state.world; }
    return cache;
  }
  Bk.sources = (id) => data().S[id] || ['❔ Explora el archipiélago: aparece en lugares especiales'];
  Bk.uses = (id) => [...(data().uses[id] || [])];
  // Texto sencillo (sin HTML) para las etiquetas al pasar el ratón
  Bk.plain = (id) => {
    const d = document.createElement('div');
    return Bk.sources(id).slice(0, 4).map((s) => { d.innerHTML = s; return '• ' + d.textContent; }).join('\n');
  };

  // ------------------------------------------------------------------ vista
  function entry(id) {
    const it = G.ITEMS[id], have = G.Inv.count(id), U = Bk.uses(id), tr = data().trade.has(id);
    let h = `<div class="bk-item${Bk.focus === id ? ' focus' : ''}" data-id="${id}"><div class="bk-ic">${G.icon(id)}</div><div class="bk-body">`;
    h += `<div class="bk-nm">${it.n}${have ? ` <span class="bk-have">tienes ${have}</span>` : ''}</div>`;
    if (it.d) h += `<div class="bk-ds">${it.d}</div>`;
    h += `<div class="bk-h">📍 Cómo conseguirlo</div><ul class="bk-src">${Bk.sources(id).map((s) => `<li>${s}</li>`).join('')}</ul>`;
    if (U.length || tr) h += `<div class="bk-h">🔧 Sirve para</div><div class="bk-uses">${U.map(link).join('')}${tr ? '<span class="bk-trade">🤝 comerciar con Genbu</span>' : ''}</div>`;
    return h + '</div></div>';
  }
  function list() {
    const q = Bk.q.trim().toLowerCase();
    const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const nq = norm(q);
    const ids = Object.keys(G.ITEMS).filter((id) => (Bk.cat === 'all' || Bk.catOf(id) === Bk.cat) && (!nq || norm(G.ITEMS[id].n).includes(nq) || norm(G.ITEMS[id].d || '').includes(nq)));
    return ids.length ? ids.map(entry).join('') : '<div class="muted bk-empty">No hay ningún objeto con ese nombre.</div>';
  }
  Bk.render = function (box) {
    box.innerHTML = `<div class="bk-head"><input id="bookSearch" type="text" placeholder="🔎 Busca un objeto (madera, lingote, perla…)" value="${Bk.q.replace(/"/g, '&quot;')}" autocomplete="off">`
      + `<div class="bk-cats">${Bk.CATS.map(([k, n]) => `<button data-bcat="${k}" class="${Bk.cat === k ? 'on' : ''}">${n}</button>`).join('')}</div></div><div id="bookList">${list()}</div>`;
    const inp = box.querySelector('#bookSearch');
    inp.addEventListener('input', () => { Bk.q = inp.value; Bk.focus = null; box.querySelector('#bookList').innerHTML = list(); });
    if (Bk.focus) { const e = box.querySelector(`.bk-item[data-id="${Bk.focus}"]`); if (e) e.scrollIntoView({ block: 'start' }); }
  };
  // Solo actualiza lo que llevas encima (sin rehacer la lista ni perder la búsqueda)
  Bk.refreshCounts = function (box) {
    for (const e of box.querySelectorAll('.bk-item')) {
      const id = e.dataset.id, n = G.Inv.count(id), nmEl = e.querySelector('.bk-nm');
      const cur = nmEl.querySelector('.bk-have');
      if (n && cur) cur.textContent = 'tienes ' + n;
      else if (n) nmEl.insertAdjacentHTML('beforeend', ` <span class="bk-have">tienes ${n}</span>`);
      else if (cur) cur.remove();
    }
  };
  // Abre el recetario en la ficha de un objeto
  Bk.open = function (id) {
    Bk.focus = id; Bk.q = ''; Bk.cat = 'all';
    G.UI.craftCat = 'libro'; G.UI.bookShown = false;
    G.UI.renderRecipes();
  };
})();
