// Controles táctiles (móvil y tableta, en el navegador o en la app):
//   - Joystick a la izquierda (aparece donde pones el dedo): moverse; empujado hasta el borde, corres.
//   - Arrastrar el dedo por la derecha de la pantalla: mirar (girar la cámara).
//   - Botones de acción a la derecha: atacar (mantener = seguir golpeando), pesado / usar, parar (mantener =
//     bloquear), esquivar, saltar, bajar (nadando), acción (E), fijar enemigo, técnica y definitivo. Cambian
//     según lo que llevas en la mano (colocar, disparar, pescar, comer…) y solo se ven cuando sirven.
//   - Botones de menú arriba: pausa, inventario, mapa, bitácora, cámara, chat (LAN) y modo creativo.
//   - En el inventario, el mapa, la bitácora…: botón ✕ para volver. El mapa se mueve con el dedo y se amplía
//     pellizcando; tocar marca el destino.
// Los botones reutilizan las mismas acciones que el teclado y el ratón (se envían como teclas), así todo lo que
// funciona con teclado funciona igual en el móvil. Se activa solo en pantallas táctiles (o desde Configuración).
(function () {
  'use strict';
  const G = window.G, U = G.U;
  const T = (G.Touch = { on: false });
  const $ = (id) => document.getElementById(id);
  const isMobile = () => /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
  T.coarse = () => !!((window.matchMedia && matchMedia('(pointer: coarse)').matches) || isMobile());
  T.want = () => { const s = G.Profile.set('touch') || 'auto'; return s === 'on' ? true : s === 'off' ? false : T.coarse(); };

  // ------------------------------------------------------------------ teclas y clics simulados
  const key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, key: '', bubbles: true, cancelable: true }));
  const tap = (code) => { key(code, true); setTimeout(() => key(code, false), 60); };

  // ------------------------------------------------------------------ botones
  const melee = () => G.Parry.canGuard();
  const heldIt = () => { const id = G.Inv.heldId(); return id ? G.ITEMS[id] : null; };
  const inWater = () => G.Player.swimming || (G.Cheats.flag && G.Cheats.flag('fly'));
  // [id, icono, texto, acción, mantener, cuándo se ve, icono/texto según el objeto]
  const ACT = [
    ['atk', '⚔️', 'Atacar', { down: () => G.Main.pointerDown(0), up: () => G.Main.pointerUp(0) }, true, null, () => {
      const it = heldIt();
      if (it && (it.place || it.ship || it.plano)) return ['📦', 'Colocar'];
      if (it && it.gun) return ['🔫', 'Disparar'];
      if (it && it.fishing) return ['🎣', 'Pescar'];
      if (it && it.style === 'magic' && G.Styles.learned('magic')) return ['🔮', 'Magia'];
      if (it && it.tool && !it.dmg) return ['⛏️', 'Golpear'];
      return null;
    }],
    ['hvy', '💥', 'Pesado', { down: () => G.Main.pointerDown(2), up: () => G.Main.pointerUp(2) }, true, () => melee() || (heldIt() && (heldIt().use || heldIt().eq || heldIt().fruit || heldIt().read || heldIt().spyglass || heldIt().place || heldIt().ship)), () => {
      const it = heldIt();
      if (!it || melee()) return null;
      if (it.spyglass) return ['🔭', 'Mirar'];
      if (it.fruit) return ['🍇', 'Comer'];
      if (it.use) return ['🍴', 'Usar'];
      if (it.eq) return ['🧥', 'Ponerse'];
      if (it.read) return ['📜', 'Leer'];
      return ['✋', 'Usar'];
    }],
    ['par', '🛡️', 'Parar', { key: 'KeyF' }, true, () => melee()],
    ['dge', '💨', 'Esquivar', { key: 'KeyQ' }, false, () => !G.Player.swimming && !G.Player.ship, () => (G.Player.station && G.Player.station.kind === 'helm' ? ['🧭', 'Piloto'] : null)],
    ['jmp', '⤒', 'Saltar', { key: 'Space' }, true, null, () => (G.Player.station && G.Player.station.kind === 'helm' ? ['⚓', 'Ancla'] : G.Player.swimming ? ['⤒', 'Subir'] : null)],
    ['dwn', '⤓', 'Bajar', { key: 'KeyC' }, true, () => inWater()],
    ['act', '✋', 'Acción', { key: 'KeyE' }, false, null],
    ['lck', '🎯', 'Fijar', { key: 'KeyT' }, false, () => melee() && !G.Player.ship, () => (G.Combat.lock ? ['🎯', 'Soltar'] : null)],
    ['tec', '✨', 'Técnica', { key: 'KeyZ' }, false, () => !!G.Styles.active()],
    ['ult', '🔥', 'Definitivo', { key: 'KeyR' }, false, () => { const k = G.Styles.active(); if (k && G.Styles.level(k) >= 3) return true; const it = heldIt(); return !!(it && (it.place || it.ship || it.plano)); }, () => { const it = heldIt(); return it && (it.place || it.ship || it.plano) ? ['↻', 'Girar'] : null; }],
    ['dem', '🔨', 'Desmontar', { key: 'KeyX' }, false, () => { const t = G.Game.target; return !!(t && t.kind === 'struct'); }],
  ];
  const MENU = [
    ['pau', '⏸️', 'Pausa', { fn: () => G.Main.pause() }, () => true],
    ['inv', '🎒', 'Mochila', { key: 'Tab' }, () => true],
    ['map', '🗺️', 'Mapa', { key: 'KeyM' }, () => true],
    ['jrn', '📖', 'Bitácora', { key: 'KeyJ' }, () => true],
    ['cam', '📷', 'Cámara', { key: 'KeyV' }, () => true],
    ['cht', '💬', 'Chat', { key: 'Enter' }, () => G.Net.active],
    ['frt', '🌀', 'Poder', { key: 'KeyG' }, () => !!(G.state.fruit)],
    ['crt', '🪄', 'Creativo', { key: 'KeyK' }, () => G.Cheats.enabled()],
    ['fs', '⛶', 'Pantalla completa', { fn: () => toggleFullscreen() }, () => !!document.documentElement.requestFullscreen],
  ];
  let root = null, look = null, joy = null, knob = null, back = null, rotate = null;
  const btns = {};
  function build() {
    if (root) return;
    look = document.createElement('div'); look.id = 'tLook'; document.body.appendChild(look);
    root = document.createElement('div'); root.id = 'tUI'; document.body.appendChild(root);
    joy = document.createElement('div'); joy.id = 'tJoy'; joy.innerHTML = '<i></i>'; knob = joy.firstChild; look.appendChild(joy);
    const acts = document.createElement('div'); acts.className = 't-acts'; root.appendChild(acts);
    for (const [id, ic, txt, a, hold, show, dyn] of ACT) acts.appendChild(button(id, ic, txt, a, hold, show, dyn));
    const menu = document.createElement('div'); menu.className = 't-menu'; root.appendChild(menu);
    for (const [id, ic, txt, a, show] of MENU) menu.appendChild(button(id, ic, txt, a, false, show));
    back = document.createElement('button'); back.id = 'tBack'; back.textContent = '✕'; document.body.appendChild(back);
    back.addEventListener('touchstart', (e) => { e.preventDefault(); goBack(); }, { passive: false });
    back.addEventListener('click', goBack);
    rotate = document.createElement('div'); rotate.id = 'tRotate'; rotate.innerHTML = '<div><b>📱↻</b>Gira el móvil para jugar en horizontal</div>'; document.body.appendChild(rotate);
    bindLook();
    bindHotbar();
    bindMap();
  }
  function button(id, ic, txt, a, hold, show, dyn) {
    const b = document.createElement('button');
    b.className = 't-btn t-' + id;
    b.innerHTML = `<span class="ti">${ic}</span><span class="tt">${txt}</span>`;
    btns[id] = { el: b, show, dyn, ic, txt, cur: '' };
    const down = (e) => {
      e.preventDefault(); e.stopPropagation();
      if (b.classList.contains('down')) return;
      b.classList.add('down');
      if (navigator.vibrate) try { navigator.vibrate(8); } catch (err) { /* nada */ }
      if (a.key) { if (hold) key(a.key, true); else tap(a.key); }
      else if (a.down) a.down(); else if (a.fn) a.fn();
    };
    const up = (e) => {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      if (!b.classList.contains('down')) return;
      b.classList.remove('down');
      if (a.key && hold) key(a.key, false);
      else if (a.up) a.up();
    };
    b.addEventListener('touchstart', down, { passive: false });
    b.addEventListener('touchend', up, { passive: false });
    b.addEventListener('touchcancel', up, { passive: false });
    // Con ratón (pantallas táctiles de portátil o para probar): igual
    b.addEventListener('mousedown', down);
    b.addEventListener('mouseup', up);
    b.addEventListener('mouseleave', () => up());
    return b;
  }
  // ✕: cierra lo que esté abierto (inventario, mapa, bitácora, creativo, diálogo…)
  function goBack() {
    const m = G.state.mode;
    if (G.Story.dialog) { tap('Escape'); return; }
    if (m === 'inventory') G.Game.closeInventory();
    else if (m === 'map') G.Game.closeMap();
    else if (m === 'journal') G.Game.closeJournal();
    else if (m === 'cheats') G.Cheats.close();
    else tap('Escape');
  }

  // ------------------------------------------------------------------ joystick y mirar
  const J = { id: null, x0: 0, y0: 0, edge: 0 }, L = { id: null, x: 0, y: 0 };
  const R = 58; // radio del joystick (px)
  function bindLook() {
    look.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (!fullTried) { fullTried = true; goFull(); }
      for (const t of e.changedTouches) {
        const left = t.clientX < window.innerWidth * 0.42;
        if (left && J.id === null) {
          J.id = t.identifier; J.x0 = t.clientX; J.y0 = t.clientY;
          joy.style.left = t.clientX + 'px'; joy.style.top = t.clientY + 'px';
          joy.classList.add('on'); knob.style.transform = 'translate(-50%, -50%)';
        } else if (!left && L.id === null) { L.id = t.identifier; L.x = t.clientX; L.y = t.clientY; }
      }
    }, { passive: false });
    look.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === J.id) {
          let dx = t.clientX - J.x0, dy = t.clientY - J.y0;
          const d = Math.hypot(dx, dy);
          if (d > R) { dx *= R / d; dy *= R / d; }
          knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
          setAxis(dx / R, dy / R);
        } else if (t.identifier === L.id) {
          const dx = t.clientX - L.x, dy = t.clientY - L.y;
          L.x = t.clientX; L.y = t.clientY;
          lookBy(dx, dy);
        }
      }
    }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === J.id) { J.id = null; joy.classList.remove('on'); setAxis(0, 0); }
        if (t.identifier === L.id) L.id = null;
      }
    };
    look.addEventListener('touchend', end, { passive: false });
    look.addEventListener('touchcancel', end, { passive: false });
  }
  // Joystick → movimiento analógico (player.js) y teclas W/A/S/D (timón, volar…); al borde, correr
  const K = () => G.Input.keys;
  function setAxis(x, y) {
    const ax = (G.Input.axis = G.Input.axis || { x: 0, y: 0 });
    ax.x = Math.abs(x) < 0.12 ? 0 : x; ax.y = Math.abs(y) < 0.12 ? 0 : y;
    const k = K();
    k.KeyW = ax.y < -0.4; k.KeyS = ax.y > 0.4; k.KeyA = ax.x < -0.4; k.KeyD = ax.x > 0.4;
    const full = Math.hypot(x, y) > 0.93 && y < -0.5;
    J.edge = full ? J.edge || performance.now() : 0;
    if (!full) k.ShiftLeft = false;
  }
  function lookBy(dx, dy) {
    if (G.state.mode !== 'playing' || G.Combat.lock) return;
    if (G.Ships.aimInput(dx * 1.6, dy * 1.6)) return;
    const P = G.Player, k = (P.zoom ? 0.0012 : 0.0048) * G.Profile.set('sens'), inv = G.Profile.set('invY') ? -1 : 1;
    P.yaw -= dx * k;
    P.pitch = U.clamp(P.pitch - dy * k * inv, -1.45, 1.45);
  }

  // ------------------------------------------------------------------ barra rápida, mapa y pantalla completa
  function bindHotbar() {
    const hb = $('hotbar');
    if (!hb) return;
    hb.addEventListener('touchstart', (e) => {
      const s = e.target.closest('.slot');
      if (!s) return;
      e.preventDefault();
      const i = [...hb.children].indexOf(s);
      if (i >= 0) { G.Inv.sel = i; G.Inv.changed(); G.Audio.play('select'); }
    }, { passive: false });
  }
  function bindMap() {
    const cv = $('bigmapCanvas');
    if (!cv) return;
    let d = null;
    const pos = (t) => { const r = cv.getBoundingClientRect(), k = 640 / r.width; return [(t.clientX - r.left) * k, (t.clientY - r.top) * k]; };
    cv.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const m = G.UI.map;
      if (e.touches.length >= 2) { const a = pos(e.touches[0]), b = pos(e.touches[1]); d = { pinch: Math.hypot(a[0] - b[0], a[1] - b[1]), scale: m.scale, moved: true }; return; }
      const p = pos(e.touches[0]);
      d = { x: p[0], y: p[1], cx: m.cx, cz: m.cz, moved: false };
    }, { passive: false });
    cv.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (!d) return;
      const m = G.UI.map;
      if (d.pinch && e.touches.length >= 2) {
        const a = pos(e.touches[0]), b = pos(e.touches[1]);
        m.scale = U.clamp(d.scale * Math.hypot(a[0] - b[0], a[1] - b[1]) / d.pinch, 0.12, 4);
      } else if (!d.pinch) {
        const p = pos(e.touches[0]), dx = p[0] - d.x, dy = p[1] - d.y;
        if (Math.abs(dx) + Math.abs(dy) > 8) d.moved = true;
        if (d.moved) { m.cx = d.cx - dx / m.scale; m.cz = d.cz - dy / m.scale; }
      }
      G.UI.drawBigMap();
    }, { passive: false });
    cv.addEventListener('touchend', (e) => {
      e.preventDefault();
      if (!d) return;
      const was = d; d = null;
      if (was.moved || e.touches.length) return;
      // Toque sin arrastrar: marcar el destino
      const t = e.changedTouches[0], p = pos(t), m = G.UI.map;
      G.UI.waypoint = { x: m.cx + (p[0] - 320) / m.scale, z: m.cz + (p[1] - 320) / m.scale };
      G.Audio.play('select');
      G.UI.msg('📍 Destino marcado. Al timón, pulsa 🧭 para el piloto automático.', 'info', 'wp');
      G.UI.drawBigMap();
    }, { passive: false });
  }
  let fullTried = false;
  function goFull() {
    const el = document.documentElement;
    try {
      const p = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : el.webkitRequestFullscreen ? el.webkitRequestFullscreen() : null;
      if (p && p.then) p.then(() => { try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* nada */ } }).catch(() => {});
    } catch (e) { /* no se puede */ }
  }
  function toggleFullscreen() {
    if (document.fullscreenElement) { try { document.exitFullscreen(); } catch (e) { /* nada */ } } else goFull();
  }

  // ------------------------------------------------------------------ activar / fotograma
  T.refresh = function () {
    const on = T.want();
    if (on) build();
    T.on = on;
    document.body.classList.toggle('touch', on);
    if (!on && root) { root.classList.add('hidden'); look.classList.add('hidden'); back.classList.add('hidden'); rotate.classList.add('hidden'); }
    // Sin puntero bloqueado en el móvil: el juego se controla con los dedos
    if (on && G.state && G.state.mode === 'playing') G.Input.locked = true;
  };
  let tick = 0;
  T.update = function (dt) {
    if (!T.on) return;
    const st = G.state, P = G.Player;
    const playing = st.mode === 'playing' && !P.dead && !st.spectate && !(G.Cinema && G.Cinema.active);
    const talking = !!G.Story.dialog;
    root.classList.toggle('hidden', !playing || talking);
    look.classList.toggle('hidden', !playing || talking);
    back.classList.toggle('hidden', !(['map', 'journal', 'cheats'].includes(st.mode) || (talking && st.mode === 'playing'))); // la mochila tiene su propio ✕
    rotate.classList.toggle('hidden', !(window.innerHeight > window.innerWidth && st.mode !== 'loading'));
    if (playing) G.Input.locked = true;
    // Correr: joystick empujado al borde un momento
    if (J.edge && performance.now() - J.edge > 250) K().ShiftLeft = true;
    if ((tick -= dt) > 0) return;
    tick = 0.15;
    for (const id in btns) {
      const B = btns[id];
      const vis = !B.show || !!B.show();
      if (B.el.classList.contains('hidden') === vis) B.el.classList.toggle('hidden', !vis);
      if (!vis && B.el.classList.contains('down')) B.el.dispatchEvent(new Event('touchend'));
      const alt = vis && B.dyn ? B.dyn() : null, label = alt ? alt.join('|') : '';
      if (label !== B.cur) {
        B.cur = label;
        B.el.innerHTML = `<span class="ti">${alt ? alt[0] : B.ic}</span><span class="tt">${alt ? alt[1] : B.txt}</span>`;
      }
    }
    // Enfriamiento de las técnicas en su botón
    const k = G.Styles.active();
    if (k && btns.tec) { btns.tec.el.classList.toggle('cd', G.Styles.cd[k][0] > 0); btns.ult.el.classList.toggle('cd', G.Styles.cd[k][1] > 0); }
    if (btns.dge) btns.dge.el.classList.toggle('cd', G.Combat.dodgeCd > 0);
  };
  document.addEventListener('DOMContentLoaded', () => { try { T.refresh(); } catch (e) { /* se reintenta al empezar */ } });
  // Versión web publicada (https): se puede instalar como app en el móvil y jugar sin conexión (sw.js)
  if ('serviceWorker' in navigator && location.protocol === 'https:' && !window.islaDesktop) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
})();
