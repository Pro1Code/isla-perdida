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
  let camera, vm, vmHand, vmHolder, grip, vmId = '__', model, torchLight, lookKey = '';
  // Brazo en primera persona: el golpe gira alrededor del codo, que queda siempre fuera de la pantalla
  // (así solo se ve del antebrazo a la mano). Posiciones en el espacio de la cámara.
  const VM_ELBOW = new THREE.Vector3(0.229, -0.243, -0.197), VM_HAND = new THREE.Vector3(0.0187, 0.0373, -0.3716);
  const _v = new V3(), _d = new V3(), _dv = new V3();

  P.init = function (scene, cam) {
    camera = cam;
    // La ropa y la armadura se ven puestas sobre el personaje
    G.Inv.listeners.push(() => P.refreshCosmetics());
    // Brazo y objeto en primera persona
    vm = new THREE.Group();
    camera.add(vm);
    vmHand = new THREE.Group();
    vmHand.position.copy(VM_HAND);
    vm.add(vmHand);
    vmHolder = new THREE.Group();
    vmHolder.rotation.set(-0.35, 0, 0.25);
    vmHand.add(vmHolder);
    // Mano con dedos que agarran el objeto y antebrazo hasta el codo (grip.js)
    grip = G.Grip.create(vm, vmHand);
    vm.scale.setScalar(0.6);
    torchLight = new THREE.PointLight(0xffa04a, 0, 20, 1.6);
    scene.add(torchLight);
    P.setLook(G.Profile.lookHex(), true);
  };

  // Lo que se ve puesto: equipo + cosméticos de la tienda
  // (el protagonista lleva siempre su conjunto: fajín rojo, correa cruzada con bolsa y muñequeras)
  P.visibleIds = () => G.Equip.visibleIds(G.Inv.eqIds(), G.Profile.cosIds()).concat(['heroe_fajin', 'heroe_correa', 'munequeras']);
  P.refreshCosmetics = function () {
    if (!model) return;
    const before = model.eqKey;
    G.Equip.apply(model, P.visibleIds());
    if (model.eqKey !== before) { const l = curLayer; curLayer = -1; setLayer(Math.max(0, l)); }
  };
  // Aspecto del personaje (perfil): { shirt, skin, pants } en números
  P.setLook = function (look, force) {
    const key = [look.shirt, look.skin, look.pants].join(',');
    if (!force && key === lookKey && model) return;
    lookKey = key;
    if (model) { G.scene.remove(model.root); model.dispose(); }
    model = G.Character.create(look.shirt, { skin: look.skin, pants: look.pants });
    G.scene.add(model.root);
    G.Equip.apply(model, P.visibleIds());
    curLayer = -1;
    grip.setLook(look.shirt, look.skin);
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
  // Desde dónde miras (y apuntas). En 3ª persona por detrás, el rayo es el de la mira (el centro de la cámara),
  // tomado a la altura de tu cabeza: así golpeas, disparas y recoges justo lo que marca la cruz
  let aimCam = false;
  const _ld = new V3();
  P.eyePos = function (out) {
    out.set(P.pos.x, P.pos.y + (P.swimming && !P.diving ? 1.45 : P.station && P.station.st && P.station.st.seat ? 1.15 : P.eye), P.pos.z);
    if (aimCam && camera) {
      const d = P.lookDir(_ld), c = camera.position;
      const t = (out.x - c.x) * d.x + (out.y - c.y) * d.y + (out.z - c.z) * d.z;
      out.set(c.x + d.x * t, c.y + d.y * t, c.z + d.z * t);
    }
    return out;
  };

  P.reset = function (x, z, yaw) {
    if (P.ship) { P.ship = null; P.station = null; }
    P.pos.set(x, G.Build.groundAt(x, z) + 0.05, z);
    P.vel.set(0, 0, 0);
    P.yaw = yaw || 0; P.pitch = 0;
    P.dead = false; P.sick = 0; P.poison = 0; P.wet = 0; P.hurtT = 99; P.swing = 0; P.cd = 0; P.oxy = 100; P.diving = false; P.sinking = false;
  };

  // ------------------------------------------------------------------ colisiones
  // air: volando (truco); árboles, rocas y lugares solo chocan a su altura
  function collide(air) {
    const pos = P.pos;
    G.Res.query(pos.x, pos.z, 4, (r) => {
      if (!r.alive || !r.k.solid) return;
      if (air && pos.y > r.y + (r.k.tree ? 7 : 1.4 * r.s)) return;
      const dx = pos.x - r.x, dz = pos.z - r.z;
      const rr = r.k.r * r.s + P.radius;
      const d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2); pos.x = r.x + dx / d * rr; pos.z = r.z + dz / d * rr; }
    });
    G.Landmarks.collide(pos, P.radius, air);
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
    if (G.Cheats.flag('fly')) { fly(dt, K); return; }
    let fwd = (K.KeyW || K.ArrowUp ? 1 : 0) - (K.KeyS || K.ArrowDown ? 1 : 0);
    let str = (K.KeyD || K.ArrowRight ? 1 : 0) - (K.KeyA || K.ArrowLeft ? 1 : 0);
    // Joystick táctil (touch.js): movimiento analógico, más despacio si no lo empujas del todo
    const ax = inputOn && G.Input.axis, amag = ax && (ax.x || ax.y) ? Math.min(1, Math.hypot(ax.x, ax.y) * 1.15) : 1;
    if (ax && (ax.x || ax.y)) { fwd = -ax.y; str = ax.x; }
    const sy = Math.sin(P.yaw), cy = Math.cos(P.yaw);
    let wx = -sy * fwd + cy * str, wz = -cy * fwd - sy * str;
    const wl = Math.hypot(wx, wz);
    if (wl > 0) { wx /= wl; wz /= wl; wx *= amag; wz *= amag; }
    P.moving = wl > 0;
    const S = P.stats;
    if (S.stamina <= 0) P.exhausted = true;
    if (P.exhausted && S.stamina > 25) P.exhausted = false;
    const Pa = G.Parry, Cb = G.Combat;
    P.sprinting = !!(K.ShiftLeft || K.ShiftRight) && P.moving && fwd > 0 && !P.exhausted && !P.swimming && !Pa.guard && !(Cb.heavyT > 0);
    let speed = P.swimming ? (P.diving ? 3.4 : 3.6) * (S.stamina <= 0 ? 0.75 : 1) : P.sprinting ? 7.2 : 4.4;
    // En guardia se avanza despacio; aturdido (te pararon el golpe), casi nada
    if (Pa.guard) speed *= 0.55;
    if (Pa.stagger > 0) speed *= 0.4;
    if (Cb.heavyT > 0) speed *= 0.5; // cargando un golpe pesado
    if ((P.slowT = Math.max(0, (P.slowT || 0) - dt)) > 0) speed *= 0.72; // te dieron en una pierna
    if (P.wading) speed *= 0.7;
    if (G.Story) speed *= G.Story.speedMul();
    if (G.Cheats.flag('fast')) speed *= 2;
    // Equipo: armadura pesada, aletas, botas de nieve
    speed *= P.swimming ? G.Inv.eqStat('swim') : G.Inv.eqStat('speed');
    if (!P.swimming && !G.Inv.eqStat('snow') && G.Arch.biomeAt(P.pos.x, P.pos.z) === 'escarcha' && P.pos.y > 1.5) speed *= 0.85;
    const acc = P.onGround || P.swimming ? 12 : 2.5;
    // Esquivando (combat.js): un impulso rápido que se frena al final
    if (Cb.dodgeT > 0 && !P.swimming) { Cb.dodgeVel(_dv); P.vel.x = _dv.x; P.vel.z = _dv.z; }
    else {
      P.vel.x += (wx * speed - P.vel.x) * Math.min(1, acc * dt);
      P.vel.z += (wz * speed - P.vel.z) * Math.min(1, acc * dt);
    }
    if (!P.swimming) P.vel.y -= 24 * dt;
    if (K.Space && P.onGround && !P.swimming) { P.vel.y = G.Story ? G.Story.jumpPower(7.2) : 7.2; P.onGround = false; Cb.dust(P.pos.x, P.pos.y + 0.05, P.pos.z, 2, 0.5); }
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
        if (!P.onGround && vyBefore < -6) Cb.land(-vyBefore); // polvo y rodillas que amortiguan
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
        if (P.sprinting && P.onGround && !P.wading) Cb.dust(P.pos.x, P.pos.y + 0.05, P.pos.z, 1, 0.45); // polvo al correr
        const biome = G.Arch.biomeAt(P.pos.x, P.pos.z);
        G.Audio.play(P.swimming || P.wading ? 'splash' : P.onStruct ? 'step_wood' : ground < 2.3 ? 'step_sand' : biome === 'escarcha' ? 'step_snow' : 'step_grass', P.swimming ? 0.5 : 1);
      }
    }
  };

  // Truco: volar (Espacio sube, C o Ctrl baja, Shift más rápido)
  function fly(dt, K) {
    const fwd = (K.KeyW || K.ArrowUp ? 1 : 0) - (K.KeyS || K.ArrowDown ? 1 : 0), str = (K.KeyD || K.ArrowRight ? 1 : 0) - (K.KeyA || K.ArrowLeft ? 1 : 0);
    const sy = Math.sin(P.yaw), cy = Math.cos(P.yaw);
    let wx = -sy * fwd + cy * str, wz = -cy * fwd - sy * str;
    const wl = Math.hypot(wx, wz);
    if (wl > 0) { wx /= wl; wz /= wl; }
    const sp = K.ShiftLeft || K.ShiftRight ? 26 : 11;
    P.vel.x += (wx * sp - P.vel.x) * Math.min(1, dt * 8);
    P.vel.z += (wz * sp - P.vel.z) * Math.min(1, dt * 8);
    P.vel.y += (((K.Space ? 1 : 0) - (K.KeyC || K.ControlLeft ? 1 : 0)) * 8 - P.vel.y) * Math.min(1, dt * 8);
    P.pos.addScaledVector(P.vel, dt);
    const rr = Math.hypot(P.pos.x, P.pos.z), B = G.Arch.BOUND;
    if (rr > B) { P.pos.x *= B / rr; P.pos.z *= B / rr; }
    // Volando también chocas con chozas, paredes, árboles y rocas (pero puedes pasar por encima)
    const ground = Math.max(collide(true), G.World.waterLevelAt(P.pos.x, P.pos.z) + 0.1);
    const ceil = G.Landmarks.caveCeil(P.pos.x, P.pos.z);
    if (ceil !== null && P.pos.y > ceil - 1.9) { P.pos.y = ceil - 1.9; P.vel.y = Math.min(0, P.vel.y); }
    if (P.pos.y < ground) { P.pos.y = ground; P.vel.y = Math.max(0, P.vel.y); }
    P.pos.y = Math.min(P.pos.y, 260);
    P.moving = wl > 0; P.onGround = false; P.swimming = false; P.diving = false; P.sinking = false; P.wading = false; P.sprinting = false;
    P.hs = Math.hypot(P.vel.x, P.vel.z);
  }

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
    // Correr gasta 9/s (11 s seguidos); nadar gasta 1,6/s (un minuto largo) y flotando quieto se recupera algo.
    // Sin energía en el agua se nada más despacio y se pierde vida poco a poco
    if (P.sprinting) S.stamina = Math.max(0, S.stamina - 9 * dt);
    else if (P.swimming && !P.sinking) {
      S.stamina = P.moving ? Math.max(0, S.stamina - 1.6 * dt) : Math.min(100, S.stamina + 3 * dt);
      if (S.stamina <= 0 && !P.diving) { S.health -= 2.5 * dt; P.cause = 'Te ahogaste'; }
    } else if (!(P.station && P.station.kind === 'helm' && P.ship && P.ship.def.paddle && P.ship.throttle !== 0)) S.stamina = Math.min(100, S.stamina + (P.moving ? 10 : 18) * dt);
    const fire = G.Build.nearestLitFire(P.pos.x, P.pos.z);
    if (fire && fire.d < 0.75 && Math.abs(fire.s.y - P.pos.y) < 1 && !(G.Story && G.Story.fruitOf() === 'llama')) { S.health -= 10 * dt; P.cause = 'Te quemaste'; P.hurtT = 0; G.UI.hurtFlash(0.3); }
    // Lava del volcán
    if (!P.ship && G.Arch.biomeAt(P.pos.x, P.pos.z) === 'brasa' && G.Landmarks.lavaAt(P.pos.x, P.pos.z, P.pos.y) && !(G.Story && G.Story.fruitOf() === 'llama')) { S.health -= 30 * (1 - G.Inv.eqStat('lava')) * dt; P.cause = 'Caíste en la lava'; P.hurtT = 0; G.UI.hurtFlash(0.5); }
    if (G.Cheats.flag('god')) S.health = Math.max(S.health, 1);
    if (S.health <= 0) G.Game.die(P.cause);
  };

  // info (parry.js): { melee, cid, by, heavy, beast, shot }: golpes que se pueden bloquear o parar. Devuelve el daño recibido.
  P.damage = function (amt, src, cause, info) {
    if (P.dead || G.state.mode === 'dead') return 0;
    if (G.Cheats.flag('god')) return 0;
    if (info && G.Combat.iframes > 0) { G.UI.msg('💨 ¡Esquivado!', 'good', 'dodged'); G.Combat.dmgNum(P.pos.x, P.pos.y + 2, P.pos.z, 0, 'dodge', 'ESQUIVA'); return 0; }
    if (info) { amt = G.Parry.onHit(amt, src, info); if (amt <= 0) return 0; }
    const guarded = G.Parry.guard;
    if (G.Story) amt *= G.Story.damageMul();
    amt *= 1 - G.Inv.eqStat('armor');
    P.stats.health -= amt;
    P.hurtT = 0;
    P.cause = cause || P.cause;
    P.shake = 0.25;
    G.UI.hurtFlash(Math.min(1, amt / 20));
    G.Audio.play('hurt');
    // La parte del cuerpo golpeada reacciona (y un golpe en la pierna te frena un momento)
    const zone = info && info.zone;
    model.react(zone || 'torso', info && info.side, zone ? 1 : Math.min(1, amt / 15));
    if (zone === 'cabeza') P.shake = 0.45;
    if (zone === 'pierna') P.slowT = 1.3;
    if (src && !P.ship) {
      const dx = P.pos.x - src.x, dz = P.pos.z - src.z, d = Math.hypot(dx, dz) || 1;
      const k = guarded ? 0.4 : 1; // cubriéndote, el golpe apenas te mueve
      P.vel.x += dx / d * 6 * k; P.vel.z += dz / d * 6 * k; P.vel.y = 3.5 * k; P.onGround = !guarded ? false : P.onGround;
    }
    // En un duelo nadie muere: quien se queda sin vida pierde (duel.js)
    if (P.stats.health <= 0 && info && info.by !== undefined && G.Duel && G.Duel.with(info.by)) { P.stats.health = 1; G.Duel.lost(info.by); return amt; }
    if (P.stats.health <= 0) G.Game.die(P.cause);
    return amt;
  };

  // ------------------------------------------------------------------ cámara y modelos
  P.updateVisuals = function (dt) {
    const hs = P.hs;
    // Objeto en la mano
    const id = G.Inv.heldId();
    if (id !== vmId) {
      vmId = id;
      vmHolder.clear();
      const fp = id && G.ITEMS[id] && G.ITEMS[id].fp;
      if (fp) vmHolder.rotation.set(fp[0], fp[1], fp[2]); else vmHolder.rotation.set(-0.35, 0, 0.25);
      const t = G.makeItemMesh(id);
      if (t) { t.traverse((o) => (o.castShadow = false)); vmHolder.add(t); }
      grip.hold(t ? id : null, t, vmHolder.rotation); // los dedos se cierran sobre el objeto
      model.hand.clear();
      const t2 = G.makeItemMesh(id);
      if (t2) { t2.rotation.set(Math.PI / 2, 2.12, 0); model.hand.add(t2); t2.traverse((o) => o.layers.set(Math.max(0, curLayer))); }
    }
    if (P.swing > 0) P.swing = Math.max(0, P.swing - dt / 0.32);
    const s = P.swing > 0 ? Math.sin((1 - P.swing) * Math.PI) : 0;
    const bobA = P.onGround ? Math.min(1, hs / 4) : 0;
    // Balanceo del brazo en primera persona (girando desde el codo): levanta la herramienta
    // hacia atrás, golpea hacia delante y hacia el centro, y vuelve a su sitio
    const p = 1 - P.swing;
    const wind = P.swing > 0 ? (p < 0.35 ? U.smooth(0, 1, p / 0.35) : 1 - U.smooth(0, 1, (p - 0.35) / 0.3)) : 0;
    const strike = P.swing > 0 && p >= 0.35 ? Math.sin(Math.min(1, (p - 0.35) / 0.65) * Math.PI) : 0;
    const sway = Math.sin(performance.now() / 900) * 0.005 * (1 - bobA);
    void s;
    const gk = G.Parry.guardK, sk = G.Parry.staggerK, Cb = G.Combat, dir = P.swingDir || 0;
    P.hwK = U.lerp(P.hwK || 0, Cb.heavyT > 0 ? 1 : 0, Math.min(1, dt * 14));
    P.dgK = U.lerp(P.dgK || 0, Cb.dodgeT > 0 ? 1 : 0, Math.min(1, dt * 18));
    let rx = wind * 0.5 - strike * 0.62, ry = -wind * 0.1 + strike * 0.3, rz = -wind * 0.12 + strike * 0.18, pz = 0;
    if (P.swing > 0 && (dir === 0 || dir === 1)) {
      // Tajo (de derecha a izquierda) o revés: el arma cruza la pantalla en horizontal
      const sg = dir === 0 ? 1 : -1, env = Math.sin(p * Math.PI);
      const sw = p < 0.3 ? -0.55 * U.smooth(0, 1, p / 0.3) : (-0.55 + 1.4 * U.smooth(0, 1, (p - 0.3) / 0.32)) * (1 - U.smooth(0, 1, (p - 0.7) / 0.3));
      rx = 0.28 * env; ry = sw * sg; rz = 0.95 * env;
    } else if (P.swing > 0 && dir === 3) { rx = wind * 0.25 - strike * 0.2; ry = strike * 0.1; rz = 0.1 * strike; pz = -0.2 * strike; } // estocada
    else if (P.swing > 0 && dir === 4) { rx = wind * 0.95 - strike * 0.95; ry = strike * 0.35; rz = strike * 0.3; } // pesado
    const tr = P.hwK > 0.5 ? Math.sin(performance.now() / 14) * 0.012 : 0;
    rx += P.hwK * 0.95 + tr; rz -= P.hwK * 0.2; // cargando el pesado: el arma bien atrás, temblando
    vm.rotation.set(rx + gk * 0.66 - sk * 0.5, ry + gk * 0.5, rz + gk * 0.92 - sk * 0.3 + P.dgK * 0.25 * Math.sign(Cb.dodgeSide || 1));
    vm.position.set(
      VM_ELBOW.x + Math.cos(P.bob) * 0.01 * bobA - gk * 0.05 + sk * 0.03,
      VM_ELBOW.y + Math.sin(P.bob * 2) * 0.01 * bobA + sway + gk * 0.05 - sk * 0.05 + P.hwK * 0.05 - P.dgK * 0.07,
      VM_ELBOW.z + pz + P.hwK * 0.04);
    grip.update(dt);

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
    const moveAng = hs > 0.3 ? U.angDiff(P.yaw, Math.atan2(-P.vel.x, -P.vel.z)) : 0;
    model.update(dt, { pos: _v, yaw: P.yaw, pitch: P.pitch, speed: P.station ? 0 : hs, onGround: P.onGround || P.wading || !!P.ship, swimming: P.swimming, swing: P.swing, holding: !!id, guard: G.Parry.guardK, stagger: G.Parry.staggerK,
      swingDir: P.swingDir || 0, heavyWind: P.hwK, dodge: P.dgK, dodgeSide: G.Combat.dodgeSide, land: P.landK || 0, moveAng: G.Combat.dodgeT > 0 ? 0 : moveAng });
    model.root.visible = !P.dead || P.cam !== 'fp';

    // Cámara
    P.shake = Math.max(0, P.shake - dt);
    const sh = P.shake * 0.25;
    // Zoom del catalejo
    const wantFov = P.zoom ? 18 : G.Profile.set('fov') + G.Combat.fovExtra(dt);
    if (Math.abs(camera.fov - wantFov) > 0.05) { camera.fov = U.lerp(camera.fov, wantFov, Math.min(1, dt * 8)); camera.updateProjectionMatrix(); }
    aimCam = false;
    if (G.Ships && G.Ships.cameraFor(camera)) { setLayer(0); vm.visible = false; return; }
    if (P.cam === 'fp') {
      const bob = P.onGround ? Math.sin(P.bob * 2) * 0.04 * bobA : 0;
      P.eyePos(camera.position);
      camera.position.y += bob - (P.landK || 0) * 0.14 - P.dgK * 0.12;
      const K = G.Input.keys, str = (K.KeyD ? 1 : 0) - (K.KeyA ? 1 : 0);
      P.roll = U.lerp(P.roll || 0, -str * 0.022 * Math.min(1, hs / 4) - (Math.abs(G.Combat.dodgeSide) === 1 ? G.Combat.dodgeSide * 0.07 * P.dgK : 0), Math.min(1, dt * 8));
      camera.rotation.set(P.pitch + (Math.random() - 0.5) * sh, P.yaw + (Math.random() - 0.5) * sh, P.roll, 'YXZ');
      setLayer(1);
      vm.visible = !P.dead && !P.zoom;
    } else if (P.cam === 'front') {
      // Cámara frontal: delante de ti, mirándote a la cara (el ratón la sube y la baja)
      const head = _v.set(P.pos.x, P.pos.y + (P.swimming && !P.diving ? 1.3 : seated ? 1.1 : 1.55), P.pos.z);
      const pt = U.clamp(P.pitch, -0.8, 0.8);
      _d.set(-Math.sin(P.yaw) * Math.cos(pt), Math.sin(pt) * 0.85 + 0.06, -Math.cos(P.yaw) * Math.cos(pt)).normalize();
      P.camD = camFree(head, _d, 2.7, dt);
      camera.position.copy(head).addScaledVector(_d, P.camD);
      camera.lookAt(head.x, head.y - 0.06, head.z);
      camera.rotation.z += (Math.random() - 0.5) * sh;
      setLayer(0);
      vm.visible = false;
    } else {
      // 3ª persona por detrás, cómoda para luchar: por encima del hombro derecho (tu personaje queda a la
      // izquierda y no tapa la mira) y más cerca cuando hay pelea o te cubres. No atraviesa paredes ni el suelo.
      if ((fightT -= dt) <= 0) { fightT = 0.3; fighting = enemyNear(); }
      const fk = (P.fightK = U.lerp(P.fightK || 0, fighting || G.Parry.guard || P.swing > 0 ? 1 : 0, Math.min(1, dt * 3)));
      const side = U.lerp(0.55, 0.68, fk), dist = U.lerp(3.5, 2.7, fk);
      const pivot = _v.set(P.pos.x + Math.cos(P.yaw) * side, P.pos.y + (P.swimming && !P.diving ? 1.35 : seated ? 1.2 : U.lerp(1.62, 1.55, fk)), P.pos.z - Math.sin(P.yaw) * side);
      P.lookDir(_d).multiplyScalar(-1);
      P.camD = camFree(pivot, _d, dist, dt);
      camera.position.copy(pivot).addScaledVector(_d, P.camD);
      camera.rotation.set(P.pitch + (Math.random() - 0.5) * sh, P.yaw + (Math.random() - 0.5) * sh, 0, 'YXZ');
      setLayer(0);
      vm.visible = false;
      aimCam = true;
    }
  };
  // Distancia libre desde 'from' en la dirección 'dir' (hasta 'max'): el terreno y las construcciones cortan la cámara.
  // Se acerca al instante y se vuelve a alejar con suavidad.
  let fightT = 0, fighting = false;
  function camFree(from, dir, max, dt) {
    let free = max;
    for (let t = 0.3; t <= max; t += 0.12) {
      const x = from.x + dir.x * t, y = from.y + dir.y * t, z = from.z + dir.z * t;
      let hit = y < G.height(x, z) + 0.3;
      if (!hit) G.Build.forBoxesNear(x, z, 0.5, (b) => { if (!hit && x > b.x0 - 0.15 && x < b.x1 + 0.15 && z > b.z0 - 0.15 && z < b.z1 + 0.15 && y > b.y0 - 0.15 && y < b.y1 + 0.15) hit = true; });
      if (hit) { free = Math.max(0.35, t - 0.2); break; }
    }
    const cur = P.camD || free;
    return free < cur ? free : U.lerp(cur, free, Math.min(1, dt * 4));
  }
  // ¿Hay algún enemigo peleando cerca? (la cámara de 3ª persona se acerca)
  function enemyNear() {
    let near = false;
    G.Creatures.forEachAlive((c) => {
      if (!near && c.aggro > 0 && c.d.dmg && !c.d.friendly && !c.d.dummy && !G.Faction.friendly(c) && Math.hypot(c.x - P.pos.x, c.z - P.pos.z) < 14) near = true;
    });
    return near;
  }
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
  // V: primera persona → 3ª persona (por detrás) → frontal
  P.toggleCam = function () {
    P.cam = P.cam === 'fp' ? 'tp' : P.cam === 'tp' ? 'front' : 'fp';
    P.camD = 0;
    G.UI.msg(P.cam === 'fp' ? '📷 Cámara: primera persona' : P.cam === 'tp' ? '📷 Cámara: tercera persona (por detrás)' : '📷 Cámara: frontal (te ve de cara)', 'info', 'cam');
  };
})();
