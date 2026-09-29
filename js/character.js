// Personaje humano con esqueleto (SkinnedMesh, 17 huesos) esculpido con sdf.js y animación procedural:
// caminar, correr, reposo con respiración, salto, nado y golpe, con transiciones suaves entre estados.
(function () {
  'use strict';
  const G = window.G, U = G.U;
  const Char = (G.Character = {});
  const Col = THREE.Color;

  // ------------------------------------------------------------------ esqueleto (posiciones de reposo, mirando a +Z)
  const BONES = [
    ['hips', -1, [0, 0.95, 0]], ['spine', 0, [0, 1.07, 0]], ['chest', 1, [0, 1.27, 0]], ['neck', 2, [0, 1.5, 0]], ['head', 3, [0, 1.61, 0]],
    ['uaL', 2, [0.2, 1.45, 0]], ['faL', 5, [0.2, 1.17, 0]], ['hL', 6, [0.2, 0.925, 0]],
    ['uaR', 2, [-0.2, 1.45, 0]], ['faR', 8, [-0.2, 1.17, 0]], ['hR', 9, [-0.2, 0.925, 0]],
    ['thL', 0, [0.095, 0.93, 0]], ['shL', 11, [0.095, 0.51, 0]], ['ftL', 12, [0.095, 0.085, 0]],
    ['thR', 0, [-0.095, 0.93, 0]], ['shR', 14, [-0.095, 0.51, 0]], ['ftR', 15, [-0.095, 0.085, 0]],
  ];
  const B = {};
  BONES.forEach(([n], i) => (B[n] = i));

  // ------------------------------------------------------------------ cuerpo esculpido (sdf.js + rig.js)
  // Una sola malla para todas las personas: anatomía real (cara con cejas, nariz, labios, orejas y ojos; cuello,
  // trapecios, pecho, hombros, brazos con bíceps, manos con cinco dedos, muslos, rodillas, gemelos y botas).
  // Los colores de piel, camisa, pantalón y pelo van en el material, así cada aldeano o pirata usa la misma malla.
  // Mantiene los 17 huesos y las medidas de antes (sombreros, corazas, capas y armas encajan igual).
  const sm = U.smooth;
  // fem: cuerpo de mujer (hombros y cintura más estrechos, caderas más anchas, rasgos más suaves y pelo largo)
  function sculpt(fem) {
    const S = G.Sdf, R = G.Rig, F = G.Fauna, M = G.Mdl;
    const b = R.animal(fem ? 'humanF' : 'human');
    const q = (m, f) => (fem ? f : m), ar = q(1, 0.87);
    for (const [n, par, pos] of BONES) b.bone(n, par >= 0 ? BONES[par][0] : null, pos, n === 'head' ? [0, 1.86, 0] : n[0] === 'h' && n[1] !== 'i' ? [pos[0], 0.77, 0] : n.startsWith('ft') ? [pos[0], 0.02, 0.17] : null);
    const SK = 0, SH = 1, PA = 2, HA = 3; // zonas de color: piel, camisa, pantalón, pelo
    const cloth = { fur: 0.3 }, skin = { fur: 0 };
    const belt = 0x3b2a1a, buckle = 0xb8963c, boot = 0x3a2a1c, sole = 0x1e1610;
    // Tronco: pelvis, vientre, costillas, pecho, espalda y trapecios
    b.p(
      S.ell([0, 0.97, q(-0.005, -0.012)], [q(0.162, 0.175), 0.11, q(0.104, 0.112)], Object.assign({ bone: 'hips', k: 0.05, reg: PA, color: 0xffffff, bb: 0.08 }, cloth)),
      S.ell([0, 1.11, 0.012], [q(0.142, 0.122), 0.12, q(0.098, 0.09)], Object.assign({ bone: 'spine', k: 0.06, reg: SH, color: 0xffffff, bb: 0.09 }, cloth)),
      S.ell([0, 1.3, 0.0], [q(0.162, 0.145), q(0.19, 0.18), q(0.112, 0.102)], Object.assign({ bone: 'chest', k: 0.06, reg: SH, color: 0xffffff, bb: 0.09 }, cloth)),
      fem ? null : S.ell([0, 1.36, 0.036], [0.155, 0.085, 0.095], Object.assign({ bone: 'chest', k: 0.05, reg: SH, color: 0xffffff }, cloth)),
      fem ? S.ell([0.052, 1.335, 0.07], [0.055, 0.05, 0.048], Object.assign({ bone: 'chest', k: 0.04, reg: SH, color: 0xffffff }, cloth)) : null,
      fem ? S.ell([-0.052, 1.335, 0.07], [0.055, 0.05, 0.048], Object.assign({ bone: 'chest', k: 0.04, reg: SH, color: 0xffffff }, cloth)) : null,
      S.ell([0, 1.45, -0.03], [q(0.15, 0.13), 0.07, 0.08], Object.assign({ bone: 'chest', k: 0.05, reg: SH, color: 0xffffff }, cloth)),
      S.cone([0.03, 1.5, -0.015], [q(0.175, 0.162), 1.445, -0.008], q(0.05, 0.044), q(0.042, 0.036), Object.assign({ bone: 'chest', k: 0.04, reg: SH, color: 0xffffff }, cloth)),
      S.cone([-0.03, 1.5, -0.015], [-q(0.175, 0.162), 1.445, -0.008], q(0.05, 0.044), q(0.042, 0.036), Object.assign({ bone: 'chest', k: 0.04, reg: SH, color: 0xffffff }, cloth)),
      S.ell([q(0.15, 0.14), 1.43, 0.0], [q(0.06, 0.05), 0.065, q(0.068, 0.06)], Object.assign({ bone: 'chest', k: 0.04, reg: SH, color: 0xffffff }, cloth)),
      S.ell([-q(0.15, 0.14), 1.43, 0.0], [q(0.06, 0.05), 0.065, q(0.068, 0.06)], Object.assign({ bone: 'chest', k: 0.04, reg: SH, color: 0xffffff }, cloth)),
      // Cinturón con hebilla y faldón de la camisa
      S.ell([0, 1.005, 0.0], [0.166, 0.026, 0.11], { bone: 'hips', k: 0.012, color: belt, fur: 0.1, fixed: true }),
      S.ell([0, 1.005, 0.108], [0.02, 0.018, 0.01], { paint: true, soft: 0.004, color: buckle, fixed: true, paintFur: true, fur: 0 }),
      S.ell([0, 1.05, 0.0], [0.16, 0.03, 0.12], { paint: true, soft: 0.02, reg: SH, color: 0xb8b8b8 }),
      // Cuello de la camisa y cuello
      S.ell([0, 1.525, 0.0], [0.075, 0.03, 0.068], { paint: true, soft: 0.012, reg: SH, color: 0xb8b8b8 }),
      S.cone([0, 1.47, 0.0], [0, 1.53, 0.004], q(0.058, 0.05), q(0.056, 0.049), Object.assign({ bone: 'neck', k: 0.03, reg: SK, color: 0xffffff, bb: 0.04 }, skin)),
      S.cone([0, 1.505, 0.06], [0, 1.455, 0.085], 0.03, 0.006, { paint: true, soft: 0.01, sx: 1.2, reg: SK, color: 0xffffff }),
    );
    // Piernas: muslo con cuádriceps, rodilla, gemelo, pantalón remangado y bota
    for (const s of [1, -1]) {
      const L = s > 0 ? 'L' : 'R', x = s * 0.095;
      b.p(
        S.cone([x, 0.96, 0.0], [x, 0.53, 0.012], q(0.088, 0.092), q(0.058, 0.054), Object.assign({ bone: 'th' + L, k: 0.03, reg: PA, color: 0xffffff, bb: 0.05 }, cloth)),
        S.ell([x, 0.76, 0.035], [0.058, 0.13, 0.05], Object.assign({ bone: 'th' + L, k: 0.03, reg: PA, color: 0xffffff }, cloth)),
        S.sph([x, 0.51, 0.016], 0.055, Object.assign({ bone: 'sh' + L, k: 0.025, reg: PA, color: 0xffffff, bb: 0.03 }, cloth)),
        S.ell([x, 0.415, 0.0], [0.064, 0.022, 0.064], Object.assign({ bone: 'sh' + L, k: 0.012, reg: PA, color: 0xc0c0c0 }, cloth)),
        S.cone([x, 0.5, 0.0], [x, 0.1, -0.004], 0.052, 0.036, Object.assign({ bone: 'sh' + L, k: 0.02, reg: SK, color: 0xffffff, bb: 0.03 }, skin)),
        S.ell([x, 0.35, -0.03], [0.048, 0.1, 0.048], Object.assign({ bone: 'sh' + L, k: 0.025, reg: SK, color: 0xffffff }, skin)),
        S.ell([x, 0.47, 0.0], [0.07, 0.05, 0.07], { paint: true, soft: 0.01, reg: PA, color: 0xffffff }),
        S.cone([x, 0.175, 0.0], [x, 0.06, 0.004], 0.049, 0.046, { bone: 'sh' + L, k: 0.015, color: boot, fur: 0.1, fixed: true }),
        S.ell([x, 0.05, 0.048], [0.052, 0.048, 0.124], { bone: 'ft' + L, k: 0.02, color: boot, fur: 0.1, fixed: true }),
        S.ell([x, 0.008, 0.048], [0.056, 0.012, 0.13], { paint: true, soft: 0.006, color: sole, fixed: true }),
        S.ell([x, 0.075, 0.03], [0.075, 0.105, 0.17], { paint: true, soft: 0.008, color: boot, fixed: true }),
      );
    }
    // Brazos (grupo propio: no se funden con el costado): deltoides, bíceps, codo, antebrazo; manga corta
    for (const s of [1, -1]) {
      const L = s > 0 ? 'L' : 'R', x = s * 0.2, gA = 'arm' + L, gH = 'hand' + L;
      b.p(
        S.ell([s * 0.186, 1.425, 0.0], [0.052 * ar, 0.07, 0.058 * ar], Object.assign({ grp: gA, bone: 'ua' + L, k: 0.03, reg: SH, color: 0xffffff }, cloth)),
        S.cone([x, 1.44, 0.0], [x, 1.18, 0.0], 0.052 * ar, 0.043 * ar, Object.assign({ grp: gA, bone: 'ua' + L, k: 0.02, reg: SK, color: 0xffffff, bb: 0.03 }, skin)),
        S.ell([x, 1.31, 0.02], [0.04 * ar, 0.07, 0.044 * ar], Object.assign({ grp: gA, bone: 'ua' + L, k: 0.02, reg: SK, color: 0xffffff }, skin)),
        S.ell([x, 1.4, 0.0], [0.075, 0.13, 0.075], { grp: gA, paint: true, soft: 0.008, reg: SH, color: 0xffffff, paintFur: true, fur: 0.3 }),
        S.ell([x, 1.27, 0.0], [0.058, 0.016, 0.058], Object.assign({ grp: gA, bone: 'ua' + L, k: 0.008, reg: SH, color: 0xb8b8b8 }, cloth)),
        S.sph([x, 1.17, -0.008], 0.041, Object.assign({ grp: gA, bone: 'fa' + L, k: 0.015, reg: SK, color: 0xffffff, bb: 0.025 }, skin)),
        S.cone([x, 1.17, 0.0], [x, 0.935, 0.0], 0.044 * ar, 0.028 * ar, Object.assign({ grp: gA, bone: 'fa' + L, k: 0.015, reg: SK, color: 0xffffff, bb: 0.025, sx: 0.9 }, skin)),
        S.ell([x, 1.1, 0.01], [0.038 * ar, 0.06, 0.04 * ar], Object.assign({ grp: gA, bone: 'fa' + L, k: 0.015, reg: SK, color: 0xffffff }, skin)),
      );
      // Mano: palma, cuatro dedos algo doblados y pulgar
      b.p(S.ell([x, 0.868, 0.004], [0.021, 0.046, 0.04], Object.assign({ grp: gH, bone: 'h' + L, k: 0.012, reg: SK, color: 0xffffff }, skin)));
      for (let k = 0; k < 4; k++) {
        const z = -0.026 + k * 0.0175, len = [0.036, 0.042, 0.04, 0.032][k];
        b.p(S.cone([x - s * 0.002, 0.828, z], [x - s * 0.001, 0.828 - len, z + 0.012], 0.0085, 0.0072, Object.assign({ grp: gH, bone: 'h' + L, k: 0.006, reg: SK, color: 0xffffff }, skin)));
      }
      b.p(S.cone([x + s * 0.004, 0.878, 0.034], [x + s * 0.012, 0.832, 0.056], 0.0098, 0.0082, Object.assign({ grp: gH, bone: 'h' + L, k: 0.008, reg: SK, color: 0xffffff }, skin)));
    }
    // Cabeza (grupo propio): óvalo suave, frente, pómulos discretos, nariz pequeña y labios; orejas.
    // Los rasgos finos (ojos con párpados, cejas y la línea de la boca con una ligera sonrisa) son piezas aparte,
    // colocadas sobre la superficie real de la cara (se mide con el propio campo de distancia), nítidas de lejos
    const HD = { grp: 'head', bone: 'head', reg: SK, color: 0xffffff, fur: 0 };
    const hd = (o) => Object.assign({}, HD, o || {});
    const lipC = q(0xc98a80, 0xd47f76);
    const face = [
      S.ell([0, 1.745, -0.006], [0.089, 0.104, 0.1], hd({ k: 0.03 })),
      S.ell([0, 1.705, 0.03], [q(0.074, 0.07), 0.09, 0.08], hd({ k: 0.035 })),
      S.ell([0, 1.785, 0.05], [0.068, 0.045, 0.054], hd({ k: 0.03 })),
      S.ell([0, 1.648, 0.046], [q(0.058, 0.052), 0.032, 0.054], hd({ k: 0.03 })),
      S.ell([0, 1.632, 0.074], [q(0.02, 0.016), q(0.018, 0.016), 0.02], hd({ k: 0.015 })),
      S.cone([0, 1.505, 0.0], [0, 1.66, 0.02], 0.056, 0.05, hd({ k: 0.02 })),
      S.ell([0.046, 1.713, 0.063], [0.022, 0.016, 0.022], hd({ k: 0.02 })),
      S.ell([-0.046, 1.713, 0.063], [0.022, 0.016, 0.022], hd({ k: 0.02 })),
    ];
    const smin = (a2, b2, k) => { const h = Math.max(k - Math.abs(a2 - b2), 0) / k; return Math.min(a2, b2) - h * h * k * 0.25; };
    const fieldAt = (list, x, y, z) => { let d = 1e9; for (const pr of list) d = smin(d, S.dist(pr, x, y, z), pr.k); return d; };
    // z de la superficie de la cara en (x, y), mirando desde delante
    const surfZ = (list, x, y) => { let z = 0.25; for (let i = 0; i < 80; i++) { const d = fieldAt(list, x, y, z); if (d < 2e-4) break; z -= Math.max(d, 2e-4); } return z; };
    // Nariz pequeña y recta, y labios que asoman un poco de la cara
    const zn = surfZ(face, 0, 1.712), zl1 = surfZ(face, 0, 1.6725), zl2 = surfZ(face, 0, 1.6625);
    face.push(
      S.cone([0, 1.752, zn - 0.012], [0, 1.712, zn + 0.003], 0.0078, 0.0105, hd({ k: 0.008 })),
      S.sph([0, 1.706, zn + 0.004], 0.0112, hd({ k: 0.008 })),
      S.ell([0.0095, 1.702, zn - 0.004], [0.0075, 0.0065, 0.0075], hd({ k: 0.005 })),
      S.ell([-0.0095, 1.702, zn - 0.004], [0.0075, 0.0065, 0.0075], hd({ k: 0.005 })),
      S.ell([0, 1.6725, zl1 - 0.0035], [0.0185, q(0.0052, 0.0062), 0.0085], hd({ k: 0.005, color: lipC })),
      S.ell([0, 1.6625, zl2 - 0.003], [0.0165, q(0.0062, 0.0075), 0.009], hd({ k: 0.005, color: lipC })),
    );
    b.p(...face);
    const eyes = [];
    for (const s of [1, -1]) {
      b.p(
        S.ell([s * 0.091, 1.722, 0.0], [0.011, 0.028, 0.019], hd({ k: 0.008 })),
        S.ell([s * 0.098, 1.724, 0.004], [0.006, 0.017, 0.01], { grp: 'head', sub: true, k: 0.004 }),
      );
      // Ojo: globo que asoma de la cara, con el párpado de arriba (una concha de piel) y el de abajo más fino
      const ex = s * 0.032, ey = 1.738, er = 0.0132, ez = surfZ(face, ex, ey) - er * 0.6;
      eyes.push([ex, ey, ez, er, s]);
      const lid = (theta, tilt, col) => {
        const g = new THREE.SphereGeometry(er * 1.1, 18, 6, 0, Math.PI * 2, 0, theta);
        g.rotateX(tilt);
        g.translate(ex, ey, ez);
        return M.paint(g, col, 0.01);
      };
      b.part(lid(0.8, 0.45, 0xffffff), { bone: 'head', reg: SK, fur: 0 });
      b.part(lid(0.55, Math.PI - 0.45, 0xffffff), { bone: 'head', reg: SK, fur: 0 });
      // Ceja: arco fino del color del pelo, pegado a la frente
      const bp = [[0.015, 1.7585], [0.033, 1.7625], [0.049, 1.7585]].map(([x, y]) => [s * x, y, surfZ(face, s * x, y) + 0.0012]);
      b.part(M.tube(bp, [q(0.0034, 0.0027), q(0.0022, 0.0016)], 5, 0xffffff, 8), { bone: 'head', reg: HA, fur: 0.4, hair: [s, 0, 0] });
    }
    // Boca: la línea entre los labios, con las comisuras un poco hacia arriba
    const mp = [[-0.019, 1.6685], [-0.0095, 1.6665], [0, 1.666], [0.0095, 1.6665], [0.019, 1.6685]].map(([x, y]) => [x, y, surfZ(face, x, y) + 0.0004]);
    b.part(M.tube(mp, [0.0013, 0.0013], 5, 0x4e2622, 12), { bone: 'head' });
    // Pelo: casquete desordenado que cubre más la nuca, con patillas
    b.p(
      S.ell([0, 1.797, -0.012], [0.1, 0.077, 0.104], hd({ k: 0.02, reg: HA, fur: 1, hair: [0, 0.3, -1], cb: 0.003 })),
      S.ell([0, 1.745, -0.052], [0.095, 0.08, 0.074], hd({ k: 0.025, reg: HA, fur: 1, hair: [0, -1, -0.2] })),
      S.ell([0.083, 1.745, -0.01], [0.022, 0.05, 0.06], hd({ k: 0.015, reg: HA, fur: 1, hair: [0, -1, 0] })),
      S.ell([-0.083, 1.745, -0.01], [0.022, 0.05, 0.06], hd({ k: 0.015, reg: HA, fur: 1, hair: [0, -1, 0] })),
      S.ell([0, 1.842, 0.03], [0.07, 0.03, 0.06], hd({ k: 0.02, reg: HA, fur: 1, hair: [0, 0.2, 1], cb: 0.003 })),
      // Melena larga hasta los hombros (mujeres)
      fem ? S.cone([0, 1.76, -0.07], [0, 1.52, -0.085], 0.088, 0.07, hd({ k: 0.04, reg: HA, fur: 1, sx: 1.15, hair: [0, -1, 0] })) : null,
      fem ? S.ell([0.07, 1.64, -0.035], [0.03, 0.09, 0.05], hd({ k: 0.03, reg: HA, fur: 1, hair: [0, -1, 0] })) : null,
      fem ? S.ell([-0.07, 1.64, -0.035], [0.03, 0.09, 0.05], hd({ k: 0.03, reg: HA, fur: 1, hair: [0, -1, 0] })) : null,
    );
    void M;
    return b.done({
      h: 0.019, hg: { head: 0.0062, armL: 0.012, armR: 0.012, handL: 0.0065, handR: 0.0065 }, cb: 0.008, bb: 0.05, ao: 0.018, aoMin: 0.5,
      lodK: 2.4, lodDist: 12,
      // Ojos: esferas propias con la textura del iris (degradado, pupila y brillo) y un material brillante
      extra: (rig) => {
        for (const [x, y, z, r, s] of eyes) {
          const m = new THREE.Mesh(eyeGeo(r), eyeMat());
          m.position.set(x, y - 1.61, z);
          m.rotation.y = s * 0.04;
          m.castShadow = false;
          rig.B.head.add(m);
        }
      },
    });
  }
  // Ojo con textura: en una esfera, el frente (+Z) cae en u = 0,25, v = 0,5 de la textura
  let eyeTex = null, eyeM = null;
  const eyeGeos = {};
  const eyeGeo = (r) => eyeGeos[r] || (eyeGeos[r] = new THREE.SphereGeometry(r, 24, 16));
  function eyeMat() {
    if (eyeM) return eyeM;
    eyeTex = U.canvasTex(256, 128, (c, w, h) => {
      c.fillStyle = '#efe9df'; c.fillRect(0, 0, w, h);
      const cx = w * 0.25, cy = h * 0.5, R = w * 0.075;
      const g = c.createRadialGradient(cx, cy, R * 0.15, cx, cy, R);
      g.addColorStop(0, '#8a5a30'); g.addColorStop(0.55, '#6a4222'); g.addColorStop(0.85, '#4a2c16'); g.addColorStop(1, '#1e120a');
      c.fillStyle = g; c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(30,18,10,0.35)'; c.lineWidth = 1;
      for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; c.beginPath(); c.moveTo(cx + Math.cos(a) * R * 0.45, cy + Math.sin(a) * R * 0.45); c.lineTo(cx + Math.cos(a) * R * 0.9, cy + Math.sin(a) * R * 0.9); c.stroke(); }
      c.fillStyle = '#070504'; c.beginPath(); c.arc(cx, cy, R * 0.42, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.95)'; c.beginPath(); c.arc(cx + R * 0.32, cy - R * 0.32, R * 0.17, 0, Math.PI * 2); c.fill();
    });
    eyeM = new THREE.MeshStandardMaterial({ map: eyeTex, roughness: 0.12, metalness: 0 });
    return eyeM;
  }
  const tpl = (fem) => G.Rig.get(fem ? 'humanF' : 'human', () => sculpt(!!fem));
  Char.prepare = () => { G.Rig.prepare('human', () => sculpt(false)); G.Rig.prepare('humanF', () => sculpt(true)); };

  // ------------------------------------------------------------------ creación
  // opts = { skin, pants, hair, female } (colores opcionales, p. ej. para los aldeanos; female: cuerpo de mujer)
  Char.create = function (shirt = 0xe6dfcc, opts) {
    opts = opts || {};
    const mat = G.Rig.material({ human: true, skin: opts.skin ?? 0xc68d67, shirt, pants: opts.pants ?? 0x3b5270, hair: opts.hair ?? 0x2a1b12, furFreq: 420, fur: 1, bump: 0.004, sheen: 0.25, rough: 0.8, gloss: 0.55 });
    const rig = G.Rig.instance(tpl(opts.female), mat);
    const bones = rig.bones, mesh = rig.mesh;
    const root = rig.g;
    const hand = new THREE.Group();
    hand.position.set(0, -0.06, 0.005);
    bones[B.hR].add(hand);
    const o = {
      root, mesh, bones, hand, mat, rig,
      phase: 0, t: Math.random() * 10, walkW: 0, runW: 0, airW: 0, swimW: 0,
      rot: bones.map(() => new THREE.Vector3()), tgt: bones.map(() => new THREE.Vector3()),
    };
    o.update = (dt, s) => {
      animate(o, dt, s);
      if (G.camera) G.Rig.lod(rig, G.camera.position.distanceTo(root.position));
    };
    o.dispose = () => { mat.dispose(); mesh.skeleton.dispose(); };
    return o;
  };

  // ------------------------------------------------------------------ animación procedural
  // s = { pos, yaw, pitch, speed, onGround, swimming, swing (1→0), holding }
  function animate(o, dt, s) {
    dt = Math.min(dt, 0.1);
    o.t += dt;
    const sp = s.speed || 0;
    const k = (r) => 1 - Math.exp(-dt * r);
    o.walkW += (U.clamp(sp / 2.2, 0, 1) - o.walkW) * k(8);
    o.runW += (U.clamp((sp - 4.8) / 2.0, 0, 1) - o.runW) * k(6);
    o.airW += ((s.onGround === false && !s.swimming ? 1 : 0) - o.airW) * k(9);
    o.swimW += ((s.swimming ? 1 : 0) - o.swimW) * k(5);
    const freq = sp > 0.15 ? 0.95 + sp * 0.2 : 0;
    o.phase += dt * freq * Math.PI * 2;

    const T = o.tgt;
    for (const v of T) v.set(0, 0, 0);
    const ph = o.phase, sn = Math.sin(ph), cs = Math.cos(ph);
    const land = (1 - o.swimW) * (1 - o.airW * 0.7);
    const W = o.walkW * land, Rn = o.runW * land;
    const legA = 0.42 + 0.33 * Rn, armA = 0.32 + 0.4 * Rn;

    // Reposo: respiración y cambio de peso
    const br = Math.sin(o.t * 1.7), idle = 1 - o.walkW;
    T[B.chest].x += br * 0.014;
    T[B.head].x += br * 0.008;
    T[B.uaL].z += 0.045 + br * 0.01; T[B.uaR].z -= 0.045 + br * 0.01;
    T[B.faL].x -= 0.14; T[B.faR].x -= 0.14;
    const shift = Math.sin(o.t * 0.45) * idle;
    T[B.hips].z += shift * 0.025; T[B.spine].z -= shift * 0.02; T[B.neck].z -= shift * 0.01;
    T[B.head].y += Math.sin(o.t * 0.31) * 0.12 * idle;

    // Caminar / correr
    for (const [sd, off] of [[1, 0], [-1, Math.PI]]) {
      const sL = Math.sin(ph + off), cL = Math.cos(ph + off);
      const th = sd > 0 ? B.thL : B.thR, sh = sd > 0 ? B.shL : B.shR, ft = sd > 0 ? B.ftL : B.ftR;
      const ua = sd > 0 ? B.uaL : B.uaR, fa = sd > 0 ? B.faL : B.faR;
      const thigh = -sL * legA;
      const knee = 0.06 + (0.55 + 0.7 * Rn) * Math.pow(Math.max(0, cL), 1.4) + 0.15 * Rn * Math.max(0, -cL);
      T[th].x += thigh * W;
      T[th].z += sd * 0.03 * W;
      T[sh].x += knee * W;
      T[ft].x += (-(thigh + knee) * 0.75 + Math.max(0, -sL) * 0.2 * Math.max(0, -cL)) * W;
      T[ua].x += sL * armA * W;
      T[fa].x -= ((0.2 + 1.05 * Rn) + Math.max(0, -sL) * 0.3) * W;
      T[ua].z += sd * 0.04 * Rn;
    }
    T[B.hips].y -= sn * 0.1 * W;
    T[B.chest].y += sn * 0.13 * W;
    T[B.hips].z += cs * 0.035 * W;
    T[B.spine].x += 0.04 * W + 0.2 * Rn;
    T[B.neck].x -= 0.02 * W + 0.1 * Rn;
    T[B.head].x -= 0.02 * W + 0.08 * Rn;
    let hipY = -Math.abs(sn) * (0.028 * W) - 0.03 * Rn + 0.035 * Rn * Math.abs(cs);
    let hipX = cs * 0.018 * W * (1 - Rn * 0.6);

    // Salto / caída
    const air = o.airW * (1 - o.swimW);
    T[B.thL].x -= 0.55 * air; T[B.thR].x -= 0.25 * air;
    T[B.shL].x += 0.9 * air; T[B.shR].x += 0.5 * air;
    T[B.uaL].x -= 0.5 * air; T[B.uaR].x -= 0.3 * air;
    T[B.uaL].z += 0.35 * air; T[B.uaR].z -= 0.35 * air;
    T[B.faL].x -= 0.5 * air; T[B.faR].x -= 0.5 * air;

    // Nado (braza + patada)
    const sw = o.swimW;
    if (sw > 0.01) {
      const a = o.t * 3.2, kick = o.t * 7;
      for (const sd of [1, -1]) {
        const th = sd > 0 ? B.thL : B.thR, sh = sd > 0 ? B.shL : B.shR, ua = sd > 0 ? B.uaL : B.uaR, fa = sd > 0 ? B.faL : B.faR;
        T[th].x += Math.sin(kick + (sd > 0 ? 0 : Math.PI)) * 0.3 * sw;
        T[sh].x += (0.2 + Math.max(0, Math.sin(kick + (sd > 0 ? 0.6 : 0.6 + Math.PI))) * 0.3) * sw;
        T[ua].x += (-2.3 + 0.7 * Math.sin(a)) * sw;
        T[ua].z += sd * (0.5 + 0.6 * Math.sin(a + 1.2)) * sw;
        T[fa].x += (-0.3 - 0.6 * Math.max(0, Math.cos(a))) * sw;
      }
      T[B.head].x -= 0.9 * sw;
      T[B.neck].x -= 0.3 * sw;
    }

    // Mirar arriba/abajo
    const pitch = s.pitch || 0;
    T[B.neck].x -= pitch * 0.35 * (1 - sw);
    T[B.head].x -= pitch * 0.35 * (1 - sw);
    if (s.holding) T[B.faR].x -= 0.3;

    // Golpe con el brazo derecho (anticipación → impacto → recuperación)
    let swingActive = false;
    if (s.swing > 0) {
      swingActive = true;
      const p = 1 - s.swing;
      let a, e, tw;
      if (p < 0.38) { const q = sm(0, 1, p / 0.38); a = -2.6 * q; e = -1.35 * q; tw = 0.3 * q; }
      else { const q = 1 - Math.pow(1 - (p - 0.38) / 0.62, 3); a = -2.6 + 2.35 * q; e = -1.35 + 1.15 * q; tw = 0.3 - 0.55 * q; }
      T[B.uaR].x = a; T[B.uaR].z = -0.28; T[B.faR].x = e;
      T[B.chest].y += tw; T[B.spine].x += 0.12 * Math.sin(p * Math.PI);
    }

    // Aplicar con suavizado (el golpe es más rápido para que se sienta con impacto)
    const kp = k(14), ks = k(45);
    for (let i = 0; i < T.length; i++) {
      const f = swingActive && (i === B.uaR || i === B.faR) ? ks : kp;
      const r = o.rot[i];
      r.x += (T[i].x - r.x) * f; r.y += (T[i].y - r.y) * f; r.z += (T[i].z - r.z) * f;
      o.bones[i].rotation.set(r.x, r.y, r.z);
    }
    o.hipY = U.lerp(o.hipY || 0, hipY, k(12));
    o.hipX = U.lerp(o.hipX || 0, hipX, k(12));
    o.bones[B.hips].position.set(o.hipX, 0.95 + o.hipY, 0);

    o.root.position.copy(s.pos);
    o.root.position.y += sw * 0.35;
    o.root.rotation.set(sw * 1.25, (s.yaw || 0) + Math.PI, 0, 'YXZ');
  }

})();
