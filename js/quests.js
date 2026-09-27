// Tablón de encargos de la aldea Shandara (Isla Tahuri): los aldeanos piden ayuda
// (cazar, traer materiales, explorar islas, desenterrar tesoros) y pagan en doblones.
// Hasta 3 encargos a la vez; los cumplidos se cobran solos (las entregas, en el tablón).
// Cada jugador tiene los suyos (G.state.quests, se guarda con su partida).
(function () {
  'use strict';
  const G = window.G, U = G.U;
  const Q = (G.Quests = {});
  const $ = (id) => document.getElementById(id);
  const esc = (s) => G.Net.esc(String(s));
  const MAX = 3;

  const WHO = ['Wypar', 'Aisha', 'Kamakiro', 'Laka', 'Brahan', 'Genbu', 'Anciano Kalgor'];
  // [tipo, cuántos, por qué, dificultad, nombre (singular o plural)]
  const HUNT = [
    ['boar', 3, 'Los jabalíes destrozan los huertos de la aldea.', 1, 'jabalíes'],
    ['crab', 5, 'Los cangrejos se comen las redes de pesca.', 0, 'cangrejos'],
    ['snake', 2, 'Hay serpientes junto al pozo. Los niños tienen miedo.', 1, 'serpientes'],
    ['wolf', 3, 'Los lobos rondan la aldea por la noche.', 2, 'lobos'],
    ['caiman', 2, 'Dos caimanes vigilan el río donde lavamos.', 2, 'caimanes'],
    ['jaguar', 1, 'Un jaguar se llevó una cabra. Que no se lleve a nadie más.', 2, 'jaguar'],
    ['pirate', 3, 'Piratas de la Hiena espían la costa. Espántalos.', 2, 'piratas de la Hiena'],
    ['bear', 1, 'Un cazador vio un oso blanco en Escarcha. Queremos su piel para el invierno.', 3, 'oso blanco'],
    ['lavacrab', 2, 'Necesitamos las pinzas de los cangrejos de lava de Brasa.', 3, 'cangrejos de lava'],
  ];
  const BRING = [
    ['madera', 12, 'Hay que reparar el techo de la choza grande.', 0],
    ['piedra', 10, 'Queremos levantar un muro junto al río.', 0],
    ['fibra', 10, 'Faltan cuerdas para las canoas.', 0],
    ['pez_asado', 5, 'La fiesta de la luna llena necesita comida.', 1],
    ['cuero', 3, 'Mi tambor está roto. Necesito cuero nuevo.', 1],
    ['coco', 6, 'Los niños quieren leche de coco.', 0],
    ['bambu', 8, 'Vamos a construir una pasarela sobre el río.', 1],
    ['carne_cocida', 4, 'Los guerreros salen de caza mañana. Necesitan provisiones.', 1],
    ['lingote', 3, 'Queremos puntas de hierro para las lanzas.', 2],
  ];
  const VISIT = [['escarcha', 'Nadie ha vuelto de Isla Escarcha este invierno. Ve a ver qué pasa.', 2], ['brasa', 'El volcán de Brasa humea más que nunca. Mira qué ocurre allí.', 2], ['ruinas', 'Dicen que las ruinas de Aurea brillan de noche. Compruébalo.', 3], ['perdida', 'En la Isla Perdida hay un ermitaño brujo. Llévale nuestro saludo.', 1]];

  const st = () => (G.state.quests = G.state.quests || { offers: [], active: [], done: 0, seed: (Math.random() * 1e9) >>> 0 });
  const itemName = (id) => (G.ITEMS[id] ? `${G.ITEMS[id].i} ${G.ITEMS[id].n.toLowerCase()}` : id);
  function reward(tier) { return { doblon: 5 + tier * 5 + Math.floor(Math.random() * 4), coins: 15 + tier * 12, extra: tier >= 2 && Math.random() < 0.5 ? (Math.random() < 0.5 ? ['mapa_tesoro', 1] : ['perla', 2]) : null }; }
  // Encargo nuevo al azar (que no repita uno ya ofrecido o activo)
  function make() {
    const s = st(), used = new Set([...s.offers, ...s.active].map((q) => q.key));
    for (let tries = 0; tries < 30; tries++) {
      const r = Math.random(), who = WHO[Math.floor(Math.random() * WHO.length)];
      let q = null;
      if (r < 0.4) { const [t, n, why, tier, nm] = HUNT[Math.floor(Math.random() * HUNT.length)]; q = { key: 'h:' + t, kind: 'hunt', t, n, why, tier, text: n > 1 ? `Caza ${n} ${nm}` : `Caza un ${nm}` }; }
      else if (r < 0.75) { const [item, n, why, tier] = BRING[Math.floor(Math.random() * BRING.length)]; if (!G.ITEMS[item]) continue; q = { key: 'b:' + item, kind: 'bring', item, n, why, tier, text: `Trae ${n} × ${itemName(item)}` }; }
      else if (r < 0.9) { const [type, why, tier] = VISIT[Math.floor(Math.random() * VISIT.length)]; const isl = G.Arch.islands.find((s2) => s2.type === type); if (!isl) continue; q = { key: 'v:' + type, kind: 'visit', isl: isl.id, n: 1, why, tier, text: `Visita ${isl.name}` }; }
      else q = { key: 't', kind: 'treasure', n: 1, why: 'Genbu dice que un tesoro enterrado pagaría la nueva canoa de la aldea.', tier: 2, text: 'Desentierra un tesoro (mapa del tesoro)' };
      if (!q || used.has(q.key)) continue;
      q.who = who; q.got = 0; q.rw = reward(q.tier); q.id = 'q' + Date.now().toString(36) + Math.floor(Math.random() * 1e4);
      return q;
    }
    return null;
  }
  function fill() { const s = st(); while (s.offers.length < 3) { const q = make(); if (!q) break; s.offers.push(q); } }
  const rwText = (rw) => `🥇 ${rw.doblon} doblones · 🪙 ${rw.coins}${rw.extra ? ' · ' + itemName(rw.extra[0]) : ''}`;

  // ------------------------------------------------------------------ progreso
  function complete(q) {
    const s = st();
    s.active = s.active.filter((x) => x !== q);
    s.done++;
    G.Game.give('doblon', q.rw.doblon);
    G.Profile.addCoins(q.rw.coins, 'Encargo cumplido');
    if (q.rw.extra) G.Game.give(q.rw.extra[0], q.rw.extra[1]);
    const w = G.state.world && G.state.world.story;
    if (w) { w.rep = Math.min(100, (w.rep || 0) + 5); G.Net.send({ t: 'story', w }); }
    G.UI.banner('📋 ¡Encargo cumplido!', `${q.who}: «¡Gracias, forastero!» · ${rwText(q.rw)}`);
    G.Audio.play('win');
    G.Ach.add('quest');
    fill();
    render(); hud();
  }
  function progress(q, add) {
    q.got = Math.min(q.n, q.got + add);
    if (q.got >= q.n && q.kind !== 'bring') complete(q);
    else { G.UI.msg(`📋 ${esc(q.text)}: ${q.got}/${q.n}`, 'info', 'quest' + q.id); hud(); }
  }
  Q.onKill = function (type) {
    for (const q of st().active.slice()) if (q.kind === 'hunt' && (q.t === type || (q.t === 'pirate' && type === 'pirate_gun'))) progress(q, 1);
  };
  Q.onEvent = function (ev) {
    for (const q of st().active.slice()) if (q.kind === ev) progress(q, 1);
  };
  let checkT = 0;
  Q.update = function (dt) {
    if (!G.state.world || (checkT -= dt) > 0) return;
    checkT = 2;
    const z = G.Arch.zoneOf(G.Player.pos.x, G.Player.pos.z);
    for (const q of st().active.slice()) if (q.kind === 'visit' && z && z.id === q.isl) progress(q, 1);
    hud();
  };

  // ------------------------------------------------------------------ ventana del tablón
  function build() {
    if ($('questWin')) return;
    const el = document.createElement('div');
    el.id = 'questWin';
    el.className = 'fe-overlay hidden';
    el.innerHTML = `<div class="quest-card"><div class="fe-head"><h3>📋 Tablón de encargos</h3><span class="muted">Aldea Shandara · hasta ${MAX} encargos a la vez</span></div>
      <div id="questBody"></div><div class="fe-foot"><span class="fe-grow"></span><button id="questClose" class="btn primary">Cerrar</button></div></div>`;
    document.body.appendChild(el);
    $('questClose').onclick = Q.close;
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-a]');
      if (!b) return;
      const s = st(), id = b.dataset.id;
      if (b.dataset.a === 'take') {
        if (s.active.length >= MAX) { G.UI.msg(`Ya tienes ${MAX} encargos. Termina o abandona alguno.`, 'warn', 'quest'); return; }
        const q = s.offers.find((x) => x.id === id);
        if (!q) return;
        s.offers = s.offers.filter((x) => x !== q);
        s.active.push(q);
        fill();
        G.Audio.play('select');
      } else if (b.dataset.a === 'give') {
        const q = s.active.find((x) => x.id === id);
        if (!q) return;
        if (G.Inv.count(q.item) < q.n) { G.UI.msg(`Te faltan ${q.n - G.Inv.count(q.item)} × ${itemName(q.item)}.`, 'warn', 'quest'); return; }
        G.Inv.remove(q.item, q.n);
        complete(q);
      } else if (b.dataset.a === 'drop') {
        s.active = s.active.filter((x) => x.id !== id);
        fill();
      }
      render(); hud();
    });
    document.addEventListener('keydown', (e) => { if (!el.classList.contains('hidden') && e.code === 'Escape') { e.stopPropagation(); Q.close(); } }, true);
  }
  function card(q, active) {
    const have = q.kind === 'bring' ? G.Inv.count(q.item) : q.got;
    const prog = active ? `<div class="q-prog"><i style="width:${Math.min(100, (have / q.n) * 100)}%"></i></div><small>${Math.min(have, q.n)}/${q.n}</small>` : '';
    const btn = !active ? `<button class="btn small primary" data-a="take" data-id="${q.id}">Aceptar</button>`
      : (q.kind === 'bring' ? `<button class="btn small primary" data-a="give" data-id="${q.id}"${have >= q.n ? '' : ' disabled'}>Entregar</button> ` : '') + `<button class="btn small" data-a="drop" data-id="${q.id}">Abandonar</button>`;
    return `<div class="q-card${active ? ' active' : ''}"><div class="q-who">📌 ${esc(q.who)}</div><b>${esc(q.text)}</b><p class="muted">«${esc(q.why)}»</p>${prog}<div class="q-rw">${rwText(q.rw)}</div><div class="q-btns">${btn}</div></div>`;
  }
  function render() {
    if (!$('questBody') || $('questWin').classList.contains('hidden')) return;
    const s = st();
    $('questBody').innerHTML = `<div class="mp-label">Tus encargos (${s.active.length}/${MAX})</div><div class="q-grid">${s.active.map((q) => card(q, true)).join('') || '<p class="muted">Aún no has aceptado ninguno.</p>'}</div>
      <div class="mp-label">En el tablón</div><div class="q-grid">${s.offers.map((q) => card(q, false)).join('')}</div>
      <p class="muted small-text">Encargos cumplidos: ${s.done}. Cada uno mejora tu relación con la tribu Shandara.</p>`;
  }
  Q.open = function () {
    build(); fill();
    $('questWin').classList.remove('hidden');
    G.Main.releasePointer && G.Main.releasePointer();
    render();
  };
  Q.close = function () { if ($('questWin')) $('questWin').classList.add('hidden'); if (G.state.mode === 'playing' && G.Main.lockPointer) G.Main.lockPointer(); };
  Q.isOpen = () => !!$('questWin') && !$('questWin').classList.contains('hidden');

  // ------------------------------------------------------------------ encargos activos en pantalla
  function hud() {
    let el = $('questHud');
    if (!el) { el = document.createElement('div'); el.id = 'questHud'; const o = $('objective'); if (!o) return; o.appendChild(el); }
    const s = G.state && G.state.world ? st() : null;
    el.innerHTML = s ? s.active.map((q) => { const have = q.kind === 'bring' ? Math.min(G.Inv.count(q.item), q.n) : q.got; return `<div>📋 ${esc(q.text)} <b>${have}/${q.n}</b></div>`; }).join('') : '';
    el.classList.toggle('hidden', !el.innerHTML);
  }
  Q.hud = hud;

  // ------------------------------------------------------------------ el tablón en la aldea
  Q.build = function () {
    const K = G.Landmarks.kit(), M = G.Mdl;
    for (const s of G.Arch.islands) {
      const V = s.feat && s.feat.village;
      if (!V || V.wx === undefined) continue;
      const x = V.wx - V.r * 0.35, z = V.wz + V.r * 0.3, y = G.height(x, z), yaw = Math.atan2(V.wx - x, V.wz - z);
      const parts = [M.xf(M.paint(new THREE.CylinderGeometry(0.07, 0.08, 2.2, 6), 0x5a3a20), -0.75, 1.1, 0), M.xf(M.paint(new THREE.CylinderGeometry(0.07, 0.08, 2.2, 6), 0x5a3a20), 0.75, 1.1, 0),
        M.xf(M.paint(new THREE.BoxGeometry(1.75, 1.15, 0.07), 0x8a6a42), 0, 1.35, 0), M.xf(M.paint(new THREE.ConeGeometry(1.2, 0.45, 4), 0x9a8a5a), 0, 2.3, 0, 0, Math.PI / 4, 0, [1, 1, 0.4])];
      // Papelitos clavados
      const rnd = U.rng(s.id * 31 + 5);
      for (let i = 0; i < 5; i++) parts.push(M.xf(M.paint(new THREE.BoxGeometry(0.3 + rnd() * 0.1, 0.36 + rnd() * 0.1, 0.01), [0xefe2bd, 0xe8d8a8, 0xf4ecd4][i % 3]), -0.6 + i * 0.3, 1.25 + (i % 2) * 0.28, 0.045, 0, 0, (rnd() - 0.5) * 0.3));
      const g = new THREE.Group();
      g.add(new THREE.Mesh(U.merge(parts), K.mats().vc));
      g.position.set(x, y, z); g.rotation.y = yaw;
      K.track(g);
      G.Landmarks.loot.push({ id: 'quests:' + s.id, kind: 'board', x, y: y + 1.0, z, g, opened: false, extra: true, hitR: 1.1, name: 'Tablón de encargos' });
    }
  };
})();
