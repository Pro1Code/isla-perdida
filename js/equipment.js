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
    // ---------------------------------------------------------------- conjuntos de los personajes (no se venden)
    // Protagonista: fajín rojo con colas que se mecen, correa cruzada con bolsa y muñequeras
    heroe_fajin: () => sash(0xb02a2a, 0x7e1a1a),
    heroe_correa: () => strap(-1, 0x5a3a20, 0xc8a040, true),
    munequeras: () => ['L', 'R'].map((s) => ({ bone: 'fa' + s, geos: [tube(-0.135, -0.215, 0.034, 0.031, 0xe2d6b8), M.xf(M.paint(new THREE.TorusGeometry(0.034, 0.005, 5, 14), 0x8a6a40), 0, -0.16, 0, Math.PI / 2), M.xf(M.paint(new THREE.TorusGeometry(0.032, 0.005, 5, 14), 0x8a6a40), 0, -0.2, 0, Math.PI / 2)] })),
    hombrera: () => [{ bone: 'uaL', geos: [M.xf(M.paint(new THREE.SphereGeometry(0.088, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), (x, y) => (y < 0.012 ? 0x3a2414 : 0x6a4226)), 0.01, -0.005, 0, 0, 0, -0.35, [1, 0.72, 1.05]),
      ...[0, 1, 2].map((i) => M.ball(0.01, 0xc8b070, 0.01 + Math.cos(i * 0.9 - 0.9) * 0.06, 0.035, Math.sin(i * 0.9 - 0.9) * 0.06))] }],
    // Kaito: chaleco largo abierto, fajín oscuro y la vaina de la katana a la cadera
    kaito_haori: () => [{ bone: 'chest', geos: [shell([[0.001, -0.5], [0.225, -0.49], [0.215, -0.28], [0.222, 0], [0.222, 0.16], [0.15, 0.255], [0.001, 0.265]], (x, y, z) => (z > 0.09 && Math.abs(x) < 0.07 ? 0xe6dfcc : Math.abs(x) > 0.2 && y > 0.12 ? 0x1e3226 : 0x2e4a3a))] }, ...sash(0x1e2430, 0x141820, true)],
    kaito_vaina: () => [{ bone: 'hips', geos: [M.xf(M.paint(new THREE.BoxGeometry(0.036, 0.03, 0.78), (x, y, z) => (z > 0.3 ? 0xc8a040 : 0x151518)), 0.19, 0.0, -0.1, -0.55, 0.15, 0), M.xf(M.paint(new THREE.TorusGeometry(0.03, 0.008, 5, 10), 0xc8a040), 0.19, 0.18, 0.2, 0.55)] }],
    // Crane: bandolera con cartuchos de latón (del hombro izquierdo a la cadera derecha)
    crane_bandolera: () => strap(1, 0x3a2414, 0xd8b050, false, true),
    // Bastián: delantal de cocinero y pañuelo al cuello
    bastian_delantal: () => [{ bone: 'hips', geos: [M.xf(M.paint(new THREE.BoxGeometry(0.3, 0.46, 0.012), (x, y) => (y < -0.2 ? 0xe2dccc : 0xf2eee4)), 0, -0.19, 0.13, -0.08)] },
      { bone: 'chest', geos: [M.xf(M.paint(new THREE.BoxGeometry(0.2, 0.26, 0.012), 0xf2eee4), 0, -0.02, 0.122, 0.12), M.xf(M.paint(new THREE.BoxGeometry(0.012, 0.22, 0.012), 0xd8d2c2), 0.08, 0.2, 0.06, -0.5), M.xf(M.paint(new THREE.BoxGeometry(0.012, 0.22, 0.012), 0xd8d2c2), -0.08, 0.2, 0.06, -0.5)] }],
    bastian_panuelo: () => [{ bone: 'neck', geos: [M.xf(M.paint(new THREE.TorusGeometry(0.058, 0.014, 6, 16), 0xb82a24), 0, 0.02, 0.005, Math.PI / 2 - 0.2), M.xf(M.paint(new THREE.ConeGeometry(0.05, 0.09, 3), 0xb82a24), 0, -0.03, 0.062, Math.PI, 0, 0, [1, 1, 0.3])] }],
    // Capitanes y jefes: charreteras doradas con flecos, fajín, medallas y cinto con pistolas
    charreteras: () => ['L', 'R'].map((s) => ({ bone: 'ua' + s, metal: true, geos: [M.xf(M.paint(new THREE.CylinderGeometry(0.072, 0.066, 0.022, 16), 0xd8b040), 0, 0.04, 0, 0, 0, s === 'L' ? -0.3 : 0.3),
      ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => { const a = i / 8 * Math.PI * 2; return M.xf(M.paint(new THREE.CylinderGeometry(0.006, 0.006, 0.05, 4), 0xe8c050), Math.cos(a) * 0.066, 0.01, Math.sin(a) * 0.066); })] })),
    mara_fajin: () => sash(0xd8a030, 0xa87818),
    medallas: () => [{ bone: 'chest', metal: true, geos: [...[0, 1, 2].map((i) => M.xf(M.paint(new THREE.CylinderGeometry(0.014, 0.014, 0.006, 10), [0xd8b040, 0xc0c4c8, 0xc87a3a][i]), 0.05 + i * 0.03, 0.1, 0.124, Math.PI / 2)),
      ...[0, 1, 2].map((i) => M.xf(M.paint(new THREE.BoxGeometry(0.018, 0.02, 0.004), [0x2a4a9a, 0xb02a2a, 0x2a8a4a][i]), 0.05 + i * 0.03, 0.125, 0.125))] }],
    hiena_cinto: () => [{ bone: 'hips', geos: [...[-1, 1].map((s) => pistol(s * 0.1, 0.03, 0.12, s * 0.4))] }],
    // Luchadores: fajines de colores y cinto blanco de la Marina
    fajin_rojo: () => sash(0xa02424, 0x781818),
    fajin_azul: () => sash(0x2a4a8a, 0x1e3668),
    fajin_ocre: () => sash(0xc0902a, 0x98701e),
    fajin_negro: () => sash(0x22222a, 0x16161c),
    cinto_blanco: () => sash(0xf2f2ee, 0xd8d8d4, true),
  };
  // Fajín: una banda alrededor de la cintura con un nudo y dos colas que se mecen (short: sin colas)
  function sash(c1, c2, short) {
    const out = [{ bone: 'hips', geos: [M.xf(M.paint(new THREE.TorusGeometry(0.16, 0.03, 8, 30), (x, y, z) => (Math.sin(Math.atan2(z, x) * 14) > 0.7 ? c2 : c1)), 0, 0.06, 0, Math.PI / 2, 0, 0, [1.1, 0.74, 1])] }];
    if (!short) out.push({ bone: 'hips', pos: [0.12, 0.055, 0.085], anim: 'sway', geos: [M.ball(0.032, c2, 0, 0, 0, [1.2, 1, 0.8]), M.xf(M.paint(new THREE.BoxGeometry(0.045, 0.2, 0.012), c1), 0.012, -0.11, 0.004, 0, 0, 0.12), M.xf(M.paint(new THREE.BoxGeometry(0.04, 0.16, 0.012), c2), -0.018, -0.09, 0.008, 0, 0, -0.18)] });
    return out;
  }
  // Correa cruzada del hombro (side −1: derecho, 1: izquierdo) a la cadera contraria; con bolsa o con cartuchos
  function strap(side, c, metal, pouch, bullets) {
    const a = -side * 0.54, geos = [];
    for (const z of [0.124, -0.122]) geos.push(M.xf(M.paint(new THREE.BoxGeometry(0.05, 0.64, 0.012), c), 0, -0.05, z, z > 0 ? 0.08 : -0.08, 0, a));
    geos.push(M.xf(M.paint(new THREE.BoxGeometry(0.055, 0.014, 0.25), c), side * 0.135, 0.245, 0, 0, 0, side * 0.3));
    geos.push(M.xf(M.paint(new THREE.BoxGeometry(0.034, 0.03, 0.01), metal), side * 0.02, 0.0, 0.132, 0, 0, a));
    if (bullets) for (let i = 0; i < 6; i++) { const t = -0.2 + i * 0.08, x = -Math.sin(a) * t, y = -0.05 + Math.cos(a) * t; geos.push(M.xf(M.paint(new THREE.CylinderGeometry(0.008, 0.008, 0.045, 6), metal), x, y, 0.134, 0, 0, a)); }
    const out = [{ bone: 'chest', geos }];
    if (pouch) out.push({ bone: 'hips', geos: [M.xf(M.paint(new THREE.BoxGeometry(0.085, 0.075, 0.045), (x, y) => (y > 0.02 ? 0x4a2e18 : c)), -side * 0.13, -0.02, 0.105, 0, side * 0.4, 0), M.ball(0.008, metal, -side * 0.13, 0.02, 0.13)] });
    return out;
  }
  // Pistola al cinto: culata, cañón y guardamonte
  function pistol(x, y, z, ry) {
    return [M.xf(M.paint(new THREE.BoxGeometry(0.03, 0.09, 0.035), 0x5a3a20), x, y - 0.03, z, 0.3, ry, 0), M.xf(M.paint(new THREE.CylinderGeometry(0.011, 0.013, 0.2, 8), 0x3a3a40), x, y + 0.06, z + 0.03, 1.87, ry, 0), M.ball(0.014, 0xc8a040, x, y + 0.02, z + 0.02)];
  }
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
        if (p.pos) m.position.set(p.pos[0], p.pos[1], p.pos[2]);
        if (p.anim) { const f = ANIMS[p.anim], ph = Math.random() * 10; m.onBeforeRender = () => f(m, performance.now() / 1000 + ph); }
        b.add(m);
        model.eqMeshes.push(m);
      }
    }
  };
  Eq.has = (id) => !!DESIGNS[id];
  // Cosméticos de la tienda (shop.js registra sus diseños aquí)
  Eq.register = (id, fn) => { DESIGNS[id] = fn; };
  // Pequeñas animaciones de las mascotas (mirar a los lados, ladear la cabeza…)
  const ANIMS = {
    look: (m, t) => { const k = Math.sin(t * 0.7) + Math.sin(t * 1.9) * 0.35; m.rotation.set(Math.sin(t * 1.3) * 0.08, Math.abs(k) > 0.9 ? Math.sign(k) * 0.9 : k, 0); },
    tilt: (m, t) => { m.rotation.set(0, Math.sin(t * 0.5) * 0.6, Math.sin(t * 0.9) * 0.25); },
    stalks: (m, t) => { m.rotation.set(Math.sin(t * 1.1) * 0.15, 0, Math.sin(t * 0.8) * 0.2); },
    // Colas del fajín: se mecen con el viento y al moverse
    sway: (m, t) => { m.rotation.set(Math.sin(t * 2.3) * 0.12 - 0.05, 0, Math.sin(t * 1.7) * 0.1); },
  };
  // Lo que se ve sobre el personaje: el equipo (cabeza, pecho, piernas, pies) y los cosméticos.
  // Un sombrero cosmético tapa el casco (el casco sigue protegiendo igual).
  Eq.visibleIds = function (eqIds, cos) {
    const ids = (eqIds || []).slice();
    const list = (cos || []).filter((id) => DESIGNS[id]);
    if (list.some((id) => G.Shop && G.Shop.byId(id) && G.Shop.byId(id).slot === 'hat')) ids[0] = null;
    return ids.concat(list);
  };
})();
