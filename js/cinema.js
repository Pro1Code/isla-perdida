// Cinemática de introducción (partida individual nueva, se salta con Espacio):
// la Gaviota Errante navega de noche en plena tormenta, la Marina Blanca la hunde a cañonazos
// y al amanecer Silvano, el ermitaño, encuentra al náufrago en la playa de la Isla Perdida.
(function () {
  'use strict';
  const G = window.G, U = G.U, V3 = THREE.Vector3;
  const Ci = (G.Cinema = { active: false, focus: new V3() });
  const $ = (id) => document.getElementById(id);
  let t = 0, onEnd = null, ours = null, navy = null, body = null, hermit = null, events = [], ending = false, prevHidden = false;

  // Subtítulos (con voz): [desde, hasta, frase de G.LINES.cine]
  const SUBS = [[0.6, 4.2, 0], [4.3, 8.9, 1], [9.0, 11.8, 2], [12.0, 15.8, 3], [17.2, 21.5, 4], [29, 31.7, 5], [32.0, 37.6, 6]];
  let subOn = -1;
  const END = 38;
  const OURS0 = new V3(335, 0, -28), OURS_DIR = new V3(-1, 0, -0.2).normalize(), NAVY0 = new V3(405, 0, 8);

  Ci.play = function (done) {
    onEnd = done; t = 0; ending = false; Ci.active = true; subOn = -1;
    G.state.mode = 'cinema';
    G.Main.showScreen(null);
    $('hud').classList.add('hidden');
    $('cine').classList.remove('hidden');
    $('cineBlack').style.opacity = 1;
    $('cineTitle').classList.remove('show');
    G.Audio.init(); G.Audio.resume();
    G.Weather.set('storm', 60);
    G.Weather.intensity = 1;
    const yaw = Math.atan2(OURS_DIR.x, OURS_DIR.z);
    ours = G.Ships.create({ type: 'barco', x: OURS0.x, z: OURS0.z, yaw, anchor: true, name: '*La Gaviota Errante', flagColor: '#c8322a' });
    navy = G.Ships.create({ type: 'barco', x: NAVY0.x, z: NAVY0.z, yaw, anchor: true, sail: 'marea', flag: 'ancla', fh: 'aguila', name: '*Marina Blanca' });
    prevHidden = true;
    G.Player.setHidden(true);
    events = [
      [2.4, () => lightning()], [6.3, () => lightning()], [9.2, () => lightning()],
      [10, () => cannon(0)], [11.1, () => cannon(1)], [12.3, () => cannon(2)], [14.2, () => cannon(3)], [15.4, () => cannon(4, true)],
      [16.3, () => { if (ours) { G.Ships.hurt(ours, 99999, null); G.Ships.puff(ours.x, 3, ours.z, 0xff8a3a, 6, 2, 10); G.Ships.puff(ours.x, 4, ours.z, 0x2a2a2a, 8, 4, 12); G.Audio.play('explode'); } }],
      [19.5, () => lightning()],
      [23.2, () => black(1)],
      [24, () => dawn()],
      [24.4, () => $('cineTitle').classList.add('show')],
      [26.6, () => $('cineTitle').classList.remove('show')],
      [27.2, () => black(0)],
    ];
    setTimeout(() => black(0), 50);
  };

  function black(v) { $('cineBlack').style.opacity = v; }
  function lightning() {
    const f = $('cineFlash');
    f.style.transition = 'none'; f.style.opacity = 0.85;
    requestAnimationFrame(() => { f.style.transition = 'opacity .6s'; f.style.opacity = 0; });
    setTimeout(() => G.Audio.play('thunder'), 250);
  }
  // Cañonazo de la Marina: fogonazo en su costado y columna de agua junto a la Gaviota (el último acierta)
  function cannon(i, hit) {
    if (!navy || !ours) return;
    const side = new V3(Math.cos(navy.yaw), 0, -Math.sin(navy.yaw)).multiplyScalar(-2.4);
    const mx = navy.x + side.x + Math.sin(navy.yaw) * (i - 2) * 1.5, mz = navy.z + side.z + Math.cos(navy.yaw) * (i - 2) * 1.5;
    G.Ships.puff(mx, 2.2, mz, 0xffc060, 2, 0.5, 3);
    G.Ships.puff(mx, 2.2, mz, 0xd0ccc4, 3, 1.5, 6);
    G.Audio.play('cannon');
    setTimeout(() => {
      if (!ours) return;
      if (hit) { G.Ships.puff(ours.x, 2.5, ours.z, 0xff8a3a, 4, 1.5, 8); G.Audio.play('explode'); G.Player.shake = 0.4; return; }
      const a = i * 1.7, d = 5 + (i % 2) * 3;
      G.Ships.puff(ours.x + Math.cos(a) * d, 0.3, ours.z + Math.sin(a) * d, 0xf4f8ff, 3.5, 5, 12);
      G.Audio.play('splash');
    }, 550);
  }
  // Amanecer en la playa: el náufrago tendido en la arena y Silvano acercándose
  function dawn() {
    G.Weather.set('clear', 300);
    G.Weather.intensity = 0;
    if (navy) { G.Ships.remove(navy); navy = null; }
    const S = G.World.spawn, L = G.Profile.lookHex();
    body = G.Character.create(L.shirt, { skin: L.skin, pants: L.pants });
    G.Equip.apply(body, G.Player.visibleIds());
    G.scene.add(body.root);
    hermit = G.Prologue.human('npc', 0);
    G.scene.add(hermit.g);
  }

  // ------------------------------------------------------------------ fotograma
  Ci.update = function (dt) {
    if (!Ci.active) return;
    t += dt;
    while (events.length && events[0][0] <= t) events.shift()[1]();
    const cam = G.camera;
    cam.fov = 55; cam.updateProjectionMatrix();
    // Subtítulos
    const s = SUBS.find((x) => t >= x[0] && t <= x[1]);
    const line = s ? G.LINES.cine[s[2]] : null, name = line ? G.VOICES[line[0]].name.split(',')[0] : '';
    if (s && s[2] !== subOn) G.Voice.say(line[0], line[1]);
    subOn = s ? s[2] : -1;
    const el = $('cineSub'), html = s ? (name ? `<b>${name}</b>` : '') + `<span${name ? '' : ' class="narr"'}>${G.stripMood(line[1])}</span>` : '';
    if (el.innerHTML !== html) el.innerHTML = html;
    el.classList.toggle('show', !!s);
    if (t < 24) {
      G.state.t = 0.74; // atardecer de tormenta
      Ci.expMul = 2.1;
      // La Gaviota avanza hacia la isla y la Marina la persigue
      if (ours && !ours.sinking) { const p = OURS0.clone().addScaledVector(OURS_DIR, Math.min(t, 16.3) * 3.2); ours.x = p.x; ours.z = p.z; }
      if (navy) { const k = Math.min(1, t / 14), p = NAVY0.clone().lerp(OURS0.clone().addScaledVector(OURS_DIR, 16).add(new V3(15, 0, 12)), k); navy.x = p.x; navy.z = p.z; navy.yaw = Math.atan2(ours.x - navy.x, ours.z - navy.z) + 1.1; }
      const o = ours || { x: OURS0.x, z: OURS0.z };
      if (t < 8.4) {
        const a = 0.9 + t * 0.09;
        cam.position.set(o.x + Math.sin(a) * 19, 7.5 + Math.sin(t * 0.8) * 0.4, o.z + Math.cos(a) * 19);
        cam.lookAt(o.x, 4.5, o.z);
      } else if (t < 16.2) {
        // Desde la popa de la Gaviota, mirando al barco de la Marina que se acerca
        const back = new V3(-OURS_DIR.x, 0, -OURS_DIR.z), k = (t - 8.4) / 7.8;
        cam.position.set(o.x + back.x * (4 - k) - OURS_DIR.z * 2.5, 6.5, o.z + back.z * (4 - k) + OURS_DIR.x * 2.5);
        cam.lookAt(navy ? navy.x : o.x, 3.5, navy ? navy.z : o.z);
      } else {
        const k = (t - 16.2) / 7;
        cam.position.set(o.x - OURS_DIR.z * (16 + k * 10), 6 + k * 6, o.z + OURS_DIR.x * (16 + k * 10));
        cam.lookAt(o.x, 2 - k * 2, o.z);
      }
      Ci.focus.set(o.x, 0, o.z);
    } else {
      G.state.t = 0.265 + (t - 24) * 0.001;
      Ci.expMul = 1;
      const S = G.World.spawn, sea = new V3(Math.sin(S.yaw), 0, Math.cos(S.yaw)), side = new V3(sea.z, 0, -sea.x);
      const hy = G.height(S.x, S.z);
      // Silvano llega caminando desde las palmeras (está junto al náufrago hacia los 31 s)
      const w = U.smooth(0, 1, Math.min(1, Math.max(0, (t - 25.5) / 5.5)));
      const hx0 = S.x - sea.x * 14 + side.x * 5, hz0 = S.z - sea.z * 14 + side.z * 5, ex = S.x + side.x * 1.6 - sea.x * 0.4, ez = S.z + side.z * 1.6 - sea.z * 0.4;
      const sx = U.lerp(hx0, ex, w), sz = U.lerp(hz0, ez, w), sy = G.height(sx, sz);
      if (t < 28.5) {
        // Toma 1: del mar a la playa
        const k = U.smooth(0, 1, Math.min(1, (t - 24) / 4.5));
        cam.position.copy(new V3(S.x + sea.x * 55, hy + 22, S.z + sea.z * 55).lerp(new V3(S.x + sea.x * 12 - side.x * 4, hy + 4, S.z + sea.z * 12 - side.z * 4), k));
        cam.lookAt(S.x, hy + 1 + (1 - k), S.z);
      } else if (t < 32) {
        // Toma 2: Silvano, de cara, mientras se acerca al náufrago
        const dx = S.x - sx, dz = S.z - sz, dl = Math.hypot(dx, dz) || 1, ux = dx / dl, uz = dz / dl;
        const cx = sx + ux * 4.2 - uz * 1.6, cz = sz + uz * 4.2 + ux * 1.6;
        cam.position.set(cx, Math.max(G.height(cx, cz), 0.3) + 1.6, cz);
        cam.lookAt(sx, sy + 1.45, sz);
      } else {
        // Toma 3: los dos en el mismo plano (Silvano de pie, entero, y el náufrago en la arena)
        const mx = (S.x + ex) / 2, mz = (S.z + ez) / 2, cx = mx + sea.x * 3.6 - side.x * 2.4, cz = mz + sea.z * 3.6 - side.z * 2.4;
        cam.position.set(cx, Math.max(G.height(cx, cz), 0.3) + 1.5, cz);
        cam.lookAt(mx, hy + 0.9, mz);
      }
      if (body) {
        body.update(dt, { pos: new V3(S.x, hy, S.z), yaw: S.yaw, pitch: 0, speed: 0, onGround: true, swimming: false, swing: 0, holding: false });
        body.root.position.set(S.x, hy + 0.12, S.z);
        body.root.rotation.set(-Math.PI / 2, S.yaw + Math.PI, 0, 'YXZ');
      }
      if (hermit) {
        const walking = w > 0 && w < 1;
        hermit.model.update(dt, { pos: new V3(sx, sy, sz), yaw: Math.atan2(S.x - sx, S.z - sz) + Math.PI, pitch: 0, speed: walking ? 1.4 : 0, onGround: true, swimming: false, swing: 0, holding: true });
      }
      Ci.focus.set(S.x, 0, S.z);
    }
    if (t >= END && !ending) Ci.skip();
  };

  // Termina (o se salta): limpia la escena y empieza a jugar
  Ci.skip = function () {
    if (!Ci.active || ending) return;
    ending = true;
    G.Voice.stop('dialog');
    black(1);
    setTimeout(finish, 450);
  };
  function finish() {
    Ci.active = false;
    if (ours) { G.Ships.remove(ours); ours = null; }
    if (navy) { G.Ships.remove(navy); navy = null; }
    if (body) { G.scene.remove(body.root); body.dispose(); body = null; }
    if (hermit) { G.scene.remove(hermit.g); hermit.model.dispose(); hermit = null; }
    G.Weather.set('clear', 200);
    G.camera.fov = G.Profile.set('fov'); G.camera.updateProjectionMatrix();
    $('cine').classList.add('hidden');
    $('cineSub').classList.remove('show');
    $('cineTitle').classList.remove('show');
    if (prevHidden) G.Player.setHidden(false);
    const S = G.World.spawn;
    G.Player.reset(S.x, S.z, S.yaw);
    G.state.mode = 'playing';
    const cb = onEnd; onEnd = null;
    if (cb) cb();
    setTimeout(() => black(0), 80);
  }
})();
