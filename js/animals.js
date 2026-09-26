// Modelos 3D de los animales: cuerpos orgánicos con silueta real (hocicos, orejas, patas articuladas,
// colas, aletas, ojos). Cada función devuelve { g, legs, head, headZ, tail, ... } para la animación.
(function () {
  'use strict';
  const G = window.G, U = G.U, M = G.Mdl, T = M.table;
  const Col = THREE.Color;
  const Anim = (G.Animals = {});

  // Degradado por sección: lomo → costado → vientre
  function grad(top, side, bot, k = 0.3) {
    const a = new Col(top), b = new Col(side), c = new Col(bot), o = new Col();
    return (t, ang, ca, sa) => (sa >= 0 ? o.lerpColors(b, a, U.smooth(k, 1, sa)) : o.lerpColors(b, c, U.smooth(k, 1, -sa)));
  }
  const tb = (rx, ry, y, pw) => (t) => ({ rx: T(rx, t), ry: T(ry, t), y: typeof y === 'number' ? y : T(y, t), pw });
  function mk(parts, mat, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(U.merge(parts.flat()), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    return m;
  }
  function piv(x, y, z, child) { const g = new THREE.Group(); g.position.set(x, y, z); g.add(child); return g; }
  // Manchas con ruido (rosetas del jaguar, pintas de la foca, puntos de la rana)
  function spots(geo, dark, seed, freq, thr) {
    const n = U.makeNoise(seed), p = geo.attributes.position, c = geo.attributes.color, d = new Col(dark);
    for (let i = 0; i < p.count; i += 3) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      if (n(x * freq + y * 3, z * freq - y * 2) > thr) for (let k = 0; k < 3; k++) c.setXYZ(i + k, d.r, d.g, d.b);
    }
    return geo;
  }
  // Refleja un contorno 2D en X manteniendo el sentido de giro
  const mirror = (pts) => pts.map(([x, y]) => [-x, y]).reverse();
  // Aleta vertical (en el plano YZ, contorno con x = hacia atrás)
  const vFin = (pts, th, color, x, y, z) => M.xf(M.fin(pts, th, color), x, y, z, 0, Math.PI / 2, 0);
  // Aleta horizontal (en el plano XZ, contorno con x = hacia fuera e y = hacia delante)
  const hFin = (pts, th, color, x, y, z, tilt = 0) => M.xf(M.fin(pts, th, color), x, y, z, Math.PI / 2, 0, tilt);

  // ------------------------------------------------------------------ jabalí
  Anim.boar = function (mat, big) {
    const g = new THREE.Group();
    const col = big ? 0x33241b : 0x4e3626, dark = big ? 0x1c130e : 0x2c1e15, light = big ? 0x4a3628 : 0x6e5038;
    const bp = tb([[0, 0.1], [0.1, 0.28], [0.35, 0.35], [0.65, 0.37], [0.85, 0.33], [1, 0.2]], [[0, 0.1], [0.1, 0.27], [0.35, 0.32], [0.65, 0.36], [0.85, 0.38], [1, 0.24]], [[0, 0.74], [0.4, 0.72], [0.8, 0.8], [1, 0.8]]);
    const parts = [M.loft({ z0: -0.68, z1: 0.56, n: 22, m: 16, prof: bp, color: grad(dark, col, light) })];
    for (let i = 0; i < 16; i++) {
      const t = 0.3 + i * 0.043, p = bp(t), z = U.lerp(-0.68, 0.56, t);
      parts.push(M.xf(M.paint(new THREE.ConeGeometry(0.035, 0.12 + Math.sin(t * Math.PI) * 0.08, 4), dark), 0, p.y + p.ry - 0.02, z, -0.5));
    }
    parts.push(M.tube([[0, 0.8, -0.66], [0, 0.72, -0.76], [0, 0.6, -0.74]], [0.025, 0.012], 5, dark), M.ball(0.035, dark, 0, 0.58, -0.74));
    g.add(mk(parts, mat));
    const hp = [M.loft({ z0: -0.08, z1: 0.46, n: 14, m: 14, prof: tb([[0, 0.19], [0.35, 0.16], [0.8, 0.1], [1, 0.085]], [[0, 0.22], [0.35, 0.17], [0.8, 0.1], [1, 0.08]], [[0, 0.02], [1, -0.12]]), color: grad(dark, col, light) })];
    hp.push(M.xf(M.paint(new THREE.CylinderGeometry(0.085, 0.09, 0.05, 14), 0x7a5048), 0, -0.12, 0.47, Math.PI / 2));
    for (const s of [-1, 1]) {
      hp.push(M.ball(0.018, 0x1a0e0a, s * 0.03, -0.12, 0.5));
      hp.push(M.ear(0.07, 0.17, col, 0x7a5a4a, s * 0.12, 0.21, -0.02, -0.35, 0, s * -0.4));
      hp.push(...M.eye(0.026, s * 0.13, 0.07, 0.17, big ? 0x9a1010 : 0x120a06));
      hp.push(M.tube([[s * 0.07, -0.13, 0.36], [s * 0.11, -0.1, 0.44], [s * 0.12, 0.0, 0.47]], [big ? 0.032 : 0.02, 0.006], 6, 0xeee6d0));
    }
    const head = mk(hp, mat, 0, 0.74, 0.56);
    g.add(head);
    const legs = [[-0.17, 0.36], [0.17, 0.36], [-0.17, -0.44], [0.17, -0.44]].map(([x, z]) =>
      piv(x, 0.55, z, mk(M.leg([0, 0, 0], [0, -0.2, z > 0 ? 0.03 : -0.04], [0, -0.38, -0.01], [0, -0.52, 0.02], 0.085, 0.035, col, 0x1a120d), mat)));
    legs.forEach((l) => g.add(l));
    if (big) g.scale.setScalar(1.9);
    return { g, legs, head, headZ: 0.56 };
  };

  // ------------------------------------------------------------------ lobo (y lobo de las nieves)
  Anim.wolf = function (mat, col = 0x6f6b66, light = 0xa8a298, back = 0x4a4744) {
    const g = new THREE.Group();
    const parts = [M.loft({ z0: -0.62, z1: 0.52, n: 22, m: 14, prof: tb([[0, 0.1], [0.12, 0.19], [0.45, 0.17], [0.72, 0.23], [0.9, 0.2], [1, 0.14]], [[0, 0.11], [0.12, 0.21], [0.45, 0.18], [0.72, 0.29], [0.9, 0.26], [1, 0.16]], [[0, 0.9], [0.45, 0.94], [0.72, 0.86], [1, 0.92]]), color: grad(back, col, light) })];
    parts.push(M.tube([[0, 0.93, 0.42], [0, 1.02, 0.6], [0, 1.08, 0.7]], [0.16, 0.12], 10, col));
    parts.push(M.xf(M.loft({ z0: -0.12, z1: 0.12, n: 6, m: 12, prof: () => ({ rx: 0.2, ry: 0.23, y: 0 }), color: () => light }), 0, 0.93, 0.5));
    g.add(mk(parts, mat));
    const hp = [M.loft({ z0: -0.12, z1: 0.38, n: 14, m: 12, prof: tb([[0, 0.12], [0.3, 0.13], [0.55, 0.085], [1, 0.042]], [[0, 0.13], [0.3, 0.12], [0.55, 0.072], [1, 0.038]], [[0, 0.02], [0.5, -0.02], [1, -0.05]]), color: grad(back, col, light, 0.2) })];
    hp.push(M.ball(0.032, 0x111111, 0, -0.045, 0.39, [1, 0.8, 1]));
    for (const s of [-1, 1]) hp.push(M.ear(0.055, 0.16, col, 0x3a2a26, s * 0.075, 0.15, -0.04, 0.15, 0, s * -0.15));
    const head = mk(hp, mat, 0, 1.08, 0.72);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffd040, roughness: 0.2, emissive: 0x000000 });
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), eyeMat); e.position.set(s * 0.07, 0.05, 0.14); head.add(e); }
    g.add(head);
    const legs = [[-0.11, 0.38, 1], [0.11, 0.38, 1], [-0.11, -0.42, 0], [0.11, -0.42, 0]].map(([x, z, f]) =>
      piv(x, 0.78, z, mk(M.leg([0, 0, 0], [0, -0.26, f ? 0.03 : -0.1], [0, -0.52, f ? -0.04 : 0.02], [0, -0.74, 0.02], 0.062, 0.028, col, back), mat)));
    legs.forEach((l) => g.add(l));
    const tail = piv(0, 0.95, -0.58, mk([M.tube([[0, 0, 0], [0, -0.1, -0.2], [0, -0.33, -0.32], [0, -0.45, -0.35]], (t) => 0.035 + Math.sin(Math.PI * Math.min(1, t * 1.05)) * 0.075, 8, (t) => (t > 0.85 ? light : col))], mat));
    g.add(tail);
    return { g, legs, head, headZ: 0.72, tail, eyeMat };
  };

  // ------------------------------------------------------------------ jaguar
  Anim.jaguar = function (mat) {
    const g = new THREE.Group(), col = 0xc9922e, bel = 0xeedcb4, spot = 0x2a1a0e, sw = grad(0xb88024, col, bel, 0.1);
    const body = mk([spots(M.loft({ z0: -0.72, z1: 0.62, n: 24, m: 16, prof: tb([[0, 0.1], [0.12, 0.21], [0.45, 0.19], [0.72, 0.23], [0.9, 0.2], [1, 0.13]], [[0, 0.12], [0.12, 0.22], [0.45, 0.2], [0.72, 0.26], [0.9, 0.24], [1, 0.15]], [[0, 0.76], [0.45, 0.75], [0.8, 0.74], [1, 0.82]]), color: sw }), spot, 9, 9, 0.35)], mat);
    g.add(body);
    const hp = [spots(M.loft({ z0: -0.13, z1: 0.24, n: 12, m: 14, prof: tb([[0, 0.13], [0.4, 0.15], [0.75, 0.12], [1, 0.07]], [[0, 0.13], [0.4, 0.14], [0.75, 0.1], [1, 0.06]], [[0, 0.02], [1, -0.04]]), color: grad(0xb88024, col, bel, 0.0) }), spot, 4, 14, 0.45)];
    hp.push(M.ball(0.03, 0xb86a60, 0, -0.03, 0.25, [1.2, 0.8, 1]));
    for (const s of [-1, 1]) {
      hp.push(M.ear(0.05, 0.08, col, 0x2a1a0e, s * 0.1, 0.13, -0.04, 0, 0, s * -0.3));
      hp.push(...M.eye(0.024, s * 0.075, 0.05, 0.16, 0x7a8a20, 0xe8e0a0));
    }
    const head = mk(hp, mat, 0, 0.9, 0.78);
    g.add(head);
    const legs = [[-0.13, 0.45, 1], [0.13, 0.45, 1], [-0.13, -0.5, 0], [0.13, -0.5, 0]].map(([x, z, f]) =>
      piv(x, f ? 0.62 : 0.66, z, mk([spots(M.leg([0, 0, 0], [0, -0.2, f ? 0.03 : -0.1], [0, -0.42, f ? -0.03 : 0.03], [0, f ? -0.6 : -0.64, 0.03], 0.075, 0.04, col)[0], spot, 5, 12, 0.4), M.ball(0.055, col, 0, f ? -0.6 : -0.64, 0.06, [1, 0.55, 1.3])], mat)));
    legs.forEach((l) => g.add(l));
    const tail = piv(0, 0.8, -0.7, mk([spots(M.tube([[0, 0, 0], [0, -0.18, -0.25], [0, -0.32, -0.45], [0, -0.26, -0.65]], [0.045, 0.03], 7, (t) => (t > 0.9 ? spot : col)), spot, 5, 10, 0.3)], mat));
    g.add(tail);
    return { g, legs, head, headZ: 0.78, tail, body };
  };

  // ------------------------------------------------------------------ cangrejo (y cangrejo de lava)
  Anim.crab = function (mat, col = 0xd2552a, dark = 0x8a3018, lava) {
    const g = new THREE.Group();
    const shell = M.loft({ z0: -0.16, z1: 0.17, n: 10, m: 16, prof: tb([[0, 0.12], [0.3, 0.25], [0.7, 0.27], [1, 0.15]], [[0, 0.05], [0.4, 0.1], [1, 0.06]], 0.2, 2.4), color: grad(col, col, 0xe8b090, 0.2) });
    const bp = [shell];
    for (let i = 0; i < 5; i++) bp.push(M.xf(M.paint(new THREE.ConeGeometry(0.02, 0.06, 4), col), -0.16 + i * 0.08, 0.22, 0.17, Math.PI / 2 - 0.3));
    for (const s of [-1, 1]) {
      bp.push(M.tube([[s * 0.05, 0.25, 0.13], [s * 0.06, 0.32, 0.15]], [0.012, 0.01], 5, col), M.ball(0.024, 0x111111, s * 0.06, 0.34, 0.15));
      // Pinza: brazo + palma + dedo móvil
      bp.push(M.tube([[s * 0.22, 0.2, 0.1], [s * 0.3, 0.23, 0.2], [s * 0.3, 0.24, 0.28]], [0.028, 0.022], 6, col));
      bp.push(M.xf(M.loft({ z0: 0, z1: 0.16, n: 6, m: 10, prof: tb([[0, 0.045], [0.5, 0.06], [1, 0.03]], [[0, 0.035], [0.5, 0.045], [1, 0.02]], 0), color: () => col }), s * 0.3, 0.24, 0.27));
      bp.push(M.xf(M.paint(new THREE.ConeGeometry(0.018, 0.1, 5), dark), s * 0.28, 0.27, 0.46, Math.PI / 2 - 0.15));
      bp.push(M.xf(M.paint(new THREE.ConeGeometry(0.015, 0.08, 5), dark), s * 0.32, 0.21, 0.45, Math.PI / 2 + 0.25));
    }
    if (lava) {
      for (let i = 0; i < 6; i++) bp.push(M.xf(M.paint(new THREE.ConeGeometry(0.025, 0.09, 4), 0x1a1210), Math.cos(i * 1.05) * 0.15, 0.28, Math.sin(i * 1.05) * 0.08));
      for (let i = 0; i < 9; i++) bp.push(M.ball(0.018, 0xff8a20, Math.cos(i * 2.4) * 0.18, 0.27, Math.sin(i * 2.4) * 0.1));
    }
    g.add(mk(bp, mat));
    const legs = [-1, 1].map((s) => piv(s * 0.2, 0.2, 0, mk([0, 1, 2].map((k) =>
      M.tube([[0, 0, -0.08 + k * 0.08], [s * 0.16, 0.08, -0.1 + k * 0.08], [s * 0.3, -0.15, -0.12 + k * 0.09]], [0.018, 0.009], 5, dark, 8)), mat)));
    legs.forEach((l) => g.add(l));
    if (lava) { g.scale.setScalar(1.8); mat.emissive = new Col(0x401000); }
    return { g, legs, head: null };
  };

  // ------------------------------------------------------------------ serpientes (cuerpo con ondulación en el sombreador)
  function tubeBody(len, rad, colorA, colorB, colorD, seed) {
    const body = new THREE.CylinderGeometry(1, 1, len, 10, Math.round(len * 18), false);
    body.rotateX(Math.PI / 2);
    const p = body.attributes.position, half = len / 2;
    for (let i = 0; i < p.count; i++) {
      const z = p.getZ(i), t = (z + half) / len; // 0 cola → 1 cabeza
      const r = rad * Math.sin(Math.min(1, t * 1.15) * Math.PI * 0.5 + 0.1) * (t > 0.92 ? 1.15 : 1);
      p.setXYZ(i, p.getX(i) * r, p.getY(i) * r * 0.85 + rad, z);
    }
    body.computeVertexNormals();
    const geo = M.paint(body, colorA, 0.02);
    const c = geo.attributes.color, q = geo.attributes.position, band = new Col(colorB), dk = new Col(colorD), bellyC = new Col(colorB).lerp(new Col(0xffffff), 0.3);
    for (let i = 0; i < q.count; i++) {
      const z = q.getZ(i) / len * 1.7, x = q.getX(i) / rad * 0.055, y = q.getY(i);
      const f = Math.sin(z * 22 + seed) + Math.sin(z * 11 + x * 30) * 0.5;
      if (y < rad * 0.45) c.setXYZ(i, bellyC.r, bellyC.g, bellyC.b);
      else if (f > 1.0) c.setXYZ(i, band.r, band.g, band.b);
      else if (f < -1.1) c.setXYZ(i, dk.r, dk.g, dk.b);
    }
    return geo;
  }
  function waveMat(mat, len, key, vertical) {
    const u = { uTime: { value: Math.random() * 10 }, uAmp: { value: 0.03 } };
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = u.uTime; sh.uniforms.uAmp = u.uAmp;
      sh.vertexShader = 'uniform float uTime;\nuniform float uAmp;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        float k = clamp((${(len / 2).toFixed(2)} - position.z) / ${len.toFixed(2)}, 0.0, 1.0);
        float wv = sin(position.z * ${(7 / len * 1.7).toFixed(3)} - uTime * 6.0) * uAmp * (0.3 + k);
        ${vertical ? 'transformed.y += wv; transformed.x += wv * 0.25;' : 'transformed.x += wv;'}`);
    };
    mat.customProgramCacheKey = () => key;
    return u;
  }
  Anim.snake = function (mat) {
    const g = new THREE.Group();
    const parts = [tubeBody(1.7, 0.055, 0x5a7a2a, 0xd8b43a, 0x1e2a10, 0)];
    // Cabeza triangular, ojos y lengua bífida
    parts.push(M.loft({ z0: 0.76, z1: 0.96, n: 8, m: 10, prof: tb([[0, 0.055], [0.5, 0.072], [1, 0.028]], [[0, 0.05], [0.5, 0.042], [1, 0.022]], [[0, 0.1], [1, 0.085]], 2.4), color: grad(0x3e5a1c, 0x5a7a2a, 0xc8b060, 0.2) }));
    for (const s of [-1, 1]) {
      parts.push(M.ball(0.014, 0xd8c020, s * 0.045, 0.115, 0.87), M.ball(0.008, 0x050505, s * 0.05, 0.117, 0.875));
      parts.push(M.tube([[0, 0.085, 0.95], [0, 0.085, 1.0], [s * 0.012, 0.085, 1.03]], [0.004, 0.002], 4, 0xc01828, 4));
    }
    const m = new THREE.Mesh(U.merge(parts), mat);
    const u = waveMat(mat, 1.7, 'snake');
    m.castShadow = true;
    g.add(m);
    return { g, legs: [], head: null, snakeU: u };
  };
  Anim.serpent = function (mat) {
    const g = new THREE.Group(), len = 14;
    const parts = [tubeBody(len, 0.55, 0x1e5a5a, 0xd8c060, 0x0e2a2e, 3)];
    for (let i = 0; i < 26; i++) {
      const z = -len / 2 + 1 + i * 0.48, t = (z + len / 2) / len, r = 0.55 * Math.sin(Math.min(1, t * 1.15) * Math.PI * 0.5 + 0.1);
      parts.push(M.xf(M.paint(new THREE.ConeGeometry(0.1 + r * 0.15, 0.3 + r * 0.6, 4), 0xd8c060), 0, 0.55 + r * 0.85 + 0.1, z, -0.4));
    }
    g.add(mk(parts, mat));
    const u = waveMat(mat, len, 'serpent', true);
    // Cabeza de dragón marino: cráneo, mandíbula abierta con dientes, cuernos y aletas laterales
    const hc = grad(0x14464a, 0x1e5a5a, 0xc8b060, 0.2);
    const hp = [M.loft({ z0: -0.6, z1: 1.6, n: 14, m: 14, prof: tb([[0, 0.6], [0.3, 0.62], [0.7, 0.42], [1, 0.2]], [[0, 0.52], [0.3, 0.46], [0.7, 0.3], [1, 0.14]], [[0, 0.1], [1, 0.05]]), color: hc })];
    hp.push(M.xf(M.loft({ z0: -0.3, z1: 1.35, n: 10, m: 12, prof: tb([[0, 0.45], [0.6, 0.35], [1, 0.14]], [[0, 0.16], [1, 0.07]], -0.35), color: () => 0xc8b060 }), 0, 0, 0, -0.18));
    for (let i = 0; i < 7; i++) for (const s of [-1, 1]) {
      hp.push(M.xf(M.paint(new THREE.ConeGeometry(0.035, 0.16, 4), 0xf4f0e0), s * (0.34 - i * 0.03), -0.14, 0.3 + i * 0.16, Math.PI));
    }
    for (const s of [-1, 1]) {
      hp.push(M.ball(0.11, 0xffd040, s * 0.42, 0.28, 0.55), M.ball(0.05, 0x201000, s * 0.48, 0.3, 0.6));
      hp.push(M.tube([[s * 0.3, 0.45, -0.1], [s * 0.45, 0.8, -0.6], [s * 0.4, 0.95, -1.2]], [0.1, 0.02], 6, 0xd8c060));
      hp.push(M.xf(M.fin([[0, 0], [0.9, 0.35], [1.1, -0.1], [0.8, -0.5], [0.1, -0.4]], 0.04, 0x2a8a8a), s * 0.55, 0.05, -0.3, 0, s > 0 ? -0.3 : Math.PI + 0.3, 0));
    }
    const head = mk(hp, mat, 0, 0.75, len / 2 + 0.2);
    g.add(head);
    return { g, legs: [], head, headZ: len / 2 + 0.2, snakeU: u };
  };

  // ------------------------------------------------------------------ tiburón
  Anim.shark = function (mat) {
    const g = new THREE.Group(), grey = 0x607080;
    const parts = [M.loft({ z0: -1.5, z1: 1.5, n: 26, m: 16, prof: tb([[0, 0.07], [0.18, 0.17], [0.5, 0.4], [0.72, 0.4], [0.9, 0.26], [1, 0.06]], [[0, 0.1], [0.18, 0.22], [0.5, 0.42], [0.72, 0.39], [0.9, 0.25], [1, 0.07]], [[0, 0.05], [0.5, 0], [1, -0.06]]), color: grad(0x4e5e68, grey, 0xe2e6e4, 0.05) })];
    parts.push(vFin([[0, 0], [0.55, 0], [0.12, 0.62], [-0.08, 0.58]], 0.05, grey, 0, 0.36, 0.2));
    parts.push(vFin([[0, 0], [0.2, 0], [0.06, 0.18]], 0.03, grey, 0, 0.18, -0.9));
    const pect = [[0, 0], [0.65, -0.35], [0.6, -0.5], [0.05, -0.28]];
    parts.push(hFin(pect, 0.04, grey, 0.34, -0.18, 0.45, -0.35), hFin(mirror(pect), 0.04, grey, -0.34, -0.18, 0.45, 0.35));
    for (const s of [-1, 1]) {
      parts.push(M.ball(0.04, 0x050505, s * 0.22, 0.08, 1.12));
      for (let i = 0; i < 5; i++) parts.push(M.xf(M.paint(new THREE.BoxGeometry(0.01, 0.18, 0.02), 0x3a4650), s * 0.3, -0.02, 0.7 + i * 0.06));
    }
    parts.push(M.xf(M.paint(new THREE.TorusGeometry(0.12, 0.012, 4, 10, Math.PI), 0x2a1a1a), 0, -0.2, 1.18, Math.PI / 2 + 0.2));
    g.add(mk(parts, mat));
    const tail = piv(0, 0.03, -1.45, mk([vFin([[0, 0.1], [0.45, 0.82], [0.58, 0.78], [0.22, 0.05], [0.42, -0.42], [0.3, -0.45], [0, -0.08]], 0.04, grey, 0, 0, 0)], mat));
    g.add(tail);
    return { g, legs: [], head: null, tail };
  };

  // ------------------------------------------------------------------ ballena jorobada y delfín
  Anim.whale = function (mat) {
    const g = new THREE.Group(), top = 0x34465a, bot = 0xd4d8dc;
    const body = M.loft({ z0: -5.2, z1: 5.2, n: 30, m: 18, prof: tb([[0, 0.25], [0.12, 0.55], [0.35, 1.25], [0.62, 1.45], [0.82, 1.3], [0.94, 0.9], [1, 0.4]], [[0, 0.35], [0.12, 0.6], [0.35, 1.25], [0.62, 1.4], [0.82, 1.22], [0.94, 0.8], [1, 0.3]], [[0, 0.1], [0.5, 0], [1, -0.2]]), color: grad(0x2a3a4c, top, bot, 0.15) });
    M.recolor(body, (x, y, z) => (y < -0.5 && z > 0.8 && Math.sin(x * 14) > 0.3 ? 0x8a9098 : null)); // pliegues de la garganta
    const parts = [body];
    parts.push(vFin([[0, 0], [0.9, 0], [0.3, 0.45]], 0.12, top, 0, 1.2, -2.4));
    const fl = [[0, 0.2], [0.6, 0.25], [3.2, -0.5], [3.3, -0.8], [0.4, -0.45]];
    parts.push(hFin(fl, 0.12, 0x44566a, 1.25, -0.7, 2.3, -0.45), hFin(mirror(fl), 0.12, 0x44566a, -1.25, -0.7, 2.3, 0.45));
    for (const s of [-1, 1]) parts.push(M.ball(0.09, 0x0a0a0a, s * 1.05, -0.25, 3.9));
    parts.push(M.ball(0.12, 0x10161c, 0, 1.08, 3.3, [1, 0.3, 1.6]));
    g.add(mk(parts, mat));
    const fluke = [[0, -0.4], [0.4, -0.7], [2.0, -1.3], [2.2, -1.1], [1.5, -0.7], [0.3, -0.1], [0, 0], [-0.3, -0.1], [-1.5, -0.7], [-2.2, -1.1], [-2.0, -1.3], [-0.4, -0.7]];
    const tail = piv(0, 0.1, -5.1, mk([hFin(fluke, 0.14, top, 0, 0, 0)], mat));
    g.add(tail);
    return { g, legs: [], head: null, tail };
  };
  Anim.dolphin = function (mat) {
    const g = new THREE.Group(), top = 0x55758e;
    const parts = [M.loft({ z0: -0.95, z1: 1.05, n: 24, m: 14, prof: tb([[0, 0.06], [0.2, 0.14], [0.5, 0.24], [0.75, 0.22], [0.88, 0.15], [0.93, 0.075], [1, 0.035]], [[0, 0.08], [0.2, 0.17], [0.5, 0.27], [0.75, 0.24], [0.88, 0.17], [0.93, 0.065], [1, 0.03]], [[0, 0.02], [0.5, 0], [0.88, 0.02], [0.93, -0.05], [1, -0.06]]), color: grad(0x46647c, 0x8aa4b8, 0xe6eef4, 0.1) })];
    parts.push(vFin([[0, 0], [0.38, 0], [0.34, 0.36], [0.2, 0.32]], 0.03, top, 0, 0.24, -0.02));
    const pf = [[0, 0], [0.3, -0.12], [0.28, -0.2], [0.03, -0.12]];
    parts.push(hFin(pf, 0.025, top, 0.2, -0.12, 0.45, -0.4), hFin(mirror(pf), 0.025, top, -0.2, -0.12, 0.45, 0.4));
    for (const s of [-1, 1]) parts.push(M.ball(0.022, 0x0a0a0a, s * 0.15, 0.03, 0.78));
    g.add(mk(parts, mat));
    const fluke = [[0, -0.1], [0.1, -0.18], [0.5, -0.32], [0.55, -0.26], [0.35, -0.16], [0.08, -0.02], [0, 0], [-0.08, -0.02], [-0.35, -0.16], [-0.55, -0.26], [-0.5, -0.32], [-0.1, -0.18]];
    const tail = piv(0, 0.02, -0.92, mk([hFin(fluke, 0.03, top, 0, 0, 0)], mat));
    g.add(tail);
    return { g, legs: [], head: null, tail };
  };

  // ------------------------------------------------------------------ medusa
  Anim.jelly = function () {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, emissive: 0x802070, emissiveIntensity: 0.7, transparent: true, opacity: 0.62, roughness: 0.2, side: THREE.DoubleSide, depthWrite: false });
    const bell = M.lathe([[0, 0.45], [0.2, 0.43], [0.36, 0.32], [0.46, 0.12], [0.44, 0.0], [0.39, 0.03], [0.3, 0.12], [0.02, 0.18]], 20, (x, y) => (y > 0.3 ? 0xf8c8f0 : 0xe890d8));
    const rim = [];
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; rim.push(M.ball(0.03, 0xffe0ff, Math.cos(a) * 0.43, 0.01, Math.sin(a) * 0.43)); }
    g.add(new THREE.Mesh(U.merge([bell, ...rim]), mat));
    const arms = [];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4, pts = [];
      for (let k = 0; k <= 6; k++) pts.push([Math.cos(a) * 0.08 + Math.sin(k * 1.4 + i) * 0.06, 0.1 - k * 0.16, Math.sin(a) * 0.08 + Math.cos(k * 1.3 + i) * 0.06]);
      arms.push(M.tube(pts, [0.045, 0.015], 6, 0xf0a8e0, 20));
    }
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2, pts = [];
      for (let k = 0; k <= 5; k++) pts.push([Math.cos(a) * (0.4 - k * 0.02), -k * 0.28, Math.sin(a) * (0.4 - k * 0.02) + Math.sin(k + i) * 0.04]);
      arms.push(M.tube(pts, [0.008, 0.003], 4, 0xf8d8f8, 12));
    }
    const tm = new THREE.Mesh(U.merge(arms), mat);
    g.add(tm);
    return { g, legs: [], head: null, tail: tm, mat };
  };

  // ------------------------------------------------------------------ oso blanco
  Anim.bear = function (mat) {
    const g = new THREE.Group(), col = 0xece6d8, sh = grad(0xf6f2e8, col, 0xc8bfae, 0.2);
    const parts = [M.loft({ z0: -0.85, z1: 0.75, n: 24, m: 16, prof: tb([[0, 0.2], [0.15, 0.46], [0.45, 0.5], [0.72, 0.47], [0.9, 0.34], [1, 0.22]], [[0, 0.25], [0.15, 0.48], [0.45, 0.5], [0.72, 0.52], [0.9, 0.38], [1, 0.24]], [[0, 1.0], [0.5, 1.0], [0.8, 1.05], [1, 1.14]]), color: sh })];
    parts.push(M.tube([[0, 1.14, 0.7], [0, 1.2, 0.85], [0, 1.22, 0.95]], [0.25, 0.2], 12, col), M.ball(0.08, col, 0, 1.05, -0.86));
    g.add(mk(parts, mat));
    const hp = [M.loft({ z0: -0.2, z1: 0.36, n: 14, m: 14, prof: tb([[0, 0.19], [0.35, 0.18], [0.7, 0.11], [1, 0.075]], [[0, 0.19], [0.35, 0.16], [0.7, 0.1], [1, 0.07]], [[0, 0.04], [1, -0.06]]), color: sh })];
    hp.push(M.ball(0.045, 0x111111, 0, -0.04, 0.37, [1.3, 0.8, 0.9]));
    hp.push(M.xf(M.paint(new THREE.TorusGeometry(0.05, 0.008, 4, 10, Math.PI), 0x2a2522), 0, -0.1, 0.3, 0, 0, Math.PI));
    for (const s of [-1, 1]) { hp.push(M.ear(0.06, 0.07, col, 0x3a3430, s * 0.13, 0.17, -0.1, 0, 0, s * -0.4)); hp.push(M.ball(0.022, 0x0a0a0a, s * 0.1, 0.07, 0.14)); }
    const head = mk(hp, mat, 0, 1.2, 1.0);
    g.add(head);
    const legs = [[-0.26, 0.45, 1], [0.26, 0.45, 1], [-0.26, -0.5, 0], [0.26, -0.5, 0]].map(([x, z, f]) =>
      piv(x, 0.88, z, mk([...M.leg([0, 0, 0], [0, -0.3, f ? 0.03 : -0.06], [0, -0.6, -0.02], [0, -0.82, 0.04], 0.17, 0.12, col), M.ball(0.13, 0xd8d0c0, 0, -0.84, 0.08, [1, 0.5, 1.35])], mat)));
    legs.forEach((l) => g.add(l));
    return { g, legs, head, headZ: 1.0 };
  };

  // ------------------------------------------------------------------ foca
  Anim.seal = function (mat) {
    const g = new THREE.Group(), col = 0x7a7c84;
    g.add(mk([spots(M.loft({ z0: -0.8, z1: 0.55, n: 22, m: 14, prof: tb([[0, 0.05], [0.12, 0.16], [0.45, 0.36], [0.75, 0.32], [0.95, 0.19], [1, 0.14]], [[0, 0.04], [0.12, 0.13], [0.45, 0.3], [0.75, 0.3], [0.95, 0.19], [1, 0.14]], [[0, 0.14], [0.45, 0.3], [0.75, 0.38], [1, 0.5]]), color: grad(0x5a5c64, col, 0xb0b2b8, 0.2) }), 0x44464c, 21, 6, 0.4),
      M.xf(M.fin([[0, 0], [0.25, -0.05], [0.3, -0.2], [0.05, -0.12]], 0.02, 0x55575e), 0.02, 0.12, -0.78, Math.PI / 2, 0, -0.2),
      M.xf(M.fin(mirror([[0, 0], [0.25, -0.05], [0.3, -0.2], [0.05, -0.12]]), 0.02, 0x55575e), -0.02, 0.12, -0.78, Math.PI / 2, 0, 0.2)], mat));
    const hp = [M.loft({ z0: -0.12, z1: 0.22, n: 10, m: 12, prof: tb([[0, 0.15], [0.5, 0.16], [0.85, 0.1], [1, 0.06]], [[0, 0.15], [0.5, 0.14], [0.85, 0.09], [1, 0.05]], 0), color: grad(0x5a5c64, col, 0xb0b2b8, 0.2) })];
    hp.push(M.ball(0.025, 0x1a1a1a, 0, 0.0, 0.225));
    for (const s of [-1, 1]) {
      hp.push(M.ball(0.04, 0x050505, s * 0.085, 0.05, 0.12));
      for (let k = 0; k < 3; k++) hp.push(M.tube([[s * 0.04, -0.02 - k * 0.012, 0.19], [s * 0.14, -0.03 - k * 0.02, 0.2]], [0.003, 0.002], 3, 0xe8e8e8, 3));
    }
    const head = mk(hp, mat, 0, 0.58, 0.62);
    g.add(head);
    const legs = [-1, 1].map((s) => piv(s * 0.3, 0.26, 0.3, mk([M.xf(M.fin(s > 0 ? [[0, 0], [0.3, -0.08], [0.32, -0.2], [0.02, -0.1]] : mirror([[0, 0], [0.3, -0.08], [0.32, -0.2], [0.02, -0.1]]), 0.02, 0x55575e), 0, 0, 0, Math.PI / 2, 0, s * -0.4)], mat)));
    legs.forEach((l) => g.add(l));
    return { g, legs, head, headZ: 0.62 };
  };

  // ------------------------------------------------------------------ mono capuchino
  Anim.monkey = function (mat) {
    const g = new THREE.Group(), col = 0x6a4a2e, face = 0xe0c8a0, dark = 0x3a2a1c;
    g.add(mk([M.loft({ z0: -0.25, z1: 0.22, n: 12, m: 12, prof: tb([[0, 0.1], [0.3, 0.15], [0.7, 0.16], [1, 0.11]], [[0, 0.11], [0.3, 0.15], [0.7, 0.17], [1, 0.12]], [[0, 0.46], [1, 0.53]]), color: grad(dark, col, 0xb08a60, 0.2) })], mat));
    const hp = [M.ball(0.13, col, 0, 0, 0, [1, 1, 0.95], 14, 10), M.ball(0.1, face, 0, -0.02, 0.07, [1, 1.05, 0.6], 14, 10), M.ball(0.06, face, 0, -0.06, 0.13, [1, 0.8, 0.9]), M.ball(0.11, dark, 0, 0.07, -0.01, [1, 0.6, 1])];
    for (const s of [-1, 1]) { hp.push(...M.eye(0.024, s * 0.04, 0.01, 0.12, 0x2a1a0a)); hp.push(M.ball(0.045, face, s * 0.13, 0.0, -0.01, [0.4, 1, 1])); }
    hp.push(M.ball(0.008, 0x2a1a10, 0.012, -0.05, 0.175), M.ball(0.008, 0x2a1a10, -0.012, -0.05, 0.175));
    const head = mk(hp, mat, 0, 0.66, 0.27);
    g.add(head);
    const legs = [[-0.1, 0.16, 1], [0.1, 0.16, 1], [-0.1, -0.18, 0], [0.1, -0.18, 0]].map(([x, z, f]) =>
      piv(x, 0.46, z, mk(M.leg([0, 0, 0], [0, -0.2, f ? 0.05 : -0.08], [0, -0.38, f ? 0 : 0.02], [0, -0.44, 0.05], 0.042, 0.025, col, dark), mat)));
    legs.forEach((l) => g.add(l));
    const tail = piv(0, 0.5, -0.24, mk([M.tube([[0, 0, 0], [0, 0.1, -0.2], [0, 0.35, -0.3], [0, 0.45, -0.2], [0, 0.38, -0.13]], [0.03, 0.014], 6, col)], mat));
    g.add(tail);
    return { g, legs, head, headZ: 0.27, tail };
  };

  // ------------------------------------------------------------------ caimán
  Anim.caiman = function (mat) {
    const g = new THREE.Group(), col = 0x4a5a2e, dark = 0x2e3a1c, bel = 0xc8c090;
    const body = [M.loft({ z0: -0.6, z1: 0.56, n: 16, m: 14, prof: tb([[0, 0.2], [0.4, 0.32], [0.8, 0.3], [1, 0.2]], [[0, 0.12], [0.4, 0.16], [0.8, 0.15], [1, 0.11]], 0.26, 2.6), color: grad(dark, col, bel, 0.2) })];
    for (let i = 0; i < 10; i++) for (const s of [-1, 1]) body.push(M.xf(M.paint(new THREE.BoxGeometry(0.07, 0.05, 0.08), dark), s * 0.08, 0.42, -0.52 + i * 0.11));
    g.add(mk(body, mat));
    const hp = [M.loft({ z0: 0, z1: 0.8, n: 12, m: 12, prof: tb([[0, 0.19], [0.3, 0.16], [0.7, 0.1], [1, 0.075]], [[0, 0.11], [0.3, 0.08], [0.7, 0.06], [1, 0.05]], 0, 2.4), color: grad(dark, col, bel, 0.2) })];
    for (const s of [-1, 1]) {
      hp.push(M.ball(0.045, col, s * 0.09, 0.1, 0.16), M.ball(0.028, 0xc8a820, s * 0.1, 0.13, 0.17), M.ball(0.012, 0x050505, s * 0.105, 0.14, 0.19, [0.4, 1, 1]));
      hp.push(M.ball(0.02, dark, s * 0.03, 0.06, 0.78));
      for (let i = 0; i < 8; i++) hp.push(M.xf(M.paint(new THREE.ConeGeometry(0.012, 0.045, 4), 0xf4f0e0), s * (0.15 - i * 0.011), -0.06, 0.18 + i * 0.075, Math.PI));
    }
    const head = mk(hp, mat, 0, 0.27, 0.55);
    g.add(head);
    const legs = [[-0.26, 0.35], [0.26, 0.35], [-0.26, -0.35], [0.26, -0.35]].map(([x, z]) => {
      const s = Math.sign(x);
      return piv(x, 0.24, z, mk([M.tube([[0, 0, 0], [s * 0.14, -0.04, 0.02], [s * 0.2, -0.2, 0.05]], [0.065, 0.038], 7, col), M.ball(0.05, dark, s * 0.21, -0.22, 0.09, [1.2, 0.4, 1.4])], mat));
    });
    legs.forEach((l) => g.add(l));
    const tp = [M.loft({ z0: -1.7, z1: 0.05, n: 14, m: 10, prof: tb([[0, 0.02], [0.6, 0.12], [1, 0.2]], [[0, 0.04], [0.6, 0.11], [1, 0.12]], 0, 2.4), color: grad(dark, col, bel, 0.2) })];
    for (let i = 0; i < 12; i++) for (const s of [-1, 1]) tp.push(M.xf(M.paint(new THREE.ConeGeometry(0.018, 0.07, 3), dark), s * 0.03, 0.08 + i * 0.005, -1.5 + i * 0.12));
    const tail = piv(0, 0.26, -0.58, mk(tp, mat));
    g.add(tail);
    return { g, legs, head, headZ: 0.55, tail, tailYaw: true };
  };

  // ------------------------------------------------------------------ rana venenosa
  Anim.frog = function (mat) {
    const g = new THREE.Group(), col = 0x2a6ae0;
    const parts = [spots(M.loft({ z0: -0.13, z1: 0.12, n: 10, m: 12, prof: tb([[0, 0.07], [0.4, 0.1], [0.8, 0.09], [1, 0.05]], [[0, 0.06], [0.4, 0.075], [0.8, 0.065], [1, 0.035]], [[0, 0.08], [1, 0.12]]), color: grad(0x1e56c8, col, 0x4a86f0, 0.3) }), 0x0a0a14, 33, 20, 0.35)];
    for (const s of [-1, 1]) {
      parts.push(M.ball(0.034, 0x0a0a14, s * 0.052, 0.17, 0.06), M.ball(0.01, 0xffffff, s * 0.06, 0.19, 0.085));
      parts.push(M.tube([[s * 0.05, 0.08, 0.06], [s * 0.08, 0.05, 0.1], [s * 0.08, 0.01, 0.12]], [0.016, 0.01], 5, col, 6), M.ball(0.018, col, s * 0.08, 0.01, 0.13, [1, 0.3, 1]));
      parts.push(M.tube([[s * 0.06, 0.08, -0.08], [s * 0.14, 0.05, -0.02], [s * 0.12, 0.02, -0.12], [s * 0.16, 0.012, -0.04]], [0.028, 0.014], 6, col, 10), M.ball(0.028, col, s * 0.17, 0.01, -0.02, [1, 0.25, 1.2]));
    }
    g.add(mk(parts, mat));
    return { g, legs: [], head: null, hop: true };
  };

  // ------------------------------------------------------------------ salamandra de fuego
  Anim.salamander = function (mat) {
    const g = new THREE.Group(), col = 0xe0521a;
    const parts = [spots(M.loft({ z0: -0.25, z1: 0.26, n: 12, m: 10, prof: tb([[0, 0.05], [0.3, 0.085], [0.8, 0.08], [1, 0.05]], [[0, 0.04], [0.3, 0.06], [0.8, 0.055], [1, 0.04]], 0.1), color: grad(0xc84010, col, 0xf0c040, 0.2) }), 0x1a0a05, 44, 14, 0.3)];
    parts.push(M.loft({ z0: 0.24, z1: 0.42, n: 8, m: 10, prof: tb([[0, 0.05], [0.4, 0.06], [1, 0.02]], [[0, 0.04], [0.4, 0.04], [1, 0.015]], 0.11), color: grad(0xc84010, col, 0xf0c040, 0.2) }));
    for (const s of [-1, 1]) parts.push(M.ball(0.016, 0xffe040, s * 0.04, 0.14, 0.34), M.ball(0.008, 0x050505, s * 0.045, 0.145, 0.35));
    g.add(mk(parts, mat));
    const legs = [[-0.08, 0.16], [0.08, 0.16], [-0.08, -0.16], [0.08, -0.16]].map(([x, z]) => {
      const s = Math.sign(x);
      return piv(x, 0.1, z, mk([M.tube([[0, 0, 0], [s * 0.06, 0.0, 0.01], [s * 0.09, -0.08, 0.02]], [0.022, 0.014], 5, col, 6), M.ball(0.018, col, s * 0.095, -0.085, 0.03, [1.3, 0.3, 1.3])], mat));
    });
    legs.forEach((l) => g.add(l));
    const tail = piv(0, 0.1, -0.24, mk([spots(M.tube([[0, 0, 0], [0, -0.02, -0.2], [0.05, -0.05, -0.4], [0.02, -0.07, -0.55]], [0.045, 0.006], 7, col), 0x1a0a05, 45, 14, 0.3)], mat));
    g.add(tail);
    mat.emissive = new Col(0x3a0c00);
    return { g, legs, head: null, tail, tailYaw: true };
  };
})();
