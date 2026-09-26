// Pesca: con la caña en la mano, clic sobre el agua para lanzar; cuando el corcho se hunde, clic para recoger.
(function () {
  'use strict';
  const G = window.G, U = G.U;
  const F = (G.Fishing = { state: 'idle', t: 0, x: 0, z: 0, level: 0, lake: false, ox: 0, oz: 0 });
  let bob, line, lineGeo;
  const _a = new THREE.Vector3(), _b = new THREE.Vector3();

  F.build = function (scene) {
    bob = new THREE.Group();
    const white = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.4 });
    const red = new THREE.MeshStandardMaterial({ color: 0xd8312a, roughness: 0.4 });
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), red);
    const bottom = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), white);
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 5), red);
    stick.position.y = 0.09;
    bob.add(top, bottom, stick);
    bob.scale.setScalar(1.8);
    bob.visible = false;
    scene.add(bob);
    lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Array(3 * 12).fill(0), 3));
    line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xe8e8e8, transparent: true, opacity: 0.7 }));
    line.frustumCulled = false;
    line.visible = false;
    scene.add(line);
  };

  function waterPoint() {
    const P = G.Player, o = P.eyePos(_a), d = P.lookDir(_b);
    for (let t = 3; t <= 16; t += 0.25) {
      const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
      const wl = G.World.waterLevelAt(x, z);
      if (y <= wl + 0.3 && G.height(x, z) < wl - 0.6) return { x, z, wl, lake: wl > 0.5 };
      if (y < G.height(x, z)) return null;
    }
    // Si miras al horizonte, lanza hasta 20 m en esa dirección, al primer punto con agua profunda
    if (d.y > 0.35) return null;
    const hl = Math.hypot(d.x, d.z) || 1;
    for (let t = 4; t <= 20; t += 0.5) {
      const x = o.x + (d.x / hl) * t, z = o.z + (d.z / hl) * t, wl = G.World.waterLevelAt(x, z);
      if (G.height(x, z) < wl - 0.6) return { x, z, wl, lake: wl > 0.5 };
    }
    return null;
  }

  // Clic con la caña en la mano
  F.click = function () {
    const P = G.Player;
    if (F.state === 'idle') {
      const w = waterPoint();
      if (!w) { G.UI.msg('Apunta a agua profunda para lanzar el anzuelo.', 'warn', 'fish'); return; }
      F.state = 'wait'; F.x = w.x; F.z = w.z; F.level = w.wl; F.lake = w.lake;
      F.t = (w.lake ? 2.5 : 3.5) + Math.random() * 6 * (G.Weather.type === 'rain' ? 0.6 : 1);
      F.ox = P.pos.x; F.oz = P.pos.z;
      P.swing = 1; P.swingCount++;
      G.Audio.play('swing');
      setTimeout(() => G.Audio.playAt('plop', F.x, F.z, 30), 350);
      return;
    }
    if (F.state === 'bite') {
      F.catch();
      return;
    }
    // Recoger antes de tiempo
    F.stop('Recoges el sedal.');
  };

  F.catch = function () {
    const r = Math.random();
    G.Audio.play('reel');
    if (F.lake) G.Game.give('pez_crudo', 1);
    else if (r < 0.04) { G.Game.give('cuero', 1); G.UI.msg('¡Sacaste un trozo de cuero enredado!', 'good'); }
    else G.Game.give('pez_crudo', r < 0.2 ? 2 : 1);
    G.Inv.wear(1);
    G.state.flags.fish = true;
    F.stop();
  };

  F.stop = function (msg) {
    if (F.state === 'idle') return;
    F.state = 'idle';
    if (bob) { bob.visible = false; line.visible = false; }
    if (msg) G.UI.msg(msg, 'info', 'fish');
  };

  F.update = function (dt) {
    if (F.state === 'idle') return;
    const P = G.Player;
    if (G.Inv.heldId() !== 'cana' || P.dead || Math.hypot(P.pos.x - F.ox, P.pos.z - F.oz) > 3 || G.state.mode !== 'playing' && G.state.mode !== 'inventory') {
      F.stop(G.Inv.heldId() !== 'cana' ? null : 'El sedal se soltó.');
      return;
    }
    F.t -= dt;
    let dip = 0;
    if (F.state === 'wait' && F.t <= 0) {
      F.state = 'bite'; F.t = 1.3;
      G.Audio.playAt('plop', F.x, F.z, 30);
      G.UI.msg('🎣 ¡Está picando! ¡Clic ya!', 'good', 'bite');
    } else if (F.state === 'bite') {
      dip = 0.12 + Math.sin(performance.now() / 60) * 0.05;
      if (F.t <= 0) {
        F.state = 'wait';
        F.t = 3 + Math.random() * 5;
        G.UI.msg('El pez se escapó… espera otra picada.', 'warn', 'bite');
      }
    }
    const wy = F.level + (F.lake ? 0 : G.World.waveHeight(F.x, F.z)) - dip + Math.sin(performance.now() / 400) * 0.02;
    bob.position.set(F.x, wy, F.z);
    bob.visible = true;
    // Sedal curvado desde la punta de la caña hasta el corcho
    const tip = P.rodTip(_a);
    const arr = lineGeo.attributes.position.array;
    for (let i = 0; i < 12; i++) {
      const k = i / 11;
      arr[i * 3] = U.lerp(tip.x, F.x, k);
      arr[i * 3 + 1] = U.lerp(tip.y, wy + 0.05, k) - Math.sin(k * Math.PI) * 0.6 * (F.state === 'bite' ? 0.3 : 1);
      arr[i * 3 + 2] = U.lerp(tip.z, F.z, k);
    }
    lineGeo.attributes.position.needsUpdate = true;
    line.visible = true;
  };

  F.prompt = function () {
    if (F.state === 'bite') return '🎣 <b>¡Pica!</b> <kbd>Clic</kbd> Recoger';
    if (F.state === 'wait') return '🎣 Esperando una picada… <kbd>Clic</kbd> Recoger sedal';
    return waterPoint() ? '🎣 <kbd>Clic</kbd> Lanzar anzuelo' : '🎣 Apunta a agua profunda';
  };
})();
