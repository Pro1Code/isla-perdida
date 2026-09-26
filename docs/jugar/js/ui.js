// Interfaz: HUD, barra rápida, inventario, fabricación, mensajes, minimapa, mapa del archipiélago,
// brújula (Log de Mareas), panel del barco, oxígeno, poderes, panel versus, diálogos y bitácora
(function () {
  'use strict';
  const G = window.G, U = G.U;
  const UI = (G.UI = { craftCat: 'herr', picked: null, hurt: 0, waypoint: null, map: { cx: 0, cz: 0, scale: 0.2 } });
  const $ = (id) => document.getElementById(id);
  let el = {}, mmT = 0, heldT = 0, lastHeld = null, msgKeys = {}, bannerT = null;

  G.CONTROLS = [
    ['<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>', 'Moverse'],
    ['Ratón', 'Mirar alrededor'],
    ['<kbd>Shift</kbd>', 'Correr (gasta energía)'],
    ['<kbd>Espacio</kbd>', 'Saltar · nadar hacia arriba'],
    ['<kbd>C</kbd> / <kbd>Ctrl</kbd>', 'Bucear (en el agua)'],
    ['<kbd>E</kbd>', 'Recoger / interactuar / hablar / subir a un barco'],
    ['Clic izq.', 'Golpear, talar, atacar, disparar cañón'],
    ['Clic der. / <kbd>F</kbd>', 'Comer, beber, colocar, usar el catalejo'],
    ['<kbd>1</kbd>–<kbd>8</kbd> / rueda', 'Elegir objeto de la barra'],
    ['<kbd>Tab</kbd>', 'Inventario y fabricación'],
    ['<kbd>R</kbd>', 'Girar al colocar · cambiar diseño de una pieza'],
    ['<kbd>X</kbd>', 'Desmontar construcción (recupera la mitad)'],
    ['<kbd>G</kbd>', 'Poder de la Fruta del Abismo'],
    ['<kbd>V</kbd>', 'Cambiar cámara 1ª / 3ª persona'],
    ['<kbd>M</kbd>', 'Mapa del archipiélago (clic: marcar destino)'],
    ['<kbd>J</kbd>', 'Bitácora (historia, islas, curiosidades)'],
    ['Al timón', '<kbd>W</kbd>/<kbd>S</kbd> velas o motor · <kbd>A</kbd>/<kbd>D</kbd> girar · <kbd>Espacio</kbd> ancla · <kbd>Q</kbd> piloto automático'],
    ['<kbd>T</kbd> / <kbd>Enter</kbd>', 'Chat (multijugador LAN)'],
    ['<kbd>Esc</kbd>', 'Pausa'],
  ];

  UI.init = function () {
    ['hud', 'hotbar', 'heldName', 'prompt', 'messages', 'vignette', 'banner', 'clock', 'dayLabel', 'timeLabel', 'dayIcon', 'objective', 'objText',
      'barHealth', 'barHunger', 'barThirst', 'barStamina', 'statusIcons', 'crosshair', 'minimap', 'inventory', 'invHot', 'invBag', 'itemInfo',
      'craftTabs', 'recipes', 'bigmap', 'bigmapCanvas', 'fade', 'clickToPlay', 'chatInput', 'playerList', 'barTemp', 'bossBar', 'bossName', 'bossFill',
      'chestSec', 'invChest', 'invHint', 'chestTitle', 'compass', 'compassArrow', 'compassText', 'oxyStat', 'barOxy', 'shipHud', 'vsHud', 'powerHud', 'dialog', 'dialogWho', 'dialogText', 'dialogOpts',
      'journal', 'journalBody', 'islandLabel', 'mapInfo', 'invEquip', 'eqStats'].forEach((id) => (el[id] = $(id)));
    UI.el = el;
    document.querySelectorAll('.controls-list').forEach((c) => {
      c.innerHTML = G.CONTROLS.map(([k, d]) => `<div>${k}</div><div>${d}</div>`).join('');
    });
    for (let i = 0; i < 8; i++) {
      const d = document.createElement('div');
      d.className = 'slot';
      el.hotbar.appendChild(d);
    }
    for (let i = 0; i < 32; i++) {
      const d = document.createElement('div');
      d.className = 'slot';
      d.dataset.i = i;
      (i < 8 ? el.invHot : el.invBag).appendChild(d);
      d.addEventListener('mousedown', (e) => { e.preventDefault(); UI.slotClick(i, e.button); });
      d.addEventListener('mouseenter', () => UI.showInfo(i));
      d.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    // Ranuras de equipo: clic = quitarse (o ponerse lo seleccionado)
    for (const k of G.Inv.SLOTS) {
      const d = document.createElement('div');
      d.className = 'slot eq-slot';
      d.dataset.slot = k;
      d.title = G.Inv.SLOT_NAMES[k];
      el.invEquip.appendChild(d);
      d.addEventListener('mousedown', (e) => { e.preventDefault(); UI.equipClick(k); });
      d.addEventListener('mouseenter', () => UI.showEquipInfo(k));
      d.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    for (let i = 0; i < 16; i++) {
      const d = document.createElement('div');
      d.className = 'slot';
      el.invChest.appendChild(d);
      d.addEventListener('mousedown', (e) => { e.preventDefault(); UI.chestClick(i); });
      d.addEventListener('mouseenter', () => { const s = UI.chest && UI.chest.items[i]; el.itemInfo.innerHTML = s ? `<b>${G.ITEMS[s.id].i} ${G.ITEMS[s.id].n}</b> ×${s.n}<br><span class="muted">Clic: pasar al inventario</span>` : '<span class="muted">Casilla vacía.</span>'; });
      d.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    el.craftTabs.innerHTML = G.CRAFT_CATS.map(([k, n]) => `<button data-c="${k}">${n}</button>`).join('');
    el.craftTabs.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { UI.craftCat = b.dataset.c; UI.renderRecipes(); }));
    el.recipes.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-r]');
      if (b) G.Game.craft(G.RECIPES[+b.dataset.r]);
    });
    $('invClose').addEventListener('click', () => G.Game.closeInventory());
    $('journalClose').addEventListener('click', () => G.Game.closeJournal());
    el.dialogOpts.addEventListener('click', (e) => { const b = e.target.closest('button[data-o]'); if (b) G.Story.choose(+b.dataset.o); });
    // Mapa: rueda = zoom, arrastrar = mover, clic = marcar destino, clic derecho = borrar destino
    const cv = el.bigmapCanvas;
    let drag = null;
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      const m = UI.map, r = cv.getBoundingClientRect(), k = 640 / r.width;
      const px = (e.clientX - r.left) * k, py = (e.clientY - r.top) * k;
      const wx = m.cx + (px - 320) / m.scale, wz = m.cz + (py - 320) / m.scale;
      m.scale = U.clamp(m.scale * (e.deltaY > 0 ? 0.8 : 1.25), 0.12, 4);
      m.cx = wx - (px - 320) / m.scale; m.cz = wz - (py - 320) / m.scale;
      UI.drawBigMap();
    }, { passive: false });
    cv.addEventListener('mousedown', (e) => { drag = { x: e.clientX, y: e.clientY, cx: UI.map.cx, cz: UI.map.cz, moved: false, b: e.button }; });
    window.addEventListener('mousemove', (e) => {
      if (!drag) return;
      const r = cv.getBoundingClientRect(), k = 640 / r.width;
      const dx = (e.clientX - drag.x) * k, dy = (e.clientY - drag.y) * k;
      if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
      if (drag.moved) { UI.map.cx = drag.cx - dx / UI.map.scale; UI.map.cz = drag.cz - dy / UI.map.scale; UI.drawBigMap(); }
    });
    window.addEventListener('mouseup', (e) => {
      if (!drag) return;
      const d = drag; drag = null;
      if (d.moved || G.state.mode !== 'map') return;
      const r = cv.getBoundingClientRect(), k = 640 / r.width, m = UI.map;
      const wx = m.cx + ((e.clientX - r.left) * k - 320) / m.scale, wz = m.cz + ((e.clientY - r.top) * k - 320) / m.scale;
      if (d.b === 2) { UI.waypoint = null; G.UI.msg('Destino borrado.', 'info', 'wp'); }
      else { UI.waypoint = { x: wx, z: wz }; G.Audio.play('select'); G.UI.msg('📍 Destino marcado. Al timón, pulsa <kbd>Q</kbd> para el piloto automático.', 'info', 'wp'); }
      UI.drawBigMap();
    });
    G.Inv.listeners.push(() => UI.refreshInv());
    UI.refreshInv();
  };

  // ------------------------------------------------------------------ inventario
  function slotHTML(s, num) {
    let h = num ? `<span class="num">${num}</span>` : '';
    if (!s) return h;
    const it = G.ITEMS[s.id];
    if (!it) return h;
    h += it.i;
    if (s.n > 1) h += `<span class="cnt">${s.n}</span>`;
    if (s.d !== undefined && it.dur < 9999) {
      const f = U.clamp(s.d / it.dur, 0, 1);
      h += `<span class="dur"><i style="width:${f * 100}%;background:${f > 0.5 ? '#7fdc6f' : f > 0.2 ? '#f2b544' : '#ff5a4f'}"></i></span>`;
    }
    return h;
  }
  UI.refreshHotbar = function () {
    const kids = el.hotbar.children;
    for (let i = 0; i < 8; i++) {
      kids[i].innerHTML = slotHTML(G.Inv.slots[i], i + 1);
      kids[i].classList.toggle('sel', i === G.Inv.sel);
    }
  };
  UI.refreshInv = function () {
    UI.refreshHotbar();
    if (el.inventory.classList.contains('hidden')) return;
    const all = [...el.invHot.children, ...el.invBag.children];
    all.forEach((d, i) => {
      d.innerHTML = slotHTML(G.Inv.slots[i], i < 8 ? i + 1 : null);
      d.classList.toggle('picked', UI.picked === i);
    });
    [...el.invEquip.children].forEach((d) => {
      const e = G.Inv.equip[d.dataset.slot];
      d.innerHTML = e ? G.ITEMS[e.id].i : `<span class="eq-ph">${G.Inv.SLOT_ICONS[d.dataset.slot]}</span>`;
      d.classList.toggle('filled', !!e);
    });
    const ar = G.Inv.eqStat('armor'), co = G.Inv.eqStat('cold'), he = G.Inv.eqStat('heat');
    el.eqStats.textContent = `🛡️ ${Math.round(ar * 100)}% · ❄️ ${Math.round(Math.min(0.9, co) * 100)}% · 🔥 ${Math.round(Math.min(0.9, he) * 100)}%`;
    el.chestSec.classList.toggle('hidden', !UI.chest);
    el.invHint.textContent = UI.chest ? 'Clic: pasar objetos entre el cofre y tu inventario · Clic derecho: usar/comer' : 'Clic: mover/intercambiar · Clic derecho: usar/comer';
    if (UI.chest) {
      el.chestTitle.textContent = UI.chest.title || '📦 Cofre';
      [...el.invChest.children].forEach((d, i) => { d.classList.toggle('hidden', i >= UI.chest.items.length); d.innerHTML = slotHTML(UI.chest.items[i]); });
    }
    UI.renderRecipes();
  };
  UI.equipClick = function (slot) {
    const S = G.Inv.slots;
    if (UI.picked !== null && S[UI.picked] && G.ITEMS[S[UI.picked].id].eq && G.ITEMS[S[UI.picked].id].eq.slot === slot) { G.Inv.equipFrom(UI.picked); UI.picked = null; }
    else if (UI.picked !== null) { G.UI.msg(`Eso no va en la ranura de ${G.Inv.SLOT_NAMES[slot].toLowerCase()}.`, 'warn', 'eq'); UI.picked = null; G.Inv.changed(); }
    else G.Inv.unequip(slot);
    G.Audio.play('select');
    UI.showEquipInfo(slot);
  };
  const eqDesc = (q) => {
    const p = [];
    if (q.armor) p.push(`🛡️ ${Math.round(q.armor * 100)}% menos daño`);
    if (q.cold) p.push(`❄️ abrigo ${Math.round(q.cold * 100)}%`);
    if (q.heat) p.push(`🔥 protege del calor ${Math.round(q.heat * 100)}%`);
    if (q.lava) p.push(`🌋 −${Math.round(q.lava * 100)}% daño de lava`);
    if (q.oxy) p.push(`🫧 aire ×${q.oxy}`);
    if (q.swim) p.push(`🏊 nado ×${q.swim}`);
    if (q.speed && q.speed !== 1) p.push(`🏃 velocidad ${q.speed > 1 ? '+' : ''}${Math.round((q.speed - 1) * 100)}%`);
    if (q.snow) p.push('❄️ no te hundes en la nieve');
    if (q.rain) p.push('🌧️ te mojas menos');
    if (q.tribe) p.push('🪶 los shandara te respetan');
    return p.join(' · ');
  };
  UI.eqDesc = eqDesc;
  UI.showEquipInfo = function (slot) {
    const e = G.Inv.equip[slot];
    if (!e) { el.itemInfo.innerHTML = `<b>${G.Inv.SLOT_ICONS[slot]} ${G.Inv.SLOT_NAMES[slot]}</b><br><span class="muted">Vacío. Selecciona una prenda en la mochila y haz clic aquí, o clic derecho sobre ella.</span>`; return; }
    const it = G.ITEMS[e.id];
    el.itemInfo.innerHTML = `<b>${it.i} ${it.n}</b> <span class="muted">(${G.Inv.SLOT_NAMES[slot].toLowerCase()})</span><br><span class="muted">${it.d}</span><br>${eqDesc(it.eq)}<br><i>Clic: quitártelo</i>`;
  };
  UI.slotClick = function (i, button) {
    const S = G.Inv.slots;
    if (button === 2) { if (S[i] && (G.ITEMS[S[i].id].use || G.ITEMS[S[i].id].fruit || G.ITEMS[S[i].id].read || G.ITEMS[S[i].id].eq)) G.Game.consume(i); UI.showInfo(i); return; }
    if (UI.chest) { moveStack(S, i, UI.chest.items); G.Net.chestChanged(UI.chest); G.Inv.changed(); G.Audio.play('select'); return; }
    if (UI.picked === null) { if (S[i]) { UI.picked = i; G.Audio.play('select'); } }
    else {
      const a = UI.picked;
      if (a !== i) {
        const A = S[a], B = S[i];
        if (B && A && A.id === B.id && !G.ITEMS[A.id].tool) {
          const k = Math.min(A.n, G.Inv.maxStack(A.id) - B.n);
          B.n += k; A.n -= k;
          if (A.n <= 0) S[a] = null;
        } else { S[a] = B; S[i] = A; }
      }
      UI.picked = null;
      G.Audio.play('select');
    }
    G.Inv.changed();
    UI.showInfo(i);
  };
  // Mueve una pila de objetos entre dos listas (inventario ⇄ cofre)
  function moveStack(src, i, dst) {
    const s = src[i];
    if (!s) return;
    const max = G.Inv.maxStack(s.id);
    if (!G.ITEMS[s.id].tool) for (const d of dst) if (d && d.id === s.id && d.n < max) { const k = Math.min(s.n, max - d.n); d.n += k; s.n -= k; if (!s.n) break; }
    if (s.n > 0) { const e = dst.findIndex((x) => !x); if (e >= 0) { dst[e] = Object.assign({}, s); s.n = 0; } else G.UI.msg('No hay espacio.', 'warn', 'full'); }
    if (s.n <= 0) src[i] = null;
  }
  UI.chestClick = function (i) {
    if (!UI.chest) return;
    moveStack(UI.chest.items, i, G.Inv.slots);
    G.Net.chestChanged(UI.chest);
    G.Inv.changed();
    G.Audio.play('select');
  };
  // s: construcción cofre ({ items }) o caja de un barco ({ items, ship, title })
  UI.openChest = function (s) {
    UI.chest = s;
    G.Game.openInventory();
    G.Audio.play('place');
  };
  UI.showInfo = function (i) {
    const s = G.Inv.slots[i];
    if (!s) { el.itemInfo.innerHTML = '<span class="muted">Casilla vacía.</span>'; return; }
    const it = G.ITEMS[s.id];
    let h = `<b>${it.i} ${it.n}</b>${s.n > 1 ? ` ×${s.n}` : ''}<br><span class="muted">${it.d || ''}</span>`;
    if (it.use) {
      const u = it.use, parts = [];
      if (u.hunger) parts.push(`🍖 +${u.hunger}`);
      if (u.thirst) parts.push(`💧 +${u.thirst}`);
      if (u.health) parts.push(`❤️ ${u.health > 0 ? '+' : ''}${u.health}`);
      if (u.warm) parts.push(`🌡️ +${u.warm}`);
      if (u.stamina) parts.push(`⚡ +${u.stamina}`);
      if (u.sick) parts.push('⚠ puede enfermarte');
      h += `<br>${parts.join(' · ')} · <i>clic derecho para usar</i>`;
    }
    if (it.fruit) h += '<br><i>Clic derecho: comer (¡piénsalo bien!)</i>';
    if (it.eq) h += `<br>${eqDesc(it.eq)}<br><i>Clic derecho: ponértelo (${G.Inv.SLOT_NAMES[it.eq.slot].toLowerCase()})</i>`;
    if (it.read) h += '<br><i>Clic derecho: leer</i>';
    if (s.d !== undefined && it.dur < 9999) h += `<br>Durabilidad: ${Math.ceil(s.d)} / ${it.dur}`;
    h += `<br><button class="btn small" id="dropBtn">Tirar</button>`;
    el.itemInfo.innerHTML = h;
    $('dropBtn').onclick = () => { G.Inv.slots[i] = null; UI.picked = null; G.Inv.changed(); el.itemInfo.innerHTML = '<span class="muted">Objeto tirado.</span>'; };
  };
  UI.renderRecipes = function () {
    el.craftTabs.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.c === UI.craftCat));
    el.recipes.innerHTML = G.RECIPES.map((r, idx) => {
      if (r.cat !== UI.craftCat) return '';
      const it = G.ITEMS[r.id];
      const learned = G.Game.learned(r);
      const near = G.Game.nearStation(r.station);
      const can = G.Inv.canCraft(r) && near && learned;
      const reqs = Object.entries(r.req).map(([id, n]) => {
        const have = G.Inv.count(id);
        return `<span class="req ${have >= n ? 'ok' : 'no'}">${G.ITEMS[id].i} ${Math.min(have, 999)}/${n}</span>`;
      }).join('') + (r.station ? `<span class="req ${near ? 'ok' : 'no'}">${G.STATION_NAMES[r.station]}</span>` : '') + (!learned ? '<span class="req no">🔒 receta shandara</span>' : '');
      const eqLine = it.eq ? `<div class="ds eq-line">${G.Inv.SLOT_NAMES[it.eq.slot]}: ${eqDesc(it.eq)}</div>` : '';
      return `<div class="recipe ${can ? 'ok' : ''}"><div class="ic">${it.i}</div><div><div class="nm">${it.n}${r.n > 1 ? ' ×' + r.n : ''}</div><div class="ds">${it.d || ''}</div>${eqLine}${reqs}</div><button data-r="${idx}" ${can ? '' : 'disabled'}>Fabricar</button></div>`;
    }).join('');
  };

  // ------------------------------------------------------------------ mensajes
  UI.msg = function (text, type = 'info', key) {
    const now = performance.now();
    if (key) { if (msgKeys[key] && now - msgKeys[key] < 2500) return; msgKeys[key] = now; }
    const d = document.createElement('div');
    d.className = 'msg ' + type;
    d.innerHTML = text;
    el.messages.appendChild(d);
    while (el.messages.children.length > 6) el.messages.firstChild.remove();
    const life = text.length > 110 ? 7500 : 3800;
    setTimeout(() => d.classList.add('out'), life);
    setTimeout(() => d.remove(), life + 700);
  };
  // ------------------------------------------------------------------ chat y jugadores (LAN)
  UI.chatMsg = function (name, color, text) {
    if (!text) return;
    const d = document.createElement('div');
    d.className = 'msg chat';
    const E = G.Net.esc;
    d.innerHTML = `<b style="color:${E(color)}">${E(name)}:</b> ${E(text)}`;
    el.messages.appendChild(d);
    while (el.messages.children.length > 8) el.messages.firstChild.remove();
    setTimeout(() => d.classList.add('out'), 9000);
    setTimeout(() => d.remove(), 9700);
    G.Audio.play('chat');
  };
  UI.openChat = function () {
    G.chatOpen = true;
    el.chatInput.value = '';
    el.chatInput.classList.remove('hidden');
    setTimeout(() => el.chatInput.focus(), 0);
  };
  UI.closeChat = function () {
    G.chatOpen = false;
    if (!el.chatInput) return;
    el.chatInput.blur();
    el.chatInput.classList.add('hidden');
  };
  UI.refreshPlayerList = function () {
    const N = G.Net;
    if (!el.playerList) return;
    if (!N.active) { el.playerList.innerHTML = ''; return; }
    const E = N.esc, M = G.Modes;
    const tag = (team) => (M.active && team !== null && team !== undefined ? ` <span class="team-dot" style="background:${M.teamColor(team)}"></span>` : '');
    const rows = [`<div><i style="background:${E(N.color)}"></i>${E(N.name)} (tú)${N.isHost ? ' 👑' : ''}${tag(N.team)}</div>`];
    for (const [id, p] of N.peers) rows.push(`<div><i style="background:${E(p.color)}"></i>${E(p.name)}${id === N.hostId ? ' 👑' : ''}${p.dead ? ' 💀' : ''}${p.out ? ' ❌' : ''}${tag(p.team)}</div>`);
    el.playerList.innerHTML = `<small>🌐 LAN · ${rows.length} jugador${rows.length > 1 ? 'es' : ''}</small>` + rows.join('');
  };

  UI.banner = function (title, sub) {
    el.banner.innerHTML = title + (sub ? `<small>${sub}</small>` : '');
    el.banner.classList.add('show');
    clearTimeout(bannerT);
    bannerT = setTimeout(() => el.banner.classList.remove('show'), 3600);
  };
  UI.hurtFlash = (a) => { UI.hurt = Math.min(1, UI.hurt + a); };
  UI.setPrompt = (html) => { if (el.prompt.innerHTML !== html) el.prompt.innerHTML = html; };
  UI.fade = function (mid, after) {
    el.fade.classList.add('on');
    setTimeout(() => { mid && mid(); setTimeout(() => { el.fade.classList.remove('on'); after && setTimeout(after, 1200); }, 500); }, 1250);
  };
  UI.objective = function (text, flash) {
    if (el.objText.innerHTML !== text) el.objText.innerHTML = text;
    if (flash) { el.objective.classList.remove('flash'); void el.objective.offsetWidth; el.objective.classList.add('flash'); }
  };

  // ------------------------------------------------------------------ diálogos
  UI.showDialog = function (d) {
    el.dialogWho.textContent = d.who || '';
    el.dialogText.textContent = d.text || '';
    const opts = d.options && d.options.length ? d.options : [['Continuar', null]];
    el.dialogOpts.innerHTML = opts.map((o, i) => `<button data-o="${i}"><kbd>${i + 1}</kbd> ${G.Net.esc(o[0])}</button>`).join('');
    el.dialog.classList.remove('hidden');
    G.Main.releasePointer();
  };
  UI.hideDialog = function () {
    el.dialog.classList.add('hidden');
    if (G.state.mode === 'playing') G.Main.lockPointer();
  };

  // ------------------------------------------------------------------ bitácora
  UI.openJournal = function () {
    const w = (G.state.world && G.state.world.story) || { disc: {}, monos: {}, facts: {}, fruits: {} };
    const A = G.Arch, St = G.Story;
    const isl = A.islands.filter((s) => w.disc[s.id]).map((s) => `<li><b>${A.TYPES[s.type].icon} ${s.name}</b> — <span class="muted">${A.TYPES[s.type].desc}</span></li>`).join('');
    const monos = Object.keys(w.monos || {}).map((k) => { const L = G.Landmarks.byId(k); return `<li><b>🗿 ${L ? L.name : k}</b></li>`; }).join('');
    const facts = Object.keys(w.facts || {}).map((k) => `<li>📖 ${St.FACTS[k]}</li>`).join('');
    const fr = Object.entries(St.FRUITS).map(([k, f]) => {
      const s = w.fruits[k] || {};
      const st = s.holder ? `la comió <b>${G.Net.esc(s.holder)}</b>` : s.found ? 'alguien la encontró' : 'escondida en algún cofre';
      return `<li>${f.icon} <b>Fruta ${f.name}</b> — ${st}${G.state.fruit === k ? ' (¡tú!)' : ''}<br><span class="muted">${f.desc}</span></li>`;
    }).join('');
    const rep = w.rep || 0;
    el.journalBody.innerHTML = `
      <h3>🏝️ Islas descubiertas</h3><ul>${isl || '<li class="muted">Ninguna todavía.</li>'}</ul>
      <h3>🗿 Monoglifos leídos</h3><ul>${monos || '<li class="muted">Aún no sabes leer la escritura antigua.</li>'}</ul>
      <h3>🍇 Frutas del Abismo</h3><ul>${fr}</ul>
      <h3>🪶 Tribu Shandara</h3><p>${rep < -20 ? '⚔️ En guerra contigo' : rep > 10 ? '🤝 Aliados' : '😐 Neutrales'}</p>
      <h3>📖 Curiosidades de One Piece</h3><ul>${facts || '<li class="muted">Explora y lee Monoglifos para descubrirlas.</li>'}</ul>`;
    el.journal.classList.remove('hidden');
  };
  UI.closeJournal = () => el.journal.classList.add('hidden');

  // ------------------------------------------------------------------ actualización del HUD
  UI.update = function (dt) {
    const P = G.Player, S = P.stats;
    const setBar = (b, v) => { b.style.width = U.clamp(v, 0, 100) + '%'; b.classList.toggle('low', v < 20); };
    setBar(el.barHealth, S.health); setBar(el.barHunger, S.hunger); setBar(el.barThirst, S.thirst); setBar(el.barStamina, S.stamina);
    el.barTemp.style.width = U.clamp(S.temp, 0, 100) + '%';
    el.barTemp.style.background = S.temp < 30 ? 'linear-gradient(90deg,#2a6fd6,#7ac0ff)' : S.temp > 75 ? 'linear-gradient(90deg,#e0781f,#ff4a3a)' : 'linear-gradient(90deg,#3cb878,#b6e06a)';
    el.barTemp.classList.toggle('low', S.temp < 22 || S.temp > 85);
    const showOxy = P.oxy < 99.5 || P.diving;
    el.oxyStat.classList.toggle('hidden', !showOxy);
    if (showOxy) setBar(el.barOxy, P.oxy);
    const st = [];
    if (P.poison > 0) st.push('☠️ Envenenado');
    if (S.temp < 30) st.push(G.Arch.biomeAt(P.pos.x, P.pos.z) === 'escarcha' ? '🥶 Frío polar' : '🥶 Frío');
    if (S.temp > 78) st.push('🥵 Calor');
    if (P.wet > 30) st.push('💦 Mojado');
    if (P.sick > 0) st.push('🤢 Enfermo');
    if (P.sinking) st.push('🌀 Hundiéndote');
    else if (P.diving) st.push('🤿 Buceando');
    else if (P.swimming) st.push('🏊 Nadando');
    if (P.exhausted) st.push('😮‍💨 Agotado');
    if (G.Build.nearestLitFire(P.pos.x, P.pos.z)?.d < 6) st.push('🔥 Junto al fuego');
    const sts = st.join(' · ');
    if (el.statusIcons.textContent !== sts) el.statusIcons.textContent = sts;

    el.dayLabel.textContent = `Día ${G.state.day}`;
    el.timeLabel.textContent = U.fmtClock(G.state.t);
    const z = G.Clock.zone >= 0 ? G.Arch.byId(G.Clock.zone) : null;
    const zl = z ? z.name : '🌊 Alta mar';
    if (el.islandLabel.textContent !== zl) el.islandLabel.textContent = zl;
    const night = G.Game.isNight();
    const wx = G.Weather.type, fk = G.Weather.fallKind;
    el.dayIcon.textContent = fk === 'snow' ? '❄️' : wx === 'storm' ? '⛈️' : wx === 'rain' ? (fk === 'ash' ? '🌋' : '🌧️') : night ? '🌙' : G.Game.hour() > 17.5 || G.Game.hour() < 7 ? '🌅' : '☀️';
    const boss = G.Creatures.nearBoss();
    el.bossBar.classList.toggle('hidden', !boss);
    if (boss) { el.bossFill.style.width = U.clamp(boss.hp / boss.d.hp, 0, 1) * 100 + '%'; el.bossName.textContent = (boss.type === 'serpent' ? '🐉 ' : '🐗 ') + boss.d.name; }

    const uw = G.World.underwater && !G.state.spectate;
    if (uw !== UI._uw) { UI._uw = uw; document.getElementById('underwater').classList.toggle('hidden', !uw); }
    UI.hurt = Math.max(0, UI.hurt - dt * 1.5);
    const lowHp = S.health < 25 ? 0.25 + Math.sin(performance.now() / 250) * 0.1 : 0;
    el.vignette.style.opacity = Math.max(UI.hurt, lowHp);

    const hid = G.Inv.heldId();
    if (hid !== lastHeld) {
      lastHeld = hid;
      el.heldName.textContent = hid ? G.ITEMS[hid].n : '';
      el.heldName.classList.add('show');
      heldT = 1.8;
    }
    if (heldT > 0) { heldT -= dt; if (heldT <= 0) el.heldName.classList.remove('show'); }

    mmT -= dt;
    if (mmT <= 0) {
      mmT = 0.15;
      UI.drawMinimap();
      updateCompass();
      updateShipHud();
      updatePower();
      const vs = G.Modes.hud();
      el.vsHud.classList.toggle('hidden', !vs);
      if (vs && el.vsHud.innerHTML !== vs) el.vsHud.innerHTML = vs;
      if ((listT = (listT || 0) + 1) % 4 === 0) { UI.refreshHotbar(); UI.refreshPlayerList(); }
    }
  };
  let listT = 0;

  // Brújula del Log de Mareas: apunta al siguiente destino de la historia (o al destino marcado)
  function updateCompass() {
    const has = G.Inv.has('log_mareas') || G.Modes.active;
    const tg = has ? G.Story.target() || (UI.waypoint ? { x: UI.waypoint.x, z: UI.waypoint.z, name: 'Destino marcado' } : null) : null;
    el.compass.classList.toggle('hidden', !tg);
    if (!tg) return;
    const P = G.Player.pos, dx = tg.x - P.x, dz = tg.z - P.z;
    const a = Math.atan2(dx, dz), rel = U.angDiff(G.Player.yaw + Math.PI, a);
    el.compassArrow.style.transform = `rotate(${-rel}rad)`;
    const d = Math.hypot(dx, dz);
    el.compassText.textContent = `${tg.name} · ${d > 1000 ? (d / 1000).toFixed(1) + ' km' : Math.round(d) + ' m'}`;
  }
  function updateShipHud() {
    const h = G.Ships.hud();
    el.shipHud.classList.toggle('hidden', !h);
    if (!h) return;
    const steps = { 0: 'plegadas', 0.35: '⅓', 0.7: '⅔', 1: 'llenas', '-0.3': 'atrás' };
    const thr = h.engine ? (h.throttle === 0 ? 'parado' : h.throttle < 0 ? 'atrás' : Math.round(h.throttle * 100) + '%') : h.paddle ? (h.throttle ? 'remando' : 'quieta') : steps[h.throttle] || Math.round(h.throttle * 100) + '%';
    let t = `<div class="sh-name">${h.icon} ${G.Net.esc(h.name)}</div><div class="bar sh-hp"><i style="width:${U.clamp(h.hp / h.max, 0, 1) * 100}%"></i></div>`;
    t += `<div>🧭 ${h.knots.toFixed(1)} nudos · ${h.engine ? '⚙️ Motor' : h.paddle ? '🛶 Remos' : '⛵ Velas'}: ${thr}</div>`;
    if (h.wind !== null) t += `<div>💨 Viento <span class="wind" style="transform:rotate(${-h.wind + Math.PI}rad)">⬆</span> ${h.windS > 1.1 ? 'fuerte' : 'suave'}</div>`;
    if (h.fuel !== null) t += `<div>⚫ Caldera: ${Math.round(h.fuel)} s</div>`;
    if (h.net !== null) t += `<div>🕸️ Red: ${h.net < 0 ? 'recogida' : h.net + ' peces'}</div>`;
    t += `<div>${h.anchor ? '⚓ Anclado' : ''}${h.ap ? ' 🤖 Piloto automático' : ''}</div>`;
    if (h.station === 'cannon') t += `<div>💣 ${h.reload > 0 ? 'Recargando ' + h.reload.toFixed(1) + ' s' : '¡Listo para disparar!'}</div>`;
    if (el.shipHud.innerHTML !== t) el.shipHud.innerHTML = t;
  }
  function updatePower() {
    const k = G.Story.fruitOf();
    el.powerHud.classList.toggle('hidden', !k);
    if (!k) return;
    const f = G.Story.FRUITS[k], cd = G.Story.powerCd;
    const t = `${f.icon} <b>${f.power}</b> <kbd>G</kbd> ${cd > 0 ? Math.ceil(cd) + ' s' : '✓'}`;
    if (el.powerHud.innerHTML !== t) el.powerHud.innerHTML = t;
  }

  // ------------------------------------------------------------------ mapas
  const disc = (s) => {
    const w = G.state.world && G.state.world.story;
    return s.id === 0 || (w && w.disc && w.disc[s.id]) || (G.Modes.active && s.main);
  };
  function drawIslands(ctx, toPx, scale, full) {
    for (const s of G.Arch.islands) {
      if (!s.map) continue;
      const [x, y] = toPx(s.x - s.ext, s.z - s.ext), w = s.ext * 2 * scale;
      if (x > 640 || y > 640 || x + w < 0 || y + w < 0) continue;
      if (disc(s)) ctx.drawImage(s.map, x, y, w, w);
      else if (full && s.main && G.Inv.has('log_mareas')) {
        const [cx, cy] = toPx(s.x, s.z);
        ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.setLineDash([6, 6]); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, cy, s.r * scale, 0, 7); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.font = '800 22px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('?', cx, cy + 8);
      }
    }
  }
  function drawMarkers(ctx, toPx, scale, full) {
    const P = G.Player.pos;
    for (const s of G.Build.list) {
      if (Math.abs(s.x - P.x) > 600 && !full) continue;
      const [x, y] = toPx(s.x, s.z);
      if (s.type === 'fogata') { ctx.fillStyle = s.fuel > 0 ? '#ff9a3c' : '#7a5a3a'; ctx.beginPath(); ctx.arc(x, y, full ? 4 : 3.5, 0, 7); ctx.fill(); }
      else if (s.type === 'cama') { ctx.fillStyle = '#9fd3ff'; ctx.fillRect(x - 3, y - 3, 6, 6); }
      else if (scale > 0.5) { ctx.fillStyle = '#c9a36b'; const w = Math.max(2, 3 * scale); ctx.fillRect(x - w / 2, y - w / 2, w, w); }
    }
    for (const s of G.Ships.list) {
      if (s.sinking) continue;
      const [x, y] = toPx(s.x, s.z);
      ctx.save(); ctx.translate(x, y); ctx.rotate(-s.yaw + Math.PI);
      ctx.fillStyle = s.team !== null && G.Modes.active ? G.Modes.teamColor(s.team) : s.building ? '#5ae0ff' : '#ffe066';
      ctx.strokeStyle = '#000'; ctx.lineWidth = 1.2;
      const k = full ? 1.2 : 1;
      ctx.beginPath(); ctx.moveTo(0, -7 * k); ctx.lineTo(4 * k, 5 * k); ctx.lineTo(-4 * k, 5 * k); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    // Lugares especiales ya vistos
    const w = G.state.world && G.state.world.story;
    for (const c of G.Landmarks.loot) {
      const seen = w && w.seen && w.seen[c.id];
      if (!seen || (c.opened && c.kind !== 'mono')) continue;
      const [x, y] = toPx(c.x, c.z);
      ctx.font = `${full ? 14 : 11}px sans-serif`; ctx.textAlign = 'center';
      ctx.fillText(c.kind === 'mono' ? '🗿' : c.kind === 'bottle' ? '🍾' : c.kind === 'barrel' ? '🛢️' : '📦', x, y + 4);
    }
    if (G.Modes.active) for (const sd of G.Modes.stands) {
      const [x, y] = toPx(sd.x, sd.z);
      ctx.font = `${full ? 16 : 12}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText('🏴', x, y);
      ctx.fillStyle = G.Modes.teamColor(sd.team); ctx.beginPath(); ctx.arc(x, y + 5, 3, 0, 7); ctx.fill();
    }
    for (const p of G.Net.peers.values()) {
      if (p.dead || p.out) continue;
      if (G.Modes.active && p.team !== G.Net.team && Math.hypot(p.x - P.x, p.z - P.z) > 60) continue;
      const [x, y] = toPx(p.x, p.z);
      ctx.fillStyle = p.color; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, full ? 6 : 4.5, 0, 7); ctx.fill(); ctx.stroke();
      if (full) { ctx.fillStyle = '#fff'; ctx.font = '700 12px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(p.name, x, y - 10); }
    }
    for (const c of G.Creatures.list) {
      if (c.dead || c.type === 'crab' || c.d.npc) continue;
      if (Math.hypot(c.x - P.x, c.z - P.z) > (full ? 60 : 70)) continue;
      const [x, y] = toPx(c.x, c.z);
      ctx.fillStyle = ['wolf', 'snowwolf', 'jaguar', 'bear', 'caiman', 'serpent', 'shark', 'boss'].includes(c.type) ? '#ff4d4d' : '#c89a6a';
      ctx.beginPath(); ctx.arc(x, y, c.type === 'serpent' || c.type === 'whale' ? 5 : 3, 0, 7); ctx.fill();
    }
    if (UI.waypoint) {
      const [x, y] = toPx(UI.waypoint.x, UI.waypoint.z);
      ctx.strokeStyle = '#ff4040'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x - 6, y - 6); ctx.lineTo(x + 6, y + 6); ctx.moveTo(x + 6, y - 6); ctx.lineTo(x - 6, y + 6); ctx.stroke();
    }
    if (G.Modes.active && G.Modes.st && G.Arch.treasure) {
      const T = G.Modes.st.teams[G.Net.team];
      if (T && T.frags >= 4) { const [x, y] = toPx(G.Arch.treasure.x, G.Arch.treasure.z); ctx.fillStyle = '#ff3030'; ctx.font = '900 22px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('✖', x, y + 8); }
    }
  }
  function drawPlayer(ctx, x, y, size) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-G.Player.yaw);
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, -size); ctx.lineTo(size * 0.7, size * 0.8); ctx.lineTo(0, size * 0.4); ctx.lineTo(-size * 0.7, size * 0.8); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  UI.drawMinimap = function () {
    const c = el.minimap, ctx = c.getContext('2d'), P = G.Player.pos;
    const span = P.ship ? 220 : 140, k = 180 / span;
    ctx.fillStyle = '#123a5c'; ctx.fillRect(0, 0, 180, 180);
    ctx.imageSmoothingEnabled = true;
    const toPx = (x, z) => [(x - P.x) * k + 90, (z - P.z) * k + 90];
    drawIslands(ctx, toPx, k, false);
    drawMarkers(ctx, toPx, k, false);
    drawPlayer(ctx, 90, 90, 7);
  };
  UI.openMap = function () {
    const P = G.Player.pos, isl = G.Arch.landOf(P.x, P.z);
    const m = UI.map;
    if (isl && !G.Player.ship) { m.cx = isl.x; m.cz = isl.z; m.scale = 600 / (isl.ext * 2); }
    else { m.cx = P.x; m.cz = P.z; m.scale = 0.25; }
    UI.drawBigMap();
    el.bigmap.classList.remove('hidden');
  };
  UI.drawBigMap = function () {
    const c = el.bigmapCanvas, ctx = c.getContext('2d'), m = UI.map;
    ctx.fillStyle = '#0e3354'; ctx.fillRect(0, 0, 640, 640);
    // Cuadrícula de navegación
    ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.lineWidth = 1;
    const step = m.scale > 1 ? 50 : 250;
    for (let v = Math.floor((m.cx - 320 / m.scale) / step) * step; v < m.cx + 320 / m.scale; v += step) { const x = (v - m.cx) * m.scale + 320; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 640); ctx.stroke(); }
    for (let v = Math.floor((m.cz - 320 / m.scale) / step) * step; v < m.cz + 320 / m.scale; v += step) { const y = (v - m.cz) * m.scale + 320; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(640, y); ctx.stroke(); }
    ctx.imageSmoothingEnabled = true;
    const toPx = (x, z) => [(x - m.cx) * m.scale + 320, (z - m.cz) * m.scale + 320];
    drawIslands(ctx, toPx, m.scale, true);
    drawMarkers(ctx, toPx, m.scale, true);
    // Nombres de las islas
    ctx.textAlign = 'center';
    for (const s of G.Arch.islands) {
      if (!disc(s)) continue;
      const [x, y] = toPx(s.x, s.z);
      ctx.font = `800 ${s.main ? 14 : 11}px Nunito, sans-serif`;
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillText(s.name, x + 1, y - (s.r * m.scale) - 5);
      ctx.fillStyle = s.team !== undefined && G.Modes.active ? G.Modes.teamColor(s.team) : 'rgba(255,255,255,.92)';
      ctx.fillText(s.name, x, y - (s.r * m.scale) - 6);
    }
    if (m.scale > 1) {
      const W = G.World;
      ctx.font = '700 12px Nunito, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.75)';
      let [lx, ly] = toPx(W.LAKE.x, W.LAKE.z); ctx.fillText('Lago (agua dulce)', lx, ly + 4);
      [lx, ly] = toPx(W.CAVE.x, W.CAVE.z); ctx.fillText('⛰️ Cueva', lx, ly + 18);
      [lx, ly] = toPx(W.WRECK.x, W.WRECK.z); ctx.fillText('⚓ Naufragio', lx, ly + 4);
    }
    const [x, y] = toPx(G.Player.pos.x, G.Player.pos.z);
    drawPlayer(ctx, x, y, 9);
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.font = '800 16px Nunito, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('N', 320, 22);
    el.mapInfo.textContent = `Rueda: zoom · Arrastra: mover · Clic: marcar destino · Clic derecho: borrar destino · ${Math.round(1 / m.scale * 100)} m por cada 100 px`;
  };
})();
