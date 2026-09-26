// Tienda de cosméticos (solo estéticos, se pagan con doblones):
//  - Personaje: sombreros, rostro, espalda y mascotas (modelos 3D pegados a los huesos, como el equipo)
//  - Barco: diseños de vela, banderas y mascarones (aparecen al elegir el diseño en el astillero)
// Incluye la vista previa 3D que usan la Tienda y Configuración → Personaje.
(function () {
  'use strict';
  const G = window.G, U = G.U, M = G.Mdl;
  const Shop = (G.Shop = {});

  Shop.SLOTS = {
    hat: { name: 'Sombreros', one: 'Sombrero', icon: '🎩' },
    face: { name: 'Rostro', one: 'Rostro', icon: '🥸' },
    back: { name: 'Espalda', one: 'Espalda', icon: '🧥' },
    pet: { name: 'Mascotas', one: 'Mascota', icon: '🦜' },
    sail: { name: 'Velas', one: 'Vela', icon: '⛵' },
    flag: { name: 'Banderas', one: 'Bandera', icon: '🏴‍☠️' },
    fh: { name: 'Mascarones', one: 'Mascarón', icon: '🐉' },
  };
  // id · ranura · nombre · precio · icono · descripción
  Shop.CATALOG = [
    ['cos_bandana', 'hat', 'Bandana roja', 150, '🧣', 'Un pañuelo de lunares para los días de sol.'],
    ['cos_gorro_chef', 'hat', 'Gorro de cocinero', 250, '👨‍🍳', 'Para el cocinero del barco. Nadie pasa hambre a bordo.'],
    ['cos_gorra_marina', 'hat', 'Gorra de la Marina Blanca', 350, '🧢', 'Robada de un cuartel. Mejor no llevarla cerca de la Marina.'],
    ['cos_ala_ancha', 'hat', 'Sombrero de explorador', 400, '🤠', 'Ala ancha para cruzar selvas y desiertos.'],
    ['cos_tricornio', 'hat', 'Tricornio pirata', 450, '🏴‍☠️', 'El clásico de los capitanes, con ribete dorado.'],
    ['cos_copa', 'hat', 'Sombrero de copa', 500, '🎩', 'Elegancia de caballero… aunque vivas en una isla.'],
    ['cos_corona', 'hat', 'Corona de las Mareas', 1500, '👑', 'Dicen que la llevaba el Rey de las Mareas.'],
    ['cos_parche', 'face', 'Parche pirata', 200, '🏴', 'Un ojo para el mar, otro para el tesoro.'],
    ['cos_gafas', 'face', 'Gafas redondas', 250, '🕶️', 'Cristales ahumados con montura dorada.'],
    ['cos_bigote', 'face', 'Bigote de almirante', 300, '🥸', 'Imponente y bien peinado.'],
    ['cos_mascara', 'face', 'Máscara shandara', 600, '👺', 'Máscara ceremonial de la tribu Shandara.'],
    ['cos_mochila', 'back', 'Mochila de explorador', 350, '🎒', 'Con saco de dormir enrollado.'],
    ['cos_katana', 'back', 'Katana a la espalda', 700, '🗡️', 'Una espada envainada de un país lejano.'],
    ['cos_capa', 'back', 'Capa de capitán', 800, '🦸', 'Capa roja con bordes dorados.'],
    ['cos_abrigo_alm', 'back', 'Abrigo de almirante', 1200, '🧥', 'Abrigo blanco sobre los hombros, con charreteras.'],
    ['cos_gaviota', 'pet', 'Gaviota', 600, '🕊️', 'Siempre sabe dónde está la tierra más cercana.'],
    ['cos_loro', 'pet', 'Loro', 900, '🦜', 'Un loro guacamayo que no se calla nunca.'],
    ['cos_mono', 'pet', 'Mono capuchino', 1000, '🐒', 'Pequeño, curioso y un poco ladrón.'],
    ['cos_caracol', 'pet', 'Caracolófono', 1100, '🐌', 'Un caracol con auricular. ¿Quién llamará?'],
    ['sail_rayas', 'sail', 'Vela a rayas', 400, '🟥', 'Rayas rojas y blancas: se ven desde lejos.'],
    ['sail_marea', 'sail', 'Vela de la marea', 450, '🌊', 'Azul con olas blancas.'],
    ['sail_sol', 'sail', 'Vela del sol', 600, '🌞', 'Naranja con un sol radiante.'],
    ['sail_noche', 'sail', 'Vela nocturna', 700, '🌙', 'Azul noche con luna y estrellas.'],
    ['sail_dorada', 'sail', 'Vela dorada', 900, '🟨', 'Dorada con franja carmesí. Pura ostentación.'],
    ['flag_tricornio', 'flag', 'Calavera con tricornio', 350, '☠️', 'Bandera pirata con sombrero de capitán.'],
    ['flag_ancla', 'flag', 'Ancla y luna', 450, '⚓', 'Una bandera tranquila… para un barco que no lo es.'],
    ['flag_espadas', 'flag', 'Sables cruzados', 500, '⚔️', 'Calavera sobre dos sables curvos.'],
    ['flag_llamas', 'flag', 'Calavera en llamas', 650, '🔥', 'Para los que navegan cerca de los volcanes.'],
    ['flag_corona', 'flag', 'Calavera coronada', 900, '👑', 'La bandera de quien se cree rey del mar.'],
    ['fh_tiburon', 'fh', 'Mascarón de tiburón', 800, '🦈', 'Mandíbulas abiertas en la proa.'],
    ['fh_aguila', 'fh', 'Mascarón de águila', 900, '🦅', 'Mirada fija en el horizonte.'],
    ['fh_ballena', 'fh', 'Mascarón de ballena', 1000, '🐋', 'Una ballena amable que embiste olas.'],
  ].map(([id, slot, name, price, icon, desc]) => ({ id, slot, name, price, icon, desc }));
  Shop.byId = (id) => Shop.CATALOG.find((c) => c.id === id);

  // Diseños de barco comprados (el astillero los añade a los que ya había)
  Shop.ownedOf = (slot) => Shop.CATALOG.filter((c) => c.slot === slot && G.Profile.owns(c.id)).map((c) => c.id.replace(/^(sail|flag|fh)_/, ''));
  Shop.shipName = { tiburon: 'Colmillo del Mar', aguila: 'Ala del Alba', ballena: 'Gran Ballena' };
  Shop.fhName = { tiburon: 'Tiburón', aguila: 'Águila', ballena: 'Ballena' };
  Shop.sailName = { rayas: 'Rayas', marea: 'Marea', sol: 'Sol', noche: 'Noche', dorada: 'Dorada' };
  Shop.flagName = { clasica: 'Clásica', tricornio: 'Tricornio', ancla: 'Ancla y luna', espadas: 'Sables', llamas: 'Llamas', corona: 'Corona' };

  // ------------------------------------------------------------------ utilidades de modelado
  // Lámina con grosor: P(u, v) → [x, y, z]; la segunda cara se desplaza "off" y se invierte
  function sheet(nu, nv, P, color, off = [0, -0.01, 0]) {
    const pos = [], idx = [], W = nu + 1;
    for (let s = 0; s < 2; s++) for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const p = P(i / nu, j / nv);
      pos.push(p[0] + off[0] * s, p[1] + off[1] * s, p[2] + off[2] * s);
    }
    const base = W * (nv + 1);
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const a = j * W + i, b = a + 1, c = a + W, d = c + 1;
      idx.push(a, c, b, b, c, d);
      idx.push(base + a, base + b, base + c, base + b, base + d, base + c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return M.paint(g, color, 0.015);
  }
  const cyl = (rt, rb, h, seg, color, x, y, z, rx = 0, ry = 0, rz = 0, s = 1, open = false, t0 = 0, tl = Math.PI * 2) => M.xf(M.paint(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open, t0, tl), color, 0.02), x, y, z, rx, ry, rz, s);
  const torus = (r, t, color, x, y, z, rx = 0, ry = 0, rz = 0, s = 1, seg = 24) => M.xf(M.paint(new THREE.TorusGeometry(r, t, 6, seg), color, 0.02), x, y, z, rx, ry, rz, s);
  const cone = (r, h, color, x, y, z, rx = 0, ry = 0, rz = 0, s = 1, seg = 8) => M.xf(M.paint(new THREE.ConeGeometry(r, h, seg), color, 0.02), x, y, z, rx, ry, rz, s);
  const box = (w, h, d, color, x, y, z, rx = 0, ry = 0, rz = 0) => M.xf(M.paint(new THREE.BoxGeometry(w, h, d), color, 0.02), x, y, z, rx, ry, rz);
  const half = (r, color, x, y, z, s = 1, thetaLen = Math.PI / 2) => M.xf(M.paint(new THREE.SphereGeometry(r, 20, 10, 0, Math.PI * 2, 0, thetaLen), color, 0.02), x, y, z, 0, 0, 0, s);
  const GOLD = 0xd8b040, BLACK = 0x1c1a1e;

  // ------------------------------------------------------------------ cosméticos del personaje
  // Coordenadas locales del hueso: cabeza (y ≈ 0.155 = donde apoya un sombrero; ojos en y 0.128, z 0.1)
  // y pecho (hombros en y ≈ 0.25, espalda en z ≈ -0.16)
  const D = {
    cos_tricornio: () => {
      const ph = (a) => Math.cos(3 * (a - Math.PI / 2));
      const brim = sheet(48, 5, (u, v) => {
        const a = u * Math.PI * 2, R = 0.2 * (1 + 0.26 * ph(a)), r = 0.112 + v * (R - 0.112);
        return [Math.cos(a) * r, 0.152 + Math.pow(v, 1.2) * (0.035 + 0.16 * (1 - ph(a)) / 2), Math.sin(a) * r];
      }, (x, y, z) => (Math.hypot(x, z) > 0.188 * (1 + 0.22 * ph(Math.atan2(z, x))) ? GOLD : BLACK));
      return [{ bone: 'head', geos: [brim, half(0.126, BLACK, 0, 0.128, 0, [1, 0.95, 1.05]), M.ball(0.024, 0xf2eee4, 0, 0.21, 0.135, [1, 1, 0.6]), M.ball(0.006, 0x111111, 0.008, 0.214, 0.148), M.ball(0.006, 0x111111, -0.008, 0.214, 0.148)] }];
    },
    cos_bandana: () => [{ bone: 'head', geos: [
      M.xf(M.paint(new THREE.SphereGeometry(0.134, 22, 12, 0, Math.PI * 2, 0, 1.3), (x, y, z) => (Math.sin(x * 95) + Math.sin(y * 95) + Math.sin(z * 95) > 2.1 ? 0xf6f2ea : 0xc0282a), 0.02), 0, 0.09, -0.008, -0.42),
      M.ball(0.03, 0xb02424, 0, 0.07, -0.135, [1.2, 0.9, 0.8]),
      box(0.035, 0.12, 0.008, 0xc0282a, 0.02, 0.0, -0.142, 0.25, 0, 0.25), box(0.035, 0.1, 0.008, 0xc0282a, -0.02, 0.01, -0.142, 0.25, 0, -0.3),
    ] }],
    cos_gorra_marina: () => [{ bone: 'head', geos: [
      M.lathe([[0.001, 0.155], [0.128, 0.155], [0.136, 0.2], [0.142, 0.248], [0.1, 0.27], [0.001, 0.265]], 24, (x, y) => (y < 0.19 ? 0x1e2a4a : 0xf4f2ec)),
      cyl(0.105, 0.105, 0.008, 20, 0x14141a, 0, 0.162, 0.07, -0.18, 0, 0, [1, 1, 1.25], false, -Math.PI / 2, Math.PI),
      M.ball(0.018, GOLD, 0, 0.205, 0.132, [1.4, 1, 0.5]),
      cone(0.012, 0.04, GOLD, 0.025, 0.21, 0.13, 0, 0, -1.2), cone(0.012, 0.04, GOLD, -0.025, 0.21, 0.13, 0, 0, 1.2),
    ] }],
    cos_gorro_chef: () => [{ bone: 'head', geos: [
      M.lathe([[0.001, 0.155], [0.126, 0.155], [0.128, 0.22], [0.15, 0.3], [0.158, 0.36], [0.13, 0.415], [0.07, 0.435], [0.001, 0.44]], 24, (x, y, z) => (y < 0.215 ? 0xe8e4da : Math.sin(Math.atan2(z, x) * 9) > 0.7 ? 0xe6e2d8 : 0xfbfaf6)),
    ] }],
    cos_ala_ancha: () => {
      const brim = sheet(40, 5, (u, v) => {
        const a = u * Math.PI * 2, r = 0.118 + v * 0.18;
        return [Math.cos(a) * r, 0.154 + v * v * 0.075 * Math.abs(Math.cos(a)) - v * 0.012 * Math.max(0, Math.sin(a)), Math.sin(a) * r];
      }, (x, y, z) => (Math.hypot(x, z) > 0.285 ? 0x6a4628 : 0x8a6038));
      return [{ bone: 'head', geos: [brim,
        M.lathe([[0.001, 0.155], [0.12, 0.155], [0.122, 0.22], [0.11, 0.28], [0.07, 0.29], [0.001, 0.275]], 22, (x, y) => (y > 0.165 && y < 0.2 ? 0x3a2a1a : 0x8a6038)),
        box(0.012, 0.03, 0.03, 0xe8e0c8, 0.12, 0.185, 0.02)] }];
    },
    cos_copa: () => [{ bone: 'head', geos: [
      cyl(0.106, 0.112, 0.2, 24, BLACK, 0, 0.26, 0), cyl(0.114, 0.115, 0.034, 24, 0x8a1a1a, 0, 0.178, 0),
      M.xf(M.paint((() => { const g = new THREE.CylinderGeometry(0.195, 0.195, 0.012, 32, 1); const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + Math.pow(p.getX(i) / 0.195, 2) * 0.03); g.computeVertexNormals(); return g; })(), BLACK, 0.02), 0, 0.157, 0),
    ] }],
    cos_corona: () => {
      const g = [cyl(0.13, 0.126, 0.07, 28, (x, y, z) => (Math.abs(Math.sin(Math.atan2(z, x) * 8) * 0.02 - (y - 0)) < 0.006 ? 0xb08a28 : 0xe8c050), 0, 0.19, 0)];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2, x = Math.cos(a) * 0.128, z = Math.sin(a) * 0.128;
        g.push(cone(0.022, i % 2 ? 0.06 : 0.085, 0xe8c050, x, 0.255 + (i % 2 ? 0 : 0.012), z, 0, 0, 0, 1, 6));
        g.push(M.ball(0.014, i % 2 ? 0xc01e3a : 0x2a6ae0, Math.cos(a) * 0.132, 0.19, Math.sin(a) * 0.132));
        if (!(i % 2)) g.push(M.ball(0.012, 0xf4f0e0, x, 0.305, z));
      }
      return [{ bone: 'head', metal: true, geos: g }];
    },
    cos_parche: () => [{ bone: 'head', geos: [
      cyl(0.026, 0.024, 0.008, 16, 0x111111, -0.036, 0.13, 0.108, Math.PI / 2 - 0.15, 0, 0, [1, 1, 1.15]),
      torus(0.121, 0.004, 0x111111, 0, 0.135, -0.004, Math.PI / 2 - 0.22, 0, 0, [1.02, 1.08, 1], 36),
    ] }],
    cos_gafas: () => {
      const g = [];
      for (const s of [-1, 1]) {
        g.push(cyl(0.025, 0.025, 0.004, 18, 0x20242c, s * 0.037, 0.128, 0.121, Math.PI / 2));
        g.push(torus(0.026, 0.0035, GOLD, s * 0.037, 0.128, 0.122, 0, 0, 0, 1, 18));
        g.push(box(0.004, 0.004, 0.12, GOLD, s * 0.066, 0.13, 0.065, 0, s * -0.12, 0));
      }
      g.push(box(0.022, 0.004, 0.004, GOLD, 0, 0.134, 0.124));
      return [{ bone: 'head', metal: true, geos: g }];
    },
    cos_bigote: () => [{ bone: 'head', geos: [-1, 1].map((s) => M.tube([[s * 0.004, 0.1, 0.124], [s * 0.03, 0.096, 0.126], [s * 0.058, 0.09, 0.118], [s * 0.078, 0.098, 0.104], [s * 0.084, 0.114, 0.094]], [0.013, 0.004], 7, 0x2a1a10, 10)) }],
    cos_mascara: () => [{ bone: 'head', geos: [
      M.xf(M.paint(new THREE.SphereGeometry(0.136, 22, 14, Math.PI / 2 - 0.95, 1.9, 0.5, 1.4), (x, y, z) => {
        const ey = y - 0.03;
        if (Math.hypot(Math.abs(x) - 0.037, ey) < 0.022) return 0x111111;
        if (Math.abs(x) > 0.06 && Math.abs(Math.sin(y * 70)) > 0.7) return 0xb0281e;
        if (y < -0.03 && Math.abs(Math.sin(x * 110)) > 0.6) return 0x111111;
        return Math.abs(x) < 0.01 ? 0xb0281e : 0xe8dcbc;
      }, 0.02), 0, 0.1, 0.014, 0, 0, 0, [1, 1.12, 1]),
      ...[-1, 0, 1].map((k) => cone(0.02, 0.16, k ? 0x2a8a6a : 0xc0302a, k * 0.06, 0.29, 0.06, -0.25, 0, -k * 0.35, [1, 1, 0.35], 4)),
      cone(0.012, 0.05, 0xf4f0e0, 0.05, 0.02, 0.14, Math.PI, 0, 0.2), cone(0.012, 0.05, 0xf4f0e0, -0.05, 0.02, 0.14, Math.PI, 0, -0.2),
    ] }],
    // ---------------------------------------------------------------- espalda
    cos_capa: () => [{ bone: 'chest', geos: [
      sheet(14, 12, (u, v) => { const a = (u - 0.5) * 2.0, r = 0.25 + v * 0.1; return [Math.sin(a) * r, 0.25 - v * 0.95, -Math.cos(a) * r * 0.68 - 0.012 - v * 0.03]; },
        (x, y, z) => (y < -0.66 || Math.abs(Math.atan2(x, -z)) > 0.93 ? GOLD : 0xa01e1e), [0, 0, 0.012]),
      torus(0.13, 0.02, GOLD, 0, 0.245, -0.01, Math.PI / 2, 0, 0, [1.25, 0.8, 1]),
      M.ball(0.025, GOLD, 0.1, 0.21, 0.11), M.ball(0.025, GOLD, -0.1, 0.21, 0.11),
    ] }],
    cos_abrigo_alm: () => {
      const g = [sheet(18, 12, (u, v) => { const a = (u - 0.5) * 2.7, r = 0.268 + v * 0.07; return [Math.sin(a) * r, 0.26 - v * 1.02, -Math.cos(a) * r * 0.7 - v * 0.02]; },
        (x, y, z) => (Math.abs(x) < 0.05 && y < -0.05 && y > -0.35 && z < 0 && Math.abs(Math.sin(y * 40 + x * 30)) < 0.45 ? 0x2a4a8a : y < -0.7 ? 0xe0dcd0 : 0xf6f4ee), [0, 0, 0.012]),
        torus(0.14, 0.03, 0xf6f4ee, 0, 0.25, -0.01, Math.PI / 2, 0, 0, [1.3, 0.85, 1])];
      for (const s of [-1, 1]) {
        g.push(M.ball(0.075, GOLD, s * 0.23, 0.245, 0, [1.25, 0.35, 1]));
        for (let k = 0; k < 7; k++) g.push(cyl(0.006, 0.006, 0.05, 5, 0xe8c050, s * (0.2 + k * 0.012), 0.21, -0.04 + k * 0.013));
        g.push(M.tube([[s * 0.29, 0.2, -0.03], [s * 0.31, -0.1, -0.05], [s * 0.31, -0.42, -0.07]], [0.058, 0.05], 10, 0xf6f4ee, 6));
        g.push(torus(0.05, 0.012, GOLD, s * 0.31, -0.42, -0.07, Math.PI / 2));
      }
      return [{ bone: 'chest', geos: g }];
    },
    cos_katana: () => [{ bone: 'chest', geos: [
      cyl(0.024, 0.02, 0.62, 10, (x, y) => (Math.abs(Math.sin(y * 26)) > 0.93 ? 0xa01e1e : 0x15131a), 0.02, -0.08, -0.2, 0, 0, 0.8),
      cyl(0.045, 0.045, 0.012, 14, GOLD, -0.17, 0.155, -0.2, 0, 0, 0.8),
      cyl(0.02, 0.02, 0.19, 10, (x, y) => (Math.abs(Math.sin(y * 60 + x * 60)) > 0.6 ? 0x111111 : 0xf2eee2), -0.245, 0.235, -0.2, 0, 0, 0.8),
      M.ball(0.024, GOLD, -0.315, 0.305, -0.2),
      box(0.03, 0.34, 0.02, 0x3a2416, 0, 0.1, -0.02, 0.35, 0, 0.62),
    ] }],
    cos_mochila: () => [{ bone: 'chest', geos: [
      M.ball(0.135, 0x6a4a2a, 0, 0.0, -0.225, [1.05, 1.35, 0.62], 16, 12),
      M.ball(0.1, 0x5a3a20, 0, 0.13, -0.2, [1.25, 0.45, 0.85]),
      M.ball(0.06, 0x7a5a36, 0, -0.07, -0.305, [1.2, 0.9, 0.5]),
      cyl(0.055, 0.055, 0.34, 14, (x, y, z) => (Math.abs(Math.sin(Math.atan2(z - 0.0, y) * 6)) > 0.9 ? 0x3a4a2a : 0x6a7a4a), 0, 0.23, -0.19, 0, 0, Math.PI / 2),
      ...[-1, 1].map((s) => M.tube([[s * 0.1, 0.24, -0.12], [s * 0.11, 0.26, 0.02], [s * 0.1, 0.12, 0.15], [s * 0.1, -0.12, 0.155]], [0.014, 0.014], 5, 0x3a2416, 10)),
      box(0.04, 0.03, 0.02, 0xc8b070, 0, -0.07, -0.34),
    ] }],
    // ---------------------------------------------------------------- mascotas (en el hombro izquierdo; la cabeza se mueve)
    cos_loro: () => [
      { bone: 'chest', geos: [
        M.xf(M.ball(0.052, 0xd8241e, 0, 0, 0, [1, 1.55, 1.05], 14, 12), 0.2, 0.34, -0.025, 0.25, 0, 0),
        ...[-1, 1].map((s) => M.xf(M.fin([[0.03, 0.05], [0.0, 0.03], [-0.07, -0.08], [-0.03, -0.1]], 0.012, (x, y) => (y < -0.05 ? 0x2a5ad8 : y < -0.01 ? 0xf2c020 : 0xd8241e)), 0.2 + s * 0.052, 0.345, -0.03, 0.2, -Math.PI / 2, 0)),
        M.xf(M.fin([[-0.02, 0], [0.02, 0], [0.012, -0.2], [-0.012, -0.2]], 0.01, (x, y) => (y < -0.1 ? 0x2a5ad8 : 0xd8241e)), 0.2, 0.28, -0.07, 0.55, 0, 0),
        M.ball(0.012, 0x6a6a6a, 0.185, 0.265, 0.0), M.ball(0.012, 0x6a6a6a, 0.215, 0.265, 0.0),
      ] },
      { bone: 'chest', pos: [0.2, 0.43, -0.005], anim: 'look', geos: [
        M.ball(0.042, 0xd8241e, 0, 0, 0, [1, 1, 1.1], 14, 12),
        ...[-1, 1].map((s) => M.ball(0.02, 0xf6f2ea, s * 0.03, 0.002, 0.018, [0.5, 1, 1])),
        ...[-1, 1].map((s) => M.ball(0.008, 0x111111, s * 0.036, 0.008, 0.02)),
        M.xf(M.paint(new THREE.ConeGeometry(0.018, 0.05, 8), 0xefe6cc), 0, -0.01, 0.05, 1.9, 0, 0),
        M.ball(0.012, 0x222222, 0, -0.025, 0.035),
      ] },
    ],
    cos_gaviota: () => [
      { bone: 'chest', geos: [
        M.ball(0.05, 0xf8f6f0, 0.2, 0.32, -0.02, [1, 0.95, 1.7], 14, 10),
        ...[-1, 1].map((s) => M.xf(M.fin([[0, 0.02], [0.06, 0.0], [0.05, -0.16], [0.0, -0.1]], 0.01, (x, y) => (y < -0.1 ? 0x1c1c1e : 0x9aa0a8)), 0.2 + s * 0.045, 0.335, 0.04, Math.PI / 2 - 0.1, 0, s * 0.2)),
        box(0.05, 0.01, 0.06, 0x9aa0a8, 0.2, 0.33, -0.1, 0.3, 0, 0),
        ...[-1, 1].map((s) => cyl(0.005, 0.005, 0.05, 4, 0xe8a030, 0.2 + s * 0.02, 0.27, -0.02)),
      ] },
      { bone: 'chest', pos: [0.2, 0.37, 0.07], anim: 'look', geos: [
        M.ball(0.036, 0xf8f6f0, 0, 0, 0, 1, 14, 10),
        M.xf(M.paint(new THREE.ConeGeometry(0.011, 0.055, 6), 0xf0c020), 0, -0.006, 0.05, Math.PI / 2 + 0.1, 0, 0),
        M.ball(0.006, 0xd82020, 0, -0.012, 0.06),
        ...[-1, 1].map((s) => M.ball(0.006, 0x111111, s * 0.026, 0.01, 0.018)),
      ] },
    ],
    cos_mono: () => [
      { bone: 'chest', geos: [
        M.ball(0.058, 0x6a4424, 0.205, 0.33, -0.02, [1, 1.2, 0.9], 14, 10),
        M.ball(0.04, 0xd8b890, 0.205, 0.32, 0.02, [1, 1.1, 0.6]),
        ...[-1, 1].map((s) => M.tube([[0.205 + s * 0.045, 0.37, -0.01], [0.205 + s * 0.07, 0.31, 0.03], [0.205 + s * 0.05, 0.27, 0.07]], [0.016, 0.012], 6, 0x6a4424, 8)),
        ...[-1, 1].map((s) => M.ball(0.022, 0x6a4424, 0.205 + s * 0.035, 0.28, 0.03, [1, 0.8, 1.3])),
        M.tube([[0.205, 0.29, -0.07], [0.22, 0.2, -0.14], [0.24, 0.08, -0.17], [0.2, -0.02, -0.18], [0.16, 0.0, -0.17]], [0.012, 0.008], 6, 0x6a4424, 16),
      ] },
      { bone: 'chest', pos: [0.205, 0.43, 0.0], anim: 'tilt', geos: [
        M.ball(0.046, 0x6a4424, 0, 0, 0, 1, 14, 10),
        M.ball(0.032, 0xd8b890, 0, -0.008, 0.028, [1.15, 1, 0.7]),
        ...[-1, 1].map((s) => M.ball(0.018, 0xd8b890, s * 0.05, 0.005, 0, [0.5, 1, 1])),
        ...[-1, 1].map((s) => M.ball(0.007, 0x111111, s * 0.014, 0.004, 0.05)),
        M.ball(0.006, 0x3a2414, 0, -0.018, 0.055),
      ] },
    ],
    cos_caracol: () => {
      const shell = [];
      for (let i = 0; i < 26; i++) { const a = i * 0.42, r = 0.055 * Math.exp(-i * 0.06); shell.push([0, Math.sin(a) * r * 0.9, -Math.cos(a) * r * 0.9 + 0.0]); }
      return [
        { bone: 'chest', geos: [
          M.loft({ z0: -0.07, z1: 0.07, n: 10, m: 10, prof: (t) => ({ rx: 0.028, ry: 0.022 + Math.sin(t * Math.PI) * 0.01, y: 0 }), color: () => 0xe8b890 }),
          M.tube(shell, [0.036, 0.008], 10, (t) => (Math.sin(t * 38) > 0.2 ? 0xe07a2a : 0xf0b050), 30),
          M.tube([[0.03, 0.11, -0.02], [0.05, 0.13, 0.02], [0.03, 0.13, 0.06]], [0.008, 0.008], 6, 0x2a4a2a, 8),
          M.ball(0.018, 0x2a4a2a, 0.03, 0.105, -0.03, [1, 0.6, 1.2]), M.ball(0.018, 0x2a4a2a, 0.03, 0.105, 0.07, [1, 0.6, 1.2]),
        ].map((g) => M.xf(g, 0.2, 0.3, -0.03, 0, 0, 0, 1.35)) },
        { bone: 'chest', pos: [0.2, 0.33, 0.055], anim: 'stalks', geos: [
          ...[-1, 1].map((s) => M.tube([[s * 0.01, 0, 0], [s * 0.018, 0.04, 0.01], [s * 0.022, 0.07, 0.012]], [0.006, 0.005], 5, 0xe8b890, 6)),
          ...[-1, 1].map((s) => M.ball(0.012, 0x111111, s * 0.022, 0.075, 0.014)),
        ] },
      ];
    },
  };
  for (const [id, fn] of Object.entries(D)) G.Equip.register(id, fn);

  // ------------------------------------------------------------------ velas, banderas y mascarones
  // Color de la vela según el diseño (u horizontal y v vertical, de 0 a 1)
  const SAIL = {
    rayas: (u) => (Math.floor(u * 7) % 2 ? 0xc8322a : 0xf2ede0),
    marea: (u, v) => (Math.abs(v - 0.62 - Math.sin(u * 14) * 0.035) < 0.035 || Math.abs(v - 0.78 - Math.sin(u * 14 + 1) * 0.03) < 0.03 ? 0xf2f2f0 : 0x2a6aa8),
    sol: (u, v) => { const d = Math.hypot(u - 0.5, (v - 0.45) * 0.8); const a = Math.atan2(v - 0.45, u - 0.5); return d < 0.14 ? 0xf8d040 : d < 0.26 && Math.sin(a * 12) > 0.3 ? 0xf2b030 : 0xe0662a; },
    noche: (u, v) => { const d = Math.hypot(u - 0.5, v - 0.42), d2 = Math.hypot(u - 0.56, v - 0.38); if (d < 0.17 && d2 > 0.14) return 0xf0e6b0; const h = Math.sin(u * 91.7 + v * 47.3) * 43758.5; return h - Math.floor(h) > 0.985 ? 0xf8f4e0 : 0x1a2440; },
    dorada: (u, v) => (v > 0.4 && v < 0.54 ? 0x9a1a24 : u < 0.04 || u > 0.96 || v > 0.95 ? 0x9a1a24 : 0xe4b848),
  };
  // Devuelve la función de color para M.paint (ejes: 'x' en las velas cuadradas, 'z' en las triangulares)
  Shop.sailPaint = function (design, geo, axis) {
    const f = SAIL[design];
    if (!f) return 0xeee6d2;
    geo.computeBoundingBox();
    const b = geo.boundingBox, h0 = axis === 'z' ? b.min.z : b.min.x, h1 = axis === 'z' ? b.max.z : b.max.x;
    return (x, y, z) => f(((axis === 'z' ? z : x) - h0) / (h1 - h0 || 1), 1 - (y - b.min.y) / (b.max.y - b.min.y || 1));
  };
  Shop.isSailDesign = (v) => typeof v === 'string' && !!SAIL[v];
  Shop.sailColorAt = (d, u, v) => (SAIL[d] ? SAIL[d](u, v) : 0xeee6d2);
  // Dibuja el emblema de la bandera (el fondo negro y las franjas del equipo las pone ships.js)
  Shop.drawFlag = function (c, w, h, design) {
    const cx = w / 2, cy = h * 0.46;
    const skull = (y = cy, s = 1) => {
      c.fillStyle = '#f2f2f2'; c.beginPath(); c.arc(cx, y, 15 * s, 0, 7); c.fill(); c.fillRect(cx - 8 * s, y + 8 * s, 16 * s, 10 * s);
      c.fillStyle = '#111'; c.beginPath(); c.arc(cx - 6 * s, y, 4.5 * s, 0, 7); c.arc(cx + 6 * s, y, 4.5 * s, 0, 7); c.fill();
      c.fillRect(cx - 4 * s, y + 13 * s, 2, 5 * s); c.fillRect(cx, y + 13 * s, 2, 5 * s); c.fillRect(cx + 4 * s, y + 13 * s, 2, 5 * s);
    };
    const bones = () => { c.strokeStyle = '#f2f2f2'; c.lineWidth = 7; c.lineCap = 'round'; c.beginPath(); c.moveTo(cx - 24, cy + 26); c.lineTo(cx + 24, cy - 14); c.moveTo(cx - 24, cy - 14); c.lineTo(cx + 24, cy + 26); c.stroke(); };
    if (design === 'tricornio') {
      bones(); skull(cy + 4);
      c.fillStyle = '#3a2a1a'; c.beginPath(); c.moveTo(cx - 26, cy - 6); c.quadraticCurveTo(cx, cy - 32, cx + 26, cy - 6); c.quadraticCurveTo(cx, cy - 14, cx - 26, cy - 6); c.fill();
      c.strokeStyle = '#d8b040'; c.lineWidth = 2; c.stroke();
    } else if (design === 'espadas') {
      c.strokeStyle = '#d8d8e0'; c.lineWidth = 4; c.lineCap = 'round';
      for (const s of [-1, 1]) { c.beginPath(); c.moveTo(cx - s * 30, cy + 28); c.quadraticCurveTo(cx, cy, cx + s * 28, cy - 26); c.stroke(); c.fillStyle = '#d8b040'; c.fillRect(cx - s * 26 - 5, cy + 18, 10, 4); }
      skull(cy - 2, 0.9);
    } else if (design === 'llamas') {
      const fl = ['#e8501e', '#f08a20', '#f8c040'];
      for (let k = 0; k < 3; k++) { c.fillStyle = fl[k]; c.beginPath(); c.moveTo(cx - 30 + k * 5, cy + 28); for (let i = 0; i <= 6; i++) c.quadraticCurveTo(cx - 30 + k * 5 + i * (10 - k * 1.5) - 3, cy - 24 + k * 9 + (i % 2) * 14, cx - 30 + k * 5 + (i + 1) * (10 - k * 1.5), cy + 6); c.lineTo(cx + 30 - k * 5, cy + 28); c.fill(); }
      skull(cy + 2);
    } else if (design === 'ancla') {
      c.strokeStyle = '#f2f2f2'; c.fillStyle = '#f2f2f2'; c.lineWidth = 5; c.lineCap = 'round';
      c.beginPath(); c.moveTo(cx, cy - 20); c.lineTo(cx, cy + 24); c.moveTo(cx - 12, cy - 12); c.lineTo(cx + 12, cy - 12); c.stroke();
      c.beginPath(); c.arc(cx, cy + 6, 20, 0.2, Math.PI - 0.2); c.stroke();
      c.beginPath(); c.arc(cx, cy - 25, 5, 0, 7); c.stroke();
      c.fillStyle = '#f0e0a0'; c.beginPath(); c.arc(cx + 34, cy - 18, 11, 0, 7); c.fill(); c.fillStyle = '#111'; c.beginPath(); c.arc(cx + 39, cy - 21, 10, 0, 7); c.fill();
    } else if (design === 'corona') {
      bones(); skull(cy + 5);
      c.fillStyle = '#e8c050'; c.beginPath(); c.moveTo(cx - 16, cy - 8); c.lineTo(cx - 18, cy - 26); c.lineTo(cx - 8, cy - 16); c.lineTo(cx, cy - 30); c.lineTo(cx + 8, cy - 16); c.lineTo(cx + 18, cy - 26); c.lineTo(cx + 16, cy - 8); c.fill();
      c.fillStyle = '#c01e3a'; c.beginPath(); c.arc(cx, cy - 13, 3, 0, 7); c.fill();
    } else return false;
    return true;
  };
  // Mascarones nuevos (misma escala que los del astillero)
  Shop.figurehead = function (kind) {
    const p = [];
    if (kind === 'tiburon') {
      p.push(M.loft({ z0: -0.35, z1: 0.62, n: 14, m: 14, prof: (t) => ({ rx: 0.3 * Math.sin(Math.PI * (0.25 + t * 0.7)) + 0.03, ry: 0.28 * Math.sin(Math.PI * (0.25 + t * 0.7)) + 0.03, y: -t * 0.04 }), color: (t, a, ca, sa) => (sa < -0.25 ? 0xeeeee6 : 0x6a7a88) }));
      p.push(M.ball(0.075, 0x6a7a88, 0, -0.03, 0.6, [1.1, 0.8, 1], 12, 8));
      p.push(M.xf(M.fin([[-0.14, 0], [0.16, 0], [-0.05, 0.36]], 0.04, 0x5a6a78), 0, 0.22, -0.02, 0, Math.PI / 2, 0));
      for (let i = 0; i < 9; i++) { const a = (i / 8 - 0.5) * 2.2; p.push(M.xf(M.paint(new THREE.ConeGeometry(0.018, 0.06, 4), 0xffffff), Math.sin(a) * 0.14, -0.06, 0.42 + Math.cos(a) * 0.05, Math.PI)); }
      p.push(M.xf(M.paint(new THREE.BoxGeometry(0.3, 0.03, 0.14), 0x7a1a1a), 0, -0.07, 0.45));
      for (const s of [-1, 1]) p.push(M.ball(0.035, 0x111111, s * 0.16, 0.06, 0.34));
    } else if (kind === 'aguila') {
      p.push(M.ball(0.32, 0x5a3a20, 0, -0.28, -0.08, [1.1, 0.9, 1.1], 16, 12));
      p.push(M.ball(0.28, 0xf6f4ee, 0, 0.02, 0.08, [1, 1.05, 1.1], 16, 12));
      p.push(M.tube([[0, 0.02, 0.32], [0, 0.0, 0.48], [0, -0.12, 0.54]], [0.09, 0.02], 10, 0xf0c030, 10));
      for (const s of [-1, 1]) { p.push(M.ball(0.045, 0xf8d040, s * 0.14, 0.08, 0.28)); p.push(M.ball(0.025, 0x111111, s * 0.155, 0.085, 0.31)); }
      for (let i = 0; i < 5; i++) p.push(M.xf(M.paint(new THREE.ConeGeometry(0.05, 0.22, 4), 0xeae6dc), (i - 2) * 0.07, 0.24, -0.1, -0.7, 0, (i - 2) * 0.12));
    } else if (kind === 'ballena') {
      p.push(M.loft({ z0: -0.4, z1: 0.6, n: 14, m: 16, prof: (t) => ({ rx: 0.4 * Math.sin(Math.PI * (0.3 + t * 0.55)) + 0.06, ry: 0.33 * Math.sin(Math.PI * (0.3 + t * 0.55)) + 0.05, y: 0 }), color: (t, a, ca, sa) => (sa < -0.35 ? (Math.sin(ca * 30) > 0 ? 0xe8e4dc : 0xb8b4ac) : 0x3a5a7a) }));
      for (const s of [-1, 1]) { p.push(M.ball(0.04, 0x111111, s * 0.3, 0.02, 0.28)); p.push(M.xf(M.fin([[0, 0], [0.26, -0.05], [0.2, -0.16]], 0.03, 0x34506e), s * 0.3, -0.15, 0.05, 0, s > 0 ? 0 : Math.PI, 0)); }
      p.push(M.xf(M.paint(new THREE.BoxGeometry(0.46, 0.02, 0.05), 0x22324a), 0, -0.1, 0.55));
    } else return null;
    return p;
  };

  // ------------------------------------------------------------------ vista previa 3D (tienda y personaje)
  const PV = (Shop.Preview = { canvas: null });
  let renderer, scene, cam, holder, model, raf = 0, rotY = 0.5, dragX = null, autoRot = true, pvKey = '';
  function ensure() {
    if (renderer) return;
    const canvas = (PV.canvas = document.createElement('canvas'));
    canvas.className = 'preview3d';
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, canvas });
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    scene = new THREE.Scene();
    cam = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
    scene.add(new THREE.HemisphereLight(0xfff4e0, 0x3a4a5a, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 2.4); sun.position.set(2, 4, 3); scene.add(sun);
    const rim = new THREE.DirectionalLight(0x9fd3ff, 1.2); rim.position.set(-3, 2, -3); scene.add(rim);
    holder = new THREE.Group(); scene.add(holder);
    canvas.addEventListener('pointerdown', (e) => { dragX = e.clientX; autoRot = false; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', (e) => { if (dragX !== null) { rotY += (e.clientX - dragX) * 0.012; dragX = e.clientX; } });
    canvas.addEventListener('pointerup', () => { dragX = null; });
  }
  function clear() {
    if (model && model.dispose) model.dispose();
    holder.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    holder.clear();
    model = null;
  }
  // o = { look, cos: [ids] } (personaje) o { fh: 'tiburon' } (mascarón) o { flag, sail } (se dibuja en 2D)
  // box: el elemento donde se coloca el lienzo de la vista previa
  PV.show = function (box, o) {
    ensure();
    if (PV.canvas.parentNode !== box) box.appendChild(PV.canvas);
    const key = JSON.stringify(o);
    if (key !== pvKey) {
      pvKey = key;
      clear();
      if (o.fh) {
        const geos = Shop.figurehead(o.fh) || [];
        if (geos.length) { const m = new THREE.Mesh(U.merge(geos), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide })); holder.add(m); }
        cam.position.set(2.1, 0.7, 1.5); cam.lookAt(0, 0, 0.1);
      } else {
        const L = G.Profile.lookHex(o.look);
        model = G.Character.create(L.shirt, { skin: L.skin, pants: L.pants });
        G.Equip.apply(model, o.cos || []);
        holder.add(model.root);
        model.update(0.016, { pos: new THREE.Vector3(0, 0, 0), yaw: 0, pitch: 0, speed: 0, onGround: true, swimming: false, swing: 0, holding: false });
        const pet = (o.cos || []).some((id) => /loro|mono|gaviota|caracol/.test(id)), face = (o.cos || []).some((id) => /parche|gafas|bigote|mascara/.test(id));
        cam.position.set(0, face ? 1.62 : pet ? 1.45 : 1.15, face ? 1.25 : pet ? 2.2 : 3.9);
        cam.lookAt(0, face ? 1.66 : pet ? 1.4 : 0.98, 0);
      }
    }
    if (!raf) loop();
  };
  PV.stop = function () { cancelAnimationFrame(raf); raf = 0; };
  PV.reset = () => { autoRot = true; rotY = 0.5; };
  let last = 0;
  function loop(t = 0) {
    raf = requestAnimationFrame(loop);
    const c = PV.canvas;
    if (!c || !c.isConnected || c.offsetParent === null) return;
    const dt = Math.min(0.05, (t - last) / 1000 || 0.016); last = t;
    const w = c.clientWidth, h = c.clientHeight;
    if (!w || !h) return;
    if (c.width !== Math.round(w * devicePixelRatio) || c.height !== Math.round(h * devicePixelRatio)) { renderer.setPixelRatio(devicePixelRatio); renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
    if (autoRot) rotY += dt * 0.5;
    holder.rotation.y = rotY;
    if (model) model.update(dt, { pos: new THREE.Vector3(0, 0, 0), yaw: 0, pitch: 0, speed: 0, onGround: true, swimming: false, swing: 0, holding: false });
    renderer.render(scene, cam);
  }
})();
