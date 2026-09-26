// Equipo visible sobre el personaje: cada prenda se modela y se pega a los huesos del esqueleto
// (cabeza, pecho, brazos, muslos, espinillas y pies), así se mueve con las animaciones.
(function () {
  'use strict';
  const G = window.G, U = G.U, M = G.Mdl;
  const Eq = (G.Equip = {});

  const bone = (model, name) => model.bones.find((b) => b.name === name);
  const shell = (profile, color, sz = 0.68, seg = 18) => { const g = M.lathe(profile, seg, color); g.scale(1, 1, sz); return g; };
  const tube = (y0, y1, r0, r1, color) => M.tube([[0, y0, 0], [0, (y0 + y1) / 2, 0], [0, y1, 0]], [r0, r1], 12, color, 6);
  const metalC = 0x9aa0a6;

  // Cada diseño devuelve una lista de piezas: { bone, geos, metal }
  const DESIGNS = {
    // ---------------------------------------------------------------- cabeza
    sombrero_paja: () => [{ bone: 'head', geos: [
      M.xf(M.paint(new THREE.CylinderGeometry(0.115, 0.125, 0.1, 20), (x, y, z) => (Math.sin(Math.atan2(z, x) * 24 + y * 80) > 0 ? 0xe8c85a : 0xd8b448)), 0, 0.205, 0.005),
      M.xf(M.paint(new THREE.CylinderGeometry(0.245, 0.25, 0.012, 28), (x, y, z) => (Math.sin(Math.hypot(x, z) * 160) > 0 ? 0xe8c85a : 0xd4ae44)), 0, 0.155, 0.005),
      M.xf(M.paint(new THREE.CylinderGeometry(0.127, 0.128, 0.032, 20), 0xc41e1e), 0, 0.17, 0.005),
    ] }],
    casco_cuero: () => [{ bone: 'head', geos: [
      M.xf(M.paint(new THREE.SphereGeometry(0.132, 18, 9, 0, Math.PI * 2, 0, Math.PI / 2), (x, y, z) => (Math.abs(x) < 0.012 ? 0x4a2e18 : 0x7a4e2a)), 0, 0.09, 0),
      M.xf(M.paint(new THREE.TorusGeometry(0.13, 0.012, 6, 24), 0x4a2e18), 0, 0.09, 0, Math.PI / 2),
    ] }],
    gorro_piel: () => [{ bone: 'head', geos: [
      M.xf(M.paint(new THREE.SphereGeometry(0.142, 18, 9, 0, Math.PI * 2, 0, Math.PI / 2), 0xe8e2d6), 0, 0.085, 0, 0, 0, 0, [1, 1.1, 1]),
      M.xf(M.paint(new THREE.TorusGeometry(0.138, 0.028, 8, 24), 0xf6f2ea), 0, 0.09, 0, Math.PI / 2),
      M.ball(0.045, 0xf6f2ea, 0, 0.255, 0), M.ball(0.05, 0xe8e2d6, 0.125, 0.03, -0.005, [0.5, 1.2, 1]), M.ball(0.05, 0xe8e2d6, -0.125, 0.03, -0.005, [0.5, 1.2, 1]),
    ] }],
    casco_hierro: () => [{ bone: 'head', metal: true, geos: [
      M.xf(M.paint(new THREE.SphereGeometry(0.138, 18, 9, 0, Math.PI * 2, 0, Math.PI / 2), metalC), 0, 0.085, 0),
      M.xf(M.paint(new THREE.TorusGeometry(0.137, 0.014, 6, 24), 0x7a8086), 0, 0.085, 0, Math.PI / 2),
      M.xf(M.paint(new THREE.BoxGeometry(0.022, 0.1, 0.02), 0x7a8086), 0, 0.05, 0.14),
      M.xf(M.paint(new THREE.BoxGeometry(0.02, 0.02, 0.26), 0x7a8086), 0, 0.22, 0),
    ] }],
    casco_buceo: () => [{ bone: 'head', metal: true, geos: [
      M.xf(M.paint(new THREE.SphereGeometry(0.195, 20, 14), (x, y, z) => (z > 0.1 && Math.hypot(x, y) < 0.1 ? 0x1e3a4a : 0xc8a050)), 0, 0.08, 0),
      M.xf(M.paint(new THREE.TorusGeometry(0.1, 0.018, 6, 20), 0xa88838), 0, 0.08, 0.168),
      M.xf(M.paint(new THREE.TorusGeometry(0.165, 0.03, 6, 24), 0xa88838), 0, -0.1, 0, Math.PI / 2),
      ...[0, 1, 2, 3, 4, 5].map((i) => M.ball(0.014, 0x8a6a28, Math.cos(i * 1.05) * 0.165, -0.1, Math.sin(i * 1.05) * 0.165)),
    ] }],
    tocado_shandara: () => {
      const g = [M.xf(M.paint(new THREE.TorusGeometry(0.122, 0.018, 6, 20), 0xc0302a), 0, 0.1, 0, Math.PI / 2)];
      for (let i = 0; i < 7; i++) { const a = (i / 6 - 0.5) * 2.2; g.push(M.xf(M.paint(new THREE.ConeGeometry(0.025, 0.3, 4), i % 2 ? 0xf0e0b0 : 0x2a8a6a), Math.sin(a) * 0.12, 0.25, -Math.cos(a) * 0.12, -0.3, a, 0, [1, 1, 0.3])); }
      return [{ bone: 'head', geos: g }];
    },
    bicornio: () => [{ bone: 'head', geos: [
      M.ball(0.17, 0x1a1a1e, 0, 0.19, 0, [1.9, 0.48, 0.78], 20, 10),
      M.xf(M.paint(new THREE.TorusGeometry(0.17, 0.008, 6, 28), 0xd8b040), 0, 0.19, 0, Math.PI / 2, 0, 0, [1.9, 0.78, 1]),
      M.ball(0.032, 0xf4f0e6, 0, 0.23, 0.12), M.ball(0.01, 0x111111, 0.011, 0.235, 0.148), M.ball(0.01, 0x111111, -0.011, 0.235, 0.148),
    ] }],
    // ---------------------------------------------------------------- pecho
    chaleco_fibra: () => [{ bone: 'chest', geos: [shell([[0.001, -0.32], [0.205, -0.31], [0.215, -0.15], [0.222, 0.05], [0.215, 0.18], [0.14, 0.26], [0.001, 0.27]], (x, y, z) => (z > 0.1 && Math.abs(x) < 0.04 ? 0xe6dfcc : Math.sin(y * 90) > 0.6 ? 0xa89050 : 0xc8b070))] }],
    chaqueta_cuero: () => [
      { bone: 'chest', geos: [shell([[0.001, -0.34], [0.21, -0.33], [0.22, -0.15], [0.226, 0.05], [0.22, 0.18], [0.15, 0.26], [0.001, 0.27]], (x, y, z) => (z > 0.1 && Math.abs(x) < 0.012 ? 0x2a1a0e : 0x6a4226)),
        ...[0, 1, 2, 3].map((i) => M.xf(M.paint(new THREE.BoxGeometry(0.06, 0.008, 0.008), 0xd8c8a0), 0, -0.2 + i * 0.1, 0.155, 0, 0, i % 2 ? 0.4 : -0.4))] },
      ...sleeves(0x6a4226, 0x5a3820, false),
    ],
    abrigo: () => [
      { bone: 'chest', geos: [shell([[0.001, -0.58], [0.25, -0.57], [0.235, -0.3], [0.225, 0], [0.228, 0.16], [0.16, 0.25], [0.001, 0.27]], 0x7a5230),
        M.xf(M.paint(new THREE.TorusGeometry(0.12, 0.045, 8, 20), 0xd8c8a8), 0, 0.24, 0, Math.PI / 2, 0, 0, [1.2, 0.85, 1])] },
      ...sleeves(0x7a5230, 0x6a4628, true),
    ],
    abrigo_grueso: () => [
      { bone: 'chest', geos: [shell([[0.001, -0.6], [0.26, -0.59], [0.245, -0.3], [0.235, 0], [0.238, 0.16], [0.17, 0.26], [0.001, 0.28]], (x, y) => (y < -0.5 ? 0xffffff : 0xeeeae2)),
        M.xf(M.paint(new THREE.TorusGeometry(0.125, 0.06, 8, 20), 0xffffff), 0, 0.24, 0, Math.PI / 2, 0, 0, [1.2, 0.85, 1])] },
      ...sleeves(0xeeeae2, 0xffffff, true),
    ],
    coraza_hierro: () => [{ bone: 'chest', metal: true, geos: [
      shell([[0.001, -0.3], [0.215, -0.29], [0.228, -0.12], [0.235, 0.06], [0.228, 0.18], [0.15, 0.26], [0.001, 0.27]], (x, y, z) => (Math.abs(Math.sin(y * 18)) > 0.96 ? 0x6a7076 : metalC)),
      ...[-1, 1].map((s) => M.ball(0.09, 0x8a9096, s * 0.23, 0.2, 0, [1.1, 0.8, 1])),
      ...[-0.15, 0, 0.15].map((y) => M.ball(0.012, 0x5a6066, 0.1, y, 0.155)), ...[-0.15, 0, 0.15].map((y) => M.ball(0.012, 0x5a6066, -0.1, y, 0.155)),
    ] }],
    coraza_obsidiana: () => [{ bone: 'chest', metal: true, geos: [
      shell([[0.001, -0.3], [0.218, -0.29], [0.232, -0.12], [0.238, 0.06], [0.23, 0.18], [0.15, 0.26], [0.001, 0.27]], (x, y, z) => (Math.sin(x * 40 + y * 30) > 0.85 ? 0x5a3a8a : 0x1e1a24)),
      ...[-1, 1].map((s) => M.ball(0.09, 0x2a2430, s * 0.23, 0.2, 0, [1.1, 0.8, 1])),
      ...[-1, 1].map((s) => M.xf(M.paint(new THREE.ConeGeometry(0.025, 0.12, 5), 0x3a2a4a), s * 0.26, 0.28, 0, 0, 0, s * -0.6)),
    ] }],
    casaca_capitan: () => [
      { bone: 'chest', geos: [shell([[0.001, -0.6], [0.25, -0.59], [0.235, -0.3], [0.227, 0], [0.23, 0.16], [0.16, 0.25], [0.001, 0.27]], (x, y, z) => (z > 0.11 && Math.abs(x) < 0.02 ? 0xd8b040 : 0xa01e1e)),
        ...[0, 1, 2, 3, 4].map((i) => M.ball(0.014, 0xe8c050, 0.04, 0.15 - i * 0.1, 0.16)), ...[0, 1, 2, 3, 4].map((i) => M.ball(0.014, 0xe8c050, -0.04, 0.15 - i * 0.1, 0.16)),
        ...[-1, 1].map((s) => M.ball(0.06, 0xe8c050, s * 0.2, 0.23, 0, [1.3, 0.4, 1]))] },
      ...sleeves(0xa01e1e, 0x8a1818, true),
    ],
    // ---------------------------------------------------------------- piernas
    pantalon_fibra: () => legs(0xc8b070, null),
    pantalon_cuero: () => legs(0x5a3a20, 0x4e321c),
    pantalon_piel: () => legs(0xd8d0c0, 0xc8c0b0),
    grebas_hierro: () => {
      const out = legs(0x5a3a20, 0x5a3a20);
      for (const s of ['L', 'R']) out.push({ bone: 'sh' + s, metal: true, geos: [M.xf(M.paint(new THREE.BoxGeometry(0.1, 0.34, 0.03), metalC), 0, -0.2, 0.065), M.ball(0.055, 0x8a9096, 0, -0.01, 0.045, [1, 1, 0.7])] });
      return out;
    },
    // ---------------------------------------------------------------- pies
    sandalias: () => ['L', 'R'].map((s) => ({ bone: 'ft' + s, geos: [M.xf(M.paint(new THREE.BoxGeometry(0.1, 0.018, 0.26), 0xa07040), 0, -0.075, 0.04), M.xf(M.paint(new THREE.BoxGeometry(0.11, 0.012, 0.025), 0x6a4020), 0, -0.035, 0.1), M.xf(M.paint(new THREE.BoxGeometry(0.11, 0.012, 0.025), 0x6a4020), 0, -0.035, -0.02)] })),
    botas_cuero: () => boots(0x5a3a20, 0x2a1a10),
    botas_nieve: () => boots(0xe8e2d6, 0x3a3230, 0xf6f2ea),
    botas_hierro: () => boots(metalC, 0x4a4e52, null, true),
    botas_lava: () => boots((x, y, z) => (Math.sin(x * 60 + y * 40 + z * 30) > 0.9 ? 0xff7a20 : 0x1e1a1c), 0x0e0c0c),
    aletas: () => ['L', 'R'].map((s) => ({ bone: 'ft' + s, geos: [M.ball(0.068, 0xf0c020, 0, -0.03, 0.045, [1, 0.95, 2.1]), M.xf(M.fin([[-0.07, 0], [0.07, 0], [0.11, 0.32], [-0.11, 0.32]], 0.012, 0xf0c020), 0, -0.07, 0.12, Math.PI / 2, 0, 0)] })),
  };
  function sleeves(c1, c2, long) {
    const out = [];
    for (const s of ['L', 'R']) {
      out.push({ bone: 'ua' + s, geos: [tube(0.03, -0.27, 0.062, 0.054, c1)] });
      if (long) out.push({ bone: 'fa' + s, geos: [tube(0.01, -0.2, 0.054, 0.048, c2)] });
    }
    return out;
  }
  function legs(cThigh, cShin) {
    const out = [];
    for (const s of ['L', 'R']) {
      out.push({ bone: 'th' + s, geos: [tube(0.03, -0.43, 0.09, 0.068, cThigh)] });
      if (cShin) out.push({ bone: 'sh' + s, geos: [tube(0.01, -0.36, 0.066, 0.054, cShin)] });
    }
    return out;
  }
  function boots(c, sole, cuff, metal) {
    const out = [];
    for (const s of ['L', 'R']) {
      out.push({ bone: 'ft' + s, metal, geos: [M.ball(0.068, c, 0, -0.025, 0.045, [1, 0.95, 2.1], 14, 10), M.xf(M.paint(new THREE.BoxGeometry(0.12, 0.025, 0.28), sole), 0, -0.075, 0.045)] });
      out.push({ bone: 'sh' + s, metal, geos: [tube(-0.18, -0.42, 0.064, 0.066, c), ...(cuff ? [M.xf(M.paint(new THREE.TorusGeometry(0.066, 0.022, 6, 16), cuff), 0, -0.18, 0, Math.PI / 2)] : [])] });
    }
    return out;
  }

  // Coloca (o quita) el equipo en un modelo de personaje. ids = [cabeza, pecho, piernas, pies]
  Eq.apply = function (model, ids) {
    const key = (ids || []).join('|');
    if (model.eqKey === key) return;
    model.eqKey = key;
    for (const m of model.eqMeshes || []) { m.parent && m.parent.remove(m); m.geometry.dispose(); }
    model.eqMeshes = [];
    if (!model.eqMat) {
      model.eqMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 });
      model.eqMetal = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.6 });
    }
    for (const id of ids || []) {
      const d = id && DESIGNS[id];
      if (!d) continue;
      for (const p of d()) {
        const b = bone(model, p.bone);
        if (!b) continue;
        const m = new THREE.Mesh(U.merge(p.geos.flat()), p.metal ? model.eqMetal : model.eqMat);
        m.castShadow = true;
        b.add(m);
        model.eqMeshes.push(m);
      }
    }
  };
  Eq.has = (id) => !!DESIGNS[id];
})();
