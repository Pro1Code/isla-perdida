// Jugador: movimiento, física, nado y buceo, colisiones, estadísticas, cámaras (1ª/3ª persona) y modelos.
// A bordo de un barco el movimiento lo gestiona ships.js (coordenadas locales del barco).
(function () {
  'use strict';
  const G = window.G, U = G.U;
  const V3 = THREE.Vector3;
  const P = (G.Player = {
    pos: new V3(), vel: new V3(), yaw: 0, pitch: 0, onGround: false, swimming: false, wading: false, onStruct: false, diving: false,
    radius: 0.35, eye: 1.62, stats: { health: 100, hunger: 100, thirst: 100, stamina: 100, temp: 55 }, wet: 0, poison: 0, oxy: 100,
    cam: 'fp', swing: 0, cd: 0, hurtT: 99, stepAcc: 0, bob: 0, dead: false, sick: 0, sprinting: false, moving: false,
    cause: '', shake: 0, hs: 0, exhausted: false, swingCount: 0, ship: null, local: null, station: null, sinking: false, zoom: 0,
  });
  let camera, vm, vmHolder, vmArm, vmId = '__', model, torchLight, shirtColor = 0xe6dfcc;
  const _v = new V3(), _d = new V3();

  P.init = function (scene, cam) {
    camera = cam;
    // La ropa y la armadura se ven puestas sobre el personaje
    G.Inv.listeners.push(() => {
      if (!model) return;
      const before = model.eqKey;
      G.Equip.apply(model, G.Inv.eqIds());
      if (model.eqKey !== before) { const l = curLayer; curLayer = -1; setLayer(Math.max(0, l)); }
    });
    // Brazo y objeto en primera persona
    vm = new THREE.Group();
    camera.add(vm);
    vmHolder = new THREE.Group();
    vmHolder.rotation.set(-0.35, 0, 0.25);
    vm.add(vmHolder);
    vm.scale.setScalar(0.6);
    torchLight = new THREE.PointLight(0xffa04a, 0, 20, 1.6);
    scene.add(torchLight);
    P.setShirt(shirtColor, true);
  };

  // Cambia el color de la camisa (en LAN cada jugador elige el suyo)
  P.setShirt = function (color, force) {
    const c = new THREE.Color(color).getHex();
    if (!force && c === shirtColor && model) return;
    shirtColor = c;
    if (model) { G.scene.remove(model.root); model.dispose(); }
    model = G.Character.create(c);
    G.scene.add(model.root);
    G.Equip.apply(model, G.Inv.eqIds());
    curLayer = -1;
    if (vmArm) { vm.remove(vmArm); vmArm.geometry.dispose(); vmArm.material.dispose(); }
    vmArm = G.Character.fpArm(c);
    vmArm.rotation.set(0.1, -0.05, 0);
    vm.add(vmArm);
    vmId = '__';
  };

  // Punta de la caña de pescar en coordenadas del mundo (para dibujar el sedal)
  P.rodTip = function (out) {
    const holder = P.cam === 'fp' ? vmHolder : model.hand;
    const item = holder.children[0];
    if (item && item.userData.tip) return item.userData.tip.getWorldPosition(out);
    return P.eyePos(out);
  };

  P.lookDir = function (out) {
    const cp = Math.cos(P.pitch);
    return out.set(-Math.sin(P.yaw) * cp, Math.sin(P.pitch), -Math.cos(P.yaw) * cp);
  };
  P.eyePos = (out) => out.set(P.pos.x, P.pos.y + (P.swimming && !P.diving ? 1.45 : P.station && P.station.st && P.station.st.seat ? 1.15 : P.eye), P.pos.z);

  P.reset = function (x, z, yaw) {
    if (P.ship) { P.ship = null; P.station = null; }
    P.pos.set(x, G.Build.groundAt(x, z) + 0.05, z);
    P.vel.set(0, 0, 0);
    P.yaw = yaw || 0; P.pitch = 0;
    P.dead = false; P.sick = 0; P.poison = 0; P.wet = 0; P.hurtT = 99; P.swing = 0; P.cd = 0; P.oxy = 100; P.diving = false; P.sinking = false;
  };

  // ------------------------------------------------------------------ colisiones
  function collide() {
    const pos = P.pos;
    G.Res.query(pos.x, pos.z, 4, (r) => {
      if (!r.alive || !r.k.solid) return;
      const dx = pos.x - r.x, dz = pos.z - r.z;
      const rr = r.k.r * r.s + P.radius;
      const d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2); pos.x = r.x + dx / d * rr; pos.z = r.z + dz / d * rr; }
    });
    G.Landmarks.collide(pos, P.radius);
    let ground = G.height(pos.x, pos.z);
    P.onStruct = false;
    const R = P.radius;
    G.Build.forBoxesNear(pos.x, pos.z, 2, (b) => {
      const cx = U.clamp(pos.x, b.x0, b.x1), cz = U.clamp(pos.z, b.z0, b.z1);
      const dx = pos.x - cx, dz = pos.z - cz, d2 = dx * dx + dz * dz;
      if (d2 >= R * R) return;
      if (b.walk && pos.y >= b.y1 - 0.45) { if (b.y1 > ground) { ground = b.y1; P.onStruct = true; } return; }
      if (pos.y < b.y1 && pos.y + 1.75 > b.y0) {
        if (d2 > 1e-6) { const d = Math.sqrt(d2); pos.x = cx + dx / d * R; pos.z = cz + dz / d * R; }
        else {
          const l = pos.x - b.x0, r = b.x1 - pos.x, f = pos.z - b.z0, k = b.z1 - pos.z, m = Math.min(l, r, f, k);
          if (m === l) pos.x = b.x0 - R; else if (m === r) pos.x = b.x1 + R; else if (m === f) pos.z = b.z0 - R; else pos.z = b.z1 + R;
        }
      }
    });
    // Los barcos son sólidos cuando estás en el agua junto a ellos
    if (G.Ships) for (const s of G.Ships.list) {
      if (s.sinking || Math.abs(s.x - pos.x) > s.def.L || Math.abs(s.z - pos.z) > s.def.L) continue;
      const l = G.Ships.toLocal(s, pos.x, pos.y, pos.z, _v), d = s.def;
      if (Math.abs(l.z) > d.L / 2 || l.y > d.deckY + d.rail + 0.3 || l.y < -d.draft - 2) continue;
      const hw = G.Ships.halfW(d, l.z) + R;
      if (Math.abs(l.x) < hw) {
        const nx = Math.sign(l.x || 1) * hw, c = Math.cos(s.yaw), sn = Math.sin(s.yaw);
        pos.x = s.x + nx * c + l.z * sn; pos.z = s.z - nx * sn + l.z * c;
      }
    }
    return ground;
  }

  // ------------------------------------------------------------------ movimiento
  P.update = function (dt, inputOn) {
    const K = inputOn ? G.Input.keys : {};
    if (P.ship) { G.Ships.updatePlayer(dt, K); return; }
    const fwd = (K.KeyW || K.ArrowUp ? 1 : 0) - (K.KeyS || K.ArrowDown ? 1 : 0);
    const str = (K.KeyD || K.ArrowRight ? 1 : 0) - (K.KeyA || K.ArrowLeft ? 1 : 0);
    const sy = Math.sin(P.yaw), cy = Math.cos(P.yaw);
    let wx = -sy * fwd + cy * str, wz = -cy * fwd - sy * str;
    const wl = Math.hypot(wx, wz);
    if (wl > 0) { wx /= wl; wz /= wl; }
    P.moving = wl > 0;
    const S = P.stats;
    if (S.stamina <= 0) P.exhausted = true;
    if (P.exhausted && S.stamina > 25) P.exhausted = false;
    P.sprinting = !!(K.ShiftLeft || K.ShiftRight) && P.moving && fwd > 0 && !P.exhausted && !P.swimming;
    let speed = P.swimming ? (P.diving ? 2.8 : 2.6) : P.sprinting ? 7.2 : 4.4;
    if (P.wading) speed *= 0.7;
    if (G.Story) speed *= G.Story.speedMul();
    // Equipo: armadura pesada, aletas, botas de nieve
    speed *= P.swimming ? G.Inv.eqStat('swim') : G.Inv.eqStat('speed');
    if (!P.swimming && !G.Inv.eqStat('snow') && G.Arch.biomeAt(P.pos.x, P.pos.z) === 'escarcha' && P.pos.y > 1.5) speed *= 0.85;
    const acc = P.onGround || P.swimming ? 12 : 2.5;
    P.vel.x += (wx * speed - P.vel.x) * Math.min(1, acc * dt);
    P.vel.z += (wz * speed - P.vel.z) * Math.min(1, acc * dt);
    if (!P.swimming) P.vel.y -= 24 * dt;
    if (K.Space && P.onGround && !P.swimming) { P.vel.y = G.Story ? G.Story.jumpPower(7.2) : 7.2; P.onGround = false; }
    const vyBefore = P.vel.y;
    P.pos.x += P.vel.x * dt; P.pos.z += P.vel.z * dt; P.pos.y += P.vel.y * dt;
    const rr = Math.hypot(P.pos.x, P.pos.z), B = G.Arch.BOUND;
    if (rr > B) { P.pos.x *= B / rr; P.pos.z *= B / rr; G.UI.msg('🌊 Las corrientes te devuelven hacia el archipiélago.', 'warn', 'bounds'); }

    let ground = collide();
    const wLevel = G.World.waterLevelAt(P.pos.x, P.pos.z);
    const wave = wLevel === 0 ? G.World.waveHeight(P.pos.x, P.pos.z) : 0;
    const floatY = wLevel - 1.35 + wave * 0.8;
    // Fruta Hielo-Hielo: el agua se congela bajo tus pies
    const fruit = G.Story ? G.Story.fruitOf() : null;
    if (fruit === 'hielo' && ground < wLevel - 0.3 && !P.diving) { ground = wLevel + 0.05; G.Story.iceStep(P.pos.x, P.pos.z, wLevel); }
    P.wading = !P.onStruct && wLevel - ground > 0.4;
    const deep = ground < floatY;
    if (deep && P.pos.y <= floatY + 0.05) {
      if (!P.swimming) G.Audio.play('splash');
      P.swimming = true;
      P.onGround = false;
      if (fruit) {
        // Quien comió una Fruta del Abismo no puede nadar: se hunde
        if (!P.sinking) { P.sinking = true; G.UI.msg('🌀 ¡La Fruta del Abismo te arrastra al fondo! Pide ayuda a tu tripulación (<kbd>E</kbd> para rescatarte).', 'bad'); }
        P.diving = true;
        P.pos.y = Math.max(ground + 0.2, P.pos.y - 1.6 * dt);
        P.vel.x *= 0.3; P.vel.z *= 0.3;
      } else {
        P.sinking = false;
        const down = K.ControlLeft || K.KeyC, up = K.Space;
        if (down) P.diving = true;
        if (P.diving) {
          if (down) P.pos.y -= 2.2 * dt;
          if (up) P.pos.y += 2.6 * dt;
          if (!down && !up) P.pos.y += 0.25 * dt; // flotabilidad suave
          P.pos.y = Math.max(ground + 0.25, P.pos.y);
          if (P.pos.y >= floatY) { P.diving = false; P.pos.y = floatY; }
        } else P.pos.y = U.lerp(P.pos.y, floatY, Math.min(1, dt * 5));
      }
      if (P.vel.y < 0) P.vel.y = 0;
    } else {
      P.swimming = false; P.diving = false; P.sinking = false;
      if (P.pos.y <= ground) {
        const safe = G.Story ? G.Story.noFallDamage() : false;
        if (vyBefore < -14 && !safe) P.damage((-vyBefore - 14) * 5, null, 'Una caída fatal');
        P.pos.y = ground; P.vel.y = 0; P.onGround = true;
      } else if (P.onGround && P.vel.y <= 0 && P.pos.y - ground < 0.5) {
        P.pos.y = ground; P.vel.y = 0;
      } else P.onGround = false;
    }

    // Pasos
    const hs = (P.hs = Math.hypot(P.vel.x, P.vel.z));
    if ((P.onGround || P.swimming) && hs > 0.5) {
      P.stepAcc += hs * dt;
      P.bob += hs * dt * 2.2;
      if (P.stepAcc > (P.sprinting ? 2.6 : 2.0)) {
        P.stepAcc = 0;
        const biome = G.Arch.biomeAt(P.pos.x, P.pos.z);
        G.Audio.play(P.swimming || P.wading ? 'splash' : P.onStruct ? 'step_wood' : ground < 2.3 ? 'step_sand' : biome === 'escarcha' ? 'step_snow' : 'step_grass', P.swimming ? 0.5 : 1);
      }
    }
  };

  // ------------------------------------------------------------------ estadísticas
  P.updateStats = function (dt) {
    if (P.dead) return;
    const S = P.stats, D = G.Game.diff();
    const mul = D.decay * (P.sprinting ? 1.7 : 1);
    S.hunger = Math.max(0, S.hunger - 0.2 * mul * dt);
    S.thirst = Math.max(0, S.thirst - 0.3 * mul * dt);
    if (P.sick > 0) { P.sick -= dt; S.hunger = Math.max(0, S.hunger - 0.25 * dt); S.health -= 0.25 * dt; P.cause = 'Una infección te venció'; }
    if (P.poison > 0) { P.poison -= dt; S.health -= 0.7 * dt; P.cause = 'El veneno acabó contigo'; }
    G.Weather.updatePlayer(P, dt);
    if (S.hunger <= 0) { S.health -= 0.6 * dt; P.cause = 'Moriste de hambre'; }
    if (S.thirst <= 0) { S.health -= 0.9 * dt; P.cause = 'Moriste de sed'; }
    P.hurtT += dt;
    if (S.hunger > 30 && S.thirst > 30 && P.hurtT > 6 && P.sick <= 0 && P.poison <= 0 && S.temp > 25) S.health = Math.min(100, S.health + 0.4 * dt);
    // Aire bajo el agua (el casco de buceo lo triplica)
    const eyeUnder = P.diving && G.World.underwater;
    if (eyeUnder || P.sinking) {
      P.oxy = Math.max(0, P.oxy - dt * 3.4 / G.Inv.eqStat('oxy') * (P.sinking ? 1.6 : 1));
      if (P.oxy <= 0) { S.health -= 9 * dt; P.cause = P.sinking ? 'La Fruta del Abismo te hundió en el mar' : 'Te ahogaste'; }
    } else P.oxy = Math.min(100, P.oxy + dt * 25);
    if (P.sprinting) S.stamina = Math.max(0, S.stamina - 16 * dt);
    else if (P.swimming && !P.sinking) {
      S.stamina = Math.max(0, S.stamina - (P.moving ? 5 : 2.5) * dt);
      if (S.stamina <= 0 && !P.diving) { S.health -= 6 * dt; P.cause = 'Te ahogaste'; }
    } else if (!(P.station && P.station.kind === 'helm' && P.ship && P.ship.def.paddle && P.ship.throttle !== 0)) S.stamina = Math.min(100, S.stamina + (P.moving ? 10 : 18) * dt);
    const fire = G.Build.nearestLitFire(P.pos.x, P.pos.z);
    if (fire && fire.d < 0.75 && Math.abs(fire.s.y - P.pos.y) < 1 && !(G.Story && G.Story.fruitOf() === 'llama')) { S.health -= 10 * dt; P.cause = 'Te quemaste'; P.hurtT = 0; G.UI.hurtFlash(0.3); }
    // Lava del volcán
    if (!P.ship && G.Arch.biomeAt(P.pos.x, P.pos.z) === 'brasa' && G.Landmarks.lavaAt(P.pos.x, P.pos.z, P.pos.y) && !(G.Story && G.Story.fruitOf() === 'llama')) { S.health -= 30 * (1 - G.Inv.eqStat('lava')) * dt; P.cause = 'Caíste en la lava'; P.hurtT = 0; G.UI.hurtFlash(0.5); }
    if (S.health <= 0) G.Game.die(P.cause);
  };

  P.damage = function (amt, src, cause) {
    if (P.dead || G.state.mode === 'dead') return;
    if (G.Story) amt *= G.Story.damageMul();
    amt *= 1 - G.Inv.eqStat('armor');
    P.stats.health -= amt;
    P.hurtT = 0;
    P.cause = cause || P.cause;
    P.shake = 0.25;
    G.UI.hurtFlash(Math.min(1, amt / 20));
    G.Audio.play('hurt');
    if (src && !P.ship) {
      const dx = P.pos.x - src.x, dz = P.pos.z - src.z, d = Math.hypot(dx, dz) || 1;
      P.vel.x += dx / d * 6; P.vel.z += dz / d * 6; P.vel.y = 3.5; P.onGround = false;
    }
    if (P.stats.health <= 0) G.Game.die(P.cause);
  };

  // ------------------------------------------------------------------ cámara y modelos
  P.updateVisuals = function (dt) {
    const hs = P.hs;
    // Objeto en la mano
    const id = G.Inv.heldId();
    if (id !== vmId) {
      vmId = id;
      vmHolder.clear();
      const t = G.makeItemMesh(id);
      if (t) { t.traverse((o) => (o.castShadow = false)); vmHolder.add(t); }
      model.hand.clear();
      const t2 = G.makeItemMesh(id);
      if (t2) { t2.rotation.x = Math.PI / 2; model.hand.add(t2); t2.traverse((o) => o.layers.set(Math.max(0, curLayer))); }
    }
    if (P.swing > 0) P.swing = Math.max(0, P.swing - dt / 0.32);
    const s = P.swing > 0 ? Math.sin((1 - P.swing) * Math.PI) : 0;
    const bobA = P.onGround ? Math.min(1, hs / 4) : 0;
    // Balanceo del brazo en primera persona: anticipación hacia atrás y golpe hacia delante
    const p = 1 - P.swing;
    const wind = P.swing > 0 ? (p < 0.38 ? U.smooth(0, 1, p / 0.38) : 1 - U.smooth(0, 1, (p - 0.38) / 0.62)) : 0;
    const strike = P.swing > 0 && p >= 0.38 ? Math.sin(((p - 0.38) / 0.62) * Math.PI) : 0;
    const sway = Math.sin(performance.now() / 900) * 0.006 * (1 - bobA);
    vm.rotation.set(wind * 0.55 - strike * 1.0, s * 0.25, wind * 0.15);
    vm.position.set(
      0.24 + wind * 0.04 - strike * 0.06 + Math.cos(P.bob) * 0.012 * bobA,
      -0.22 + wind * 0.05 + Math.sin(P.bob * 2) * 0.012 * bobA - strike * 0.04 + sway,
      -0.42 + wind * 0.05 - strike * 0.12);

    // Antorcha (y el brillo de la Fruta Llama-Llama)
    const torch = id === 'antorcha' || (G.Story && G.Story.fruitOf() === 'llama' && G.World.night > 0.5);
    if (torch) {
      torchLight.intensity = 16 + Math.random() * 4;
      if (P.cam === 'fp') {
        P.lookDir(_d);
        torchLight.position.set(camera.position.x + _d.x * 0.6 + Math.cos(P.yaw) * 0.3, camera.position.y + 0.1, camera.position.z + _d.z * 0.6 - Math.sin(P.yaw) * 0.3);
      } else model.hand.getWorldPosition(torchLight.position).y += 0.5;
      for (const holder of [vmHolder, model.hand]) {
        const fl = holder.children[0] && holder.children[0].userData.flame;
        if (fl) fl.scale.set(1 + Math.random() * 0.15, 0.9 + Math.random() * 0.35, 1 + Math.random() * 0.15);
      }
      if (G.state.mode === 'playing' && id === 'antorcha') G.Inv.wear(dt, true);
    } else torchLight.intensity = 0;

    // Personaje (también en primera persona para que proyecte su sombra)
    const seated = P.station && P.station.st && P.station.st.seat;
    _v.copy(P.pos); if (seated) _v.y -= 0.45;
    model.update(dt, { pos: _v, yaw: P.yaw, pitch: P.pitch, speed: P.station ? 0 : hs, onGround: P.onGround || P.wading || !!P.ship, swimming: P.swimming, swing: P.swing, holding: !!id });
    model.root.visible = !P.dead || P.cam === 'tp';

    // Cámara
    P.shake = Math.max(0, P.shake - dt);
    const sh = P.shake * 0.25;
    // Zoom del catalejo
    const wantFov = P.zoom ? 18 : 70;
    if (Math.abs(camera.fov - wantFov) > 0.05) { camera.fov = U.lerp(camera.fov, wantFov, Math.min(1, dt * 8)); camera.updateProjectionMatrix(); }
    if (G.Ships && G.Ships.cameraFor(camera)) { setLayer(0); vm.visible = false; return; }
    if (P.cam === 'fp') {
      const bob = P.onGround ? Math.sin(P.bob * 2) * 0.04 * bobA : 0;
      P.eyePos(camera.position);
      camera.position.y += bob;
      camera.rotation.set(P.pitch + (Math.random() - 0.5) * sh, P.yaw + (Math.random() - 0.5) * sh, 0, 'YXZ');
      setLayer(1);
      vm.visible = !P.dead && !P.zoom;
    } else {
      const head = _v.set(P.pos.x, P.pos.y + 1.65, P.pos.z);
      P.lookDir(_d);
      const dist = 4.2;
      const cx = head.x - _d.x * dist + Math.cos(P.yaw) * 0.55;
      const cz = head.z - _d.z * dist - Math.sin(P.yaw) * 0.55;
      let cyy = head.y - _d.y * dist;
      const th = G.height(cx, cz) + 0.4;
      if (cyy < th) cyy = th;
      camera.position.set(cx, cyy, cz);
      camera.rotation.set(P.pitch + (Math.random() - 0.5) * sh, P.yaw + (Math.random() - 0.5) * sh, 0, 'YXZ');
      setLayer(0);
      vm.visible = false;
    }
  };
  // Capa 1: invisible para la cámara pero visible para la sombra del sol (primera persona)
  let curLayer = -1;
  function setLayer(l) {
    if (l === curLayer) return;
    curLayer = l;
    model.root.traverse((o) => o.layers.set(l));
  }

  P.setHidden = function (hidden) {
    model.root.visible = !hidden;
    vm.visible = !hidden && P.cam === 'fp';
    if (hidden) torchLight.intensity = 0;
  };
  P.toggleCam = function () {
    P.cam = P.cam === 'fp' ? 'tp' : 'fp';
    G.UI.msg(P.cam === 'fp' ? 'Cámara: primera persona' : 'Cámara: tercera persona', 'info', 'cam');
  };
})();
