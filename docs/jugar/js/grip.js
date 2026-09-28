// Mano en primera persona que agarra de verdad lo que llevas.
// Tiene palma, cuatro dedos de tres falanges y pulgar. Según el objeto, los dedos se cierran alrededor
// del mango (herramientas y armas blancas), de la culata con el índice hacia el gatillo (armas de fuego)
// o sostienen el objeto en la palma rodeándolo según su tamaño (comida, piedras, cuencos…).
// Al cambiar de objeto la mano se abre y vuelve a cerrarse sobre el nuevo. El antebrazo va del codo
// (fuera de la pantalla) a la muñeca, esté donde esté la mano.
//
// Espacio de la mano (EM): origen en la línea de los nudillos; la palma mira a −X y el dorso a +X,
// los dedos estirados apuntan a −Z, la muñeca queda hacia +Z y el índice arriba (+Y).
(function () {
  'use strict';
  const G = window.G, U = G.U, V3 = THREE.Vector3;
  const Gp = (G.Grip = {});

  // Puño cerrado: radio del mango y altura del agarre sobre el origen del objeto
  const POWER = { hacha: 0.025, hacha_hierro: 0.025, pico: 0.025, pico_hierro: 0.025, lanza: 0.022, lanza_obsidiana: 0.022, arpon: 0.022, pala: 0.021,
    cana: 0.02, katana: 0.023, sable: 0.022, baston: 0.027, antorcha: 0.027, palo: 0.027, cerbatana: 0.021, catalejo: 0.029, bambu: 0.031, bandera: 0.01, dardo: 0.01 };
  const GRIP_Y = { catalejo: 0.08, bambu: 0.05, palo: 0.06, antorcha: 0.02 };
  // Armas de fuego: dónde está la culata y cómo girarla para que su eje quede vertical (+Y)
  const GUNS = { pistola: { p: [0, 0.0, 0.035], r: [-0.86, 0, 0], rh: 0.024 }, mosquete: { p: [0, 0.045, 0.1], r: [-1.3, 0, 0], rh: 0.028 } };
  Gp.kind = (id) => (!id ? 'empty' : POWER[id] ? 'power' : GUNS[id] ? 'gun' : 'palm');
  // Ajustes de la mano: giro del dorso hacia la cámara, tamaño respecto a los objetos y tamaño de lo que va en la palma
  const T = (Gp.T = { alpha: -0.9, scale: 1.3, palmItem: 0.8 });

  // Dedos (índice, corazón, anular, meñique): altura en la palma, nudillo (z), falanges y grosor
  const FINGERS = [
    { y: 0.029, z: 0.002, L: [0.040, 0.026, 0.022], r: 0.0105 },
    { y: 0.0095, z: -0.002, L: [0.044, 0.028, 0.023], r: 0.011 },
    { y: -0.0095, z: 0.001, L: [0.041, 0.026, 0.022], r: 0.0105 },
    { y: -0.028, z: 0.008, L: [0.032, 0.021, 0.018], r: 0.0092 },
  ];
  const KX = 0.011; // nudillos, algo hacia el dorso
  const THUMB = { b: new V3(0.006, 0.036, 0.056), L: [0.036, 0.028, 0.024], r: 0.0125 };
  const CHAINS = [...FINGERS.map((f) => ({ L: f.L, r: f.r })), { L: THUMB.L, r: THUMB.r }];
  const WRIST = new V3(0.017, 0, 0.098);
  const AXIS_Z = 0.014; // el mango cruza la palma justo detrás de los nudillos

  // ------------------------------------------------------------------ posturas (puntos de las articulaciones en EM)
  const _q = new THREE.Quaternion();
  // Cadena que se dobla: dirección inicial f, eje de giro a y ángulos acumulados
  function bend(base, f, a, ang, L) {
    const pts = [base.clone()], d = new V3();
    let acc = 0;
    for (let k = 0; k < 3; k++) {
      acc += ang[k];
      d.copy(f).applyQuaternion(_q.setFromAxisAngle(a, acc));
      pts.push(pts[k].clone().addScaledVector(d, L[k]));
    }
    return pts;
  }
  // Cadena que rodea un mango vertical (eje en x = cx, z = cz) de radio R; sign −1 = sentido horario visto desde arriba
  function wrap(base, cx, cz, R, sign, L, y1) {
    const pts = [base.clone()], total = L[0] + L[1] + L[2];
    R = Math.max(R, total / (Math.PI * 1.15)); // un mango muy fino: el puño no se mete en la palma
    let px = base.x - cx, pz = base.z - cz;
    for (let k = 0; k < 3; k++) {
      const d = Math.hypot(px, pz), a0 = Math.atan2(pz, px);
      let a1;
      if (Math.abs(d - R) < 1e-4) a1 = a0 + sign * 2 * Math.asin(Math.min(1, L[k] / (2 * R)));
      else {
        // Cruce del círculo del mango con el círculo de radio L alrededor del punto actual
        const c = (d * d + R * R - L[k] * L[k]) / (2 * d * R);
        a1 = Math.abs(c) <= 1 ? a0 + sign * Math.acos(c) : a0 + sign * L[k] / R;
      }
      px = Math.cos(a1) * R; pz = Math.sin(a1) * R;
      pts.push(new V3(cx + px, U.lerp(base.y, y1, (k + 1) / 3), cz + pz));
    }
    return pts;
  }
  const FWD = new V3(0, 0, -1), UP = new V3(0, 1, 0);
  function thumbBend(dir, toward, ang) {
    const f = dir.clone().normalize(), a = f.clone().cross(toward.clone().normalize()).normalize();
    return bend(THUMB.b, f, a, ang, THUMB.L);
  }
  // Puño alrededor de un mango de radio rh (el índice puede ir estirado: gatillo)
  function fist(rh, trigger) {
    const cx = -rh, out = FINGERS.map((f, i) => {
      const base = new V3(KX, f.y, f.z);
      if (i === 0 && trigger) return bend(base, new V3(0.18, 0.1, -1).normalize(), UP, [0.2, 0.55, 0.4], f.L);
      return wrap(base, cx, AXIS_Z, rh + f.r + 0.001, -1, f.L, f.y);
    });
    out.push(wrap(THUMB.b, cx, AXIS_Z, rh + THUMB.r + 0.001, 1, THUMB.L, 0.047));
    return out;
  }
  // Mano abierta que sostiene algo en la palma: c = cuánto se cierran los dedos (0 plana, 1 muy cerrada)
  function cup(c) {
    const out = FINGERS.map((f, i) => {
      const s = (1.5 - i) * 0.07; // dedos algo abiertos en abanico
      return bend(new V3(KX, f.y, f.z), new V3(0, s, -1).normalize(), UP, [0.35 + 0.75 * c, 0.3 + 0.8 * c, 0.2 + 0.6 * c], f.L);
    });
    out.push(thumbBend(new V3(-0.3, 0.55, -0.78), new V3(-1, -0.3, 0), [0.15 + 0.2 * c, 0.2 + 0.3 * c, 0.15 + 0.2 * c]));
    return out;
  }
  const OPEN = () => FINGERS.map((f) => bend(new V3(KX, f.y, f.z), FWD, UP, [0.15, 0.2, 0.12], f.L)).concat([thumbBend(new V3(-0.25, 0.6, -0.75), new V3(-1, -0.2, 0), [0.05, 0.1, 0.08])]);
  const RELAX = () => FINGERS.map((f, i) => bend(new V3(KX, f.y, f.z), FWD, UP, [0.75 + i * 0.08, 1.0, 0.7], f.L)).concat([thumbBend(new V3(-0.35, 0.5, -0.8), new V3(-1, -0.5, 0), [0.25, 0.35, 0.3])]);

  // ------------------------------------------------------------------ mallas
  // Plantillas sin índices (se copian transformadas en una sola malla: una llamada de dibujo para los dedos)
  const SPH = new THREE.SphereGeometry(1, 10, 7).toNonIndexed(), CYL = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true).toNonIndexed();
  const nS = SPH.attributes.position.count, nC = CYL.attributes.position.count;
  const PER = 4 * nS + 3 * nC; // por cadena: 4 bolas (nudillo, 2 articulaciones, punta) y 3 falanges

  Gp.create = function (vm, vmHand) {
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xc68d67, roughness: 0.75 });
    const armMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
    const root = new THREE.Group(), frame = new THREE.Group(), hand = new THREE.Group();
    vmHand.add(root); root.add(frame); frame.add(hand);
    // Palma, muñeca y relieve de los nudillos
    const palmParts = [];
    const pg = new THREE.SphereGeometry(1, 16, 12); pg.scale(0.018, 0.045, 0.053); pg.translate(0.014, 0.001, 0.045); palmParts.push(pg);
    const wg = new THREE.SphereGeometry(0.029, 12, 10); wg.scale(0.85, 1, 1); wg.translate(WRIST.x, 0, WRIST.z - 0.01); palmParts.push(wg);
    for (const f of FINGERS) { const k = new THREE.SphereGeometry(f.r * 1.15, 8, 6); k.translate(KX + 0.004, f.y, f.z + 0.004); palmParts.push(k); }
    const tb = new THREE.SphereGeometry(0.02, 10, 8); tb.scale(0.8, 1, 1.4); tb.translate(0.004, 0.03, 0.058); palmParts.push(tb); // base del pulgar
    const palm = new THREE.Mesh(U.merge(palmParts), skinMat);
    hand.add(palm);
    // Dedos (se reescriben cuando cambia la postura)
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(PER * 5 * 3), 3));
    fg.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(PER * 5 * 3), 3));
    const fingers = new THREE.Mesh(fg, skinMat);
    fingers.frustumCulled = false;
    hand.add(fingers);
    // Antebrazo: cilindro del codo a la muñeca (manga de la camisa junto al codo)
    const ag = new THREE.CylinderGeometry(0.043, 0.025, 1, 12, 8, true); ag.translate(0, 0.5, 0);
    ag.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(ag.attributes.position.count * 3), 3));
    const arm = new THREE.Mesh(ag, armMat);
    arm.frustumCulled = false;
    vm.add(arm);

    let cur = OPEN(), target = RELAX(), dirty = true, kind = 'empty';
    const rig = { root, frame, hand, kind: () => kind };

    rig.setLook = function (shirt, skin) {
      skinMat.color.set(skin ?? 0xc68d67);
      const sk = new THREE.Color(skin ?? 0xc68d67), sh = new THREE.Color(shirt), cuff = sh.clone().multiplyScalar(0.72);
      const p = ag.attributes.position, c = ag.attributes.color;
      for (let i = 0; i < p.count; i++) { const y = p.getY(i), col = y > 0.8 ? sh : y > 0.74 ? cuff : sk; c.setXYZ(i, col.r, col.g, col.b); }
      c.needsUpdate = true;
    };

    // Coge un objeto: postura según el tipo, el giro del objeto en la mano y, en la palma, lo apoya encima
    rig.hold = function (id, item, rot) {
      kind = Gp.kind(id);
      root.rotation.copy(rot);
      frame.position.set(0, 0, 0); frame.rotation.set(0, 0, 0);
      hand.rotation.set(0, 0, 0);
      let rh = 0.02, gy = 0;
      const s = T.scale;
      hand.scale.setScalar(s); if (item) item.scale.setScalar(1);
      if (kind === 'power') { rh = POWER[id]; gy = GRIP_Y[id] || 0; target = fist(rh / s); }
      else if (kind === 'gun') { const g = GUNS[id]; frame.position.fromArray(g.p); frame.rotation.fromArray(g.r); rh = g.rh; target = fist(rh / s, true); }
      else if (kind === 'palm') {
        // Tamaño del objeto: cuanto más pequeño, más se cierran los dedos
        const par = item.parent;
        if (par) par.remove(item);
        item.position.set(0, 0, 0); item.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(item), size = box.getSize(new V3()), w = Math.max(size.x, size.z) / 2;
        if (par) par.add(item);
        const k = T.palmItem;
        item.scale.setScalar(k);
        item.position.set(-(box.min.x + box.max.x) / 2 * k, -box.min.y * k, -(box.min.z + box.max.z) / 2 * k);
        target = cup(U.clamp((0.085 * s - w * k) / (0.06 * s), 0, 1));
        hand.rotation.set(0, 0, -Math.PI / 2); // palma hacia arriba
        hand.position.set(0, -0.003, 0).sub(new V3(0, 0, 0.042 * s).applyEuler(hand.rotation));
      } else target = RELAX();
      if (kind !== 'palm') {
        hand.rotation.set(0, T.alpha, 0); // el dorso algo girado hacia la cámara
        hand.position.set(0, gy, 0).sub(new V3(-rh, 0, AXIS_Z * s).applyEuler(hand.rotation));
      }
      cur = OPEN(); dirty = true; // se abre y se vuelve a cerrar sobre el nuevo objeto
    };

    const _m = new THREE.Matrix4(), _s = new V3(), _p = new V3(), _d = new V3(), _n = new V3();
    function put(src, count, off, pos, quat, scl) {
      _m.compose(pos, quat, scl);
      const sp = src.attributes.position.array, sn = src.attributes.normal.array, P = fg.attributes.position.array, N = fg.attributes.normal.array;
      for (let i = 0; i < count; i++) {
        const j = i * 3, o = (off + i) * 3;
        _p.set(sp[j], sp[j + 1], sp[j + 2]).applyMatrix4(_m);
        P[o] = _p.x; P[o + 1] = _p.y; P[o + 2] = _p.z;
        _n.set(sn[j] / scl.x, sn[j + 1] / scl.y, sn[j + 2] / scl.z).applyQuaternion(quat).normalize();
        N[o] = _n.x; N[o + 1] = _n.y; N[o + 2] = _n.z;
      }
      return off + count;
    }
    const Q0 = new THREE.Quaternion();
    function rebuild() {
      let off = 0;
      cur.forEach((pts, c) => {
        const r0 = CHAINS[c].r;
        for (let k = 0; k < 4; k++) { const r = r0 * (k === 0 ? 1.05 : k === 3 ? 0.82 : 1 - k * 0.06); off = put(SPH, nS, off, pts[k], Q0, _s.set(r, r, r)); }
        for (let k = 0; k < 3; k++) {
          _d.subVectors(pts[k + 1], pts[k]);
          const len = _d.length() || 1e-4, r = r0 * (1 - k * 0.07);
          _q.setFromUnitVectors(UP, _d.multiplyScalar(1 / len));
          off = put(CYL, nC, off, _p.addVectors(pts[k], pts[k + 1]).multiplyScalar(0.5).clone(), _q.clone(), _s.set(r, len, r));
        }
      });
      fg.attributes.position.needsUpdate = true; fg.attributes.normal.needsUpdate = true;
    }

    const _w = new V3(), _e = new V3();
    rig.update = function (dt) {
      // Los dedos van cerrándose hacia la postura (más rápido que un parpadeo)
      const k = 1 - Math.exp(-dt * 16);
      let moved = dirty;
      for (let c = 0; c < cur.length; c++) for (let j = 0; j < 4; j++) {
        const a = cur[c][j], b = target[c][j];
        if (a.distanceToSquared(b) > 1e-10) { a.lerp(b, k); moved = true; }
      }
      if (moved) { rebuild(); dirty = false; }
      // Antebrazo del codo (origen del brazo) a la muñeca
      vm.updateMatrixWorld(true);
      vm.worldToLocal(hand.localToWorld(_w.copy(WRIST)));
      _e.copy(_w).negate();
      const len = _e.length();
      arm.position.copy(_w);
      arm.quaternion.setFromUnitVectors(UP, _e.multiplyScalar(1 / len));
      arm.scale.set(1, len, 1);
    };
    return rig;
  };
})();
