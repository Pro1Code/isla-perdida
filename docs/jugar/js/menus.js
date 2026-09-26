// Menú principal: Un Jugador (partidas guardadas y crear partida), Logros, Configuración y Tienda.
// El multijugador y el lobby están en main.js.
(function () {
  'use strict';
  const G = window.G;
  const Menus = (G.Menus = {});
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const PANELS = ['menuMain', 'menuSP', 'menuCreate', 'menuAch', 'menuMP', 'menuSettings', 'menuShop'];
  const DIFF = ['Fácil', 'Normal', 'Difícil'];
  let current = 'menuMain';

  Menus.show = function (id) {
    current = id;
    for (const p of PANELS) $(p).classList.toggle('hidden', p !== id);
    $('menuCard').classList.toggle('wide-card', id !== 'menuMain');
    $('profileChip').classList.toggle('hidden', id !== 'menuMain');
    if (id !== 'menuSettings' && id !== 'menuShop') G.Shop.Preview.stop();
    if (id === 'menuMain') Menus.refreshChip();
  };
  Menus.current = () => current;

  // ------------------------------------------------------------------ perfil (arriba a la derecha)
  Menus.refreshChip = function () {
    const P = G.Profile;
    $('profileChip').innerHTML = `<i style="background:${esc(P.look().shirt)}"></i><b>${esc(P.name())}</b><span>🏆 ${G.Ach.count()}/100</span><span>🪙 ${P.coins()}</span>`;
    $('achCount').textContent = `${G.Ach.count()}/100`;
    $('shopCoins').textContent = `🪙 ${P.coins()} doblones`;
  };

  // ------------------------------------------------------------------ lista de partidas
  const ago = (t) => {
    const m = Math.round((Date.now() - t) / 60000);
    if (m < 2) return 'hace un momento';
    if (m < 60) return `hace ${m} min`;
    const h = Math.round(m / 60);
    if (h < 24) return `hace ${h} h`;
    const d = Math.round(h / 24);
    return d < 30 ? `hace ${d} día${d > 1 ? 's' : ''}` : new Date(t).toLocaleDateString('es');
  };
  const dur = (s) => (s < 3600 ? `${Math.max(1, Math.round(s / 60))} min` : `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min`);
  // kind: 'sp' o 'mp' · onPlay(w): qué hacer al pulsar Jugar / Hospedar
  Menus.renderWorlds = function (box, kind, onPlay) {
    const list = G.Worlds.list(kind);
    if (!list.length) {
      box.innerHTML = `<div class="world-empty">${kind === 'sp' ? '🏝️ Aún no tienes partidas. ¡Crea tu primera isla!' : '🤝 Aún no tienes mundos para jugar con amigos. Crea uno nuevo.'}</div>`;
      return;
    }
    box.innerHTML = list.map((w) => `<div class="world" data-id="${w.id}">
      <div class="w-main"><b class="w-name">${esc(w.name)}</b>
        <div class="w-tags"><span class="tag d${w.diff}">${DIFF[w.diff] || 'Normal'}</span>${w.cheats ? '<span class="tag cheat">🪄 Trucos</span>' : ''}<span>${w.fresh ? 'Sin empezar' : `Día ${w.day || 1}`}</span>${w.time ? `<span>⏱️ ${dur(w.time)}</span>` : ''}<span class="muted">${ago(w.played || w.created)}</span>${w.ver && w.ver !== G.VERSION ? `<span class="muted">v${esc(w.ver)}</span>` : ''}</div></div>
      <div class="w-btns"><button class="btn small primary" data-a="play">${kind === 'sp' ? '▶ Jugar' : '👑 Hospedar'}</button><button class="btn small icon" data-a="ren" title="Renombrar">✏️</button><button class="btn small icon" data-a="del" title="Borrar">🗑️</button></div>
    </div>`).join('');
    box.onclick = async (e) => {
      const b = e.target.closest('button[data-a]');
      if (!b) return;
      const card = b.closest('.world'), w = G.Worlds.get(card.dataset.id);
      if (!w) return;
      if (b.dataset.a === 'play') { box.querySelectorAll('button').forEach((x) => (x.disabled = true)); try { await onPlay(w); } finally { box.querySelectorAll('button').forEach((x) => (x.disabled = false)); } }
      else if (b.dataset.a === 'ren') {
        const nm = card.querySelector('.w-name');
        nm.outerHTML = `<input class="mp-input w-edit" maxlength="32" value="${esc(w.name)}" />`;
        const inp = card.querySelector('.w-edit');
        inp.focus(); inp.select();
        const done = () => { G.Worlds.rename(w.id, inp.value); Menus.renderWorlds(box, kind, onPlay); };
        inp.onkeydown = (ev) => { if (ev.key === 'Enter') done(); if (ev.key === 'Escape') Menus.renderWorlds(box, kind, onPlay); };
        inp.onblur = done;
      } else if (b.dataset.a === 'del') {
        if (b.dataset.sure) { await G.Worlds.remove(w.id); Menus.renderWorlds(box, kind, onPlay); return; }
        b.dataset.sure = '1'; b.textContent = '¿Borrar?'; b.classList.add('danger');
        setTimeout(() => { if (b.isConnected) { delete b.dataset.sure; b.textContent = '🗑️'; b.classList.remove('danger'); } }, 3000);
      }
    };
  };
  function openSP() {
    Menus.show('menuSP');
    Menus.renderWorlds($('spList'), 'sp', (w) => G.Main.playSingle(w));
    Menus.refreshChip();
  }

  // ------------------------------------------------------------------ crear partida
  let createKind = 'sp', createDiff = 1;
  Menus.openCreate = function (kind) {
    createKind = kind;
    Menus.show('menuCreate');
    $('cwTitle').textContent = kind === 'sp' ? '🏝️ Nueva partida' : '🤝 Nuevo mundo para jugar con amigos';
    $('cwName').value = G.Worlds.freeName(kind === 'sp' ? 'Mi isla' : 'Isla de la tripulación');
    $('cwSeed').value = '';
    $('cwCheats').checked = false;
    setDiff(1);
    setTimeout(() => { $('cwName').focus(); $('cwName').select(); }, 30);
  };
  function setDiff(d) { createDiff = d; document.querySelectorAll('#cwDiff .diff').forEach((b) => b.classList.toggle('on', +b.dataset.d === d)); }
  // La semilla puede ser un número o cualquier palabra
  function seedOf(txt) {
    txt = String(txt || '').trim();
    if (!txt) return null;
    if (/^\d+$/.test(txt)) return (+txt >>> 0) || 1;
    let h = 2166136261;
    for (const ch of txt) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
    return h || 1;
  }
  async function create() {
    const w = G.Worlds.create({ kind: createKind, name: $('cwName').value, diff: createDiff, death: $('cwDeath').value, cheats: $('cwCheats').checked, seed: seedOf($('cwSeed').value) });
    if (createKind === 'sp') { $('cwCreate').disabled = true; try { await G.Main.playSingle(w); } finally { $('cwCreate').disabled = false; } }
    else { G.Main.mpHome(); G.Main.hostNewWorld(w); }
  }

  // ------------------------------------------------------------------ logros
  let achFrom = 'menuSP', achTab = 'all';
  const TAB_ORDER = [['all', 'Todos'], ['c', 'Comunes'], ['e', 'Especiales'], ['r', 'Raros'], ['p', 'Épicos'], ['l', 'Legendarios'], ['done', '✔ Conseguidos'], ['pending', 'Pendientes']];
  function openAch(from) {
    achFrom = from || 'menuSP';
    Menus.show('menuAch');
    const A = G.Ach, n = A.count();
    $('achSummary').textContent = `${n}/100 conseguidos · ${G.Profile.data.earned || 0} 🪙 ganados en total`;
    $('achTiers').innerHTML = Object.entries(A.TIERS).map(([k, T]) => {
      const all = A.LIST.filter((a) => a.t === k), got = all.filter((a) => G.Profile.hasAch(a.id)).length;
      return `<div class="tier" style="--tc:${T.color}"><b>${got}/${all.length}</b><span>${T.plural}</span><div class="bar"><i style="width:${(got / all.length) * 100}%"></i></div></div>`;
    }).join('');
    $('achTabs').innerHTML = TAB_ORDER.map(([k, n2]) => `<button data-k="${k}" class="${k === achTab ? 'on' : ''}">${n2}</button>`).join('');
    Menus.renderAch($('achList'), achTab);
  }
  // filter: 'all' | rango | 'done' | 'pending'
  Menus.renderAch = function (box, filter) {
    const A = G.Ach, PR = G.Profile;
    let list = A.LIST;
    if (A.TIERS[filter]) list = list.filter((a) => a.t === filter);
    if (filter === 'done') list = list.filter((a) => PR.hasAch(a.id));
    if (filter === 'pending') list = list.filter((a) => !PR.hasAch(a.id));
    const cheats = G.Cheats.enabled();
    box.innerHTML = (cheats ? '<div class="world-empty">🪄 Estás en una partida con trucos: aquí no se consiguen logros.</div>' : '') +
      (list.length ? list.map((a) => {
        const T = A.TIERS[a.t], got = PR.hasAch(a.id), pr = A.progress(a);
        const bar = !got && a.c && a.goal > 1 ? `<div class="bar"><i style="width:${pr * 100}%"></i></div><small class="muted">${Math.min(PR.cnt(a.c), a.goal).toLocaleString('es')} / ${a.goal.toLocaleString('es')}</small>` : '';
        return `<div class="ach ${got ? 'got' : ''}" style="--tc:${T.color}"><div class="ach-ic">${a.i}</div><div class="ach-tx"><b>${esc(a.n)}</b><span>${esc(a.d)}</span>${bar}</div>
          <div class="ach-side"><span class="tier-tag">${T.name}</span><small>${got ? '✔ ' + new Date(PR.data.ach[a.id]).toLocaleDateString('es') : '+' + T.coins + ' 🪙'}</small></div></div>`;
      }).join('') : '<div class="world-empty">¡No queda ninguno aquí!</div>');
  };

  // ------------------------------------------------------------------ configuración
  let setPage = 'char';
  function swatches(box, colors, cur, onPick) {
    box.innerHTML = colors.map((c) => `<button class="swatch${c.toLowerCase() === String(cur).toLowerCase() ? ' on' : ''}" data-c="${c}" style="background:${c}"></button>`).join('');
    box.onclick = (e) => { const b = e.target.closest('.swatch'); if (b) onPick(b.dataset.c); };
  }
  function charPreview() { G.Shop.Preview.show($('charPreview'), { look: G.Profile.look(), cos: G.Profile.cosIds() }); }
  function renderChar() {
    const P = G.Profile, L = P.look();
    $('setName').value = P.name();
    const pick = (k) => (c) => { P.setLook(k, c); renderChar(); };
    swatches($('setSkin'), P.SKINS, L.skin, pick('skin'));
    swatches($('setShirt'), P.SHIRTS, L.shirt, pick('shirt'));
    swatches($('setPants'), P.PANTS, L.pants, pick('pants'));
    $('setCos').innerHTML = ['hat', 'face', 'back', 'pet'].map((slot) => {
      const S = G.Shop.SLOTS[slot], owned = G.Shop.CATALOG.filter((c) => c.slot === slot && P.owns(c.id)), cur = P.equipped(slot);
      return `<div class="cos-row"><span>${S.icon} ${S.one}</span><select data-slot="${slot}"${owned.length ? '' : ' disabled'}><option value="">${owned.length ? 'Ninguno' : 'Ninguno (cómpralos en la Tienda)'}</option>${owned.map((c) => `<option value="${c.id}"${c.id === cur ? ' selected' : ''}>${c.icon} ${esc(c.name)}</option>`).join('')}</select></div>`;
    }).join('');
    charPreview();
    Menus.refreshChip();
  }
  function renderSettings() {
    document.querySelectorAll('#setTabs button').forEach((b) => b.classList.toggle('on', b.dataset.p === setPage));
    document.querySelectorAll('#menuSettings .set-page').forEach((p) => p.classList.toggle('hidden', p.dataset.p !== setPage));
    const P = G.Profile;
    if (setPage === 'char') renderChar(); else G.Shop.Preview.stop();
    $('setSens').value = P.set('sens'); $('setSensV').textContent = (+P.set('sens')).toFixed(2) + '×';
    $('setFov').value = P.set('fov'); $('setFovV').textContent = P.set('fov') + '°';
    $('setInvY').checked = !!P.set('invY');
    $('setFps').checked = !!P.set('fps');
    for (const k of ['vol', 'sfx', 'amb']) { $('set' + k[0].toUpperCase() + k.slice(1)).value = P.set(k); $('set' + k[0].toUpperCase() + k.slice(1) + 'V').textContent = P.set(k) + '%'; }
    document.querySelectorAll('#setQuality button').forEach((b) => b.classList.toggle('on', b.dataset.q === G.Main.quality));
    $('setVersion').innerHTML = `<b>Isla Perdida ${esc(G.VERSION)}</b> · ${esc(G.VERSION_NAME)}<br><small class="muted">${window.islaDesktop ? 'App de escritorio: puedes tener varias versiones y elegir cuál jugar en el lanzador.' : 'Versión para navegador: siempre es la última.'}</small>`;
  }
  function openSettings(page) {
    if (page) setPage = page;
    Menus.show('menuSettings');
    renderSettings();
  }

  // ------------------------------------------------------------------ tienda
  let shopSlot = 'hat', shopSel = null;
  function openShop() {
    Menus.show('menuShop');
    Menus.refreshChip();
    renderShop();
  }
  function renderShop() {
    const P = G.Profile, S = G.Shop;
    $('shopTabs').innerHTML = Object.entries(S.SLOTS).map(([k, v]) => `<button data-k="${k}" class="${k === shopSlot ? 'on' : ''}">${v.icon} ${v.name}</button>`).join('');
    const items = S.CATALOG.filter((c) => c.slot === shopSlot);
    if (!shopSel || !items.some((c) => c.id === shopSel)) shopSel = items[0].id;
    $('shopGrid').innerHTML = items.map((c) => {
      const own = P.owns(c.id), on = P.equipped(c.slot) === c.id;
      return `<button class="shop-item${c.id === shopSel ? ' sel' : ''}${own ? ' own' : ''}" data-id="${c.id}"><span class="si-ic">${c.icon}</span><b>${esc(c.name)}</b><span class="si-price">${on ? '✔ Puesto' : own ? 'Tuyo' : `🪙 ${c.price}`}</span></button>`;
    }).join('');
    const c = S.byId(shopSel), own = P.owns(c.id), on = P.equipped(c.slot) === c.id, lack = c.price - P.coins();
    const ship = ['sail', 'flag', 'fh'].includes(c.slot);
    $('shopInfo').innerHTML = `<h4>${c.icon} ${esc(c.name)}</h4><p class="muted">${esc(c.desc)}</p>` +
      (ship ? '<p class="small-text muted">Se usa en tus barcos: los nuevos lo llevan puesto, y en uno que ya tengas pulsa <kbd>R</kbd> a bordo. También aparece al elegir el diseño en el astillero.</p>' : '') +
      (own ? `<button id="shopEquip" class="btn ${on ? 'small' : 'primary'}">${on ? 'Quitármelo' : 'Ponérmelo'}</button>`
        : `<button id="shopBuy" class="btn primary"${lack > 0 ? ' disabled' : ''}>Comprar por 🪙 ${c.price}</button>${lack > 0 ? `<p class="warn-text">Te faltan ${lack} doblones.</p>` : ''}`);
    // Vista previa: el personaje con el cosmético o el diseño del barco
    const flat = $('shopFlat');
    if (c.slot === 'sail' || c.slot === 'flag') {
      $('shopPreview').classList.add('hidden'); flat.classList.remove('hidden'); G.Shop.Preview.stop();
      drawFlat(flat, c);
    } else {
      $('shopPreview').classList.remove('hidden'); flat.classList.add('hidden');
      if (c.slot === 'fh') G.Shop.Preview.show($('shopPreview'), { fh: c.id.replace('fh_', '') });
      else {
        const cos = G.Profile.cosIds().filter((id) => G.Shop.byId(id).slot !== c.slot).concat([c.id]);
        G.Shop.Preview.show($('shopPreview'), { look: G.Profile.look(), cos });
      }
    }
    const buy = $('shopBuy'), eq = $('shopEquip');
    if (buy) buy.onclick = () => {
      if (!G.Profile.spend(c.price)) return;
      G.Profile.grant(c.id);
      G.Profile.equip(c.slot, c.id);
      G.Audio.init(); G.Audio.play('loot');
      renderShop(); Menus.refreshChip();
    };
    if (eq) eq.onclick = () => { G.Profile.equip(c.slot, on ? null : c.id); G.Audio.init(); G.Audio.play('select'); renderShop(); };
  }
  // Velas y banderas se muestran en 2D
  function drawFlat(box, c) {
    const cv = document.createElement('canvas');
    cv.width = 320; cv.height = 220;
    const x = cv.getContext('2d');
    x.fillStyle = '#10222c'; x.fillRect(0, 0, cv.width, cv.height);
    if (c.slot === 'flag') {
      x.save(); x.translate(32, 30); x.scale(2, 2);
      x.fillStyle = '#111'; x.fillRect(0, 0, 128, 80);
      G.Shop.drawFlag(x, 128, 80, c.id.replace('flag_', ''));
      x.restore();
      x.fillStyle = '#7a5230'; x.fillRect(22, 20, 10, 190);
    } else {
      const d = c.id.replace('sail_', ''), w = 200, h = 180, ox = 60, oy = 20;
      const img = x.createImageData(w, h), col = new THREE.Color();
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        col.set(G.Shop.sailColorAt(d, i / w, j / h));
        const k = (j * w + i) * 4, shade = 0.82 + 0.18 * Math.sin(Math.PI * i / w);
        img.data[k] = col.r * 255 * shade; img.data[k + 1] = col.g * 255 * shade; img.data[k + 2] = col.b * 255 * shade; img.data[k + 3] = 255;
      }
      x.putImageData(img, ox, oy);
      x.fillStyle = '#7a5230'; x.fillRect(ox - 12, oy - 8, w + 24, 8); x.fillRect(ox + w / 2 - 5, 0, 10, cv.height);
    }
    box.innerHTML = '';
    box.appendChild(cv);
  }

  // ------------------------------------------------------------------ arranque
  Menus.init = function () {
    $('btnSP').onclick = openSP;
    $('btnSettings').onclick = () => openSettings();
    $('btnShop').onclick = openShop;
    $('profileChip').onclick = () => openSettings('char');
    document.querySelectorAll('#menu .back').forEach((b) => (b.onclick = () => { G.Net.disconnect(); Menus.show('menuMain'); }));
    $('spNew').onclick = () => Menus.openCreate('sp');
    $('btnAch').onclick = () => openAch('menuSP');
    $('achBack').onclick = () => (achFrom === 'menuSP' ? openSP() : Menus.show(achFrom));
    $('achTabs').onclick = (e) => { const b = e.target.closest('button[data-k]'); if (!b) return; achTab = b.dataset.k; openAch(achFrom); };
    // Crear partida
    $('cwDeath').innerHTML = Object.entries(G.Modes.DEATH).filter(([k]) => k !== 'out').map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
    $('cwDeath').value = 'half';
    $('cwDiff').onclick = (e) => { const b = e.target.closest('.diff'); if (b) setDiff(+b.dataset.d); };
    $('cwCancel').onclick = () => (createKind === 'sp' ? openSP() : G.Main.mpHome());
    $('cwCreate').onclick = create;
    $('cwName').onkeydown = (e) => { if (e.key === 'Enter') create(); };
    // Configuración
    $('setTabs').onclick = (e) => { const b = e.target.closest('button[data-p]'); if (!b) return; setPage = b.dataset.p; renderSettings(); };
    $('setName').onchange = () => { G.Profile.setName($('setName').value); $('setName').value = G.Profile.name(); Menus.refreshChip(); };
    $('setCos').onchange = (e) => { const s = e.target.dataset.slot; if (s) { G.Profile.equip(s, e.target.value || null); charPreview(); } };
    const slider = (id, key, fmt, after) => { $(id).oninput = () => { G.Profile.setSetting(key, +$(id).value); $(id + 'V').textContent = fmt(+$(id).value); if (after) after(); }; };
    slider('setSens', 'sens', (v) => v.toFixed(2) + '×');
    slider('setFov', 'fov', (v) => v + '°');
    for (const k of ['Vol', 'Sfx', 'Amb']) slider('set' + k, k.toLowerCase(), (v) => v + '%', () => G.Audio.setVolumes());
    $('setInvY').onchange = () => G.Profile.setSetting('invY', $('setInvY').checked);
    $('setFps').onchange = () => G.Profile.setSetting('fps', $('setFps').checked);
    $('setQuality').onclick = (e) => { const b = e.target.closest('button[data-q]'); if (b) { G.Main.setQuality(b.dataset.q); renderSettings(); } };
    // Tienda
    $('shopTabs').onclick = (e) => { const b = e.target.closest('button[data-k]'); if (!b) return; shopSlot = b.dataset.k; shopSel = null; renderShop(); };
    $('shopGrid').onclick = (e) => { const b = e.target.closest('.shop-item'); if (!b) return; shopSel = b.dataset.id; renderShop(); };
    G.Profile.onCoins = () => Menus.refreshChip();
    G.Profile.onLook = () => { if (G.state.mode !== 'menu') G.Player.refreshCosmetics(); };
    // Versión, descargas y lanzador
    $('versionLabel').textContent = `Versión ${G.VERSION} · ${G.VERSION_NAME}`;
    $('btnDownloads').href = G.DOWNLOAD_URL;
    const D = window.islaDesktop;
    if (D) {
      $('btnDownloads').classList.add('hidden');
      // Botón del lanzador (la app antigua añade uno propio si no encuentra este id)
      if (D.openLauncher) { $('btnLauncher').classList.remove('hidden'); $('btnLauncher').onclick = () => D.openLauncher(); }
      if (D.checkUpdates) { $('btnCheckUpd').classList.remove('hidden'); $('btnCheckUpd').onclick = () => { D.checkUpdates(); $('setUpdState').textContent = 'Buscando actualizaciones…'; }; }
      const note = $('updateNote');
      D.onUpdate((u) => {
        note.classList.toggle('hidden', !['downloading', 'ready'].includes(u.state));
        if (u.state === 'downloading') note.textContent = `⬇️ Descargando la versión ${u.version}… ${u.percent || 0}%`;
        if (u.state === 'ready') { note.innerHTML = `✅ Versión ${u.version} lista. <button class="btn small" id="btnUpd">Reiniciar y actualizar</button>`; $('btnUpd').onclick = () => D.installUpdate(); }
        $('setUpdState').textContent = u.state === 'latest' ? '✔ Tienes la última versión de la app.' : u.state === 'error' ? 'No se pudo comprobar (¿sin conexión?).' : u.state === 'checking' ? 'Buscando actualizaciones…' : note.textContent;
      });
    }
    Menus.refreshChip();
  };
})();
