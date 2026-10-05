// Fauna realista: cada especie se esculpe con sdf.js (primitivas que se funden como la arcilla), lleva
// piezas finas aparte (ojos con iris y pupila, orejas, colmillos, crines, garras…) y un esqueleto de rig.js
// con el que camina, trota y galopa de verdad. F.build(tipo) devuelve { g, rig, … } para creatures.js.
(function () {
  'use strict';
  const G = window.G, U = G.U, M = G.Mdl, S = G.Sdf, R = G.Rig;
  const Col = THREE.Color, V3 = THREE.Vector3;
  const F = (G.Fauna = { defs: {} });

  // ------------------------------------------------------------------ piezas finas
  // Globo ocular con pupila, iris (más oscuro en el borde) y esclerótica; mira hacia dir
  F.eye = function (r, pos, dir, iris, o) {
    o = o || {};
    const geo = new THREE.SphereGeometry(r, o.glint ? 28 : 18, o.glint ? 22 : 14);
    const ic = new Col(iris), ie = new Col(iris).multiplyScalar(0.45), pc = new Col(o.pupil ?? 0x050403), sc = new Col(o.sclera ?? 0x2a1d16), c = new Col();
    const pr = o.pupilR ?? 0.35, ir = o.irisR ?? 0.78, slit = o.slit || 0, glint = o.glint ? new Col(0xffffff) : null;
    const P = geo.attributes.position, cols = new Float32Array(P.count * 3);
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i) / r, y = P.getY(i) / r, z = P.getZ(i) / r;
      const rad = Math.sqrt(x * x + y * y) * (z > 0 ? 1 : 3);
      const px = slit ? Math.abs(x) / (pr * (1 - slit)) : Math.sqrt(x * x + y * y) / pr;
      if (z > 0 && (slit ? Math.hypot(Math.abs(x) / (1 - slit * 0.85), y) < pr : px < 1)) c.copy(pc);
      else if (z > 0 && rad < ir) c.lerpColors(ic, ie, U.smooth(ir * 0.55, ir, rad));
      else c.copy(sc);
      if (glint && z > 0 && (x - 0.22) * (x - 0.22) + (y - 0.28) * (y - 0.28) < 0.018) c.copy(glint);
      cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const d = new V3(...dir).normalize();
    geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new V3(0, 0, 1), d));
    geo.translate(pos[0], pos[1], pos[2]);
    return geo;
  };
  // Oreja: concha curvada con grosor (fuera pelo, dentro más clara). Sale de base, apunta a dir, abierta hacia face
  F.ear = function (base, dir, face, len, wid, cOut, cIn, o) {
    o = o || {};
    const n = 10, m = 12, cup = o.cup ?? 0.55, th = o.th ?? 0.008, tipR = o.tip ?? 0.15;
    const up = new V3(...dir).normalize(), fw = new V3(...face);
    fw.addScaledVector(up, -fw.dot(up)).normalize();
    const sd = new V3().crossVectors(up, fw).normalize();
    const pos = [], col = [], idx = [];
    const co = new Col(cOut), ci = new Col(cIn);
    const ring = (layer) => {
      for (let i = 0; i <= n; i++) {
        const u = i / n, w = wid * Math.pow(1 - u, 0.85) * (1 - u * (1 - tipR)) + 0.002, bend = (o.bend || 0) * u * u;
        for (let j = 0; j <= m; j++) {
          const a = (j / m - 0.5) * 1.8;
          const x = (Math.sin(a) / Math.sin(0.9)) * w, z = (Math.cos(a) - 1) * w * cup * 1.4 - (layer ? th : 0) - bend * len;
          const p = new V3().addScaledVector(up, u * len).addScaledVector(sd, x).addScaledVector(fw, z);
          pos.push(base[0] + p.x, base[1] + p.y, base[2] + p.z);
          const cc = layer ? co : ci.clone().lerp(co, U.smooth(0.55, 1, Math.abs(j / m - 0.5) * 2) * 0.8 + u * 0.2);
          col.push(cc.r, cc.g, cc.b);
        }
      }
    };
    ring(0); ring(1);
    const off = (n + 1) * (m + 1), vid = (L, i, j) => L * off + i * (m + 1) + j;
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
      const a = vid(0, i, j), b = vid(0, i + 1, j), c2 = vid(0, i + 1, j + 1), d = vid(0, i, j + 1);
      idx.push(a, b, c2, a, c2, d);
      const a1 = vid(1, i, j), b1 = vid(1, i + 1, j), c1 = vid(1, i + 1, j + 1), d1 = vid(1, i, j + 1);
      idx.push(a1, c1, b1, a1, d1, c1);
    }
    for (let i = 0; i < n; i++) for (const j of [0, m]) {
      const a = vid(0, i, j), b = vid(0, i + 1, j), a1 = vid(1, i, j), b1 = vid(1, i + 1, j);
      if (j === 0) idx.push(a, a1, b1, a, b1, b); else idx.push(a, b1, a1, a, b, b1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const out = g.toNonIndexed(); g.dispose();
    return out;
  };
  // Cuerno / colmillo / garra: tubo curvo que se afila
  F.horn = (pts, r0, r1, color, seg) => M.tube(pts, (t) => U.lerp(r0, r1, Math.pow(t, 0.9)), seg || 8, color, 12);
  // Mechones / cerdas: conos finos a lo largo de una curva, inclinados hacia atrás
  F.tufts = function (list, color, rnd) {
    const parts = [];
    for (const [x, y, z, h, r, tilt, yaw] of list) {
      const g = new THREE.ConeGeometry(r, h, 4, 1);
      g.translate(0, h / 2, 0);
      g.rotateX(-(tilt ?? 0.9) + (rnd ? (rnd() - 0.5) * 0.3 : 0));
      if (yaw) g.rotateY(yaw);
      g.translate(x, y, z);
      parts.push(M.paint(g, color, 0.08, rnd));
    }
    return parts.length ? U.merge(parts) : null;
  };
  // Simetría: fn(s, lado) para s = +1 (L) y -1 (R)
  const sym = (fn) => [fn(1, 'L'), fn(-1, 'R')];
  const mx = (p, s) => [p[0] * s, p[1], p[2]];

  // ------------------------------------------------------------------ jabalí (y jabalí gigante)
  F.defs.boar = function (big) {
    const b = R.animal(big ? 'boss' : 'boar');
    const body = big ? 0x3a3029 : 0x564638, back = big ? 0x241d18 : 0x3a2f26, belly = big ? 0x4a3d33 : 0x65574a, face = big ? 0x5a4c40 : 0x7a6a5a;
    const leg = big ? 0x2a231e : 0x3a3029, hoof = 0x1a1511, snout = big ? 0x3a2c2a : 0x4e3a36;
    b.bone('hips', null, [0, 0.66, -0.40]);
    b.bone('spine', 'hips', [0, 0.70, -0.08]);
    b.bone('belly', 'spine', [0, 0.52, -0.05], [0, 0.45, -0.05]);
    b.bone('chest', 'spine', [0, 0.72, 0.28]);
    b.bone('neck', 'chest', [0, 0.74, 0.46]);
    b.bone('head', 'neck', [0, 0.76, 0.60], [0, 0.6, 1.0]);
    b.bone('jaw', 'head', [0, 0.63, 0.68], [0, 0.56, 0.93]);
    sym((s, L) => b.bone('ear' + L, 'head', [s * 0.075, 0.88, 0.6], [s * 0.13, 1.02, 0.57]));
    b.bone('tail1', 'hips', [0, 0.73, -0.62]);
    b.bone('tail2', 'tail1', [0, 0.62, -0.67], [0, 0.47, -0.665]);
    sym((s, L) => {
      b.bone('fl' + L + '0', 'chest', [s * 0.12, 0.58, 0.36]);
      b.bone('fl' + L + '1', 'fl' + L + '0', [s * 0.12, 0.38, 0.30]);
      b.bone('fl' + L + '2', 'fl' + L + '1', [s * 0.12, 0.17, 0.35]);
      b.bone('fl' + L + '3', 'fl' + L + '2', [s * 0.12, 0.07, 0.36], [s * 0.12, 0.0, 0.42]);
      b.bone('hl' + L + '0', 'hips', [s * 0.11, 0.62, -0.40]);
      b.bone('hl' + L + '1', 'hl' + L + '0', [s * 0.11, 0.38, -0.31]);
      b.bone('hl' + L + '2', 'hl' + L + '1', [s * 0.11, 0.19, -0.47]);
      b.bone('hl' + L + '3', 'hl' + L + '2', [s * 0.11, 0.07, -0.44], [s * 0.11, 0.0, -0.38]);
    });
    // Tronco: ancas estrechas, barril, pecho hondo y cruz alta (la joroba de las cerdas)
    b.p(
      S.ell([0, 0.66, -0.44], [0.125, 0.17, 0.18], { bone: 'hips', k: 0.08, color: body, bb: 0.08 }),
      S.ell([0, 0.64, -0.06], [0.17, 0.22, 0.36], { bone: 'spine', k: 0.1, color: body, bb: 0.1 }),
      S.ell([0, 0.55, -0.02], [0.15, 0.13, 0.26], { bone: 'belly', k: 0.1, color: belly }),
      S.ell([0, 0.67, 0.27], [0.18, 0.25, 0.22], { bone: 'chest', k: 0.1, color: body, bb: 0.1 }),
      S.ell([0, 0.86, 0.24], [0.1, 0.1, 0.24], { bone: 'chest', k: 0.09, color: back }),
      S.ell([0, 0.82, -0.2], [0.09, 0.07, 0.3], { bone: 'spine', k: 0.09, color: back }),
      // Cuello corto y grueso y cabeza en cuña
      S.cone([0, 0.74, 0.40], [0, 0.75, 0.58], 0.17, 0.145, { bone: 'neck', k: 0.08, sx: 0.85, color: body }),
      S.cone([0, 0.79, 0.6], [0, 0.615, 0.96], 0.13, 0.062, { bone: 'head', k: 0.07, sx: 0.8, color: face }),
      S.ell([0, 0.63, 0.88], [0.058, 0.058, 0.1], { bone: 'head', k: 0.04, color: face }),
      S.ell([0, 0.84, 0.66], [0.075, 0.06, 0.1], { bone: 'head', k: 0.05, color: face }),
      S.cone([0, 0.64, 0.66], [0, 0.565, 0.92], 0.07, 0.034, { bone: 'jaw', k: 0.03, sx: 0.9, color: face }),
      // Disco del hocico con fosas nasales
      S.cone([0, 0.585, 0.965], [0, 0.58, 1.018], 0.056, 0.055, { bone: 'head', k: 0.018, sy: 0.85, color: snout, fur: 0, pat: 0 }),
      S.sph([0.022, 0.585, 1.03], 0.013, { sub: true, k: 0.008 }),
      S.sph([-0.022, 0.585, 1.03], 0.013, { sub: true, k: 0.008 }),
      // Boca (comisura)
      S.cone([0, 0.605, 0.74], [0, 0.588, 0.95], 0.012, 0.008, { paint: true, soft: 0.008, sx: 5, color: 0x201814 }),
    );
    sym((s, L) => b.p(
      // Mejillas, cuencas de los ojos y cejas
      S.ell([s * 0.065, 0.67, 0.67], [0.07, 0.085, 0.12], { bone: 'head', k: 0.05, color: face }),
      S.ell([s * 0.085, 0.68, 0.66], [0.03, 0.06, 0.1], { paint: true, soft: 0.03, color: big ? 0x5a4e45 : 0x7a6c5e, amt: 0.7 }),
      S.sph([s * 0.08, 0.765, 0.715], 0.024, { sub: true, k: 0.012 }),
      S.ell([s * 0.074, 0.792, 0.712], [0.03, 0.016, 0.036], { bone: 'head', k: 0.012, color: face }),
      // Paletillas y jamones (se mueven con la pata)
      S.ell([s * 0.1, 0.62, 0.34], [0.08, 0.17, 0.12], { bone: 'fl' + L + '0', k: 0.06, color: body }),
      S.ell([s * 0.095, 0.58, -0.43], [0.065, 0.15, 0.12], { bone: 'hl' + L + '0', k: 0.06, color: body }),
      // Pata delantera
      S.cone([s * 0.12, 0.58, 0.36], [s * 0.12, 0.38, 0.30], 0.075, 0.055, { bone: 'fl' + L + '0', k: 0.05, color: body }),
      S.cone([s * 0.12, 0.38, 0.30], [s * 0.12, 0.17, 0.35], 0.05, 0.03, { bone: 'fl' + L + '1', k: 0.04, color: leg, bb: 0.014 }),
      S.sph([s * 0.12, 0.17, 0.35], 0.031, { bone: 'fl' + L + '1', k: 0.02, color: leg, bb: 0.014 }),
      S.cone([s * 0.12, 0.17, 0.35], [s * 0.12, 0.07, 0.36], 0.027, 0.024, { bone: 'fl' + L + '2', k: 0.02, color: leg, bb: 0.014 }),
      S.cone([s * 0.12, 0.07, 0.36], [s * 0.12, 0.035, 0.385], 0.025, 0.024, { bone: 'fl' + L + '3', k: 0.015, color: leg, bb: 0.014 }),
      // Pata trasera
      S.cone([s * 0.11, 0.62, -0.40], [s * 0.11, 0.38, -0.31], 0.085, 0.055, { bone: 'hl' + L + '0', k: 0.06, color: body }),
      S.cone([s * 0.11, 0.38, -0.31], [s * 0.11, 0.19, -0.47], 0.055, 0.03, { bone: 'hl' + L + '1', k: 0.04, color: leg, bb: 0.014 }),
      S.sph([s * 0.11, 0.19, -0.47], 0.032, { bone: 'hl' + L + '1', k: 0.02, color: leg, bb: 0.014 }),
      S.cone([s * 0.11, 0.19, -0.47], [s * 0.11, 0.07, -0.44], 0.027, 0.024, { bone: 'hl' + L + '2', k: 0.02, color: leg, bb: 0.014 }),
      S.cone([s * 0.11, 0.07, -0.44], [s * 0.11, 0.035, -0.405], 0.025, 0.024, { bone: 'hl' + L + '3', k: 0.015, color: leg, bb: 0.014 }),
    ));
    // Pezuñas partidas (dos dedos)
    for (const [z0, z1, L, f] of [[0.385, 0.43, 'L', 'fl'], [0.385, 0.43, 'R', 'fl'], [-0.405, -0.36, 'L', 'hl'], [-0.405, -0.36, 'R', 'hl']]) {
      const s = L === 'L' ? 1 : -1, x = s * (f === 'fl' ? 0.12 : 0.11);
      for (const dx of [-0.013, 0.013]) b.p(S.cone([x + dx, 0.034, z0], [x + dx * 1.1, 0.006, z1], 0.019, 0.012, { bone: f + L + '3', k: 0.006, color: hoof, fur: 0, pat: 0 }));
    }
    // Cola con borla
    b.p(
      S.cone([0, 0.73, -0.62], [0, 0.62, -0.67], 0.026, 0.017, { bone: 'tail1', k: 0.03, color: body }),
      S.cone([0, 0.62, -0.67], [0, 0.49, -0.665], 0.017, 0.011, { bone: 'tail2', k: 0.01, color: back }),
    );
    // Ojos, orejas, colmillos, cerdas del lomo y borla de la cola
    sym((s, L) => {
      b.part(F.eye(0.021, [s * 0.078, 0.765, 0.715], [s * 0.85, 0.12, 0.5], big ? 0x9a1208 : 0x2a1608), { bone: 'head' });
      b.part(F.ear([s * 0.075, 0.875, 0.6], [s * 0.5, 1, -0.15], [s * 0.35, 0.1, 1], 0.14, 0.05, body, 0x5e4a3e, { cup: 0.6, tip: 0.12 }), { bone: 'ear' + L, fur: 1, hair: [0, 1, 0] });
      const tk = big ? 1.8 : 1;
      b.part(F.horn([[s * 0.036, 0.575, 0.9], [s * 0.058, 0.6, 0.935], [s * 0.074, 0.64, 0.925], [s * (0.07 + 0.012 * tk), 0.66 + 0.03 * (tk - 1), 0.9 - 0.02 * (tk - 1)]], 0.012 * tk, 0.002, 0xe6dcc4), { bone: 'jaw' });
    });
    const rnd = U.rng(big ? 91 : 19), cerdas = [];
    for (let i = 0; i < (big ? 70 : 46); i++) {
      const t = i / (big ? 70 : 46), z = U.lerp(0.52, -0.25, t), y = t < 0.35 ? U.lerp(0.9, 0.97, t / 0.35) : U.lerp(0.97, 0.88, (t - 0.35) / 0.65);
      const h = (0.05 + Math.sin(t * Math.PI) * 0.06) * (big ? 1.5 : 1) * (0.7 + rnd() * 0.6);
      cerdas.push([(rnd() - 0.5) * 0.05, y - 0.02, z, h, 0.012, 1.0 + rnd() * 0.3, (rnd() - 0.5) * 0.6]);
    }
    b.part(F.tufts(cerdas, back, rnd), { bones: ['neck', 'chest', 'spine', 'hips'], fur: 1, hair: [0, 1, -0.6] });
    b.part(F.tufts([[0, 0.5, -0.665, 0.08, 0.02, Math.PI, 0], [0.008, 0.51, -0.66, 0.07, 0.016, Math.PI - 0.25, 0.8], [-0.008, 0.51, -0.668, 0.07, 0.016, Math.PI - 0.25, -0.8]], back), { bone: 'tail2', fur: 1, hair: [0, -1, 0] });
    // Patas
    sym((s, L) => {
      b.leg(['fl' + L + '0', 'fl' + L + '1', 'fl' + L + '2', 'fl' + L + '3'], { key: L === 'L' ? 'fl' : 'fr', front: true });
      b.leg(['hl' + L + '0', 'hl' + L + '1', 'hl' + L + '2', 'hl' + L + '3'], { key: L === 'L' ? 'hl' : 'hr' });
    });
    return b.done({
      h: 0.0235, cb: 0.02, bb: 0.05,
      // Lomo más oscuro (raya dorsal) y canas en la cara
      color: (c, x, y, z, nx, ny) => { if (ny > 0.55 && y > 0.8) c.multiplyScalar(0.82); },
      spine: ['spine', 'chest'], neck: ['neck'], tail: ['tail1', 'tail2'],
      gaits: {
        walk: { v: [0, 1.5], stride: 0.55, duty: 0.66, lift: 0.07 },
        trot: { v: [1.5, 3.6], stride: 0.95, duty: 0.45, lift: 0.1 },
        gallop: { v: [3.6, 99], stride: 1.55, duty: 0.32, lift: 0.13 },
      },
      half: 0.45, footReach: 0.2, bob: 0.012, crouch: 0.1, tailAmp: 0.35, tailFreq: 6, jawOpen: 0.35, lungeNeck: 0.5, lungeHead: -0.2,
    });
  };

  // ------------------------------------------------------------------ patas (ayuda común)
  // J: puntos del lado izquierdo (x > 0) de la cadera / hombro a la punta que toca el suelo; R: radio en cada punto.
  // o.colors[i] (color de cada tramo), o.front, o.foot(s, L, P, nombre) añade pezuñas, almohadillas o garras
  function limb(b, pre, parent, J, R2, o) {
    o = o || {};
    const n = J.length - 1;
    sym((s, L) => {
      const P = J.map((p) => mx(p, s)), nm = pre + L;
      for (let i = 0; i < n; i++) b.bone(nm + i, i ? nm + (i - 1) : parent, P[i], i === n - 1 ? P[n] : null);
      for (let i = 0; i < n; i++) {
        const col = (o.colors && o.colors[i]) ?? o.color;
        b.p(S.cone(P[i], P[i + 1], R2[i], R2[i + 1], { bone: nm + i, k: (o.k && o.k[i]) ?? (i ? 0.02 : 0.05), color: col, bb: i ? 0.014 : undefined, ps: o.ps }));
        if (i > 0 && o.knobs !== false) b.p(S.sph(P[i], R2[i] * 1.06, { bone: nm + i, k: 0.015, color: col, bb: 0.014, ps: o.ps }));
      }
      if (o.foot) o.foot(s, L, P, nm);
      b.leg(Array.from({ length: n }, (_, i) => nm + i), { key: (o.front ? 'f' : 'h') + (L === 'L' ? 'l' : 'r'), front: !!o.front, toeFlex: o.toeFlex, metaFlex: o.metaFlex });
    });
  }
  // Bigotes: pelos finos que salen del hocico hacia los lados
  function whiskers(b, bone, base, n, len, color) {
    const parts = [];
    for (const s of [1, -1]) for (let i = 0; i < n; i++) {
      const a = (i / (n - 1) - 0.5) * 0.7, x = base[0] * s, y = base[1] - i * 0.004, z = base[2] - i * 0.003;
      parts.push(M.tube([[x, y, z], [x + s * len * 0.5 * Math.cos(a), y + len * 0.1 * Math.sin(a) - 0.004, z + len * 0.25], [x + s * len * Math.cos(a), y + len * 0.3 * Math.sin(a) - 0.02, z + len * 0.3]], [0.0016, 0.0006], 3, color, 4));
    }
    b.part(U.merge(parts), { bone, fur: 0 });
  }

  // ------------------------------------------------------------------ lobo (y lobo de las nieves)
  F.defs.wolf = function (snow) {
    const b = R.animal(snow ? 'snowwolf' : 'wolf');
    const back = snow ? 0xc4cad3 : 0x6e665c, side = snow ? 0xe4e8ee : 0xa89e8e, pale = snow ? 0xf7f8fa : 0xe0d6c4, dark = snow ? 0xa0a8b4 : 0x3a3530, nose = 0x141211;
    b.bone('hips', null, [0, 0.8, -0.42]);
    b.bone('spine', 'hips', [0, 0.8, -0.08]);
    b.bone('belly', 'spine', [0, 0.62, 0.0], [0, 0.56, 0.0]);
    b.bone('chest', 'spine', [0, 0.8, 0.26]);
    b.bone('neck', 'chest', [0, 0.86, 0.42]);
    b.bone('head', 'neck', [0, 0.99, 0.6], [0, 0.94, 0.86]);
    b.bone('jaw', 'head', [0, 0.935, 0.64], [0, 0.915, 0.82]);
    sym((s, L) => b.bone('ear' + L, 'head', [s * 0.045, 1.055, 0.6], [s * 0.07, 1.16, 0.58]));
    b.bone('tail1', 'hips', [0, 0.87, -0.54]);
    b.bone('tail2', 'tail1', [0, 0.76, -0.63]);
    b.bone('tail3', 'tail2', [0, 0.6, -0.68], [0, 0.45, -0.68]);
    b.p(
      S.ell([0, 0.72, 0.22], [0.12, 0.21, 0.2], { bone: 'chest', k: 0.08, color: side, bb: 0.09 }),
      S.ell([0, 0.86, 0.3], [0.1, 0.09, 0.2], { bone: 'chest', k: 0.07, color: back }),
      S.ell([0, 0.76, 0.0], [0.125, 0.17, 0.28], { bone: 'spine', k: 0.08, color: side, bb: 0.09 }),
      S.ell([0, 0.66, 0.02], [0.1, 0.09, 0.2], { bone: 'belly', k: 0.08, color: pale }),
      S.ell([0, 0.8, -0.24], [0.095, 0.105, 0.14], { bone: 'spine', k: 0.08, color: side }),
      S.ell([0, 0.8, -0.42], [0.1, 0.12, 0.14], { bone: 'hips', k: 0.07, color: side }),
      S.ell([0, 0.95, -0.05], [0.12, 0.09, 0.45], { paint: true, soft: 0.06, color: back }),
      S.ell([0, 0.57, 0.05], [0.12, 0.08, 0.32], { paint: true, soft: 0.05, color: pale }),
      // Cuello con la gorguera de pelo
      S.cone([0, 0.82, 0.36], [0, 0.96, 0.56], 0.11, 0.08, { bone: 'neck', k: 0.06, sx: 0.85, color: side }),
      S.ell([0, 0.86, 0.42], [0.13, 0.16, 0.14], { bone: 'neck', k: 0.07, color: side }),
      S.ell([0, 0.9, 0.52], [0.1, 0.1, 0.09], { bone: 'neck', k: 0.06, color: side }),
      S.ell([0, 0.78, 0.44], [0.08, 0.1, 0.08], { paint: true, soft: 0.05, color: pale }),
      // Cabeza: cráneo, frente con el escalón de los ojos, hocico largo y estrecho, trufa y mandíbula
      S.ell([0, 1.0, 0.6], [0.075, 0.07, 0.085], { bone: 'head', k: 0.05, color: side }),
      S.ell([0, 1.015, 0.665], [0.058, 0.045, 0.05], { bone: 'head', k: 0.04, color: side }),
      S.cone([0, 0.978, 0.69], [0, 0.955, 0.85], 0.042, 0.02, { bone: 'head', k: 0.035, sx: 0.85, sy: 1.1, color: side }),
      S.ell([0, 0.958, 0.862], [0.018, 0.015, 0.013], { bone: 'head', k: 0.008, color: nose, fur: 0, pat: 0, cb: 0.004 }),
      S.ell([0, 0.94, 0.77], [0.045, 0.028, 0.09], { paint: true, soft: 0.025, color: pale }),
      S.cone([0, 0.936, 0.66], [0, 0.936, 0.82], 0.032, 0.016, { bone: 'jaw', k: 0.022, color: pale }),
      S.cone([0, 0.943, 0.72], [0, 0.938, 0.835], 0.004, 0.003, { sub: true, k: 0.007, sx: 7 }),
      S.cone([0, 0.943, 0.72], [0, 0.938, 0.835], 0.009, 0.006, { paint: true, soft: 0.006, sx: 5, color: 0x2a2420 }),
      S.ell([0, 1.04, 0.63], [0.055, 0.03, 0.07], { paint: true, soft: 0.03, color: back }),
    );
    sym((s, L) => b.p(
      S.ell([s * 0.045, 0.965, 0.625], [0.036, 0.045, 0.06], { bone: 'head', k: 0.04, color: pale }),
      S.sph([s * 0.037, 1.003, 0.708], 0.012, { sub: true, k: 0.008 }),
      S.ell([s * 0.036, 1.018, 0.7], [0.018, 0.009, 0.02], { bone: 'head', k: 0.008, color: side }),
      S.ell([s * 0.085, 0.72, 0.33], [0.06, 0.13, 0.1], { bone: 'fl' + L + '0', k: 0.05, color: side }),
      S.ell([s * 0.08, 0.7, -0.44], [0.075, 0.16, 0.13], { bone: 'hl' + L + '0', k: 0.05, color: side }),
      S.ell([s * 0.07, 0.95, 0.62], [0.03, 0.06, 0.05], { paint: true, soft: 0.03, color: pale }),
    ));
    const paw = () => (s, L, P, nm) => b.p(S.ell([P[4][0], 0.022, P[4][2] - 0.012], [0.028, 0.022, 0.04], { bone: nm + 3, k: 0.015, color: 0x6a625a, bb: 0.012 }));
    limb(b, 'fl', 'chest', [[0.1, 0.74, 0.34], [0.1, 0.5, 0.27], [0.1, 0.18, 0.32], [0.1, 0.05, 0.34], [0.1, 0.0, 0.4]], [0.072, 0.052, 0.03, 0.026, 0.026], { front: true, colors: [side, side, pale, pale], foot: paw(), knobs: false });
    limb(b, 'hl', 'hips', [[0.09, 0.76, -0.42], [0.09, 0.5, -0.3], [0.09, 0.22, -0.5], [0.09, 0.05, -0.47], [0.09, 0.0, -0.41]], [0.092, 0.056, 0.03, 0.025, 0.026], { colors: [side, side, pale, pale], foot: paw(), knobs: false });
    b.p(
      S.cone([0, 0.87, -0.54], [0, 0.76, -0.63], 0.045, 0.068, { bone: 'tail1', k: 0.04, color: back }),
      S.cone([0, 0.76, -0.63], [0, 0.6, -0.68], 0.068, 0.075, { bone: 'tail2', k: 0.03, color: side }),
      S.cone([0, 0.6, -0.68], [0, 0.44, -0.67], 0.075, 0.025, { bone: 'tail3', k: 0.03, color: side }),
      S.ell([0, 0.46, -0.68], [0.05, 0.07, 0.05], { paint: true, soft: 0.04, color: dark }),
    );
    sym((s, L) => {
      b.part(F.eye(0.0105, [s * 0.034, 1.002, 0.707], [s * 0.4, 0.1, 0.9], snow ? 0x7aa8d8 : 0xc88a22), { bone: 'head' });
      b.part(F.ear([s * 0.045, 1.05, 0.6], [s * 0.35, 1, -0.05], [s * 0.4, 0.1, 1], 0.12, 0.048, side, pale, { cup: 0.55, tip: 0.08 }), { bone: 'ear' + L, fur: 1, hair: [0, 1, 0] });
    });
    whiskers(b, 'head', [0.028, 0.95, 0.79], 3, 0.05, snow ? 0xf0f0f0 : 0x8a8278);
    return b.done({
      h: 0.022, cb: 0.022, bb: 0.05, ao: 0.03,
      spine: ['spine', 'chest'], neck: ['neck'], tail: ['tail1', 'tail2', 'tail3'],
      gaits: {
        walk: { v: [0, 1.3], stride: 0.62, duty: 0.62, lift: 0.08 },
        trot: { v: [1.3, 4.2], stride: 1.15, duty: 0.42, lift: 0.11 },
        gallop: { v: [4.2, 99], stride: 2.0, duty: 0.3, lift: 0.15 },
      },
      half: 0.45, footReach: 0.25, bob: 0.012, crouch: 0.14, tailAmp: 0.2, tailFreq: 2, jawOpen: 0.6, lungeNeck: 0.35, lungeHead: 0.25,
    });
  };

  // ------------------------------------------------------------------ jaguar
  F.defs.jaguar = function () {
    const b = R.animal('jaguar');
    const base = 0xd99a3e, back = 0xc4862c, pale = 0xf2e6cc, dark = 0x1c140c, nose = 0x9a6458;
    b.bone('hips', null, [0, 0.62, -0.46]);
    b.bone('spine', 'hips', [0, 0.6, -0.08]);
    b.bone('belly', 'spine', [0, 0.45, -0.05], [0, 0.4, -0.05]);
    b.bone('chest', 'spine', [0, 0.6, 0.28]);
    b.bone('neck', 'chest', [0, 0.64, 0.44]);
    b.bone('head', 'neck', [0, 0.72, 0.62], [0, 0.69, 0.84]);
    b.bone('jaw', 'head', [0, 0.645, 0.67], [0, 0.635, 0.79]);
    sym((s, L) => b.bone('ear' + L, 'head', [s * 0.068, 0.8, 0.62], [s * 0.09, 0.86, 0.6]));
    b.bone('tail1', 'hips', [0, 0.66, -0.62]);
    b.bone('tail2', 'tail1', [0, 0.5, -0.76]);
    b.bone('tail3', 'tail2', [0, 0.36, -0.86], [0, 0.31, -0.99]);
    b.p(
      S.ell([0, 0.55, 0.28], [0.165, 0.19, 0.21], { bone: 'chest', k: 0.08, color: base, bb: 0.09 }),
      S.ell([0, 0.57, -0.06], [0.16, 0.165, 0.32], { bone: 'spine', k: 0.08, color: base, bb: 0.09 }),
      S.ell([0, 0.47, -0.04], [0.12, 0.09, 0.24], { bone: 'belly', k: 0.08, color: pale }),
      S.ell([0, 0.6, -0.44], [0.125, 0.14, 0.15], { bone: 'hips', k: 0.07, color: base }),
      S.ell([0, 0.72, -0.1], [0.1, 0.06, 0.5], { paint: true, soft: 0.06, color: back }),
      S.ell([0, 0.42, 0.0], [0.13, 0.07, 0.42], { paint: true, soft: 0.05, color: pale }),
      S.cone([0, 0.6, 0.4], [0, 0.68, 0.58], 0.12, 0.1, { bone: 'neck', k: 0.06, color: base }),
      S.ell([0, 0.58, 0.5], [0.07, 0.06, 0.08], { paint: true, soft: 0.04, color: pale }),
      // Cabeza grande, ancha y redonda; hocico corto con las almohadillas de los bigotes
      S.ell([0, 0.735, 0.64], [0.108, 0.092, 0.1], { bone: 'head', k: 0.05, color: base, ps: 2 }),
      S.ell([0, 0.775, 0.685], [0.075, 0.045, 0.06], { bone: 'head', k: 0.04, color: base, ps: 2 }),
      S.ell([0, 0.698, 0.772], [0.068, 0.05, 0.055], { bone: 'head', k: 0.04, color: base, ps: 2 }),
      S.ell([0, 0.678, 0.796], [0.05, 0.034, 0.035], { paint: true, soft: 0.018, color: pale, pat: 0, paintPat: true }),
      S.ell([0, 0.71, 0.826], [0.023, 0.014, 0.011], { bone: 'head', k: 0.008, color: nose, fur: 0, pat: 0, cb: 0.004 }),
      S.ell([0, 0.648, 0.745], [0.045, 0.03, 0.05], { bone: 'jaw', k: 0.025, color: pale, pat: 0.2 }),
      S.cone([0, 0.664, 0.74], [0, 0.66, 0.805], 0.004, 0.004, { sub: true, k: 0.006, sx: 9 }),
    );
    sym((s) => b.p(S.ell([s * 0.03, 0.68, 0.8], [0.034, 0.03, 0.03], { bone: 'head', k: 0.02, color: pale, pat: 0 })));
    sym((s, L) => b.p(
      S.ell([s * 0.07, 0.69, 0.71], [0.055, 0.06, 0.06], { bone: 'head', k: 0.04, color: base, ps: 2 }),
      S.sph([s * 0.05, 0.742, 0.745], 0.017, { sub: true, k: 0.01 }),
      S.ell([s * 0.048, 0.758, 0.748], [0.022, 0.01, 0.022], { bone: 'head', k: 0.01, color: base }),
      S.ell([s * 0.075, 0.69, 0.36], [0.05, 0.06, 0.09], { bone: 'fl' + L + '0', k: 0.05, color: base }),
      S.ell([s * 0.1, 0.5, 0.36], [0.06, 0.12, 0.09], { bone: 'fl' + L + '0', k: 0.05, color: base, ps: 1.4 }),
      S.ell([s * 0.09, 0.55, -0.46], [0.07, 0.15, 0.13], { bone: 'hl' + L + '0', k: 0.05, color: base }),
    ));
    const paw = (s, L, P, nm) => b.p(S.ell([P[4][0], 0.032, (P[3][2] + P[4][2]) / 2], [0.052, 0.032, 0.06], { bone: nm + 3, k: 0.015, color: base, bb: 0.012, ps: 2 }));
    limb(b, 'fl', 'chest', [[0.115, 0.56, 0.38], [0.115, 0.35, 0.31], [0.115, 0.12, 0.37], [0.115, 0.04, 0.39], [0.115, 0.0, 0.46]], [0.095, 0.07, 0.048, 0.045, 0.05], { front: true, color: base, ps: 2, foot: paw, knobs: false });
    limb(b, 'hl', 'hips', [[0.1, 0.6, -0.47], [0.1, 0.38, -0.35], [0.1, 0.16, -0.57], [0.1, 0.04, -0.54], [0.1, 0.0, -0.48]], [0.11, 0.072, 0.04, 0.038, 0.046], { color: base, ps: 2, foot: paw, knobs: false });
    b.p(
      S.cone([0, 0.66, -0.62], [0, 0.5, -0.76], 0.048, 0.042, { bone: 'tail1', k: 0.04, color: base, ps: 2 }),
      S.cone([0, 0.5, -0.76], [0, 0.36, -0.86], 0.042, 0.036, { bone: 'tail2', k: 0.02, color: base, ps: 2 }),
      S.cone([0, 0.36, -0.86], [0, 0.31, -0.99], 0.036, 0.03, { bone: 'tail3', k: 0.02, color: base, ps: 2 }),
      S.ell([0, 0.31, -0.98], [0.04, 0.04, 0.04], { paint: true, soft: 0.02, color: dark }),
    );
    sym((s, L) => {
      b.part(F.eye(0.016, [s * 0.05, 0.742, 0.748], [s * 0.4, 0.05, 0.92], 0xc8a830, { pupilR: 0.3 }), { bone: 'head' });
      b.part(F.ear([s * 0.07, 0.8, 0.63], [s * 0.55, 1, -0.3], [s * 0.35, 0, 1], 0.052, 0.04, 0x2a1c10, pale, { cup: 0.5, tip: 0.75 }), { bone: 'ear' + L, fur: 1 });
    });
    whiskers(b, 'head', [0.04, 0.68, 0.805], 5, 0.09, 0xf4f0e6);
    return b.done({
      h: 0.022, cb: 0.02, bb: 0.05, ao: 0.03,
      spine: ['spine', 'chest'], neck: ['neck'], tail: ['tail1', 'tail2', 'tail3'],
      gaits: {
        walk: { v: [0, 2.0], stride: 0.72, duty: 0.64, lift: 0.07 },
        gallop: { v: [2.0, 99], stride: 2.3, duty: 0.28, lift: 0.14 },
      },
      half: 0.5, footReach: 0.22, bob: 0.01, crouch: 0.2, tailAmp: 0.25, tailFreq: 1.5, jawOpen: 0.7, lungeNeck: 0.3, lungeHead: 0.2,
    });
  };

  // ------------------------------------------------------------------ oso blanco
  F.defs.bear = function () {
    const b = R.animal('bear');
    const fur = 0xefe7d6, shade = 0xd9ceb8, dark = 0x141210, pad = 0x2a2420;
    b.bone('hips', null, [0, 1.0, -0.6]);
    b.bone('spine', 'hips', [0, 1.02, -0.1]);
    b.bone('belly', 'spine', [0, 0.72, -0.1], [0, 0.62, -0.1]);
    b.bone('chest', 'spine', [0, 1.05, 0.35]);
    b.bone('neck', 'chest', [0, 1.1, 0.6]);
    b.bone('head', 'neck', [0, 1.18, 0.92], [0, 1.1, 1.32]);
    b.bone('jaw', 'head', [0, 1.07, 1.0], [0, 1.04, 1.24]);
    sym((s, L) => b.bone('ear' + L, 'head', [s * 0.1, 1.3, 0.93], [s * 0.12, 1.36, 0.92]));
    b.bone('tail1', 'hips', [0, 1.02, -0.86], [0, 0.96, -0.95]);
    b.p(
      S.ell([0, 0.98, -0.08], [0.36, 0.4, 0.6], { bone: 'spine', k: 0.12, color: fur, bb: 0.15 }),
      S.ell([0, 0.78, -0.05], [0.3, 0.2, 0.42], { bone: 'belly', k: 0.12, color: shade }),
      S.ell([0, 1.0, 0.38], [0.33, 0.4, 0.32], { bone: 'chest', k: 0.12, color: fur, bb: 0.15 }),
      S.ell([0, 1.0, -0.6], [0.32, 0.36, 0.3], { bone: 'hips', k: 0.1, color: fur }),
      S.ell([0, 1.2, 0.3], [0.24, 0.16, 0.3], { bone: 'chest', k: 0.1, color: fur }),
      S.ell([0, 0.66, 0.0], [0.28, 0.12, 0.6], { paint: true, soft: 0.1, color: shade }),
      // Cuello largo y cabeza pequeña con hocico largo
      S.cone([0, 1.06, 0.52], [0, 1.16, 0.9], 0.25, 0.16, { bone: 'neck', k: 0.1, color: fur }),
      S.ell([0, 1.2, 0.96], [0.14, 0.13, 0.15], { bone: 'head', k: 0.06, color: fur }),
      S.cone([0, 1.16, 1.02], [0, 1.1, 1.27], 0.1, 0.058, { bone: 'head', k: 0.05, sx: 0.9, color: fur }),
      S.ell([0, 1.12, 1.322], [0.048, 0.036, 0.03], { bone: 'head', k: 0.012, color: dark, fur: 0, cb: 0.004 }),
      S.cone([0, 1.075, 1.0], [0, 1.05, 1.23], 0.07, 0.045, { bone: 'jaw', k: 0.03, color: shade }),
      S.cone([0, 1.085, 1.1], [0, 1.075, 1.25], 0.007, 0.006, { sub: true, k: 0.01, sx: 7 }),
      S.cone([0, 1.08, 1.1], [0, 1.07, 1.26], 0.02, 0.015, { paint: true, soft: 0.012, sx: 5, color: dark }),
    );
    sym((s, L) => b.p(
      S.sph([s * 0.072, 1.235, 1.09], 0.015, { sub: true, k: 0.01 }),
      S.ell([s * 0.19, 0.92, 0.42], [0.13, 0.26, 0.2], { bone: 'fl' + L + '0', k: 0.08, color: fur }),
      S.ell([s * 0.17, 0.92, -0.62], [0.14, 0.28, 0.22], { bone: 'hl' + L + '0', k: 0.08, color: fur }),
    ));
    const paw = (front) => (s, L, P, nm) => {
      b.p(S.ell([P[3][0], 0.055, P[2][2] + (front ? 0.08 : 0.06)], [0.11, 0.06, 0.15], { bone: nm + 2, k: 0.03, color: fur, bb: 0.02 }));
      b.p(S.ell([P[3][0], 0.012, P[2][2] + (front ? 0.08 : 0.06)], [0.09, 0.02, 0.12], { paint: true, soft: 0.02, color: pad, paintFur: true, fur: 0.2 }));
      const cl = [];
      for (let k = 0; k < 5; k++) { const x = P[3][0] + (k - 2) * 0.032, z = P[2][2] + (front ? 0.21 : 0.19); cl.push(F.horn([[x, 0.05, z], [x, 0.03, z + 0.03], [x, 0.005, z + 0.045]], 0.011, 0.002, dark, 5)); }
      b.part(U.merge(cl), { bone: nm + 2 });
    };
    limb(b, 'fl', 'chest', [[0.22, 0.95, 0.45], [0.22, 0.58, 0.36], [0.22, 0.12, 0.44], [0.22, 0.0, 0.62]], [0.17, 0.13, 0.1, 0.09], { front: true, color: fur, foot: paw(true), toeFlex: 0.7, knobs: false, k: [0.08, 0.05, 0.04] });
    limb(b, 'hl', 'hips', [[0.2, 0.98, -0.62], [0.2, 0.58, -0.46], [0.2, 0.14, -0.66], [0.2, 0.0, -0.44]], [0.19, 0.13, 0.1, 0.09], { color: fur, foot: paw(false), toeFlex: 0.5, knobs: false, k: [0.08, 0.05, 0.04] });
    b.p(S.ell([0, 1.0, -0.9], [0.06, 0.06, 0.07], { bone: 'tail1', k: 0.05, color: fur }));
    sym((s, L) => {
      b.part(F.eye(0.012, [s * 0.072, 1.235, 1.094], [s * 0.45, 0.15, 0.88], 0x1a0e08), { bone: 'head' });
      b.part(F.ear([s * 0.1, 1.285, 0.93], [s * 0.6, 1, -0.2], [s * 0.3, 0.1, 1], 0.065, 0.05, fur, shade, { cup: 0.7, tip: 1.0 }), { bone: 'ear' + L, fur: 1 });
    });
    return b.done({
      h: 0.036, cb: 0.03, bb: 0.08, ao: 0.05,
      spine: ['spine', 'chest'], neck: ['neck'], tail: ['tail1'],
      gaits: {
        walk: { v: [0, 1.4], stride: 0.95, duty: 0.66, lift: 0.1 },
        gallop: { v: [1.4, 99], stride: 1.9, duty: 0.4, lift: 0.14, off: { fl: 0.5, fr: 0.62, hl: 0.0, hr: 0.12 } },
      },
      half: 0.7, footReach: 0.3, bob: 0.02, crouch: 0.12, tailAmp: 0.05, jawOpen: 0.5, lungeNeck: 0.3, lungeHead: 0.25,
    });
  };

  // ------------------------------------------------------------------ cadenas curvas (colas, cuellos, serpientes)
  // Huesos en los puntos de control y conos cortos a lo largo de la curva suave que los une (sin codos)
  function chain(b, pre, parent, pts, r, o) {
    o = o || {};
    const n = pts.length - 1, V = pts.map((p) => new V3(...p));
    for (let i = 0; i < n; i++) b.bone(pre + (i + 1), i ? pre + i : parent, pts[i], i === n - 1 ? pts[n] : null);
    const curve = new THREE.CatmullRomCurve3(V), seg = o.seg || n * 4;
    const rad = typeof r === 'function' ? r : (t) => U.lerp(r[0], r[1], t);
    for (let k = 0; k < seg; k++) {
      const t0 = k / seg, t1 = (k + 1) / seg, A = curve.getPointAt(t0), C = curve.getPointAt(t1), mid = A.clone().add(C).multiplyScalar(0.5);
      let bi = 0, bd = 1e9;
      for (let i = 0; i < n; i++) { const d = segDist(mid, V[i], V[i + 1]); if (d < bd) { bd = d; bi = i; } }
      b.p(S.cone(A.toArray(), C.toArray(), rad(t0), rad(t1), { bone: pre + (bi + 1), k: o.k ?? 0.008, color: typeof o.color === 'function' ? o.color(t0) : o.color, sx: o.sx, sy: o.sy, up: o.up, ps: o.ps, bb: o.bb, fur: o.fur, pat: o.pat }));
    }
    return Array.from({ length: n }, (_, i) => pre + (i + 1));
  }
  function segDist(p, a, e) {
    const ab = new V3().subVectors(e, a), t = U.clamp(new V3().subVectors(p, a).dot(ab) / (ab.lengthSq() || 1e-9), 0, 1);
    return p.distanceTo(a.clone().addScaledVector(ab, t));
  }

  // ------------------------------------------------------------------ mono capuchino
  F.defs.monkey = function () {
    const b = R.animal('monkey');
    const body = 0x553b27, limbC = 0x362619, cream = 0xe8d4aa, skin = 0xc49a78, cap = 0x1c1510;
    b.bone('hips', null, [0, 0.3, -0.15]);
    b.bone('spine', 'hips', [0, 0.31, 0.0]);
    b.bone('chest', 'spine', [0, 0.31, 0.12]);
    b.bone('neck', 'chest', [0, 0.34, 0.19]);
    b.bone('head', 'neck', [0, 0.385, 0.245], [0, 0.37, 0.33]);
    b.bone('jaw', 'head', [0, 0.355, 0.27], [0, 0.35, 0.305]);
    b.p(
      S.ell([0, 0.3, -0.01], [0.078, 0.082, 0.16], { bone: 'spine', k: 0.04, color: body, bb: 0.05 }),
      S.ell([0, 0.3, 0.11], [0.082, 0.084, 0.09], { bone: 'chest', k: 0.04, color: body }),
      S.ell([0, 0.3, -0.13], [0.072, 0.074, 0.08], { bone: 'hips', k: 0.04, color: body }),
      S.ell([0, 0.29, 0.15], [0.078, 0.07, 0.06], { paint: true, soft: 0.025, color: cream }),
      S.cone([0, 0.32, 0.16], [0, 0.36, 0.23], 0.043, 0.039, { bone: 'neck', k: 0.03, color: cream }),
      // Cabeza redonda: casquete negro, cerco de pelo claro y la cara desnuda con el hocico corto
      S.sph([0, 0.39, 0.25], 0.047, { bone: 'head', k: 0.03, color: cream }),
      S.ell([0, 0.375, 0.286], [0.032, 0.036, 0.02], { bone: 'head', k: 0.02, color: skin, fur: 0.25 }),
      S.ell([0, 0.36, 0.298], [0.021, 0.017, 0.016], { bone: 'head', k: 0.012, color: skin, fur: 0.15 }),
      S.ell([0, 0.35, 0.29], [0.016, 0.009, 0.014], { bone: 'jaw', k: 0.01, color: skin, fur: 0.15 }),
      S.ell([0, 0.392, 0.296], [0.029, 0.007, 0.008], { bone: 'head', k: 0.008, color: skin, fur: 0.2 }),
      S.ell([0, 0.428, 0.245], [0.044, 0.027, 0.045], { paint: true, soft: 0.012, color: cap }),
      S.cone([0, 0.405, 0.28], [0, 0.42, 0.2], 0.012, 0.02, { paint: true, soft: 0.01, color: cap }),
    );
    sym((s) => b.p(
      S.sph([s * 0.014, 0.384, 0.301], 0.0072, { sub: true, k: 0.004 }),
      S.ell([s * 0.046, 0.385, 0.245], [0.007, 0.014, 0.012], { bone: 'head', k: 0.006, color: skin, fur: 0.2 }),
    ));
    const hand = (s, L, P, nm) => b.p(S.ell([P[3][0], 0.012, (P[2][2] + P[3][2]) / 2 + 0.004], [0.02, 0.012, 0.03], { bone: nm + 2, k: 0.01, color: limbC, bb: 0.01, fur: 0.4 }));
    limb(b, 'fl', 'chest', [[0.07, 0.29, 0.13], [0.07, 0.17, 0.1], [0.07, 0.025, 0.13], [0.07, 0.0, 0.18]], [0.037, 0.03, 0.021, 0.018], { front: true, colors: [cream, limbC, limbC], foot: hand, knobs: false, k: [0.03, 0.015, 0.012] });
    limb(b, 'hl', 'hips', [[0.062, 0.29, -0.16], [0.062, 0.17, -0.07], [0.062, 0.035, -0.18], [0.062, 0.0, -0.1]], [0.043, 0.032, 0.021, 0.018], { colors: [body, limbC, limbC], foot: hand, knobs: false, k: [0.03, 0.015, 0.012] });
    const tail = chain(b, 'tail', 'hips', [[0, 0.31, -0.2], [0, 0.26, -0.3], [0, 0.25, -0.42], [0, 0.3, -0.52], [0, 0.38, -0.55], [0, 0.42, -0.49]], [0.022, 0.011], { color: (t) => (t < 0.5 ? body : limbC), seg: 24 });
    sym((s) => b.part(F.eye(0.0068, [s * 0.014, 0.384, 0.302], [s * 0.2, 0.05, 1], 0x4a2a14, { pupilR: 0.42, irisR: 0.9 }), { bone: 'head' }));
    return b.done({
      h: 0.0105, cb: 0.012, bb: 0.03, ao: 0.012,
      spine: ['spine', 'chest'], neck: ['neck'], tail,
      gaits: {
        walk: { v: [0, 1.8], stride: 0.34, duty: 0.62, lift: 0.045 },
        bound: { v: [1.8, 99], stride: 0.9, duty: 0.35, lift: 0.07 },
      },
      half: 0.2, footReach: 0.1, bob: 0.007, tailAmp: 0.25, tailFreq: 1.6, jawOpen: 0.5, lungeNeck: 0.2,
    });
  };

  // ------------------------------------------------------------------ caimán (y, más grande, el Gran Caimán)
  F.defs.caiman = function (big) {
    const b = R.animal(big ? 'bigcaiman' : 'caiman');
    const back = big ? 0x2a3420 : 0x3e4a2a, side = big ? 0x46552f : 0x5a6a3a, belly = big ? 0xc8bf92 : 0xd8d0a4, dark = 0x1c2214, tooth = 0xeee8d4, mouth = 0xb07060;
    b.bone('hips', null, [0, 0.26, -0.45]);
    b.bone('spine', 'hips', [0, 0.27, 0.0]);
    b.bone('chest', 'spine', [0, 0.27, 0.35]);
    b.bone('neck', 'chest', [0, 0.27, 0.52]);
    b.bone('head', 'neck', [0, 0.29, 0.62], [0, 0.22, 1.4]);
    b.bone('jaw', 'head', [0, 0.2, 0.62], [0, 0.17, 1.35]);
    b.bone('tail1', 'hips', [0, 0.26, -0.62]);
    b.bone('tail2', 'tail1', [0, 0.24, -1.0]);
    b.bone('tail3', 'tail2', [0, 0.2, -1.4]);
    b.bone('tail4', 'tail3', [0, 0.16, -1.8], [0, 0.12, -2.25]);
    b.p(
      S.ell([0, 0.26, -0.05], [0.2, 0.115, 0.5], { bone: 'spine', k: 0.06, color: side, bb: 0.12 }),
      S.ell([0, 0.26, 0.35], [0.17, 0.105, 0.22], { bone: 'chest', k: 0.05, color: side }),
      S.ell([0, 0.25, -0.45], [0.17, 0.105, 0.2], { bone: 'hips', k: 0.05, color: side }),
      S.ell([0, 0.36, -0.05], [0.15, 0.05, 0.6], { paint: true, soft: 0.05, color: back }),
      S.ell([0, 0.15, 0.0], [0.17, 0.05, 0.6], { paint: true, soft: 0.04, color: belly, pat: 0.4, paintPat: true }),
      S.cone([0, 0.27, 0.45], [0, 0.28, 0.66], 0.12, 0.105, { bone: 'neck', k: 0.05, sy: 0.75, color: side }),
      // Cabeza plana y ancha: cráneo, hocico largo, órbitas levantadas y la "gafa" entre los ojos
      S.cone([0, 0.29, 0.62], [0, 0.245, 1.12], 0.11, 0.06, { bone: 'head', k: 0.04, sx: 1.3, sy: 0.52, color: side, ps: 2 }),
      S.ell([0, 0.232, 1.24], [0.062, 0.036, 0.13], { bone: 'head', k: 0.04, color: side, ps: 2 }),
      S.ell([0, 0.26, 1.355], [0.036, 0.02, 0.03], { bone: 'head', k: 0.02, color: side, ps: 2 }),
      S.ell([0, 0.345, 0.765], [0.07, 0.012, 0.014], { bone: 'head', k: 0.015, color: back, ps: 2 }),
      S.cone([0, 0.2, 0.62], [0, 0.185, 1.33], 0.09, 0.044, { bone: 'jaw', k: 0.03, sx: 1.35, sy: 0.42, color: belly, ps: 2 }),
      S.cone([0, 0.21, 0.66], [0, 0.205, 1.33], 0.012, 0.008, { paint: true, soft: 0.01, sx: 7, color: dark }),
    );
    sym((s, L) => b.p(
      S.ell([s * 0.065, 0.352, 0.72], [0.034, 0.03, 0.04], { bone: 'head', k: 0.02, color: side, ps: 2 }),
      S.sph([s * 0.07, 0.37, 0.735], 0.019, { sub: true, k: 0.008 }),
      S.sph([s * 0.016, 0.275, 1.365], 0.007, { sub: true, k: 0.004 }),
    ));
    // Placas óseas del lomo (dos y cuatro filas) y cresta doble de la cola
    for (let i = 0; i < 12; i++) {
      const z = U.lerp(0.5, -0.58, i / 11), y = 0.355 - Math.abs(z) * 0.03;
      for (const [x, r] of [[0.035, 0.022], [-0.035, 0.022], [0.09, 0.018], [-0.09, 0.018]]) b.p(S.ell([x, y, z], [r, r * 0.8, r * 1.4], { bone: z > 0.2 ? 'chest' : z > -0.3 ? 'spine' : 'hips', k: 0.012, color: back }));
    }
    const legC = side, claw = 0x2a2620;
    const hand = (s, L, P, nm) => {
      b.p(S.ell([P[3][0] - s * 0.01, 0.018, P[3][2] - 0.02], [0.05, 0.016, 0.055], { bone: nm + 2, k: 0.015, color: legC, bb: 0.012, ps: 2 }));
      const cl = [];
      for (let k = 0; k < 4; k++) { const a = (k - 1.5) * 0.35, x = P[3][0] + Math.sin(a) * 0.05, z = P[3][2] + Math.cos(a) * 0.03; cl.push(F.horn([[x, 0.015, z], [x + Math.sin(a) * 0.02, 0.008, z + 0.02], [x + Math.sin(a) * 0.03, 0.0, z + 0.03]], 0.006, 0.0015, claw, 4)); }
      b.part(U.merge(cl), { bone: nm + 2 });
    };
    limb(b, 'fl', 'chest', [[0.13, 0.22, 0.36], [0.3, 0.2, 0.36], [0.32, 0.035, 0.4], [0.36, 0.0, 0.5]], [0.06, 0.04, 0.03, 0.022], { front: true, color: legC, ps: 2, foot: hand, knobs: false, k: [0.04, 0.02, 0.015], toeFlex: 0.3 });
    limb(b, 'hl', 'hips', [[0.14, 0.22, -0.42], [0.32, 0.22, -0.38], [0.33, 0.04, -0.5], [0.4, 0.0, -0.36]], [0.07, 0.045, 0.032, 0.024], { color: legC, ps: 2, foot: hand, knobs: false, k: [0.05, 0.02, 0.015], toeFlex: 0.3 });
    b.p(
      S.cone([0, 0.26, -0.6], [0, 0.24, -1.0], 0.13, 0.1, { bone: 'tail1', k: 0.05, sx: 0.9, color: side }),
      S.cone([0, 0.24, -1.0], [0, 0.2, -1.4], 0.1, 0.07, { bone: 'tail2', k: 0.03, sx: 0.7, color: side }),
      S.cone([0, 0.2, -1.4], [0, 0.16, -1.8], 0.07, 0.045, { bone: 'tail3', k: 0.02, sx: 0.6, color: side }),
      S.cone([0, 0.16, -1.8], [0, 0.12, -2.25], 0.045, 0.015, { bone: 'tail4', k: 0.015, sx: 0.55, color: side }),
    );
    // Cresta de escamas de la cola (dos filas que se juntan en una)
    const crest = [];
    for (let i = 0; i < 20; i++) {
      const t = i / 19, z = U.lerp(-0.66, -2.15, t), r = U.lerp(0.13, 0.03, t), y = U.lerp(0.26, 0.13, t) + r * 0.8, h = U.lerp(0.05, 0.025, t);
      for (const x of t < 0.45 ? [-0.035, 0.035] : [0]) crest.push(M.xf(M.fin([[0, 0], [0.018, h], [0.045, 0]], 0.01, back), x, y - 0.005, z, 0, Math.PI / 2, 0));
    }
    b.part(U.merge(crest), { bones: ['tail1', 'tail2', 'tail3', 'tail4'], fur: 0, pat: 0.5, ps: 2 });
    // Dientes de arriba y de abajo asomando por el borde de la boca
    const th = [];
    for (const s of [1, -1]) for (let k = 0; k < 11; k++) {
      const z = U.lerp(0.72, 1.3, k / 10), x = s * U.lerp(0.105, 0.045, k / 10);
      th.push(M.xf(M.paint(new THREE.ConeGeometry(0.008, 0.026, 5), tooth), x, 0.2, z, Math.PI));
    }
    b.part(U.merge(th), { bone: 'head' });
    sym((s) => b.part(F.eye(0.017, [s * 0.07, 0.366, 0.735], [s * 0.6, 0.6, 0.5], 0xc8b040, { slit: 0.7, pupilR: 0.5 }), { bone: 'head' }));
    void mouth;
    const glow = big ? new THREE.MeshStandardMaterial({ color: 0xffe070, emissive: 0xffa020, emissiveIntensity: 1.2, roughness: 0.3 }) : null;
    return b.done({
      extra: big ? (rig) => { for (const s of [1, -1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.0175, 10, 8), glow); e.position.set(s * 0.07, 0.366 - 0.29, 0.737 - 0.62); rig.B.head.add(e); } rig.glow = glow; } : null,
      h: 0.0225, cb: 0.02, bb: 0.06, ao: 0.03,
      spine: ['spine', 'chest'], neck: ['neck'], tail: ['tail1', 'tail2', 'tail3', 'tail4'],
      gaits: { walk: { v: [0, 99], stride: 0.5, duty: 0.7, lift: 0.07, off: { fl: 0.0, hr: 0.0, fr: 0.5, hl: 0.5 } } },
      half: 0.6, footReach: 0.12, bob: 0.004, tailAmp: 0.12, tailFreq: 1.2, jawOpen: 0.55, lungeNeck: 0.15, lungeHead: -0.1, lungeFwd: 0.08,
      // Ondulación lateral de la columna y la cola al caminar
      anim: (rig, st, dt, ph, move) => {
        const w = Math.sin(ph * Math.PI * 2) * 0.12 * move;
        for (const [nm, k] of [['hips', -1], ['chest', 1.2], ['neck', -0.6], ['tail1', -0.8], ['tail2', 1], ['tail3', 1.2], ['tail4', 1.3]]) if (rig.B[nm]) rig.B[nm].rotation.y += w * k;
      },
    });
  };

  // ------------------------------------------------------------------ foca
  F.defs.seal = function () {
    const b = R.animal('seal');
    const grey = 0x7c7e86, dark = 0x55575e, belly = 0xb6b8bc, nose = 0x1a1a1c;
    b.bone('hips', null, [0, 0.2, -0.42]);
    b.bone('spine', 'hips', [0, 0.25, -0.08]);
    b.bone('chest', 'spine', [0, 0.28, 0.24]);
    b.bone('neck', 'chest', [0, 0.33, 0.44]);
    b.bone('head', 'neck', [0, 0.42, 0.58], [0, 0.39, 0.76]);
    b.bone('jaw', 'head', [0, 0.37, 0.64], [0, 0.365, 0.72]);
    b.bone('tail1', 'hips', [0, 0.16, -0.62]);
    sym((s, L) => {
      b.bone('fl' + L + '0', 'chest', [s * 0.15, 0.16, 0.34]);
      b.bone('fl' + L + '1', 'fl' + L + '0', [s * 0.2, 0.06, 0.4], [s * 0.26, 0.0, 0.5]);
      b.bone('rf' + L, 'tail1', [s * 0.05, 0.13, -0.74], [s * 0.1, 0.11, -0.98]);
    });
    b.p(
      S.ell([0, 0.24, -0.1], [0.22, 0.2, 0.44], { bone: 'spine', k: 0.08, color: grey, bb: 0.12 }),
      S.ell([0, 0.27, 0.24], [0.2, 0.2, 0.22], { bone: 'chest', k: 0.07, color: grey }),
      S.cone([0, 0.2, -0.42], [0, 0.14, -0.72], 0.17, 0.07, { bone: 'hips', k: 0.06, color: grey }),
      S.ell([0, 0.08, -0.05], [0.18, 0.08, 0.5], { paint: true, soft: 0.06, color: belly, pat: 0.3, paintPat: true }),
      S.cone([0, 0.3, 0.38], [0, 0.4, 0.57], 0.15, 0.115, { bone: 'neck', k: 0.06, color: grey }),
      S.sph([0, 0.425, 0.6], 0.105, { bone: 'head', k: 0.05, color: grey }),
      S.ell([0, 0.39, 0.695], [0.058, 0.048, 0.055], { bone: 'head', k: 0.04, color: grey }),
      S.ell([0, 0.398, 0.748], [0.026, 0.018, 0.012], { bone: 'head', k: 0.01, color: nose, fur: 0, pat: 0, cb: 0.004 }),
      S.ell([0, 0.368, 0.69], [0.04, 0.02, 0.04], { bone: 'jaw', k: 0.02, color: belly }),
    );
    sym((s, L) => b.p(
      S.sph([s * 0.055, 0.45, 0.665], 0.022, { sub: true, k: 0.01 }),
      S.ell([s * 0.012, 0.4, 0.758], [0.006, 0.01, 0.006], { sub: true, k: 0.004 }),
      S.ell([s * 0.03, 0.385, 0.735], [0.028, 0.024, 0.02], { bone: 'head', k: 0.015, color: grey }),
      // Aletas delanteras (dos tramos) y traseras
      S.cone([s * 0.13, 0.17, 0.34], [s * 0.2, 0.06, 0.4], 0.05, 0.035, { bone: 'fl' + L + '0', k: 0.03, sy: 0.6, color: dark }),
      S.cone([s * 0.2, 0.06, 0.4], [s * 0.26, 0.012, 0.5], 0.035, 0.03, { bone: 'fl' + L + '1', k: 0.015, sy: 0.35, sx: 1.4, color: dark }),
      S.cone([s * 0.05, 0.13, -0.72], [s * 0.1, 0.11, -0.98], 0.04, 0.06, { bone: 'rf' + L, k: 0.02, sy: 0.3, sx: 1.2, color: dark }),
    ));
    sym((s) => b.part(F.eye(0.024, [s * 0.055, 0.45, 0.668], [s * 0.6, 0.15, 0.8], 0x120c08, { pupilR: 0.6, irisR: 0.95, sclera: 0x100c08 }), { bone: 'head' }));
    whiskers(b, 'head', [0.03, 0.39, 0.735], 5, 0.07, 0xe8e6e0);
    return b.done({
      h: 0.02, cb: 0.02, bb: 0.07, ao: 0.03,
      spine: ['spine', 'chest'], neck: ['neck'], tail: ['tail1'],
      gaits: { walk: { v: [0, 99], stride: 0.5, duty: 0.6, lift: 0.0 } },
      half: 0.5, bob: 0.0, tailAmp: 0.1, jawOpen: 0.4, lungeNeck: 0.3,
      // En tierra avanza a saltitos: la columna se arquea en ola y las aletas empujan
      anim: (rig, st, dt, ph, move) => {
        const B = rig.B, a = ph * Math.PI * 2;
        B.hips.position.y += Math.max(0, Math.sin(a)) * 0.05 * move;
        B.hips.rotation.x += Math.sin(a) * 0.12 * move;
        B.spine.rotation.x += -Math.sin(a - 0.8) * 0.16 * move;
        B.chest.rotation.x += Math.sin(a - 1.6) * 0.14 * move;
        B.neck.rotation.x += -0.25 - Math.sin(a - 2.2) * 0.1 * move;
        for (const L of ['L', 'R']) {
          B['fl' + L + '0'].rotation.x = Math.sin(a + 1) * 0.5 * move;
          B['fl' + L + '0'].rotation.z = (L === 'L' ? 1 : -1) * 0.15;
          B['rf' + L].rotation.x = Math.sin(a * 0.5 + rig.t) * 0.08;
          B['rf' + L].rotation.y = (L === 'L' ? -1 : 1) * (0.1 + Math.sin(rig.t * 1.3) * 0.08);
        }
      },
    });
  };

  // ------------------------------------------------------------------ cangrejo (y cangrejo de lava)
  F.defs.crab = function (lava) {
    const b = R.animal(lava ? 'lavacrab' : 'crab');
    const top = lava ? 0x231c1a : 0xa8391a, shell = lava ? 0x352c28 : 0xcc5428, under = lava ? 0x2a2320 : 0xeccaa2, legC = lava ? 0x2e2622 : 0xd8622c, tip = lava ? 0x120c0a : 0x3a1a10;
    b.bone('body', null, [0, 0.19, 0]);
    b.p(
      S.ell([0, 0.2, 0.0], [0.24, 0.075, 0.17], { bone: 'body', k: 0.03, color: shell }),
      S.ell([0, 0.232, -0.01], [0.2, 0.05, 0.14], { bone: 'body', k: 0.03, color: top }),
      S.ell([0, 0.165, 0.0], [0.2, 0.05, 0.14], { bone: 'body', k: 0.03, color: under, pat: 0 }),
      S.ell([0, 0.212, 0.135], [0.17, 0.04, 0.05], { bone: 'body', k: 0.02, color: shell }),
      S.ell([0, 0.185, 0.165], [0.05, 0.028, 0.02], { bone: 'body', k: 0.012, color: lava ? 0x1a1412 : 0x8a3a20 }),
    );
    sym((s) => b.p(
      S.ell([s * 0.065, 0.262, -0.01], [0.012, 0.012, 0.085], { sub: true, k: 0.012 }),
      S.ell([s * 0.13, 0.245, 0.06], [0.05, 0.02, 0.045], { bone: 'body', k: 0.02, color: top }),
    ));
    if (lava) for (let i = 0; i < 7; i++) { const a = i * 0.9 + 0.3, x = Math.cos(a) * 0.13, z = Math.sin(a) * 0.08 - 0.01; b.p(S.cone([x, 0.24, z], [x * 1.2, 0.33 + (i % 3) * 0.02, z * 1.2], 0.03, 0.006, { bone: 'body', k: 0.015, color: 0x161010, pat: 0.3 })); }
    // Patas: cuatro por lado (se esconden bajo el caparazón y se abren hacia fuera)
    const LZ = [0.07, 0.01, -0.05, -0.11];
    sym((s, L) => LZ.forEach((z, i) => {
      const J = [[0.18, 0.17, z], [0.33, 0.26, z * 1.35], [0.43, 0.1, z * 1.55], [0.47, 0.0, z * 1.65]].map((p) => mx(p, s)), nm = 'lg' + L + i;
      for (let k = 0; k < 3; k++) b.bone(nm + k, k ? nm + (k - 1) : 'body', J[k], k === 2 ? J[3] : null);
      b.p(
        S.cone(J[0], J[1], 0.024, 0.02, { bone: nm + 0, k: 0.015, sy: 0.75, color: legC, bb: 0.012 }),
        S.cone(J[1], J[2], 0.019, 0.013, { bone: nm + 1, k: 0.01, sy: 0.8, color: legC, bb: 0.01 }),
        S.cone(J[2], J[3], 0.012, 0.003, { bone: nm + 2, k: 0.006, color: tip, bb: 0.008 }),
      );
    }));
    // Pinzas: brazo, palma y dedo móvil
    sym((s, L) => {
      const nm = 'cl' + L;
      b.bone(nm + 0, 'body', mx([0.13, 0.17, 0.13], s));
      b.bone(nm + 1, nm + 0, mx([0.23, 0.19, 0.27], s), mx([0.24, 0.19, 0.46], s));
      b.bone(nm + 2, nm + 1, mx([0.268, 0.215, 0.43], s), mx([0.255, 0.21, 0.52], s));
      b.p(
        S.cone(mx([0.13, 0.17, 0.13], s), mx([0.23, 0.19, 0.27], s), 0.028, 0.03, { bone: nm + 0, k: 0.015, color: legC }),
        S.ell(mx([0.245, 0.2, 0.37], s), [0.048, 0.042, 0.075], { bone: nm + 1, k: 0.02, color: shell }),
        S.cone(mx([0.235, 0.19, 0.43], s), mx([0.232, 0.18, 0.52], s), 0.022, 0.006, { bone: nm + 1, k: 0.01, color: tip }),
        S.cone(mx([0.268, 0.215, 0.43], s), mx([0.255, 0.21, 0.52], s), 0.018, 0.005, { bone: nm + 2, k: 0.006, color: tip, bb: 0.006 }),
      );
      b.part(M.tube([mx([0.045, 0.22, 0.15], s), mx([0.05, 0.26, 0.165], s), mx([0.055, 0.285, 0.17], s)], [0.008, 0.006], 6, legC, 6), { bone: 'body' });
      b.part(F.eye(0.016, mx([0.056, 0.29, 0.172], s), [s * 0.4, 0.5, 0.6], 0x050404, { sclera: 0x080606, pupilR: 1, irisR: 1 }), { bone: 'body' });
    });
    return b.done({
      h: 0.011, cb: 0.012, bb: 0.03, ao: 0.012,
      gaits: { walk: { v: [0, 99], stride: 0.22, duty: 0.5, lift: 0 } },
      half: 0.2, bob: 0,
      // Corre de lado: las patas se levantan en dos grupos alternos y las pinzas se abren y se cierran
      anim: (rig, st, dt, ph, move) => {
        const B = rig.B, t = rig.t, a = ph * Math.PI * 2;
        for (const L of ['L', 'R']) {
          const s = L === 'L' ? 1 : -1;
          for (let i = 0; i < 4; i++) {
            const p = a + ((i + (L === 'L' ? 0 : 1)) % 2) * Math.PI, up = Math.max(0, Math.sin(p));
            B['lg' + L + i + '0'].rotation.z = s * up * 0.4 * move + s * Math.sin(t * 2 + i) * 0.02;
            B['lg' + L + i + '0'].rotation.y = Math.cos(p) * 0.18 * move;
            B['lg' + L + i + '1'].rotation.z = -s * up * 0.25 * move;
          }
          const open = 0.12 + Math.max(0, Math.sin(t * 1.3 + (s > 0 ? 0 : 1.7))) * 0.25 + (st.jaw || 0) * 0.45;
          B['cl' + L + '2'].rotation.x = -open;
          B['cl' + L + '0'].rotation.y = s * (Math.sin(t * 0.8 + s) * 0.08 - (st.lunge || 0) * 0.3);
          B['cl' + L + '0'].rotation.x = -(st.lunge || 0) * 0.4;
        }
        B.body.position.y += Math.abs(Math.sin(a * 2)) * 0.01 * move;
      },
    });
  };

  // ------------------------------------------------------------------ serpiente
  F.defs.snake = function () {
    const b = R.animal('snake');
    const green = 0x5e7e2c, belly = 0xd8cc88, headC = 0x4a6a22, r = 0.05;
    b.bone('head', null, [0, 0.045, 0.8], [0, 0.04, 0.96]);
    b.bone('jaw', 'head', [0, 0.03, 0.83], [0, 0.028, 0.93]);
    // Columna de la cabeza a la cola: la onda del cuerpo nace detrás de la cabeza
    const n = 14, spine = [];
    for (let i = 0; i < n; i++) {
      const z = U.lerp(0.76, -0.85, i / n), z2 = U.lerp(0.76, -0.85, (i + 1) / n);
      spine.push('sp' + (i + 1));
      b.bone('sp' + (i + 1), i ? 'sp' + i : 'head', [0, 0.045, z], i === n - 1 ? [0, 0.04, -0.9] : null);
      void z2;
    }
    // Cuerpo: tubo que se estrecha en el cuello y se afila en la cola, algo aplanado
    const pts = [];
    for (let k = 0; k <= 20; k++) pts.push([0, 0, U.lerp(0.84, -0.92, k / 20)]);
    const tube = M.tube(pts, (t) => r * (t < 0.08 ? U.lerp(0.75, 0.85, t / 0.08) : t < 0.6 ? U.lerp(0.85, 1, U.smooth(0.08, 0.3, t)) : U.lerp(1, 0.1, U.smooth(0.6, 1, t))), 14, green, 90);
    tube.scale(1, 0.82, 1); tube.translate(0, r * 0.82, 0);
    M.recolor(tube, (x, y, z, nx, ny) => (ny < -0.35 ? belly : ny < 0 ? 0x9aa850 : null));
    b.part(tube, { bones: spine.concat(['head']), fur: 0, pat: 1 });
    // Cabeza triangular (esculpida) con ojos, fosas y lengua bífida
    b.p(
      S.ell([0, 0.048, 0.86], [0.052, 0.032, 0.065], { bone: 'head', k: 0.02, color: headC }),
      S.cone([0, 0.05, 0.87], [0, 0.044, 0.95], 0.036, 0.02, { bone: 'head', k: 0.015, sx: 1.25, sy: 0.72, color: headC }),
      S.ell([0, 0.028, 0.88], [0.034, 0.012, 0.06], { bone: 'jaw', k: 0.012, color: belly, pat: 0.3 }),
      S.cone([0, 0.035, 0.84], [0, 0.034, 0.95], 0.003, 0.002, { sub: true, k: 0.004, sx: 12 }),
    );
    sym((s) => b.p(S.ell([s * 0.03, 0.062, 0.895], [0.014, 0.012, 0.018], { bone: 'head', k: 0.01, color: headC }), S.sph([s * 0.012, 0.052, 0.955], 0.004, { sub: true, k: 0.003 })));
    sym((s) => b.part(F.eye(0.009, [s * 0.034, 0.064, 0.9], [s * 0.8, 0.3, 0.4], 0xd8c020, { slit: 0.75, pupilR: 0.55 }), { bone: 'head' }));
    b.part(U.merge([1, -1].map((s) => M.tube([[0, 0.034, 0.93], [0, 0.034, 0.99], [s * 0.012, 0.036, 1.02]], [0.003, 0.0012], 4, 0xc01828, 5))), { bone: 'jaw' });
    return b.done({
      h: 0.005, cb: 0.008, bb: 0.02, ao: 0.006, lod: false,
      gaits: { walk: { v: [0, 99], stride: 0.42, duty: 0.5, lift: 0 } },
      half: 0.4, bob: 0, jawOpen: 0.6,
      // Ondulación serpenteante: una onda que recorre el cuerpo de la cabeza a la cola
      anim: (rig, st, dt, ph, move) => {
        const B = rig.B, a = ph * Math.PI * 2, t = rig.t, amp = 0.05 + move * 0.13;
        spine.forEach((nm, i) => { const k = i / n; B[nm].rotation.y = Math.sin(a * 1.0 + t * 0.4 * (1 - move) - i * 0.85) * amp * (0.6 + k * 0.8); });
        B.head.rotation.x = -0.12 - (st.lunge || 0) * 0.5;
        B.head.rotation.y = -Math.sin(a - 0.85) * amp * 0.5;
      },
    });
  };

  // ------------------------------------------------------------------ rana venenosa
  F.defs.frog = function () {
    const b = R.animal('frog');
    const blue = 0x2a6ae0, dark = 0x1a46a8, belly = 0x5a8af0;
    b.bone('hips', null, [0, 0.07, -0.04]);
    b.bone('chest', 'hips', [0, 0.08, 0.03]);
    b.bone('head', 'chest', [0, 0.09, 0.07], [0, 0.08, 0.13]);
    b.p(
      S.ell([0, 0.075, -0.01], [0.055, 0.042, 0.075], { bone: 'hips', k: 0.02, color: blue }),
      S.ell([0, 0.085, 0.06], [0.05, 0.036, 0.05], { bone: 'head', k: 0.02, color: blue }),
      S.ell([0, 0.075, 0.105], [0.035, 0.024, 0.03], { bone: 'head', k: 0.015, color: blue }),
      S.ell([0, 0.05, 0.0], [0.045, 0.02, 0.07], { paint: true, soft: 0.015, color: belly, pat: 0.3, paintPat: true }),
      S.cone([0, 0.068, 0.07], [0, 0.066, 0.125], 0.003, 0.003, { paint: true, soft: 0.003, sx: 12, color: 0x0a1a40 }),
    );
    sym((s, L) => {
      b.p(S.ell([s * 0.032, 0.105, 0.07], [0.02, 0.018, 0.02], { bone: 'head', k: 0.01, color: blue }));
      b.part(F.eye(0.016, [s * 0.034, 0.108, 0.072], [s * 0.8, 0.35, 0.35], 0x050508, { sclera: 0x050508, pupilR: 1, irisR: 1 }), { bone: 'head' });
      // Patas traseras dobladas en Z y delanteras cortas
      const H = [[0.045, 0.06, -0.06], [0.1, 0.05, -0.01], [0.075, 0.025, -0.085], [0.12, 0.0, -0.03]].map((p) => mx(p, s)), nm = 'hl' + L;
      for (let k = 0; k < 3; k++) b.bone(nm + k, k ? nm + (k - 1) : 'hips', H[k], k === 2 ? H[3] : null);
      b.p(
        S.cone(H[0], H[1], 0.022, 0.016, { bone: nm + 0, k: 0.012, color: blue }),
        S.cone(H[1], H[2], 0.015, 0.01, { bone: nm + 1, k: 0.008, color: dark, bb: 0.008 }),
        S.cone(H[2], H[3], 0.01, 0.006, { bone: nm + 2, k: 0.006, color: dark, bb: 0.006 }),
        S.sph(H[3], 0.009, { bone: nm + 2, k: 0.004, color: dark }),
      );
      const Fr = [[0.04, 0.06, 0.05], [0.065, 0.03, 0.075], [0.075, 0.0, 0.1]].map((p) => mx(p, s)), fn = 'fl' + L;
      b.bone(fn + 0, 'chest', Fr[0]); b.bone(fn + 1, fn + 0, Fr[1], Fr[2]);
      b.p(S.cone(Fr[0], Fr[1], 0.011, 0.008, { bone: fn + 0, k: 0.008, color: blue }), S.cone(Fr[1], Fr[2], 0.008, 0.006, { bone: fn + 1, k: 0.006, color: dark, bb: 0.006 }), S.sph(Fr[2], 0.008, { bone: fn + 1, k: 0.004, color: dark }));
    });
    return b.done({
      h: 0.006, cb: 0.008, bb: 0.015, ao: 0.006, lod: false,
      gaits: { walk: { v: [0, 99], stride: 0.35, duty: 0.5, lift: 0 } },
      half: 0.08, bob: 0,
      // Salta: estira las patas traseras, se eleva y vuelve a plegarse
      anim: (rig, st, dt, ph, move) => {
        const B = rig.B, hop = move > 0.05 ? Math.sin(ph * Math.PI) : 0, t = rig.t;
        B.hips.position.y += hop * 0.1 * move;
        B.hips.rotation.x = -hop * 0.35 * move;
        B.chest.scale.y = 1 + Math.sin(t * 7) * 0.04;
        for (const L of ['L', 'R']) {
          B['hl' + L + '0'].rotation.x = hop * 0.9 * move;
          B['hl' + L + '1'].rotation.x = -hop * 1.1 * move;
          B['hl' + L + '2'].rotation.x = hop * 0.7 * move;
          B['fl' + L + '0'].rotation.x = -hop * 0.7 * move;
        }
      },
    });
  };

  // ------------------------------------------------------------------ salamandra de fuego
  F.defs.salamander = function () {
    const b = R.animal('salamander');
    const black = 0x221a16, orange = 0xe8801c, belly = 0x3a2a20;
    b.bone('hips', null, [0, 0.075, -0.1]);
    b.bone('spine', 'hips', [0, 0.08, 0.02]);
    b.bone('chest', 'spine', [0, 0.08, 0.12]);
    b.bone('head', 'chest', [0, 0.085, 0.2], [0, 0.075, 0.32]);
    b.p(
      S.ell([0, 0.075, 0.0], [0.05, 0.036, 0.16], { bone: 'spine', k: 0.025, color: black, bb: 0.04 }),
      S.ell([0, 0.08, 0.12], [0.045, 0.034, 0.06], { bone: 'chest', k: 0.02, color: black }),
      S.ell([0, 0.075, -0.1], [0.045, 0.033, 0.06], { bone: 'hips', k: 0.02, color: black }),
      S.ell([0, 0.085, 0.235], [0.045, 0.026, 0.06], { bone: 'head', k: 0.02, color: black }),
      S.ell([0, 0.08, 0.285], [0.03, 0.018, 0.03], { bone: 'head', k: 0.015, color: black }),
      S.ell([0, 0.045, 0.0], [0.04, 0.012, 0.15], { paint: true, soft: 0.012, color: belly, pat: 0.2, paintPat: true }),
      S.cone([0, 0.074, 0.2], [0, 0.072, 0.305], 0.003, 0.003, { paint: true, soft: 0.003, sx: 12, color: 0x0a0806 }),
    );
    sym((s) => b.p(S.ell([s * 0.026, 0.096, 0.205], [0.011, 0.008, 0.02], { bone: 'head', k: 0.01, color: orange, pat: 0 }), S.ell([s * 0.03, 0.098, 0.255], [0.014, 0.013, 0.014], { bone: 'head', k: 0.008, color: black })));
    sym((s) => b.part(F.eye(0.011, [s * 0.031, 0.1, 0.256], [s * 0.7, 0.5, 0.4], 0x080606, { sclera: 0x080606, pupilR: 1, irisR: 1 }), { bone: 'head' }));
    const tail = chain(b, 'tail', 'hips', [[0, 0.075, -0.16], [0, 0.065, -0.33], [0, 0.05, -0.5], [0, 0.035, -0.64], [0, 0.025, -0.76]], [0.033, 0.006], { color: black, seg: 20 });
    const foot = (s, L, P, nm) => b.p(S.ell([P[3][0], 0.006, P[3][2]], [0.018, 0.006, 0.016], { bone: nm + 2, k: 0.006, color: black, bb: 0.006 }));
    limb(b, 'fl', 'chest', [[0.04, 0.07, 0.12], [0.085, 0.07, 0.13], [0.095, 0.012, 0.15], [0.115, 0.0, 0.19]], [0.016, 0.012, 0.009, 0.007], { front: true, color: black, foot, knobs: false, k: [0.012, 0.006, 0.005], toeFlex: 0.3 });
    limb(b, 'hl', 'hips', [[0.04, 0.07, -0.1], [0.095, 0.07, -0.1], [0.105, 0.012, -0.13], [0.135, 0.0, -0.08]], [0.018, 0.013, 0.009, 0.007], { color: black, foot, knobs: false, k: [0.012, 0.006, 0.005], toeFlex: 0.3 });
    return b.done({
      h: 0.0075, cb: 0.008, bb: 0.02, ao: 0.008, lod: false,
      spine: ['spine', 'chest'], tail,
      gaits: { walk: { v: [0, 99], stride: 0.16, duty: 0.66, lift: 0.025, off: { fl: 0.0, hr: 0.0, fr: 0.5, hl: 0.5 } } },
      half: 0.15, footReach: 0.04, bob: 0, tailAmp: 0.15, tailFreq: 2,
      anim: (rig, st, dt, ph, move) => {
        const w = Math.sin(ph * Math.PI * 2) * 0.16 * move;
        for (const [nm, k] of [['hips', -1], ['chest', 1.2], ['head', -0.7]]) rig.B[nm].rotation.y += w * k;
        tail.forEach((nm, i) => (rig.B[nm].rotation.y += w * (i % 2 ? 1 : -1) * 0.8));
      },
    });
  };

  // ------------------------------------------------------------------ animales marinos
  // Aleta vertical (contorno con x hacia atrás, y hacia arriba) y horizontal (x hacia fuera, y hacia delante)
  // Aleta de contorno curvo (el polígono se suaviza con una curva cerrada) y bordes redondeados
  F.fin = function (pts, th, color, q = 1) {
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, y]) => new V3(x, y, 0)), true, 'centripetal', 0.5);
    const sh = new THREE.Shape(curve.getSpacedPoints(Math.max(Math.round(12 * q), Math.round(pts.length * 7 * q))).slice(0, -1).map((p) => new THREE.Vector2(p.x, p.y)));
    const g = new THREE.ExtrudeGeometry(sh, { depth: th * 0.4, bevelEnabled: true, bevelThickness: th * 0.3, bevelSize: th * 0.35, bevelSegments: q < 1 ? 1 : 2, curveSegments: 4 });
    g.translate(0, 0, -th * 0.2);
    return M.paint(g, color, 0.01);
  };
  const vFin = (pts, th, color, x, y, z, rz = 0) => M.xf(F.fin(pts, th, color), x, y, z, 0, Math.PI / 2, rz);
  const hFin = (pts, th, color, x, y, z, tilt = 0) => M.xf(F.fin(pts, th, color), x, y, z, Math.PI / 2, 0, tilt);
  const mirror2 = (pts) => pts.map(([x, y]) => [-x, y]).reverse();
  // Contrasombra: lomo oscuro, vientre claro con una transición en el costado
  const counter = (top, bot, k0, k1) => { const A = new Col(top), Bc = new Col(bot); return (c, x, y, z, nx, ny) => { const t = U.smooth(k0, k1, ny); c.multiply(new Col().lerpColors(Bc, A, t)); }; };
  // Nado: una onda recorre la columna (de lado en peces y serpientes, de arriba abajo en cetáceos)
  const swim = (spine, amp, k, vertical) => (rig, st, dt, ph, move) => {
    const a = ph * Math.PI * 2 + rig.t * 0.8, n = spine.length;
    spine.forEach((nm, i) => { const w = Math.sin(a - i * k) * amp * (0.35 + (i / n) * 1.1) * (0.5 + move * 0.7); if (vertical) rig.B[nm].rotation.x += w; else rig.B[nm].rotation.y += w; });
  };

  // Tiburón
  F.defs.shark = function () {
    const b = R.animal('shark');
    const grey = 0x62707e, fin = 0x55626e;
    b.bone('head', null, [0, 0, 0.85], [0, -0.03, 1.5]);
    b.bone('jaw', 'head', [0, -0.17, 1.02], [0, -0.2, 1.25]);
    const spine = ['sp1', 'sp2', 'sp3', 'sp4', 'sp5'];
    [[0, 0, 0.4], [0, 0, -0.1], [0, 0.01, -0.6], [0, 0.03, -1.05], [0, 0.05, -1.4]].forEach((p, i) => b.bone(spine[i], i ? spine[i - 1] : 'head', p, i === 4 ? [0, 0.06, -1.62] : null));
    sym((s, L) => b.bone('fin' + L, 'sp1', [s * 0.3, -0.16, 0.52], [s * 0.9, -0.42, 0.15]));
    b.p(
      S.ell([0, -0.03, 1.28], [0.21, 0.14, 0.24], { bone: 'head', k: 0.08, color: 0xffffff }),
      S.ell([0, 0, 0.92], [0.33, 0.3, 0.42], { bone: 'head', k: 0.1, color: 0xffffff }),
      S.ell([0, 0.02, 0.35], [0.4, 0.42, 0.6], { bone: 'sp1', k: 0.12, color: 0xffffff, bb: 0.2 }),
      S.ell([0, 0.03, -0.15], [0.34, 0.36, 0.5], { bone: 'sp2', k: 0.12, color: 0xffffff, bb: 0.2 }),
      S.cone([0, 0.03, -0.5], [0, 0.04, -1.05], 0.27, 0.11, { bone: 'sp3', k: 0.08, sx: 0.72, color: 0xffffff }),
      S.cone([0, 0.04, -1.05], [0, 0.05, -1.42], 0.11, 0.065, { bone: 'sp4', k: 0.04, sx: 0.6, color: 0xffffff }),
      S.ell([0, -0.2, 1.12], [0.15, 0.028, 0.08], { sub: true, k: 0.02 }),
      S.ell([0, -0.19, 1.11], [0.16, 0.04, 0.09], { paint: true, soft: 0.02, color: 0x2a1c1c }),
    );
    sym((s) => { for (let k = 0; k < 5; k++) b.p(S.ell([s * 0.31, -0.03, 0.76 - k * 0.07], [0.012, 0.13 - k * 0.012, 0.011], { sub: true, k: 0.01 })); b.p(S.sph([s * 0.08, -0.1, 1.42], 0.018, { sub: true, k: 0.01 })); });
    b.part(vFin([[0, 0], [0.56, 0], [0.34, 0.64], [0.14, 0.62]], 0.045, fin, 0, 0.36, 0.34), { bones: ['sp1', 'sp2'], fur: 0 });
    b.part(vFin([[0, 0], [0.18, 0], [0.12, 0.16], [0.05, 0.15]], 0.025, fin, 0, 0.18, -0.72), { bones: ['sp3', 'sp4'], fur: 0 });
    b.part(vFin([[0, 0], [0.16, 0], [0.12, -0.14], [0.04, -0.13]], 0.025, fin, 0, -0.18, -0.86), { bones: ['sp3', 'sp4'], fur: 0 });
    b.part(vFin([[0, 0.05], [0.33, 0.76], [0.47, 0.74], [0.22, 0.02], [0.37, -0.38], [0.27, -0.42], [0, -0.05]], 0.04, fin, 0, 0.05, -1.36), { bone: 'sp5', fur: 0 });
    const pect = [[0, 0.12], [0.66, -0.3], [0.63, -0.46], [0.04, -0.2]];
    sym((s, L) => {
      b.part(hFin(s > 0 ? pect : mirror2(pect), 0.04, fin, s * 0.28, -0.2, 0.58, s * -0.3), { bone: 'fin' + L, fur: 0 });
      b.part(hFin(s > 0 ? [[0, 0.05], [0.2, -0.1], [0.18, -0.17], [0.02, -0.08]] : mirror2([[0, 0.05], [0.2, -0.1], [0.18, -0.17], [0.02, -0.08]]), 0.02, fin, s * 0.14, -0.3, -0.45, s * -0.4), { bone: 'sp3', fur: 0 });
      b.part(F.eye(0.034, [s * 0.22, 0.04, 1.08], [s, 0.1, 0.3], 0x0c0c10, { pupilR: 0.6, sclera: 0x0a0a0c }), { bone: 'head' });
    });
    return b.done({
      h: 0.035, cb: 0.03, bb: 0.15, ao: 0.05, color: counter(0x5f6c7a, 0xe6eaec, -0.35, 0.05),
      gaits: { walk: { v: [0, 99], stride: 1.8, duty: 0.5, lift: 0 } },
      half: 1.2, bob: 0, jawOpen: 0.45,
      anim: (rig, st, dt, ph, move) => { swim(spine, 0.07, 0.7)(rig, st, dt, ph, move); rig.B.finL.rotation.z = -0.1 + Math.sin(rig.t) * 0.04; rig.B.finR.rotation.z = 0.1 - Math.sin(rig.t) * 0.04; },
    });
  };

  // Delfín
  F.defs.dolphin = function () {
    const b = R.animal('dolphin');
    const fin = 0x4e667a;
    b.bone('head', null, [0, 0, 0.6], [0, -0.05, 1.05]);
    b.bone('jaw', 'head', [0, -0.07, 0.76], [0, -0.07, 1.03]);
    const spine = ['sp1', 'sp2', 'sp3', 'sp4'];
    [[0, 0, 0.25], [0, 0, -0.15], [0, 0.01, -0.5], [0, 0.02, -0.8]].forEach((p, i) => b.bone(spine[i], i ? spine[i - 1] : 'head', p, i === 3 ? [0, 0.02, -1.0] : null));
    sym((s, L) => b.bone('fl' + L, 'sp1', [s * 0.18, -0.12, 0.45], [s * 0.42, -0.22, 0.28]));
    b.p(
      S.ell([0, 0.03, 0.66], [0.17, 0.17, 0.22], { bone: 'head', k: 0.18, color: 0xffffff }),
      S.cone([0, -0.04, 0.8], [0, -0.056, 1.04], 0.075, 0.034, { bone: 'head', k: 0.04, sy: 0.8, color: 0xffffff }),
      S.cone([0, -0.07, 0.78], [0, -0.068, 1.02], 0.05, 0.026, { bone: 'jaw', k: 0.03, sy: 0.6, color: 0xffffff }),
      S.ell([0, 0, 0.15], [0.25, 0.27, 0.55], { bone: 'sp1', k: 0.18, color: 0xffffff, bb: 0.12 }),
      S.cone([0, 0.01, -0.3], [0, 0.02, -0.86], 0.21, 0.055, { bone: 'sp2', k: 0.06, sx: 0.7, color: 0xffffff }),
      S.sph([0, 0.19, 0.6], 0.012, { sub: true, k: 0.008 }),
      S.cone([0, -0.055, 0.78], [0, -0.058, 1.0], 0.006, 0.004, { paint: true, soft: 0.005, sx: 6, color: 0x3a4450 }),
    );
    b.part(vFin([[0, 0], [0.37, 0], [0.36, 0.35], [0.24, 0.31]], 0.03, fin, 0, 0.24, 0.02), { bones: ['sp1', 'sp2'], fur: 0 });
    const pf = [[0, 0.05], [0.28, -0.12], [0.27, -0.2], [0.03, -0.1]];
    sym((s, L) => {
      b.part(hFin(s > 0 ? pf : mirror2(pf), 0.025, fin, s * 0.17, -0.13, 0.46, s * -0.4), { bone: 'fl' + L, fur: 0 });
      b.part(F.eye(0.017, [s * 0.14, 0.01, 0.74], [s, 0.1, 0.3], 0x140e0c), { bone: 'head' });
    });
    const fluke = [[0, -0.1], [0.1, -0.18], [0.5, -0.32], [0.55, -0.26], [0.35, -0.16], [0.08, -0.02], [0, 0], [-0.08, -0.02], [-0.35, -0.16], [-0.55, -0.26], [-0.5, -0.32], [-0.1, -0.18]];
    b.part(hFin(fluke, 0.03, fin, 0, 0.02, -0.9), { bone: 'sp4', fur: 0 });
    return b.done({
      h: 0.022, cb: 0.03, bb: 0.1, ao: 0.03, color: counter(0x4c6478, 0xeaf0f4, -0.45, 0.25),
      gaits: { walk: { v: [0, 99], stride: 1.4, duty: 0.5, lift: 0 } },
      half: 0.8, bob: 0, jawOpen: 0.3,
      anim: swim(spine, 0.08, 0.6, true),
    });
  };

  // Ballena jorobada
  F.defs.whale = function () {
    const b = R.animal('whale');
    const fin = 0x3a4656, pale = 0xd8dce0;
    b.bone('head', null, [0, 0, 3.0], [0, -0.3, 5.3]);
    b.bone('jaw', 'head', [0, -0.75, 3.2], [0, -0.85, 5.1]);
    const spine = ['sp1', 'sp2', 'sp3', 'sp4'];
    [[0, 0, 1.0], [0, 0, -1.0], [0, 0.05, -2.8], [0, 0.1, -4.2]].forEach((p, i) => b.bone(spine[i], i ? spine[i - 1] : 'head', p, i === 3 ? [0, 0.1, -5.1] : null));
    sym((s, L) => b.bone('fl' + L, 'sp1', [s * 1.25, -0.7, 2.3], [s * 4.3, -1.5, 0.9]));
    b.p(
      S.ell([0, -0.05, 3.7], [1.05, 0.9, 1.8], { bone: 'head', k: 0.4, color: 0xffffff }),
      S.ell([0, -0.7, 3.8], [1.0, 0.45, 1.5], { bone: 'jaw', k: 0.3, color: 0xffffff }),
      S.ell([0, 0, 0.8], [1.45, 1.45, 2.9], { bone: 'sp1', k: 0.5, color: 0xffffff, bb: 0.8 }),
      S.cone([0, 0.05, -1.4], [0, 0.1, -4.9], 1.25, 0.32, { bone: 'sp2', k: 0.4, sx: 0.75, color: 0xffffff }),
      S.ell([0, 1.15, -2.0], [0.2, 0.25, 0.5], { bone: 'sp2', k: 0.2, color: 0xffffff }),
      S.ell([0, -0.95, 2.6], [0.9, 0.3, 2.6], { paint: true, soft: 0.2, color: pale }),
      S.ell([0, -0.35, 5.0], [0.9, 0.05, 0.4], { sub: true, k: 0.1 }),
    );
    // Tubérculos de la cabeza y la mandíbula
    const rnd = U.rng(33), tub = [];
    for (let i = 0; i < 26; i++) { const z = U.lerp(3.6, 5.1, rnd()), x = (rnd() - 0.5) * 0.9 * (5.3 - z), y = 0.55 - (z - 3.6) * 0.45; tub.push(M.ball(0.07 + rnd() * 0.04, 0x2a3440, x, y, z)); }
    for (let i = 0; i < 10; i++) { const z = U.lerp(4.0, 5.0, rnd()), s = rnd() < 0.5 ? -1 : 1; tub.push(M.ball(0.06 + rnd() * 0.03, 0x2a3440, s * U.lerp(0.75, 0.3, (z - 4.0)), -0.42, z)); }
    b.part(U.merge(tub), { bones: ['head', 'jaw'], fur: 0 });
    const fl = [[0, 0.25], [0.6, 0.3], [3.2, -0.45], [3.35, -0.75], [2.4, -0.62], [1.5, -0.6], [0.4, -0.45]];
    sym((s, L) => {
      const fg = hFin(s > 0 ? fl : mirror2(fl), 0.12, fin, s * 1.2, -0.72, 2.35, s * -0.45);
      M.recolor(fg, (x, y, z, nx, ny) => (ny < 0.2 ? 0xdfe4e8 : null));
      b.part(fg, { bone: 'fl' + L, fur: 0 });
      b.part(F.eye(0.09, [s * 1.0, -0.3, 3.95], [s, 0.1, 0.2], 0x100c0a), { bone: 'head' });
    });
    const fluke = [[0, -0.4], [0.4, -0.7], [1.2, -1.05], [2.0, -1.35], [2.25, -1.1], [1.5, -0.7], [0.3, -0.1], [0, 0], [-0.3, -0.1], [-1.5, -0.7], [-2.25, -1.1], [-2.0, -1.35], [-1.2, -1.05], [-0.4, -0.7]];
    b.part(hFin(fluke, 0.14, fin, 0, 0.1, -4.9), { bone: 'sp4', fur: 0 });
    return b.done({
      h: 0.14, cb: 0.15, bb: 0.6, ao: 0.25, color: counter(0x2e3a48, 0x6a7482, -0.6, 0.1),
      gaits: { walk: { v: [0, 99], stride: 6, duty: 0.5, lift: 0 } },
      half: 4, bob: 0, jawOpen: 0.15,
      anim: swim(spine, 0.05, 0.5, true),
    });
  };

  // Serpiente marina (14 m): cuerpo con cresta de púas y cabeza de dragón marino
  F.defs.serpent = function () {
    const b = R.animal('serpent');
    const teal = 0x1e5a5a, dark = 0x0e2a2e, belly = 0xd8c060, horn = 0xd8c060;
    b.bone('head', null, [0, 0.75, 7.1], [0, 0.7, 8.8]);
    b.bone('jaw', 'head', [0, 0.45, 7.2], [0, 0.35, 8.5]);
    const n = 16, spine = [];
    for (let i = 0; i < n; i++) { spine.push('sp' + (i + 1)); b.bone('sp' + (i + 1), i ? 'sp' + i : 'head', [0, 0.6, U.lerp(6.6, -6.6, i / n)], i === n - 1 ? [0, 0.5, -7.2] : null); }
    const pts = [];
    for (let k = 0; k <= 30; k++) pts.push([0, 0, U.lerp(7.2, -7.3, k / 30)]);
    const tube = M.tube(pts, (t) => 0.55 * (t < 0.06 ? U.lerp(0.9, 1, t / 0.06) : t < 0.55 ? 1 : U.lerp(1, 0.12, U.smooth(0.55, 1, t))), 16, teal, 150);
    tube.scale(1, 0.88, 1); tube.translate(0, 0.6, 0);
    M.recolor(tube, (x, y, z, nx, ny) => (ny < -0.4 ? belly : null));
    b.part(tube, { bones: spine.concat(['head']), fur: 0, pat: 1 });
    const sp = [];
    for (let i = 0; i < 28; i++) { const z = U.lerp(6.4, -6.2, i / 27), r = 0.55 * (z < -1 ? U.lerp(1, 0.2, (-1 - z) / 5.5) : 1); sp.push(M.xf(M.fin([[0, 0], [0.12 + r * 0.25, 0.3 + r * 0.7], [0.3 + r * 0.3, 0]], 0.05, horn), 0, 0.6 + r * 0.8, z + 0.1, 0, Math.PI / 2, 0)); }
    b.part(U.merge(sp), { bones: spine, fur: 0, pat: 0.3 });
    // Cabeza esculpida: cráneo, hocico, arcos de las cejas, mandíbula
    b.p(
      S.ell([0, 0.8, 7.4], [0.6, 0.5, 0.75], { bone: 'head', k: 0.15, color: teal }),
      S.cone([0, 0.75, 7.6], [0, 0.62, 8.75], 0.45, 0.2, { bone: 'head', k: 0.12, sx: 1.2, sy: 0.7, color: teal }),
      S.cone([0, 0.42, 7.3], [0, 0.35, 8.55], 0.4, 0.16, { bone: 'jaw', k: 0.1, sx: 1.15, sy: 0.45, color: belly, pat: 0.4 }),
      S.cone([0, 0.5, 7.4], [0, 0.46, 8.6], 0.06, 0.04, { sub: true, k: 0.04, sx: 7 }),
    );
    sym((s) => b.p(S.ell([s * 0.38, 1.05, 7.75], [0.2, 0.12, 0.3], { bone: 'head', k: 0.08, color: teal }), S.sph([s * 0.42, 1.0, 7.9], 0.13, { sub: true, k: 0.05 }), S.sph([s * 0.1, 0.7, 8.78], 0.05, { sub: true, k: 0.03 })));
    const hp = [];
    for (const s of [1, -1]) {
      hp.push(F.horn([[s * 0.35, 1.2, 7.4], [s * 0.5, 1.55, 6.9], [s * 0.45, 1.75, 6.3]], 0.13, 0.02, horn));
      hp.push(M.xf(M.fin([[0, 0], [0.9, 0.35], [1.1, -0.1], [0.8, -0.5], [0.1, -0.4]], 0.05, 0x2a8a8a), s * 0.6, 0.85, 7.1, 0, s > 0 ? -0.3 : Math.PI + 0.3, 0));
      for (let i = 0; i < 7; i++) hp.push(M.xf(M.paint(new THREE.ConeGeometry(0.04, 0.2, 5), 0xf4f0e0), s * (0.4 - i * 0.035), 0.5, 7.7 + i * 0.14, Math.PI));
    }
    b.part(U.merge(hp), { bone: 'head', fur: 0 });
    const glow = new THREE.MeshStandardMaterial({ color: 0xffd040, emissive: 0xff9a10, emissiveIntensity: 1.1, roughness: 0.3 });
    b.extra = (rig) => { for (const s of [1, -1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), glow); e.position.set(s * 0.42, 1.0 - 0.75, 7.92 - 7.1); rig.B.head.add(e); } rig.glow = glow; };
    return b.done({
      h: 0.07, cb: 0.06, bb: 0.3, ao: 0.1, lod: false,
      gaits: { walk: { v: [0, 99], stride: 5, duty: 0.5, lift: 0 } },
      half: 5, bob: 0, jawOpen: 0.5, extra: b.extra,
      anim: (rig, st, dt, ph, move) => {
        const a = ph * Math.PI * 2 + rig.t * 0.6;
        spine.forEach((nm, i) => { rig.B[nm].rotation.y += Math.sin(a - i * 0.55) * 0.07 * (0.6 + i / n); rig.B[nm].rotation.x += Math.sin(a * 0.7 - i * 0.45) * 0.035; });
      },
    });
  };

  // ------------------------------------------------------------------ jefes
  // Mechones de pelo largo que cuelgan sobre una zona (elipsoide): regiones [[centro, radios, hueso]]
  function shag(b, regions, colors, n, rnd, len) {
    for (const [c, r, bone] of regions) {
      const list = [];
      for (let i = 0; i < n; i++) {
        const u = rnd() * Math.PI * 2, v = Math.acos(U.lerp(-0.2, 1, rnd()));
        const nx = Math.sin(v) * Math.cos(u), ny = Math.cos(v), nz = Math.sin(v) * Math.sin(u);
        const x = c[0] + nx * r[0] * 0.95, y = c[1] + ny * r[1] * 0.95, z = c[2] + nz * r[2] * 0.95;
        const L = len * (0.6 + rnd() * 0.7), d = new V3(nx * 0.3, -1, nz * 0.3).normalize();
        list.push(M.tube([[x - nx * 0.04, y, z - nz * 0.04], [x + d.x * L * 0.5 + nx * 0.02, y + d.y * L * 0.5, z + d.z * L * 0.5 + nz * 0.02], [x + d.x * L, y + d.y * L, z + d.z * L]], (t) => len * 0.34 * (1 - t) * (1 - t * 0.5) + 0.008, 6, colors[i % colors.length], 5));
      }
      b.part(U.merge(list), { bone, fur: 1, hair: [0, -1, 0] });
    }
  }

  // El Rey de la Escarcha (yeti de 3,5 m, bípedo, con brazos larguísimos)
  F.defs.yeti = function () {
    const b = R.animal('yeti');
    const fur = 0xeef3f8, shade = 0xc6d3e0, deep = 0x9aaec4, skin = 0x5c7a9a, dark = 0x223246, ice = 0x9ae6ff, horn = 0xe2e8ee;
    const rnd = U.rng(4242);
    b.bone('hips', null, [0, 1.25, 0]);
    b.bone('spine', 'hips', [0, 1.8, 0.06]);
    b.bone('belly', 'spine', [0, 1.6, 0.3], [0, 1.5, 0.45]);
    b.bone('chest', 'spine', [0, 2.35, 0.16]);
    b.bone('neck', 'chest', [0, 2.72, 0.3]);
    b.bone('head', 'neck', [0, 2.95, 0.42], [0, 2.88, 0.9]);
    b.bone('jaw', 'head', [0, 2.8, 0.55], [0, 2.72, 0.8]);
    b.p(
      S.ell([0, 1.32, 0.0], [0.5, 0.36, 0.38], { bone: 'hips', k: 0.15, color: fur, bb: 0.25 }),
      S.ell([0, 1.75, 0.1], [0.56, 0.46, 0.46], { bone: 'spine', k: 0.18, color: fur, bb: 0.25 }),
      S.ell([0, 1.62, 0.32], [0.42, 0.3, 0.25], { bone: 'belly', k: 0.12, color: shade }),
      S.ell([0, 2.3, 0.12], [0.72, 0.56, 0.5], { bone: 'chest', k: 0.2, color: fur, bb: 0.3 }),
      S.ell([0, 2.58, -0.05], [0.56, 0.36, 0.46], { bone: 'chest', k: 0.15, color: fur }),
      S.ell([0, 2.2, 0.52], [0.44, 0.4, 0.2], { paint: true, soft: 0.1, color: skin, fur: 0.35, paintFur: true }),
      S.cone([0, 2.6, 0.24], [0, 2.9, 0.38], 0.3, 0.26, { bone: 'neck', k: 0.12, color: fur }),
      // Cabeza: cráneo peludo, cara azul con cejas marcadas, hocico chato y mandíbula
      S.ell([0, 3.0, 0.45], [0.32, 0.32, 0.34], { bone: 'head', k: 0.1, color: fur }),
      S.ell([0, 2.92, 0.64], [0.24, 0.25, 0.16], { bone: 'head', k: 0.08, color: skin, fur: 0.2 }),
      S.ell([0, 3.08, 0.7], [0.26, 0.07, 0.09], { bone: 'head', k: 0.05, color: deep }),
      S.ell([0, 2.83, 0.76], [0.17, 0.11, 0.11], { bone: 'head', k: 0.06, color: skin, fur: 0.15 }),
      S.ell([0, 2.93, 0.805], [0.065, 0.045, 0.04], { bone: 'head', k: 0.03, color: dark, fur: 0, cb: 0.01 }),
      S.ell([0, 2.71, 0.68], [0.2, 0.08, 0.14], { bone: 'jaw', k: 0.05, color: skin, fur: 0.2 }),
      S.cone([-0.13, 2.765, 0.8], [0.13, 2.765, 0.8], 0.025, 0.025, { paint: true, soft: 0.02, color: 0x140c18 }),
    );
    sym((s) => b.p(S.sph([s * 0.11, 2.98, 0.745], 0.05, { sub: true, k: 0.03 })));
    sym((s, L) => {
      const nm = 'ar' + L;
      b.bone(nm + '0', 'chest', [s * 0.82, 2.6, 0.18]);
      b.bone(nm + '1', nm + '0', [s * 0.98, 1.95, 0.3]);
      b.bone(nm + '2', nm + '1', [s * 1.02, 1.28, 0.42], [s * 1.0, 0.95, 0.5]);
      b.p(
        S.ell([s * 0.72, 2.6, 0.12], [0.34, 0.32, 0.34], { bone: nm + '0', k: 0.15, color: fur }),
        S.cone([s * 0.82, 2.6, 0.18], [s * 0.98, 1.95, 0.3], 0.27, 0.21, { bone: nm + '0', k: 0.1, color: fur }),
        S.cone([s * 0.98, 1.95, 0.3], [s * 1.02, 1.28, 0.42], 0.22, 0.18, { bone: nm + '1', k: 0.08, color: fur, bb: 0.08 }),
        S.ell([s * 1.0, 1.08, 0.47], [0.24, 0.24, 0.27], { bone: nm + '2', k: 0.08, color: skin, fur: 0.25, bb: 0.06 }),
      );
      const cl = [];
      for (let k = 0; k < 3; k++) { const x = s * 1.0 + (k - 1) * 0.12; cl.push(F.horn([[x, 0.95, 0.62], [x, 0.86, 0.7], [x, 0.84, 0.78]], 0.035, 0.006, dark, 5)); }
      b.part(U.merge(cl), { bone: nm + '2' });
    });
    const foot = (s, L, P, nm) => {
      b.p(S.ell([P[2][0], 0.1, P[2][2] + 0.16], [0.22, 0.11, 0.3], { bone: nm + 2, k: 0.06, color: skin, fur: 0.2, bb: 0.05 }));
      const cl = [];
      for (let k = 0; k < 4; k++) { const x = P[2][0] + (k - 1.5) * 0.1; cl.push(F.horn([[x, 0.08, 0.4], [x, 0.04, 0.47], [x, 0.0, 0.5]], 0.03, 0.005, dark, 5)); }
      b.part(U.merge(cl), { bone: nm + 2 });
    };
    limb(b, 'hl', 'hips', [[0.42, 1.25, 0.0], [0.46, 0.7, 0.14], [0.45, 0.16, -0.02], [0.45, 0.0, 0.34]], [0.34, 0.25, 0.17, 0.15], { color: fur, foot, knobs: false, k: [0.12, 0.08, 0.06] });
    // Mechones largos en hombros, espalda, brazos y muslos; cristales de hielo en la espalda; cuernos
    shag(b, [[[0, 2.55, -0.05], [0.6, 0.4, 0.5], 'chest'], [[0, 1.8, -0.1], [0.55, 0.45, 0.45], 'spine']], [fur, shade, fur], 60, rnd, 0.3);
    sym((s, L) => shag(b, [[[s * 0.9, 2.2, 0.22], [0.25, 0.4, 0.25], 'ar' + L + '0'], [[s * 1.0, 1.6, 0.36], [0.2, 0.3, 0.2], 'ar' + L + '1'], [[s * 0.44, 0.95, 0.06], [0.28, 0.3, 0.28], 'hl' + L + '0']], [fur, shade, deep], 16, rnd, 0.28));
    const cr = [];
    for (let k = 0; k < 11; k++) {
      const a = Math.PI / 2 + (rnd() - 0.5) * 1.8, t = rnd(), x = Math.cos(a) * 0.5, y = 2.3 + t * 0.45, z = -0.1 - Math.sin(a) * 0.35;
      cr.push(M.xf(M.paint(new THREE.ConeGeometry(0.07 + rnd() * 0.07, 0.45 + rnd() * 0.5, 5), rnd() < 0.5 ? ice : 0xd8f6ff), x, y + 0.2, z, -0.6 - rnd() * 0.3, 0, (x > 0 ? -1 : 1) * (0.2 + rnd() * 0.3)));
    }
    b.part(U.merge(cr), { bone: 'chest', fur: 0 });
    b.part(U.merge([1, -1].map((s) => F.horn([[s * 0.24, 3.17, 0.4], [s * 0.46, 3.31, 0.25], [s * 0.6, 3.57, 0.13], [s * 0.52, 3.85, 0.23]], 0.1, 0.018, horn, 14))), { bone: 'head', fur: 0 });
    const glow = new THREE.MeshStandardMaterial({ color: 0xbff4ff, emissive: 0x4ad0ff, emissiveIntensity: 1.4, roughness: 0.2 });
    return b.done({
      h: 0.065, cb: 0.05, bb: 0.2, ao: 0.08,
      spine: ['spine', 'chest'], neck: ['neck'],
      gaits: {
        walk: { v: [0, 2.6], stride: 1.6, duty: 0.62, lift: 0.22 },
        trot: { v: [2.6, 99], stride: 2.8, duty: 0.42, lift: 0.32 },
      },
      half: 0.5, footReach: 0.4, bob: 0.06, jawOpen: 0.45, lungeNeck: 0.2, lungeHead: 0.2,
      extra: (rig) => { for (const s of [1, -1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.052, 12, 10), glow); e.position.set(s * 0.11, 0.03, 0.325); rig.B.head.add(e); } rig.glow = glow; },
      // Encorvado hacia delante; los brazos se balancean al andar y se alzan para el pisotón o el lanzamiento
      anim: (rig, st, dt, ph, move) => {
        const B = rig.B, a = ph * Math.PI * 2, c = st.c || {}, up = c.armUp || 0;
        B.chest.rotation.x += 0.12;
        B.neck.rotation.x -= 0.12;
        for (const [L, s, o] of [['L', 1, 0], ['R', -1, Math.PI]]) {
          const sw = Math.sin(a + o) * 0.45 * move;
          B['ar' + L + '0'].rotation.x = U.lerp(sw - 0.05, -2.6, up);
          B['ar' + L + '0'].rotation.z = s * (0.06 + Math.sin(rig.t * 0.9) * 0.02) * (1 - up);
          B['ar' + L + '1'].rotation.x = U.lerp(-0.25 - Math.max(0, -sw) * 0.4, -0.4, up) - (st.lunge || 0) * 0.3;
        }
      },
    });
  };

  // El Dragón de Brasa: cuatro patas, cuello y cola largos, alas de membrana que se pliegan y grietas de lava
  F.defs.lavadragon = function () {
    const b = R.animal('lavadragon');
    const sc = 0x2e2724, belly = 0x5e3a28, horn = 0x3a322c, claw = 0x141010, memb = 0x5a1c12, boneC = 0x2a201c, tooth = 0xf0e8d8;
    b.bone('hips', null, [0, 1.75, -1.1]);
    b.bone('spine', 'hips', [0, 1.85, 0.0]);
    b.bone('chest', 'spine', [0, 1.95, 1.0]);
    const neck = chain(b, 'n', 'chest', [[0, 2.2, 1.45], [0, 2.8, 1.95], [0, 3.4, 2.3], [0, 3.88, 2.56]], (t) => U.lerp(0.62, 0.36, t), { color: sc, seg: 12, k: 0.1 });
    b.bone('head', 'n3', [0, 3.95, 2.62], [0, 3.72, 3.8]);
    b.bone('jaw', 'head', [0, 3.78, 2.85], [0, 3.55, 3.72]);
    const tail = chain(b, 't', 'hips', [[0, 1.8, -1.6], [0, 1.45, -2.7], [0, 1.05, -3.7], [0, 0.82, -4.6], [0, 0.76, -5.4], [0, 0.78, -6.2]], (t) => U.lerp(0.6, 0.08, t), { color: sc, seg: 20, k: 0.08 });
    b.p(
      S.ell([0, 1.85, 0.0], [0.92, 0.9, 1.5], { bone: 'spine', k: 0.3, color: sc, bb: 0.5 }),
      S.ell([0, 1.9, 0.95], [0.95, 0.95, 0.8], { bone: 'chest', k: 0.3, color: sc }),
      S.ell([0, 1.75, -1.1], [0.82, 0.82, 0.7], { bone: 'hips', k: 0.25, color: sc }),
      S.ell([0, 1.15, 0.2], [0.7, 0.35, 1.5], { paint: true, soft: 0.2, color: belly }),
      S.ell([0, 4.0, 2.75], [0.36, 0.34, 0.45], { bone: 'head', k: 0.12, color: sc }),
      S.cone([0, 3.95, 2.95], [0, 3.78, 3.75], 0.3, 0.15, { bone: 'head', k: 0.1, sx: 1.1, sy: 0.8, color: sc }),
      S.cone([0, 3.72, 2.8], [0, 3.58, 3.7], 0.26, 0.12, { bone: 'jaw', k: 0.08, sy: 0.5, color: belly }),
      S.cone([0, 3.73, 2.95], [0, 3.62, 3.72], 0.03, 0.02, { paint: true, soft: 0.03, sx: 5, color: 0x6a1a0a }),
    );
    sym((s) => b.p(
      S.ell([s * 0.2, 4.17, 3.0], [0.12, 0.08, 0.22], { bone: 'head', k: 0.06, color: sc }),
      S.sph([s * 0.24, 4.08, 3.1], 0.085, { sub: true, k: 0.04 }),
      S.sph([s * 0.08, 3.84, 3.78], 0.045, { sub: true, k: 0.03 }),
      S.ell([s * 0.8, 1.55, -1.05], [0.4, 0.55, 0.5], { bone: 'hl' + (s > 0 ? 'L' : 'R') + '0', k: 0.2, color: sc }),
      S.ell([s * 0.75, 1.6, 1.0], [0.38, 0.5, 0.45], { bone: 'fl' + (s > 0 ? 'L' : 'R') + '0', k: 0.2, color: sc }),
    ));
    const claws = (front) => (s, L, P, nm) => {
      const cl = [];
      for (let k = 0; k < 3; k++) { const x = P[4][0] + (k - 1) * 0.13, z = P[4][2]; cl.push(F.horn([[x, 0.1, z - 0.05], [x, 0.06, z + 0.08], [x, 0.0, z + 0.14]], 0.05, 0.008, claw, 5)); }
      b.part(U.merge(cl), { bone: nm + 3 });
    };
    limb(b, 'fl', 'chest', [[0.75, 1.55, 1.05], [0.85, 0.95, 1.3], [0.85, 0.35, 1.1], [0.85, 0.1, 1.2], [0.85, 0.0, 1.5]], [0.44, 0.3, 0.23, 0.21, 0.19], { front: true, color: sc, foot: claws(true), knobs: false, k: [0.15, 0.08, 0.06, 0.05] });
    limb(b, 'hl', 'hips', [[0.85, 1.6, -1.05], [0.9, 1.0, -0.55], [0.9, 0.45, -1.15], [0.9, 0.1, -1.0], [0.9, 0.0, -0.68]], [0.54, 0.34, 0.23, 0.21, 0.19], { color: sc, foot: claws(false), knobs: false, k: [0.18, 0.08, 0.06, 0.05] });
    // Púas del lomo, del cuello y de la cola; punta de flecha en la cola; cuernos; dientes
    const sp = [];
    for (let i = 0; i < 9; i++) { const z = U.lerp(1.4, -1.5, i / 8), h = 0.35 + Math.sin((i / 8) * Math.PI) * 0.25; sp.push(M.xf(F.fin([[0, 0], [0.18, h], [0.42, 0]], 0.05, horn, 0.5), 0, 2.62 - Math.abs(z) * 0.08, z + 0.2, 0, Math.PI / 2, 0)); }
    b.part(U.merge(sp), { bones: ['chest', 'spine', 'hips'], fur: 0 });
    const tc = new THREE.CatmullRomCurve3([[0, 1.8, -1.6], [0, 1.45, -2.7], [0, 1.05, -3.7], [0, 0.82, -4.6], [0, 0.76, -5.4], [0, 0.78, -6.2]].map((p) => new V3(...p)));
    const ts = [];
    for (let i = 1; i < 11; i++) { const P = tc.getPointAt(i / 12), r = U.lerp(0.6, 0.08, i / 12); ts.push(M.xf(F.fin([[0, 0], [0.1, 0.22 + r * 0.3], [0.25, 0]], 0.04, horn, 0.5), 0, P.y + r * 0.9, P.z + 0.12, 0, Math.PI / 2, 0)); }
    ts.push(M.xf(F.fin([[0, 0], [0.45, 0.35], [0.95, 0], [0.45, -0.35]], 0.06, horn), 0, 0.78, -6.1, 0, Math.PI / 2, Math.PI / 2));
    b.part(U.merge(ts), { bones: tail, fur: 0 });
    const nc = new THREE.CatmullRomCurve3([[0, 2.2, 1.45], [0, 2.8, 1.95], [0, 3.4, 2.3], [0, 3.88, 2.56]].map((p) => new V3(...p))), ns = [];
    for (let i = 0; i < 5; i++) { const P = nc.getPointAt(0.1 + i * 0.2), r = U.lerp(0.62, 0.36, 0.1 + i * 0.2); ns.push(M.xf(F.fin([[0, 0], [0.1, 0.3], [0.26, 0]], 0.04, horn, 0.5), 0, P.y + r * 0.9, P.z - 0.1, 0, Math.PI / 2, -0.5)); }
    b.part(U.merge(ns), { bones: neck, fur: 0 });
    const hp = [];
    for (const s of [1, -1]) {
      hp.push(F.horn([[s * 0.18, 4.2, 2.55], [s * 0.3, 4.38, 2.2], [s * 0.34, 4.5, 1.8], [s * 0.28, 4.46, 1.47]], 0.11, 0.02, horn, 14));
      hp.push(F.horn([[s * 0.3, 3.98, 2.5], [s * 0.5, 4.0, 2.23], [s * 0.6, 4.06, 2.05]], 0.06, 0.01, horn, 8));
      for (let k = 0; k < 6; k++) hp.push(M.xf(M.paint(new THREE.ConeGeometry(0.026, 0.12, 5), tooth), s * U.lerp(0.19, 0.08, k / 5), 3.76, 3.0 + k * 0.13, Math.PI));
    }
    b.part(U.merge(hp), { bone: 'head', fur: 0 });
    const jt = [];
    for (const s of [1, -1]) for (let k = 0; k < 5; k++) jt.push(M.xf(M.paint(new THREE.ConeGeometry(0.022, 0.1, 5), tooth), s * U.lerp(0.16, 0.07, k / 4), 3.7, 3.0 + k * 0.15));
    b.part(U.merge(jt), { bone: 'jaw', fur: 0 });
    // Alas: brazo, antebrazo y tres dedos que sostienen la membrana
    sym((s, L) => {
      const w = 'w' + L, sh = mx([0.62, 2.45, 0.85], s), el = mx([1.8, 2.85, 0.95], s), wr = mx([3.2, 2.95, 0.65], s);
      const t1 = mx([4.6, 2.55, 0.1], s), t2 = mx([4.1, 2.1, -1.15], s), t3 = mx([2.9, 2.0, -1.7], s), bt = mx([0.75, 2.2, -0.9], s);
      b.bone(w + '0', 'chest', sh); b.bone(w + '1', w + '0', el);
      b.bone(w + '2', w + '1', wr, t1); b.bone(w + '3', w + '1', wr, t2); b.bone(w + '4', w + '1', wr, t3);
      const V = (p) => new V3(...p), pos = [], idx = [];
      const panel = (A0, A1, B0, B1, rows, cols, sc2) => {
        const base = pos.length / 3;
        for (let i = 0; i <= rows; i++) for (let j = 0; j <= cols; j++) {
          const v = i / rows, u = j / cols, a = V(A0).lerp(V(A1), v), c = V(B0).lerp(V(B1), v), p = a.lerp(c, u);
          p.y -= Math.sin(u * Math.PI) * 0.12 * v;
          if (sc2 && i === rows) p.lerp(V(wr), Math.sin(u * Math.PI) * sc2);
          pos.push(p.x, p.y, p.z);
        }
        for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) { const a = base + i * (cols + 1) + j, b2 = a + 1, c = a + cols + 1, d = c + 1; idx.push(a, c, b2, b2, c, d); }
      };
      panel(wr, t1, wr, t2, 10, 6, 0.12);
      panel(wr, t2, wr, t3, 10, 6, 0.14);
      panel(el, wr, bt, t3, 8, 8, 0);
      panel(sh, el, bt, bt, 6, 6, 0);
      // Membrana de dos caras (cada cara con sus normales)
      const gF = new THREE.BufferGeometry();
      gF.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      gF.setIndex(idx); gF.computeVertexNormals();
      const idxB = [];
      for (let k = 0; k < idx.length; k += 3) idxB.push(idx[k], idx[k + 2], idx[k + 1]);
      const gB = gF.clone(); gB.setIndex(idxB); gB.computeVertexNormals();
      b.part(U.merge([M.paint(gF.toNonIndexed(), memb, 0.04), M.paint(gB.toNonIndexed(), memb, 0.04)]), { bones: [w + '0', w + '1', w + '2', w + '3', w + '4'], fur: 0, pat: 0 });
      b.part(U.merge([
        M.tube([sh, el, wr], [0.14, 0.08], 8, boneC, 14), M.tube([wr, V(wr).lerp(V(t1), 0.5).toArray(), t1], [0.08, 0.025], 6, boneC, 10),
        M.tube([wr, t2], [0.06, 0.02], 6, boneC, 8), M.tube([wr, t3], [0.06, 0.02], 6, boneC, 8), F.horn([wr, mx([3.3, 3.15, 0.8], s), mx([3.25, 3.25, 0.95], s)], 0.05, 0.01, claw, 5),
      ]), { bones: [w + '0', w + '1', w + '2', w + '3', w + '4'], fur: 0 });
    });
    const glow = new THREE.MeshStandardMaterial({ color: 0xffd060, emissive: 0xff7a10, emissiveIntensity: 1.6, roughness: 0.3 });
    return b.done({
      h: 0.09, cb: 0.06, bb: 0.3, ao: 0.1,
      spine: ['spine', 'chest'], neck, tail,
      gaits: {
        walk: { v: [0, 2.6], stride: 2.2, duty: 0.66, lift: 0.3 },
        trot: { v: [2.6, 99], stride: 3.8, duty: 0.42, lift: 0.42 },
      },
      half: 1.1, footReach: 0.5, bob: 0.05, tailAmp: 0.08, tailFreq: 0.9, jawOpen: 0.55, lungeNeck: 0.15, lungeHead: 0.25,
      extra: (rig) => { for (const s of [1, -1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 10), glow); e.position.set(s * 0.24, 4.08 - 3.95, 3.13 - 2.62); rig.B.head.add(e); } rig.glow = glow; },
      // Alas plegadas en tierra y batiendo en el aire (st.c.fly), el cuello se estira al volar
      anim: (rig, st, dt, ph, move) => {
        const B = rig.B, c = st.c || {}, fl = U.smooth(0.05, 0.6, c.fly || 0), t = rig.t;
        const flap = Math.sin(t * (fl > 0.3 ? 5.5 : 1.2));
        for (const [L, s] of [['L', 1], ['R', -1]]) {
          B['w' + L + '0'].rotation.set(0, s * U.lerp(0.95, 0.05, fl), -s * (U.lerp(0.45, -0.1, fl) - flap * U.lerp(0.03, 0.6, fl)));
          B['w' + L + '1'].rotation.y = -s * U.lerp(1.9, 0.12, fl) + s * flap * 0.1 * fl;
          B['w' + L + '1'].rotation.z = -s * U.lerp(0.35, 0.0, fl);
          B['w' + L + '3'].rotation.y = s * U.lerp(0.35, 0, fl);
          B['w' + L + '4'].rotation.y = s * U.lerp(0.6, 0, fl);
        }
        if (fl > 0.05) { for (const nm of neck) B[nm].rotation.x -= 0.12 * fl; for (const nm of tail) B[nm].rotation.x += 0.05 * fl; }
      },
      post: (rig, st) => {
        const c = st.c || {}, fl = U.smooth(0.05, 0.6, c.fly || 0);
        if (!st.noLegs || fl < 0.05) return;
        for (const L of ['L', 'R']) { rig.B['fl' + L + '0'].rotation.x = -0.9 * fl; rig.B['fl' + L + '1'].rotation.x = 1.3 * fl; rig.B['hl' + L + '0'].rotation.x = 0.8 * fl; rig.B['hl' + L + '1'].rotation.x = -0.9 * fl; }
      },
    });
  };

  // ------------------------------------------------------------------ construcción
  const MAT = {
    boar: { furFreq: 70, bump: 0.01, sheen: 0.5, rough: 0.92 },
    boss: { furFreq: 48, bump: 0.012, sheen: 0.5, rough: 0.92 },
    wolf: { furFreq: 55, bump: 0.01, sheen: 0.6 },
    snowwolf: { furFreq: 50, bump: 0.01, sheen: 0.55 },
    jaguar: { furFreq: 95, bump: 0.012, sheen: 0.45, pattern: 'rosette', patScale: 11, patCol: 0x1a120a },
    bear: { furFreq: 32, bump: 0.012, sheen: 0.55 },
    monkey: { furFreq: 120, bump: 0.008, sheen: 0.5 },
    caiman: { fur: 0, rough: 0.55, gloss: 0.3, bump: 0.006, sheen: 0, pattern: 'scales', patScale: 22 },
    bigcaiman: { fur: 0, rough: 0.55, gloss: 0.3, bump: 0.01, sheen: 0, pattern: 'scales', patScale: 12, lava: 0x000000 },
    seal: { fur: 0.35, furFreq: 160, rough: 0.45, gloss: 0.2, bump: 0.004, sheen: 0.3, pattern: 'spots', patScale: 17, patCol: 0x4a4c52 },
    crab: { fur: 0, rough: 0.4, gloss: 0.25, bump: 0.004, sheen: 0, pattern: 'spots', patScale: 45, patCol: 0x8a2a14 },
    lavacrab: { fur: 0, rough: 0.5, gloss: 0.3, bump: 0.008, sheen: 0, pattern: 'scales', patScale: 30, lava: 0xff5a10 },
    snake: { fur: 0, rough: 0.42, gloss: 0.3, bump: 0.005, sheen: 0, pattern: 'bands+scales', patScale: 62, patCol: 0xd8b43a, patCol2: 0x1a2410 },
    frog: { fur: 0, rough: 0.22, gloss: 0.18, bump: 0.002, sheen: 0, pattern: 'spots', patScale: 30, patCol: 0x08080c },
    salamander: { fur: 0, rough: 0.3, gloss: 0.2, bump: 0.003, sheen: 0, pattern: 'spots', patScale: 26, patCol: 0xf0a020 },
    shark: { fur: 0, rough: 0.45, gloss: 0.3, bump: 0.003, sheen: 0 },
    dolphin: { fur: 0, rough: 0.3, gloss: 0.25, bump: 0.002, sheen: 0 },
    whale: { fur: 0, rough: 0.55, gloss: 0.4, bump: 0.02, sheen: 0, pattern: 'spots', patScale: 7, patCol: 0x3a4652 },
    serpent: { fur: 0, rough: 0.45, gloss: 0.3, bump: 0.02, sheen: 0, pattern: 'scales', patScale: 5 },
    yeti: { furFreq: 20, bump: 0.02, sheen: 0.6, rough: 0.9 },
    lavadragon: { fur: 0, rough: 0.55, gloss: 0.35, bump: 0.04, sheen: 0, pattern: 'scales', patScale: 5.5, lava: 0xff5a10 },
  };
  const SCALE = { boss: 1.9, bigcaiman: 2.6 };
  const VARIANT = { boss: ['boar', true], snowwolf: ['wolf', true], bigcaiman: ['caiman', true], lavacrab: ['crab', true] };
  F.has = (type) => !!(F.defs[type] || (VARIANT[type] && F.defs[VARIANT[type][0]]));
  const make = (type) => () => (VARIANT[type] ? F.defs[VARIANT[type][0]](VARIANT[type][1]) : F.defs[type]());
  // Todas las especies se van esculpiendo en segundo plano en cuanto aparece el primer animal
  const ALL = ['boar', 'crab', 'snake', 'jaguar', 'boss', 'monkey', 'caiman', 'frog', 'seal', 'snowwolf', 'bear', 'lavacrab', 'salamander', 'wolf', 'shark', 'dolphin', 'whale', 'serpent', 'yeti', 'lavadragon', 'bigcaiman'];
  let scheduled = false;
  F.prepareAll = function () { if (scheduled) return; scheduled = true; for (const t of ALL) if (F.has(t)) R.prepare(t, make(t)); };
  F.build = function (type) {
    const tpl = R.get(type, make(type));
    setTimeout(F.prepareAll, 1500);
    const mat = R.material(MAT[type] || {});
    const rig = R.instance(tpl, mat);
    const out = { g: rig.g, rig, mat, legs: [], head: rig.B.head || null, headZ: 0, tail: null };
    if (SCALE[type]) rig.g.scale.setScalar(SCALE[type]);
    return out;
  };
})();
