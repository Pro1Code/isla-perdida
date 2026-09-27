// Mundo: terreno de la Isla Perdida, océano (sigue a la cámara), lagos, cielo, luces, hierba y ciclo día/noche.
// Las demás islas del archipiélago se generan en islands.js y reutilizan lo que exporta este archivo.
(function () {
  'use strict';
  const G = window.G, U = G.U;
  const W = (G.World = {});
  const V3 = THREE.Vector3;
  W.SIZE = 520; W.SEG = 260; W.ISLAND_R = 200; W.MAP_RANGE = 240;
  W.WORLD = 3600; // tamaño total del mar (±1800 m)
  W.LAKE = { x: 34, z: 42, r: 17, plateau: 6.2, level: 5.4 };
  W.MOUNT = { x: -48, z: -58 };
  W.waterMats = [];
  W.lakes = [];
  W.grassTime = { value: 0 };
  W.grassR = { value: 42 };
  const nA = U.makeNoise(7), nB = U.makeNoise(99), nC = U.makeNoise(2024);

  // ------------------------------------------------------------------ altura (Isla Perdida)
  function baseHeight(x, z) {
    const d = Math.hypot(x, z) / W.ISLAND_R;
    const coast = d + U.fbm(nA, x * 0.0045, z * 0.0045, 4) * 0.22;
    const island = 1 - U.smooth(0.55, 1.0, coast);
    const inland = U.smooth(0.62, 0.35, coast);
    const hills = U.fbm(nB, x * 0.011, z * 0.011, 5) * 0.5 + 0.5;
    let m = Math.max(0, 1 - Math.hypot(x - W.MOUNT.x, z - W.MOUNT.z) / 95);
    m = m * m * (3 - 2 * m) * 30;
    let h = -12 + island * 14;
    h += inland * (hills * 12 + m);
    h += U.fbm(nC, x * 0.07, z * 0.07, 2) * 0.35 * (0.3 + inland);
    return h;
  }
  function heightFn(x, z) {
    let h = baseHeight(x, z);
    const L = W.LAKE, d = Math.hypot(x - L.x, z - L.z);
    h = U.lerp(h, L.plateau, U.smooth(L.r * 2.1, L.r * 1.15, d));
    h -= U.smooth(L.r, 0, d) * 4.2;
    // Terraza plana al pie de la montaña para la cueva
    const Cv = W.CAVE, dc = Math.hypot(x - Cv.x, z - Cv.z);
    if (dc < Cv.r * 2.3) {
      if (Cv.plateau === undefined) Cv.plateau = baseHeight(Cv.x, Cv.z);
      h = U.lerp(h, Cv.plateau, U.smooth(Cv.r * 2.3, Cv.r * 1.3, dc));
    }
    return h;
  }
  W.CAVE = { x: -24, z: -30, r: 11, h: 7.5 };
  W.CAVE.ent = Math.atan2(W.CAVE.x - W.MOUNT.x, W.CAVE.z - W.MOUNT.z); // la entrada mira hacia fuera de la montaña
  W.noSpawn = [];
  W.blockedArea = (x, z, pad = 0) => W.noSpawn.some((a) => Math.hypot(x - a.x, z - a.z) < a.r + pad);
  // Lagos de agua dulce (o termales) de todas las islas
  W.lakeAt = (x, z) => {
    for (const L of W.lakes) if (Math.abs(x - L.x) < L.r && Math.abs(z - L.z) < L.r && Math.hypot(x - L.x, z - L.z) < L.r) return L;
    return null;
  };
  W.waterLevelAt = (x, z) => { const L = W.lakeAt(x, z); return L ? L.level : 0; };
  W.inLakeWater = (x, z) => { const L = W.lakeAt(x, z); return !!L && G.height(x, z) < L.level; };
  W.slope = (x, z) => {
    const dx = G.height(x + 1, z) - G.height(x - 1, z), dz = G.height(x, z + 1) - G.height(x, z - 1);
    return 1 / Math.sqrt(1 + (dx * dx + dz * dz) / 4);
  };

  // ------------------------------------------------------------------ construcción
  W.build = function (scene) {
    const N = W.SEG + 1, STEP = W.SIZE / W.SEG, HALF = W.SIZE / 2;
    const H = new Float32Array(N * N);
    for (let iz = 0; iz < N; iz++) for (let ix = 0; ix < N; ix++) H[iz * N + ix] = heightFn(-HALF + ix * STEP, -HALF + iz * STEP);
    G.Arch.setBase(H, W.SEG, STEP, HALF);
    W.detailTex = makeDetail();
    buildTerrain(scene);
    buildWater(scene);
    buildSky(scene);
    W.spawn = findSpawn();
    W.WRECK = findWreck();
    W.noSpawn = [{ x: W.CAVE.x, z: W.CAVE.z, r: W.CAVE.r + 3 }, { x: W.WRECK.x, z: W.WRECK.z, r: 10 }];
    W.lakes.push({ x: W.LAKE.x, z: W.LAKE.z, r: W.LAKE.r, level: W.LAKE.level, kind: 'fresh', isl: 0 });
    buildGrass(scene);
    G.Arch.islands[0].map = W.renderIslandMap(G.Arch.islands[0], 256);
    G.Arch.islands[0].spawn = W.spawn;
    W.mapCanvas = G.Arch.islands[0].map;
  };

  function findSpawn() {
    const dx = -0.24, dz = 0.97;
    for (let d = 40; d < 240; d += 0.5) {
      if (G.height(dx * d, dz * d) < 1.7) {
        const x = dx * (d - 4), z = dz * (d - 4);
        return { x, z, yaw: Math.atan2(dx, dz) };
      }
    }
    return { x: 0, z: 150, yaw: 0 };
  }

  function findWreck() {
    const dx = 0.86, dz = -0.51;
    for (let d = 60; d < 240; d += 0.5) {
      if (G.height(dx * d, dz * d) < 0.9) return { x: dx * (d - 7), z: dz * (d - 7), rot: Math.atan2(dz, -dx) };
    }
    return { x: 150, z: -90, rot: 0 };
  }

  function makeDetail() {
    return U.canvasTex(256, 256, (ctx, w, h) => {
      const img = ctx.createImageData(w, h);
      for (let i = 0; i < w * h; i++) {
        const v = 220 + Math.random() * 35;
        img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      for (let k = 0; k < 120; k++) {
        ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},0.05)`;
        ctx.beginPath(); ctx.arc(Math.random() * w, Math.random() * h, 3 + Math.random() * 10, 0, Math.PI * 2); ctx.fill();
      }
    });
  }
  // Material de terreno con la textura de detalle repetida según el tamaño
  W.terrainMaterial = function (size) {
    const tex = W.detailTex.clone();
    tex.needsUpdate = true;
    tex.repeat.set(size / 5.8, size / 5.8);
    return new THREE.MeshStandardMaterial({ vertexColors: true, map: tex, roughness: 0.96, metalness: 0 });
  };

  function buildTerrain(scene) {
    const geo = new THREE.PlaneGeometry(W.SIZE, W.SIZE, W.SEG, W.SEG);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, G.height(pos.getX(i), pos.getZ(i)));
    geo.computeVertexNormals();
    const nor = geo.attributes.normal;
    const cols = new Float32Array(pos.count * 3);
    const C = (h) => new THREE.Color(h);
    const sand = C(0xe8d3a4), wet = C(0xb09a70), under = C(0xc9b489), grassA = C(0x55842a), grassB = C(0x7a9a3a),
      dirt = C(0x7a6240), rockA = C(0x8a857b), rockB = C(0x68635b), mud = C(0x55493a);
    const c = new THREE.Color(), g = new THREE.Color(), r = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), h = pos.getY(i), ny = nor.getY(i);
      const n1 = nA(x * 0.05, z * 0.05), n2 = nB(x * 0.013, z * 0.013), n3 = nC(x * 0.2, z * 0.2);
      if (h < -0.3) c.copy(under).lerp(wet, U.smooth(-4, -0.3, h));
      else c.lerpColors(wet, sand, U.smooth(-0.3, 0.9, h));
      g.lerpColors(grassA, grassB, n1 * 0.5 + 0.5);
      g.lerp(dirt, U.smooth(0.35, 0.75, n2) * 0.7);
      c.lerp(g, U.smooth(2.1, 3.3, h + n3 * 0.5));
      r.lerpColors(rockA, rockB, n3 * 0.5 + 0.5);
      const rockT = Math.max(U.smooth(0.86, 0.7, ny) * U.smooth(1.0, 3.0, h), U.smooth(20, 27, h + n1 * 3));
      c.lerp(r, rockT);
      const ld = Math.hypot(x - W.LAKE.x, z - W.LAKE.z);
      if (ld < W.LAKE.r * 1.05) c.lerp(mud, U.smooth(W.LAKE.level + 0.6, W.LAKE.level - 0.4, h) * 0.85);
      const cd = Math.hypot(x - W.CAVE.x, z - W.CAVE.z);
      if (cd < W.CAVE.r * 1.6) c.lerp(r.copy(rockB).multiplyScalar(0.75 + n3 * 0.1), U.smooth(W.CAVE.r * 1.6, W.CAVE.r * 0.9, cd) * 0.9);
      cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const mesh = new THREE.Mesh(geo, W.terrainMaterial(W.SIZE));
    mesh.receiveShadow = true;
    scene.add(mesh);
    W.terrain = mesh;
  }

  // ------------------------------------------------------------------ agua
  const waterVS = `
    uniform float uTime; uniform float uAmp; uniform float uLevel; uniform float uSize; uniform sampler2D uHeight;
    varying vec3 vW; varying vec3 vN;
    void main(){
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vec2 uv = (wp.xz + uSize * 0.5) / uSize;
      float depth = uLevel - texture2D(uHeight, uv).r;
      float amp = uAmp * smoothstep(0.0, 5.0, depth);
      float h = 0.0; vec2 d = vec2(0.0); vec2 D; float ph;
      D = normalize(vec2(1.0, 0.35)); ph = dot(D, wp.xz) * 0.07 + uTime * 0.9; h += 0.45 * sin(ph); d += D * 0.45 * 0.07 * cos(ph);
      D = normalize(vec2(-0.5, 1.0)); ph = dot(D, wp.xz) * 0.11 + uTime * 1.25; h += 0.25 * sin(ph); d += D * 0.25 * 0.11 * cos(ph);
      D = normalize(vec2(0.8, -0.7)); ph = dot(D, wp.xz) * 0.23 + uTime * 1.9; h += 0.09 * sin(ph); d += D * 0.09 * 0.23 * cos(ph);
      D = normalize(vec2(-0.9, -0.3)); ph = dot(D, wp.xz) * 0.41 + uTime * 2.6; h += 0.045 * sin(ph); d += D * 0.045 * 0.41 * cos(ph);
      wp.y += h * amp; d *= amp;
      vN = normalize(vec3(-d.x, 1.0, -d.y));
      vW = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`;
  const waterFS = `
    uniform vec3 uSunDir; uniform vec3 uSunColor; uniform vec3 uSky; uniform vec3 uFog;
    uniform float uFogNear; uniform float uFogFar; uniform float uTime; uniform float uDay;
    uniform float uLevel; uniform float uSize; uniform sampler2D uHeight; uniform float uAmp;
    uniform vec3 uShallow; uniform vec3 uDeep; uniform float uFoam;
    varying vec3 vW; varying vec3 vN;
    void main(){
      vec2 uv = (vW.xz + uSize * 0.5) / uSize;
      float depth = uLevel - texture2D(uHeight, uv).r;
      vec2 p = vW.xz;
      // Normal de las olas calculada en cada píxel (con la de los vértices se veía una cuadrícula en mar abierto)
      float amp = uAmp * smoothstep(0.0, 5.0, depth);
      vec2 dd = vec2(0.0); vec2 D; float ph;
      D = normalize(vec2(1.0, 0.35)); ph = dot(D, p) * 0.07 + uTime * 0.9; dd += D * 0.45 * 0.07 * cos(ph);
      D = normalize(vec2(-0.5, 1.0)); ph = dot(D, p) * 0.11 + uTime * 1.25; dd += D * 0.25 * 0.11 * cos(ph);
      D = normalize(vec2(0.8, -0.7)); ph = dot(D, p) * 0.23 + uTime * 1.9; dd += D * 0.09 * 0.23 * cos(ph);
      D = normalize(vec2(-0.9, -0.3)); ph = dot(D, p) * 0.41 + uTime * 2.6; dd += D * 0.045 * 0.41 * cos(ph);
      dd *= amp;
      // Ondas pequeñas en direcciones irregulares (rompen la repetición), más suaves a lo lejos
      float mid = (1.0 - smoothstep(60.0, 420.0, length(cameraPosition - vW))) * (0.4 + 0.6 * amp);
      D = normalize(vec2(0.37, 0.93)); ph = dot(D, p) * 0.93 + uTime * 1.6; dd += D * 0.03 * cos(ph + sin(p.x * 0.05)) * mid;
      D = normalize(vec2(-0.83, 0.56)); ph = dot(D, p) * 1.37 + uTime * 2.1; dd += D * 0.022 * cos(ph + sin(p.y * 0.043)) * mid;
      D = normalize(vec2(0.95, -0.31)); ph = dot(D, p) * 0.61 + uTime * 1.2; dd += D * 0.028 * cos(ph) * mid;
      vec3 n = normalize(vec3(-dd.x, 1.0, -dd.y));
      float near = 1.0 - smoothstep(25.0, 140.0, length(cameraPosition - vW));
      n.x += (sin(p.x * 1.1 + uTime * 1.7 + sin(p.y * 0.7)) * 0.5 + sin(p.y * 2.3 - uTime * 2.3 + p.x * 0.6) * 0.5) * 0.05 * near;
      n.z += (sin(p.y * 1.3 + uTime * 1.5 + sin(p.x * 0.9)) * 0.5 + sin(p.x * 2.7 + uTime * 2.1 - p.y * 0.4) * 0.5) * 0.05 * near;
      n = normalize(n);
      vec3 V = normalize(cameraPosition - vW);
      float fres = 0.04 + 0.96 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
      vec3 base = mix(uShallow, uDeep, smoothstep(0.0, 9.0, depth));
      float lit = 0.35 + 0.65 * max(dot(n, uSunDir), 0.0);
      vec3 col = base * lit * uDay;
      col = mix(col, uSky, clamp(fres, 0.0, 0.85));
      vec3 R = reflect(-V, n);
      float sp = pow(max(dot(R, uSunDir), 0.0), 220.0);
      col += uSunColor * sp * 3.0;
      float wob = sin(p.x * 0.8 + uTime * 0.6) * sin(p.y * 0.9 - uTime * 0.5) * 0.3;
      float edge = 1.0 - smoothstep(0.0, 0.7 + wob * 0.5, depth);
      float bands = smoothstep(0.55, 1.0, sin(depth * 4.0 - uTime * 1.6 + wob * 3.0) * 0.5 + 0.5) * (1.0 - smoothstep(0.2, 2.2, depth));
      float foam = clamp(edge + bands * 0.6, 0.0, 1.0) * uFoam;
      col = mix(col, vec3(0.95) * uDay, foam * 0.85);
      float alpha = mix(0.35, 0.93, smoothstep(0.0, 2.5, depth));
      alpha = max(alpha, foam * 0.9);
      alpha = mix(alpha, 1.0, clamp(fres * 0.5, 0.0, 1.0));
      float fd = length(cameraPosition - vW);
      float fogF = clamp((fd - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
      col = mix(col, uFog, fogF);
      alpha = mix(alpha, 1.0, fogF);
      gl_FragColor = vec4(col, alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;

  // Altura de las olas del mar en (x, z): replica las ondas del sombreador del agua
  W.waveHeight = function (x, z) {
    const t = W.waterMats.length ? W.waterMats[0].uniforms.uTime.value : 0;
    let h = 0;
    const w = (dx, dz, f, a, s) => { const l = Math.hypot(dx, dz); h += a * Math.sin((dx / l * x + dz / l * z) * f + t * s); };
    w(1, 0.35, 0.07, 0.45, 0.9); w(-0.5, 1, 0.11, 0.25, 1.25); w(0.8, -0.7, 0.23, 0.09, 1.9); w(-0.9, -0.3, 0.41, 0.045, 2.6);
    return h * W.waveAmp * U.smooth(0, 5, -G.height(x, z));
  };
  W.waveAmp = 1;

  // Textura con la profundidad de todo el mar (la usan el agua y los lagos para la espuma y el color)
  const DTS = 1536;
  function buildDepthTex() {
    const data = new Uint16Array(DTS * DTS);
    const tex = new THREE.DataTexture(data, DTS, DTS, THREE.RedFormat, THREE.HalfFloatType);
    tex.minFilter = tex.magFilter = THREE.LinearFilter;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    W.depthTex = tex;
    W.refreshDepth();
    return tex;
  }
  // Recalcula la profundidad solo dentro del recuadro de cada isla (el resto es fondo marino)
  W.refreshDepth = function () {
    const tex = W.depthTex, data = tex.image.data, cell = W.WORLD / DTS, half = W.WORLD / 2;
    data.fill(THREE.DataUtils.toHalfFloat(G.Arch.FLOOR));
    for (const isl of G.Arch.islands) {
      const c0 = Math.max(0, Math.floor((isl.x0 + half) / cell)), c1 = Math.min(DTS - 1, Math.ceil((isl.x1 + half) / cell));
      const r0 = Math.max(0, Math.floor((isl.z0 + half) / cell)), r1 = Math.min(DTS - 1, Math.ceil((isl.z1 + half) / cell));
      for (let row = r0; row <= r1; row++) for (let col = c0; col <= c1; col++) {
        data[row * DTS + col] = THREE.DataUtils.toHalfFloat(G.height(-half + (col + 0.5) * cell, -half + (row + 0.5) * cell));
      }
    }
    tex.needsUpdate = true;
  };
  W.makeWater = function (level, amp, shallow, deep, foam) {
    const m = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: W.waterMats.length ? W.waterMats[0].uniforms.uTime.value : 0 }, uAmp: { value: amp }, uLevel: { value: level }, uSize: { value: W.WORLD }, uHeight: { value: W.depthTex },
        uSunDir: { value: new V3(0, 1, 0) }, uSunColor: { value: new THREE.Color() }, uSky: { value: new THREE.Color() },
        uFog: { value: new THREE.Color() }, uFogNear: { value: 100 }, uFogFar: { value: 600 }, uDay: { value: 1 },
        uShallow: { value: new THREE.Color(shallow) }, uDeep: { value: new THREE.Color(deep) }, uFoam: { value: foam },
      },
      vertexShader: waterVS, fragmentShader: waterFS, transparent: true,
    });
    W.waterMats.push(m);
    return m;
  };
  W.dropWater = function (m) { const i = W.waterMats.indexOf(m); if (i > 0) W.waterMats.splice(i, 1); m.dispose(); };

  function buildWater(scene) {
    buildDepthTex();
    const seaGeo = new THREE.PlaneGeometry(1800, 1800, 160, 160);
    seaGeo.rotateX(-Math.PI / 2);
    const sea = new THREE.Mesh(seaGeo, W.makeWater(0, 1, 0x2fd0c0, 0x0a3f6e, 1));
    W.seaMat = sea.material;
    sea.frustumCulled = false;
    scene.add(sea);
    W.sea = sea;
    const lakeGeo = new THREE.CircleGeometry(W.LAKE.r, 64);
    lakeGeo.rotateX(-Math.PI / 2);
    const lake = new THREE.Mesh(lakeGeo, W.makeWater(W.LAKE.level, 0.12, 0x4f9a86, 0x123f3c, 0.35));
    lake.position.set(W.LAKE.x, W.LAKE.level, W.LAKE.z);
    scene.add(lake);
  }

  // ------------------------------------------------------------------ cielo y luces
  function buildSky(scene) {
    const sky = new window.Sky();
    sky.scale.setScalar(4000);
    scene.add(sky);
    W.sky = sky;
    const su = sky.material.uniforms;
    su.turbidity.value = 6; su.rayleigh.value = 1.4; su.mieCoefficient.value = 0.004; su.mieDirectionalG.value = 0.82;

    const sun = new THREE.DirectionalLight(0xffffff, 3);
    sun.castShadow = true;
    const sc = sun.shadow.camera;
    sc.left = -55; sc.right = 55; sc.top = 55; sc.bottom = -55; sc.near = 1; sc.far = 360;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05;
    sun.shadow.camera.layers.enable(1); // el cuerpo del jugador en 1ª persona solo proyecta sombra
    scene.add(sun); scene.add(sun.target);
    W.sun = sun;
    W.hemi = new THREE.HemisphereLight(0xd4e6ff, 0x6b5a3c, 1);
    scene.add(W.hemi);

    // Estrellas
    const sg = new THREE.BufferGeometry(), sp = [];
    const rnd = U.rng(5);
    for (let i = 0; i < 1600; i++) {
      const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, rr = Math.sqrt(1 - u * u);
      const y = Math.abs(u) * 0.95 + 0.05;
      sp.push(Math.cos(a) * rr * 2000, y * 2000, Math.sin(a) * rr * 2000);
    }
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    W.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, depthWrite: false, fog: false }));
    W.stars.frustumCulled = false;
    scene.add(W.stars);

    // Luna
    const moonTex = U.canvasTex(128, 128, (c) => {
      const g = c.createRadialGradient(64, 64, 10, 64, 64, 64);
      g.addColorStop(0, 'rgba(255,255,245,1)'); g.addColorStop(0.35, 'rgba(240,240,230,1)');
      g.addColorStop(0.42, 'rgba(200,210,255,0.25)'); g.addColorStop(1, 'rgba(200,210,255,0)');
      c.fillStyle = g; c.fillRect(0, 0, 128, 128);
      c.fillStyle = 'rgba(160,160,150,0.35)';
      [[52, 55, 7], [72, 70, 9], [66, 48, 5]].forEach(([x, y, r]) => { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); });
    });
    W.moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex, transparent: true, fog: false, depthWrite: false }));
    W.moon.scale.setScalar(160);
    scene.add(W.moon);

    // Nubes (se mueven con la cámara en un toro alrededor de ella)
    const cloudTex = U.canvasTex(256, 128, (c) => {
      for (let i = 0; i < 22; i++) {
        const x = 40 + Math.random() * 176, y = 50 + Math.random() * 40, r = 18 + Math.random() * 30;
        const g = c.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(255,255,255,0.85)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = g; c.fillRect(0, 0, 256, 128);
      }
    });
    W.cloudMat = new THREE.SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false, opacity: 0.85 });
    W.clouds = [];
    for (let i = 0; i < 38; i++) {
      const s = new THREE.Sprite(W.cloudMat);
      const a = rnd() * Math.PI * 2, d = 80 + rnd() * 650;
      s.position.set(Math.cos(a) * d, 130 + rnd() * 90, Math.sin(a) * d);
      s.scale.set(160 + rnd() * 160, 60 + rnd() * 50, 1);
      scene.add(s); W.clouds.push(s);
    }
    scene.fog = new THREE.Fog(0xb7cde0, 120, 680);
  }

  // ------------------------------------------------------------------ hierba
  // Las matas se guardan por celdas (cada celda pertenece a una isla) y solo se dibujan las cercanas a la cámara
  const GCELL = 16;
  W.grassCells = new Map();
  W.addGrass = function (isl, count, rnd, test) {
    const tmp = new Map();
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new V3(), p = new V3(), e = new THREE.Euler();
    let n = 0, tries = 0;
    while (n < count && tries < count * 8) {
      tries++;
      const x = isl.x + (rnd() * 2 - 1) * isl.ext * 0.9, z = isl.z + (rnd() * 2 - 1) * isl.ext * 0.9;
      const h = G.height(x, z);
      if (!test(x, z, h)) continue;
      if (W.inLakeWater(x, z) || W.lakeAt(x, z)) continue;
      if (W.slope(x, z) < 0.86) continue;
      const sc = 0.75 + rnd() * 0.45;
      m.compose(p.set(x, h - 0.03, z), q.setFromEuler(e.set(0, rnd() * 6.28, 0)), s.set(sc, sc * (0.6 + rnd() * 0.5), sc));
      const key = Math.floor(x / GCELL) + ',' + Math.floor(z / GCELL);
      let c = tmp.get(key);
      if (!c) tmp.set(key, (c = []));
      c.push(...m.elements);
      n++;
    }
    for (const [key, arr] of tmp) W.grassCells.set(key, { arr: new Float32Array(arr), isl: isl.id });
    W.grassData.cx = 1e9;
  };
  W.clearGrass = function (keepBase) {
    for (const [key, c] of W.grassCells) if (!keepBase || c.isl !== 0) W.grassCells.delete(key);
    if (W.grassData) W.grassData.cx = 1e9;
  };
  function buildGrass(scene) {
    const pos = [], col = [], nor = [];
    const rnd = U.rng(77);
    const dark = new THREE.Color(0x3a5e1a), light = new THREE.Color(0x9dbd4f);
    for (let b = 0; b < 7; b++) {
      const a = rnd() * Math.PI, ox = (rnd() - 0.5) * 0.45, oz = (rnd() - 0.5) * 0.45;
      const h = 0.45 + rnd() * 0.45, w = 0.045, lx = (rnd() - 0.5) * 0.3, lz = (rnd() - 0.5) * 0.3;
      const cx = Math.cos(a) * w, cz = Math.sin(a) * w;
      // Cada hoja se añade con ambas orientaciones para que nunca se vea negra por detrás
      pos.push(ox - cx, 0, oz - cz, ox + cx, 0, oz + cz, ox + lx, h, oz + lz);
      pos.push(ox + cx, 0, oz + cz, ox - cx, 0, oz - cz, ox + lx, h, oz + lz);
      const tip = dark.clone().lerp(light, 0.6 + rnd() * 0.4);
      for (let k = 0; k < 2; k++) col.push(dark.r, dark.g, dark.b, dark.r, dark.g, dark.b, tip.r, tip.g, tip.b);
      for (let k = 0; k < 6; k++) nor.push(0, 1, 0);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = W.grassTime;
      sh.uniforms.uGrassR = W.grassR;
      sh.vertexShader = 'uniform float uTime;\nuniform float uGrassR;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 ip = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float sw = sin(uTime * 1.7 + ip.x * 0.35 + ip.z * 0.25) * 0.12 + sin(uTime * 3.1 + ip.x * 0.9) * 0.04;
        transformed.x += sw * position.y; transformed.z += sw * 0.6 * position.y;
        float gEnd = uGrassR - 6.0;
        transformed *= 1.0 - smoothstep(gEnd * 0.7, gEnd, distance(ip.xz, cameraPosition.xz));`);
    };
    const CAP = 16000;
    const mesh = new THREE.InstancedMesh(geo, mat, CAP);
    mesh.count = 0;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    scene.add(mesh);
    W.grass = mesh;
    W.grassData = { CAP, cx: 1e9, cz: 1e9 };
    W.addGrass(G.Arch.islands[0], 70000, rnd, (x, z, h) =>
      h >= 2.8 && h <= 17 && nB(x * 0.03, z * 0.03) >= -0.35 && Math.hypot(x - W.CAVE.x, z - W.CAVE.z) >= W.CAVE.r + 1);
  }

  // Rellena la hierba alrededor de la cámara cuando esta se desplaza unos metros
  W.updateGrass = function (cam, force) {
    const gd = W.grassData, R = W.grassR.value;
    if (!force && Math.hypot(cam.x - gd.cx, cam.z - gd.cz) < 5) return;
    gd.cx = cam.x; gd.cz = cam.z;
    const out = W.grass.instanceMatrix.array, R2 = R * R;
    const c0 = Math.floor((cam.x - R) / GCELL), c1 = Math.floor((cam.x + R) / GCELL);
    const d0 = Math.floor((cam.z - R) / GCELL), d1 = Math.floor((cam.z + R) / GCELL);
    let n = 0;
    for (let cx = c0; cx <= c1; cx++) for (let cz = d0; cz <= d1; cz++) {
      const c = W.grassCells.get(cx + ',' + cz);
      if (!c) continue;
      const a = c.arr;
      for (let o = 0; o < a.length && n < gd.CAP; o += 16) {
        const dx = a[o + 12] - cam.x, dz = a[o + 14] - cam.z;
        if (dx * dx + dz * dz > R2) continue;
        out.set(a.subarray(o, o + 16), n * 16);
        n++;
      }
    }
    W.grass.count = n;
    W.grass.instanceMatrix.clearUpdateRanges();
    W.grass.instanceMatrix.addUpdateRange(0, Math.max(16, n * 16));
    W.grass.instanceMatrix.needsUpdate = true;
  };

  // Niveles de calidad gráfica
  W.QUALITY = {
    low: { name: 'Baja', ratio: 0.75, shadow: 1024, soft: false, grass: 28, lod: 60, clouds: 10 },
    med: { name: 'Media', ratio: 1.0, shadow: 1024, soft: false, grass: 42, lod: 85, clouds: 22 },
    high: { name: 'Alta', ratio: 1.5, shadow: 2048, soft: true, grass: 56, lod: 115, clouds: 38 },
  };
  W.setQuality = function (q) {
    const Q = W.QUALITY[q] || W.QUALITY.med;
    W.grassR.value = Q.grass;
    G.Res.lodDist.value = Q.lod;
    W.clouds.forEach((c, i) => (c.visible = i < Q.clouds));
    if (W.sun.shadow.mapSize.x !== Q.shadow) {
      W.sun.shadow.mapSize.set(Q.shadow, Q.shadow);
      if (W.sun.shadow.map) { W.sun.shadow.map.dispose(); W.sun.shadow.map = null; }
    }
    if (W.grassData) W.updateGrass(G.camera.position, true);
  };

  // ------------------------------------------------------------------ mapa de una isla (imagen base)
  W.renderIslandMap = function (isl, S) {
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const ctx = c.getContext('2d'), img = ctx.createImageData(S, S), R = isl.ext;
    const pal = G.Arch.mapPalette(isl.type);
    for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
      const x = isl.x - R + (px + 0.5) * 2 * R / S, z = isl.z - R + (py + 0.5) * 2 * R / S;
      const h = G.height(x, z);
      let r, g, b;
      const lake = W.inLakeWater(x, z), L = lake ? W.lakeAt(x, z) : null;
      if (lake) { if (L.kind === 'hot') { r = 110; g = 170; b = 175; } else { r = 60; g = 140; b = 130; } }
      else if (h < 0) { const t = U.clamp(-h / 10, 0, 1); r = U.lerp(70, 20, t); g = U.lerp(190, 70, t); b = U.lerp(190, 130, t); }
      else if (h < 2.4) [r, g, b] = pal.sand;
      else if (h < pal.hi) { const t = U.clamp((h - 2.4) / (pal.hi - 2.4), 0, 1); r = U.lerp(pal.lo1[0], pal.lo2[0], t); g = U.lerp(pal.lo1[1], pal.lo2[1], t); b = U.lerp(pal.lo1[2], pal.lo2[2], t); }
      else { const t = U.clamp((h - pal.hi) / 15, 0, 1); r = U.lerp(pal.rock1[0], pal.rock2[0], t); g = U.lerp(pal.rock1[1], pal.rock2[1], t); b = U.lerp(pal.rock1[2], pal.rock2[2], t); }
      if (h >= 0 && !lake) {
        const shade = U.clamp(1 + (G.height(x - 2, z - 2) - h) * 0.12, 0.7, 1.25);
        r *= shade; g *= shade; b *= shade;
      }
      const i = (py * S + px) * 4;
      img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = h < -9 ? 0 : 255;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  };

  // ------------------------------------------------------------------ actualización por fotograma
  const cDayFog = new THREE.Color(0xb7cde0), cSetFog = new THREE.Color(0xd9a37e), cNightFog = new THREE.Color(0x0b1424);
  const cDaySky = new THREE.Color(0x9cc3e6), cSetSky = new THREE.Color(0xe6a47e), cNightSky = new THREE.Color(0x0c1528);
  const cSunHi = new THREE.Color(0xfff1dc), cSunLo = new THREE.Color(0xff9a50), cMoon = new THREE.Color(0x9bb2ff);
  const cHemiDay = new THREE.Color(0xd4e6ff), cHemiNight = new THREE.Color(0x3a4c80), cGndDay = new THREE.Color(0x6b5a3c), cGndNight = new THREE.Color(0x141824);
  const cCloudDay = new THREE.Color(0xffffff), cCloudSet = new THREE.Color(0xffb890), cCloudNight = new THREE.Color(0x2a3040);
  const cMist = new THREE.Color(0xc4ccd2), cUnder = new THREE.Color(0x0e4a5e);
  const tmpC = new THREE.Color();
  W.sunDir = new V3(); W.lightDir = new V3(); W.skyColor = new THREE.Color();
  W.day = 1; W.night = 0; W.exposure = 0.5; W.mist = 0; W.underwater = false;

  W.update = function (dt, t, camera, focus) {
    const ang = (t - 0.25) * Math.PI * 2;
    const s = W.sunDir.set(Math.cos(ang), Math.sin(ang), 0.28).normalize();
    const y = s.y;
    const day = (W.day = U.smooth(-0.12, 0.2, y));
    W.night = 1 - day;
    const dusk = U.smooth(0.4, 0.02, y) * U.smooth(-0.2, 0.0, y);
    const su = W.sky.material.uniforms;
    su.sunPosition.value.copy(s);
    su.rayleigh.value = 1.2 + dusk * 1.8;
    su.turbidity.value = 5 + dusk * 5;

    const L = W.sun;
    if (y > 0) { W.lightDir.copy(s); L.color.lerpColors(cSunLo, cSunHi, U.smooth(0.0, 0.4, y)); L.intensity = 3.0 * U.smooth(0.0, 0.12, y); }
    else { W.lightDir.copy(s).negate(); L.color.copy(cMoon); L.intensity = 0.6 * U.smooth(0.0, 0.12, -y); }
    const fx = Math.round(focus.x), fz = Math.round(focus.z);
    L.position.set(fx, focus.y, fz).addScaledVector(W.lightDir, 150);
    L.target.position.set(fx, focus.y, fz);
    L.target.updateMatrixWorld();
    W.hemi.intensity = 0.45 + 0.9 * day;
    W.hemi.color.lerpColors(cHemiNight, cHemiDay, day);
    W.hemi.groundColor.lerpColors(cGndNight, cGndDay, day);

    const fog = G.scene.fog;
    tmpC.lerpColors(cSetFog, cDayFog, U.smooth(0.05, 0.4, y));
    fog.color.lerpColors(cNightFog, tmpC, day);
    fog.near = U.lerp(30, 120, day); fog.far = U.lerp(260, 680, day);
    tmpC.lerpColors(cSetSky, cDaySky, U.smooth(0.05, 0.4, y));
    W.skyColor.lerpColors(cNightSky, tmpC, day);
    // Tinte del bioma (bruma blanca en la nieve, calima rojiza en el volcán)
    const tint = G.Arch.fogTint(camera.position.x, camera.position.z);
    if (tint) {
      fog.color.lerp(tmpC.set(tint.color).multiplyScalar(0.25 + 0.75 * day), tint.k);
      fog.far *= 1 - tint.k * 0.35; fog.near *= 1 - tint.k * 0.4;
    }
    // Clima: nubes cerradas, niebla gris y relámpagos
    const wi = G.Weather ? G.Weather.intensity : 0, flash = G.Weather ? G.Weather.flash : 0;
    if (wi > 0.001 || flash > 0) {
      tmpC.setRGB(0.32, 0.36, 0.4).multiplyScalar(0.25 + 0.75 * day);
      fog.color.lerp(tmpC, wi * 0.75);
      W.skyColor.lerp(tmpC, wi * 0.7);
      fog.near *= 1 - 0.6 * wi; fog.far *= 1 - 0.55 * wi;
      L.intensity *= 1 - 0.78 * wi;
      W.hemi.intensity = W.hemi.intensity * (1 - 0.3 * wi) + flash * 4;
      su.turbidity.value += wi * 12; su.rayleigh.value += wi * 2;
      if (flash > 0) fog.color.lerp(tmpC.setRGB(0.8, 0.85, 1), flash * 0.6);
    }
    // Niebla marina espesa: oculta el cambio de hora al llegar a una isla con otro horario
    const mist = W.mist;
    if (mist > 0.001) {
      tmpC.copy(cMist).multiplyScalar(0.18 + 0.82 * day);
      fog.color.lerp(tmpC, mist);
      W.skyColor.lerp(tmpC, mist);
      fog.near = U.lerp(fog.near, 2, mist); fog.far = U.lerp(fog.far, 38, mist);
    }
    // Bajo el agua todo se vuelve azul y cercano
    W.underwater = camera.position.y < W.waterLevelAt(camera.position.x, camera.position.z) + W.waveHeight(camera.position.x, camera.position.z) - 0.05 && G.height(camera.position.x, camera.position.z) < camera.position.y;
    if (W.underwater) {
      fog.color.copy(cUnder).multiplyScalar(0.25 + 0.75 * day);
      fog.near = 0; fog.far = 34;
    }

    for (const m of W.waterMats) {
      const u = m.uniforms;
      u.uTime.value += dt;
      u.uSunDir.value.copy(W.lightDir);
      u.uSunColor.value.copy(L.color).multiplyScalar(y > 0 ? U.smooth(0.0, 0.1, y) : 0.25 * U.smooth(0.0, 0.1, -y));
      u.uSky.value.copy(W.skyColor);
      u.uFog.value.copy(fog.color);
      u.uFogNear.value = fog.near; u.uFogFar.value = fog.far;
      u.uDay.value = 0.12 + 0.88 * day;
    }
    // El mar sigue a la cámara (ajustado a su rejilla para que las olas no "patinen")
    const st = 1800 / 160;
    W.sea.position.set(Math.round(camera.position.x / st) * st, 0, Math.round(camera.position.z / st) * st);
    W.grassTime.value += dt;

    W.stars.position.copy(camera.position);
    W.stars.material.opacity = U.clamp(1 - day * 1.4, 0, 1) * (1 - mist);
    W.stars.visible = W.stars.material.opacity > 0.01;
    W.moon.position.copy(camera.position).addScaledVector(s, -1500);
    W.moon.material.opacity = U.clamp(1 - day * 1.2, 0, 1) * (1 - mist);
    W.moon.visible = s.y < 0.15 && mist < 0.95;

    tmpC.lerpColors(cCloudSet, cCloudDay, U.smooth(0.05, 0.35, y));
    W.cloudMat.color.lerpColors(cCloudNight, tmpC, day);
    W.cloudMat.color.multiplyScalar(1 - 0.55 * wi);
    W.cloudMat.opacity = Math.min(1, 0.55 + 0.3 * day + wi * 0.4);
    const cx = camera.position.x, cz = camera.position.z;
    for (const c of W.clouds) {
      c.position.x += dt * 2.5;
      if (c.position.x > cx + 750) c.position.x -= 1500; else if (c.position.x < cx - 750) c.position.x += 1500;
      if (c.position.z > cz + 750) c.position.z -= 1500; else if (c.position.z < cz - 750) c.position.z += 1500;
    }
    W.exposure = U.lerp(0.62, 0.5, day) * (1 - 0.2 * wi) + flash * 0.4;
  };
})();
