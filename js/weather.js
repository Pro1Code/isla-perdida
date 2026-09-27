// Clima: cielo despejado, lluvia y tormenta (con relámpagos), más la temperatura corporal del jugador.
// En LAN el anfitrión decide el clima y lo envía al resto.
(function () {
  'use strict';
  const G = window.G, U = G.U;
  const Wx = (G.Weather = { type: 'clear', timer: 150, intensity: 0, flash: 0, nextBolt: 5, windA: 0.6, windS: 0.8, windT: 0 });
  const TARGET = { clear: 0, rain: 0.6, storm: 1 };
  Wx.NAMES = { clear: 'Despejado', rain: 'Lluvia', storm: 'Tormenta' };
  let rain, rainU;

  // ------------------------------------------------------------------ partículas de lluvia (animadas en la GPU)
  Wx.build = function (scene) {
    const N = 4000, BOX = 44, HGT = 26;
    const pos = new Float32Array(N * 2 * 3), end = new Float32Array(N * 2);
    const rnd = U.rng(3);
    for (let i = 0; i < N; i++) {
      const x = rnd() * BOX, y = rnd() * HGT, z = rnd() * BOX;
      pos.set([x, y, z, x, y, z], i * 6);
      end[i * 2] = 0; end[i * 2 + 1] = 1;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
    rainU = {
      uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uAlpha: { value: 0 }, uBox: { value: new THREE.Vector3(BOX, HGT, BOX) },
      uWind: { value: new THREE.Vector2(0.15, 0.05) }, uCave: { value: new THREE.Vector3(G.World.CAVE.x, G.World.CAVE.z, G.World.CAVE.r * 0.9) },
      uColor: { value: new THREE.Color(0xaec4d8) }, uFall: { value: 22 }, uLen: { value: 0.9 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: rainU, transparent: true, depthWrite: false,
      vertexShader: `
        attribute float aEnd;
        uniform float uTime; uniform vec3 uCam; uniform vec3 uBox; uniform vec2 uWind; uniform float uFall; uniform float uLen;
        varying float vA; varying vec3 vW;
        void main(){
          vec3 p = position;
          p.y -= uTime * uFall;
          p.xz += uWind * uTime * uFall + vec2(sin(uTime * 0.7 + position.y), cos(uTime * 0.6 + position.x)) * (1.0 - uLen) * 1.5;
          vec3 base = uCam - vec3(uBox.x * 0.5, uBox.y * 0.4, uBox.z * 0.5);
          p = mod(p - base, uBox) + base;
          p.y += aEnd * uLen; p.xz -= uWind * aEnd * uLen;
          vA = 1.0 - aEnd * 0.6;
          vW = p;
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: `
        uniform float uAlpha; uniform vec3 uColor; uniform vec3 uCave;
        varying float vA; varying vec3 vW;
        void main(){
          if (distance(vW.xz, uCave.xy) < uCave.z) discard; // no llueve dentro de la cueva
          gl_FragColor = vec4(uColor, uAlpha * vA * 0.55);
        }`,
    });
    rain = new THREE.LineSegments(g, mat);
    rain.frustumCulled = false;
    rain.visible = false;
    scene.add(rain);
    // Cielo encapotado: una cúpula gris que tapa el cielo según la intensidad del mal tiempo
    overcast = new THREE.Mesh(new THREE.SphereGeometry(1800, 24, 12), new THREE.MeshBasicMaterial({ color: 0x5a6068, side: THREE.BackSide, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    overcast.frustumCulled = false;
    overcast.visible = false;
    scene.add(overcast);
  };
  let overcast;
  const _oc = new THREE.Color(), _ocDay = new THREE.Color(0x6a7078), _ocNight = new THREE.Color(0x0c0f14), _ocFlash = new THREE.Color(0xc8d4ff);

  Wx.set = function (type, timer) {
    if (!TARGET.hasOwnProperty(type)) return;
    const changed = type !== Wx.type;
    Wx.type = type;
    if (timer !== undefined) Wx.timer = timer;
    if (changed && G.state.mode !== 'menu') {
      if (type === 'rain') G.UI.msg('🌧️ Empieza a llover. Busca refugio o te mojarás y tendrás frío.', 'warn', 'wx');
      else if (type === 'storm') G.UI.msg('⛈️ ¡Se acerca una tormenta! El fuego al aire libre se apagará rápido.', 'bad', 'wx');
      else G.UI.msg('🌤️ El cielo se despeja.', 'good', 'wx');
    }
  };

  // Solo quien tiene la autoridad (partida individual o anfitrión) decide el siguiente clima
  function nextWeather() {
    const r = Math.random(), day = G.state.day;
    if (Wx.type !== 'clear') Wx.set('clear', 150 + Math.random() * 200);
    else if (day >= 2 && r < 0.14) Wx.set('storm', 50 + Math.random() * 60);
    else if (r < 0.45) Wx.set('rain', 60 + Math.random() * 90);
    else Wx.timer = 90 + Math.random() * 120;
  }

  Wx.update = function (dt, cam, active) {
    if (active && G.Net.authority()) {
      Wx.timer -= dt;
      if (Wx.timer <= 0) nextWeather();
      // El viento gira despacio (y sopla fuerte en las tormentas)
      Wx.windT -= dt;
      if (Wx.windT <= 0) { Wx.windT = 40 + Math.random() * 60; Wx.windTarget = Wx.windA + (Math.random() - 0.5) * 1.6; }
    }
    if (Wx.windTarget !== undefined) Wx.windA += U.angDiff(Wx.windA, Wx.windTarget) * Math.min(1, dt * 0.05);
    Wx.windS = U.lerp(Wx.windS, 0.75 + Wx.intensity * 0.55, Math.min(1, dt * 0.2));
    Wx.intensity += (TARGET[Wx.type] - Wx.intensity) * (1 - Math.exp(-dt * 0.35));
    // En Isla Escarcha nieva (siempre un poco) y en Isla Brasa cae ceniza
    const biome = G.Arch.biomeAt(cam.x, cam.z);
    let fall = Wx.intensity, kind = 'rain';
    if (biome === 'escarcha') { kind = 'snow'; fall = Math.max(0.35, Wx.intensity); }
    else if (biome === 'brasa') { kind = 'ash'; fall = Math.max(0.25, Wx.intensity * 0.6); }
    Wx.fallKind = kind;
    if (rain) {
      rainU.uTime.value = (rainU.uTime.value + dt) % 1000;
      rainU.uCam.value.copy(cam);
      rainU.uAlpha.value = U.smooth(0.05, 0.6, fall) * (kind === 'rain' ? 1 : 1.6);
      rainU.uWind.value.set(Math.sin(Wx.windA) * (0.15 + Wx.intensity * 0.25), Math.cos(Wx.windA) * (0.15 + Wx.intensity * 0.25));
      rainU.uFall.value = kind === 'rain' ? 22 : kind === 'snow' ? 2.2 : 1.4;
      rainU.uLen.value = kind === 'rain' ? 0.9 : 0.07;
      rainU.uColor.value.set(kind === 'rain' ? 0xaec4d8 : kind === 'snow' ? 0xffffff : 0x6a625c);
      const C = G.Landmarks.nearestCave(cam.x, cam.z);
      if (C) rainU.uCave.value.set(C.wx, C.wz, C.r * 0.9);
      rain.visible = fall > 0.04 && !G.World.underwater;
      rain.geometry.setDrawRange(0, Math.floor(4000 * U.clamp(fall * 1.2, 0, 1)) * 2);
    }
    // Relámpagos y truenos durante la tormenta
    Wx.flash = Math.max(0, Wx.flash - dt * 4);
    if (overcast) {
      // La niebla marina (cambio de horario entre islas) también tapa el cielo por completo
      const mist = G.World.mist || 0, uw = G.World.underwater ? 1 : 0;
      overcast.visible = Wx.intensity > 0.02 || mist > 0.01 || uw;
      overcast.position.copy(cam);
      overcast.material.opacity = Math.max(Math.min(0.92, Wx.intensity * 0.95), mist, uw);
      _oc.lerpColors(_ocNight, _ocDay, G.World.day).lerp(_ocFlash, Wx.flash * 0.7);
      if (mist > 0.01 || uw) _oc.lerp(G.scene.fog.color, Math.max(mist, uw));
      overcast.material.color.copy(_oc);
      if (Wx.intensity > 0.4 || mist > 0.6) { G.World.stars.visible = false; G.World.moon.visible = false; }
    }
    if (Wx.type === 'storm' && Wx.intensity > 0.6) {
      Wx.nextBolt -= dt;
      if (Wx.nextBolt <= 0) {
        Wx.nextBolt = 5 + Math.random() * 11;
        Wx.flash = 1;
        if (G.SeaWx) G.SeaWx.onBolt();
        const delay = 0.4 + Math.random() * 2.2;
        setTimeout(() => G.Audio.play('thunder', 1 - delay / 3.2), delay * 1000);
      }
    }
    if (active) G.Audio.setRain(Wx.intensity * (G.Landmarks.inCave(cam.x, cam.z) ? 0.25 : 1));
  };

  // ------------------------------------------------------------------ temperatura y humedad del jugador
  // Devuelve la temperatura "sentida" (0 congelado · 50 ideal · 100 calor extremo)
  Wx.feltTemp = function (P) {
    const W = G.World, day = W.day, sunY = W.sunDir.y;
    let t = U.lerp(26, 60, day) + Math.max(0, sunY) * 16;
    t += G.Arch.tempAt(P.pos.x, P.pos.z);
    const inCave = G.Landmarks.inCave(P.pos.x, P.pos.z);
    const roof = G.Build.hasRoof(P.pos.x, P.pos.z) || inCave || (P.ship && P.local && P.ship.type === 'barco' && P.local.z < -P.ship.def.L / 2 + 5);
    if (!roof) t -= Wx.intensity * 18;
    else t = U.lerp(t, 50, 0.45);
    t -= P.wet * 0.22;
    const fire = G.Build.nearestLitFire(P.pos.x, P.pos.z);
    if (fire && fire.d < 6) t += 32 * (1 - fire.d / 6);
    // Aguas termales de Isla Escarcha
    const L = G.World.lakeAt(P.pos.x, P.pos.z);
    if (L && L.kind === 'hot' && P.swimming) t = Math.max(t, 70);
    // Ropa: abrigo contra el frío y protección contra el calor
    if (t < 50) t = U.lerp(t, 50, Math.min(0.9, G.Inv.eqStat('cold')));
    if (t > 58) t = U.lerp(t, 58, Math.min(0.9, G.Inv.eqStat('heat')));
    const fr = G.Story ? G.Story.fruitOf() : null;
    if ((fr === 'llama' || fr === 'hielo') && t < 50) t = 50;
    if (fr === 'hielo' && t > 60) t = 60;
    if (P.swimming) t -= 8;
    if (P.sprinting) t += 6;
    return U.clamp(t, 0, 100);
  };
  Wx.updatePlayer = function (P, dt) {
    const S = P.stats;
    const inCave = G.Landmarks.inCave(P.pos.x, P.pos.z);
    const roof = G.Build.hasRoof(P.pos.x, P.pos.z) || inCave;
    const fire = G.Build.nearestLitFire(P.pos.x, P.pos.z);
    const hotL = G.World.lakeAt(P.pos.x, P.pos.z);
    if (hotL && hotL.kind === 'hot' && P.swimming) { S.health = Math.min(100, S.health + 2 * dt); P.sick = Math.max(0, P.sick - dt * 2); }
    if (P.swimming) P.wet = Math.min(100, P.wet + 25 * dt);
    else if (Wx.intensity > 0.1 && !roof && Wx.fallKind === 'rain') P.wet = Math.min(100, P.wet + Wx.intensity * (G.Inv.eqStat('rain') ? 2 : 5) * dt);
    else P.wet = Math.max(0, P.wet - (fire && fire.d < 5 ? 10 : 1.5 + G.World.day * 1.5) * dt);
    const felt = Wx.feltTemp(P);
    S.temp += (felt - S.temp) * (1 - Math.exp(-dt * 0.05));
    if (S.temp < 22) { S.health -= (22 - S.temp) * 0.035 * dt; P.cause = 'Moriste de hipotermia'; }
    if (S.temp > 80) S.thirst = Math.max(0, S.thirst - (S.temp - 80) * 0.02 * dt);
  };
})();
