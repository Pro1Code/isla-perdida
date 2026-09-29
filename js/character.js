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
      S.cone([0, 1.47, 0.0], [0, 1.58, 0.01], q(0.058, 0.05), q(0.052, 0.045), Object.assign({ bone: 'neck', k: 0.03, reg: SK, color: 0xffffff, bb: 0.04 }, skin)),
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
    // Cabeza (grupo propio con más detalle): cráneo, frente, arcos de las cejas, pómulos, nariz, labios, mandíbula, orejas
    const HD = { grp: 'head', bone: 'head', reg: SK, color: 0xffffff, fur: 0 };
    const hd = (o) => Object.assign({}, HD, o || {});
    b.p(
      S.ell([0, 1.742, -0.004], [0.088, 0.105, 0.1], hd({ k: 0.03 })),
      S.ell([0, 1.7, 0.036], [0.077, 0.093, 0.08], hd({ k: 0.03 })),
      S.ell([0, 1.79, 0.048], [0.07, 0.045, 0.058], hd({ k: 0.025 })),
      S.ell([0, 1.765, 0.084], [0.064, 0.013, 0.024], hd({ k: 0.012 })),
      S.ell([0, 1.642, 0.046], [q(0.064, 0.056), 0.035, 0.058], hd({ k: 0.02 })),
      S.ell([0, 1.627, 0.084], [q(0.022, 0.017), q(0.02, 0.017), 0.02], hd({ k: 0.012 })),
      S.cone([0, 1.59, 0.0], [0, 1.66, 0.02], 0.055, 0.05, hd({ k: 0.02 })),
      // Nariz: caballete, punta y aletas con las fosas
      S.cone([0, 1.758, 0.094], [0, 1.708, 0.117], 0.0095, 0.0135, hd({ k: 0.008 })),
      S.sph([0, 1.701, 0.119], 0.0145, hd({ k: 0.008 })),
      S.ell([0.012, 1.698, 0.108], [0.01, 0.0085, 0.01], hd({ k: 0.006 })),
      S.ell([-0.012, 1.698, 0.108], [0.01, 0.0085, 0.01], hd({ k: 0.006 })),
      S.ell([0.0075, 1.692, 0.12], [0.004, 0.003, 0.004], { grp: 'head', paint: true, soft: 0.002, reg: SK, color: 0x5a3a30 }),
      S.ell([-0.0075, 1.692, 0.12], [0.004, 0.003, 0.004], { grp: 'head', paint: true, soft: 0.002, reg: SK, color: 0x5a3a30 }),
      // Labios (tono rojizo sobre el color de la piel) y la línea de la boca
      S.ell([0, 1.669, 0.097], [0.021, q(0.0058, 0.0072), 0.011], hd({ k: 0.006, color: q(0xcf8f84, 0xd88478) })),
      S.ell([0, 1.659, 0.095], [0.019, q(0.0068, 0.0085), q(0.011, 0.012)], hd({ k: 0.006, color: q(0xcf8f84, 0xd88478) })),
      S.cone([-0.02, 1.6645, 0.104], [0.02, 1.6645, 0.104], 0.0018, 0.0018, { grp: 'head', paint: true, soft: 0.0018, reg: SK, color: 0x6a3a34 }),
      // Barba incipiente y cejas

      S.ell([0.035, 1.767, 0.092], [0.023, 0.0055, 0.014], { grp: 'head', paint: true, soft: 0.004, reg: HA, color: 0xffffff }),
      S.ell([-0.035, 1.767, 0.092], [0.023, 0.0055, 0.014], { grp: 'head', paint: true, soft: 0.004, reg: HA, color: 0xffffff }),
    );
    for (const s of [1, -1]) {
      b.p(
        S.ell([s * 0.048, 1.7, 0.07], [0.034, 0.03, 0.033], hd({ k: 0.016 })),
        S.sph([s * 0.034, 1.737, 0.084], 0.0158, { grp: 'head', sub: true, k: 0.006 }),
        S.ell([s * 0.034, 1.7505, 0.084], [0.0175, 0.0075, 0.0115], hd({ k: 0.004 })),
        S.ell([s * 0.034, 1.7232, 0.0855], [0.0155, 0.0045, 0.0095], hd({ k: 0.004 })),
        S.ell([s * 0.091, 1.72, 0.0], [0.012, 0.03, 0.02], hd({ k: 0.008 })),
        S.ell([s * 0.098, 1.722, 0.004], [0.006, 0.019, 0.011], { grp: 'head', sub: true, k: 0.004 }),
      );
      b.part(F.eye(0.0114, [s * 0.034, 1.7368, 0.0838], [s * 0.06, 0, 1], 0x3b2c20, { sclera: 0xe8e2d8, pupilR: 0.24, irisR: 0.55 }), { bone: 'head' });
    }
    // Pelo: casquete desordenado que cubre más la nuca, con patillas
    b.p(
      S.ell([0, 1.797, -0.012], [0.1, 0.077, 0.104], hd({ k: 0.02, reg: HA, fur: 1, hair: [0, 0.3, -1] })),
      S.ell([0, 1.745, -0.052], [0.095, 0.08, 0.074], hd({ k: 0.025, reg: HA, fur: 1, hair: [0, -1, -0.2] })),
      S.ell([0.083, 1.745, -0.01], [0.022, 0.05, 0.06], hd({ k: 0.015, reg: HA, fur: 1, hair: [0, -1, 0] })),
      S.ell([-0.083, 1.745, -0.01], [0.022, 0.05, 0.06], hd({ k: 0.015, reg: HA, fur: 1, hair: [0, -1, 0] })),
      S.ell([0, 1.842, 0.03], [0.07, 0.03, 0.06], hd({ k: 0.02, reg: HA, fur: 1, hair: [0, 0.2, 1] })),
      // Melena larga hasta los hombros (mujeres)
      fem ? S.cone([0, 1.76, -0.07], [0, 1.52, -0.085], 0.088, 0.07, hd({ k: 0.04, reg: HA, fur: 1, sx: 1.15, hair: [0, -1, 0] })) : null,
      fem ? S.ell([0.07, 1.64, -0.035], [0.03, 0.09, 0.05], hd({ k: 0.03, reg: HA, fur: 1, hair: [0, -1, 0] })) : null,
      fem ? S.ell([-0.07, 1.64, -0.035], [0.03, 0.09, 0.05], hd({ k: 0.03, reg: HA, fur: 1, hair: [0, -1, 0] })) : null,
    );
    void M;
    return b.done({
      h: 0.019, hg: { head: 0.0068, armL: 0.012, armR: 0.012, handL: 0.0065, handR: 0.0065 }, cb: 0.008, bb: 0.05, ao: 0.018, aoMin: 0.5,
      lodK: 2.4, lodDist: 12,
    });
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
